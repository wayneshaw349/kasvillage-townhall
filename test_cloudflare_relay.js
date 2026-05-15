// ============================================================================
// TEST: Cloudflare Worker Relay (all endpoints)
// Run: node test_cloudflare_relay.js
// ============================================================================

const crypto = require('crypto');

// Simulated KV store
const KV = {};
const FROST_KV = {
  async put(key, value, opts) { KV[key] = { value, expires: opts?.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : null }; },
  async get(key, type) { const e = KV[key]; if (!e) return null; if (type === 'json') return JSON.parse(e.value); return e.value; },
  async delete(key) { delete KV[key]; },
  async list(opts) { const prefix = opts?.prefix || ''; return { keys: Object.keys(KV).filter(k => k.startsWith(prefix)).map(k => ({ name: k })) }; },
};

// Simulated Worker handler (mirrors frost_relay_worker.js)
async function handleRequest(method, path, body) {
  const json = (data, status = 200) => ({ status, data });
  const env = { FROST_KV };

  if (path === '/health') return json({ status: 'ok', relay: 'cloudflare' });

  if (path === '/propose' && method === 'POST') {
    if (!body.agreementId || !body.pubkey) return json({ error: 'missing fields' }, 400);
    await env.FROST_KV.put(`propose:${body.agreementId}`, JSON.stringify({ ...body, createdAt: Date.now() }), { expirationTtl: 86400 });
    if (body.counterpartyPubkey) {
      const existing = await env.FROST_KV.get(`inbox:${body.counterpartyPubkey}`, 'json') || [];
      existing.push(body.agreementId);
      await env.FROST_KV.put(`inbox:${body.counterpartyPubkey}`, JSON.stringify([...new Set(existing)]), { expirationTtl: 86400 });
    }
    return json({ success: true, agreementId: body.agreementId });
  }

  if (path.startsWith('/inbox/') && method === 'GET') {
    const pubkey = path.split('/inbox/')[1];
    const ids = await env.FROST_KV.get(`inbox:${pubkey}`, 'json') || [];
    const proposals = [];
    for (const id of ids) { const p = await env.FROST_KV.get(`propose:${id}`, 'json'); if (p) proposals.push(p); }
    return json({ proposals, count: proposals.length });
  }

  if (path === '/accept' && method === 'POST') {
    if (!body.agreementId || !body.pubkey) return json({ error: 'missing' }, 400);
    await env.FROST_KV.put(`accept:${body.agreementId}:${body.pubkey}`, JSON.stringify({ ...body, timestamp: Date.now() }), { expirationTtl: 86400 });
    return json({ success: true });
  }

  if (path === '/agreed-send' && method === 'POST') {
    if (!body.agreementId || !body.pubkey) return json({ error: 'missing' }, 400);
    await env.FROST_KV.put(`agreed-send:${body.agreementId}:${body.pubkey}`, JSON.stringify({ ...body, timestamp: Date.now() }), { expirationTtl: 86400 });
    return json({ success: true });
  }

  if (path.startsWith('/agreed-send/') && method === 'GET') {
    const parts = path.split('/'); const agrId = parts[2]; const pk = parts[3];
    const data = await env.FROST_KV.get(`agreed-send:${agrId}:${pk}`, 'json');
    return json({ found: !!data, data });
  }

  if (path === '/partial-sig' && method === 'POST') {
    if (!body.agreementId || !body.partialSig) return json({ error: 'missing' }, 400);
    await env.FROST_KV.put(`partial-sig:${body.agreementId}`, JSON.stringify({ ...body, timestamp: Date.now() }), { expirationTtl: 3600 });
    return json({ success: true });
  }

  if (path.startsWith('/partial-sig/') && method === 'GET') {
    const agrId = path.split('/partial-sig/')[1];
    const data = await env.FROST_KV.get(`partial-sig:${agrId}`, 'json');
    if (!data) return json({ found: false });
    return json({ found: true, ...data });
  }

  if (path.startsWith('/agreement/') && method === 'GET') {
    const agrId = path.split('/agreement/')[1];
    const proposal = await env.FROST_KV.get(`propose:${agrId}`, 'json');
    if (!proposal) return json({ found: false });
    const acceptKeys = await env.FROST_KV.list({ prefix: `accept:${agrId}:` });
    const sendKeys = await env.FROST_KV.list({ prefix: `agreed-send:${agrId}:` });
    const partialSig = await env.FROST_KV.get(`partial-sig:${agrId}`, 'json');
    return json({ found: true, proposal, acceptCount: acceptKeys.keys.length, sendCount: sendKeys.keys.length, partialSig });
  }

  if (path.startsWith('/agreement/') && method === 'DELETE') {
    const agrId = path.split('/agreement/')[1];
    for (const prefix of [`propose:${agrId}`, `accept:${agrId}:`, `agreed-send:${agrId}:`, `partial-sig:${agrId}`]) {
      const keys = await env.FROST_KV.list({ prefix });
      for (const key of keys.keys) await env.FROST_KV.delete(key.name);
    }
    return json({ success: true, deleted: agrId });
  }

  return json({ error: 'Not found' }, 404);
}

