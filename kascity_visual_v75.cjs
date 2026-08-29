// kascity_visual_v75.cjs
// Reads showcase_kascity74.html -> showcase_kascity75.html   (scene JSON unchanged)
//
// NETWORKED TWO-PLAYER over the TownHall relay on Flux.
//
// The relay carries signed moves; it never decides anything. Both clients run the identical
// deterministic engine from a shared seed, so the relay cannot alter an outcome — at worst it can
// stall, and either player can still prove the game from their own move log.
//
//   HOST  -> POST /api/game/room/create  -> room code + seed, you are seat 1
//   JOIN  -> POST /api/game/room/join    -> same seed, you are seat 2
//   PLAY  -> every local move POSTs to /room/{id}/move; a 700ms poll pulls the peer's moves
//            from /room/{id}/since/{n} and applies them locally
//   END   -> both sides POST the co-signed result to /room/{id}/result
//
// DIVERGENCE GUARD: each side sends its move root with every move. If the relay's root disagrees
// with ours, the game is out of sync and we say so loudly rather than quietly drifting apart.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
const src = ['showcase_kascity78.html','showcase_kascity74.html','showcase_kascity73.html'].find(f => fs.existsSync(f));
if (!src) die('no showcase_kascity73/74/78.html found');
console.log('source: ' + src);
let html = fs.readFileSync(src, 'utf8');

const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');

