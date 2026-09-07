// kascity_visual_v222.cjs — accepted trades execute directly when the engine won't
// Human-accepted offers arm tr_* and wait for the engine's settle rule, which never
// fires in a relay game (owner stayed with the seller for 20s -> TRANSFER DID NOT
// LAND, then the boards wedge). The JS already knows buyer/seller/tile/amt, and the
// change watchers already turn owner+cash changes into p2pbuy/cash records that the
// relay carries. So on the 3s NOT-EXECUTED branch we settle it ourselves: deed to
// the buyer, cash both ways. Deterministic, recorded, relayed.
const fs = require("fs");
const SRC = "showcase_kascity221.html";
const DST = "showcase_kascity222.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V222") !== -1) { console.error("ABORT: v222 already applied."); process.exit(1); }

const A1 = `    if(Date.now()-t0>3000 && !done){ done=true; clearInterval(iv);
      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};
      dbg("ACCEPT DEBUG 3/3 \\u2014 NOT EXECUTED after 3s: owner=P"+own+" tr_state="+f.tr_state+" tr_tile="+f.tr_tile+" tr_from="+f.tr_from+" tr_to="+f.tr_to+" tr_amt="+f.tr_amt+" buyerCash="+b1+" (needs \\u2265 "+amt+")", "#e0a040"); }`;
const c = s.split(A1).length - 1;
if (c !== 1) { console.error("ABORT: anchor count " + c + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`    if(Date.now()-t0>3000 && !done){ done=true; clearInterval(iv);
      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};
      dbg("ACCEPT DEBUG 3/3 \\u2014 NOT EXECUTED after 3s: owner=P"+own+" tr_state="+f.tr_state+" tr_tile="+f.tr_tile+" tr_from="+f.tr_from+" tr_to="+f.tr_to+" tr_amt="+f.tr_amt+" buyerCash="+b1+" (needs \\u2265 "+amt+")", "#e0a040");
      // __KV_V222: the engine won't settle in a relay game — settle directly.
      try{
        if(own===seller && b1>=amt){
          var w2=window.KV_WORLD;
          if(w2 && w2.owners) w2.owners["t"+tile]=buyer;
          if(window.KV_SETSTATE){
            window.KV_SETSTATE("cash"+buyer,  Math.round(b1-amt));
            window.KV_SETSTATE("cash"+seller, Math.round(s1+amt));
            window.KV_SETSTATE("tr_state",0); window.KV_SETSTATE("htr_state",0);
          }
          if(w2 && w2.seats){
            try{ w2.seats[buyer-1].cash  = Math.round(b1-amt); }catch(e3){}
            try{ w2.seats[seller-1].cash = Math.round(s1+amt); }catch(e3){}
          }
          dbg("ACCEPT DEBUG \\u2014 settled directly: deed \\u2192 P"+buyer+", "+amt+" \\u2192 P"+seller, "#9cd87c");
        }
      }catch(e2){}
    }`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — accepted trades settle directly when the engine doesn't");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
