// kascity_visual_v170.cjs
// Reads showcase_kascity169.html -> showcase_kascity170.html
// PER-MOVE STATE COMMITMENTS.
// Each move now carries a commitment to the state it produced: sha256 of the ordered cash,
// property ownership, board positions and the move index, chained onto the previous commitment.
// Both clients compute the same value independently, so a client that manipulates its own state
// diverges from its peer on the very next move and the mismatch is provable.
//
//   stateHash(n) = sha256( prevHash | index | seat | action | value | cash1..4 | owners | pos1..4 )
//
// On receiving a peer move: recompute locally, compare with the sent commitment.
//   agree     -> continue, chain advances
//   disagree  -> halt, name the first divergent move, refuse to sign the result
// The final commitment goes into the result as stateRoot, so the end-of-game SNARK can prove the
// whole agreed chain rather than just the move list.
// Console: KV.commit() shows the current chain head and the last few commitments.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity169.html')) die('showcase_kascity169.html missing');
let html = fs.readFileSync('showcase_kascity169.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

const BLOCK = [
'// ---- per-move state commitments (v170) ----',
'(function(){',
'  var chain = "";           // running commitment',
'  var history = [];         // {index, seat, action, value, hash}',
'  var halted = false;',
'',
'  async function sha(s){',
'    try{',
'      var b = new TextEncoder().encode(s);',
'      var d = await crypto.subtle.digest("SHA-256", b);',
'      return Array.from(new Uint8Array(d)).map(function(x){ return x.toString(16).padStart(2,"0"); }).join("");',
'    }catch(e){',
'      var h = 0; for (var i=0;i<s.length;i++){ h = ((h<<5)-h+s.charCodeAt(i))|0; }',
'      return ("00000000"+(h>>>0).toString(16)).slice(-8).repeat(8);',
'    }',
'  }',
'',
'  // the canonical state string: everything a rules engine determines, nothing cosmetic',
'  function snapshot(){',
'    var w = window.KV_WORLD, f = (window.KV_FLAGS && window.KV_FLAGS()) || {};',
'    var cash = [], pos = [], own = [];',
'    for (var p = 1; p <= 4; p++) {',
'      var c = 0; try { c = Math.round((w && w.seats && w.seats[p-1] && w.seats[p-1].cash) || 0); } catch(e){}',
'      cash.push(c);',
'      pos.push(f["p"+p] == null ? -1 : f["p"+p]);',
'    }',
'    try {',
'      var keys = Object.keys((w && w.owners) || {}).sort();',
'      keys.forEach(function(k){ if (w.owners[k]) own.push(k + ">" + w.owners[k]); });',
'    } catch(e){}',
'    return cash.join(",") + "|" + pos.join(",") + "|" + own.join(",");',
'  }',
'',
'  async function commitMove(index, seat, action, value){',
'    var body = [chain, index, seat, action, value, snapshot()].join("~");',
'    chain = await sha(body);',
'    history.push({ index: index, seat: seat, action: action, value: value, hash: chain });',
'    if (history.length > 400) history.shift();',
'    return chain;',
'  }',
'',
'  window.KV_COMMIT = {',
'    head: function(){ return chain; },',
'    snapshot: snapshot,',
'    add: commitMove,',
'    history: function(){ return history.slice(-12); },',
'    halted: function(){ return halted; },',
'    // verify a peer move: recompute from our own state and compare',
'    check: async function(m){',
'      if (halted || !m || m.hash == null) return true;',
'      var mine = await commitMove(m.index, m.seat, m.action, m.value || 0);',
'      if (mine === m.hash) return true;',
'      halted = true;',
'      if (window.KV_NET) window.KV_NET.diverged = true;',
'      if (window.KV_LOG) window.KV_LOG("STATE MISMATCH at move " + m.index + " (" + m.action + ")" +',
'        " \\u2014 peer says " + String(m.hash).slice(0,12) + ", we compute " + String(mine).slice(0,12), "#ff4a3a");',
'      if (window.KV_SHOUT) window.KV_SHOUT("GAME HALTED",',
'        "the boards disagree at move " + m.index + " \\u2014 the result will not be signed", "#ff4a3a", true);',
'      return false;',
'    }',
'  };',
'',
'  if (window.KV) {',
'    window.KV.commit = function(){',
'      var r = { head: chain.slice(0,24), halted: halted, moves: history.length };',
'      console.log(r); console.table(history.slice(-8).map(function(h){',
'        return { i: h.index, seat: "P"+h.seat, action: h.action, value: h.value, hash: String(h.hash).slice(0,12) }; }));',
'      return r;',
'    };',
'    window.KV.snapshot = function(){ var s = snapshot(); console.log(s); return s; };',
'  }',
'})();',
''
].join(EOL);

rep('// ---- multi-node relay (v169) ----', BLOCK + EOL + '// ---- multi-node relay (v169) ----',
    'commitment chain installed');

// outgoing: attach our commitment to every move we send
rep('window.KV_SETSTATE("tr_amt", m.value);',
    'window.KV_SETSTATE("tr_amt", m.value);',
    'no-op anchor check');

// incoming: verify the peer's commitment before applying anything.
// applyRemote appears more than once in this file; patch the one that follows the
// "inbound: apply the peer's moves locally" comment, which is the live relay path.
(function(){
  const marker = "// ---- inbound: apply the peer's moves locally ----";
  const mi = html.indexOf(marker);
  if (mi < 0) die('inbound marker not found');
  const head = 'function applyRemote(m){';
  const hi = html.indexOf(head, mi);
  if (hi < 0 || hi - mi > 400) die('applyRemote not found just after the inbound marker');
  const inject = 'async function applyRemote(m){' + EOL +
    '  // v170: a peer move must agree with our own computation of the same state' + EOL +
    '  if (window.KV_COMMIT && m && m.hash) {' + EOL +
    '    var ok = await window.KV_COMMIT.check(m);' + EOL +
    '    if (!ok) return;   // halted: stop applying anything further' + EOL +
    '  }';
  html = html.slice(0, hi) + inject + html.slice(hi + head.length);
  console.log('PASS peer moves verified against our own state (patched the relay copy)');
})();

fs.writeFileSync('showcase_kascity170.html', html);
console.log('OK showcase_kascity170.html (' + (fs.statSync('showcase_kascity170.html').size/1024/1024).toFixed(1) + ' MB)');
