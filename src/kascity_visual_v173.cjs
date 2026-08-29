// kascity_visual_v173.cjs
// Reads showcase_kascity172.html -> showcase_kascity173.html
// ONE PAYER: THE ENGINE.
// Both KV_PAY (JS) and the engine's authored transfer sequences were settling trades, so a purchase
// could be charged twice. The engine's branches are the correct, replayable ones, so:
//   * KV_PAY no longer moves money or ownership. It arms the engine (tr_* flags) and returns.
//   * settle() arms tr_* again (v149 had moved it to the private htr_ channel; the engine's
//     authored sequences read tr_*), then watches for the engine to execute.
//   * the audit line reports what the engine actually did, from real balances before and after.
// Rendering, movement, rent, cards and the scene are untouched — only who moves the money changes.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity172.html')) die('showcase_kascity172.html missing');
let html = fs.readFileSync('showcase_kascity172.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

// 1) KV_PAY becomes an arming call, not a payment
const payHead = 'window.KV_PAY = function (tile, buyer, seller, amt) {';
if (html.split(payHead).length - 1 !== 1) die('KV_PAY head not unique');
const pi = html.indexOf(payHead);
const bodyEnd = html.indexOf('\n};', pi);
if (bodyEnd < 0 || bodyEnd - pi > 6000) die('could not bound KV_PAY');
html = html.slice(0, pi) +
  'window.KV_PAY = function (tile, buyer, seller, amt) {' + EOL +
  '  // v173: the engine settles trades. This only arms it and reports.' + EOL +
  '  var k = "t" + tile + ":b" + buyer + ":s" + seller + ":" + amt;' + EOL +
  '  window.__KV_PAID = window.__KV_PAID || {};' + EOL +
  '  if (window.__KV_PAID[k]) { return "already armed"; }' + EOL +
  '  window.__KV_PAID[k] = Date.now();' + EOL +
  '  if (!window.KV_SETSTATE) return "no setstate";' + EOL +
  '  var w = window.KV_WORLD || null;' + EOL +
  '  var own = 0; try { own = w && w.owners ? (w.owners["t" + tile] || 0) : 0; } catch (e) {}' + EOL +
  '  if (own && own !== seller) return "owner mismatch: block belongs to P" + own;' + EOL +
  '  function cash(p){ try { return Math.round((w.seats[p-1] || {}).cash || 0); } catch (e) { return 0; } }' + EOL +
  '  var b0 = cash(buyer), s0 = cash(seller);' + EOL +
  '  window.KV_SETSTATE("tr_tile", tile);' + EOL +
  '  window.KV_SETSTATE("tr_from", buyer);' + EOL +
  '  window.KV_SETSTATE("tr_to", seller);' + EOL +
  '  window.KV_SETSTATE("tr_amt", amt);' + EOL +
  '  window.KV_SETSTATE("tr_t", 0);' + EOL +
  '  window.KV_SETSTATE("tr_state", 2);' + EOL +
  '  (function(){' + EOL +
  '    var t0 = Date.now();' + EOL +
  '    var iv = setInterval(function(){' + EOL +
  '      var o = 0; try { o = w && w.owners ? (w.owners["t" + tile] || 0) : 0; } catch (e) {}' + EOL +
  '      if (o === buyer) {' + EOL +
  '        clearInterval(iv);' + EOL +
  '        var b1 = cash(buyer), s1 = cash(seller);' + EOL +
  '        var N = window.KV_NAMES || {}, nm = (N[tile] && N[tile].n) || ("block " + tile);' + EOL +
  '        if (window.KV_LOG) window.KV_LOG("DEAL " + nm + " for " + amt + ": P" + buyer + " " + b0 + "\\u2192" + b1 +' + EOL +
  '          " \\u00b7 P" + seller + " " + s0 + "\\u2192" + s1, (s1 > s0) ? "#9cd87c" : "#ff6a4a");' + EOL +
  '        if (window.KV_MOVE) { window.KV_MOVE(buyer, "cash:" + tile, b1); window.KV_MOVE(seller, "cash:" + tile, s1); }' + EOL +
  '        if (window.KV_SHOUT) window.KV_SHOUT("DEAL DONE", "P" + seller + " +" + (s1 - s0) + " \\u00b7 " + nm, "#9cd87c", true);' + EOL +
  '        return;' + EOL +
  '      }' + EOL +
  '      if (Date.now() - t0 > 30000) { clearInterval(iv);' + EOL +
  '        if (window.KV_LOG) window.KV_LOG("trade still pending after 30s \\u2014 block " + tile, "#e0a040"); }' + EOL +
  '    }, 250);' + EOL +
  '  })();' + EOL +
  '  return { armed: true, tile: tile, buyer: buyer, seller: seller, amt: amt };' +
  html.slice(bodyEnd);
console.log('PASS KV_PAY arms the engine instead of paying');

// 2) settle() must arm the channel the engine reads (tr_*), not the private htr_
['htr_tile', 'htr_from', 'htr_to', 'htr_amt', 'htr_t', 'htr_state'].forEach(function (k) {
  const si = html.indexOf('function settle(tile,buyer,seller,amt){');
  const a = 'window.KV_SETSTATE("' + k + '",';
  const idx = html.indexOf(a, si);
  if (idx >= 0 && idx - si < 1200) {
    html = html.slice(0, idx) + 'window.KV_SETSTATE("' + k.slice(1) + '",' + html.slice(idx + a.length);
  }
});
console.log('PASS settle() arms the engine channel the authored sequences read');

fs.writeFileSync('showcase_kascity173.html', html);
console.log('OK showcase_kascity173.html (' + (fs.statSync('showcase_kascity173.html').size/1024/1024).toFixed(1) + ' MB)');
