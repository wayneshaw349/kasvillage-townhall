// 4 headless players + 3 local relay nodes. Measures resync churn in a real multiplayer game.
// usage: node harness.cjs <dir-with-dev_kascity_v417_browser.html> <seconds> <tag>
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const DIR = process.argv[2], SECS = +(process.argv[3] || 240), TAG = process.argv[4] || 'run';
const NODES = { '10.9.0.1': 36001, '10.9.0.2': 36002, '10.9.0.3': 36003 };
const srv = http.createServer((q, r) => { const f = path.join(DIR, q.url.split('?')[0]); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8790);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function wire(ctx){
  await ctx.addInitScript(() => { window.__kvAllNL = []; const t0 = Date.now();
    setInterval(() => { const f = window.KV_LOG; if (f && !f.__cap) { const g = function(m){ if (window.__capD) return f.apply(this, arguments); window.__capD = 1; try { window.__kvAllNL.push('+' + Math.round((Date.now() - t0) / 1000) + 's ' + String(m).slice(0, 120)); } catch(e){} try { return f.apply(this, arguments); } finally { window.__capD = 0; } }; g.__cap = 1; window.KV_LOG = g; } }, 50); });
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.hostname === '127.0.0.1' && u.port === '8790') return route.continue();
    if (u.hostname === 'api.runonflux.io') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', data: Object.keys(NODES).map(ip => ({ ip: ip + ':16127' })) }) });
    if (/kaspa\.org$/.test(u.hostname)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blueScore: Math.floor(Date.now() / 100) }) });
    let port = NODES[u.hostname]; if (!port && /runonflux\.io$/.test(u.hostname)) port = 36001;
    if (!port) return route.abort();
    try {
      const resp = await route.fetch({ url: 'http://127.0.0.1:' + port + u.pathname + u.search, timeout: 8000 });
      const body = await resp.body();
      return route.fulfill({ status: resp.status(), headers: Object.assign({}, resp.headers(), { 'access-control-allow-origin': '*' }), body });
    } catch (e) { return route.abort(); }
  });
}
(async () => {
  const b = await chromium.launch();
  const pages = [];
  for (let k = 0; k < 4; k++) { const ctx = await b.newContext({ viewport: { width: 480, height: 320 } }); await wire(ctx); const p = await ctx.newPage(); p.on('pageerror', e => (p.__err = (p.__err || 0) + 1)); p.__roll = []; const T0 = Date.now(); p.on('console', m => { const t = m.text(); if (t.startsWith('[KV_ROLL]')) p.__roll.push('+' + Math.round((Date.now() - T0) / 1000) + 's ' + t.slice(10, 330)); }); pages.push(p); }
  const URL0 = 'http://127.0.0.1:8790/dev_kascity_v417_browser.html';
  for (const p of pages) { await p.goto(URL0); }
  await sleep(4000);
  const room = await pages[0].evaluate(() => window.KV_HOST2());
  await sleep(4000);
  for (let k = 1; k < 4; k++) { await pages[k].evaluate(c => window.KV_JOIN2(c), room); }
  await sleep(6000);
  const clicked = await pages[0].evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Start game/.test(x.textContent)); if (b) { b.click(); return true; } return false; });
  console.log('start button', clicked); if (!clicked) await pages[0].evaluate(() => window.KV_START2());
  console.log('room', room, 'started; playing', SECS, 's');
  const t0 = Date.now();
  while (Date.now() - t0 < SECS * 1000) {
    for (const p of pages) {
      await p.evaluate(() => {
        const mv = (window.KV_MOVES || []).filter(m => m && m.__acked);
        if (mv.filter(m => m.a === 'first').length < 4) return;
        if (!window.__hgo) window.__hgo = Date.now(); if (Date.now() - window.__hgo < 6000) return;
        const vis = [...document.querySelectorAll('button,div[data-i]')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(b).visibility !== 'hidden'; });
        const pick = vis.find(b => /^\s*▸?\s*Buy\b/.test(b.textContent)) || vis.find(b => /^\s*▸?\s*Roll\b|^ROLL$|🎲/.test(b.textContent.trim())) ||
                     vis.find(b => /Continue|^OK|Keep it|Take the|Decline|^▸ Pass/.test(b.textContent.trim()));
        if (pick && Math.random() < 0.7) pick.click();
      }).catch(() => {});
    }
    await sleep(1200 + Math.random() * 800);
  }
  const out = [];
  for (let k = 0; k < 4; k++) {
    const r = await pages[k].evaluate(() => ({ seat: window.KV_MP2 && window.KV_MP2.seat, nl: (window.__kvAllNL || []).slice(), moves: (window.KV_MOVES || []).filter(Boolean).map(m => m.s + ':' + m.a + (m.__acked ? '' : '?')) })).catch(e => ({ err: String(e) }));
    r.errs = pages[k].__err || 0; r.roll = pages[k].__roll; out.push(r);
  }
  fs.writeFileSync('result_' + TAG + '.json', JSON.stringify(out, null, 1));
  const cnt = re => out.map(o => (o.nl || []).filter(x => re.test(x)).length);
  console.log('seats', out.map(o => o.seat).join(','), ' moves', out.map(o => (o.moves || []).length).join(','), ' pageErrors', out.map(o => o.errs).join(','));
  console.log('RESYNC       ', cnt(/RESYNC/).join(','));
  console.log('dice correct ', cnt(/corrected dice/).join(','));
  console.log('drifted      ', cnt(/drifted|behind the chain/).join(','));
  console.log('dropped roll ', cnt(/dropped P/).join(','));
  console.log('self-heal    ', cnt(/self-heal/).join(','));
  console.log('half-open    ', cnt(/half-open/).join(','));
  console.log('holding      ', cnt(/holding your roll/).join(','));
  await b.close(); srv.close(); process.exit(0);
})();
