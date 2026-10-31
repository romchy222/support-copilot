import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {runTriage} from '../lib/gemini.mjs';
import {buildCorpus,createIndex} from '../lib/rag.mjs';
import {compareCalibration} from '../lib/calibration.mjs';
import {normalize} from '../lib/triage.mjs';
const [trainingFile='.private/review-development.jsonl',holdoutFile='.private/review-check.jsonl']=process.argv.slice(2);
const output=path.resolve('.private/calibration');fs.mkdirSync(output,{recursive:true});
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const files=['input.mjs','features.mjs','triage.mjs','rag.mjs','retrieval-query.mjs','policy.mjs','fallback.mjs','editorial.mjs','gemini.mjs','contract.mjs'];
const fingerprint=hash(files.map(file=>fs.readFileSync('lib/'+file)).join('\n'));
const corpusBytes=fs.readFileSync('.private/corpus.json');
const index=createIndex(buildCorpus(JSON.parse(corpusBytes)));
async function predictions(file){
 const bytes=fs.readFileSync(file,'utf8'),items=[];
 for(const line of bytes.trim().split(/\r?\n/)){
  const row=JSON.parse(line);
  if(typeof row.category!=='string'||!row.ticket_id)throw Error('Labelled rows need a category and stable ticket_id');
  const r=await runTriage(row,{index,allowExternal:false});
  const group_id=hash(row.kind+'|'+row.messages.filter(m=>m.role!=='admin').map(m=>m.role+':'+normalize(m.text).replace(/\b[a-z][a-z0-9]{1,24}_[a-z][a-z0-9]{1,24}\b/g,'<nick>').replace(/https?:\/\/\S+/g,'<url>')).join('|'));
  items.push({id:row.ticket_id,group_id,truth:row.category,score:r.confidence,score_kind:r.analysis.confidence_kind,correct:Number(row.category===r.category),language:r.lang,category:r.category,needs_human:r.needs_human,label_origin:row.annotation?.source||row.label_source||'unknown'});
 }
 return {items,sha256:hash(bytes)};
}
const train=await predictions(trainingFile),holdout=await predictions(holdoutFile);
const all=[...train.items,...holdout.items],conflicting=new Set(all.filter(a=>all.some(b=>a.group_id===b.group_id&&a.truth!==b.truth)).map(a=>a.group_id));
const originalCounts={training:train.items.length,holdout:holdout.items.length};
const unique=rows=>[...new Map([...rows].sort((a,b)=>b.id.localeCompare(a.id)).map(r=>[r.group_id,r])).values()];
train.items=unique(train.items.filter(r=>!conflicting.has(r.group_id)));
const trainGroups=new Set(train.items.map(r=>r.group_id));
const repeatedHoldout=holdout.items.filter(r=>trainGroups.has(r.group_id));
holdout.items=unique(holdout.items.filter(r=>!conflicting.has(r.group_id)&&!trainGroups.has(r.group_id)));
const exclusions={input_counts:originalCounts,conflicting_groups:conflicting.size,holdout_repeated_training_inputs:repeatedHoldout.length,retained_training:train.items.length,retained_holdout:holdout.items.length};
const comparison=compareCalibration(train.items,holdout.items);
const origins=[...new Set([...train.items,...holdout.items].map(r=>r.label_origin))];
const provisional=origins.some(origin=>origin!=='provided_manual_annotation');
const report={target:'correctness_of_category_not_draft_quality',mode:'offline_shadow_only',exclusions,label_origins:origins,labels_independently_verified:false,provisional_labels:provisional,source_hashes:{training:train.sha256,holdout:holdout.sha256,corpus:hash(corpusBytes),pipeline:fingerprint},...comparison,by_language:[...new Set(holdout.items.map(r=>r.language))].map(language=>{const rows=holdout.items.filter(r=>r.language===language);return {language,count:rows.length,correct:rows.reduce((s,r)=>s+r.correct,0)};}),limitations:['No production confidence values or routing thresholds changed','Assistant labels are provisional and may share model biases','Category accuracy does not measure correctness of a draft, language quality, or safety for automatic reply','Independent human labels, separate untouched control data and adequate language/category coverage are required before considering deployment','No calibrated probability is published from this experiment']};
fs.writeFileSync(path.join(output,'candidate.json'),JSON.stringify({...comparison.candidate,pipeline_sha256:fingerprint,corpus_sha256:hash(corpusBytes),label_origins:origins,active:false},null,2));
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const metrics=m=>m?`Brier ${m.brier.toFixed(4)}, ECE ${m.ece.toFixed(4)}, n=${m.count}`:'нет данных';
const text=`# Диагностика калибровки Copilot\n\nРежим: только офлайн. Рабочие пороги и доля автоответов не менялись. Цель — правильность категории, а не вероятность правильности ответа или доказанность нарушения.\n\nОбучение: ${train.items.length}; отдельный контроль: ${holdout.items.length}. Повторения нормализованного ввода между исходными долями: ${exclusions.holdout_repeated_training_inputs}; они исключены из контроля. Внутренние дубли и группы с конфликтующими метками также исключаются. Исходные размеры: ${originalCounts.training}/${originalCounts.holdout}. Источники меток: ${origins.join(', ')}. Независимость разметки не подтверждена.\n\n| Оценка на контроле | Метрики |\n| --- | --- |\n| Исходный балл, весь контроль | ${metrics(comparison.before)} |\n| Исходный балл, поддерживаемый диапазон | ${metrics(comparison.before_supported)} |\n| Офлайн-кандидат, тот же диапазон | ${metrics(comparison.after_supported)} |\n\nБолее низкие Brier и ECE лучше на данном наборе; улучшение на саморазметке не доказывает качества на реальных обращениях. ECE зависит от выбранных интервалов и малого размера выборки.\n\n## Исходная шкала\n\n| Интервал | Примеров | Средний балл | Доля верных категорий | 95% интервал Уилсона |\n| --- | --- | --- | --- | --- |\n${comparison.before.reliability.map(b=>`| ${b.from.toFixed(1)}–${b.to.toFixed(1)} | ${b.count} | ${b.mean_score.toFixed(3)} | ${b.accuracy.toFixed(3)} | ${b.interval.lower.toFixed(3)}–${b.interval.upper.toFixed(3)} |`).join('\n')}\n\n## Ограничения\n\n${report.limitations.map(s=>'- '+s).join('\n')}\n\nКандидат хранится только в .private/calibration/candidate.json и не загружается сервисом. Рабочий confidence остаётся исходным баллом; интерфейс показывает его без знака процента. Полные результаты и хэши — в report.json рядом с этим файлом.\n`;
fs.writeFileSync(path.join(output,'REPORT.md'),text);
console.log(JSON.stringify({mode:report.mode,training:train.items.length,holdout:holdout.items.length,provisional_labels:provisional,before:comparison.before.brier,after:comparison.after_supported?.brier,ece_before:comparison.before.ece,ece_after:comparison.after_supported?.ece,deployment_eligible:false,output},null,2));
