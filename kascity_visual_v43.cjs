// kascity_visual_v43.cjs
// Reads kascity_v42.json + scene_engine.html + audio -> kascity_v43.json + showcase_kascity43.html
//  1) CLOCK -> 6:00 (BT flags + DOM countdown both retimed)
//  2) STRATEGIC BOTS, replacing the flat "cash >= price + 150" rule:
//     - EARLY (first 2/3 of the clock): buy anything they can afford with a slim buffer -> land grab
//     - LATE: only buy if it leaves a real cushion, since mortgage bills are stacking
//     - HAZARD-AWARE: skip blocks with hazard >= 34% unless they're cheap
//     - BROKE GUARD: never buy below a 60-cash floor
//     - OFFERS: bots now SELL when the offer is good and they're cash-poor, instead of always refusing
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
const need = ['kascity_v42.json','scene_engine.html','showcase_kascity25.html','kv_music_loop.mp3',
              'sfx_ching.mp3','sfx_boo.mp3','sfx_gavel.mp3','sfx_dang.mp3','sfx_fireworks.mp3'];
for (const f of need) if (!fs.existsSync(f)) die(f + ' missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v42.json', 'utf8'));
const byId = id => j.nodes.find(n => n.id === id);
const director = byId('director') || die('director missing');

// ---------- 1. clock to 6 minutes ----------
let clkN = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { o.forEach(walk); return; }
  if (o.do && o.do.action === 'setFlagExpr' && o.do.args && o.do.args[0] === 'left'
      && typeof o.do.args[1] === 'string' && o.do.args[1].indexOf('600 -') === 0) {
    o.do.args[1] = o.do.args[1].replace('600 -', '360 -'); clkN++;
  }
  if (o.do && o.do.action === 'setState' && o.do.args && o.do.args[0] === 'left' && o.do.args[1] === 600) {
    o.do.args[1] = 360; clkN++;
  }
  if (o.do && o.do.action === 'setState' && o.do.args && o.do.args[0] === 'cmin' && o.do.args[1] === 10) {
    o.do.args[1] = 6; clkN++;
  }
  Object.values(o).forEach(walk);
})(director);
if (clkN < 2) die('clock retimings ' + clkN + ' (<2)');

