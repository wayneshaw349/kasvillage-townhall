const fs=require('fs');let n=fs.readFileSync('NeighborAgreement.tsx','utf8');
const anchor="          console.log('[Neighbor] Inbox FROST address:', frostData.address);";
if(n.indexOf(anchor)<0){console.log('ANCHOR FAIL');process.exit(1);}
const gate=anchor+`\n          // === HARD GATE: seller-derived FROST must match buyer's declared address ===\n          const _claimedFrost = (agreement as any)?.frostAddress || '';\n          if (_claimedFrost && frostData?.address && _claimedFrost !== frostData.address) {\n            console.error('[FROST-GATE] MISMATCH! derived:', frostData.address, 'claimed:', _claimedFrost);\n            Alert.alert('FROST Address Mismatch', 'The FROST address you derived does not match the buyer\\'s proposal. Collateral will NOT be sent. Do not proceed with this trade.');\n            return;\n          }\n          if (_claimedFrost) console.log('[FROST-GATE] Address match confirmed:', frostData.address.slice(0,30));`;
n=n.replace(anchor,gate);
fs.writeFileSync('NeighborAgreement.tsx',n);console.log('done');
