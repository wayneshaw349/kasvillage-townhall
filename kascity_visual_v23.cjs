// kascity_visual_v23.cjs
// Reads kascity_v22.json + scene_engine.html -> writes kascity_v23.json + showcase_kascity23.html
// Economy layer:
//  - propval seat stat: every buy/trade/sale branch that moves 'props' now also moves property VALUE
//    (auto-derived from the cash amount in the same branch; works for buys, trades, bank sales)
//  - BANK row in HUD per player = net worth = cash + propval (recomputed ~4x/sec via beat branches)
//  - each full rotation (pass GO): loan installment (cash -60, credit -50 while credit remains;
//    10 = interest) + mortgage tiers on holdings (4+ props: -30, 8+ props: another -30;
//    12+ props keeps the existing -72)
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v22.json')) die('kascity_v22.json missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v22.json', 'utf8'));
const byId = id => j.nodes.find(n => n.id === id);
const director = byId('director') || die('director missing');

// ---------- 1. propval accrual on every props-moving branch ----------
function seatKey(a) { return JSON.stringify(a); }
let pvN = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const seq = o.sequence;
    const propsSteps = [];
    for (let i = 0; i < seq.length; i++) {
      const e = seq[i];
      if (e && e.do && e.do.action === 'addSeatStat' && e.do.args && e.do.args[1] === 'props') propsSteps.push(i);
    }
    if (propsSteps.length) {
      // map seat -> cash delta in this sequence
      const cash = {};
      for (const e of seq) {
        if (e && e.do && e.do.action === 'addSeatStat' && e.do.args && e.do.args[1] === 'cash') {
          cash[seatKey(e.do.args[0])] = e.do.amount;
        }
      }
      // insert propval steps (reverse order keeps indices valid)
      for (let k = propsSteps.length - 1; k >= 0; k--) {
        const i = propsSteps[k];
        const seat = seq[i].do.args[0];
        const c = cash[seatKey(seat)];
        if (typeof c === 'number') {
          seq.splice(i + 1, 0, { do: { action: 'addSeatStat', args: [seat, 'propval'], amount: -c } });
          pvN++;
        }
      }
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);
if (pvN < 40) die('propval insertions ' + pvN + ' (<40)');

// ---------- 2. net worth recompute in beat branches ----------
let beatN = 0;
(function walk2(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence) && o.sequence[0] && typeof o.sequence[0].cond === 'string'
      && o.sequence[0].cond.indexOf('floor(mod(world.time, 2) * 4) ==') === 0) {
    for (let p = 1; p <= 4; p++) {
      o.sequence.push({ do: { action: 'setFlagExpr', args: ['nw' + p, "seatStat(" + p + ",'cash') + seatStat(" + p + ",'propval')"] } });
    }
    beatN++;
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk2(v);
})(director.bt);
if (beatN !== 8) die('beat branches ' + beatN + ' != 8');

// ---------- 3. per-lap loan + mortgage on pass-GO ----------
let goN = 0;
(function walk3(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence) && o.sequence.some(e => e && e.cond === 'world.flags.sum >= 40')) {
    o.sequence.push(
      { selector: [
        { sequence: [
          { cond: "seatStat(seat(),'credit') >= 50" },
          { do: { action: 'addSeatStat', args: ['current', 'cash'], amount: -60 } },
          { do: { action: 'addSeatStat', args: ['current', 'credit'], amount: -50 } },
          { do: { action: 'playSound', args: ['tax'] } }
        ]},
        { cond: '1 == 1' }
      ]},
      { selector: [
        { sequence: [
          { cond: "seatStat(seat(),'props') >= 4" },
          { do: { action: 'addSeatStat', args: ['current', 'cash'], amount: -30 } }
        ]},
        { cond: '1 == 1' }
      ]},
      { selector: [
        { sequence: [
          { cond: "seatStat(seat(),'props') >= 8" },
          { do: { action: 'addSeatStat', args: ['current', 'cash'], amount: -30 } }
        ]},
        { cond: '1 == 1' }
      ]}
    );
    goN++;
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk3(v);
})(director.bt);
if (goN < 1) die('pass-GO branches found ' + goN);

