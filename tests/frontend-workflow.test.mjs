import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesFilters,nextSteps,dirtyRecords} from '../public/workflow-ui.mjs';
const record={id:'one',status:'open',draft:'saved',input:{kind:'complaint',messages:[{text:'Оплатил донат'}]},result:{category:'report.payment',priority:'p0',lang:'ru',extracted:{server:'12',has_evidence:true},analysis:{intent_topic:'payment'},needs_human:true}};
test('combined filters match exactly and missing server does not match a server filter',()=>{
 assert.ok(matchesFilters(record,{priority:'p0',lang:'ru',category:'report.payment',server:'12'}));
 assert.equal(matchesFilters(record,{priority:'p1',server:'12'}),false);
 assert.equal(matchesFilters({...record,result:{...record.result,extracted:{}}},{server:'12'}),false);
});
test('next actions request missing data but never claim an attachment was reviewed',()=>{
 const steps=nextSteps(record);assert.ok(steps.items.some(t=>t.includes('чека')));assert.ok(steps.items.some(t=>t.includes('не просматривает')));assert.ok(!steps.items.some(t=>t.includes('Запросите номер сервера')));
 const noServer={...record,result:{...record.result,extracted:{}}};assert.ok(nextSteps(noServer).items.includes('Запросите номер сервера.'));
 assert.match(nextSteps({...record,status:'approved',delivery:{mode:'test'}}).items[0],/не получил/);
});
test('dirty tracking distinguishes edited, saved and restored drafts',()=>{
 const drafts=new Map([['one','changed']]);assert.equal(dirtyRecords([record],drafts).length,1);
 drafts.set('one','saved');assert.equal(dirtyRecords([record],drafts).length,0);
});
