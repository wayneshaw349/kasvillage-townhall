const fs = require("fs");
const f = "TownHallScreen.tsx";
const orig = fs.readFileSync(f, "utf8");
let s = orig;
const nl = s.includes("\r\n") ? "\r\n" : "\n";

const oldBlock = [
"      let txId = '';",
"      if (arweaveUpload.uploadToTurbo) { const r = await arweaveUpload.uploadToTurbo(payload, tags); txId = r?.txId || ''; }",
"      else if ((arweaveUpload as any).uploadToIrys) { const r = await (arweaveUpload as any).uploadToIrys(payload, tags); txId = r?.txId || ''; }",
"      if (txId) { Alert.alert('APT Registered', `APT-${aptNum} is now searchable.\\nTX: ${txId.slice(0,16)}...`); }",
"      else { Alert.alert('Upload failed', 'No transaction id returned. Try again.'); }"
].join(nl);

if (s.split(oldBlock).length - 1 !== 1) { console.error("old block count", s.split(oldBlock).length-1, "-- ABORT"); process.exit(1); }

const newBlock = [
"      let txId = '';",
"      let upErr = '';",
"      const _up = arweaveUpload.uploadToTurbo || (arweaveUpload as any).uploadToIrys;",
"      if (_up) {",
"        const r: any = await _up(payload, tags);",
"        txId = r?.txId || r?.id || r?.transaction?.id || '';",
"        if (!txId) upErr = r?.error || (r?.success === false ? 'Upload rejected' : 'No transaction id returned');",
"      } else { upErr = 'No upload function available'; }",
"      if (txId) { Alert.alert('APT Registered', `APT-${aptNum} is now searchable.\\nTX: ${txId.slice(0,16)}...`); }",
"      else { Alert.alert('Upload failed', upErr + '.\\nEnsure your wallet key is available, then retry.'); }"
].join(nl);

s = s.replace(oldBlock, newBlock);
fs.writeFileSync(f + ".bak6", orig);
fs.writeFileSync(f, s);
console.log("handler now surfaces the real upload error + accepts alt txId fields");
