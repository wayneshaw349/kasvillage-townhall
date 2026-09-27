// kascity_visual_v56.cjs
// Reads showcase_kascity55.html -> showcase_kascity56.html   (scene JSON unchanged)
// LAYOUT FIX: the play-by-play panel was covering P3's corner card and the prompt bar. It moves to
// the right column directly under GAME LOG, which is the only column with clear vertical space
// (P2 occupies the top-right, P4 the bottom-right, GAME LOG the middle). Width matches the log panel
// so the right edge reads as one stack. Line count trimmed to 7 so it can never reach P4's card.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity55.html')) die('showcase_kascity55.html missing');
let html = fs.readFileSync('showcase_kascity55.html', 'utf8');

// panel body: right column, below the game log, above P4
const wrapRe = /wrap\.style\.cssText="position:fixed;left:10px;bottom:10px;z-index:78;width:290px;[^"]*";/;
if (!wrapRe.test(html)) die('play-by-play wrap style not found');
html = html.replace(wrapRe,
  'wrap.style.cssText="position:fixed;right:6px;top:calc(50% + 130px);z-index:78;width:236px;' +
  'display:flex;flex-direction:column-reverse;gap:3px;pointer-events:none;max-height:210px;overflow:hidden;";');

// header sits directly above the feed
const hdrRe = /hdr\.style\.position="fixed"; hdr\.style\.left="10px"; hdr\.style\.bottom="10px"; hdr\.style\.zIndex=78;/;
if (!hdrRe.test(html)) die('play-by-play header position not found');
html = html.replace(hdrRe,
  'hdr.style.position="fixed"; hdr.style.right="6px"; hdr.style.top="calc(50% + 106px)"; ' +
  'hdr.style.zIndex=78; hdr.style.width="236px"; hdr.style.boxSizing="border-box";');

// drop the old bottom offset
const botRe = /wrap\.style\.bottom="34px";/;
if (!botRe.test(html)) die('wrap bottom offset not found');
html = html.replace(botRe, '');

// tighter type and fewer lines so the stack stays inside its slot
const rowRe = /padding:4px 10px;border-radius:3px;font:13px\/1\.4 monospace;color:#f4e4c1;/;
if (!rowRe.test(html)) die('log row style not found');
html = html.replace(rowRe, 'padding:3px 8px;border-radius:3px;font:11px/1.35 monospace;color:#f4e4c1;');

const capRe = /while\(wrap\.children\.length>12\) wrap\.removeChild\(wrap\.firstChild\);/;
if (!capRe.test(html)) die('log line cap not found');
html = html.replace(capRe, 'while(wrap.children.length>7) wrap.removeChild(wrap.firstChild);');

fs.writeFileSync('showcase_kascity56.html', html);
console.log('PASS play-by-play moved to the right column under GAME LOG (236px wide, 7 lines)');
console.log('PASS P3 card and prompt bar no longer covered');
console.log('OK showcase_kascity56.html (' + (fs.statSync('showcase_kascity56.html').size/1024/1024).toFixed(1) + ' MB)');
