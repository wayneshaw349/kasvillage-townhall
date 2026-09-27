// kascity_visual_v44.cjs
// Reads kascity_v43.json + scene_engine.html + audio -> kascity_v44.json + showcase_kascity44.html
//  1) CLOCK -> 8:00
//  2) SERIOUS BOT STRATEGY — district-aware, three-tier buy logic per tile:
//       TIER 1 COMPLETION: bot already owns a sibling in this district -> buy on a slim buffer,
//                          hazard ignored (owning the set is worth the repairs)
//       TIER 2 DENIAL:     an opponent owns a sibling -> buy to block them completing, if affordable
//       TIER 3 OPEN:       nobody owns the district -> v43 rules (early grab / late caution / hazard)
//     Plus a hard broke-guard floor on all three.
//  3) SELL LOGIC gets district sense: bots refuse to sell a property whose district they're building,
//     and sell readily from districts where an opponent already leads.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
const need = ['kascity_v43.json','scene_engine.html','showcase_kascity25.html','showcase_kascity42.html',
              'kv_music_loop.mp3','sfx_ching.mp3','sfx_boo.mp3','sfx_gavel.mp3','sfx_dang.mp3','sfx_fireworks.mp3'];
for (const f of need) if (!fs.existsSync(f)) die(f + ' missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v43.json', 'utf8'));
const byId = id => j.nodes.find(n => n.id === id);
const director = byId('director') || die('director missing');

// ---------- 0. district map from band materials ----------
const district = {};              // band material -> [tile ids]
for (let i = 0; i < 40; i++) {
  const t = byId('tile_' + i);
  if (!t || !t.children) continue;
  const band = t.children.find(c => /^band_/.test(c.id || ''));
  if (!band || !band.material) continue;
  (district[band.material] = district[band.material] || []).push(i);
}
const groups = Object.values(district).filter(g => g.length > 1);
if (groups.length < 4) die('districts with siblings ' + groups.length + ' (<4)');
const siblingsOf = {};
for (const g of groups) for (const t of g) siblingsOf[t] = g.filter(x => x !== t);

// ---------- 1. clock -> 8:00 ----------
let clkN = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { o.forEach(walk); return; }
  if (o.do && o.do.action === 'setFlagExpr' && o.do.args && o.do.args[0] === 'left'
      && typeof o.do.args[1] === 'string' && o.do.args[1].indexOf('360 -') === 0) {
    o.do.args[1] = o.do.args[1].replace('360 -', '480 -'); clkN++;
  }
  if (o.do && o.do.action === 'setState' && o.do.args && o.do.args[0] === 'left' && o.do.args[1] === 360) { o.do.args[1] = 480; clkN++; }
  if (o.do && o.do.action === 'setState' && o.do.args && o.do.args[0] === 'cmin' && o.do.args[1] === 6) { o.do.args[1] = 8; clkN++; }
  Object.values(o).forEach(walk);
})(director);
if (clkN < 2) die('clock retimings ' + clkN);

// ---------- 2. three-tier district-aware buy rules ----------
let botN = 0, tierN = 0;
(function walk2(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.selector)) {
    const sel = o.selector;
    for (let i = 0; i < sel.length; i++) {
      const br = sel[i];
      if (!br || !Array.isArray(br.sequence)) continue;
      const c = br.sequence[0] && br.sequence[0].cond;
      if (typeof c !== 'string') continue;
      const m = /^world\.flags\.pos == (\d+) && world\.flags\.moved == 1 && seat\(\) != 1 && ownerOf\('t(\d+)'\) == 0\s*&&\s*seatStat\(seat\(\),'cash'\) >= (\d+)/.exec(c);
      if (!m) continue;
      const tile = parseInt(m[1], 10);
      const price = parseInt(m[3], 10) - 60;         // v43 wrote price + 60 as the first gate
      const sibs = siblingsOf[tile] || [];
      const base = "world.flags.pos == " + tile + " && world.flags.moved == 1 && seat() != 1 && ownerOf('t" + tile + "') == 0";
      const cash = "seatStat(seat(),'cash')";
      const hz = 'world.flags.hz_t' + tile;
      const mine = sibs.map(s => "ownerOf('t" + s + "') == seat()").join(' || ');
      const theirs = sibs.map(s => "(ownerOf('t" + s + "') != 0 && ownerOf('t" + s + "') != seat())").join(' || ');

      // TIER 3 (open district) — rewrite this branch
      br.sequence[0].cond = base +
        " && " + cash + " >= " + (price + 90) +
        " && (world.flags.left > 200 ? (" + hz + " < 34 || " + price + " < 120) : (" + cash + " >= " + (price + 280) + " && " + hz + " < 30))";
      botN++;

      if (sibs.length) {
        // clone the action steps for the two higher-priority tiers
        const acts = br.sequence.slice(1);
        const completion = { sequence: [{ cond: base + " && (" + mine + ") && " + cash + " >= " + (price + 40) }].concat(JSON.parse(JSON.stringify(acts))) };
        const denial = { sequence: [{ cond: base + " && (" + theirs + ") && " + cash + " >= " + (price + 200) + " && world.flags.left > 150" }].concat(JSON.parse(JSON.stringify(acts))) };
        sel.splice(i, 0, completion, denial);
        i += 2; tierN += 2;
      }
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk2(v);
})(director.bt);
if (botN < 16) die('tier-3 rules rewritten ' + botN);
if (tierN < 20) die('completion/denial branches ' + tierN);

