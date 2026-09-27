// kascity_visual_v228.cjs — the owner's board answers incoming bids
// v205 declared "a remote owner answers on their own board" — but the answering
// side was never built: the decide/settle logic lives only inside the offer-send
// closure. A remote bid arrived, was adopted, and nobody answered (the freeze on
// offers to the other client's bot or human). This adds the listener: a watcher
// scans adopted remote bid: records; if the tile's owner is a seat this device
// controls, it answers — human owner gets the ask dialog (KV_ASK_HUMAN), bot
// owner decides on price and records accept:/refuse: (+settle via tr flags),
// all of which relays back to the bidder.
const fs = require("fs");
const SRC = "showcase_kascity227.html";
const DST = "showcase_kascity228.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V228") !== -1) { console.error("ABORT: v228 already applied."); process.exit(1); }

const A1 = `  // ---- __KV_V226: turn-pointer watchdog`;
const c = s.split(A1).length - 1;
if (c !== 1) { console.error("ABORT: anchor count " + c + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`  // ---- __KV_V228: answer incoming remote bids for seats this device owns ----
  (function(){
    var seenBid={};
    function cashOf(p){ var v=null; try{ v=(window.KV_SEAT&&window.KV_SEAT(p,"cash")); }catch(e){} if(v==null){ var ff=(window.KV_FLAGS&&window.KV_FLAGS())||{}; v=ff["cash"+p]; } return v==null?0:Math.round(v); }
    setInterval(function(){
      try{
        if(!M.started || M.halted) return;
        var mv=(window.KV_MOVES||[]);
        for(var i=0;i<mv.length;i++){
          var r=mv[i];
          if(!r || seenBid[i]) continue;
          var a=String(r.a||"");
          if(a.indexOf("bid:")!==0) continue;
          seenBid[i]=1;
          if(r.s===M.seat || (M.owns&&M.owns(r.s))) continue;      // our own bid: the other side answers
          var tile=+a.split(":")[1]; if(!isFinite(tile)) continue;
          var owner=(window.KV_OWNER&&window.KV_OWNER(tile))||0;
          if(!owner || owner===r.s) continue;
          var ours=(owner===M.seat)||(M.owns&&M.owns(owner));
          if(!ours) continue;
          // has it been answered already? (accept/refuse/counter for this tile after i)
          var answered=false;
          for(var j=i+1;j<mv.length;j++){ var q=mv[j]; if(!q) continue; var qa=String(q.a||"");
            if((qa.indexOf("accept:")===0||qa.indexOf("refuse:")===0||qa.indexOf("counter:")===0) && +qa.split(":")[1]===tile){ answered=true; break; } }
          if(answered) continue;
          var N=window.KV_NAMES||{}, nm=(N[tile]&&N[tile].n)||("block "+tile);
          var v=+r.v||0;
          if(owner===M.seat){
            // our human decides
            if(window.KV_ASK_HUMAN){ log("P"+r.s+" offers "+v+" for your "+nm, "#f0c860"); window.KV_ASK_HUMAN(tile, r.s, owner, v, nm); }
            continue;
          }
          // our bot decides: simple price rule (base price if known, else the offer)
          var base=(N[tile]&&(N[tile].p||N[tile].price))||0;
          var need=cashOf(owner)<380;
          var threshold=base? Math.round(base*(need?0.8:1.0)) : v;
          var accept=v>=threshold;
          log("P"+owner+"  "+(accept?"ACCEPTS":"REFUSES")+" remote offer "+v+" for "+nm+(base?("  (asks "+threshold+")"):""), accept?"#9cd87c":"#e0a040");
          if(window.KV_MOVE) window.KV_MOVE(owner,(accept?"accept:":"refuse:")+tile, threshold);
          if(accept && window.KV_PAY_SETTLE){ try{ window.KV_PAY_SETTLE(tile, r.s, owner, v); }catch(e2){} }
          if(accept && !window.KV_PAY_SETTLE){
            // direct settle in the update model: deed + cash, watchers record p2pbuy/cash
            try{
              var __b0=cashOf(r.s), __s0=cashOf(owner);
              var w2=window.KV_WORLD;
              if(w2&&w2.owners) w2.owners["t"+tile]=r.s;
              if(window.KV_SETSTATE){
                window.KV_SETSTATE("cash"+r.s, Math.round(__b0-v));
                window.KV_SETSTATE("cash"+owner, Math.round(__s0+v));
              }
              if(w2&&w2.seats){ try{ w2.seats[r.s-1].cash=Math.round(__b0-v); }catch(e3){} try{ w2.seats[owner-1].cash=Math.round(__s0+v); }catch(e3){} }
            }catch(e4){}
          }
        }
      }catch(e){}
    }, 900);
  })();

  // ---- __KV_V226: turn-pointer watchdog`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — remote bids get answered by the owning board");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
