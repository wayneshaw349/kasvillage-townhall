// patch243_opener.cjs
// SRC showcase_kascity242.html -> DST showcase_kascity243.html
// Opener enforcement, client half (pairs with relay v53):
//   C1: turn_order gains seed:["opener"] (both /start call sites)
//   C2: host publishes {s:openerSeat, a:"opener"} via /append once firsts are done
//       (inside the openBot flow, where the opener seat is known)
//   C3: poll skips queueing "opener" records (informational, like "first")
//   C4: ROLL button opening case: before any roll on the chain, only the declared
//       opener's board shows ROLL (engine fallback only when no opener exists)
//   C5: outbound gate opening case: hold a first roll that is not the declared opener's
//   C6: resync expected-seat honors a trailing opener record
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity242.html";
const DST = "showcase_kascity243.html";

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

// ---------- C1: rules gain seed (both start sites carry the same literal) ----------
rep("C1-rules-seed",
  'turn_order:{ seats:4, round_robin:["roll"], follow:["buy","pass"], exempt:["first"] }',
  'turn_order:{ seats:4, round_robin:["roll"], follow:["buy","pass"], exempt:["first"], seed:["opener"] }',
  2);

// ---------- C2: host publishes the opener once firsts are done ----------
rep("C2-publish-opener",
`              var seat=g.seat||(((g.turn||0)%4)+1);
              var isBot = M.roster.length && seat>M.roster.length;`,
`              var seat=g.seat||(((g.turn||0)%4)+1);
              // __KV_V243: publish the opener so the relay gate knows who rolls first
              if(!M.__openerSent){ M.__openerSent=1;
                try{ ord("/api/game/room/"+M.room+"/append", { wallet:wallet(), kind:"move",
                  body:{ s:seat, a:"opener", v:0, t:0 } }).catch(function(){}); }catch(eO){}
                log("opener published: P"+seat+" rolls first", "#caa64c");
              }
              var isBot = M.roster.length && seat>M.roster.length;`);

// ---------- C3: poll skips opener records ----------
rep("C3-poll-skip",
  '          if(m.a==="first" && m.s>=1 && m.s<=4){ M.firstList=M.firstList||{}; (M.firstList[m.s]=M.firstList[m.s]||[]).push(Number(m.v)); return; }',
`          if(m.a==="first" && m.s>=1 && m.s<=4){ M.firstList=M.firstList||{}; (M.firstList[m.s]=M.firstList[m.s]||[]).push(Number(m.v)); return; }
          if(m.a==="opener"){ M.opener=m.s; return; }   // __KV_V243: informational; seeds the gate server-side`);

// ---------- C4: ROLL button opening case ----------
rep("C4-button-opener",
  '      if(!lr) return ((f.seat||1)===M.seat);                     // opening roll: engine decides',
`      if(!lr){
        var op=M.opener;
        if(op==null){ var mvO=(window.KV_MOVES||[]);
          for(var oi=mvO.length-1;oi>=0;oi--){ var orr=mvO[oi]; if(orr && String(orr.a)==="opener"){ op=orr.s; break; } } }
        if(op!=null) return op===M.seat;                           // __KV_V243: the declared opener rolls first
        return ((f.seat||1)===M.seat);                             // no opener yet: engine decides
      }`);

// ---------- C5: outbound gate opening case ----------
rep("C5-outbound-opener",
  '          if(__a==="roll"){ if(__lr && rec.s!==((__lr.s%4)+1)) continue; }',
`          if(__a==="roll"){
            if(__lr){ if(rec.s!==((__lr.s%4)+1)) continue; }
            else { var __op=M.opener; if(__op!=null && rec.s!==__op) continue; }   // __KV_V243
          }`);

// ---------- C6: resync honors a trailing opener ----------
rep("C6-resync-opener",
  '        exp = (String(lastMove.a)==="roll") ? lastMove.s : ((lastMove.s%4)+1);',
  '        exp = (String(lastMove.a)==="roll"||String(lastMove.a)==="opener") ? lastMove.s : ((lastMove.s%4)+1);');

if (errs.length) {
  console.error("ABORT -- nothing written:");
  errs.forEach(function(e){ console.error("  " + e); });
  process.exit(1);
}

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");
const chk = fs.readFileSync(DST, "utf8");
const must = ['seed:["opener"]', "__KV_V243: publish the opener", "__KV_V243: the declared opener rolls first"];
const missing = must.filter(function(x){ return chk.indexOf(x) < 0; });
if (missing.length) { console.error("POST-WRITE CHECK FAILED", missing); process.exit(1); }
console.log("OK -> " + DST + "  (" + chk.length + " chars)");
