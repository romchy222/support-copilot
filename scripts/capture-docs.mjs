// Снимки интерфейса для документации через Chrome DevTools Protocol (Edge/Chrome в headless).
// Запуск: node scripts/capture-docs.mjs [http://127.0.0.1:4173]
// Тексты фрагментов правил размываются, чтобы не публиковать материалы датасета.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs', 'assets');
mkdirSync(out, { recursive: true });

const candidates = [
  process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const browser = candidates.find(p => existsSync(p));
if (!browser) throw new Error('Не найден Edge/Chrome. Укажите путь в BROWSER_PATH.');

const port = 9333;
const profile = mkdtempSync(join(tmpdir(), 'copilot-shot-'));
const proc = spawn(browser, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitForBrowser() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return; } catch { /* ждём */ }
    await sleep(250);
  }
  throw new Error('Браузер не запустился');
}

class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && this.pending.has(m.id)) { const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } }; }
  send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject })); }
  async eval(expression) { const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || '')); return r.result.value; }
}

async function openPage() {
  let target;
  const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
  target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const cdp = new Cdp(ws);
  await cdp.send('Page.enable');
  return cdp;
}

const BLUR = `.rule-card-text, .kb-card p { filter: blur(6px); user-select: none; }`;

async function shot(cdp, { file, width, height, mobile = false, path = '/index.html', steps = '', fullPage = true, wait = 1800 }) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile });
  await cdp.send('Page.navigate', { url: base + path });
  await sleep(wait);
  await cdp.eval(`(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(BLUR)}; document.head.appendChild(s); })()`);
  if (steps) { await cdp.eval(steps); await sleep(wait); }
  let clip;
  if (fullPage) {
    // Подгоняем высоту окна под содержимое, чтобы фиксированное боковое меню занимало всю высоту кадра.
    const total = await cdp.eval('Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: Math.min(Math.max(total, height), 4200), deviceScaleFactor: 2, mobile });
    await sleep(500);
  }
  const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(out, file), Buffer.from(r.data, 'base64'));
  console.log('saved', file);
}

const clickTicket = id => `(() => { const all=document.querySelector('.size-btn[data-size="0"]'); if(all) all.click(); const b=[...document.querySelectorAll('.ticket')].find(x=>x.textContent.includes(${JSON.stringify(id)})); if(b) b.click(); })()`;
const clickView = v => `document.querySelector('[data-view="${v}"]').click()`;

try {
  await waitForBrowser();
  const cdp = await openPage();
  await shot(cdp, { file: 'ui-queue-desktop.png', width: 1440, height: 900, steps: clickTicket('DEMO-RU-01') });
  await shot(cdp, { file: 'ui-draft-kk.png', width: 1440, height: 900, steps: clickTicket('DEMO-KK-02') });
  await shot(cdp, { file: 'ui-draft-uz.png', width: 1440, height: 900, steps: clickTicket('DEMO-UZ-03') });
  await shot(cdp, { file: 'ui-payment-p0.png', width: 1440, height: 900, steps: clickTicket('DEMO-PAY-04') });
  await shot(cdp, { file: 'ui-knowledge.png', width: 1440, height: 900, steps: clickView('rules'), wait: 2500 });
  await shot(cdp, { file: 'ui-history.png', width: 1440, height: 900, steps: clickView('history') });
  await shot(cdp, { file: 'ui-tablet.png', width: 820, height: 1100, steps: clickTicket('DEMO-CHEAT-06') });
  await shot(cdp, { file: 'ui-mobile.png', width: 390, height: 844, mobile: true, steps: clickTicket('DEMO-ACC-05') });
} finally {
  proc.kill();
}
process.exit(0);