// ---------- 3. district-aware selling ----------
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
        /^world\.flags\.offer_tile == (\d+) && ownerOf\('t(\d+)'\) == seat\(\) && seat\(\) != 1 && seatStat\(seat\(\),'cash'\) < 200$/.exec(c);
      if (!m) continue;
      const t = parseInt(m[1], 10);
      const sibs = siblingsOf[t] || [];
      if (!sibs.length) continue;
      const mine = sibs.map(s => "ownerOf('t" + s + "') == seat()").join(' || ');
      // refuse to break up a set they're building
      br.sequence[0].cond = c + " && !(" + mine + ")";
      // but sell freely from a district an opponent already leads
      const theirs = sibs.map(s => "(ownerOf('t" + s + "') != 0 && ownerOf('t" + s + "') != seat())").join(' || ');
      sel.splice(i, 0, { sequence: [
        { cond: "world.flags.offer_tile == " + t + " && ownerOf('t" + t + "') == seat() && seat() != 1 && (" + theirs + ") && !(" + mine + ")" },
        { do: { action: 'setState', args: ['oans', 0] } }
      ]});
      i++; sellN++;
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk3(v);
})(director.bt);
if (sellN < 6) die('district sell branches ' + sellN);

function countAll(list) { let c = 0; for (const n of list) { c++; if (n.children) c += countAll(n.children); } return c; }
const total = countAll(j.nodes);
if (total > 512) die('node cap ' + total);

const v44str = JSON.stringify(j);
fs.writeFileSync('kascity_v44.json', v44str);

// ---------- engine + UI ----------
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

const src42 = fs.readFileSync('showcase_kascity42.html', 'utf8');
const us = src42.indexOf('window.KV_VOX = window.KV_VOX || {};');
const ue = src42.search(/\/\/ ---- injected kascity v\d+ showcase ----/);
if (us < 0 || ue <= us) die('v42 UI block not found');
let uiJs = src42.slice(us, ue).replace('TOTAL=600', 'TOTAL=480').replace('clock.textContent="10:00"', 'clock.textContent="8:00"');
if (uiJs.indexOf('TOTAL=480') < 0) die('UI clock retime failed');

const src25 = fs.readFileSync('showcase_kascity25.html', 'utf8');
const cs = src25.indexOf('// ---- injected kascity v25 showcase ----');
const ce = src25.indexOf('try { loadScene(');
if (cs < 0 || ce <= cs) die('corner-card block not found');

fs.writeFileSync('showcase_kascity44.html', engine.replace('</script>', [
  '', uiJs,
  src25.slice(cs, ce).replace('v25 showcase', 'v44 showcase'),
  'try { loadScene(' + JSON.stringify(v44str) + '); }',
  "catch (e) { console.error('kascity44 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS clock -> 8:00 (' + clkN + ' retimings)');
console.log('PASS districts mapped: ' + groups.length + ' with siblings');
console.log('PASS ' + tierN + ' completion/denial branches + ' + botN + ' open-district rules');
console.log('PASS ' + sellN + ' district-aware sell rules (won\'t break their own set)');
console.log('PASS nodes ' + total + '/512, json ' + (v44str.length/1024).toFixed(0) + ' KB');
console.log('OK kascity_v44.json + showcase_kascity44.html (' + (fs.statSync('showcase_kascity44.html').size/1024/1024).toFixed(1) + ' MB)');
