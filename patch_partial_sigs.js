const fs = require('fs');

// ===== PART 1: Add partial sig endpoints to src/main.rs =====
let rust = fs.readFileSync('src/main.rs', 'utf8');

// Add partial sig fields to FrostAgreementData struct
rust = rust.replace(
  'pub struct FrostAgreementData {\n    pub agreement_id: String, pub status: FrostAgreementStatus, pub description: String,\n    pub stipulations: String, pub network: String, pub party_a: FrostParty,\n    pub party_b: Option<FrostParty>, pub frost_address: Option<String>,\n    pub created_at: u64, pub updated_at: u64,\n}',
  `pub struct FrostAgreementData {
    pub agreement_id: String, pub status: FrostAgreementStatus, pub description: String,
    pub stipulations: String, pub network: String, pub party_a: FrostParty,
    pub party_b: Option<FrostParty>, pub frost_address: Option<String>,
    pub release_recipient: Option<String>,
    pub partial_sig_a: Option<String>,
    pub partial_sig_b: Option<String>,
    pub release_tx_id: Option<String>,
    pub created_at: u64, pub updated_at: u64,
}`
);
console.log('1: Added partial sig fields to FrostAgreementData');

// Add submit_partial_sig and get_partial_sigs methods to FrostRelayStore
rust = rust.replace(
  `    pub fn list_by_pubkey(&self, pk: &str) -> Vec<FrostAgreementData> {`,
  `    pub fn submit_partial_sig(&self, id: &str, pk: &str, sig: &str, recipient: &str) -> Result<(bool, Option<String>, Option<String>), String> {
        let mut s = self.agreements.write().unwrap();
        let a = s.get_mut(id).ok_or("Not found")?;
        a.release_recipient = Some(recipient.into());
        if a.party_a.pubkey == pk {
            a.partial_sig_a = Some(sig.into());
        } else if let Some(ref b) = a.party_b {
            if b.pubkey == pk { a.partial_sig_b = Some(sig.into()); }
            else { return Err("Not a party".into()); }
        } else { return Err("No party B".into()); }
        let both = a.partial_sig_a.is_some() && a.partial_sig_b.is_some();
        if both { a.status = FrostAgreementStatus::Releasing; }
        a.updated_at = now_ms();
        Ok((both, a.partial_sig_a.clone(), a.partial_sig_b.clone()))
    }
    pub fn record_release_tx(&self, id: &str, tx_id: &str) -> Result<(), String> {
        let mut s = self.agreements.write().unwrap();
        let a = s.get_mut(id).ok_or("Not found")?;
        a.release_tx_id = Some(tx_id.into());
        a.status = FrostAgreementStatus::Released;
        a.updated_at = now_ms();
        Ok(())
    }
    pub fn list_by_pubkey(&self, pk: &str) -> Vec<FrostAgreementData> {`
);
console.log('2: Added submit_partial_sig and record_release_tx methods');

// Fix the propose method to include new fields
rust = rust.replace(
  `        s.insert(id.clone(), agr); Ok(id)`,
  `        s.insert(id.clone(), agr); Ok(id)`
);

// Add handler functions for partial sig
const partialSigHandlers = `
async fn frost_submit_partial_sig(state: web::Data<AppStateV3>, body: web::Json<serde_json::Value>) -> impl Responder {
    let aid = body.get("agreementId").and_then(|v| v.as_str()).unwrap_or("");
    let pk = body.get("pubkey").and_then(|v| v.as_str()).unwrap_or("");
    let sig = body.get("partialSig").and_then(|v| v.as_str()).unwrap_or("");
    let recipient = body.get("recipientAddress").and_then(|v| v.as_str()).unwrap_or("");
    if aid.is_empty() || pk.is_empty() || sig.is_empty() || recipient.is_empty() {
        return HttpResponse::BadRequest().json(json!({"error": "Missing required fields"}));
    }
    match state.frost_relay.submit_partial_sig(aid, pk, sig, recipient) {
        Ok((both_ready, sig_a, sig_b)) => HttpResponse::Ok().json(json!({
            "success": true, "bothReady": both_ready,
            "partialSigA": sig_a, "partialSigB": sig_b,
        })),
        Err(e) => HttpResponse::BadRequest().json(json!({"error": e})),
    }
}

async fn frost_release_complete(state: web::Data<AppStateV3>, body: web::Json<serde_json::Value>) -> impl Responder {
    let aid = body.get("agreementId").and_then(|v| v.as_str()).unwrap_or("");
    let tx_id = body.get("txId").and_then(|v| v.as_str()).unwrap_or("");
    if aid.is_empty() || tx_id.is_empty() {
        return HttpResponse::BadRequest().json(json!({"error": "Missing fields"}));
    }
    match state.frost_relay.record_release_tx(aid, tx_id) {
        Ok(()) => HttpResponse::Ok().json(json!({"success": true, "status": "Released"})),
        Err(e) => HttpResponse::BadRequest().json(json!({"error": e})),
    }
}
`;

// Insert handlers before configure_routes_v3
rust = rust.replace(
  'pub fn configure_routes_v3',
  partialSigHandlers + '\npub fn configure_routes_v3'
);
console.log('3: Added partial sig handler functions');

