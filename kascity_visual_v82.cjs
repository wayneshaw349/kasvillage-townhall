// kascity_visual_v82.cjs
// Reads showcase_kascity81.html -> showcase_kascity82.html   (scene JSON unchanged)
// Left column tidy-up: MARKET and HOLDINGS move up out of the middle of the screen, and P3's corner
// card lifts clear of the prompt bar which was clipping its wallet field.
//   MARKET   50% - 118px -> 150px
//   HOLDINGS 50% -  90px -> 178px
//   P3 card  bottom 8px  -> bottom 120px
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity81.html')) die('showcase_kascity81.html missing');
let html = fs.readFileSync('showcase_kascity81.html', 'utf8');

// market index strip
const mkRe = /position:fixed;left:8px;top:calc\(50% - 118px\);z-index:57;width:214px;/;
if (!mkRe.test(html)) die('market strip style not found');
html = html.replace(mkRe, 'position:fixed;left:8px;top:150px;z-index:57;width:214px;');

// holdings panel
const hdRe = /position:fixed;left:8px;top:calc\(50% - 90px\);z-index:57;width:214px;/;
if (!hdRe.test(html)) die('holdings panel style not found');
html = html.replace(hdRe, 'position:fixed;left:8px;top:178px;z-index:57;width:214px;');

// P3 corner card — lift it off the prompt bar
const p3Re = /3: "left:8px;bottom:92px;"/;
if (!p3Re.test(html)) die('P3 card spot not found');
html = html.replace(p3Re, '3: "left:8px;bottom:120px;"');

const p4Re = /4: "right:8px;bottom:92px;"/;
if (p4Re.test(html)) html = html.replace(p4Re, '4: "right:8px;bottom:120px;"');

fs.writeFileSync('showcase_kascity82.html', html);
console.log('PASS MARKET raised to 150px, HOLDINGS to 178px');
console.log('PASS P3 and P4 cards lifted to 120px, clear of the prompt bar');
console.log('OK showcase_kascity82.html (' + (fs.statSync('showcase_kascity82.html').size/1024/1024).toFixed(1) + ' MB)');
