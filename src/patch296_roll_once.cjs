// patch296_roll_once.cjs — 295's chain-roll re-fired whenever the previous attempt was not acked,
// walking the token around the board. Fix:
//   * at most one chain-roll attempt per chain head (M.head), ever
//   * the token is NOT moved locally; the relay's acceptance + snapshot adoption place it
//   * if an attempt is refused, stand down for that head instead of retrying
// SRC showcase_kascity295.html -> DST showcase_kascity296.html
const fs = require("fs");
const SRC = "showcase_kascity295.html";
const DST = "showcase_kascity296.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const A = "      // B: our seat has not rolled -> roll from here, with the relay's dice\n" +
"      if(!st.rolled){";
const c = s.split(A).length - 1;
if (c !== 1) {
  console.error("ABORT — anchor found " + c + " times (expected 1). Is 295 applied?");
  process.exit(1);
}

// one attempt per head
s = s.replace(A,
"      // B: our seat has not rolled -> roll from here, with the relay's dice\n" +
"      if(!st.rolled){\n" +
"        // __KV_V296: one attempt per chain head; never retry blindly\n" +
"        var __h=(m.head!=null?m.head:m.logN)||0;\n" +
"        if(m.__rollTried===__h) return;");

// mark the head as tried, and stop moving the token locally
const B = "          window.KV_LOG && window.KV_LOG(\"turn: P\"+exp+\" rolls \"+total+\" (chain)\",\"#9cd87c\");\n" +
"          // move the token so the snapshot we publish is correct\n" +
"          var f2=flags(), from=f2[\"p\"+exp];\n" +
"          if(from!=null && window.KV_SETSTATE){\n" +
"            var to=((from+total)%40+40)%40;\n" +
"            window.__KV_CTL_WRITE=1;\n" +
"            window.KV_SETSTATE(\"p\"+exp, to);\n" +
"            window.__KV_CTL_WRITE=0;\n" +
"          }\n" +
"          if(window.KV_MOVE) window.KV_MOVE(exp,\"roll\",total);";

if (s.split(B).length - 1 === 1) {
  s = s.replace(B,
"          m.__rollTried=__h;   // __KV_V296: this head has had its attempt\n" +
"          window.KV_LOG && window.KV_LOG(\"turn: P\"+exp+\" rolls \"+total+\" (chain)\",\"#9cd87c\");\n" +
"          // __KV_V296: the token is placed by the accepted move's snapshot, not speculatively\n" +
"          if(window.KV_MOVE) window.KV_MOVE(exp,\"roll\",total);");
} else {
  console.error("ABORT — 295 roll body not found as expected");
  process.exit(1);
}

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
