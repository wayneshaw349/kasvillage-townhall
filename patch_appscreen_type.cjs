// patch_appscreen_type.cjs — add 'welcome' to the AppScreen union
// Run: node patch_appscreen_type.cjs
const fs = require('fs');
const P = 'AppNaviagator.tsx';

let src = fs.readFileSync(P, 'utf8');
const before = src;

// locate the type declaration
const decl = src.indexOf('type AppScreen');
if (decl < 0) throw new Error("could not find 'type AppScreen'");

// the union ends at the first semicolon after the declaration
const end = src.indexOf(';', decl);
if (end < 0) throw new Error('no terminating semicolon after type AppScreen');

const slice = src.slice(decl, end + 1);
console.log('--- current declaration ---');
console.log(slice);
console.log('---------------------------');

if (slice.includes("'welcome'")) throw new Error("'welcome' already present — nothing to do");

const n = slice.split("'booting'").length - 1;
if (n !== 1) throw new Error(`expected 1 'booting' inside the union, found ${n}`);

const patched = slice.replace("'booting'", "'welcome'\n  | 'booting'");
src = src.slice(0, decl) + patched + src.slice(end + 1);

if (!src.includes("'welcome'")) throw new Error('post-condition failed: welcome not inserted');
if (src === before) throw new Error('no changes written');

fs.writeFileSync(P + '.bak3', before, 'utf8');
fs.writeFileSync(P, src, 'utf8');
console.log('[done] backup at ' + P + '.bak3');
