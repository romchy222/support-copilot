import {readFileSync,writeFileSync} from 'node:fs';
const report=JSON.parse(readFileSync('.private/smoke-live.json','utf8'));
const packet=report.rows.map(row=>({id:row.name,language:row.lang,reply:row.reply,cited:row.cited,review:{role:null,native_language:null,helpfulness_1_to_5:null,language_1_to_5:null,grounding_1_to_5:null,unsafe_promise:null,comments:''}}));
writeFileSync('.private/native-review.json',JSON.stringify({status:'awaiting_external_review',instructions:'Review the reply independently. Do not fill ratings automatically. Empty ratings are not scores.',items:packet},null,2));
console.log('Private independent-review packet prepared with empty ratings.');
