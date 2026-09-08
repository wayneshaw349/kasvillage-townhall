// game_rooms.rs — KasCity multiplayer relay (stateless-Flux model)
//
// Each Flux node runs this independently with NO cross-instance sync.
// The client is the replicator: it broadcasts every write to all healthy
// nodes and merges reads by move index. Therefore every endpoint here is
// idempotent and order-tolerant:
//   - moves are keyed by index `i`; a re-posted or out-of-order index is
//     stored at its slot, an already-filled slot is ignored (first write wins)
//   - join is idempotent per wallet
//   - reads return everything >= `since`, sorted by index
//
// Rooms are in-memory only and expire ROOM_TTL_SECS after last touch.
// No rule execution server-side (agreed: not viable stateless); integrity
// comes from the per-move commitment chain exchanged between peers.

use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{BTreeMap, HashMap};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use once_cell::sync::Lazy;
use sha2::{Digest, Sha256};

static ROOMS: Lazy<Mutex<HashMap<String, Room>>> = Lazy::new(|| Mutex::new(HashMap::new()));

const ROOM_TTL_SECS: u64 = 3 * 60 * 60; // 3h — covers a full game + postgame
const DEFAULT_MAX_PLAYERS: usize = 4;
const HARD_MAX_PLAYERS: usize = 8;
const MAX_MOVES: usize = 4096;
const MAX_MOVE_BYTES: usize = 8192;
const MAX_ROOMS: usize = 500;

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

#[derive(Serialize, Clone)]
struct Player {
    wallet: String,
    seat: u8,
    joined_at: u64,
}

#[derive(Serialize)]
struct Room {
    id: String,
    created_at: u64,
    #[serde(skip)]
    touched_at: u64,
    seed_commit: String,
    game: String,
    max_players: usize,
    turn_deadline_secs: Option<u64>,
    players: Vec<Player>,
    started: bool,
    // index -> move record (opaque JSON from the client, hash included)
    #[serde(skip)]
    moves: BTreeMap<u64, serde_json::Value>,
    // ---- v2 ordered log: the relay is the organizer ----
    // Server-assigned dense indices; each entry hash-chains over the previous,
    // so every node's log is a verifiable commitment to its arrival order.
    // (Nodes remain independent: the client picks one node as its orderer for
    // a room, or merges by comparing chains.)
    #[serde(skip)]
    log: Vec<LogEntry>,
    #[serde(skip)]
    chain: String,
    // v52 turn gate
    #[serde(skip)]
    rules: Option<TurnOrderReq>,
    #[serde(skip)]
    last_rr_seat: Option<u8>,
}

#[derive(Serialize, Clone)]
struct LogEntry {
    i: u64,
    ts: u64,
    wallet: String,
    kind: String,               // "move" | "gun" | "beacon" | anything the game defines
    body: serde_json::Value,    // opaque to the relay
    h: String,                  // sha256(prev_h | i | wallet | kind | body) hex
}

fn sweep(map: &mut HashMap<String, Room>) {
    let cutoff = now().saturating_sub(ROOM_TTL_SECS);
    map.retain(|_, r| r.touched_at >= cutoff);
}

fn room_id_ok(id: &str) -> bool {
    !id.is_empty() && id.len() <= 32 && id.chars().all(|c| c.is_ascii_alphanumeric())
}

// ---------- request bodies ----------

#[derive(Deserialize)]
pub struct CreateReq {
    pub room: String,        // client-chosen id (same id posted to all nodes)
    pub wallet: String,      // creator wallet address
    pub seed_commit: String, // sha256 commitment to the game seed
    #[serde(default = "default_game")]
    pub game: String,        // game label, e.g. "kascity", "fighter"
    pub max_players: Option<usize>,       // 1..8, default 4
    pub turn_deadline_secs: Option<u64>,  // echoed only; enforced by clients
}

fn default_game() -> String { "kascity".to_string() }

