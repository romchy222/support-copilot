import { env } from 'cloudflare:workers';
import { listTickets, createTicket } from '../../../lib/ticket-store.mjs';
import { analyze } from '../../../lib/analyze';
import { readJSON, failure, json } from '../../../lib/http';
export async function GET(request: Request) { try {
    if (!env.BUCKET)
        throw new Error('Storage unavailable');
    return json(await listTickets(env.BUCKET, { cursor: new URL(request.url).searchParams.get('cursor') || undefined }));
}
catch (error) {
    return failure(error);
} }
export async function POST(request: Request) { try {
    if (!env.BUCKET)
        throw new Error('Storage unavailable');
    return json(await createTicket(env.BUCKET, await readJSON(request), analyze), 201);
}
catch (error) {
    return failure(error);
} }
