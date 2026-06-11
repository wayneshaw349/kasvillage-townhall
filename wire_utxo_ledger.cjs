const fs = require("fs");
let s = fs.readFileSync("proposal_share.ts", "utf8");
let fixes = 0;

// 1. Add utxo_ledger import at top
s = s.replace(
  "import { sha256 } from '@noble/hashes/sha256';",
  "import { sha256 } from '@noble/hashes/sha256';\nimport { canSpend, allocateForIOU, releaseIOU, getBalanceBreakdown, isAlreadyCommitted } from './utxo_ledger';"
);
fixes++;
console.log("  → utxo_ledger import added");

// 2. Replace the REST balance check with utxo_ledger canSpend
const oldBalanceCheck = `async function checkBalance(address: string, amountSompi: bigint, network: string): Promise<{ ok: boolean; balance: bigint; error?: string }> {
  try {
    const api = network.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
    const resp = await fetch(\`\${api}/addresses/\${address}/balance\`);
    if (!resp.ok) return { ok: false, balance: 0n, error: 'Balance check failed' };
    const data = await resp.json();
    const balance = BigInt(data.balance || 0);
    if (balance < amountSompi) {
      const kas = Number(amountSompi) / 1e8;
      const have = Number(balance) / 1e8;
      return { ok: false, balance, error: \`Insufficient: need \${kas.toFixed(2)} KAS, have \${have.toFixed(2)} KAS\` };
    }
    return { ok: true, balance };
  } catch {
    return { ok: false, balance: 0n, error: 'Network error — cannot verify balance' };
  }
}`;

const newBalanceCheck = `async function checkBalance(address: string, amountSompi: bigint, network: string): Promise<{ ok: boolean; balance: bigint; error?: string }> {
  try {
    // Use UTXO ledger for accurate spendable balance (prevents double-spend)
    const check = await canSpend(address, amountSompi);
    if (check.ok) {
      return { ok: true, balance: check.spendable };
    }
    const kas = Number(amountSompi) / 1e8;
    const have = Number(check.spendable) / 1e8;
    let reason = \`Insufficient: need \${kas.toFixed(2)} KAS, have \${have.toFixed(2)} KAS spendable\`;
    if (check.committed > 0n) reason += \`. \${Number(check.committed) / 1e8} KAS committed to collateral\`;
    if (check.iouAllocated > 0n) reason += \`. \${Number(check.iouAllocated) / 1e8} KAS allocated to IOUs\`;
    return { ok: false, balance: check.spendable, error: reason };
  } catch (e: any) {
    // Fallback to REST if ledger fails
    try {
      const api = network.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
      const resp = await fetch(\`\${api}/addresses/\${address}/balance\`);
      if (!resp.ok) return { ok: false, balance: 0n, error: 'Balance check failed' };
      const data = await resp.json();
      const balance = BigInt(data.balance || 0);
      if (balance < amountSompi) {
        return { ok: false, balance, error: \`Insufficient: need \${Number(amountSompi) / 1e8} KAS, have \${Number(balance) / 1e8} KAS\` };
      }
      return { ok: true, balance };
    } catch {
      return { ok: false, balance: 0n, error: 'Cannot verify balance' };
    }
  }
}`;

if (s.includes('async function checkBalance')) {
  s = s.replace(oldBalanceCheck, newBalanceCheck);
  fixes++;
  console.log("  → checkBalance now uses utxo_ledger (prevents double-spend)");
}

// 3. Add IOU allocation when proposal is accepted
const oldAcceptStore = `// Store locally
  await storeProposal(proposal, 'accepted');`;

const newAcceptStore = `// Allocate UTXOs for this accepted proposal (prevents double-spend)
  try {
    const amountSompi = BigInt(proposal.amount);
    const proposalId = 'prop_' + proposal.nonce;
    const alreadyCommitted = await isAlreadyCommitted(proposalId);
    if (!alreadyCommitted.committed) {
      await allocateForIOU(creds.address, amountSompi, proposalId);
      console.log('[Proposal] UTXOs allocated for', proposalId);
    }
  } catch (e) {
    console.warn('[Proposal] UTXO allocation failed (non-fatal):', e);
  }

  // Store locally
  await storeProposal(proposal, 'accepted');`;

if (s.includes(oldAcceptStore)) {
  s = s.replace(oldAcceptStore, newAcceptStore);
  fixes++;
  console.log("  → acceptProposal now allocates UTXOs via ledger");
}

// 4. Update markProposalSettled to release IOU allocation
const oldSettled = `export async function markProposalSettled(nonce: string, txId: string): Promise<void> {
  const json = await SecureStore.getItemAsync(PROPOSALS_KEY);
  const proposals: StoredAgreement[] = json ? JSON.parse(json) : [];
  const p = proposals.find(x => x.proposal.nonce === nonce);
  if (p) {
    p.status = 'settled';
    p.settledTxId = txId;
    await SecureStore.setItemAsync(PROPOSALS_KEY, JSON.stringify(proposals));
  }
}`;

const newSettled = `export async function markProposalSettled(nonce: string, txId: string): Promise<void> {
  const json = await SecureStore.getItemAsync(PROPOSALS_KEY);
  const proposals: StoredAgreement[] = json ? JSON.parse(json) : [];
  const p = proposals.find(x => x.proposal.nonce === nonce);
  if (p) {
    p.status = 'settled';
    p.settledTxId = txId;
    await SecureStore.setItemAsync(PROPOSALS_KEY, JSON.stringify(proposals));
    // Release UTXO allocation
    try {
      await releaseIOU('prop_' + nonce);
      console.log('[Proposal] Released UTXO allocation for prop_' + nonce);
    } catch (e) {
      console.warn('[Proposal] Release failed:', e);
    }
  }
}`;

if (s.includes(oldSettled)) {
  s = s.replace(oldSettled, newSettled);
  fixes++;
  console.log("  → markProposalSettled now releases UTXO allocation");
}

// 5. Add getFinancialSummary export for Dashboard
s += `

// ============================================================================
// FINANCIAL SUMMARY (for Dashboard)
// ============================================================================

export async function getFinancialSummary(address: string): Promise<{
  pendingProposals: number;
  acceptedProposals: number;
  totalProposedKAS: number;
  totalAcceptedKAS: number;
  spendableKAS: number;
  committedKAS: number;
  iouAllocatedKAS: number;
  totalKAS: number;
}> {
  const proposals = await getStoredProposals();
  const pending = proposals.filter(p => p.status === 'proposed');
  const accepted = proposals.filter(p => p.status === 'accepted');
  const totalProposed = pending.reduce((s, p) => s + Number(p.proposal.amount), 0) / 1e8;
  const totalAccepted = accepted.reduce((s, p) => s + Number(p.proposal.amount), 0) / 1e8;

  let breakdown = { total: 0, spendable: 0, committed: 0, iouBacked: 0, frozen: 0 };
  try {
    breakdown = await getBalanceBreakdown(address);
  } catch {}

  return {
    pendingProposals: pending.length,
    acceptedProposals: accepted.length,
    totalProposedKAS: totalProposed,
    totalAcceptedKAS: totalAccepted,
    spendableKAS: breakdown.spendable,
    committedKAS: breakdown.committed,
    iouAllocatedKAS: breakdown.iouBacked,
    totalKAS: breakdown.total,
  };
}
`;
fixes++;
console.log("  → getFinancialSummary export added for Dashboard");

fs.writeFileSync("proposal_share.ts", s, "utf8");
console.log("done:", fixes, "patches applied");
