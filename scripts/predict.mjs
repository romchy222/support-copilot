import {createReadStream,createWriteStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {triage} from '../lib/triage.mjs';
const [input,output]=process.argv.slice(2);if(!input||!output)throw new Error('Usage: node scripts/predict.mjs input.jsonl output.jsonl');
const out=createWriteStream(output);let line=0;for await(const text of createInterface({input:createReadStream(input),crlfDelay:Infinity})){if(!text.trim())continue;line++;try{const item=JSON.parse(text);out.write(JSON.stringify({ticket_id:item.ticket_id,...triage(item)})+'\n')}catch(e){out.write(JSON.stringify({line,error:e.message})+'\n');process.exitCode=1}}out.end();
