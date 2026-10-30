import { findDuplicate } from './dedup.mjs';
export async function registerDedup(bucket, input, now = Date.now()) {
    if (!input.reporter_hash || !input.created_at)
        return { checked: false, duplicate: null };
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.reporter_hash));
    const key = 'dedup/' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('') + '.json';
    for (let attempt = 0; attempt < 3; attempt++) {
        const object = await bucket.get(key);
        const records = object ? await object.json() : [];
        const recent = records.filter(r => now - r.seen_at <= 3600000);
        const duplicate = findDuplicate(input, recent);
        // Retries of the same ticket_id must not become a new duplicate.
        const id = input.ticket_id || crypto.randomUUID();
        if (input.ticket_id && recent.some(r => r.id === input.ticket_id))
            return { checked: true, duplicate };
        const next = [...recent, { id, input, seen_at: now }].slice(-100);
        const written = await bucket.put(key, JSON.stringify(next), { onlyIf: object ? { etagMatches: object.etag } : { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/json' } });
        if (written)
            return { checked: true, duplicate };
    }
    return { checked: false, duplicate: null, reason: 'concurrent_updates' };
}
