import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { buildCorpus,createIndex } from '../lib/rag.mjs';
import { runTriage } from '../lib/gemini.mjs';
import { prepareInput } from '../lib/input.mjs';
const out=path.resolve('.private/review-ready');fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync('.private/tickets_valid.jsonl','utf8');
const index=createIndex(buildCorpus(JSON.parse(fs.readFileSync('.private/corpus.json','utf8'))));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const scrub=value=>String(value).replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'<email>').replace(/https?:\/\/\S+/gi,'<url>').replace(/(?:\+?\d[\s()-]*){7,}/g,'<digits>');
const rows=[];
for(const line of source.trim().split('\n')){
 const original=JSON.parse(line),input=prepareInput(original),prediction=await runTriage(input,{index,allowExternal:false});
 rows.push({original,input,prediction,sort:hash(String(original.ticket_id))});
}
rows.sort((a,b)=>a.sort.localeCompare(b.sort));
const groups=new Map();for(const row of rows.filter(r=>r.original.messages.some(m=>m.role==='admin'&&m.text.trim()))){const lang=row.prediction.lang;groups.set(lang,[...(groups.get(lang)||[]),row]);}
const selected=[];while(selected.length<100){let added=false;for(const group of groups.values()){if(group.length&&selected.length<100){selected.push(group.shift());added=true;}}if(!added)break;}
const blind=[],key=[];
for(const [i,row] of selected.entries()){
 const id='B'+String(i+1).padStart(3,'0'),modelFirst=parseInt(row.sort[0],16)%2===0;
 const human=row.original.messages.filter(m=>m.role==='admin').map(m=>m.text).join('\n');
 const candidates=modelFirst?[row.prediction.draft_reply.text,human]:[human,row.prediction.draft_reply.text];
 blind.push({id,language:row.prediction.lang,request:row.input.messages.map(m=>({role:m.role,text:scrub(m.text),attachments:m.attachments})),A:{text:scrub(candidates[0]),score_1_to_5:null},B:{text:scrub(candidates[1]),score_1_to_5:null},reviewer:null,comments:''});
 key.push({id,ticket_id:row.original.ticket_id,model_variant:modelFirst?'A':'B'});
}
const native=rows.filter(r=>['kk','uz'].includes(r.prediction.lang)).reduce((acc,row)=>{if(acc.filter(x=>x.language===row.prediction.lang).length<32)acc.push({id:'N'+String(acc.length+1).padStart(3,'0'),language:row.prediction.lang,request:row.input.messages.map(m=>({role:m.role,text:scrub(m.text)})),reply:row.prediction.draft_reply.text,reviewer:null,native_language:null,language_1_to_5:null,helpfulness_1_to_5:null,grounding_1_to_5:null,comments:''});return acc;},[]);
const annotations=rows.slice(0,120).map((r,i)=>({id:'C'+String(i+1).padStart(3,'0'),input:r.input,category:null,priority:null,language:null,annotator:null,comments:''}));
const write=(name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2));
write('blind-100.json',{status:'awaiting_independent_review',instructions:'Оцените варианты A и B независимо по шкале 1–5. Источник варианта скрыт; не открывайте blind-key.json. Не заполняйте оценки моделью.',items:blind});
write('blind-key.json',key);
write('native-review.json',{status:'awaiting_native_speakers',items:native});
write('independent-labels.json',{status:'unlabelled_frozen_before_future_tuning',items:annotations});
write('manifest.json',{created_at:new Date().toISOString(),source_sha256:hash(source),counts:{blind:blind.length,native:native.length,classification:annotations.length},files:Object.fromEntries(['blind-100.json','native-review.json','independent-labels.json'].map(file=>[file,hash(fs.readFileSync(path.join(out,file)))])),limitations:['Независимые оценки ещё не получены','Пакет содержит закрытые данные кейса и не предназначен для публикации','Реальная выборка может не содержать все приоритеты; p0 дополнительно проверяется на синтетических сценариях']});
console.log(JSON.stringify({output:out,blind:blind.length,native:native.length,classification:annotations.length,status:'awaiting_humans'}));
