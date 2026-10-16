// Drive the real Guide tutor (learn/tutor, ?dev=1) in headless Chrome: one fresh browser context
// per question, so each question starts a new conversation. Usage: node run.mjs <provider> <modelId>
// Results append to results/<modelId>.jsonl; Anthropic spend goes to spend.jsonl and stops the run
// at the cap (computed from usage x the 5.5 price table, not from pi-durable's own figure).
import { chromium } from 'playwright';
import fs from 'node:fs';
const [provider, modelId, only] = process.argv.slice(2);
const OUT = process.env.OUT || 'results';
const CAP = 21;                 // stop starting questions here; hard cap is $25 (in-flight margin)
const DEADLINE = new Date('2026-10-16T18:25:00-05:00');
const PRICE = {                 // $/MTok: input, output, cache write (5m, 1.25x), cache read (0.1x)
  'claude-haiku-5-5': [0.10, 0.50, 0.125, 0.01],
  'claude-sonnet-5-5': [2, 10, 2.5, 0.20],
  'claude-opus-5-5': [4, 20, 5, 0.20],
};
const cost = u => { const p = PRICE[modelId]; return p ? (u.input * p[0] + u.output * p[1] + u.cacheWrite * p[2] + u.cacheRead * p[3]) / 1e6 : 0; };
const spent = () => fs.existsSync('spend.jsonl') ? fs.readFileSync('spend.jsonl', 'utf8').trim().split('\n').filter(Boolean).reduce((s, l) => s + JSON.parse(l).usd, 0) : 0;

const questions = JSON.parse(fs.readFileSync('questions.json', 'utf8')).filter(q => !only || q.id === only);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const q of questions) {
  if (provider === 'anthropic') {
    if (spent() >= CAP) { console.log('STOP: spend cap reached', spent().toFixed(2)); break; }
    if (new Date() > DEADLINE) { console.log('STOP: deadline'); break; }
  }
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(([p, m]) => {
    localStorage.setItem('kids.tutor.provider', p);
    localStorage.setItem('kids.tutor.model.' + p, m);
    localStorage.setItem('kids.tutor.open', '1');
  }, [provider, modelId]);
  const page = await ctx.newPage();
  let row = { model: modelId, id: q.id, kind: q.kind };
  try {
    await page.goto(`http://127.0.0.1:8377/learn/${q.room}?dev=1`);
    await page.waitForFunction(() => window.learnTutor, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    const t0 = Date.now();
    await page.fill('#tutor textarea', q.text);
    await page.press('#tutor textarea', 'Enter');
    await page.waitForFunction(() => window.learnTutor.view.value.entries.some(e => e.kind === 'tutor.ask'), null, { timeout: 30000 });
    await Promise.race([
      page.evaluate(() => window.learnTutor.harness.waitForIdle(window.learnTutor.ctx)),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 300s')), 300000)),
    ]);
    row.ms = Date.now() - t0;
  } catch (e) { row.error = String(e.message ?? e).slice(0, 300); }
  try {
    const entries = await page.evaluate(() => window.learnTutor?.view.value.entries ?? []);
    const u = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    row.turns = 0; row.tools = []; row.text = []; row.stops = [];
    for (const e of entries) {
      const m = e.model?.[0];
      if (e.kind === 'pi.assistant' && m) {
        row.turns++;
        for (const k in u) u[k] += m.usage?.[k] ?? 0;
        row.stops.push(m.stopReason + (m.errorMessage ? ': ' + String(m.errorMessage).slice(0, 200) : ''));
        for (const c of m.content ?? []) {
          if (c.type === 'text' && c.text.trim()) row.text.push(c.text);
          if (c.type === 'toolCall') row.tools.push({ name: c.name, args: JSON.stringify(c.arguments ?? {}).slice(0, 300) });
        }
      }
      if (e.kind === 'pi.tool-result' && m?.isError) row.tools.push({ name: '!error', args: JSON.stringify(m.content ?? '').slice(0, 200) });
    }
    row.usage = u;
    row.usd = cost(u);
    row.final = row.text.at(-1) ?? '';
  } catch (e) { row.error = (row.error ?? '') + ' | collect: ' + e.message; }
  if (provider === 'anthropic') fs.appendFileSync('spend.jsonl', JSON.stringify({ model: modelId, id: q.id, usd: row.usd ?? 0 }) + '\n');
  fs.appendFileSync(`${OUT}/${modelId}.jsonl`, JSON.stringify(row) + '\n');
  console.log(modelId, q.id, row.ms ?? '-', 'ms', (row.usd ?? 0).toFixed(4), '$', row.tools?.map(t => t.name).join(',') ?? '', row.error ?? '', '| total', spent().toFixed(3));
  await ctx.close();
}
await browser.close();