#[derive(Deserialize)]
pub struct JoinReq {
    pub wallet: String,
}

#[derive(Deserialize)]
pub struct StartReq {
    pub roster: Vec<String>, // ordered wallets; index+1 = seat; same list broadcast to every node
    #[serde(default)]
    pub turn_order: Option<TurnOrderReq>, // v52: optional turn gate config
}

// v52: turn-gate rules -- entirely client-defined so the relay stays game-agnostic.
#[derive(Deserialize, Serialize, Clone)]
pub struct TurnOrderReq {
    pub seats: u8,                 // total seats including bots
    #[serde(default)]
    pub round_robin: Vec<String>,  // actions that rotate seats in order (e.g. ["roll"])
    #[serde(default)]
    pub follow: Vec<String>,       // actions allowed only from the last round-robin seat (e.g. ["buy","pass"])
    #[serde(default)]
    pub exempt: Vec<String>,       // actions never gated (e.g. ["first"])
    #[serde(default)]
    pub seed: Vec<String>,         // v53: actions that declare the opener (e.g. ["opener"])
    #[serde(default)]
    pub derive_opener_from: Option<String>, // v54: derive the opener from these entries (e.g. "first")
    #[serde(default)]
    pub dice: Vec<String>,         // v55: actions whose dice the relay derives from the seed (e.g. ["roll"])
}

#[derive(Deserialize)]
pub struct MoveReq {
    pub wallet: String,
    #[serde(rename = "move")]
    pub mv: serde_json::Value, // {i,s,a,v,t,hash} — opaque here, verified by peers
}

#[derive(Deserialize)]
pub struct SinceQ {
    pub since: Option<u64>,
}

// ---------- handlers ----------

async fn create_room(body: web::Json<CreateReq>) -> HttpResponse {
    if !room_id_ok(&body.room) {
        return HttpResponse::BadRequest().json(json!({"error":"bad room id"}));
    }
    let mut map = ROOMS.lock().unwrap();
    sweep(&mut map);
    if map.len() >= MAX_ROOMS && !map.contains_key(&body.room) {
        return HttpResponse::ServiceUnavailable().json(json!({"error":"room capacity"}));
    }
    let maxp = body.max_players.unwrap_or(DEFAULT_MAX_PLAYERS);
    if maxp < 1 || maxp > HARD_MAX_PLAYERS {
        return HttpResponse::BadRequest().json(json!({"error":"max_players must be 1..8"}));
    }
    if body.game.is_empty() || body.game.len() > 32 || !body.game.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return HttpResponse::BadRequest().json(json!({"error":"bad game label"}));
    }
    // idempotent: re-create of an existing room with same seed_commit + game = ok (broadcast retry)
    if let Some(r) = map.get(&body.room) {
        if r.seed_commit == body.seed_commit && r.game == body.game {
            return HttpResponse::Ok().json(json!({"room": body.room, "game": r.game, "existed": true}));
        }
        return HttpResponse::Conflict().json(json!({"error":"room exists with different seed or game"}));
    }
    let t = now();
    map.insert(body.room.clone(), Room {
        id: body.room.clone(),
        created_at: t,
        touched_at: t,
        seed_commit: body.seed_commit.clone(),
        game: body.game.clone(),
        max_players: maxp,
        turn_deadline_secs: body.turn_deadline_secs,
        players: vec![Player { wallet: body.wallet.clone(), seat: 1, joined_at: t }],
        started: false,
        moves: BTreeMap::new(),
        log: Vec::new(),
        chain: String::from("genesis"),
        rules: None,
        last_rr_seat: None,
    });
    HttpResponse::Ok().json(json!({"room": body.room, "seat": 1}))
}

