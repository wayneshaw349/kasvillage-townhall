// wire_mailbox_games.cjs — GAMES lane in the VillageMailbox.
//
// Search-first section that reads the deterministic GAME REGISTRY address
// (relay-fallback fetchRecords, so it works with api-tn10 dead), lists signed
// announces, and DOWNLOAD fetches + hash-verifies the game via
// fetchGamePuzzle (device-cached) and files it in kv_installed_games for the
// Entertainment Center. Search bar gains TIME TIERS everywhere:
// "kascity week", "shoes 30 days", "dapp 2 hours" filter by record time.
// Run from layer1 root:  node src\wire_mailbox_games.cjs
const fs = require("fs");
const P = "VillageMailbox.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("GameRegistryCard")) { console.log("already patched"); process.exit(0); }
let n = 0;
function rep(name, a, b, exp) {
  const f = s.split(a).length - 1;
  if (f !== exp) { console.error("ABORT [" + name + "]: expected " + exp + ", found " + f); process.exit(1); }
  s = s.split(a).join(b); n++; console.log("ok  [" + name + "]");
}
rep("section-type",
`type Section = 'dapps' | 'storefronts' | 'coupons' | 'academics' | 'services';`,
`type Section = 'dapps' | 'storefronts' | 'coupons' | 'academics' | 'services' | 'games';`, 1);
rep("section-config",
`  { key: 'services', label: 'Services', icon: '🔧', color: COLORS.green600 },`,
`  { key: 'services', label: 'Services', icon: '🔧', color: COLORS.green600 },
  { key: 'games', label: 'Games', icon: '🕹️', color: COLORS.purple600 },`, 1);
rep("empty-state",
`    services: { icon: '🔧', title: 'No Services', subtitle: 'Verified service providers will appear here' },`,
`    services: { icon: '🔧', title: 'No Services', subtitle: 'Verified service providers will appear here' },
    games: { icon: '🕹️', title: 'No Games Found', subtitle: 'Search a game name — on-chain games appear here' },`, 1);
rep("game-card",
`function EmptyState({ section }: { section: Section }) {`,
`function GameRegistryCard({ item, onInstall, installing }: any) {
  return (
    <View style={cardStyles.storefrontCard}>
      <Text style={{ fontSize: 22 }}>🕹️</Text>
      <Text style={{ fontWeight: '700', marginTop: 4 }} numberOfLines={1}>{item.name}</Text>
      <Text style={{ color: '#666', fontSize: 11 }} numberOfLines={1}>{item.category || 'Game'} · on-chain · verified by hash</Text>
      <TouchableOpacity onPress={() => onInstall(item)} disabled={!!installing}
        style={{ marginTop: 8, backgroundColor: installing ? '#999' : '#7c3aed', borderRadius: 8, paddingVertical: 6, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{installing ? 'DOWNLOADING…' : 'DOWNLOAD'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyState({ section }: { section: Section }) {`, 1);
