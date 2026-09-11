// patch291_chain_only_turns.cjs — Path A, core step.
// In a relay game the chain (via the controller) is the ONLY thing that advances turn/seat.
//   A: the v-era "ends turn" timer (advances turn every tick) is disabled in relay games —
//      it was racing the controller, which is the tug-of-war behind the stalls.
//   B: the stall detector's last-resort hand-off is disabled in relay games (belt and braces).
//   C: KV_SETSTATE("turn"/"seat") is funnelled: in a relay game, writes from outside the
//      controller are ignored. The controller sets window.__KV_CTL_WRITE=1 around its own writes.
// Solo play is untouched throughout.
// SRC showcase_kascity290.html -> DST showcase_kascity291.html
const fs = require("fs");
const SRC = "showcase_kascity290.html";
const DST = "showcase_kascity291.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function need(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

const A = '    window.KV_SETSTATE("turn",(f.turn||0)+1); window.KV_SETSTATE("seat",(((f.turn||0)+1)%4)+1); window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0); window.KV_SETSTATE("asked",0);\n' +
'    if(window.KV_LOG) window.KV_LOG("P"+seat+" ends turn","#7a6a58");';
const B = '          window.KV_SETSTATE("turn",(f.turn||0)+1); window.KV_SETSTATE("seat",(((f.turn||0)+1)%4)+1);\n' +
'          window.KV_SETSTATE("phase",0);';
const CTL = '        window.KV_SETSTATE("turn", exp-1); window.KV_SETSTATE("seat", exp);\n' +
'        window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);\n' +
'        window.KV_SETSTATE("rollshow",0); window.KV_SETSTATE("rollv",0); window.KV_SETSTATE("rollt",0);';

need(A, 1, "A ends-turn timer");
need(B, 1, "B stall hand-off");
need(CTL, 1, "CTL controller step");

if (fails.length) { console.error("ABORT — anchors:\n" + fails.join("\n")); process.exit(1); }

// A: relay games never self-advance the turn here
s = s.replace(A,
'    // __KV_V291: in a relay game the chain advances turns, not this timer\n' +
'    if(window.KV_MP2 && window.KV_MP2.room && window.KV_MP2.started){\n' +
'      if(window.KV_LOG) window.KV_LOG("P"+seat+" ends turn (chain advances)","#7a6a58");\n' +
'      return;\n' +
'    }\n' +
'    window.KV_SETSTATE("turn",(f.turn||0)+1); window.KV_SETSTATE("seat",(((f.turn||0)+1)%4)+1); window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0); window.KV_SETSTATE("asked",0);\n' +
'    if(window.KV_LOG) window.KV_LOG("P"+seat+" ends turn","#7a6a58");');

// B: stall hand-off never rotates in a relay game
s = s.replace(B,
'          if(window.KV_MP2 && window.KV_MP2.room && window.KV_MP2.started){ step=3; return; }   // __KV_V291\n' +
'          window.KV_SETSTATE("turn",(f.turn||0)+1); window.KV_SETSTATE("seat",(((f.turn||0)+1)%4)+1);\n' +
'          window.KV_SETSTATE("phase",0);');

// C: mark the controller's own writes as authorised
s = s.replace(CTL,
'        window.__KV_CTL_WRITE=1;   // __KV_V291\n' +
'        window.KV_SETSTATE("turn", exp-1); window.KV_SETSTATE("seat", exp);\n' +
'        window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);\n' +
'        window.KV_SETSTATE("rollshow",0); window.KV_SETSTATE("rollv",0); window.KV_SETSTATE("rollt",0);');

// close the authorised window right after the controller's block (it ends with buy_tile)
const CTLEND = '          window.KV_SETSTATE("buy",-1); window.KV_SETSTATE("buy_tile",-1);\n' +
'        }\n' +
'        log("turn: P"+exp+" to act (engine was on P"+seatNow+")", "#9cd87c");';
if (s.split(CTLEND).length - 1 === 1) {
  s = s.replace(CTLEND,
'          window.KV_SETSTATE("buy",-1); window.KV_SETSTATE("buy_tile",-1);\n' +
'        }\n' +
'        window.__KV_CTL_WRITE=0;   // __KV_V291\n' +
'        log("turn: P"+exp+" to act (engine was on P"+seatNow+")", "#9cd87c");');
}

// D: the funnel itself, appended at EOF so it wraps the final KV_SETSTATE
const APPEND = `
<script>
// ---- __KV_V291: in a relay game, only the controller may move turn/seat ----
(function(){
  var installed=false, blocked={};
  var iv=setInterval(function(){
    if(installed || !window.KV_SETSTATE) return;
    installed=true; clearInterval(iv);
    var base=window.KV_SETSTATE;
    window.KV_SETSTATE=function(key, val){
      try{
        var M=window.KV_MP2;
        if(M && M.room && M.started && !window.__KV_CTL_WRITE && (key==="turn" || key==="seat")){
          var k="blk/"+key;
          if(!blocked[k] || Date.now()-blocked[k]>8000){
            blocked[k]=Date.now();
            if(window.KV_LOG) window.KV_LOG("blocked an outside "+key+" write \\u2014 the chain owns turns","#7a6a58");
          }
          return;
        }
      }catch(e){}
      return base.apply(null, arguments);
    };
    if(window.KV_LOG) window.KV_LOG("turn funnel armed \\u2014 chain-only rotation","#9cd87c");
  }, 200);
})();
</script>
`;

s = s + APPEND;
fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
