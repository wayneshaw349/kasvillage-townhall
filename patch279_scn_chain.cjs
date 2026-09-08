// patch279_scn_chain.cjs — scenarios become chain-driven for non-owned seats.
// Publisher: carries the option label, good/bad and the swing in the move body (opt/good/sw),
//            plus records the id so remote boards mark the card used.
// Remote:    applyRemote's mgmt: branch fires shout/log/sfx and marks the deck entry used,
//            so the other board never draws a card for a seat it does not own.
// SRC showcase_kascity278.html -> DST showcase_kascity279.html
const fs = require("fs");
const SRC = "showcase_kascity278.html";
const DST = "showcase_kascity279.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function must(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

// P: publisher — enrich the fx payload with presentation data
const P1 = '        window.KV_MOVE(seat,"mgmt:"+sc.id,oi,__fx);';
// R: remote handler — insert a mgmt: branch in applyRemote before the generic fx block
const R1 = "    // __KV_V233: effect payloads -- the mover states exactly what changed; apply and return\n    if(m.fx){";
// Q: poller/queue records must carry the extra fields
const Q1 = 'fx:b2.fx||null, d1:(b2.d1!=null?+b2.d1:null), d2:(b2.d2!=null?+b2.d2:null) };   // __KV_V273';
const Q2 = 'fx:b.fx||null, d1:(b.d1!=null?+b.d1:null), d2:(b.d2!=null?+b.d2:null)';

must(P1, 1, "P1 publisher");
must(R1, 1, "R1 applyRemote fx block");
must(Q1, 1, "Q1 poller record");
if (s.split(Q2).length - 1 < 1) fails.push("Q2 resync record: found 0");

if (fails.length) {
  console.error("ABORT — anchors:\n" + fails.join("\n"));
  process.exit(1);
}

// ---- P: publish presentation data alongside fx ----
s = s.replace(P1,
'        __fx.__scn={ id:sc.id, opt:o.l, good:!!good, sw:Math.round(swing), sold:(sold==null?null:sold), lost:!!lost, best:(oi===best) };   // __KV_V279\n' +
'        window.KV_MOVE(seat,"mgmt:"+sc.id,oi,__fx);');

// ---- R: remote scenario rendering + deck marking, before the generic fx apply ----
s = s.replace(R1,
'    // __KV_V279: a remote scenario resolves from the chain, never from our own deck\n' +
'    if(a.indexOf("mgmt:")===0 && m.fx && m.fx.__scn){\n' +
'      try{\n' +
'        var sx=m.fx.__scn;\n' +
'        window.__KV_SCN_USED=window.__KV_SCN_USED||{};\n' +
'        window.__KV_SCN_USED[m.s+":"+sx.id]=1;\n' +
'        var nmR=(sx.sold!=null && window.KV_NAMES && window.KV_NAMES[sx.sold]) ? window.KV_NAMES[sx.sold].n : null;\n' +
'        var wordR=sx.lost ? "  \\u00b7 LOST " : "  \\u00b7 sold ";\n' +
'        log("P"+m.s+"  "+sx.opt+"  \\u2192  "+(sx.sw>=0?"+":"")+sx.sw+(nmR?(wordR+nmR):""), COL[m.s]);\n' +
'        if(window.KV_SFX) window.KV_SFX(sx.good?"ching":"dang");\n' +
'        if(window.KV_SHOUT) window.KV_SHOUT(sx.good?"IT WORKED":"IT BACKFIRED",\n' +
'          "P"+m.s+" \\u00b7 "+sx.opt+" \\u00b7 "+(sx.sw>=0?"+":"")+sx.sw+(nmR?(wordR+nmR):""),\n' +
'          sx.good?"#9cd87c":"#ff6a4a", false);\n' +
'        if(sx.best && window.KV_XP){\n' +
'          var xa=Math.max(1,Math.round(12*(window.KV_XP_MULT==null?1:window.KV_XP_MULT)));\n' +
'          window.KV_XP[m.s]=(window.KV_XP[m.s]||0)+xa;\n' +
'          log("P"+m.s+"  +"+xa+" XP  best decision", COL[m.s]);\n' +
'        }\n' +
'      }catch(eS){}\n' +
'    }\n' +
R1);

// ---- Q: keep fx (which now carries __scn) intact — records already copy fx wholesale; no change needed,
//         but ensure the local generator marks its own used map through the shared store ----
const U1 = '      used[seat+":"+sc.id]=1; lastFire=Date.now();';
const U2 = '      used[seat+":"+sc.id]=1;\n      lastFire=Date.now();';
if (s.split(U1).length - 1 === 1) {
  s = s.replace(U1, '      used[seat+":"+sc.id]=1; window.__KV_SCN_USED=window.__KV_SCN_USED||{}; window.__KV_SCN_USED[seat+":"+sc.id]=1; lastFire=Date.now();   // __KV_V279');
}
if (s.split(U2).length - 1 === 1) {
  s = s.replace(U2, '      used[seat+":"+sc.id]=1; window.__KV_SCN_USED=window.__KV_SCN_USED||{}; window.__KV_SCN_USED[seat+":"+sc.id]=1;\n      lastFire=Date.now();   // __KV_V279');
}

// ---- deck filters honour the shared used map so a card consumed remotely is not redrawn ----
const F1 = 'var pool=window.KV_DECK.filter(function(s){return !used[seat+":"+s.id];});';
if (s.split(F1).length - 1 === 1) {
  s = s.replace(F1, 'var pool=window.KV_DECK.filter(function(s){ var U=window.__KV_SCN_USED||{}; return !used[seat+":"+s.id] && !U[seat+":"+s.id]; });   // __KV_V279');
}
const F2 = '        return (s.t===0||s.t===tier) && !used[seat+":"+s.id];';
if (s.split(F2).length - 1 === 1) {
  s = s.replace(F2, '        var U=window.__KV_SCN_USED||{}; return (s.t===0||s.t===tier) && !used[seat+":"+s.id] && !U[seat+":"+s.id];   // __KV_V279');
}

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
