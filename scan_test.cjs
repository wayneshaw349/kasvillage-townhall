// scan_test.cjs — validate the counterparty scan logic against live testnet REST.
// Mirrors counterparty_scan.ts exactly, minus AsyncStorage/deriveAddress, so you can
// tune the escrow-detection heuristic before wiring any UI.
//
// Usage: node scan_test.cjs <kaspa-address> [maxCandidates]

const BASE = 'https://api-tn10.kaspa.org';
const addr = process.argv[2];
const MAX = Number(process.argv[3] || 25);

if (!addr) { console.error('usage: node scan_test.cjs <address> [maxCandidates]'); process.exit(1); }

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
  console.log('Payment destinations found:', candidates.length,
              candidates.length > MAX ? '(TRUNCATED to ' + MAX + ')' : '');

  const examine = candidates.slice(0, MAX);
  const escrows = [];

  for (let n = 0; n < examine.length; n++) {
    const cand = examine[n];
    process.stdout.write('  [' + (n + 1) + '/' + examine.length + '] ' + cand.slice(0, 28) + '... ');
    await sleep(120); // be polite to the public endpoint
    const txs = await fetchTxs(cand, 50);
    if (!txs.length) { console.log('no history'); continue; }

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

    if (funders.length < 2) { console.log('single funder - ordinary payment'); continue; }
    if (funders.indexOf(addr) < 0) { console.log('target not a funder - skip'); continue; }

    const spends = txs.filter(t => spendsFrom(t, cand));
    let killCount = 0, settle = null;
    for (const sp of spends) {
      const outs = outAddrs(sp);
      if (!outs.some(o => o !== cand)) { killCount++; continue; }
      if (!settle || Number(sp.block_time || 0) > Number(settle.block_time || 0)) settle = sp;
    }
    const paidTo = settle ? outAddrs(settle).filter(o => o !== cand) : [];

    escrows.push({
      escrowAddr: cand, funders, fundedTotal,
      resolution: settle ? 'settled' : 'open',
      resolutionTxId: settle ? (settle.transaction_id || '') : '',
      paidTo, paidToTarget: paidTo.indexOf(addr) >= 0, killCount,
    });
    console.log('ESCROW (' + funders.length + ' funders, ' + (settle ? 'settled' : 'OPEN') + ')');
  }

  const cps = [];
  for (const e of escrows) for (const f of e.funders) if (f !== addr && cps.indexOf(f) < 0) cps.push(f);

  console.log('\n=== SCAN RESULT ===');
  for (const e of escrows) {
    console.log(e.escrowAddr.slice(0, 34) + '...');
    console.log('   funded: ' + (e.fundedTotal / 1e8).toFixed(4) + ' KAS  kills: ' + e.killCount);
    console.log('   ' + e.resolution + (e.resolutionTxId ? ' via ' + e.resolutionTxId.slice(0, 16) : ''));
    console.log('   paid to target: ' + e.paidToTarget);
  }
  console.log('\ntotal escrows: ' + escrows.length +
              '  settled: ' + escrows.filter(e => e.resolution === 'settled').length +
              '  open: ' + escrows.filter(e => e.resolution === 'open').length);
  console.log('payouts received: ' + escrows.filter(e => e.paidToTarget).length);
  console.log('distinct counterparties: ' + cps.length +
              (cps.length === 1 && escrows.length > 3 ? '  <-- SYBIL SIGNAL' : ''));
})();
