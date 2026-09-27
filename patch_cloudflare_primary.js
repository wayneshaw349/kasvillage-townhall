// ============================================================================
// PATCH: Cloudflare Worker as primary relay, TownHall as backup
// Run: node patch_cloudflare_primary.js
// ============================================================================

const fs = require('fs');
let fixes = 0;

let nr = fs.readFileSync('neighbor_relay.ts', 'utf8');

// 1. Add Cloudflare Worker URL constant
if (!nr.includes('CLOUDFLARE_RELAY_URL')) {
  nr = nr.replace(
    "const AKASH_RELAY_URL = 'https://relay.kasvillage.dev';",
    `const CLOUDFLARE_RELAY_URL = 'https://kasvillage-frost-relay.YOUR_SUBDOMAIN.workers.dev';
const AKASH_RELAY_URL = 'https://relay.kasvillage.dev';`
  );
  fixes++;
  console.log('FIX 1: CLOUDFLARE_RELAY_URL added');
}

// 2. Add Cloudflare post/fetch functions
if (!nr.includes('postToCloudflareRelay')) {
  const cfFunctions = `
// =============================================================================
// CLOUDFLARE WORKER RELAY (PRIMARY)
// =============================================================================

async function postToCloudflareRelay(payload: PartialTxPayload): Promise<RelayResult> {
  try {
    const response = await fetch(CLOUDFLARE_RELAY_URL + '/partial-sig', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agreementId: payload.agreementId,
        pubkey: payload.senderPubkey,
        partialSig: payload.partialTx,
        recipientPubkey: payload.recipientPubkey,
        timestamp: payload.timestamp,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.log('[Relay] Cloudflare failed:', response.status, text);
      return { success: false, error: 'Cloudflare relay: ' + response.status };
    }

    return { success: true, method: 'cloudflare' as any, url: CLOUDFLARE_RELAY_URL };
  } catch (e) {
    console.log('[Relay] Cloudflare error, falling back to Akash:', e);
    return { success: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

async function fetchFromCloudflareRelay(agreementId: string): Promise<PartialTxPayload | null> {
  try {
    const response = await fetch(CLOUDFLARE_RELAY_URL + '/partial-sig/' + agreementId, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.found) return null;
    return {
      agreementId,
      partialTx: data.partialSig || data.partialTx || '',
      senderPubkey: data.pubkey || '',
      recipientPubkey: data.recipientPubkey || '',
      timestamp: data.timestamp || Date.now(),
    };
  } catch {
    return null;
  }
}

/** Post agreed-send status to Cloudflare */
export async function postAgreedSendToCloudflare(params: {
  agreementId: string;
  pubkey: string;
  frostAddress: string;
  txId?: string;
}): Promise<boolean> {
  try {
    const resp = await fetch(CLOUDFLARE_RELAY_URL + '/agreed-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10000),
    });
    return resp.ok;
  } catch { return false; }
}

/** Check if counterparty sent agreed-send on Cloudflare */
export async function checkAgreedSendOnCloudflare(agreementId: string, counterpartyPubkey: string): Promise<boolean> {
  try {
    const resp = await fetch(CLOUDFLARE_RELAY_URL + '/agreed-send/' + agreementId + '/' + counterpartyPubkey, {
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    return data.found === true;
  } catch { return false; }
}

/** Post proposal to Cloudflare */
export async function postProposalToCloudflare(params: {
  agreementId: string;
  pubkey: string;
  counterpartyPubkey: string;
  amount_sompi: number;
  description: string;
  network: string;
  frostAddress?: string;
}): Promise<boolean> {
  try {
    const resp = await fetch(CLOUDFLARE_RELAY_URL + '/propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10000),
    });
    return resp.ok;
  } catch { return false; }
}

/** Fetch inbox from Cloudflare */
export async function fetchInboxFromCloudflare(pubkey: string): Promise<any[]> {
  try {
    const resp = await fetch(CLOUDFLARE_RELAY_URL + '/inbox/' + pubkey, {
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.proposals || [];
  } catch { return []; }
}

`;

  // Insert before the AKASH RELAY CLIENT section
  const akashSection = nr.indexOf('// =============================================================================\n// AKASH RELAY CLIENT');
  if (akashSection > -1) {
    nr = nr.slice(0, akashSection) + cfFunctions + nr.slice(akashSection);
    fixes++;
    console.log('FIX 2: Cloudflare relay functions added');
  }
}

