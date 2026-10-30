export class InputError extends Error {
}
/** Whitelist pre-decision information. Never carry admin answers/outcome labels. */
export function prepareInput(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new InputError('Ожидается объект обращения');
    if (!['complaint', 'report'].includes(value.kind))
        throw new InputError('kind должен быть complaint или report');
    if (!Array.isArray(value.messages) || !value.messages.length || value.messages.length > 50)
        throw new InputError('Нужно от 1 до 50 сообщений');
    let size = 0;
    const messages = [];
    for (const message of value.messages) {
        if (!message || !['player', 'reported_player', 'admin'].includes(message.role) || typeof message.text !== 'string')
            throw new InputError('Укажите допустимые role и text');
        if (message.role === 'admin')
            continue;
        size += message.text.length;
        if (size > 20000)
            throw new InputError('Максимум 20 000 символов');
        if (message.attachments !== undefined && (!Number.isInteger(message.attachments) || message.attachments < 0 || message.attachments > 100))
            throw new InputError('attachments: целое число от 0 до 100');
        messages.push({ role: message.role, text: message.text, attachments: message.attachments || 0 });
    }
    if (!messages.some(m => m.role === 'player' && m.text.trim()))
        throw new InputError('Нужно непустое сообщение игрока');
    if (value.images_count !== undefined && (!Number.isInteger(value.images_count) || value.images_count < 0 || value.images_count > 100))
        throw new InputError('images_count: целое число от 0 до 100');
    const first = messages.find(m => m.role === 'player');
    if (value.images_count !== undefined && !messages.some(m => m.attachments))
        first.attachments = value.images_count;
    const clean = { kind: value.kind, messages };
    for (const key of ['ticket_id', 'reported_nick', 'rule_refs_raw', 'region', 'server_lang', 'reporter_hash', 'reported_hash', 'server']) {
        if (value[key] !== undefined && value[key] !== null) {
            if (typeof value[key] !== 'string' || value[key].length > 256)
                throw new InputError(`Некорректное поле ${key}`);
            clean[key] = value[key];
        }
    }
    if (value.created_at !== undefined) {
        if (typeof value.created_at !== 'string' || value.created_at.length > 40 || !Number.isFinite(Date.parse(value.created_at)))
            throw new InputError('Некорректное время created_at');
        // Naive dataset timestamps use a consistent UTC reference for time differences.
        clean.created_at = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value.created_at) ? value.created_at : value.created_at + 'Z';
    }
    clean.data_mode = value.data_mode === 'synthetic' ? 'synthetic' : 'private';
    return clean;
}
