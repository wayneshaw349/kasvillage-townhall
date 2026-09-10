// patch282_daa_clock.cjs — in a relay game the clock is derived from the Kaspa blue score, so both
// boards read the same time regardless of engine pauses, modals or resyncs.
//   * armGun records the gun score and the wall-clock instant it fired
//   * a poller samples daaNow() every 5s and measures the score-per-second rate empirically
//   * KV_CLOCK_LEFT() = TOTAL - elapsed_seconds_since_gun (score-derived, smoothed locally)
//   * the HUD clock and the end trigger use it in relay games; solo is untouched
// SRC showcase_kascity281.html -> DST showcase_kascity282.html
const fs = require("fs");
const SRC = "showcase_kascity281.html";
const DST = "showcase_kascity282.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function must(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

const A1 = '  M.armGun = function(startDaa, seed, players){';
const A2 = '      var bl=(bf.left!=null)?Math.round(bf.left):null;\n' +
'      if(bl===null && t0===null){clock.textContent="7:00";return;}\n' +
'      var l=(bl!==null) ? Math.max(0,bl) : Math.max(0,TOTAL-Math.floor((Date.now()-t0)/1000));';

must(A1, 1, "A1 armGun");
must(A2, 1, "A2 clock read");

if (fails.length) {
  console.error("ABORT — anchors:\n" + fails.join("\n"));
  process.exit(1);
}

// A1: record the gun and start the score sampler
s = s.replace(A1,
'  // __KV_V282: DAA-derived shared clock\n' +
'  M.__clk = { gun:null, gunAt:0, score:null, scoreAt:0, rate:null };\n' +
'  (function(){\n' +
'    setInterval(async function(){\n' +
'      try{\n' +
'        if(!M.__clk.gun) return;\n' +
'        var d=await M.daaNow();\n' +
'        if(d==null) return;\n' +
'        var now=Date.now();\n' +
'        if(M.__clk.score!=null && now>M.__clk.scoreAt){\n' +
'          var r=(d-M.__clk.score)/((now-M.__clk.scoreAt)/1000);\n' +
'          if(r>0.2 && r<200) M.__clk.rate = (M.__clk.rate==null) ? r : (M.__clk.rate*0.7 + r*0.3);\n' +
'        }\n' +
'        M.__clk.score=d; M.__clk.scoreAt=now;\n' +
'      }catch(e){}\n' +
'    }, 5000);\n' +
'  })();\n' +
'  // seconds elapsed since the gun, from the chain score (null when unavailable)\n' +
'  window.KV_CLOCK_LEFT = function(total){\n' +
'    try{\n' +
'      var c=M.__clk;\n' +
'      if(!M.room || !M.started || !c || !c.gun || c.score==null) return null;\n' +
'      var rate = c.rate || 10;   // tn10 blue score advances ~10/s; measured above\n' +
'      var scoreNow = c.score + rate*((Date.now()-c.scoreAt)/1000);   // smooth between samples\n' +
'      var elapsed = (scoreNow - c.gun) / rate;\n' +
'      if(!isFinite(elapsed) || elapsed<0) return null;\n' +
'      return Math.max(0, Math.round((total||420) - elapsed));\n' +
'    }catch(e){ return null; }\n' +
'  };\n' +
'  M.armGun = function(startDaa, seed, players){\n' +
'    try{ M.__clk.gun = Number(startDaa); M.__clk.gunAt = Date.now(); }catch(eG){}   // __KV_V282');

// A2: prefer the shared clock in relay games
s = s.replace(A2,
'      var bl=(bf.left!=null)?Math.round(bf.left):null;\n' +
'      // __KV_V282: in a relay game the chain score is the clock both boards share\n' +
'      var dl=(window.KV_CLOCK_LEFT)?window.KV_CLOCK_LEFT(TOTAL):null;\n' +
'      if(dl!=null) bl=dl;\n' +
'      if(bl===null && t0===null){clock.textContent="7:00";return;}\n' +
'      var l=(bl!==null) ? Math.max(0,bl) : Math.max(0,TOTAL-Math.floor((Date.now()-t0)/1000));');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
