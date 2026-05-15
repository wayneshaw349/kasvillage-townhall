// ============================================================================
// KASVILLAGE FROST RELAY — CLOUDFLARE WORKER
// Primary relay for agreement actions. TownHall on Akash = backup.
// Deploy: wrangler deploy
// ============================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    try {
      // ====================================================================
      // HEALTH
      // ====================================================================
      if (path === '/health') {
        return json({ status: 'ok', relay: 'cloudflare', version: '1.0.0', timestamp: Date.now() });
      }

      // ====================================================================
      // PROPOSE — Seller creates agreement
      // POST /propose { agreementId, pubkey, counterpartyPubkey, amount_sompi, description, network, frostAddress }
      // ====================================================================
      if (path === '/propose' && method === 'POST') {
        const body = await request.json();
        if (!body.agreementId || !body.pubkey) {
          return json({ error: 'agreementId and pubkey required' }, 400);
        }
        // Store proposal (TTL 24h)
        await env.FROST_KV.put(
          `propose:${body.agreementId}`,
          JSON.stringify({ ...body, createdAt: Date.now() }),
          { expirationTtl: 86400 }
        );
        // Add to counterparty's inbox
        if (body.counterpartyPubkey) {
          const inboxKey = `inbox:${body.counterpartyPubkey}`;
          const existing = await env.FROST_KV.get(inboxKey, 'json') || [];
          existing.push(body.agreementId);
          // Deduplicate
          const unique = [...new Set(existing)];
          await env.FROST_KV.put(inboxKey, JSON.stringify(unique), { expirationTtl: 86400 });
        }
        return json({ success: true, agreementId: body.agreementId });
      }

      // ====================================================================
      // INBOX — Buyer checks for proposals addressed to them
      // GET /inbox/{pubkey}
      // ====================================================================
      if (path.startsWith('/inbox/') && method === 'GET') {
        const pubkey = path.split('/inbox/')[1];
        if (!pubkey) return json({ error: 'pubkey required' }, 400);

        const agreementIds = await env.FROST_KV.get(`inbox:${pubkey}`, 'json') || [];
        const proposals = [];

        for (const agrId of agreementIds) {
          const proposal = await env.FROST_KV.get(`propose:${agrId}`, 'json');
          if (proposal) proposals.push(proposal);
        }

        return json({ proposals, count: proposals.length });
      }

      // ====================================================================
      // ACCEPT — Buyer accepts proposal
      // POST /accept { agreementId, pubkey, amount_sompi, frostAddress }
      // ====================================================================
      if (path === '/accept' && method === 'POST') {
        const body = await request.json();
        if (!body.agreementId || !body.pubkey) {
          return json({ error: 'agreementId and pubkey required' }, 400);
        }
        await env.FROST_KV.put(
          `accept:${body.agreementId}:${body.pubkey}`,
          JSON.stringify({ ...body, timestamp: Date.now() }),
          { expirationTtl: 86400 }
        );
        return json({ success: true });
      }

      // ====================================================================
      // AGREED-SEND — Party signals they've sent collateral to FROST
      // POST /agreed-send { agreementId, pubkey, frostAddress, txId }
      // GET  /agreed-send/{agreementId}/{pubkey} — check if counterparty sent
      // ====================================================================
      if (path === '/agreed-send' && method === 'POST') {
        const body = await request.json();
        if (!body.agreementId || !body.pubkey) {
          return json({ error: 'agreementId and pubkey required' }, 400);
        }
        await env.FROST_KV.put(
          `agreed-send:${body.agreementId}:${body.pubkey}`,
          JSON.stringify({ ...body, timestamp: Date.now() }),
          { expirationTtl: 86400 }
        );
        return json({ success: true });
      }

      if (path.startsWith('/agreed-send/') && method === 'GET') {
        const parts = path.split('/');
        const agrId = parts[2];
        const pubkey = parts[3];
        if (!agrId || !pubkey) return json({ error: 'agreementId and pubkey required' }, 400);

        const data = await env.FROST_KV.get(`agreed-send:${agrId}:${pubkey}`, 'json');
        return json({ found: !!data, data });
      }

      // ====================================================================
      // PARTIAL-SIG — Buyer posts partial signature for release
      // POST /partial-sig { agreementId, pubkey, partialSig, recipientAddress }
      // GET  /partial-sig/{agreementId} — seller fetches buyer's partial sig
      // ====================================================================
      if (path === '/partial-sig' && method === 'POST') {
        const body = await request.json();
        if (!body.agreementId || !body.partialSig) {
          return json({ error: 'agreementId and partialSig required' }, 400);
        }
        await env.FROST_KV.put(
          `partial-sig:${body.agreementId}`,
          JSON.stringify({ ...body, timestamp: Date.now() }),
          { expirationTtl: 3600 } // 1 hour TTL
        );
        return json({ success: true });
      }

      if (path.startsWith('/partial-sig/') && method === 'GET') {
        const agrId = path.split('/partial-sig/')[1];
        if (!agrId) return json({ error: 'agreementId required' }, 400);

        const data = await env.FROST_KV.get(`partial-sig:${agrId}`, 'json');
        if (!data) return json({ found: false });
        return json({ found: true, ...data });
      }

      // ====================================================================
      // AGREEMENT STATUS — Get full state of an agreement
      // GET /agreement/{agreementId}
      // ====================================================================
      if (path.startsWith('/agreement/') && method === 'GET') {
        const agrId = path.split('/agreement/')[1];
        if (!agrId) return json({ error: 'agreementId required' }, 400);

        const proposal = await env.FROST_KV.get(`propose:${agrId}`, 'json');
        if (!proposal) return json({ found: false });

        // Check for accepts and agreed-sends
        const keys = await env.FROST_KV.list({ prefix: `accept:${agrId}:` });
        const accepts = [];
        for (const key of keys.keys) {
          const data = await env.FROST_KV.get(key.name, 'json');
          if (data) accepts.push(data);
        }

        const sendKeys = await env.FROST_KV.list({ prefix: `agreed-send:${agrId}:` });
        const sends = [];
        for (const key of sendKeys.keys) {
          const data = await env.FROST_KV.get(key.name, 'json');
          if (data) sends.push(data);
        }

        const partialSig = await env.FROST_KV.get(`partial-sig:${agrId}`, 'json');

        return json({
          found: true,
          proposal,
          accepts,
          agreedSends: sends,
          partialSig: partialSig || null,
          acceptCount: accepts.length,
          sendCount: sends.length,
        });
      }

      // ====================================================================
      // CLEANUP — Delete agreement data after completion
      // DELETE /agreement/{agreementId}
      // ====================================================================
      if (path.startsWith('/agreement/') && method === 'DELETE') {
        const agrId = path.split('/agreement/')[1];
        if (!agrId) return json({ error: 'agreementId required' }, 400);

        // Delete all keys for this agreement
        const prefixes = [`propose:${agrId}`, `accept:${agrId}:`, `agreed-send:${agrId}:`, `partial-sig:${agrId}`];
        for (const prefix of prefixes) {
          const keys = await env.FROST_KV.list({ prefix });
          for (const key of keys.keys) {
            await env.FROST_KV.delete(key.name);
          }
        }

        return json({ success: true, deleted: agrId });
      }

      // ====================================================================
      // 404
      // ====================================================================
      return json({ error: 'Not found', endpoints: [
        'GET  /health',
        'POST /propose',
        'GET  /inbox/{pubkey}',
        'POST /accept',
        'POST /agreed-send',
        'GET  /agreed-send/{agreementId}/{pubkey}',
        'POST /partial-sig',
        'GET  /partial-sig/{agreementId}',
        'GET  /agreement/{agreementId}',
        'DELETE /agreement/{agreementId}',
      ]}, 404);

    } catch (e) {
      return json({ error: e.message || 'Internal error' }, 500);
    }
  },
};
