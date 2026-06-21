const fs = require('fs');
const fixes = {};

const files = [
  'storefront_api.ts',
  'townhall_client.ts',
  'TownHallVerifier.ts',
  'Workspace.tsx',
  'counterparty_lookup.ts',
  'dapp_integrity.ts',
  'townhallscreen.tsx',
];

for (const f of files) {
  if (!fs.existsSync(f)) { console.log(f + ': not found, skipping'); continue; }
  let content = fs.readFileSync(f, 'utf8');
  let count = 0;
  
  // Replace all old TownHall URLs
  const replacements = [
    ['townhall.kasvillage.dev', 'kasvillage.app.runonflux.io'],
    ['townhall.kasvillage.app', 'kasvillage.app.runonflux.io'],
  ];
  
  for (const [old, nw] of replacements) {
    const regex = new RegExp(old.replace(/\./g, '\\.'), 'g');
    const matches = content.match(regex);
    if (matches) {
      count += matches.length;
      content = content.replace(regex, nw);
    }
  }
  
  if (count > 0) {
    fs.writeFileSync(f, content);
    console.log(f + ': ' + count + ' URL(s) fixed');
  } else {
    console.log(f + ': already correct');
  }
}

// Also fix endpoint path mismatches in Workspace.tsx
const wf = 'Workspace.tsx';
if (fs.existsSync(wf)) {
  let content = fs.readFileSync(wf, 'utf8');
  let wfixes = 0;
  
  if (content.includes('/api/verify/storefront')) {
    content = content.replace(/\/api\/verify\/storefront/g, '/api/verify/store');
    wfixes++; console.log('  Workspace: /api/verify/storefront → /api/verify/store');
  }
  
  if (wfixes > 0) fs.writeFileSync(wf, content);
}

console.log('Done');
