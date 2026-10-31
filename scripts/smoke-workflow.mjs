// Run only against an explicitly selected local environment; creates one synthetic ticket.
import assert from 'node:assert/strict';
const origin = process.argv[2];
if (!origin || !/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin)) throw Error('Pass an explicit local origin');
async function post(path, body, expected = 200) {
  const response = await fetch(origin + path, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const value = await response.json();
  assert.equal(response.status, expected, JSON.stringify(value));
  return value;
}
let record = await post('/api/tickets', {kind:'report',messages:[{role:'player',text:'Тест интерфейса: застрял у гаража, сервер 5. Синтетический сценарий.'}]}, 201);
const action = async (action, extra = {}) => record = await post('/api/tickets/' + record.id, {action, version:record.version, draft:record.draft, ...extra});
await post('/api/test-delivery',{ticket_id:record.id,version:record.version,text:record.draft},409);
await action('save', {draft:'Тестовый ответ: уточните место и время события.'});
await action('escalate',{escalation:{team:'Тестовая поддержка',assignee:'Тестовая смена',reason:'Проверка интерфейса'}});
assert.equal(record.escalation.assignee,'Тестовая смена');
await action('reopen');
await action('approve',{reviewed:true});
const payload={ticket_id:record.id,version:record.version,text:record.draft};
const first = await post('/api/test-delivery',payload);
const retry = await post('/api/test-delivery',payload);
assert.equal(first.delivered_to_player,false);
assert.equal(first.receipt.receipt_id,retry.receipt.receipt_id);
assert.equal(first.record.version,retry.record.version);
let cursor, persisted;
do {
  const page=await (await fetch(origin+'/api/tickets'+(cursor?'?cursor='+encodeURIComponent(cursor):''))).json();
  persisted ||= page.records.find(r=>r.id===record.id); cursor=page.cursor;
} while(cursor && !persisted);
assert.equal(persisted.delivery.receipt_id,first.receipt.receipt_id);
assert.equal(persisted.history.filter(e=>e.action==='send_test').length,1);
console.log('Workflow HTTP smoke passed: save, escalation, reopen, approval, test delivery, retry, persisted history');
