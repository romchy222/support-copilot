// Генерация SVG-графиков для документации из docs/metrics.json (только агрегаты, без данных датасета).
// Запуск: node scripts/make-doc-charts.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs', 'assets');
mkdirSync(out, { recursive: true });
const m = JSON.parse(readFileSync(join(root, 'docs', 'metrics.json'), 'utf8'));

const C = {
  bg: '#0b101b', panel: '#121a2b', line: '#243049', text: '#e8eefc', muted: '#94a3b8',
  orange: '#ff7a00', gold: '#ffb800', blue: '#22a0ee', green: '#10b981', red: '#ef4444', violet: '#8b5cf6',
};
const FONT = "font-family=\"Manrope, 'Segoe UI', Arial, sans-serif\"";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function frame(w, h, title, subtitle, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">
<defs>
  <linearGradient id="g-or" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.gold}"/><stop offset="1" stop-color="${C.orange}"/></linearGradient>
  <linearGradient id="g-bl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="${C.blue}"/></linearGradient>
  <linearGradient id="g-gr" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6ee7b7"/><stop offset="1" stop-color="${C.green}"/></linearGradient>
</defs>
<rect width="${w}" height="${h}" rx="16" fill="${C.bg}"/>
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="16" fill="none" stroke="${C.line}"/>
<rect x="0" y="0" width="${w}" height="4" rx="2" fill="url(#g-or)"/>
<text x="28" y="40" ${FONT} font-size="20" font-weight="800" fill="${C.text}">${esc(title)}</text>
<text x="28" y="62" ${FONT} font-size="12.5" fill="${C.muted}">${esc(subtitle)}</text>
${body}
</svg>
`;
}

/** Горизонтальные столбцы. rows: {label, value, grad?, note?} */
function hbar({ file, title, subtitle, rows, max, width = 860, labelW = 230, valueW = 150, valueFmt = fmt, footer, marker }) {
  const rowH = 34, top = 84, barW = width - labelW - valueW - 28;
  const h = top + rows.length * rowH + (footer ? 46 : 26);
  const peak = max ?? Math.max(...rows.map(r => r.value));
  let body = '';
  if (marker) {
    const mx = 28 + labelW + (marker.value / peak) * barW;
    body += `<line x1="${mx}" y1="${top - 8}" x2="${mx}" y2="${top + rows.length * rowH}" stroke="${C.red}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
    body += `<text x="${mx + 6}" y="${top - 12}" ${FONT} font-size="11.5" font-weight="700" fill="${C.red}">${esc(marker.label)}</text>`;
  }
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    const w = Math.max(3, (r.value / peak) * barW);
    body += `<text x="28" y="${y + 17}" ${FONT} font-size="13" fill="${C.text}">${esc(r.label)}</text>`;
    body += `<rect x="${28 + labelW}" y="${y + 4}" width="${barW}" height="18" rx="9" fill="${C.panel}"/>`;
    body += `<rect x="${28 + labelW}" y="${y + 4}" width="${w}" height="18" rx="9" fill="url(#${r.grad || 'g-or'})"/>`;
    body += `<text x="${28 + labelW + barW + 12}" y="${y + 18}" ${FONT} font-size="13" font-weight="800" fill="${C.text}">${esc(valueFmt(r.value))}${r.note ? `<tspan fill="${C.muted}" font-weight="500" font-size="11.5"> ${esc(r.note)}</tspan>` : ''}</text>`;
  });
  if (footer) body += `<text x="28" y="${h - 18}" ${FONT} font-size="11.5" fill="${C.muted}">${esc(footer)}</text>`;
  writeFileSync(join(out, file), frame(width, h, title, subtitle, body));
}

// 1. Веса критериев оценки ТЗ
hbar({
  file: 'scoring-weights.svg',
  title: 'Критерии оценки кейса 03 (вес в итоговой оценке)',
  subtitle: 'Источник: ТЗ Grand Mobile × Decentrathon 6.0. Бонусы оцениваются только при выполненном ядре.',
  rows: m.scoring_weights.map((r, i) => ({ label: r.label, value: r.weight, grad: ['g-or', 'g-bl', 'g-gr', 'g-or', 'g-bl'][i], note: '%' })),
  max: 40, valueFmt: v => `${v}`,
});

