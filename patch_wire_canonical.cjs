const fs = require('fs');
let f = fs.readFileSync('NeighborAgreement.tsx','utf8');

if (f.includes('buyerBuildTemplate(')) {
  console.log('ALREADY WIRED to canonical');
  process.exit(0);
}

const start = f.indexOf('const buildReleaseTemplate = async ()');
if (start < 0) { console.log('buildReleaseTemplate not found'); process.exit(1); }

let depth = 0, inF = false, end = -1;
for (let i = start; i < f.length; i++) {
  if (f[i] === '{') { depth++; inF = true; }
  if (f[i] === '}') { depth--; if (inF && depth === 0) { end = i + 1; break; } }
}
if (end < 0) { console.log('Could not find end of function'); process.exit(1); }

let e = end;
while (e < f.length && ' \n\r'.includes(f[e])) e++;
if (f[e] === ';') e++;

console.log('Old function: line', f.substring(0,start).split('\n').length, '- length:', e - start, 'chars');

const newFn = [
  'const buildReleaseTemplate = async () => {',
  '    setIsLoading(true);',
  '    try {',
  '      const wallet = await loadMainWallet();',
  '      if (!wallet?.privKeyHex || !contract.frostData || !contract.agreementId) {',
  "        Alert.alert('Error', 'Missing wallet or FROST data'); setIsLoading(false); return;",
  '      }',
  "      const network = wallet.network || 'testnet-10';",
  "      const apiBase = network.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';",
  "      const utxoResp = await fetch(apiBase + '/addresses/' + contract.frostData.address + '/utxos');",
  '      const utxos = await utxoResp.json();',
  "      if (!utxos?.length) { Alert.alert('Error', 'No UTXOs at FROST address'); setIsLoading(false); return; }",
  '',
  '      // k born HERE — canonical function',
  '      const result = buyerBuildTemplate({',
  '        privateKeyHex: wallet.privKeyHex,',
  "        buyerPubkey: contract.buyerPubkey || '',",
  "        sellerPubkey: contract.sellerPubkey || '',",
  '        counter: contract.frostData?.frostCounter || 0,',
  '        utxos: utxos.map((u: any) => ({ txId: u.outpoint.transactionId, index: u.outpoint.index, amount: u.utxoEntry.amount, scriptPubKey: u.utxoEntry.scriptPublicKey.scriptPublicKey })),',
  '        buyerAmountSompi: BigInt(Math.floor(contract.itemPriceKas * 1e8)),',
  '        agrId: contract.agreementId,',
  '      });',
  '',
  "      await SecureStore.setItemAsync('kv_frost_nonce_' + contract.agreementId, JSON.stringify({ k: result.nonce.k.toString(16), d_tweaked: result.nonce.d_tweaked.toString(16), R_hex: result.nonce.R_hex }));",
  '      try { await Clipboard.setStringAsync(result.templateB64); } catch {}',
  '',
  "      console.log('[Ceremony] Template built:', result.templateB64.length, 'chars');",
  "      Alert.alert('TX Template Copied', 'Send clipboard to seller.\\nBuyer: ' + (Number(BigInt(result.template.o[0].v)) / 1e8).toFixed(4) + ' KAS\\nSeller: ' + (Number(BigInt(result.template.o[1].v)) / 1e8).toFixed(4) + ' KAS');",
  "    } catch (e: any) { console.error('[Ceremony]', e); Alert.alert('Error', e.message || 'Template build failed'); }",
  '    finally { setIsLoading(false); }',
  '  };',
].join('\n');

f = f.substring(0, start) + newFn + f.substring(e);
fs.writeFileSync('NeighborAgreement.tsx', f);
console.log('DONE — buildReleaseTemplate now calls buyerBuildTemplate from canonical');
console.log('buyerBuildTemplate hits:', (f.match(/buyerBuildTemplate/g)||[]).length);
