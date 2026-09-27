// kascity_visual_v128.cjs
// Reads showcase_kascity127.html -> showcase_kascity128.html
// District motive. The district table is read out of the engine's dbon_N conditions and exposed as
// window.KV_DISTRICTS. Then:
//  - a bot BUYING from you pays +25% if the block completes its district, +10% if it holds part of it
//  - a bot SELLING to you wants x1.35 if the sale breaks a district it has completed, and x1.2 if the
//    block would complete YOUR district; the bid panel's bar / marker and the accept test all agree
//  - the reason is stated in the log ("completes their district", "breaking up their district")
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity127.html')) die('showcase_kascity127.html missing');
let html = fs.readFileSync('showcase_kascity127.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

// --- extract districts from the engine JSON (escaped form) ---
const J = html.replace(/\\"/g, '"');
const re = /"cond":"world\.flags\.dbon_(\d+) != 1 && \(((?:ownerOf\('t\d+'\) == 1(?: && )?)+)\)"\},\{"do":\{"action":"setState","args":\["dbon_\d+",1\]\}\},\{"do":\{"action":"addSeatStat","args":\[1,"cash"\],"amount":(\d+)\}/g;
const D = {};
let m; while ((m = re.exec(J))) { const tiles = [...m[2].matchAll(/t(\d+)/g)].map(x => +x[1]); D[+m[1]] = { tiles: tiles, bonus: +m[3] }; }
const keys = Object.keys(D);
if (keys.length < 6) die('districts: expected 6+, got ' + keys.length);
const DIST = keys.map(k => ({ id: +k, tiles: D[k].tiles, bonus: D[k].bonus }));
console.log('PASS districts extracted: ' + DIST.length + ' (' + DIST.map(d => d.tiles.join('/')).join(', ') + ')');

const block =
  '// ---- districts + motive (v128) ----' + EOL +
  'window.KV_DISTRICTS=' + JSON.stringify(DIST) + ';' + EOL +
  'window.KV_DIST_MULT=function(tile,buyer,seller){' + EOL +
  '  var out={buy:1,sell:1,why:""};' + EOL +
  '  var d=null; for(var i=0;i<window.KV_DISTRICTS.length;i++){ if(window.KV_DISTRICTS[i].tiles.indexOf(tile)>=0){ d=window.KV_DISTRICTS[i]; break; } }' + EOL +
  '  if(!d || !window.KV_OWNER) return out;' + EOL +
  '  var others=d.tiles.filter(function(t){ return t!==tile; });' + EOL +
  '  var bh=others.filter(function(t){ return window.KV_OWNER(t)===buyer; }).length;' + EOL +
  '  var sh=others.filter(function(t){ return window.KV_OWNER(t)===seller; }).length;' + EOL +
  '  var buyerCompletes=(bh===others.length && others.length>0), sellerHadSet=(sh===others.length && others.length>0);' + EOL +
  '  if(buyerCompletes){ out.buy=1.25; out.why="completes their district (+"+d.bonus+" bonus)"; } else if(bh>0){ out.buy=1.10; out.why="builds their district"; }' + EOL +
  '  if(sellerHadSet){ out.sell*=1.35; out.why=(out.why?out.why+" \\u00b7 ":"")+"breaking up their district"; }' + EOL +
  '  if(buyerCompletes){ out.sell*=1.20; }' + EOL +
  '  return out;' + EOL +
  '};' + EOL + EOL;

rep('// ---- bots make offers on human blocks (v118) ----', block + '// ---- bots make offers on human blocks (v118) ----', 'district table + KV_DIST_MULT injected');

// bot buying from you: price up for district
rep('var amt=Math.round(intr*mul*(0.95+Math.random()*0.12)/5)*5;',
    'var dmB=window.KV_DIST_MULT?window.KV_DIST_MULT(tile,bot,human):{buy:1,why:""};' + EOL +
    '    var amt=Math.round(intr*mul*dmB.buy*(0.95+Math.random()*0.12)/5)*5;',
    'bot offers pay up for district fit');
rep('if(window.KV_LOG) window.KV_LOG("P"+bot+"  offers  "+amt+"  for your "+nm+(label?("  \\u00b7 the "+label):""), COL[bot]);',
    'if(window.KV_LOG) window.KV_LOG("P"+bot+"  offers  "+amt+"  for your "+nm+(label?("  \\u00b7 the "+label):"")+(dmB.why?("  \\u00b7 "+dmB.why):""), COL[bot]);',
    'offer log states the district reason');

// bot selling to you: bar up when it hurts them / completes yours (panel marker + accept test)
rep('var bar=Math.round(intr*(needy?0.76:0.98)*sellMul);',
    'var dmS=window.KV_DIST_MULT?window.KV_DIST_MULT(tile,me,owner):{sell:1,why:""};' + EOL +
    'var bar=Math.round(intr*(needy?0.76:0.98)*sellMul*dmS.sell);',
    'bid panel bar includes district');
rep('var threshold=intr*(need?0.76:0.98)*sellMul;',
    'var dmT=window.KV_DIST_MULT?window.KV_DIST_MULT(tile,me,owner):{sell:1,why:""};' + EOL +
    'var threshold=intr*(need?0.76:0.98)*sellMul*dmT.sell;',
    'accept test includes district');
rep(': ((label?("the "+label):"they")+" wanted "+Math.round(threshold));',
    ': ((label?("the "+label):"they")+" wanted "+Math.round(threshold)+(dmT.sell>1?"  \\u00b7 "+(dmT.why||"district premium"):""));',
    'refusal states the district reason');

fs.writeFileSync('showcase_kascity128.html', html);
console.log('OK showcase_kascity128.html (' + (fs.statSync('showcase_kascity128.html').size/1024/1024).toFixed(1) + ' MB)');
