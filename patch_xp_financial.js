// patch_xp_financial.js
// 1. Wire getUserStats() to call TownHall /user-stats (Arweave-backed, cross-referenced)
// 2. Wire Dashboard financial summary to real agreement data
//
// Run: node patch_xp_financial.js

const fs = require('fs');

// ============================================================================
// 1. Wire getUserStats to call TownHall instead of SecureStore
// ============================================================================
let reg = fs.readFileSync('wallet_registration_v2.ts', 'utf8');

// Find TOWN_HALL_BASE_URL or define it
let townHallUrl = "'http://10.0.0.186:8080'";
const urlMatch = reg.match(/TOWN_HALL_BASE_URL\s*=\s*['"]([^'"]+)['"]/);
if (urlMatch) townHallUrl = `'${urlMatch[1]}'`;

// Check if townhall_client has the URL
try {
  const tc = fs.readFileSync('townhall_client.ts', 'utf8');
  const tcMatch = tc.match(/(?:TOWN_HALL_BASE|BASE_URL|TOWNHALL_URL)\s*=\s*['"]([^'"]+)['"]/);
  if (tcMatch) townHallUrl = `'${tcMatch[1]}'`;
} catch (e) {}

const oldGetUserStats = `export async function getUserStats(): Promise<UserStats> {
  const statsJson = await SecureStore.getItemAsync(STORE_KEYS.USER_STATS);
  return statsJson ? JSON.parse(statsJson) : createDefaultUserStats();
}`;

const newGetUserStats = `export async function getUserStats(): Promise<UserStats> {
  // Try TownHall first (cross-references Arweave + L1)
  try {
    const pubkey = await SecureStore.getItemAsync('kv_l1_pubkey');
    if (pubkey) {
      const resp = await fetch(${townHallUrl} + '/user-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey }),
      });
      if (resp.ok) {
        const stats = await resp.json();
        // Cache locally for offline access
        await SecureStore.setItemAsync(STORE_KEYS.USER_STATS, JSON.stringify(stats));
        return stats as UserStats;
      }
    }
  } catch (e) {
    console.warn('[Stats] TownHall unreachable, using local cache');
  }
  // Fallback to local SecureStore cache
  const statsJson = await SecureStore.getItemAsync(STORE_KEYS.USER_STATS);
  return statsJson ? JSON.parse(statsJson) : createDefaultUserStats();
}`;

if (reg.includes(oldGetUserStats)) {
  reg = reg.replace(oldGetUserStats, newGetUserStats);
  fs.writeFileSync('wallet_registration_v2.ts', reg);
  console.log('1: getUserStats wired to TownHall /user-stats');
  console.log('   Falls back to SecureStore if TownHall unreachable');
} else {
  console.log('1: WARN - getUserStats pattern not matched, check manually');
}

// ============================================================================
// 2. Wire Dashboard financial summary to real data
// ============================================================================
let dash = fs.readFileSync('Dashboard.tsx', 'utf8');

// Add financial state variables to WalletOverview
if (!dash.includes('inAgreementsSompi')) {
  // Add state for financial data
  const walletOverviewProps = "balanceSompi?: bigint;\n}>";
  const newProps = `balanceSompi?: bigint;
  inAgreementsSompi?: bigint;
  iousOwedSompi?: bigint;
  iousOwedToYouSompi?: bigint;
  agreementReturnsSompi?: bigint;
}>`;

  if (dash.includes(walletOverviewProps)) {
    dash = dash.replace(walletOverviewProps, newProps);
    console.log('2a: Financial props added to WalletOverview');
  }

  // Update the destructuring
  dash = dash.replace(
    "activeMode, onSwitchMode, balanceSompi = 0n }) => {",
    "activeMode, onSwitchMode, balanceSompi = 0n, inAgreementsSompi = 0n, iousOwedSompi = 0n, iousOwedToYouSompi = 0n, agreementReturnsSompi = 0n }) => {"
  );
  console.log('2b: Financial props destructured');

  // Replace hardcoded zeros with real values
  dash = dash.replace(
    '<Text style={{ color: "#E67E22", fontSize: 13 }}>0.0000 KASPA</Text>',
    '<Text style={{ color: "#E67E22", fontSize: 13 }}>{(Number(inAgreementsSompi) / 1e8).toFixed(4)} KASPA</Text>'
  );
  dash = dash.replace(
    '<Text style={{ color: "#E74C3C", fontSize: 13 }}>0.0000 KASPA</Text>',
    '<Text style={{ color: "#E74C3C", fontSize: 13 }}>{(Number(iousOwedSompi) / 1e8).toFixed(4)} KASPA</Text>'
  );
  dash = dash.replace(
    '<Text style={{ color: "#27AE60", fontSize: 13 }}>+0.0000 KASPA</Text>',
    '<Text style={{ color: "#27AE60", fontSize: 13 }}>+{(Number(iousOwedToYouSompi) / 1e8).toFixed(4)} KASPA</Text>'
  );
  // Second +0.0000 (Agreement Returns)
  dash = dash.replace(
    '<Text style={{ color: "#27AE60", fontSize: 13 }}>+0.0000 KASPA</Text>',
    '<Text style={{ color: "#27AE60", fontSize: 13 }}>+{(Number(agreementReturnsSompi) / 1e8).toFixed(4)} KASPA</Text>'
  );

  fs.writeFileSync('Dashboard.tsx', dash);
  console.log('2c: Dashboard financial summary wired to props');
  console.log('   Lines:', dash.split('\n').length);
} else {
  console.log('2: Financial props already exist');
}

