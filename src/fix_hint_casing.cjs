// fix_hint_casing.cjs — SubmitReq is #[serde(rename_all = "camelCase")], so the
// relay reads payloadAddress; the wallet was sending payload_address -> None ->
// records never stored. Send BOTH spellings (primary submit + mirrors).
// Run from layer1 root:  node src\fix_hint_casing.cjs
const fs = require("fs");
const P = "kaspa_rest_tx.ts";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("payloadAddress:")) { console.log("already patched"); process.exit(0); }
let n = 0;
function rep(name, a, b, exp) {
  const f = s.split(a).length - 1;
  if (f !== exp) { console.error("ABORT [" + name + "]: expected " + exp + ", found " + f); process.exit(1); }
  s = s.split(a).join(b); n++; console.log("ok  [" + name + "]");
}
rep("primary-camel",
"        body: JSON.stringify({ transaction: restTx, allowOrphan: false, idHint, payload_address: (restTx && restTx.__payloadAddress) || '' }),",
"        body: JSON.stringify({ transaction: restTx, allowOrphan: false, idHint, payloadAddress: (restTx && restTx.__payloadAddress) || '', payload_address: (restTx && restTx.__payloadAddress) || '' }),", 1);
rep("mirror-camel",
"        const mBody = JSON.stringify({ transaction: restTx, allowOrphan: false, idHint, payload_address: (restTx && restTx.__payloadAddress) || '' });",
"        const mBody = JSON.stringify({ transaction: restTx, allowOrphan: false, idHint, payloadAddress: (restTx && restTx.__payloadAddress) || '', payload_address: (restTx && restTx.__payloadAddress) || '' });", 1);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (" + n + "). Reload app, PUBLISH once more to seed the relay records.");