// 2. Языки валидации
const langName = { ru: 'Русский (ru)', uz: 'Узбекский (uz)', und: 'Не определён (und)', kk: 'Казахский (kk)', en: 'Английский (en)' };
const L = m.validation.languages;
hbar({
  file: 'validation-languages.svg',
  title: 'Языки обращений в валидационной выборке (1000)',
  subtitle: 'Определены сервисом; казахский приходит с подменёнными символами cp1251 (ќ ґ ѕ є ј ў ї).',
  rows: Object.entries(L).sort((a, b) => b[1] - a[1]).map(([k, v], i) => ({ label: langName[k], value: v, grad: i % 2 ? 'g-bl' : 'g-or', note: `${(v / 10).toFixed(1)}%` })),
  max: 800,
  footer: 'Только агрегированные счётчики; тексты обращений в репозиторий не включаются.',
});

// 3. Категории
const catRows = Object.entries(m.validation.categories).sort((a, b) => b[1] - a[1]);
hbar({
  file: 'validation-categories.svg',
  title: 'Распределение категорий, определённых сервисом (валидация, 1000)',
  subtitle: 'Разметки категорий в валидации нет; это предсказания сервиса. complaint.other сокращена с 439 до 180.',
  rows: catRows.map(([k, v]) => ({ label: k, value: v, grad: k.startsWith('report') ? 'g-bl' : 'g-or', note: `${(v / 10).toFixed(1)}%` })),
  max: 250, width: 860, labelW: 210,
  footer: 'Оранжевый — complaint.* (лаунчер), синий — report.* (игра). report.account и report.payment в выборке не встретились.',
});

// 4. Задержка
const lat = [
  { label: 'Офлайн конвейер, p95', value: m.validation.offline_latency_ms.p95, grad: 'g-gr' },
  { label: 'Локальный HTTP /triage, p50', value: m.http_local.p50_ms, grad: 'g-gr' },
  { label: 'Локальный HTTP /triage, p95', value: m.http_local.p95_ms, grad: 'g-gr' },
  { label: 'Живая LLM, 8 синтетических, макс.', value: Math.max(...m.live_llm_synthetic.tickets.map(t => t.latency_ms)), grad: 'g-bl' },
  { label: 'Опубликованный сайт, p95 (LLM таймаут)', value: m.http_published.p95_ms, grad: 'g-or' },
];
hbar({
  file: 'latency.svg',
  title: 'Задержка по режимам измерения, мс (меньше — лучше)',
  subtitle: 'Порог ТЗ: p95 ≤ 5000 мс. Режимы не сопоставимы между собой — это разные способы замера.',
  rows: lat, max: 5600, labelW: 300, width: 940, marker: { value: m.limits.p95_ms, label: 'Порог 5000 мс' },
  valueFmt: v => (v < 10 ? v.toFixed(2).replace('.', ',') : Math.round(v)) + ' мс',
  footer: 'Зелёный — без внешней модели, синий — с живой моделью, оранжевый — внешняя модель недоступна, сработали таймауты.',
});

// 5. Бюджет и отказоустойчивость
hbar({
  file: 'fault-injection.svg',
  title: 'Инъекция сбоев: p95 по сценариям, мс',
  subtitle: `Внутренний бюджет обработчика ${m.fault_injection.budget_ms} мс; при любом сбое возвращается needs_human = true.`,
  rows: m.fault_injection.rows.map(r => ({ label: r.scenario, value: r.p95_ms, grad: r.p95_ms > 2000 ? 'g-or' : 'g-bl' })),
  max: 5600, labelW: 260, width: 940, marker: { value: m.limits.p95_ms, label: 'Порог 5000 мс' },
  valueFmt: v => `${v} мс`,
  footer: 'Синтетическая инъекция через тот же оркестратор, не реальный отказ провайдера или хранилища.',
});