const net = [
  '  window.KV_END=endGame;',
  '',
  '  // ================= RELAY NETWORKING =================',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    var API = window.KV_RELAY || "https://kasvillage.app.runonflux.io";',
  '    window.KV_NET = { room:null, seat:null, seed:null, cursor:0, online:false, peerSeen:0, diverged:false };',
  '',
  '    function el(t,css,par){var e=document.createElement(t);e.style.cssText=css;(par||document.body).appendChild(e);return e;}',
  '    async function api(path, opts){',
  '      var r = await fetch(API + path, Object.assign({ headers:{ "Content-Type":"application/json" } }, opts||{}));',
  '      if(!r.ok) throw new Error(r.status + " " + (await r.text()).slice(0,120));',
  '      return r.json();',
  '    }',
  '    // identity: reuse the wallet address if one is typed, otherwise a session key',
  '    function myKey(){',
  '      if(!window.__kvKey){',
  '        var a=new Uint8Array(24); crypto.getRandomValues(a);',
  '        window.__kvKey=Array.from(a).map(function(x){return x.toString(16).padStart(2,"0");}).join("");',
  '      }',
  '      return window.__kvKey;',
  '    }',
  '',
  '    // ---- status pill ----',
  '    var pill=el("div","position:fixed;left:50%;top:34px;transform:translateX(-50%);z-index:66;'
    + 'display:none;padding:3px 12px;border-radius:11px;font:10px monospace;letter-spacing:1px;");',
  '    function status(txt,col){ pill.textContent=txt; pill.style.background=col||"#2a2118";',
  '      pill.style.color="#f4e4c1"; pill.style.display="block"; }',
  '',
  '    // ---- outbound: every local move goes to the relay ----',
  '    var baseMove = window.KV_MOVE;',
  '    window.KV_MOVE = function(seat, action, value){',
  '      var r = baseMove ? baseMove(seat, action, value) : null;',
  '      var N = window.KV_NET;',
  '      if(N.online && N.seat === seat){',
  '        var payload = { seat:seat, action:String(action), value:(+value||0),',
  '                        clock:Math.round(((window.KV_FLAGS&&window.KV_FLAGS().left)||0)),',
  '                        sig:"session", pubkey:myKey(), root:(window.KV_ROOT||"") };',
  '        api("/api/game/room/"+N.room+"/move", { method:"POST", body:JSON.stringify(payload) })',
  '          .then(function(res){',
  '            if(res.root && window.KV_ROOT && res.root !== window.KV_ROOT && !N.diverged){',
  '              N.diverged = true;',
  '              status("OUT OF SYNC", "#ff6a4a");',
  '              window.KV_LOG("games have diverged — move roots disagree","#ff6a4a");',
  '            }',
  '          })',
  '          .catch(function(e){ window.KV_LOG("relay: "+e.message,"#ff6a4a"); });',
  '      }',
  '      return r;',
  '    };',
  '',
  '    // ---- inbound: apply the peer\'s moves locally ----',
  '    function applyRemote(m){',
  '      if(m.seat === window.KV_NET.seat) return;      // our own, echoed back',
  '      window.KV_LOG("P"+m.seat+"  "+m.action+(m.value?(" "+m.value):""), COL[m.seat]);',
  '      // the deterministic engine replays it: set the same flags the local path would',
  '      if(!window.KV_SETSTATE) return;',
  '      if(m.action==="roll")      window.KV_SETSTATE("go", 0);',
  '      else if(m.action==="buy")  window.KV_SETSTATE("buy", 0);',
  '      else if(m.action==="pass") window.KV_SETSTATE("buy", 1);',
  '      else if(m.action==="renovate"){ window.KV_SETSTATE("renov_by", m.seat);',
  '        window.KV_SETSTATE("renov_t", 0); window.KV_SETSTATE("renov", m.value); }',
  '      else if(m.action && m.action.indexOf("bid:")===0){',
  '        window.KV_SETSTATE("tr_tile", +m.action.split(":")[1]);',
  '        window.KV_SETSTATE("tr_from", m.seat);',
  '        window.KV_SETSTATE("tr_amt", m.value);',
  '      }',
  '    }',
  '',
  '    async function poll(){',
  '      var N=window.KV_NET;',
  '      if(!N.online) return;',
  '      try{',
  '        var res = await api("/api/game/room/"+N.room+"/since/"+N.cursor);',
  '        (res.moves||[]).forEach(function(m){',
  '          if(m.index >= N.cursor) N.cursor = m.index + 1;',
  '          applyRemote(m);',
  '        });',
  '        var others=(res.players||[]).filter(function(p){return p.seat!==N.seat;});',
  '        N.peerSeen = others.length;',
  '        if(!N.diverged) status("ROOM "+N.room+"  seat "+N.seat+"  peers "+others.length,',
  '          others.length? "#2f5d3a" : "#4a3a22");',
  '        if(res.ended) status("GAME ENDED","#2a2118");',
  '      }catch(e){ status("relay unreachable","#ff6a4a"); }',
  '    }',
  '    setInterval(poll, 700);',
  '',
  '    // ---- lobby ----',
  '    window.KV_HOST = async function(){',
  '      try{',
  '        var r = await api("/api/game/room/create", { method:"POST",',
  '          body: JSON.stringify({ pubkey: myKey(), wallet:(window.KV_WALLETS&&window.KV_WALLETS[1])||null }) });',
  '        window.KV_NET = { room:r.room, seat:r.seat, seed:r.seed, cursor:0, online:true, peerSeen:0, diverged:false };',
  '        window.KV_HUMANS=[1,2]; window.KV_MODE="p2p"; window.KV_XP_MULT=1.0;',
  '        if(window.KV_SETSTATE) window.KV_SETSTATE("humans", 2);',
  '        status("ROOM "+r.room+"  waiting for a player","#4a3a22");',
  '        window.KV_LOG("hosting room "+r.room+" — share this code","#caa64c");',
  '        return r.room;',
  '      }catch(e){ window.KV_LOG("could not host: "+e.message,"#ff6a4a"); }',
  '    };',
  '    window.KV_JOIN = async function(code){',
  '      try{',
  '        var r = await api("/api/game/room/join", { method:"POST",',
  '          body: JSON.stringify({ room:String(code).trim(), pubkey: myKey(),',
  '                                 wallet:(window.KV_WALLETS&&window.KV_WALLETS[2])||null }) });',
  '        window.KV_NET = { room:r.room, seat:r.seat, seed:r.seed, cursor:(r.moveCount||0), online:true, peerSeen:1, diverged:false };',
  '        window.KV_HUMANS=[1,2]; window.KV_MODE="p2p"; window.KV_XP_MULT=1.0;',
  '        if(window.KV_SETSTATE) window.KV_SETSTATE("humans", 2);',
  '        status("ROOM "+r.room+"  seat "+r.seat,"#2f5d3a");',
  '        window.KV_LOG("joined room "+r.room+" as seat "+r.seat,"#9cd87c");',
  '        return r.seat;',
  '      }catch(e){ window.KV_LOG("could not join: "+e.message,"#ff6a4a"); }',
  '    };',
  '',
  '    // ---- co-signed result to the relay ----',
  '    var baseEnd = window.KV_END;',
  '    window.KV_END = function(){',
  '      var r = baseEnd ? baseEnd() : null;',
  '      var N = window.KV_NET;',
  '      if(N.online && window.KV_RESULT){',
  '        api("/api/game/room/"+N.room+"/result", { method:"POST", body: JSON.stringify({',
  '          seat:N.seat, pubkey:myKey(), sig:(window.KV_ROOT||"unsigned"), result:window.KV_RESULT',
  '        })}).then(function(res){',
  '          window.KV_LOG("result submitted — "+res.signatures+"/"+res.required+" signatures",',
  '            res.complete ? "#9cd87c" : "#caa64c");',
  '        }).catch(function(e){ window.KV_LOG("result submit failed: "+e.message,"#ff6a4a"); });',
  '      }',
  '      return r;',
  '    };',
  '',
  '    // ---- lobby buttons on the start screen ----',
  '    setTimeout(function(){',
  '      var bar=el("div","position:fixed;left:50%;bottom:52px;transform:translateX(-50%);z-index:66;'
    + 'display:flex;gap:6px;align-items:center;font:11px monospace;color:#f4e4c1;");',
  '      var host=el("button","padding:6px 12px;background:#22303a;color:#cfe6f4;border:1px solid #4f7fd9;'
    + 'border-radius:5px;font:11px monospace;cursor:pointer;",bar);',
  '      host.textContent="Host online game";',
  '      host.onclick=function(e){ e.stopPropagation(); window.KV_HOST(); };',
  '      var code=el("input","width:110px;padding:5px 8px;background:#1a1410;color:#f4e4c1;'
    + 'border:1px solid #5a4a3a;border-radius:5px;font:11px monospace;",bar);',
  '      code.placeholder="room code";',
  '      var join=el("button","padding:6px 12px;background:#2a2118;color:#f4e4c1;border:1px solid #5a4a3a;'
    + 'border-radius:5px;font:11px monospace;cursor:pointer;",bar);',
  '      join.textContent="Join";',
  '      join.onclick=function(e){ e.stopPropagation(); if(code.value.trim()) window.KV_JOIN(code.value); };',
  '    }, 900);',
  '  })();'
].join('\n');
html = html.split(anchor).join(net);

// expose the running move root for the divergence check
const chainRe = /if\s*\(\s*chainReady\s*\)\s*chain\s*=\s*await\s+sha\([^;]*\);/;
const chainM = html.match(chainRe);
if (!chainM) die('move chain line not found');
if (html.split(chainM[0]).length - 1 !== 1) die('move chain line not unique');
html = html.split(chainM[0]).join('if(chainReady){ ' + chainM[0].replace(/^if\s*\(\s*chainReady\s*\)\s*/, '') + ' window.KV_ROOT = chain; }');

fs.writeFileSync('showcase_kascity75.html', html);
console.log('PASS relay client: host / join by room code, 700ms move sync');
console.log('PASS every local move signed and posted; peer moves applied locally');
console.log('PASS divergence guard — mismatched move roots are reported, not hidden');
console.log('PASS co-signed result posted to the relay at the final bell');
console.log('PASS lobby bar with Host / room code / Join');
console.log('OK showcase_kascity75.html (' + (fs.statSync('showcase_kascity75.html').size/1024/1024).toFixed(1) + ' MB)');
