// wire_streamer.cjs — Streamer Mode (KV_STREAMER). Idempotent, CRLF-safe.
const fs = require('fs');
const MARK = 'KV_STREAMER';
function patch(file, hunks) {
  let s = fs.readFileSync(file, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
  if (s.includes(MARK)) { console.log('skip (already)', file); return; }
  for (const [a, b] of hunks) {
    const n = s.split(a).length - 1;
    if (n !== 1) { console.error('ANCHOR x' + n + ' in ' + file + ':\n' + a.slice(0, 120)); process.exit(1); }
    s = s.replace(a, () => b);
  }
  if (crlf) s = s.replace(/\n/g, '\r\n');
  fs.writeFileSync(file, s); console.log('patched', file);
}
const IMP = "import { useStreamer, isStreamer, maskAddr, STREAMER_BAL, STREAMER_USD } from './streamer_mode'; // KV_STREAMER\n";

patch('Dashboard.tsx', [
  ["import { getFinancialSummary } from './proposal_share';\n", "import { getFinancialSummary } from './proposal_share';\n" + IMP],
  ["  const usdValue = kasBalance * usdPerKas;\n", "  const usdValue = kasBalance * usdPerKas;\n  const __sm = useStreamer();\n"],
  ["          {kasBalance.toFixed(4)} KASPA\n", "          {__sm ? STREAMER_BAL : kasBalance.toFixed(4) + ' KASPA'}\n"],
  ["<Text style={walletStyles.usdValue}>≈ ${usdValue.toFixed(2)} USD</Text>", "<Text style={walletStyles.usdValue}>{__sm ? STREAMER_USD : '≈ $' + usdValue.toFixed(2) + ' USD'}</Text>"],
  ['{(Number(r.sompi) / 1e8).toFixed(4)} KAS</Text>', "{isStreamer() ? STREAMER_BAL : (Number(r.sompi) / 1e8).toFixed(4) + ' KAS'}</Text>"],
]);

patch('ReceiveScreen.tsx', [
  ["import { useKaspaPrice } from './useKaspaPrice';\n", "import { useKaspaPrice } from './useKaspaPrice';\n" + IMP],
  ["  const [copied, setCopied] = useState(false);\n", "  const [copied, setCopied] = useState(false);\n  const __sm = useStreamer();\n"],
  ["    await Share.share({ message: `My Kaspa address: ${shownAddress}` });", "    if (isStreamer()) return;\n    await Share.share({ message: `My Kaspa address: ${shownAddress}` });"],
  ["      {address && (\n            <View style={styles.qrContainer}>", "      {address && !__sm && (\n            <View style={styles.qrContainer}>"],
  ["<Text style={styles.addressText} selectable>{shortAddress}</Text>", "<Text style={styles.addressText} selectable={!__sm}>{__sm ? maskAddr(shownAddress) : shortAddress}</Text>"],
  ["<Text style={styles.balanceAmount}>{formatKAS(balance)}</Text>\n            {usdPerKas ? (", "<Text style={styles.balanceAmount}>{__sm ? STREAMER_BAL : formatKAS(balance)}</Text>\n            {usdPerKas && !__sm ? ("],
]);

patch('MnemonicExportModal.tsx', [
  ["import * as Clipboard from 'expo-clipboard';\n", "import * as Clipboard from 'expo-clipboard';\n" + IMP],
  ["  if (!visible) return null;\n", "  if (!visible) return null;\n  if (isStreamer()) return (\n    <Modal visible={visible} animationType=\"fade\" transparent onRequestClose={onClose}>\n      <View style={styles.overlay}><View style={styles.modal}>\n        <Text style={styles.title}>🎥 Streamer Mode is on</Text>\n        <Text style={{ color: '#A8A29E', marginVertical: 12 }}>Seed and key export are locked while streaming. Turn Streamer Mode off in Profile first.</Text>\n        <TouchableOpacity onPress={onClose} style={{ padding: 12, alignItems: 'center' }}><Text style={{ color: '#F59E0B', fontWeight: 'bold' }}>Close</Text></TouchableOpacity>\n      </View></View>\n    </Modal>\n  );\n"],
]);

patch('ProfileScreen.tsx', [
  ["import * as Clipboard from 'expo-clipboard';\n", "import * as Clipboard from 'expo-clipboard';\n" + IMP.replace('useStreamer, isStreamer, maskAddr, STREAMER_BAL, STREAMER_USD', 'useStreamer, setStreamer, STREAMER_BAL')],
  ["  const [showAvatar, setShowAvatar] = useState(false);\n", "  const [showAvatar, setShowAvatar] = useState(false);\n  const __sm = useStreamer();\n"],
  ["        {/* Avatar Viewer (hidden by default) */}\n", "        {/* Streamer Mode */}\n        <TouchableOpacity\n          onPress={() => setStreamer(!__sm)}\n          style={{ backgroundColor: __sm ? '#4c1d95' : '#1A1A1A', padding: 12, borderRadius: 8, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: __sm ? '#a78bfa' : '#333' }}\n        >\n          <Text style={{ color: '#fff', fontSize: 14 }}>🎥 Streamer Mode</Text>\n          <Text style={{ color: __sm ? '#a78bfa' : '#888', fontSize: 13, fontWeight: 'bold' }}>{__sm ? 'ON — balances hidden' : 'OFF'}</Text>\n        </TouchableOpacity>\n\n        {/* Avatar Viewer (hidden by default) */}\n"],
  ["{kasBalance.toFixed(4)} KASPA</Text>\n          </View>\n        )}\n\n        {/* XP Progress */}", "{__sm ? STREAMER_BAL : kasBalance.toFixed(4) + ' KASPA'}</Text>\n          </View>\n        )}\n\n        {/* XP Progress */}"],
]);
console.log('Streamer Mode wired.');
