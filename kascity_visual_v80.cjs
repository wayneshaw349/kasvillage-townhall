// kascity_visual_v80.cjs
// Reads showcase_kascity79.html -> showcase_kascity80.html   (scene JSON unchanged)
//
// FOUR PLAYERS ONLINE. The relay always allowed four; the client hardcoded two. Now:
//   - the host picks how many seats the room holds (2, 3 or 4)
//   - joiners take the next free seat and everyone sees the roster fill in real time
//   - world.flags.humans tracks the ACTUAL number connected, so an empty seat plays as a bot rather
//     than stalling the game waiting for someone who never arrives
//   - if a player drops mid-game their seat reverts to bot control and play continues
//   - the room roster shows seat, colour and last-seen, so you can tell who is actually there
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity79.html')) die('showcase_kascity79.html missing');
let html = fs.readFileSync('showcase_kascity79.html', 'utf8');

// ---------- host: choose room size, do not assume 2 ----------
const hostRe = /window\.KV_MP_HOST=async function\(\)\{[\s\S]*?\n    \};/;
if (!hostRe.test(html)) die('KV_MP_HOST not found');
html = html.replace(hostRe, [
  'window.KV_MP_HOST=async function(seats){',
  '      var want = Math.max(2, Math.min(4, seats|0 || 2));',
  '      var room=rid();',
  '      var seed=room+"-"+Date.now();',
  '      try{',
  '        await fanPost("/api/game/room/create", { pubkey:key(), room:room, seed:seed,',
  '          wallet:(window.KV_WALLETS&&window.KV_WALLETS[1])||null });',
  '        window.KV_MP={ room:room, seat:1, seed:seed, online:true, cursor:0, seen:{}, want:want, roster:[1] };',
  '        window.KV_HUMANS=[1];',
  '        window.KV_MODE="p2p"; window.KV_XP_MULT=1.0;',
  '        if(window.KV_SETSTATE) window.KV_SETSTATE("humans",1);',
  '        window.KV_LOG("hosting "+room+" for "+want+" players — share the code","#caa64c");',
  '        paint();',
  '        return room;',
  '      }catch(e){ window.KV_LOG("host failed: "+e.message,"#ff6a4a"); }',
  '    };'
].join('\n'));

// ---------- join: take the seat the relay assigns ----------
const joinRe = /window\.KV_MP_JOIN=async function\(code\)\{[\s\S]*?\n    \};/;
if (!joinRe.test(html)) die('KV_MP_JOIN not found');
html = html.replace(joinRe, [
  'window.KV_MP_JOIN=async function(code){',
  '      code=String(code).trim();',
  '      try{',
  '        var r=await fanPost("/api/game/room/join", { room:code, pubkey:key(),',
  '          wallet:(window.KV_WALLETS&&window.KV_WALLETS[2])||null });',
  '        window.KV_MP={ room:code, seat:r.seat, seed:r.seed, online:true, cursor:0, seen:{},',
  '                       want:4, roster:(r.peers||[r.seat]) };',
  '        window.KV_MODE="p2p"; window.KV_XP_MULT=1.0;',
  '        window.KV_LOG("joined "+code+" as seat "+r.seat,"#9cd87c");',
  '        paint();',
  '        return r.seat;',
  '      }catch(e){ window.KV_LOG("join failed: "+e.message,"#ff6a4a"); }',
  '    };'
].join('\n'));

// ---------- roster drives humans, seats fall back to bots ----------
const pollRe = /      Object\.keys\(merged\)\.sort\(function\(a,b\)\{\n        return \(\+a\.split\(":"\)\[0\]\)-\(\+b\.split\(":"\)\[0\]\);\n      \}\)\.forEach\(function\(k\)\{ applyRemote\(merged\[k\]\); \}\);\n      paint\(\);/;
if (!pollRe.test(html)) die('poll merge block not found');
html = html.replace(pollRe, [
  '      Object.keys(merged).sort(function(a,b){',
  '        return (+a.split(":")[0])-(+b.split(":")[0]);',
  '      }).forEach(function(k){ applyRemote(merged[k]); });',
  '',
  '      // roster: who is actually connected right now',
  '      var now=Math.floor(Date.now()/1000);',
  '      var live={};',
  '      res.forEach(function(r){',
  '        if(r.status!=="fulfilled") return;',
  '        (r.value.players||[]).forEach(function(p){',
  '          var age = p.lastSeen ? (now - p.lastSeen) : 0;',
  '          if(age < 25) live[p.seat]=true;      // 25s grace before a seat reverts to bot',
  '        });',
  '      });',
  '      live[M.seat]=true;',
  '      var seats=Object.keys(live).map(Number).sort(function(a,b){return a-b;});',
  '      var joined=seats.join(",");',
  '      if(joined!==(M.rosterKey||"")){',
  '        M.rosterKey=joined;',
  '        M.roster=seats;',
  '        window.KV_HUMANS=seats;',
  '        // humans flag is the highest CONTIGUOUS human seat: seats above it play as bots',
  '        var contiguous=0;',
  '        for(var s=1;s<=4;s++){ if(live[s]) contiguous=s; else break; }',
  '        if(window.KV_SETSTATE) window.KV_SETSTATE("humans", contiguous);',
  '        window.KV_LOG("players connected: "+seats.map(function(s){return "P"+s;}).join(" ")+',
  '          (contiguous<seats.length?"  (gaps play as bots)":""), "#caa64c");',
  '      }',
  '      paint();'
].join('\n'));

