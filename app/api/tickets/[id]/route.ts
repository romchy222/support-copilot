import { env } from 'cloudflare:workers';
import { updateTicket } from '../../../../lib/ticket-store.mjs';
import { readJSON, failure, json } from '../../../../lib/http';
export async function POST(request: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) { try {
    if (!env.BUCKET)
        throw new Error('Storage unavailable');
    return json(await updateTicket(env.BUCKET, (await params).id, await readJSON(request)));
}
catch (error) {
    return failure(error);
} }
