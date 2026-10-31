import { env } from 'cloudflare:workers';
import { updateTicket } from '../../../lib/ticket-store.mjs';
import { readJSON, failure, json } from '../../../lib/http';
import { requestActor } from '../../../lib/request-actor';

// A local receipt simulator. No network request to a game or messaging service.
export async function POST(request: Request) {
  try {
    if (!env.BUCKET) throw new Error('Storage unavailable');
    const body = await readJSON(request);
    const record = await updateTicket(env.BUCKET, body.ticket_id, {
      action: 'send_test', version: body.version, draft: body.text,
    }, { actor: requestActor(request) });
    return json({ mode: 'test', delivered_to_player: false, receipt: record.delivery, record });
  } catch (error) { return failure(error); }
}
