import { registerDedup } from './dedup-store.mjs';
import { env } from 'cloudflare:workers';
import { getIndex } from './corpus-store';
import { analyzeWithBudget } from './analyze-core.mjs';

export async function analyze(input: any) {
  return analyzeWithBudget(input, {
    getIndex,
    checkDuplicate: (clean: any) => env.BUCKET ? registerDedup(env.BUCKET,clean) : Promise.resolve({checked:false,duplicate:null}),
    apiKey:env.LLM_API_KEY,
    model:env.LLM_MODEL || '',
    provider:'openai-compatible',
    baseUrl:env.LLM_BASE_URL || 'https://myapi.creitingameplays.com/v1',
    allowExternal:env.LLM_EXTERNAL_ENABLED === 'true',
  });
}
