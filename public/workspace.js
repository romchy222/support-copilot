const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
$('.profile').innerHTML = '<span class="avatar">GM</span><div>Grand Mobile<small>Support Copilot</small></div>';
const state = { records: [], selected: null, tab: 'all', view: 'queue', query: '', cursor: null, loading: true, error: null, busy: false, drafts: new Map(), config: null };
const labels = { open: 'В очереди', approved: 'Ответ подтверждён', escalated: 'Передано старшему администратору' };
const langs = { ru: 'Русский', kk: 'Қазақша', uz: 'O‘zbekcha', en: 'English', es: 'Español', pt: 'Português', und: 'Не определён' };
const priorityNames = { p0: 'Критично', p1: 'Высокий', p2: 'Обычный', p3: 'Низкий' };
const actions = { created: 'Создано обращение', save: 'Сохранены правки', approve: 'Ответ подтверждён', escalate: 'Передано старшему администратору', reopen: 'Возвращено в очередь' };
function toast(text) { $('#toast').textContent = text; $('#toast').classList.add('show'); setTimeout(() => $('#toast').classList.remove('show'), 3500); }
async function api(path, options = {}) { const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(20000) }); let data; try {
    data = await response.json();
}
catch {
    throw new Error('Сервер вернул некорректный ответ');
} if (!response.ok)
    throw new Error(data.error || `Ошибка ${response.status}`); return data; }
