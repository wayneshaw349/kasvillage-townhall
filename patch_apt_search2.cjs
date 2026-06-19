const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');
const startMarker = "response = await fetch(`${TOWNHALL_BASE}/api/identity/verify`";
const endMarker = "setSearchResult({ found: false, error: data.message || 'Not found' });";
const s = c.indexOf(startMarker);
const e = c.indexOf(endMarker);
if (s > -1 && e > -1) {
  const end = c.indexOf('}', e) + 1;
  const nl = c.includes('\r\n') ? '\r\n' : '\n';
  const rep = [
    '// Query Arweave directly for verification proof',
    "        const aptNum = query.replace(/^APT-/i, '');",
    "        console.log('[Search] Looking up APT:', aptNum);",
    '        const gql = JSON.stringify({ query: `{transactions(tags:[{name:"App-Name",values:["KasVillage"]},{name:"KV-Type",values:["verification-proof"]}],first:10){edges{node{id tags{name value}}}}}` });',
    "        const arRes = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: gql });",
    '        const arData = await arRes.json();',
    "        const edges = arData?.data?.transactions?.edges || [];",
    "        console.log('[Search] Arweave results:', edges.length);",
    '        const match = edges.find((e2: any) => {',
    "          const pk = e2.node.tags.find((t: any) => t.name === 'KV-Pubkey');",
    '          return pk && deriveApt(pk.value) === aptNum;',
    '        });',
    '        if (match) {',
    "          const tier = match.node.tags.find((t: any) => t.name === 'KV-Tier')?.value || 'Guest';",
    "          console.log('[Search] Found! TX:', match.node.id);",
    '          setSearchResult({ found: true, type: "apt", verified: true, aptNumber: "APT-" + aptNum, arweaveTx: match.node.id, name: tier });',
    '        } else {',
    "          setSearchResult({ found: false, error: 'No verification proof on Arweave for APT-' + aptNum });",
    '        }'
  ].join(nl + '        ');
  c = c.substring(0, s) + rep + c.substring(end);
  fs.writeFileSync('townhallscreen.tsx', c);
  console.log('OK: replaced', s, '->', end);
} else {
  console.log('Not found. start:', s, 'end:', e);
}
