// wire_attestation_v2.cjs
// Attestation → Arweave only. TownHall = stateless read-through to Arweave.
// No bind endpoint. /api/device/check queries Arweave KV-DeviceHash tag.
const fs = require('fs');
const path = require('path');

let changes = 0;

// ── 1. FIX BLE IMPORTS ─────────────────────────────────────────────────────
const bleFile = path.join(__dirname, 'bluetooth_p2p.ts');
if (fs.existsSync(bleFile)) {
  let ble = fs.readFileSync(bleFile, 'utf8');
  
  // Remove peripheral import
  ble = ble.replace(/import Peripheral.*from 'react-native-peripheral';\n?/g, '');

  // Guard ble-plx
  if (ble.includes("from 'react-native-ble-plx'") && !ble.includes('// BLE_NATIVE_REQUIRED')) {
    ble = ble.replace(
      "import { BleManager, Device, State } from 'react-native-ble-plx';",
      `// BLE_NATIVE_REQUIRED: needs EAS dev build
let BleManager: any, Device: any, State: any;
try {
  const blePlx = require('react-native-ble-plx');
  BleManager = blePlx.BleManager;
  Device = blePlx.Device;
  State = blePlx.State;
} catch (e) {
  console.warn('[BLE] react-native-ble-plx not available — BLE disabled');
  BleManager = class { state() { return 'Unknown'; } startDeviceScan() {} stopDeviceScan() {} destroy() {} onStateChange() { return { remove: () => {} }; } connectToDevice() { throw new Error('BLE not available'); } cancelDeviceConnection() {} };
  State = { PoweredOn: 'PoweredOn', PoweredOff: 'PoweredOff' };
}`
    );
    changes++;
  }
  // Guard ble-advertiser
  if (ble.includes("from 'react-native-ble-advertiser'")) {
    ble = ble.replace(
      "import BLEAdvertiser from 'react-native-ble-advertiser';",
      `let BLEAdvertiser: any;
try { BLEAdvertiser = require('react-native-ble-advertiser').default; } catch { BLEAdvertiser = { setCompanyId: () => {}, broadcast: async () => {}, stopBroadcast: async () => {}, scan: async () => {}, stopScan: async () => {}, addListener: () => ({ remove: () => {} }) }; }`
    );
    changes++;
  }
  fs.writeFileSync(bleFile, ble, 'utf8');
  console.log('✅ bluetooth_p2p.ts: BLE imports guarded');
}

// ── 2. FIX DEVICE ATTESTATION — Arweave only, no TownHall bind ─────────────
const attFiles = ['device_attestation.ts', 'device_attestation_(1).ts', 'device_attestation__1_.ts'];
let attPath = null;
for (const f of attFiles) {
  const p = path.join(__dirname, f);
  if (fs.existsSync(p)) { attPath = p; break; }
}

