import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fitMonotone,applyMonotone,compareCalibration,calibrationMetrics,wilsonInterval} from '../lib/calibration.mjs';
import {confidencePresentation} from '../public/confidence-ui.mjs';
const row=(id,score,correct)=>({id,score,correct,score_kind:'heuristic_not_calibrated'});
test('PAVA pools nonmonotone observed correctness and never emits certainty',()=>{
 const candidate=fitMonotone([row('a',.4,1),row('b',.4,1),row('c',.8,0),row('d',.8,0)]);
 assert.equal(candidate.blocks.length,1);assert.equal(candidate.blocks[0].probability,.5);assert.equal(candidate.status,'offline_candidate_not_active');
 const perfect=fitMonotone([row('a',.7,1)]);assert.ok(perfect.blocks[0].probability<1);assert.ok(perfect.blocks[0].interval.lower<.5);
});
test('calibration rejects overlap, duplicate samples and mixed score sources',()=>{
 assert.throws(()=>compareCalibration([row('a',.5,1)],[row('a',.5,0)]),/overlap/);
 assert.throws(()=>compareCalibration([{...row('a',.5,1),group_id:'same-text'}],[{...row('b',.5,0),group_id:'same-text'}]),/group overlap/);
 assert.throws(()=>compareCalibration([row('a',.5,1),row('a',.5,1)],[row('b',.5,1)]),/unique/);
 assert.throws(()=>fitMonotone([row('a',.5,1),{...row('b',.9,1),score_kind:'model_self_assessment_not_calibrated'}]),/mix/);
});
test('calibration does not extrapolate or apply heuristic mapping to model scores',()=>{
 const c=fitMonotone([row('a',.4,0),row('b',.8,1)]);
 assert.equal(applyMonotone(c,row('c',.9,1)).supported,false);
 assert.equal(applyMonotone(c,{...row('d',.5,1),score_kind:'model_self_assessment_not_calibrated'}).supported,false);
});
test('Brier and ECE use the heldout correctness, not the training accuracy',()=>{
 const r=compareCalibration([row('a',.7,1),row('b',.7,1)],[row('c',.7,0)]);
 assert.equal(r.after_supported.accuracy,0);assert.equal(r.deployment_eligible,false);assert.equal(r.policy_changed,false);
 assert.equal(calibrationMetrics([row('a',.5,1),row('b',.5,0)]).brier,.25);
 assert.equal(wilsonInterval(0,0),null);
});
test('uncalibrated UI presents a score rather than a probability for both engines',()=>{
 for(const kind of ['heuristic_not_calibrated','model_self_assessment_not_calibrated']){
  const v=confidencePresentation({confidence:.95,analysis:{confidence_kind:kind}});
  assert.equal(v.value,'0,95');assert.equal(v.calibrated,false);assert.ok(!v.value.includes('%'));assert.match(v.note,/Не вероятность/);
 }
});
