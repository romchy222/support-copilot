export function contractResult(result) {
  const sources = result.analysis.cited_sources || [];
  const refs = [...new Set(sources.map(source => source.ref))];
  return {...result, extracted:{...result.extracted,rule_refs:refs},draft_reply:{...result.draft_reply,cited:refs},analysis:{...result.analysis,qualified_citations:sources.map(source=>`${source.section} § ${source.ref}`),contract_version:1}};
}

export function assertContract(result) {
  const fail = message => { throw new Error('Contract: '+message); };
  if (!['ru','kk','uz','en','es','pt','und'].includes(result.lang)) fail('lang');
  if (!/^(complaint|report)\.[a-z_]+$/.test(result.category)) fail('category');
  if (!['p0','p1','p2','p3'].includes(result.priority)) fail('priority');
  if (typeof result.is_spam_or_duplicate !== 'boolean' || typeof result.needs_human !== 'boolean') fail('flags');
  if (typeof result.confidence !== 'number' || !Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1) fail('confidence');
  const e=result.extracted,d=result.draft_reply;
  if (!e || !Array.isArray(e.rule_refs) || typeof e.has_evidence !== 'boolean' || !(e.nickname === null || typeof e.nickname === 'string') || !(e.server === null || typeof e.server === 'string')) fail('extracted');
  if (!d || !['ru','kk','uz','en','es','pt'].includes(d.lang) || typeof d.text !== 'string' || !d.text.trim() || !Array.isArray(d.cited) || !d.cited.every(r=>typeof r === 'string' && !r.includes('§'))) fail('draft_reply');
  if (!Array.isArray(result.reasons) || !result.reasons.every(r=>typeof r==='string')) fail('reasons');
  return result;
}
