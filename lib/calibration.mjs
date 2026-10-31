const valid = row => Number.isFinite(row.score) && row.score >= 0 && row.score <= 1 && [0,1].includes(row.correct);
const mean = values => values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;

export function wilsonInterval(successes, count, z=1.96) {
  if (!count) return null;
  const p=successes/count,d=1+z*z/count,c=(p+z*z/(2*count))/d,h=z*Math.sqrt(p*(1-p)/count+z*z/(4*count*count))/d;
  return {lower:Math.max(0,c-h),upper:Math.min(1,c+h)};
}

export function calibrationMetrics(rows, bins=10) {
  if (!rows.length || rows.some(row=>!valid(row))) throw Error('Calibration rows require scores in [0,1] and binary correctness');
  const groups=Array.from({length:bins},()=>[]);
  rows.forEach(row=>groups[Math.min(bins-1,Math.floor(row.score*bins))].push(row));
  const reliability=groups.map((group,i)=>({from:i/bins,to:(i+1)/bins,count:group.length,mean_score:mean(group.map(r=>r.score)),accuracy:mean(group.map(r=>r.correct)),interval:wilsonInterval(group.reduce((n,r)=>n+r.correct,0),group.length)})).filter(g=>g.count);
  return {count:rows.length,accuracy:mean(rows.map(r=>r.correct)),mean_score:mean(rows.map(r=>r.score)),brier:mean(rows.map(r=>(r.score-r.correct)**2)),ece:reliability.reduce((sum,b)=>sum+b.count/rows.length*Math.abs(b.mean_score-b.accuracy),0),reliability};
}

// Laplace-smoothed PAVA; fit only on the training partition, never the holdout.
export function fitMonotone(rows) {
  if (!rows.length || rows.some(row=>!valid(row))) throw Error('Invalid calibration training data');
  const kinds=[...new Set(rows.map(row=>row.score_kind))];
  if (kinds.length!==1) throw Error('Do not mix heuristic scores and model self-assessments');
  const grouped=new Map();
  for(const row of rows){const group=grouped.get(row.score)||{min:row.score,max:row.score,count:0,successes:0};group.count++;group.successes+=row.correct;grouped.set(row.score,group);}
  const blocks=[];
  for(const group of [...grouped.values()].sort((a,b)=>a.min-b.min)){
    blocks.push({...group,weight:group.count+2,sum:group.successes+1});
    while(blocks.length>1){const a=blocks.at(-2),b=blocks.at(-1);if(a.sum/a.weight<=b.sum/b.weight)break;blocks.splice(-2,2,{min:a.min,max:b.max,count:a.count+b.count,successes:a.successes+b.successes,weight:a.weight+b.weight,sum:a.sum+b.sum});}
  }
  return {version:1,target:'category_correctness',score_kind:kinds[0],training_count:rows.length,status:'offline_candidate_not_active',blocks:blocks.map(b=>({...b,probability:b.sum/b.weight,interval:wilsonInterval(b.successes,b.count)}))};
}

export function applyMonotone(candidate,row) {
  if(candidate.score_kind!==row.score_kind) return {supported:false,reason:'different_score_kind'};
  if(!candidate.blocks.length || row.score<candidate.blocks[0].min || row.score>candidate.blocks.at(-1).max) return {supported:false,reason:'outside_training_range'};
  const block=candidate.blocks.find(b=>row.score<=b.max)||candidate.blocks.at(-1);
  return {supported:true,probability:block.probability,interval:block.interval,support:block.count};
}

export function compareCalibration(training,holdout) {
  const ids=rows=>new Set(rows.map(r=>r.id));
  if(training.some(r=>!r.id)||holdout.some(r=>!r.id)||ids(training).size!==training.length||ids(holdout).size!==holdout.length)throw Error('Every sample needs a unique stable ID');
  const trainIds=ids(training);if(holdout.some(r=>trainIds.has(r.id)))throw Error('Training/holdout overlap');
  const trainGroups=new Set(training.map(r=>r.group_id).filter(Boolean));
  if(holdout.some(r=>r.group_id&&trainGroups.has(r.group_id)))throw Error('Training/holdout input-group overlap');
  const candidate=fitMonotone(training),mapped=holdout.map(row=>({row,estimate:applyMonotone(candidate,row)}));
  const supported=mapped.filter(r=>r.estimate.supported);
  return {candidate,holdout_count:holdout.length,supported_holdout:supported.length,before:calibrationMetrics(holdout),before_supported:supported.length?calibrationMetrics(supported.map(r=>r.row)):null,after_supported:supported.length?calibrationMetrics(supported.map(r=>({...r.row,score:r.estimate.probability}))):null,unsupported:mapped.filter(r=>!r.estimate.supported).map(r=>({id:r.row.id,reason:r.estimate.reason})),deployment_eligible:false,policy_changed:false};
}
