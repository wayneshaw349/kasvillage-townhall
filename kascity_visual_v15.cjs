// kascity_visual_v15.cjs
// Reads kascity_v14.json + scene_engine.html -> writes kascity_v15.json + showcase_kascity15.html
// Changes (sound defs redefined in-place so every existing playSound hook fires the new SFX — zero BT
// changes for sounds): storm -> real thunder rumble; hazard -> winter wind gust; evict -> sad trombone
// womp; win -> adds coin sparkle burst; bust -> adds low boom. Plus: "BYE FELISHA!" caption injected
// into every tenant-evict branch, with its own auto-dismiss.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }

const V14 = 'kascity_v14.json';
if (!fs.existsSync(V14)) die(V14 + ' missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync(V14, 'utf8'));
const RES = j.resources || die('resources missing');
const snd = RES.sounds || die('sounds missing');
const byId = id => j.nodes.find(n => n.id === id);

// ---------- 1. event SFX (respect caps: <=6 layers, dur <=2, vol <=1.5, freq 20-8000) ----------
function cap(def) {
  const L = def.layers || [def];
  if (L.length > 6) die('layer cap');
  for (const l of L) { if (l.dur > 2 || l.vol > 1.5 || (l.freq && (l.freq < 20 || l.freq > 8000))) die('sound cap violated'); }
  return def;
}
for (const k of ['storm', 'hazard', 'evict', 'win', 'bust']) if (!snd[k]) die('sound ' + k + ' missing');

snd.storm = cap({ layers: [                                      // thunder
  { type: 'noise', filter: 250, dur: 2.0, vol: 0.55 },
  { type: 'noise', filter: 120, dur: 1.8, vol: 0.45 },
  { type: 'tone', wave: 'sawtooth', freq: 48, sweep: -18, dur: 1.7, vol: 0.22 }
]});
snd.hazard = cap({ layers: [                                     // winter wind / snow gust
  { type: 'noise', filter: 700, dur: 1.5, vol: 0.34 },
  { type: 'noise', filter: 1600, dur: 1.0, vol: 0.18 },
  { type: 'tone', wave: 'sine', freq: 920, sweep: -640, dur: 0.9, vol: 0.08 }
]});
snd.evict = cap({ layers: [                                      // sad trombone womp
  { type: 'tone', wave: 'sawtooth', freq: 311, sweep: -190, dur: 1.3, vol: 0.30 },
  { type: 'tone', wave: 'square', freq: 156, sweep: -95, dur: 1.3, vol: 0.14 }
]});
const winL = (snd.win.layers || [snd.win]).concat([              // coin sparkle burst
  { type: 'tone', wave: 'sine', freq: 1047, sweep: 80, dur: 0.12, vol: 0.20 },
  { type: 'tone', wave: 'sine', freq: 1319, sweep: 80, dur: 0.16, vol: 0.18 },
  { type: 'tone', wave: 'sine', freq: 1568, sweep: 80, dur: 0.22, vol: 0.16 }
]);
snd.win = cap({ layers: winL });
const bustL = (snd.bust.layers || [snd.bust]).concat([
  { type: 'noise', filter: 90, dur: 1.4, vol: 0.4 }
]);
snd.bust = cap({ layers: bustL });

// ---------- 2. BYE FELISHA on every evict branch ----------
const director = byId('director');
if (!director || !director.bt) die('director missing');
let evN = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const hasEvict = o.sequence.some(e => e && e.do && e.do.action === 'setFlagExpr' && /^ev_t\d+$/.test((e.do.args || [])[0] || ''));
    if (hasEvict) {
      o.sequence.push(
        { do: { action: 'setText', args: ['BYE FELISHA!'], to: 'cap' } },
        { do: { action: 'show', args: [], to: 'cap' } },
        { do: { action: 'setState', args: ['bfshow', 1] } },
        { do: { action: 'setFlagExpr', args: ['bf_t', 'world.time'] } }
      );
      evN++;
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);
if (evN < 5) die('evict branches found ' + evN + ' (<5)');

// dismiss branch at selector front
const rootSel = director.bt.sequence[1] && director.bt.sequence[1].selector;
if (!Array.isArray(rootSel)) die('root selector missing');
rootSel.unshift({ sequence: [
  { cond: 'world.flags.bfshow == 1 && world.time - world.flags.bf_t > 1.6' },
  { do: { action: 'hide', args: [], to: 'cap' } },
  { do: { action: 'setState', args: ['bfshow', 0] } }
]});

// boot init
let bootOk = false;
(function walkA(o) {
  if (bootOk || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) {
      o.splice(ri, 0,
        { after: 0.1, do: { action: 'setState', args: ['bfshow', 0] } },
        { after: 0.1, do: { action: 'setState', args: ['bf_t', 0] } });
      bootOk = true; return;
    }
    o.forEach(walkA);
  } else Object.values(o).forEach(walkA);
})(director.alarms);
if (!bootOk) die('boot anchor missing');

// ---------- write ----------
const v15str = JSON.stringify(j);
fs.writeFileSync('kascity_v15.json', v15str);

const anchor = 'if (n.type === "ProgressBar" && n.bind) {';
if (engine.split(anchor).length - 1 !== 1) die('engine bind anchor mismatch');
const labelBind = 'if (n.type === "Label" && n.bind) { var cvb = resolvePath(n.bind.split("."), exprCtx(null)); if (cvb != null && cvb === cvb) n.text = "" + Math.round(cvb); }\n    ';
engine = engine.split(anchor).join(labelBind + anchor);
const inject = [
  '', '// ---- injected kascity v15 showcase ----',
  'try { loadScene(' + JSON.stringify(v15str) + '); }',
  "catch (e) { console.error('kascity15 boot: ' + (e && e.message)); }", ''
].join('\n');
fs.writeFileSync('showcase_kascity15.html', engine.replace('</script>', inject + '\n</script>'));

console.log('PASS thunder/wind/trombone/coin-burst/boom SFX (defs redefined, all hooks intact)');
console.log('PASS BYE FELISHA on ' + evN + ' evict branches + dismiss + boot init');
console.log('OK kascity_v15.json (' + (v15str.length / 1024).toFixed(1) + ' KB)');
console.log('OK showcase_kascity15.html');
