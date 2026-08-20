// fix_engine_backticks.cjs
// build_scene_engine wraps the engine in a template literal, so a backtick
// anywhere in the file breaks the build. The warning strings added by
// patch_engine_warnings used them for emphasis; single quotes read the same.
const fs = require('fs');
const F = 'scene_engine.html';
let s = fs.readFileSync(F, 'utf8');

const before = (s.match(/`/g) || []).length;
if (before === 0) { console.log('nothing to do: no backticks'); process.exit(0); }

// Only touch the strings we introduced -- identified by their surrounding text.
const swaps = [
  ['"top-level `world` is IGNORED', '"top-level \'world\' is IGNORED'],
  ['"top-level `alarms` is IGNORED', '"top-level \'alarms\' is IGNORED'],
  ['"unknown top-level key `" + kk + "` -- the engine will ignore it"',
   '"unknown top-level key \'" + kk + "\' -- the engine will ignore it"'],
];
let hits = 0;
for (const [a, b] of swaps) {
  const n = s.split(a).length - 1;
  if (n) { s = s.split(a).join(b); hits += n; }
}

const left = (s.match(/`/g) || []).length;
fs.writeFileSync(F + '.bak', fs.readFileSync(F));
fs.writeFileSync(F, s);
console.log('swapped ' + hits + ' string(s); backticks ' + before + ' -> ' + left);
if (left > 0) console.log('WARNING: ' + left + ' backtick(s) remain elsewhere in the file');
