import { normalize } from './triage.mjs';
export function issueTokens(input) {
    return new Set(normalize(input.messages.filter(m => m.role === 'player').map(m => m.text).join(' ')).replace(/<[^>]*>/g, ' ').match(/[\p{L}\p{N}]+/gu)?.filter(w => w.length > 2 && !['меня', 'пожалуйста', 'здравствуйте', 'игрок', 'помогите'].includes(w)).map(w => w.length > 5 ? w.slice(0, -2) : w) || []);
}
export function similarIssue(a, b) {
    if (a.kind !== b.kind || a.server && b.server && a.server !== b.server || a.reported_hash && b.reported_hash && a.reported_hash !== b.reported_hash)
        return false;
    const x = issueTokens(a), y = issueTokens(b);
    if (!x.size || !y.size)
        return false;
    const intersection = [...x].filter(t => y.has(t)).length;
    return intersection / new Set([...x, ...y]).size >= .75;
}
export function findDuplicate(input, records) {
    if (!input.reporter_hash || !input.created_at)
        return null;
    const time = Date.parse(input.created_at);
    return records.find(record => record.input.reporter_hash === input.reporter_hash && record.input.created_at && Math.abs(time - Date.parse(record.input.created_at)) <= 3600000 && (!input.ticket_id || record.input.ticket_id !== input.ticket_id) && similarIssue(input, record.input)) || null;
}
export class Deduplicator {
    records = [];
    check(input, result) { const duplicate = findDuplicate(input, this.records); if (this.records.length >= 10000)
        this.records.shift(); this.records.push({ id: input.ticket_id || String(this.records.length), input, result }); return duplicate; }
}
