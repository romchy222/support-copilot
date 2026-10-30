import {readFileSync,writeFileSync} from 'node:fs';
const [input='.private/tickets_valid.jsonl',output='.private/review-set.jsonl']=process.argv.slice(2);
const rows=readFileSync(input,'utf8').trim().split(/\r?\n/).map(JSON.parse).filter((_,i)=>i%10===0).map(({ticket_id,kind,messages,images_count,reported_nick,rule_refs_raw,reporter_hash,created_at})=>({ticket_id,kind,messages:messages.filter(m=>m.role!=='admin'),images_count,reported_nick,rule_refs_raw,reporter_hash,created_at,category:null,priority:null}));
writeFileSync(output,rows.map(JSON.stringify).join('\n')+'\n');console.log(`${rows.length} private records prepared for independent annotation.`);
