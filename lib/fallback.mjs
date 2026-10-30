import { texts } from './triage.mjs';
const words = { ru: 'Основание для проверки', kk: 'Тексеру үшін ереже', uz: 'Tekshirish uchun qoida', en: 'Rule for review', es: 'Regla para revisión', pt: 'Regra para análise' };
const sourceTerms = {
    'complaint.insult': /оскорблен|родственник/i,
    'complaint.cheat': /стороннего программного обеспечения|читы/i,
    'complaint.dm': /deathmatch|убийств|зеленой зоне|зелёной зоне/i,
    'complaint.scam': /обман|мошеннич/i,
    'complaint.rmt_ads': /реальные деньги|реальных денег|реклам/i,
    'complaint.admin': /обжалован|администратор/i,
    'complaint.invalid': /жалоб|доказательств/i,
    'report.complaint': /оскорблен|убийств|нарушен/i,
};
export function safeFallback(baseline, index, documents, reason) {
    const lang = baseline.draft_reply.lang, t = texts[lang] || texts.ru;
    const relevant = sourceTerms[baseline.category];
    const selected = relevant ? documents.filter(d => relevant.test(d.text)).slice(0, 1) : [];
    let text = baseline.draft_reply.text;
    // A fallback never states a rule unless the corpus contains the supporting source.
    if (baseline.category === 'complaint.insult' || baseline.category === 'report.complaint')
        text = `${t.hello} ${t.review}`;
    if (selected.length)
        text += `\n\n${words[lang] || words.ru}: ${selected[0].section} § ${selected[0].ref}.`;
    const humanReasons = { gemini_key_missing: 'Генерация недоступна: ключ модели не настроен', rules_not_loaded: 'База правил недоступна', external_processing_disabled: 'Использован локальный режим без передачи данных провайдеру', gemini_timeout: 'Модель не успела ответить в установленное время', gemini_quota_exceeded: 'Квота модели исчерпана' };
    return { ...baseline, needs_human: !(reason === 'external_processing_disabled' && baseline.category === 'report.offtopic' && baseline.lang !== 'und'), draft_reply: { lang, text, cited: selected.map(d => `${d.section} § ${d.ref}`) }, extracted: { ...baseline.extracted, rule_refs: selected.map(d => d.ref) }, reasons: [...baseline.reasons, humanReasons[reason] || 'Черновик модели не прошёл проверку или модель недоступна'], analysis: { ...baseline.analysis, engine: 'rag-safe-fallback', llm_status: reason, knowledge_scope: index ? 'full_rules_corpus' : 'not_loaded', corpus_documents: index?.docs.length || 0, retrieved: documents, cited_sources: selected, cost_usd: 0, usage: null } };
}