rep("games-state",
`  const [services, setServices] = useState<ServiceEntry[]>([]);`,
`  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [installingGame, setInstallingGame] = useState<string>('');`, 1);
rep("games-fetch",
`        case 'services':
          result = await fetchServices(cursor);
          result.items = result.items.filter((s: ServiceEntry) => s.townhall.verified);
          setServices(isRefresh ? result.items : [...services, ...result.items]);
          break;`,
`        case 'services':
          result = await fetchServices(cursor);
          result.items = result.items.filter((s: ServiceEntry) => s.townhall.verified);
          setServices(isRefresh ? result.items : [...services, ...result.items]);
          break;
        case 'games': {
          // Deterministic game registry, read through the relay-fallback rail.
          const pp = require('./payload_publish');
          const kp = require('./kaspa_payload');
          const regAddr = pp.registryAddress('game', 'testnet-10');
          const fetchR = kp.fetchRecords || kp.fetchPayloadRecords || kp.fetchAddressRecords;
          const rows: any[] = (await fetchR(regAddr, 'testnet-10')) || [];
          const h2s = (hx: string) => { let o = ''; for (let i = 0; i < hx.length; i += 2) o += String.fromCharCode(parseInt(hx.substr(i, 2), 16)); try { return decodeURIComponent(escape(o)); } catch { return o; } };
          const items: any[] = [];
          const seen = new Set<string>();
          for (const row of rows) {
            let r: any = (row && row.record) ? row.record : row;
            if (r && !r.k && typeof r.payload === 'string') { try { const raw = h2s(r.payload); r = JSON.parse(raw.startsWith('KVP1') ? raw.slice(4) : raw); } catch { continue; } }
            if (!r || r.k !== 'registry' || !r.d) continue;
            let quad: any = null; try { quad = r.d.primaryLink ? JSON.parse(r.d.primaryLink) : null; } catch {}
            if (!quad || !quad.head || !quad.manifestAddress || !quad.manifestHash) continue;
            if (seen.has(quad.head)) continue;
            seen.add(quad.head);
            items.push({ name: r.d.name || quad.game, category: r.d.category || 'Game', t: r.t || 0, quad });
          }
          items.sort((a, b) => b.t - a.t);
          result = { items, nextCursor: undefined, hasMore: false } as any;
          setGames(items);
          break;
        }`, 1);
rep("games-current",
`      case 'services': return services;`,
`      case 'services': return services;
      case 'games': return games;`, 1);
rep("install-handler",
`  // Filter by query
  const filteredData = useMemo(() => {`,
`  const installGame = async (item: any) => {
    const q = item.quad;
    if (!q || installingGame) return;
    setInstallingGame(q.head);
    try {
      const gc = require('./game_chunks');
      const r = await gc.fetchGamePuzzle(q.manifestAddress, q.manifestHash, q.head, 'testnet-10');
      if (!r || !r.html) throw new Error((r && r.error) || 'download failed');
      const AS = require('@react-native-async-storage/async-storage').default;
      const raw = await AS.getItem('kv_installed_games');
      const list = raw ? JSON.parse(raw) : [];
      const next = [{ id: q.game || item.name, name: item.name || q.game, installedAt: Date.now(), ...q },
        ...list.filter((g: any) => g.head !== q.head)];
      await AS.setItem('kv_installed_games', JSON.stringify(next));
      Alert.alert('Installed ✓', (item.name || q.game) + ' downloaded and hash-verified. Open it from the Entertainment Center.');
    } catch (e: any) { Alert.alert('Install failed', String(e?.message || e)); }
    setInstallingGame('');
  };

  // Filter by query
  const filteredData = useMemo(() => {`, 1);
rep("time-tiers",
`    const data = getCurrentData();
    if (!query.trim()) return []; // search-first: no auto-populated feed
    
    const q = query.toLowerCase();
    return data.filter((item: any) => {`,
`    const data = getCurrentData();
    if (!query.trim()) return []; // search-first: no auto-populated feed
    
    let q = query.toLowerCase();
    // Time tiers: "shoes week" / "kascity 30 hours" / "dapp 2 days" -> cutoff
    let cutoff = 0;
    const tm = q.match(/(?:last\\s+)?(\\d+)?\\s*(hour|day|week|month)s?\\b/);
    if (tm) {
      const nN = tm[1] ? parseInt(tm[1], 10) : 1;
      const unit: any = { hour: 3600e3, day: 86400e3, week: 604800e3, month: 2592000e3 };
      cutoff = Date.now() - nN * unit[tm[2]];
      q = q.replace(tm[0], '').trim();
    }
    return data.filter((item: any) => {
      if (cutoff && item.t && item.t < cutoff) return false;`, 1);
rep("time-tiers-q",
`      return searchable.includes(q);`,
`      return q ? searchable.includes(q) : true;`, 1);
rep("games-render",
`      case 'services': return <ServiceCard item={item} onPress={onPress} />;`,
`      case 'services': return <ServiceCard item={item} onPress={onPress} />;
      case 'games': return <GameRegistryCard item={item} onInstall={installGame} installing={installingGame === (item.quad && item.quad.head)} />;`, 1);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (" + n + " edits). Games lane + time-tier search live after Metro reload.");
