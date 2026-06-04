// check_arweave.cjs — scan all KasVillage txs on Arweave
const PK = '02e9c450fc541f38';

async function main() {
  // 1) All KasVillage txs
  const q1 = `{ transactions(tags: [{ name: "App-Name", values: ["KasVillage"] }], first: 30, sort: HEIGHT_DESC) { edges { node { id tags { name value } } } } }`;
  const r1 = await fetch('https://arweave.net/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q1 }),
  });
  const d1 = await r1.json();
  const e1 = d1?.data?.transactions?.edges || [];
  console.log('=== ALL KasVillage txs:', e1.length, '===');
  e1.forEach((e, i) => {
    const tags = {};
    e.node.tags.forEach(t => { tags[t.name] = t.value; });
    console.log(i + 1, e.node.id.slice(0, 16), JSON.stringify(tags));
  });

  // 2) By KV-Owner
  const q2 = `{ transactions(tags: [{ name: "KV-Owner", values: ["${PK}"] }], first: 20, sort: HEIGHT_DESC) { edges { node { id tags { name value } } } } }`;
  const r2 = await fetch('https://arweave.net/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q2 }),
  });
  const d2 = await r2.json();
  const e2 = d2?.data?.transactions?.edges || [];
  console.log('\n=== KV-Owner:', PK, '— found:', e2.length, '===');
  e2.forEach((e, i) => {
    const tags = {};
    e.node.tags.forEach(t => { tags[t.name] = t.value; });
    console.log(i + 1, e.node.id.slice(0, 16), JSON.stringify(tags));
  });

  // 3) FROST events specifically
  const q3 = `{ transactions(tags: [{ name: "KV-Type", values: ["KV_FROST_V1", "FrostEvent", "Agreement"] }], first: 20, sort: HEIGHT_DESC) { edges { node { id tags { name value } } } } }`;
  const r3 = await fetch('https://arweave.net/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q3 }),
  });
  const d3 = await r3.json();
  const e3 = d3?.data?.transactions?.edges || [];
  console.log('\n=== FROST events:', e3.length, '===');
  e3.forEach((e, i) => {
    const tags = {};
    e.node.tags.forEach(t => { tags[t.name] = t.value; });
    console.log(i + 1, e.node.id.slice(0, 16), JSON.stringify(tags));
  });

  // 4) Any tx mentioning the pubkey anywhere in tags
  const q4 = `{ transactions(tags: [{ name: "KV-Buyer", values: ["${PK}"] }], first: 10) { edges { node { id tags { name value } } } } }`;
  const r4 = await fetch('https://arweave.net/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q4 }),
  });
  const d4 = await r4.json();
  const e4 = d4?.data?.transactions?.edges || [];
  console.log('\n=== KV-Buyer:', PK, '— found:', e4.length, '===');

  const q5 = `{ transactions(tags: [{ name: "KV-Seller", values: ["${PK}"] }], first: 10) { edges { node { id tags { name value } } } } }`;
  const r5 = await fetch('https://arweave.net/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q5 }),
  });
  const d5 = await r5.json();
  const e5 = d5?.data?.transactions?.edges || [];
  console.log('=== KV-Seller:', PK, '— found:', e5.length, '===');
}

main().catch(console.error);
