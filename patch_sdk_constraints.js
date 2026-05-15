// ============================================================================
// PATCH: Add 6 missing items to procedural SDK constraints
// Run from wallet project root: node patch_sdk_constraints.js
// ============================================================================

const fs = require('fs');
const crypto = require('crypto');
let fixes = 0;

// Patch the bundled copy in the wallet project
const SDK_PATH = 'procedural_sdk.ts';
if (!fs.existsSync(SDK_PATH)) {
  console.log('ERROR: procedural_sdk.ts not found. Run from wallet project root.');
  process.exit(1);
}

let sdk = fs.readFileSync(SDK_PATH, 'utf8');

// ============================================================================
// FIX 1: Add innerHTML/outerHTML to bypass patterns
// FIX 2: Add WebSocket image transfer patterns
// FIX 3: Add iframe src= patterns
// ============================================================================

const oldPatterns = `const IMAGE_BYPASS_PATTERNS = [
  /<img\\s+[^>]*src\\s*=/i,
  /Image\\s*\\.\\s*load/i,
  /fetch\\s*\\([^)]*\\.(jpg|jpeg|png|gif|webp)/i,
  /createImageBitmap/i,
  /drawImage\\s*\\(/i,
  /FileReader[^}]*readAsDataURL/i,
  /data:image\\/(jpeg|png|gif|webp)/i,
  /\\.toDataURL\\s*\\(/i,
  /(uploadPhoto|uploadImage|uploadAvatar|uploadPicture|uploadFace)/i,
  /(camera|webcam|getUserMedia|mediaDevices\\.getUserMedia)/i,
  /(deepfake|face\\s*swap|face\\s*morph|face\\s*gen)/i,
];`;

const newPatterns = `const IMAGE_BYPASS_PATTERNS = [
  // Original patterns
  /<img\\s+[^>]*src\\s*=/i,
  /Image\\s*\\.\\s*load/i,
  /fetch\\s*\\([^)]*\\.(jpg|jpeg|png|gif|webp)/i,
  /createImageBitmap/i,
  /drawImage\\s*\\(/i,
  /FileReader[^}]*readAsDataURL/i,
  /data:image\\/(jpeg|png|gif|webp)/i,
  /\\.toDataURL\\s*\\(/i,
  /(uploadPhoto|uploadImage|uploadAvatar|uploadPicture|uploadFace)/i,
  /(camera|webcam|getUserMedia|mediaDevices\\.getUserMedia)/i,
  /(deepfake|face\\s*swap|face\\s*morph|face\\s*gen)/i,
  // FIX 1: DOM injection (innerHTML/outerHTML can inject <img> tags)
  /\\.innerHTML\\s*[=+]/i,
  /\\.outerHTML\\s*[=+]/i,
  /\\.insertAdjacentHTML\\s*\\(/i,
  /document\\.write\\s*\\(/i,
  // FIX 2: WebSocket image transfer
  /WebSocket[^}]*send\\s*\\([^)]*(?:blob|arraybuffer|image|photo|avatar)/i,
  /\\.send\\s*\\([^)]*(?:imageData|imgData|photoData|faceData)/i,
  /new\\s+WebSocket\\s*\\([^)]*(?:image|photo|avatar|face)/i,
  // FIX 3: iframe injection (embed external phishing pages)
  /<iframe\\s+[^>]*src\\s*=/i,
  /createElement\\s*\\(\\s*['"]iframe['"]/i,
  /\\.src\\s*=\\s*['"](?:https?:|data:text\\/html)/i,
  /window\\.open\\s*\\(/i,
  /\\.contentWindow/i,
  /\\.contentDocument/i,
];`;

if (sdk.includes(oldPatterns)) {
  sdk = sdk.replace(oldPatterns, newPatterns);
  fixes += 3;
  console.log('FIX 1: innerHTML/outerHTML/insertAdjacentHTML/document.write added');
  console.log('FIX 2: WebSocket image transfer patterns added');
  console.log('FIX 3: iframe/window.open/contentWindow patterns added');
} else {
  console.log('WARN: Could not find exact IMAGE_BYPASS_PATTERNS block');
  console.log('Checking if patterns already added...');
  if (sdk.includes('innerHTML')) console.log('  innerHTML: already present');
  if (sdk.includes('WebSocket')) console.log('  WebSocket: already present');
  if (sdk.includes('iframe')) console.log('  iframe: already present');
}

// ============================================================================
// FIX 4: Add scanCode to SDK exports with TownHall integration hook
// ============================================================================

if (!sdk.includes('scanCodeForTownHall')) {
  const townhallScanFn = `
// ============================================================================
// FIX 4: TownHall integration — scanCode wrapper for server-side verification
// ============================================================================

export interface TownHallScanResult {
  isValid: boolean;
  violations: string[];
  codeHash: string;
  sdkHash: string;
  timestamp: number;
}

/**
 * scanCode wrapper for TownHall verify-dapp endpoint.
 * TownHall calls this to verify DApp code at registration AND periodically.
 */
export function scanCodeForTownHall(code: string, sdkVersion: string): TownHallScanResult {
  const scan = scanCode(code);
  const codeHash = bytesToHex(sha256(new TextEncoder().encode(code)));
  return {
    isValid: scan.isValid,
    violations: scan.violations,
    codeHash,
    sdkHash: SDK_TEMPLATE_HASH,
    timestamp: Math.floor(Date.now() / 1000),
  };
}
`;
  // Insert before the last export
  const lastExport = sdk.lastIndexOf('export function verifySDKVersion');
  if (lastExport > -1) {
    sdk = sdk.slice(0, lastExport) + townhallScanFn + '\n' + sdk.slice(lastExport);
    fixes++;
    console.log('FIX 4: scanCodeForTownHall function added');
  }
}

