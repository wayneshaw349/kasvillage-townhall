// patch_receipt_lookup.cjs — release-as-receipt lookup (display-only, no fund path)
const fs = require('fs');
const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');
fs.writeFileSync(F + '.bak', s);

function rep(oldStr, newStr, label) {
  const n = s.split(oldStr).length - 1;
  if (n !== 1) { console.error('ABORT ' + label + ' — count=' + n + ' (need 1)'); process.exit(1); }
  s = s.replace(oldStr, newStr);
  console.log('ok: ' + label);
}

// EDIT 1 — terminal-status fallback before the Not Found alert
const OLD1 = `Alert.alert('Not Found', 'Agreement not found on Arweave. It may still be indexing — try again in 1-2 minutes.');`;
const NEW1 = `// RECEIPT-LOOKUP: not an open proposal — check for a terminal inscription (completed trade)
                          try {
                            const _tq = '{ transactions(first: 1, tags: [{ name: "KV-AgreementId", values: ["' + manualAgrId + '"] }, { name: "KV-Status", values: ["Released","Refund","Reclaimed","Deadlocked"] }], sort: HEIGHT_DESC) { edges { node { id tags { name value } } } } }';
                            const _tr = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: _tq }) });
                            const _tj = _tr.ok ? await _tr.json() : null;
                            const _tn = _tj?.data?.transactions?.edges?.[0]?.node || null;
                            if (_tn) {
                              const _tm = {}; (_tn.tags || []).forEach((t) => { _tm[t.name] = t.value; });
                              setManualLookupResult({ agreementId: manualAgrId, _terminal: true, _status: _tm['KV-Status'] || 'Complete', _receiptTx: _tn.id, pubkey: _tm['KV-Pubkey'] || '', counterpartyPubkey: _tm['KV-Counterparty'] || '', description: _tm['KV-Description'] || '', frostAddress: _tm['KV-FrostAddress'] || '', network: _tm['KV-Network'] || 'testnet-10', buyerAmountSompi: parseInt(_tm['KV-BuyerAmount'] || '0'), sellerAmountSompi: parseInt(_tm['KV-SellerAmount'] || '0'), amount_sompi: parseInt(_tm['KV-Amount'] || '0') });
                              console.log('[Receipt] Terminal inscription:', _tm['KV-Status'], (_tn.id || '').slice(0, 16));
                              setInboxLoading(false); return;
                            }
                          } catch (e) { console.warn('[Receipt] Terminal lookup failed:', e); }
                          Alert.alert('Not Found', 'No open proposal or completed record for that ID on Arweave. It may still be indexing — try again in 1-2 minutes.');`;
rep(OLD1, NEW1, 'terminal-fallback');

// EDIT 2 — receipt render + gate the accept UI to non-terminal only
const OLD2 = `{manualLookupResult && (`;
const NEW2 = `{manualLookupResult && manualLookupResult._terminal && (
                    <View style={{ backgroundColor: '#f0fdf4', borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#86efac' }}>
                      <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: '#166534' }}>Receipt — {manualLookupResult._status}</Text>
                      <Text style={{ fontSize: rs.font(11), color: '#15803d', marginTop: 4 }}>{manualLookupResult.description || manualLookupResult.agreementId}</Text>
                      <Text style={{ fontSize: rs.font(10), color: '#166534', marginTop: 4 }}>Total: {((manualLookupResult.amount_sompi || ((manualLookupResult.buyerAmountSompi || 0) + (manualLookupResult.sellerAmountSompi || 0))) || 0) / 1e8} KAS</Text>
                      <Text style={{ fontSize: rs.font(10), color: '#166534' }}>  Buyer: {(manualLookupResult.buyerAmountSompi || 0) / 1e8} KAS</Text>
                      <Text style={{ fontSize: rs.font(10), color: '#166534' }}>  Seller: {(manualLookupResult.sellerAmountSompi || 0) / 1e8} KAS</Text>
                      <Text style={{ fontSize: rs.font(10), color: '#15803d', marginTop: 4 }}>FROST: {(manualLookupResult.frostAddress || '').slice(0, 30)}...</Text>
                      <Text selectable style={{ fontSize: rs.font(9), fontFamily: 'monospace', color: '#15803d', marginTop: 4 }}>Arweave: {manualLookupResult._receiptTx}</Text>
                      <Text style={{ fontSize: rs.font(9), color: '#78716c', marginTop: 6 }}>Complete. Read-only — nothing to sign.</Text>
                      <TouchableOpacity onPress={() => { setManualLookupResult(null); setManualAgrId(''); }} style={{ backgroundColor: '#e5e7eb', borderRadius: 8, padding: 8, marginTop: 8, alignItems: 'center' }}>
                        <Text style={{ fontSize: rs.font(11), color: '#374151', fontWeight: '600' }}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {manualLookupResult && !manualLookupResult._terminal && (`;
rep(OLD2, NEW2, 'receipt-render');

fs.writeFileSync(F, s);
console.log('patched ok - 2 edits');
