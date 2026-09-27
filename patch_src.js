const fs = require('fs');
let code = fs.readFileSync('src/main.rs', 'utf8');

// ===== PART 2: Insert FrostRelayStore structs =====
const structs = `
// ============================================================================
// FROST AGREEMENT RELAY (in-memory store for agreement signing flow)
// ============================================================================
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum FrostAgreementStatus { Proposed, Accepted, Confirming, BothConfirmed, Funding, Collateralized, Active, Releasing, Released, Expired }

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FrostParty {
    pub pubkey: String, pub amount_sompi: u64, pub signature: String,
    pub confirmed: bool, pub confirm_signature: Option<String>, pub collateral_tx_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FrostAgreementData {
    pub agreement_id: String, pub status: FrostAgreementStatus, pub description: String,
    pub stipulations: String, pub network: String, pub party_a: FrostParty,
    pub party_b: Option<FrostParty>, pub frost_address: Option<String>,
    pub created_at: u64, pub updated_at: u64,
}

pub struct FrostRelayStore { agreements: RwLock<HashMap<String, FrostAgreementData>> }
impl FrostRelayStore {
    pub fn new() -> Self { Self { agreements: RwLock::new(HashMap::new()) } }
    pub fn propose(&self, agr: FrostAgreementData) -> Result<String, String> {
        let id = agr.agreement_id.clone();
        let mut s = self.agreements.write().unwrap();
        if s.contains_key(&id) { return Err("Agreement ID already exists".into()); }
        s.insert(id.clone(), agr); Ok(id)
    }
    pub fn get(&self, id: &str) -> Option<FrostAgreementData> { self.agreements.read().unwrap().get(id).cloned() }
    pub fn accept(&self, id: &str, pb: FrostParty) -> Result<(), String> {
        let mut s = self.agreements.write().unwrap();
        let a = s.get_mut(id).ok_or("Not found")?;
        if a.status != FrostAgreementStatus::Proposed { return Err(format!("Cannot accept: {:?}", a.status)); }
        if a.party_a.pubkey == pb.pubkey { return Err("Cannot accept own agreement".into()); }
        a.party_b = Some(pb); a.status = FrostAgreementStatus::Accepted; a.updated_at = now_ms(); Ok(())
    }
    pub fn confirm(&self, id: &str, pk: &str, sig: &str) -> Result<FrostAgreementStatus, String> {
        let mut s = self.agreements.write().unwrap();
        let a = s.get_mut(id).ok_or("Not found")?;
        if a.party_a.pubkey == pk { a.party_a.confirmed = true; a.party_a.confirm_signature = Some(sig.into()); }
        else if let Some(ref mut b) = a.party_b { if b.pubkey == pk { b.confirmed = true; b.confirm_signature = Some(sig.into()); } else { return Err("Not a party".into()); } }
        else { return Err("No party B".into()); }
        let both = a.party_a.confirmed && a.party_b.as_ref().map_or(false, |b| b.confirmed);
        a.status = if both { FrostAgreementStatus::BothConfirmed } else { FrostAgreementStatus::Confirming };
        a.updated_at = now_ms(); Ok(a.status.clone())
    }
    pub fn record_collateral(&self, id: &str, pk: &str, tx: &str, addr: Option<&str>) -> Result<FrostAgreementStatus, String> {
        let mut s = self.agreements.write().unwrap();
        let a = s.get_mut(id).ok_or("Not found")?;
        if a.party_a.pubkey == pk { a.party_a.collateral_tx_id = Some(tx.into()); }
        else if let Some(ref mut b) = a.party_b { if b.pubkey == pk { b.collateral_tx_id = Some(tx.into()); } }
        if let Some(ad) = addr { a.frost_address = Some(ad.into()); }
        let both = a.party_a.collateral_tx_id.is_some() && a.party_b.as_ref().map_or(false, |b| b.collateral_tx_id.is_some());
        a.status = if both { FrostAgreementStatus::Collateralized } else { FrostAgreementStatus::Funding };
        a.updated_at = now_ms(); Ok(a.status.clone())
    }
    pub fn list_by_pubkey(&self, pk: &str) -> Vec<FrostAgreementData> {
        self.agreements.read().unwrap().values().filter(|a| a.party_a.pubkey == pk || a.party_b.as_ref().map_or(false, |b| b.pubkey == pk)).cloned().collect()
    }
}
fn now_ms() -> u64 { std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64 }

`;

