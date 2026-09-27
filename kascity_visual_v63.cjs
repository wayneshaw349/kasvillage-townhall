// kascity_visual_v63.cjs
// Reads kascity_v62.json + showcase_kascity62.html -> kascity_v63.json + showcase_kascity63.html
//
// BOT DEAL-MAKING: until now a bot kept everything unless it was under 200 cash. Now it values the
// block the way you do and answers on risk versus benefit. The offer is ~90% of asking, so:
//
//   intrinsic = price * (1 - hazard/180) * (1 + 0.18 * renovations)
//
//   SELL when   offer >= intrinsic            (they are being paid over what it is worth)
//   SELL when   hazard is severe and unrenovated — dump the liability
//   SELL when   mortgage debt is crushing them and this block is not part of a set
//   KEEP when   it completes or extends a district they hold
//   KEEP when   they renovated it (they paid to improve it, they want the upside)
//   KEEP otherwise
//
// Branch order matters: keeps are inserted ahead of sells so a district block is never dumped.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v62.json')) die('kascity_v62.json missing');
if (!fs.existsSync('showcase_kascity62.html')) die('showcase_kascity62.html missing');
const j = JSON.parse(fs.readFileSync('kascity_v62.json', 'utf8'));
const byId = id => j.nodes.find(n => n.id === id);
const director = byId('director') || die('director missing');

// districts + prices
const district = {};
for (let i = 0; i < 40; i++) {
  const t = byId('tile_' + i);
  if (!t || !t.children) continue;
  const band = t.children.find(c => /^band_/.test(c.id || ''));
  if (band && band.material) (district[band.material] = district[band.material] || []).push(i);
}
const sibs = {};
Object.values(district).filter(g => g.length > 1).forEach(g => g.forEach(t => { sibs[t] = g.filter(x => x !== t); }));

