/**
 * KasVillage Patch: Duplicate Proposal Guard + KV Proposal Clipboard
 * ==================================================================
 * Run from repo root: node patch_proposal_guard.cjs
 *
 * 1. Adds isAlreadyCommitted() to utxo_ledger.ts
 * 2. Creates kv_proposal.ts (clipboard format module)
 * 3. Wires guard into NeighborAgreement.tsx proposal flow
 * 4. Updates "Copy All to Clipboard" to use KV proposal format
 * 5. Adds isAlreadyCommitted import to NeighborAgreement.tsx
 */

const fs = require('fs');
let fixes = 0;

function log(msg) { console.log('✓ ' + msg); fixes++; }
function skip(msg) { console.log('⊘ SKIP: ' + msg); }

// ============================================================
// PART 1: Add isAlreadyCommitted to utxo_ledger.ts
// ============================================================
{
  let ledger = fs.readFileSync('utxo_ledger.ts', 'utf8');
  
  if (ledger.includes('isAlreadyCommitted')) {
    skip('isAlreadyCommitted already exists in utxo_ledger.ts');
  } else {
    const guard = `

// ============================================================================
// DUPLICATE PROPOSAL GUARD
// ============================================================================

/**
 * Check if an agreement ID already has committed UTXOs.
 * Call BEFORE proposing to prevent duplicate proposals.
 */
export async function isAlreadyCommitted(agreementId: string): Promise<{
  committed: boolean;
  utxoCount: number;
  totalSompi: bigint;
  status: UtxoStatus | null;
}> {
  const ledger = await loadLedger();
  let totalSompi = 0n;
  let utxoCount = 0;
  let status: UtxoStatus | null = null;

  for (const entry of ledger.values()) {
    if (entry.commitReason === agreementId) {
      utxoCount++;
      totalSompi += BigInt(entry.amountSompi);
      status = entry.status;
    }
  }

  if (utxoCount > 0) {
    console.log('[UTXO-Guard] AGR', agreementId, 'already has', utxoCount, 'tagged UTXOs:', Number(totalSompi) / 1e8, 'KAS, status:', status);
  }

  return { committed: utxoCount > 0, utxoCount, totalSompi, status };
}`;

    // Insert before the final clearLedger export
    ledger = ledger.replace(
      "export async function clearLedger(): Promise<void> {",
      guard + "\n\nexport async function clearLedger(): Promise<void> {"
    );
    fs.writeFileSync('utxo_ledger.ts', ledger);
    log('Added isAlreadyCommitted to utxo_ledger.ts');
  }
}