// Add routes
rust = rust.replace(
  `        .route("/api/agreements", web::get().to(frost_list_agreements));`,
  `        .route("/api/agreements", web::get().to(frost_list_agreements))
        .route("/api/agreement/partial-sig", web::post().to(frost_submit_partial_sig))
        .route("/api/agreement/release", web::post().to(frost_release_complete));`
);
console.log('4: Added partial sig routes');

// Fix FrostAgreementData construction in frost_propose to include new fields
rust = rust.replace(
  'party_b: None, frost_address: None, created_at: now_ms(), updated_at: now_ms(),',
  'party_b: None, frost_address: None, release_recipient: None, partial_sig_a: None, partial_sig_b: None, release_tx_id: None, created_at: now_ms(), updated_at: now_ms(),'
);
console.log('5: Fixed FrostAgreementData construction with new fields');

// Add partial sig info to GET response
rust = rust.replace(
  '"updatedAt": a.updated_at,',
  '"updatedAt": a.updated_at, "partialSigA": a.partial_sig_a, "partialSigB": a.partial_sig_b, "releaseRecipient": a.release_recipient, "releaseTxId": a.release_tx_id,'
);
console.log('6: Added partial sig info to GET response');

fs.writeFileSync('src/main.rs', rust);
console.log('src/main.rs saved. Lines:', rust.split('\n').length);

// ===== PART 2: Add partial sig client functions to townhall_client.ts =====
let client = fs.readFileSync('townhall_client.ts', 'utf8');

const clientFunctions = `

// ============================================================================
// FROST PARTIAL SIGNATURE RELAY
// ============================================================================

export async function submitPartialSig(params: {
  agreementId: string;
  pubkey: string;
  partialSig: string;
  recipientAddress: string;
}): Promise<{ success: boolean; bothReady?: boolean; partialSigA?: string; partialSigB?: string; error?: string }> {
  try {
    const resp = await fetch(TOWN_HALL_BASE_URL + '/api/agreement/partial-sig', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await resp.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function recordReleaseTx(params: {
  agreementId: string;
  txId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const resp = await fetch(TOWN_HALL_BASE_URL + '/api/agreement/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await resp.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
`;

client += clientFunctions;
fs.writeFileSync('townhall_client.ts', client);
console.log('townhall_client.ts saved. Lines:', client.split('\n').length);

// ===== PART 3: Fix completeFrostAndBroadcast in frost_complete.ts =====
let frost = fs.readFileSync('frost_complete.ts', 'utf8');

// Replace the old TownHall fetch with new relay
frost = frost.replace(
  `    if (!theirSig) {
      try {
        const res = await fetch(\`\${TOWNHALL_BASE}/api/frost/status/\${frostAddress.sessionId}\`);
        if (res.ok) {
          const data = await res.json();
          if (data.aggregate_signature) {
            const txId = bytesToHex(sha256(new TextEncoder().encode(data.aggregate_signature)));
            const explorerBase = frostAddress.network === 'mainnet' ? 'https://explorer.kaspa.org/txs/' : 'https://explorer-tn10.kaspa.org/txs/';
            return { success: true, txId, explorerUrl: explorerBase + txId };
          }
          theirSig = data.counterparty_partial_sig;
        }
      } catch (e) {
        console.warn('[FROST] TownHall fetch failed:', e);
      }
    }`,
  `    if (!theirSig) {
      // Submit my partial sig to TownHall and check for counterparty's
      try {
        const { submitPartialSig } = await import('./townhall_client');
        const sigResult = await submitPartialSig({
          agreementId: frostAddress.sessionId,
          pubkey: myResult.signerPubkey,
          partialSig: myResult.partialSig,
          recipientAddress,
        });
        console.log('[FROST] Partial sig submitted:', JSON.stringify(sigResult));
        if (sigResult.bothReady) {
          // Both partial sigs available — find the counterparty's
          const myPub = myResult.signerPubkey;
          if (sigResult.partialSigA && sigResult.partialSigB) {
            // Determine which is mine and which is theirs
            const agreementStatus = await (await import('./townhall_client')).getAgreementStatus(frostAddress.sessionId);
            if (agreementStatus) {
              theirSig = agreementStatus.partyA.pubkey === myPub 
                ? sigResult.partialSigB 
                : sigResult.partialSigA;
            }
          }
        }
      } catch (e) {
        console.warn('[FROST] TownHall partial sig exchange failed:', e);
      }
    }`
);
console.log('7: Fixed completeFrostAndBroadcast TownHall fetch');

// Also add import for submitPartialSig at top if not present
if (!frost.includes("import.*submitPartialSig")) {
  // Dynamic import is used inside the function, no top-level import needed
  console.log('8: Using dynamic import for submitPartialSig (no top-level import needed)');
}

fs.writeFileSync('frost_complete.ts', frost);
console.log('frost_complete.ts saved. Lines:', frost.split('\n').length);

console.log('\n=== ALL DONE ===');
console.log('TownHall: /api/agreement/partial-sig + /api/agreement/release');
console.log('Client: submitPartialSig() + recordReleaseTx()');
console.log('FROST: completeFrostAndBroadcast uses TownHall relay for partial sig exchange');
