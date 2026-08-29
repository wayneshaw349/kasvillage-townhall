// kascity_visual_v88.cjs
// Reads kascity_v86.json + showcase_kascity86.html -> kascity_v88.json + showcase_kascity88.html
//
// PERSONALITY AS DATA, NOT AS HARDCODED NUMBERS.
// v87 baked each temperament into the conditions, so P2 was the developer in every game — you would
// learn the board instead of the players. Every threshold now reads a per-seat flag, which means:
//
//   1. RANDOM ASSIGNMENT — at boot each bot seat draws a temperament, so the same seat plays
//      differently game to game and you have to read them fresh.
//
//   2. LIVE SWITCHING — temperament shifts with circumstance, the way a real operator would:
//        cash under 260             -> MISER      (stop spending, hold out for a premium)
//        4+ properties and cash 700+ -> DEVELOPER (money and stock: improve and hold)
//        trailing on net worth late  -> TRADER    (flip for liquidity, take what you can get)
//      A switch is announced, so you see the opponent change and can adjust.
//
//   Flags per seat: mrn_pN (renovation margin), mby_pN (how far over value they chase),
//                   mls_pN (cash level at which they list), msl_pN (what they demand to sell)
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v85.json')) die('kascity_v85.json missing');
if (!fs.existsSync('showcase_kascity85.html')) die('showcase_kascity85.html missing');
const j = JSON.parse(fs.readFileSync('kascity_v85.json', 'utf8'));
const director = j.nodes.find(n => n.id === 'director') || die('director missing');
const rootSel = director.bt.sequence[1] && director.bt.sequence[1].selector;
if (!Array.isArray(rootSel)) die('root selector missing');

// ---------- conditions read the flags ----------
let renN = 0, lsN = 0, buyN = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const step = o.sequence[0];
    const c = step && step.cond;
    if (typeof c === 'string') {

      // renovation: clock-aware tiers, margin scaled by the seat's temperament
      if (c.indexOf('world.flags.renov == -1') === 0 && c.indexOf('seat() > world.flags.humans') >= 0) {
        const sm = /seat\(\) == (\d)/.exec(c);
        const um = /(\(\([^]*?\) - \([^]*?\)\)) > (\d+)/.exec(c);
        if (sm && um) {
          const seat = sm[1];
          const uplift = um[1];
          const base = parseInt(um[2], 10);
          const early = Math.max(5, Math.round(base * 1.10));
          const mid = Math.max(5, Math.round(base * 1.40));
          const m = 'world.flags.mrn_p' + seat;
          const replacement = uplift + ' > ' + early + ' * ' + m +
            ' && world.flags.left > 120' +
            ' && (world.flags.left > 300 || ' + uplift + ' > ' + mid + ' * ' + m + ')';
          step.cond = c.replace(um[0], replacement);
          renN++;
        }
      }

      // listing: the cash level at which they will put stock on the market
      if (/^world\.flags\.ls_t\d+ == 0 && seat\(\) > world\.flags\.humans/.test(c)) {
        const sm = /seat\(\) == (\d)/.exec(c);
        if (sm) {
          step.cond = c.replace(/'cash'\) < \d+$/, "'cash') < world.flags.mls_p" + sm[1])
                              .replace(/'cash'\) < 420/, "'cash') < world.flags.mls_p" + sm[1]);
          lsN++;
        }
      }

      // chasing a listing: how far over their own valuation they will go
      if (c.indexOf('world.flags.tr_state == 0 && world.flags.ls_t') === 0) {
        const sm = /seat\(\) == (\d)/.exec(c);
        if (sm) {
          step.cond = c.replace(/<= \(/, '<= world.flags.mby_p' + sm[1] + ' * (');
          buyN++;
        }
      }
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);
if (renN < 60) die('renovation flagged ' + renN + ' (<60)');
if (lsN < 60) die('listing flagged ' + lsN + ' (<60)');
if (buyN < 60) die('listing-chase flagged ' + buyN + ' (<60)');

// ---------- boot: draw a temperament per bot seat ----------
// profile 1 developer | 2 trader | 3 miser
const PROFILES = {
  1: { mrn: 0.85, mby: 1.18, mls: 400,  msl: 1.14 },
  2: { mrn: 1.05, mby: 1.02, mls: 1500, msl: 0.88 },
  3: { mrn: 1.60, mby: 0.92, mls: 250,  msl: 1.26 }
};
let bootOk = false;
(function walkA(o) {
  if (bootOk || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) {
      const ins = [];
      for (let p = 1; p <= 4; p++) {
        ins.push({ after: 0.1, do: { action: 'setFlagExpr', args: ['prof_p' + p, 'floor(rand() * 3) + 1'] } });
        // safe defaults; the switch branches immediately correct them to the drawn profile
        ins.push({ after: 0.1, do: { action: 'setState', args: ['mrn_p' + p, 1.0] } });
        ins.push({ after: 0.1, do: { action: 'setState', args: ['mby_p' + p, 1.08] } });
        ins.push({ after: 0.1, do: { action: 'setState', args: ['mls_p' + p, 900] } });
        ins.push({ after: 0.1, do: { action: 'setState', args: ['msl_p' + p, 1.0] } });
      }
      o.splice(ri, 0, ...ins);
      bootOk = true; return;
    }
    o.forEach(walkA);
  } else Object.values(o).forEach(walkA);
})(director.alarms);
if (!bootOk) die('boot anchor missing');

