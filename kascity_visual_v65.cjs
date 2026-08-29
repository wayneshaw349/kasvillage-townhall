// kascity_visual_v65.cjs
// Reads showcase_kascity64.html -> showcase_kascity65.html   (scene JSON unchanged)
// Removes the music ducking added in v64: the mix stays flat and the music never dips. Samples stay
// at 1.0 and the music baseline sits at 0.26 instead, so voice lines still cut through without the
// pumping effect.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity64.html')) die('showcase_kascity64.html missing');
let html = fs.readFileSync('showcase_kascity64.html', 'utf8');

const duckStart = 'if(window.KV_MUSIC && !window.KV_MUSIC.paused){';
const duckEnd = "    }, dur);\n  }";
const si = html.indexOf(duckStart);
const ei = html.indexOf(duckEnd);
if (si < 0 || ei <= si) die('ducking block not found');
html = html.slice(0, si) + html.slice(ei + duckEnd.length);

const volRe = /window\.KV_MUSIC\.volume = 0\.30;/;
if (!volRe.test(html)) die('music baseline volume not found');
html = html.replace(volRe, 'window.KV_MUSIC.volume = 0.26;');

if (html.indexOf('KV_DUCK_T') >= 0) die('duck references survived');

fs.writeFileSync('showcase_kascity65.html', html);
console.log('PASS ducking removed — music holds a steady level');
console.log('PASS music baseline 0.26, samples 1.0');
console.log('OK showcase_kascity65.html (' + (fs.statSync('showcase_kascity65.html').size/1024/1024).toFixed(1) + ' MB)');
