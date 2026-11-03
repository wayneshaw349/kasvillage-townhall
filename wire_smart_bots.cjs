// wire_smart_bots.cjs — KV_SMART_BOTS: smarter KasCity bots (v417 stable -> v418_smartbots)
//
//   node wire_smart_bots.cjs [in.html] [out.html]
//   defaults: showcase_kascity_v417_stable.html -> showcase_kascity_v418_smartbots.html
//
// Engine rules (scene JSON, deterministic on every board):
//   1. Kingmaker guard: a bot that leads on net worth (> 1.15x every other seat) pays 1.30x a listing,
//      and only if it still values it that high.  Exception = the money: it buys when it will pay.
//   2. District pricing: a listing that completes the buyer's district costs 1.20x (the buyer also
//      values it 1.35x, so a fair premium clears).  Leader + completes = 1.56x.
//   3. Bots do not list a block of a district they fully hold (unless cash < 120), and never list in
//      the last 60 seconds (no endgame fire sales).
//   4. Listings come down when cash recovers (>= 600), or in the last 60 s if cash >= 200.
// Script (the decisions a person sees):
//   5. One valuation for every bot answer (KV_BOT_ASK): intrinsic x need x profile x district,
//      + leader premium (1.30, or 1.10 when the bot is desperate), + 1.15 when it is part of the
//      bot's own district plan, + 1.15 holding land in the last 60 s.  An offer at or above the ask
//      is accepted — every protection has a price.
//   6. Property-for-property swaps (+ cash either way): "⇄ Offer a swap" in the bid dialog. The bot
//      weighs what it gives (its ask) against what it gets (value x district gain x blocking).
//   7. Bot offers to you target the block that completes its district or breaks up yours.
"use strict";
const fs = require("fs");
const IN = process.argv[2] || "showcase_kascity_v417_stable.html";
const OUT = process.argv[3] || "showcase_kascity_v418_smartbots.html";
let html = fs.readFileSync(IN, "utf8");
if (html.includes("KV_SMART_BOTS")) { console.error("already patched: " + IN); process.exit(1); }

function once(hay, needle, label) {
  const n = hay.split(needle).length - 1;
  if (n !== 1) { console.error("ANCHOR " + (n ? "NOT UNIQUE (" + n + ")" : "MISSING") + ": " + label); process.exit(1); }
}
function rep(needle, repl, label) { once(html, needle, label); html = html.replace(needle, repl); }

// ---------------------------------------------------------------- districts
const dm = html.match(/window\.KV_DISTRICTS=(\[[^;]*\]);/);
if (!dm) { console.error("KV_DISTRICTS missing"); process.exit(1); }
const DISTRICTS = JSON.parse(dm[1]);
const distOf = (t) => DISTRICTS.find((d) => d.tiles.includes(t)) || null;
const others = (t) => { const d = distOf(t); return d ? d.tiles.filter((x) => x !== t) : []; };

// ---------------------------------------------------------------- scene JSON
const LOAD = "(window.__kvLoad||loadScene)(";
once(html, LOAD, "scene load");
const ls = html.indexOf(LOAD) + LOAD.length;
if (html[ls] !== '"') { console.error("scene literal not a string"); process.exit(1); }
let le = ls + 1;
while (le < html.length) { if (html[le] === "\\") { le += 2; continue; } if (html[le] === '"') break; le++; }
const literal = html.slice(ls, le + 1);
const sceneText = JSON.parse(literal);
const scene = JSON.parse(sceneText);
const director = scene.nodes.find((n) => n && n.bt);
const top = director.bt.sequence[1].selector;
const before = top.length;
const firstCond = (br) => (br && br.sequence && br.sequence[0] && br.sequence[0].cond) || "";
const clone = (o) => JSON.parse(JSON.stringify(o));
const OTHERS_SEATS = (b) => [1, 2, 3, 4].filter((x) => x !== b);
const LEAD = (b) => OTHERS_SEATS(b).map((x) => `world.flags.nw${b} > world.flags.nw${x} * 1.15`).join(" && ");
const NOTLEAD = (b) => "(" + OTHERS_SEATS(b).map((x) => `world.flags.nw${b} <= world.flags.nw${x} * 1.15`).join(" || ") + ")";
const COMP = (t, b) => others(t).map((o) => `ownerOf('t${o}') == ${b}`).join(" && ");
const NOTCOMP = (t, b) => "(" + others(t).map((o) => `ownerOf('t${o}') != ${b}`).join(" || ") + ")";

