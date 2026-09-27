const fs = require('fs');

// ============================================================================
// 1. Add uploadAgreementToArweave + queryAgreementsFromArweave to townhall_client.ts
// ============================================================================
let client = fs.readFileSync('townhall_client.ts', 'utf8');

const arweaveAgreementFns = `
// ============================================================================
// ARWEAVE PERSISTENCE FOR AGREEMENTS
// ============================================================================
import { uploadToIrys, ArweaveTag, IrysUploadResult } from './arweave_upload';
import { ARWEAVE_GRAPHQL, GOLDSKY_GRAPHQL } from './arweave_queries';

export async function inscribeAgreementToArweave(agreement: {
  agreementId: string;
  pubkey: string;
  amount_sompi: number;
  description: string;
  network: string;
  status: string;
  signature: string;
  counterpartyPubkey?: string;
}): Promise<IrysUploadResult> {
  const tags: ArweaveTag[] = [
    { name: 'App-Name', value: 'KasVillage' },
    { name: 'Content-Type', value: 'application/json' },
    { name: 'KV-Type', value: 'frost-agreement' },
    { name: 'KV-AgreementId', value: agreement.agreementId },
    { name: 'KV-Status', value: agreement.status },
    { name: 'KV-Pubkey', value: agreement.pubkey },
    { name: 'KV-Network', value: agreement.network },
    { name: 'KV-Amount', value: String(agreement.amount_sompi) },
    { name: 'Unix-Time', value: String(Math.floor(Date.now() / 1000)) },
  ];
  if (agreement.counterpartyPubkey) {
    tags.push({ name: 'KV-Counterparty', value: agreement.counterpartyPubkey });
  }
  const payload = JSON.stringify(agreement);
  console.log('[Arweave] Inscribing agreement:', agreement.agreementId, '(' + payload.length + ' bytes)');
  return uploadToIrys(payload, tags);
}

export async function queryAgreementsFromArweave(opts?: {
  status?: string;
  pubkey?: string;
  network?: string;
}): Promise<any[]> {
  const tagFilters: string[] = [
    '{ name: "App-Name", values: ["KasVillage"] }',
    '{ name: "KV-Type", values: ["frost-agreement"] }',
  ];
  if (opts?.status) {
    tagFilters.push('{ name: "KV-Status", values: ["' + opts.status + '"] }');
  }
  if (opts?.pubkey) {
    tagFilters.push('{ name: "KV-Pubkey", values: ["' + opts.pubkey + '"] }');
  }
  if (opts?.network) {
    tagFilters.push('{ name: "KV-Network", values: ["' + opts.network + '"] }');
  }

  const query = \`{
    transactions(
      tags: [\${tagFilters.join(', ')}],
      first: 20,
      sort: HEIGHT_DESC
    ) {
      edges {
        node {
          id
          tags { name value }
        }
      }
    }
  }\`;

  const endpoints = [GOLDSKY_GRAPHQL, ARWEAVE_GRAPHQL];
  for (const endpoint of endpoints) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      const edges = data?.data?.transactions?.edges || [];
      
      // Parse tags into agreement objects
      const agreements = await Promise.all(edges.map(async (edge) => {
        const tags = edge.node.tags.reduce((acc, t) => {
          acc[t.name] = t.value;
          return acc;
        }, {});
        
        // Fetch the full agreement data from Arweave
        let agreementData = {};
        try {
          const dataResp = await fetch('https://arweave.net/' + edge.node.id);
          if (dataResp.ok) {
            agreementData = await dataResp.json();
          }
        } catch (e) {
          // Fall back to tag data only
        }

        return {
          arweave_tx_id: edge.node.id,
          agreement_id: tags['KV-AgreementId'] || '',
          agreementId: tags['KV-AgreementId'] || '',
          status: tags['KV-Status'] || 'Proposed',
          description: agreementData.description || tags['KV-AgreementId'] || '',
          network: tags['KV-Network'] || 'testnet-10',
          party_a: {
            pubkey: tags['KV-Pubkey'] || '',
            amount_sompi: parseInt(tags['KV-Amount'] || '0', 10),
          },
          ...agreementData,
        };
      }));
      
      console.log('[Arweave] Found', agreements.length, 'agreements');
      return agreements;
    } catch (e) {
      console.warn('[Arweave] Query failed on', endpoint, e);
      continue;
    }
  }
  return [];
}
`;

if (!client.includes('inscribeAgreementToArweave')) {
  client += arweaveAgreementFns;
  fs.writeFileSync('townhall_client.ts', client);
  console.log('1: Arweave agreement functions added to townhall_client.ts');
} else {
  console.log('1: Already exists');
}

// ============================================================================
// 2. Wire proposeAgreement to also inscribe to Arweave
// ============================================================================
client = fs.readFileSync('townhall_client.ts', 'utf8');

