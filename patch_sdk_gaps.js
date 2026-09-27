// ============================================================================
// PATCH: Add 7 remaining bypass gaps to procedural SDK
// Run AFTER patch_sdk_constraints.js
// Run: node patch_sdk_gaps.js
// ============================================================================

const fs = require('fs');
const crypto = require('crypto');

const SDK_PATH = 'procedural_sdk.ts';
if (!fs.existsSync(SDK_PATH)) {
  console.log('ERROR: procedural_sdk.ts not found. Run from wallet project root.');
  process.exit(1);
}

let sdk = fs.readFileSync(SDK_PATH, 'utf8');
let fixes = 0;

// Find the end of IMAGE_BYPASS_PATTERNS array and add new patterns before the closing ];
const closingBracket = sdk.indexOf('];\n', sdk.indexOf('IMAGE_BYPASS_PATTERNS'));

if (closingBracket === -1) {
  console.log('ERROR: Could not find IMAGE_BYPASS_PATTERNS closing bracket');
  process.exit(1);
}

// Check what's already there to avoid duplicates
const alreadyHas = (pattern) => sdk.includes(pattern);

const newPatterns = [];

// GAP 1: CSS background-image
if (!alreadyHas('background-image')) {
  newPatterns.push(`  // GAP 1: CSS background-image (load photo via CSS)`);
  newPatterns.push(`  /background-image\\s*:\\s*url\\s*\\(/i,`);
  newPatterns.push(`  /background\\s*:[^;]*url\\s*\\(/i,`);
  fixes++;
  console.log('FIX 1: CSS background-image patterns added');
}

// GAP 2: CSS @import
if (!alreadyHas('@import')) {
  newPatterns.push(`  // GAP 2: CSS @import (load external stylesheet with images)`);
  newPatterns.push(`  /@import\\s+(?:url\\s*\\()?\\s*['"]?https?:/i,`);
  newPatterns.push(`  /\\.addRule|insertRule[^}]*url\\s*\\(/i,`);
  fixes++;
  console.log('FIX 2: CSS @import patterns added');
}

// GAP 3: Video/audio poster and source
if (!alreadyHas('<video')) {
  newPatterns.push(`  // GAP 3: Video/audio with poster attribute (embed images via media)`);
  newPatterns.push(`  /<video\\s+[^>]*poster\\s*=/i,`);
  newPatterns.push(`  /<video\\s+[^>]*src\\s*=/i,`);
  newPatterns.push(`  /<source\\s+[^>]*src\\s*=\\s*['"][^'"]*\\.(jpg|png|gif|webp|mp4)/i,`);
  newPatterns.push(`  /createElement\\s*\\(\\s*['"]video['"]/i,`);
  fixes++;
  console.log('FIX 3: Video/audio poster patterns added');
}

// GAP 4: SVG <image> tag
if (!alreadyHas('SVG.*image')) {
  newPatterns.push(`  // GAP 4: SVG <image> tag (SVG can embed external images)`);
  newPatterns.push(`  /<image\\s+[^>]*href\\s*=/i,`);
  newPatterns.push(`  /<image\\s+[^>]*xlink:href\\s*=/i,`);
  newPatterns.push(`  /createElementNS[^)]*image/i,`);
  fixes++;
  console.log('FIX 4: SVG <image> tag patterns added');
}

// GAP 5: Worker/ServiceWorker fetch
if (!alreadyHas('Worker')) {
  newPatterns.push(`  // GAP 5: Worker/ServiceWorker (background thread can load images)`);
  newPatterns.push(`  /new\\s+Worker\\s*\\(/i,`);
  newPatterns.push(`  /new\\s+SharedWorker\\s*\\(/i,`);
  newPatterns.push(`  /navigator\\.serviceWorker\\.register/i,`);
  newPatterns.push(`  /importScripts\\s*\\(/i,`);
  fixes++;
  console.log('FIX 5: Worker/ServiceWorker patterns added');
}

