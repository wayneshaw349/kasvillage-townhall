#!/usr/bin/env node
// Count-guarded, CRLF-tolerant, idempotent inserter for restoreWalletFromMnemonic().
// Usage:  node patch_restore_wallet.cjs [path\to\wallet_registration_v2.ts]
const fs = require('fs');
const FILE = process.argv[2] || 'wallet_registration_v2.ts';
const PAYLOAD = Buffer.from('ZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlc3RvcmVXYWxsZXRGcm9tTW5lbW9uaWMoCiAgbW5lbW9uaWM6IHN0cmluZywKICBuZXR3b3JrOiAnbWFpbm5ldCcgfCAndGVzdG5ldC0xMCcgfCAndGVzdG5ldC0xMScgPSAndGVzdG5ldC0xMCcsCik6IFByb21pc2U8ewogIHN1Y2Nlc3M6IGJvb2xlYW47CiAgcHVibGljS2V5Pzogc3RyaW5nOwogIGthc3BhQWRkcmVzcz86IHN0cmluZzsKICBlcnJvcj86IHN0cmluZzsKfT4gewogIHRyeSB7CiAgICBpZiAoIW1uZW1vbmljIHx8IG1uZW1vbmljLnRyaW0oKS5zcGxpdCgvXHMrLykubGVuZ3RoICE9PSAxMikgewogICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdJbnZhbGlkIHJlY292ZXJ5IHBocmFzZSAobmVlZCAxMiB3b3JkcyknIH07CiAgICB9CgogICAgY29uc3QgeyBtbmVtb25pY1RvU2VlZCwgZGVyaXZlS2FzcGFIREtleSB9ID0gYXdhaXQgaW1wb3J0KCcuL2JpcDM5X3dhbGxldCcpOwoKICAgIC8vIEVNUFRZIHBhc3NwaHJhc2Ug4oCUIG11c3QgbWF0Y2ggY3JlYXRlV2FsbGV0J3MgcmFuZG9tIGJyYW5jaCBleGFjdGx5LgogICAgY29uc3Qgc2VlZCA9IGF3YWl0IG1uZW1vbmljVG9TZWVkKG1uZW1vbmljLCAnJyk7CiAgICBjb25zdCBoZEtleSA9IGRlcml2ZUthc3BhSERLZXkoc2VlZCk7CiAgICBjb25zdCBwdWJCeXRlcyA9IGdldFB1YmxpY0tleShoZEtleS5wcml2YXRlS2V5LCB0cnVlKTsKICAgIGNvbnN0IHhPbmx5ID0gcHViQnl0ZXMuc2xpY2UoMSk7CiAgICBjb25zdCBocnAgPSBuZXR3b3JrLnN0YXJ0c1dpdGgoJ3Rlc3RuZXQnKSA/ICdrYXNwYXRlc3QnIDogJ2thc3BhJzsKCiAgICBjb25zdCB3YWxsZXQgPSB7CiAgICAgIG1uZW1vbmljLAogICAgICBwcml2YXRlS2V5SGV4OiBieXRlc1RvSGV4KGhkS2V5LnByaXZhdGVLZXkpLAogICAgICBwdWJsaWNLZXlIZXg6IGJ5dGVzVG9IZXgocHViQnl0ZXMpLAogICAgICBrYXNwYUFkZHJlc3M6IGthc3BhQWRkcmVzc0Zyb21YT25seSh4T25seSwgaHJwKSwKICAgICAgc2VlZDogc2VlZC5zbGljZSgwLCAzMiksCiAgICB9OwoKICAgIC8vIFN0ZWFsdGgga2V5cyBmcm9tIHRoZSBzYW1lIDMyLWJ5dGUgc2VlZCBzbGljZSAoYXMgY3JlYXRlV2FsbGV0KS4KICAgIGF3YWl0IGdlbmVyYXRlU3RlYWx0aEtleXMod2FsbGV0LnNlZWQpOwoKICAgIC8vIC0tLS0gaWRlbnRpY2FsIFNlY3VyZVN0b3JlIHdyaXRlcyAtLS0tCiAgICBhd2FpdCBTZWN1cmVTdG9yZS5zZXRJdGVtQXN5bmMoU1RPUkVfS0VZUy5QUklWQVRFX0tFWSwgd2FsbGV0LnByaXZhdGVLZXlIZXgsIHsKICAgICAga2V5Y2hhaW5BY2Nlc3NpYmxlOiBTZWN1cmVTdG9yZS5XSEVOX1BBU1NDT0RFX1NFVF9USElTX0RFVklDRV9PTkxZLAogICAgfSk7CiAgICBhd2FpdCBTZWN1cmVTdG9yZS5zZXRJdGVtQXN5bmMoU1RPUkVfS0VZUy5QVUJMSUNfS0VZLCB3YWxsZXQucHVibGljS2V5SGV4KTsKICAgIGF3YWl0IFNlY3VyZVN0b3JlLnNldEl0ZW1Bc3luYyhTVE9SRV9LRVlTLktBU1BBX0FERFJFU1MsIHdhbGxldC5rYXNwYUFkZHJlc3MpOwogICAgYXdhaXQgU2VjdXJlU3RvcmUuc2V0SXRlbUFzeW5jKFNUT1JFX0tFWVMuTUFTVEVSX1NFRUQsIGJ5dGVzVG9IZXgod2FsbGV0LnNlZWQpLCB7CiAgICAgIGtleWNoYWluQWNjZXNzaWJsZTogU2VjdXJlU3RvcmUuV0hFTl9QQVNTQ09ERV9TRVRfVEhJU19ERVZJQ0VfT05MWSwKICAgIH0pOwogICAgYXdhaXQgU2VjdXJlU3RvcmUuc2V0SXRlbUFzeW5jKFNUT1JFX0tFWVMuUkVHSVNUUkFUSU9OX1NUQVRVUywgJ3dhbGxldF9jcmVhdGVkJyk7CgogICAgLy8gcHJlc2VydmUgc3RhdHMgY2FjaGUgaWYgcHJlc2VudCwgZWxzZSBzZWVkIGRlZmF1bHRzIChUb3duSGFsbCByZWZpbGxzIGJ5IHB1YmtleSkKICAgIGNvbnN0IGV4aXN0aW5nU3RhdHMgPSBhd2FpdCBBc3luY1N0b3JhZ2UuZ2V0SXRlbShTVE9SRV9LRVlTLlVTRVJfU1RBVFMpOwogICAgaWYgKCFleGlzdGluZ1N0YXRzKSB7CiAgICAgIGF3YWl0IEFzeW5jU3RvcmFnZS5zZXRJdGVtKFNUT1JFX0tFWVMuVVNFUl9TVEFUUywgSlNPTi5zdHJpbmdpZnkoY3JlYXRlRGVmYXVsdFVzZXJTdGF0cygpKSk7CiAgICB9CgogICAgLy8gLS0tLSBlbmNyeXB0ZWQgcHJpdmtleSBibG9jayAoaWRlbnRpdHlfaW5zY3JpcHRpb25fdjYgY29tcGF0aWJpbGl0eSkgLS0tLQogICAgbGV0IGRldmljZUVuY0tleSA9IGF3YWl0IFNlY3VyZVN0b3JlLmdldEl0ZW1Bc3luYygnZGV2aWNlX2VuY3J5cHRpb25fa2V5Jyk7CiAgICBpZiAoIWRldmljZUVuY0tleSkgewogICAgICBjb25zdCByYW5kb21CeXRlcyA9IGF3YWl0IENyeXB0by5nZXRSYW5kb21CeXRlc0FzeW5jKDMyKTsKICAgICAgZGV2aWNlRW5jS2V5ID0gQXJyYXkuZnJvbShuZXcgVWludDhBcnJheShyYW5kb21CeXRlcyksIGIgPT4gYi50b1N0cmluZygxNikucGFkU3RhcnQoMiwgJzAnKSkuam9pbignJyk7CiAgICAgIGF3YWl0IFNlY3VyZVN0b3JlLnNldEl0ZW1Bc3luYygnZGV2aWNlX2VuY3J5cHRpb25fa2V5JywgZGV2aWNlRW5jS2V5LCB7CiAgICAgICAga2V5Y2hhaW5BY2Nlc3NpYmxlOiBTZWN1cmVTdG9yZS5XSEVOX1BBU1NDT0RFX1NFVF9USElTX0RFVklDRV9PTkxZLAogICAgICB9KTsKICAgIH0KICAgIGNvbnN0IGNvbWJpbmVkID0gZGV2aWNlRW5jS2V5ICsgd2FsbGV0LnByaXZhdGVLZXlIZXg7CiAgICBjb25zdCBrZXlTdHJlYW0gPSBhd2FpdCBDcnlwdG8uZGlnZXN0U3RyaW5nQXN5bmMoCiAgICAgIENyeXB0by5DcnlwdG9EaWdlc3RBbGdvcml0aG0uU0hBMjU2LAogICAgICBjb21iaW5lZCwKICAgICk7CiAgICBjb25zdCBlbmNyeXB0ZWRDaGFyczogc3RyaW5nW10gPSBbXTsKICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNjQ7IGkgKz0gMikgewogICAgICBjb25zdCBwcml2Qnl0ZSA9IHBhcnNlSW50KHdhbGxldC5wcml2YXRlS2V5SGV4LnNsaWNlKGksIGkgKyAyKSwgMTYpOwogICAgICBjb25zdCBrc0J5dGUgPSBwYXJzZUludChrZXlTdHJlYW0uc2xpY2UoaSAlIGtleVN0cmVhbS5sZW5ndGgsIChpICUga2V5U3RyZWFtLmxlbmd0aCkgKyAyKSwgMTYpOwogICAgICBlbmNyeXB0ZWRDaGFycy5wdXNoKChwcml2Qnl0ZSBeIGtzQnl0ZSkudG9TdHJpbmcoMTYpLnBhZFN0YXJ0KDIsICcwJykpOwogICAgfQogICAgYXdhaXQgU2VjdXJlU3RvcmUuc2V0SXRlbUFzeW5jKCdrdl9sMV9wcml2a2V5X2VuYycsIEpTT04uc3RyaW5naWZ5KHsgcHJpdmF0ZUtleUVuYzogZW5jcnlwdGVkQ2hhcnMuam9pbignJykgfSksIHsKICAgICAga2V5Y2hhaW5BY2Nlc3NpYmxlOiBTZWN1cmVTdG9yZS5XSEVOX1BBU1NDT0RFX1NFVF9USElTX0RFVklDRV9PTkxZLAogICAgfSk7CgogICAgYXdhaXQgU2VjdXJlU3RvcmUuc2V0SXRlbUFzeW5jKCdrYXNwYV9hZGRyZXNzJywgd2FsbGV0Lmthc3BhQWRkcmVzcyk7CiAgICBhd2FpdCBTZWN1cmVTdG9yZS5zZXRJdGVtQXN5bmMoJ2thc3BhX25ldHdvcmsnLCBuZXR3b3JrKTsKCiAgICAvLyBleHBvcnQgY29udGludWl0eSArIGJvb3QtYXMtcmV0dXJuaW5nOgogICAgYXdhaXQgU2VjdXJlU3RvcmUuc2V0SXRlbUFzeW5jKCdrdl9tbmVtb25pYycsIG1uZW1vbmljLCB7CiAgICAgIGtleWNoYWluQWNjZXNzaWJsZTogU2VjdXJlU3RvcmUuV0hFTl9QQVNTQ09ERV9TRVRfVEhJU19ERVZJQ0VfT05MWSwKICAgIH0pOwogICAgYXdhaXQgU2VjdXJlU3RvcmUuc2V0SXRlbUFzeW5jKCdrdl92ZXJpZmllZCcsICd0cnVlJyk7IC8vIEFwcE5hdmlnYXRvciBib290IHRyZWF0cyBhcyByZXR1cm5pbmcKCiAgICBjb25zb2xlLmxvZygnW3Jlc3RvcmVXYWxsZXRdIFJlc3RvcmVkIGFkZHJlc3M6Jywgd2FsbGV0Lmthc3BhQWRkcmVzcyk7CiAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBwdWJsaWNLZXk6IHdhbGxldC5wdWJsaWNLZXlIZXgsIGthc3BhQWRkcmVzczogd2FsbGV0Lmthc3BhQWRkcmVzcyB9OwogIH0gY2F0Y2ggKGVycm9yKSB7CiAgICBjb25zb2xlLmVycm9yKCdbcmVzdG9yZVdhbGxldEZyb21NbmVtb25pY10gZmFpbGVkOicsIGVycm9yKTsKICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1dhbGxldCByZXN0b3JlIGZhaWxlZC4nIH07CiAgfQp9Cg==', 'base64').toString('utf8');

