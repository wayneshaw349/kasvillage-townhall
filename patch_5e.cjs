// patch_5e.cjs — 5e buyer pre-fund guard
// Run: node patch_5e.cjs
const fs = require('fs');
const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');

function esc(x){ return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function rx(anchor){ return new RegExp(esc(anchor).replace(/\n/g, '\\r?\\n'), 'g'); }
function count(anchor){ return (s.match(rx(anchor)) || []).length; }
function guard(name, anchor, expect){
  const c = count(anchor);
  if (c !== expect) { console.error('ABORT ['+name+'] count='+c+' expected='+expect); process.exit(1); }
  console.log('OK ['+name+'] count='+c);
}
function sub(name, anchor, repl){
  s = s.replace(rx(anchor), () => repl);
  console.log('APPLIED ['+name+']');
}

// ---- anchors ----
const A1 = "  description: string;\n  createdAt: number;\n}";
const A2 = "                description: (contract.itemDescription || '') + (contract.shippingCenter ? ' - Ship to: ' + contract.shippingCenter : ''), createdAt: Date.now(),";
const A3 = "            if (sellerBal < expectedSeller * 0.95) continue;";
const A4 = "            const sentKey = 'kv_frost_poll_sent_' + contract.agreementId;";

guard('A1 FrostActiveEntry', A1, 1);
guard('A2 addToFrostList(proposer)', A2, 1);
guard('A3 crash-recovery', A3, 1);
guard('A4 frost-poll', A4, 1);

// ---- 1: FrostActiveEntry.timeoutN ----
sub('1', A1, "  description: string;\r\n  createdAt: number;\r\n  timeoutN?: number;\r\n}");

// ---- 2: persist N on proposer entry ----
sub('2', A2, A2 + "\r\n                timeoutN: Math.floor((contract.timeoutMinutes || 5) * 60),");

// ---- 3: crash-recovery guard ----
const G3 = A3 + "\r\n" +
"            // 5e PRE-FUND GUARD: refuse if seller's reclaim window has passed\r\n" +
"            try {\r\n" +
"              const _N = BigInt(entry.timeoutN || 0);\r\n" +
"              const _fundDAA = BigInt(eUtxos[0]?.utxoEntry?.blockDaaScore || 0);\r\n" +
"              if (_N > 0n && _fundDAA > 0n) {\r\n" +
"                const _dagR = await fetch(apiBase + '/info/blockdag');\r\n" +
"                const _dag = _dagR.ok ? await _dagR.json() : null;\r\n" +
"                const _now = BigInt(_dag?.virtualDaaScore || 0);\r\n" +
"                if (_now > 0n && _now >= _fundDAA + _N) {\r\n" +
"                  console.warn('[5e-Guard] Crash-recovery BLOCKED', entry.agrId.slice(0,12), 'now=', String(_now), 'fund=', String(_fundDAA), 'N=', String(_N));\r\n" +
"                  continue;\r\n" +
"                }\r\n" +
"                console.log('[5e-Guard] Crash-recovery OK', entry.agrId.slice(0,12), 'remaining DAA=', String(_fundDAA + _N - _now));\r\n" +
"              }\r\n" +
"            } catch (e) { console.warn('[5e-Guard] Crash-recovery check failed — NOT funding:', e); continue; }";
sub('3', A3, G3);

// ---- 4: frost-poll guard ----
const G4 =
"            // 5e PRE-FUND GUARD: refuse if seller's reclaim window has passed\r\n" +
"            try {\r\n" +
"              const _N = BigInt(Math.floor((contract.timeoutMinutes || 5) * 60));\r\n" +
"              const _fundDAA = BigInt(frostUtxos[0]?.utxoEntry?.blockDaaScore || 0);\r\n" +
"              if (_N > 0n && _fundDAA > 0n) {\r\n" +
"                const _dagR = await fetch(apiBase + '/info/blockdag');\r\n" +
"                const _dag = _dagR.ok ? await _dagR.json() : null;\r\n" +
"                const _now = BigInt(_dag?.virtualDaaScore || 0);\r\n" +
"                if (_now > 0n && _now >= _fundDAA + _N) {\r\n" +
"                  console.warn('[5e-Guard] FROST-Poll BLOCKED — timeout passed. now=', String(_now), 'fund=', String(_fundDAA), 'N=', String(_N));\r\n" +
"                  if (!cancelled) Alert.alert('Timeout passed', 'The seller can now reclaim their collateral. Not sending — start a new agreement.');\r\n" +
"                  return;\r\n" +
"                }\r\n" +
"                console.log('[5e-Guard] FROST-Poll OK — remaining DAA=', String(_fundDAA + _N - _now));\r\n" +
"              }\r\n" +
"            } catch (e) { console.warn('[5e-Guard] FROST-Poll check failed — NOT funding:', e); return; }\r\n" +
A4;
sub('4', A4, G4);

fs.writeFileSync(F, s);
console.log('WROTE ' + F);
