// fix_cfg_retry.cjs — one API hiccup must not render as "Config not yet
// on-chain" (the chunks were on chain the whole time). The modal's config
// fetch retries once after 1.5s before giving up.
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_CFG_RETRY')) { console.log('already patched'); process.exit(0); }

const A = `            const { config, error: _cfgErr } = await fetchStoreConfig(item.arweaveTx, cfgHash, 'testnet-10', (item as any).coords || undefined);`;
const B = `            let { config, error: _cfgErr } = await fetchStoreConfig(item.arweaveTx, cfgHash, 'testnet-10', (item as any).coords || undefined);
            // KV_CFG_RETRY: one retry - a transient API miss must not read as "not on-chain"
            if (!config) { await new Promise((r) => setTimeout(r, 1500)); const _r2: any = await fetchStoreConfig(item.arweaveTx, cfgHash, 'testnet-10', (item as any).coords || undefined); if (_r2 && _r2.config) { config = _r2.config; _cfgErr = _r2.error; } }`;

const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }
s = s.split(A).join(B);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: config fetch retries once before reporting not-on-chain');
