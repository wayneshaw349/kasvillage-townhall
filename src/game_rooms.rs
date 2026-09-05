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
    let i = r.log.len() as u64;
    let mut b = body.body.clone();
    if let (Some(n), Some(obj)) = (&body.nonce, b.as_object_mut()) {
        obj.insert("__nonce".into(), json!(n));
    }
    let h = chain_hash(&r.chain, i, &body.wallet, &body.kind, &b);
    r.chain = h.clone();
    r.log.push(LogEntry { i, ts: now(), wallet: body.wallet.clone(), kind: body.kind.clone(), body: b, h: h.clone() });
    HttpResponse::Ok().json(json!({"room": id, "i": i, "h": h, "stored": true, "head": r.log.len(), "chain": r.chain}))
}

#[derive(Deserialize)]
pub struct AfterQ { pub after: Option<u64> }

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
            .route("/room/{id}", web::get().to(room_info)),
    );
}
