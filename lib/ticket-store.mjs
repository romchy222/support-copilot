import { InputError, prepareInput } from './input.mjs';
import { findDuplicate } from './dedup.mjs';
const prefix = 'tickets/';
const validId = id => typeof id === 'string' && /^\d{13}-[0-9a-f-]{36}$/.test(id);
const conflict = () => Object.assign(new Error('Обращение изменено в другой вкладке. Обновите очередь.'), { status: 409 });
/** @param {any} bucket @param {{cursor?:string,limit?:number}} [options] */
export async function listTickets(bucket, { cursor, limit = 50 } = {}) {
    const page = await bucket.list({ prefix, limit, cursor });
    const records = (await Promise.all(page.objects.map(async (o) => { const value = await bucket.get(o.key); return value ? await value.json() : null; }))).filter(Boolean);
    return { records, cursor: page.truncated ? page.cursor : null };
}
export async function createTicket(bucket, raw, analyze, { now = Date.now() } = {}) {
    const input = prepareInput(raw);
    input.created_at ||= new Date(now).toISOString();
    const id = `${String(9999999999999 - now).padStart(13, '0')}-${crypto.randomUUID()}`;
    const result = await analyze(input);
    const recent = await listTickets(bucket, { limit: 250 });
    const duplicate = findDuplicate(input, recent.records);
    if (duplicate) {
        result.is_spam_or_duplicate = true;
        result.needs_human = true;
        result.reasons.push('Повторное обращение этого игрока по той же проблеме в течение часа');
        result.analysis.duplicate_of = duplicate.id;
    }
    const record = { id, input, result, created_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString(), version: 1, status: 'open', draft: result.draft_reply.text, history: [{ action: 'created', at: new Date(now).toISOString() }] };
    await bucket.put(prefix + id + '.json', JSON.stringify(record), { httpMetadata: { contentType: 'application/json' } });
    return record;
}
export async function updateTicket(bucket, id, change, { now = Date.now() } = {}) {
    if (!validId(id))
        throw new InputError('Некорректный идентификатор');
    if (!change || !['save', 'approve', 'escalate', 'reopen'].includes(change.action))
        throw new InputError('Неизвестное действие');
    const object = await bucket.get(prefix + id + '.json');
    if (!object)
        throw Object.assign(new Error('Обращение не найдено'), { status: 404 });
    const record = await object.json();
    if (!Number.isInteger(change.version) || record.version !== change.version)
        throw conflict();
    if (typeof change.draft !== 'string' || !change.draft.trim() || change.draft.length > 8000)
        throw new InputError('Черновик должен содержать от 1 до 8000 символов');
    if (change.action === 'approve' && change.reviewed !== true)
        throw new InputError('Подтвердите проверку ответа администратором');
    if (record.status !== 'open' && change.action !== 'reopen')
        throw Object.assign(new Error('Сначала верните обращение в очередь'), { status: 409 });
    const event = { action: change.action, at: new Date(now).toISOString(), previous_draft: record.draft, draft: change.draft, reviewed: change.reviewed === true };
    record.draft = change.draft;
    record.version++;
    record.updated_at = event.at;
    record.status = ({ approve: 'approved', escalate: 'escalated', reopen: 'open', save: 'open' })[change.action];
    record.history = [...record.history, event].slice(-100);
    const written = await bucket.put(prefix + id + '.json', JSON.stringify(record), { onlyIf: { etagMatches: object.etag }, httpMetadata: { contentType: 'application/json' } });
    if (!written)
        throw conflict();
    return record;
}
