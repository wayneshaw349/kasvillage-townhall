// kascity_visual_v152.cjs
// Reads showcase_kascity151.html -> showcase_kascity152.html
// ROOT CAUSE of "I accept and my block goes for nothing": the scenario resolver (buyer card and
// friends) sells a deed via sc_sell but credits only the scenario swing (win - cost, e.g. +40),
// not the block's worth. FIX: when a card sale takes a block, pay its market value on top of the
// swing, and name the block in the log. A forfeit (losesOnFail) still pays nothing — that is the
// designed penalty — but now says so explicitly.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity151.html')) die('showcase_kascity151.html missing');
let html = fs.readFileSync('showcase_kascity151.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('window.KV_SETSTATE("sc_amt", lost ? Math.round(Math.min(0, swing)) : Math.round(swing));',
    'var __sale = 0;' + EOL +
    '      if(sold!=null && !lost){ __sale = (window.KV_MARKET ? window.KV_MARKET(sold) : 0) || 0;' + EOL +
    '        if(window.KV_LOG) window.KV_LOG("P"+seat+"  sale price  "+__sale+"  for "+((window.KV_NAMES[sold]&&window.KV_NAMES[sold].n)||("block "+sold))+"  (plus deal margin "+(swing>=0?"+":"")+Math.round(swing)+")", COL[seat]); }' + EOL +
    '      if(sold!=null && lost && window.KV_LOG) window.KV_LOG("P"+seat+"  forfeits "+((window.KV_NAMES[sold]&&window.KV_NAMES[sold].n)||("block "+sold))+"  \\u2014 no payment, this is the penalty","#ff6a4a");' + EOL +
    '      window.KV_SETSTATE("sc_amt", lost ? Math.round(Math.min(0, swing)) : Math.round(swing + __sale));',
    'card sales pay the block market value on top of the swing');

fs.writeFileSync('showcase_kascity152.html', html);
console.log('OK showcase_kascity152.html (' + (fs.statSync('showcase_kascity152.html').size/1024/1024).toFixed(1) + ' MB)');
