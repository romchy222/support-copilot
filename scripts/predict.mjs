import {createReadStream,createWriteStream,existsSync,readFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {runTriage} from '../lib/gemini.mjs';
import {buildCorpus,createIndex} from '../lib/rag.mjs';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const corpusPath=process.env.CORPUS_PATH||'.private/corpus.json';
const index=existsSync(corpusPath)?createIndex(buildCorpus(JSON.parse(readFileSync(corpusPath,'utf8')))):null;
const [input,output]=process.argv.slice(2);if(!input||!output)throw new Error('Usage: node scripts/predict.mjs input.jsonl output.jsonl');
const out=createWriteStream(output);let line=0;for await(const text of createInterface({input:createReadStream(input),crlfDelay:Infinity})){if(!text.trim())continue;line++;try{const item=JSON.parse(text);const result=await runTriage(item,{index,apiKey:process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL,allowExternal:process.env.GEMINI_EXTERNAL_ENABLED==='true'&&item.data_mode==='synthetic'});out.write(JSON.stringify({ticket_id:item.ticket_id,...result})+'\n')}catch(e){out.write(JSON.stringify({line,error:e.message})+'\n');process.exitCode=1}}out.end();
