const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[ќґѕєјўї]/g, c => ({ќ:'қ',ґ:'ғ',ѕ:'ң',є:'ә',ј:'ө',ў:'ұ',ї:'ү'})[c]);
const stop = new Set('и в на по за из у я мне меня мой пожалуйста здравствуйте привет игрок сервер салем сәлем salom hello please server'.split(' '));
const literal = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function redactTemplate(text, record = {}) {
  let value = String(text || '');
  for (const nick of [record.input?.reported_nick, record.result?.extracted?.nickname].filter(Boolean)) value = value.replace(new RegExp(literal(nick), 'gi'), '{nickname}');
  return value.replace(/https?:\/\/\S+/gi,'{url}')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'{contact}')
    .replace(/\b[A-Za-z][A-Za-z0-9]{1,24}_[A-Za-z][A-Za-z0-9]{1,24}\b/g,'{nickname}')
    .replace(/@[\p{L}\p{N}_.]+/gu,'{contact}')
    .replace(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/g,'{date}')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g,'{time}')
    .replace(/(?:\+?\d[\s()-]*){7,}/g,'{contact}')
    .replace(/((?:сервер|server)\s*[#№:]?\s*)\d+/gi,'$1{server}')
    .replace(/(?<![\d.])\b\d+\b(?![.\d])/g,'{number}');
}

function tokens(text, record) {
  return new Set((normalize(redactTemplate(text,record)).replace(/\{[^}]+\}/g,' ').match(/[\p{L}]+/gu) || []).filter(w => w.length > 2 && !stop.has(w)).map(w => w.length > 6 ? w.slice(0,-2) : w));
}
const similarity = (a,b) => {
  if (Math.min(a.size,b.size) < 2) return 0;
  const common = [...a].filter(t => b.has(t)).length;
  return common / new Set([...a,...b]).size;
};
const unsafe = text => /(?:получит|назначим|выдадим).*(?:мут|бан|наказ)|верн[её]м|разбаним|will (?:refund|unban|punish)|ақша.*қайтарамыз|pul.*qaytaramiz/i.test(text);

// Complete-link lexical clusters prevent unrelated issues joining via a broad category.
export function suggestTemplates(records, { threshold = .42, minimum = 3, maxRecords = 400 } = {}) {
  const clusters = [];
  const seen = new Set();
  for (const record of records.filter(r => r.status === 'approved' && !r.result.is_spam_or_duplicate && !unsafe(r.draft)).slice(-maxRecords)) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    const text = record.input.messages.filter(m => m.role === 'player').map(m => m.text).join(' ');
    const item = { record, terms:tokens(text,record), reply:tokens(record.draft,record) };
    const key = record.result.category + ':' + record.result.draft_reply.lang;
    const group = clusters.find(c => c.key === key && c.items.every(other => similarity(other.terms,item.terms) >= threshold && similarity(other.reply,item.reply) >= .45));
    if (group) group.items.push(item); else clusters.push({key,items:[item]});
  }
  return clusters.filter(c => c.items.length >= minimum).map(c => {
    const medoid = [...c.items].sort((a,b) => c.items.reduce((s,x) => s+similarity(b.terms,x.terms)-similarity(a.terms,x.terms),0))[0];
    const text = redactTemplate(medoid.record.draft,medoid.record);
    const pairs = c.items.flatMap((x,i) => c.items.slice(i+1).map(y => similarity(x.terms,y.terms)));
    return {category:medoid.record.result.category,language:medoid.record.result.draft_reply.lang,count:c.items.length,text,variables:[...new Set(text.match(/\{[a-z]+\}/g)||[])],minimum_similarity:Math.round(Math.min(...pairs)*100),review_required:true};
  }).sort((a,b) => b.count-a.count);
}
