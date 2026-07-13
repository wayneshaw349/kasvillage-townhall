const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const norm = str => str.split('\n').join(EOL);

const marker = 'PARTIAL-GATE: require exactly the seller UTXO';
if (s.includes(marker)) { console.log('SKIP — already applied'); process.exit(0); }

// Insert a strict count+amount check right after the buyer-branch condition opens,
// before the alreadySent lookup. Only fire if the address holds exactly ONE UTXO
// (the seller's) at ~expectedSeller — no residue, no partial pool.
const a = norm("          if (role === 'buyer' && balance >= otherExpected && myExpected > 0) {\n            const sentKey = 'kv_frost_poll_sent_' + contract.agreementId;");

const b = norm(`          if (role === 'buyer' && balance >= otherExpected && myExpected > 0) {
            // PARTIAL-GATE: require exactly the seller UTXO (count===1, amount within 5%) — blocks residue false-trigger
            const _amts = frostUtxos.map((u: any) => Number(u.utxoEntry?.amount || '0'));
            const _okOne = _amts.length === 1 && Math.abs(_amts[0] - otherExpected) <= otherExpected * 0.05;
            if (!_okOne) {
              console.log('[FROST-Poll] Buyer send BLOCKED — expected 1 seller UTXO ~', otherExpected/1e8, 'but saw', _amts.map(a=>a/1e8), '(residue?) — not sending');
              return;
            }
            const sentKey = 'kv_frost_poll_sent_' + contract.agreementId;`);

const n = s.split(a).length - 1;
if (n === 1) { s = s.split(a).join(b); fs.writeFileSync(f, s); console.log('WROTE — buyer partial-send now requires exactly the seller UTXO (no residue trigger)'); }
else { console.log('NO WRITE — found ' + n + ' (expected 1); paste 1489/22 anchor again'); }
