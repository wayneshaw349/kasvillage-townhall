// kascity_visual_v85.cjs
// Reads kascity_v83.json + showcase_kascity84.html -> kascity_v85.json + showcase_kascity85.html
//
// THE FREEZE. Bot renovation triggers were unshifted to the FRONT of the root selector with no
// once-per-turn guard. Sequence of events each tick:
//     trigger fires -> renov set -> work branch renovates + sets phase 3 -> turn "ends"
//     next tick: trigger fires again on another property -> repeat, forever
// The bot renovated in a loop and never rolled. Because a selector stops at its first success, this
// also starved every branch below it — which is exactly why listings and offers never ran either.
//
// Fixes:
//   1. per-turn guard: a bot may trigger at most one renovation per turn (renov_turn == world.flags.turn)
//   2. the same guard on listing triggers, so they cannot monopolise a turn either
//   3. renovation triggers moved BEHIND the roll branches — rolling always takes priority
//   4. a watchdog: if the turn counter has not moved in 12 seconds, force phase 3 and clear renov
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v83.json')) die('kascity_v83.json missing');
if (!fs.existsSync('showcase_kascity84.html')) die('showcase_kascity84.html missing');
const j = JSON.parse(fs.readFileSync('kascity_v83.json', 'utf8'));
const director = j.nodes.find(n => n.id === 'director') || die('director missing');
const rootSel = director.bt.sequence[1] && director.bt.sequence[1].selector;
if (!Array.isArray(rootSel)) die('root selector missing');

// ---------- 1+2. per-turn guards, and pull the triggers out of the front ----------
const pulled = [];
let renGuard = 0, lsGuard = 0;
for (let i = rootSel.length - 1; i >= 0; i--) {
  const br = rootSel[i];
  const c = br && br.sequence && br.sequence[0] && br.sequence[0].cond;
  if (typeof c !== 'string') continue;

  // bot renovation trigger
  if (c.indexOf('world.flags.renov == -1') === 0 && c.indexOf('seat() > world.flags.humans') >= 0) {
    if (c.indexOf('renov_turn') < 0) {
      br.sequence[0].cond = c + ' && world.flags.renov_turn != world.flags.turn';
      br.sequence.splice(1, 0, { do: { action: 'setFlagExpr', args: ['renov_turn', 'world.flags.turn'] } });
      renGuard++;
    }
    pulled.push(rootSel.splice(i, 1)[0]);
    continue;
  }
  // bot listing triggers
  if (/^world\.flags\.ls_t\d+ == 0 && seat\(\) > world\.flags\.humans/.test(c)) {
    if (c.indexOf('ls_turn') < 0) {
      br.sequence[0].cond = c + ' && world.flags.ls_turn != world.flags.turn';
      br.sequence.splice(1, 0, { do: { action: 'setFlagExpr', args: ['ls_turn', 'world.flags.turn'] } });
      lsGuard++;
    }
    pulled.push(rootSel.splice(i, 1)[0]);
  }
}
if (renGuard < 60) die('renovation guards added ' + renGuard + ' (<60)');
if (lsGuard < 60) die('listing guards added ' + lsGuard + ' (<60)');

// ---------- 3. reinsert behind the roll branches ----------
let rollIdx = -1;
for (let i = 0; i < rootSel.length; i++) {
  const s = JSON.stringify(rootSel[i]);
  if (s.indexOf('"drawCard"') >= 0 || s.indexOf('world.flags.go >= 0') >= 0) rollIdx = i;
}
if (rollIdx < 0) rollIdx = Math.min(40, rootSel.length - 1);
rootSel.splice(rollIdx + 1, 0, ...pulled);

// ---------- 4. watchdog ----------
rootSel.unshift({ sequence: [
  { cond: 'world.flags.wd_turn != world.flags.turn' },
  { do: { action: 'setFlagExpr', args: ['wd_turn', 'world.flags.turn'] } },
  { do: { action: 'setFlagExpr', args: ['wd_t', 'world.time'] } }
]});
rootSel.unshift({ sequence: [
  { cond: 'world.flags.over == 0 && world.flags.wd_t > 0 && world.time - world.flags.wd_t > 12' },
  { do: { action: 'setState', args: ['renov', -1] } },
  { do: { action: 'setState', args: ['renov_by', 0] } },
  { do: { action: 'setState', args: ['tr_state', 0] } },
  { do: { action: 'setState', args: ['asked', 0] } },
  { do: { action: 'setState', args: ['phase', 3] } },
  { do: { action: 'setFlagExpr', args: ['wd_t', 'world.time'] } }
]});

// boot the guard flags
let bootOk = false;
(function walkA(o) {
  if (bootOk || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) {
      o.splice(ri, 0,
        { after: 0.1, do: { action: 'setState', args: ['renov_turn', -1] } },
        { after: 0.1, do: { action: 'setState', args: ['ls_turn', -1] } },
        { after: 0.1, do: { action: 'setState', args: ['wd_turn', -1] } },
        { after: 0.1, do: { action: 'setState', args: ['wd_t', 0] } });
      bootOk = true; return;
    }
    o.forEach(walkA);
  } else Object.values(o).forEach(walkA);
})(director.alarms);
if (!bootOk) die('boot anchor missing');

const v85str = JSON.stringify(j);
fs.writeFileSync('kascity_v85.json', v85str);

// ---------- showcase ----------
let html = fs.readFileSync('showcase_kascity84.html', 'utf8');
const oldRaw = fs.readFileSync('kascity_v83.json', 'utf8');
if (html.split(JSON.stringify(oldRaw)).length - 1 !== 1) die('embedded v83 JSON not found exactly once');
html = html.split(JSON.stringify(oldRaw)).join(JSON.stringify(v85str));

// surface a stalled turn so it is never a mystery
const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');
html = html.split(anchor).join([
  '  window.KV_END=endGame;',
  '',
  '  // ---- stall detector ----',
  '  (function(){',
  '    var lastTurn=null, since=Date.now(), warned=false;',
  '    setInterval(function(){',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      if(f.over) return;',
  '      var t=f.turn;',
  '      if(t!==lastTurn){ lastTurn=t; since=Date.now(); warned=false; return; }',
  '      var stuck=(Date.now()-since)/1000;',
  '      if(stuck>10 && !warned){',
  '        warned=true;',
  '        var seat=((t||0)%4)+1;',
  '        window.KV_LOG("P"+seat+" has stalled "+Math.round(stuck)+"s — forcing the turn on","#ff6a4a");',
  '        if(window.KV_SETSTATE){',
  '          window.KV_SETSTATE("renov",-1); window.KV_SETSTATE("renov_by",0);',
  '          window.KV_SETSTATE("tr_state",0); window.KV_SETSTATE("asked",0);',
  '          window.KV_SETSTATE("phase",3);',
  '        }',
  '      }',
  '    }, 1500);',
  '  })();'
].join('\n'));

fs.writeFileSync('showcase_kascity85.html', html);
console.log('PASS ' + renGuard + ' renovation triggers guarded to one per turn');
console.log('PASS ' + lsGuard + ' listing triggers guarded to one per turn');
console.log('PASS ' + pulled.length + ' triggers moved behind the roll branches — rolling wins priority');
console.log('PASS BT watchdog at 12s + client stall detector at 10s, both force the turn on');
console.log('OK kascity_v85.json + showcase_kascity85.html (' + (fs.statSync('showcase_kascity85.html').size/1024/1024).toFixed(1) + ' MB)');
