import { createReadStream, createWriteStream, existsSync, readFileSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import { createInterface } from 'node:readline';
import { runTriage } from '../lib/gemini.mjs';
import { prepareInput } from '../lib/input.mjs';
import { buildCorpus, createIndex } from '../lib/rag.mjs';
import { Deduplicator } from '../lib/dedup.mjs';
export async function predict(input, output) {
    if (!input || !output)
        throw Error('Usage: node scripts/predict.mjs input.jsonl output.jsonl');
    if (resolve(input) === resolve(output))
        throw Error('Input and output must be different files');
    await access(input);
    if (existsSync('.env.local'))
        process.loadEnvFile('.env.local');
    const path = process.env.CORPUS_PATH || '.private/corpus.json';
    if (!existsSync(path))
        throw Error('Corpus missing. Run python scripts/prepare-data.py first.');
    const index = createIndex(buildCorpus(JSON.parse(readFileSync(path, 'utf8'))));
    const out = createWriteStream(output);
    const completion = finished(out);
    completion.catch(() => { });
    const source = createReadStream(input);
    let lineNumber = 0, errors = 0;
    const dedup = new Deduplicator;
    try {
        for await (const line of createInterface({ input: source, crlfDelay: Infinity })) {
            if (!line.trim())
                continue;
            lineNumber++;
            let row;
            try {
                const original = JSON.parse(line), clean = prepareInput(original);
                const started = performance.now();
                const result = await runTriage(clean, { index, apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL, allowExternal: process.env.GEMINI_EXTERNAL_ENABLED === 'true' && clean.data_mode === 'synthetic' });
                const duplicate = dedup.check(clean, result);
                if (duplicate) {
                    result.is_spam_or_duplicate = true;
                    result.needs_human = true;
                    result.analysis.duplicate_of = duplicate.id;
                }
                row = { ticket_id: original.ticket_id, ...result, latency_ms: Math.round(performance.now() - started) };
            }
            catch (error) {
                errors++;
                row = { line: lineNumber, error: error.message };
            }
            if (!out.write(JSON.stringify(row) + '\n'))
                await once(out, 'drain');
        }
        out.end();
        await completion;
    }
    catch (error) {
        out.destroy();
        throw error;
    }
    return { processed: lineNumber, errors };
}
