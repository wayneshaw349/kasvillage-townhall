const fs = require('fs');
const f = 'townhallscreen.tsx';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// Find handleSearch and replace the fetch call section
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const handleSearch = async ()')) {
    // Find the try block and replace the fetch logic
    for (let j = i; j < i + 80; j++) {
      if (lines[j].includes("// Call Town Hall API") || lines[j].includes("fetch(`https://")) {
        // Find end of try block (the catch)
        let endTry = j;
        for (let k = j; k < j + 40; k++) {
          if (lines[k].includes('} catch')) { endTry = k; break; }
        }
        
        const newFetch = `      // Route to correct endpoint based on search type
      const BASE = 'https://kasvillage.app.runonflux.io';
      let url = '';
      let method = 'GET';
      let body = undefined;
      
      const isApt = query.toUpperCase().startsWith('APT-') || /^\\d{5,}$/.test(query);
      const isPubkey = /^[0-9a-fA-F]{64,66}$/.test(query);
      
      if (searchType === 'dapp') {
        url = isApt ? \`\${BASE}/api/dapp/apt/\${query}\` : \`\${BASE}/api/dapp/\${query}\`;
      } else if (searchType === 'store') {
        url = isApt ? \`\${BASE}/api/storefront/apt/\${query}\` : \`\${BASE}/api/storefront/\${query}\`;
      } else if (searchType === 'stats') {
        const id = query.replace(/^stats-/i, '');
        url = isApt ? \`\${BASE}/api/counterparty/apt/\${id}\` : \`\${BASE}/api/counterparty/\${id}\`;
      } else {
        // Default: APT or pubkey lookup
        url = isApt ? \`\${BASE}/api/counterparty/apt/\${query}\` : isPubkey ? \`\${BASE}/api/counterparty/\${query}\` : \`\${BASE}/api/counterparty/apt/APT-\${query}\`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.ok !== false && !data.error) {
        // Map response to search result format
        const stats = data.stats || data;
        setSearchResult({
          found: true,
          type: searchType,
          verified: stats.citadel_tier !== 'guest',
          aptNumber: stats.apt_alias || query,
          address: stats.pubkey,
          name: stats.brand_name || stats.pubkey?.slice(0, 12),
          traits: 0,
          arweaveTx: stats.arweave_tx,
          isOwner: false,
          xp: stats.xp || 0,
          pComplete: stats.p_complete || 0.5,
          successes: stats.successes || 0,
          deadlocks: stats.deadlocks || 0,
          statsProofTx: null,
          rulesFollowed: true,
          violations: [],
        });
      } else {
        setSearchResult({
          found: false,
          error: data.error || 'Not found',
        });
      }`;
        
        lines.splice(j, endTry - j, ...newFetch.split('\n'));
        console.log('Replaced search fetch logic');
        break;
      }
    }
    break;
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Done');
