const fs = require('fs');
let fixes = 0;

// ============ 1. KV-TrackingNumber tag in townhall_client.ts ============
let tc = fs.readFileSync('townhall_client.ts', 'utf8');
if (!tc.includes('KV-TrackingNumber')) {
  const marker = "{ name: 'KV-SellerAmount', value: String(agreement.sellerAmountSompi || (agreement as any).sellerAmountSompi || 0) },";
  const idx = tc.indexOf(marker);
  if (idx > -1) {
    tc = tc.substring(0, idx + marker.length) +
      "\n    ...((agreement as any).trackingNumber ? [{ name: 'KV-TrackingNumber', value: (agreement as any).trackingNumber }] : [])," +
      tc.substring(idx + marker.length);
    fixes++;
    console.log('1. Added KV-TrackingNumber tag to townhall_client.ts');
  } else { console.log('1. FAIL: KV-SellerAmount marker not found'); }
  fs.writeFileSync('townhall_client.ts', tc);
} else { console.log('1. SKIP: KV-TrackingNumber already exists'); }

// ============ 2. sellerTrackingNum state in NeighborAgreement.tsx ============
let na = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
if (!na.includes('sellerTrackingNum')) {
  na = na.replace(
    "const [sellerResponseB64, setSellerResponseB64] = useState('');",
    "const [sellerResponseB64, setSellerResponseB64] = useState('');\n  const [sellerTrackingNum, setSellerTrackingNum] = useState('');"
  );
  fixes++;
  console.log('2. Added sellerTrackingNum state');
} else { console.log('2. SKIP: sellerTrackingNum already exists'); }

// ============ 3. Seller tracking input field before "Paste Buyer Template" ============
if (!na.includes('Tracking Number (optional)')) {
  const sellerLabel = "Paste Buyer Template</Text>";
  const labelIdx = na.indexOf(sellerLabel);
  if (labelIdx > -1) {
    const insertBefore = na.lastIndexOf("<Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1e40af'", labelIdx);
    if (insertBefore > -1) {
      const field = `<View style={{ marginBottom: 10 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#059669', marginBottom: 2 }}>Tracking Number (optional)</Text>
                        <Text style={{ fontSize: 10, color: '#15803d', marginBottom: 4 }}>{"Saved permanently to Arweave as proof of shipment.\\nDo NOT paste with your signed response."}</Text>
                        <TextInput
                          style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#86efac', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#1c1917' }}
                          placeholder="e.g. 1Z999AA10123456784"
                          placeholderTextColor="#a8a29e"
                          value={sellerTrackingNum}
                          onChangeText={setSellerTrackingNum}
                          autoCapitalize="characters"
                          autoCorrect={false}
                        />
                      </View>
                      `;
      na = na.substring(0, insertBefore) + field + na.substring(insertBefore);
      fixes++;
      console.log('3. Added seller tracking input field');
    } else { console.log('3. FAIL: insert point not found'); }
  } else { console.log('3. FAIL: Paste Buyer Template label not found'); }
} else { console.log('3. SKIP: seller tracking field already exists'); }

// ============ 4. Nonce sweep in AppNaviagator.tsx ============
let nav = fs.readFileSync('AppNaviagator.tsx', 'utf8');
if (!nav.includes('ORPHANED NONCE SWEEP')) {
  // Find any useEffect with [], — insert after it
  const useEffectPattern = "}, []);";
  const firstUE = nav.indexOf(useEffectPattern);
  if (firstUE > -1) {
    const insertAt = firstUE + useEffectPattern.length;
    const sweepCode = `\n
  // === ORPHANED NONCE SWEEP ===
  useEffect(() => {
    (async () => {
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const nonceKeys = allKeys.filter(k => k.startsWith('kv_frost_nonce_'));
        for (const nk of nonceKeys) {
          try {
            const raw = await SecureStore.getItemAsync(nk);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            const age = Date.now() - (parsed.createdAt || 0);
            if (age > 24 * 60 * 60 * 1000 || !parsed.createdAt) {
              await SecureStore.deleteItemAsync(nk);
              console.log('[K-SWEEP] Destroyed orphaned nonce:', nk, 'age:', Math.round(age / 60000), 'min');
            }
          } catch { await SecureStore.deleteItemAsync(nk); console.log('[K-SWEEP] Destroyed unparseable nonce:', nk); }
        }
      } catch (e) { console.warn('[K-SWEEP] Failed:', e); }
    })();
  }, []);`;
    nav = nav.substring(0, insertAt) + sweepCode + nav.substring(insertAt);
    fixes++;
    console.log('4. Added orphaned nonce sweep (24h threshold)');
  } else { console.log('4. FAIL: no useEffect found'); }
  fs.writeFileSync('AppNaviagator.tsx', nav);
} else { console.log('4. SKIP: nonce sweep already exists'); }

fs.writeFileSync('NeighborAgreement.tsx', na);
console.log('\\nDone:', fixes, 'fixes applied');
console.log('\\nVerify:');
console.log('  Select-String -Path "townhall_client.ts" -Pattern "KV-TrackingNumber"');
console.log('  Select-String -Path "NeighborAgreement.tsx" -Pattern "sellerTrackingNum" | Measure-Object');
console.log('  Select-String -Path "AppNaviagator.tsx" -Pattern "K-SWEEP"');