async fn join_room(path: web::Path<String>, body: web::Json<JoinReq>) -> HttpResponse {
    let id = path.into_inner();
    let mut map = ROOMS.lock().unwrap();
    let Some(r) = map.get_mut(&id) else {
        return HttpResponse::NotFound().json(json!({"error":"no such room"}));
    };
    r.touched_at = now();
    // idempotent join
    if let Some(p) = r.players.iter().find(|p| p.wallet == body.wallet) {
        return HttpResponse::Ok().json(json!({"room": id, "seat": p.seat, "rejoined": true}));
    }
    if r.started {
        return HttpResponse::Conflict().json(json!({"error":"game already started"}));
    }
    if r.players.len() >= r.max_players {
        return HttpResponse::Conflict().json(json!({"error":"room full"}));
    }
    let seat = (r.players.len() + 1) as u8;
    r.players.push(Player { wallet: body.wallet.clone(), seat, joined_at: now() });
    HttpResponse::Ok().json(json!({"room": id, "seat": seat}))
}

async fn start_room(path: web::Path<String>, body: web::Json<StartReq>) -> HttpResponse {
    let id = path.into_inner();
    if body.roster.is_empty() {
        return HttpResponse::BadRequest().json(json!({"error":"roster must not be empty"}));
    }
    let mut map = ROOMS.lock().unwrap();
    let Some(r) = map.get_mut(&id) else {
        return HttpResponse::NotFound().json(json!({"error":"no such room"}));
    };
    r.touched_at = now();
    if body.roster.len() > r.max_players {
        return HttpResponse::BadRequest().json(json!({"error":"roster exceeds room max_players"}));
    }
    let incoming: Vec<String> = body.roster.clone();
    if r.started {
        let current: Vec<String> = r.players.iter().map(|p| p.wallet.clone()).collect();
        if current == incoming {
            return HttpResponse::Ok().json(json!({"room": id, "started": true, "players": r.players}));
        }
        return HttpResponse::Conflict().json(json!({"error":"started with different roster"}));
    }
    let t = now();
    r.players = incoming.iter().enumerate().map(|(i, w)| Player {
        wallet: w.clone(),
        seat: (i + 1) as u8,
        joined_at: t,
    }).collect();
    r.started = true;
    if let Some(t) = body.turn_order.clone() {
        if t.seats >= 1 && t.seats <= 8 { r.rules = Some(t); }
    }
    HttpResponse::Ok().json(json!({"room": id, "started": true, "players": r.players}))
}

async fn post_move(path: web::Path<String>, body: web::Json<MoveReq>) -> HttpResponse {
    let id = path.into_inner();
    let raw = body.mv.to_string();
    if raw.len() > MAX_MOVE_BYTES {
        return HttpResponse::PayloadTooLarge().json(json!({"error":"move too large"}));
    }
    let Some(idx) = body.mv.get("i").and_then(|v| v.as_u64()) else {
        return HttpResponse::BadRequest().json(json!({"error":"move missing index i"}));
    };
    let mut map = ROOMS.lock().unwrap();
    let Some(r) = map.get_mut(&id) else {
        return HttpResponse::NotFound().json(json!({"error":"no such room"}));
    };
    r.touched_at = now();
    if !r.players.iter().any(|p| p.wallet == body.wallet) {
        return HttpResponse::Forbidden().json(json!({"error":"wallet not in room"}));
    }
    if r.moves.len() >= MAX_MOVES && !r.moves.contains_key(&idx) {
        return HttpResponse::PayloadTooLarge().json(json!({"error":"move capacity"}));
    }
    // first write wins per index — broadcast retries and peer echoes are no-ops
    let stored = if r.moves.contains_key(&idx) {
        false
    } else {
        r.moves.insert(idx, body.mv.clone());
        true
    };
    HttpResponse::Ok().json(json!({"room": id, "i": idx, "stored": stored, "count": r.moves.len()}))
}