// ============================================================
// PART 2: Create kv_proposal.ts
// ============================================================
{
  const kvProposal = `// ============================================================================
// KASVILLAGE - PROPOSAL CLIPBOARD FORMAT
// ============================================================================
// Format: KV|agrId|buyerAddr|sellerAddr|buyerAmt|sellerAmt|network|buyerR|code|description
// Seller pastes this -> app verifies everything via math. No network needed.
// ============================================================================

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

export function addressToPubkey(address: string): string | null {
  try {
    if (!address.includes(':')) return null;
    const dataPart = address.split(':')[1];
    const data5bit = Array.from(dataPart).map(c => CHARSET.indexOf(c));
    if (data5bit.some(v => v < 0)) return null;
    const result: number[] = [];
    let buff = 0, bits = 0;
    for (const d of data5bit) { buff = (buff << 5) | d; bits += 5; while (bits >= 8) { bits -= 8; result.push((buff >> bits) & 0xff); } }
    if (result[0] === 0x00 && result.length >= 33) {
      const xOnly = result.slice(1, 33);
      return '02' + xOnly.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return null;
  } catch { return null; }
}

export interface KVProposal {
  agrId: string;
  buyerAddress: string;
  sellerAddress: string;
  buyerAmountSompi: number;
  sellerAmountSompi: number;
  network: string;
  buyerR: string;
  verificationCode: string;
  description: string;
  buyerPubkey?: string | null;
  sellerPubkey?: string | null;
  valid?: boolean;
  error?: string;
}

export function generateProposal(params: {
  agrId: string;
  buyerAddress: string;
  sellerAddress: string;
  buyerAmountSompi: number;
  sellerAmountSompi: number;
  network: string;
  buyerR: string;
  verificationCode: string;
  description: string;
}): string {
  const desc = (params.description || 'Agreement').replace(/[|\\n\\r]/g, ' ').trim();
  return ['KV', params.agrId, params.buyerAddress, params.sellerAddress,
    params.buyerAmountSompi.toString(), params.sellerAmountSompi.toString(),
    params.network, params.buyerR, params.verificationCode, desc].join('|');
}

export function parseProposal(text: string): KVProposal | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('KV|')) return null;
  const parts = trimmed.split('|');
  if (parts.length < 10) return null;

  const proposal: KVProposal = {
    agrId: parts[1], buyerAddress: parts[2], sellerAddress: parts[3],
    buyerAmountSompi: parseInt(parts[4], 10), sellerAmountSompi: parseInt(parts[5], 10),
    network: parts[6], buyerR: parts[7], verificationCode: parts[8],
    description: parts.slice(9).join('|'),
  };

  proposal.buyerPubkey = addressToPubkey(proposal.buyerAddress);
  proposal.sellerPubkey = addressToPubkey(proposal.sellerAddress);

  if (!proposal.buyerPubkey || !proposal.sellerPubkey) {
    proposal.valid = false;
    proposal.error = 'Invalid Kaspa address';
    return proposal;
  }

  // Verify AGR ID
  const expectedInput = proposal.buyerPubkey + proposal.sellerPubkey
    + proposal.buyerAmountSompi.toString() + proposal.sellerAmountSompi.toString() + proposal.network;
  const expectedHash = sha256(new TextEncoder().encode(expectedInput));
  const expectedAgrId = 'AGR_' + bytesToHex(expectedHash.slice(0, 6));
  if (proposal.agrId !== expectedAgrId) {
    proposal.valid = false;
    proposal.error = 'AGR ID mismatch: expected ' + expectedAgrId;
    return proposal;
  }

  // Verify buyer R is valid EC point
  try {
    const { secp256k1 } = require('@noble/curves/secp256k1');
    secp256k1.ProjectivePoint.fromHex(proposal.buyerR);
  } catch {
    proposal.valid = false;
    proposal.error = 'Invalid buyer R nonce';
    return proposal;
  }

  // Verify code
  const sorted = [proposal.buyerPubkey, proposal.sellerPubkey].sort();
  const codeHash = sha256(new TextEncoder().encode(sorted[0] + sorted[1]));
  const expectedCode = bytesToHex(codeHash.slice(0, 2)).toUpperCase();
  if (proposal.verificationCode !== expectedCode) {
    proposal.valid = false;
    proposal.error = 'Code mismatch: expected ' + expectedCode;
    return proposal;
  }

  proposal.valid = true;
  return proposal;
}

export function verifyProposalForMe(proposal: KVProposal, myAddress: string, myPubkey: string): {
  isForMe: boolean; myRole: 'buyer' | 'seller' | null; error?: string;
} {
  if (!proposal.valid) return { isForMe: false, myRole: null, error: proposal.error };
  if (proposal.sellerAddress === myAddress || proposal.sellerPubkey === myPubkey)
    return { isForMe: true, myRole: 'seller' };
  if (proposal.buyerAddress === myAddress || proposal.buyerPubkey === myPubkey)
    return { isForMe: false, myRole: null, error: 'This is your own proposal' };
  return { isForMe: false, myRole: null, error: 'Not addressed to you' };
}

export function parseReleaseKey(text: string): { agrId: string; buyerR: string; encryptedSig: string } | null {
  const t = text.trim();
  const agrMatch = t.match(/AGR:\\s*(\\S+)/);
  const rMatch = t.match(/R:\\s*([0-9a-fA-F]{60,66})/);
  const sigMatch = t.match(/SIG:\\s*(.+)/);
  if (!agrMatch || !sigMatch) return null;
  return { agrId: agrMatch[1], buyerR: rMatch ? rMatch[1] : '', encryptedSig: sigMatch[1].trim() };
}
`;

  fs.writeFileSync('kv_proposal.ts', kvProposal);
  log('Created kv_proposal.ts');
}

