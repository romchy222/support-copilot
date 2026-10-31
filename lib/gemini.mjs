import {editorialDraft} from './editorial.mjs';
import {retrievalQuery} from './retrieval-query.mjs';
import {wireSchema,buildWireRequest,decodeWire} from './gemini-wire.mjs';
import {GenerationCache,requestKey} from './generation-cache.mjs';
const generationCache=new GenerationCache();
import { estimateUsage } from './usage.mjs';
import { safeFallback } from './fallback.mjs';
import { prepareInput } from './input.mjs';
import { mandatoryHuman, permittedAutomatic, unsafeDraft } from './policy.mjs';
import { triage, titles, texts } from './triage.mjs';
import { retrieve } from './rag.mjs';
import { supportsCitation, inspectFinalDraft, citationMode } from './citation-policy.mjs';
export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const schema = { type: 'object', properties: { lang: { type: 'string', enum: ['ru', 'kk', 'uz', 'en', 'es', 'pt', 'und'] }, category: { type: 'string', enum: Object.keys(titles) }, priority: { type: 'string', enum: ['p0', 'p1', 'p2', 'p3'] }, text: { type: 'string' }, cited_ids: { type: 'array', items: { type: 'string' } }, quotes: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, quote: { type: 'string' } }, required: ['id', 'quote'] } }, needs_human: { type: 'boolean' }, confidence: { type: 'number' }, reasons: { type: 'array', items: { type: 'string' } } }, required: ['lang', 'category', 'priority', 'text', 'cited_ids', 'quotes', 'needs_human', 'confidence', 'reasons'] };
const fabricatedStatus = /передан[аоы]?\s+(?:на|в|админ|специал)|(?:обращение|жалоба)\s+(?:уже\s+)?рассмотрен|has been (?:forwarded|reviewed|resolved)|әкімшіге жіберілді|administratorga yuborildi/i;
function replyMatchesLanguage(value, documents) {
    let text = value.text;
    for (const d of documents)
        text = text.replaceAll(d.section, '').replaceAll(d.title, '');
    if (value.lang === 'kk')
        return /[әғқңөұүһі]/i.test(text);
    if (value.lang === 'ru')
        return /[а-яё]/i.test(text);
    if (['en', 'uz', 'es', 'pt'].includes(value.lang))
        return (text.match(/[a-z]{2,}/gi) || []).length >= 3;
    return true;
}
function redact(text) { return text.replace(/https?:\/\/\S+/gi, '<url>').replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '<email>').replace(/\b[A-Z][a-zA-Z0-9]{1,24}_[A-Z][a-zA-Z0-9]{1,24}\b/g, '<nick>').replace(/(?:\+?\d[\s()-]*){7,}/g, '<digits>').replace(/@[\w.]+/g, '<handle>'); }
export function validateGenerated(value, documents, kind, input) {
    if (!value || !schema.properties.lang.enum.includes(value.lang) || !Object.keys(titles).includes(value.category) || !value.category.startsWith(kind + '.') || !['p0', 'p1', 'p2', 'p3'].includes(value.priority) || typeof value.text !== 'string' || value.text.length < 5 || value.text.length > 4000 || typeof value.needs_human !== 'boolean' || typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1 || !Array.isArray(value.reasons) || value.reasons.length > 10 || !value.reasons.every(r => typeof r === 'string' && r.length < 500) || !Array.isArray(value.cited_ids) || !Array.isArray(value.quotes))
        throw new Error('invalid_model_output');
    if (!replyMatchesLanguage(value, documents))
        throw new Error('language_mismatch');
    if (fabricatedStatus.test(value.text) || unsafeDraft(value.text))
        throw new Error('unsafe_draft');
    if (value.cited_ids.length > 4 || new Set(value.cited_ids).size !== value.cited_ids.length)
        throw new Error('invalid_model_output');
    const selected = value.cited_ids.map(id => documents.find(d => d.id === id));
    if (selected.some(d => !d))
        throw new Error('unknown_citation');
    if (selected.some(d => !supportsCitation(value.category, d, input)))
        throw new Error('irrelevant_citation');
    for (const d of selected) {
        const q = value.quotes.find(q => q?.id === d.id && typeof q.quote === 'string' && q.quote.trim().length >= 12 && d.text.includes(q.quote));
        if (!q)
            throw new Error('unverified_quote');
    }
    ;
    for (const ref of value.text.match(/\b\d+\.\d+(?:\.\d+)*\b/g) || [])
        if (!selected.some(d => d.ref === ref))
            throw new Error('uncited_rule_in_text');
    if ((kind === 'complaint' || value.category === 'report.complaint') && !selected.length)
        throw new Error('missing_rules');
    // Conservative post-filter. Rejected drafts always fall back to the safe baseline.
    if (/(?:получит|выдадим|назначим).*(?:мут|бан|наказ)|(?:верн[её]м|возместим|разблокируем|разбаним)|(?:скриншот|запис[ьи]).*(?:видно|подтвержда)|жалоба рассмотрена|нарушение подтверждено|will (?:refund|unban|punish|restore)|we (?:have reviewed|will ban)|ақша.*қайтарамыз|бұғат.*аламыз|pul.*qaytaramiz|ban.*ochamiz|reembolsaremos|vamos (?:reembolsar|punir)/i.test(value.text))
        throw new Error('unsafe_draft');
    return selected;
}
/** @param {any} input @param {{index?:any,apiKey?:string,model?:string,fetcher?:any,timeoutMs?:number,allowExternal?:boolean,cache?:boolean}} [options] */
export async function runTriage(input, { index, apiKey, model = DEFAULT_MODEL, fetcher = fetch, timeoutMs = 4700, allowExternal = false, cache = true } = {}) {
    input = prepareInput(input);
    const baseline = triage(input);
    const text = input.messages.filter(m => m.role === 'player').map(m => m.text).join('\n');
    const documents = index ? retrieve(index,retrievalQuery(text,baseline.category),3).map(d=>({...d,text:d.text.slice(0,900)})) : [];
    let attempted = false, usage = null;
    const finalize = result => {
        let edited = editorialDraft(result, input);
        const errors = inspectFinalDraft(edited, index, input);
        if (errors.length) {
            edited = safeFallback(baseline, index, [], 'final_validation_failed', input);
            const t = texts[edited.draft_reply.lang] || texts.ru;
            edited.draft_reply.text = `${t.hello} ${t.clarify}`;
            edited.needs_human = true;
            edited.analysis.final_validation_errors = errors;
            edited.analysis.api_request_attempted = result.analysis.api_request_attempted;
            edited.analysis.usage = result.analysis.usage;
            for (const key of ['cost_usd', 'estimated_paid_cost_usd', 'free_tier_cost_usd', 'cache_hit']) {
                if (key in result.analysis) edited.analysis[key] = result.analysis[key];
            }
        }
        const mode = citationMode(edited);
        if (mode === 'missing_source_clarification') edited.needs_human = true;
        return { ...edited, analysis: { ...edited.analysis, citation_mode: mode, final_draft_checked: true, citation_relevance_check: 'conservative_rules_not_independent_review' } };
    };
    const fallback = reason => { const result = safeFallback(baseline, index, documents, reason, input); result.analysis.api_request_attempted = attempted; result.analysis.usage = usage; Object.assign(result.analysis, estimateUsage(model, usage)); if (!attempted)
        result.analysis.cost_usd = 0; return finalize(result); };
    if (!index)
        return fallback('rules_not_loaded');
    if (!allowExternal)
        return fallback('external_processing_disabled');
    if (!apiKey)
        return fallback('gemini_key_missing');
    if (!/^[a-zA-Z0-9.-]+$/.test(model))
        return fallback('invalid_model_configuration');
    const request=buildWireRequest(input,baseline,documents,redact);
    const key=cache?await requestKey(model,request):null;
    const cached=key?generationCache.get(key):null;
    let cacheHit=!!cached;
    try {
        let value;
        if(cached){value=cached.value;}else{
          attempted = true;
          const response=await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({...request,generationConfig:{temperature:.1,maxOutputTokens:600,responseMimeType:'application/json',responseJsonSchema:wireSchema(documents,input.kind),thinkingConfig:model.startsWith('gemini-2.5')?{thinkingBudget:0}:{thinkingLevel:'MINIMAL'}}}),signal:AbortSignal.timeout(timeoutMs)});
          if(!response.ok)return fallback(response.status===429?'gemini_quota_exceeded':response.status===401||response.status===403?'gemini_auth_error':`gemini_http_${response.status}`);
          const data=await response.json();usage=data.usageMetadata||null;
          const candidate=data.candidates?.[0];if(candidate?.finishReason!=='STOP')return fallback('gemini_incomplete_response');
          value=decodeWire(JSON.parse(candidate.content.parts.filter(p=>typeof p.text==='string'&&!p.thought).map(p=>p.text).join('')),documents);
        }
        const selected = validateGenerated(value, documents, input.kind, input);
        if(['kk','uz'].includes(baseline.lang)&&value.lang!==baseline.lang)return fallback('language_mismatch');
        if(key&&!cacheHit)generationCache.set(key,{value});
        const inputTruncated=input.messages.some(m=>m.text.length>2400);
        const needs_human = inputTruncated||mandatoryHuman(input, value.category) || value.needs_human || !permittedAutomatic(value.category, value.lang, selected.length > 0, value.confidence);
        const rank = ['p0', 'p1', 'p2', 'p3'];
        const priority = rank[Math.min(rank.indexOf(baseline.priority), rank.indexOf(value.priority))];
        return finalize({ ...baseline, lang: value.lang, category: value.category, priority, extracted: { ...baseline.extracted, rule_refs: selected.map(d => d.ref) }, draft_reply: { lang: value.lang === 'und' ? 'ru' : value.lang, text: value.text, cited: selected.map(d => d.section + ' \u00a7 ' + d.ref) }, needs_human, confidence: Math.min(value.confidence, .95), reasons:needs_human?['\u041d\u0443\u0436\u043d\u043e \u043f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c \u043e\u0431\u0441\u0442\u043e\u044f\u0442\u0435\u043b\u044c\u0441\u0442\u0432\u0430 \u0438 \u0447\u0435\u0440\u043d\u043e\u0432\u0438\u043a \u043e\u0442\u0432\u0435\u0442\u0430']:[], analysis: { engine: 'bm25-gemini-rag', model,input_truncated:inputTruncated,llm_status: 'generated', confidence_kind: 'model_self_assessment_not_calibrated', category_title: titles[value.category], knowledge_scope: 'full_rules_corpus', corpus_documents: index.docs.length, cited_sources: selected, retrieved: documents, usage,cache_hit:cacheHit,api_request_attempted:attempted,...(cacheHit?{cost_usd:0,estimated_paid_cost_usd:0}:estimateUsage(model,usage)), billing_note: 'Free tier eligibility and quota depend on the Google project; no paid fallback',intent_topic:baseline.analysis.intent_topic} });
    }
    catch (error) {
        return fallback(error.name === 'TimeoutError' || error.name === 'AbortError' ? 'gemini_timeout' : error.message && ['language_mismatch', 'invalid_model_output', 'unknown_citation', 'irrelevant_citation', 'unverified_quote', 'uncited_rule_in_text', 'missing_rules', 'unsafe_draft'].includes(error.message) ? error.message : 'gemini_invalid_response');
    }
}
