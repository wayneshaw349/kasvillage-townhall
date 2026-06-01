const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

const old = "frostData: frostAddr ? { address: frostAddr, network: 'testnet-10' } : undefined";
const count = (s.match(new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
if (count === 0) { console.log('Pattern not found'); process.exit(1); }

const newFrostData = "frostData: frostAddr ? (() => { let _fc = 0; try { for (let _i = 0; _i < 25; _i++) { const _a = deriveAggregateKey(iAmProposer ? myPk : proposerPk, iAmProposer ? counterPk : myPk, _i); const _ad = deriveAddress(_a.aggXOnly, 'testnet-10'); if (_ad === frostAddr) { _fc = _i; console.log('[Resume] Counter recovered:', _i); break; } } } catch(e) { console.warn('[Resume] Counter scan failed:', e); } return { address: frostAddr, network: 'testnet-10', frostCounter: _fc }; })() : undefined";

s = s.split(old).join(newFrostData);

fs.writeFileSync(f, s);
console.log('Patched', count, 'frostData assignments with counter recovery');
console.log('Verify:', s.includes('Counter recovered'));
