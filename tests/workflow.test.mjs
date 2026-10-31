import {test} from 'node:test';import assert from 'node:assert/strict';
import {prepareInput} from '../lib/input.mjs';import {mandatoryHuman,unsafeDraft} from '../lib/policy.mjs';import {createTicket,updateTicket,listTickets} from '../lib/ticket-store.mjs';import {registerDedup} from '../lib/dedup-store.mjs';import {estimateUsage} from '../lib/usage.mjs';
class Bucket {map=new Map;version=0;async get(key){const e=this.map.get(key);return e?{etag:e.etag,json:async()=>JSON.parse(e.text)}:null}async put(key,text,options={}){const current=this.map.get(key);if(options.onlyIf?.etagMatches&&current?.etag!==options.onlyIf.etagMatches||options.onlyIf?.etagDoesNotMatch==='*'&&current)return null;const entry={text,etag:String(++this.version)};this.map.set(key,entry);return entry}async list({prefix}){return {objects:[...this.map.keys()].filter(k=>k.startsWith(prefix)).sort().map(key=>({key})),truncated:false}}}
const input={kind:'report',messages:[{role:'player',text:'Застрял в текстурах у гаража'}],images_count:2,reporter_hash:'anonymous-1',created_at:'2026-10-30T10:00:00Z'};
const analyze=async()=>({lang:'ru',category:'report.help',needs_human:true,is_spam_or_duplicate:false,priority:'p2',draft_reply:{lang:'ru',text:'Уточните место события',cited:[]},reasons:[],analysis:{category_title:'Помощь'}});
test('dataset adapter includes image counts and discards outcomes and admin replies',()=>{const clean=prepareInput({...input,verdict:'approved',punishment:'secret',messages:[...input.messages,{role:'admin',text:'secret'}]});assert.equal(clean.messages.length,1);assert.equal(clean.messages[0].attachments,2);assert.equal(clean.verdict,undefined)});
test('mandatory policy cannot be bypassed by predicted question category',()=>{for(const text of ['Прошу разбанить аккаунт','Оплатил донат','Не могу войти, пароль изменён','To‘lov amalga oshdi, pul ketdi','Payment failed'])assert.equal(mandatoryHuman({...input,messages:[{role:'player',text}]},'report.question'),true)});
test('unsafe drafts are rejected in multiple languages',()=>{for(const text of ['Жалоба передана на рассмотрение','Игрок получит мут','We will refund your money','Ақшаңызды қайтарамыз','pulni qaytaramiz'])assert.ok(unsafeDraft(text),text)});
test('records and feedback survive storage reload, stale updates fail',async()=>{const bucket=new Bucket;const record=await createTicket(bucket,input,analyze);const changed=await updateTicket(bucket,record.id,{version:1,action:'save',draft:'Уточните место и время события'});assert.equal(changed.version,2);assert.equal((await listTickets(bucket)).records[0].draft,changed.draft);assert.equal(changed.history[1].previous_draft,'Уточните место события');await assert.rejects(()=>updateTicket(bucket,record.id,{version:1,action:'save',draft:'stale'}),e=>e.status===409)});
test('approve requires explicit human review; status transitions are stored',async()=>{const bucket=new Bucket,record=await createTicket(bucket,input,analyze);await assert.rejects(()=>updateTicket(bucket,record.id,{version:1,action:'approve',draft:record.draft}));const approved=await updateTicket(bucket,record.id,{version:1,action:'approve',draft:record.draft,reviewed:true});assert.equal(approved.status,'approved');assert.equal((await updateTicket(bucket,record.id,{version:2,action:'reopen',draft:record.draft})).status,'open')});
test('dedup requires same player, issue and one-hour window',async()=>{const bucket=new Bucket;assert.equal((await registerDedup(bucket,{...input,ticket_id:'a'},1000)).duplicate,null);assert.equal((await registerDedup(bucket,{...input,ticket_id:'b',created_at:'2026-10-30T10:30:00Z'},1001)).duplicate.id,'a');assert.equal((await registerDedup(bucket,{...input,ticket_id:'c',created_at:'2026-10-30T12:00:00Z'},1002)).duplicate,null);assert.equal((await registerDedup(bucket,{...input,reporter_hash:'other'},1003)).duplicate,null)});
test('paid estimate does not claim verified free billing',()=>{const cost=estimateUsage('gemini-3.5-flash-lite',{promptTokenCount:1000,candidatesTokenCount:200});assert.equal(cost.cost_usd,null);assert.equal(cost.estimated_paid_cost_usd,.0008)});
test('dedup works when tickets have no external ticket_id',async()=>{const bucket=new Bucket;await registerDedup(bucket,input,1000);assert.ok((await registerDedup(bucket,{...input,created_at:'2026-10-30T10:05:00Z'},1001)).duplicate)});

test('escalation persists responsible team, reason and trusted actor, and reopen clears active assignment',async()=>{
 const bucket=new Bucket,record=await createTicket(bucket,input,analyze),actor={id:'admin-1',name:'Admin'};
 await assert.rejects(()=>updateTicket(bucket,record.id,{version:1,action:'escalate',draft:record.draft}),/ответственного/);
 const escalation={team:'Платежи',assignee:'Смена 2',reason:'Проверить чек'};
 const saved=await updateTicket(bucket,record.id,{version:1,action:'escalate',draft:record.draft,escalation,actor:{id:'spoofed'}},{actor});
 assert.equal(saved.status,'escalated');assert.equal(saved.escalation.assignee,'Смена 2');assert.deepEqual(saved.history.at(-1).actor,actor);
 const reopened=await updateTicket(bucket,record.id,{version:2,action:'reopen',draft:record.draft});
 assert.equal(reopened.escalation,null);assert.deepEqual(reopened.history[1].escalation,escalation);
});
test('test delivery only sends approved text, persists a receipt and is idempotent',async()=>{
 const bucket=new Bucket,record=await createTicket(bucket,input,analyze);
 const send=(version,text=record.draft)=>updateTicket(bucket,record.id,{version,action:'send_test',draft:text});
 await assert.rejects(()=>send(1),/подтвердите/);
 await updateTicket(bucket,record.id,{version:1,action:'approve',draft:record.draft,reviewed:true});
 await assert.rejects(()=>send(2,'Unapproved edit'),/подтверждённый/);
 const sent=await send(2);assert.equal(sent.status,'approved');assert.equal(sent.delivery.mode,'test');assert.equal(sent.delivery.text,record.draft);
 const retry=await send(2);assert.equal(retry.delivery.receipt_id,sent.delivery.receipt_id);assert.equal(retry.version,sent.version);assert.equal(retry.history.filter(e=>e.action==='send_test').length,1);
 const reopened=await updateTicket(bucket,record.id,{version:sent.version,action:'reopen',draft:record.draft});assert.equal(reopened.delivery,null);assert.ok(reopened.history.find(e=>e.delivery));
});
