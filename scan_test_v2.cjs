// scan_test_v2.cjs — validate counterparty scan logic against live testnet REST.
//
// v2 fixes a false positive: ">=2 funders" matched ordinary personal wallets,
// which naturally accumulate funds from many sources. A FROST 2-of-2 escrow is
// funded by EXACTLY two parties, so exact arity is the correct test. A busy
// wallet also has far more transactions than a short-lived escrow.
//
// v2 also splits 'open': an escrow with a broadcast kill has no live refund
// path, so stuck funds there are a DEADLOCK, not merely a pending trade.
//
// Usage: node scan_test_v2.cjs <kaspa-address> [maxCandidates]

const BASE = 'https://api-tn10.kaspa.org';
const addr = process.argv[2];
const MAX = Number(process.argv[3] || 40);
const MAX_ESCROW_TXS = 12; // escrows are short-lived; wallets are not

if (!addr) { console.error('usage: node scan_test_v2.cjs <address> [maxCandidates]'); process.exit(1); }

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchTxs(a, limit) {
  const url = BASE + '/addresses/' + a + '/full-transactions?limit=' + limit + '&resolve_previous_outpoints=light';
  const r = await fetch(url);
  if (!r.ok) { console.warn('  ! HTTP', r.status, 'for', a.slice(0, 24)); return []; }
  const j = await r.json();
  return Array.isArray(j) ? j : [];
}

const spendsFrom = (tx, a) => Array.isArray(tx.inputs) && tx.inputs.some(i => i && i.previous_outpoint_address === a);
const paysTo = (tx, a) => !Array.isArray(tx.outputs) ? 0 :
  tx.outputs.filter(o => o && o.script_public_key_address === a).reduce((n, o) => n + Number(o.amount || 0), 0);
const outAddrs = (tx) => !Array.isArray(tx.outputs) ? [] :
  tx.outputs.map(o => o && o.script_public_key_address).filter(Boolean);

(async () => {
  console.log('Scanning', addr);
  const history = await fetchTxs(addr, 100);
  console.log('History:', history.length, 'txs\n');
  if (!history.length) return;

  const candidates = [];
  for (const tx of history) {
    if (!spendsFrom(tx, addr)) continue;
    for (const o of outAddrs(tx)) if (o !== addr && candidates.indexOf(o) < 0) candidates.push(o);
  }
  console.log('Payment destinations:', candidates.length,
              candidates.length > MAX ? '(TRUNCATED to ' + MAX + ')' : '');

  const examine = candidates.slice(0, MAX);
  const escrows = [];

  for (let n = 0; n < examine.length; n++) {
    const cand = examine[n];
    process.stdout.write('  [' + (n + 1) + '/' + examine.length + '] ' + cand.slice(0, 28) + '... ');
    await sleep(120);
    const txs = await fetchTxs(cand, 50);
    if (!txs.length) { console.log('no history'); continue; }

    if (txs.length > MAX_ESCROW_TXS) { console.log('busy address (' + txs.length + ' txs) - wallet, not escrow'); continue; }

    const funders = [];
    let fundedTotal = 0;
    for (const tx of txs) {
      const amt = paysTo(tx, cand);
      if (!amt) continue;
      fundedTotal += amt;
      for (const i of (tx.inputs || [])) {
        const f = i && i.previous_outpoint_address;
        if (f && f !== cand && funders.indexOf(f) < 0) funders.push(f);
      }
    }

    // EXACT 2: a 2-of-2 escrow has precisely two funding parties.
    if (funders.length !== 2) { console.log(funders.length + ' funders - not a 2-of-2'); continue; }
    if (funders.indexOf(addr) < 0) { console.log('target not a funder - skip'); continue; }

    const spends = txs.filter(t => spendsFrom(t, cand));
    let killCount = 0, settle = null;
    for (const sp of spends) {
      const outs = outAddrs(sp);
      if (!outs.some(o => o !== cand)) { killCount++; continue; }
      if (!settle || Number(sp.block_time || 0) > Number(settle.block_time || 0)) settle = sp;
    }
    const paidTo = settle ? outAddrs(settle).filter(o => o !== cand) : [];
    const resolution = settle ? 'settled' : (killCount > 0 ? 'deadlocked' : 'open');

    escrows.push({
      escrowAddr: cand, funders, fundedTotal, resolution,
      resolutionTxId: settle ? (settle.transaction_id || '') : '',
      paidTo, paidToTarget: paidTo.indexOf(addr) >= 0, killCount,
      counterparty: funders.find(f => f !== addr) || '',
    });
    console.log('ESCROW - ' + resolution.toUpperCase());
  }

  const cps = [];
  for (const e of escrows) if (e.counterparty && cps.indexOf(e.counterparty) < 0) cps.push(e.counterparty);

  const settled = escrows.filter(e => e.resolution === 'settled');
  const deadlocked = escrows.filter(e => e.resolution === 'deadlocked');
  const open = escrows.filter(e => e.resolution === 'open');
  const stuck = deadlocked.reduce((n, e) => n + e.fundedTotal, 0);

  console.log('\n=== SCAN RESULT ===');
  for (const e of escrows) {
    console.log(e.escrowAddr.slice(0, 34) + '...  ' + e.resolution +
                '  ' + (e.fundedTotal / 1e8).toFixed(2) + ' KAS' +
                (e.killCount ? '  kills:' + e.killCount : '') +
                (e.paidToTarget ? '  [paid target]' : ''));
  }

  console.log('\ntotal escrows: ' + escrows.length);
  console.log('  settled:    ' + settled.length);
  console.log('  deadlocked: ' + deadlocked.length + (stuck ? '  (' + (stuck / 1e8).toFixed(2) + ' KAS stuck, refund path dead)' : ''));
  console.log('  open:       ' + open.length);
  console.log('payouts received: ' + escrows.filter(e => e.paidToTarget).length);
  console.log('distinct counterparties: ' + cps.length +
              (cps.length === 1 && escrows.length > 3 ? '   <-- SYBIL SIGNAL: all trades against one address' : ''));
  if (escrows.length) {
    console.log('pSettled: ' + (settled.length / escrows.length).toFixed(3));
  }
})();
