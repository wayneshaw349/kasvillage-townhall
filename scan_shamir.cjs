const fs = require("fs");
for (const f of ["wallet_shamir_backup.ts","VaultRecoveryScreen.tsx","VaultBackupScreen.tsx","GenerateVaultScreen.tsx"]) {
  if (!fs.existsSync(f)) { console.log("(missing: "+f+")"); continue; }
  const s = fs.readFileSync(f,"utf8").split(/\r?\n/);
  console.log("=== "+f+" ===");
  s.forEach((l,i)=>{ if(/mnemonicToSeed|deriveKaspaHDKey|bip39_wallet|bip39_v2|createWallet|import .*wallet/.test(l)) console.log((i+1)+": "+l.trim().slice(0,130)); });
}