async fn get_moves(path: web::Path<String>, q: web::Query<SinceQ>) -> HttpResponse {
    let id = path.into_inner();
    let since = q.since.unwrap_or(0);
    let mut map = ROOMS.lock().unwrap();
    let Some(r) = map.get_mut(&id) else {
        return HttpResponse::NotFound().json(json!({"error":"no such room"}));
    };
    r.touched_at = now();
    let moves: Vec<&serde_json::Value> = r.moves.range(since..).map(|(_, v)| v).collect();
    HttpResponse::Ok().json(json!({
        "room": id,
        "since": since,
        "count": moves.len(),
        "total": r.moves.len(),
        "moves": moves
    }))
}

async fn room_info(path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let mut map = ROOMS.lock().unwrap();
    let Some(r) = map.get_mut(&id) else {
        return HttpResponse::NotFound().json(json!({"error":"no such room"}));
    };
    r.touched_at = now();
    HttpResponse::Ok().json(json!({
        "room": r.id,
        "game": r.game,
        "created_at": r.created_at,
        "seed_commit": r.seed_commit,
        "max_players": r.max_players,
        "turn_deadline_secs": r.turn_deadline_secs,
        "players": r.players,
        "started": r.started,
        "move_count": r.moves.len()
    }))
}

// ---------- v2: server-ordered, hash-chained log (generic for any game) ----------

#[derive(Deserialize)]
pub struct AppendReq {
    pub wallet: String,
    #[serde(default = "default_kind")]
    pub kind: String,
    pub body: serde_json::Value,   // opaque game payload (a move, a gun, a beacon, ...)
    // optional client idempotency key: same (wallet,kind,nonce) appended twice
    // returns the original entry instead of a duplicate
    pub nonce: Option<String>,
}

fn default_kind() -> String { "move".to_string() }

fn chain_hash(prev: &str, i: u64, wallet: &str, kind: &str, body: &serde_json::Value) -> String {
    let mut hz = Sha256::new();
    hz.update(prev.as_bytes());
    hz.update(i.to_le_bytes());
    hz.update(wallet.as_bytes());
    hz.update(kind.as_bytes());
    hz.update(body.to_string().as_bytes());
    hex::encode(hz.finalize())
}

// v55: deterministic 2d6 from the room seed commitment and the entry index.
// Pure function of public inputs: any node or client derives identical dice.
fn derive_dice(seed: &str, i: u64) -> (u8, u8) {
    let mut hz = Sha256::new();
    hz.update(seed.as_bytes());
    hz.update(b"dice");
    hz.update(i.to_le_bytes());
    let d = hz.finalize();
    (1 + (d[0] % 6), 1 + (d[1] % 6))
}

// v54: replay the opener contest from the chain itself.
// Rounds of one value per active seat (arrival order); keep the max-value seats;
// repeat until a single seat remains. Incomplete round -> None.
fn derive_opener(log: &Vec<LogEntry>, first_action: &str, seats: u8) -> Option<u8> {
    let mut seq: Vec<(u8, i64)> = Vec::new();
    for e in log {
        if e.kind != "move" { continue; }
        let a = e.body.get("a").and_then(|v| v.as_str()).unwrap_or("");
        if a != first_action { continue; }
        let sv = e.body.get("s").and_then(|v| v.as_u64()).unwrap_or(0) as u8;
        let vv = e.body.get("v").and_then(|v| v.as_i64()).unwrap_or(0);
        if sv >= 1 && sv <= seats { seq.push((sv, vv)); }
    }
    let mut active: Vec<u8> = (1..=seats).collect();
    let mut idx = 0usize;
    loop {
        if active.len() == 1 { return Some(active[0]); }
        let mut vals: HashMap<u8, i64> = HashMap::new();
        while idx < seq.len() && vals.len() < active.len() {
            let (sv, vv) = seq[idx];
            idx += 1;
            if active.contains(&sv) && !vals.contains_key(&sv) { vals.insert(sv, vv); }
        }
        if vals.len() < active.len() { return None; }
        let m = *vals.values().max()?;
        active.retain(|sv| vals.get(sv) == Some(&m));
        if active.is_empty() { return None; }
    }
}

