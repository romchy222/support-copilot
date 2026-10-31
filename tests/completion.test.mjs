import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestTemplates,redactTemplate } from '../public/template-clusters.mjs';
import { analyzeWithBudget } from '../lib/analyze-core.mjs';
import { contractResult,assertContract } from '../lib/contract.mjs';
import { buildCorpus,createIndex } from '../lib/rag.mjs';
const input={kind:'report',messages:[{role:'player',text:'Помогите, застрял в текстурах, сервер 4'}]};
const index=createIndex(buildCorpus({rules:{rules:[{id:1,category:'Synthetic',text:'Synthetic',points:[{ref:'1.1',text:'Synthetic unrelated rule'}]}]},taxonomy:{categories:[]}}));
const pending=()=>new Promise(()=>{});

test('storage stalls do not prevent a bounded safe triage response',async()=>{
 const start=performance.now();const r=await analyzeWithBudget(input,{getIndex:pending,checkDuplicate:pending,budgetMs:80});
 assert.ok(performance.now()-start<500);assert.ok(r.needs_human);assert.equal(r.analysis.storage_status,'timeout');assert.equal(r.analysis.deadline_exceeded,true);assertContract(r);
});
test('generation stalls abort the external request and preserve unknown billing',async()=>{
 let aborted=false;const r=await analyzeWithBudget({...input,data_mode:'synthetic'},{getIndex:async()=>index,apiKey:'test',allowExternal:true,budgetMs:100,generate:(_input,{signal})=>{signal.addEventListener('abort',()=>{aborted=true});return pending();}});
 assert.ok(aborted);assert.equal(r.analysis.llm_status,'request_deadline_exceeded');assert.equal(r.analysis.cost_usd,null);assert.ok(r.needs_human);
});
test('private inputs cannot use external generation even when enabled',async()=>{
 const r=await analyzeWithBudget(input,{getIndex:async()=>index,apiKey:'test',allowExternal:true,generate:()=>{throw Error('external request forbidden')}});
 assert.equal(r.analysis.api_request_attempted,false);assert.ok(r.analysis.final_draft_checked);
});
function record(id,text,draft='Укажите сервер 4 и точное место. Игрок Arman_Petrov, контакт test@example.com.'){
 return {id,status:'approved',draft,input:{messages:[{role:'player',text}]},result:{category:'report.help',draft_reply:{lang:'ru'},extracted:{nickname:'Arman_Petrov'},is_spam_or_duplicate:false}};
}
test('templates cluster similar issues rather than every approved ticket in the category',()=>{
 const rs=[record('a','Застрял в текстурах около гаража'),record('b','Застрял в текстурах около гаража, сервер 2'),record('c','Застрял в текстурах около гаража, сервер 4'),record('d','Игра вылетает при загрузке машины','Переустановите игру')];
 const groups=suggestTemplates(rs);assert.equal(groups.length,1);assert.equal(groups[0].count,3);assert.ok(groups[0].text.includes('{nickname}'));assert.ok(!groups[0].text.includes('test@example.com'));assert.ok(!groups[0].text.includes('сервер 4'));
});
test('template redaction preserves rule references but removes identities and incident values',()=>{
 const t=redactTemplate('Правило 2.1: Arman_Petrov, server 12, 20:30, https://example.com');
 assert.match(t,/2\.1/);assert.match(t,/\{server\}/);assert.ok(!t.includes('Arman_Petrov'));assert.ok(!t.includes('20:30'));
});
test('contract returns short references and preserves unambiguous sources separately',()=>{
 const r=contractResult({extracted:{},draft_reply:{cited:[]},analysis:{cited_sources:[{id:'a',ref:'2.1',section:'General'},{id:'b',ref:'2.1',section:'Event'}]}});
 assert.deepEqual(r.draft_reply.cited,['2.1']);assert.deepEqual(r.analysis.qualified_citations,['General § 2.1','Event § 2.1']);assert.equal(r.analysis.cited_sources.length,2);
});
