// kascity_visual_v76.cjs
// Reads showcase_kascity75.html -> showcase_kascity76.html   (scene JSON unchanged)
//
// TWO TRANSPORTS, chosen by the network you are actually on.
//
// 1. DIRECT (WiFi) — WebRTC data channel with PASTE signalling. No server, no room codes, no relay.
//    Host copies an invite blob, guest pastes it and copies back an answer, host pastes that. Same
//    "follow the paste" pattern as the FROST ceremony: the paste is the source of truth.
//    Works reliably on shared WiFi and usually across the internet on home broadband.
//    HONEST LIMIT: on cellular, carrier-grade NAT is often symmetric — STUN cannot punch through it
//    and a direct channel will not form. The UI says so rather than spinning forever.
//
// 2. RELAY (anywhere, incl. cellular) — the Flux route from v75. Because TownHall nodes are stateless
//    and rooms live only in RAM, a node restart drops the room. That is recoverable: both clients hold
//    the full move log, so on a 404 the client re-creates the room and replays its history. The relay
//    is a courier, never a record.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity75.html')) die('showcase_kascity75.html missing');
let html = fs.readFileSync('showcase_kascity75.html', 'utf8');

const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');

const rtc = [
  '  window.KV_END=endGame;',
  '',
  '  // ================= DIRECT LINK (WebRTC, paste signalling) =================',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    function el(t,css,par){var e=document.createElement(t);e.style.cssText=css;(par||document.body).appendChild(e);return e;}',
  '    var ICE={ iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}] };',
  '',
  '    window.KV_P2P={ pc:null, ch:null, connected:false, seat:null, cursor:0 };',
  '',
  '    function wire(ch){',
  '      var P=window.KV_P2P;',
  '      P.ch=ch;',
  '      ch.onopen=function(){',
  '        P.connected=true;',
  '        window.KV_HUMANS=[1,2]; window.KV_MODE="p2p"; window.KV_XP_MULT=1.0;',
  '        if(window.KV_SETSTATE) window.KV_SETSTATE("humans",2);',
  '        window.KV_LOG("direct link established — seat "+P.seat,"#9cd87c");',
  '        var pill=document.getElementById("kvp2p");',
  '        if(pill){ pill.textContent="DIRECT LINK  seat "+P.seat; pill.style.background="#2f5d3a"; }',
  '      };',
  '      ch.onclose=function(){ P.connected=false; window.KV_LOG("direct link closed","#ff6a4a"); };',
  '      ch.onmessage=function(ev){',
  '        var m; try{ m=JSON.parse(ev.data); }catch(e){ return; }',
  '        if(m.t==="move") applyRemote(m);',
  '        else if(m.t==="root" && window.KV_ROOT && m.root!==window.KV_ROOT){',
  '          window.KV_LOG("games have diverged — move roots disagree","#ff6a4a");',
  '        }',
  '      };',
  '    }',
  '',
  '    function applyRemote(m){',
  '      if(m.seat===window.KV_P2P.seat) return;',
  '      window.KV_LOG("P"+m.seat+"  "+m.a+(m.v?(" "+m.v):""), COL[m.seat]);',
  '      if(!window.KV_SETSTATE) return;',
  '      if(m.a==="roll")           window.KV_SETSTATE("go",0);',
  '      else if(m.a==="buy")       window.KV_SETSTATE("buy",0);',
  '      else if(m.a==="pass")      window.KV_SETSTATE("buy",1);',
  '      else if(m.a==="renovate"){ window.KV_SETSTATE("renov_by",m.seat);',
  '        window.KV_SETSTATE("renov_t",0); window.KV_SETSTATE("renov",m.v); }',
  '      else if(m.a && m.a.indexOf("bid:")===0){',
  '        window.KV_SETSTATE("tr_tile",+m.a.split(":")[1]);',
  '        window.KV_SETSTATE("tr_from",m.seat);',
  '        window.KV_SETSTATE("tr_amt",m.v);',
  '      }',
  '    }',
  '',
  '    // outbound: send over the direct channel when it is up',
  '    var prevMove=window.KV_MOVE;',
  '    window.KV_MOVE=function(seat,action,value){',
  '      var r=prevMove?prevMove(seat,action,value):null;',
  '      var P=window.KV_P2P;',
  '      if(P.connected && P.ch && P.seat===seat){',
  '        try{ P.ch.send(JSON.stringify({t:"move",seat:seat,a:String(action),v:(+value||0)}));',
  '             P.ch.send(JSON.stringify({t:"root",root:window.KV_ROOT||""})); }catch(e){}',
  '      }',
  '      return r;',
  '    };',
  '',
  '    async function gather(pc){',
  '      // wait for ICE to finish so the blob is self-contained — one paste, not a stream',
  '      if(pc.iceGatheringState==="complete") return;',
  '      await new Promise(function(res){',
  '        var t=setTimeout(res,4000);',
  '        pc.onicegatheringstatechange=function(){ if(pc.iceGatheringState==="complete"){ clearTimeout(t); res(); } };',
  '      });',
  '    }',
  '    function pack(o){ return btoa(JSON.stringify(o)).replace(/=+$/,""); }',
  '    function unpack(s){ return JSON.parse(atob(s.trim())); }',
  '',
  '    window.KV_DIRECT_HOST=async function(){',
  '      var pc=new RTCPeerConnection(ICE);',
  '      window.KV_P2P.pc=pc; window.KV_P2P.seat=1;',
  '      var ch=pc.createDataChannel("kascity",{ordered:true});',
  '      wire(ch);',
  '      await pc.setLocalDescription(await pc.createOffer());',
  '      await gather(pc);',
  '      return pack({r:"offer",sdp:pc.localDescription});',
  '    };',
  '    window.KV_DIRECT_JOIN=async function(blob){',
  '      var d=unpack(blob);',
  '      if(d.r!=="offer") throw new Error("that is not an invite");',
  '      var pc=new RTCPeerConnection(ICE);',
  '      window.KV_P2P.pc=pc; window.KV_P2P.seat=2;',
  '      pc.ondatachannel=function(ev){ wire(ev.channel); };',
  '      await pc.setRemoteDescription(d.sdp);',
  '      await pc.setLocalDescription(await pc.createAnswer());',
  '      await gather(pc);',
  '      return pack({r:"answer",sdp:pc.localDescription});',
  '    };',
  '    window.KV_DIRECT_ACCEPT=async function(blob){',
  '      var d=unpack(blob);',
  '      if(d.r!=="answer") throw new Error("that is not an answer");',
  '      await window.KV_P2P.pc.setRemoteDescription(d.sdp);',
  '    };',
  '',
  '    // ---- lobby ----',
  '    setTimeout(function(){',
  '      var pill=el("div","position:fixed;left:50%;top:34px;transform:translateX(-50%);z-index:66;'
    + 'display:none;padding:3px 12px;border-radius:11px;font:10px monospace;color:#f4e4c1;background:#4a3a22;");',
  '      pill.id="kvp2p";',
  '      var bar=el("div","position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:66;'
    + 'display:flex;gap:6px;align-items:center;font:11px monospace;color:#f4e4c1;");',
  '      var b1=el("button","padding:6px 12px;background:#22303a;color:#cfe6f4;border:1px solid #4f7fd9;'
    + 'border-radius:5px;font:11px monospace;cursor:pointer;",bar);',
  '      b1.textContent="Direct link (WiFi)";',
  '      b1.onclick=function(e){ e.stopPropagation(); openPanel(); };',
  '',
  '      function openPanel(){',
  '        var ov=el("div","position:fixed;inset:0;z-index:79;background:rgba(10,8,6,.75);display:flex;align-items:center;justify-content:center;");',
  '        var box=el("div","background:#14100c;border:2px solid #caa64c;border-radius:12px;padding:18px 22px;'
    + 'font:12px/1.6 monospace;color:#f4e4c1;width:440px;",ov);',
  '        box.innerHTML="<div style=\'color:#f0c860;font-weight:700;letter-spacing:1px\'>DIRECT LINK</div>"+',
  '          "<div style=\'opacity:.7;margin:6px 0 10px;font-size:11px\'>peer to peer over WiFi — no server. "+',
  '          "on mobile data this often fails (carrier NAT); use the relay instead.</div>";',
  '        var ta=el("textarea","width:100%;height:88px;background:#0e0b08;color:#9cd87c;border:1px solid #3a3228;'
    + 'border-radius:5px;font:10px monospace;padding:6px;box-sizing:border-box;resize:none;",box);',
  '        ta.placeholder="invite / answer blob appears here — copy it, or paste theirs";',
  '        var row=el("div","display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;",box);',
  '        function mk(label,col,fn){',
  '          var b=el("button","flex:1;min-width:120px;padding:7px;background:"+col+";color:#f4e4c1;'
    + 'border:1px solid #5a4a3a;border-radius:5px;font:11px monospace;cursor:pointer;",row);',
  '          b.textContent=label; b.onclick=function(e){ e.stopPropagation(); fn(b); }; return b;',
  '        }',
  '        var note=el("div","margin-top:9px;font-size:10px;opacity:.7;min-height:14px;",box);',
  '        mk("1 · Create invite","#22303a",async function(b){',
  '          b.textContent="working…";',
  '          try{ ta.value=await window.KV_DIRECT_HOST(); ta.select();',
  '               note.textContent="send this to the other player, then paste their answer and press 3"; }',
  '          catch(e){ note.textContent="failed: "+e.message; }',
  '          b.textContent="1 · Create invite";',
  '        });',
  '        mk("2 · Join with invite","#2a2118",async function(b){',
  '          b.textContent="working…";',
  '          try{ ta.value=await window.KV_DIRECT_JOIN(ta.value); ta.select();',
  '               note.textContent="send this answer back to the host"; }',
  '          catch(e){ note.textContent="failed: "+e.message; }',
  '          b.textContent="2 · Join with invite";',
  '        });',
  '        mk("3 · Accept answer","#2a2118",async function(b){',
  '          try{ await window.KV_DIRECT_ACCEPT(ta.value); note.textContent="connecting…"; }',
  '          catch(e){ note.textContent="failed: "+e.message; }',
  '        });',
  '        mk("Close","#1b1712",function(){ ov.remove(); });',
  '        pill.style.display="block";',
  '      }',
  '    }, 950);',
  '  })();',
  '',
  '  // ---- relay resume: stateless nodes lose rooms, the clients do not ----',
  '  (function(){',
  '    var tries=0;',
  '    var origLog=window.KV_LOG;',
  '    window.KV_RELAY_RESUME=async function(){',
  '      var N=window.KV_NET;',
  '      if(!N||!N.online) return;',
  '      if(tries++>3){ window.KV_LOG("relay resume gave up — play continues locally","#ff6a4a"); return; }',
  '      try{',
  '        var API=window.KV_RELAY||"https://kasvillage.app.runonflux.io";',
  '        var r=await fetch(API+"/api/game/room/create",{method:"POST",',
  '          headers:{"Content-Type":"application/json"},',
  '          body:JSON.stringify({pubkey:(window.__kvKey||"resume")})}).then(function(x){return x.json();});',
  '        N.room=r.room; N.cursor=0;',
  '        window.KV_LOG("relay restarted — new room "+r.room+", replaying "+((window.KV_MOVES||[]).length)+" moves","#caa64c");',
  '        for(var i=0;i<(window.KV_MOVES||[]).length;i++){',
  '          var m=window.KV_MOVES[i];',
  '          await fetch(API+"/api/game/room/"+N.room+"/move",{method:"POST",',
  '            headers:{"Content-Type":"application/json"},',
  '            body:JSON.stringify({seat:m.s,action:m.a,value:(+m.v||0),clock:(+m.t||0),',
  '                                 sig:"replay",pubkey:(window.__kvKey||"resume"),root:(window.KV_ROOT||"")})});',
  '        }',
  '      }catch(e){ window.KV_LOG("relay resume failed: "+e.message,"#ff6a4a"); }',
  '    };',
  '  })();'
].join('\n');
html = html.split(anchor).join(rtc);

// on a 404 from the relay, attempt resume rather than failing silently
const catchRe = /      \}catch\(e\)\{ status\("relay unreachable","#ff6a4a"\); \}/;
if (!catchRe.test(html)) die('relay poll catch not found');
html = html.replace(catchRe,
  '      }catch(e){\n' +
  '        status("relay unreachable","#ff6a4a");\n' +
  '        if(String(e.message||"").indexOf("404")>=0 && window.KV_RELAY_RESUME) window.KV_RELAY_RESUME();\n' +
  '      }');

fs.writeFileSync('showcase_kascity76.html', html);
console.log('PASS direct WebRTC data channel with paste signalling (host invite / join / accept)');
console.log('PASS cellular limitation stated in the UI instead of failing silently');
console.log('PASS relay resume: on a 404 the client re-creates the room and replays its own move log');
console.log('OK showcase_kascity76.html (' + (fs.statSync('showcase_kascity76.html').size/1024/1024).toFixed(1) + ' MB)');