async fn append_log(path: web::Path<String>, body: web::Json<AppendReq>) -> HttpResponse {
    let id = path.into_inner();
    if body.kind.is_empty() || body.kind.len() > 24
        || !body.kind.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return HttpResponse::BadRequest().json(json!({"error":"bad kind"}));
    }
    let raw = body.body.to_string();
    if raw.len() > MAX_MOVE_BYTES {
        return HttpResponse::PayloadTooLarge().json(json!({"error":"entry too large"}));
    }
    let mut map = ROOMS.lock().unwrap();
    let Some(r) = map.get_mut(&id) else {
        return HttpResponse::NotFound().json(json!({"error":"no such room"}));
    };
    r.touched_at = now();
    if !r.players.iter().any(|p| p.wallet == body.wallet) {
        return HttpResponse::Forbidden().json(json!({"error":"wallet not in room"}));
    }
    if r.log.len() >= MAX_MOVES {
        return HttpResponse::PayloadTooLarge().json(json!({"error":"log capacity"}));
    }
    // idempotency: nonce replay returns the already-stored entry
    if let Some(n) = &body.nonce {
        let key = format!("{}|{}|{}", body.wallet, body.kind, n);
        if let Some(e) = r.log.iter().find(|e|
            e.body.get("__nonce").and_then(|v| v.as_str())
                .map(|s| format!("{}|{}|{}", e.wallet, e.kind, s) == key)
                .unwrap_or(false)) {
            return HttpResponse::Ok().json(json!({"room": id, "i": e.i, "h": e.h, "stored": false, "head": r.log.len(), "chain": r.chain}));
        }
    }
    // ---- v52 turn gate (only when the game configured one at /start) ----
    if body.kind == "move" {
        if let Some(rules) = r.rules.clone() {
            let a = body.body.get("a").and_then(|v| v.as_str()).unwrap_or("");
            let sv = body.body.get("s").and_then(|v| v.as_u64()).unwrap_or(0) as u8;
            let exempt = rules.exempt.iter().any(|x| x == a);
            if rules.seed.iter().any(|x| x == a) {
                // v53: a seed action declares the opener -- its seat becomes expected-next
                // v54: when the chain can derive the opener, the declaration must match it
                if let Some(fa) = rules.derive_opener_from.as_deref() {
                    if let Some(open) = derive_opener(&r.log, fa, rules.seats) {
                        if sv != open {
                            return HttpResponse::Ok().json(json!({
                                "room": id, "stored": false, "reason": "opener_mismatch",
                                "expect": open, "head": r.log.len(), "chain": r.chain
                            }));
                        }
                    }
                }
                let n = rules.seats.max(2) as u16;
                let v16 = sv as u16;
                r.last_rr_seat = Some((((v16 + n - 2) % n) + 1) as u8);
            } else if !exempt && rules.round_robin.iter().any(|x| x == a) {
                // v54: no rotation state yet -> the chain's derived opener goes first
                if r.last_rr_seat.is_none() {
                    if let Some(fa) = rules.derive_opener_from.as_deref() {
                        if let Some(open) = derive_opener(&r.log, fa, rules.seats) {
                            if sv != open {
                                return HttpResponse::Ok().json(json!({
                                    "room": id, "stored": false, "reason": "not_the_opener",
                                    "expect": open, "head": r.log.len(), "chain": r.chain
                                }));
                            }
                        }
                    }
                }
                if let Some(last) = r.last_rr_seat {
                    let expect = (last % rules.seats) + 1;
                    if sv != expect {
                        return HttpResponse::Ok().json(json!({
                            "room": id, "stored": false, "reason": "not_your_turn",
                            "expect": expect, "head": r.log.len(), "chain": r.chain
                        }));
                    }
                }
                r.last_rr_seat = Some(sv);
            } else if !exempt && rules.follow.iter().any(|x| x == a) {
                match r.last_rr_seat {
                    Some(last) if last == sv => {}
                    _ => {
                        return HttpResponse::Ok().json(json!({
                            "room": id, "stored": false, "reason": "not_the_roller",
                            "expect": r.last_rr_seat, "head": r.log.len(), "chain": r.chain
                        }));
                    }
                }
            }
        }
    }
    // ---- v55b: fx sanity cap — a single move cannot mint or burn beyond the cap ----
    if body.kind == "move" {
        if let Some(fx) = body.body.get("fx") {
            if let Some(cash) = fx.get("cash").and_then(|c| c.as_object()) {
                let total: i64 = cash.values().filter_map(|v| v.as_i64()).map(|v| v.abs()).sum();
                if total > 5000 {
                    return HttpResponse::Ok().json(json!({
                        "room": id, "stored": false, "reason": "fx_cap",
                        "head": r.log.len(), "chain": r.chain
                    }));
                }
            }
        }
    }
    let i = r.log.len() as u64;
    // ---- v55: relay-derived dice are authoritative for configured actions ----
    let mut dice_out: Option<(u8, u8)> = None;
    if body.kind == "move" {
        if let Some(rules) = &r.rules {
            let a = body.body.get("a").and_then(|v| v.as_str()).unwrap_or("");
            if rules.dice.iter().any(|x| x == a) {
                dice_out = Some(derive_dice(&r.seed_commit, i));
            }
        }
    }
    // ---- v56: transition validation against the previous chain snap (mover-scoped) ----
    if body.kind == "move" && r.rules.is_some() {
        let a = body.body.get("a").and_then(|v| v.as_str()).unwrap_or("");
        let sv = body.body.get("s").and_then(|v| v.as_u64()).unwrap_or(0) as u8;
        if let Some(next_snap) = body.body.get("snap").and_then(|v| v.as_str()) {
            if !next_snap.is_empty() {
                if let Some(prev_snap) = last_chain_snap(&r.log) {
                    if let Some(why) = check_transition(&prev_snap, next_snap, a, sv, dice_out) {
                        return HttpResponse::Ok().json(json!({
                            "room": id, "stored": false, "reason": "bad_transition", "detail": why,
                            "head": r.log.len(), "chain": r.chain
                        }));
                    }
                }
            }
        }
    }
    let mut b = body.body.clone();
    if let (Some((d1, d2)), Some(obj)) = (dice_out, b.as_object_mut()) {
        obj.insert("d1".into(), json!(d1));
        obj.insert("d2".into(), json!(d2));
        obj.insert("v".into(), json!((d1 as i64) + (d2 as i64)));
    }
    if let (Some(n), Some(obj)) = (&body.nonce, b.as_object_mut()) {
        obj.insert("__nonce".into(), json!(n));
    }
    let h = chain_hash(&r.chain, i, &body.wallet, &body.kind, &b);
    r.chain = h.clone();
    r.log.push(LogEntry { i, ts: now(), wallet: body.wallet.clone(), kind: body.kind.clone(), body: b, h: h.clone() });
    let mut resp = json!({"room": id, "i": i, "h": h, "stored": true, "head": r.log.len(), "chain": r.chain});
    if let (Some((d1, d2)), Some(obj)) = (dice_out, resp.as_object_mut()) {
        obj.insert("d1".into(), json!(d1));
        obj.insert("d2".into(), json!(d2));
        obj.insert("v".into(), json!((d1 as i64) + (d2 as i64)));
    }
    HttpResponse::Ok().json(resp)
}

