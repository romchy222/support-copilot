import { texts } from './triage.mjs';
import { supportsCitation } from './citation-policy.mjs';
const words = { ru: 'Основание для проверки', kk: 'Тексеру үшін ереже', uz: 'Tekshirish uchun qoida', en: 'Rule for review', es: 'Regla para revisión', pt: 'Regra para análise' };
const sectionNames = {
    kk: { 'Общие правила игры': 'Жалпы ойын ережелері', 'Правила жалоб': 'Шағым беру ережелері', 'Правила нахождения в Зелёной Зоне': 'Жасыл аймақта болу ережелері', 'RP термины и их описание': 'RP терминдері мен сипаттамасы' },
    uz: { 'Общие правила игры': 'Umumiy o‘yin qoidalari', 'Правила жалоб': 'Shikoyat berish qoidalari', 'Правила нахождения в Зелёной Зоне': 'Yashil hududda bo‘lish qoidalari', 'RP термины и их описание': 'RP atamalari va tavsifi' },
};
export function safeFallback(baseline, index, documents, reason, input) {
    const lang = baseline.draft_reply.lang, t = texts[lang] || texts.ru;
    const selected = documents.filter(d => supportsCitation(baseline.category, d, input)).slice(0, 1);
    let text = baseline.draft_reply.text;
    // A fallback never states a rule unless the corpus contains the supporting source.
    if (baseline.category.startsWith('complaint.') || baseline.category === 'report.complaint')
        text = `${t.hello} ${t.review} ${!selected.length ? t.clarify : ''}`.trim();
    if (baseline.category === 'report.help') text = `${t.hello} ${t.clarify}`;
    if (selected.length) {
        const sec = sectionNames[lang]?.[selected[0].section] || selected[0].section;
        text += `\n\n${words[lang] || words.ru}: ${sec} § ${selected[0].ref}.`;
    }
    const humanReasons = { gemini_key_missing: 'Генерация недоступна: ключ модели не настроен', rules_not_loaded: 'База правил недоступна', external_processing_disabled: 'Использован локальный режим без передачи данных провайдеру', gemini_timeout: 'Модель не успела ответить в установленное время', gemini_quota_exceeded: 'Квота модели исчерпана' };
    return { ...baseline, needs_human: !(reason === 'external_processing_disabled' && baseline.category === 'report.offtopic' && baseline.lang !== 'und'), draft_reply: { lang, text, cited: selected.map(d => `${d.section} § ${d.ref}`) }, extracted: { ...baseline.extracted, rule_refs: selected.map(d => d.ref) }, reasons: [...baseline.reasons, humanReasons[reason] || 'Черновик модели не прошёл проверку или модель недоступна'], analysis: { ...baseline.analysis, engine: 'rag-safe-fallback', llm_status: reason, knowledge_scope: index ? 'full_rules_corpus' : 'not_loaded', corpus_documents: index?.docs.length || 0, retrieved: documents, cited_sources: selected, cost_usd: 0, usage: null } };
}

