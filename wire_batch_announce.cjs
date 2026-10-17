// wire_batch_announce.cjs — batch announces + directory hardening.
//  kaspa_payload.ts
//   - fetchRecords(addr, net, limit, maxPages=1): KV_PAGE_BY_TIME - keeps
//     paging (offset) while pages are full and still inside ~48h, deduped by
//     txid. A registry flood slows the scan instead of erasing listings.
//   - rebuildDirectory: KV_BATCH_READ - signed {d:{batch:[...]}} announces
//     are verified ONCE then expanded into one entry per listing (the parent
//     record rides along as _parent for replay). KV_SENDER_CAP - one wallet
//     can occupy at most 30 directory records per scan.
//  payload_publish.ts: announceBatch(owner, kind, items) - up to 4 listings
//    per registry tx (1 KAS per batch instead of per listing).
//  Workspace.tsx: "Re-announce My Abstracts" sends ONE batch (blank titles
//    skipped) instead of one announce per abstract.
//  VillageMailbox.tsx: Repost replays the original signed batch record
//    (_parent) so signatures stay valid.
const fs = require('fs');

const FETCH_OLD = [
  '  let txs: any[] = [];',
  '  try {',
  '    txs = await getJson(',
  '      `${apiBase(network)}/addresses/${encodeURIComponent(address)}/full-transactions?limit=${limit}&resolve_previous_outpoints=light`',
  '    );',
  '  } catch { txs = []; }',
].join('\n');
const FETCH_NEW = [
  '  let txs: any[] = [];',
  '  try {',
  '    txs = await getJson(',
  '      `${apiBase(network)}/addresses/${encodeURIComponent(address)}/full-transactions?limit=${limit}&resolve_previous_outpoints=light`',
  '    );',
  '    // KV_PAGE_BY_TIME: keep paging while pages are full and still inside the window',
  "    const _seenTx = new Set<string>((txs || []).map((t: any) => String(t.transaction_id || '')));",
  '    for (let _pg = 1; _pg < maxPages && (txs || []).length >= limit * _pg; _pg++) {',
  '      const _oldest = Math.min(...(txs || []).map((t: any) => Number(t.block_time || Date.now())));',
  '      if (Date.now() - _oldest > 48 * 3600 * 1000) break;',
  '      const _more: any[] = await getJson(`${apiBase(network)}/addresses/${encodeURIComponent(address)}/full-transactions?limit=${limit}&offset=${limit * _pg}&resolve_previous_outpoints=light`);',
  "      const _fresh = (_more || []).filter((t: any) => !_seenTx.has(String(t.transaction_id || '')));",
  '      if (!_fresh.length) break;',
  "      for (const t of _fresh) _seenTx.add(String(t.transaction_id || ''));",
  '      txs = txs.concat(_fresh);',
  '    }',
  '  } catch { txs = txs || []; }',
].join('\n');

