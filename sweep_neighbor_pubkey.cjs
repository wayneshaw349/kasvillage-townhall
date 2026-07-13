const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

const bad = "('02' + xOnly.map((b: number) => b.toString(16).padStart(2, '0')).join(''))";
const good = "b2h(secpPub(wallet.privKeyHex))";

const before = s.split(bad).length - 1;
s = s.split(bad).join(good);
const after = s.split(bad).length - 1;

fs.writeFileSync(f, s);
console.log('replaced ' + before + ' -> remaining ' + after);
