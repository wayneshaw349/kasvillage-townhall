// kascity_visual_v57.cjs
// Reads showcase_kascity56.html -> showcase_kascity57.html   (scene JSON unchanged)
// Raises the play-by-play stack in the right column: header from 50%+106px to 50%+58px, feed to
// 50%+82px. That lifts the whole block by roughly 48px so it sits closer under GAME LOG with more
// clearance above P4's card.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity56.html')) die('showcase_kascity56.html missing');
let html = fs.readFileSync('showcase_kascity56.html', 'utf8');

const feedOld = 'top:calc(50% + 130px)';
if (html.split(feedOld).length - 1 !== 1) die('feed offset not found');
html = html.split(feedOld).join('top:calc(50% + 82px)');

const hdrOld = 'hdr.style.top="calc(50% + 106px)"';
if (html.split(hdrOld).length - 1 !== 1) die('header offset not found');
html = html.split(hdrOld).join('hdr.style.top="calc(50% + 58px)"');

fs.writeFileSync('showcase_kascity57.html', html);
console.log('PASS play-by-play raised 48px (header 50%+58px, feed 50%+82px)');
console.log('OK showcase_kascity57.html (' + (fs.statSync('showcase_kascity57.html').size/1024/1024).toFixed(1) + ' MB)');