const jobs = [
  {
    f: 'kaspa_payload.ts',
    marker: 'KV_BATCH_READ',
    edits: [
      [
        'export async function fetchRecords(address: string, network = \'testnet-10\', limit = 50): Promise<Array<{ record: KvRecord; txid: string; blockTime: number }>> {',
        'export async function fetchRecords(address: string, network = \'testnet-10\', limit = 50, maxPages = 1): Promise<Array<{ record: KvRecord; txid: string; blockTime: number }>> {',
      ],
      [FETCH_OLD, FETCH_NEW],
      [
        '  const anns = await fetchRecords(registryAddress, network, 100);',
        [
          '  // KV_BATCH_READ: page by time, then expand signed batch announces (verified once)',
          '  const _annsRaw = await fetchRecords(registryAddress, network, 100, 5);',
          '  const anns: any[] = [];',
          '  const _senderCount = new Map<string, number>();',
          '  for (const _a0 of _annsRaw) {',
          '    const _r0: any = _a0.record;',
          '    if (_r0 && _r0.k === \'registry\' && _r0.d && Array.isArray(_r0.d.batch)) {',
          '      if (!verifyRecord(_r0)) continue;',
          '      for (const _it of _r0.d.batch.slice(0, 12)) {',
          '        if (!_it || !_it.storeAddress) continue;',
          '        anns.push({ ..._a0, record: { ..._r0, d: _it, _bv: 1, _parent: _r0 } });',
          '      }',
          '    } else anns.push(_a0);',
          '  }',
        ].join('\n'),
      ],
      [
        '    if (r.k !== \'registry\') continue;\n    if (!verifyRecord(r)) continue;',
        [
          '    if (r.k !== \'registry\') continue;',
          '    if (!(r as any)._bv && !verifyRecord(r)) continue;',
          '    // KV_SENDER_CAP: one wallet cannot occupy the directory scan',
          "    { const _sk = String((a as any).sender || r.o || ''); const _sc = (_senderCount.get(_sk) || 0) + 1; _senderCount.set(_sk, _sc); if (_sc > 30) continue; }",
        ].join('\n'),
      ],
    ],
  },
  {
    f: 'payload_publish.ts',
    marker: 'KV_BATCH_ANNOUNCE',
    edits: [
      [
        "    } catch (e) { console.warn('[RepostStrip] record failed:', (rec as any).k, e); }\n  }\n  return out;\n}",
        [
          "    } catch (e) { console.warn('[RepostStrip] record failed:', (rec as any).k, e); }",
          '  }',
          '  return out;',
          '}',
          '',
          '/** KV_BATCH_ANNOUNCE: one registry tx announces up to 4 listings -',
          ' *  1 KAS per batch instead of per listing. Readers verify the batch',
          ' *  signature once and expand it into one directory entry per item. */',
          'export async function announceBatch(owner: OwnerKeys, kind: string, items: any[]) {',
          '  const out: any[] = [];',
          '  const regAddr = registryAddress(String(kind), owner.network);',
          '  for (let i = 0; i < items.length; i += 4) {',
          "    const rec = signRecord({ k: 'registry', v: 1, o: owner.pubkeyHex, t: Date.now(), d: { batch: items.slice(i, i + 4) } } as any, owner.privateKeyHex);",
          '    const res: any = await sendKaspaViaRest({',
          '      senderAddress: owner.address,',
          '      recipientAddress: regAddr,',
          '      amountSompi: ANNOUNCE_SOMPI,',
          '      privateKeyHex: owner.privateKeyHex,',
          '      network: owner.network,',
          '      payload: buildPayloadHex(rec),',
          '    });',
          "    console.log('[AnnounceBatch]', Math.min(4, items.length - i), 'listing(s) ->', regAddr.slice(0, 24));",
          '    out.push(res);',
          '  }',
          '  return out;',
          '}',
        ].join('\n'),
      ],
    ],
  },
  {
    f: 'Workspace.tsx',
    marker: 'KV_BATCH_REANNOUNCE',
    edits: [
      [
        '      let _ok = 0, _skip = 0;\n      for (const _a of _list) {\n        const _nS = await AS.getItem(\'kv_abs_nonce_\' + _a.id);',
        '      let _ok = 0, _skip = 0;\n      const _batch: any[] = []; // KV_BATCH_REANNOUNCE\n      for (const _a of _list) {\n        const _nS = await AS.getItem(\'kv_abs_nonce_\' + _a.id);',
      ],
      [
        [
          "        const _an: any = await announceToRegistry(_owner, _st, String(_a.title || '').trim(), 'Academic', 'store', { primaryLink: _a.repositoryUrl, ...(_h ? { configHash: _h } : {}), coords: _c, ...(_dk ? { dkim: true, dkimDomain: _dk } : {}) } as any);",
          "        if (_an && _an.success !== false) _ok++;",
          "        console.log('[Academic] re-announce', _a.id, '->', _st.slice(0, 24), _an && _an.success !== false ? 'OK' : 'FAIL');",
          '      }',
          "      Alert.alert('Re-announced', _ok + ' abstract(s) re-advertised' + (_skip ? ', ' + _skip + ' skipped (no pledge nonce)' : '') + '. ~1 KAS each.');",
        ].join('\n'),
        [
          "        if (!String(_a.title || '').trim()) { _skip++; continue; }",
          "        _batch.push({ storeAddress: _st, name: String(_a.title).trim(), category: 'Academic', ...(_a.repositoryUrl ? { primaryLink: _a.repositoryUrl } : {}), ...(_h ? { configHash: _h } : {}), ...(_c ? { coords: _c } : {}), ...(_dk ? { dkim: true, dkimDomain: _dk } : {}) });",
          "        console.log('[Academic] batched', _a.id, '->', _st.slice(0, 24));",
          '      }',
          '      if (_batch.length) {',
          "        const { announceBatch } = require('./payload_publish');",
          "        const _rs: any[] = await announceBatch(_owner, 'store', _batch);",
          '        for (let _bi = 0; _bi < _rs.length; _bi++) { if (_rs[_bi] && _rs[_bi].success !== false) _ok += Math.min(4, _batch.length - _bi * 4); }',
          '      }',
          "      Alert.alert('Re-announced', _ok + ' abstract(s) in ' + Math.ceil(_batch.length / 4) + ' batch tx(s)' + (_skip ? ', ' + _skip + ' skipped' : '') + '. ~1 KAS per batch.');",
        ].join('\n'),
      ],
    ],
  },
  {
    f: 'VillageMailbox.tsx',
    marker: 'KV_BATCH_REPOST',
    edits: [
      [
        '    const rec = entry && entry.record;',
        '    const rec = entry && entry.record && ((entry.record as any)._parent || entry.record); // KV_BATCH_REPOST: replay the original signed batch',
      ],
    ],
  },
];

let ok = true;
const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8');
  const CRLF = s.includes('\r\n');
  if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (let i = 0; i < j.edits.length; i++) {
    const c = s.split(j.edits[i][0]).length - 1;
    if (c !== 1) { console.error(j.f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; }
  }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) {
  let s = j.s;
  for (const [a, b] of j.edits) s = s.split(a).join(b);
  fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s);
  console.log(j.f + ': patched');
}
console.log('DONE - batch announces + paged/capped directory scan.');
