// wire_dlg_watch.cjs - clear the ghost dialog that silently freezes a guest's turns.
//
// ROOT CAUSE of every missing-Roll game, confirmed live in a desktop browser
// (dialogueOpen() true with nothing on screen, turn logic frozen 10 minutes):
// the engine pauses ALL turn logic while one of its own dialogs is open, and a
// guest's boot-time prompt (the game boots as single-player seat 1 before the
// join re-seats it) can be hidden without the dialog state being cleared.
//
// The watchdog: in a started relay game, if the dialog state is set but its
// window is not actually visible for ~4s, clear it and reset 'asked'; the
// revived turn logic re-opens the correct prompt by itself. Verified in
// Chromium: ghost cleared -> fresh visible Roll prompt appears; legit open
// dialogs and single-player are untouched. Applies to v414 and v416 alike.
//
// Run from the repo root:   node wire_dlg_watch.cjs
const fs = require('fs');
const PLAN = [{"file":"OnChainPageView.tsx","hunks":[["// KV_ROLL_RESCUE v3: the CONTINUE button posts what the CHAIN is owed.\n","// KV_DLG_WATCH: clear a ghost engine dialog that froze the turn logic.\n// Confirmed in-browser (room kcc40ea2ce): the engine pauses ALL turn logic while\n// one of its own dialogs is open, and a guest's boot-time prompt (the game boots\n// as single-player seat 1 before the multiplayer join re-seats it) can be hidden\n// by the MP machinery without the engine dialog state being cleared - dialogueOpen()\n// stayed true for 10 minutes with nothing on screen, so no Roll was ever offered.\n// Rule: in a started relay game, if the dialog state is set but its window is not\n// actually visible for 2 consecutive checks (~4s), clear it and reset the asked\n// flag; the revived turn logic then re-opens the correct prompt by itself (verified\n// in Chromium: ghost cleared -> fresh visible Roll prompt; legit open dialogs and\n// single-player untouched).\nconst KV_DLG_WATCH = \"(function(){try{var LOG=function(m){try{if(window.KV_LOG)window.KV_LOG(m,'#7fd87f');}catch(e){}try{console.log('[KV_DLG_WATCH] '+m);}catch(e){}};var strikes=0;setInterval(function(){try{var M=window.KV_MP2;if(!M||!M.room||!M.started){strikes=0;return;}var d=window.DLG;if(!d){strikes=0;return;}var el=null;try{el=(typeof dlgEl!=='undefined')?dlgEl:null;}catch(e){}var vis=!!(el&&el.offsetParent);if(vis){strikes=0;return;}strikes++;if(strikes<2)return;strikes=0;window.DLG=null;try{if(typeof hideDialogue==='function')hideDialogue();}catch(e){}try{if(el)el.style.display='none';}catch(e){}try{if(window.KV_SETSTATE)window.KV_SETSTATE('asked',0);}catch(e){}LOG('cleared a stale engine dialog \\u2014 the turn logic was frozen behind it');}catch(e){}},2000);}catch(e){}})();true;\";\n\n// KV_ROLL_RESCUE v3: the CONTINUE button posts what the CHAIN is owed.\n"],["(props.game ? KV_ROLL_RESCUE : '') /* KV_ROLL_RESCUE */","(props.game ? KV_DLG_WATCH : '') /* KV_DLG_WATCH */ + (props.game ? KV_ROLL_RESCUE : '') /* KV_ROLL_RESCUE */"]]}];
let okF = 0, skipF = 0, badF = 0;
for (const p of PLAN) {
  if (!fs.existsSync(p.file)) { console.log('  MISSING ' + p.file); badF++; continue; }
  const raw = fs.readFileSync(p.file, 'utf8'); const CRLF = raw.includes('\r\n'); let s = raw.replace(/\r\n/g, '\n');
  if (s.includes('const KV_DLG_WATCH = ')) { console.log('  skip  ' + p.file + ' (already done)'); skipF++; continue; }
  let fail = '';
  for (const [o, n] of p.hunks) { const c = s.split(o).length - 1; if (c !== 1) { fail = 'change ' + (p.hunks.indexOf(p.hunks.find((h) => h[0] === o)) + 1) + ' matched ' + c + 'x'; break; } s = s.replace(o, () => n); }
  if (fail) { console.log('  FAIL  ' + p.file + ' - ' + fail + ' (file left unchanged)'); badF++; continue; }
  fs.copyFileSync(p.file, p.file + '.bak_dlgwatch'); fs.writeFileSync(p.file, CRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('  ok    ' + p.file + ' (' + p.hunks.length + ' changes)'); okF++;
}
console.log('\n' + okF + ' files patched, ' + skipF + ' already done, ' + badF + ' failed' + (badF ? '  <- send me this output' : ''));
