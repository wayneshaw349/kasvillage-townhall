// dashboard_pubkey_fix.cjs
// Fixes Dashboard.tsx to read pubkey from SecureStore kv_public_key
// instead of using prop-derived (address-based) pubkey
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'Dashboard.tsx');
let src = fs.readFileSync(file, 'utf8');

// 1. Add SecureStore import after existing imports
src = src.replace(
  `import { useKaspaPrice } from './useKaspaPrice';`,
  `import { useKaspaPrice } from './useKaspaPrice';
import * as SecureStore from 'expo-secure-store';`
);

// 2. Add pubkey state + SecureStore read + TownHall/Arweave fetch inside Dashboard component
src = src.replace(
  `const [activeTab, setActiveTab] = useState<'wallet' | 'mailbox' | 'workspace' | 'bathroom'>('wallet');
  const [refreshing, setRefreshing] = useState(false);`,
  `const [activeTab, setActiveTab] = useState<'wallet' | 'mailbox' | 'workspace' | 'bathroom'>('wallet');
  const [refreshing, setRefreshing] = useState(false);
  const [storedPubkey, setStoredPubkey] = useState<string | null>(null);
  const [dashXp, setDashXp] = useState<number>(user.xp);
  const [dashAgreements, setDashAgreements] = useState<number>(0);
  const [dashPComplete, setDashPComplete] = useState<number>(0.5);

  // Read correct pubkey from SecureStore on mount
  useEffect(() => {
    (async () => {
      try {
        const pk = await SecureStore.getItemAsync('kv_public_key');
        if (pk) {
          setStoredPubkey(pk);
          console.log('[Dashboard] SecureStore pubkey:', pk.slice(0, 10) + '...');
        } else {
          console.warn('[Dashboard] No kv_public_key in SecureStore, falling back to prop');
          if (user.pubkey) setStoredPubkey(user.pubkey);
        }
      } catch (e) {
        console.error('[Dashboard] SecureStore read error:', e);
        if (user.pubkey) setStoredPubkey(user.pubkey);
      }
    })();
  }, []);

  // Fetch TownHall + Arweave data when pubkey is available
  const fetchDashboardData = useCallback(async (pubkey: string) => {
    try {
      // TownHall XP/reputation query
      const thRes = await fetch(
        \`https://kasvillage.app.runonflux.io/api/reputation/\${pubkey}\`
      ).then(r => r.ok ? r.json() : null).catch(() => null);
      if (thRes) {
        if (thRes.xp != null) setDashXp(thRes.xp);
        if (thRes.agreements != null) setDashAgreements(thRes.agreements);
        if (thRes.p_complete != null) setDashPComplete(thRes.p_complete);
        console.log('[Dashboard] TownHall data:', { xp: thRes.xp, agreements: thRes.agreements });
      }

      // Arweave agreement history query
      const arRes = await fetch(
        \`https://arweave.net/graphql\`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: \`{ transactions(tags: [{ name: "KV-Pubkey", values: ["\${pubkey}"] }, { name: "KV-Type", values: ["agreement"] }], first: 50) { edges { node { id tags { name value } } } } }\`
          })
        }
      ).then(r => r.ok ? r.json() : null).catch(() => null);
      if (arRes?.data?.transactions?.edges) {
        const count = arRes.data.transactions.edges.length;
        console.log('[Dashboard] Arweave agreements found:', count);
      }
    } catch (e) {
      console.error('[Dashboard] Data fetch error:', e);
    }
  }, []);

  // Auto-fetch on pubkey load
  useEffect(() => {
    if (storedPubkey) fetchDashboardData(storedPubkey);
  }, [storedPubkey, fetchDashboardData]);`
);

// 3. Wire handleRefresh to use storedPubkey
src = src.replace(
  `const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Refresh data from Arweave/API
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);`,
  `const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (storedPubkey) {
      await fetchDashboardData(storedPubkey);
    }
    setRefreshing(false);
  }, [storedPubkey, fetchDashboardData]);`
);

// 4. Use dashXp instead of user.xp in WalletOverview
src = src.replace(
  `xp={user.xp}`,
  `xp={dashXp}`
);

fs.writeFileSync(file, src, 'utf8');
console.log('✅ Dashboard.tsx patched — pubkey now from SecureStore kv_public_key');
console.log('   - SecureStore read on mount');
console.log('   - TownHall + Arweave queries use correct pubkey');
console.log('   - Pull-to-refresh re-fetches with correct pubkey');
