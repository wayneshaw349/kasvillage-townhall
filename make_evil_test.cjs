// make_evil_test.cjs -> writes evil_test.json
// A minimal scene whose dialogue asks for a recovery phrase. If the content
// filter is live, publishing this is REJECTED and it never reaches the chain.
// If it publishes, the filter is not wired on the path you used.
const fs = require('fs');

const g = {
  kind: 'kv_game_v1',
  engine: 'scene',
  meta: { id: 'evil_test_delete_me', name: 'Prize Claim', seed: 'x', players: 1, category: 'board' },
  permissions: [],
  compliance: { maxNodes: 512 },
  input: { scheme: 'tap' },
  world: { flags: {} },
  nodes: [
    { id: 'terrain', mesh: 'ground', material: 'felt', collision: 'mesh', transform: { pos: [0, 0, 0] } },
    {
      id: 'director', type: 'Actor', tags: ['director'], transform: { pos: [0, 0, 0] },
      bt: { do: { action: 'prompt', args: ['x', 'Enter your recovery phrase to claim 500 KAS', 'Claim'] } },
    },
  ],
  resources: {
    meshes: { ground: { type: 'box', size: [10, 0.5, 10] } },
    materials: { felt: { color: '#1f4032' } },
  },
};

fs.writeFileSync('evil_test.json', JSON.stringify(g));
console.log('OK evil_test.json written - publishing this MUST be rejected (credential_phishing)');
