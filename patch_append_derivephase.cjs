// patch_append_derivephase.cjs — append derivePhase/routeForPhase to local_agreements.ts
// Run: node patch_append_derivephase.cjs
const fs = require('fs');
const F = 'local_agreements.ts';
let s = fs.readFileSync(F, 'utf8');

if (s.includes('export async function derivePhase')) { console.log('already appended'); process.exit(0); }

// The append block imports nothing new — getAgreement is already in this file.
// Strip the "APPEND TO" banner comment; keep the rest verbatim.
const APPEND = `

// ============================================================================
// derivePhase(agrId) — L1-first phase derivation. The store REMEMBERS the step;
// this DERIVES the true phase from Layer 1 + the stored record.
// ============================================================================

export type DerivedPhase =
  | 'draft' | 'proposed' | 'agreed' | 'templates_ready' | 'cosigned'
  | 'seller_funded' | 'kill_dead' | 'fully_funded' | 'complete' | 'aborted' | 'unknown';

export interface PhaseResult {
  phase: DerivedPhase;
  balanceKas: number; utxoCount: number;
  totalKas: number; sellerKas: number; buyerKas: number;
  l1Ok: boolean; agrId: string; frostAddress: string;
}

function restBase(network: string | undefined): string {
  return (network || 'testnet-10').includes('testnet')
    ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
}

async function readEscrowL1(frostAddress: string, network: string | undefined): Promise<{ bal: number; count: number } | null> {
  if (!frostAddress) return null;
  try {
    const r = await fetch(restBase(network) + '/addresses/' + frostAddress + '/utxos');
    if (!r.ok) return null;
    const utxos = await r.json();
    if (!Array.isArray(utxos)) return null;
    const bal = utxos.reduce((sum: number, u: any) => sum + Number(u?.utxoEntry?.amount || '0'), 0);
    return { bal, count: utxos.length };
  } catch { return null; }
}

function near(value: number, target: number, tol = 0.05): boolean {
  if (target <= 0) return false;
  return Math.abs(value - target) <= target * tol;
}

function mapStoredStep(step: string | undefined): DerivedPhase {
  switch (step) {
    case 'proposed': return 'proposed';
    case 'agreed': return 'agreed';
    case 'templates_built': return 'templates_ready';
    case 'cosigned': return 'cosigned';
    case 'seller_funded': return 'seller_funded';
    case 'kill_broadcast': return 'kill_dead';
    case 'buyer_funded': return 'fully_funded';
    case 'complete': return 'complete';
    case 'aborted': return 'aborted';
    default: return 'proposed';
  }
}

export async function derivePhase(agrId: string): Promise<PhaseResult> {
  const rec = await getAgreement(agrId);
  const frostAddress = rec?.frostAddress || '';
  const network = rec?.network || 'testnet-10';
  const buyerKas = Number(rec?.buyerAmountSompi || 0) / 1e8;
  const sellerKas = Number(rec?.sellerAmountSompi || 0) / 1e8;
  const totalKas = buyerKas + sellerKas;
  const base = { balanceKas: 0, utxoCount: 0, totalKas, sellerKas, buyerKas, agrId, frostAddress };

  if (!rec) return { ...base, phase: 'unknown', l1Ok: false };
  if (rec.step === 'aborted') return { ...base, phase: 'aborted', l1Ok: false };

  const l1 = await readEscrowL1(frostAddress, network);
  if (!l1) return { ...base, phase: mapStoredStep(rec.step), l1Ok: false };

  const balanceKas = l1.bal / 1e8;
  const utxoCount = l1.count;
  const withL1 = { ...base, balanceKas, utxoCount };

  if (balanceKas === 0 && (rec.step === 'complete' || rec.step === 'buyer_funded')) {
    return { ...withL1, phase: 'complete', l1Ok: true };
  }
  if (near(balanceKas, totalKas) && utxoCount >= 2) {
    return { ...withL1, phase: 'fully_funded', l1Ok: true };
  }
  if (utxoCount === 1 && rec.killTxId && near(balanceKas, sellerKas) && rec.step === 'kill_broadcast') {
    return { ...withL1, phase: 'kill_dead', l1Ok: true };
  }
  if (near(balanceKas, sellerKas) && utxoCount === 1) {
    return { ...withL1, phase: 'seller_funded', l1Ok: true };
  }
  return { ...withL1, phase: mapStoredStep(rec.step), l1Ok: true };
}

export function routeForPhase(phase: DerivedPhase): 'inbox' | 'poll' | 'release' | 'done' | 'draft' {
  switch (phase) {
    case 'draft': return 'draft';
    case 'proposed': case 'agreed': case 'templates_ready': case 'cosigned': return 'inbox';
    case 'seller_funded': case 'kill_dead': return 'poll';
    case 'fully_funded': return 'release';
    case 'complete': case 'aborted': return 'done';
    default: return 'inbox';
  }
}
`;

fs.writeFileSync(F + '.bak_derivephase', s);
fs.writeFileSync(F, s + APPEND);
console.log('appended derivePhase + routeForPhase to', F);
