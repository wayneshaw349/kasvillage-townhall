// patch_alert_and_iters.cjs — import Alert in the ritual; drop serial KDF to 50k
// Run: node patch_alert_and_iters.cjs
const fs = require('fs');

// ---------------------------------------------------------------- 1. Alert
{
  const P = 'expo_identity_ritual.tsx';
  let src = fs.readFileSync(P, 'utf8');
  const EOL = src.includes('\r\n') ? '\r\n' : '\n';
  const before = src;

  if (/\bAlert\b[^\n]*from 'react-native'/.test(src) ||
      /import\s*{[^}]*\bAlert\b[^}]*}\s*from\s*'react-native'/.test(src)) {
    console.log('[skip] Alert already imported');
  } else {
    // find the react-native import and add Alert to its named list
    const L = src.split(/\r?\n/);
    let idx = -1, open = -1;
    for (let i = 0; i < L.length; i++) {
      if (/from\s+'react-native'/.test(L[i])) { idx = i; break; }
    }
    if (idx < 0) throw new Error("no import from 'react-native' found");

    // walk back to the line holding the opening brace of that import
    for (let i = idx; i >= 0 && i > idx - 40; i--) {
      if (/import\s*{/.test(L[i])) { open = i; break; }
    }
    if (open < 0) throw new Error('could not locate opening of the react-native import');

    console.log('--- react-native import, lines ' + (open + 1) + '-' + (idx + 1) + ' ---');
    console.log(L.slice(open, idx + 1).join(EOL));
    console.log('------------------------------------------');

    // insert Alert immediately after the opening brace
    const m = L[open].match(/import\s*{\s*/);
    if (!m) throw new Error('unexpected import shape on line ' + (open + 1));
    L[open] = L[open].replace(/import\s*{\s*/, 'import { Alert, ');
    src = L.join(EOL);

    if (!/import\s*{\s*Alert,/.test(src)) throw new Error('post-condition failed: Alert insert');
    fs.writeFileSync(P + '.bak-alert', before, 'utf8');
    fs.writeFileSync(P, src, 'utf8');
    console.log('[ok] Alert added to react-native import — backup ' + P + '.bak-alert');
  }
}

// ------------------------------------------------------- 2. KDF iterations
{
  const P = 'device_attestation.ts';
  let src = fs.readFileSync(P, 'utf8');
  const before = src;

  const OLD = 'const SERIAL_ITERATIONS_V2 = 100_000;';
  const n = src.split(OLD).length - 1;
  if (n !== 1) throw new Error(`expected 1 SERIAL_ITERATIONS_V2, found ${n}`);

  src = src.replace(
    /const SERIAL_ITERATIONS_V2 = 100_000;[^\n]*/,
    'const SERIAL_ITERATIONS_V2 = 50_000;     // ~190ms desktop, ~1-4s on a low-end phone'
  );

  if (!src.includes('50_000')) throw new Error('post-condition failed: 50_000');
  if (src === before) throw new Error('no changes written');

  fs.writeFileSync(P + '.bak-iters', before, 'utf8');
  fs.writeFileSync(P, src, 'utf8');
  console.log('[ok] iterations 100k -> 50k — backup ' + P + '.bak-iters');
}
