// patch_ceremony_ui.cjs — combined: seller copy btn + buyer paste + arweave reuse
const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');
const NL = s.includes('\r\n') ? '\r\n' : '\n';
const n = (str) => str.replace(/\n/g, NL);
let fixes = 0;

// ═══════════════════════════════════════════════════════════════
// FIX 1: Add sellerResponseB64 state
// ═══════════════════════════════════════════════════════════════
const S1 = 'const [isLoading, setIsLoading] = useState(false);';
if (s.includes(S1) && !s.includes('sellerResponseB64')) {
  s = s.replace(S1, S1 + NL + "  const [sellerResponseB64, setSellerResponseB64] = useState('');");
  fixes++;
  console.log('FIX 1: sellerResponseB64 state ✓');
} else if (s.includes('sellerResponseB64')) {
  console.log('FIX 1: already present ✓');
  fixes++;
} else console.log('FIX 1: SKIP');

// ═══════════════════════════════════════════════════════════════
// FIX 2: Seller — store response + copy button
// ═══════════════════════════════════════════════════════════════
const S2 = "console.log('[Ceremony-Seller] Signed! Response:', result.responseB64.length, 'chars');";
if (s.includes(S2) && !s.includes('setSellerResponseB64(result')) {
  s = s.replace(S2, "setSellerResponseB64(result.responseB64);" + NL + "            " + S2);
  fixes++;
  console.log('FIX 2: Store seller response ✓');
} else console.log('FIX 2: already present or skip');

// Add copy button after seller k note
const S2B = "{isLoading && <ActivityIndicator color=\"#4f46e5\" />}" + NL +
  "                      <Text style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center' }}>{'Seller k is born and destroyed within the sign call (~ms)'}</Text>";
const S2B_NEW = "{isLoading && <ActivityIndicator color=\"#4f46e5\" />}" + NL +
  "                      {sellerResponseB64 ? (" + NL +
  "                        <TouchableOpacity" + NL +
  "                          onPress={async () => { try { await Clipboard.setStringAsync(sellerResponseB64); Alert.alert('Copied!', 'Send this to the buyer so they can broadcast.'); } catch {} }}" + NL +
  "                          style={{ backgroundColor: '#059669', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 }}" + NL +
  "                        >" + NL +
  "                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{'\\ud83d\\udccb Copy Response & Send to Buyer'}</Text>" + NL +
  "                        </TouchableOpacity>" + NL +
  "                      ) : null}" + NL +
  "                      <Text style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center' }}>{'Seller k is born and destroyed within the sign call (~ms)'}</Text>";

if (s.includes(n(S2B)) && !s.includes('Copy Response & Send to Buyer')) {
  s = s.replace(n(S2B), n(S2B_NEW));
  fixes++;
  console.log('FIX 2B: Seller copy button ✓');
} else if (s.includes('Copy Response & Send to Buyer')) {
  console.log('FIX 2B: already present ✓'); fixes++;
} else console.log('FIX 2B: SKIP — anchor not found');

// ═══════════════════════════════════════════════════════════════
// FIX 3: Buyer — replace clipboard-only button with TextInput
// Find the exact processSellerResponse button
// ═══════════════════════════════════════════════════════════════
const S3 = "onPress={processSellerResponse} style={{ backgroundColor: '#4f46e5', borderRadius: 8, padding: 14, alignItems: 'center' }}>" + NL +
  "                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{'Paste Seller Response'}</Text>" + NL +
  "                      </TouchableOpacity>";

const S3_NEW = "onPress={async () => {}} style={{ display: 'none' }}><Text>{''}</Text></TouchableOpacity>" + NL +
  "                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#4f46e5', marginTop: 4, marginBottom: 4 }}>Paste Seller Response</Text>" + NL +
  "                      <TextInput" + NL +
  "                        style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#a5b4fc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 11, fontFamily: 'monospace', color: '#1c1917', minHeight: 60, marginBottom: 8 }}" + NL +
  "                        placeholder=\"Paste seller response here (base64)...\"" + NL +
  "                        placeholderTextColor=\"#a8a29e\"" + NL +
  "                        multiline" + NL +
  "                        onChangeText={(txt) => { const v = txt.trim(); if (v.length > 20) setSellerResponseB64(v); }}" + NL +
  "                        autoCapitalize=\"none\"" + NL +
  "                        autoCorrect={false}" + NL +
  "                      />" + NL +
  "                      <TouchableOpacity onPress={async () => { if (sellerResponseB64 && sellerResponseB64.length > 20) { try { await Clipboard.setStringAsync(sellerResponseB64); } catch {} } processSellerResponse(); }} style={{ backgroundColor: '#4f46e5', borderRadius: 8, padding: 14, alignItems: 'center' }}>" + NL +
  "                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{'Process Seller Response'}</Text>" + NL +
  "                      </TouchableOpacity>";

