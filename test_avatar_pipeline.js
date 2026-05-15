// ============================================================================
// AVATAR SVG FULL PIPELINE TEST (generate → store → upload → recover → verify)
// Run: node test_avatar_pipeline.js
// ============================================================================

const crypto = require('crypto');

// ============================================================================
// SIMULATED STORAGE
// ============================================================================
const secureStore = {};
const arweaveStore = [];

// ============================================================================
// AVATAR GENERATOR (mirrors avatar_silhouette_generator.tsx)
// ============================================================================

function seededRandom(seed) { const x = Math.sin(seed++) * 10000; return x - Math.floor(x); }

function deriveSeed(pk) {
  let h = 0;
  for (let i = 0; i < pk.length; i++) h = (Math.imul(31, h) + pk.charCodeAt(i)) >>> 0;
  return h;
}

function generateHumanSilhouette(gender, seed) {
  const p = gender === 'male'
    ? { shoulderWidth: 1.15, hipWidth: 0.88, waistWidth: 0.95, neckWidth: 1.1, jawWidth: 1.08 }
    : { shoulderWidth: 0.92, hipWidth: 1.08, waistWidth: 0.8, neckWidth: 0.88, jawWidth: 0.94 };
  const paths = [];
  let s = seed;
  const r = () => seededRandom(s++);
  const cx = 200, baseY = 45, headW = 36 * p.jawWidth, headH = 46;

  let skull = `M ${cx} ${baseY}`;
  for (let i = 0; i <= 30; i++) {
    const a = (i / 30) * Math.PI, v = (r() - 0.5) * 2;
    const rx = headW * (0.95 + r() * 0.04), ry = headH * 0.52;
    skull += ` L ${(cx + Math.sin(a) * rx + v).toFixed(1)} ${(baseY + 4 - Math.cos(a) * ry).toFixed(1)}`;
  }
  skull += ' Z'; paths.push(skull);

  const nW = 12 * p.neckWidth, nT = baseY + headH * 0.85, nB = nT + 18;
  paths.push(`M ${cx - nW} ${nT} L ${cx - nW - 2} ${nB} L ${cx + nW + 2} ${nB} L ${cx + nW} ${nT} Z`);

  const sW = 65 * p.shoulderWidth, sY = nB + 2, wY = sY + 100, wW = 40 * p.waistWidth, hY = wY + 30, hW = 50 * p.hipWidth;
  paths.push(`M ${cx - sW} ${sY} C ${cx - sW + 5} ${wY - 30} ${cx - wW - 5} ${wY - 10} ${cx - wW} ${wY} L ${cx - hW} ${hY} L ${cx + hW} ${hY} L ${cx + wW} ${wY} C ${cx + wW + 5} ${wY - 10} ${cx + sW - 5} ${wY - 30} ${cx + sW} ${sY} Z`);

  const aL = 130 + r() * 20, lx = cx - sW - 8, rx2 = cx + sW + 8;
  paths.push(`M ${lx} ${sY + 5} L ${lx - 18} ${sY + aL} L ${lx - 8} ${sY + aL + 12} L ${lx + 10} ${sY + 5} Z`);
  paths.push(`M ${rx2} ${sY + 5} L ${rx2 + 18} ${sY + aL} L ${rx2 + 8} ${sY + aL + 12} L ${rx2 - 10} ${sY + 5} Z`);

  const lT = hY, lL = 140 + r() * 15, lgW = 20;
  paths.push(`M ${cx - hW + 5} ${lT} L ${cx - hW - 8} ${lT + lL} L ${cx - hW + lgW} ${lT + lL} L ${cx - 5} ${lT} Z`);
  paths.push(`M ${cx + 5} ${lT} L ${cx + hW - lgW} ${lT + lL} L ${cx + hW + 8} ${lT + lL} L ${cx + hW - 5} ${lT} Z`);

  return paths;
}

function computeAvatarHash(paths) {
  return crypto.createHash('sha256').update(JSON.stringify(paths)).digest('hex');
}

