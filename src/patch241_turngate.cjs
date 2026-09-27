// patch241_turngate.cjs
// SRC showcase_kascity240.html -> DST showcase_kascity241.html
// Client half of the sequence enforcement (works before AND after the relay v52 deploy):
//   C1/C2: /start now sends turn_order {seats:4, round_robin:["roll"], follow:["buy","pass"], exempt:["first"]}
//   C3: outbound tail HOLDS turn-bound records until the chain says the seat is eligible
//       (roll: next after last roll, first roll free; buy/pass: only the last roller)
//   C4: /append {stored:false, reason} is handled as a verdict -> unsend + resync, not a retry storm
//   C5: ROLL button is strictly chain-gated (the "engine is on us" branch that let both
//       humans open is gone; rent-only landings unlock after 3.5s of log quiet)
//   C6: host bot kicker only fires when the chain says that bot is next
//   C7: poll stamps M.__lastLogAt for the quiet-log heuristic
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity240.html";
const DST = "showcase_kascity241.html";

let raw = fs.readFileSync(SRC, "utf8");
const hadCRLF = raw.indexOf("\r\n") >= 0;
let s = hadCRLF ? raw.replace(/\r\n/g, "\n") : raw;

const errs = [];
function count(h, n){ return h.split(n).length - 1; }
function rep(label, o, n, expect){
  expect = expect == null ? 1 : expect;
  const c = count(s, o);
  if (c !== expect) { errs.push(`[${label}] anchor count ${c}, expected ${expect}`); return; }
  s = s.split(o).join(n);
}

const RULES = `turn_order:{ seats:4, round_robin:["roll"], follow:["buy","pass"], exempt:["first"] }`;

// ---------- C1: KV_START2 sends the rules ----------
rep("C1-start-rules",
  '    await fan("/api/game/room/"+M.room+"/start", { roster:roster });',
  `    await fan("/api/game/room/"+M.room+"/start", { roster:roster, ${RULES} });`);

// ---------- C2: seedNode re-start sends the rules ----------
rep("C2-seed-rules",
  '        await one(u, "/api/game/room/"+M.room+"/start", { roster:M.roster });',
  `        await one(u, "/api/game/room/"+M.room+"/start", { roster:M.roster, ${RULES} });`);

// ---------- C3: outbound turn gate ----------
rep("C3-outbound-gate",
  "        if(!mine(rec.s)) continue;   // __KV_V202: publish only the seats this client owns",
`        if(!mine(rec.s)) continue;   // __KV_V202: publish only the seats this client owns
        // __KV_V241: hold turn-bound records until the chain says this seat is eligible
        var __a=String(rec.a);
        if(__a==="roll" || __a==="buy" || __a==="pass"){
          var __mvG=(window.KV_MOVES||[]), __lr=null;
          for(var __g=__mvG.length-1;__g>=0;__g--){ var __r=__mvG[__g];
            if(__r && __r!==rec && String(__r.a)==="roll"){ __lr=__r; break; } }
          if(__a==="roll"){ if(__lr && rec.s!==((__lr.s%4)+1)) continue; }
          else { if(!__lr || __lr.s!==rec.s) continue; }
        }`);

// ---------- C4: verdict handling on append ----------
rep("C4-verdict",
  "            if(!o || o.stored!==true || o.i==null){ r.__sent=0; return; }",
`            if(o && o.stored===false && o.reason){
              r.__sent=0;
              log("relay refused "+r.a+" P"+r.s+": "+o.reason+(o.expect!=null?(" (expects P"+o.expect+")"):""), "#e0a040");
              if(M.resync) M.resync("relay refused "+r.a);
              return;
            }
            if(!o || o.stored!==true || o.i==null){ r.__sent=0; return; }`);

// ---------- C5: strict chain-gated ROLL button ----------
rep("C5-ourturn",
`    function ourTurn(){
      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};
      var mv=(window.KV_MOVES||[]), lr=null, lri=-1;
      for(var i=mv.length-1;i>=0;i--){ var r=mv[i]; if(r && String(r.a)==="roll"){ lr=r; lri=i; break; } }
      var rolledOurs = !!(lr && lr.s===M.seat);
      if(((f.seat||1)===M.seat) && !rolledOurs) return true;          // engine is on us, we have not rolled
      if(lr && lr.s!==M.seat){
        for(var j=lri+1;j<mv.length;j++){ var q=mv[j];
          if(q && q.s===lr.s && /^(buy|pass)$/.test(String(q.a))) return ((lr.s%4)+1)===M.seat; }
      }
      return false;
    }`,
`    function ourTurn(){
      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};
      var mv=(window.KV_MOVES||[]), lr=null, lri=-1;
      for(var i=mv.length-1;i>=0;i--){ var r=mv[i]; if(r && String(r.a)==="roll"){ lr=r; lri=i; break; } }
      if(!lr) return ((f.seat||1)===M.seat);                     // opening roll: engine decides
      if(lr.s===M.seat) return false;                            // our roll is the latest
      if(((lr.s%4)+1)!==M.seat) return false;                    // chain: not our turn
      for(var j=lri+1;j<mv.length;j++){ var q=mv[j];
        if(q && q.s===lr.s && /^(buy|pass)$/.test(String(q.a))) return true; }   // roller decided
      // rent-only landings record no buy/pass: unlock after the log goes quiet
      return (Date.now()-(M.__lastLogAt||0)) > 3500 && !(M.queue||[]).length;
    }`);

// ---------- C6: chain-gated bot kicker ----------
rep("C6-bot-gate",
  "        if(!(M.roster.length && seatNow>M.roster.length)) return;   // not a bot seat",
`        if(!(M.roster.length && seatNow>M.roster.length)) return;   // not a bot seat
        // __KV_V241: only when the chain says this bot is next
        var mvK=(window.KV_MOVES||[]), lrK=null;
        for(var ki=mvK.length-1;ki>=0;ki--){ var kr=mvK[ki]; if(kr && String(kr.a)==="roll"){ lrK=kr; break; } }
        if(lrK && ((lrK.s%4)+1)!==seatNow) return;`);

// ---------- C7: last-log timestamp ----------
rep("C7-lastlog",
  "          M.logN = (M.logN||0) + 1;",
  "          M.logN = (M.logN||0) + 1; M.__lastLogAt=Date.now();");

if (errs.length) {
  console.error("ABORT -- nothing written:");
  errs.forEach(function(e){ console.error("  " + e); });
  process.exit(1);
}

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");
const chk = fs.readFileSync(DST, "utf8");
const must = ["__KV_V241: hold turn-bound records", "relay refused ", "turn_order:{ seats:4", "__KV_V241: only when the chain says this bot is next"];
const missing = must.filter(function(x){ return chk.indexOf(x) < 0; });
if (missing.length) { console.error("POST-WRITE CHECK FAILED", missing); process.exit(1); }
console.log("OK -> " + DST + "  (" + chk.length + " chars)");
