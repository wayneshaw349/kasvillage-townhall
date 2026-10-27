// make_key_qr.cjs - turn a cold key into a QR code PNG, entirely on YOUR machine.
//   one-time:  npm i -D qrcode
//   then:      node make_key_qr.cjs
// The key is typed at a prompt (never on the command line, so it stays out of shell history).
// The PNG is written next to this script, auto-added to .gitignore, and should be PRINTED
// (or moved to offline storage) and then DELETED - empty the recycle bin too.
const fs = require('fs');
const OUT = 'kv_cold_key_SECRET_qr.png';
let QR; try { QR = require('qrcode'); } catch { console.log('\n  FAIL  run once first:  npm i -D qrcode\n'); process.exit(1); }
const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
rl.question('Paste the 64-hex SECRET to encode and press Enter: ', async (ans) => {
  rl.close();
  const sk = String(ans || '').trim().toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{64}$/.test(sk)) { console.log('\n  FAIL  that is not a 64-hex secret key'); process.exit(1); }
  try {
    // keep this file out of git even if someone runs git add .
    const gi = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf8') : '';
    if (!gi.includes(OUT)) fs.appendFileSync('.gitignore', (gi.endsWith('\n') || !gi ? '' : '\n') + OUT + '\n');
  } catch {}
  await QR.toFile(OUT, sk, { errorCorrectionLevel: 'H', width: 600, margin: 4 });
  console.log('\n  ok    wrote ' + OUT + ' (git-ignored)');
  console.log('\n  NOW: 1) print it or move it to offline storage');
  console.log('       2) DELETE the PNG from this folder and empty the recycle bin');
  console.log('       3) verify the printout:  scan it, then  node check_mod_key.cjs  and paste the scanned text\n');
});
