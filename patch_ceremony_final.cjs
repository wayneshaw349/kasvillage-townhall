// patch_ceremony_final.cjs — exact anchors from pasted NeighborAgreement.tsx
const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');
const NL = s.includes('\r\n') ? '\r\n' : '\n';
const n = (str) => str.replace(/\n/g, NL);
let fixes = 0;

// FIX 1+2: sellerResponseB64 state + setSellerResponseB64 — already present from partial patch
if (s.includes('sellerResponseB64')) { fixes++; console.log('FIX 1+2: state+store already present ✓'); }

// ═══════════════════════════════════════════════════════════════
// FIX 3: Seller "Copy Response & Send to Buyer" button
// Insert AFTER the "Seller k is born" text line
// ═══════════════════════════════════════════════════════════════
const A3 = "{'Seller k is born and destroyed within the sign call (~ms)'}";
if (s.includes('Copy Response') && s.includes(A3)) {
  console.log('FIX 3: seller copy btn already present ✓'); fixes++;
} else if (s.includes(A3)) {
  const idx = s.indexOf(A3);
  const textClose = s.indexOf('</Text>', idx);
  const lineEnd = s.indexOf(NL, textClose);
  const insertAt = lineEnd + NL.length;
  const btn = [
    '                      {sellerResponseB64 ? (',
    '                        <TouchableOpacity',
    "                          onPress={async () => { try { await Clipboard.setStringAsync(sellerResponseB64); Alert.alert('Copied!', 'Send this to the buyer.'); } catch {} }}",
    "                          style={{ backgroundColor: '#059669', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 }}",
    '                        >',
    "                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Copy Response & Send to Buyer</Text>",
    '                        </TouchableOpacity>',
    '                      ) : null}',
  ].join(NL);
  s = s.slice(0, insertAt) + btn + NL + s.slice(insertAt);
  fixes++;
  console.log('FIX 3: seller copy btn ✓');
} else { console.log('FIX 3: SKIP — anchor not found'); }

// ═══════════════════════════════════════════════════════════════
// FIX 4: Buyer — replace "Paste Seller Response" button with TextInput + Process button
// ═══════════════════════════════════════════════════════════════
const A4 = "onPress={processSellerResponse} style={{ backgroundColor: '#4f46e5', borderRadius: 8, padding: 14, alignItems: 'center' }}>";
if (s.includes('Paste seller response here')) {
  console.log('FIX 4: buyer paste already present ✓'); fixes++;
} else if (s.includes(A4)) {
  const idx = s.indexOf(A4);
  const blockStart = s.lastIndexOf('<TouchableOpacity', idx);
  const blockEnd = s.indexOf('</TouchableOpacity>', idx) + '</TouchableOpacity>'.length;
  const replacement = [
    "<Text style={{ fontSize: 14, fontWeight: 'bold', color: '#4f46e5', marginTop: 4, marginBottom: 4 }}>Paste Seller Response</Text>",
    '                      <TextInput',
    "                        style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#a5b4fc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 11, fontFamily: 'monospace', color: '#1c1917', minHeight: 60, marginBottom: 8 }}",
    '                        placeholder="Paste seller response here (base64)..."',
    '                        placeholderTextColor="#a8a29e"',
    '                        multiline',
    '                        onChangeText={(txt) => { const v = txt.trim(); if (v.length > 20) setSellerResponseB64(v); }}',
    '                        autoCapitalize="none"',
    '                        autoCorrect={false}',
    '                      />',
    "                      <TouchableOpacity onPress={async () => { if (sellerResponseB64 && sellerResponseB64.length > 20) { try { await Clipboard.setStringAsync(sellerResponseB64); } catch {} } processSellerResponse(); }} style={{ backgroundColor: '#4f46e5', borderRadius: 8, padding: 14, alignItems: 'center' }}>",
    "                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{'Process Seller Response'}</Text>",
    '                      </TouchableOpacity>',
  ].join(NL);
  s = s.slice(0, blockStart) + n(replacement) + s.slice(blockEnd);
  fixes++;
  console.log('FIX 4: buyer paste field ✓');
} else { console.log('FIX 4: SKIP — anchor not found'); }

// ═══════════════════════════════════════════════════════════════
// FIX 5: Arweave direct query for frostAddress before reuse check
// ═══════════════════════════════════════════════════════════════
const A5 = '// FROST REUSE: if Arweave/TownHall has frostAddress with funds, find matching counter' + NL +
  '          const agrFrostAddr = agreement.frostAddress || \'\';';

if (s.includes('Got frostAddress from Arweave')) {
  console.log('FIX 5: arweave query already present ✓'); fixes++;
} else if (s.includes(n(A5))) {
  const replacement5 = [
    '// FROST REUSE: query Arweave for buyer proposal frostAddress',
    '          let agrFrostAddr = agreement.frostAddress || \'\';',
    '          if (!agrFrostAddr || agrFrostAddr.length < 20) {',
    '            try {',
    '              const _fGql = \'{ transactions(first: 1, tags: [{ name: "KV-AgreementId", values: ["\' + agrId + \'"] }, { name: "KV-Status", values: ["Proposed"] }]) { edges { node { tags { name value } } } } }\';',
    '              const _fResp = await fetch(\'https://arweave.net/graphql\', { method: \'POST\', headers: { \'Content-Type\': \'application/json\' }, body: JSON.stringify({ query: _fGql }) });',
    '              const _fJson = await _fResp.json();',
    '              const _fTags = _fJson?.data?.transactions?.edges?.[0]?.node?.tags;',
    '              if (_fTags) { const _fm: any = {}; _fTags.forEach((t: any) => { _fm[t.name] = t.value; }); if (_fm[\'KV-FrostAddress\']) { agrFrostAddr = _fm[\'KV-FrostAddress\']; console.log(\'[Seller-Reuse] Got frostAddress from Arweave proposal:\', agrFrostAddr.slice(0, 30)); } }',
    '            } catch (e) { console.warn(\'[Seller-Reuse] Arweave frost query failed:\', e); }',
    '          }',
  ].join(NL);
  s = s.replace(n(A5), n(replacement5));
  fixes++;
  console.log('FIX 5: arweave frost query ✓');
} else { console.log('FIX 5: SKIP — anchor not found'); }

// ═══════════════════════════════════════════════════════════════
fs.writeFileSync(f, s);
console.log('\n=== ' + fixes + '/5 ===');
const v = fs.readFileSync(f, 'utf8');
const checks = [
  ['sellerResponseB64', v.includes('sellerResponseB64')],
  ['Seller copy btn', v.includes('Copy Response & Send to Buyer')],
  ['Buyer paste field', v.includes('Paste seller response here')],
  ['Process button', v.includes('Process Seller Response')],
  ['Arweave frost query', v.includes('Got frostAddress from Arweave')],
];
checks.forEach(([nm, ok]) => console.log(ok ? '  ✓' : '  ✗', nm));
console.log(checks.every(c => c[1]) ? '\n✅ ALL PASSED' : '\n❌ SOME FAILED');
