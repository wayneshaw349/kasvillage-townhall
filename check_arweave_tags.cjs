// check_arweave_tags.cjs — dump ALL KasVillage tag structures
async function main() {
  const queries = [
    { label: 'App-Name=KasVillage', q: `{ transactions(tags: [{ name: "App-Name", values: ["KasVillage"] }], first: 50, sort: HEIGHT_DESC) { edges { node { id tags { name value } } } } }` },
    { label: 'KV-Type any', q: `{ transactions(tags: [{ name: "KV-Type", values: ["Agreement", "FrostEvent", "KV_FROST_V1", "XP", "Identity", "Stats", "UserStats"] }], first: 30) { edges { node { id tags { name value } } } } }` },
    { label: 'KV-XP tags', q: `{ transactions(tags: [{ name: "KV-XP" }], first: 10) { edges { node { id tags { name value } } } } }` },
    { label: 'KV-UserStats', q: `{ transactions(tags: [{ name: "KV-UserStats" }], first: 10) { edges { node { id tags { name value } } } } }` },
  ];

  for (const { label, q } of queries) {
    try {
      const r = await fetch('https://arweave.net/graphql', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const d = await r.json();
      const edges = d?.data?.transactions?.edges || [];
      console.log(`\n=== ${label}: ${edges.length} results ===`);
      edges.forEach((e, i) => {
        const tags = {};
        e.node.tags.forEach(t => { tags[t.name] = t.value; });
        console.log(`  ${i+1}. ${e.node.id.slice(0,16)}`, JSON.stringify(tags));
      });
    } catch (err) {
      console.log(`\n=== ${label}: ERROR ===`, err.message);
    }
  }

  // Also check what tag NAMES exist across all KV txs
  console.log('\n=== UNIQUE TAG NAMES across KasVillage txs ===');
  try {
    const r = await fetch('https://arweave.net/graphql', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ transactions(tags: [{ name: "App-Name", values: ["KasVillage"] }], first: 50, sort: HEIGHT_DESC) { edges { node { tags { name value } } } } }` }),
    });
    const d = await r.json();
    const tagNames = new Set();
    const tagSamples = {};
    for (const e of (d?.data?.transactions?.edges || [])) {
      for (const t of e.node.tags) {
        tagNames.add(t.name);
        if (!tagSamples[t.name]) tagSamples[t.name] = [];
        if (tagSamples[t.name].length < 3 && !tagSamples[t.name].includes(t.value)) {
          tagSamples[t.name].push(t.value);
        }
      }
    }
    for (const name of [...tagNames].sort()) {
      console.log(`  ${name}: ${tagSamples[name].join(', ')}`);
    }
  } catch {}
}

main().catch(console.error);