#[derive(Deserialize)]
pub struct AfterQ { pub after: Option<u64> }

#[derive(Deserialize)]
pub struct DiceQ { pub i: Option<u64> }

// v56: parse a client snapshot "cash|pos|owners|xp" into comparable state.
fn parse_snap(snap: &str) -> Option<(Vec<i64>, Vec<i64>, std::collections::BTreeMap<String, u8>, Vec<i64>)> {
    let parts: Vec<&str> = snap.split('|').collect();
    if parts.len() < 3 { return None; }
    let cash: Vec<i64> = parts[0].split(',').filter_map(|x| x.trim().parse().ok()).collect();
    let pos: Vec<i64> = parts[1].split(',').filter_map(|x| x.trim().parse().ok()).collect();
    if cash.len() < 4 || pos.len() < 4 { return None; }
    let mut own = std::collections::BTreeMap::new();
    if !parts[2].is_empty() {
        for e in parts[2].split(',') {
            let kv: Vec<&str> = e.split('>').collect();
            if kv.len() == 2 { if let Ok(o) = kv[1].parse::<u8>() { own.insert(kv[0].to_string(), o); } }
        }
    }
    let xp: Vec<i64> = if parts.len() > 3 {
        parts[3].split(',').filter_map(|x| x.trim().parse().ok()).collect()
    } else { Vec::new() };
    Some((cash, pos, own, xp))
}