if (s.includes(n(S3))) {
  s = s.replace(n(S3), n(S3_NEW));
  fixes++;
  console.log('FIX 3: Buyer paste field ✓');
} else if (s.includes('Process Seller Response')) {
  console.log('FIX 3: already present ✓'); fixes++;
} else {
  // Try shorter anchor
  const S3_SHORT = "'>{'Paste Seller Response'}<";
  if (s.includes(S3_SHORT)) {
    console.log('FIX 3: Found short anchor, attempting...');
    // Find the full TouchableOpacity block around it
    const idx = s.indexOf(S3_SHORT);
    const lineStart = s.lastIndexOf('<TouchableOpacity', idx);
    const lineEnd = s.indexOf('</TouchableOpacity>', idx) + '</TouchableOpacity>'.length;
    if (lineStart > 0 && lineEnd > lineStart) {
      const oldBlock = s.slice(lineStart, lineEnd);
      const newBlock = '<Text style={{ fontSize: 14, fontWeight: \'bold\', color: \'#4f46e5\', marginTop: 4, marginBottom: 4 }}>Paste Seller Response</Text>' + NL +
        '                      <TextInput' + NL +
        '                        style={{ backgroundColor: \'#fff\', borderWidth: 1, borderColor: \'#a5b4fc\', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 11, fontFamily: \'monospace\', color: \'#1c1917\', minHeight: 60, marginBottom: 8 }}' + NL +
        '                        placeholder="Paste seller response here (base64)..."' + NL +
        '                        placeholderTextColor="#a8a29e"' + NL +
        '                        multiline' + NL +
        '                        onChangeText={(txt) => { const v = txt.trim(); if (v.length > 20) setSellerResponseB64(v); }}' + NL +
        '                        autoCapitalize="none"' + NL +
        '                        autoCorrect={false}' + NL +
        '                      />' + NL +
        '                      <TouchableOpacity onPress={async () => { if (sellerResponseB64 && sellerResponseB64.length > 20) { try { await Clipboard.setStringAsync(sellerResponseB64); } catch {} } processSellerResponse(); }} style={{ backgroundColor: \'#4f46e5\', borderRadius: 8, padding: 14, alignItems: \'center\' }}>' + NL +
        '                        <Text style={{ color: \'#fff\', fontWeight: \'bold\', fontSize: 15 }}>{\'Process Seller Response\'}</Text>' + NL +
        '                      </TouchableOpacity>';
      s = s.slice(0, lineStart) + n(newBlock) + s.slice(lineEnd);
      fixes++;
      console.log('FIX 3: Buyer paste field (short anchor) ✓');
    }
  } else {
    console.log('FIX 3: SKIP — no anchor found');
  }
}

// ═══════════════════════════════════════════════════════════════
// FIX 4: Arweave direct query for frostAddress before reuse
// ═══════════════════════════════════════════════════════════════
const S4 = "// FROST REUSE: if Arweave/TownHall has frostAddress with funds, find matching counter" + NL +
  "          const agrFrostAddr = agreement.frostAddress || '';";

const S4_NEW = "// FROST REUSE: query Arweave directly for buyer's proposal frostAddress" + NL +
  "          let agrFrostAddr = agreement.frostAddress || '';" + NL +
  "          if (!agrFrostAddr || agrFrostAddr.length < 20) {" + NL +
  "            try {" + NL +
  "              const _frostGql = '{ transactions(first: 1, tags: [{ name: \"KV-AgreementId\", values: [\"' + agrId + '\"] }, { name: \"KV-Status\", values: [\"Proposed\"] }]) { edges { node { tags { name value } } } } }';" + NL +
  "              const _frostResp = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: _frostGql }) });" + NL +
  "              const _frostJson = await _frostResp.json();" + NL +
  "              const _frostTags = _frostJson?.data?.transactions?.edges?.[0]?.node?.tags;" + NL +
  "              if (_frostTags) {" + NL +
  "                const _ftm: any = {};" + NL +
  "                _frostTags.forEach((t: any) => { _ftm[t.name] = t.value; });" + NL +
  "                if (_ftm['KV-FrostAddress']) {" + NL +
  "                  agrFrostAddr = _ftm['KV-FrostAddress'];" + NL +
  "                  console.log('[Seller-Reuse] Got frostAddress from Arweave proposal:', agrFrostAddr.slice(0, 30));" + NL +
  "                }" + NL +
  "              }" + NL +
  "            } catch (e) { console.warn('[Seller-Reuse] Arweave frost query failed:', e); }" + NL +
  "          }";

if (s.includes(n(S4))) {
  s = s.replace(n(S4), n(S4_NEW));
  fixes++;
  console.log('FIX 4: Arweave direct frost query ✓');
} else if (s.includes('Got frostAddress from Arweave proposal')) {
  console.log('FIX 4: already present ✓'); fixes++;
} else console.log('FIX 4: SKIP');

// ═══════════════════════════════════════════════════════════════
fs.writeFileSync(f, s);
console.log('\n=== ' + fixes + '/5 fixes ===');
const v = fs.readFileSync(f, 'utf8');
const checks = [
  ['sellerResponseB64 state', v.includes('sellerResponseB64')],
  ['Seller copy button', v.includes('Copy Response')],
  ['Buyer paste field', v.includes('Paste seller response here')],
  ['Process button', v.includes('Process Seller Response')],
  ['Arweave frost query', v.includes('Got frostAddress from Arweave')],
];
console.log('\nVerification:');
checks.forEach(([nm, ok]) => console.log(ok ? '  ✓' : '  ✗', nm));
console.log(checks.every(c => c[1]) ? '\n✅ ALL PASSED' : '\n❌ SOME FAILED');
