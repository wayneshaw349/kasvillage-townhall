// swap_upload_host.cjs — turbo.ardrive.io (payment host, 402s) -> upload.ardrive.io (upload host, free small items)
const fs = require('fs');
const p = 'avatar_arweave_upload.ts';
let s = fs.readFileSync(p, 'utf8');
const old = "const IRYS_UPLOAD_URL = 'https://turbo.ardrive.io/v1/tx';";
const neu = "const IRYS_UPLOAD_URL = 'https://upload.ardrive.io/v1/tx'; // TURBO-SWAP: upload host, free small items; turbo.ardrive.io is payment host (402s via AR.IO bundler)";
if (s.split(old).length - 1 !== 1) { console.error('FAIL anchor — count ' + (s.split(old).length - 1)); process.exit(1); }
fs.copyFileSync(p, p + '.bak');
fs.writeFileSync(p, s.replace(old, neu));
console.log('OK endpoint swapped');
