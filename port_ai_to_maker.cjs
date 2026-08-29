/* port_ai_to_maker.cjs  --  move the v13 bot AI into the generator
 *
 * Edits make_kascity_v2.cjs so `node make_kascity_v2.cjs` emits a kascity_v2.json
 * that already contains the bots. After this, the AI survives regeneration and
 * patch_kascity_ai.cjs is no longer needed.
 *
 * Three single-line anchors, CRLF-tolerant, count-guarded, .bak first.
 *
 * Run:  node port_ai_to_maker.cjs
 * Then: node make_kascity_v2.cjs
 *       node scene_engine_test.cjs      (156 green)
 *       node smoke_showcases.cjs        (32 green -- now really runs the bots)
 */
'use strict';
const fs = require('fs');

const FILE = process.argv[2] || 'make_kascity_v2.cjs';
if (!fs.existsSync(FILE)) { console.error('ABORT: ' + FILE + ' not found'); process.exit(1); }
const src = fs.readFileSync(FILE, 'utf8');

/* CRLF-tolerant single-line anchor: match on trimmed content, keep the line's own EOL */
function anchorRegex(line) {
  const esc = line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^[ \\t]*' + esc.replace(/^\s+/, '') + '[ \\t]*$', 'm');
}
function countMatches(re, s) {
  const g = new RegExp(re.source, 'gm');
  return (s.match(g) || []).length;
}

/* ---- anchors ----------------------------------------------------------- */
const A_TABLE  = 'const T = [';
const A_IFKIND = 'if (t.k === "prop" || t.k === "transit" || t.k === "utility") {';
const A_COND   = 'cond(at + " && ownerOf(\'t" + i + "\') == 0 && seatStat(seat(),\'cash\') >= " + t.p),';
const A_EMIT   = 'const json = JSON.stringify(scene);';

const anchors = [
  ['board table', A_TABLE],
  ['buyable-kind branch', A_IFKIND],
  ['buy prompt cond', A_COND],
  ['emit', A_EMIT]
];
const res = {};
let bad = false;
anchors.forEach(function (a) {
  const re = anchorRegex(a[1]);
  const n = countMatches(re, src);
  res[a[0]] = re;
  if (n !== 1) { console.error('ABORT: anchor "' + a[0] + '" matched ' + n + ' times (want 1)'); bad = true; }
});
if (bad) process.exit(1);

if (/v13 bots|AI\.MATE_PULL|'aggr'|"aggr"/.test(src)) {
  console.error('ABORT: generator already contains AI markers -- already ported?');
  process.exit(1);
}

/* ---- fragments --------------------------------------------------------- */
const AI_CONSTS = [
  '// ---- v13 bot AI tunables ---------------------------------------------------',
  '// aggr is a RESERVE multiplier: lower = keener to buy. Owning group-mates',
  '// lowers it further (colour-set instinct); rand() adds a seeded wobble so a',
  '// bot is not perfectly predictable, while replays stay identical.',
  'const AI = {',
  '  AGGR:      { 2: 1.2, 3: 1.5, 4: 2.2 },  // per bot seat; seat 1 is human',
  '  MATE_PULL: 0.35,   // per owned group-mate',
  '  WOBBLE:    0.40,   // rand() jitter band',
  '  TURN_STOP: 40,     // seat-turns, not rounds: 40 = 10 rounds each at 4 players',
  '  SELL_FLOOR: 100,   // cash below this triggers a sale',
  '  SELL_PCT:  0.60    // refund fraction',
  '};',
  ''
].join('\n');

const BOT_BRANCHES = [
  '    // --- v13 bots: seats 2..N decide for themselves, no prompt ---',
  '    const _mates = t.g',
  '      ? T.map((x, xi) => (x.g === t.g && xi !== i) ? xi : -1).filter(x => x >= 0)',
  '      : [];',
  '    const _eff = "seatStat(seat(),\'aggr\')"',
  '      + (_mates.length',
  '          ? " - " + AI.MATE_PULL + " * (" +',
  '            _mates.map(m => "(ownerOf(\'t" + m + "\') == seat())").join(" + ") + ")"',
  '          : "")',
  '      + " + " + AI.WOBBLE + " * rand()";',
  '    resolve.selector.push(seq(',
  '      cond(at + " && ownerOf(\'t" + i + "\') == 0 && seat() != 1"',
  '           + " && world.flags.turn < " + AI.TURN_STOP',
  '           + " && seatStat(seat(),\'cash\') >= " + t.p + " * (" + _eff + ")"),',
  '      act("setState", ["buy_tile", i]),',
  '      act("setState", ["buy", 0]),',
  '      act("setState", ["phase", 2])',
  '    ));',
  '    resolve.selector.push(seq(',
  '      cond(at + " && ownerOf(\'t" + i + "\') == 0 && seat() != 1"),',
  '      act("setState", ["phase", 3])',
  '    ));'
].join('\n');

