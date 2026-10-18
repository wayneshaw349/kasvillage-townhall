// make_mod_qr.cjs — turn your cold mod key (from paper) into a printable QR, once.
// One-time setup:  npm i --no-save qrcode
// Run:             node make_mod_qr.cjs
// You type the key, it's checked against modkey.pub.txt, a QR image opens for printing,
// and when you press Enter the image is DELETED and the screen is cleared.
const fs = require('fs');
const readline = require('readline');
const { execSync } = require('child_process');
let QR; try { QR = require('qrcode'); } catch { console.error('Missing qrcode package. Run:  npm i --no-save qrcode'); process.exit(1); }
const { secp256k1 } = require('@noble/curves/secp256k1');
let PUB = ''; try { PUB = fs.readFileSync('modkey.pub.txt', 'utf8').trim(); } catch {}
const OUT = 'modkey_qr.png';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
// safety net: whatever happens, the QR image never outlives this script
const _wipe = () => { try { if (fs.existsSync(OUT)) { fs.unlinkSync(OUT); console.log('Deleted ' + OUT + '.'); } } catch {} };
process.on('exit', _wipe);
rl.question('Type or paste the cold PRIVATE key (64 hex, spaces ok): ', async (raw) => {
  const k = String(raw || '').replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(k)) { console.error('Not 64 hex characters - check the paper and try again.'); rl.close(); return; }
  const pub = Buffer.from(secp256k1.getPublicKey(Buffer.from(k, 'hex'), true)).toString('hex');
  if (PUB && pub !== PUB) { console.error('This key does NOT match modkey.pub.txt - typo? Nothing written.'); rl.close(); return; }
  await QR.toFile(OUT, k, { width: 700, margin: 4, errorCorrectionLevel: 'H' });
  console.log('\nQR written to ' + OUT + (PUB ? ' (key verified against modkey.pub.txt)' : ' (no modkey.pub.txt to verify against)'));
  try { execSync('start "" ' + OUT, { stdio: 'ignore', shell: true }); } catch { console.log('Open ' + OUT + ' manually to print it.'); }
  rl.question('Print it (Ctrl+P in the viewer), close the viewer, then press Enter to DELETE the image... ', () => {
    try { fs.unlinkSync(OUT); console.log('Deleted ' + OUT + '.'); } catch (e) { console.error('Could not delete ' + OUT + ' - delete it by hand!'); }
    process.stdout.write('\x1Bc'); // clear the screen (the key was visible)
    console.log('Done. QR printed, image deleted, screen cleared. Put the printout in the safe.');
    rl.close();
  });
});
