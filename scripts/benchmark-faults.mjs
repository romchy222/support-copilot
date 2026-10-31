import fs from 'node:fs';
import http from 'node:http';
import {analyzeWithBudget} from '../lib/analyze-core.mjs';
import {buildCorpus,createIndex} from '../lib/rag.mjs';
import {runTriage} from '../lib/gemini.mjs';
import {assertContract} from '../lib/contract.mjs';
const index=createIndex(buildCorpus({rules:{rules:[{id:1,category:'Synthetic',text:'Synthetic fixture',points:[{ref:'DEMO',text:'Unrelated synthetic material'}]}]},taxonomy:{categories:[]}}));
const pending=()=>new Promise(()=>{});
const server=http.createServer(async(req,res)=>{
 try{
  const scenario=new URL(req.url,'http://local').pathname.slice(1);
  const r=await analyzeWithBudget({kind:'report',data_mode:'synthetic',messages:[{role:'player',text:'Застрял у гаража, сервер 4'}]},{
   getIndex:scenario==='storage-stall'?pending:scenario==='storage-error'?async()=>{throw Error('injected storage error')}:async()=>index,
   checkDuplicate:scenario==='dedup-stall'?pending:async()=>({checked:true,duplicate:null}),
   allowExternal:['model-stall','model-quota'].includes(scenario),apiKey:'synthetic-test-key',
   generate:scenario==='model-stall'?pending:(input,options)=>runTriage(input,{...options,fetcher:async()=>({ok:false,status:429})}),
  });
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(r));
 }catch(error){res.writeHead(500);res.end(JSON.stringify({error:error.message}));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port,rows=[];
try{
 for(const scenario of ['storage-stall','dedup-stall','model-stall','model-quota','storage-error']){
  const samples=await Promise.all(Array.from({length:6},async()=>{const start=performance.now();const response=await fetch(`http://127.0.0.1:${port}/${scenario}`);const value=await response.json();assertContract(value);if(response.status!==200)throw Error('HTTP failure');return {ms:Math.round(performance.now()-start),status:value.analysis.llm_status,needs_human:value.needs_human,deadline:value.analysis.deadline_exceeded};}));
  samples.sort((a,b)=>a.ms-b.ms);rows.push({scenario,count:samples.length,p95_ms:samples.at(-1).ms,all_need_human:samples.every(r=>r.needs_human),statuses:[...new Set(samples.map(r=>r.status))],deadline_exceeded:samples.filter(r=>r.deadline).length});
 }
 const report={scope:'Synthetic fault injection over HTTP using the same analyzeWithBudget orchestration, not a live provider/storage outage',budget_ms:4300,rows,passes:rows.every(r=>r.p95_ms<=5000&&r.all_need_human)};
 fs.writeFileSync('.private/benchmark-faults.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.passes)process.exitCode=1;
}finally{await new Promise(resolve=>server.close(resolve));}