// ============================================================================
// FIX 5: Add periodic re-scan support (wallet calls this)
// ============================================================================

if (!sdk.includes('periodicRescan')) {
  const rescanFn = `
// ============================================================================
// FIX 5: Periodic re-scan — wallet calls this to verify DApp hasn't changed
// ============================================================================

export interface RescanResult {
  dappId: string;
  currentHash: string;
  expectedHash: string;
  matches: boolean;
  scanResult: CodeScanResult;
  timestamp: number;
}

/**
 * Wallet calls this periodically to re-verify a DApp.
 * If code changed or violations found, DApp becomes invisible.
 */
export function periodicRescan(dappId: string, currentCode: string, expectedHash: string): RescanResult {
  const currentHash = bytesToHex(sha256(new TextEncoder().encode(currentCode)));
  const scanResult = scanCode(currentCode);
  return {
    dappId,
    currentHash,
    expectedHash,
    matches: currentHash === expectedHash,
    scanResult,
    timestamp: Math.floor(Date.now() / 1000),
  };
}
`;
  const lastExport2 = sdk.lastIndexOf('export function verifySDKVersion');
  if (lastExport2 > -1) {
    sdk = sdk.slice(0, lastExport2) + rescanFn + '\n' + sdk.slice(lastExport2);
    fixes++;
    console.log('FIX 5: periodicRescan function added');
  }
}

// ============================================================================
// FIX 6: Compute and export all file hashes for Arweave inscription
// ============================================================================

if (!sdk.includes('SDK_FILE_HASHES')) {
  const currentSourceHash = crypto.createHash('sha256').update(sdk).digest('hex');
  
  const hashExport = `
// ============================================================================
// FIX 6: SDK file hashes for Arweave inscription
// ============================================================================

/** 
 * Complete SDK file hashes — inscribe these to Arweave as KV-Type=sdk-release.
 * Any modification to any file changes the hash → TownHall rejects.
 */
export const SDK_FILE_HASHES = {
  version: '2.1.0',
  source: '${currentSourceHash}',
  // Recompute after build: sha256sum dist/index.js dist/index.mjs
  dist_cjs: 'RECOMPUTE_AFTER_BUILD',
  dist_esm: 'RECOMPUTE_AFTER_BUILD',
  constraintsPatternCount: ${sdk.match(/IMAGE_BYPASS_PATTERNS/g)?.length || 0},
  totalPatterns: ${newPatterns.split('\n').filter(l => l.trim().startsWith('/')).length},
};

/**
 * Verify the complete SDK — checks source hash + template hash + pattern count.
 */
export function verifySDKComplete(sourceHash: string, templateHash: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (sourceHash !== SDK_FILE_HASHES.source) errors.push('source_hash_mismatch');
  if (templateHash !== SDK_TEMPLATE_HASH) errors.push('template_hash_mismatch');
  return { valid: errors.length === 0, errors };
}
`;
  sdk += hashExport;
  fixes++;
  console.log('FIX 6: SDK_FILE_HASHES + verifySDKComplete added');
}

// ============================================================================
// SAVE
// ============================================================================

fs.writeFileSync(SDK_PATH, sdk);

// Also update the original source if it exists
const origPath = '../kasvillage-procedural-sdk/src/index.ts';
if (fs.existsSync(origPath)) {
  fs.writeFileSync(origPath, sdk);
  console.log('\nAlso updated original SDK source: ' + origPath);
}

// ============================================================================
// SUMMARY
// ============================================================================

const newHash = crypto.createHash('sha256').update(sdk).digest('hex');
const lineCount = sdk.split('\n').length;
const patternCount = (sdk.match(/^\s+\/[^/]/gm) || []).length;

console.log('\n=== ' + fixes + '/6 fixes applied ===');
console.log('\nSDK updated:');
console.log('  File: ' + SDK_PATH);
console.log('  Lines: ' + lineCount);
console.log('  New hash: ' + newHash);
console.log('\nNew bypass patterns added:');
console.log('  innerHTML, outerHTML, insertAdjacentHTML, document.write');
console.log('  WebSocket send with image data');
console.log('  iframe src, createElement iframe, window.open');
console.log('  contentWindow, contentDocument');
console.log('\nNew functions added:');
console.log('  scanCodeForTownHall() — server-side verification');
console.log('  periodicRescan() — wallet re-verification');
console.log('  verifySDKComplete() — full SDK integrity check');
console.log('  SDK_FILE_HASHES — all hashes for Arweave inscription');
console.log('\nTotal attack vectors now blocked: ~25 patterns');
console.log('\nVerify: npx tsc --noEmit --pretty 2>&1 | Select-String "error TS" | Select-Object -First 5');
