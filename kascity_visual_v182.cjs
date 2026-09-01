// kascity_visual_v182.cjs — wire the lobby UI to the v181 client; drop dead nodes
// Observed: the lobby's "Host a game" / "Join" buttons call the OLD KV_MP layer, which
// targets kasvillage_1/_2.app.runonflux.io (CORS-blocked) and posts the pre-v50 body
// shape to the LB (400). The new KV_MP2 client was never reachable from the UI.
// Fix 1: alias KV_MP_HOST / KV_MP_JOIN to KV_HOST2 / KV_JOIN2 (buttons need no edits).
// Fix 2: silence the old layer's polling loop (it fans to the dead hostnames).
// Fix 3: discovery health-checks each node and keeps only responsive ones
//        (152.53.136.33 timed out — the Flux instance that never cycled to v50).
const fs = require("fs");
const SRC = "showcase_kascity181.html";
const DST = "showcase_kascity182.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V182") !== -1) { console.error("ABORT: v182 already applied."); process.exit(1); }

// --- Fix 3: health-checked discovery ---
const A1 = `    if(!M.nodes.length) M.nodes=["https://kasvillage.app.runonflux.io"];
    log("relay: "+M.nodes.length+" node(s)");
    return M.nodes;`;
// --- Fix 1+2: aliases, installed at the end of the client IIFE ---
const A2 = `    window.KV.retry=function(){ return window.KV_RETRY2(); };`;

for (const [n, a] of [["A1", A1], ["A2", A2]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + n + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

s = s.replace(A1,
`    // __KV_V182: keep only nodes that actually answer — a Flux instance can be listed but dead
    var probed = await Promise.all(M.nodes.map(async function(u){
      try{
        var c=new AbortController(); var t=setTimeout(function(){c.abort();},3500);
        var r=await fetch(u+"/api/game/room/__probe__",{signal:c.signal});
        clearTimeout(t);
        return (r.status===404||r.ok) ? u : null;   // 404 = alive, route present, no such room
      }catch(e){ return null; }
    }));
    var alive = probed.filter(Boolean);
    if(alive.length) M.nodes = alive;
    if(!M.nodes.length) M.nodes=["https://kasvillage.app.runonflux.io"];
    log("relay: "+M.nodes.length+" node(s) reachable");
    return M.nodes;`);

s = s.replace(A2,
`    window.KV.retry=function(){ return window.KV_RETRY2(); };
    // __KV_V182: the lobby buttons call the old layer — point them at this client
    window.KV_MP_HOST = function(seats){ return window.KV_HOST2(); };
    window.KV_MP_JOIN = function(code){ return window.KV_JOIN2(code); };
    // and stop the old layer from fanning to its dead hostnames
    try { if(window.KV_MP){ window.KV_MP.online=false; window.KV_MP.room=null; } } catch(e){}
    try { window.KV_NODES = []; } catch(e){}`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 2/2 — lobby wired to KV_MP2, old layer silenced, dead nodes dropped");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