// Find the proposeAgreement function and add Arweave inscription after TownHall call
const proposeSuccess = "return await resp.json();\n  } catch";
const proposeIdx = client.indexOf(proposeSuccess);
// Need to find the RIGHT one (in proposeAgreement, not elsewhere)
const proposeFnIdx = client.indexOf('export async function proposeAgreement');
if (proposeFnIdx > 0) {
  const successInPropose = client.indexOf("return await resp.json();", proposeFnIdx);
  if (successInPropose > 0 && !client.includes('// Arweave dual-write for propose')) {
    const replacement = `const result = await resp.json();
    // Arweave dual-write for propose
    try {
      await inscribeAgreementToArweave({
        agreementId: params.agreementId || '',
        pubkey: params.pubkey,
        amount_sompi: params.amount_sompi,
        description: params.description || '',
        network: params.network || 'testnet-10',
        status: 'Proposed',
        signature: params.signature,
      });
    } catch (e) { console.warn('[TownHall] Arweave inscription failed (non-fatal):', e); }
    return result;`;
    client = client.slice(0, successInPropose) + replacement + client.slice(successInPropose + "return await resp.json();".length);
    fs.writeFileSync('townhall_client.ts', client);
    console.log('2: proposeAgreement now dual-writes to Arweave');
  } else {
    console.log('2: Already wired or not found');
  }
}

// ============================================================================
// 3. Wire loadInbox in NeighborAgreement.tsx to query Arweave as fallback
// ============================================================================
let neighbor = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// Add Arweave query import
if (!neighbor.includes('queryAgreementsFromArweave')) {
  neighbor = neighbor.replace(
    "import { proposeAgreement, acceptAgreement, confirmAgreement, getAgreementStatus, recordCollateral, listMyAgreements } from './townhall_client';",
    "import { proposeAgreement, acceptAgreement, confirmAgreement, getAgreementStatus, recordCollateral, listMyAgreements, queryAgreementsFromArweave } from './townhall_client';"
  );
  console.log('3: queryAgreementsFromArweave import added');
}

// Add Arweave fallback to loadInbox
const townhallOnlyInbox = `const allProposed = await listProposedAgreements();`;
if (neighbor.includes(townhallOnlyInbox) && !neighbor.includes('// Arweave fallback')) {
  neighbor = neighbor.replace(
    townhallOnlyInbox,
    `const allProposed = await listProposedAgreements();
      // Arweave fallback — query permanent storage if TownHall cache is empty
      let arweaveProposals: any[] = [];
      if (allProposed.length === 0) {
        try {
          arweaveProposals = await queryAgreementsFromArweave({ status: 'Proposed', network: 'testnet-10' });
          console.log('[Neighbor] Arweave fallback found', arweaveProposals.length, 'proposals');
        } catch (e) { console.warn('[Neighbor] Arweave query failed:', e); }
      }`
  );
  
  // Update the merge to include Arweave results
  neighbor = neighbor.replace(
    "const allAgreements = [...agreements, ...allProposed];",
    "const allAgreements = [...agreements, ...allProposed, ...arweaveProposals];"
  );
  console.log('4: Arweave fallback wired into loadInbox');
} else {
  console.log('4: Already wired or anchor not found');
}

// Also wire acceptAgreement to inscribe the acceptance
if (!neighbor.includes('// Inscribe acceptance to Arweave')) {
  const acceptAlert = "Alert.alert('Accepted', 'FROST address ready!";
  const acceptIdx = neighbor.indexOf(acceptAlert);
  if (acceptIdx > 0) {
    const arweaveAccept = `
          // Inscribe acceptance to Arweave
          try {
            const { inscribeAgreementToArweave } = await import('./townhall_client');
            await inscribeAgreementToArweave({
              agreementId: agrId,
              pubkey: myPubkey,
              amount_sompi: Math.floor(sellerAmount * 1e8),
              description: agreement.description || '',
              network: frostNetwork,
              status: 'Accepted',
              signature: 'accept_' + Date.now(),
              counterpartyPubkey: sellerPubkey,
            });
            console.log('[Neighbor] Acceptance inscribed to Arweave');
          } catch (e) { console.warn('[Neighbor] Arweave accept inscription failed:', e); }
`;
    neighbor = neighbor.slice(0, acceptIdx) + arweaveAccept + '\n          ' + neighbor.slice(acceptIdx);
    console.log('5: Accept inscribed to Arweave');
  }
}

fs.writeFileSync('NeighborAgreement.tsx', neighbor);
console.log('=== ALL DONE ===');
console.log('townhall_client.ts lines:', fs.readFileSync('townhall_client.ts', 'utf8').split('\n').length);
console.log('NeighborAgreement.tsx lines:', neighbor.split('\n').length);
