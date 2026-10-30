import { createReadStream, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { buildCorpus, createIndex } from '../lib/rag.mjs';
import { runTriage } from '../lib/gemini.mjs';
import { unsafeDraft } from '../lib/policy.mjs';
const [input, output = '.private/evaluation.json'] = process.argv.slice(2);
if (!input)
    throw Error('Usage: node scripts/evaluate.mjs input.jsonl [report.json]');
const corpus = JSON.parse(readFileSync(process.env.CORPUS_PATH || '.private/corpus.json', 'utf8'));
const index = createIndex(buildCorpus(corpus));
const result = { mode: 'offline_no_external_requests', total: 0, errors: 0, category_labels: 0, priority_labels: 0, category_correct: 0, category_accuracy: null, priority_macro_f1: null, needs_human: 0, citations: 0, unknown_citations: 0, unsafe_drafts: 0, languages: {}, categories: {}, latency_ms: {}, limitations: ['Categories and priorities are evaluated only when input contains labels. Labels never enter the pipeline.', 'Offline latency excludes Gemini and HTTP.', 'Citation existence is not a semantic quality or native-speaker assessment.'] };
const latency = [], confusion = new Map;
for await (const line of createInterface({ input: createReadStream(input), crlfDelay: Infinity })) {
    if (!line.trim())
        continue;
    result.total++;
    try {
        const row = JSON.parse(line);
        const started = performance.now();
        const prediction = await runTriage(row, { index, allowExternal: false });
        latency.push(performance.now() - started);
        result.needs_human += Number(prediction.needs_human);
        result.languages[prediction.lang] = (result.languages[prediction.lang] || 0) + 1;
        result.categories[prediction.category] = (result.categories[prediction.category] || 0) + 1;
        if (row.category) {
            result.category_labels++;
            result.category_correct += Number(row.category === prediction.category);
        }
        if (row.priority) {
            result.priority_labels++;
            const key = row.priority + '|' + prediction.priority;
            confusion.set(key, (confusion.get(key) || 0) + 1);
        }
        for (const citation of prediction.draft_reply.cited) {
            result.citations++;
            if (!index.docs.some(d => `${d.section} § ${d.ref}` === citation))
                result.unknown_citations++;
        }
        result.unsafe_drafts += Number(unsafeDraft(prediction.draft_reply.text));
    }
    catch {
        result.errors++;
    }
}
latency.sort((a, b) => a - b);
const quantile = p => latency.length ? Number(latency[Math.ceil(p * latency.length) - 1].toFixed(3)) : null;
result.latency_ms = { p50: quantile(.5), p95: quantile(.95), max: quantile(1) };
result.category_accuracy = result.category_labels ? result.category_correct / result.category_labels : null;
if (result.priority_labels) {
    const f1 = ['p0', 'p1', 'p2', 'p3'].map(code => { const tp = confusion.get(code + '|' + code) || 0; let fp = 0, fn = 0; for (const [key, count] of confusion) {
        const [truth, pred] = key.split('|');
        if (truth !== code && pred === code)
            fp += count;
        if (truth === code && pred !== code)
            fn += count;
    } return 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : 0; });
    result.priority_macro_f1 = f1.reduce((a, b) => a + b, 0) / 4;
}
result.needs_human_rate = result.total - result.errors ? result.needs_human / (result.total - result.errors) : null;
writeFileSync(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