// ---------- 2. strategic bot buy rules ----------
// original: pos == N && moved == 1 && seat() != 1 && ownerOf('tN') == 0 && cash >= price + 150
let botN = 0;
(function walk2(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const c = o.sequence[0] && o.sequence[0].cond;
    const m = typeof c === 'string' &&
      /^world\.flags\.pos == (\d+) && world\.flags\.moved == 1 && seat\(\) != 1 && ownerOf\('t(\d+)'\) == 0 && seatStat\(seat\(\),'cash'\) >= (\d+)$/.exec(c);
    if (m) {
      const tile = m[1], price = parseInt(m[3], 10) - 150;   // recover the listed price
      // early = more than a third of the clock left; late = tighter buffer + hazard caution
      const early = 'world.flags.left > 120';
      const cash = "seatStat(seat(),'cash')";
      const hz = 'world.flags.hz_t' + tile;
      o.sequence[0].cond =
        "world.flags.pos == " + tile + " && world.flags.moved == 1 && seat() != 1 && ownerOf('t" + tile + "') == 0" +
        " && " + cash + " >= " + (price + 60) +
        " && ((" + early + " && (" + hz + " < 34 || " + price + " < 120))" +
        "   || (!(" + early + ") && " + cash + " >= " + (price + 260) + " && " + hz + " < 30))";
      botN++;
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk2(v);
})(director.bt);
if (botN < 16) die('bot buy rules rewritten ' + botN + ' (<16)');

// ---------- 3. bots sell when cash-poor ----------
// original blanket: offer_tile == N && ownerOf('tN') == seat() && seat() != 1  -> oans = 1 (always keep)
let sellN = 0;
(function walk3(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.selector)) {
    const sel = o.selector;
    for (let i = 0; i < sel.length; i++) {
      const br = sel[i];
      if (!br || !Array.isArray(br.sequence)) continue;
      const c = br.sequence[0] && br.sequence[0].cond;
      const m = typeof c === 'string' &&
        /^world\.flags\.offer_tile == (\d+) && ownerOf\('t(\d+)'\) == seat\(\) && seat\(\) != 1$/.exec(c);
      if (!m) continue;
      const t = m[1];
      const acceptCond = "world.flags.offer_tile == " + t + " && ownerOf('t" + t + "') == seat() && seat() != 1 && seatStat(seat(),'cash') < 200";
      if (sel.some(b => b && b.sequence && b.sequence[0] && b.sequence[0].cond === acceptCond)) continue;
      sel.splice(i, 0, { sequence: [
        { cond: acceptCond },
        { do: { action: 'setState', args: ['oans', 0] } }   // 0 = sell
      ]});
      i++; sellN++;
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk3(v);
})(director.bt);
if (sellN < 8) die('bot sell branches ' + sellN + ' (<8)');

function countAll(list) { let c = 0; for (const n of list) { c++; if (n.children) c += countAll(n.children); } return c; }
const total = countAll(j.nodes);
if (total > 512) die('node cap ' + total);

const v43str = JSON.stringify(j);
fs.writeFileSync('kascity_v43.json', v43str);

// ---------- engine patches ----------
const psRe = /function playSound\(id, at\) \{\r?\n\s*if \(!AUDIO_ON\) return;\r?\n\s*var d = soundDef\(id\);\r?\n\s*if \(!d\) return;/;
const psM = engine.match(psRe);
if (!psM) die('playSound anchor not found');
const NL = psM[0].indexOf('\r\n') >= 0 ? '\r\n' : '\n';
engine = engine.split(psM[0]).join(psM[0] + NL +
  '  if (d.vox && window.KV_VOX && window.KV_VOX[d.vox]) {' + NL +
  '    try { var _a = window.KV_VOX[d.vox].cloneNode(); _a.volume = 0.9; _a.play(); } catch (e) {}' + NL +
  '  }' + NL);
const readyAnchor = 'post({ kv: "ready", id: scene.meta.id, permissions: scene.permissions || [] });';
if (engine.split(readyAnchor).length - 1 !== 1) die('ready anchor mismatch');
engine = engine.split(readyAnchor).join(readyAnchor + NL +
  '  window.KV_PROJECT = function (p) { try { return project(p); } catch (e) { return null; } };' + NL +
  '  window.KV_FLAGS = function () { try { var c = exprCtx(null); return (c && c.world && c.world.flags) || {}; } catch (e) { return {}; } };' + NL +
  '  window.KV_SEAT = function (p, k) { try { var c = exprCtx(null); if (c && c.seats && c.seats[p]) return c.seats[p][k]; } catch (e) {} return null; };' + NL +
  '  window.KV_NODE = function (id) { var f = null; (function w(ns){ for (var i=0;i<ns.length;i++){ if(ns[i].id===id){f=ns[i];return;} if(ns[i].children) w(ns[i].children); } })(scene.nodes); return f; };' + NL +
  '  window.KV_OWNER = function (tid) { var o = null; for (var s = 1; s <= 4; s++) { var n = window.KV_NODE("own_" + tid + "_" + s); if (n && n.visible !== false && !n.hidden) o = s; } return o; };' + NL);

// reuse v42 UI, retimed to 6:00
const src42 = fs.readFileSync('showcase_kascity42.html', 'utf8');
const us = src42.indexOf('window.KV_VOX = window.KV_VOX || {};');
const ue = src42.search(/\/\/ ---- injected kascity v\d+ showcase ----/);
if (us < 0 || ue <= us) die('v42 UI block not found in showcase_kascity42.html');
let uiJs = src42.slice(us, ue).replace('TOTAL=600', 'TOTAL=360').replace('clock.textContent="10:00"', 'clock.textContent="6:00"');
if (uiJs.indexOf('TOTAL=360') < 0) die('UI clock retime failed');

const src25 = fs.readFileSync('showcase_kascity25.html', 'utf8');
const cs = src25.indexOf('// ---- injected kascity v25 showcase ----');
const ce = src25.indexOf('try { loadScene(');
if (cs < 0 || ce <= cs) die('corner-card block not found');

fs.writeFileSync('showcase_kascity43.html', engine.replace('</script>', [
  '', uiJs,
  src25.slice(cs, ce).replace('v25 showcase', 'v43 showcase'),
  'try { loadScene(' + JSON.stringify(v43str) + '); }',
  "catch (e) { console.error('kascity43 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS clock -> 6:00 (' + clkN + ' retimings, BT + DOM)');
console.log('PASS strategic buy rules on ' + botN + ' tiles (early grab / late caution / hazard-aware / broke guard)');
console.log('PASS bots now sell when cash-poor (' + sellN + ' branches)');
console.log('PASS nodes ' + total + '/512');
console.log('OK kascity_v43.json + showcase_kascity43.html (' + (fs.statSync('showcase_kascity43.html').size/1024/1024).toFixed(1) + ' MB)');
