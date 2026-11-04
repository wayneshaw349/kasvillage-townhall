// KV_MONEY_AUDIT: "Where did my KAS go?" - reads your own address history straight off the
// chain and sorts every transaction into plain buckets. No server and no estimates: each tx's
// own payload says what it was (cfg = data stake parked at addresses your key controls,
// registry/delist = listing records, no payload = a plain send). Read-only - signs nothing.
export interface MoneyAudit {
  txCount: number;
  sinceMs: number;    // oldest tx covered (0 = unknown)
  partial: boolean;   // true when the history is longer than one page (last 500 txs shown)
  stakedOut: bigint;  // parked at your own derived addresses (reclaimable - see My Pledges)
  listingOut: bigint; // registry announces + delists (the cost of being listed)
  sentOut: bigint;    // plain sends to other addresses (payments, tips, funding other wallets)
  fees: bigint;       // network fees on your sends
  received: bigint;   // everything that came in (reclaims, payments, refunds)
}

export async function auditMyMoney(address: string, network: string): Promise<MoneyAudit> {
  const { apiBase } = require('./kaspa_payload');
  const ctl = new AbortController(); const _t = setTimeout(() => ctl.abort(), 20000);
  let txs: any[];
  try {
    const r = await fetch(apiBase(network) + '/addresses/' + encodeURIComponent(address) + '/full-transactions?limit=500&resolve_previous_outpoints=light', { signal: ctl.signal });
    txs = await r.json();
  } finally { clearTimeout(_t); }
  if (!Array.isArray(txs)) throw new Error('could not read the chain - try again');
  const A: MoneyAudit = { txCount: 0, sinceMs: 0, partial: txs.length >= 500, stakedOut: 0n, listingOut: 0n, sentOut: 0n, fees: 0n, received: 0n };
  for (const tx of txs) {
    try {
      const ins: any[] = tx.inputs || [], outs: any[] = tx.outputs || [];
      const mineIn = ins.filter((i) => i && i.previous_outpoint_address === address);
      const allIn: bigint = ins.reduce((a: bigint, i: any) => a + BigInt((i && i.previous_outpoint_amount) || 0), 0n);
      const outSum: bigint = outs.reduce((a: bigint, o: any) => a + BigInt((o && o.amount) || 0), 0n);
      const toMe: bigint = outs.filter((o: any) => o && o.script_public_key_address === address).reduce((a: bigint, o: any) => a + BigInt(o.amount || 0), 0n);
      const t = Number(tx.block_time || 0); if (t && (!A.sinceMs || t < A.sinceMs)) A.sinceMs = t;
      A.txCount++;
      if (mineIn.length && mineIn.length === ins.length) {
        // a send of mine: where did the non-change part go?
        const toOthers = outSum - toMe;
        if (allIn > outSum) A.fees += allIn - outSum;
        let kind = '';
        try {
          const hx = String(tx.payload || tx.payload_hex || '');
          if (hx) { let raw = ''; for (let i = 0; i < Math.min(hx.length, 240); i += 2) raw += String.fromCharCode(parseInt(hx.substr(i, 2), 16));
            const m = raw.match(/"k"\s*:\s*"([a-z_]+)"/); kind = (m && m[1]) || ''; }
        } catch {}
        if (toOthers > 0n) {
          if (kind === 'cfg') A.stakedOut += toOthers;                       // data chunks -> your own derived slots
          else if (kind === 'registry' || kind === 'delist') A.listingOut += toOthers;
          else A.sentOut += toOthers;
        }
      } else if (!mineIn.length && toMe > 0n) {
        A.received += toMe;
      }
    } catch {}
  }
  return A;
}
