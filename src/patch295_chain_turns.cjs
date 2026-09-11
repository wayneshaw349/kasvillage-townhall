// patch295_chain_turns.cjs — Path A, final piece.
// When the chain says a seat we own is the actor and the engine has not produced the turn within a
// short grace, this board composes the turn itself and posts it: roll (relay dice) -> buy|pass -> end.
// Positions/cash are applied through the existing snapshot path, so the engine renders the result
// exactly as it renders any remote seat's turn. Works for our human seat and for host-owned bots.
// The engine is never asked to drive a turn again; it is a renderer.
// SRC showcase_kascity294.html -> DST showcase_kascity295.html
const fs = require("fs");
const SRC = "showcase_kascity294.html";
const DST = "showcase_kascity295.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const APPEND = `
<script>
// ---- __KV_V295: chain-native turns ----
(function(){
  function M(){ return window.KV_MP2; }
  function owns(p){ var m=M(); return !!m && (p===m.seat || (m.owns && m.owns(p))); }
  function flags(){ return (window.KV_FLAGS && window.KV_FLAGS()) || {}; }
  function cash(p){
    var v=null;
    try{ v=(window.KV_SEAT && window.KV_SEAT(p,"cash")); }catch(e){}
    if(v==null){ var f=flags(); v=f["cash"+p]; }
    return v==null?0:Math.round(v);
  }
  function expected(){
    var m=M(); if(!m) return null;
    var RT=m.__relayTurn;
    if(RT && Date.now()-RT.at<20000 && RT.exp>=1) return RT.exp;
    if(m.opener) return m.opener;
    return null;
  }
  // the chain's view of this seat's turn: has it rolled, has it closed?
  function turnState(seat){
    var mv=(window.KV_MOVES||[]), lastRoll=null;
    for(var i=mv.length-1;i>=0;i--){ var r=mv[i]; if(r && r.__acked && String(r.a)==="roll"){ lastRoll=r; break; } }
    if(!lastRoll || lastRoll.s!==seat) return { rolled:false, closed:false, roll:null };
    for(var j=mv.length-1;j>=0;j--){
      var q=mv[j]; if(!q||!q.__acked) continue; if(q.i<=lastRoll.i) break;
      if(q.s===seat && /^(buy|pass|end)$/.test(String(q.a))) return { rolled:true, closed:true, roll:lastRoll };
    }
    return { rolled:true, closed:false, roll:lastRoll };
  }
  async function relayDice(){
    var m=M(); if(!m) return null;
    try{
      var i=(m.head!=null?m.head:m.logN)||0;
      var url=(m.node||m.nodes[0])+"/api/game/room/"+m.room+"/dice?i="+i;
      var o=await fetch(url).then(function(r){ return r.json(); });
      if(o && o.d1!=null) return { d1:+o.d1, d2:+o.d2, v:(+o.d1)+(+o.d2) };
    }catch(e){}
    return null;
  }
  var busy=false, lastAct=0;
  setInterval(async function(){
    try{
      var m=M();
      if(!m || !m.room || !m.started || m.halted) return;
      if(busy) return;
      if((m.queue||[]).length) return;                 // remote moves first
      if(window.KV_SEALED) return;
      if(document.querySelector("[data-kvmodal]")) return;
      var exp=expected();
      if(!exp || !owns(exp)) return;
      if(Date.now()-lastAct<3000) return;
      var st=turnState(exp);

      // A: our seat has rolled and not closed -> close it from here
      if(st.rolled && !st.closed){
        busy=true; lastAct=Date.now();
        try{
          var f=flags();
          var pos=f["p"+exp];
          var N=window.KV_NAMES||{};
          var owner=(window.KV_OWNER && pos!=null) ? window.KV_OWNER(pos) : null;
          var price=(pos!=null && N[pos]) ? ((window.KV_INTRINSIC && window.KV_INTRINSIC(pos)) || N[pos].p || 0) : 0;
          var canBuy = (pos!=null && N[pos] && !owner && price>0 && cash(exp)>=price);
          if(canBuy && window.KV_MOVE){
            window.KV_LOG && window.KV_LOG("turn: P"+exp+" buys "+((N[pos]&&N[pos].n)||("block "+pos))+" (chain)","#9cd87c");
            window.KV_MOVE(exp,"buy",pos);
          } else if(window.KV_MOVE){
            window.KV_LOG && window.KV_LOG("turn: P"+exp+" passes (chain)","#7a6a58");
            window.KV_MOVE(exp,"pass",0);
          }
          setTimeout(function(){
            try{ if(window.KV_MOVE) window.KV_MOVE(exp,"end",(flags().turn||0)); }catch(e){}
          }, 700);
        }catch(e){}
        setTimeout(function(){ busy=false; }, 1500);
        return;
      }

      // B: our seat has not rolled -> roll from here, with the relay's dice
      if(!st.rolled){
        var eng=flags();
        // give the engine a moment to do it itself (human tap, normal flow)
        if(!m.__waitRoll || m.__waitSeat!==exp){ m.__waitRoll=Date.now(); m.__waitSeat=exp; return; }
        if(Date.now()-m.__waitRoll < 6000) return;
        busy=true; lastAct=Date.now(); m.__waitRoll=Date.now();
        try{
          var d=await relayDice();
          var total=d?d.v:(2+Math.floor(Math.random()*11));
          window.__KV_PIN=(window.__KV_PIN||{});
          if(d) window.__KV_PIN[exp]={d1:d.d1,d2:d.d2};
          window.KV_LOG && window.KV_LOG("turn: P"+exp+" rolls "+total+" (chain)","#9cd87c");
          // move the token so the snapshot we publish is correct
          var f2=flags(), from=f2["p"+exp];
          if(from!=null && window.KV_SETSTATE){
            var to=((from+total)%40+40)%40;
            window.__KV_CTL_WRITE=1;
            window.KV_SETSTATE("p"+exp, to);
            window.__KV_CTL_WRITE=0;
          }
          if(window.KV_MOVE) window.KV_MOVE(exp,"roll",total);
        }catch(e){}
        setTimeout(function(){ busy=false; }, 1500);
        return;
      }
    }catch(e){ busy=false; }
  }, 1200);
  if(window.KV_LOG) window.KV_LOG("chain-native turns armed","#9cd87c");
})();
</script>
`;

s = s + APPEND;
fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