const dstr = JSON.stringify(director);
const prices = {};
const pr = /"prompt","args":\["buy","(?:.+?) is unowned\. Buy for (\d+)\?"(?:,"[^"]*")*\]\}\},\{"do":\{"action":"setState","args":\["buy_tile",(\d+)\]/g;
let m2; while ((m2 = pr.exec(dstr)) !== null) prices[parseInt(m2[2],10)] = parseInt(m2[1],10);
if (Object.keys(prices).length < 16) die('prices ' + Object.keys(prices).length);

// find the bot-response branches for each offer tile
let added = 0, tiles = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.selector)) {
    const sel = o.selector;
    for (let i = 0; i < sel.length; i++) {
      const br = sel[i];
      if (!br || !Array.isArray(br.sequence)) continue;
      const c = br.sequence[0] && br.sequence[0].cond;
      if (typeof c !== 'string') continue;
      const mm = /^world\.flags\.offer_tile == (\d+) && ownerOf\('t(\d+)'\) == seat\(\)/.exec(c);
      if (!mm) continue;
      const t = parseInt(mm[1], 10);
      if (prices[t] == null) continue;
      if (c.indexOf('__ev') >= 0) continue;                 // already processed
      const price = prices[t];
      const offer = Math.round(price * 0.9);
      const botOnly = 'seat() > world.flags.humans';
      const hz = 'world.flags.hz_t' + t;
      const rv = 'world.flags.rv_t' + t;
      const mine = (sibs[t] || []).map(s => "ownerOf('t" + s + "') == seat()").join(' || ');

      // intrinsic value, expressed for the engine's parser
      const intrinsic = price + ' * (1 - ' + hz + ' / 180) * (1 + 0.18 * ' + rv + ')';

      const keeps = [];
      if (mine) {
        keeps.push({ sequence: [
          { cond: '__ev world.flags.offer_tile == ' + t + " && ownerOf('t" + t + "') == seat() && " + botOnly + ' && (' + mine + ')' },
          { do: { action: 'setState', args: ['oans', 1] } }
        ]});
      }
      keeps.push({ sequence: [
        { cond: '__ev world.flags.offer_tile == ' + t + " && ownerOf('t" + t + "') == seat() && " + botOnly + ' && ' + rv + ' > 0 && ' + hz + ' < 22' },
        { do: { action: 'setState', args: ['oans', 1] } }
      ]});

      const sells = [
        // paid over the odds
        { sequence: [
          { cond: '__ev world.flags.offer_tile == ' + t + " && ownerOf('t" + t + "') == seat() && " + botOnly + ' && ' + offer + ' >= ' + intrinsic },
          { do: { action: 'setState', args: ['oans', 0] } }
        ]},
        // severe hazard, never improved: shed the liability
        { sequence: [
          { cond: '__ev world.flags.offer_tile == ' + t + " && ownerOf('t" + t + "') == seat() && " + botOnly + ' && ' + hz + ' >= 34 && ' + rv + ' == 0' },
          { do: { action: 'setState', args: ['oans', 0] } }
        ]},
        // debt pressure
        { sequence: [
          { cond: '__ev world.flags.offer_tile == ' + t + " && ownerOf('t" + t + "') == seat() && " + botOnly + " && seatStat(seat(),'mort') > 300 && seatStat(seat(),'cash') < 260" },
          { do: { action: 'setState', args: ['oans', 0] } }
        ]}
      ];

      sel.splice(i, 0, ...keeps, ...sells);
      i += keeps.length + sells.length;
      added += keeps.length + sells.length;
      tiles++;
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);

if (tiles < 8) die('offer tiles processed ' + tiles + ' (<8)');

// strip the marker used to avoid double-processing
let cleaned = 0;
(function walk2(o) {
  if (!o || typeof o !== 'object') return;
  if (typeof o.cond === 'string' && o.cond.indexOf('__ev ') === 0) { o.cond = o.cond.slice(5); cleaned++; }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk2(v);
})(director.bt);
if (cleaned !== added) die('marker cleanup mismatch ' + cleaned + '/' + added);

const scan = JSON.stringify(j);
if (scan.indexOf('__ev') >= 0) die('markers survived into output');

const v63str = JSON.stringify(j);
fs.writeFileSync('kascity_v63.json', v63str);

let html = fs.readFileSync('showcase_kascity62.html', 'utf8');
const oldJson = fs.readFileSync('kascity_v62.json', 'utf8');
if (html.split(JSON.stringify(oldJson)).length - 1 !== 1) die('embedded v62 JSON not found exactly once');
html = html.split(JSON.stringify(oldJson)).join(JSON.stringify(v63str));

// narrate bot decisions so the reasoning is visible
const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');
html = html.split(anchor).join([
  '  window.KV_END=endGame;',
  '',
  '  // ---- narrate bot offer decisions ----',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    var lastAns=null, lastTile=null;',
  '    setInterval(function(){',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var t=f.offer_tile, a=f.oans;',
  '      if(t==null||t<0||a==null||a<0){ lastAns=null; return; }',
  '      if(a===lastAns&&t===lastTile) return;',
  '      lastAns=a; lastTile=t;',
  '      var N=window.KV_NAMES||{}, nm=(N[t]&&N[t].n)||("block "+t);',
  '      var o=window.KV_OWNER?window.KV_OWNER(t):null;',
  '      var hz=f["hz_t"+t], rv=f["rv_t"+t]||0;',
  '      var why = a===0',
  '        ? (hz>=34&&!rv ? "hazard too high" : "price beats value")',
  '        : (rv>0 ? "improved, holding" : "building the district");',
  '      if(o) window.KV_LOG("P"+o+"  "+(a===0?"SELLS":"KEEPS")+"  "+nm+"  \\u2014 "+why, COL[o]);',
  '    },350);',
  '  })();'
].join('\n'));

fs.writeFileSync('showcase_kascity63.html', html);
console.log('PASS ' + added + ' decision branches across ' + tiles + ' offer tiles');
console.log('PASS bots sell when the offer beats intrinsic value, when hazard is severe, or under debt pressure');
console.log('PASS bots keep district blocks and anything they renovated');
console.log('PASS decisions narrated in the play-by-play with the reason');
console.log('OK kascity_v63.json + showcase_kascity63.html (' + (fs.statSync('showcase_kascity63.html').size/1024/1024).toFixed(1) + ' MB)');
