// fix_orphan_retry.cjs — retry-on-orphan in _wrpcSubmit.
//
// "orphan where orphan is disallowed" = the node handling THIS submit hasn't
// seen the parent tx yet (load-balanced upstream, mempool sync gap). The tx is
// valid; it just arrived early. Fix: when the rejection mentions "orphan",
// wait and resubmit the SAME tx — the parent propagates within a second or
// two. Real rejections (mass, fees, prohibited term, double spend) don't say
// orphan and still fail immediately.
// Run from layer1 root:  node src\fix_orphan_retry.cjs
const fs = require("fs");
const P = "kaspa_rest_tx.ts";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("orphan-retry")) { console.log("already patched"); process.exit(0); }
let n = 0;
function rep(name, a, b, exp) {
  const f = s.split(a).length - 1;
  if (f !== exp) { console.error("ABORT [" + name + "]: expected " + exp + ", found " + f); process.exit(1); }
  s = s.split(a).join(b); n++; console.log("ok  [" + name + "]");
}
rep("orphan-retry",
`      if (resp.status === 422 || (resp.status === 400 && j.error)) {
        // Node/gate rejection is final — same result on any relay.
        return { error: String(j.error || bodyText.slice(0, 200)) };
      }`,
`      if (resp.status === 422 || (resp.status === 400 && j.error)) {
        const em = String(j.error || bodyText.slice(0, 200));
        // orphan-retry: parent tx not yet visible on the node that got this
        // submit (LB / mempool sync gap). The tx is fine — wait, resubmit.
        if (/orphan/i.test(em) && (_orphanTries = (_orphanTries || 0) + 1) <= 6) {
          console.log('[REST-TX] orphan (parent not propagated yet) — retry ' + _orphanTries + '/6 in 2s');
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        // Node/gate rejection is final — same result on any relay.
        return { error: em };
      }`, 1);
rep("orphan-var",
`  let lastErr = 'no relay reachable';
  for (const url of RELAYS) {`,
`  let lastErr = 'no relay reachable';
  let _orphanTries = 0;
  // orphan retries re-enter the loop; extend the iteration list so 'continue'
  // has somewhere to go: same relay repeated.
  const ATTEMPTS = [...RELAYS, ...Array(6).fill(RELAYS[0])];
  for (const url of ATTEMPTS) {`, 1);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (" + n + "). Metro reload, then PUBLISH again.");
