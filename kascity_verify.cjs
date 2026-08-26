#!/usr/bin/env node
// kascity_verify.cjs — independent verifier for a KasCity result payload
//
//   node kascity_verify.cjs result.json
//   node kascity_verify.cjs result.json --scene kascity_v85.json     (adds board-level checks)
//
// This is the piece that makes the whole scheme mean anything: a third party runs it and either the
// record holds up or it does not. It never trusts a number in the payload — every claim is recomputed
// from the move log and compared.
//
// WHAT IT PROVES
//   1. CHAIN INTEGRITY   the move root is recomputed from the moves themselves. Alter one move, one
//                        seat, one value, and the root will not match. This is the strong check.
//   2. XP DERIVATION     XP is recomputed from the declared rules and compared to what was claimed.
//   3. STRUCTURE         indices are contiguous, seats are in range, the clock only runs down,
//                        properties reconcile against buy/trade moves, rank matches net worth order.
//   4. IDENTITY          reports whether seats are bound to wallets and whether a real signature is
//                        present — currently they are not, and it says so rather than implying trust.
//
// WHAT IT CANNOT PROVE without the scene JSON: that the moves were legal (that you could afford the
// buy, that you landed on that square). Pass --scene to enable the board-level checks that are
// possible, and see NOTES at the end for what still requires a full replay engine.

const fs = require('fs');
const crypto = require('crypto');

const args = process.argv.slice(2);
const file = args[0];
const sceneIdx = args.indexOf('--scene');
const sceneFile = sceneIdx >= 0 ? args[sceneIdx + 1] : null;

if (!file) {
  console.error('usage: node kascity_verify.cjs <result.json> [--scene <scene.json>]');
  process.exit(2);
}
if (!fs.existsSync(file)) { console.error('no such file: ' + file); process.exit(2); }

const R = JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = s => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

const pass = [], fail = [], note = [];
const ok = (c, m) => (c ? pass : fail).push(m);

console.log('\n  KASCITY RESULT VERIFIER');
console.log('  ' + '-'.repeat(58));
console.log('  file      ' + file);
console.log('  kind      ' + (R.kind || '(missing)'));
console.log('  mode      ' + (R.mode || '?') + (R.humans ? ('  ·  ' + R.humans + ' human seat(s)') : ''));
console.log('  moves     ' + (R.moves ? R.moves.length : 0));
console.log('  ' + '-'.repeat(58) + '\n');

// ---------------------------------------------------------------- 1. chain
if (!Array.isArray(R.moves)) {
  fail.push('no move log present — nothing can be verified');
} else {
  let chain = sha((R.seed || 'kv') + '|kascity|' + (R.mode || 'solo'));
  const genesis = chain;
  for (const m of R.moves) {
    chain = sha(chain + '|' + m.i + '|' + m.s + '|' + m.a + '|' + m.v + '|' + m.t);
  }
  ok(chain === R.moveRoot,
     'move root ' + (chain === R.moveRoot ? 'matches the log' : 'DOES NOT MATCH — the log has been altered'));
  if (chain !== R.moveRoot) {
    note.push('claimed root   ' + R.moveRoot);
    note.push('computed root  ' + chain);
  }
  ok(R.moveCount === R.moves.length, 'moveCount agrees with the log length');
  note.push('genesis ' + genesis.slice(0, 16) + '…  (seed + mode)');

  // seed commitment
  if (R.seedCommit) {
    const expect = sha((R.seed || 'kv') + '|commit');
    ok(expect === R.seedCommit, 'seed commitment matches the seed');
  } else note.push('no seed commitment — the board could have been grinded for');
}

// ------------------------------------------------------------ 2. structure
if (Array.isArray(R.moves) && R.moves.length) {
  let contiguous = true, seatsOk = true, clockOk = true, lastT = Infinity;
  R.moves.forEach((m, ix) => {
    if (m.i !== ix) contiguous = false;
    if (!(m.s >= 1 && m.s <= 4)) seatsOk = false;
    if (typeof m.t === 'number') { if (m.t > lastT) clockOk = false; lastT = m.t; }
  });
  ok(contiguous, 'move indices are contiguous from 0');
  ok(seatsOk, 'every move belongs to a seat in range 1-4');
  ok(clockOk, 'the clock only ever runs down');

  const span = R.moves[0].t - R.moves[R.moves.length - 1].t;
  note.push('elapsed ' + span + 's of clock across ' + R.moves.length + ' moves');
}

// -------------------------------------------------------------------- 3. XP
// rules as shipped: bank buy 8, p2p buy 20, sale 15, tenant/scenario 12,
// renovation 8, district 30, win 60 / second 25, solo multiplier 0.4
const RULES = { buy: 8, p2pbuy: 20, sell: 15, mgmt: 12, renovate: 8, district: 30, win: 60, second: 25 };
if (Array.isArray(R.moves) && Array.isArray(R.seats)) {
  const mult = (R.mode === 'solo' || R.humans === 1) ? 0.4 : 1.0;
  const earned = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const award = (s, n) => { earned[s] = (earned[s] || 0) + Math.max(1, Math.round(n * mult)); };

  for (const m of R.moves) {
    const a = String(m.a);
    if (a === 'buy') award(m.s, RULES.buy);
    else if (a === 'p2pbuy') award(m.s, RULES.p2pbuy);
    else if (a === 'renovate') award(m.s, RULES.renovate);
    else if (a.indexOf('mgmt:') === 0) award(m.s, RULES.mgmt);
  }
  const ranked = R.seats.slice().sort((a, b) => a.rank - b.rank);
  if (ranked[0]) award(ranked[0].seat, RULES.win);
  if (ranked[1]) award(ranked[1].seat, RULES.second);

  console.log('  XP RECONCILIATION' + (mult !== 1 ? '   (solo multiplier ' + mult + ')' : ''));
  let anyGap = false;
  for (const s of R.seats) {
    const claimed = s.xp || 0;
    const floor = earned[s.seat] || 0;
    const gap = claimed - floor;
    if (gap < -1) anyGap = true;
    console.log('    P' + s.seat + '   claimed ' + String(claimed).padStart(4) +
                '   derivable ' + String(floor).padStart(4) +
                '   ' + (gap >= 0 ? '+' + gap + ' from income / bonuses' : 'SHORTFALL ' + gap));
  }
  console.log('');
  ok(!anyGap, 'no seat claims less XP than its own moves justify');
  note.push('rent, district and best-decision XP are not derivable from the log alone —');
  note.push('the surplus above "derivable" is expected; a NEGATIVE gap would be the red flag');
}

