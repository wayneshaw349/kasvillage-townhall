// kascity_visual_v130.cjs
// Reads showcase_kascity129.html -> showcase_kascity130.html
// Bot offers only when there's a reason: the block builds/completes the bot's district, OR the bot
// is a developer, OR it is sitting on 600+ cash. Spacing 40s -> 55s. Everything else unchanged.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity129.html')) die('showcase_kascity129.html missing');
let html = fs.readFileSync('showcase_kascity129.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('if(Date.now()-last<40000){ why("waiting out spacing "+Math.round((40000-(Date.now()-last))/1000)+"s"); return; }',
    'if(Date.now()-last<55000){ why("waiting out spacing "+Math.round((55000-(Date.now()-last))/1000)+"s"); return; }',
    'spacing 55s');

rep('var amt=Math.round(intr*mul*dmB.buy*(0.95+Math.random()*0.12)/5)*5;',
    'var reason = dmB.buy>1 ? dmB.why : (label.indexOf("develop")>=0 ? "the developer wants inventory" : (cashOf(bot)>=600 ? "cash burning a hole" : ""));' + EOL +
    '    if(!reason){ tried[bot+":"+tile]=Date.now(); why("P"+bot+" has no reason to want tile "+tile); return; }' + EOL +
    '    var amt=Math.round(intr*mul*dmB.buy*(0.95+Math.random()*0.12)/5)*5;',
    'offer only with a reason (district / developer / 600+ cash)');

rep('+(label?("  \\u00b7 the "+label):"")+(dmB.why?("  \\u00b7 "+dmB.why):""), COL[bot]);',
    '+(label?("  \\u00b7 the "+label):"")+"  \\u00b7 "+reason, COL[bot]);',
    'offer log always states the reason');

fs.writeFileSync('showcase_kascity130.html', html);
console.log('OK showcase_kascity130.html (' + (fs.statSync('showcase_kascity130.html').size/1024/1024).toFixed(1) + ' MB)');
