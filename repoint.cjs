// repoint.cjs — switch new-wallet creation from V1 (broken KDF) to V2 (standard BIP39).
// PRE-REQ: bip39_v2.ts must exist (run makev2.cjs first).
// Line-level edits, count-guarded, .bak files. Existing V1 functions untouched.
// Run from project root: node repoint.cjs

const fs = require("fs");
if (!fs.existsSync("bip39_v2.ts")) { console.error("bip39_v2.ts missing — run makev2.cjs first. ABORT"); process.exit(1); }

function eol(s) {
  const crlf = (s.match(/\r\n/g) || []).length;
  const lf = (s.match(/(?<!\r)\n/g) || []).length;
  return crlf >= lf ? "\r\n" : "\n";
}

const jobs = [
  {
    f: "wallet_registration_v2.ts",
    edits: [
      // dynamic imports -> V2 module + V2 names
      { find: "const { entropyToMnemonic, mnemonicToSeed, deriveKaspaHDKey } = await import('./bip39_wallet');",
        repl: "const { entropyToMnemonic } = await import('./bip39_wallet'); const { mnemonicToSeedV2: mnemonicToSeed, deriveKaspaHDKeyV2: deriveKaspaHDKey } = await import('./bip39_v2');",
        count: 1 },
      { find: "const { mnemonicToSeed, deriveKaspaHDKey } = await import('./bip39_wallet');",
        repl: "const { mnemonicToSeedV2: mnemonicToSeed, deriveKaspaHDKeyV2: deriveKaspaHDKey } = await import('./bip39_v2');",
        count: 2 },
    ],
  },
  {
    f: "vault_generator.ts",
    edits: [
      { find: "import { entropyToMnemonic, mnemonicToSeed, deriveKaspaHDKey } from './bip39_wallet';",
        repl: "import { entropyToMnemonic } from './bip39_wallet';\nimport { mnemonicToSeedV2 as mnemonicToSeed, deriveKaspaHDKeyV2 as deriveKaspaHDKey } from './bip39_v2';",
        count: 1 },
    ],
  },
  {
    f: "kasvillage_cold_wallet.tsx",
    edits: [
      { find: "const { mnemonicToSeed, deriveKaspaHDKey } = await import('./bip39_wallet');",
        repl: "const { mnemonicToSeedV2: mnemonicToSeed, deriveKaspaHDKeyV2: deriveKaspaHDKey } = await import('./bip39_v2');",
        count: 1 },
    ],
  },
];

// Pre-flight: verify every count before touching anything
for (const job of jobs) {
  const s = fs.readFileSync(job.f, "utf8");
  for (const e of job.edits) {
    const n = s.split(e.find).length - 1;
    if (n !== e.count) {
      console.error("COUNT MISMATCH in " + job.f + ": expected " + e.count + " got " + n + " for:\n  " + e.find.slice(0, 90));
      console.error("ABORT — nothing written");
      process.exit(1);
    }
  }
}

// Apply
for (const job of jobs) {
  let s = fs.readFileSync(job.f, "utf8");
  const nl = eol(s);
  fs.writeFileSync(job.f + ".bakv2", s);
  for (const e of job.edits) {
    s = s.split(e.find).join(e.repl.replace(/\n/g, nl));
  }
  fs.writeFileSync(job.f, s);
  console.log("patched " + job.f);
}

// Tag: after wallet creation, record kdf version. Insert next to REGISTRATION_STATUS set.
{
  const f = "wallet_registration_v2.ts";
  let s = fs.readFileSync(f, "utf8");
  const nl = eol(s);
  const anchor = "await SecureStore.setItemAsync(STORE_KEYS.REGISTRATION_STATUS, 'wallet_created');";
  const n = s.split(anchor).length - 1;
  if (n >= 1 && !s.includes("kv_kdf_version")) {
    s = s.split(anchor).join(anchor + nl + "    await SecureStore.setItemAsync('kv_kdf_version', 'v2');");
    fs.writeFileSync(f, s);
    console.log("kdf version tag added (" + n + " site" + (n > 1 ? "s" : "") + ")");
  } else {
    console.log("kdf tag: " + (s.includes("kv_kdf_version") ? "already present" : "anchor not found — add manually"));
  }
}

console.log("\nDONE. Next:");
console.log("  npx tsc --noEmit   (expect baseline 126)");
console.log("  re-onboard both test devices (old wallets used V1 KDF)");
