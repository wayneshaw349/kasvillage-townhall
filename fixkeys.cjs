const fs = require("fs");

// ---- helper code to inject (same in both files, file-local) ----
function makeResolver(indent) {
  const I = indent;
  return [
I+"async function _kvResolvePrivHex(): Promise<string | null> {",
I+"  const isHex = (v: string | null): v is string => !!v && /^[0-9a-fA-F]{64}$/.test(v.trim());",
I+"  // 1) plain-hex candidates",
I+"  for (const k of ['kv_private_key', 'kasvillage_private_key', 'kv_l1_privkey']) {",
I+"    const v = await SecureStore.getItemAsync(k);",
I+"    if (isHex(v)) { console.log('[KVKey] using plain key:', k); return v.trim(); }",
I+"  }",
I+"  // 2) encrypted envelope (JSON { privateKeyEnc }) XOR scheme from avatar_arweave_upload",
I+"  try {",
I+"    const env = await SecureStore.getItemAsync('kv_l1_privkey_enc');",
I+"    const deviceKey = await SecureStore.getItemAsync('device_encryption_key');",
I+"    if (env && deviceKey) {",
I+"      const stored = JSON.parse(env) as { privateKeyEnc: string };",
I+"      const encHex = stored.privateKeyEnc;",
I+"      const Crypto = require('expo-crypto');",
I+"      const keyStream = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, deviceKey + encHex);",
I+"      const out: string[] = [];",
I+"      for (let i = 0; i < 64; i += 2) {",
I+"        const eb = parseInt(encHex.slice(i, i + 2), 16);",
I+"        const kb = parseInt(keyStream.slice(i % keyStream.length, (i % keyStream.length) + 2), 16);",
I+"        out.push((eb ^ kb).toString(16).padStart(2, '0'));",
I+"      }",
I+"      const hex = out.join('');",
I+"      if (isHex(hex)) { console.log('[KVKey] using decrypted envelope'); return hex; }",
I+"    }",
I+"  } catch (e) { console.warn('[KVKey] envelope decrypt failed:', e); }",
I+"  console.warn('[KVKey] no valid private key found');",
I+"  return null;",
I+"}",
""
  ].join("\n");
}

// ---- File 1: IOUBalanceSheetShare.tsx ----
{
  const f = "IOUBalanceSheetShare.tsx";
  let s = fs.readFileSync(f, "utf8");
  const nl = (s.match(/\r\n/g)||[]).length >= (s.match(/(?<!\r)\n/g)||[]).length ? "\r\n" : "\n";
  if (s.includes("_kvResolvePrivHex")) { console.error(f + " already patched -- skip"); }
  else {
    const fnAnchor = "async function getWalletCredentials()";
    if (s.split(fnAnchor).length - 1 !== 1) { console.error(f + " fn anchor count wrong -- ABORT"); process.exit(1); }
    // inject resolver above getWalletCredentials
    s = s.replace(fnAnchor, makeResolver("").replace(/\n/g, nl) + fnAnchor);
    // repoint the privkey line
    const old = "    const privkey = await SecureStore.getItemAsync(KEYS.PRIVKEY_ENC);";
    if (s.split(old).length - 1 !== 1) { console.error(f + " privkey line count wrong -- ABORT"); process.exit(1); }
    s = s.replace(old, "    const privkey = await _kvResolvePrivHex();");
    fs.writeFileSync(f + ".bak11", fs.readFileSync(f, "utf8"));
    fs.writeFileSync(f, s);
    console.log("patched " + f);
  }
}

// ---- File 2: proposal_share.ts ----
{
  const f = "proposal_share.ts";
  let s = fs.readFileSync(f, "utf8");
  const nl = (s.match(/\r\n/g)||[]).length >= (s.match(/(?<!\r)\n/g)||[]).length ? "\r\n" : "\n";
  if (s.includes("_kvResolvePrivHex")) { console.error(f + " already patched -- skip"); }
  else {
    const old = "  const privkey = await SecureStore.getItemAsync('kv_l1_privkey_enc') ||" + nl +
                "                  await SecureStore.getItemAsync('kasvillage_private_key') || '';";
    if (s.split(old).length - 1 !== 1) { console.error(f + " privkey block count " + (s.split(old).length-1) + " -- ABORT"); process.exit(1); }
    s = s.replace(old, "  const privkey = (await _kvResolvePrivHex()) || '';");
    // inject resolver before the function containing it — anchor on the line that defines getWalletCredentials-equivalent; use pubkey line's function start.
    // Simplest: prepend resolver right before the first occurrence of 'const privkey = (await _kvResolvePrivHex())'
    const marker = "  const privkey = (await _kvResolvePrivHex()) || '';";
    // find enclosing function start: search backwards for 'async function' before marker index
    const mi = s.indexOf(marker);
    const fi = s.lastIndexOf("async function", mi);
    if (fi === -1) { console.error(f + " enclosing fn not found -- ABORT"); process.exit(1); }
    s = s.slice(0, fi) + makeResolver("").replace(/\n/g, nl) + s.slice(fi);
    fs.writeFileSync(f + ".bak11", fs.readFileSync(f, "utf8"));
    fs.writeFileSync(f, s);
    console.log("patched " + f);
  }
}
console.log("done");