// v56: last snap on the chain, scanning backwards.
fn last_chain_snap(log: &Vec<LogEntry>) -> Option<String> {
    for e in log.iter().rev() {
        if e.kind != "move" { continue; }
        if let Some(sn) = e.body.get("snap").and_then(|v| v.as_str()) {
            if !sn.is_empty() { return Some(sn.to_string()); }
        }
    }
    None
}

// v56: mover-scoped, table-free transition invariants. Some(reason) on violation.
fn check_transition(prev: &str, next: &str, a: &str, sv: u8, dice: Option<(u8, u8)>) -> Option<&'static str> {
    let (pc, pp, po, px) = match parse_snap(prev) { Some(x) => x, None => return None };
    let (nc, np, no, nx) = match parse_snap(next) { Some(x) => x, None => return Some("snap_unparseable") };
    if a == "roll" && sv >= 1 && sv <= 4 {
        let p = (sv - 1) as usize;
        let (from, to) = (pp[p], np[p]);
        if from >= 0 && to >= 0 {
            if let Some((d1, d2)) = dice {
                let expect = (from + (d1 as i64) + (d2 as i64)).rem_euclid(40);
                // v56b: advisory only — dice-index drift makes this unsafe to enforce
                let _ = (to, expect, from);
            }
        }
    }
    if po != no {
        let ok = a == "buy" || a == "p2pbuy" || a.starts_with("accept:") || a.starts_with("lapse:") || a.starts_with("mgmt:") || a.starts_with("cash:");
        if !ok { return Some("deed_change_off_action"); }
    }
    let mut delta: i64 = 0;
    for p in 0..4usize { delta += (nc[p] - pc[p]).abs(); }
    if delta > 1500 { return Some("cash_delta_cap"); }
    if !px.is_empty() && !nx.is_empty() && px.len() >= 4 && nx.len() >= 4 {
        for p in 0..4usize {
            if nx[p] < px[p] { return Some("xp_decrease"); }
            if nx[p] - px[p] > 100 { return Some("xp_jump"); }
        }
    }
    None
}

// v56: the relay answers whose turn it is, directly.
async fn get_turn(path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let mut map = ROOMS.lock().unwrap();
    let Some(r) = map.get_mut(&id) else {
        return HttpResponse::NotFound().json(json!({"error":"no such room"}));
    };
    r.touched_at = now();
    let seats = r.rules.as_ref().map(|t| t.seats).unwrap_or(4).max(1);
    let expect: Option<u8> = r.last_rr_seat.map(|last| (last % seats) + 1);
    HttpResponse::Ok().json(json!({
        "room": id,
        "expect_roller": expect,
        "last_rr_seat": r.last_rr_seat,
        "head": r.log.len(),
        "chain": r.chain
    }))
}