function date(value) { return new Date(value).toLocaleString('ru-RU', { timeZone: 'Asia/Qyzylorda', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
function short(id) { return id.split('-').slice(1, 3).join('-').toUpperCase(); }
function selected() { return state.records.find(r => r.id === state.selected); }
function rememberDraft() { const r = selected(); if (r && $('#draft'))
    state.drafts.set(r.id, $('#draft').value); }
function draft(r) { return state.drafts.get(r.id) ?? r.draft; }
function modal(html) { $('#modal-body').innerHTML = html; $('#close-modal').textContent = 'Закрыть'; $('#modal').showModal(); }
$('#close-modal').onclick = () => $('#modal').close();
async function load(more = false) { rememberDraft(); state.loading = true; state.error = null; if (!more)
    render(); try {
    const data = await api('/api/tickets' + (more && state.cursor ? '?cursor=' + encodeURIComponent(state.cursor) : ''));
    state.records = more ? [...state.records, ...data.records] : data.records;
    state.cursor = data.cursor;
    if (!state.selected)
        state.selected = state.records[0]?.id;
}
catch (error) {
    state.error = error.message;
}
finally {
    state.loading = false;
    render();
} }
function filtered() { return state.records.filter(r => (state.tab === 'done' ? r.status !== 'open' : r.status === 'open') && (state.tab !== 'human' || r.result.needs_human) && (state.tab !== 'ready' || !r.result.needs_human) && `${r.input.ticket_id || ''} ${r.id} ${r.result.analysis.category_title} ${r.input.messages.map(m => m.text).join(' ')}`.toLowerCase().includes(state.query.toLowerCase())).sort((a, b) => a.result.priority.localeCompare(b.result.priority) || b.created_at.localeCompare(a.created_at)); }
function render() {
    const open = state.records.filter(r => r.status === 'open'), human = open.filter(r => r.result.needs_human), ready = open.filter(r => !r.result.needs_human), done = state.records.filter(r => r.status !== 'open');
    $('#navcount').textContent = open.length;
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
    if (state.view === 'rules') {
        renderRules();
        return;
    }
    if (state.view === 'history') {
        renderHistory();
        return;
    }
    $('#app').innerHTML = `<div class="title-row"><div><h1>Обращения игроков</h1><p class="subtitle">${state.records.length} загружено · сначала критичные · время Казахстана</p></div><div class="actions"><button class="secondary" id="refresh">↻ Обновить</button><button class="primary" id="new-ticket">＋ Новое обращение</button></div></div><div class="stats">${[['В очереди', open.length, 'Сохранены на сервере'], ['Требуют человека', human.length, 'Решение принимает администратор'], ['Можно ответить автоматически', ready.length, 'После проверки правил безопасности'], ['Обработано', done.length, 'Подтверждено или эскалировано']].map(([title, n, foot]) => `<div class="stat"><div class="stat-label">${title}</div><div class="stat-value">${String(n).padStart(2, '0')}</div><div class="stat-foot">${foot}</div></div>`).join('')}</div>${state.error ? `<div class="caution" role="alert">${esc(state.error)}. Попробуйте обновить очередь.</div>` : ''}<section class="desk"><div class="toolbar"><div class="tabs">${[['all', 'Все', open.length], ['human', 'Нужен человек', human.length], ['ready', 'Автоответ', ready.length], ['done', 'Обработаны', done.length]].map(([id, title, n]) => `<button class="tab ${id === state.tab ? 'selected' : ''}" data-tab="${id}">${title}<span>${n}</span></button>`).join('')}</div><input class="search" id="search" aria-label="Поиск обращений" placeholder="Поиск по тексту или номеру" value="${esc(state.query)}"></div><div class="panels"><div class="ticket-list"><div class="list-caption"><span>ПРИОРИТЕТ → ВРЕМЯ</span><span>${state.loading ? 'Загрузка…' : ''}</span></div><div id="list"></div>${state.cursor ? '<button class="secondary load-more" id="load-more">Загрузить ещё</button>' : ''}</div><div class="detail" id="detail"></div><aside class="insights" id="insights"></aside></div></section>`;
    $('#refresh').onclick = () => load();
    $('#new-ticket').onclick = () => openNewTicket();
    $('#search').oninput = e => { rememberDraft(); state.query = e.target.value; renderList(); };
    document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { rememberDraft(); state.tab = b.dataset.tab; render(); });
    if ($('#load-more'))
        $('#load-more').onclick = () => load(true);
    renderList();
}
function renderList() {
    const records = filtered();
    if (!records.some(r => r.id === state.selected))
        state.selected = records[0]?.id;
    $('#list').innerHTML = records.map(r => `<button class="ticket ${r.id === state.selected ? 'current' : ''}" data-ticket="${r.id}"><div class="ticket-top"><span>#${esc(r.input.ticket_id || short(r.id))} · ${r.input.kind === 'complaint' ? 'Жалоба' : 'Репорт'}</span><span>${date(r.created_at)}</span></div><h3>${esc(r.result.analysis.category_title)}</h3><p>${esc(r.input.messages.find(m => m.role === 'player')?.text)}</p><div class="ticket-bottom"><span class="tag ${r.result.priority}">${r.result.priority.toUpperCase()}</span><span class="tag ${r.status !== 'open' ? 'green' : r.result.needs_human ? 'human' : 'green'}">${r.status !== 'open' ? labels[r.status] : r.result.needs_human ? 'Нужен человек' : 'Автоответ'}</span>${r.result.is_spam_or_duplicate ? '<span class="tag">Повтор / спам</span>' : ''}<span class="lang">${esc(r.result.lang.toUpperCase())}</span></div></button>`).join('') || `<div class="empty">${state.loading ? 'Загрузка…' : state.query ? 'Ничего не найдено' : 'Обращений пока нет. Создайте новое или выберите другую вкладку.'}</div>`;
    document.querySelectorAll('[data-ticket]').forEach(b => b.onclick = () => { rememberDraft(); state.selected = b.dataset.ticket; renderList(); });
    renderDetail();
}
function llmStatus(result) { const status = result.analysis.llm_status; return ({ generated: 'Gemini · ответ прошёл проверки', external_processing_disabled: 'Локальный ответ · данные не отправлены провайдеру', gemini_timeout: 'Резервный ответ · модель не успела ответить', gemini_quota_exceeded: 'Резервный ответ · квота модели исчерпана', gemini_key_missing: 'Резервный ответ · ключ модели не настроен', rules_not_loaded: 'База правил недоступна', unsafe_draft: 'Резервный ответ · черновик модели отклонён', unverified_quote: 'Резервный ответ · цитата не прошла проверку', unknown_citation: 'Резервный ответ · неизвестная ссылка' })[status] || 'Резервный ответ · модель недоступна или ответ не прошёл проверку'; }
function sourceButton(d) { return `<button class="secondary source-button" data-source="${esc(d.id)}">↗ ${esc(d.section)} § ${esc(d.ref)}</button>`; }
function renderDetail() {
    const r = selected();
    if (!r) {
        $('#detail').innerHTML = '<div class="empty">Выберите обращение из очереди</div>';
        $('#insights').innerHTML = '';
        return;
    }
    const result = r.result;
    const cited = result.analysis.cited_sources || [];
    const readOnly = r.status !== 'open';
    $('#detail').innerHTML = `<div class="detail-head"><span class="eyebrow">#${esc(r.input.ticket_id || short(r.id))}</span><span class="tag ${result.priority}">${result.priority.toUpperCase()} · ${priorityNames[result.priority]}</span></div><h2>${esc(result.analysis.category_title)}</h2><div class="meta"><span>${esc(result.extracted.nickname || 'Игрок не указан')}</span><span>·</span><span>${esc(result.extracted.server ? 'Сервер ' + result.extracted.server : 'Сервер не указан')}</span><span>·</span><span>${date(r.created_at)}</span></div><div class="divider"></div><div class="section-label">ПЕРЕПИСКА</div>${r.input.messages.map(m => `<div class="message-author">${m.role === 'reported_player' ? 'Комментарий обвиняемого' : 'Игрок'}</div><div class="message">${esc(m.text)}</div>${m.attachments ? `<div class="attachment">Вложения: ${m.attachments} · содержимое не проверено</div>` : ''}`).join('')}<div class="copilot"><div class="copilot-top"><span>✧ Черновик ответа</span><span>${esc(result.draft_reply.lang.toUpperCase())}</span></div><div class="draft-wrap"><textarea id="draft" class="draft" aria-label="Черновик ответа" maxlength="8000" ${readOnly ? 'readonly' : ''}>${esc(draft(r))}</textarea><div class="cite">${cited.length ? cited.map(sourceButton).join(' ') : 'Цитаты отсутствуют. Для решения может потребоваться уточнение.'}</div><div class="caution">${result.needs_human ? 'Требуется проверка человеком. ' : ''}${result.reasons.map(esc).join('. ')}</div></div></div><div class="actions">${readOnly ? `<span class="tag green">${labels[r.status]}</span><button class="secondary" id="reopen">Вернуть в очередь</button>` : '<button class="primary" id="approve">Подтвердить ответ</button><button class="secondary" id="save">Сохранить правки</button><button class="secondary" id="escalate">Эскалировать</button>'}<button class="secondary" id="export">Экспорт JSON</button></div><div class="action-note" id="save-state">Изменения и решения сохраняются на сервере. Отправка игрокам не подключена к игре.</div>`;
    const token = result.analysis.usage?.totalTokenCount;
    $('#insights').innerHTML = `<div class="insight-title">✧ Анализ Copilot</div><div class="confidence"><div class="confidence-head">Оценка уверенности <strong>${Math.round(result.confidence * 100)}%</strong></div><div class="bar"><div style="width:${Math.round(result.confidence * 100)}%"></div></div><p>Не калибрована · не подтверждает факты</p></div><p class="baseline-note">${esc(llmStatus(result))}</p><div class="section-label">ИЗВЛЕЧЁННЫЕ ДАННЫЕ</div><div class="facts">${[['Категория', result.category], ['Язык', langs[result.lang]], ['Ник обвиняемого', result.extracted.nickname || 'Не указан'], ['Вложения', result.extracted.has_evidence ? 'Есть · не проверены' : 'Не указаны'], ['Сервер', result.extracted.server || 'Не указан'], ['Спам / дубликат', result.is_spam_or_duplicate ? 'Есть признаки' : 'Не обнаружен'], ['Обработка', result.latency_ms + ' мс'], ['Токены', token ?? 'Внешний вызов не завершён'], ['Источник правил', (result.analysis.corpus_documents || 0) + ' фрагментов']].map(([key, value]) => `<div class="fact"><span>${key}</span><b>${esc(value)}</b></div>`).join('')}</div><div class="section-label">ИСПОЛЬЗОВАННЫЕ ПРАВИЛА</div>${cited.length ? cited.map(d => `<div class="rule-card"><b>${esc(d.section)} § ${esc(d.ref)}</b>${esc(d.text.slice(0, 180))}…<br>${sourceButton(d)}</div>`).join('') : '<p class="subtitle">Подтверждённая цитата не выбрана.</p>'}<div class="safe">Обвинения игрока не являются доказанными фактами.</div>`;
    $('#draft').oninput = e => { state.drafts.set(r.id, e.target.value); $('#save-state').textContent = e.target.value === r.draft ? 'Черновик сохранён на сервере.' : 'Есть несохранённые изменения'; };
    if ($('#save'))
        $('#save').onclick = () => saveAction('save');
    if ($('#escalate'))
        $('#escalate').onclick = () => saveAction('escalate');
    if ($('#reopen'))
        $('#reopen').onclick = () => saveAction('reopen');
    if ($('#approve'))
        $('#approve').onclick = () => { rememberDraft(); modal('<h2>Проверка ответа</h2><p>Убедитесь, что ответ соответствует обращению и правилам. Подтверждение сохранит решение в очереди, без отправки игроку.</p><label class="consent"><input id="reviewed" type="checkbox"> Я проверил текст и основания ответа</label><p id="approve-error" role="alert"></p><button class="primary" id="confirm-approve">Подтвердить</button>'); $('#confirm-approve').onclick = () => { if (!$('#reviewed').checked) {
            $('#approve-error').textContent = 'Подтвердите проверку';
            return;
        } saveAction('approve', true); }; };
    $('#export').onclick = () => download(r);
    document.querySelectorAll('[data-source]').forEach(b => b.onclick = () => { const source = cited.find(d => d.id === b.dataset.source); modal(`<div class="section-label">${esc(source.section)} § ${esc(source.ref)}</div><p>${esc(source.text)}</p>`); });
}
async function saveAction(action, reviewed = false) { if (state.busy)
    return; rememberDraft(); const r = selected(); state.busy = true; try {
    const saved = await api('/api/tickets/' + encodeURIComponent(r.id), { method: 'POST', body: JSON.stringify({ action, version: r.version, draft: draft(r), reviewed }) });
    state.records[state.records.findIndex(x => x.id === r.id)] = saved;
    state.drafts.delete(r.id);
    if ($('#modal').open)
        $('#modal').close();
    toast(actions[action]);
    render();
}
catch (error) {
    toast(error.message);
}
finally {
    state.busy = false;
} }
function download(record) { const blob = new Blob([JSON.stringify({ ticket_id: record.input.ticket_id || record.id, ...record.result, review: { status: record.status, draft: record.draft, history: record.history } }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'triage-' + record.id + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function openNewTicket() { modal('<div class="section-label">НОВОЕ ОБРАЩЕНИЕ</div><h2>Разобрать обращение</h2><form id="triage-form"><label for="kind">Канал</label><select id="kind"><option value="report">Репорт</option><option value="complaint">Жалоба на игрока</option></select><label for="ticket-text">Сообщение игрока</label><textarea id="ticket-text" required maxlength="20000" placeholder="Опишите проблему игрока"></textarea><label for="reporter">Анонимный ID заявителя · необязательно</label><input id="reporter" maxlength="256" placeholder="Для поиска повторных обращений"><label for="attachments">Количество вложений</label><input id="attachments" type="number" min="0" max="100" value="0" required><p class="form-note">Изображения не анализируются. Исходный текст и результат сохраняются в приватной очереди.</p><label class="consent"><input id="synthetic" type="checkbox"> Это синтетический пример без конфиденциальных данных. Использовать Gemini Free.</label><p class="form-note">Без этой отметки данные обрабатываются локальным алгоритмом, без передачи Google.</p><div id="form-error" role="alert"></div><div class="actions"><button class="primary" id="analyze" type="submit">Проанализировать</button><button class="secondary" id="example" type="button">Подставить пример</button></div></form>'); $('#example').onclick = () => { $('#kind').value = 'complaint'; $('#ticket-text').value = 'Игрок Arman_Petrov оскорбляет меня в чате, сервер 4. Прикрепил два скриншота.'; $('#attachments').value = 2; $('#reporter').value = 'demo-player-1'; $('#synthetic').checked = true; }; $('#triage-form').onsubmit = createNew; }
async function createNew(event) { event.preventDefault(); const button = $('#analyze'); button.disabled = true; button.textContent = 'Анализирую…'; try {
    const text = $('#ticket-text').value.trim();
    if (!text)
        throw Error('Введите текст обращения');
    const record = await api('/api/tickets', { method: 'POST', body: JSON.stringify({ kind: $('#kind').value, data_mode: $('#synthetic').checked ? 'synthetic' : 'private', reporter_hash: $('#reporter').value.trim() || undefined, created_at: new Date().toISOString(), messages: [{ role: 'player', text, attachments: Number($('#attachments').value) }] }) });
    state.records.unshift(record);
    state.selected = record.id;
    state.tab = 'all';
    state.query = '';
    $('#modal').close();
    render();
    toast('Обращение сохранено');
}
catch (error) {
    $('#form-error').textContent = error.message;
}
finally {
    button.disabled = false;
    button.textContent = 'Проанализировать';
} }
function renderHistory() { const events = state.records.flatMap(r => r.history.map(e => ({ ...e, id: r.id }))).sort((a, b) => b.at.localeCompare(a.at)); const groups = new Map(); for (const r of state.records.filter(r => r.status === 'approved')) {
    const key = r.result.category;
    groups.set(key, [...(groups.get(key) || []), r]);
} const suggestions = [...groups.entries()].filter(([, rs]) => rs.length >= 3); $('#app').innerHTML = `<div class="title-row"><div><h1>История решений</h1><p class="subtitle">Сохранённые действия по загруженным обращениям</p></div></div><div class="full-page">${events.map(e => `<div class="history-row"><span class="eyebrow">${date(e.at)}</span><b>${short(e.id)}</b><span>${actions[e.action] || esc(e.action)}</span>${e.previous_draft && e.previous_draft !== e.draft ? '<span class="tag green">Текст изменён</span>' : ''}</div>`).join('') || '<div class="empty">История пока пуста</div>'}</div>${suggestions.length ? `<div class="full-page" style="margin-top:20px"><h2>Кандидаты в шаблоны</h2><p class="subtitle">Повторяющиеся категории с тремя и более подтверждёнными ответами. Перед использованием требуется редакторская проверка.</p>${suggestions.map(([code, rs]) => `<article class="message"><b>${esc(code)} · ${rs.length} ответов</b><p>${esc(rs[0].draft)}</p></article>`).join('')}</div>` : ''}`; }
let knowledgeGeneration = 0;
function renderRules() { const generation = ++knowledgeGeneration; $('#app').innerHTML = '<div class="title-row"><div><h1>База знаний</h1><p class="subtitle" id="kb-status">Загрузка…</p></div><input class="search" id="kb-query" aria-label="Поиск по правилам" placeholder="Поиск по правилам"></div><div class="full-page"><div class="knowledge-grid" id="kb-results"></div></div>'; let sequence = 0; async function search() { const current = ++sequence; try {
    const data = await api('/api/knowledge?q=' + encodeURIComponent($('#kb-query').value));
    if (state.view !== 'rules' || generation !== knowledgeGeneration || current !== sequence)
        return;
    $('#kb-status').textContent = data.loaded ? `${data.sections} разделов · ${data.documents} фрагментов` : 'База не загружена';
    $('#kb-results').innerHTML = data.sources.map(d => `<article><span class="tag green">${esc(d.section)} § ${esc(d.ref)}</span><p>${esc(d.text)}</p></article>`).join('') || '<p>Подходящих фрагментов не найдено</p>';
}
catch (error) {
    if ($('#kb-status'))
        $('#kb-status').textContent = error.message;
} } let timer; $('#kb-query').oninput = () => { clearTimeout(timer); timer = setTimeout(search, 250); }; search(); }
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { rememberDraft(); state.view = b.dataset.view; render(); });
window.addEventListener('beforeunload', event => { if (state.records.some(r => state.drafts.has(r.id) && draft(r) !== r.draft)) {
    event.preventDefault();
    event.returnValue = '';
} });
load();
api('/api/corpus').then(config => { state.config = config; $('.demo').textContent = config.loaded && config.gemini_configured ? 'Gemini + RAG · приватная очередь' : 'RAG · локальный режим'; $('.date').textContent = new Date().toLocaleDateString('ru-RU', { timeZone: 'Asia/Qyzylorda', day: 'numeric', month: 'long', year: 'numeric' }); }).catch(() => { });
