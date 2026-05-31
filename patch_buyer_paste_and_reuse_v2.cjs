// patch_buyer_paste_and_reuse_v2.cjs
const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');
const NL = s.includes('\r\n') ? '\r\n' : '\n';
const n = (str) => str.replace(/\n/g, NL);
let fixes = 0;

// ═══════════════════════════════════════════════════════════════
// FIX 1: Buyer step 5 — add TextInput for seller response
// Replace clipboard-only "Paste Seller Response" button with
// TextInput + Process button
// ═══════════════════════════════════════════════════════════════

const FIX1_OLD = n(`                      <TouchableOpacity onPress={processSellerResponse} style={{ backgroundColor: '#4f46e5', borderRadius: 8, padding: 14, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{'Paste Seller Response'}</Text>
                      </TouchableOpacity>`);

const FIX1_NEW = n(`                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#4f46e5', marginTop: 8, marginBottom: 4 }}>Paste Seller Response</Text>
                      <TextInput
                        style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#a5b4fc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 11, fontFamily: 'monospace', color: '#1c1917', minHeight: 60, marginBottom: 8 }}
                        placeholder="Paste seller response here (base64)..."
                        placeholderTextColor="#a8a29e"
                        multiline
                        onChangeText={(txt) => { if (txt.trim().length > 20) setSellerResponseB64(txt.trim()); }}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity onPress={async () => {
                        // Use pasted text from state, or fallback to clipboard
                        if (sellerResponseB64 && sellerResponseB64.length > 20) {
                          // Temporarily set clipboard so processSellerResponse reads it
                          try { await Clipboard.setStringAsync(sellerResponseB64); } catch {}
                        }
                        processSellerResponse();
                      }} style={{ backgroundColor: '#4f46e5', borderRadius: 8, padding: 14, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{'Process Seller Response'}</Text>
                      </TouchableOpacity>`);

if (s.includes(FIX1_OLD)) {
  s = s.replace(FIX1_OLD, FIX1_NEW);
  fixes++;
  console.log('FIX 1: Buyer paste field ✓');
} else console.log('FIX 1: SKIP — anchor not found');

// ═══════════════════════════════════════════════════════════════
// FIX 2: Seller — query Arweave directly for frostAddress
// before the reuse check (don't rely on inbox object)
// Insert before "[Seller-Reuse] FROST reused" block
// ═══════════════════════════════════════════════════════════════

const FIX2_OLD = n(`          // FROST REUSE: if Arweave/TownHall has frostAddress with funds, find matching counter
          const agrFrostAddr = agreement.frostAddress || '';`);

const FIX2_NEW = n(`          // FROST REUSE: query Arweave directly for buyer's proposal frostAddress
          let agrFrostAddr = agreement.frostAddress || '';
          if (!agrFrostAddr || agrFrostAddr.length < 20) {
            try {
              const _frostGql = '{ transactions(first: 1, tags: [{ name: "KV-AgreementId", values: ["' + agrId + '"] }, { name: "KV-Status", values: ["Proposed"] }]) { edges { node { tags { name value } } } } }';
              const _frostResp = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: _frostGql }) });
              const _frostJson = await _frostResp.json();
              const _frostTags = _frostJson?.data?.transactions?.edges?.[0]?.node?.tags;
              if (_frostTags) {
                const _ftm: any = {};
                _frostTags.forEach((t: any) => { _ftm[t.name] = t.value; });
                if (_ftm['KV-FrostAddress']) {
                  agrFrostAddr = _ftm['KV-FrostAddress'];
                  console.log('[Seller-Reuse] Got frostAddress from Arweave proposal:', agrFrostAddr.slice(0, 30));
                }
              }
            } catch (e) { console.warn('[Seller-Reuse] Arweave frost query failed:', e); }
          }`);

if (s.includes(FIX2_OLD)) {
  s = s.replace(FIX2_OLD, FIX2_NEW);
  fixes++;
  console.log('FIX 2: Arweave direct frostAddress query ✓');
} else console.log('FIX 2: SKIP — anchor not found');

// ═══════════════════════════════════════════════════════════════
// WRITE + VERIFY
// ═══════════════════════════════════════════════════════════════
fs.writeFileSync(f, s);
console.log('\n=== ' + fixes + '/2 fixes ===');
const v = fs.readFileSync(f, 'utf8');
console.log('Buyer paste field:', v.includes('Paste seller response here') ? '✓' : '✗');
console.log('Process button:', v.includes('Process Seller Response') ? '✓' : '✗');
console.log('Arweave frost query:', v.includes('Got frostAddress from Arweave proposal') ? '✓' : '✗');
