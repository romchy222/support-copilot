import { registerDedup } from './dedup-store.mjs';
import { env } from 'cloudflare:workers';
import { getIndex } from './corpus-store';
import { analyzeWithBudget } from './analyze-core.mjs';

export async function analyze(input: any) {
  return analyzeWithBudget(input, {
    getIndex,
    checkDuplicate: (clean: any) => env.BUCKET ? registerDedup(env.BUCKET,clean) : Promise.resolve({checked:false,duplicate:null}),
    apiKey:env.GEMINI_API_KEY,
    model:env.GEMINI_MODEL,
    allowExternal:env.GEMINI_EXTERNAL_ENABLED === 'true',
  });
}
