// patch280_relay_turn.cjs — the enforcer asks the relay whose turn it is (v56 /turn) instead of
// deriving it locally. The relay's gate is what accepts or refuses moves, so its answer is the only
// one that matters. Local roll-math stays as a fallback when /turn is unavailable.
// Also: the bot kicker uses the same cached answer.
// SRC showcase_kascity279.html -> DST showcase_kascity280.html
const fs = require("fs");
const SRC = "showcase_kascity279.html";
const DST = "showcase_kascity280.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function must(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

const A1 = "  // ---- __KV_V277: chain-truth turn enforcer";
const A2 = '          var rx=M.__lastRollRx||{at:0};\n' +
'          exp=(closed || Date.now()-rx.at>12000) ? ((lastRoll.s%4)+1) : lastRoll.s;\n' +
'        } else if(M.opener){ exp=M.opener; }';

must(A1, 1, "A1 enforcer banner");
must(A2, 1, "A2 enforcer local derivation");

if (fails.length) {
  console.error("ABORT — anchors:\n" + fails.join("\n"));
  process.exit(1);
}

// poll /turn into M.__relayTurn
s = s.replace(A1,
'  // ---- __KV_V280: ask the relay whose turn it is (its gate is the acceptor) ----\n' +
'  (function(){\n' +
'    setInterval(async function(){\n' +
'      try{\n' +
'        if(!M.room || !M.started || M.halted) return;\n' +
'        var t=await ord("/api/game/room/"+M.room+"/turn");\n' +
'        if(t && t.expect_roller!=null){ M.__relayTurn={ exp:+t.expect_roller, last:(t.last_rr_seat==null?null:+t.last_rr_seat), at:Date.now() }; }\n' +
'      }catch(e){}\n' +
'    }, 2500);\n' +
'  })();\n\n' + A1);

// enforcer prefers the relay answer; a roller mid-decision is respected
s = s.replace(A2,
'          var rx=M.__lastRollRx||{at:0};\n' +
'          exp=(closed || Date.now()-rx.at>12000) ? ((lastRoll.s%4)+1) : lastRoll.s;\n' +
'          // __KV_V280: the relay gate is authoritative on who may roll next\n' +
'          var RT=M.__relayTurn;\n' +
'          if(RT && Date.now()-RT.at<15000){\n' +
'            if(closed || Date.now()-rx.at>12000) exp=RT.exp;\n' +
'            else if(RT.last!=null && RT.last!==lastRoll.s) exp=RT.exp;\n' +
'          }\n' +
'        } else if(M.__relayTurn && M.__relayTurn.exp){ exp=M.__relayTurn.exp;\n' +
'        } else if(M.opener){ exp=M.opener; }');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