// 6. Стоимость
const live = m.live_llm_synthetic.tickets;
const avgCost = live.reduce((s, t) => s + t.cost_usd, 0) / live.length;
const maxCost = Math.max(...live.map(t => t.cost_usd));
hbar({
  file: 'cost.svg',
  title: 'Стоимость обработки одного обращения, USD',
  subtitle: 'Лимит ТЗ: ≤ 0,002 USD за обращение либо локальная модель. Расчёт по тарифам от 30.10.2026.',
  rows: [
    { label: 'Лимит ТЗ', value: m.limits.cost_usd_per_ticket, grad: 'g-or' },
    { label: 'Максимум из 8 живых вызовов', value: maxCost, grad: 'g-bl' },
    { label: 'Среднее по 8 живым вызовам', value: avgCost, grad: 'g-bl' },
    { label: 'Локальный режим (без внешней модели)', value: 0.00001, grad: 'g-gr' },
  ],
  max: 0.0022, labelW: 300, valueW: 130, width: 940,
  valueFmt: v => (v <= 0.00001 ? '0,000000' : v.toFixed(6)).replace('.', ','),
  footer: `Среднее ≈ ${(avgCost * 1000).toFixed(3).replace('.', ',')} · 10⁻³ USD, то есть примерно в ${(m.limits.cost_usd_per_ticket / avgCost).toFixed(1).replace('.', ',')} раза ниже лимита. Это оценка стандартной платной стоимости, не счёт провайдера.`,
});

// 7. Пончик: доля needs_human
function donut() {
  const total = m.validation.total, human = m.validation.needs_human, rest = total - human;
  const w = 860, h = 330, cx = 190, cy = 190, r = 90, sw = 34, circ = 2 * Math.PI * r;
  const hLen = (human / total) * circ;
  let body = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.panel}" stroke-width="${sw}"/>`;
  body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.orange}" stroke-width="${sw}" stroke-dasharray="${hLen} ${circ - hLen}" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt"/>`;
  body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.green}" stroke-width="${sw}" stroke-dasharray="${circ - hLen} ${hLen}" stroke-dashoffset="${-hLen}" transform="rotate(-90 ${cx} ${cy})"/>`;
  body += `<text x="${cx}" y="${cy - 2}" text-anchor="middle" ${FONT} font-size="34" font-weight="800" fill="${C.text}">${(human / total * 100).toFixed(0)}%</text>`;
  body += `<text x="${cx}" y="${cy + 20}" text-anchor="middle" ${FONT} font-size="12" fill="${C.muted}">needs_human</text>`;
  const lx = 360;
  const item = (y, color, title, text) => `<rect x="${lx}" y="${y}" width="14" height="14" rx="4" fill="${color}"/><text x="${lx + 26}" y="${y + 12}" ${FONT} font-size="14" font-weight="800" fill="${C.text}">${esc(title)}</text><text x="${lx + 26}" y="${y + 32}" ${FONT} font-size="12.5" fill="${C.muted}">${esc(text)}</text>`;
  body += item(100, C.orange, `Нужен человек — ${human} из ${total}`, 'Все жалобы, платежи, аккаунты, апелляции, спорные случаи.');
  body += item(168, C.green, `Автоответ допустим политикой — ${rest}`, 'Оффтоп и вопросы механики при уверенности ≥ 0,85 и с источником.');
  body += `<text x="${lx}" y="262" ${FONT} font-size="12.5" fill="${C.muted}">Высокая доля — осознанный выбор: ТЗ требует отправлять платежи, апелляции и</text>`;
  body += `<text x="${lx}" y="281" ${FONT} font-size="12.5" fill="${C.muted}">взломы человеку, а решение о наказании всегда подтверждает администратор.</text>`;
  writeFileSync(join(out, 'needs-human.svg'), frame(w, h, 'Доля обращений, переданных человеку (валидация, 1000)', 'Сервис честно говорит, когда нужен человек, а не имитирует уверенность.', body));
}
donut();

