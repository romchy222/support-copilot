import { normalize } from './triage.mjs';
import { unsafeDraft } from './policy.mjs';

const patterns = {
  'complaint.insult': /оскорблен|родственник|расизм|угрожать игрокам/i,
  'complaint.cheat': /стороннего программного обеспечения|читы/i,
  'complaint.scam': /махинации с игровой валютой|мошенничество по отношению|вымогательство любых игровых/i,
  'complaint.admin': /оспаривания действий администрации|жалобы на администраторов/i,
  'complaint.invalid': /раздел жалоб не предназначен|доказательств/i,
  'report.account': /сохранность своего аккаунта/i,
  'report.offtopic': /использовать репорт не по назначению/i,
};

// Conservative topical/context gate, not an independent semantic quality assessment.
export function supportsCitation(category, source, input) {
  const text = normalize((input?.messages || []).filter(m => m.role === 'player').map(m => m.text).join(' '));
  if (category === 'report.complaint') {
    if (/оскорб|оск\b|балағат|haqorat|insult/.test(text)) return supportsCitation('complaint.insult', source, input);
    if (/чит|аим|aimbot|cheat/.test(text)) return supportsCitation('complaint.cheat', source, input);
    if (/обман|мошен|scam|алда/.test(text)) return supportsCitation('complaint.scam', source, input);
    return supportsCitation('complaint.dm', source, input);
  }
  if (category === 'complaint.dm') {
    if (/зел[её]н|greenzone|\bgz\b/.test(text) && /убийств.*зел[её]ной зоне|deathmatch/i.test(source.text) && /зел[её]н/i.test(source.section)) return true;
    if (/дом|квартир|жильц|house|apartment/.test(text) && /урона жильцам|гостям дома/i.test(source.text)) return true;
    if (/rp|рп|afk|афк/.test(text) && /уход|выш|покин|заверш|последств/.test(text) && /доводить начатую rp-ситуацию/i.test(source.text)) return true;
    return false;
  }
  if (category === 'complaint.rmt_ads') {
    if (/реал|rmt|прода.*аккаунт|sell.*account/.test(text)) return /сделки.*за реальные деньги/i.test(source.text);
    return /реклам|advertis/.test(text) && /запрещена любая реклама/i.test(source.text);
  }
  return patterns[category]?.test(source.text) || false;
}

export function ruleClaims(text) {
  return /\b\d+\.\d+(?:\.\d+)*\b|§|запрещ|наруш.*(?:пункт|правил)|согласно.*правил|по\s+правилам|тарма[қғ]|тыйым|taqiql|bandida|prohibit|forbidden/i.test(text);
}

export function inspectFinalDraft(result, index, input) {
  const errors = [];
  const cited = result.analysis.cited_sources || [];
  for (const source of cited) {
    const original = index?.docs.find(d => d.id === source.id);
    if (!original || original.ref !== source.ref || original.section !== source.section || !original.text.includes(source.text)) errors.push('unknown_source');
    else if (!supportsCitation(result.category, source, input)) errors.push('irrelevant_source');
  }
  const expected = cited.map(d => `${d.section} § ${d.ref}`);
  const short = [...new Set(cited.map(d => d.ref))];
  if (![expected,short].some(refs=>JSON.stringify(result.draft_reply.cited) === JSON.stringify(refs))) errors.push('citation_mismatch');
  for (const ref of result.draft_reply.text.match(/\b\d+\.\d+(?:\.\d+)*\b/g) || []) {
    if (!cited.some(d => d.ref === ref)) errors.push('uncited_rule');
  }
  if (!cited.length && ruleClaims(result.draft_reply.text)) errors.push('unsupported_rule_claim');
  if (unsafeDraft(result.draft_reply.text)) errors.push('unsafe_draft');
  return [...new Set(errors)];
}

export function citationMode(result) {
  if (result.draft_reply.cited.length) return 'grounded';
  return ['report.payment', 'report.account', 'report.question', 'report.help'].includes(result.category) ? 'no_rule_needed_clarification' : 'missing_source_clarification';
}
