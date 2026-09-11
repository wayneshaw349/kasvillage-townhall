// patch292_opener_derive.cjs — the controller had no actor before the first roll:
//   * M.opener was never set (the host published its own seat, not the derived winner)
//   * /turn returns expect_roller:null until rotation starts, and the poller ignored null
// Fix, client side and independent of the relay:
//   A: M.deriveOpener() — highest "first" value wins, ties reroll among the tied (relay's rule)
//   B: the /turn poller stores the relay answer, and falls back to the local derivation when the
//      relay has no rotation state yet
//   C: a gate refusal naming an expected seat updates __relayTurn immediately
// SRC showcase_kascity291.html -> DST showcase_kascity292.html
const fs = require("fs");
const SRC = "showcase_kascity291.html";
const DST = "showcase_kascity292.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function need(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

const A = '  // ---- __KV_V280: ask the relay whose turn it is (its gate is the acceptor) ----';
const B = '        if(t && t.expect_roller!=null){ M.__relayTurn={ exp:+t.expect_roller, last:(t.last_rr_seat==null?null:+t.last_rr_seat), at:Date.now() }; }';
const C = '              log("relay expects P"+ex, "#caa64c");';

need(A, 1, "A poller banner");
need(B, 1, "B poller store");
need(C, 1, "C gate refusal log");

if (fails.length) { console.error("ABORT — anchors:\n" + fails.join("\n")); process.exit(1); }

// A: local opener derivation, same rule as the relay's derive_opener
s = s.replace(A,
'  // ---- __KV_V292: derive the opener from the chain\'s first-rolls (relay rule) ----\n' +
'  M.deriveOpener = function(){\n' +
'    try{\n' +
'      var mv=(window.KV_MOVES||[]), seq=[];\n' +
'      for(var i=0;i<mv.length;i++){\n' +
'        var r=mv[i];\n' +
'        if(r && String(r.a)==="first" && r.s>=1 && r.s<=4) seq.push([r.s, +r.v||0]);\n' +
'      }\n' +
'      if(!seq.length) return null;\n' +
'      var active=[1,2,3,4], idx=0;\n' +
'      for(var guard=0; guard<16; guard++){\n' +
'        if(active.length===1) return active[0];\n' +
'        var vals={}, n=0;\n' +
'        while(idx<seq.length && n<active.length){\n' +
'          var sv=seq[idx][0], vv=seq[idx][1]; idx++;\n' +
'          if(active.indexOf(sv)>=0 && vals[sv]==null){ vals[sv]=vv; n++; }\n' +
'        }\n' +
'        if(n<active.length) return null;            // incomplete round\n' +
'        var best=-1;\n' +
'        for(var k in vals){ if(vals[k]>best) best=vals[k]; }\n' +
'        active=active.filter(function(sv){ return vals[sv]===best; });\n' +
'        if(!active.length) return null;\n' +
'      }\n' +
'      return null;\n' +
'    }catch(e){ return null; }\n' +
'  };\n\n' + A);

// B: store the relay answer; fall back to the local derivation when rotation has not started
s = s.replace(B,
'        if(t && t.expect_roller!=null){\n' +
'          M.__relayTurn={ exp:+t.expect_roller, last:(t.last_rr_seat==null?null:+t.last_rr_seat), at:Date.now() };\n' +
'        } else if(t){\n' +
'          // __KV_V292: relay has no rotation state yet — the derived opener is the actor\n' +
'          var op=M.opener || M.deriveOpener();\n' +
'          if(op){ M.opener=op; M.__relayTurn={ exp:op, last:null, at:Date.now() }; }\n' +
'        }');

// C: a refusal that names the expected seat updates the controller at once
s = s.replace(C,
'              if(ex>=1 && ex<=4){ M.__relayTurn={ exp:ex, last:(M.__relayTurn?M.__relayTurn.last:null), at:Date.now() }; }   // __KV_V292\n' +
'              log("relay expects P"+ex, "#caa64c");');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