const POST_BUILD = [
  '// ---- v13 AI: personality stats + sell-when-broke ---------------------------',
  '(function injectAI() {',
  '  const boot = scene.alarms.find(a => a && a.id === "boot");',
  '  if (!boot) throw new Error("boot alarm missing");',
  '  Object.keys(AI.AGGR).forEach(s =>',
  '    boot.actions.push({ action: "setSeatStat", args: [+s, "aggr", AI.AGGR[s]] }));',
  '',
  '  const p3 = bt.selector.find(b =>',
  '    b.sequence && b.sequence[0] && b.sequence[0].cond === "world.flags.phase == 3");',
  '  if (!p3) throw new Error("phase 3 block missing");',
  '  const sel = p3.sequence.filter(x => Array.isArray(x.selector)).pop();',
  '  if (!sel) throw new Error("phase 3 selector missing");',
  '',
  '  // broke bots liquidate: first owned tile in board order, refunded at SELL_PCT',
  '  const sells = [];',
  '  T.forEach((t, i) => {',
  '    if (t.k !== "prop" && t.k !== "transit" && t.k !== "utility") return;',
  '    sells.push(seq(',
  '      cond("seat() != 1 && seatStat(seat(),\'cash\') < " + AI.SELL_FLOOR',
  '           + " && ownerOf(\'t" + i + "\') == seat()"),',
  '      act("release", ["t" + i]),',
  '      act("addSeatStat", ["current", "cash"], Math.round(t.p * AI.SELL_PCT)),',
  '      act("playSound", ["buy"])',
  '    ));',
  '  });',
  '  sel.selector.unshift.apply(sel.selector, sells);',
  '  console.log("OK v13 AI: " + sells.length + " sell branches, aggr on seats "',
  '    + Object.keys(AI.AGGR).join(","));',
  '})();',
  ''
].join('\n');

/* ---- apply ------------------------------------------------------------- */
let out = src;

out = out.replace(res['board table'], function (m) { return AI_CONSTS + m; });
out = out.replace(res['buyable-kind branch'], function (m) { return m + '\n' + BOT_BRANCHES; });
out = out.replace(res['buy prompt cond'], function (m) {
  return m.replace('>= " + t.p),', '>= " + t.p + " && seat() == 1"),');
});
out = out.replace(res['emit'], function (m) { return POST_BUILD + m; });

/* ---- verify the edits actually took ------------------------------------ */
const checks = [
  ['AI consts', /const AI = \{/],
  ['bot branches', /v13 bots: seats 2\.\.N/],
  ['human gate', /&& seat\(\) == 1"\),/],
  ['post-build', /function injectAI\(\)/]
];
let missing = checks.filter(function (c) { return !c[1].test(out); });
if (missing.length) {
  console.error('ABORT: edit did not apply: ' + missing.map(function (c) { return c[0]; }).join(', '));
  process.exit(1);
}
if (out === src) { console.error('ABORT: no change produced'); process.exit(1); }

/* ---- syntax check before writing --------------------------------------- */
try { new (require('vm').Script)(out, { filename: FILE }); }
catch (e) { console.error('ABORT: patched generator is not valid JS -- ' + e.message); process.exit(1); }

fs.writeFileSync(FILE + '.bak', src, 'utf8');
fs.writeFileSync(FILE, out, 'utf8');
console.log('OK  backup : ' + FILE + '.bak');
console.log('OK  size   : ' + src.length + ' -> ' + out.length + ' bytes');
console.log('');
console.log('Next: node make_kascity_v2.cjs   (regenerates JSON + showcase WITH bots)');
console.log('      patch_kascity_ai.cjs is now obsolete -- do not run it again.');
