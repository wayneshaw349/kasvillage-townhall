// ============================================================================
// TEST: SDK INTEGRITY VERIFICATION CHAIN
// SDK hash → DApp registration → tamper detection → wallet verification
// Run: node test_sdk_integrity.js
// ============================================================================

const crypto = require('crypto');
const fs = require('fs');

// ============================================================================
// SIMULATED STORAGE
// ============================================================================

const arweaveStore = [];
const townhallRegistry = {};  // dappId → { codeHash, sdkHash, pubkey, verified, xp }

// ============================================================================
// HELPERS
// ============================================================================

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function sha256File(content) {
  return sha256(typeof content === 'string' ? content : JSON.stringify(content));
}

// Simulate signing (in production: secp256k1)
function sign(message, privateKey) {
  return sha256(privateKey + ':' + message);
}

function verifySignature(message, signature, publicKey, privateKey) {
  return sha256(privateKey + ':' + message) === signature;
}

function arweaveInscribe(tags, payload) {
  const txId = 'AR_' + sha256(JSON.stringify(tags) + Date.now() + Math.random()).slice(0, 20);
  arweaveStore.push({ txId, tags, payload, timestamp: Date.now() });
  return txId;
}

function arweaveQuery(filterTags) {
  return arweaveStore.filter(entry =>
    Object.entries(filterTags).every(([k, v]) => {
      const tag = entry.tags.find(t => t.name === k);
      return tag && tag.value === v;
    })
  );
}

// ============================================================================
// SDK PUBLISHER (KasVillage team)
// ============================================================================

function publishSDK(sdkFiles, constraintsCode, publisherPrivKey, publisherPubKey) {
  // Hash each file individually
  const fileHashes = {};
  for (const [name, content] of Object.entries(sdkFiles)) {
    fileHashes[name] = sha256File(content);
  }

  // Hash the constraints specifically (this is the law)
  const constraintsHash = sha256File(constraintsCode);

  // Hash everything together (master SDK hash)
  const allContent = Object.values(sdkFiles).join('') + constraintsCode;
  const sdkMasterHash = sha256(allContent);

  // Sign the master hash
  const signature = sign(sdkMasterHash, publisherPrivKey);

  // Inscribe to Arweave
  const txId = arweaveInscribe([
    { name: 'App-Name', value: 'KasVillage' },
    { name: 'KV-Type', value: 'sdk-release' },
    { name: 'KV-SDKHash', value: sdkMasterHash },
    { name: 'KV-ConstraintsHash', value: constraintsHash },
    { name: 'KV-Publisher', value: publisherPubKey },
    { name: 'KV-Signature', value: signature },
    { name: 'KV-FileCount', value: String(Object.keys(sdkFiles).length) },
    { name: 'KV-Version', value: '1.0.0' },
  ], JSON.stringify({ fileHashes, constraintsHash, sdkMasterHash }));

  return { sdkMasterHash, constraintsHash, fileHashes, txId, signature };
}

// ============================================================================
// TOWNHALL VERIFICATION SERVICE
// ============================================================================

function townhallRegisterDApp(params) {
  const { dappId, codeHash, sdkHash, constraintsHash, pubkey, signature } = params;

  // 1. Verify SDK hash matches published SDK on Arweave
  const sdkRelease = arweaveQuery({ 'KV-Type': 'sdk-release', 'KV-SDKHash': sdkHash });
  if (sdkRelease.length === 0) {
    return { success: false, error: 'SDK hash not found on Arweave — using unauthorized SDK' };
  }

  // 2. Verify constraints hash matches published constraints
  const publishedConstraints = sdkRelease[0].tags.find(t => t.name === 'KV-ConstraintsHash');
  if (!publishedConstraints || publishedConstraints.value !== constraintsHash) {
    return { success: false, error: 'Constraints hash mismatch — SDK constraints tampered' };
  }

  // 3. Register the DApp
  townhallRegistry[dappId] = {
    codeHash,
    sdkHash,
    constraintsHash,
    pubkey,
    signature,
    registeredAt: Date.now(),
    verified: true,
    xp: 100, // starting XP
  };

  // 4. Inscribe registration to Arweave
  arweaveInscribe([
    { name: 'App-Name', value: 'KasVillage' },
    { name: 'KV-Type', value: 'dapp-registration' },
    { name: 'KV-DAppId', value: dappId },
    { name: 'KV-CodeHash', value: codeHash },
    { name: 'KV-SDKHash', value: sdkHash },
    { name: 'KV-ConstraintsHash', value: constraintsHash },
    { name: 'KV-Pubkey', value: pubkey },
  ], { dappId, codeHash, sdkHash });

  return { success: true, dappId };
}

