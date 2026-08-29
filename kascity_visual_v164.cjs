// kascity_visual_v164.cjs
// Reads showcase_kascity163.html -> showcase_kascity164.html
// Flavour: the holding-cell banner now names an offence instead of saying "fate card", so being
// sent to the cell reads as a consequence rather than a glitch. The offence is picked from a list
// using the seed-independent turn count, so it varies but never repeats twice running.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity163.html')) die('showcase_kascity163.html missing');
let html = fs.readFileSync('showcase_kascity163.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('        if (window.KV_SHOUT) window.KV_SHOUT("SENT TO HOLDING",' + EOL +
    '          "P" + p + " \\u00b7 fate card \\u00b7 fined 50 \\u00b7 turn ends", "#ff4a3a",' + EOL +
    '          (window.KV_HUMANS || [1]).indexOf(p) >= 0);' + EOL +
    '        if (window.KV_LOG) window.KV_LOG("P" + p + " SENT TO HOLDING (cell is tile 10) \\u00b7 fined 50", "#ff4a3a");',
    '        var CRIMES = ["permits forged", "inspector bribed", "books cooked", "tenants shut out illegally",' + EOL +
    '                      "safety notices ignored", "rent skimmed off the books", "deeds falsified",' + EOL +
    '                      "site worked without licence", "meter tampered with", "cash paid under the table"];' + EOL +
    '        var crime = CRIMES[((f.turn || 0) + p) % CRIMES.length];' + EOL +
    '        if (window.KV_SHOUT) window.KV_SHOUT("CAUGHT \\u2014 SENT TO HOLDING",' + EOL +
    '          "P" + p + " \\u00b7 " + crime + " \\u00b7 fined 50 \\u00b7 turn ends", "#ff4a3a",' + EOL +
    '          (window.KV_HUMANS || [1]).indexOf(p) >= 0);' + EOL +
    '        if (window.KV_LOG) window.KV_LOG("P" + p + " caught: " + crime + " \\u2014 sent to the Holding Cell, fined 50", "#ff4a3a");',
    'holding banner names the offence');

fs.writeFileSync('showcase_kascity164.html', html);
console.log('OK showcase_kascity164.html (' + (fs.statSync('showcase_kascity164.html').size/1024/1024).toFixed(1) + ' MB)');
