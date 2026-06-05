/**
 * patch_townhall_screen_endpoints.cjs
 * Fixes TownHallScreen to use correct Flux domain + existing Rust endpoints
 * Run: node patch_townhall_screen_endpoints.cjs
 */
const fs = require('fs');
const path = require('path');
const FILE = path.resolve(__dirname, 'townhallscreen.tsx');
let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('TOWNHALL_BASE')) {
  console.log('[Patch] Already applied. Skipping.');
  process.exit(0);
}

let count = 0;

// 1. Add TOWNHALL_BASE constant after imports
const importAnchor = "} from 'lucide-react-native';";
if (!src.includes(importAnchor)) {
  console.error('[Patch] Cannot find lucide import anchor. Aborting.');
  process.exit(1);
}
src = src.replace(importAnchor, importAnchor + `\n\nconst TOWNHALL_BASE = 'https://kasvillage.app.runonflux.io';`);
count++;
console.log('[Patch] 1 Added TOWNHALL_BASE constant');

// 2. Fix handleSearch — replace the old fetch call
const oldSearch = `      // Call Town Hall API
      const response = await fetch(\`https://townhall.kasvillage.dev/api/verify/search\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, type: searchType }),
      });
      
      const data = await response.json();
      
      if (data.ok) {
        setSearchResult({
          found: true,
          type: data.type,
          verified: data.verified,
          aptNumber: data.apt_number,
          address: data.kaspa_address,
          name: data.name,
          traits: data.trait_count,
          arweaveTx: data.arweave_tx,
          isOwner: data.is_owner,
          // Stats data
          xp: data.xp,
          pComplete: data.p_complete,
          successes: data.successes,
          deadlocks: data.deadlocks,
          statsProofTx: data.stats_proof_tx,
          // Rules compliance
          rulesFollowed: data.rules_followed,
          violations: data.violations,
        });
      } else {
        setSearchResult({
          found: false,
          error: data.error || 'Not found',
        });
      }`;

if (!src.includes(oldSearch)) {
  console.error('[Patch] Cannot find handleSearch fetch block. Aborting.');
  process.exit(1);
}

const newSearch = `      // Call Town Hall API (routes matched to configure_routes_v3)
      let response;
      let data: any;
      
      if (searchType === 'stats' || searchType === 'address') {
        // User stats lookup via /user-stats POST
        response = await fetch(\`\${TOWNHALL_BASE}/user-stats\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pubkey: query.replace('kaspa:', '').replace('kaspatest:', '') }),
        });
        data = await response.json();
        if (data.successes !== undefined || data.xp !== undefined) {
          const s = data.successes || 0;
          const d = data.deadlocks || 0;
          const n = s + d;
          setSearchResult({
            found: true,
            type: 'stats',
            verified: n > 0,
            name: data.citadel_tier || 'Guest',
            xp: data.xp || 0,
            pComplete: n > 0 ? (1 + s) / (2 + n) : 0.5,
            successes: s,
            deadlocks: d,
          });
        } else {
          setSearchResult({ found: false, error: data.error || 'Not found' });
        }
      } else if (searchType === 'dapp') {
        // DApp lookup via /api/query/dapp POST (doesn't exist yet — fallback to not found)
        // TODO: wire when /api/query/dapp is deployed
        setSearchResult({ found: false, error: 'DApp search not yet available on this TownHall instance' });
      } else {
        // APT or generic — try identity verify
        response = await fetch(\`\${TOWNHALL_BASE}/api/identity/verify\`, {
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
        }
      }`;

src = src.replace(oldSearch, newSearch);
count++;
console.log('[Patch] 2 Fixed handleSearch to use correct endpoints');

// 3. Fix handleSendVerification URL
const oldSendUrl = `https://townhall.kasvillage.dev/api/verify/submit`;
if (!src.includes(oldSendUrl)) {
  console.error('[Patch] Cannot find send verification URL. Aborting.');
  process.exit(1);
}
// Map by type: dapp → /api/verify/dapp, store → /api/verify/store, stats → /api/verify/user/full
const oldSendFetch = `      const response = await fetch('https://townhall.kasvillage.dev/api/verify/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });`;
if (!src.includes(oldSendFetch)) {
  console.error('[Patch] Cannot find send fetch block. Aborting.');
  process.exit(1);
}
const newSendFetch = `      const sendEndpoint = sendType === 'dapp' ? '/api/verify/dapp'
        : sendType === 'store' ? '/api/verify/store'
        : '/api/verify/user/full';
      const response = await fetch(\`\${TOWNHALL_BASE}\${sendEndpoint}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });`;
src = src.replace(oldSendFetch, newSendFetch);
count++;
console.log('[Patch] 3 Fixed handleSendVerification URL');

// 4. Fix handleReceiveProofs URL
const oldProofsUrl = `https://townhall.kasvillage.dev/api/verify/my-proofs`;
if (src.includes(oldProofsUrl)) {
  src = src.replace(
    `const response = await fetch(\`https://townhall.kasvillage.dev/api/verify/my-proofs\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: myAddress, apt: myApt }),
      });`,
    `const response = await fetch(\`\${TOWNHALL_BASE}/api/proofs/query\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject_id: myAddress || myApt || '' }),
      });`
  );
  count++;
  console.log('[Patch] 4 Fixed handleReceiveProofs URL');
} else {
  console.log('[Patch] 4 Proofs URL not found (skipping)');
}

// 5. Fix handleVerify URL
const oldVerifyUrl = `https://townhall.kasvillage.dev/api/verify/identity`;
if (src.includes(oldVerifyUrl)) {
  src = src.replace(oldVerifyUrl, `\${TOWNHALL_BASE}/verify-identity`);
  // Fix the template literal
  src = src.replace(
    `const response = await fetch('\${TOWNHALL_BASE}/verify-identity', {`,
    'const response = await fetch(`${TOWNHALL_BASE}/verify-identity`, {'
  );
  count++;
  console.log('[Patch] 5 Fixed handleVerify URL');
} else {
  console.log('[Patch] 5 Verify URL not found (skipping)');
}

// 6. Fix APT change URL
const oldAptUrl = `https://townhall.kasvillage.dev/api/apt/change`;
if (src.includes(oldAptUrl)) {
  src = src.replace(oldAptUrl, `\${TOWNHALL_BASE}/api/apt/register`);
  src = src.replace(
    `const response = await fetch('\${TOWNHALL_BASE}/api/apt/register', {`,
    'const response = await fetch(`${TOWNHALL_BASE}/api/apt/register`, {'
  );
  count++;
  console.log('[Patch] 6 Fixed APT change URL');
} else {
  console.log('[Patch] 6 APT URL not found (skipping)');
}

fs.writeFileSync(FILE, src, 'utf8');
console.log(`[Patch] \u2705 TownHallScreen patched (${count} changes)`);
