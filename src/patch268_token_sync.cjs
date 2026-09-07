// patch268_token_sync.cjs — non-owned seats' tokens follow the position flags
// Engine token movement is seat-gated, so adopted flags never reached the sprites on the guest.
// This loop mirrors f["pN"] -> nodes.token_pN.transform.pos using nodes.tile_T as the target,
// with a per-seat corner offset. Runs only in relay games, only for seats this client doesn't own.
// Appended at EOF (file has no </html>).
// SRC showcase_kascity267.html -> DST showcase_kascity268.html
const fs = require("fs");
const SRC = "showcase_kascity267.html";
const DST = "showcase_kascity268.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const APPEND = `
<script>
// ---- __KV_V268: token sync for non-owned seats ----
(function(){
  var lastT={}, warned=0;
  function owned(p){ var M=window.KV_MP2; if(!(M&&M.room&&M.started)) return true; return p===M.seat || (M.owns&&M.owns(p)); }
  setInterval(function(){
    try{
      var M=window.KV_MP2; if(!(M&&M.room&&M.started)) return;
      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};
      var N=window.nodes||{};
      for(var p=1;p<=4;p++){
        if(owned(p)) continue;
        var t=f["p"+p]; if(t==null||t<0) continue;
        if(lastT[p]===t) continue;
        var tn=N["tile_"+t], tok=N["token_p"+p];
        if(!tn||!tok||!tn.transform||!tok.transform) continue;
        var tp=tn.transform.pos||[0,0,0];
        if(!tp[0]&&!tp[2]&&t!==0){
          if(!warned){ warned=1; if(window.KV_LOG) window.KV_LOG("token sync: tile nodes carry no position \\u2014 sync disabled","#e0a040"); }
          return;
        }
        var off=[[-0.35,0,-0.35],[0.35,0,-0.35],[-0.35,0,0.35],[0.35,0,0.35]][p-1];
        var y=(tok.transform.pos&&tok.transform.pos[1])||0.2;
        tok.transform.pos=[tp[0]+off[0], y, tp[2]+off[2]];
        try{ delete tok._world; }catch(e){}
        try{ if(N["tok_spr_"+p] && N["tok_spr_"+p]._world) delete N["tok_spr_"+p]._world; }catch(e2){}
        lastT[p]=t;
      }
    }catch(e){}
  }, 300);
})();
</script>
`;

s = s + APPEND;
fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
