// patch_appnav_frost.cjs — AppNaviagator: wire FROST vault screens
// Adds: imports, screen types, vault state + key helpers, a floating "FROST"
// button on the dashboard (setup / send / co-sign menu), and the three cases.
const fs = require('fs');
const FILE = 'AppNaviagator.tsx';
let s = fs.readFileSync(FILE, 'utf8');
const orig = s;

const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\n/g, '\\r?\\n');
function patch(name, oldStr, newStr) {
  const re = new RegExp(esc(oldStr), 'g');
  const m = s.match(re);
  if (!m || m.length !== 1) throw new Error(`[${name}] expected 1 match, got ${m ? m.length : 0}`);
  s = s.replace(re, () => newStr);
  console.log(`[${name}] OK`);
}
const skip = (name, test) => { if (test) { console.log(`[${name}] already applied, skip`); return true; } return false; };

// --- A: imports ---
if (!skip('imports', /VaultQRSignScreen/.test(s)))
patch('imports',
`import { GenerateVaultScreen } from './GenerateVaultScreen';`,
`import { GenerateVaultScreen } from './GenerateVaultScreen';
import { VaultSetupScreen, loadFrostVault } from './VaultSetupScreen';
import { VaultQRSignScreen } from './VaultQRSignScreen';
import { VaultCosignScreen } from './VaultCosignScreen';
import type { VaultInfo } from './frost_qr_signer';`);

// --- B: screen type union ---
if (!skip('types', /'vault_setup'/.test(s)))
patch('types',
`  | 'generate_vault';`,
`  | 'generate_vault'
  | 'vault_setup'
  | 'vault_sign'
  | 'vault_cosign';`);

// --- C: vault state + key helpers + FROST menu (before navigation object) ---
if (!skip('helpers', /openFrostMenu/.test(s)))
patch('helpers',
`  const navigation = {`,
`  // ---- FROST vault (2-device signer) ----
  const [frostVault, setFrostVault] = useState<VaultInfo | null>(null);
  useEffect(() => { loadFrostVault().then(setFrostVault).catch(() => {}); }, [screen]);

  const getMyPubkeyHex = useCallback(async () => {
    return (await SecureStore.getItemAsync('kv_public_key'))
      || (await SecureStore.getItemAsync(STORE_KEYS.PUBLIC_KEY))
      || (await SecureStore.getItemAsync('kaspa_pubkey'))
      || '';
  }, []);

  const getPrivKeyHex = useCallback(async () => {
    return (await SecureStore.getItemAsync('kv_private_key'))
      || (await SecureStore.getItemAsync(STORE_KEYS.PRIVATE_KEY))
      || '';
  }, []);

  const openFrostMenu = useCallback(() => {
    if (!frostVault) { setScreen('vault_setup'); return; }
    Alert.alert(
      'FROST Vault',
      frostVault.address.slice(0, 28) + '...\\nverify: ' + frostVault.verificationCode,
      [
        { text: 'Send (this device builds)', onPress: () => setScreen('vault_sign') },
        { text: 'Co-Sign (this device approves)', onPress: () => setScreen('vault_cosign') },
        { text: 'New vault (replace)', onPress: () => setScreen('vault_setup') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [frostVault]);

  const navigation = {`);

// --- D: wrap dashboard with FROST floating button ---
if (!skip('fab-open', /flex: 1 \}\}>{\/\* frost-wrap \*\/}/.test(s)))
patch('fab-open',
`    case 'dashboard':
      return (
        <Dashboard`,
`    case 'dashboard':
      return (
        <View style={{ flex: 1 }}>{/* frost-wrap */}
        <Dashboard`);

if (!skip('fab-close', /onPress=\{openFrostMenu\}/.test(s)))
patch('fab-close',
`          onNavigateBalanceSheet={() => setScreen('balance_sheet')}
        />
      );`,
`          onNavigateBalanceSheet={() => setScreen('balance_sheet')}
        />
        <TouchableOpacity
          onPress={openFrostMenu}
          style={{ position: 'absolute', bottom: 96, right: 14, backgroundColor: '#14532D', borderRadius: 24, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: '#4ADE80', zIndex: 99 }}
        >
          <Text style={{ color: '#BBF7D0', fontWeight: 'bold', fontSize: 12 }}>{'\\uD83D\\uDD17 FROST'}</Text>
        </TouchableOpacity>
        </View>
      );`);

// --- E: three cases before default ---
if (!skip('cases', /case 'vault_sign':/.test(s)))
patch('cases',
`    default:
      return <LoadingScreen />;
  }
};`,
`    case 'vault_setup':
      return (
        <VaultSetupScreen
          visible={true}
          onClose={() => setScreen('dashboard')}
          getMyPubkey={getMyPubkeyHex}
          network={kaspaAddress.startsWith('kaspatest:') ? 'testnet-10' : 'mainnet'}
          onCreated={(v) => setFrostVault(v)}
        />
      );

    case 'vault_sign':
      return frostVault ? (
        <VaultQRSignScreen
          visible={true}
          onClose={() => setScreen('dashboard')}
          vault={frostVault}
          getPrivateKeyHex={getPrivKeyHex}
          onSuccess={() => setTimeout(() => refreshBalance(), 2000)}
        />
      ) : <LoadingScreen />;

    case 'vault_cosign':
      return frostVault ? (
        <VaultCosignScreen
          visible={true}
          onClose={() => setScreen('dashboard')}
          vault={frostVault}
          getPrivateKeyHex={getPrivKeyHex}
        />
      ) : <LoadingScreen />;

    default:
      return <LoadingScreen />;
  }
};`);

// --- post-conditions ---
if (!/VaultSetupScreen, loadFrostVault/.test(s)) throw new Error('POST: imports missing');
if ((s.match(/case 'vault_setup':/g) || []).length !== 1) throw new Error('POST: vault_setup case count != 1');
if ((s.match(/case 'vault_sign':/g) || []).length !== 1) throw new Error('POST: vault_sign case count != 1');
if ((s.match(/case 'vault_cosign':/g) || []).length !== 1) throw new Error('POST: vault_cosign case count != 1');
if (!/openFrostMenu/.test(s)) throw new Error('POST: openFrostMenu missing');
if (!/frost-wrap/.test(s)) throw new Error('POST: dashboard wrapper missing');
if (s === orig) { console.log('No changes needed (all applied).'); process.exit(0); }

fs.writeFileSync(FILE, s, 'utf8');
console.log('ALL PATCHES APPLIED — run: npx tsc --noEmit');