#[derive(Deserialize)]
pub struct DeriveQ { pub tag: Option<String>, pub i: Option<u64> }

// v55b: generic RNG oracle — H(seed | tag | i). Pure function of public inputs,
// so every node and every client derives identical bytes. Game-agnostic: clients
// decide what a tag means (market index, scenario pick, offer amount, ...).
async fn get_derive(path: web::Path<String>, q: web::Query<DeriveQ>) -> HttpResponse {
    let id = path.into_inner();
    let tag = q.tag.clone().unwrap_or_else(|| "misc".to_string());
    if tag.is_empty() || tag.len() > 24 || !tag.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return HttpResponse::BadRequest().json(json!({"error":"bad tag"}));
    }
    let mut map = ROOMS.lock().unwrap();
    let Some(r) = map.get_mut(&id) else {
        return HttpResponse::NotFound().json(json!({"error":"no such room"}));
    };
    r.touched_at = now();
    let i = q.i.unwrap_or(r.log.len() as u64);
    let mut hz = Sha256::new();
    hz.update(r.seed_commit.as_bytes());
    hz.update(tag.as_bytes());
    hz.update(i.to_le_bytes());
    let d = hz.finalize();
    let u32s: Vec<u32> = d.chunks(4).take(8)
        .map(|c| u32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect();
    HttpResponse::Ok().json(json!({"room": id, "tag": tag, "i": i, "hex": hex::encode(d), "u32s": u32s, "head": r.log.len()}))
}

// v55: expose the derivation so clients can pre-pin their own rolls.
async fn get_dice(path: web::Path<String>, q: web::Query<DiceQ>) -> HttpResponse {
    let id = path.into_inner();
    let mut map = ROOMS.lock().unwrap();
    let Some(r) = map.get_mut(&id) else {
        return HttpResponse::NotFound().json(json!({"error":"no such room"}));
    };
    r.touched_at = now();
    let i = q.i.unwrap_or(r.log.len() as u64);
    let (d1, d2) = derive_dice(&r.seed_commit, i);
    HttpResponse::Ok().json(json!({"room": id, "i": i, "d1": d1, "d2": d2, "v": (d1 as i64)+(d2 as i64), "head": r.log.len()}))
}

async fn get_log(path: web::Path<String>, q: web::Query<AfterQ>) -> HttpResponse {
    let id = path.into_inner();
    let after = q.after.unwrap_or(0) as usize;
    let mut map = ROOMS.lock().unwrap();
    let Some(r) = map.get_mut(&id) else {
        return HttpResponse::NotFound().json(json!({"error":"no such room"}));
    };
    r.touched_at = now();
    let entries: Vec<&LogEntry> = r.log.iter().skip(after).collect();
    HttpResponse::Ok().json(json!({
        "room": id,
        "after": after,
        "head": r.log.len(),
        "chain": r.chain,
        "seed_commit": r.seed_commit,
        "started": r.started,
        "entries": entries
    }))
}

// ---------- wiring ----------

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/game")
            .route("/room/create", web::post().to(create_room))
            .route("/room/{id}/join", web::post().to(join_room))
            .route("/room/{id}/start", web::post().to(start_room))
            .route("/room/{id}/move", web::post().to(post_move))
            .route("/room/{id}/moves", web::get().to(get_moves))
            .route("/room/{id}/append", web::post().to(append_log))   // v2: relay-assigned order
            .route("/room/{id}/log", web::get().to(get_log))          // v2: dense, hash-chained
            .route("/room/{id}/dice", web::get().to(get_dice))        // v55: derived dice
            .route("/room/{id}/derive", web::get().to(get_derive))    // v55b: generic RNG oracle
            .route("/room/{id}/turn", web::get().to(get_turn))        // v56: whose turn
            .route("/room/{id}", web::get().to(room_info)),
    );
}
