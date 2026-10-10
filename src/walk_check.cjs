// walk_check.cjs — definitive chunk-existence check via block walk (PC port of fetchGameViaWalk)
// Usage:
//   node walk_check.cjs --anchor <64hex> --daa_to <num> --manifest <64hex> [--head <64hex>] [--relay https://host] [--daa_pad 600]
// Quad source: kv_installed_games on the phone (anchor_hash, daa_to, manifestHash, head).
// Endpoint: defaults to KV_WALK_RELAY read from game_chunks.ts; override with --relay to test other nodes.
// Needs Node 18+ (global fetch). pako optional (falls back to zlib).
const fs = require('fs'); const crypto = require('crypto'); const zlib = require('zlib');
let pako; try { pako = require('pako'); } catch {}
const inflate = (buf) => pako ? Buffer.from(pako.inflate(buf)) : zlib.inflateSync(buf);
const hex = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };

(async () => {
  const useWrpc = process.argv.includes('--wrpc');
  let relay = arg('relay', '');
  if (!useWrpc && !relay) {
    try { const m = fs.readFileSync('game_chunks.ts', 'utf8').match(/KV_WALK_RELAY\s*=\s*['"]([^'"]+)['"]/); if (m) relay = m[1]; } catch {}
  }
  if (!useWrpc && !relay) { console.error('no endpoint: pass --relay, --wrpc, or run in repo next to game_chunks.ts'); process.exit(1); }
  const anchor = arg('anchor'); const daaTo = Number(arg('daa_to', 0));
  const manifestHash = arg('manifest'); const head = arg('head', '');
  if (!/^[0-9a-f]{64}$/.test(anchor || '') || !daaTo || !/^[0-9a-f]{64}$/.test(manifestHash || '')) {
    console.error('need --anchor <64hex> --daa_to <num> --manifest <64hex>  (from kv_installed_games quad)'); process.exit(1);
  }

  let rpc = null;
  if (useWrpc) {
    const { RpcClient, Resolver, NetworkId } = require('@kcoin/kaspa-web3.js');
    const url = arg('wrpc_url', '');
    rpc = url ? new RpcClient({ url, networkId: NetworkId.Testnet10 })
              : new RpcClient({ resolver: new Resolver(), networkId: NetworkId.Testnet10 });
    await rpc.connect();
    try { const si = await rpc.getServerInfo(); console.log('endpoint (wrpc):', url || 'resolver-assigned', '| server:', JSON.stringify(si).slice(0, 160)); }
    catch { console.log('endpoint (wrpc):', url || 'resolver-assigned'); }
  } else {
    console.log('endpoint:', relay);
  }

  let vdaa = 0;
  if (useWrpc) { const d = await rpc.getBlockDagInfo(); vdaa = Number(d.virtualDaaScore || 0); }
  else { const sink = await (await fetch(relay + '/api/kaspa/sink')).json(); vdaa = Number(sink.virtual_daa_score || 0); }
  console.log('virtual daa:', vdaa, '| daa_to:', daaTo, '| behind:', vdaa - daaTo);
  if (vdaa - daaTo > 1100000) console.log('WARNING: outside ~30h window by ' + ((vdaa - daaTo) / 1100000).toFixed(1) + 'x — a pruning node will serve nothing; only an archival node can say EXIST');

  const daaMax = daaTo + Number(arg('daa_pad', 600));
  const getPage = async (low) => {
    if (!useWrpc) return await (await fetch(relay + '/api/kaspa/blocks?low_hash=' + low + '&daa_max=' + daaMax + '&txs=1')).json();
    // wRPC: getBlocks(lowHash) → normalize to the relay page shape
    let res;
    try { res = await rpc.getBlocks({ lowHash: low, includeBlocks: true, includeTransactions: true }); }
    catch (e) { return { error: String(e && e.message || e) }; }
    const rb = res.blocks || [];
    const out = { blocks: [], next_low_hash: null, done: false };
    let pastMax = false, lastHash = low;
    for (const b of rb) {
      const hsh = (b.header && (b.header.hash)) || (res.blockHashes ? res.blockHashes[rb.indexOf(b)] : null);
      const daa = Number(b.header && b.header.daaScore || 0);
      if (hsh) lastHash = hsh;
      if (daa > daaMax) { pastMax = true; continue; }
      out.blocks.push({ txs: (b.transactions || []).map((t) => ({ payload_hex: String(t.payload || '') })) });
    }
    if (pastMax || rb.length <= 1) out.done = true; else out.next_low_hash = lastHash;
    return out;
  };

  const store = {}; const mstore = {};
  let low = anchor, pages = 0, retries = 0, blocks = 0, txs = 0, recs = 0;
  while (pages < 450) {
    let page;
    try { page = await getPage(low); }
    catch (e) { if (++retries > 20) { console.error('\nwalk: node unreachable: ' + e.message); process.exit(2); } await new Promise(r => setTimeout(r, 1500)); continue; }
    if (page && page.error) { console.error('\nnode said: ' + JSON.stringify(page).slice(0, 300)); break; }
    pages++;
    for (const b of (page.blocks || [])) { blocks++;
      for (const tx of (b.txs || [])) { txs++;
        try {
          const hx = String(tx.payload_hex || ''); if (!hx) continue;
          let raw = Buffer.from(hx, 'hex').toString('latin1');
          try { raw = decodeURIComponent(escape(raw)); } catch {}
          const rec = JSON.parse(raw.startsWith('KVP1') ? raw.slice(4) : raw);
          const d = rec && rec.d; if (!d || rec.k !== 'cfg') continue; recs++;
          if (d.ty === 'html' && d.h && typeof d.seq === 'number') {
            const k = d.h + ':' + d.seq;
            if (!store[k] || (rec.t || 0) > store[k].t) store[k] = { t: rec.t || 0, tot: d.tot, c: d.c };
          } else if (!d.ty && d.h === manifestHash && typeof d.seq === 'number') {
            if (!mstore[d.seq] || (rec.t || 0) > mstore[d.seq].t) mstore[d.seq] = { t: rec.t || 0, tot: d.tot, c: d.c };
          }
        } catch {}
      }
    }
    process.stdout.write('\rpages ' + pages + '  blocks ' + blocks + '  txs ' + txs + '  kv-records ' + recs + '   ');
    if (page.done || !page.next_low_hash) break;
    low = page.next_low_hash;
  }
  console.log('');

  if (!blocks) { console.log('VERDICT: node served NO blocks from the span — pruned (not archival). Per-node answer: cannot hold the chunks.'); process.exit(0); }
  const mtot = mstore[0] ? mstore[0].tot : 0;
  console.log('manifest chunks found: ' + Object.keys(mstore).length + '/' + (mtot || '?'));
  if (!mstore[0]) { console.log('VERDICT: blocks served but no manifest records in span — wrong span/anchor, or records outside walked range.'); process.exit(0); }
  let mb64 = '', miss = -1;
  for (let i = 0; i < mtot; i++) { if (!mstore[i]) { miss = i; break; } mb64 += mstore[i].c; }
  if (miss >= 0) { console.log('VERDICT: PARTIAL — manifest missing chunk ' + miss); process.exit(0); }
  const mjson = inflate(Buffer.from(mb64, 'base64')).toString('utf8');
  if (hex(mjson) !== manifestHash) { console.log('VERDICT: walked manifest hash mismatch'); process.exit(0); }
  const m = JSON.parse(mjson);
  if (head && m.head !== head) console.log('note: manifest head ' + m.head.slice(0, 8) + ' != pinned ' + head.slice(0, 8));
  console.log('manifest OK — fragments: ' + m.frags.length);
  let ok = 0; const missing = [];
  for (const f of m.frags) {
    const f0 = store[f.h + ':0'];
    if (!f0) { missing.push(f.i); continue; }
    let b64 = '', bad = false;
    for (let i = 0; i < f0.tot; i++) { const c = store[f.h + ':' + i]; if (!c) { bad = true; break; } b64 += c.c; }
    if (bad) { missing.push(f.i); continue; }
    try { const t = inflate(Buffer.from(b64, 'base64')).toString('utf8'); if (hex(t) === f.h) ok++; else missing.push(f.i); }
    catch { missing.push(f.i); }
  }
  console.log('fragments verified: ' + ok + '/' + m.frags.length + (missing.length ? '  missing/bad: ' + missing.slice(0, 10).join(',') + (missing.length > 10 ? '…' : '') : ''));
  console.log(ok === m.frags.length
    ? 'VERDICT: CHUNKS EXIST AND VERIFY on this node — you found an archival endpoint; pin it.'
    : 'VERDICT: PARTIAL — node retains some records but not the full set.');
  if (rpc) { try { (rpc.dispose || rpc.disconnect || (() => {})).call(rpc); } catch {} }
  process.exit(0);
})().catch(e => { console.error('FATAL: ' + (e && e.message || e)); process.exit(3); });
