// patch259_apply_once.cjs — drain applies a remote move ONCE; click-retry + force-adopt fuse recover
// SRC showcase_kascity258.html -> DST showcase_kascity259.html
const fs = require("fs");
const SRC = "showcase_kascity258.html";
const DST = "showcase_kascity259.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const A = 'if(M.assertN===1 || M.assertN%3===0){ M.applying=m; applyRemote(m);';
const B = 'if(M.assertN===1){ M.applying=m; applyRemote(m);';

const c = s.split(A).length - 1;
if (c !== 1) {
  console.error("ABORT — anchor found " + c + " times (expected 1)");
  process.exit(1);
}

s = s.replace(A, B);
fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
