// wire_scan_proof.cjs — the Counterparty Pubkey bar runs on the KASPA CHAIN.
// Generate Proof: scanCounterparty(pubkey) - no Arweave, no cooperation from
// the party being scanned. The existing tally card renders the ScanResult.
// Verify: re-runs the scan fresh from chain and compares tallies.
// The old Arweave prover path is kept for any old proof objects.
const fs = require('fs');
const F = 'PhoneProofScreen.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_SCAN_PROOF')) { console.log('already patched'); process.exit(0); }

const edits = [
  // 1. Generate: chain scan instead of Arweave prover
  [
`    try {
      const myPk = (await SecureStore.getItemAsync('kaspa_pubkey')) || 'anon';
      const p = await generateCounterpartyProof(pk, myPk);
      setProof(p);
    } catch (e: any) {
      setError(e?.message || 'Generation failed (Arweave unreachable?)');
    } finally { setLoading(false); }`,
`    try {
      // KV_SCAN_PROOF: chain-first background check (Arweave prover dead in RN)
      if (!/^[0-9a-fA-F]{64,66}$/.test(pk)) throw new Error('Enter their pubkey (64/66 hex) - it is in any proposal they send you');
      const { scanCounterparty } = require('./counterparty_scan');
      const _scan: any = await scanCounterparty(pk, 'testnet-10', 40, false);
      const _p: any = {
        completed: _scan.settled,
        deadlocks: _scan.deadlocked,
        total_agreements: _scan.total,
        p_complete: _scan.pSettled || 0,
        total_volume_sompi: Number(_scan.payoutsReceived || 0),
        evidence_hash: 'L1 scan ' + String(_scan.address || '').slice(0, 28) + (_scan.truncated ? ' (truncated - lower bound)' : ''),
        evidence: (_scan.escrows || []).map((e: any) => ({ agrId: 'escrow ' + String(e.escrowAddr || '').slice(10, 26), status: String(e.resolution || ''), amount: Number(e.fundedTotal || 0), arweaveTx: String(e.resolutionTxId || ''), role: '' })),
        _scan: true, _pk: pk,
      };
      setProof(_p);
    } catch (e: any) {
      setError(e?.message || 'Chain scan failed');
    } finally { setLoading(false); }`,
  ],
  // 2. Verify: fresh re-scan + tally compare for scan-proofs
  [
`    setLoading(true);
    try {
      const r = await verifyCounterpartyProof(proof);
      setVerified(r);`,
`    setLoading(true);
    try {
      let r: any;
      if ((proof as any)._scan) {
        // KV_SCAN_PROOF: verify = independent re-scan of the chain, compare tallies
        const { scanCounterparty } = require('./counterparty_scan');
        const _re: any = await scanCounterparty((proof as any)._pk, 'testnet-10', 40, false);
        const _match = _re.settled === proof.completed && _re.deadlocked === proof.deadlocks && _re.total === proof.total_agreements;
        r = { valid: _match, reason: _match ? undefined : 'fresh scan differs (window moved or new activity): settled ' + _re.settled + ' vs ' + proof.completed + ', deadlocked ' + _re.deadlocked + ' vs ' + proof.deadlocks };
      } else {
        r = await verifyCounterpartyProof(proof);
      }
      setVerified(r);`,
  ],
  // 3. stale Arweave description
  [
`            Tally any user's completed trades, deadlocks, and P(complete) directly from Arweave.
            No TownHall needed. Every number is backed by a re-fetchable transaction.`,
`            Background-check any user straight from the Kaspa chain: enter their pubkey (it is in
            any proposal they send) and tally completed trades, deadlocks, and P(complete). No
            cooperation needed - every number is a re-fetchable transaction in the live window.`,
  ],
];

let ok = true;
for (let i = 0; i < edits.length; i++) {
  const c = s.split(edits[i][0]).length - 1;
  if (c !== 1) { console.error('ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; }
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const [a, b] of edits) s = s.split(a).join(b);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: Counterparty bar scans the chain (generate + verify + wording)');
