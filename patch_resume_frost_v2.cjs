const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

// Replace the "Missing FROST Address" block with derivation from pubkeys
const oldBlock = `if (!frostAddr || frostAddr.length < 20) {
                            Alert.alert('Missing FROST Address', 'Could not find FROST address for this agreement on Arweave. Try again in a few minutes.');
                            setIsLoading(false); return;
                          }`;

if (!s.includes(oldBlock)) { console.log('Block not found'); process.exit(1); }

const newBlock = `if (!frostAddr || frostAddr.length < 20) {
                            // Derive FROST address from pubkeys (both available from Arweave)
                            try {
                              const _bPk = match.pubkey || match.partyA?.pubkey || '';
                              const _cPk = match.counterpartyPubkey || match.KVCounterparty || '';
                              if (_bPk && _cPk) {
                                for (let _dc = 0; _dc < 25; _dc++) {
                                  const _da = deriveAggregateKey(_bPk, _cPk, _dc);
                                  const _dAddr = deriveAddress(_da.aggXOnly, 'testnet-10');
                                  const _dApi = wallet.network?.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
                                  try {
                                    const _dBr = await fetch(_dApi + '/addresses/' + _dAddr + '/balance');
                                    if (_dBr.ok) {
                                      const _dBal = Number((await _dBr.json()).balance || '0');
                                      if (_dBal > 0) { frostAddr = _dAddr; console.log('[Resume-Derive] Found funded FROST at counter', _dc, ':', _dAddr.slice(0, 30), _dBal / 1e8, 'KAS'); break; }
                                    }
                                  } catch {}
                                }
                              }
                            } catch (e) { console.warn('[Resume-Derive] Failed:', e); }
                            if (!frostAddr || frostAddr.length < 20) {
                              Alert.alert('Missing FROST Address', 'Could not find or derive FROST address. Check pubkeys and try again.');
                              setIsLoading(false); return;
                            }
                          }`;

s = s.split(oldBlock).join(newBlock);

fs.writeFileSync(f, s);
const count = (s.match(/Resume-Derive/g) || []).length;
console.log('Patched', count / 2, 'paths with FROST derivation fallback');
console.log('Verify:', s.includes('Resume-Derive'));
