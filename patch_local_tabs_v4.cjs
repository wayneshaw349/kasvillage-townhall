// patch_local_tabs_v4.cjs — single-line anchors only (no \n joins, dodges CRLF mismatch).
// Assumes v3 already applied state/loader/load-on-open? NO — v3 aborted, nothing written.
// This redoes ALL edits from clean, every anchor a single line.
const fs = require('fs');
const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');
fs.writeFileSync(F + '.bak_localtabs', s);

function rep(oldStr, newStr, label) {
  const n = s.split(oldStr).length - 1;
  if (n !== 1) { console.error('ABORT ' + label + ' — count=' + n + ' (need 1)'); process.exit(1); }
  s = s.replace(oldStr, newStr);
  console.log('ok: ' + label);
}

// EDIT 1 — state (single line)
const OLD1 = `  const [inboxSort, setInboxSort] = useState<'recent'|'buyerHigh'|'sellerLow'|'name'>('recent');`;
const NEW1 = `  const [inboxSort, setInboxSort] = useState<'recent'|'buyerHigh'|'sellerLow'|'name'>('recent');
  const [activeTab, setActiveTab] = useState<'active'|'buyer'|'seller'>('active');
  const [localList, setLocalList] = useState<any[]>([]);
  const [localLoading, setLocalLoading] = useState(false);`;
rep(OLD1, NEW1, 'state');

// EDIT 2 — loader (single-line comment anchor)
const OLD2 = `  // === TX TEMPLATE + DELAYED R FLOW ===`;
const NEW2 = `  // === LOCAL AGREEMENTS (source of truth for the visible list) ===
  const loadLocalList = async () => {
    setLocalLoading(true);
    try {
      const _mod = await import('./local_agreements');
      const _all = await _mod.listActiveAgreements();
      const _rows: any[] = [];
      for (const _a of _all) {
        if (!_a || !_a.agrId) continue;
        if (_a.step === 'aborted') continue;
        let _phase = '', _bal = 0, _route = '', _b = 0, _se = 0, _frost = '';
        try {
          const _ph = await _mod.derivePhase(_a.agrId);
          _phase = _ph.phase; _bal = _ph.balanceKas; _b = _ph.buyerKas; _se = _ph.sellerKas; _frost = _ph.frostAddress;
          _route = _mod.routeForPhase(_ph.phase);
        } catch (e) { console.warn('[LocalList] derivePhase failed', _a.agrId, e); _b = Number(_a.buyerAmountSompi || 0) / 1e8; _se = Number(_a.sellerAmountSompi || 0) / 1e8; }
        const _role = _a.origin === 'mine' ? 'buyer' : (_a.role || 'seller');
        _rows.push({ agrId: _a.agrId, role: _role, phase: _phase || _a.step || 'proposed', route: _route, balanceKas: _bal, buyerKas: _b, sellerKas: _se, frostAddress: _frost, network: _a.network || 'testnet-10', frostCounter: _a.frostCounter, description: _a.description || _a.agrId, updatedAt: _a.updatedAt || _a.createdAt || 0 });
      }
      _rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      setLocalList(_rows);
      console.log('[LocalList] Loaded', _rows.length, 'local agreements');
    } catch (e) { console.warn('[LocalList] load failed:', e); }
    setLocalLoading(false);
  };

  const resumeLocal = async (row: any) => {
    try {
      if (row.route === 'release') {
        setContract({ agreementId: row.agrId, multisigAddress: row.frostAddress, frostData: { address: row.frostAddress, network: row.network, frostCounter: row.frostCounter }, itemPriceKas: row.buyerKas, sellerCommitmentKas: row.sellerKas } as any);
        setRole(row.role); setStep(5);
        Alert.alert('Resumed at Release', 'Escrow holds ' + (row.balanceKas || 0).toFixed(2) + ' KAS.');
        return;
      }
      if (row.route === 'done') { Alert.alert('Already Complete', 'This agreement is finished (escrow ' + (row.balanceKas || 0).toFixed(2) + ' KAS).'); return; }
      setContract({ agreementId: row.agrId, multisigAddress: row.frostAddress, frostData: { address: row.frostAddress, network: row.network, frostCounter: row.frostCounter }, itemPriceKas: row.buyerKas, sellerCommitmentKas: row.sellerKas, buyerPubkey: '', sellerPubkey: '' } as any);
      setRole(row.role); setStep(row.route === 'poll' ? 3 : 4);
      Alert.alert('Resuming — ' + String(row.phase).replace('_', ' '), 'Escrow at ' + (row.balanceKas || 0).toFixed(2) + ' KAS. Funding continues automatically.');
    } catch (e) { console.warn('[LocalList] resume failed:', e); Alert.alert('Error', e instanceof Error ? e.message : 'Resume failed'); }
  };

  // === TX TEMPLATE + DELAYED R FLOW ===`;
