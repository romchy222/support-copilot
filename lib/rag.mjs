import { normalize } from './triage.mjs';
export function buildCorpus(input) { if (!input || !Array.isArray(input.rules?.rules) || !Array.isArray(input.taxonomy?.categories))
    throw new Error('Invalid corpus'); const docs = []; for (const section of input.rules.rules) {
    if (!Number.isInteger(section.id) || typeof section.category !== 'string' || typeof section.text !== 'string')
        throw new Error('Invalid section');
    const points = section.points?.length ? section.points : section.text.split(/\n(?=\s*[•\d])/).filter(s => s.trim()).map((text, i) => ({ ref: `term-${i + 1}`, text }));
    for (const point of points) {
        if (typeof point.ref !== 'string' || typeof point.text !== 'string')
            throw new Error('Invalid point');
        const parts = point.text.match(/[\s\S]{1,2000}/g) || [point.text];
        parts.forEach((text, i) => docs.push({ id: `${section.id}:${point.ref}:${i}`, ref: point.ref, section: section.category, title: `${section.category} · ${point.ref}`, text: text.trim() }));
    }
} if (!docs.length || docs.length > 3000)
    throw new Error('Invalid corpus size'); return { version: 1, sections: input.rules.rules.length, documents: docs, taxonomy: input.taxonomy }; }
const aliases = [[/оскорб|балағат|haqorat|insult|токсич/g, 'оскорбление игрок родственник чат'], [/чит|аим|aimbot|cheat|через стен|летает/g, 'стороннего программного обеспечения читы автокликеры модификации'], [/дм|\bdm\b|убил|өлтір|kill/g, 'убийство deathmatch dm'], [/зелен|зелён|\bgz\b/g, 'зеленая зона greenzone gz'], [/аккаунт|akkaunt|account|парол|құпиясөз|parol/g, 'аккаунт сохранность имущество доступ'], [/донат|төлем|to.lov|payment|оплат/g, 'покупка платеж деньги донат'], [/обман|мошен|scam|алда/g, 'обман имущество мошенничество'], [/застр|stuck|текстур|qotib/g, 'застрял помощь репорт'], [/жалоб|шағым|shikoyat|complaint/g, 'жалоба доказательства оформление'], [/разбан|апелляц|appeal|бұғат/g, 'обжалование наказание администрация жалоба']];
const stop = new Set('и в на не что как мне меня это он она для по за из от до the a is to please help салем сәлем здравствуйте'.split(' '));
function tokens(s) { return normalize(s).replace(/ё/g, 'е').match(/[\p{L}\p{N}]+/gu)?.filter(x => x.length > 1 && !stop.has(x)).map(x => x.length > 5 ? x.slice(0, -2) : x) || []; }
export function createIndex(corpus) { const docs = corpus.documents.map(d => { const ts = tokens(`${d.section} ${d.text}`), tf = new Map; for (const t of ts)
    tf.set(t, (tf.get(t) || 0) + 1); return { ...d, tf, len: ts.length }; }); const df = new Map; for (const d of docs)
    for (const t of d.tf.keys())
        df.set(t, (df.get(t) || 0) + 1); return { corpus, docs, df, avg: docs.reduce((n, d) => n + d.len, 0) / docs.length }; }
export function retrieve(index, query, limit = 6) { const normalized = normalize(query); let expanded = normalized; for (const [pattern, words] of aliases)
    if (normalized.match(pattern))
        expanded += ' ' + words; const ts = [...new Set(tokens(expanded))]; const terms = new Set(tokens(expanded)); return index.docs.map(d => { let score = 0, overlap = 0; for (const term of ts) {
    const tf = d.tf.get(term) || 0;
    if (!tf)
        continue;
    const idf = Math.log(1 + (index.docs.length - (index.df.get(term) || 0) + .5) / ((index.df.get(term) || 0) + .5));
    score += idf * (tf * 2.2) / (tf + 1.2 * (.25 + .75 * d.len / index.avg));
    if (terms.has(term))
        overlap++;
} return { id: d.id, ref: d.ref, section: d.section, title: d.title, text: d.text, score: Math.round(score * 1000) / 1000, overlap }; }).filter(d => d.score >= 0.5 && d.overlap > 0).sort((a, b) => b.score - a.score).slice(0, limit); }
