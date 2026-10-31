import fs from 'node:fs';
import assert from 'node:assert/strict';
import { assertContract } from '../lib/contract.mjs';
const [origin,countArg='240',concurrencyArg='8',mode='private']=process.argv.slice(2);
if (!origin || !/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin)) throw Error('Pass an explicit local origin');
const count=Number(countArg),concurrency=Number(concurrencyArg);
if(!Number.isInteger(count)||count<1||count>2000||!Number.isInteger(concurrency)||concurrency<1||concurrency>32)throw Error('Invalid load limits');
if(!['private','synthetic'].includes(mode))throw Error('Mode must be private or synthetic');
const samples=[
 ['report','Застрял в текстурах около гаража, сервер 4'],
 ['report','Оплатил донат, деньги списались, но покупка не пришла'],
 ['report','Аккаунтыма кіре алмаймын, ќўпиясөз өзгеріп кеткен'],
 ['report',"Salom, akkaunt parol o'zgargan, yordam bering"],
 ['complaint','Игрок Arman_Petrov оскорбил меня в чате'],
 ['complaint','Ойыншы мені чатта балағаттады, скриншот бар'],
 ['report','Hello, I am stuck near the garage, server 3'],
 ['report','Привет'],
];
const runId=Date.now(),results=[];let next=0;
const started=performance.now();
async function request(i){
 const before=performance.now(),[kind,text]=samples[i%samples.length];
 try{
  const response=await fetch(origin+'/triage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,data_mode:mode,ticket_id:`bench-${runId}-${i}`,reporter_hash:`synthetic-bench-${runId}-${i%40}`,created_at:new Date().toISOString(),messages:[{role:'player',text,attachments:kind==='complaint'?1:0}]}),signal:AbortSignal.timeout(6500)});
  const value=await response.json();assert.equal(response.status,200);assertContract(value);
  results.push({ms:performance.now()-before,status:value.analysis.llm_status,deadline:value.analysis.deadline_exceeded,cost:value.analysis.estimated_paid_cost_usd,external:value.analysis.api_request_attempted,error:false});
 }catch(error){results.push({ms:performance.now()-before,error:String(error.message)});}
}
// First request records the first-use/warmup path separately.
await request(next++);const firstRequest=results[0];
await Promise.all(Array.from({length:concurrency},async()=>{while(next<count)await request(next++);}));
const times=results.map(r=>r.ms).sort((a,b)=>a-b),q=p=>Math.round(times[Math.ceil(p*times.length)-1]);
const report={scope:'Local real HTTP endpoint with R2 emulator; not production latency',mode,count,concurrency,first_request_ms:Math.round(firstRequest.ms),errors:results.filter(r=>r.error).length,p50_ms:q(.5),p95_ms:q(.95),max_ms:q(1),elapsed_ms:Math.round(performance.now()-started),deadline_exceeded:results.filter(r=>r.deadline).length,external_requests:results.filter(r=>r.external).length,statuses:results.reduce((a,r)=>(a[r.status||'error']=(a[r.status||'error']||0)+1,a),{}),unknown_cost_requests:results.filter(r=>r.external&&r.cost==null).length,estimated_paid_cost_usd:results.some(r=>r.external&&r.cost==null)?null:results.reduce((s,r)=>s+(r.cost||0),0),passes_p95_limit:q(.95)<=5000};
fs.writeFileSync(`.private/benchmark-http-${mode}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(report.errors||!report.passes_p95_limit)process.exitCode=1;