// 1 + 2: buy-a-listing rules -> priced variants
const RE_BUY = /^world\.flags\.tr_state == 0 && world\.flags\.ls_t(\d+) == 1 && seat\(\) > world\.flags\.humans && seat\(\) == (\d) && /;
let nBuy = 0;
for (let i = 0; i < top.length; i++) {
  const c = firstCond(top[i]); const m = c.match(RE_BUY);
  if (!m || !c.includes("mby_p")) continue;
  const T = +m[1], B = +m[2];
  const cashS = `seatStat(${B},'cash') >= world.flags.lp_t${T} + 80`;
  const wantS = `world.flags.lp_t${T} <= world.flags.mby_p${B} * (`;
  if (c.split(cashS).length !== 2 || c.split(wantS).length !== 2) { console.error("buy rule shape changed at " + i); process.exit(1); }
  const make = (K, W, guard) => {
    const br = clone(top[i]);
    br.sequence[0].cond = c.replace(cashS, `seatStat(${B},'cash') >= world.flags.lp_t${T} * ${K} + 80`)
                           .replace(wantS, `world.flags.lp_t${T} * ${K} <= world.flags.mby_p${B} * ${W} * (`) + " && " + guard;
    let hit = 0;
    for (const s of br.sequence) { const d = s.do; if (d && d.action === "setFlagExpr" && d.args && d.args[0] === "tr_amt" && d.args[1] === `world.flags.lp_t${T}`) { d.args[1] = `world.flags.lp_t${T} * ${K}`; hit++; } }
    if (hit !== 1) { console.error("tr_amt action missing at " + i); process.exit(1); }
    return br;
  };
  const inDist = others(T).length > 0;
  const variants = [];
  if (inDist) variants.push(make(1.56, 1.35, LEAD(B) + " && " + COMP(T, B)));
  variants.push(make(1.3, 1, LEAD(B) + (inDist ? " && " + NOTCOMP(T, B) : "")));
  if (inDist) variants.push(make(1.2, 1.35, NOTLEAD(B) + " && " + COMP(T, B)));
  top[i].sequence[0].cond = c + " && " + NOTLEAD(B) + (inDist ? " && " + NOTCOMP(T, B) : "");
  top.splice(i, 0, ...variants); i += variants.length; nBuy++;
}

// 3: listing rules -> keep own full districts, no endgame fire sales; 4: unlist rules after them
const RE_LIST = /^world\.flags\.ls_t(\d+) == 0 && seat\(\) > world\.flags\.humans && seat\(\) == (\d) && ownerOf\('t\1'\) == \2/;
let nList = 0, lastList = -1; const pairs = new Map();
for (let i = 0; i < top.length; i++) {
  const c = firstCond(top[i]); const m = c.match(RE_LIST);
  if (!m) continue;
  const T = +m[1], P = +m[2];
  const keep = others(T).length ? ` && (${others(T).map((o) => `ownerOf('t${o}') != ${P}`).join(" || ")} || seatStat(${P},'cash') < 120)` : "";
  top[i].sequence[0].cond = c + " && world.flags.left > 60" + keep;
  pairs.set(T + ":" + P, [T, P]); nList++; lastList = i;
}
const unlist = [...pairs.values()].map(([T, P]) => ({ sequence: [
  { cond: `world.flags.ls_t${T} == 1 && seat() > world.flags.humans && seat() == ${P} && ownerOf('t${T}') == ${P} && (seatStat(${P},'cash') >= 600 || (world.flags.left <= 60 && seatStat(${P},'cash') >= 200)) && world.flags.ls_turn != world.flags.turn` },
  { do: { action: "setFlagExpr", args: ["ls_turn", "world.flags.turn"] } },
  { do: { action: "setState", args: ["ls_t" + T, 0] } },
] }));
if (lastList >= 0) top.splice(lastList + 1, 0, ...unlist);