const marker1 = '// GLOBAL BAYESIAN STATS';
const idx1 = code.indexOf(marker1);
if (idx1 > 0) {
    code = code.slice(0, idx1) + structs + code.slice(idx1);
    console.log('OK: FrostRelayStore structs inserted');
} else {
    console.log('WARN: GLOBAL BAYESIAN STATS marker not found');
}

// ===== PART 3: Insert handler functions before configure_routes =====
const handlers = `
// ============================================================================
// FROST AGREEMENT RELAY HANDLERS
// ============================================================================
async fn frost_propose(state: web::Data<AppStateV2>, body: web::Json<serde_json::Value>) -> impl Responder {
    let aid = body.get("agreementId").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let pk = body.get("pubkey").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let amt = body.get("amount_sompi").and_then(|v| v.as_u64()).unwrap_or(0);
    let sig = body.get("signature").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let desc = body.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let stip = body.get("stipulations").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let net = body.get("network").and_then(|v| v.as_str()).unwrap_or("testnet-10").to_string();
    if aid.is_empty() || pk.is_empty() || sig.is_empty() {
        return HttpResponse::BadRequest().json(json!({"error": "Missing required fields"}));
    }
    let agr = FrostAgreementData {
        agreement_id: aid.clone(), status: FrostAgreementStatus::Proposed,
        description: desc, stipulations: stip, network: net,
        party_a: FrostParty { pubkey: pk, amount_sompi: amt, signature: sig, confirmed: false, confirm_signature: None, collateral_tx_id: None },
        party_b: None, frost_address: None, created_at: now_ms(), updated_at: now_ms(),
    };
    match state.frost_relay.propose(agr) {
        Ok(id) => HttpResponse::Ok().json(json!({"success": true, "agreementId": id, "status": "proposed"})),
        Err(e) => HttpResponse::Conflict().json(json!({"error": e})),
    }
}

async fn frost_accept(state: web::Data<AppStateV2>, body: web::Json<serde_json::Value>) -> impl Responder {
    let aid = body.get("agreementId").and_then(|v| v.as_str()).unwrap_or("");
    let pk = body.get("pubkey").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let amt = body.get("amount_sompi").and_then(|v| v.as_u64()).unwrap_or(0);
    let sig = body.get("signature").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if aid.is_empty() || pk.is_empty() || sig.is_empty() {
        return HttpResponse::BadRequest().json(json!({"error": "Missing required fields"}));
    }
    let pb = FrostParty { pubkey: pk, amount_sompi: amt, signature: sig, confirmed: false, confirm_signature: None, collateral_tx_id: None };
    match state.frost_relay.accept(aid, pb) {
        Ok(()) => HttpResponse::Ok().json(json!({"success": true, "agreementId": aid, "status": "accepted"})),
        Err(e) => HttpResponse::BadRequest().json(json!({"error": e})),
    }
}

async fn frost_confirm(state: web::Data<AppStateV2>, body: web::Json<serde_json::Value>) -> impl Responder {
    let aid = body.get("agreementId").and_then(|v| v.as_str()).unwrap_or("");
    let pk = body.get("pubkey").and_then(|v| v.as_str()).unwrap_or("");
    let sig = body.get("signature").and_then(|v| v.as_str()).unwrap_or("");
    if aid.is_empty() || pk.is_empty() || sig.is_empty() {
        return HttpResponse::BadRequest().json(json!({"error": "Missing required fields"}));
    }
    match state.frost_relay.confirm(aid, pk, sig) {
        Ok(status) => HttpResponse::Ok().json(json!({"success": true, "agreementId": aid, "status": format!("{:?}", status)})),
        Err(e) => HttpResponse::BadRequest().json(json!({"error": e})),
    }
}

async fn frost_get_agreement(state: web::Data<AppStateV2>, path: web::Path<String>) -> impl Responder {
    let aid = path.into_inner();
    match state.frost_relay.get(&aid) {
        Some(a) => {
            let pb_json = a.party_b.as_ref().map(|b| json!({"pubkey": b.pubkey, "amount_sompi": b.amount_sompi, "confirmed": b.confirmed, "collateralTxId": b.collateral_tx_id}));
            HttpResponse::Ok().json(json!({
                "agreementId": a.agreement_id, "status": format!("{:?}", a.status),
                "description": a.description, "network": a.network, "frostAddress": a.frost_address,
                "partyA": {"pubkey": a.party_a.pubkey, "amount_sompi": a.party_a.amount_sompi, "confirmed": a.party_a.confirmed, "collateralTxId": a.party_a.collateral_tx_id},
                "partyB": pb_json, "createdAt": a.created_at, "updatedAt": a.updated_at,
            }))
        }
        None => HttpResponse::NotFound().json(json!({"error": "Agreement not found"})),
    }
}

async fn frost_collateral(state: web::Data<AppStateV2>, body: web::Json<serde_json::Value>) -> impl Responder {
    let aid = body.get("agreementId").and_then(|v| v.as_str()).unwrap_or("");
    let pk = body.get("pubkey").and_then(|v| v.as_str()).unwrap_or("");
    let tx = body.get("txId").and_then(|v| v.as_str()).unwrap_or("");
    let addr = body.get("frostAddress").and_then(|v| v.as_str());
    match state.frost_relay.record_collateral(aid, pk, tx, addr) {
        Ok(status) => HttpResponse::Ok().json(json!({"success": true, "status": format!("{:?}", status)})),
        Err(e) => HttpResponse::BadRequest().json(json!({"error": e})),
    }
}

async fn frost_list_agreements(state: web::Data<AppStateV2>, query: web::Query<HashMap<String, String>>) -> impl Responder {
    let pk = query.get("pubkey").map(|s| s.as_str()).unwrap_or("");
    if pk.is_empty() { return HttpResponse::BadRequest().json(json!({"error": "Missing pubkey"})); }
    let results: Vec<_> = state.frost_relay.list_by_pubkey(pk).iter().map(|a| json!({
        "agreementId": a.agreement_id, "status": format!("{:?}", a.status),
        "description": a.description, "frostAddress": a.frost_address,
        "myRole": if a.party_a.pubkey == pk { "A" } else { "B" },
        "myAmount": if a.party_a.pubkey == pk { a.party_a.amount_sompi } else { a.party_b.as_ref().map_or(0, |b| b.amount_sompi) },
        "createdAt": a.created_at,
    })).collect();
    HttpResponse::Ok().json(json!({"agreements": results}))
}

`;

const marker2 = '// COMPLETE SERVER WITH ALL ROUTES';
const idx2 = code.indexOf(marker2);
if (idx2 > 0) {
    code = code.slice(0, idx2) + handlers + '\n' + code.slice(idx2);
    console.log('OK: Handler functions inserted');
} else {
    console.log('WARN: COMPLETE SERVER marker not found');
}

// ===== PART 4: Add routes to configure_routes =====
code = code.replace(
    '.route("/api/proofs/query", web::post().to(query_proofs));',
    `.route("/api/proofs/query", web::post().to(query_proofs))
        .route("/api/agreement/propose", web::post().to(frost_propose))
        .route("/api/agreement/accept", web::post().to(frost_accept))
        .route("/api/agreement/confirm", web::post().to(frost_confirm))
        .route("/api/agreement/{id}", web::get().to(frost_get_agreement))
        .route("/api/agreement/collateral", web::post().to(frost_collateral))
        .route("/api/agreements", web::get().to(frost_list_agreements));`
);
console.log('OK: Routes added to configure_routes');

fs.writeFileSync('src/main.rs', code);
console.log('Saved. Total lines:', code.split('\n').length);
