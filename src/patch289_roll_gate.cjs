// patch289_roll_gate.cjs — the engine free-runs bot seats; their rolls are refused by the relay but
// still enter KV_MOVES unacked, jamming the outbound turn gate so the legitimate seat's roll never
// posts. Fix at the source: in a relay game, KV_MOVE will not record a "roll" for a seat that is not
// the actor the relay/controller currently expects. Installed at EOF, on top of every earlier wrapper.
// Non-roll actions are untouched. Solo games are untouched.
// SRC showcase_kascity288.html -> DST showcase_kascity289.html
const fs = require("fs");
const SRC = "showcase_kascity288.html";
const DST = "showcase_kascity289.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const APPEND = `
<script>
// ---- __KV_V289: only the expected actor may create a roll in a relay game ----
(function(){
  var installed=false, dropped={};
  var iv=setInterval(function(){
    if(installed || !window.KV_MOVE) return;
    installed=true; clearInterval(iv);
    var base=window.KV_MOVE;
    window.KV_MOVE=function(seat, action, value, fx){
      try{
        var M=window.KV_MP2;
        if(M && M.room && M.started && String(action)==="roll"){
          var exp=null;
          var RT=M.__relayTurn;
          if(RT && Date.now()-RT.at<20000 && RT.exp>=1) exp=RT.exp;
          if(exp==null && M.opener) exp=M.opener;
          // a roller mid-turn keeps it until it posts a closer
          var mv=(window.KV_MOVES||[]), lr=null;
          for(var i=mv.length-1;i>=0;i--){ var r=mv[i]; if(r && r.__acked && String(r.a)==="roll"){ lr=r; break; } }
          if(lr && exp!=null && lr.s===exp){
            var closed=false;
            for(var j=mv.length-1;j>=0;j--){ var q=mv[j]; if(!q||!q.__acked) continue; if(q.i<=lr.i) break;
              if(q.s===lr.s && /^(buy|pass|end)$/.test(String(q.a))){ closed=true; break; } }
            if(!closed){
              // the expected seat already rolled and has not closed: no new roll from anyone
              var k1="mid/"+seat;
              if(!dropped[k1] || Date.now()-dropped[k1]>4000){
                dropped[k1]=Date.now();
                if(window.KV_LOG) window.KV_LOG("dropped P"+seat+" roll \\u2014 P"+lr.s+" has not closed its turn","#7a6a58");
              }
              return;
            }
          }
          if(exp!=null && seat!==exp){
            var k2="wrong/"+seat+"/"+exp;
            if(!dropped[k2] || Date.now()-dropped[k2]>4000){
              dropped[k2]=Date.now();
              if(window.KV_LOG) window.KV_LOG("dropped P"+seat+" roll \\u2014 the chain expects P"+exp,"#7a6a58");
            }
            return;
          }
        }
      }catch(e){}
      return base.apply(null, arguments);
    };
    if(window.KV_LOG) window.KV_LOG("roll gate armed \\u2014 only the expected seat may roll","#9cd87c");
  }, 200);
})();
</script>
`;

s = s + APPEND;
fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
