// kascity_visual_v108.cjs
// Reads showcase_kascity107.html -> showcase_kascity108.html
// ROLL button was dead: the overlay blocked events in capture phase, so the click never reached
// the button. Block in bubble phase instead (board still shielded). Backdrop made see-through.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity107.html')) die('showcase_kascity107.html missing');
let html = fs.readFileSync('showcase_kascity107.html', 'utf8');
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('["pointerdown","keydown","click"].forEach(function(t){ ov.addEventListener(t,function(e){ e.stopPropagation(); }, true); });',
    '["pointerdown","pointerup","keydown","click"].forEach(function(t){ ov.addEventListener(t,function(e){ e.stopPropagation(); }); });',
    'overlay blocks in bubble phase — ROLL button receives its click');
rep('z-index:90;background:rgba(10,8,6,.82);display:flex;',
    'z-index:90;background:rgba(10,8,6,.18);display:flex;',
    'board visible behind the roll-off');

fs.writeFileSync('showcase_kascity108.html', html);
console.log('OK showcase_kascity108.html (' + (fs.statSync('showcase_kascity108.html').size/1024/1024).toFixed(1) + ' MB)');
