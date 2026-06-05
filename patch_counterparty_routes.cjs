// patch_counterparty_routes.cjs — Add counterparty stats routes to main.rs
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'main.rs');

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('/api/counterparty/{pubkey}')) {
  console.log('[patch] Counterparty routes already present — skipping.');
  process.exit(0);
}

// Find the anchor: last route in configure_routes_v3
const anchor = '.route("/api/host-nodes", web::get().to(get_host_nodes))';
const idx = src.indexOf(anchor);
if (idx === -1) {
  console.log('[patch] Anchor "/api/host-nodes" not found. Trying alternate...');
  // Try finding end of configure_routes_v3 by looking for the closing semicolon
  const altAnchor = '.route("/api/code/register", web::post().to(register_signature_api))';
  const altIdx = src.indexOf(altAnchor);
  if (altIdx === -1) {
    console.log('[patch] No anchor found in configure_routes_v3. Manual edit needed.');
    process.exit(1);
  }
}

const insertAfter = anchor + (src[idx + anchor.length] === ';' ? ';' : '');
const insertIdx = src.indexOf(insertAfter);
if (insertIdx === -1) {
  console.log('[patch] Could not locate insert point.');
  process.exit(1);
}

const ROUTES = `
        // Counterparty Stats Lookup & SNARK Proofs (universal — any KasVillage wallet)
        .route("/api/counterparty/{pubkey}", web::get().to(api_get_counterparty_stats))
        .route("/api/counterparty/{pubkey}/proof", web::get().to(api_get_counterparty_stats_with_proof))
        .route("/api/counterparty/batch", web::post().to(api_batch_counterparty))
        // Aggregate stats from L1 + Arweave
        .route("/api/stats/aggregate/{pubkey}", web::get().to(api_aggregate_stats))`;

// Insert after the anchor line (before the semicolon that closes the chain)
// The anchor ends with "...get_host_nodes))" or "...get_host_nodes));"
// We need to insert BEFORE the final ";" that closes configure_routes_v3
const anchorEnd = insertIdx + insertAfter.length;
src = src.slice(0, anchorEnd) + ROUTES + src.slice(anchorEnd);

fs.writeFileSync(FILE, src);
console.log('[patch] Added 4 counterparty/stats routes to configure_routes_v3.');
console.log('[patch] Handlers needed: api_get_counterparty_stats, api_get_counterparty_stats_with_proof, api_batch_counterparty, api_aggregate_stats');
console.log('[patch] These are defined in townhall_verification_complete.rs — ensure they are imported.');
