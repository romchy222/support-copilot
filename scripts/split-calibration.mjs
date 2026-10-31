import fs from 'node:fs';
import crypto from 'node:crypto';
import {normalize} from '../lib/triage.mjs';
const file=process.argv[2]||'.private/independent-labelled.jsonl';
const rows=fs.readFileSync(file,'utf8').trim().split(/\r?\n/).map(JSON.parse);
if(rows.some(r=>r.label_source!=='provided_manual_annotation'||!r.annotator||!r.ticket_id))throw Error('Provide complete manually labelled rows with annotator and stable IDs');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const groups=new Map();
for(const row of rows){const key=hash(row.kind+'|'+row.messages.filter(m=>m.role!=='admin').map(m=>m.role+':'+normalize(m.text).replace(/\b[a-z][a-z0-9]{1,24}_[a-z][a-z0-9]{1,24}\b/g,'<nick>').replace(/https?:\/\/\S+/g,'<url>')).join('|'));groups.set(key,[...(groups.get(key)||[]),row]);}
const ordered=[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
if(ordered.length<4)throw Error('Too few independent input groups');
if(ordered.some(([,rs])=>new Set(rs.map(r=>r.category)).size>1))throw Error('Conflicting category labels in duplicate group: resolve with the annotator');
const boundary=Math.min(ordered.length-1,Math.max(1,Math.floor(ordered.length*.7)));
const training=ordered.slice(0,boundary).flatMap(([,rs])=>rs),holdout=ordered.slice(boundary).flatMap(([,rs])=>rs);
fs.writeFileSync('.private/calibration-training.jsonl',training.map(row=>JSON.stringify(row)).join('\n')+'\n');
fs.writeFileSync('.private/calibration-holdout.jsonl',holdout.map(row=>JSON.stringify(row)).join('\n')+'\n');
fs.writeFileSync('.private/calibration-split-manifest.json',JSON.stringify({method:'frozen SHA256 ordering of normalized input groups, 70/30',input_sha256:hash(fs.readFileSync(file)),training:training.length,holdout:holdout.length,training_groups:boundary,holdout_groups:ordered.length-boundary,limitations:['Manual provenance is provided by the team, not independently verified by this script','Do not tune on the holdout or repeatedly select the best split']},null,2));
console.log(JSON.stringify({training:training.length,holdout:holdout.length,groups:ordered.length}));
