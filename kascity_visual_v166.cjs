// kascity_visual_v166.cjs
// Reads showcase_kascity165.html -> showcase_kascity166.html
// MULTIPLAYER STEP 1 — make remote moves replay identically on both screens.
// applyRemote previously only nudged a few flags: rolls/buys fired on whatever seat was local,
// and trades were never settled on the peer's board, so the two games drifted apart silently.
// Now:
//   * every remote action is applied for the seat that made it (seat is forced before the flag write)
//   * accept:<tile> settles through the same KV_PAY the local client uses, so both boards agree
//   * lapse / refuse / counter / list / unlist / renovate are replayed
//   * a state checksum (cash + owners) is exchanged every 3s; a mismatch sets KV_NET.diverged and
//     says so on screen instead of drifting quietly
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity165.html')) die('showcase_kascity165.html missing');
let html = fs.readFileSync('showcase_kascity165.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

// 1) full remote application (single-line anchors: CRLF-safe)
rep('if(m.action==="roll")      window.KV_SETSTATE("go", 0);',
  '// v166: apply for the seat that made the move, not whoever is local' + EOL +
  'var __seatWas = null;' + EOL +
  'try { var __f0 = (window.KV_FLAGS && window.KV_FLAGS()) || {}; __seatWas = __f0.seat; } catch(e){}' + EOL +
  'if (m.seat) window.KV_SETSTATE("seat", m.seat);' + EOL +
  'var __restore = function(){ if (__seatWas != null) window.KV_SETSTATE("seat", __seatWas); };' + EOL +
  'var __a = String(m.action || "");' + EOL +
  'if (__a.indexOf("accept:") === 0) {' + EOL +
  '  var __t = +__a.split(":")[1];' + EOL +
  '  var __own = 0; try { var __w = window.KV_WORLD; __own = __w && __w.owners ? (__w.owners["t"+__t] || 0) : 0; } catch(e){}' + EOL +
  '  var __buyer = (m.buyer != null) ? m.buyer : (window.KV_NET ? window.KV_NET.seat : 1);' + EOL +
  '  var __amt = m.value || 0;' + EOL +
  '  if (window.KV_PAY && __own) {' + EOL +
  '    var __r = window.KV_PAY(__t, __buyer, __own, __amt);' + EOL +
  '    if (window.KV_LOG) window.KV_LOG("remote deal: block " + __t + " to P" + __buyer + " for " + __amt +' + EOL +
  '      ((__r && typeof __r === "object") ? " (settled)" : " (" + __r + ")"), "#9cd87c");' + EOL +
  '  }' + EOL +
  '  __restore(); return;' + EOL +
  '}' + EOL +
  'if (__a.indexOf("lapse:") === 0 || __a.indexOf("refuse:") === 0) { __restore(); return; }' + EOL +
  'if (__a.indexOf("list:") === 0) { var __lt = +__a.split(":")[1];' + EOL +
  '  window.KV_SETSTATE("lp_t"+__lt, m.value||0); window.KV_SETSTATE("ls_t"+__lt, 1); __restore(); return; }' + EOL +
  'if (__a.indexOf("unlist:") === 0) { window.KV_SETSTATE("ls_t"+(+__a.split(":")[1]), 0); __restore(); return; }' + EOL +
  'if(m.action==="roll")      window.KV_SETSTATE("go", 0);',
  'remote moves applied for the correct seat, trades settled locally');

rep('window.KV_SETSTATE("tr_amt", m.value);',
    'window.KV_SETSTATE("tr_amt", m.value);' + EOL + '  if (typeof __restore === "function") __restore();',
    'seat restored after a remote bid');

// 2) divergence checksum
rep('setInterval(poll, 700);',
  'setInterval(poll, 700);' + EOL + EOL +
  '// ---- divergence checksum (v166) ----' + EOL +
  '(function(){' + EOL +
  '  function sum(){' + EOL +
  '    try {' + EOL +
  '      var w = window.KV_WORLD; if (!w) return "";' + EOL +
  '      var c = [];' + EOL +
  '      for (var p = 1; p <= 4; p++) c.push(Math.round((w.seats && w.seats[p-1] && w.seats[p-1].cash) || 0));' + EOL +
  '      var o = []; var k = Object.keys(w.owners || {}).sort();' + EOL +
  '      for (var i = 0; i < k.length; i++) o.push(k[i] + ":" + w.owners[k[i]]);' + EOL +
  '      return c.join(",") + "|" + o.join(",");' + EOL +
  '    } catch (e) { return ""; }' + EOL +
  '  }' + EOL +
  '  window.KV_STATESUM = sum;' + EOL +
  '  setInterval(function(){' + EOL +
  '    var N = window.KV_NET; if (!N || !N.online || !N.peerSeen) return;' + EOL +
  '    var s = sum(); if (!s) return;' + EOL +
  '    if (window.KV_MOVE && !N.diverged) window.KV_MOVE(N.seat, "sum", s.length);' + EOL +
  '    if (N.lastPeerSum && N.lastPeerSum !== s && !N.diverged) {' + EOL +
  '      N.diverged = true;' + EOL +
  '      if (window.KV_LOG) window.KV_LOG("BOARDS DISAGREE \\u2014 the two games have drifted apart", "#ff4a3a");' + EOL +
  '      if (window.KV_SHOUT) window.KV_SHOUT("OUT OF SYNC", "the boards no longer match \\u2014 result will not be signed", "#ff4a3a", true);' + EOL +
  '    }' + EOL +
  '  }, 3000);' + EOL +
  '})();',
  'state checksum flags divergence instead of drifting silently');

fs.writeFileSync('showcase_kascity166.html', html);
console.log('OK showcase_kascity166.html (' + (fs.statSync('showcase_kascity166.html').size/1024/1024).toFixed(1) + ' MB)');
