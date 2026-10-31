// Site credentials are read from hidden stdin, retained only in memory.
import fs from 'node:fs';
import {createInterface} from 'node:readline';
import {assertContract} from '../lib/contract.mjs';
if(process.stdin.isTTY)process.stdin.setRawMode(true);
console.log('Ready for private Site benchmark JSON on stdin (hidden).');
const rl=createInterface({input:process.stdin,terminal:false});
rl.once('line',async line=>{
 rl.close();
 try{
  const {url,serviceToken,count=16}=JSON.parse(line);
  if(new URL(url).origin!=='https://grand-support-copilot-roman.zhekagood047.chatgpt.site')throw Error('Unexpected Site origin');
  if(!Number.isInteger(count)||count<1||count>64)throw Error('Invalid benchmark count');
  const samples=[['report','Застрял в текстурах у гаража, сервер 4'],['complaint','Игрок Arman_Petrov оскорбил моих родственников в чате, сервер 4'],['report','Оплатил донат, покупка не пришла'],['complaint','Ойыншы мені чатта балағаттады, скриншот бар'],['complaint',"Salom, o'yinchi meni chatda haqorat qildi"]];
  const rows=[];let next=0;
  await Promise.all(Array.from({length:2},async()=>{while(next<count){const i=next++,[kind,text]=samples[i%samples.length],start=performance.now();try{
   const r=await fetch(new URL('/triage',url),{method:'POST',headers:{'Content-Type':'application/json','OAI-Sites-Authorization':`Bearer ${serviceToken}`},body:JSON.stringify({kind,data_mode:'synthetic',messages:[{role:'player',text,attachments:kind==='complaint'?1:0}]}),signal:AbortSignal.timeout(6500)});
   if(r.status!==200)throw Error('HTTP '+r.status);const value=await r.json();assertContract(value);
   rows.push({ms:Math.round(performance.now()-start),status:value.analysis.llm_status,cost:value.analysis.estimated_paid_cost_usd,attempted:value.analysis.api_request_attempted,error:false});
  }catch(error){rows.push({ms:Math.round(performance.now()-start),error:error.name});}}}));
  const times=rows.map(r=>r.ms).sort((a,b)=>a-b),report={scope:'Published owner-private Site; synthetic inputs; concurrency 2',count,errors:rows.filter(r=>r.error).length,p95_ms:times[Math.ceil(.95*times.length)-1],max_ms:times.at(-1),statuses:rows.reduce((a,r)=>(a[r.status||'error']=(a[r.status||'error']||0)+1,a),{}),unknown_cost_requests:rows.filter(r=>r.attempted&&r.cost==null).length,known_estimated_paid_cost_usd:rows.reduce((s,r)=>s+(r.cost||0),0)};
  fs.writeFileSync('.private/benchmark-published.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.errors||report.p95_ms>5000)process.exitCode=1;
 }catch{console.error('Private Site benchmark failed; no credentials logged.');process.exitCode=1;}
});
