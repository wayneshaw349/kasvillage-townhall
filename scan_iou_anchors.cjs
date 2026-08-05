// scan_iou_anchors.cjs — dump exact current text for precise anchoring. Read-only.
const fs = require('fs');
function dump(file, label, re, ctx = 0) {
  if (!fs.existsSync(file)) { console.log(`\n### ${file} MISSING`); return; }
  const s = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  console.log(`\n### ${file} :: ${label}`);
  let hit = false;
  s.forEach((l, i) => {
    if (re.test(l)) {
      hit = true;
      for (let j = Math.max(0, i - ctx); j <= Math.min(s.length - 1, i + ctx); j++)
        console.log((j + 1) + ': ' + JSON.stringify(s[j]));
      if (ctx) console.log('  ---');
    }
  });
  if (!hit) console.log('  (no match)');
}

// (1) did patch 1 land?
dump('utxo_ledger.ts', 'partial-alloc fields present?', /allocatedSompi\?:|allocations\?:/);
dump('utxo_ledger.ts', 'allocateForIOU signature', /allocateForIOU|allocations: \{ tag/);

// (2) IOU file anchors
dump('IOUBalanceSheetShare.tsx', 'top imports', /^import /);
dump('IOUBalanceSheetShare.tsx', 'allocate call site', /allocateBatches\(/, 1);
dump('IOUBalanceSheetShare.tsx', 'backedByBatches field', /backedByBatches:/);
dump('IOUBalanceSheetShare.tsx', 'release call site', /releaseBatches\(/, 1);
dump('IOUBalanceSheetShare.tsx', 'getWalletState head', /export async function getWalletState/, 10);