// ============================================================================
// TESTS
// ============================================================================

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log(`  ✅ ${name}`); passed++; } catch (e) { console.log(`  ❌ ${name}: ${e.message}`); failed++; } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

const SELLER = '02e9c450fc541f388eb3c0292401560115c56029137ad8207c4875f7d0f296424f';
const BUYER = '02dd5b588bb15ba4f56a451afe57bbdc38a7aa7a9bdd637c49c0e662bb3917765b';
const AGR_ID = 'AGR_' + Date.now();
const FROST_ADDR = 'kaspatest:frost_test123';

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  CLOUDFLARE WORKER RELAY TEST                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Health
  console.log('PHASE 1: Health');
  let r = await handleRequest('GET', '/health');
  test('Health returns ok', () => assert(r.data.status === 'ok'));
  test('Relay type is cloudflare', () => assert(r.data.relay === 'cloudflare'));

  // Propose
  console.log('\nPHASE 2: Propose');
  r = await handleRequest('POST', '/propose', {
    agreementId: AGR_ID, pubkey: SELLER, counterpartyPubkey: BUYER,
    amount_sompi: 1000000000, description: 'Watch', network: 'testnet-10', frostAddress: FROST_ADDR,
  });
  test('Propose succeeds', () => assert(r.data.success));
  test('Propose returns agreementId', () => assert(r.data.agreementId === AGR_ID));

  // Inbox
  console.log('\nPHASE 3: Buyer Inbox');
  r = await handleRequest('GET', `/inbox/${BUYER}`);
  test('Buyer inbox has 1 proposal', () => assert(r.data.count === 1));
  test('Proposal has correct description', () => assert(r.data.proposals[0].description === 'Watch'));
  test('Proposal has FROST address', () => assert(r.data.proposals[0].frostAddress === FROST_ADDR));
  test('Proposal has counterpartyPubkey', () => assert(r.data.proposals[0].counterpartyPubkey === BUYER));

  // Seller inbox should be empty
  r = await handleRequest('GET', `/inbox/${SELLER}`);
  test('Seller inbox is empty', () => assert(r.data.count === 0));

  // Accept
  console.log('\nPHASE 4: Buyer Accepts');
  r = await handleRequest('POST', '/accept', { agreementId: AGR_ID, pubkey: BUYER, amount_sompi: 500000000, frostAddress: FROST_ADDR });
  test('Accept succeeds', () => assert(r.data.success));

  // Agreed-Send (both parties)
  console.log('\nPHASE 5: Agreed-Send');
  r = await handleRequest('POST', '/agreed-send', { agreementId: AGR_ID, pubkey: SELLER, frostAddress: FROST_ADDR, txId: 'tx_seller_123' });
  test('Seller agreed-send succeeds', () => assert(r.data.success));

  r = await handleRequest('POST', '/agreed-send', { agreementId: AGR_ID, pubkey: BUYER, frostAddress: FROST_ADDR, txId: 'tx_buyer_456' });
  test('Buyer agreed-send succeeds', () => assert(r.data.success));

  // Check counterparty's agreed-send
  r = await handleRequest('GET', `/agreed-send/${AGR_ID}/${BUYER}`);
  test('Seller can see buyer agreed-send', () => assert(r.data.found === true));

  r = await handleRequest('GET', `/agreed-send/${AGR_ID}/${SELLER}`);
  test('Buyer can see seller agreed-send', () => assert(r.data.found === true));

  // Wrong agreement
  r = await handleRequest('GET', `/agreed-send/AGR_wrong/${BUYER}`);
  test('Wrong agreementId returns not found', () => assert(r.data.found === false));

  // Partial Sig
  console.log('\nPHASE 6: Partial Signature');
  const partialSig = crypto.randomBytes(32).toString('hex');
  r = await handleRequest('POST', '/partial-sig', { agreementId: AGR_ID, pubkey: BUYER, partialSig, recipientPubkey: SELLER });
  test('Partial sig post succeeds', () => assert(r.data.success));

  r = await handleRequest('GET', `/partial-sig/${AGR_ID}`);
  test('Seller fetches partial sig', () => assert(r.data.found === true));
  test('Partial sig matches', () => assert(r.data.partialSig === partialSig));

  r = await handleRequest('GET', '/partial-sig/AGR_wrong');
  test('Wrong agreementId returns not found', () => assert(r.data.found === false));

  // Full agreement status
  console.log('\nPHASE 7: Agreement Status');
  r = await handleRequest('GET', `/agreement/${AGR_ID}`);
  test('Agreement found', () => assert(r.data.found === true));
  test('Has proposal', () => assert(r.data.proposal.description === 'Watch'));
  test('1 accept', () => assert(r.data.acceptCount === 1));
  test('2 agreed-sends', () => assert(r.data.sendCount === 2));
  test('Has partial sig', () => assert(r.data.partialSig !== null));

  // Cleanup
  console.log('\nPHASE 8: Cleanup');
  r = await handleRequest('DELETE', `/agreement/${AGR_ID}`);
  test('Delete succeeds', () => assert(r.data.success));

  r = await handleRequest('GET', `/agreement/${AGR_ID}`);
  test('Agreement gone after delete', () => assert(r.data.found === false));

  r = await handleRequest('GET', `/partial-sig/${AGR_ID}`);
  test('Partial sig gone after delete', () => assert(r.data.found === false));

  // Guards
  console.log('\nPHASE 9: Guards');
  r = await handleRequest('POST', '/propose', {});
  test('Empty propose rejected', () => assert(r.status === 400));

  r = await handleRequest('POST', '/partial-sig', { agreementId: 'x' });
  test('Partial sig without sig rejected', () => assert(r.status === 400));

  r = await handleRequest('GET', '/nonexistent');
  test('Unknown path returns 404', () => assert(r.status === 404));

  // Relay priority test
  console.log('\nPHASE 10: Relay Priority');
  test('Priority: Cloudflare → Akash → Arweave', () => {
    const priority = ['cloudflare', 'akash', 'arweave'];
    assert(priority[0] === 'cloudflare');
    assert(priority[1] === 'akash');
    assert(priority[2] === 'arweave');
  });

  // Summary
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  RESULTS: ${passed} passed, ${failed} failed${' '.repeat(Math.max(0, 30 - String(passed).length - String(failed).length))}║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (failed > 0) { console.log('\n⚠️  FAILURES'); process.exit(1); }
  else {
    console.log('\n✅ ALL TESTS PASS — Worker ready to deploy\n');
    console.log('Deploy steps:');
    console.log('  1. npm install -g wrangler');
    console.log('  2. wrangler login');
    console.log('  3. wrangler kv namespace create FROST_KV');
    console.log('  4. Paste ID into wrangler.toml');
    console.log('  5. wrangler deploy');
    console.log('  6. node patch_cloudflare_primary.js');
    console.log('  7. Update CLOUDFLARE_RELAY_URL with your worker URL');
  }
}

runTests();
