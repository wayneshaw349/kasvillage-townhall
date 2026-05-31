// patch_frost_guards_v2.cjs — handles \r\n line endings
const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');
const NL = s.includes('\r\n') ? '\r\n' : '\n';
const n = (str) => str.replace(/\n/g, NL);
let fixes = 0;

// FIX A1+A2: MAX_COUNTER 10→25
if (s.includes('_n < 10')) { s = s.replace('_n < 10', '_n < 25'); fixes++; console.log('A1: buyer 25 ✓'); }
if (s.includes('_sc < 10')) { s = s.replace('_sc < 10', '_sc < 25'); fixes++; console.log('A2: seller 25 ✓'); }

// FIX B: FROST-Poll — UTXO count + amount guard
const B_OLD = n(
`        // Check FROST address balance
        const balResp = await fetch(apiBase + '/addresses/' + contract.multisigAddress + '/balance');
        if (!balResp.ok || cancelled) return;
        const balData = await balResp.json();
        const balance = Number(balData.balance || '0');

        if (balance >= expectedTotal && expectedTotal > 0) {
          console.log('[FROST-Poll] Balance:', balance / 1e8, 'KASPA, expected:', expectedTotal / 1e8);
          console.log('[FROST-Poll] Both parties confirmed! Advancing to step 4');
          if (!cancelled) {
            setBuyerLocked(true);
            setSellerLocked(true);
            setStep(4);
            // Update FROST active list
            updateFrostEntry(contract.agreementId || '', { step: 4 });
          }
          return;
        }`);

const B_NEW = n(
`        // Check FROST UTXOs (not balance — blocks stale-fund false positive)
        const utxoResp = await fetch(apiBase + '/addresses/' + contract.multisigAddress + '/utxos');
        if (!utxoResp.ok || cancelled) return;
        const frostUtxos = await utxoResp.json();
        if (!Array.isArray(frostUtxos)) return;
        const balance = frostUtxos.reduce((sum, u) => sum + Number(u.utxoEntry?.amount || '0'), 0);
        const utxoCount = frostUtxos.length;

        if (balance >= expectedTotal && expectedTotal > 0) {
          // GUARD: exactly 2 UTXOs (buyer + seller collateral)
          if (utxoCount !== 2) {
            console.log('[FROST-Poll] Balance:', balance / 1e8, 'but', utxoCount, 'UTXOs (need 2) — stale funds, skipping');
            return;
          }
          // GUARD: amounts must match expected buyer/seller ±5%
          const sortedA = frostUtxos.map(u => Number(u.utxoEntry?.amount || '0')).sort((a, b) => a - b);
          const sortedE = [expectedBuyer, expectedSeller].sort((a, b) => a - b);
          if (Math.abs(sortedA[0] - sortedE[0]) > sortedE[0] * 0.05 || Math.abs(sortedA[1] - sortedE[1]) > sortedE[1] * 0.05) {
            console.log('[FROST-Poll] UTXOs', sortedA.map(a => a / 1e8), '!= expected', sortedE.map(a => a / 1e8), '— mismatch, skipping');
            return;
          }
          console.log('[FROST-Poll] Balance:', balance / 1e8, 'UTXOs:', utxoCount, '✓ amounts match — advancing to step 4');
          if (!cancelled) {
            setBuyerLocked(true);
            setSellerLocked(true);
            setStep(4);
            updateFrostEntry(contract.agreementId || '', { step: 4 });
          }
          return;
        }`);

if (s.includes(B_OLD)) { s = s.replace(B_OLD, B_NEW); fixes++; console.log('B: UTXO guard ✓'); }
else { console.log('B: ANCHOR NOT FOUND'); console.log('Looking for:', JSON.stringify(B_OLD.slice(0, 80))); console.log('File has:', JSON.stringify(s.slice(s.indexOf('Check FROST address') - 5, s.indexOf('Check FROST address') + 80))); }

// FIX C: Partial-balance log
const C_OLD = n(
`        // Partial balance: one party sent, auto-send ours if needed
        if (balance > 0 && balance < expectedTotal) {
          console.log('[FROST-Poll] Partial balance:', balance / 1e8, 'KASPA');`);

const C_NEW = n(
`        // Partial balance: one party sent, auto-send ours if needed
        if (balance > 0 && balance < expectedTotal && utxoCount >= 1) {
          console.log('[FROST-Poll] Partial balance:', balance / 1e8, 'UTXOs:', utxoCount);`);

if (s.includes(C_OLD)) { s = s.replace(C_OLD, C_NEW); fixes++; console.log('C: partial log ✓'); }
else console.log('C: skip (non-critical)');

fs.writeFileSync(f, s);
console.log('\n=== ' + fixes + '/4 fixes ===');
console.log('UTXO guard:', s.includes('utxoCount !== 2') ? '✓' : '✗');
console.log('Counter 25:', (s.includes('_n < 25') && s.includes('_sc < 25')) ? '✓' : '✗');
console.log('Amount match:', s.includes('mismatch, skipping') ? '✓' : '✗');