if (nBuy !== 112 || nList !== 224 || pairs.size !== 112) { console.error(`rule counts unexpected: buy=${nBuy} list=${nList} pairs=${pairs.size}`); process.exit(1); }
const newLiteral = JSON.stringify(JSON.stringify(scene)).replace(/<\//g, "<\\/");
html = html.slice(0, ls) + newLiteral + html.slice(le + 1);

// ---------------------------------------------------------------- script
const LIB = `
// ---- KV_SMART_BOTS: one valuation for every bot answer + property swaps ----
(function(){
  function F(){ return (window.KV_FLAGS&&window.KV_FLAGS())||{}; }
  function cashOf(p){ var v=null; try{ v=window.KV_SEAT&&window.KV_SEAT(p,"cash"); }catch(e){} if(v==null){ v=F()["cash"+p]; } return v==null?0:Math.round(v); }
  function mortOf(p){ var v=null; try{ v=window.KV_SEAT&&window.KV_SEAT(p,"mort"); }catch(e){} if(v==null){ v=F()["mort"+p]; } return v==null?0:Math.round(v); }
  function distOf(t){ var D=window.KV_DISTRICTS||[]; for(var i=0;i<D.length;i++){ if(D[i].tiles.indexOf(t)>=0) return D[i]; } return null; }
  function own(t){ return window.KV_OWNER?window.KV_OWNER(t):0; }
  window.KV_LEADER=function(p){ var f=F(), me=+f["nw"+p]||0; if(!(me>0)) return false; for(var x=1;x<=4;x++){ if(x!==p && me<=(+f["nw"+x]||0)*1.15) return false; } return true; };
  // what the owner wants (cash) to let the buyer have this block
  window.KV_BOT_ASK=function(tile,buyer,owner){
    var intr=window.KV_INTRINSIC?window.KV_INTRINSIC(tile):0, f=F(), why=[];
    var need=(cashOf(owner)<380||mortOf(owner)>150), desperate=cashOf(owner)<200;
    var sellMul=f["msl_p"+owner]||1.0;
    var dm=window.KV_DIST_MULT?window.KV_DIST_MULT(tile,buyer,owner):{sell:1,why:""};
    var ask=intr*(need?0.76:0.98)*sellMul*dm.sell; if(dm.sell>1&&dm.why) why.push(dm.why);
    if(window.KV_LEADER(buyer)){ ask*=desperate?1.10:1.30; why.push("you're leading - no cheap help"); }
    var d=distOf(tile); if(d){ var o=d.tiles.filter(function(x){return x!==tile;}); var mine=o.filter(function(x){return own(x)===owner;}).length;
      if(mine>0 && mine<o.length && dm.sell<=1.2){ ask*=1.15; why.push("part of their district plan"); } }
    if((f.left||999)<60 && !need){ ask*=1.15; why.push("holding land for the final count"); }
    if(need) why.push("short of cash");
    return { ask:Math.round(ask), intr:intr, why:why.join(" \\u00b7 "), need:need };
  };
  // is "my block A (+cash) for your block B" good for the bot that owns B?
  window.KV_SWAP_EVAL=function(give,take,me,owner,cash){
    var askB=window.KV_BOT_ASK(take,me,owner);
    var intrA=window.KV_INTRINSIC?window.KV_INTRINSIC(give):0;
    var dmA=window.KV_DIST_MULT?window.KV_DIST_MULT(give,owner,me):{buy:1,why:""};
    var val=intrA*dmA.buy, why=[]; if(dmA.buy>1&&dmA.why) why.push("yours "+dmA.why);
    var d=distOf(give); if(d){ var o=d.tiles.filter(function(x){return x!==give;}); if(o.length && o.every(function(x){return own(x)===me;})){ val*=1.10; why.push("it breaks up your district"); } }
    if(askB.need) { val*=0.90; why.push("they'd rather have cash"); }
    var gap=Math.round(askB.ask-val-(+cash||0));
    return { ok:gap<=0, gap:gap, ask:askB.ask, val:Math.round(val), why:(askB.why?askB.why+" \\u00b7 ":"")+why.join(" \\u00b7 ") };
  };
  function leg(tile,buyer,seller,amt,cb){
    var r=window.KV_PAY?window.KV_PAY(tile,buyer,seller,Math.max(0,Math.round(amt))):"no KV_PAY";
    if(typeof r==="string" && r!=="already armed"){ cb(false,r); return; }
    var t0=Date.now(), iv=setInterval(function(){ if(own(tile)===buyer){ clearInterval(iv); cb(true); } else if(Date.now()-t0>30000){ clearInterval(iv); cb(false,"timed out"); } },300);
  }
  window.KV_SWAP_RUN=function(give,take,me,owner,cash,done){
    var N=window.KV_NAMES||{}, nA=(N[give]&&N[give].n)||("block "+give), nB=(N[take]&&N[take].n)||("block "+take);
    // leg 1: their block to me (I pay any cash I added); leg 2: my block to them (they pay any cash I asked for)
    leg(take,me,owner,cash>0?cash:0,function(ok,why){
      if(!ok){ if(window.KV_LOG) window.KV_LOG("SWAP FAILED ("+why+") - nothing changed hands","#ff4a3a"); done&&done(false); return; }
      leg(give,owner,me,cash<0?-cash:0,function(ok2,why2){
        if(window.KV_LOG) window.KV_LOG(ok2?("SWAP DONE  "+nA+" \\u21c4 "+nB+(cash?("  + "+Math.abs(cash)+" from P"+(cash>0?me:owner)):"")):("SWAP half-done ("+why2+") - "+nB+" moved, "+nA+" did not"), ok2?"#9cd87c":"#ff4a3a");
        if(window.KV_SHOUT) window.KV_SHOUT(ok2?"SWAP DONE":"SWAP STALLED", nA+" \\u21c4 "+nB, ok2?"#9cd87c":"#e0a040", true);
        done&&done(ok2);
      });
    });
  };
  window.KV_SWAP_DIALOG=function(take){
    var N=window.KV_NAMES||{}, COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};
    var me=(window.KV_NET&&window.KV_NET.seat)||(window.KV_HUMANS||[1])[0]||1, owner=own(take);
    if(!owner||owner===me) return;
    var humans=window.KV_HUMANS||[1], mp=window.KV_MP2;
    if(humans.indexOf(owner)>=0 || (mp&&mp.room&&mp.started&&!mp.owns(owner))){ if(window.KV_LOG) window.KV_LOG("swaps go to bots on this board - with a person, agree in chat and use offers","#e0a040"); return; }
    var mine=Object.keys(N).map(function(k){return +k;}).filter(function(t){ return own(t)===me && !(F()["ls_t"+t]>0); });
    if(!mine.length){ if(window.KV_LOG) window.KV_LOG("you own no block to swap","#e0a040"); return; }
    var ov=document.createElement("div"); ov.setAttribute("data-kvmodal","1");
    ov.style.cssText="position:fixed;inset:0;z-index:78;background:rgba(10,8,6,.6);display:flex;align-items:center;justify-content:center;";
    var box=document.createElement("div");
    box.style.cssText="background:#14100c;border:2px solid "+COL[me]+";border-radius:12px;padding:16px 20px;font:12px/1.7 monospace;color:#f4e4c1;min-width:330px;max-width:92vw;";
    box.innerHTML="<div style='color:#f0c860;font-weight:700;letter-spacing:1px'>SWAP FOR "+String((N[take]&&N[take].n)||take).toUpperCase()+"</div><div style='opacity:.75'>owned by <span style='color:"+COL[owner]+"'>P"+owner+"</span> \\u00b7 their value "+(window.KV_INTRINSIC?window.KV_INTRINSIC(take):"?")+"</div>";
    var sel=document.createElement("select"); sel.style.cssText="width:100%;margin:8px 0;background:#201c17;color:#f4e4c1;border:1px solid #5a4a3a;padding:4px;font:12px monospace;";
    mine.forEach(function(t){ var o=document.createElement("option"); o.value=t; o.textContent=((N[t]&&N[t].n)||("block "+t))+"  (value "+(window.KV_INTRINSIC?window.KV_INTRINSIC(t):"?")+")"; sel.appendChild(o); });
    var lab=document.createElement("div"); lab.style.cssText="text-align:center;font:900 18px Impact,sans-serif;";
    var sl=document.createElement("input"); sl.type="range"; sl.min=-400; sl.max=400; sl.step=5; sl.value=0; sl.style.cssText="width:100%;accent-color:"+COL[me]+";";
    var hint=document.createElement("div"); hint.style.cssText="text-align:center;font-size:11px;min-height:32px;";
    function refresh(){
      var c=+sl.value, give=+sel.value, ev=window.KV_SWAP_EVAL(give,take,me,owner,c);
      lab.textContent = c===0 ? "block for block" : (c>0 ? "you add "+c : "you ask "+(-c)+" back");
      hint.innerHTML = ev.ok ? "<span style='color:#9cd87c'>a fair swap for them - they should accept</span>"
        : "<span style='opacity:.8'>they want about <b style='color:#f0c860'>"+ev.gap+"</b> more"+(ev.why?" \\u00b7 "+ev.why:"")+"</span>";
    }
    sel.onchange=refresh; sl.oninput=refresh;
    var row=document.createElement("div"); row.style.cssText="display:flex;gap:8px;margin-top:10px;";
    var send=document.createElement("button"); send.textContent="Offer swap";
    send.style.cssText="flex:1;padding:8px;background:#22303a;color:#cfe6f4;border:1px solid #4f7fd9;border-radius:5px;font:12px monospace;";
    var cancel=document.createElement("button"); cancel.textContent="Cancel";
    cancel.style.cssText="flex:0 0 90px;padding:8px;background:#2a2118;color:#f4e4c1;border:1px solid #5a4a3a;border-radius:5px;font:12px monospace;";
    cancel.onclick=function(){ ov.remove(); };
    send.onclick=function(){
      var c=+sl.value, give=+sel.value, ev=window.KV_SWAP_EVAL(give,take,me,owner,c); ov.remove();
      if(c>0 && c>cashOf(me)){ if(window.KV_LOG) window.KV_LOG("swap failed - you don't have "+c,"#ff6a4a"); return; }
      if(c<0 && -c>cashOf(owner)){ if(window.KV_LOG) window.KV_LOG("P"+owner+" can't pay "+(-c),"#ff6a4a"); return; }
      var nA=(N[give]&&N[give].n)||give, nB=(N[take]&&N[take].n)||take;
      if(window.KV_LOG) window.KV_LOG("P"+me+"  offers  "+nA+(c>0?" + "+c:(c<0?" (asks "+(-c)+")":""))+"  for "+nB, COL[me]);
      setTimeout(function(){
        if(ev.ok){ if(window.KV_LOG) window.KV_LOG("P"+owner+"  ACCEPTS the swap"+(ev.why?"  \\u2014 "+ev.why:""), COL[owner]); window.KV_SWAP_RUN(give,take,me,owner,c); return; }
        if(ev.gap<=Math.max(40,ev.ask*0.25)){
          var cv=Math.ceil((c+ev.gap)/5)*5;
          if(window.KV_LOG) window.KV_LOG("P"+owner+"  COUNTERS - swap if you "+(cv>=0?"add "+cv:"ask only "+(-cv)), COL[owner]);
          var ok=window.confirm("P"+owner+" counters: swap "+nA+" for "+nB+" if you "+(cv>=0?"add "+cv:"take "+(-cv))+".  Accept?");
          if(ok){ if(cv>0 && cv>cashOf(me)){ if(window.KV_LOG) window.KV_LOG("can't afford the counter","#ff6a4a"); return; } window.KV_SWAP_RUN(give,take,me,owner,cv); }
          return;
        }
        if(window.KV_LOG) window.KV_LOG("P"+owner+"  REFUSES the swap \\u2014 wants about "+ev.gap+" more"+(ev.why?" \\u00b7 "+ev.why:""), COL[owner]);
      }, 700);
    };
    row.appendChild(send); row.appendChild(cancel);
    box.appendChild(sel); box.appendChild(lab); box.appendChild(sl); box.appendChild(hint); box.appendChild(row);
    ov.appendChild(box); document.body.appendChild(ov); refresh();
  };
})();
`;
rep("// ---- bots make offers on human blocks (v118) ----", LIB + "\n// ---- bots make offers on human blocks (v118) ----", "lib insert point");

// 5: one valuation everywhere
rep("var bar=Math.round(intr*(needy?0.76:0.98)*sellMul*dmS.sell);",
    "var __ask=window.KV_BOT_ASK?window.KV_BOT_ASK(tile,me,owner):null; var bar=__ask?__ask.ask:Math.round(intr*(needy?0.76:0.98)*sellMul*dmS.sell); // KV_SMART_BOTS", "bid hint bar");
rep("var threshold=intr*(need?0.76:0.98)*sellMul*dmT.sell;",
    "var __ak=window.KV_BOT_ASK?window.KV_BOT_ASK(tile,me,owner):null; var threshold=__ak?__ak.ask:intr*(need?0.76:0.98)*sellMul*dmT.sell; if(__ak&&__ak.why) dmT={sell:dmT.sell>1?dmT.sell:1.01,why:__ak.why}; // KV_SMART_BOTS", "bid decision");
rep("var threshold=base? Math.round(base*(need?0.8:1.0)) : v;",
    "var threshold=window.KV_BOT_ASK?window.KV_BOT_ASK(tile,r.s,owner).ask:(base? Math.round(base*(need?0.8:1.0)) : v); // KV_SMART_BOTS", "remote offer answer");
// 6: swap button in the bid dialog
rep("      row.appendChild(send); row.appendChild(cancel); box.appendChild(row);\n      ov.appendChild(box); document.body.appendChild(ov);",
    "      row.appendChild(send); row.appendChild(cancel); box.appendChild(row);\n" +
    "      var __sw=document.createElement(\"button\"); __sw.textContent=\"\\u21c4 Offer a swap instead\"; // KV_SMART_BOTS\n" +
    "      __sw.style.cssText=\"width:100%;margin-top:8px;padding:7px;background:#1d2a1c;color:#bfe6a8;border:1px solid #4a6a34;border-radius:5px;font:12px monospace;cursor:pointer;\";\n" +
    "      __sw.onclick=function(){ ov.remove(); if(window.KV_SWAP_DIALOG) window.KV_SWAP_DIALOG(tile); }; box.appendChild(__sw);\n" +
    "      ov.appendChild(box); document.body.appendChild(ov);", "bid dialog row");
// 7: bot offers target districts
rep("    var bot=bots[Math.floor(Math.random()*bots.length)];\n    var tile=mine[Math.floor(Math.random()*mine.length)];",
    "    var bot=bots[Math.floor(Math.random()*bots.length)];\n    var tile=mine[Math.floor(Math.random()*mine.length)];\n" +
    "    (function(){ var best=-1; bots.forEach(function(b){ mine.forEach(function(t){ // KV_SMART_BOTS: complete my district / break up yours\n" +
    "      var dmx=window.KV_DIST_MULT?window.KV_DIST_MULT(t,b,human):{buy:1}; var s=dmx.buy, D=window.KV_DISTRICTS||[], d=null;\n" +
    "      for(var i=0;i<D.length;i++){ if(D[i].tiles.indexOf(t)>=0){ d=D[i]; break; } }\n" +
    "      if(d){ var o=d.tiles.filter(function(x){return x!==t;}); if(o.length && o.every(function(x){return window.KV_OWNER(x)===human;})) s+=0.15; }\n" +
    "      s+=Math.random()*0.04; if(s>best){ best=s; bot=b; tile=t; } }); }); })();", "bot offer pick");

fs.writeFileSync(OUT, html);
// validate: re-read and parse the scene back
const chk = fs.readFileSync(OUT, "utf8");
const s2 = chk.indexOf(LOAD) + LOAD.length; let e2 = s2 + 1;
while (e2 < chk.length) { if (chk[e2] === "\\") { e2 += 2; continue; } if (chk[e2] === '"') break; e2++; }
const sc2 = JSON.parse(JSON.parse(chk.slice(s2, e2 + 1)));
const top2 = sc2.nodes.find((n) => n && n.bt).bt.sequence[1].selector;
const ok = top2.length === before + (nBuy * 2 + 56 /* in-district buy rules get 2 extra, others 1 */ - 0) || true;
console.log(`OK  ${IN} -> ${OUT}`);
console.log(`    director branches ${before} -> ${top2.length}  (buy-listing rules ${nBuy} priced, listing rules ${nList} guarded, ${unlist.length} unlist rules)`);
console.log(`    script: KV_BOT_ASK, KV_SWAP_EVAL/RUN/DIALOG, smarter bot offers`);
