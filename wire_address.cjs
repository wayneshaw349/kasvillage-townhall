const fs = require('fs');

// === 1. Phone: add address to stats proof URL ===
const tf = 'TownHallScreen.tsx';
let tl = fs.readFileSync(tf, 'utf8').split(/\r?\n/);
for (let i = 0; i < tl.length; i++) {
  if (tl[i].includes('/api/counterparty/') && tl[i].includes('include_proof=true')) {
    tl[i] = tl[i].replace(
      'include_proof=true`',
      'include_proof=true&address=${encodeURIComponent(myAddress || "")}`'
    );
    console.log('Phone: added address to proof URL');
    break;
  }
}
fs.writeFileSync(tf, tl.join('\r\n'));

// === 2. Backend: read address param, use for L1 queries ===
const vf = 'src\\townhall_verification_complete.rs';
let vl = fs.readFileSync(vf, 'utf8').split(/\r?\n/);

// Add address to CounterpartyProofRequest
for (let i = 0; i < vl.length; i++) {
  if (vl[i].includes('pub struct CounterpartyProofRequest')) {
    for (let j = i+1; j < i+6; j++) {
      if (vl[j].includes('pub include_history: bool,')) {
        if (!vl[j+1]?.includes('address')) {
          vl.splice(j+1, 0, '    #[serde(default)]', '    pub address: Option<String>,');
          console.log('Backend: added address to CounterpartyProofRequest');
        }
        break;
      }
    }
    break;
  }
}

// Pass address to aggregate_and_prove_stats in the proof handler
for (let i = 0; i < vl.length; i++) {
  if (vl[i].includes('aggregate_and_prove_stats(&pubkey).await')) {
    vl[i] = vl[i].replace(
      'aggregate_and_prove_stats(&pubkey).await',
      'aggregate_and_prove_stats(&pubkey, query.address.as_deref()).await'
    );
    console.log('Backend: passing address to aggregate_and_prove_stats');
    break;
  }
}

// Update aggregate_and_prove_stats signature to accept optional address
for (let i = 0; i < vl.length; i++) {
  if (vl[i].includes('pub async fn aggregate_and_prove_stats(pubkey: &str)')) {
    vl[i] = vl[i].replace(
      'pub async fn aggregate_and_prove_stats(pubkey: &str)',
      'pub async fn aggregate_and_prove_stats(pubkey: &str, address: Option<&str>)'
    );
    console.log('Backend: updated aggregate_and_prove_stats signature');
    break;
  }
}

// Use address for L1 query instead of pubkey
for (let i = 0; i < vl.length; i++) {
  if (vl[i].includes('let l1_events = query_l1_frost_events(pubkey).await')) {
    vl[i] = vl[i].replace(
      'let l1_events = query_l1_frost_events(pubkey).await',
      'let l1_query_id = address.unwrap_or(pubkey);\n    let l1_events = query_l1_frost_events(l1_query_id).await'
    );
    console.log('Backend: using address for L1 queries');
    break;
  }
}

fs.writeFileSync(vf, vl.join('\r\n'));
console.log('Done');
