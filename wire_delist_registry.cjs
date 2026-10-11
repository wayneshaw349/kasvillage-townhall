// wire_delist_registry.cjs — registry-targeted delist for announce-based lanes (games).
// Adds delistFromRegistry(owner, head, kind): posts a signed {k:'delist', d:{head}}
// record to the kind's registry (~1 KAS dust, same rail as announceToRegistry).
// Publisher-key-only: readers match the delist's signer (o) to the announce's signer.
const fs = require('fs');
const F = 'payload_publish.ts';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('delistFromRegistry')) { console.log('already patched'); process.exit(0); }

const A = "// DELIST: payload flag now; pledge withdrawal (sweep) is the hard delist.";
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }

const FN = A + `
// ---------------------------------------------------------------------------
// REGISTRY DELIST (games and other announce-based lanes): a signed record on
// the registry naming the head. Readers hide the announce when the delist's
// signer matches the announce's signer. Pledge-independent by design.
// ---------------------------------------------------------------------------

export async function delistFromRegistry(owner: OwnerKeys, head: string, kind: string = 'game') {
  const rec = signRecord({ v: 1, k: 'delist', t: Date.now(), o: owner.pubkeyHex, d: { head } } as any, owner.privateKeyHex);
  const regAddr = registryAddress(kind, owner.network);
  const res = await sendKaspaViaRest({
    senderAddress: owner.address,
    recipientAddress: regAddr,
    amountSompi: ANNOUNCE_SOMPI,
    privateKeyHex: owner.privateKeyHex,
    network: owner.network,
    payload: buildPayloadHex(rec),
  });
  console.log('[Delist]', head.slice(0, 10), '-> registry', regAddr.slice(0, 24));
  return { ...res, registryAddr: regAddr };
}
`;
s = s.replace(A, FN);
if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: delistFromRegistry(owner, head, kind) added');