rep(OLD2, NEW2, 'loader');

// EDIT 3 — load on Join open (single line)
const OLD3 = `                  onPress={() => { setAgreementType('join'); loadInbox(); }}`;
const NEW3 = `                  onPress={() => { setAgreementType('join'); loadInbox(); loadLocalList(); }}`;
rep(OLD3, NEW3, 'load-on-open');

// EDIT 4 — kill chip render: flip the guard on the SINGLE line 3597.
const OLD4 = `                {inboxAgreements.length > 0 && (`;
const NEW4 = `                {false && inboxAgreements.length > 0 && (`;
rep(OLD4, NEW4, 'kill-chips');

// EDIT 5 — inject tabs+list, anchor single-line comment.
const OLD5 = `                {/* PASTE BUYER PROPOSAL */}`;
const NEW5 = `                {/* LOCAL-TABS: source of truth is local_agreements. Arweave inbox still runs in background. */}
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                  {[{k:'active',l:'Active'},{k:'buyer',l:'Buyer'},{k:'seller',l:'Seller'}].map(t => (
                    <TouchableOpacity key={t.k} onPress={() => setActiveTab(t.k as any)} style={{ backgroundColor: activeTab === t.k ? '#4f46e5' : '#e5e7eb', borderRadius: 6, paddingHorizontal: 14, paddingVertical: 6 }}>
                      <Text style={{ fontSize: 11, color: activeTab === t.k ? '#fff' : '#374151', fontWeight: activeTab === t.k ? 'bold' : 'normal' }}>{t.l}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity onPress={loadLocalList} style={{ marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 11, color: '#4f46e5', fontWeight: '600' }}>{localLoading ? '...' : 'Refresh'}</Text>
                  </TouchableOpacity>
                </View>
                {(() => {
                  const _f = localList.filter(r => activeTab === 'active' ? true : r.role === activeTab);
                  if (_f.length === 0) return (<View style={{ backgroundColor: '#f5f5f4', borderRadius: 8, padding: 16, alignItems: 'center', marginBottom: 8 }}><Text style={{ color: '#78716c', fontSize: rs.font(11) }}>{localLoading ? 'Loading...' : 'No ' + (activeTab === 'active' ? 'active' : activeTab) + ' agreements'}</Text></View>);
                  return _f.map((r: any, i: number) => (
                    <TouchableOpacity key={r.agrId + i} onPress={() => resumeLocal(r)} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 12, padding: 12, marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: rs.font(12), fontWeight: 'bold', color: '#3730a3', flex: 1 }} numberOfLines={1}>{r.description}</Text>
                        <View style={{ backgroundColor: r.role === 'buyer' ? '#dcfce7' : '#dbeafe', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 6 }}>
                          <Text style={{ fontSize: rs.font(9), fontWeight: 'bold', color: r.role === 'buyer' ? '#166534' : '#1e40af' }}>{r.role.toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: rs.font(10), color: '#6366f1', marginTop: 4 }}>{String(r.phase).replace(/_/g, ' ')} - {(r.balanceKas || 0).toFixed(2)} KAS in escrow</Text>
                      <Text style={{ fontSize: rs.font(9), color: '#78716c', marginTop: 2 }}>{r.agrId}  -  buyer {r.buyerKas} / seller {r.sellerKas} KAS</Text>
                    </TouchableOpacity>
                  ));
                })()}
                {/* PASTE BUYER PROPOSAL */}`;
rep(OLD5, NEW5, 'tabs-inject');

// EDIT 6 — hide Arweave inbox cards (single line)
const OLD6 = `                {[...inboxAgreements].sort((a, b) => {`;
const NEW6 = `                {false && [...inboxAgreements].sort((a, b) => {`;
rep(OLD6, NEW6, 'hide-arweave-cards');

fs.writeFileSync(F, s);
console.log('patched ok - 6 edits');
