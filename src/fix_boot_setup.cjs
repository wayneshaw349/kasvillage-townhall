/* fix_boot_setup.cjs  --  make the boot seeding actually run
 *
 * The engine only registers per-NODE alarms (n.alarms). The scene's top-level
 * `scene.alarms` block is never read, so cash/alive/shuffles have never been
 * applied: seats ran at cash 0, alive 0, decks unshuffled. That also left the
 * v13 bots' `aggr` unset (reads 0), collapsing every personality to "buy).
 *
 * Fix: a one-shot BT branch at the head of the tree, guarded by world.flags.setup.
 * Pure JSON -- no engine change.
 *
 * Run:  node fix_boot_setup.cjs
 * Then: node make_kascity_v2.cjs
 *       node scene_engine_test.cjs   (156 green)
 *       node smoke_showcases.cjs     (32 green)
 */
'use strict';
const fs = require('fs');

const FILE = process.argv[2] || 'make_kascity_v2.cjs';
if (!fs.existsSync(FILE)) { console.error('ABORT: ' + FILE + ' not found'); process.exit(1); }
const src = fs.readFileSync(FILE, 'utf8');

function anchorRegex(line) {
  const esc = line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^[ \\t]*' + esc + '[ \\t]*$', 'm');
}
function count(re, s) { return (s.match(new RegExp(re.source, 'gm')) || []).length; }

/* ---- guards ------------------------------------------------------------ */
if (!/const AI = \{/.test(src)) {
  console.error('ABORT: AI block not found -- run port_ai_to_maker.cjs first');
  process.exit(1);
}
if (/world\.flags\.setup/.test(src)) {
  console.error('ABORT: setup branch already present -- already patched?');
  process.exit(1);
}

const A_BT    = 'const bt = { selector: [] };';
const A_FLAGS = 'world: { score: 0, flags: { phase: 0, asked: 0, pos: 0, sum: 0, moved: 1,';

[['bt root', A_BT], ['world flags', A_FLAGS]].forEach(function (a) {
  const n = count(anchorRegex(a[1]), src);
  if (n !== 1) { console.error('ABORT: anchor "' + a[0] + '" matched ' + n + ' times (want 1)'); process.exit(1); }
});

/* ---- setup branch ------------------------------------------------------ */
/* Runs once, before any phase branch. Seeds what scene.alarms never did.
 * PLAYERS seats get cash + alive; bot seats additionally get their aggr
 * personality, which the buy conds read.                                    */
const SETUP = [
  '',
  '// SETUP: runs once. The engine ignores top-level scene.alarms (only node',
  '// alarms are registered), so seeding has to live in the tree itself.',
  'bt.selector.push((function () {',
  '  const acts = [cond("world.flags.setup == 0")];',
  '  for (let s = 1; s <= PLAYERS; s++) {',
  '    acts.push(act("setSeatStat", [s, "cash", 1500]));',
  '    acts.push(act("setSeatStat", [s, "alive", 1]));',
  '    if (AI.AGGR[s] != null) acts.push(act("setSeatStat", [s, "aggr", AI.AGGR[s]]));',
  '  }',
  '  acts.push(act("shuffleDeck", ["fate"]));',
  '  acts.push(act("shuffleDeck", ["cards"]));',
  '  acts.push(act("setState", ["setup", 1]));',
  '  return seq.apply(null, acts);',
  '})());',
  ''
].join('\n');

/* ---- apply ------------------------------------------------------------- */
let out = src;
out = out.replace(anchorRegex(A_BT), function (m) { return m + '\n' + SETUP; });
out = out.replace(anchorRegex(A_FLAGS), function (m) {
  return m.replace('flags: { phase: 0,', 'flags: { setup: 0, phase: 0,');
});

const checks = [
  ['setup branch', /world\.flags\.setup == 0/],
  ['setup flag', /flags: \{ setup: 0, phase: 0,/]
];
const missing = checks.filter(function (c) { return !c[1].test(out); });
if (missing.length) {
  console.error('ABORT: edit did not apply: ' + missing.map(function (c) { return c[0]; }).join(', '));
  process.exit(1);
}

try { new (require('vm').Script)(out, { filename: FILE }); }
catch (e) { console.error('ABORT: patched generator is not valid JS -- ' + e.message); process.exit(1); }

fs.writeFileSync(FILE + '.bak_setup', src, 'utf8');
fs.writeFileSync(FILE, out, 'utf8');
console.log('OK  backup : ' + FILE + '.bak_setup');
console.log('OK  setup branch added at head of BT (cash 1500, alive 1, aggr, shuffles)');
console.log('OK  size   : ' + src.length + ' -> ' + out.length + ' bytes');
console.log('');
console.log('NOTE: scene.alarms boot block is left in place but remains dead data.');
console.log('Next: node make_kascity_v2.cjs');