// ============================================================
// PART 3: Wire into NeighborAgreement.tsx
// ============================================================
{
  let na = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
  
  // 3a: Add isAlreadyCommitted to utxo_ledger import
  if (!na.includes('isAlreadyCommitted')) {
    na = na.replace(
      "import { canonicalCommit, verifyCommitment, releaseExpiredCommitments, markLocked } from './utxo_ledger';",
      "import { canonicalCommit, verifyCommitment, releaseExpiredCommitments, markLocked, isAlreadyCommitted } from './utxo_ledger';"
    );
    log('Added isAlreadyCommitted to import');
  } else { skip('isAlreadyCommitted import already exists'); }

  // 3b: Add kv_proposal import
  if (!na.includes("from './kv_proposal'")) {
    na = na.replace(
      "import { canonicalCommit, verifyCommitment, releaseExpiredCommitments, markLocked, isAlreadyCommitted } from './utxo_ledger';",
      "import { canonicalCommit, verifyCommitment, releaseExpiredCommitments, markLocked, isAlreadyCommitted } from './utxo_ledger';\nimport { generateProposal, parseProposal, verifyProposalForMe, parseReleaseKey } from './kv_proposal';"
    );
    log('Added kv_proposal import');
  } else { skip('kv_proposal import already exists'); }

  // 3c: Add duplicate guard before proposeAgreement call
  // Insert after agreementId is computed and before proposeAgreement
  if (!na.includes('[UTXO-Guard]')) {
    na = na.replace(
      "            console.log('[Neighbor] Proposing to TownHall:', agreementId,",
      "            // Check duplicate proposal guard\n            const dupGuard = await isAlreadyCommitted(agreementId);\n            if (dupGuard.committed) {\n              console.log('[UTXO-Guard] Already committed to', agreementId, '- skipping re-propose');\n              Alert.alert('Already Proposed', 'Agreement ' + agreementId.slice(0,12) + ' already exists. Reset to create a new one.');\n              setIsLoading(false);\n              return;\n            }\n            console.log('[Neighbor] Proposing to TownHall:', agreementId,"
    );
    log('Added duplicate proposal guard');
  } else { skip('Duplicate guard already exists'); }

  // 3d: Update "Copy All to Clipboard" to use KV proposal format
  const oldClipboard = "const shareText = 'AGR: ' + contract.agreementId + '\\nTX: ' + (contract.arweaveTxId || 'pending') + '\\nCode: ' + (contract.verificationCode || '');";
  if (na.includes(oldClipboard)) {
    na = na.replace(
      oldClipboard,
      "// Generate KV proposal clipboard format\n                          const buyerR_saved = await (async () => { try { const s = await AsyncStorage.getItem('kv_frost_nonce_' + (contract.agreementId || '')); return s ? JSON.parse(s).R_hex || '' : ''; } catch { return ''; } })();\n                          const shareText = generateProposal({\n                            agrId: contract.agreementId || '',\n                            buyerAddress: myAddress || '',\n                            sellerAddress: counterpartyKaspaAddr || '',\n                            buyerAmountSompi: Math.floor(contract.itemPriceKas * 1e8),\n                            sellerAmountSompi: Math.floor(contract.sellerCommitmentKas * 1e8),\n                            network: contract.frostData?.network || 'testnet-10',\n                            buyerR: buyerR_saved,\n                            verificationCode: contract.verificationCode || '',\n                            description: contract.itemDescription || '',\n                          });"
    );
    log('Updated Copy All to Clipboard with KV proposal format');
  } else { skip('Copy All clipboard already updated'); }

  // 3e: Rename multisigAddress references in variable names to frostAddress for clarity
  // (cosmetic only — don't change state variable names as that breaks session restore)
  // Skip this for now — too risky

  fs.writeFileSync('NeighborAgreement.tsx', na);
  
  // Verify
  const cc = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
  let b = 0, p = 0;
  for (const ch of cc) { if (ch === '{') b++; if (ch === '}') b--; if (ch === '(') p++; if (ch === ')') p--; }
  console.log('\nBraces:', b === 0 ? 'OK ✓' : 'BROKEN(' + b + ') ✗');
  console.log('Parens:', p === 0 ? 'OK ✓' : 'BROKEN(' + p + ') ✗');
}

console.log('\n' + '='.repeat(50));
console.log('Applied', fixes, 'fixes');
console.log('='.repeat(50));
console.log('\nNext:');
console.log('  git pull --rebase origin main');
console.log('  git add utxo_ledger.ts kv_proposal.ts NeighborAgreement.tsx');
console.log('  git commit -m "feat: duplicate proposal guard + KV clipboard format"');
console.log('  git push origin main');
