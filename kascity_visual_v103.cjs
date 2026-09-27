// kascity_visual_v103.cjs
// Reads showcase_kascity102.html -> showcase_kascity103.html
// 1) WHAT HAD HAPPENED WAS strip: shorter, sits level with the button row instead of climbing over the board
// 2) stall detector: do nothing until the game has started (engine t0 set) — it was passing turns pre-tap
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity102.html')) die('showcase_kascity102.html missing');
let html = fs.readFileSync('showcase_kascity102.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(re, out, name) { const m = html.match(new RegExp(re.source, 'g')); if (!m || m.length !== 1) die(name + ' expected 1 match, got ' + (m ? m.length : 0)); html = html.replace(re, out); console.log('PASS ' + name); }

rep(/left:270px;right:250px;bottom:6px;height:88px;z-index:59;/,
    'left:270px;right:250px;bottom:6px;height:54px;z-index:59;',
    'feed strip 88px -> 54px, level with the button row');

rep(/if\(window\.KV_SCN_BUSY && window\.KV_SCN_BUSY\(\)\)\{ since=Date\.now\(\); step=0; return; \}/,
    'if(!(f.t0>0)){ since=Date.now(); step=0; return; }  // v103: not started yet = not a stall' + EOL +
    'if(window.KV_SCN_BUSY && window.KV_SCN_BUSY()){ since=Date.now(); step=0; return; }',
    'stall detector waits for first tap');

fs.writeFileSync('showcase_kascity103.html', html);
console.log('OK showcase_kascity103.html (' + (fs.statSync('showcase_kascity103.html').size/1024/1024).toFixed(1) + ' MB)');
