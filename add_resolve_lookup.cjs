// add_resolve_lookup.cjs
// Adds resolveByAddress / resolveByApt to counterparty_lookup.ts
// Queries Arweave KV-Address/KV-Apt tags → extracts KV-Pubkey → feeds to existing lookup
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'counterparty_lookup.ts');
let src = fs.readFileSync(file, 'utf8');

const resolveBlock = `

// ============================================================================
// RESOLVE: Address/Apt → Pubkey via Arweave tags
// ============================================================================

const ARWEAVE_GQL = 'https://arweave.net/graphql';

async function resolvePubkeyFromArweave(
  tagName: string,
  tagValue: string
): Promise<string | null> {
  try {
    const query = \`{
      transactions(
        tags: [
          { name: "App-Name", values: ["KasVillage"] },
          { name: "\${tagName}", values: ["\${tagValue}"] }
        ],
        sort: HEIGHT_DESC,
        first: 1
      ) {
        edges {
          node {
            tags { name value }
          }
        }
      }
    }\`;
    const res = await fetch(ARWEAVE_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const edges = data?.data?.transactions?.edges;
    if (!edges?.length) return null;
    const tags = edges[0].node.tags as { name: string; value: string }[];
    const pubkeyTag = tags.find((t: { name: string }) => t.name === 'KV-Pubkey');
    return pubkeyTag?.value || null;
  } catch (e) {
    console.error('[Resolve] Arweave query failed:', e);
    return null;
  }
}

/**
 * Resolve Kaspa address → pubkey → counterparty stats
 */
export async function lookupByAddress(
  address: string,
  options?: { includeProof?: boolean }
): Promise<{ pubkey: string | null; stats: CounterpartyStats | null }> {
  const pubkey = await resolvePubkeyFromArweave('KV-Address', address);
  if (!pubkey) {
    console.warn('[Resolve] No pubkey found for address:', address.slice(0, 16));
    return { pubkey: null, stats: null };
  }
  const result = await lookupCounterparty(pubkey, options);
  return { pubkey, stats: result.stats };
}

/**
 * Resolve apt number → pubkey → counterparty stats
 */
export async function lookupByApt(
  apt: string,
  options?: { includeProof?: boolean }
): Promise<{ pubkey: string | null; stats: CounterpartyStats | null }> {
  const pubkey = await resolvePubkeyFromArweave('KV-Apt', apt);
  if (!pubkey) {
    console.warn('[Resolve] No pubkey found for apt:', apt);
    return { pubkey: null, stats: null };
  }
  const result = await lookupCounterparty(pubkey, options);
  return { pubkey, stats: result.stats };
}
`;

// Append before final export or at end of file
if (src.includes('export {')) {
  // Add functions before the export block
  src = src.replace(/export\s*\{/, resolveBlock + '\nexport {');
  // Add new exports
  src = src.replace(
    /export\s*\{/,
    'export {\n  lookupByAddress,\n  lookupByApt,\n  resolvePubkeyFromArweave,'
  );
} else {
  // Just append
  src += resolveBlock;
}

fs.writeFileSync(file, src, 'utf8');
console.log('✅ counterparty_lookup.ts: added lookupByAddress + lookupByApt');
console.log('   Arweave KV-Address/KV-Apt → KV-Pubkey → existing stats lookup');
