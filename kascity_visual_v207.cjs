// kascity_visual_v207.cjs — scenarios fire only for seats this client owns
// The scenario driver (interval + Math.random) fired for whichever seat was on turn, on every
// machine — each client invented different events for seats it doesn't own (guest forced
// zoning/appraisal on P3, host had different moves at those indices -> halt).
// Rule as everywhere: owner generates, everyone else applies from the relay.
const fs = require("fs");
const SRC = "showcase_kascity206.html";
const DST = "showcase_kascity207.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V207") !== -1) { console.error("ABORT: v207 already applied."); process.exit(1); }

// 1. auto-fire loop: bail for un-owned seats in relay games (anchor = pacing check)
const A1 = `    setInterval(function(){
      if(busy) return;
      if(Date.now()-lastFire < 12000) return;  // pacing`;
// 2. the manual/force path: same gate
const A2 = `    window.KV_FORCE_SCENARIO=function(){
      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};
      var seat=((f.turn||0)%4)+1;`;
for (const [k, a] of [["A1", A1], ["A2", A2]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + k + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

s = s.replace(A1,
`    setInterval(function(){
      if(busy) return;
      if(Date.now()-lastFire < 12000) return;  // pacing
      // __KV_V207: in a relay game, scenarios are generated only by the seat's owner
      if(window.KV_MP2 && window.KV_MP2.room && window.KV_MP2.started){
        var __f=(window.KV_FLAGS&&window.KV_FLAGS())||{};
        if(!window.KV_MP2.owns(((__f.turn||0)%4)+1)) return;
      }`);

s = s.replace(A2,
`    window.KV_FORCE_SCENARIO=function(){
      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};
      var seat=((f.turn||0)%4)+1;
      if(window.KV_MP2 && window.KV_MP2.room && window.KV_MP2.started && !window.KV_MP2.owns(seat)){
        console.log("[SCN] P"+seat+" is remote — their client generates their scenarios"); return;
      }`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 2/2 — scenario generation gated to owned seats");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