// GAP 6: Obfuscated code (eval, atob, Function constructor)
if (!alreadyHas('eval\\s*\\(') && !alreadyHas('atob')) {
  newPatterns.push(`  // GAP 6: Obfuscated code (hides real code from scanner)`);
  newPatterns.push(`  /eval\\s*\\(/i,`);
  newPatterns.push(`  /atob\\s*\\(/i,`);
  newPatterns.push(`  /new\\s+Function\\s*\\(/i,`);
  newPatterns.push(`  /setTimeout\\s*\\(\\s*['"]/i,`);
  newPatterns.push(`  /setInterval\\s*\\(\\s*['"]/i,`);
  newPatterns.push(`  /String\\.fromCharCode/i,`);
  newPatterns.push(`  /unescape\\s*\\(/i,`);
  fixes++;
  console.log('FIX 6: Obfuscated code patterns added (eval, atob, Function, fromCharCode)');
}

// GAP 7: Dynamic import
if (!alreadyHas('import\\s*\\(')) {
  newPatterns.push(`  // GAP 7: Dynamic import (load unscanned module at runtime)`);
  newPatterns.push(`  /import\\s*\\(\\s*['"][^'"]*['"]\\s*\\)/i,`);
  newPatterns.push(`  /require\\s*\\(\\s*['"][^'"]*https?:/i,`);
  newPatterns.push(`  /System\\.import\\s*\\(/i,`);
  fixes++;
  console.log('FIX 7: Dynamic import patterns added');
}

if (newPatterns.length > 0) {
  // Insert before the closing ];
  const before = sdk.slice(0, closingBracket);
  const after = sdk.slice(closingBracket);
  sdk = before + '\n' + newPatterns.join('\n') + '\n' + after;
}

// Update the totalPatterns count in SDK_FILE_HASHES
const patternLines = (sdk.match(/^\s+\/[^\/]/gm) || []).length;
sdk = sdk.replace(
  /totalPatterns: \d+/,
  'totalPatterns: ' + patternLines
);

// Update source hash
const newHash = crypto.createHash('sha256').update(sdk).digest('hex');
sdk = sdk.replace(
  /source: '[a-f0-9]{64}'/,
  "source: '" + newHash + "'"
);

fs.writeFileSync(SDK_PATH, sdk);

// Also update original if it exists
const origPath = '../kasvillage-procedural-sdk/src/index.ts';
if (fs.existsSync(origPath)) {
  fs.writeFileSync(origPath, sdk);
  console.log('\nAlso updated original: ' + origPath);
}

// Count total patterns
const totalPatterns = (sdk.match(/^\s+\/[^\/]/gm) || []).length;

console.log('\n=== ' + fixes + '/7 fixes applied ===');
console.log('\nTotal bypass patterns: ~' + totalPatterns);
console.log('New SDK hash: ' + newHash);
console.log('\nAll blocked vectors:');
console.log('  Images:    img, Image, fetch, createImageBitmap, drawImage');
console.log('  Camera:    getUserMedia, webcam, camera');
console.log('  DOM:       innerHTML, outerHTML, insertAdjacentHTML, document.write');
console.log('  Frames:    iframe, window.open, contentWindow, contentDocument');
console.log('  Export:    toDataURL, WebSocket send');
console.log('  Upload:    uploadPhoto, uploadImage, uploadFace');
console.log('  CSS:       background-image url(), @import url()');
console.log('  Media:     <video poster>, <video src>, <source src>');
console.log('  SVG:       <image href>, <image xlink:href>, createElementNS image');
console.log('  Workers:   Worker, SharedWorker, ServiceWorker, importScripts');
console.log('  Obfusc:    eval, atob, new Function, fromCharCode, unescape');
console.log('  Dynamic:   import(), require(http), System.import');
console.log('  Faces:     eye ratio, face aspect, realistic skin tones');
console.log('\nTo bypass ALL of this, a developer would need to write');
console.log('a custom rendering engine from scratch — at which point');
console.log('they are not using the SDK and TownHall rejects them.');
console.log('\nVerify: npx tsc --noEmit --pretty 2>&1 | Select-String "error TS" | Select-Object -First 5');
