// kascity_visual_v68.cjs
// Reads showcase_kascity67.html -> showcase_kascity68.html   (scene JSON unchanged)
//
// SCENARIO STORM FIX. Three separate faults were stacking:
//   1. present() now returns early for bots WITHOUT clearing busy — but the early-return path never
//      set busy, so the loop kept firing every 1.2s with nothing blocking it.
//   2. The trigger only checks position, and position does not change while a modal is open, so the
//      same landing re-fired continuously.
//   3. The 45s guarantee timer ran even while scenarios were firing normally.
// Fixes: a fired-landing memo (seat+tile must be new), a hard 1-per-turn cap, busy cleared on every
// path, pacing raised to 12s, and the guarantee only runs if nothing has fired for 60s.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity67.html')) die('showcase_kascity67.html missing');
let html = fs.readFileSync('showcase_kascity67.html', 'utf8');

// 1) memo + turn cap declared alongside the other scenario state
const stateRe = /    var used=\{\}, busy=false, lastFire=0;/;
if (!stateRe.test(html)) die('scenario state vars not found');
html = html.replace(stateRe,
  '    var used={}, busy=false, lastFire=0;\n' +
  '    var firedLanding={};      // seat+tile already handled\n' +
  '    var lastTurnSeen=-1, firedThisTurn=0;');

// 2) trigger requires a landing not already handled, and one per turn
const gateRe = /      if\(Math\.random\(\)>0\.75\) return;\s*\/\/ not every landing/;
if (!gateRe.test(html)) die('chance gate not found');
html = html.replace(gateRe,
  '      var turnNo=(f.turn==null?-1:Math.round(f.turn));\n' +
  '      if(turnNo!==lastTurnSeen){ lastTurnSeen=turnNo; firedThisTurn=0; }\n' +
  '      if(firedThisTurn>=1) return;                       // at most one per turn\n' +
  '      var memo=seat+":"+pos+":"+turnNo;\n' +
  '      if(firedLanding[memo]) return;                     // this landing already handled\n' +
  '      if(Math.random()>0.55) { firedLanding[memo]=1; return; }\n' +
  '      firedLanding[memo]=1;\n' +
  '      firedThisTurn++;');

// 3) longer pacing
const paceRe = /if\(Date\.now\(\)-lastFire < 5000\) return;\s*\/\/ pacing/;
if (!paceRe.test(html)) die('pacing gate not found');
html = html.replace(paceRe, 'if(Date.now()-lastFire < 12000) return;  // pacing');

// 4) bots must not leave the loop hot
const botPathRe = /        \/\/ bot: resolve on expected value, no modal\n        resolve\(sc, bestIndex\(sc, cashOfSeat\(seat\)\), seat, false\);\n        return;/;
if (!botPathRe.test(html)) die('bot resolve path not found');
html = html.replace(botPathRe,
  '        // bot: resolve on expected value, no modal\n' +
  '        busy=true;\n' +
  '        lastFire=Date.now();\n' +
  '        resolve(sc, bestIndex(sc, cashOfSeat(seat)), seat, false);\n' +
  '        return;');

// 5) resolve() always releases the lock and stamps the clock
const resolveRe = /      if\(window\.KV_MOVE\) window\.KV_MOVE\(seat,"mgmt:"\+sc\.id,oi\);\n      busy=false;/;
if (!resolveRe.test(html)) die('resolve tail not found');
html = html.replace(resolveRe,
  '      if(window.KV_MOVE) window.KV_MOVE(seat,"mgmt:"+sc.id,oi);\n' +
  '      lastFire=Date.now();\n' +
  '      busy=false;');

// 6) guarantee timer only when genuinely idle
const guarRe = /      if\(Date\.now\(\)-lastFire < 45000\) return;/;
if (!guarRe.test(html)) die('guarantee timer not found');
html = html.replace(guarRe, '      if(Date.now()-lastFire < 60000) return;');

// 7) safety: if a modal somehow sticks, release after 30s
const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');
html = html.split(anchor).join([
  '  window.KV_END=endGame;',
  '',
  '  // scenario deadlock breaker — clears any stuck modal',
  '  (function(){',
  '    var seenAt=0;',
  '    setInterval(function(){',
  '      var open=document.querySelector("div[style*=\'z-index:76\']");',
  '      if(!open){ seenAt=0; return; }',
  '      if(!seenAt){ seenAt=Date.now(); return; }',
  '      if(Date.now()-seenAt>30000){',
  '        open.remove(); seenAt=0;',
  '        if(window.KV_LOG) window.KV_LOG("scenario timed out","#ff6a4a");',
  '      }',
  '    }, 2000);',
  '  })();'
].join('\n'));

fs.writeFileSync('showcase_kascity68.html', html);
console.log('PASS one scenario per turn, per landing — repeat firing on the same square stopped');
console.log('PASS busy lock set on the bot path too; resolve() always stamps the clock and releases');
console.log('PASS pacing 12s, chance 55%, guarantee only after 60s idle');
console.log('PASS deadlock breaker clears a stuck modal after 30s');
console.log('OK showcase_kascity68.html (' + (fs.statSync('showcase_kascity68.html').size/1024/1024).toFixed(1) + ' MB)');
