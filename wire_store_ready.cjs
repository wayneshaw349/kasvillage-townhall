// wire_store_ready.cjs - App Store / Play fixes from kv_store_check.
//   node wire_store_ready.cjs        (project folder; safe to run twice)
//   then:  npm install   (removes the Bluetooth packages, adds nothing else)
//          npx expo install expo-build-properties
// 1 camera permission text (no microphone)   2 Bluetooth + location removed (app.json + package.json)
// 3 phone-to-phone http removed (IOU / FROST Wi-Fi + Tailscale)   4 "Open Claude Code" + "Build Your Own DApp" buttons removed
// 5 iPhone: no pay sheet inside games/pages  6 relay IPs keep working in release builds (cleartext allowed for http://IP:35816)
const fs = require('fs');
let ok = 0, skip = 0, bad = 0;
function patch(file, steps) {
  if (!fs.existsSync(file)) { console.log('MISSING ' + file); bad++; return; }
  const raw = fs.readFileSync(file, 'utf8'); const CRLF = raw.includes('\r\n');
  let s = raw.replace(/\r\n/g, '\n'); let changed = false;
  for (const [name, mark, fn] of steps) {
    if (s.includes(mark)) { console.log('  skip  ' + name + ' (already done)'); skip++; continue; }
    const n = fn(s);
    if (n === s || !n.includes(mark)) { console.log('  FAIL  ' + name + ' - anchor not found'); bad++; continue; }
    s = n; changed = true; ok++; console.log('  ok    ' + name);
  }
  if (changed) { fs.copyFileSync(file, file + '.bak_store'); fs.writeFileSync(file, CRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8'); }
}
const rep = (a, b) => (s) => s.includes(a) ? s.replace(a, b) : s;
const cutBlock = (start, mark) => (s) => { const i = s.indexOf(start); if (i < 0) return s;
  const end = s.indexOf('</TouchableOpacity>\n', i); if (end < 0) return s;
  return s.slice(0, i) + start.match(/^\s*/)[0] + '{/* ' + mark + ' removed */}\n' + s.slice(end + '</TouchableOpacity>\n'.length); };

// ---------- app.json ----------
console.log('app.json');
(() => {
  const f = 'app.json'; const raw = fs.readFileSync(f, 'utf8'); const j = JSON.parse(raw); const e = j.expo; const did = [];
  e.plugins = e.plugins || [];
  if (!e.plugins.some((p) => (Array.isArray(p) ? p[0] : p) === 'expo-camera')) {
    e.plugins.push(['expo-camera', { cameraPermission: 'KasVillage uses the camera to scan QR codes: payment addresses, vault backup cards and agreement handoffs.', microphonePermission: false, recordAudioAndroid: false }]); did.push('camera text');
  }
  const nb = e.plugins.filter((p) => !/ble/i.test(Array.isArray(p) ? p[0] : p)); if (nb.length !== e.plugins.length) { e.plugins = nb; did.push('Bluetooth plugin'); }
  if (!e.plugins.some((p) => (Array.isArray(p) ? p[0] : p) === 'expo-build-properties')) {
    e.plugins.push(['expo-build-properties', { android: { usesCleartextTraffic: true } }]); did.push('Android: relay IPs allowed');
  }
  const pl = (e.ios = e.ios || {}).infoPlist = e.ios.infoPlist || {};
  for (const k of ['NSBluetoothAlwaysUsageDescription', 'NSBluetoothPeripheralUsageDescription']) if (pl[k]) { delete pl[k]; did.push(k); }
  if (!pl.NSAppTransportSecurity) { pl.NSAppTransportSecurity = { NSAllowsArbitraryLoads: true }; did.push('iOS: relay IPs allowed'); }
  const a = (e.android = e.android || {}); const before = (a.permissions || []).length;
  a.permissions = (a.permissions || []).filter((p) => !/BLUETOOTH|LOCATION/.test(p)); if (a.permissions.length !== before) did.push('Bluetooth + location permissions');
  a.blockedPermissions = Array.from(new Set([...(a.blockedPermissions || []), 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION', 'android.permission.BLUETOOTH_SCAN', 'android.permission.BLUETOOTH_CONNECT', 'android.permission.BLUETOOTH_ADVERTISE', 'android.permission.RECORD_AUDIO']));
  if (did.length) { fs.copyFileSync(f, f + '.bak_store'); fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n', 'utf8'); ok++; console.log('  ok    ' + did.join(', ')); }
  else { skip++; console.log('  skip  app.json (already done)'); }
})();

// ---------- package.json ----------
console.log('package.json');
(() => {
  const f = 'package.json'; const j = JSON.parse(fs.readFileSync(f, 'utf8')); const gone = [];
  for (const k of ['react-native-ble-plx', 'react-native-ble-advertiser', 'react-native-ble-peripheral']) if (j.dependencies && j.dependencies[k]) { delete j.dependencies[k]; gone.push(k); }
  if (gone.length) { fs.copyFileSync(f, f + '.bak_store'); fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n', 'utf8'); ok++; console.log('  ok    removed ' + gone.join(', ') + '  -> run: npm install'); }
  else { skip++; console.log('  skip  Bluetooth packages (already removed)'); }
})();

// ---------- Bluetooth code: no module names left for the bundler to look for ----------
console.log('bluetooth_p2p.ts');
patch('bluetooth_p2p.ts', [
  ['BLE manager off', 'KV_NO_BLE_P2P', rep("  const blePlx = require('react-native-ble-plx');", "  const blePlx: any = null; if (!blePlx) throw new Error('Bluetooth removed'); /* KV_NO_BLE_P2P */")],
  ['BLE advertiser off', 'KV_NO_BLE_ADV', rep("try { BLEAdvertiser = require('react-native-ble-advertiser').default; }", "try { BLEAdvertiser = (null as any).default; /* KV_NO_BLE_ADV */ }")],
]);
console.log('tailscaleHelper.ts');
patch('tailscaleHelper.ts', [
  ['BLE off', 'KV_NO_BLE_TS', (s) => s.replace("const { BleManager } = require('react-native-ble-plx');", "const { BleManager } = (null as any); /* KV_NO_BLE_TS */").replace("require('react-native-ble-peripheral').default", "(null as any).default")],
]);
console.log('IOUBalanceSheetShare.tsx (Bluetooth import)');
patch('IOUBalanceSheetShare.tsx', [
  ['BLE import off', 'KV_NO_BLE_IMP', rep("const { BleManager } = await import('react-native-ble-plx');", "const { BleManager } = (null as any); /* KV_NO_BLE_IMP */")],
]);

// ---------- phone-to-phone http ----------
console.log('IOUBalanceSheetShare.tsx');
patch('IOUBalanceSheetShare.tsx', [
  ['no Tailscale send', 'KV_NO_LAN_TS', rep('async function sendViaTailscale(pubkey: string, payload: string): Promise<boolean> {\n',
    'async function sendViaTailscale(pubkey: string, payload: string): Promise<boolean> {\n  if (pubkey !== null) return false; /* KV_NO_LAN_TS: removed - share the IOU file instead */\n')],
  ['no Wi-Fi send', 'KV_NO_LAN_WIFI', rep('async function sendViaWiFi(pubkey: string, payload: string): Promise<boolean> {\n',
    'async function sendViaWiFi(pubkey: string, payload: string): Promise<boolean> {\n  if (pubkey !== null) return false; /* KV_NO_LAN_WIFI: removed - share the IOU file instead */\n')],
  ['no Bluetooth send', 'KV_NO_BLE_IOU', rep('async function sendViaBluetooth(pubkey: string, payload: string): Promise<boolean> {\n',
    'async function sendViaBluetooth(pubkey: string, payload: string): Promise<boolean> {\n  if (pubkey !== null) return false; /* KV_NO_BLE_IOU: Bluetooth removed */\n')],
]);
console.log('frost_complete.ts');
patch('frost_complete.ts', [
  ['no Wi-Fi peer connect', 'KV_NO_LAN_FROST', rep("  onProgress?.({ phase: 'connecting', progress: 20, message: `Connecting to ${ip}...` });\n  const response = await fetch(`http://${ip}",
    "  if (ip !== null) throw new Error('Wi-Fi pairing was removed - use QR or paste'); /* KV_NO_LAN_FROST */\n  onProgress?.({ phase: 'connecting', progress: 20, message: `Connecting to ${ip}...` });\n  const response = await fetch(`http://${ip}")],
  ['no Tailscale lookup', 'KV_NO_LAN_TSIP', rep('export async function getTailscaleIP(): Promise<string | null> {\n',
    'export async function getTailscaleIP(): Promise<string | null> {\n  if (Date.now() > 0) return null; /* KV_NO_LAN_TSIP: Tailscale removed */\n')],
]);

// ---------- Claude Code buttons ----------
console.log('Workspace.tsx');
patch('Workspace.tsx', [['remove "Open Claude Code"', 'KV_NO_CLAUDE_BTN', cutBlock('            {/* Claude Code Link */}\n', 'KV_NO_CLAUDE_BTN')]]);
console.log('EntertainmentCenter.tsx');
patch('EntertainmentCenter.tsx', [['remove "Build Your Own DApp" (Claude Code link)', 'KV_NO_CLAUDE_CTA', cutBlock('            {/* Build DApp CTA */}\n', 'KV_NO_CLAUDE_CTA')]]);

// ---------- iPhone pay sheet ----------
console.log('OnChainPageView.tsx');
patch('OnChainPageView.tsx', [['iPhone: no pay sheet inside games/pages', 'KV_IOS_PAY', rep("    if (path.startsWith('pay/')) {\n",
  "    if (path.startsWith('pay/')) {\n      if (require('react-native').Platform.OS === 'ios') { setNotice('Payments are not available inside games or pages on iPhone. Use Send in your wallet.'); return; } /* KV_IOS_PAY */\n")]]);

console.log('\n' + ok + ' applied, ' + skip + ' already done, ' + bad + ' failed' + (bad ? '  <- send me this output' : '') +
  '\nNext:  npm install ; npx expo install expo-build-properties ; node kv_store_check.cjs');
