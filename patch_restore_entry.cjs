// patch_restore_entry.cjs — reachable restore + correct network on fresh install
// Run: node patch_restore_entry.cjs
const fs = require('fs');
const P = 'AppNaviagator.tsx';

let src = fs.readFileSync(P, 'utf8');
const EOL = src.includes('\r\n') ? '\r\n' : '\n';
const before = src;

function rep(name, oldStr, newStr, expect = 1) {
  const n = src.split(oldStr).length - 1;
  if (n !== expect) throw new Error(`[${name}] expected ${expect}, found ${n}`);
  src = src.split(oldStr).join(newStr);
  console.log(`[ok] ${name} (${n})`);
}

// 1. boot: unrecognised device lands on a welcome gate, not straight into the ritual
rep('boot.route',
  "if (!isReturning) {" + EOL + "          setScreen('onboarding');",
  "if (!isReturning) {" + EOL + "          setScreen('welcome');"
);

// 2. new welcome case: choose new identity or restore from cards
rep('welcome.case',
  "    case 'onboarding':",
  [
    "    case 'welcome':",
    "      return (",
    "        <View style={{ flex: 1, backgroundColor: '#0d0d0f', justifyContent: 'center', padding: 28 }}>",
    "          <Text style={{ color: '#e8ddd0', fontSize: 26, fontWeight: '700', marginBottom: 10 }}>KasVillage</Text>",
    "          <Text style={{ color: '#8a8a8a', fontSize: 14, marginBottom: 36 }}>",
    "            Start a new identity, or restore the one you already hold on cards.",
    "          </Text>",
    "          <TouchableOpacity",
    "            onPress={() => setScreen('onboarding')}",
    "            style={{ backgroundColor: '#49b675', padding: 16, borderRadius: 10, marginBottom: 14 }}",
    "          >",
    "            <Text style={{ color: '#0d0d0f', fontSize: 16, fontWeight: '700', textAlign: 'center' }}>",
    "              New identity",
    "            </Text>",
    "          </TouchableOpacity>",
    "          <TouchableOpacity",
    "            onPress={() => setScreen('vault_recovery')}",
    "            style={{ borderColor: '#49b675', borderWidth: 1, padding: 16, borderRadius: 10 }}",
    "          >",
    "            <Text style={{ color: '#49b675', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>",
    "              Restore from recovery cards",
    "            </Text>",
    "          </TouchableOpacity>",
    "        </View>",
    "      );",
    "",
    "    case 'onboarding':",
  ].join(EOL)
);

// 3. restore network: empty state must not silently mean mainnet
rep('restore.network',
  "const net = kaspaAddress.startsWith('kaspatest:') ? 'testnet-10' : 'mainnet';",
  [
    "const knownAddr = kaspaAddress",
    "                || (await SecureStore.getItemAsync('kv_kaspa_address'))",
    "                || (await SecureStore.getItemAsync('kaspa_address')) || '';",
    "              const knownNet = (await SecureStore.getItemAsync('kaspa_network')) || '';",
    "              // fresh install: nothing known -> testnet-10, never a silent mainnet restore",
    "              const net: 'mainnet' | 'testnet-10' =",
    "                (knownAddr.startsWith('kaspa:') || knownNet === 'mainnet') ? 'mainnet' : 'testnet-10';",
    "              console.log('[Restore] network:', net, 'from addr:', knownAddr.slice(0, 12) || 'none');",
  ].join(EOL)
);

// 4. cancelling restore returns to the welcome gate, not the ritual
rep('restore.cancel',
  "onCancel={() => setScreen('onboarding')}",
  "onCancel={() => setScreen('welcome')}"
);

for (const m of ["case 'welcome':", "const net: 'mainnet' | 'testnet-10'", "[Restore] network:"]) {
  if (!src.includes(m)) throw new Error(`post-condition failed: ${m}`);
}
if (src === before) throw new Error('no changes written');

fs.writeFileSync(P + '.bak2', before, 'utf8');
fs.writeFileSync(P, src, 'utf8');
console.log('[done] backup at ' + P + '.bak2');
