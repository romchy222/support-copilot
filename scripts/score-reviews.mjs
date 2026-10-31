import fs from 'node:fs';
import {prepareInput} from '../lib/input.mjs';
const [file,kind]=process.argv.slice(2);
if(!file||!['blind','native','labels'].includes(kind))throw Error('Usage: node scripts/score-reviews.mjs rated.json blind|native|labels');
const packet=JSON.parse(fs.readFileSync(file,'utf8'));
const baseline=JSON.parse(fs.readFileSync('.private/review-ready/'+({blind:'blind-100.json',native:'native-review.json',labels:'independent-labels.json'}[kind]),'utf8'));
if(packet.items.length!==baseline.items.length || new Set(packet.items.map(i=>i.id)).size!==packet.items.length)throw Error('Review packet item mismatch');
for(const item of packet.items){const expected=baseline.items.find(i=>i.id===item.id);if(!expected)throw Error('Unknown review item');for(const key of kind==='blind'?['request','A','B']:kind==='native'?['request','reply']:['input']){const a=['A','B'].includes(key)?item[key]?.text:item[key],b=['A','B'].includes(key)?expected[key]?.text:expected[key];if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Review text changed: '+item.id);}}

const rated=packet.items.filter(i=>String(i.reviewer||i.annotator||'').trim());
const valid=value=>Number.isInteger(value)&&value>=1&&value<=5;
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
let result;
if(kind==='blind'){
 const key=JSON.parse(fs.readFileSync('.private/review-ready/blind-key.json','utf8'));
 const complete=rated.filter(i=>valid(i.A?.score_1_to_5)&&valid(i.B?.score_1_to_5));
 const scores=complete.map(i=>{const k=key.find(k=>k.id===i.id);if(!k)throw Error('Unknown blinded item');return {model:i[k.model_variant].score_1_to_5,human:i[k.model_variant==='A'?'B':'A'].score_1_to_5};});
 result={kind,total:packet.items.length,complete:complete.length,model_mean:mean(scores.map(s=>s.model)),reference_mean:mean(scores.map(s=>s.human)),limitations:'Ratings are supplied by named reviewers; independence and expertise must be confirmed separately.'};
}else if(kind==='native'){
 const complete=rated.filter(i=>valid(i.language_1_to_5)&&valid(i.helpfulness_1_to_5)&&valid(i.grounding_1_to_5)&&i.native_language===i.language);
 result={kind,total:packet.items.length,complete:complete.length,language_mean:mean(complete.map(i=>i.language_1_to_5)),helpfulness_mean:mean(complete.map(i=>i.helpfulness_1_to_5)),grounding_mean:mean(complete.map(i=>i.grounding_1_to_5))};
}else{
 const categories=new Set(JSON.parse(fs.readFileSync('.private/corpus.json','utf8')).taxonomy.categories.map(c=>c.code));
 const complete=rated.filter(i=>categories.has(i.category)&&i.category.startsWith(i.input.kind+'.')&&['p0','p1','p2','p3'].includes(i.priority)&&['ru','kk','uz','en','es','pt','und'].includes(i.language));
 result={kind,total:packet.items.length,complete:complete.length,priorities:[...new Set(complete.map(i=>i.priority))],languages:[...new Set(complete.map(i=>i.language))]};
 if(complete.length===packet.items.length)fs.writeFileSync('.private/independent-labelled.jsonl',complete.map(i=>JSON.stringify({...prepareInput(i.input),category:i.category,priority:i.priority,lang:i.language,label_source:'provided_manual_annotation',annotator:i.annotator})).join('\n')+'\n');
}
result.status=result.complete===result.total&&result.total?'complete_provided_ratings':'awaiting_human_ratings';
fs.writeFileSync(`.private/review-${kind}-summary.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