function townhallVerifyDApp(dappId, currentCodeHash) {
  const registration = townhallRegistry[dappId];
  if (!registration) {
    return { verified: false, error: 'DApp not registered' };
  }

  // Check code hasn't changed since registration
  if (registration.codeHash !== currentCodeHash) {
    // XP slashed
    registration.xp = Math.max(0, registration.xp - 50);
    registration.verified = false;
    return {
      verified: false,
      error: 'Code hash mismatch — DApp code changed since registration',
      xpSlashed: 50,
      remainingXp: registration.xp,
    };
  }

  return { verified: true, dappId, xp: registration.xp };
}

function townhallVerifySDKIntegrity(sdkHash, constraintsHash) {
  const sdkRelease = arweaveQuery({ 'KV-Type': 'sdk-release', 'KV-SDKHash': sdkHash });
  if (sdkRelease.length === 0) return { valid: false, error: 'SDK not found on Arweave' };

  const publishedConstraints = sdkRelease[0].tags.find(t => t.name === 'KV-ConstraintsHash');
  if (publishedConstraints.value !== constraintsHash) {
    return { valid: false, error: 'Constraints tampered' };
  }

  return { valid: true, sdkHash, constraintsHash, arweaveTx: sdkRelease[0].txId };
}

// ============================================================================
// WALLET VERIFICATION (runs on user's device)
// ============================================================================

function walletVerifyDApp(dappId, currentCodeHash) {
  // Wallet checks TownHall registry
  const result = townhallVerifyDApp(dappId, currentCodeHash);

  if (!result.verified) {
    return {
      safe: false,
      warning: 'This DApp has been modified since verification. Proceed with caution.',
      error: result.error,
    };
  }

  // Also verify SDK hash on Arweave independently
  const reg = townhallRegistry[dappId];
  const sdkCheck = townhallVerifySDKIntegrity(reg.sdkHash, reg.constraintsHash);

  if (!sdkCheck.valid) {
    return {
      safe: false,
      warning: 'SDK integrity check failed on Arweave.',
      error: sdkCheck.error,
    };
  }

  return {
    safe: true,
    dappId,
    sdkVerified: true,
    codeVerified: true,
    arweaveTx: sdkCheck.arweaveTx,
  };
}

// ============================================================================
// TEST RUNNER
// ============================================================================

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}: ${e.message}`); failed++; }
}
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

// ============================================================================
// SETUP
// ============================================================================

const PUBLISHER_PRIVKEY = 'kasvillage_publisher_private_key_hex';
const PUBLISHER_PUBKEY = '02kasvillage_publisher_pubkey';

const DEV_PRIVKEY = 'developer_private_key_hex';
const DEV_PUBKEY = '02developer_pubkey_abc123';

// Simulated SDK files (in production, these are the actual .ts files)
const SDK_FILES = {
  'kasvillage_avatar_engine.ts': 'export function deriveJoints() { /* 1649 lines */ }',
  'kasvillage_canvas_renderer.ts': 'export function renderFrame() { /* 692 lines */ }',
  'kasvillage_environments.ts': 'export function generateRoom() { /* 988 lines */ }',
  'kasvillage_particles.ts': 'export class ParticleSystem { /* 737 lines */ }',
  'kasvillage_wallet_bridge.ts': 'export async function readWalletProfile() { /* 347 lines */ }',
};

const CONSTRAINTS_CODE = `
// KASVILLAGE SDK CONSTRAINTS v1.0
// These rules MUST be enforced by all DApps
export const CONSTRAINTS = {
  MAX_ITEM_PRICE_KAS: 100000,
  MIN_COLLATERAL_PCT: 5,
  MAX_COLLATERAL_PCT: 200,
  REQUIRE_AVATAR_HASH: true,
  REQUIRE_PUBKEY_BINDING: true,
  ALLOW_CUSTOM_ASSETS: false,
  PROCEDURAL_ONLY: true,
  NO_EXTERNAL_IMAGES: true,
  NO_EXTERNAL_SCRIPTS: true,
  MUST_VERIFY_ON_TOWNHALL: true,
  XP_THRESHOLD_DAPP: 500,
  DEADLOCK_XP_PENALTY: 50,
};
`;

// Simulated DApp code
const DAPP_CODE = `
import { CONSTRAINTS } from 'kasvillage-procedural-sdk/constraints';
import { readWalletProfile, initGameSession } from 'kasvillage-procedural-sdk';

