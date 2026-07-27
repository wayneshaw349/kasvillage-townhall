// ============================================================================
// proposal_decode.ts — turn a parsed KV proposal into layman-readable fields
// ============================================================================
// Single source of truth for how a proposal is explained to users. Both the
// decode popup and the canonical-form view render from decodeProposal().
//
// Engine internals (FROST, N/DAA, pubkeys, R, frostCounter) are NEVER surfaced
// as-is. timeoutN is converted to minutes; sompi to KAS; the rest to sentences.
//
// Pure: no I/O, no storage, no crypto. Feed it the object parseProposal()
// returns (or a LocalAgreement — field names overlap), get back display data.
// ============================================================================

/** DAA blocks per minute on Kaspa (1 block/sec * 60). timeoutN = minutes * this. */
export const DAA_PER_MIN = 3600;

export type DecodeRole = 'buyer' | 'seller';

/** Loose input: whatever parseProposal returns, or a LocalAgreement. */
export interface DecodeInput {
  agrId?: string;
  description?: string;
  buyerAmountSompi?: number | string;
  sellerAmountSompi?: number | string;
  timeoutN?: number | string;
  verificationCode?: string;
  network?: string;
  buyerPubkey?: string;
  sellerPubkey?: string;
  frostAddress?: string;
}

export interface DecodeRow {
  label: string;
  value: string;
  /** One plain sentence expanding the row. Empty string = no expansion. */
  detail: string;
  /** true = emphasize (amount at stake / the code). */
  emphasize?: boolean;
}

export interface DecodedProposal {
  role: DecodeRole;
  title: string;         // popup heading
  rows: DecodeRow[];     // ordered display rows
  ctaLabel: string;      // primary button text
  // machine-usable extracts (for callers that want raw numbers)
  buyerKas: number;
  sellerKas: number;
  totalKas: number;
  refundMinutes: number;
  verificationCode: string;
  agrId: string;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function toNum(v: number | string | undefined): number {
  if (v === undefined || v === null || v === '') return 0;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function kas(sompi: number | string | undefined): number {
  return toNum(sompi) / 1e8;
}

function fmtKas(sompi: number | string | undefined): string {
  return kas(sompi).toFixed(2) + ' KAS';
}

function minutesFromN(timeoutN: number | string | undefined): number {
  const n = toNum(timeoutN);
  if (n <= 0) return 0;
  return Math.max(1, Math.round(n / DAA_PER_MIN));
}

function shortId(pk: string | undefined): string {
  if (!pk) return '(unknown)';
  return pk.slice(0, 8) + '…';
}

// ---------------------------------------------------------------------------
// core
// ---------------------------------------------------------------------------

/**
 * Decode a parsed proposal for the given viewer role.
 * @param p     parsed proposal object (or LocalAgreement)
 * @param role  who is looking — changes labels ("Your payment" vs "Buyer pays")
 */
export function decodeProposal(p: DecodeInput, role: DecodeRole): DecodedProposal {
  const buyerKas = kas(p.buyerAmountSompi);
  const sellerKas = kas(p.sellerAmountSompi);
  const totalKas = buyerKas + sellerKas;
  const mins = minutesFromN(p.timeoutN);
  const code = p.verificationCode || '';
  const desc = (p.description || '').trim();

  const rows: DecodeRow[] = [];

  // Item
  rows.push({
    label: 'Item',
    value: desc || '(no description)',
    detail: desc ? 'What this deal is for.' : 'No item description was provided.',
  });

  // Payment — role-aware label
  rows.push({
    label: role === 'buyer' ? 'You pay' : 'Buyer pays',
    value: fmtKas(p.buyerAmountSompi),
    detail: role === 'buyer'
      ? 'This is your payment for the item.'
      : 'The buyer pays this for the item.',
    emphasize: role === 'buyer',
  });

  // Trust deposit — role-aware label, always with the refundable/forfeit line
  rows.push({
    label: role === 'seller' ? 'Your trust deposit' : "Seller's trust deposit",
    value: fmtKas(p.sellerAmountSompi),
    detail: role === 'seller'
      ? 'You lock this as collateral. You get all of it back when the deal completes honestly — you lose it only if you fail to deliver.'
      : 'The seller locks this as collateral, refunded to them on honest completion and forfeited if they cheat.',
    emphasize: role === 'seller',
  });

  // Total in escrow
  rows.push({
    label: 'Total in escrow',
    value: totalKas.toFixed(2) + ' KAS',
    detail: 'Held in a shared vault that neither side can move alone.',
  });

  // Refund window
  rows.push({
    label: 'Refund window',
    value: mins > 0 ? mins + (mins === 1 ? ' minute' : ' minutes') : '(none set)',
    detail: mins > 0
      ? (role === 'buyer'
          ? 'If the seller does not complete their side within ' + mins + ' minute' + (mins === 1 ? '' : 's') + ', you can reclaim your payment.'
          : 'If you do not complete your side within ' + mins + ' minute' + (mins === 1 ? '' : 's') + ', the buyer can reclaim their payment.')
      : 'No refund window was set — do not proceed; ask for a fresh proposal.',
  });

  // Verification code — read-aloud confirmation
  if (code) {
    rows.push({
      label: 'Verification code',
      value: code,
      detail: role === 'buyer'
        ? 'Have the seller read this back to confirm you both see the same deal.'
        : 'Confirm this matches the code the buyer sees before accepting.',
      emphasize: true,
    });
  }

  // Network (quiet row)
  if (p.network) {
    rows.push({ label: 'Network', value: p.network, detail: '' });
  }

  const title = role === 'seller' ? 'Accept this agreement?' : "You're sending this proposal";
  const ctaLabel = role === 'seller' ? 'Accept & Lock Deposit' : 'Copy Proposal';

  return {
    role, title, rows, ctaLabel,
    buyerKas, sellerKas, totalKas, refundMinutes: mins,
    verificationCode: code, agrId: p.agrId || '',
  };
}

/**
 * One-line summary for compact contexts (inbox row subtitle, notifications).
 * e.g. "Buy 'Vintage hat' — you pay 5.00, seller stakes 6.00, 5-min refund"
 */
export function summarizeProposal(p: DecodeInput, role: DecodeRole): string {
  const d = decodeProposal(p, role);
  const item = (p.description || 'item').trim() || 'item';
  const pay = role === 'buyer' ? 'you pay ' + d.buyerKas.toFixed(2) : 'buyer pays ' + d.buyerKas.toFixed(2);
  const dep = role === 'seller' ? 'you stake ' + d.sellerKas.toFixed(2) : 'seller stakes ' + d.sellerKas.toFixed(2);
  const win = d.refundMinutes > 0 ? d.refundMinutes + '-min refund' : 'no refund window';
  return "'" + item + "' — " + pay + ', ' + dep + ', ' + win;
}
