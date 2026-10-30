import {env} from 'cloudflare:workers';
import {createIndex} from './rag.mjs';
let cached:any;let loaded=0;
export function invalidateCorpus(){cached=undefined;loaded=0}
export async function getIndex(){if(cached&&Date.now()-loaded<60000)return cached;const object=await env.BUCKET?.get('rules-corpus-v1.json');if(!object)return null;const corpus=await object.json();cached=createIndex(corpus);loaded=Date.now();return cached}