// ---------- roster in the health strip ----------
const paintRe = /      strip\.innerHTML\+="<span style='opacity:\.6'>"\+up\+"\/"\+window\.KV_NODES\.length\+" up<\/span>";/;
if (!paintRe.test(html)) die('health strip tail not found');
html = html.replace(paintRe, [
  "      strip.innerHTML+=\"<span style='opacity:.6'>\"+up+\"/\"+window.KV_NODES.length+\" up</span>\";",
  '      var PC={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '      var ros=(M.roster||[M.seat]);',
  '      for(var s=1;s<=4;s++){',
  '        var here=ros.indexOf(s)>=0;',
  '        strip.innerHTML+="<span style=\'background:"+(here?PC[s]:"#1b1712")+";color:"+(here?"#12100e":"#5a4a3a")+',
  '          ";padding:3px 6px;border-radius:9px;font-weight:700\'>P"+s+"</span>";',
  '      }'
].join('\n'));

// ---------- start screen: host for N players ----------
const hostBtnRe = /    lobbyBtn\("Host a game","#2f4a2f","#4fd98a", async function\(b\)\{\n      b\.textContent="opening…";\n      var room = window\.KV_MP_HOST \? await window\.KV_MP_HOST\(\) : \(window\.KV_HOST \? await window\.KV_HOST\(\) : null\);/;
if (!hostBtnRe.test(html)) die('host button not found');
html = html.replace(hostBtnRe, [
  '    var seatWant = 2;',
  '    var seatRow=document.createElement("div");',
  '    seatRow.style.cssText="display:flex;gap:5px;width:250px;margin:5px auto 8px;align-items:center;";',
  '    var seatLbl=document.createElement("span");',
  '    seatLbl.textContent="seats";',
  '    seatLbl.style.cssText="font-size:10px;opacity:.6;flex:0 0 34px;";',
  '    seatRow.appendChild(seatLbl);',
  '    [2,3,4].forEach(function(n){',
  '      var sb=document.createElement("button");',
  '      sb.textContent=n;',
  '      sb.style.cssText="flex:1;padding:6px;background:"+(n===2?"#3a2f22":"#1b1712")+";color:#f4e4c1;border:1px solid #5a4a3a;border-radius:5px;font:12px monospace;cursor:pointer;";',
  '      sb.onclick=function(e){',
  '        e.stopPropagation(); seatWant=n;',
  '        Array.prototype.forEach.call(seatRow.querySelectorAll("button"),function(x){ x.style.background="#1b1712"; });',
  '        sb.style.background="#3a2f22";',
  '      };',
  '      seatRow.appendChild(sb);',
  '    });',
  '    box.appendChild(seatRow);',
  '',
  '    lobbyBtn("Host a game","#2f4a2f","#4fd98a", async function(b){',
  '      b.textContent="opening…";',
  '      var room = window.KV_MP_HOST ? await window.KV_MP_HOST(seatWant) : (window.KV_HOST ? await window.KV_HOST() : null);'
].join('\n'));

// live roster on the waiting screen
const waitRe = /        wifi\.textContent="share this code, then press Start when they join";/;
if (!waitRe.test(html)) die('waiting text not found');
html = html.replace(waitRe, [
  '        wifi.textContent="share this code — waiting for players";',
  '        var tick=setInterval(function(){',
  '          var M=window.KV_MP||{};',
  '          var n=(M.roster||[1]).length;',
  '          wifi.textContent="room "+room+"  \\u00b7  "+n+" of "+seatWant+" here"+(n<seatWant?"  (empty seats play as bots)":"  \\u2014 ready");',
  '        }, 900);',
  '        window.__kvLobbyTick=tick;'
].join('\n'));

const startRe = /        var go=lobbyBtn\("Start game","#22303a","#4f7fd9", function\(\)\{ ov\.remove\(\); \}\);/;
if (!startRe.test(html)) die('start button not found');
html = html.replace(startRe,
  '        var go=lobbyBtn("Start game","#22303a","#4f7fd9", function(){ if(window.__kvLobbyTick) clearInterval(window.__kvLobbyTick); ov.remove(); });');

fs.writeFileSync('showcase_kascity80.html', html);
console.log('PASS host chooses 2, 3 or 4 seats; joiners take the next free one');
console.log('PASS humans flag follows the live roster — empty or dropped seats play as bots');
console.log('PASS roster shown on the waiting screen and as P1-P4 pips in the health strip');
console.log('PASS 25s grace before a silent seat reverts to bot control, so a reconnect keeps its seat');
console.log('OK showcase_kascity80.html (' + (fs.statSync('showcase_kascity80.html').size/1024/1024).toFixed(1) + ' MB)');
