import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCorpus, createIndex } from '../lib/rag.mjs';
import { runTriage, validateGenerated } from '../lib/gemini.mjs';
import { inspectFinalDraft, supportsCitation } from '../lib/citation-policy.mjs';
import { editorialDraft } from '../lib/editorial.mjs';

const points = [
  {ref:'3.1', text:'Запрещено использовать репорт не по назначению.'},
  {ref:'3.4', text:'Жалобы на администраторов подаются через соответствующий раздел в течение 2-х дней.'},
  {ref:'5.4', text:'Запрещено нанесение урона жильцам и гостям дома.'},
  {ref:'5.3', text:'Игрок обязан доводить начатую RP-ситуацию до логического завершения.'},
];
const index = createIndex(buildCorpus({rules:{rules:[{id:1,category:'Общие правила игры',text:'Синтетические правила для регрессионного теста',points}]},taxonomy:{categories:[]}}));
const input = (text, kind='report') => ({kind,messages:[{role:'player',text}]});

test('help asks for details without presenting off-topic prohibition as a help instruction', async()=>{
  for (const text of ['Застрял в текстурах, сервер 4','Текстурада тұрып қалдым, көмектесіңізші']) {
    const r=await runTriage(input(text),{index});
    assert.equal(r.analysis.final_draft_checked,true);
    assert.deepEqual(r.draft_reply.cited,[]);
    assert.ok(!r.draft_reply.text.includes('3.1'));
    assert.ok(r.needs_human);
  }
});
test('narrow house and RP rules require matching context in the player allegation',()=>{
  const house=index.docs.find(d=>d.ref==='5.4'), rp=index.docs.find(d=>d.ref==='5.3');
  assert.equal(supportsCitation('complaint.dm',house,input('Убил меня без причины','complaint')),false);
  assert.equal(supportsCitation('complaint.dm',house,input('Убил жильца у дома','complaint')),true);
  assert.equal(supportsCitation('complaint.dm',rp,input('Убил меня','complaint')),false);
  assert.equal(supportsCitation('complaint.dm',rp,input('Вышел из игры и ушёл от РП последствий','complaint')),true);
});
test('model output with a real but irrelevant source is rejected',()=>{
  const source=index.docs.find(d=>d.ref==='3.1');
  const output={lang:'ru',category:'report.help',priority:'p2',text:'Помощь оказывается по пункту 3.1.',cited_ids:[source.id],quotes:[{id:source.id,quote:source.text}],needs_human:true,confidence:.9,reasons:[]};
  assert.throws(()=>validateGenerated(output,[source],'report',input('Застрял')),/irrelevant_citation/);
});
test('complaint without a supporting source is an explicit human clarification', async()=>{
  const r=await runTriage(input('Мешает мероприятию','complaint'),{index});
  assert.equal(r.analysis.citation_mode,'missing_source_clarification');
  assert.ok(r.needs_human);assert.deepEqual(r.draft_reply.cited,[]);
  assert.deepEqual(inspectFinalDraft(r,index,input('Мешает мероприятию','complaint')),[]);
});
test('final validation detects rule claims introduced after generation',()=>{
  const r={category:'report.help',draft_reply:{text:'По пункту 3.1 администратор обязан помочь.',cited:[]},analysis:{cited_sources:[]}};
  assert.ok(inspectFinalDraft(r,index,input('Застрял')).includes('unsupported_rule_claim'));
});
test('editorial appeal text repeats supported procedure without inventing senior-admin routing',()=>{
  const source=index.docs.find(d=>d.ref==='3.4');
  const result={category:'complaint.admin',draft_reply:{lang:'ru',text:'Уточните обстоятельства',cited:['Общие правила игры § 3.4']},extracted:{server:'1'},analysis:{cited_sources:[source]}};
  const revised=editorialDraft(result,input('Админ выдал мут','complaint'));
  assert.match(revised.draft_reply.text,/двух дней/);
  assert.ok(!revised.draft_reply.text.includes('старшей администрацией'));
});
