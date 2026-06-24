const fs = require('fs');
const f = 'TownHallScreen.tsx';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// Find handleReceiveProofs and replace the fetch with Arweave query
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const handleReceiveProofs = async ()')) {
    // Find the try block
    for (let j = i; j < i + 5; j++) {
      if (lines[j].includes('try {')) {
        // Find the catch
        let catchLine = j;
        for (let k = j+1; k < j + 30; k++) {
          if (lines[k].includes('} catch')) { catchLine = k; break; }
        }
        
        const newFetch = [
          '    try {',
          '      // Query Arweave directly for user proofs',
          '      const gql = JSON.stringify({ query: `{transactions(tags:[{name:"App-Name",values:["KasVillage"]},{name:"KV-Pubkey",values:["${myPubkey}"]}],first:10,sort:HEIGHT_DESC){edges{node{id tags{name value} block{timestamp}}}}}` });',
          "      const arRes = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: gql });",
          '      const arData = await arRes.json();',
          '      const edges = arData?.data?.transactions?.edges || [];',
          '      const proofs = edges.map((e: any) => {',
          "        const getTag = (name: string) => e.node.tags?.find((t: any) => t.name === name)?.value || '';",
          '        return {',
          '          id: e.node.id,',
          "          type: getTag('KV-Type').includes('stats') ? 'stats' : getTag('KV-Type').includes('verification') ? 'identity' : 'dapp',",
          "          name: getTag('KV-Type') || 'Proof',",
          "          status: 'verified' as const,",
          '          arweaveTx: e.node.id,',
          '          timestamp: e.node.block?.timestamp ? e.node.block.timestamp * 1000 : Date.now(),',
          '        };',
          '      });',
          '      setMyProofs(proofs);',
        ];
        
        lines.splice(j, catchLine - j, ...newFetch);
        console.log('Replaced handleReceiveProofs with Arweave query');
        break;
      }
    }
    break;
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Done');
