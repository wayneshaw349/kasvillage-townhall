// kascity_visual_v181.cjs — fix v180 resume: the client read window.__KV_MP2_BOOT, which is
// set by scene code that runs AFTER the client block initializes, so resume never fired
// (observed: __KV_MP2_BOOT populated, KV_MP2.room null, nodes 0).
// Fix: the client reads localStorage directly (source of truth, no ordering dependency),
// keeps the flag until the session is established, and logs failures instead of swallowing.
const fs = require("fs");
const SRC = "showcase_kascity180.html";
const DST = "showcase_kascity181.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V181") !== -1) { console.error("ABORT: v181 already applied."); process.exit(1); }

const A1 = `  // ---- resume after the lobby reload ----
  (function(){
    var b=window.__KV_MP2_BOOT;
    if(!b||!b.room) return;
    localStorage.removeItem("kv_mp2");
    M.room=b.room;
    discover().then(function(){
      if(b.role==="host"){
        fan("/api/game/room/create",{room:M.room,wallet:wallet(),seed_commit:"seed-"+M.room,game:"kascity"}).catch(function(){});
        log("hosting "+M.room+" — when everyone has joined, run KV.start()", "#9cd87c");
      } else {
        fan("/api/game/room/"+M.room+"/join",{wallet:wallet()},true).catch(function(){});
        log("in room "+M.room+" — waiting for the host to start", "#9cd87c");
      }
      strip();
    });
  })();`;

const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error("ABORT: resume anchor count " + c1 + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`  // ---- resume after the lobby reload (__KV_V181: read storage directly, no load-order dependency) ----
  (function(){
    var b=null;
    try{ b = JSON.parse(localStorage.getItem("kv_mp2") || "null") || window.__KV_MP2_BOOT || null; }
    catch(e){ b = window.__KV_MP2_BOOT || null; }
    if(!b || !b.room) return;
    M.room = b.room; M.role = b.role;
    strip();
    discover().then(function(){
      var p = (b.role==="host")
        ? fan("/api/game/room/create",{room:M.room,wallet:wallet(),seed_commit:"seed-"+M.room,game:"kascity"})
        : fan("/api/game/room/"+M.room+"/join",{wallet:wallet()},true);
      return p.then(function(){
        // only drop the flag once the room is actually live on a node
        localStorage.removeItem("kv_mp2");
        log(b.role==="host"
          ? ("hosting "+M.room+" — when everyone has joined, run KV.start()")
          : ("in room "+M.room+" — waiting for the host to start"), "#9cd87c");
        strip();
      });
    }).catch(function(e){
      log("multiplayer resume failed: "+((e&&e.message)||e)+" — flag kept, try KV.retry()", "#ff6a4a");
    });
  })();

  window.KV_RETRY2 = async function(){
    var b=null; try{ b=JSON.parse(localStorage.getItem("kv_mp2")||"null"); }catch(e){}
    if(!b||!b.room){ log("nothing to resume","#ff6a4a"); return; }
    M.room=b.room; await discover();
    try{
      if(b.role==="host") await fan("/api/game/room/create",{room:M.room,wallet:wallet(),seed_commit:"seed-"+M.room,game:"kascity"});
      else await fan("/api/game/room/"+M.room+"/join",{wallet:wallet()},true);
      localStorage.removeItem("kv_mp2");
      log("resumed room "+M.room,"#9cd87c"); strip();
    }catch(e){ log("retry failed: "+((e&&e.message)||e),"#ff6a4a"); }
  };`);

// expose retry on the KV console object
const A2 = `    window.KV.mp=function(){`;
if (s.split(A2).length - 1 !== 1) { console.error("ABORT: KV.mp anchor not unique. File untouched."); process.exit(1); }
s = s.replace(A2, `    window.KV.retry=function(){ return window.KV_RETRY2(); };
    window.KV.mp=function(){`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 2/2 — resume reads localStorage directly, flag kept until room is live, KV.retry() added");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
