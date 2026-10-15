// wire_repost_core.cjs — keeper/repost core (1 of 3).
//  kaspa_payload.ts:
//   - fetchRecords keeps each announce tx's SENDER address
//     (inputs[0].previous_outpoint_address, present with
//     resolve_previous_outpoints=light).
//   - DirectoryEntry gains repostedBy: when the newest announce for a
//     listing was sent by a wallet other than the author's own address,
//     that sender is the keeper who reposted it.
//  payload_publish.ts:
//   - repostRecord(keeper, record, kind): replay someone else's ORIGINAL
//     signed record to its registry. Record untouched - sig stays valid,
//     original t preserved so the author's newer updates/delists still win.
const fs = require('fs');

const jobs = [
  {
    f: 'kaspa_payload.ts',
    marker: 'KV_REPOST_ATTR',
    edits: [
      // 1. fetchRecords: widen the out type
      [
`  const out: Array<{ record: KvRecord; txid: string; blockTime: number }> = [];`,
`  const out: Array<{ record: KvRecord; txid: string; blockTime: number; sender?: string }> = [];`,
      ],
      // 2. fetchRecords: capture the tx sender
      [
`    out.push({ record: rec, txid: tx.transaction_id || '', blockTime: Number(tx.block_time || 0) });`,
`    out.push({ record: rec, txid: tx.transaction_id || '', blockTime: Number(tx.block_time || 0), sender: String((tx.inputs && tx.inputs[0] && tx.inputs[0].previous_outpoint_address) || '') });`,
      ],
      // 3. DirectoryEntry interface
      [
`  record: KvRecord;
  announcedAt: number;
}`,
`  record: KvRecord;
  announcedAt: number;
  repostedBy?: string; // KV_REPOST_ATTR: keeper wallet address when the announce sender != the author
}`,
      ],
      // 4. byAddr keeps the sender
      [
`    const _ak = String(r.d.storeAddress);
    if (!byAddr.has(_ak)) byAddr.set(_ak, { record: r, blockTime: a.blockTime }); // newest first already`,
`    const _ak = String(r.d.storeAddress);
    if (!byAddr.has(_ak)) byAddr.set(_ak, { record: r, blockTime: a.blockTime, sender: (a as any).sender || '' } as any); // newest first already`,
      ],
      // 5. loop: derive author's address, flag reposts
      [
`  for (const [, { record, blockTime }] of byAddr) {
    const owner = record.o;`,
`  for (const [, _ent] of byAddr) {
    const { record, blockTime } = _ent;
    const owner = record.o;
    // KV_REPOST_ATTR: announce sender != author's own wallet => a keeper replayed it
    let _repostedBy = '';
    try {
      const _snd = String((_ent as any).sender || '');
      if (_snd) {
        const { deriveAddress } = require('./canonical_agreement_steps');
        const _xo = String(owner || '').length === 66 ? String(owner).slice(2) : String(owner || '');
        const _ownAddr = deriveAddress(_xo, network as any);
        if (_ownAddr && _snd !== _ownAddr) _repostedBy = _snd;
      }
    } catch {}`,
      ],
      // 6. entry carries it
      [
`      record,
      announcedAt: blockTime,
    });`,
`      record,
      announcedAt: blockTime,
      repostedBy: _repostedBy,
    });`,
      ],
    ],
  },
  {
    f: 'payload_publish.ts',
    marker: 'KV_REPOST',
    edits: [
      [
`    amountSompi: 0n, // self-send; inscription is in payload (same as inscribeIdentityViaRest)
    privateKeyHex: owner.privateKeyHex,
    network: owner.network,
    payload: buildPayloadHex(rec),
  });
}`,
`    amountSompi: 0n, // self-send; inscription is in payload (same as inscribeIdentityViaRest)
    privateKeyHex: owner.privateKeyHex,
    network: owner.network,
    payload: buildPayloadHex(rec),
  });
}

/** KV_REPOST: replay someone else's ORIGINAL signed record to its registry.
 *  The record is untouched - its signature stays valid and its original t
 *  is preserved, so the author's newer updates and delists still win.
 *  Attribution is the tx itself: readers see the announce sender != the
 *  author's wallet and credit the keeper; tips go to that sender address. */
export async function repostRecord(keeper: OwnerKeys, record: KvRecord, kind: string = 'store') {
  const regAddr = registryAddress(String(kind), keeper.network);
  const res = await sendKaspaViaRest({
    senderAddress: keeper.address,
    recipientAddress: regAddr,
    amountSompi: ANNOUNCE_SOMPI,
    privateKeyHex: keeper.privateKeyHex,
    network: keeper.network,
    payload: buildPayloadHex(record),
  });
  console.log('[Repost]', String(((record as any).d && (record as any).d.name) || '').slice(0, 24), '-> registry', regAddr.slice(0, 24), 'by', keeper.address.slice(0, 24));
  return res;
}`,
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
console.log('DONE - repost core: sender attribution + repostRecord()');
