const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const norm = str => str.split('\n').join(EOL);

const marker = 'PASTE-ONLY: buyer uses deterministic counter-0 address';
if (s.includes(marker)) { console.log('SKIP — already applied'); process.exit(0); }

// Replace the buyer L1 counter-scan (1779-1793) with a single deterministic derivation (no counter = counter-0 = qppw56)
const a = norm(`          // L1 check: find first clean FROST address (counter 0,1,2...)
          let frostData: any = null;
          const _frostApi = network.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
          for (let _n = 0; _n < 25; _n++) {
            const _candidate = deriveFrostAddressLocal({ pubkeyA: contract.buyerPubkey, pubkeyB: contract.sellerPubkey, network, agreementId, frostCounter: _n });
            try {
              const _br = await fetch(_frostApi + '/addresses/' + _candidate.address + '/balance');
              if (_br.ok) {
                const _bd = await _br.json();
                if (BigInt(_bd.balance || '0') === 0n) { frostData = _candidate; console.log('[FROST-L1] Clean at nonce', _n, _candidate.address.slice(0,30)); break; }
                else { console.log('[FROST-L1] Nonce', _n, 'has', Number(BigInt(_bd.balance || '0'))/1e8, 'KAS, skipping'); }
              } else { frostData = _candidate; break; }
            } catch { frostData = _candidate; break; }
          }
          if (!frostData) frostData = deriveFrostAddressLocal({ pubkeyA: contract.buyerPubkey, pubkeyB: contract.sellerPubkey, network,agreementId, frostCounter: 0 });`);

const b = norm(`          // PASTE-ONLY: buyer uses deterministic counter-0 address (matches seller's canon derivation).
          // Never scan for a "clean" address — the seller funds counter-0, so scanning away from it splits the escrow.
          let frostData: any = deriveFrostAddressLocal({ pubkeyA: contract.buyerPubkey, pubkeyB: contract.sellerPubkey, network, agreementId });
          console.log('[FROST-Buyer] Deterministic FROST (no scan):', frostData.address.slice(0,30));`);

const n = s.split(a).length - 1;
if (n === 1) { s = s.split(a).join(b); fs.writeFileSync(f, s); console.log('WROTE — buyer now uses deterministic counter-0 FROST address'); }
else if (n === 0) { console.log('NO WRITE — block not matched (whitespace drift). Paste 1778/22 again.'); }
else { console.log('NO WRITE — found ' + n + ' (expected 1)'); }