if (attPath) {
  let att = fs.readFileSync(attPath, 'utf8');

  // Fix URL
  att = att.replace(
    /const TOWN_HALL_URL\s*=\s*'https:\/\/townhall\.kasvillage\.(com|app)';/,
    "const TOWN_HALL_URL         = 'https://kasvillage.app.runonflux.io';"
  );

  // Remove bindDeviceToTownHall function
  att = att.replace(
    /\/\/ =+\n\/\/ TOWN HALL BINDING[\s\S]*?^}/m,
    '// TownHall binding removed — TownHall is stateless, Arweave is source of truth'
  );

  // Remove checkExistingBinding function
  att = att.replace(
    /\/\/ =+\n\/\/ CHECK EXISTING BINDING[\s\S]*?^}/m,
    '// Check binding removed — query Arweave directly'
  );

  // Replace registerDevice with Arweave-only version
  att = att.replace(
    /\/\/ =+\n\/\/ FULL REGISTRATION FLOW[\s\S]*?^}/m,
    `// ============================================================================
// FULL REGISTRATION — Arweave only (TownHall is stateless)
// ============================================================================
// 1. Integrity check
// 2. Generate stable fingerprint
// 3. Get attestation token
// 4. Inscribe to Arweave (permanent proof)
// TownHall reads Arweave when it needs to verify.

export async function registerDevice(
  pubkey: string
): Promise<TownHallBindResult> {
  const integrity = await checkDeviceIntegrity();
  if (!integrity.success) return { success: false, error: 'Device integrity check failed' };
  if (integrity.isEmulator) return { success: false, error: 'Emulators not supported' };

  let deviceHash: string;
  try { deviceHash = await getDeviceHash(); }
  catch { return { success: false, error: 'Could not generate device fingerprint' }; }

  const attestation = await getAttestationToken(pubkey);
  if (!attestation.success) return { success: false, error: attestation.error };

  // Store locally
  await SecureStore.setItemAsync('kv_device_hash', deviceHash);
  await SecureStore.setItemAsync('kv_device_platform', attestation.platform);

  // Derive APT
  let apt = '0';
  try {
    const { deriveApt } = await import('./apt_derivation');
    apt = deriveApt(pubkey);
  } catch {}

  return { success: true, aptNumber: apt };
}`
  );

  // Add Arweave inscription function if not present
  if (!att.includes('inscribeAttestationToArweave')) {
    att += `

// ============================================================================
// ARWEAVE INSCRIPTION — permanent attestation proof
// ============================================================================

export async function inscribeAttestationToArweave(params: {
  pubkey: string;
  privKeyHex: string;
}): Promise<{ txId: string } | null> {
  try {
    const { pubkey, privKeyHex } = params;
    const attestation = await getAttestationToken(pubkey);
    if (!attestation.success) return null;

    let apt = '0';
    try {
      const { deriveApt } = await import('./apt_derivation');
      apt = deriveApt(pubkey);
    } catch {}

    const payload = JSON.stringify({
      v: 2,
      device_hash: attestation.deviceHash,
      platform: attestation.platform,
      pubkey,
      apt,
      timestamp: Date.now(),
    });

    const tags = [
      { name: 'App-Name', value: 'KasVillage' },
      { name: 'KV-Type', value: 'device-attestation' },
      { name: 'KV-DeviceHash', value: attestation.deviceHash },
      { name: 'KV-Pubkey', value: pubkey },
      { name: 'KV-Platform', value: attestation.platform },
      { name: 'KV-Apt', value: apt },
      { name: 'Content-Type', value: 'application/json' },
    ];

    const { buildAns104Item, uploadToIrys } = await import('./arweave_upload');
    const data = new TextEncoder().encode(payload);
    const result = await buildAns104Item(data, tags, privKeyHex).then(uploadToIrys);

    if (result?.txId) {
      console.log('[Attestation] Inscribed to Arweave:', result.txId);
      await SecureStore.setItemAsync('kv_attestation_arweave_tx', result.txId);
      return { txId: result.txId };
    }
    return null;
  } catch (e) {
    console.error('[Attestation] Arweave inscription failed:', e);
    return null;
  }
}

// ============================================================================
// CHECK EXISTING ATTESTATION — query Arweave directly
// ============================================================================

export async function checkExistingAttestation(
  deviceHash: string
): Promise<{ exists: boolean; pubkey?: string; apt?: string }> {
  try {
    const query = \`{
      transactions(
        tags: [
          { name: "App-Name", values: ["KasVillage"] },
          { name: "KV-Type", values: ["device-attestation"] },
          { name: "KV-DeviceHash", values: ["\${deviceHash}"] }
        ],
        sort: HEIGHT_DESC,
        first: 1
      ) {
        edges { node { tags { name value } } }
      }
    }\`;
    const res = await fetch('https://arweave.net/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return { exists: false };
    const data = await res.json();
    const tags = data?.data?.transactions?.edges?.[0]?.node?.tags;
    if (!tags) return { exists: false };
    const pubkey = tags.find((t: {name:string}) => t.name === 'KV-Pubkey')?.value;
    const apt = tags.find((t: {name:string}) => t.name === 'KV-Apt')?.value;
    return { exists: true, pubkey, apt };
  } catch {
    return { exists: false };
  }
}
`;
    changes++;
  }

  // Update default export
  att = att.replace(
    /export default \{[\s\S]*?\};/,
    `export default {
  getDeviceHash,
  getDeviceInfo,
  checkDeviceIntegrity,
  getAttestationToken,
  registerDevice,
  inscribeAttestationToArweave,
  checkExistingAttestation,
};`
  );

  fs.writeFileSync(attPath, att, 'utf8');
  changes++;
  console.log('✅', path.basename(attPath), ': Arweave-only (no TownHall bind)');
}

