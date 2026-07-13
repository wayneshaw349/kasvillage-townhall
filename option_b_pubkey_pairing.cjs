const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const norm = str => str.split('\n').join(EOL);

const marker = 'OPTION-B: counterparty pubkey pasted directly';
if (s.includes(marker)) { console.log('SKIP — already applied'); process.exit(0); }

// Confirm deriveAddress is imported; if not, we'll fall back to no-address (still sets pubkey).
const hasDerive = /import[\s\S]{0,4000}\bderiveAddress\b/.test(s);

const a = norm("  const handleSetCounterparty = (addr: string) => {\n    setCounterpartyKaspaAddr(addr);\n    if (addr.length > 40 && (addr.startsWith('kaspa:') || addr.startsWith('kaspatest:'))) {");

const b = norm(`  const handleSetCounterparty = (addr: string) => {
    setCounterpartyKaspaAddr(addr);
    // OPTION-B: counterparty pubkey pasted directly (66 hex, real 02/03 parity) — no address guessing
    const _pk = (addr || '').trim().toLowerCase();
    if (/^0[23][0-9a-f]{64}$/.test(_pk)) {
      try {
        const _net = (contract.frostData?.network || 'testnet-10');
        const _xonly = _pk.slice(2);
        let _derivedAddr = '';
        try { _derivedAddr = deriveAddress(_xonly, _net as any); } catch (e) { console.warn('[OptionB] deriveAddress failed:', e); }
        console.log('[Neighbor][OptionB] Counterparty pubkey used directly:', _pk.slice(0,16), 'addr:', (_derivedAddr||'').slice(0,30));
        if (role === 'buyer') {
          setContract(prev => ({ ...prev, sellerPubkey: _pk, counterpartyPubkey: _pk }));
        } else {
          setContract(prev => ({ ...prev, buyerPubkey: _pk, counterpartyPubkey: _pk }));
        }
        if (_derivedAddr) { setCounterpartyKaspaAddr(_derivedAddr); setCounterpartyAddress(_derivedAddr); }
      } catch (e) { console.warn('[OptionB] pubkey branch failed:', e); }
      return;
    }
    if (addr.length > 40 && (addr.startsWith('kaspa:') || addr.startsWith('kaspatest:'))) {`);

const n = s.split(a).length - 1;
if (n === 1) {
  s = s.split(a).join(b);
  fs.writeFileSync(f, s);
  console.log('WROTE — Option B: pubkey pasted directly, address derived from it');
  console.log(hasDerive ? '  deriveAddress import: FOUND' : '  deriveAddress import: NOT FOUND — check tsc; may need to add it');
} else {
  console.log('NO WRITE — found ' + n + ' (expected 1); paste 1936/24 again');
}
