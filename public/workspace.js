import { matchesFilters, nextSteps, dirtyRecords } from './workflow-ui.mjs';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
$('.profile').innerHTML = '<span class="avatar">GM</span><div>Grand Mobile<small>Support Copilot</small></div>';

const state = {
  records: [],
  selected: null,
  detailOpen: false,
  tab: 'all',
  view: 'queue',
  query: '',
  filters: { priority: '', lang: '', category: '', server: '' },
  cursor: null,
  loading: true,
  error: null,
  busy: false,
  drafts: new Map(),
  config: null,
  queuePage: 1,
  queuePageSize: 5,
  kbQuery: '',
  kbSection: '',
  kbPage: 1,
  kbPageSize: 12,
  kbData: null,
  historyPage: 1,
  historyPageSize: 15,
};

const labels = {
  open: 'В очереди',
  approved: 'Ответ подтверждён',
  escalated: 'Передано специалисту',
};
const langs = {
  ru: 'Русский',
  kk: 'Қазақша',
  uz: 'O‘zbekcha',
  en: 'English',
  es: 'Español',
  pt: 'Português',
  und: 'Не определён',
};
const priorityNames = {
  p0: 'Критично',
  p1: 'Высокий',
  p2: 'Обычный',
  p3: 'Низкий',
};
const actions = {
  created: 'Создано обращение',
  save: 'Сохранены правки',
  approve: 'Ответ подтверждён',
  escalate: 'Передано специалисту',
  reopen: 'Возвращено в очередь',
  send_test: 'Отправлено в тестовый канал',
};

function toast(text) {
  $('#toast').textContent = text;
  $('#toast').classList.add('show');
  setTimeout(() => $('#toast').classList.remove('show'), 3500);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(20000),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Сервер вернул некорректный ответ');
  }
  if (response.status === 401) {
    $('#signin-notice').hidden = false;
  }
  if (!response.ok) throw new Error(data.error || `Ошибка ${response.status}`);
  return data;
}