// 3. Update RelayMethod type to include 'cloudflare'
if (!nr.includes("'cloudflare'")) {
  nr = nr.replace(
    "export type RelayMethod = 'bluetooth' | 'wifi' | 'tailscale' | 'akash';",
    "export type RelayMethod = 'bluetooth' | 'wifi' | 'tailscale' | 'cloudflare' | 'akash';"
  );
  fixes++;
  console.log('FIX 3: cloudflare added to RelayMethod type');
}

// 4. Change default relay priority: Cloudflare first, then Akash
nr = nr.replace(
  "const method = preferredMethod ?? status.method ?? 'akash';",
  "const method = preferredMethod ?? 'cloudflare';"
);
// Handle if the previous patch changed it
nr = nr.replace(
  "const method = preferredMethod ?? 'cloudflare' ?? status.method ?? 'akash';",
  "const method = preferredMethod ?? 'cloudflare';"
);
fixes++;
console.log('FIX 4: Default relay method set to cloudflare');

// 5. Add cloudflare case to postPartialTx switch
if (!nr.includes("case 'cloudflare':")) {
  nr = nr.replace(
    "    case 'akash':\n    default:\n      return postToAkashRelay(payload);",
    `    case 'cloudflare':
      const cfResult = await postToCloudflareRelay(payload);
      if (cfResult.success) return cfResult;
      // Cloudflare failed — fall through to Akash backup
      console.log('[Relay] Cloudflare failed, falling back to Akash');
      return postToAkashRelay(payload);

    case 'akash':
    default:
      return postToAkashRelay(payload);`
  );
  fixes++;
  console.log('FIX 5: cloudflare case added to postPartialTx');
}

// 6. Update fetchPartialTx to try Cloudflare before Akash
if (!nr.includes('fetchFromCloudflareRelay')) {
  nr = nr.replace(
    "  // Fall back to Akash relay\n  return fetchFromAkashRelay(agreementId);",
    `  // Try Cloudflare first (primary relay)
  try {
    const cfPayload = await fetchFromCloudflareRelay(agreementId);
    if (cfPayload && cfPayload.partialTx) {
      console.log('[Relay] Found partial TX on Cloudflare relay');
      return cfPayload;
    }
  } catch (e) {
    console.log('[Relay] Cloudflare fetch failed:', e);
  }

  // Fall back to Akash relay (backup)
  return fetchFromAkashRelay(agreementId);`
  );
  fixes++;
  console.log('FIX 6: fetchPartialTx now tries Cloudflare before Akash');
}

fs.writeFileSync('neighbor_relay.ts', nr);

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n=== ' + fixes + ' fixes applied ===');
console.log('\nRelay priority (new):');
console.log('  1. Cloudflare Worker  (instant, global, 99.99% uptime)');
console.log('  2. TownHall/Akash     (backup, verification services)');
console.log('  3. Arweave            (permanent record, parallel write)');
console.log('\nCloudflare Worker endpoints:');
console.log('  POST /propose           — seller creates agreement');
console.log('  GET  /inbox/{pubkey}    — buyer checks for proposals');
console.log('  POST /accept            — buyer accepts');
console.log('  POST /agreed-send       — party signals collateral sent');
console.log('  GET  /agreed-send/{id}/{pk} — check counterparty sent');
console.log('  POST /partial-sig       — post partial signature');
console.log('  GET  /partial-sig/{id}  — fetch partial signature');
console.log('  GET  /agreement/{id}    — full agreement status');
console.log('  DELETE /agreement/{id}  — cleanup after completion');
console.log('\nDeploy Worker:');
console.log('  1. npm install -g wrangler');
console.log('  2. wrangler login');
console.log('  3. wrangler kv namespace create FROST_KV');
console.log('  4. Paste KV ID into wrangler.toml');
console.log('  5. wrangler deploy');
console.log('  6. Update CLOUDFLARE_RELAY_URL in neighbor_relay.ts with your worker URL');
console.log('\nVerify: npx tsc --noEmit --pretty 2>&1 | grep "error TS" | head -5');
