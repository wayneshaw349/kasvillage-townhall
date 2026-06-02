const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

// The Resume form does: const frostAddr = match.frostAddress || '';
// If empty, generateFrostAddress fires and creates a NEW agreement.
// Fix: if frostAddress missing from main record, query Arweave directly for it.

const anchor = "const frostAddr = match.frostAddress || '';";
if (!s.includes(anchor)) { console.log('Anchor not found'); process.exit(1); }
if (s.includes('Resume-FrostFix')) { console.log('Already patched'); process.exit(0); }

const fix = `let frostAddr = match.frostAddress || '';
                          // [Resume-FrostFix] If frostAddress missing, query Arweave tags directly
                          if (!frostAddr || frostAddr.length < 20) {
                            try {
                              const _fGql = '{ transactions(first: 5, tags: [{ name: "KV-AgreementId", values: ["' + manualAgrId + '"] }], sort: HEIGHT_DESC) { edges { node { tags { name value } } } } }';
                              const _fResp = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: _fGql }) });
                              const _fJson = await _fResp.json();
                              for (const _edge of (_fJson?.data?.transactions?.edges || [])) {
                                const _tags = {};
                                (_edge?.node?.tags || []).forEach(t => { _tags[t.name] = t.value; });
                                if (_tags['KV-FrostAddress'] && _tags['KV-FrostAddress'].length > 20) {
                                  frostAddr = _tags['KV-FrostAddress'];
                                  console.log('[Resume-FrostFix] Got FROST addr from Arweave tag:', frostAddr.slice(0, 30));
                                  break;
                                }
                              }
                            } catch (e) { console.warn('[Resume-FrostFix] Arweave query failed:', e); }
                          }
                          if (!frostAddr || frostAddr.length < 20) {
                            Alert.alert('Missing FROST Address', 'Could not find FROST address for this agreement on Arweave. Try again in a few minutes.');
                            setIsLoading(false); return;
                          }`;

s = s.split(anchor).join(fix);

fs.writeFileSync(f, s);
const count = (s.match(/Resume-FrostFix/g) || []).length;
console.log('Patched', count / 2, 'Resume paths with FROST address recovery');
console.log('Verify:', s.includes('Resume-FrostFix'));
