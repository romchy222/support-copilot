import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {triage} from '../lib/triage.mjs';
const rows=fs.readFileSync(new URL('../examples/acceptance-synthetic.jsonl',import.meta.url),'utf8').trim().split('\n').map(JSON.parse);
test('authored synthetic acceptance covers six languages and every priority',()=>{
 assert.equal(new Set(rows.map(r=>r.lang)).size,6);assert.equal(new Set(rows.map(r=>r.priority)).size,4);
 for(const row of rows){const r=triage(row);assert.equal(r.lang,row.lang,row.ticket_id);assert.equal(r.category,row.category,row.ticket_id);assert.equal(r.priority,row.priority,row.ticket_id);}
});
test('cp1251 Kazakh substitutions and mixed Uzbek wording do not bypass critical escalation',()=>{
 for(const text of ['Аккаунтыма кіре алмаймын, ќўпиясөз өзгерді',"Salom, пароль o'zgargan, akkaunt kirmayapti"]){const r=triage({kind:'report',messages:[{role:'player',text}]});assert.equal(r.needs_human,true);assert.equal(r.priority,'p0');}
});
test('buying in Uzbek does not match the shooting substring and accented greeting identifies Portuguese',()=>{
 assert.equal(triage({kind:'report',messages:[{role:'player',text:'Salom, uy sotib olish qanday?'}]}).category,'report.question');
 assert.equal(triage({kind:'report',messages:[{role:'player',text:'Olá, como comprar uma casa?'}]}).lang,'pt');
});