// 8. Матрица приоритетов
function heatmap() {
  const P = ['p0', 'p1', 'p2', 'p3'];
  const names = { p0: 'p0 критично', p1: 'p1 высокий', p2: 'p2 обычный', p3: 'p3 низкий' };
  const conf = m.labeled_control.priority_confusion;
  const w = 860, h = 420, ox = 230, oy = 130, cell = 62;
  let body = `<text x="${ox + cell * 2}" y="${oy - 38}" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="${C.muted}">Предсказано сервисом</text>`;
  body += `<text transform="translate(60 ${oy + cell * 2}) rotate(-90)" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="${C.muted}">Эталон (саморазметка)</text>`;
  P.forEach((p, i) => {
    body += `<text x="${ox + i * cell + cell / 2}" y="${oy - 12}" text-anchor="middle" ${FONT} font-size="12" fill="${C.text}">${p}</text>`;
    body += `<text x="${ox - 12}" y="${oy + i * cell + cell / 2 + 4}" text-anchor="end" ${FONT} font-size="12" fill="${C.text}">${names[p]}</text>`;
    P.forEach((q, j) => {
      const v = conf[`${p}|${q}`] || 0;
      const a = v ? 0.25 + 0.75 * (v / 28) : 0;
      const fill = v ? (p === q ? C.orange : C.red) : C.panel;
      body += `<rect x="${ox + j * cell}" y="${oy + i * cell}" width="${cell - 4}" height="${cell - 4}" rx="10" fill="${fill}" fill-opacity="${v ? a : 1}"/>`;
      body += `<text x="${ox + j * cell + (cell - 4) / 2}" y="${oy + i * cell + cell / 2 + 4}" text-anchor="middle" ${FONT} font-size="16" font-weight="800" fill="${v ? '#fff' : C.muted}">${v}</text>`;
    });
  });
  const tx = 520;
  body += `<text x="${tx}" y="${oy + 6}" ${FONT} font-size="14" font-weight="800" fill="${C.text}">Контрольная выборка: 45 обращений</text>`;
  body += `<text x="${tx}" y="${oy + 32}" ${FONT} font-size="12.5" fill="${C.muted}">Accuracy категории: 44 / 45 = ${(m.labeled_control.category_accuracy * 100).toFixed(1).replace('.', ',')}%</text>`;
  body += `<text x="${tx}" y="${oy + 54}" ${FONT} font-size="12.5" fill="${C.muted}">Macro-F1 по приоритету: ${String(m.labeled_control.priority_macro_f1).replace('.', ',')}</text>`;
  body += `<text x="${tx}" y="${oy + 76}" ${FONT} font-size="12.5" fill="${C.muted}">(1,000 по трём присутствующим классам;</text>`;
  body += `<text x="${tx}" y="${oy + 94}" ${FONT} font-size="12.5" fill="${C.muted}"> класс p0 в выборке отсутствует и даёт 0)</text>`;
  body += `<text x="${tx}" y="${oy + 130}" ${FONT} font-size="12.5" fill="${C.gold}">Разметил ассистент, не человек: это</text>`;
  body += `<text x="${tx}" y="${oy + 148}" ${FONT} font-size="12.5" fill="${C.gold}">контроль регрессий, а не независимая оценка.</text>`;
  writeFileSync(join(out, 'priority-confusion.svg'), frame(w, h, 'Матрица приоритетов на контрольной выборке', 'Строки — эталон, столбцы — предсказание. Диагональ — совпадения.', body));
}
heatmap();

// 9. Стоимость и задержка по каждому живому обращению
{
  const rows = live.map(t => ({ label: t.id, value: t.latency_ms, grad: 'g-bl', note: `· ${t.tokens} ток. · $${t.cost_usd.toFixed(6).replace('.', ',')}` }));
  hbar({
    file: 'live-llm-per-ticket.svg',
    title: 'Живые вызовы модели на 8 синтетических обращениях',
    subtitle: 'Задержка в мс, токены и оценочная стоимость каждого вызова (gemini-3.5-flash-lite).',
    rows, max: 2400, labelW: 170, valueW: 330, width: 1020, valueFmt: v => `${v} мс`,
    footer: 'Файл examples/synthetic-tickets.jsonl; реальные обращения игроков во внешнюю модель не передаются.',
  });
}

console.log('Графики сохранены в docs/assets');
