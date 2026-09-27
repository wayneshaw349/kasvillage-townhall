// kascity_visual_v137.cjs
// Reads showcase_kascity136.html -> showcase_kascity137.html
// 1) On every seat change, asked/go are reset so the incoming seat (bot or you) can roll at once.
// 2) Nudges (JS stall step 2 and the engine watchdog) set phase to 0 if the seat hasn't moved yet,
//    3 only if it has. Previously phase=3 pre-roll parked bots until they were passed over.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity136.html')) die('showcase_kascity136.html missing');
let html = fs.readFileSync('showcase_kascity136.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function q(s) { return s.replace(/"/g, '\\"'); }
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

// 1) seat-change reset
rep('// ---- stall detector (escalating) ----',
  '// ---- seat-change reset (v137) ----' + EOL +
  '(function(){ var lastSeat=null; setInterval(function(){ var f=(window.KV_FLAGS&&window.KV_FLAGS())||{}; if(!(f.t0>0)||f.over) return; var s=f.seat||1; if(lastSeat===null){ lastSeat=s; return; } if(s!==lastSeat){ lastSeat=s; if(window.KV_SETSTATE && !(f.moved>0)){ window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1); } } },200); })();' + EOL + EOL +
  '// ---- stall detector (escalating) ----',
  'asked/go reset on seat change');

// 2a) JS nudge phase
rep('if(window.KV_SETSTATE){ window.KV_SETSTATE("asked",0); window.KV_SETSTATE("phase",3); }',
    'if(window.KV_SETSTATE){ window.KV_SETSTATE("asked",0); window.KV_SETSTATE("phase",(f.moved>0)?3:0); }',
    'JS nudge respects moved');

// 2b) engine watchdog phase
const wdOld = q('{"do":{"action":"setState","args":["asked",0]}},{"do":{"action":"setState","args":["phase",3]}},{"do":{"action":"setFlagExpr","args":["wd_t","world.time"]}}');
const wdNew = q('{"do":{"action":"setState","args":["asked",0]}},{"do":{"action":"setFlagExpr","args":["phase","world.flags.moved * 3"]}},{"do":{"action":"setFlagExpr","args":["wd_t","world.time"]}}');
rep(wdOld, wdNew, 'engine watchdog respects moved');

fs.writeFileSync('showcase_kascity137.html', html);
console.log('OK showcase_kascity137.html (' + (fs.statSync('showcase_kascity137.html').size/1024/1024).toFixed(1) + ' MB)');
