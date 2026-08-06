// fix_dust_branch.cjs — clean up the dust-change branch left over from the coin-level guard.
// v2: locked value is never coin-anchored, so dust change can always fold into fee.
const fs = require('fs');
const p = 'kaspa_rest_tx.ts';
let s = fs.readFileSync(p, 'utf8');
const old = "    } else if (change > 0n && lockedOnSpent === 0n) {\r\n      fee += change; // Absorb dust change into fee (safe: no IOU-backed value rides here)\r\n    } else if (change > 0n) {\r\n      return { success: false, error: `IOU-backed change (${Number(change) / 1e8} KAS) is below dust and cannot be preserved. Settle IOUs or adjust the amount.` };\r\n    }";
const neu = "    } else if (change > 0n) {\r\n      fee += change; // Absorb dust change into fee (v2: locked value is balance-level, never rides a specific coin)\r\n    }";
const variants = [[old, neu], [old.replace(/\r\n/g, '\n'), neu.replace(/\r\n/g, '\n')]];
let done = false;
for (const [o, n2] of variants) {
  if (s.split(o).length - 1 === 1) { fs.copyFileSync(p, p + '.bakd'); fs.writeFileSync(p, s.replace(o, n2)); done = true; break; }
}
if (!done) { console.error('FAIL anchor'); process.exit(1); }
console.log('OK dust branch fixed');
if (fs.readFileSync(p, 'utf8').includes('lockedOnSpent')) { console.error('POST-FAIL still referenced'); process.exit(1); }
console.log('POST-OK lockedOnSpent fully gone');