function date(value) {
  return new Date(value).toLocaleString('ru-RU', {
    timeZone: 'Asia/Qyzylorda',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function short(id) {
  return id.split('-').slice(1, 3).join('-').toUpperCase();
}

function selected() {
  return state.records.find(r => r.id === state.selected);
}

function rememberDraft() {
  const r = selected();
  if (r && $('#draft')) state.drafts.set(r.id, $('#draft').value);
}

function updateDirtyState() {
  const records = dirtyRecords(state.records, state.drafts);
  const bar = $('#draft-status');
  if (!bar) return;
  bar.hidden = !records.length;
  bar.innerHTML = records.length ? `<strong>Не сохранено: ${records.length}</strong><span>Правки хранятся в этой вкладке. Сохраните их перед закрытием.</span>${records.map(r => `<button class="secondary" data-dirty="${esc(r.id)}">Открыть #${esc(r.input.ticket_id || short(r.id))}</button>`).join('')}` : '';
  bar.querySelectorAll('[data-dirty]').forEach(b => b.onclick = () => {
    rememberDraft();
    const r = state.records.find(x => x.id === b.dataset.dirty);
    state.view = 'queue'; state.query = ''; state.filters = { priority: '', lang: '', category: '', server: '' };
    state.tab = r.status === 'open' ? 'all' : 'done';
    state.selected = r.id; state.detailOpen = true;
    state.queuePage = Math.floor(filtered().findIndex(x => x.id === r.id) / (state.queuePageSize || state.records.length)) + 1;
    render(); $('#detail')?.scrollIntoView({ block: 'start' });
  });
}

function filterControls() {
  const definitions = [
    ['priority', 'Приоритет', Object.entries(priorityNames)],
    ['lang', 'Язык', [...new Set(state.records.map(r => r.result.lang))].sort().map(v => [v, langs[v] || v])],
    ['category', 'Категория', [...new Map(state.records.map(r => [r.result.category, r.result.analysis.category_title])).entries()].sort((a,b) => a[1].localeCompare(b[1]))],
    ['server', 'Сервер', [...new Set(state.records.map(r => String(r.result.extracted.server || r.input.server || '')).filter(Boolean))].sort((a,b) => Number(a)-Number(b)).map(v => [v, 'Сервер ' + v])],
  ];
  return `<div class="queue-filters">${definitions.map(([key, title, values]) => `<label>${title}<select data-filter="${key}" aria-label="Фильтр ${title.toLowerCase()}"><option value="">Все</option>${values.map(([value, label]) => `<option value="${esc(value)}" ${state.filters[key] === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>`).join('')}<button class="secondary" id="reset-filters">Сбросить фильтры</button></div>`;
}

function ticketHistory(record) {
  return `<details class="ticket-history"><summary>История обращения · ${record.history.length}</summary>${[...record.history].reverse().map(e => `<article class="event"><div><strong>${esc(actions[e.action] || e.action)}</strong><time>${date(e.at)}</time></div><p>${e.actor ? esc(e.actor.name || e.actor.id) : 'Автор не записан'}</p>${e.escalation ? `<p>${esc(e.escalation.team)} · ${esc(e.escalation.assignee)}<br>${esc(e.escalation.reason)}</p>` : ''}${e.previous_draft !== undefined && e.previous_draft !== e.draft ? `<details><summary>Изменения текста</summary><div class="revision"><section><b>До</b><p>${esc(e.previous_draft)}</p></section><section><b>После</b><p>${esc(e.draft)}</p></section></div></details>` : ''}</article>`).join('')}</details>`;
}

function draft(r) {
  return state.drafts.get(r.id) ?? r.draft;
}

function autoResizeDraft() {
  const el = $('#draft');
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.max(140, el.scrollHeight + 4) + 'px';
}

function modal(html) {
  $('#modal-body').innerHTML = html;
  $('#close-modal').textContent = 'Закрыть';
  $('#modal').showModal();
}

$('#close-modal').onclick = () => $('#modal').close();

function renderPager(currentPage, totalItems, pageSize, prefix, sizes = [5, 10, 20, 0]) {
  const effectiveSize = pageSize > 0 ? pageSize : Math.max(totalItems, 1);
  const totalPages = Math.max(1, Math.ceil(totalItems / effectiveSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * effectiveSize + 1;
  const end = Math.min(totalItems, safePage * effectiveSize);

  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - safePage) <= 2) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  return `<div class="pagination" data-pager="${prefix}">
    <div class="pagination-info">Показано <b>${start}–${end}</b> из <b>${totalItems}</b></div>
    <div class="pagination-controls">
      <button type="button" class="page-btn" data-page="${safePage - 1}" ${safePage <= 1 ? 'disabled' : ''}>← Назад</button>
      <div class="page-numbers">
        ${pages
          .map(p =>
            p === '…'
              ? '<span class="page-dots">…</span>'
              : `<button type="button" class="page-num ${p === safePage ? 'active' : ''}" data-page="${p}">${p}</button>`
          )
          .join('')}
      </div>
      <button type="button" class="page-btn" data-page="${safePage + 1}" ${safePage >= totalPages ? 'disabled' : ''}>Вперёд →</button>
    </div>
    <div class="pagination-size">
      <span>На странице:</span>
      ${sizes
        .map(
          s =>
            `<button type="button" class="size-btn ${s === pageSize ? 'active' : ''}" data-size="${s}">${s === 0 ? 'Все' : s}</button>`
        )
        .join('')}
    </div>
  </div>`;
}

async function load(more = false) {
  rememberDraft();
  state.loading = true;
  state.error = null;
  if (!more) render();
  try {
    let cursor = more ? state.cursor : null;
    let accumulated = more ? [...state.records] : [];
    do {
      const data = await api('/api/tickets' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
      accumulated = [...accumulated, ...data.records];
      cursor = data.cursor;
    } while (cursor);
    state.records = accumulated;
    state.cursor = null;
    if (!state.selected) state.selected = state.records[0]?.id;
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    render();
  }
}

function filtered() {
  return state.records
    .filter(
      r =>
        matchesFilters(r, state.filters) &&
        (state.tab === 'done' ? r.status !== 'open' : r.status === 'open') &&
        (state.tab !== 'human' || r.result.needs_human) &&
        (state.tab !== 'ready' || !r.result.needs_human) &&
        `${r.input.ticket_id || ''} ${r.id} ${r.result.analysis.category_title} ${r.input.messages.map(m => m.text).join(' ')}`
          .toLowerCase()
          .includes(state.query.toLowerCase())
    )
    .sort((a, b) => a.result.priority.localeCompare(b.result.priority) || b.created_at.localeCompare(a.created_at));
}

function render() {
  const open = state.records.filter(r => r.status === 'open');
  const human = open.filter(r => r.result.needs_human);
  const ready = open.filter(r => !r.result.needs_human);
  const done = state.records.filter(r => r.status !== 'open');

  $('#navcount').textContent = open.length;
  updateDirtyState();
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));

  if (state.view === 'rules') {
    renderRules();
    return;
  }
  if (state.view === 'history') {
    renderHistory();
    return;
  }

  $('#app').innerHTML = `<div class="title-row">
    <div>
      <h1>Обращения игроков</h1>
      <p class="subtitle">${state.records.length} загружено · сначала критичные · время Казахстана</p>
    </div>
    <div class="actions">
      <button class="secondary" id="refresh">↻ Обновить</button>
      <button class="primary" id="new-ticket">＋ Новое обращение</button>
    </div>
  </div>
  <div class="stats">
    ${[
      ['В очереди', open.length, 'Сохранены на сервере'],
      ['Требуют человека', human.length, 'Решение принимает администратор'],
      ['Готовы к автоответу', ready.length, 'После проверки правил безопасности'],
      ['Обработано', done.length, 'Подтверждено или эскалировано'],
    ]
      .map(
        ([title, n, foot]) =>
          `<div class="stat"><div class="stat-label">${title}</div><div class="stat-value">${String(n).padStart(2, '0')}</div><div class="stat-foot">${foot}</div></div>`
      )
      .join('')}
  </div>
  ${state.error ? `<div class="caution" role="alert">${esc(state.error)}. Попробуйте обновить очередь.</div>` : ''}
  <section class="desk ${state.detailOpen ? 'detail-open' : ''}">
    <div class="toolbar">
      <div class="tabs">
        ${[
          ['all', 'Все', open.length],
          ['human', 'Нужен человек', human.length],
          ['ready', 'Автоответ', ready.length],
          ['done', 'Обработаны', done.length],
        ]
          .map(
            ([id, title, n]) =>
              `<button class="tab ${id === state.tab ? 'selected' : ''}" aria-pressed="${id === state.tab}" data-tab="${id}">${title}<span>${n}</span></button>`
          )
          .join('')}
      </div>
      <input class="search" id="search" aria-label="Поиск обращений" placeholder="Поиск по тексту или номеру" value="${esc(state.query)}">
    </div>
    ${filterControls()}
    <div class="panels">
      <div class="ticket-list">
        <div class="list-caption"><span>ПРИОРИТЕТ → ВРЕМЯ</span><span>${state.loading ? 'Загрузка…' : ''}</span></div>
        <div id="list"></div>
        <div id="list-pager"></div>
      </div>
      <div class="detail" id="detail"></div>
      <aside class="insights" id="insights"></aside>
    </div>
  </section>`;

  $('#refresh').onclick = () => load();
  document.querySelectorAll('[data-filter]').forEach(el => el.onchange = () => {
    rememberDraft(); state.filters[el.dataset.filter] = el.value; state.queuePage = 1; state.detailOpen = false;
    $('.desk').classList.remove('detail-open'); renderList();
  });
  $('#reset-filters').onclick = () => {
    rememberDraft(); state.filters = { priority: '', lang: '', category: '', server: '' }; state.query = ''; state.queuePage = 1; state.detailOpen = false; render();
  };
  $('#new-ticket').onclick = () => openNewTicket();
  $('#search').oninput = e => {
    rememberDraft();
    state.query = e.target.value;
    state.queuePage = 1;
    renderList();
  };
  document.querySelectorAll('[data-tab]').forEach(
    b =>
      (b.onclick = () => {
        rememberDraft();
        state.tab = b.dataset.tab;
        state.detailOpen = false;
        state.queuePage = 1;
        render();
      })
  );
  renderList();
}

function renderList() {
  const allRecords = filtered();
  const effectiveSize = state.queuePageSize > 0 ? state.queuePageSize : Math.max(allRecords.length, 1);
  const totalPages = Math.max(1, Math.ceil(allRecords.length / effectiveSize));
  if (state.queuePage > totalPages) state.queuePage = totalPages;
  if (state.queuePage < 1) state.queuePage = 1;

  const pageRecords =
    state.queuePageSize > 0
      ? allRecords.slice((state.queuePage - 1) * state.queuePageSize, state.queuePage * state.queuePageSize)
      : allRecords;

  if (!pageRecords.some(r => r.id === state.selected)) {
    state.selected = pageRecords[0]?.id || allRecords[0]?.id;
  }

  $('#list').innerHTML =
    pageRecords
      .map(
        r => `<button class="ticket ${r.id === state.selected ? 'current' : ''}" aria-pressed="${r.id === state.selected}" data-ticket="${r.id}">
        <div class="ticket-top">
          <span>#${esc(r.input.ticket_id || short(r.id))} · ${r.input.kind === 'complaint' ? 'Жалоба' : 'Репорт'}</span>
          <span>${date(r.created_at)}</span>
        </div>
        <h3>${esc(r.result.analysis.category_title)}</h3>
        <p>${esc(r.input.messages.find(m => m.role === 'player')?.text)}</p>
        <div class="ticket-bottom">
          <span class="tag ${r.result.priority}">${r.result.priority.toUpperCase()}</span>
          <span class="tag ${r.status !== 'open' ? 'green' : r.result.needs_human ? 'human' : 'green'}">${r.status !== 'open' ? labels[r.status] : r.result.needs_human ? 'Нужен человек' : 'Автоответ'}</span>
          ${r.result.is_spam_or_duplicate ? '<span class="tag">Повтор / спам</span>' : ''}
          <span class="lang">${esc(r.result.lang.toUpperCase())}</span>
        </div>
      </button>`
      )
      .join('') ||
    `<div class="empty">${state.loading ? 'Загрузка…' : state.query ? 'Ничего не найдено' : 'Обращений пока нет. Создайте новое или выберите другую вкладку.'}</div>`;

  $('#list-pager').innerHTML = allRecords.length
    ? renderPager(state.queuePage, allRecords.length, state.queuePageSize, 'queue', [5, 10, 20, 0])
    : '';

  document.querySelectorAll('#list-pager [data-page]').forEach(
    b =>
      (b.onclick = () => {
        rememberDraft();
        state.queuePage = Number(b.dataset.page);
        renderList();
      })
  );
  document.querySelectorAll('#list-pager [data-size]').forEach(
    b =>
      (b.onclick = () => {
        rememberDraft();
        state.queuePageSize = Number(b.dataset.size);
        state.queuePage = 1;
        renderList();
      })
  );

  document.querySelectorAll('[data-ticket]').forEach(
    b =>
      (b.onclick = () => {
        rememberDraft();
        state.selected = b.dataset.ticket;
        state.detailOpen = true;
        $('.desk').classList.add('detail-open');
        renderList();
        if (window.matchMedia('(max-width: 768px)').matches) {
          $('#detail')?.scrollIntoView({ block: 'start' });
        }
      })
  );
  renderDetail();
}

function llmStatus(result) {
  const status = result.analysis.llm_status;
  return (
    {
      generated: 'Gemini · ответ прошёл проверки',
      external_processing_disabled: 'Локальный ответ · данные не отправлены провайдеру',
      gemini_timeout: 'Резервный ответ · модель не успела ответить',
      gemini_quota_exceeded: 'Резервный ответ · квота модели исчерпана',
      gemini_key_missing: 'Резервный ответ · ключ модели не настроен',
      rules_not_loaded: 'База правил недоступна',
      unsafe_draft: 'Резервный ответ · черновик модели отклонён',
      unverified_quote: 'Резервный ответ · цитата не прошла проверку',
      unknown_citation: 'Резервный ответ · неизвестная ссылка',
    }[status] || 'Резервный ответ · модель недоступна или ответ не прошёл проверку'
  );
}

function sourceButton(d) {
  return `<button class="secondary source-button" data-source="${esc(d.id)}">↗ ${esc(d.section)} § ${esc(d.ref)}</button>`;
}

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
  const guidance = nextSteps(r);
  $('#detail').innerHTML = `<div class="detail-head">
    <div class="detail-head-left">
      <button type="button" class="secondary back-to-list" id="back-to-list">↑ К очереди</button>
      <span class="eyebrow">#${esc(r.input.ticket_id || short(r.id))}</span>
    </div>
    <span class="tag ${result.priority}">${result.priority.toUpperCase()} · ${priorityNames[result.priority]}</span>
  </div>
  <h2>${esc(result.analysis.category_title)}</h2>
  <div class="meta">
    <span>${esc(result.extracted.nickname || 'Игрок не указан')}</span>
    <span>·</span>
    <span>${esc(result.extracted.server ? 'Сервер ' + result.extracted.server : 'Сервер не указан')}</span>
    <span>·</span>
    <span>${date(r.created_at)}</span>
  </div>
  <div class="divider"></div>
  <section class="next-step"><h3>${esc(guidance.title)}</h3><ul>${guidance.items.map(item => `<li>${esc(item)}</li>`).join('')}</ul></section>
  ${r.status === 'escalated' ? `<section class="handoff"><strong>Передано на рассмотрение</strong>${r.escalation ? `<p>Команда: ${esc(r.escalation.team)}<br>Ответственный: ${esc(r.escalation.assignee)}<br>Передано: ${date(r.escalation.at)}</p><p>Причина: ${esc(r.escalation.reason)}</p>` : '<p>Команда, ответственный и причина не записаны для этой старой передачи.</p>'}<small>Запись в очереди Copilot. Внешнее уведомление не отправлялось.</small></section>` : ''}
  <div class="section-label">ПЕРЕПИСКА</div>
  ${r.input.messages
    .map(
      m =>
        `<div class="message-author">${m.role === 'reported_player' ? 'Комментарий обвиняемого' : 'Игрок'}</div>
        <div class="message">${esc(m.text)}</div>
        ${m.attachments ? `<div class="attachment">Вложения: ${m.attachments} · содержимое не проверено</div>` : ''}`
    )
    .join('')}
  <div class="copilot">
    <div class="copilot-top"><span>✧ Черновик ответа</span><span>${esc(result.draft_reply.lang.toUpperCase())}</span></div>
    <div class="draft-wrap">
      <textarea id="draft" class="draft" aria-label="Черновик ответа" maxlength="8000" ${readOnly ? 'readonly' : ''}>${esc(draft(r))}</textarea>
      <div class="cite">${cited.length ? cited.map(sourceButton).join(' ') : 'Цитаты отсутствуют. Для решения может потребоваться уточнение.'}</div>
      <div class="caution">${result.needs_human ? 'Требуется проверка человеком. ' : ''}${result.reasons.map(esc).join('. ')}</div>
    </div>
  </div>
  <div class="actions">
    ${
      readOnly
        ? `<span class="tag green">${labels[r.status]}</span><button class="secondary" id="reopen">Вернуть в очередь</button>`
        : '<button class="primary" id="approve">Подтвердить ответ</button><button class="secondary" id="save">Сохранить правки</button><button class="secondary" id="escalate">Эскалировать</button>'
    }
    <button class="secondary" id="export">Экспорт JSON</button>
  </div>
  <div class="save-state ${draft(r) !== r.draft ? 'is-dirty' : ''}" id="save-state" role="status">${draft(r) !== r.draft ? '● Не сохранено' : '✓ Черновик сохранён на сервере'}</div>
  <div class="delivery"><span><b>Тестовый канал</b><br>Реальная отправка игроку не подключена</span><button class="secondary" id="copy-reply">Скопировать ответ</button><button class="primary" id="test-send" ${r.status !== 'approved' || r.delivery ? 'disabled' : ''}>${r.delivery ? 'Тест отправлен' : 'Отправить в тестовый канал'}</button></div>
  ${r.status !== 'approved' ? '<p class="form-note">Для тестовой отправки сначала подтвердите ответ.</p>' : ''}
  ${r.delivery ? `<div class="receipt"><strong>Тестовый API принял ответ</strong><p>Квитанция: ${esc(r.delivery.receipt_id)}<br>${date(r.delivery.at)} · Игроку не доставлено</p></div>` : ''}
  ${ticketHistory(r)}`;

  if ($('#back-to-list')) {
    $('#back-to-list').onclick = () => {
      rememberDraft();
      state.detailOpen = false;
      $('.desk').classList.remove('detail-open');
      $('.desk').scrollIntoView({ block: 'start' });
      document.querySelector('.ticket.current')?.focus({ preventScroll: true });
    };
  }

  const token = result.analysis.usage?.totalTokenCount;
  $('#insights').innerHTML = `<div class="insight-title">✧ Анализ Copilot</div>
  <div class="confidence">
    <div class="confidence-head">Оценка уверенности <strong>${Math.round(result.confidence * 100)}%</strong></div>
    <div class="bar"><div style="width:${Math.round(result.confidence * 100)}%"></div></div>
    <p>Не калибрована · не подтверждает факты</p>
  </div>
  <p class="baseline-note">${esc(llmStatus(result))}</p>
  <div class="section-label">ИЗВЛЕЧЁННЫЕ ДАННЫЕ</div>
  <div class="facts">
    ${[
      ['Категория', result.analysis.category_title],
      ['Язык', langs[result.lang]],
      ['Ник обвиняемого', result.extracted.nickname || 'Не указан'],
      ['Вложения', result.extracted.has_evidence ? 'Есть · не проверены' : 'Не указаны'],
      ['Сервер', result.extracted.server || 'Не указан'],
      ['Спам / дубликат', result.is_spam_or_duplicate ? 'Есть признаки' : 'Не обнаружен'],
    ]
      .map(([key, value]) => `<div class="fact"><span>${key}</span><b>${esc(value)}</b></div>`)
      .join('')}
  </div>
  <details class="technical"><summary>Технические сведения</summary><p>Категория: ${esc(result.category)}<br>Обработка: ${esc(result.latency_ms)} мс<br>Токены: ${esc(token ?? 'Внешний вызов не завершён')}<br>База: ${esc(result.analysis.corpus_documents || 0)} фрагментов</p></details>
  <div class="section-label">ИСПОЛЬЗОВАННЫЕ ПРАВИЛА</div>
  ${
    cited.length
      ? cited
          .map(
            d =>
              `<div class="rule-card"><b>${esc(d.section)} § ${esc(d.ref)}</b><div class="rule-card-text">${esc(d.text)}</div>${sourceButton(d)}</div>`
          )
          .join('')
      : '<p class="subtitle">Подтверждённая цитата не выбрана.</p>'
  }
  <div class="safe">Обвинения игрока не являются доказанными фактами.</div>`;

  autoResizeDraft();
  $('#draft').oninput = e => {
    state.drafts.set(r.id, e.target.value);
    autoResizeDraft();
    $('#save-state').textContent =
      e.target.value === r.draft ? '✓ Черновик сохранён на сервере' : '● Не сохранено';
    $('#save-state').classList.toggle('is-dirty', e.target.value !== r.draft);
    updateDirtyState();
  };
  if ($('#save')) $('#save').onclick = () => saveAction('save');
  if ($('#escalate')) $('#escalate').onclick = () => {
    rememberDraft();
    modal('<h2>Передать специалисту</h2><form id="escalation-form"><label for="escalation-team">Команда</label><select id="escalation-team"><option>Старшая администрация</option><option>Поддержка платежей</option><option>Безопасность аккаунтов</option></select><label for="escalation-assignee">Ответственный или дежурная смена</label><input id="escalation-assignee" required maxlength="160" placeholder="Имя администратора или название смены"><label for="escalation-reason">Причина и что нужно проверить</label><textarea id="escalation-reason" required maxlength="2000"></textarea><p class="form-note">Передача фиксируется в Copilot. Внешнее уведомление не отправляется.</p><p id="escalation-error" role="alert"></p><button class="primary" type="submit">Передать обращение</button></form>');
    $('#escalation-form').onsubmit = e => {
      e.preventDefault();
      const escalation = { team: $('#escalation-team').value, assignee: $('#escalation-assignee').value.trim(), reason: $('#escalation-reason').value.trim() };
      if (!escalation.assignee || !escalation.reason) { $('#escalation-error').textContent = 'Укажите ответственного и причину'; return; }
      saveAction('escalate', false, { escalation });
    };
  };
  if ($('#reopen')) $('#reopen').onclick = () => saveAction('reopen');
  if ($('#approve')) {
    $('#approve').onclick = () => {
      rememberDraft();
      modal(
        '<h2>Проверка ответа</h2><p>Убедитесь, что ответ соответствует обращению и правилам. Подтверждение сохранит решение в очереди, без отправки игроку.</p><label class="consent"><input id="reviewed" type="checkbox"> Я проверил текст и основания ответа</label><p id="approve-error" role="alert"></p><button class="primary" id="confirm-approve">Подтвердить</button>'
      );
      $('#confirm-approve').onclick = () => {
        if (!$('#reviewed').checked) {
          $('#approve-error').textContent = 'Подтвердите проверку';
          return;
        }
        saveAction('approve', true);
      };
    };
  }
  $('#export').onclick = () => download(r);
  $('#test-send').onclick = async () => {
    if (state.busy) return;
    state.busy = true;
    const button = $('#test-send'); button.disabled = true; button.textContent = 'Отправляю в тестовый канал…';
    try {
      const response = await api('/api/test-delivery', { method: 'POST', body: JSON.stringify({ ticket_id: r.id, version: r.version, text: r.draft }) });
      state.records[state.records.findIndex(x => x.id === r.id)] = response.record;
      renderDetail(); toast('Тестовая квитанция сохранена. Игроку не отправлено.');
    } catch (error) { toast(error.message); button.disabled = false; button.textContent = 'Повторить тестовую отправку'; }
    finally { state.busy = false; }
  };
  $('#copy-reply').onclick = async () => {
    try { await navigator.clipboard.writeText(draft(r)); toast('Ответ скопирован. Отправьте его в игровом канале.'); }
    catch { $('#draft').focus(); $('#draft').select(); toast('Выделен текст ответа. Скопируйте его вручную.'); }
  };
  document.querySelectorAll('[data-source]').forEach(
    b =>
      (b.onclick = () => {
        const source = cited.find(d => d.id === b.dataset.source);
        modal(`<div class="section-label">${esc(source.section)} § ${esc(source.ref)}</div><p>${esc(source.text)}</p>`);
      })
  );
}

async function saveAction(action, reviewed = false, extra = {}) {
  if (state.busy) return;
  rememberDraft();
  const r = selected();
  state.busy = true;
  const pendingButtons = [...document.querySelectorAll('#detail .actions button, #modal button')];
  pendingButtons.forEach(button => button.disabled = true);
  const pendingDraft = $('#draft');
  if (pendingDraft) pendingDraft.disabled = true;
  try {
    const saved = await api('/api/tickets/' + encodeURIComponent(r.id), {
      method: 'POST',
      body: JSON.stringify({ ...extra, action, version: r.version, draft: draft(r), reviewed }),
    });
    state.records[state.records.findIndex(x => x.id === r.id)] = saved;
    state.drafts.delete(r.id);
    if (action !== 'save') {
      state.tab = action === 'reopen' ? 'all' : 'done';
      state.query = '';
      state.filters = { priority: '', lang: '', category: '', server: '' };
      state.queuePage = Math.floor(filtered().findIndex(x => x.id === saved.id) / (state.queuePageSize || state.records.length)) + 1;
      state.detailOpen = true;
    }
    if ($('#modal').open) $('#modal').close();
    toast(actions[action]);
    render();
  } catch (error) {
    toast(error.message);
    const field = $('#escalation-error') || $('#approve-error');
    if (field) field.textContent = error.message;
  } finally {
    state.busy = false;
    pendingButtons.forEach(button => button.disabled = false);
    if (pendingDraft) pendingDraft.disabled = false;
  }
}

function download(record) {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          ticket_id: record.input.ticket_id || record.id,
          ...record.result,
          review: { status: record.status, draft: record.draft, history: record.history },
        },
        null,
        2
      ),
    ],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = 'triage-' + record.id + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openNewTicket() {
  modal(
    '<div class="section-label">НОВОЕ ОБРАЩЕНИЕ</div><h2>Разобрать обращение</h2><form id="triage-form"><label for="kind">Канал</label><select id="kind"><option value="report">Репорт</option><option value="complaint">Жалоба на игрока</option></select><label for="ticket-text">Сообщение игрока</label><textarea id="ticket-text" required maxlength="20000" placeholder="Опишите проблему игрока"></textarea><label for="reporter">Анонимный ID заявителя · необязательно</label><input id="reporter" maxlength="256" placeholder="Для поиска повторных обращений"><label for="attachments">Количество вложений</label><input id="attachments" type="number" min="0" max="100" value="0" required><p class="form-note">Изображения не анализируются. Исходный текст и результат сохраняются в приватной очереди.</p><label class="consent"><input id="synthetic" type="checkbox"> Это синтетический пример без конфиденциальных данных. Использовать Gemini Free.</label><p class="form-note">Без этой отметки данные обрабатываются локальным алгоритмом, без передачи Google.</p><div id="form-error" role="alert"></div><div class="actions"><button class="primary" id="analyze" type="submit">Проанализировать</button><button class="secondary" id="example" type="button">Подставить пример</button></div></form>'
  );
  $('#example').onclick = () => {
    $('#kind').value = 'complaint';
    $('#ticket-text').value = 'Игрок Arman_Petrov оскорбляет меня в чате, сервер 4. Прикрепил два скриншота.';
    $('#attachments').value = 2;
    $('#reporter').value = 'demo-player-1';
    $('#synthetic').checked = true;
  };
  $('#triage-form').onsubmit = createNew;
}

async function createNew(event) {
  event.preventDefault();
  const button = $('#analyze');
  button.disabled = true;
  button.textContent = 'Анализирую…';
  try {
    const text = $('#ticket-text').value.trim();
    if (!text) throw Error('Введите текст обращения');
    const record = await api('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({
        kind: $('#kind').value,
        data_mode: $('#synthetic').checked ? 'synthetic' : 'private',
        reporter_hash: $('#reporter').value.trim() || undefined,
        created_at: new Date().toISOString(),
        messages: [{ role: 'player', text, attachments: Number($('#attachments').value) }],
      }),
    });
    state.records.unshift(record);
    state.selected = record.id;
    state.detailOpen = true;
    state.tab = 'all';
    state.query = '';
    state.filters = { priority: '', lang: '', category: '', server: '' };
    state.queuePage = 1;
    $('#modal').close();
    render();
    toast('Обращение сохранено');
  } catch (error) {
    $('#form-error').textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Проанализировать';
  }
}

function renderHistory() {
  const events = state.records
    .flatMap(r => r.history.map(e => ({ ...e, id: r.id, ticket_id: r.input.ticket_id })))
    .sort((a, b) => b.at.localeCompare(a.at));
  const groups = new Map();
  for (const r of state.records.filter(r => r.status === 'approved')) {
    const key = r.result.category;
    groups.set(key, [...(groups.get(key) || []), r]);
  }
  const suggestions = [...groups.entries()].filter(([, rs]) => rs.length >= 3);

  const effectiveSize = state.historyPageSize > 0 ? state.historyPageSize : Math.max(events.length, 1);
  const totalPages = Math.max(1, Math.ceil(events.length / effectiveSize));
  if (state.historyPage > totalPages) state.historyPage = totalPages;
  const pageEvents =
    state.historyPageSize > 0
      ? events.slice((state.historyPage - 1) * state.historyPageSize, state.historyPage * state.historyPageSize)
      : events;

  $('#app').innerHTML = `<div class="title-row">
    <div>
      <h1>История решений</h1>
      <p class="subtitle">Всего событий: ${events.length} · по загруженным обращениям</p>
    </div>
  </div>
  <div class="full-page">
    ${
      pageEvents
        .map(
          e =>
            `<div class="history-row"><span class="eyebrow">${date(e.at)}</span><b>#${esc(e.ticket_id || short(e.id))}</b><span>${actions[e.action] || esc(e.action)}</span><span>${e.actor ? esc(e.actor.name || e.actor.id) : 'Автор не записан'}</span>${e.escalation ? `<span>${esc(e.escalation.team)} · ${esc(e.escalation.assignee)}</span>` : ''}${e.previous_draft && e.previous_draft !== e.draft ? '<span class="tag green">Текст изменён</span>' : ''}</div>`
        )
        .join('') || '<div class="empty">История пока пуста</div>'
    }
    ${events.length ? renderPager(state.historyPage, events.length, state.historyPageSize, 'history', [15, 30, 50, 0]) : ''}
  </div>
  ${
    suggestions.length
      ? `<div class="full-page" style="margin-top:20px"><h2>Кандидаты в шаблоны</h2><p class="subtitle">Повторяющиеся категории с тремя и более подтверждёнными ответами. Перед использованием требуется редакторская проверка.</p>${suggestions.map(([code, rs]) => `<article class="message"><b>${esc(code)} · ${rs.length} ответов</b><p>${esc(rs[0].draft)}</p></article>`).join('')}</div>`
      : ''
  }`;

  document.querySelectorAll('[data-pager="history"] [data-page]').forEach(
    b =>
      (b.onclick = () => {
        state.historyPage = Number(b.dataset.page);
        renderHistory();
      })
  );
  document.querySelectorAll('[data-pager="history"] [data-size]').forEach(
    b =>
      (b.onclick = () => {
        state.historyPageSize = Number(b.dataset.size);
        state.historyPage = 1;
        renderHistory();
      })
  );
}

let knowledgeGeneration = 0;
function renderRules() {
  const generation = ++knowledgeGeneration;
  $('#app').innerHTML = `<div class="title-row">
    <div>
      <h1>База знаний правил</h1>
      <p class="subtitle" id="kb-status">Загрузка полной базы знаний…</p>
    </div>
    <input class="search kb-search" id="kb-query" aria-label="Поиск по правилам" placeholder="Поиск по номеру пункта, разделу или тексту" value="${esc(state.kbQuery)}">
  </div>
  <div class="full-page">
    <div class="section-filters" id="kb-sections"></div>
    <div id="kb-pager-top"></div>
    <div class="knowledge-grid" id="kb-results"></div>
    <div id="kb-pager-bottom"></div>
  </div>`;

  let sequence = 0;

  function drawKnowledgeView() {
    const data = state.kbData;
    if (!data) return;
    const allSources = data.sources || [];
    const sectionNames = data.section_names || [];

    const filteredSources = state.kbSection
      ? allSources.filter(d => d.section === state.kbSection)
      : allSources;

    const effectiveSize = state.kbPageSize > 0 ? state.kbPageSize : Math.max(filteredSources.length, 1);
    const totalPages = Math.max(1, Math.ceil(filteredSources.length / effectiveSize));
    if (state.kbPage > totalPages) state.kbPage = totalPages;
    if (state.kbPage < 1) state.kbPage = 1;

    const pageItems =
      state.kbPageSize > 0
        ? filteredSources.slice((state.kbPage - 1) * state.kbPageSize, state.kbPage * state.kbPageSize)
        : filteredSources;

    $('#kb-status').textContent = data.loaded
      ? `${data.sections} разделов · ${data.documents} фрагментов в базе · найдено: ${filteredSources.length}`
      : 'База не загружена';

    $('#kb-sections').innerHTML = [
      ['', `Все разделы (${allSources.length})`],
      ...sectionNames.map(sec => [sec, `${sec} (${allSources.filter(d => d.section === sec).length})`]),
    ]
      .map(
        ([sec, label]) =>
          `<button type="button" class="section-chip ${state.kbSection === sec ? 'active' : ''}" data-section="${esc(sec)}">${esc(label)}</button>`
      )
      .join('');

    $('#kb-results').innerHTML =
      pageItems
        .map(
          d =>
            `<article class="kb-card"><div class="kb-card-head"><span class="tag green">${esc(d.section)}</span><span class="tag p2">§ ${esc(d.ref)}</span></div><p>${esc(d.text)}</p></article>`
        )
        .join('') || '<div class="empty">Подходящих фрагментов не найдено</div>';

    const pagerHtml = filteredSources.length
      ? renderPager(state.kbPage, filteredSources.length, state.kbPageSize, 'kb', [12, 24, 48, 0])
      : '';
    $('#kb-pager-top').innerHTML = pagerHtml;
    $('#kb-pager-bottom').innerHTML = pagerHtml;

    document.querySelectorAll('#kb-sections [data-section]').forEach(
      b =>
        (b.onclick = () => {
          state.kbSection = b.dataset.section;
          state.kbPage = 1;
          drawKnowledgeView();
        })
    );
    document.querySelectorAll('[data-pager="kb"] [data-page]').forEach(
      b =>
        (b.onclick = () => {
          state.kbPage = Number(b.dataset.page);
          drawKnowledgeView();
        })
    );
    document.querySelectorAll('[data-pager="kb"] [data-size]').forEach(
      b =>
        (b.onclick = () => {
          state.kbPageSize = Number(b.dataset.size);
          state.kbPage = 1;
          drawKnowledgeView();
        })
    );
  }

  async function search() {
    const current = ++sequence;
    try {
      const data = await api('/api/knowledge?q=' + encodeURIComponent(state.kbQuery));
      if (state.view !== 'rules' || generation !== knowledgeGeneration || current !== sequence) return;
      state.kbData = data;
      drawKnowledgeView();
    } catch (error) {
      if ($('#kb-status')) $('#kb-status').textContent = error.message;
    }
  }

  let timer;
  $('#kb-query').oninput = e => {
    state.kbQuery = e.target.value;
    state.kbPage = 1;
    clearTimeout(timer);
    timer = setTimeout(search, 200);
  };
  search();
}

document.querySelectorAll('[data-view]').forEach(
  b =>
    (b.onclick = () => {
      rememberDraft();
      state.view = b.dataset.view;
      render();
    })
);

window.addEventListener('beforeunload', event => {
  rememberDraft();
  if (dirtyRecords(state.records, state.drafts).length) {
    event.preventDefault();
    event.returnValue = '';
  }
});

load();
api('/api/corpus')
  .then(config => {
    state.config = config;
    $('.demo').textContent =
      config.loaded && config.gemini_configured ? 'Gemini + RAG · приватная очередь' : 'RAG · локальный режим';
    $('.date').textContent = new Date().toLocaleDateString('ru-RU', {
      timeZone: 'Asia/Qyzylorda',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  })
  .catch(() => {});
