const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');

// Replace the broken APT search (calls non-existent /api/identity/verify) 
// with direct Arweave GraphQL query
const oldSearch = `response = await fetch(\`\${TOWNHALL_BASE}/api/identity/verify\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity_hash: query }),
        });
        data = await response.json();
        if (data.verified) {
          setSearchResult({
            found: true,
            type: 'apt',
            verified: data.verified,
            aptNumber: query,
          });
        } else {
          setSearchResult({ found: false, error: data.message || 'Not found' });
        }`;

const newSearch = `// Query Arweave directly for verification proof
        const aptNum = query.replace(/^APT-/i, '');
        console.log('[Search] Looking up APT:', aptNum);
        const gql = JSON.stringify({ query: \`{transactions(tags:[{name:"App-Name",values:["KasVillage"]},{name:"KV-Type",values:["verification-proof"]}],first:10){edges{node{id tags{name value}}}}}\` });
        const arRes = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: gql });
        const arData = await arRes.json();
        const edges = arData?.data?.transactions?.edges || [];
        console.log('[Search] Arweave results:', edges.length);
        // Find matching pubkey by deriving APT from each result's KV-Pubkey tag
        const match = edges.find((e: any) => {
          const pubkeyTag = e.node.tags.find((t: any) => t.name === 'KV-Pubkey');
          if (pubkeyTag) {
            const derivedApt = deriveApt(pubkeyTag.value);
            return derivedApt === aptNum;
          }
          return false;
        });
        if (match) {
          const tags = match.node.tags;
          const tier = tags.find((t: any) => t.name === 'KV-Tier')?.value || 'Guest';
          console.log('[Search] Found! TX:', match.node.id, 'Tier:', tier);
          setSearchResult({
            found: true,
            type: 'apt',
            verified: true,
            aptNumber: 'APT-' + aptNum,
            arweaveTx: match.node.id,
            name: tier,
          });
        } else {
          console.log('[Search] No verification proof found for APT-' + aptNum);
          setSearchResult({ found: false, error: 'No verification proof on Arweave for APT-' + aptNum });
        }`;

if (c.includes('/api/identity/verify')) {
  c = c.replace(oldSearch, newSearch);
  fs.writeFileSync('townhallscreen.tsx', c);
  console.log('OK: APT search queries Arweave directly');
} else {
  console.log('Pattern not found');
}
