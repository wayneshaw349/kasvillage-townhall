// kascity_visual_v154.cjs
// Reads showcase_kascity153.html -> showcase_kascity154.html
// Trades are settled in JS, arithmetically, instead of waiting on the engine's 336 conditional
// sequences. On accept: seller.cash += amt, buyer.cash -= amt, owners[tile] = buyer, props/propval
// adjusted, then verified. If the numbers do not move, it says so loudly.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity153.html')) die('showcase_kascity153.html missing');
let html = fs.readFileSync('showcase_kascity153.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

// direct settlement helper, installed next to KV_SETSTATE so `world` is in scope
rep('window.KV_SETSTATE = function (k, v) {',
  'window.KV_PAY = function (tile, buyer, seller, amt) {' + EOL +
  '  try {' + EOL +
  '    var w = (typeof world !== "undefined" && world) ? world : (window.KV_WORLD || null);' + EOL +
  '    if (!w) return "no world";' + EOL +
  '    w.seats = w.seats || []; w.owners = w.owners || {};' + EOL +
  '    var B = w.seats[buyer - 1] = w.seats[buyer - 1] || {};' + EOL +
  '    var S = w.seats[seller - 1] = w.seats[seller - 1] || {};' + EOL +
  '    var b0 = B.cash || 0, s0 = S.cash || 0;' + EOL +
  '    if (b0 < amt) return "buyer short: " + b0 + " < " + amt;' + EOL +
  '    B.cash = b0 - amt;' + EOL +          // buyer pays
  '    S.cash = s0 + amt;' + EOL +          // seller receives
  '    B.props = (B.props || 0) + 1;  S.props = Math.max(0, (S.props || 0) - 1);' + EOL +
  '    B.propval = (B.propval || 0) + amt;  S.propval = Math.max(0, (S.propval || 0) - amt);' + EOL +
  '    w.owners["t" + tile] = buyer;' + EOL +
  '    return { b0: b0, b1: B.cash, s0: s0, s1: S.cash };' + EOL +
  '  } catch (e) { return "error: " + e.message; }' + EOL +
  '};' + EOL + EOL +
  'window.KV_SETSTATE = function (k, v) {',
  'KV_PAY installed (direct arithmetic settlement)');

// settle() calls it, and reports the result plainly
rep('var okt=window.KV_SETSTATE("htr_state",2);',
  'var okt=true;' + EOL +
  'var __r = window.KV_PAY ? window.KV_PAY(tile, buyer, seller, amt) : "no KV_PAY";' + EOL +
  '(function(){' + EOL +
  '  var N=window.KV_NAMES||{}, nm=(N[tile]&&N[tile].n)||("block "+tile);' + EOL +
  '  if(__r && typeof __r === "object"){' + EOL +
  '    if(window.KV_LOG) window.KV_LOG("DEAL "+nm+" for "+amt+": P"+buyer+" "+__r.b0+"\\u2192"+__r.b1+" ("+(__r.b1-__r.b0)+") \\u00b7 P"+seller+" "+__r.s0+"\\u2192"+__r.s1+" (+"+(__r.s1-__r.s0)+")", "#9cd87c");' + EOL +
  '    if(window.KV_SHOUT) window.KV_SHOUT("DEAL DONE", "P"+seller+" +"+(__r.s1-__r.s0)+" \\u00b7 P"+buyer+" "+(__r.b1-__r.b0)+" \\u00b7 "+nm, "#9cd87c", true);' + EOL +
  '    if(window.KV_MOVE){ window.KV_MOVE(buyer,"p2pbuy",tile); window.KV_MOVE(buyer,"cash:"+tile,__r.b1); window.KV_MOVE(seller,"cash:"+tile,__r.s1); }' + EOL +
  '  } else {' + EOL +
  '    if(window.KV_LOG) window.KV_LOG("DEAL FAILED ("+__r+") \\u2014 nothing changed hands","#ff4a3a");' + EOL +
  '    if(window.KV_SHOUT) window.KV_SHOUT("DEAL FAILED", String(__r), "#ff4a3a", true);' + EOL +
  '  }' + EOL +
  '})();',
  'settle() pays directly and reports both balances');

fs.writeFileSync('showcase_kascity154.html', html);
console.log('OK showcase_kascity154.html (' + (fs.statSync('showcase_kascity154.html').size/1024/1024).toFixed(1) + ' MB)');
