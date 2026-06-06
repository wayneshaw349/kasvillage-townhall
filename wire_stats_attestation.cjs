// wire_stats_attestation.cjs
// Adds attestation query + staleness indicator to StatsLookup in TownHallScreen.tsx
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'TownHallScreen.tsx');
let src = fs.readFileSync(file, 'utf8');

// 1. Update StatsResult interface to include attestation
src = src.replace(
  `interface StatsResult {
  pubkey: string;
  apt: string;
  xp: number;
  pComplete: number;
  successes: number;
  deadlocks: number;
  error?: string;
}`,
  `interface StatsResult {
  pubkey: string;
  apt: string;
  xp: number;
  pComplete: number;
  successes: number;
  deadlocks: number;
  platform?: string;
  lastAttested?: number;
  deviceHashPrefix?: string;
  attestationFound: boolean;
  error?: string;
}`
);

// 2. Add attestation query inside handleLookup, after the stats lookup
src = src.replace(
  `      if (lookupResult?.pubkey && lookupResult?.stats) {
        const s = lookupResult.stats;
        setResult({
          pubkey: lookupResult.pubkey,
          apt: 'APT-' + deriveApt(lookupResult.pubkey),
          xp: s.xp ?? 250,
          pComplete: s.p_complete ?? s.pComplete ?? 0.5,
          successes: s.successes ?? 0,
          deadlocks: s.deadlocks ?? 0,
        });`,
  `      if (lookupResult?.pubkey && lookupResult?.stats) {
        const s = lookupResult.stats;
        
        // Parallel attestation query
        let platform = '';
        let lastAttested = 0;
        let deviceHashPrefix = '';
        let attestationFound = false;
        try {
          const attQuery = \`{
            transactions(
              tags: [
                { name: "App-Name", values: ["KasVillage"] },
                { name: "KV-Type", values: ["device-attestation"] },
                { name: "KV-Pubkey", values: ["\${lookupResult.pubkey}"] }
              ],
              sort: HEIGHT_DESC,
              first: 1
            ) {
              edges { node { tags { name value } } }
            }
          }\`;
          const attRes = await fetch('https://arweave.net/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: attQuery }),
          });
          if (attRes.ok) {
            const attData = await attRes.json();
            const attTags = attData?.data?.transactions?.edges?.[0]?.node?.tags;
            if (attTags) {
              attestationFound = true;
              for (const tag of attTags) {
                if (tag.name === 'KV-Platform') platform = tag.value;
                if (tag.name === 'KV-DeviceHash') deviceHashPrefix = tag.value.slice(0, 8);
              }
              // Get timestamp from attestation payload or block time
              const tsTag = attTags.find((t: {name: string}) => t.name === 'KV-Timestamp');
              if (tsTag) lastAttested = parseInt(tsTag.value, 10);
            }
          }
        } catch (e) {
          console.warn('[StatsLookup] Attestation query failed:', e);
        }

        setResult({
          pubkey: lookupResult.pubkey,
          apt: 'APT-' + deriveApt(lookupResult.pubkey),
          xp: s.xp ?? 250,
          pComplete: s.p_complete ?? s.pComplete ?? 0.5,
          successes: s.successes ?? 0,
          deadlocks: s.deadlocks ?? 0,
          platform,
          lastAttested,
          deviceHashPrefix,
          attestationFound,
        });`
);

// 3. Fix the not-found result to include attestationFound
src = src.replace(
  `        setResult({ pubkey: '', apt: '', xp: 0, pComplete: 0, successes: 0, deadlocks: 0, error: 'Not found — user may not have completed a transaction yet' });`,
  `        setResult({ pubkey: '', apt: '', xp: 0, pComplete: 0, successes: 0, deadlocks: 0, attestationFound: false, error: 'Not found — user may not have completed a transaction yet' });`
);

src = src.replace(
  `        setResult({ pubkey: '', apt: '', xp: 0, pComplete: 0, successes: 0, deadlocks: 0, error: 'Lookup failed' });`,
  `        setResult({ pubkey: '', apt: '', xp: 0, pComplete: 0, successes: 0, deadlocks: 0, attestationFound: false, error: 'Lookup failed' });`
);

// 4. Add attestation display + staleness indicator after the stats grid
const attestationUI = `
      {result && !result.error && (
        <View style={{
          marginTop: rs.s(8),
          padding: rs.s(10),
          backgroundColor: result.attestationFound ? '#f0fdf4' : '#fef2f2',
          borderRadius: rs.s(6),
          borderWidth: 1,
          borderColor: result.attestationFound ? '#bbf7d0' : '#fecaca',
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: rs.font(12), fontWeight: '700', color: result.attestationFound ? '#166534' : '#991b1b' }}>
              {result.attestationFound ? '✓ Device attested' : '✗ No attestation'}
            </Text>
            {result.attestationFound && result.platform ? (
              <Text style={{ fontSize: rs.font(11), color: '#166534' }}>
                {result.platform === 'ios' ? '📱 iOS' : result.platform === 'android' ? '🤖 Android' : result.platform}
              </Text>
            ) : null}
          </View>
          {result.attestationFound && (
            <View style={{ marginTop: rs.s(4) }}>
              <Text style={{ fontSize: rs.font(10), color: (() => {
                if (!result.lastAttested) return COLORS.stone500;
                const daysAgo = Math.floor((Date.now() - result.lastAttested) / 86400000);
                if (daysAgo < 30) return '#16a34a';
                if (daysAgo < 180) return '#d97706';
                return '#dc2626';
              })() }}>
                {(() => {
                  if (!result.lastAttested) return 'Timestamp unavailable';
                  const daysAgo = Math.floor((Date.now() - result.lastAttested) / 86400000);
                  if (daysAgo < 1) return 'Verified today';
                  if (daysAgo < 30) return 'Verified ' + daysAgo + ' days ago';
                  if (daysAgo < 365) return 'Verified ' + Math.floor(daysAgo / 30) + ' months ago';
                  return 'Verified ' + Math.floor(daysAgo / 365) + '+ years ago';
                })()}
              </Text>
              {result.deviceHashPrefix ? (
                <Text style={{ fontSize: rs.font(9), color: COLORS.stone400, marginTop: 2 }}>
                  Device: {result.deviceHashPrefix}...
                </Text>
              ) : null}
            </View>
          )}
        </View>
      )}`;

// Insert attestation UI after the stats grid, before the error block
src = src.replace(
  `      {result?.error && (
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
      )}`,
  `${attestationUI}

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
      )}`
);

fs.writeFileSync(file, src, 'utf8');
console.log('✅ TownHallScreen.tsx: StatsLookup wired with attestation');
console.log('   - Parallel Arweave query for device-attestation');
console.log('   - Shows: platform, staleness (green/amber/red), device hash prefix');
console.log('   - No attestation = red "✗ No attestation"');
console.log('   - Staleness: <30d green, 30-180d amber, 180d+ red');