// ── 3. WIRE KV-DeviceHash INTO IDENTITY INSCRIPTION ─────────────────────────
const inscFile = path.join(__dirname, 'identity_inscription_v6.ts');
if (fs.existsSync(inscFile)) {
  let insc = fs.readFileSync(inscFile, 'utf8');
  if (!insc.includes('device_attestation')) {
    insc = insc.replace(
      "import * as SecureStore from 'expo-secure-store';",
      `import * as SecureStore from 'expo-secure-store';
import { getDeviceHash } from './device_attestation';`
    );
    changes++;
  }
  if (!insc.includes('KV-DeviceHash')) {
    const tagPoints = ['KV-Apt', 'KV-Address', 'KV-Network'];
    for (const tag of tagPoints) {
      const re = new RegExp(`(.*name: '${tag}'.*),`);
      const m = insc.match(re);
      if (m) {
        insc = insc.replace(m[0], m[0] + `\n    { name: 'KV-DeviceHash',   value: await getDeviceHash().catch(() => 'unknown') },`);
        changes++;
        break;
      }
    }
  }
  fs.writeFileSync(inscFile, insc, 'utf8');
  console.log('✅ identity_inscription_v6.ts: KV-DeviceHash tag added');
}

// ── 4. TOWNHALL: /api/device/check as pure Arweave query ────────────────────
const rsFile = path.join(__dirname, 'townhall_merged.rs');
if (fs.existsSync(rsFile)) {
  let rs = fs.readFileSync(rsFile, 'utf8');
  if (!rs.includes('/api/device/check')) {
    const handler = `
// ── Device Check — stateless Arweave query ──────────────────────────────────

async fn check_device(
    body: web::Json<serde_json::Value>,
) -> impl Responder {
    let device_hash = match body.get("device_hash").and_then(|v| v.as_str()) {
        Some(h) => h.to_string(),
        None => return HttpResponse::BadRequest().json(json!({ "error": "device_hash required" })),
    };

    // Query Arweave for this device hash
    let gql = format!(r#"{{
        transactions(
            tags: [
                {{ name: "App-Name", values: ["KasVillage"] }},
                {{ name: "KV-Type", values: ["device-attestation"] }},
                {{ name: "KV-DeviceHash", values: ["{}"] }}
            ],
            sort: HEIGHT_DESC,
            first: 1
        ) {{
            edges {{ node {{ tags {{ name value }} }} }}
        }}
    }}"#, device_hash);

    let client = reqwest::Client::new();
    match client.post("https://arweave.net/graphql")
        .header("Content-Type", "application/json")
        .body(format!(r#"{{"query": "{}"}}"#, gql.replace('"', r#"\\""#).replace('\n', " ")))
        .send()
        .await
    {
        Ok(resp) => {
            if let Ok(data) = resp.json::<serde_json::Value>().await {
                let edges = &data["data"]["transactions"]["edges"];
                if let Some(edge) = edges.as_array().and_then(|a| a.first()) {
                    let tags = &edge["node"]["tags"];
                    let mut pubkey = String::new();
                    let mut apt = String::new();
                    if let Some(arr) = tags.as_array() {
                        for t in arr {
                            match t["name"].as_str() {
                                Some("KV-Pubkey") => pubkey = t["value"].as_str().unwrap_or("").to_string(),
                                Some("KV-Apt") => apt = t["value"].as_str().unwrap_or("").to_string(),
                                _ => {}
                            }
                        }
                    }
                    return HttpResponse::Ok().json(json!({
                        "bound": true,
                        "pubkey": pubkey,
                        "apt_number": apt,
                        "source": "arweave"
                    }));
                }
            }
            HttpResponse::Ok().json(json!({ "bound": false }))
        }
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "error": format!("Arweave query failed: {}", e)
        })),
    }
}
`;
    rs = rs.replace(
      'async fn register_apt(',
      handler + 'async fn register_apt('
    );
    rs = rs.replace(
      `.route("/api/apt/register", web::post().to(register_apt))`,
      `.route("/api/device/check", web::post().to(check_device))
        .route("/api/apt/register", web::post().to(register_apt))`
    );
    changes++;
    fs.writeFileSync(rsFile, rs, 'utf8');
    console.log('✅ townhall_merged.rs: /api/device/check (pure Arweave query)');
  }
}

console.log(`\n✅ Done — ${changes} changes`);
console.log('   Flow: registerDevice → inscribeAttestationToArweave → permanent');
console.log('   TownHall /api/device/check → queries Arweave → returns pubkey/apt');
console.log('   No state stored on TownHall');
