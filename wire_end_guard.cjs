// wire_end_guard.cjs - never let an automatic closer end a turn under a choosing player.
//
// KasCity's auto-closers (stall failsafe, half-open-turn healer after only 8 s of
// quiet, closer guarantee) post 'end' with value 0 and none checks for an open
// Buy/Pass dialog or scenario card - a player thinking for 8 s lost the turn
// and the stray end could wedge the next seat. While a real choice is open on
// this device, an 'end' with value 0 is dropped (never queued or replaced); the
// closers retry once the choice closes. Roll prompts and roll-for-first are not
// counted. Human ends (turn number) and CONTINUE/bot ends (seat) are untouched.
// Prevention only - it never posts anything. Works with live v414 and v416.
//
// Verified in Chromium, injected before load into v416: every KV_MOVE the game
// defines is wrapped; card open -> end:0 held, end:2/end:7/buy pass; card
// closed -> all pass.
//
// Run from the repo root:   node wire_end_guard.cjs
const fs = require('fs');
const PLAN = [{"file":"OnChainPageView.tsx","hunks":[["// KV_ROLL_RESCUE v3: the CONTINUE button posts what the CHAIN is owed.\n","// KV_END_GUARD: never let an automatic closer end a turn under a player who is choosing.\n// KasCity's three auto-closers (stall failsafe, half-open-turn healer after 8 s of\n// quiet, closer guarantee) all post `end` with value 0 and none checks for an open\n// Buy/Pass dialog or scenario card - so a player thinking for 8 s lost the turn.\n// While a choice is open on THIS device, an `end` with value 0 is dropped (never\n// queued, never replaced); the closers retry on their own once the choice closes.\n// The game's own Roll prompt and the roll-for-first screen are not choices here.\n// Human ends carry the turn number, rescue/bot ends carry the seat - untouched.\n// Prevention only: it never posts or changes anything.\nconst KV_END_GUARD = \"(function(){try{var vis=function(e){try{if(!e||!document.body.contains(e))return false;var cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden')return false;return e.getClientRects().length>0;}catch(x){return false;}};var choiceOpen=function(){try{var ds=document.querySelectorAll('div[data-i]');for(var i=0;i<ds.length;i++)if(vis(ds[i])&&!/\\\\broll\\\\b/i.test(ds[i].textContent||''))return true;var ms=document.querySelectorAll('[data-kvmodal]');for(var k=0;k<ms.length;k++)if(vis(ms[k])&&!/roll for first/i.test(ms[k].textContent||''))return true;var os=document.querySelectorAll('div');for(var j=0;j<os.length;j++){var st=os[j].getAttribute&&os[j].getAttribute('style');if(st&&/z-index:\\\\s*76/.test(st)&&vis(os[j]))return true;}}catch(e){}return false;};var lastLog=0;var mk=function(fn){var w=function(seat,action,value,fx){try{if(String(action)==='end'&&(+value===0)&&choiceOpen()){var n=Date.now();if(n-lastLog>5000){lastLog=n;try{if(window.KV_LOG)window.KV_LOG('held an automatic end for P'+seat+' — a choice is open','#7fd87f');}catch(e){}}try{console.log('[KV_END_GUARD] held auto-end P'+seat);}catch(e){}return;}}catch(e){}return fn.apply(this,arguments);};try{for(var k in fn)if(Object.prototype.hasOwnProperty.call(fn,k))w[k]=fn[k];}catch(e){}w.__kvEG=1;w.__kvInner=fn;return w;};var cur=window.KV_MOVE;if(typeof cur==='function'&&!cur.__kvEG)cur=mk(cur);Object.defineProperty(window,'KV_MOVE',{configurable:true,enumerable:true,get:function(){return cur;},set:function(v){cur=(typeof v==='function'&&!v.__kvEG)?mk(v):v;}});}catch(e){}})();true;\";\n\n// KV_ROLL_RESCUE v3: the CONTINUE button posts what the CHAIN is owed.\n"],["(props.game ? KV_ROLL_RESCUE : '') /* KV_ROLL_RESCUE */","(props.game ? KV_END_GUARD : '') /* KV_END_GUARD */ + (props.game ? KV_ROLL_RESCUE : '') /* KV_ROLL_RESCUE */"]]}];
let okF = 0, skipF = 0, badF = 0;
for (const p of PLAN) {
  if (!fs.existsSync(p.file)) { console.log('  MISSING ' + p.file); badF++; continue; }
  const raw = fs.readFileSync(p.file, 'utf8'); const CRLF = raw.includes('\r\n'); let s = raw.replace(/\r\n/g, '\n');
  if (s.includes('const KV_END_GUARD = ')) { console.log('  skip  ' + p.file + ' (already done)'); skipF++; continue; }
  let fail = '';
  for (const [o, n] of p.hunks) { const c = s.split(o).length - 1; if (c !== 1) { fail = 'change ' + (p.hunks.indexOf(p.hunks.find((h) => h[0] === o)) + 1) + ' matched ' + c + 'x'; break; } s = s.replace(o, () => n); }
  if (fail) { console.log('  FAIL  ' + p.file + ' - ' + fail + ' (file left unchanged)'); badF++; continue; }
  fs.copyFileSync(p.file, p.file + '.bak_endguard'); fs.writeFileSync(p.file, CRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('  ok    ' + p.file + ' (' + p.hunks.length + ' changes)'); okF++;
}
console.log('\n' + okF + ' files patched, ' + skipF + ' already done, ' + badF + ' failed' + (badF ? '  <- send me this output' : ''));