// ---------- switching: circumstance overrides the drawn profile ----------
let swN = 0;
for (let p = 2; p <= 4; p++) {
  const set = (prof) => ([
    { do: { action: 'setState', args: ['mrn_p' + p, PROFILES[prof].mrn] } },
    { do: { action: 'setState', args: ['mby_p' + p, PROFILES[prof].mby] } },
    { do: { action: 'setState', args: ['mls_p' + p, PROFILES[prof].mls] } },
    { do: { action: 'setState', args: ['msl_p' + p, PROFILES[prof].msl] } },
    { do: { action: 'setState', args: ['cur_p' + p, prof] } }
  ]);

  // broke -> miser
  rootSel.push({ sequence: [
    { cond: "seatStat(" + p + ",'cash') < 260 && world.flags.cur_p" + p + ' != 3' }
  ].concat(set(3)) });
  // wealthy landlord -> developer
  rootSel.push({ sequence: [
    { cond: "seatStat(" + p + ",'cash') >= 700 && seatStat(" + p + ",'props') >= 4 && world.flags.cur_p" + p + ' != 1' }
  ].concat(set(1)) });
  // trailing late -> trader, flip for liquidity
  rootSel.push({ sequence: [
    { cond: 'world.flags.left < 240 && world.flags.nw' + p + ' < world.flags.nw1 * 0.8 && world.flags.cur_p' + p + ' != 2' }
  ].concat(set(2)) });
  // otherwise settle to the drawn profile
  for (let k = 1; k <= 3; k++) {
    rootSel.push({ sequence: [
      { cond: 'world.flags.cur_p' + p + ' == 0 && world.flags.prof_p' + p + ' == ' + k }
    ].concat(set(k)) });
  }
  swN += 6;
}
if (swN < 18) die('switch branches ' + swN);

const v88str = JSON.stringify(j);
fs.writeFileSync('kascity_v88.json', v88str);

// ---------- showcase ----------
let html = fs.readFileSync('showcase_kascity85.html', 'utf8');
const oldRaw = fs.readFileSync('kascity_v85.json', 'utf8');
if (html.split(JSON.stringify(oldRaw)).length - 1 !== 1) die('embedded v85 JSON not found exactly once');
html = html.split(JSON.stringify(oldRaw)).join(JSON.stringify(v88str));

// negotiation reads the live temperament
const thRe = /\s*var need=\(theirCash<\d+\|\|theirMort>\d+\);\s*\n\s*var threshold=intr\*\(need\?[\d.]+:[\d.]+\);\s*\n\s*var accept=v>=threshold;\s*\n\s*var why=accept\?\(need\?"needs the cash":"beats their valuation"\):"below what they will take";/;
const thM = html.match(thRe);
if (!thM) die('offer decision block not found');
if (html.split(thM[0]).length - 1 !== 1) die('offer decision block not unique');
html = html.replace(thM[0], '\n' + [
  '        var fl=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '        var sellMul=fl["msl_p"+owner]||1.0;',
  '        var label=(window.KV_PROFNAME&&window.KV_PROFNAME(owner))||"";',
  '        var need=(theirCash<380||theirMort>150);',
  '        var threshold=intr*(need?0.76:0.98)*sellMul;',
  '        var accept=v>=threshold;',
  '        var why = accept',
  '          ? (need ? "needs the cash" : (label ? ("the "+label+" takes the profit") : "beats their valuation"))',
  '          : (label ? ("the "+label+" wants more") : "below what they will take");'
].join('\n'));

const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');
html = html.split(anchor).join([
  '  window.KV_END=endGame;',
  '',
  '  // ================= TEMPERAMENT DISPLAY =================',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    var NAME={1:"developer",2:"trader",3:"miser"};',
  '    var BLURB={1:"improves and holds",2:"flips fast, deals often",3:"hoards, wants a premium"};',
  '    window.KV_PROFNAME=function(seat){',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      return NAME[Math.round(f["cur_p"+seat]||0)]||"";',
  '    };',
  '    var last={};',
  '    setInterval(function(){',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var humans=window.KV_HUMANS||[1];',
  '      for(var p=2;p<=4;p++){',
  '        if(humans.indexOf(p)>=0) continue;',
  '        var cur=Math.round(f["cur_p"+p]||0);',
  '        if(!cur) continue;',
  '        var c=document.getElementById("kvc"+p);',
  '        var tag=document.getElementById("kvchar"+p);',
  '        if(!tag && c && c.parentNode){',
  '          tag=document.createElement("div");',
  '          tag.id="kvchar"+p;',
  '          tag.style.cssText="font-size:9px;letter-spacing:1px;margin-top:2px;";',
  '          c.parentNode.appendChild(tag);',
  '        }',
  '        if(tag){',
  '          tag.style.color=COL[p];',
  '          tag.textContent=NAME[cur].toUpperCase()+" \\u00b7 "+BLURB[cur];',
  '        }',
  '        if(last[p]!==undefined && last[p]!==cur){',
  '          window.KV_LOG("P"+p+"  turns "+NAME[cur]+"  \\u2014 "+BLURB[cur], COL[p]);',
  '          if(window.KV_DEAL) window.KV_DEAL(true,"P"+p+" SHIFTS", NAME[cur].toUpperCase()+" \\u00b7 "+BLURB[cur]);',
  '        }',
  '        last[p]=cur;',
  '      }',
  '    }, 900);',
  '  })();'
].join('\n'));

fs.writeFileSync('showcase_kascity88.html', html);
console.log('PASS thresholds read per-seat flags (' + renN + ' renovation, ' + lsN + ' listing, ' + buyN + ' chase)');
console.log('PASS temperament drawn at random per bot seat each game');
console.log('PASS ' + swN + ' switch branches: broke -> miser, rich landlord -> developer, trailing late -> trader');
console.log('PASS corner cards show the current temperament; a shift is announced in the log and as a banner');
console.log('OK kascity_v88.json + showcase_kascity88.html (' + (fs.statSync('showcase_kascity88.html').size/1024/1024).toFixed(1) + ' MB)');