let s = fs.readFileSync(FILE, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';

// idempotency
if (/export async function restoreWalletFromMnemonic/.test(s)) {
  console.log('[skip] restoreWalletFromMnemonic already present — no change.');
  process.exit(0);
}

// CRLF-tolerant anchor: the STEP 2 header block (immediately after createWallet)
const anchorText =
  '// ============================================================================\n' +
  '// STEP 2: GENERATE DEVICE ATTESTATION\n' +
  '// ============================================================================';
const anchorRe = new RegExp(anchorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\n/g, '\r?\n'));

const count = (s.match(new RegExp(anchorRe.source, 'g')) || []).length;
if (count !== 1) { console.error('[abort] STEP 2 anchor found ' + count + ' times (expected 1).'); process.exit(1); }
const m = s.match(anchorRe);

const payload = PAYLOAD.replace(/\n/g, eol).replace(/[\r\n]+$/, '');
s = s.replace(anchorRe, payload + eol + eol + m[0]);

// post-conditions
const pc1 = (s.match(/export async function restoreWalletFromMnemonic/g) || []).length;
const pc2 = /mnemonicToSeed\(mnemonic, ''\)/.test(s);   // must use EMPTY passphrase
if (pc1 !== 1 || !pc2) { console.error('[abort] post-condition failed (fn=' + pc1 + ', emptyPass=' + pc2 + ').'); process.exit(1); }

fs.writeFileSync(FILE, s);
console.log('[ok] inserted restoreWalletFromMnemonic into ' + FILE + ' (eol=' + JSON.stringify(eol) + ').');