function buildSVGFromPaths(paths, fill = '#1a1a2e', stroke = '#8b5cf6') {
  const p = paths.map(d => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="0.5" opacity="0.95"/>`).join('\n');
  return `<svg width="400" height="450" viewBox="0 0 400 450" xmlns="http://www.w3.org/2000/svg">\n<g>\n${p}\n</g>\n</svg>`;
}

// ============================================================================
// SIMULATED ARWEAVE
// ============================================================================

function arweaveUpload(tags, payload) {
  const txId = 'AR_' + crypto.createHash('sha256').update(JSON.stringify(payload) + Date.now() + Math.random()).digest('hex').slice(0, 20);
  arweaveStore.push({ txId, tags, payload, timestamp: Date.now() });
  return { success: true, txId, arweaveUrl: `https://arweave.net/${txId}` };
}

function arweaveQuery(filterTags) {
  return arweaveStore.filter(entry =>
    Object.entries(filterTags).every(([key, value]) => {
      const tag = entry.tags.find(t => t.name === key);
      return tag && tag.value === value;
    })
  );
}

// ============================================================================
// SIMULATED FUNCTIONS (mirror the patched code)
// ============================================================================

// storeAvatarLocally
function storeAvatarLocally(identity) {
  secureStore['kv_avatar_identity'] = JSON.stringify(identity);
}

// getStoredAvatar
function getStoredAvatar() {
  const stored = secureStore['kv_avatar_identity'];
  return stored ? JSON.parse(stored) : null;
}

// uploadAvatarSVG (mirrors avatar_arweave_upload.ts)
function uploadAvatarSVG(params) {
  const { paths, hash, race, gender, network } = params;
  const pubkey = secureStore['kaspa_pubkey'] || '';
  const kaspaAddress = secureStore['kaspa_address_tutorial'] || '';

  const commonTags = [
    { name: 'App-Name', value: 'KasVillage' },
    { name: 'KV-Identity', value: hash },
    { name: 'KV-Address', value: kaspaAddress },
    { name: 'KV-Pubkey', value: pubkey },
    { name: 'KV-Race', value: race },
    { name: 'KV-Gender', value: gender },
    { name: 'KV-Network', value: network },
    { name: 'KV-PathCount', value: String(paths.length) },
    { name: 'Unix-Time', value: String(Math.floor(Date.now() / 1000)) },
  ];

  const svgStr = buildSVGFromPaths(paths);
  const svgResult = arweaveUpload(
    [...commonTags, { name: 'Content-Type', value: 'image/svg+xml' }, { name: 'KV-Type', value: 'avatar-svg' }],
    svgStr
  );

  const pathsPayload = JSON.stringify({ paths, hash, race, gender, pathCount: paths.length });
  const pathsResult = arweaveUpload(
    [...commonTags, { name: 'Content-Type', value: 'application/json' }, { name: 'KV-Type', value: 'avatar-paths' }],
    pathsPayload
  );

  return { success: true, svgTxId: svgResult.txId, pathsTxId: pathsResult.txId };
}

// recoverAvatarFromArweave (mirrors the recovery patch)
function recoverAvatarFromArweave(pubkey) {
  if (!pubkey) return { success: false, error: 'No pubkey provided' };

  const results = arweaveQuery({ 'KV-Type': 'avatar-paths', 'KV-Pubkey': pubkey });
  if (results.length === 0) return { success: false, error: 'No avatar found on Arweave' };

  const entry = results[results.length - 1]; // latest
  const tagMap = {};
  entry.tags.forEach(t => tagMap[t.name] = t.value);

  const expectedHash = tagMap['KV-Identity'] || '';
  const race = tagMap['KV-Race'] || 'human';
  const gender = tagMap['KV-Gender'] || 'male';

  const pathsData = JSON.parse(entry.payload);
  const paths = pathsData.paths;

  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return { success: false, error: 'Invalid avatar data' };
  }

  const computedHash = computeAvatarHash(paths);
  if (expectedHash && computedHash !== expectedHash) {
    return { success: false, error: 'Hash mismatch — avatar tampered!' };
  }

  const identity = { paths, hash: computedHash, race, gender, createdAt: Date.now() };
  storeAvatarLocally(identity);

  return { success: true, identity, arweaveTxId: entry.txId };
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

const PUBKEY = '02e9c450fc541f388eb3c0292401560115c56029137ad8207c4875f7d0f296424f';
const ADDRESS = 'kaspatest:qr5ug58u2s0n3r4ncq5jgq2kqy2u2cpfzdadsgrufp6l058jjepy75edjyk84';

// Setup simulated SecureStore
secureStore['kaspa_pubkey'] = PUBKEY;
secureStore['kaspa_address_tutorial'] = ADDRESS;

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  AVATAR SVG FULL PIPELINE TEST                         ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// --- PHASE 1: Generate ---
console.log('PHASE 1: Generate Avatar');
const seed = deriveSeed(PUBKEY);
const paths = generateHumanSilhouette('male', seed);
const hash = computeAvatarHash(paths);

test('Paths generated from pubkey', () => assert(paths.length === 7));
test('Hash is 64-char hex', () => assert(hash.length === 64));
test('Deterministic', () => {
  const p2 = generateHumanSilhouette('male', deriveSeed(PUBKEY));
  assert(computeAvatarHash(p2) === hash);
});

// --- PHASE 2: Store locally ---
console.log('\nPHASE 2: Store Locally (SecureStore)');
const identity = { paths, hash, race: 'human', gender: 'male', createdAt: Date.now() };
storeAvatarLocally(identity);

test('Stored to SecureStore', () => assert(secureStore['kv_avatar_identity']));
test('getStoredAvatar returns identity', () => {
  const loaded = getStoredAvatar();
  assert(loaded && loaded.hash === hash);
});

// --- PHASE 3: Upload to Arweave ---
console.log('\nPHASE 3: Upload to Arweave');
const uploadResult = uploadAvatarSVG({ paths, hash, race: 'human', gender: 'male', network: 'testnet-10' });

test('Upload succeeded', () => assert(uploadResult.success));
test('SVG TX created', () => assert(uploadResult.svgTxId));
test('Paths TX created', () => assert(uploadResult.pathsTxId));
test('SVG on Arweave is valid', () => {
  const found = arweaveQuery({ 'KV-Type': 'avatar-svg', 'KV-Pubkey': PUBKEY });
  assert(found.length === 1);
  assert(found[0].payload.startsWith('<svg'));
});
test('Paths JSON on Arweave is valid', () => {
  const found = arweaveQuery({ 'KV-Type': 'avatar-paths', 'KV-Pubkey': PUBKEY });
  assert(found.length === 1);
  const data = JSON.parse(found[0].payload);
  assert(data.paths.length === 7);
  assert(data.hash === hash);
});
test('Arweave tags include all required fields', () => {
  const found = arweaveQuery({ 'KV-Type': 'avatar-svg', 'KV-Pubkey': PUBKEY });
  const tagMap = {};
  found[0].tags.forEach(t => tagMap[t.name] = t.value);
  assert(tagMap['KV-Identity'] === hash, 'Missing KV-Identity');
  assert(tagMap['KV-Address'] === ADDRESS, 'Missing KV-Address');
  assert(tagMap['KV-Pubkey'] === PUBKEY, 'Missing KV-Pubkey');
  assert(tagMap['KV-Race'] === 'human', 'Missing KV-Race');
  assert(tagMap['KV-Gender'] === 'male', 'Missing KV-Gender');
  assert(tagMap['KV-Network'] === 'testnet-10', 'Missing KV-Network');
  assert(tagMap['KV-PathCount'] === '7', 'Missing KV-PathCount');
  assert(tagMap['Content-Type'] === 'image/svg+xml', 'Wrong Content-Type');
});

// --- PHASE 4: Simulate device wipe ---
console.log('\nPHASE 4: Simulate Device Wipe');
delete secureStore['kv_avatar_identity'];

test('Local avatar cleared', () => assert(getStoredAvatar() === null));

// --- PHASE 5: Recover from Arweave ---
console.log('\nPHASE 5: Recover from Arweave');
const recovery = recoverAvatarFromArweave(PUBKEY);

test('Recovery succeeded', () => assert(recovery.success));
test('Recovered paths match original', () => {
  assert(recovery.identity.paths.length === paths.length);
  assert(recovery.identity.hash === hash);
});
test('Hash verified during recovery', () => {
  assert(computeAvatarHash(recovery.identity.paths) === hash);
});
test('Avatar restored to SecureStore', () => {
  const restored = getStoredAvatar();
  assert(restored && restored.hash === hash);
});
test('Race + gender preserved', () => {
  assert(recovery.identity.race === 'human');
  assert(recovery.identity.gender === 'male');
});

// --- PHASE 6: Tamper detection ---
console.log('\nPHASE 6: Tamper Detection');

// Upload a tampered avatar
const tamperedPaths = [...paths];
tamperedPaths[0] = 'M 0 0 L 999 999 Z';
const tamperedPayload = JSON.stringify({ paths: tamperedPaths, hash, race: 'human', gender: 'male', pathCount: 7 });
arweaveStore.push({
  txId: 'AR_TAMPERED',
  tags: [
    { name: 'App-Name', value: 'KasVillage' },
    { name: 'KV-Type', value: 'avatar-paths' },
    { name: 'KV-Pubkey', value: 'ATTACKER_PUBKEY' },
    { name: 'KV-Identity', value: hash }, // claims original hash but paths are different
  ],
  payload: tamperedPayload,
  timestamp: Date.now(),
});

test('Tampered avatar rejected on recovery', () => {
  const result = recoverAvatarFromArweave('ATTACKER_PUBKEY');
  assert(result.success === false, 'Should have failed!');
  assert(result.error.includes('mismatch'), 'Wrong error: ' + result.error);
});

// --- PHASE 7: Edge cases ---
console.log('\nPHASE 7: Edge Cases');

test('Recovery with empty pubkey fails', () => {
  assert(recoverAvatarFromArweave('').success === false);
});
test('Recovery with unknown pubkey returns not found', () => {
  const r = recoverAvatarFromArweave('02aaaaaaaaaaaaaaaaaaa');
  assert(r.success === false);
  assert(r.error.includes('No avatar found'));
});
test('Developer can query by address', () => {
  const found = arweaveQuery({ 'KV-Type': 'avatar-svg', 'KV-Address': ADDRESS });
  assert(found.length === 1);
});
test('Developer can re-render with custom colors', () => {
  const found = arweaveQuery({ 'KV-Type': 'avatar-paths', 'KV-Pubkey': PUBKEY });
  const data = JSON.parse(found[0].payload);
  const custom = buildSVGFromPaths(data.paths, '#ff0000', '#00ff00');
  assert(custom.includes('fill="#ff0000"'));
  assert(custom.includes('stroke="#00ff00"'));
});

// --- PHASE 8: Size report ---
console.log('\nPHASE 8: Size Report');
const svgSize = buildSVGFromPaths(paths).length;
const pathsSize = JSON.stringify({ paths, hash, race: 'human', gender: 'male', pathCount: 7 }).length;

test('SVG under 5 KB', () => assert(svgSize < 5000, svgSize + ' bytes'));
test('Paths JSON under 5 KB', () => assert(pathsSize < 5000, pathsSize + ' bytes'));
test('Combined under 10 KB (Irys free)', () => assert(svgSize + pathsSize < 10000));

console.log(`\n  SVG:   ${svgSize} bytes (${(svgSize/1024).toFixed(2)} KB)`);
console.log(`  Paths: ${pathsSize} bytes (${(pathsSize/1024).toFixed(2)} KB)`);
console.log(`  Total: ${svgSize + pathsSize} bytes (${((svgSize + pathsSize)/1024).toFixed(2)} KB)`);
console.log(`  Cost:  $0.00 (Irys free tier)`);

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log(`║  RESULTS: ${passed} passed, ${failed} failed${' '.repeat(Math.max(0, 30 - String(passed).length - String(failed).length))}║`);
console.log('╚══════════════════════════════════════════════════════════╝');

if (failed > 0) {
  console.log('\n⚠️  FAILURES — fix before applying patches to local machine');
  process.exit(1);
} else {
  console.log('\n✅ ALL TESTS PASS — safe to apply patches');
  console.log('\nPipeline verified:');
  console.log('  Generate → Store → Upload → Wipe → Recover → Verify ✅');
  console.log('  Tamper detection ✅');
  console.log('  Developer fetch by pubkey + address ✅');
  console.log('  Custom color re-rendering ✅');
}
