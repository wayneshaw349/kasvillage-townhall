// patch272_relay_dice.cjs — client side of relay v55 dice
// C1: /start turn_order gains dice:["roll"]
// C2: prefetch loop — before our own roll, GET /dice?i=head and pin exact d1/d2
// C3: remote pins use the entry's d1/d2 (exact split, doubles-correct); rec builders carry d1/d2
// C4: ack mismatch (relay overwrote v) -> correct record + resync
// SRC showcase_kascity271.html -> DST showcase_kascity272.html
const fs = require("fs");
const SRC = "showcase_kascity271.html";
const DST = "showcase_kascity272.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function count(a){ return s.split(a).length - 1; }
function must(a, n, label){ const c = count(a); if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

const F1 = 'follow:["buy","pass","end","court"]';
const F2 = 'follow: ["buy","pass","end","court"]';
const A2 = "  // ---- __KV_V260: end-of-turn publisher";
const A3 = 'window.__KV_PIN[m.s]=+m.v;';
const A4 = 'hash:b.hash||null, snap:b.snap||null, fx:b.fx||null';
const A5 = '        var k = ks[0], v = +P[k];';
const A6 = '            M.seen[o.i]=1;                 // our own entry: the /log echo is not re-applied';

const f1c = count(F1), f2c = count(F2);
if (f1c + f2c < 2) fails.push("C1 follow lists: found " + (f1c + f2c) + " (expected 2+)");
must(A2, 1, "C2 publisher banner");
must(A3, 1, "C3 drain pin");
if (count(A4) < 1) fails.push("C3 rec builder: found 0");
must(A5, 1, "C3 pinroll value line");
must(A6, 1, "C4 ack line");

if (fails.length) {
  console.error("ABORT — anchors:\n" + fails.join("\n"));
  process.exit(1);
}

// C1
if (f1c) s = s.split(F1).join('follow:["buy","pass","end","court"], dice:["roll"]');
if (f2c) s = s.split(F2).join('follow: ["buy","pass","end","court"], dice:["roll"]');

// C2: prefetch loop (module scope, uses ord())
s = s.replace(A2,
'  // ---- __KV_V272: prefetch relay dice for our own upcoming roll ----\n' +
'  (function(){\n' +
'    var lastKey="";\n' +
'    setInterval(async function(){\n' +
'      try{\n' +
'        if(!M.started || M.halted) return;\n' +
'        var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};\n' +
'        var sNow=f.seat||1;\n' +
'        if(!(sNow===M.seat || (M.owns&&M.owns(sNow)))) return;\n' +
'        if((f.moved||0)>0) return;\n' +
'        var P=window.__KV_PIN||{};\n' +
'        if(P[sNow]) return;\n' +
'        var i=(M.head!=null?M.head:M.logN)||0;\n' +
'        var key=sNow+"/"+i; if(key===lastKey) return; lastKey=key;\n' +
'        var o=await ord("/api/game/room/"+M.room+"/dice?i="+i);\n' +
'        if(o && o.d1!=null){ window.__KV_PIN=(window.__KV_PIN||{}); window.__KV_PIN[sNow]={d1:+o.d1,d2:+o.d2}; }\n' +
'      }catch(e){}\n' +
'    }, 700);\n' +
'  })();\n\n' + A2);

// C3a: remote pins carry exact dice when present
s = s.replace(A3, 'window.__KV_PIN[m.s]=(m.d1!=null&&m.d2!=null)?{d1:+m.d1,d2:+m.d2}:+m.v;');

// C3b: rec builders carry d1/d2 (all sites)
s = s.split(A4).join('hash:b.hash||null, snap:b.snap||null, fx:b.fx||null, d1:(b.d1!=null?+b.d1:null), d2:(b.d2!=null?+b.d2:null)');

// C3c: pinroll honors exact-dice pins
s = s.replace(A5,
'        var k = ks[0], pv = P[k];\n' +
'        if (pv && typeof pv === "object" && pv.d1) {\n' +
'          if (which === 1) return +pv.d1;\n' +
'          var bx = +pv.d2; delete P[k]; delete P.__a; return bx;\n' +
'        }\n' +
'        var v = +pv;');

// C4: relay overwrote our dice -> correct record + resync
s = s.replace(A6, A6 + '\n' +
'            if(o.d1!=null && String(r.a)==="roll" && (+r.v)!==((+o.d1)+(+o.d2))){\n' +
'              r.v=(+o.d1)+(+o.d2); r.d1=+o.d1; r.d2=+o.d2;\n' +
'              log("relay corrected dice at i"+o.i+" \\u2014 resyncing","#e0a040");\n' +
'              if(M.resync){ M.__lastResync=0; M.resync("dice corrected"); }\n' +
'            }');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