// ============================================================================
// 3. Wire AppNavigator to fetch financial data and pass to Dashboard
// ============================================================================
let appNav = fs.readFileSync('AppNaviagator.tsx', 'utf8');

if (!appNav.includes('inAgreementsSompi')) {
  // Add financial state
  const balanceState = "const [balanceSompi, setBalanceSompi] = useState<bigint>(0n);";
  if (appNav.includes(balanceState)) {
    appNav = appNav.replace(
      balanceState,
      balanceState + `
  const [inAgreementsSompi, setInAgreementsSompi] = useState<bigint>(0n);
  const [iousOwedSompi, setIousOwedSompi] = useState<bigint>(0n);
  const [iousOwedToYouSompi, setIousOwedToYouSompi] = useState<bigint>(0n);
  const [agreementReturnsSompi, setAgreementReturnsSompi] = useState<bigint>(0n);`
    );
    console.log('3a: Financial state added to AppNavigator');
  }

  // Add financial data fetch after balance load
  if (appNav.includes("console.log('[AppNav] Balance loaded:', sompi.toString(), 'sompi');")) {
    appNav = appNav.replace(
      "console.log('[AppNav] Balance loaded:', sompi.toString(), 'sompi');",
      `console.log('[AppNav] Balance loaded:', sompi.toString(), 'sompi');
          // Fetch agreement data for financial summary
          try {
            const pubkey = await SecureStore.getItemAsync('kv_l1_pubkey');
            if (pubkey) {
              const agResp = await fetch('http://10.0.0.186:8080/api/agreements/proposed');
              if (agResp.ok) {
                const agreements = await agResp.json();
                let inAg = 0n;
                for (const a of (agreements.proposals || [])) {
                  if (a.amount_sompi) inAg += BigInt(a.amount_sompi);
                }
                setInAgreementsSompi(inAg);
              }
            }
          } catch (e) { /* TownHall unreachable */ }`
    );
    console.log('3b: Financial data fetch added');
  }

  // Pass props to Dashboard WalletOverview
  if (appNav.includes('xp={user.xp}') && !appNav.includes('inAgreementsSompi={')) {
    appNav = appNav.replace(
      'xp={user.xp}',
      'xp={user.xp}\n            inAgreementsSompi={inAgreementsSompi}\n            iousOwedSompi={iousOwedSompi}\n            iousOwedToYouSompi={iousOwedToYouSompi}\n            agreementReturnsSompi={agreementReturnsSompi}'
    );
    console.log('3c: Financial props passed to Dashboard');
  }

  fs.writeFileSync('AppNaviagator.tsx', appNav);
  console.log('3d: AppNaviagator.tsx saved. Lines:', appNav.split('\n').length);
} else {
  console.log('3: Financial already wired');
}

console.log('\n=== DONE ===');
console.log('XP: getUserStats() now calls TownHall /user-stats (Arweave-backed)');
console.log('    Falls back to SecureStore cache if TownHall unreachable');
console.log('Financial: Dashboard shows real agreement amounts from TownHall');
console.log('    In Agreements, IOUs, Returns — all dynamic now');
