import { prepareInput } from './input.mjs';
import { registerDedup } from './dedup-store.mjs';
import { env } from 'cloudflare:workers';
import { getIndex } from './corpus-store';
import { runTriage } from './gemini.mjs';
export async function analyze(input: any) { const started = performance.now(); input = prepareInput(input); const dedup = env.BUCKET ? await registerDedup(env.BUCKET, input) : { checked: false, duplicate: null }; const index = await getIndex(); const result = await runTriage(input, { index, apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, timeoutMs: Math.max(100, 4700 - (performance.now() - started)), allowExternal: env.GEMINI_EXTERNAL_ENABLED === 'true' && input?.data_mode === 'synthetic' }); result.analysis.dedup_checked = dedup.checked; if (dedup.duplicate) {
    result.is_spam_or_duplicate = true;
    result.needs_human = true;
    result.analysis.duplicate_of = dedup.duplicate.id;
} return { ...result, latency_ms: Math.round(performance.now() - started) }; }
