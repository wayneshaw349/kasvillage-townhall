const fs = require("fs");
const P = "Workspace.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (!s.includes("getWalletPrivateKey")) { console.log("already fixed"); process.exit(0); }
const a = "      const { deriveStoreKeys, announceToRegistry } = require('./payload_publish');\n      const { getWalletPrivateKey, getWalletAddress, getWalletPublicKey } = require('./bip39_wallet');\n      const priv = await getWalletPrivateKey();\n      const pub = await getWalletPublicKey();\n      const myAddr = await getWalletAddress();\n      const owner = { privateKeyHex: priv, pubkeyHex: pub, address: myAddr, network: 'testnet-10' as any };";
const b = "      const { deriveStoreKeys, announceToRegistry } = require('./payload_publish');\n      const { _kvResolvePrivHex } = require('./proposal_share');\n      const priv = await _kvResolvePrivHex();\n      if (!priv || !myAddr) { gadd('ERROR: wallet keys unavailable'); setGbusy(''); return; }\n      const pub = bytesToHex(secp256k1.getPublicKey(hexToBytes(priv), true));\n      const owner = { privateKeyHex: priv, pubkeyHex: pub, address: myAddr, network: 'testnet-10' as any };";
const f = s.split(a).length - 1;
if (f !== 1) { console.error("ABORT: anchor found " + f + " times"); process.exit(1); }
s = s.split(a).join(b);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("announce keys fixed - same derivation as runPublish");