// ---------- 4. boot: propval 0 + nw flags ----------
let bootOk = false;
(function walkA(o) {
  if (bootOk || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) {
      const ins = [];
      for (let p = 1; p <= 4; p++) {
        ins.push({ after: 0.1, do: { action: 'setSeatStat', args: [p, 'propval', 0] } });
        ins.push({ after: 0.1, do: { action: 'setState', args: ['nw' + p, 2000] } });
      }
      o.splice(ri, 0, ...ins);
      bootOk = true; return;
    }
    o.forEach(walkA);
  } else Object.values(o).forEach(walkA);
})(director.alarms);
if (!bootOk) die('boot anchor missing');

// ---------- 5. HUD BANK rows ----------
const hud = byId('hud') || die('hud missing');
const rows = { 1: ['topLeft', 10, 70], 2: ['topRight', -100, 70], 3: ['topLeft', 10, 134], 4: ['topRight', -100, 134] };
for (let p = 1; p <= 4; p++) {
  if (hud.children.some(c => c.id === 'bk' + p)) die('bk' + p + ' exists');
  const [a, x, y] = rows[p];
  hud.children.push(
    { id: 'bkl' + p, type: 'Label', anchor: a, pos: [x, y], size: 10, text: 'BANK', color: '#b8c4b0' },
    { id: 'bk' + p, type: 'Label', anchor: a, pos: [x + 52, y], size: 12, text: '', bind: 'world.flags.nw' + p, color: '#f0c860', weight: 700, shadow: '#241c12' }
  );
}

// ---------- write ----------
const v23str = JSON.stringify(j);
fs.writeFileSync('kascity_v23.json', v23str);

const fnAnchor = 'function playSoundDef(d, at) {';
if (engine.split(fnAnchor).length - 1 !== 1) die('playSoundDef anchor mismatch');
engine = engine.split(fnAnchor).join(fnAnchor + '\n' +
  '  if (d && d.speech && d.speech.text && typeof SpeechSynthesisUtterance !== "undefined") {\n' +
  '    try { var _u = new SpeechSynthesisUtterance(String(d.speech.text));\n' +
  '      _u.pitch = d.speech.pitch == null ? 1 : d.speech.pitch;\n' +
  '      _u.rate = d.speech.rate == null ? 1 : d.speech.rate;\n' +
  '      _u.volume = d.speech.svol == null ? 1 : d.speech.svol;\n' +
  '      window.speechSynthesis.cancel(); window.speechSynthesis.speak(_u); } catch (e) {}\n' +
  '  }\n');
const bindAnchor = 'if (n.type === "ProgressBar" && n.bind) {';
if (engine.split(bindAnchor).length - 1 !== 1) die('bind anchor mismatch');
engine = engine.split(bindAnchor).join('if (n.type === "Label" && n.bind) { var cvb = resolvePath(n.bind.split("."), exprCtx(null)); if (cvb != null && cvb === cvb) n.text = "" + Math.round(cvb); }\n    ' + bindAnchor);

const walletJs = [
  'window.KV_WALLETS = window.KV_WALLETS || {};',
  '(function(){',
  '  var spots = { 1: "left:8px;top:150px;", 2: "right:8px;top:150px;", 3: "left:8px;top:214px;", 4: "right:8px;top:214px;" };',
  '  for (var p = 1; p <= 4; p++) (function(p){',
  '    var el = document.createElement("input");',
  '    el.id = "kvw" + p; el.placeholder = "P" + p + " kaspa wallet";',
  '    el.style.cssText = "position:fixed;" + spots[p] + "width:150px;z-index:50;background:#1a1410;color:#f4e4c1;" +',
  '      "border:1px solid #5a4a3a;border-radius:4px;padding:3px 6px;font:11px monospace;opacity:0.85;";',
  '    el.addEventListener("input", function(){ window.KV_WALLETS[p] = el.value.trim(); });',
  '    document.body.appendChild(el);',
  '  })(p);',
  '})();'
].join('\n');
fs.writeFileSync('showcase_kascity23.html', engine.replace('</script>', [
  '', '// ---- injected kascity v23 showcase ----', walletJs,
  'try { loadScene(' + JSON.stringify(v23str) + '); }',
  "catch (e) { console.error('kascity23 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS propval accrual on ' + pvN + ' props-moving steps');
console.log('PASS net worth recompute in 8 beat branches');
console.log('PASS lap loan (-60 cash/-50 credit while debt remains) + mortgage tiers on ' + goN + ' pass-GO branch(es)');
console.log('PASS BANK HUD rows + boot seeds');
console.log('OK kascity_v23.json + showcase_kascity23.html');
