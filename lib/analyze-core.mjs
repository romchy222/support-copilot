import { prepareInput } from './input.mjs';
import { runTriage } from './gemini.mjs';

export async function bounded(operation, ms, onTimeout = () => {}) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation).then(value=>({value}),error=>({error:String(error?.message || error)})),
      new Promise(resolve=>{timer=setTimeout(()=>{onTimeout();resolve({timedOut:true});},Math.max(1,ms));}),
    ]);
  } finally { clearTimeout(timer); }
}

/** Shared orchestration also used by fault-injection tests.
 * @param {any} raw @param {any} options
 */
export async function analyzeWithBudget(raw, {getIndex,checkDuplicate=async()=>({checked:false,duplicate:null}),apiKey,model,allowExternal=false,budgetMs=2500,generate=runTriage}={}) {
  const started=performance.now(),input=prepareInput(raw);
  const remaining=()=>Math.max(1,budgetMs-(performance.now()-started)-15);
  const [knowledge,dedup]=await Promise.all([
    bounded(getIndex,Math.min(800,remaining())),
    bounded(()=>checkDuplicate(input),Math.min(250,remaining())),
  ]);
  const index=knowledge.value;
  const fallback=await runTriage(input,{index,allowExternal:false});
  const external=allowExternal && input.data_mode==='synthetic' && !!index && !!apiKey;
  let result=fallback, deadlineExceeded=!!knowledge.timedOut || !!dedup.timedOut;
  if(external && remaining()>40){
    const controller=new AbortController();
    const response=await bounded(()=>generate(input,{index,apiKey,model,allowExternal:true,timeoutMs:Math.max(1,Math.floor(remaining()-20)),signal:controller.signal}),remaining(),()=>controller.abort());
    if(response.value) result=response.value;
    else {
      deadlineExceeded ||= !!response.timedOut;
      result={...fallback,analysis:{...fallback.analysis,llm_status:response.timedOut?'request_deadline_exceeded':'generation_error',api_request_attempted:true,cost_usd:null,estimated_paid_cost_usd:null}};
    }
  }
  result.analysis={...result.analysis,request_budget_ms:budgetMs,deadline_exceeded:deadlineExceeded,storage_status:knowledge.timedOut?'timeout':knowledge.error?'error':'ok',dedup_checked:dedup.value?.checked || false,dedup_status:dedup.timedOut?'timeout':dedup.error?'error':'ok'};
  if(dedup.value?.duplicate){result.is_spam_or_duplicate=true;result.needs_human=true;result.analysis.duplicate_of=dedup.value.duplicate.id;}
  return {...result,latency_ms:Math.round(performance.now()-started)};
}
