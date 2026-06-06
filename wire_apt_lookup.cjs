// wire_apt_lookup.cjs
// Wires deterministic apt derivation + stats lookup into townhallscreen.tsx
// Fixes: public_key → kv_public_key, sequential apt → derived apt, TODO stats lookup
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'townhallscreen.tsx');
let src = fs.readFileSync(file, 'utf8');

// ── 1. Add imports ──────────────────────────────────────────────────────────
// Find last import line
const lastImport = src.lastIndexOf("import ");
const lastImportEnd = src.indexOf('\n', lastImport);
const insertAfter = src.slice(0, lastImportEnd + 1);
const rest = src.slice(lastImportEnd + 1);
src = insertAfter +
  "import { deriveApt, resolveAptToPubkey, verifyApt } from './apt_derivation';\n" +
  "import { lookupByAddress, lookupByApt } from './counterparty_lookup';\n" +
  rest;

// ── 2. Add myPubkey state ───────────────────────────────────────────────────
src = src.replace(
  `const [myAddress, setMyAddress] = useState<string | null>(null);
  const [myApt, setMyApt] = useState<string | null>(null);`,
  `const [myAddress, setMyAddress] = useState<string | null>(null);
  const [myPubkey, setMyPubkey] = useState<string | null>(null);
  const [myApt, setMyApt] = useState<string | null>(null);`
);

// ── 3. Fix init: read kv_public_key, derive apt deterministically ───────────
src = src.replace(
  `const aptNumber = await SecureStore.getItemAsync('kv_apt_number');
      const kaspaAddress = await SecureStore.getItemAsync('public_key');
      const traits = await SecureStore.getItemAsync('kv_trait_count');
      
      if (aptNumber) setMyApt(aptNumber);
      if (kaspaAddress) setMyAddress(kaspaAddress);`,
  `const pubkey = await SecureStore.getItemAsync('kv_public_key');
      const kaspaAddress = await SecureStore.getItemAsync('kaspa_address');
      const traits = await SecureStore.getItemAsync('kv_trait_count');
      
      if (pubkey) {
        setMyPubkey(pubkey);
        const derivedApt = deriveApt(pubkey);
        setMyApt('APT-' + derivedApt);
        console.log('[TownHall] pubkey:', pubkey.slice(0, 10) + '... → APT-' + derivedApt);
      }
      if (kaspaAddress) setMyAddress(kaspaAddress);`
);

// ── 4. Fix pubkey references (was using myAddress as pubkey) ────────────────
src = src.replace(/pubkey: myAddress/g, 'pubkey: myPubkey');

