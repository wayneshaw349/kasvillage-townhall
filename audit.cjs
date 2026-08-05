// audit.cjs — read-only wallet audit for the 5 review concerns.
// Run from: C:\Users\wayne\Downloads\kasvillage layer1
//   node audit.cjs
// Touches NOTHING. Prints findings per concern.

const fs = require("fs");
const files = fs.readdirSync(".").filter(f => /\.(ts|tsx)$/.test(f));
const read = f => { try { return fs.readFileSync(f, "utf8"); } catch { return ""; } };
const lines = f => read(f).split(/\r?\n/);
const hr = t => console.log("\n" + "=".repeat(70) + "\n" + t + "\n" + "=".repeat(70));

// ---------------------------------------------------------------
hr("CONCERN 1: hand-rolled crypto primitives vs @noble/hashes");
// Who implements sha512/hmac/pbkdf2 by hand, and who imports noble?
for (const f of files) {
  const s = read(f);
  const hand = [];
  if (/function sha512\(/.test(s)) hand.push("sha512()");
  if (/function hmacSha512\(/.test(s)) hand.push("hmacSha512()");
  if (/function pbkdf2|PBKDF2/i.test(s) && !/from '@noble/.test(s)) hand.push("pbkdf2-ish");
  if (/sha512Block/.test(s)) hand.push("sha512Block()");
  if (hand.length) console.log("HAND-ROLLED in " + f + ": " + hand.join(", "));
}
console.log("--- noble imports present:");
for (const f of files) {
  const s = read(f);
  const m = s.match(/from ['"]@noble\/(hashes|curves|secp256k1)[^'"]*['"]/g);
  if (m) console.log("  " + f + ": " + [...new Set(m)].join("  "));
}

// ---------------------------------------------------------------
hr("CONCERN 1b: CRITICAL — which mnemonicToSeed actually runs (real PBKDF2 or digest shortcut)");
for (const f of files) {
  const ls = lines(f);
  ls.forEach((l, i) => {
    if (/mnemonicToSeed/.test(l)) console.log(f + ":" + (i + 1) + ": " + l.trim().slice(0, 130));
  });
}
// The digest-shortcut fingerprint:
for (const f of files) {
  const s = read(f);
  if (s.includes("'|PBKDF2|'") || s.includes('"|PBKDF2|"')) {
    console.log("!! DIGEST-SHORTCUT STRING FOUND in " + f + " — check if this path is live");
    const ls = lines(f);
    ls.forEach((l, i) => { if (l.includes("|PBKDF2|")) console.log("   " + f + ":" + (i+1) + ": " + l.trim().slice(0,140)); });
  }
}
// Real PBKDF2 loop fingerprints (iteration loop over 2048):
for (const f of files) {
  const s = read(f);
  if (/2048/.test(s) && /hmacSha512|pbkdf2/i.test(s)) {
    const ls = lines(f);
    ls.forEach((l, i) => {
      if (/for\s*\(.*2048|iterations\s*=\s*2048|< ?2048/.test(l)) console.log("PBKDF2 loop? " + f + ":" + (i+1) + ": " + l.trim().slice(0,130));
    });
  }
}

// ---------------------------------------------------------------
hr("CONCERN 2: wallet entropy source — avatar-derived vs random");
for (const f of files) {
  const ls = lines(f);
  ls.forEach((l, i) => {
    if (/deriveWalletFromIdentityHash|identityHashToEntropy|getRandomBytesAsync\(16\)|generateIdentityHash/.test(l))
      console.log(f + ":" + (i + 1) + ": " + l.trim().slice(0, 130));
  });
}
console.log("--- avatar answer-space signals (finite option lists feeding identity hash):");
for (const f of files) {
  const ls = lines(f);
  ls.forEach((l, i) => {
    if (/KV_AVATAR_V\d|identityHash.*race|race.*class.*occupation/i.test(l))
      console.log(f + ":" + (i + 1) + ": " + l.trim().slice(0, 130));
  });
}

// ---------------------------------------------------------------
hr("CONCERN 3: BIP39 passphrase — '' (portable) vs 'kasvillage' (domain-separated)");
for (const f of files) {
  const ls = lines(f);
  ls.forEach((l, i) => {
    if (/mnemonicToSeed\s*\(/.test(l) || /passphrase\s*[=:]/.test(l))
      console.log(f + ":" + (i + 1) + ": " + l.trim().slice(0, 140));
  });
}

// ---------------------------------------------------------------
hr("CONCERN 4: SecureStore key fragmentation (private/public key names)");
const keyNames = {};
for (const f of files) {
  const s = read(f);
  const m = s.match(/SecureStore\.(get|set)ItemAsync\(\s*['"]([^'"]+)['"]/g) || [];
  for (const hit of m) {
    const name = hit.match(/['"]([^'"]+)['"]/)[1];
    if (/key|pub|priv|seed|mnemonic|address/i.test(name)) {
      keyNames[name] = keyNames[name] || new Set();
      keyNames[name].add(f);
    }
  }
}
Object.keys(keyNames).sort().forEach(k => {
  console.log(k.padEnd(28) + " <- " + [...keyNames[k]].slice(0, 5).join(", ") + (keyNames[k].size > 5 ? " +" + (keyNames[k].size - 5) : ""));
});

// ---------------------------------------------------------------
hr("CONCERN vault: does the FROST/cold vault derive independently of bip39_wallet?");
for (const f of files) {
  if (!/vault|cold/i.test(f)) continue;
  const s = read(f);
  console.log("--- " + f + ":");
  const ls = s.split(/\r?\n/);
  ls.forEach((l, i) => {
    if (/getRandomBytesAsync|deriveWalletFromIdentityHash|bip39_wallet|entropyToMnemonic|mnemonicToSeed|deriveKaspaHDKey|kv_vault/.test(l))
      console.log("  " + (i + 1) + ": " + l.trim().slice(0, 130));
  });
}
// Also: any file referencing VaultSetup
for (const f of files) {
  const s = read(f);
  if (/VaultSetup/.test(s) && !/vault|cold/i.test(f)) {
    const ls = s.split(/\r?\n/);
    ls.forEach((l, i) => { if (/VaultSetup.*key|vault.*entropy|vault.*mnemonic/i.test(l)) console.log(f + ":" + (i+1) + ": " + l.trim().slice(0,120)); });
  }
}

hr("DONE — paste this whole output back for interpretation");
