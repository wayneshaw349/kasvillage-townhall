const fs = require("fs");
const f = "KaspaClient.ts";
const orig = fs.readFileSync(f, "utf8");
const nl = (orig.match(/\r\n/g)||[]).length >= (orig.match(/(?<!\r)\n/g)||[]).length ? "\r\n" : "\n";
if (orig.includes("REST getUtxos")) { console.error("already patched -- ABORT"); process.exit(1); }

const oldBody = [
"  async getUtxos(addresses: string[]): Promise<UtxoEntry[]> {",
"    this.ensureConnected();",
"    const response = await this.client!.getUtxosByAddresses({ addresses });",
"    ",
"    return (response.entries || []).map((e: any) => ({",
"      txId: e.outpoint.transactionId,",
"      index: e.outpoint.index,",
"      amount: BigInt(e.utxoEntry.amount),",
"      scriptPublicKey: e.utxoEntry.scriptPublicKey,",
"      blockDaaScore: BigInt(e.utxoEntry.blockDaaScore),",
"      isCoinbase: e.utxoEntry.isCoinbase || false,",
"    }));",
"  }"
].join(nl);

if (orig.split(oldBody).length - 1 !== 1) { console.error("getUtxos anchor count", orig.split(oldBody).length-1, "-- ABORT"); process.exit(1); }

const newBody = [
"  async getUtxos(addresses: string[]): Promise<UtxoEntry[]> {",
"    // REST getUtxos — wRPC getUtxosByAddresses is non-functional in Expo.",
"    const apiBase = this.network === 'mainnet' ? 'https://api.kaspa.org' : 'https://api-tn10.kaspa.org';",
"    const all: UtxoEntry[] = [];",
"    for (const address of addresses) {",
"      const resp = await fetch(`${apiBase}/addresses/${encodeURIComponent(address)}/utxos`);",
"      if (!resp.ok) throw new Error(`UTXO fetch failed: ${resp.status}`);",
"      const entries = await resp.json();",
"      for (const e of (entries || [])) {",
"        all.push({",
"          txId: e.outpoint.transactionId,",
"          index: Number(e.outpoint.index),",
"          amount: BigInt(e.utxoEntry.amount),",
"          scriptPublicKey: typeof e.utxoEntry.scriptPublicKey === 'string' ? e.utxoEntry.scriptPublicKey : (e.utxoEntry.scriptPublicKey?.scriptPublicKey || ''),",
"          blockDaaScore: BigInt(e.utxoEntry.blockDaaScore),",
"          isCoinbase: e.utxoEntry.isCoinbase || false,",
"        });",
"      }",
"    }",
"    return all;",
"  }"
].join(nl);

let s = orig.replace(oldBody, newBody);
fs.writeFileSync(f + ".bak12", orig);
fs.writeFileSync(f, s);
console.log("getUtxos now REST-based");
