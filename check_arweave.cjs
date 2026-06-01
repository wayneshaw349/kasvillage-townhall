fetch('https://arweave.net/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: '{ transactions(first: 10, tags: [{ name: "KV-AgreementId", values: ["AGR_3c3998b7d19e"] }], sort: HEIGHT_DESC) { edges { node { id tags { name value } } } } }'
  })
}).then(r => r.json()).then(j => {
  const edges = j?.data?.transactions?.edges || [];
  console.log('Arweave records for AGR_3c3998b7d19e:', edges.length);
  edges.forEach((e, i) => {
    const tags = {};
    e.node.tags.forEach(t => { tags[t.name] = t.value; });
    console.log(i + 1 + '.', 'TX:', e.node.id.slice(0, 20), 'Status:', tags['KV-Status'] || '?', 'Pubkey:', (tags['KV-Pubkey'] || '').slice(0, 16));
  });
  if (edges.length === 0) console.log('No records found - inscription may not have been sent for the release TX');
});
