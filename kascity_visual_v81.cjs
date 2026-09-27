// kascity_visual_v81.cjs
// Reads showcase_kascity80.html -> showcase_kascity81.html   (scene JSON unchanged)
// Raises the PLAY BY PLAY stack: header 406px -> 356px, feed 430px -> 380px. GAME LOG stays pinned
// at 150px, so the gap between the two panels is preserved.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity80.html')) die('showcase_kascity80.html missing');
let html = fs.readFileSync('showcase_kascity80.html', 'utf8');

if (html.split('top:430px').length - 1 !== 1) die('feed offset not found');
html = html.split('top:430px').join('top:380px');

if (html.split('hdr.style.top="406px"').length - 1 !== 1) die('header offset not found');
html = html.split('hdr.style.top="406px"').join('hdr.style.top="356px"');

fs.writeFileSync('showcase_kascity81.html', html);
console.log('PASS play-by-play raised 50px (header 356px, feed 380px)');
console.log('OK showcase_kascity81.html (' + (fs.statSync('showcase_kascity81.html').size/1024/1024).toFixed(1) + ' MB)');
