// fix_anchor_refetch.cjs — Fetch Anchors now also completes PARTIAL anchors.
// backfillAnchors only handles records with NO txid; a record stamped at
// release with just releaseTxId (no header yet) was skipped forever. Now it
// re-fetches the full anchor (DAA + utxoCommitment MuHash) for those while
// the tx is still in the live window.
const fs = require('fs');
const F = 'PhoneProofScreen.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_PHONE_LOCAL2')) { console.log('already patched'); process.exit(0); }

const A = "    try { const { backfillAnchors, loadChain } = require('./stat_records'); const _n = await backfillAnchors(20); console.log('[PhoneProof] anchors backfilled:', _n); setMyChain(await loadChain()); } catch (e) { console.log('[PhoneProof] anchor fetch failed:', e); }";
const B = `    try {
      const { backfillAnchors, loadChain, fetchAnchor, setAnchor } = require('./stat_records');
      const _n = await backfillAnchors(20);
      // KV_PHONE_LOCAL2: complete partial anchors (txid stamped, header missing)
      let _f = 0;
      const _chain: any[] = await loadChain();
      for (const _r of _chain) {
        const _a: any = _r && _r.anchor;
        if (_a && _a.releaseTxId && !_a.utxoCommitment) {
          const _full = await fetchAnchor(_a.releaseTxId, _r.network === 'mainnet' ? 'mainnet' : 'testnet-10');
          if (_full && (_full.utxoCommitment || _full.releaseDaaScore)) { await setAnchor(_r.agrId, _full); _f++; }
        }
      }
      console.log('[PhoneProof] anchors backfilled:', _n, 'headers refetched:', _f);
      setMyChain(await loadChain());
    } catch (e) { console.log('[PhoneProof] anchor fetch failed:', e); }`;

const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }
s = s.split(A).join(B);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: Fetch Anchors completes partial anchors (header + MuHash refetch)');