export function startGame() {
  const profile = readWalletProfile();
  const session = initGameSession(profile);
  // Game logic using SDK constraints
  if (session.itemPrice > CONSTRAINTS.MAX_ITEM_PRICE_KAS) throw new Error('Price exceeds limit');
}
`;

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  SDK INTEGRITY VERIFICATION CHAIN TEST                 ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// ============================================================================
// PHASE 1: Publish SDK
// ============================================================================

console.log('PHASE 1: Publish SDK to Arweave');

const published = publishSDK(SDK_FILES, CONSTRAINTS_CODE, PUBLISHER_PRIVKEY, PUBLISHER_PUBKEY);

test('SDK master hash generated', () => assert(published.sdkMasterHash.length === 64));
test('Constraints hash generated', () => assert(published.constraintsHash.length === 64));
test('File hashes generated for each file', () => assert(Object.keys(published.fileHashes).length === 5));
test('SDK inscribed to Arweave', () => assert(published.txId.startsWith('AR_')));
test('Arweave has sdk-release record', () => {
  const found = arweaveQuery({ 'KV-Type': 'sdk-release', 'KV-SDKHash': published.sdkMasterHash });
  assert(found.length === 1);
});
test('Arweave record has constraints hash', () => {
  const found = arweaveQuery({ 'KV-Type': 'sdk-release' });
  const tag = found[0].tags.find(t => t.name === 'KV-ConstraintsHash');
  assert(tag.value === published.constraintsHash);
});

// ============================================================================
// PHASE 2: Developer registers DApp
// ============================================================================

console.log('\nPHASE 2: Developer Registers DApp');

const dappCodeHash = sha256File(DAPP_CODE);
const dappId = 'DAPP_' + Date.now();

const regResult = townhallRegisterDApp({
  dappId,
  codeHash: dappCodeHash,
  sdkHash: published.sdkMasterHash,
  constraintsHash: published.constraintsHash,
  pubkey: DEV_PUBKEY,
  signature: sign(dappCodeHash, DEV_PRIVKEY),
});

test('DApp registration succeeds', () => assert(regResult.success));
test('DApp registered on TownHall', () => assert(townhallRegistry[dappId]));
test('DApp inscribed to Arweave', () => {
  const found = arweaveQuery({ 'KV-Type': 'dapp-registration', 'KV-DAppId': dappId });
  assert(found.length === 1);
});

// ============================================================================
// PHASE 3: Wallet verifies DApp (clean)
// ============================================================================

console.log('\nPHASE 3: Wallet Verifies DApp (clean — no tampering)');

const walletCheck = walletVerifyDApp(dappId, dappCodeHash);

test('Wallet says DApp is safe', () => assert(walletCheck.safe === true));
test('SDK verified on Arweave', () => assert(walletCheck.sdkVerified === true));
test('Code verified on TownHall', () => assert(walletCheck.codeVerified === true));

// ============================================================================
// PHASE 4: Developer tampers with DApp code
// ============================================================================

console.log('\nPHASE 4: Developer Tampers with DApp Code');

const TAMPERED_DAPP_CODE = DAPP_CODE + '\n// HACK: bypass price limit\nCONSTRAINTS.MAX_ITEM_PRICE_KAS = 999999;';
const tamperedHash = sha256File(TAMPERED_DAPP_CODE);

test('Tampered code has different hash', () => assert(tamperedHash !== dappCodeHash));

const tamperedCheck = walletVerifyDApp(dappId, tamperedHash);

test('Wallet detects tampered code', () => assert(tamperedCheck.safe === false));
test('Warning mentions modification', () => assert(tamperedCheck.warning.includes('modified')));
test('XP slashed on TownHall', () => assert(townhallRegistry[dappId].xp === 50));
test('DApp marked as unverified', () => assert(townhallRegistry[dappId].verified === false));

// ============================================================================
// PHASE 5: Attacker uses modified SDK
// ============================================================================

console.log('\nPHASE 5: Attacker Uses Modified SDK');

const MODIFIED_SDK = { ...SDK_FILES };
MODIFIED_SDK['kasvillage_avatar_engine.ts'] = 'export function deriveJoints() { /* MODIFIED: skip signature check */ }';

const MODIFIED_CONSTRAINTS = CONSTRAINTS_CODE.replace('PROCEDURAL_ONLY: true', 'PROCEDURAL_ONLY: false');

const modifiedSDKHash = sha256(Object.values(MODIFIED_SDK).join('') + MODIFIED_CONSTRAINTS);
const modifiedConstraintsHash = sha256File(MODIFIED_CONSTRAINTS);

test('Modified SDK has different hash', () => assert(modifiedSDKHash !== published.sdkMasterHash));
test('Modified constraints has different hash', () => assert(modifiedConstraintsHash !== published.constraintsHash));

// Attacker tries to register DApp with modified SDK
const attackRegResult = townhallRegisterDApp({
  dappId: 'DAPP_ATTACK',
  codeHash: sha256File('malicious code'),
  sdkHash: modifiedSDKHash,
  constraintsHash: modifiedConstraintsHash,
  pubkey: '02attacker',
  signature: 'fake_sig',
});

test('TownHall rejects modified SDK', () => assert(attackRegResult.success === false));
test('Error mentions unauthorized SDK', () => assert(attackRegResult.error.includes('not found on Arweave')));

// ============================================================================
// PHASE 6: Attacker uses real SDK but modified constraints
// ============================================================================

console.log('\nPHASE 6: Attacker Uses Real SDK Hash but Modified Constraints');

const sneakyRegResult = townhallRegisterDApp({
  dappId: 'DAPP_SNEAKY',
  codeHash: sha256File('sneaky code'),
  sdkHash: published.sdkMasterHash,  // correct SDK hash
  constraintsHash: modifiedConstraintsHash,  // wrong constraints
  pubkey: '02sneaky',
  signature: 'fake_sig',
});

test('TownHall rejects mismatched constraints', () => assert(sneakyRegResult.success === false));
test('Error mentions constraints tampered', () => assert(sneakyRegResult.error.includes('Constraints hash mismatch')));

// ============================================================================
// PHASE 7: SDK version upgrade
// ============================================================================

console.log('\nPHASE 7: SDK Version Upgrade');

const SDK_V2_FILES = { ...SDK_FILES, 'kasvillage_new_feature.ts': 'export function newFeature() {}' };
const CONSTRAINTS_V2 = CONSTRAINTS_CODE.replace("'1.0'", "'2.0'");

const publishedV2 = publishSDK(SDK_V2_FILES, CONSTRAINTS_V2, PUBLISHER_PRIVKEY, PUBLISHER_PUBKEY);

test('V2 has different master hash', () => assert(publishedV2.sdkMasterHash !== published.sdkMasterHash));
test('V2 inscribed to Arweave', () => {
  const found = arweaveQuery({ 'KV-Type': 'sdk-release', 'KV-SDKHash': publishedV2.sdkMasterHash });
  assert(found.length === 1);
});

// DApp using V2 can register
const v2RegResult = townhallRegisterDApp({
  dappId: 'DAPP_V2',
  codeHash: sha256File('v2 dapp code'),
  sdkHash: publishedV2.sdkMasterHash,
  constraintsHash: publishedV2.constraintsHash,
  pubkey: DEV_PUBKEY,
  signature: sign('v2 dapp code', DEV_PRIVKEY),
});

test('V2 DApp registers successfully', () => assert(v2RegResult.success));

// Both V1 and V2 SDKs coexist on Arweave
test('Both SDK versions on Arweave', () => {
  const all = arweaveQuery({ 'KV-Type': 'sdk-release' });
  assert(all.length === 2);
});

// ============================================================================
// PHASE 8: Full chain verification
// ============================================================================

console.log('\nPHASE 8: Full Chain Verification');

test('Chain: SDK hash on Arweave (immutable)', () => {
  const found = arweaveQuery({ 'KV-Type': 'sdk-release', 'KV-SDKHash': published.sdkMasterHash });
  assert(found.length === 1);
});

test('Chain: Constraints hash matches SDK release', () => {
  const sdkIntegrity = townhallVerifySDKIntegrity(published.sdkMasterHash, published.constraintsHash);
  assert(sdkIntegrity.valid);
});

test('Chain: DApp code hash on TownHall', () => {
  assert(townhallRegistry[dappId].codeHash === dappCodeHash);
});

test('Chain: DApp registration on Arweave', () => {
  const found = arweaveQuery({ 'KV-Type': 'dapp-registration', 'KV-DAppId': dappId });
  assert(found.length === 1);
});

test('Chain: Wallet can verify full chain independently', () => {
  // Reset DApp to clean state for this test
  townhallRegistry[dappId].verified = true;
  townhallRegistry[dappId].codeHash = dappCodeHash;
  const fullCheck = walletVerifyDApp(dappId, dappCodeHash);
  assert(fullCheck.safe === true);
  assert(fullCheck.sdkVerified === true);
  assert(fullCheck.codeVerified === true);
  assert(fullCheck.arweaveTx);
});

// ============================================================================
// PHASE 9: Edge cases
// ============================================================================

console.log('\nPHASE 9: Edge Cases');

test('Unregistered DApp rejected', () => {
  const check = walletVerifyDApp('DAPP_NONEXISTENT', 'somehash');
  assert(check.safe === false);
});

test('Empty code hash rejected', () => {
  const check = townhallVerifyDApp(dappId, '');
  assert(check.verified === false);
});

test('SDK hash not on Arweave → rejected', () => {
  const check = townhallVerifySDKIntegrity('fake_sdk_hash', 'fake_constraints');
  assert(!check.valid);
});

test('Same developer can register multiple DApps', () => {
  const reg2 = townhallRegisterDApp({
    dappId: 'DAPP_SECOND',
    codeHash: sha256File('second app code'),
    sdkHash: published.sdkMasterHash,
    constraintsHash: published.constraintsHash,
    pubkey: DEV_PUBKEY,
    signature: sign('second', DEV_PRIVKEY),
  });
  assert(reg2.success);
});

test('Repeated tampering drains all XP', () => {
  // First tamper already took 50 XP (phase 4), now at 50
  townhallVerifyDApp(dappId, 'tamper2');  // -50 → 0
  assert(townhallRegistry[dappId].xp === 0);
  townhallVerifyDApp(dappId, 'tamper3');  // can't go below 0
  assert(townhallRegistry[dappId].xp === 0);
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log(`║  RESULTS: ${passed} passed, ${failed} failed${' '.repeat(Math.max(0, 30 - String(passed).length - String(failed).length))}║`);
console.log('╚══════════════════════════════════════════════════════════╝');

if (failed > 0) {
  console.log('\n⚠️  FAILURES');
  process.exit(1);
} else {
  console.log('\n✅ ALL TESTS PASS\n');

  console.log('--- VERIFICATION CHAIN ---');
  console.log('  1. KasVillage publishes SDK → SHA256 hash inscribed to Arweave (permanent)');
  console.log('  2. Constraints hash embedded in SDK release (separate, verifiable)');
  console.log('  3. Developer registers DApp → TownHall checks sdkHash + constraintsHash against Arweave');
  console.log('  4. If SDK or constraints modified → TownHall rejects registration');
  console.log('  5. DApp code hash recorded → any future change detected');
  console.log('  6. User wallet verifies DApp before interacting:');
  console.log('     a. Code hash matches TownHall registry');
  console.log('     b. SDK hash matches Arweave');
  console.log('     c. Constraints hash matches published SDK');
  console.log('  7. Tampering → XP slashed, DApp unverified, wallet warns user');

  console.log('\n--- WHAT THIS PREVENTS ---');
  console.log('  ✗ Developer modifies SDK constraints → REJECTED');
  console.log('  ✗ Developer modifies DApp code after registration → DETECTED, XP slashed');
  console.log('  ✗ Attacker uses unauthorized SDK → REJECTED (hash not on Arweave)');
  console.log('  ✗ Attacker uses real SDK hash with fake constraints → REJECTED (hash mismatch)');
  console.log('  ✗ DApp serves different code to users → wallet detects hash mismatch');

  console.log('\n--- ARWEAVE RECORDS ---');
  console.log('  Total inscriptions:', arweaveStore.length);
  arweaveStore.forEach((e, i) => {
    const tagMap = {};
    e.tags.forEach(t => tagMap[t.name] = t.value);
    console.log(`  ${i+1}. ${tagMap['KV-Type']} | ${tagMap['KV-DAppId'] || tagMap['KV-SDKHash']?.slice(0, 16) || '—'}`);
  });
}
