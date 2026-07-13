const fs=require('fs');let n=fs.readFileSync('NeighborAgreement.tsx','utf8');
n=n.replace('console.log("[Seller-Paste] Parsed KV proposal:", parsed.agrId, parsed.description);','console.log("[Seller-Paste] Parsed KV proposal:", parsed.agrId, parsed.description);\n                            console.log("[Seller-Paste-DEBUG] parsed.frostCounter:", parsed.frostCounter, "parsed keys:", Object.keys(parsed).join(","));');
fs.writeFileSync('NeighborAgreement.tsx',n);console.log('done');