// ── 5. Wire StatsLookup component ──────────────────────────────────────────
src = src.replace(
  `const StatsLookup: React.FC<{ myApt: string | null; myAddress: string | null }> = ({ myApt, myAddress }) => {
  const [lookupQuery, setLookupQuery] = useState('');
  const [isLooking, setIsLooking] = useState(false);

  const handleLookup = async () => {
    if (!lookupQuery.trim()) return;
    setIsLooking(true);
    // TODO: implement stats lookup
    setTimeout(() => setIsLooking(false), 1000);
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: rs.s(10) }}>
        <TextInput
          style={[styles.searchInput, { flex: 1 }]}
          value={lookupQuery}
          onChangeText={setLookupQuery}
          placeholder="APT-303 or kaspa:..."
          placeholderTextColor={COLORS.stone400}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleLookup} disabled={isLooking}>
          {isLooking ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Search size={rs.s(20)} color={COLORS.white} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};`,

  `interface StatsResult {
  pubkey: string;
  apt: string;
  xp: number;
  pComplete: number;
  successes: number;
  deadlocks: number;
  error?: string;
}

const StatsLookup: React.FC<{ myApt: string | null; myAddress: string | null }> = ({ myApt, myAddress }) => {
  const [lookupQuery, setLookupQuery] = useState('');
  const [isLooking, setIsLooking] = useState(false);
  const [result, setResult] = useState<StatsResult | null>(null);

  const handleLookup = async () => {
    const q = lookupQuery.trim();
    if (!q) return;
    setIsLooking(true);
    setResult(null);

    try {
      let lookupResult: { pubkey: string | null; stats: any } | null = null;

      if (q.toLowerCase().startsWith('kaspa:')) {
        // Address lookup → Arweave KV-Address tag → pubkey → stats
        lookupResult = await lookupByAddress(q);
      } else {
        // APT lookup → Arweave KV-Apt tag → pubkey → stats
        const aptNum = q.replace(/^APT-/i, '');
        lookupResult = await lookupByApt(aptNum);
      }

      if (lookupResult?.pubkey && lookupResult?.stats) {
        const s = lookupResult.stats;
        setResult({
          pubkey: lookupResult.pubkey,
          apt: 'APT-' + deriveApt(lookupResult.pubkey),
          xp: s.xp ?? 250,
          pComplete: s.p_complete ?? s.pComplete ?? 0.5,
          successes: s.successes ?? 0,
          deadlocks: s.deadlocks ?? 0,
        });
      } else {
        setResult({ pubkey: '', apt: '', xp: 0, pComplete: 0, successes: 0, deadlocks: 0, error: 'Not found — user may not have completed a transaction yet' });
      }
    } catch (e) {
      console.error('[StatsLookup]', e);
      setResult({ pubkey: '', apt: '', xp: 0, pComplete: 0, successes: 0, deadlocks: 0, error: 'Lookup failed' });
    }

    setIsLooking(false);
  };

  // Bayesian reputation: (1 + successes) / (2 + successes + deadlocks)
  const bayesianScore = result && !result.error
    ? ((1 + result.successes) / (2 + result.successes + result.deadlocks) * 100).toFixed(1)
    : null;

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: rs.s(10) }}>
        <TextInput
          style={[styles.searchInput, { flex: 1 }]}
          value={lookupQuery}
          onChangeText={setLookupQuery}
          placeholder="APT-11167863 or kaspa:..."
          placeholderTextColor={COLORS.stone400}
          onSubmitEditing={handleLookup}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleLookup} disabled={isLooking}>
          {isLooking ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Search size={rs.s(20)} color={COLORS.white} />
          )}
        </TouchableOpacity>
      </View>

      {result && !result.error && (
        <View style={{
          marginTop: rs.s(12),
          padding: rs.s(12),
          backgroundColor: COLORS.stone100,
          borderRadius: rs.s(8),
          borderWidth: 1,
          borderColor: COLORS.stone200,
        }}>
          <Text style={{ fontSize: rs.font(13), color: COLORS.stone500, marginBottom: rs.s(4) }}>
            {result.apt}
          </Text>
          <Text style={{ fontSize: rs.font(11), color: COLORS.stone400, marginBottom: rs.s(8) }} numberOfLines={1}>
            {result.pubkey.slice(0, 16)}...{result.pubkey.slice(-8)}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: rs.font(18), fontWeight: '900', color: COLORS.stone800 }}>{result.xp}</Text>
              <Text style={{ fontSize: rs.font(10), color: COLORS.stone500 }}>XP</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: rs.font(18), fontWeight: '900', color: COLORS.stone800 }}>{bayesianScore}%</Text>
              <Text style={{ fontSize: rs.font(10), color: COLORS.stone500 }}>Trust</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: rs.font(18), fontWeight: '900', color: COLORS.green600 }}>{result.successes}</Text>
              <Text style={{ fontSize: rs.font(10), color: COLORS.stone500 }}>Success</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: rs.font(18), fontWeight: '900', color: COLORS.amber600 }}>{result.deadlocks}</Text>
              <Text style={{ fontSize: rs.font(10), color: COLORS.stone500 }}>Deadlock</Text>
            </View>
          </View>
        </View>
      )}

      {result?.error && (
        <View style={{
          marginTop: rs.s(12),
          padding: rs.s(12),
          backgroundColor: '#fef2f2',
          borderRadius: rs.s(8),
          borderWidth: 1,
          borderColor: '#fecaca',
        }}>
          <Text style={{ fontSize: rs.font(13), color: '#991b1b' }}>{result.error}</Text>
        </View>
      )}
    </View>
  );
};`
);

// ── 6. Update StatsLookup usage to pass myPubkey ────────────────────────────
src = src.replace(
  `<StatsLookup 
            myApt={myApt}
            myAddress={myAddress}
          />`,
  `<StatsLookup 
            myApt={myApt}
            myAddress={myAddress}
            myPubkey={myPubkey}
          />`
);

// Update component signature to accept myPubkey
src = src.replace(
  `const StatsLookup: React.FC<{ myApt: string | null; myAddress: string | null }> = ({ myApt, myAddress }) => {`,
  `const StatsLookup: React.FC<{ myApt: string | null; myAddress: string | null; myPubkey?: string | null }> = ({ myApt, myAddress, myPubkey }) => {`
);

fs.writeFileSync(file, src, 'utf8');
console.log('✅ townhallscreen.tsx wired:');
console.log('   - Reads kv_public_key (not public_key)');
console.log('   - Derives apt deterministically from pubkey');
console.log('   - StatsLookup: address → lookupByAddress, apt → lookupByApt');
console.log('   - Results show XP, Bayesian trust %, successes, deadlocks');
console.log('   - Fixed pubkey: myAddress → myPubkey in API calls');
