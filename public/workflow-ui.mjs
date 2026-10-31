export function matchesFilters(record, filters) {
  return Object.entries(filters).every(([key, value]) => !value || String(key === 'server' ? record.result.extracted.server || record.input.server || '' : record.result[key]) === value);
}

export function nextSteps(record) {
  if (record.status === 'approved') return { title: record.delivery ? 'Тестовая отправка выполнена' : 'Ответ подтверждён', items: [record.delivery ? 'Квитанция сохранена. Реальный игрок не получил сообщение.' : 'Проверьте тестовую отправку или скопируйте ответ в игровой канал.'] };
  if (record.status === 'escalated') return { title: 'Ожидает решения ответственного', items: ['Проверьте результат рассмотрения. При необходимости верните обращение в очередь.'] };
  const r = record.result;
  const text = record.input.messages.map(m => m.text).join(' ');
  const items = [];
  if (!r.extracted.server && !record.input.server) items.push('Запросите номер сервера.');
  const topic = r.analysis.intent_topic;
  if (r.category !== 'report.offtopic') items.push('Проверьте, указаны ли дата и время события; при отсутствии запросите их.');
  if (topic === 'payment' || r.category === 'report.payment') items.push('Проверьте название покупки и наличие чека. Если их нет, запросите у игрока.');
  if (record.input.kind === 'complaint' || r.category === 'report.complaint') {
    if (!r.extracted.nickname) items.push('Уточните ник игрока, на которого подана жалоба.');
    items.push(r.extracted.has_evidence ? 'Откройте доказательства в исходном канале и проверьте их: Copilot не просматривает вложения.' : 'Запросите доказательства и обстоятельства нарушения.');
  }
  if (r.lang === 'und') items.push('Уточните язык игрока перед подготовкой ответа.');
  if (r.is_spam_or_duplicate) items.push('Сверьте обращение с предыдущим, прежде чем принимать отдельное решение.');
  items.push(r.needs_human ? 'Проверьте основания и черновик; при необходимости передайте специалисту.' : 'Проверьте текст и подтвердите ответ.');
  return { title: 'Следующее действие', items };
}

export function dirtyRecords(records, drafts) {
  return records.filter(r => drafts.has(r.id) && drafts.get(r.id) !== r.draft);
}