// -------------------------------------------------------- 3b. reconcile props
if (Array.isArray(R.moves) && Array.isArray(R.seats)) {
  const held = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const m of R.moves) {
    if (m.a === 'buy') held[m.s]++;
    else if (m.a === 'p2pbuy') held[m.s]++;   // the seller's loss is not logged as a move
  }
  let plausible = true;
  for (const s of R.seats) if ((s.props || 0) > (held[s.seat] || 0) + 1) plausible = false;
  ok(plausible, 'declared property counts do not exceed what the log accounts for');
}

// ---------------------------------------------------------------- 4. ranking
if (Array.isArray(R.seats)) {
  const byWorth = R.seats.slice().sort((a, b) => (b.netWorth || 0) - (a.netWorth || 0));
  let rankOk = true;
  byWorth.forEach((s, ix) => { if (s.rank !== ix + 1) rankOk = false; });
  ok(rankOk, 'ranks follow net worth order');
}

// --------------------------------------------------------------- 5. identity
const wallets = (R.seats || []).filter(s => s.wallet).length;
if (wallets === 0) {
  fail.push('NO SEAT IS BOUND TO A WALLET — this XP belongs to nobody and cannot be claimed');
} else {
  pass.push(wallets + ' of ' + (R.seats || []).length + ' seats bound to a wallet');
}
if (R.signatures) {
  note.push('signatures block present: ' + Object.keys(R.signatures).join(', '));
  const real = Object.values(R.signatures).some(v =>
    typeof v === 'string' ? /^[0-9a-f]{128}$/i.test(v) : (v && /^[0-9a-f]{128}$/i.test(v.sig || '')));
  ok(real, 'signatures look like real 64-byte Schnorr signatures');
} else if (R.signed) {
  fail.push('marked signed:true but carries no signatures — this is a self-assertion, not a proof');
}

// ------------------------------------------------------------- 6. with scene
if (sceneFile && fs.existsSync(sceneFile)) {
  const scene = JSON.parse(fs.readFileSync(sceneFile, 'utf8'));
  const dstr = JSON.stringify(scene.nodes.find(n => n.id === 'director') || {});
  const names = {};
  const re = /"prompt","args":\["buy","(.+?) is unowned\. Buy for (\d+)\?"(?:,"[^"]*")*\]\}\},\{"do":\{"action":"setState","args":\["buy_tile",(\d+)\]/g;
  let mm; while ((mm = re.exec(dstr)) !== null) names[parseInt(mm[3], 10)] = { n: mm[1], p: parseInt(mm[2], 10) };

  const propTiles = Object.keys(names).map(Number);
  let allReal = true, spend = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const m of R.moves) {
    if (m.a !== 'buy') continue;
    if (propTiles.indexOf(m.v) < 0) allReal = false;
    else spend[m.s] += names[m.v].p;
  }
  ok(allReal, 'every purchase names a real property square');

  const start = R.startCash || 1300;
  let affordable = true;
  for (const s of R.seats) if (spend[s.seat] > start * 4) affordable = false;
  ok(affordable, 'purchase totals are within a plausible cash envelope');
  note.push('board carries ' + propTiles.length + ' property squares');
} else if (sceneFile) {
  note.push('scene file not found: ' + sceneFile);
} else {
  note.push('run with --scene <scene.json> to add board-level checks');
}

// ----------------------------------------------------------------- verdict
console.log('  CHECKS');
pass.forEach(p => console.log('    \u2713  ' + p));
fail.forEach(f => console.log('    \u2717  ' + f));
if (note.length) {
  console.log('\n  NOTES');
  note.forEach(n => console.log('    ·  ' + n));
}

const chainHeld = pass.some(p => p.indexOf('move root matches') === 0);
console.log('\n  ' + '-'.repeat(58));
if (fail.length === 0) {
  console.log('  VERDICT: RECORD HOLDS UP  (' + pass.length + ' checks passed)');
} else if (chainHeld) {
  console.log('  VERDICT: LOG IS INTACT, BUT ' + fail.length + ' ISSUE(S) — see above');
  console.log('           the moves are genuine; what is missing is who they belong to');
} else {
  console.log('  VERDICT: REJECTED — the move log does not match its own root');
}
console.log('  ' + '-'.repeat(58) + '\n');
console.log('  WHAT THIS DOES NOT PROVE');
console.log('    · that each move was legal (needs a full replay engine)');
console.log('    · that a human, rather than a script, made the decisions');
console.log('    · that this root has not been submitted before (needs an on-chain index)');
console.log('');

process.exit(fail.length ? 1 : 0);
