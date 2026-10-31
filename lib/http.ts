import { InputError } from './input.mjs';
export async function readJSON(request: Request, maxBytes = 100000, timeoutMs = 2000) {
    if (!request.headers.get('content-type')?.includes('application/json'))
        throw Object.assign(new Error('Ожидается application/json'), { status: 415 });
    if (Number(request.headers.get('content-length')) > maxBytes)
        throw Object.assign(new Error('Запрос слишком большой'), { status: 413 });
    const reader = request.body?.getReader();
    if (!reader)
        throw new InputError('Пустой запрос');
    let bytes = 0;
    const deadline = performance.now() + timeoutMs;
    const chunks: Uint8Array[] = [];
    while (true) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const { done, value } = await Promise.race([
            reader.read(),
            new Promise<never>((_, reject) => { timer = setTimeout(() => {
                void reader.cancel().catch(() => {});
                reject(Object.assign(new Error('Превышено время чтения запроса'), { status: 408 }));
            }, Math.max(1, deadline - performance.now())); }),
        ]).finally(() => clearTimeout(timer));
        if (done)
            break;
        bytes += value.length;
        if (bytes > maxBytes) {
            await reader.cancel();
            throw Object.assign(new Error('Запрос слишком большой'), { status: 413 });
        }
        chunks.push(value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.length;
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
}
export function failure(error: any) { const status = error.status || (error instanceof InputError || error instanceof SyntaxError ? 400 : 500); return Response.json({ error: status < 500 ? error.message : 'Не удалось выполнить операцию' }, { status, headers: { 'Cache-Control': 'no-store' } }); }
export function json(value: any, status = 200) { return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } }); }
