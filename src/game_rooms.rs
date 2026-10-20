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
// Rooms are in-memory only and expire ROOM_TTL_SECS after the last WRITE
// (reads never extend a room's life), and unconditionally ROOM_MAX_AGE_SECS
// after creation. Expired rooms are swept on every write.
// No rule execution server-side (agreed: not viable stateless); integrity
// comes from the per-move commitment chain exchanged between peers.
//
// ---- v57: THE LOG IS THE GATE ----
// Two fixes for the split-brain games (rooms kc219edd64, kc0c51ce65):
// (1) The turn gate no longer keeps a mutable counter (last_rr_seat).
//     That counter advanced only on entries THIS node stored, so one
//     refused or missed entry desynced it from this node's own log
//     forever ("not_your_turn (expects P4)" while the log showed P3).
//     v57 derives the rotation state from the stored log on every
//     request — the gate can never contradict its own chain.
// (2) Content dedup: clients re-post records after resyncs with no
//     nonce. Follow actions (buy/pass) passed the gate twice and
//     appended twice, inflating heads and cascading dice-index drift.
//     v57 refuses an append whose (wallet, kind, body.hash) already
//     sits in the recent log — reason "duplicate", returning the
//     original entry's i and h.
//
// ---- v58: WALLET-BOUND SEATS (opt-in, backward compatible) ----
// The chain game is immutable and cannot sign. The wallet bridge
// (kv_net_bridge.ts) adds, for relay hosts only:
//   X-KV-Pub  33-byte compressed secp256k1 pubkey (hex)
//   X-KV-Ts   unix seconds
//   X-KV-Sig  BIP340 Schnorr sig (hex) over
//             sha256("KV_RELAY_V1\n" + METHOD + "\n" + pathAndQuery + "\n"
//                    + sha256hex(body) + "\n" + floor(ts/60))
// A wallet W becomes BOUND in a room (to that x-only key) when a validly
// signed write acts as W and either W is the Kaspa P2PK address of the key,
// or the signed request is the one that first adds W to the room (create /
// join; covers the game's random "kcw…" ids). Every later write as a bound
// wallet must carry a valid signature from the same key, else 403.
// Unsigned requests for never-bound wallets behave as before.
// Seats: a move for seat s must come from the roster owner of seat s
// (bot seats beyond the roster are open to any member; the room creator may
// replay unbound owners' moves — that is the client's orderer re-seed path).
//
// ---- v59 (KV_RELAY_V2 + start/opener/gun fixes) ----
// * Signatures are V2 only: the signed text is
//     "KV_RELAY_V2\n" + host + "\n" + METHOD + "\n" + pathAndQuery + "\n"
//     + sha256hex(body) + "\n" + floor(ts/60)
//   where host is the URL authority the wallet sent to (URL.host). The relay
//   accepts the host it is configured as (env KV_RELAY_HOSTS, comma list) or,
//   when that is unset, the Host / X-Forwarded-Host it sees. A request signed
//   for node A therefore no longer verifies on a node configured as B.
// * /start is no longer creator-only (a guest's re-seed can make the guest the
//   creator on a node the host's create missed). See start_authorized().
// * Opener declarations are refused while the roll-off is incomplete
//   ("rolloff_incomplete") so an early/wrong declaration can never lock in.
// * gun/seed entries: creator or starter only, after start, before the first move.
// * A move carrying a snapshot must come from that seat's owner (bot seats:
//   the creator or starter, i.e. the host that drives the bots).

use actix_web::{web, HttpRequest, HttpResponse};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};
use once_cell::sync::Lazy;
use sha2::{Digest, Sha256};

static ROOMS: Lazy<Mutex<HashMap<String, Room>>> = Lazy::new(|| Mutex::new(HashMap::new()));

const ROOM_TTL_SECS: u64 = 3 * 60 * 60; // 3h idle (since last write) — covers a full game + postgame
const ROOM_MAX_AGE_SECS: u64 = 6 * 60 * 60; // hard cap since creation, regardless of activity
const DEFAULT_MAX_PLAYERS: usize = 4;
const HARD_MAX_PLAYERS: usize = 8;
const MAX_MOVES: usize = 4096;
const MAX_MOVE_BYTES: usize = 8192;
const MAX_ROOMS: usize = 500;
const DEDUP_WINDOW: usize = 64; // v57: how far back an identical record is a replay
const MAX_WALLET_LEN: usize = 100;
const MAX_SEED_COMMIT_LEN: usize = 128;
const MAX_NONCE_LEN: usize = 64;
const MAX_RULE_LIST: usize = 16;
const MAX_ROOM_BYTES: usize = 4 * 1024 * 1024; // per-room stored payload budget
const MAX_TOTAL_BYTES: usize = 256 * 1024 * 1024; // all rooms on this node
const MAX_BODY_BYTES: usize = 128 * 1024; // request body cap for this scope
const SIG_MAX_SKEW_SECS: u64 = 300;
const ENTRY_OVERHEAD: usize = 160;

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

/// Never panic on a poisoned lock: the map holds plain data, so the inner
/// value is still usable after a panic elsewhere.
fn rooms() -> MutexGuard<'static, HashMap<String, Room>> {
    ROOMS.lock().unwrap_or_else(|e| e.into_inner())
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
    moves: BTreeMap<u64, Arc<serde_json::Value>>,
    // ---- v2 ordered log: the relay is the organizer ----
    // Server-assigned dense indices; each entry hash-chains over the previous,
    // so every node's log is a verifiable commitment to its arrival order.
    // (Nodes remain independent: the client picks one node as its orderer for
    // a room, or merges by comparing chains.)
    #[serde(skip)]
    log: Vec<Arc<LogEntry>>,
    #[serde(skip)]
    chain: String,
    // v52 turn gate rules (v57: rotation STATE is derived from the log, never stored)
    #[serde(skip)]
    rules: Option<TurnOrderReq>,
    // v58: wallet that created the room on this node (the only one allowed to /start)
    #[serde(skip)]
    creator: String,
    // v59: wallet credited with the accepted /start (gun authority)
    #[serde(skip)]
    starter: String,
    // v58: wallet -> x-only pubkey hex it is bound to
    #[serde(skip)]
    bound: HashMap<String, String>,
    // v58: approximate stored payload bytes (moves + log)
    #[serde(skip)]
    bytes: usize,
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

fn expired(r: &Room, t: u64) -> bool {
    r.touched_at < t.saturating_sub(ROOM_TTL_SECS)
        || r.created_at.saturating_add(ROOM_MAX_AGE_SECS) < t
}

fn sweep(map: &mut HashMap<String, Room>) {
    let t = now();
    map.retain(|_, r| !expired(r, t));
}

fn total_bytes(map: &HashMap<String, Room>) -> usize {
    map.values().fold(0usize, |a, r| a.saturating_add(r.bytes))
}

fn room_id_ok(id: &str) -> bool {
    !id.is_empty() && id.len() <= 32 && id.chars().all(|c| c.is_ascii_alphanumeric())
}

fn wallet_ok(w: &str) -> bool {
    !w.is_empty() && w.len() <= MAX_WALLET_LEN
        && w.chars().all(|c| c.is_ascii_alphanumeric() || c == ':' || c == '_' || c == '-' || c == '.')
}

fn label_ok(s: &str) -> bool {
    !s.is_empty() && s.len() <= 32
        && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == ':')
}

fn bad(msg: &str) -> HttpResponse {
    HttpResponse::BadRequest().json(json!({"error": msg}))
}

fn deny(msg: &str) -> HttpResponse {
    HttpResponse::Forbidden().json(json!({"error": msg}))
}

fn not_found() -> HttpResponse {
    HttpResponse::NotFound().json(json!({"error":"no such room"}))
}

fn parse_body<T: DeserializeOwned>(raw: &[u8]) -> Result<T, HttpResponse> {
    serde_json::from_slice::<T>(raw).map_err(|e| bad(&format!("bad json: {}", e)))
}

// ---------- v58: request signatures + Kaspa address derivation ----------

#[derive(Clone)]
struct Auth {
    xonly: [u8; 32],
    comp: [u8; 33],
}

impl Auth {
    fn key_hex(&self) -> String { hex::encode(self.xonly) }
}

fn header<'a>(req: &'a HttpRequest, k: &str) -> Option<&'a str> {
    req.headers().get(k)?.to_str().ok()
}

/// Domain-separated digest the wallet bridge signs. The "KV_RELAY_V1" text
/// prefix + sha256 can never equal a Kaspa tx sighash (blake2b, keyed
/// "TransactionSigningHash") or a Kaspa personal-message hash.
/// v59: V2 binds the target host, so a signature captured on one node cannot be
/// replayed to another. V1 is no longer accepted (bridge + relay ship together).
fn relay_msg_digest(host: &str, method: &str, path_and_query: &str, body: &[u8], ts: u64) -> [u8; 32] {
    let bh = hex::encode(Sha256::digest(body));
    let s = format!("KV_RELAY_V2\n{}\n{}\n{}\n{}\n{}", host, method, path_and_query, bh, ts / 60);
    Sha256::digest(s.as_bytes()).into()
}

/// Host names this node accepts in a V2 signature. KV_RELAY_HOSTS (comma list,
/// e.g. "1.2.3.4:35816,kasvillage.app.runonflux.io") pins them; otherwise the
/// Host / X-Forwarded-Host / URI authority of the request itself.
fn sig_hosts(req: &HttpRequest) -> Vec<String> {
    let norm = |s: &str| s.trim().trim_end_matches('.').to_ascii_lowercase();
    if let Ok(v) = std::env::var("KV_RELAY_HOSTS") {
        let l: Vec<String> = v.split(',').map(norm).filter(|s| !s.is_empty()).collect();
        if !l.is_empty() { return l; }
    }
    let mut out: Vec<String> = Vec::new();
    let mut add = |s: &str| { let n = norm(s); if !n.is_empty() && n.len() <= 255 && !out.contains(&n) { out.push(n); } };
    if let Some(h) = header(req, "host") { add(h); }
    if let Some(h) = header(req, "x-forwarded-host") { if let Some(f) = h.split(',').next() { add(f); } }
    if let Some(a) = req.uri().authority() { add(a.as_str()); }
    out.truncate(3);
    out
}

fn verify_sig(pub_hex: &str, sig_hex: &str, ts: u64, host: &str, method: &str, pq: &str, body: &[u8], t_now: u64) -> Option<Auth> {
    if ts.abs_diff(t_now) > SIG_MAX_SKEW_SECS { return None; }
    let pb = hex::decode(pub_hex.trim()).ok()?;
    if pb.len() != 33 || (pb[0] != 2 && pb[0] != 3) { return None; }
    let pk = secp256k1::PublicKey::from_slice(&pb).ok()?;
    let (xonly, _parity) = pk.x_only_public_key();
    let sb = hex::decode(sig_hex.trim()).ok()?;
    let sig = secp256k1::schnorr::Signature::from_slice(&sb).ok()?;
    let msg = secp256k1::Message::from_digest(relay_msg_digest(host, method, pq, body, ts));
    secp256k1::SECP256K1.verify_schnorr(&sig, &msg, &xonly).ok()?;
    let comp: [u8; 33] = pb.as_slice().try_into().ok()?;
    Some(Auth { xonly: xonly.serialize(), comp })
}

/// None = unsigned OR invalid signature (both are treated as unauthenticated;
/// an unauthenticated request can still act for never-bound wallets).
fn verify_auth(req: &HttpRequest, body: &[u8]) -> Option<Auth> {
    let pub_hex = header(req, "x-kv-pub")?;
    let sig_hex = header(req, "x-kv-sig")?;
    let ts: u64 = header(req, "x-kv-ts")?.trim().parse().ok()?;
    let pq = req.uri().path_and_query().map(|p| p.as_str()).unwrap_or_else(|| req.path());
    let t = now();
    let a = sig_hosts(req).iter()
        .find_map(|h| verify_sig(pub_hex, sig_hex, ts, h, req.method().as_str(), pq, body, t));
    if a.is_none() { log::warn!("[game_rooms] invalid relay signature on {} {}", req.method(), req.path()); }
    a
}

const ADDR_CHARSET: &[u8; 32] = b"qpzry9x8gf2tvdw0s3jn54khce6mua7l";

fn addr_polymod(values: &[u8]) -> u64 {
    let mut c: u64 = 1;
    for &d in values {
        let c0 = c >> 35;
        c = ((c & 0x07_ffff_ffff) << 5) ^ (d as u64);
        if c0 & 0x01 != 0 { c ^= 0x98f2bc8e61; }
        if c0 & 0x02 != 0 { c ^= 0x79b76d99e2; }
        if c0 & 0x04 != 0 { c ^= 0xf33e5fb3c4; }
        if c0 & 0x08 != 0 { c ^= 0xae2eabe2a8; }
        if c0 & 0x10 != 0 { c ^= 0x1e4f43e470; }
    }
    c ^ 1
}

fn conv8to5(data: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(data.len() * 8 / 5 + 1);
    let (mut buf, mut bits) = (0u32, 0u32);
    for &b in data {
        buf = (buf << 8) | b as u32;
        bits += 8;
        while bits >= 5 {
            bits -= 5;
            out.push(((buf >> bits) & 31) as u8);
            buf &= (1 << bits) - 1;
        }
    }
    if bits > 0 { out.push(((buf << (5 - bits)) & 31) as u8); }
    out
}

/// Kaspa cashaddr-style address: prefix ":" base32(version || payload || checksum).
/// version 0 = Schnorr P2PK (32-byte x-only), version 1 = ECDSA P2PK (33-byte).
fn kaspa_address(prefix: &str, version: u8, payload: &[u8]) -> String {
    let mut p = Vec::with_capacity(payload.len() + 1);
    p.push(version);
    p.extend_from_slice(payload);
    let fp5 = conv8to5(&p);
    let mut cs_in: Vec<u8> = prefix.bytes().map(|c| c & 0x1f).collect();
    cs_in.push(0);
    cs_in.extend_from_slice(&fp5);
    cs_in.extend_from_slice(&[0u8; 8]);
    let cs = addr_polymod(&cs_in);
    let cs_b: Vec<u8> = (0..5).rev().map(|i| ((cs >> (i * 8)) & 0xff) as u8).collect();
    let cs5 = conv8to5(&cs_b);
    let mut s = String::with_capacity(prefix.len() + 1 + fp5.len() + cs5.len());
    s.push_str(prefix);
    s.push(':');
    for d in fp5.iter().chain(cs5.iter()) { s.push(ADDR_CHARSET[*d as usize] as char); }
    s
}

/// Does the claimed wallet string equal the Kaspa P2PK address of this key?
/// The network prefix is taken from the claimed wallet.
fn wallet_matches_key(wallet: &str, a: &Auth) -> bool {
    let Some((pfx, _)) = wallet.split_once(':') else { return false };
    if !matches!(pfx, "kaspa" | "kaspatest" | "kaspasim" | "kaspadev") { return false; }
    kaspa_address(pfx, 0, &a.xonly) == wallet || kaspa_address(pfx, 1, &a.comp) == wallet
}

/// A wallet that is bound in this room needs a valid signature from its key.
fn check_wallet_auth(r: &Room, wallet: &str, auth: &Option<Auth>) -> Result<(), HttpResponse> {
    match r.bound.get(wallet) {
        None => Ok(()),
        Some(k) => match auth {
            Some(a) if a.key_hex() == *k => Ok(()),
            Some(_) => Err(deny("signature key does not match the key bound to this wallet")),
            None => Err(deny("wallet is bound: valid signature required")),
        },
    }
}

fn maybe_bind(r: &mut Room, wallet: &str, auth: &Option<Auth>, newly_added: bool) {
    let Some(a) = auth else { return };
    if r.bound.contains_key(wallet) || r.bound.len() >= 4 * HARD_MAX_PLAYERS { return; }
    if newly_added || wallet_matches_key(wallet, a) {
        r.bound.insert(wallet.to_string(), a.key_hex());
    }
}

/// Seat claimed by a move body: 0 = none / not a seat number.
fn seat_field(body: &serde_json::Value) -> Result<u8, HttpResponse> {
    match body.get("s") {
        None | Some(serde_json::Value::Null) => Ok(0),
        Some(v) => match v.as_u64() {
            Some(n) if n <= 255 => Ok(n as u8),
            Some(_) => Err(bad("bad seat")),
            None => Ok(0),
        },
    }
}

fn seat_of(e: &serde_json::Value) -> u8 {
    e.get("s").and_then(|v| v.as_u64()).filter(|n| *n <= 255).unwrap_or(0) as u8
}

/// A move for seat s must come from the wallet that owns seat s.
fn check_seat(r: &Room, wallet: &str, s: u8) -> Result<(), HttpResponse> {
    if s == 0 { return Ok(()); }
    let Some(owner) = r.players.iter().find(|p| p.seat == s) else {
        return Ok(()); // bot / unassigned seat: any member may drive it
    };
    if owner.wallet == wallet { return Ok(()); }
    if r.bound.contains_key(&owner.wallet) {
        return Err(deny("seat_not_yours"));
    }
    // legacy: the room creator relays/replays unbound seats (orderer re-seed path)
    if wallet == r.creator { return Ok(()); }
    Err(deny("seat_not_yours"))
}

/// v59: a snapshot is board state for every seat, so only the mover's real
/// owner may publish one: the roster owner of seat s (or the creator replaying
/// an unbound owner, as check_seat), and for bot seats the creator/starter.
fn snap_seat_ok(r: &Room, wallet: &str, s: u8) -> bool {
    if s == 0 { return false; }
    match r.players.iter().find(|p| p.seat == s) {
        Some(owner) => owner.wallet == wallet || (!r.bound.contains_key(&owner.wallet) && wallet == r.creator),
        // v60: bot seats - creator, starter, or roster[0] (the host sorts itself first; a guest may have re-seeded this node)
        None => wallet == r.creator || (!r.starter.is_empty() && wallet == r.starter) || (r.started && r.players.first().map(|p| p.wallet == wallet).unwrap_or(false)),
    }
}

/// v59: which wallet a signature speaks for in this room (bound key first,
/// then a member / roster wallet that is this key's Kaspa address).
fn caller_wallet(r: &Room, roster: &[String], a: &Auth) -> Option<String> {
    let k = a.key_hex();
    if let Some(p) = r.players.iter().find(|p| r.bound.get(&p.wallet) == Some(&k)) { return Some(p.wallet.clone()); }
    if let Some((w, _)) = r.bound.iter().find(|(_, v)| **v == k) { return Some(w.clone()); }
    r.players.iter().map(|p| &p.wallet).chain(roster.iter())
        .find(|w| !r.bound.contains_key(*w) && wallet_matches_key(w, a)).cloned()
}

fn creator_of(r: &Room) -> String { r.creator.clone() }

fn creator_signed(r: &Room, auth: &Option<Auth>) -> bool {
    match auth {
        Some(a) => match r.bound.get(&r.creator) {
            Some(k) => *k == a.key_hex(),
            None => wallet_matches_key(&r.creator, a),
        },
        None => false,
    }
}

/// v59: who may /start (or supersede a start). `joined` = r.players.
/// Ok(starter wallet). Rules:
///  0. the roster must include the room creator;
///  A. the creator (proven by signature) — any roster (re-seed of a lost node);
///  any other caller may never drop a bound joined wallet, and then:
///  B. a signed joined member, when every roster wallet joined and nobody joined is dropped;
///  C. creator unbound (unsigned room, legacy): roster ⊆ joined, or — while the
///     room has no log/moves — any roster (the unsigned re-seed replay);
///  D. the host missed its own create here (a guest re-seed made the guest
///     creator): no log/moves, nobody joined is dropped, and the only
///     not-joined wallet is roster[0] (the starter itself). That is no more
///     than join + start, which B allows any member anyway.
/// An outsider can therefore never start with a roster of its own choosing.
fn start_authorized(r: &Room, roster: &[String], auth: &Option<Auth>) -> Result<String, HttpResponse> {
    let creator = r.creator.clone();
    if !roster.iter().any(|w| *w == creator) {
        return Err(deny("roster must include the room creator"));
    }
    if creator_signed(r, auth) { return Ok(creator); }
    let joined: Vec<&String> = r.players.iter().map(|p| &p.wallet).collect();
    if let Some(w) = joined.iter().find(|w| r.bound.contains_key(**w) && !roster.contains(**w)) {
        return Err(deny(&format!("roster drops a bound player: {}", w)));
    }
    let no_log = r.log.is_empty() && r.moves.is_empty();
    let drops = joined.iter().any(|w| !roster.contains(*w));
    let not_joined: Vec<&String> = roster.iter().filter(|w| !joined.contains(w)).collect();
    let caller = auth.as_ref().and_then(|a| caller_wallet(r, roster, a));
    if let Some(c) = &caller {
        if joined.contains(&c) && not_joined.is_empty() && !drops { return Ok(c.clone()); }
    }
    if !r.bound.contains_key(&creator) {
        if not_joined.is_empty() { return Ok(caller.unwrap_or_else(|| roster[0].clone())); }
        if no_log && !drops { return Ok(caller.unwrap_or_else(|| roster[0].clone())); }
    }
    if no_log && !drops && not_joined.len() == 1 && *not_joined[0] == roster[0]
        && !r.bound.contains_key(&roster[0])
        && caller.as_deref().map_or(true, |c| c == roster[0]) {
        return Ok(roster[0].clone());
    }
    if r.bound.contains_key(&creator) {
        return Err(deny("only the room creator or a joined member may start: valid signature required"));
    }
    Err(deny(&format!("roster wallet not joined: {}", not_joined.first().map(|s| s.as_str()).unwrap_or("?"))))
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

fn rules_lists_ok(t: &TurnOrderReq) -> bool {
    [&t.round_robin, &t.follow, &t.exempt, &t.seed, &t.dice].iter()
        .all(|l| l.len() <= MAX_RULE_LIST && l.iter().all(|s| label_ok(s)))
        && t.derive_opener_from.as_deref().map_or(true, label_ok)
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

async fn create_room(req: HttpRequest, raw: web::Bytes) -> HttpResponse {
    let body: CreateReq = match parse_body(&raw) { Ok(b) => b, Err(e) => return e };
    if !room_id_ok(&body.room) {
        return bad("bad room id");
    }
    if !wallet_ok(&body.wallet) {
        return bad("bad wallet");
    }
    if body.seed_commit.len() > MAX_SEED_COMMIT_LEN {
        return bad("seed_commit too long");
    }
    let maxp = body.max_players.unwrap_or(DEFAULT_MAX_PLAYERS);
    if maxp < 1 || maxp > HARD_MAX_PLAYERS {
        return bad("max_players must be 1..8");
    }
    if body.game.is_empty() || body.game.len() > 32 || !body.game.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return bad("bad game label");
    }
    let auth = verify_auth(&req, &raw);
    let mut map = rooms();
    sweep(&mut map);
    // idempotent: re-create of an existing room with same seed_commit + game = ok (broadcast retry)
    if let Some(r) = map.get_mut(&body.room) {
        if r.seed_commit == body.seed_commit && r.game == body.game {
            if body.wallet == r.creator {
                if let Err(e) = check_wallet_auth(r, &body.wallet, &auth) { return e; }
                maybe_bind(r, &body.wallet, &auth, false);
                r.touched_at = now();
            }
            return HttpResponse::Ok().json(json!({"room": body.room, "game": r.game, "existed": true}));
        }
        return HttpResponse::Conflict().json(json!({"error":"room exists with different seed or game"}));
    }
    if map.len() >= MAX_ROOMS {
        return HttpResponse::ServiceUnavailable().json(json!({"error":"room capacity"}));
    }
    let t = now();
    let mut room = Room {
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
        creator: body.wallet.clone(),
        starter: String::new(),
        bound: HashMap::new(),
        bytes: 0,
    };
    maybe_bind(&mut room, &body.wallet, &auth, true);
    let bound = room.bound.contains_key(&body.wallet);
    map.insert(body.room.clone(), room);
    HttpResponse::Ok().json(json!({"room": body.room, "seat": 1, "bound": bound}))
}

async fn join_room(req: HttpRequest, path: web::Path<String>, raw: web::Bytes) -> HttpResponse {
    let id = path.into_inner();
    let body: JoinReq = match parse_body(&raw) { Ok(b) => b, Err(e) => return e };
    if !wallet_ok(&body.wallet) {
        return bad("bad wallet");
    }
    let auth = verify_auth(&req, &raw);
    let mut map = rooms();
    sweep(&mut map);
    let Some(r) = map.get_mut(&id) else { return not_found() };
    // idempotent join
    if let Some(seat) = r.players.iter().find(|p| p.wallet == body.wallet).map(|p| p.seat) {
        if let Err(e) = check_wallet_auth(r, &body.wallet, &auth) { return e; }
        maybe_bind(r, &body.wallet, &auth, false);
        r.touched_at = now();
        return HttpResponse::Ok().json(json!({"room": id, "seat": seat, "rejoined": true}));
    }
    if r.started {
        return HttpResponse::Conflict().json(json!({"error":"game already started"}));
    }
    if r.players.len() >= r.max_players {
        return HttpResponse::Conflict().json(json!({"error":"room full"}));
    }
    let seat = (r.players.len() + 1) as u8;
    r.players.push(Player { wallet: body.wallet.clone(), seat, joined_at: now() });
    maybe_bind(r, &body.wallet, &auth, true);
    r.touched_at = now();
    HttpResponse::Ok().json(json!({"room": id, "seat": seat}))
}

async fn start_room(req: HttpRequest, path: web::Path<String>, raw: web::Bytes) -> HttpResponse {
    let id = path.into_inner();
    let body: StartReq = match parse_body(&raw) { Ok(b) => b, Err(e) => return e };
    if body.roster.is_empty() {
        return bad("roster must not be empty");
    }
    if body.roster.len() > HARD_MAX_PLAYERS {
        return bad("roster too long");
    }
    if !body.roster.iter().all(|w| wallet_ok(w)) {
        return bad("bad roster wallet");
    }
    if body.roster.iter().collect::<HashSet<_>>().len() != body.roster.len() {
        return bad("duplicate roster wallet");
    }
    if let Some(t) = &body.turn_order {
        if !rules_lists_ok(t) { return bad("bad turn_order"); }
    }
    let auth = verify_auth(&req, &raw);
    let mut map = rooms();
    sweep(&mut map);
    let Some(r) = map.get_mut(&id) else { return not_found() };
    if body.roster.len() > r.max_players {
        return bad("roster exceeds room max_players");
    }
    if r.started {
        // idempotent broadcast retry: no state change, no auth needed
        let same = r.players.len() == body.roster.len()
            && r.players.iter().zip(body.roster.iter()).all(|(p, w)| p.wallet == *w);
        if same {
            let players = r.players.clone();
            drop(map);
            return HttpResponse::Ok().json(json!({"room": id, "started": true, "players": players}));
        }
        // v59: a later start may supersede an earlier one only before anything
        // was logged, and only with a superset roster that keeps the previous starter.
        let superset = r.players.iter().all(|p| body.roster.contains(&p.wallet))
            && (r.starter.is_empty() || body.roster.contains(&r.starter));
        if !(superset && r.log.is_empty() && r.moves.is_empty()) {
            return HttpResponse::Conflict().json(json!({"error":"started with different roster"}));
        }
    }
    // v59: see start_authorized — creator, joined member, unsigned legacy /
    // re-seed, or the host whose own create missed this node.
    let starter = match start_authorized(r, &body.roster, &auth) { Ok(w) => w, Err(e) => return e };
    if creator_signed(r, &auth) { maybe_bind(r, &creator_of(r), &auth, false); }
    else if body.roster.first() == Some(&starter)
        && body.roster.iter().filter(|w| !r.players.iter().any(|p| p.wallet == **w)).count() == 1
        && !r.players.iter().any(|p| p.wallet == starter) {
        // the starter adds only itself by starting (rule D): bind it like a signed join
        maybe_bind(r, &starter, &auth, true);
    }
    r.starter = starter;
    let t = now();
    r.players = body.roster.iter().enumerate().map(|(i, w)| Player {
        wallet: w.clone(),
        seat: (i + 1) as u8,
        joined_at: t,
    }).collect();
    r.started = true;
    r.touched_at = t;
    if let Some(t) = body.turn_order.clone() {
        if t.seats >= 1 && t.seats <= 8 { r.rules = Some(t); }
    }
    let players = r.players.clone();
    drop(map);
    HttpResponse::Ok().json(json!({"room": id, "started": true, "players": players}))
}

async fn post_move(req: HttpRequest, path: web::Path<String>, raw: web::Bytes) -> HttpResponse {
    let id = path.into_inner();
    let body: MoveReq = match parse_body(&raw) { Ok(b) => b, Err(e) => return e };
    if !wallet_ok(&body.wallet) {
        return bad("bad wallet");
    }
    let mv_raw = body.mv.to_string();
    if mv_raw.len() > MAX_MOVE_BYTES {
        return HttpResponse::PayloadTooLarge().json(json!({"error":"move too large"}));
    }
    let Some(idx) = body.mv.get("i").and_then(|v| v.as_u64()) else {
        return bad("move missing index i");
    };
    let sv = match seat_field(&body.mv) { Ok(s) => s, Err(e) => return e };
    let auth = verify_auth(&req, &raw);
    let mut map = rooms();
    sweep(&mut map);
    let total = total_bytes(&map);
    let Some(r) = map.get_mut(&id) else { return not_found() };
    if !r.players.iter().any(|p| p.wallet == body.wallet) {
        return deny("wallet not in room");
    }
    if let Err(e) = check_wallet_auth(r, &body.wallet, &auth) { return e; }
    if let Err(e) = check_seat(r, &body.wallet, sv) { return e; }
    if r.moves.contains_key(&idx) {
        // first write wins per index — broadcast retries and peer echoes are no-ops
        return HttpResponse::Ok().json(json!({"room": id, "i": idx, "stored": false, "count": r.moves.len()}));
    }
    let cost = mv_raw.len() + ENTRY_OVERHEAD;
    if r.moves.len() >= MAX_MOVES || r.bytes.saturating_add(cost) > MAX_ROOM_BYTES
        || total.saturating_add(cost) > MAX_TOTAL_BYTES {
        return HttpResponse::PayloadTooLarge().json(json!({"error":"move capacity"}));
    }
    r.moves.insert(idx, Arc::new(body.mv));
    r.bytes = r.bytes.saturating_add(cost);
    maybe_bind(r, &body.wallet, &auth, false);
    r.touched_at = now();
    HttpResponse::Ok().json(json!({"room": id, "i": idx, "stored": true, "count": r.moves.len()}))
}

async fn get_moves(path: web::Path<String>, q: web::Query<SinceQ>) -> HttpResponse {
    let id = path.into_inner();
    let since = q.since.unwrap_or(0);
    let (moves, total) = {
        let map = rooms();
        let Some(r) = map.get(&id).filter(|r| !expired(r, now())) else { return not_found() };
        let moves: Vec<Arc<serde_json::Value>> = r.moves.range(since..).map(|(_, v)| v.clone()).collect();
        (moves, r.moves.len())
    };
    let refs: Vec<&serde_json::Value> = moves.iter().map(|v| &**v).collect();
    HttpResponse::Ok().json(json!({
        "room": id,
        "since": since,
        "count": refs.len(),
        "total": total,
        "moves": refs
    }))
}

async fn room_info(path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let map = rooms();
    let Some(r) = map.get(&id).filter(|r| !expired(r, now())) else { return not_found() };
    let out = json!({
        "room": r.id,
        "game": r.game,
        "created_at": r.created_at,
        "seed_commit": r.seed_commit,
        "max_players": r.max_players,
        "turn_deadline_secs": r.turn_deadline_secs,
        "players": r.players,
        "started": r.started,
        "move_count": r.moves.len()
    });
    drop(map);
    HttpResponse::Ok().json(out)
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
fn derive_opener(log: &[Arc<LogEntry>], first_action: &str, seats: u8) -> Option<u8> {
    let mut seq: Vec<(u8, i64)> = Vec::new();
    for e in log {
        if e.kind != "move" { continue; }
        let a = e.body.get("a").and_then(|v| v.as_str()).unwrap_or("");
        if a != first_action { continue; }
        let sv = seat_of(&e.body);
        let vv = e.body.get("v").and_then(|v| v.as_i64()).unwrap_or(0);
        if sv >= 1 && sv <= seats { seq.push((sv, vv)); }
    }
    let mut active: Vec<u8> = (1..=seats).collect();
    let mut idx = 0usize;
    loop {
        if active.len() == 1 { return Some(active[0]); }
        if active.is_empty() { return None; }
        let mut vals: HashMap<u8, i64> = HashMap::new();
        while idx < seq.len() && vals.len() < active.len() {
            let (sv, vv) = seq[idx];
            idx += 1;
            if active.contains(&sv) && !vals.contains_key(&sv) { vals.insert(sv, vv); }
        }
        if vals.len() < active.len() { return None; }
        let m = *vals.values().max()?;
        active.retain(|sv| vals.get(sv) == Some(&m));
    }
}

fn is_seed_entry(e: &LogEntry, rules: &TurnOrderReq) -> bool {
    e.kind == "move" && rules.seed.iter().any(|x| Some(x.as_str()) == e.body.get("a").and_then(|v| v.as_str()))
}

fn is_rr_entry(e: &LogEntry, rules: &TurnOrderReq) -> bool {
    e.kind == "move" && rules.round_robin.iter().any(|x| Some(x.as_str()) == e.body.get("a").and_then(|v| v.as_str()))
}

// ---- v57: the rotation state, derived from the stored log on demand ----
// Replays every stored seed/round_robin entry in order and returns the seat
// whose round-robin action closed the log most recently — i.e. exactly what
// last_rr_seat used to hold, except it can never disagree with the log.
// A seed action (opener declaration) for seat S yields S-1 so that the
// expected-next formula (last % seats) + 1 lands on S, matching v53.
// v58: only the FIRST opener declaration counts, and only if it precedes
// every round-robin entry — a later re-declaration cannot reset rotation.
fn derive_rr_last(log: &[Arc<LogEntry>], rules: &TurnOrderReq) -> Option<u8> {
    let n = rules.seats.max(2) as u16;
    let mut last: Option<u8> = None;
    let mut seed_seen = false;
    let mut rr_seen = false;
    for e in log {
        if e.kind != "move" { continue; }
        let a = e.body.get("a").and_then(|v| v.as_str()).unwrap_or("");
        let sv = seat_of(&e.body);
        if sv < 1 { continue; }
        if rules.seed.iter().any(|x| x == a) {
            if seed_seen || rr_seen { continue; }
            seed_seen = true;
            let v16 = sv as u16;
            last = Some((((v16 + n - 2) % n) + 1) as u8);
        } else if rules.round_robin.iter().any(|x| x == a) {
            rr_seen = true;
            last = Some(sv);
        }
    }
    last
}

/// Sum of |cash deltas| in a move's fx; None on overflow / non-integer abuse.
fn fx_cash_total(cash: &serde_json::Map<String, serde_json::Value>) -> Option<i64> {
    let mut total: i64 = 0;
    for v in cash.values() {
        let a = if let Some(x) = v.as_i64() {
            x.checked_abs()?
        } else if v.is_u64() {
            return None; // > i64::MAX
        } else if let Some(f) = v.as_f64() {
            if !f.is_finite() || f.abs() > 1e15 { return None; }
            f.abs().ceil() as i64
        } else {
            continue; // non-numeric values were never counted
        };
        total = total.checked_add(a)?;
    }
    Some(total)
}

async fn append_log(req: HttpRequest, path: web::Path<String>, raw: web::Bytes) -> HttpResponse {
    let id = path.into_inner();
    let body: AppendReq = match parse_body(&raw) { Ok(b) => b, Err(e) => return e };
    if !wallet_ok(&body.wallet) {
        return bad("bad wallet");
    }
    if body.kind.is_empty() || body.kind.len() > 24
        || !body.kind.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return bad("bad kind");
    }
    if body.nonce.as_ref().map_or(false, |n| n.len() > MAX_NONCE_LEN) {
        return bad("nonce too long");
    }
    let body_raw = body.body.to_string();
    if body_raw.len() > MAX_MOVE_BYTES {
        return HttpResponse::PayloadTooLarge().json(json!({"error":"entry too large"}));
    }
    let sv_claim = match seat_field(&body.body) { Ok(s) => s, Err(e) => return e };
    let auth = verify_auth(&req, &raw);
    let mut map = rooms();
    sweep(&mut map);
    let total = total_bytes(&map);
    let Some(r) = map.get_mut(&id) else { return not_found() };
    if !r.players.iter().any(|p| p.wallet == body.wallet) {
        return deny("wallet not in room");
    }
    if let Err(e) = check_wallet_auth(r, &body.wallet, &auth) { return e; }
    let a_claim = body.body.get("a").and_then(|v| v.as_str()).unwrap_or("").to_string();
    // seed (opener) declarations name the opener's seat, not the poster's —
    // every client publishes one; they are policed by first-wins + derive_opener
    let is_seed_action = r.rules.as_ref().map_or(false, |t| t.seed.iter().any(|x| *x == a_claim));
    if body.kind == "move" && !is_seed_action {
        if let Err(e) = check_seat(r, &body.wallet, sv_claim) { return e; }
    }
    // v59: a snapshot rewrites every seat's state — only the mover's owner may carry one
    if body.kind == "move" {
        let has_snap = body.body.get("snap").and_then(|v| v.as_str()).map_or(false, |x| !x.is_empty());
        if has_snap && !snap_seat_ok(r, &body.wallet, sv_claim) {
            return HttpResponse::Ok().json(json!({
                "room": id, "stored": false, "reason": "snap_not_seat_owner",
                "head": r.log.len(), "chain": r.chain
            }));
        }
    }
    // v59: game-control entries (the start gun / seed reveal, incl. re-arms) come
    // only from the room creator or the starter, after /start, before the first move
    if body.kind == "gun" || body.kind == "seed" {
        let author_ok = body.wallet == r.creator || (!r.starter.is_empty() && body.wallet == r.starter) || r.players.first().map(|p| p.wallet == body.wallet).unwrap_or(false); // v60: roster[0] = host
        let moved = r.log.iter().any(|e| e.kind == "move");
        if !r.started || !author_ok || moved {
            return HttpResponse::Ok().json(json!({
                "room": id, "stored": false,
                "reason": if !r.started { "not_started" } else if moved { "gun_after_first_move" } else { "gun_not_host" },
                "head": r.log.len(), "chain": r.chain
            }));
        }
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
    // ---- v57: content dedup — a re-posted record is a replay, not a new entry ----
    // Clients re-post their records after resyncs without a nonce. The record's
    // own commitment hash (body.hash) is unique per record, so an entry from the
    // same wallet+kind with the same hash in the recent log is the same record.
    if let Some(hh) = body.body.get("hash").and_then(|v| v.as_str()) {
        if !hh.is_empty() {
            let from = r.log.len().saturating_sub(DEDUP_WINDOW);
            if let Some(e) = r.log[from..].iter().find(|e|
                e.wallet == body.wallet && e.kind == body.kind &&
                e.body.get("hash").and_then(|v| v.as_str()) == Some(hh)) {
                return HttpResponse::Ok().json(json!({
                    "room": id, "i": e.i, "h": e.h, "stored": false, "reason": "duplicate",
                    "head": r.log.len(), "chain": r.chain
                }));
            }
        }
    }
    let cost = body_raw.len() + body.wallet.len() + ENTRY_OVERHEAD;
    if r.log.len() >= MAX_MOVES || r.bytes.saturating_add(cost) > MAX_ROOM_BYTES
        || total.saturating_add(cost) > MAX_TOTAL_BYTES {
        return HttpResponse::PayloadTooLarge().json(json!({"error":"log capacity"}));
    }
    // ---- v52 turn gate (only when the game configured one at /start) ----
    // v57: every check reads derive_rr_last(&r.log, rules) — the stored log is
    // the only rotation state, so the gate cannot contradict this node's chain.
    if body.kind == "move" {
        if let Some(rules) = r.rules.clone() {
            let a = a_claim.as_str();
            let sv = sv_claim;
            let exempt = rules.exempt.iter().any(|x| x == a);
            if rules.seed.iter().any(|x| x == a) {
                // v59: while the roll-off is incomplete nothing can be checked, so
                // nothing is stored — an early (possibly wrong) declaration used to
                // win "first-wins" forever. Only a declaration matching the derived
                // opener is accepted; with no derive rule, first declaration wins.
                if let Some(fa) = rules.derive_opener_from.as_deref() {
                    if derive_opener(&r.log, fa, rules.seats).is_none() {
                        return HttpResponse::Ok().json(json!({
                            "room": id, "stored": false, "reason": "rolloff_incomplete",
                            "head": r.log.len(), "chain": r.chain
                        }));
                    }
                }
                // v58: the opener is declared once. A re-declaration (or one
                // arriving after rotation began) is refused, never re-seeds.
                if r.log.iter().any(|e| is_seed_entry(e, &rules) || is_rr_entry(e, &rules)) {
                    return HttpResponse::Ok().json(json!({
                        "room": id, "stored": false, "reason": "opener_already_set",
                        "expect": derive_rr_last(&r.log, &rules).map(|l| (l % rules.seats.max(1)) + 1),
                        "head": r.log.len(), "chain": r.chain
                    }));
                }
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
                // v57: no counter to set — storing this entry IS the state change
            } else if !exempt && rules.round_robin.iter().any(|x| x == a) {
                let last = derive_rr_last(&r.log, &rules);
                // v54: no rotation state yet -> the chain's derived opener goes first
                if last.is_none() {
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
                if let Some(last) = last {
                    let expect = (last % rules.seats.max(1)) + 1;
                    if sv != expect {
                        return HttpResponse::Ok().json(json!({
                            "room": id, "stored": false, "reason": "not_your_turn",
                            "expect": expect, "head": r.log.len(), "chain": r.chain
                        }));
                    }
                }
                // v57: no counter to set — storing this entry IS the state change
            } else if !exempt && rules.follow.iter().any(|x| x == a) {
                match derive_rr_last(&r.log, &rules) {
                    Some(last) if last == sv => {}
                    other => {
                        return HttpResponse::Ok().json(json!({
                            "room": id, "stored": false, "reason": "not_the_roller",
                            "expect": other, "head": r.log.len(), "chain": r.chain
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
                let over = match fx_cash_total(cash) { Some(t) => t > 5000, None => true };
                if over {
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
            if rules.dice.iter().any(|x| *x == a_claim) {
                dice_out = Some(derive_dice(&r.seed_commit, i));
            }
        }
    }
    // ---- v56: transition validation against the previous chain snap (mover-scoped) ----
    if body.kind == "move" && r.rules.is_some() {
        if let Some(next_snap) = body.body.get("snap").and_then(|v| v.as_str()) {
            if !next_snap.is_empty() {
                if let Some(prev_snap) = last_chain_snap(&r.log) {
                    if let Some(why) = check_transition(&prev_snap, next_snap, &a_claim, sv_claim, dice_out) {
                        return HttpResponse::Ok().json(json!({
                            "room": id, "stored": false, "reason": "bad_transition", "detail": why,
                            "head": r.log.len(), "chain": r.chain
                        }));
                    }
                }
            }
        }
    }
    let wallet = body.wallet;
    let kind = body.kind;
    let mut b = body.body;
    if let (Some((d1, d2)), Some(obj)) = (dice_out, b.as_object_mut()) {
        obj.insert("d1".into(), json!(d1));
        obj.insert("d2".into(), json!(d2));
        obj.insert("v".into(), json!((d1 as i64) + (d2 as i64)));
    }
    if let (Some(n), Some(obj)) = (&body.nonce, b.as_object_mut()) {
        obj.insert("__nonce".into(), json!(n));
    }
    let h = chain_hash(&r.chain, i, &wallet, &kind, &b);
    r.chain = h.clone();
    maybe_bind(r, &wallet, &auth, false);
    r.log.push(Arc::new(LogEntry { i, ts: now(), wallet, kind, body: b, h: h.clone() }));
    r.bytes = r.bytes.saturating_add(cost);
    r.touched_at = now();
    let mut resp = json!({"room": id, "i": i, "h": h, "stored": true, "head": r.log.len(), "chain": r.chain});
    drop(map);
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
fn last_chain_snap(log: &[Arc<LogEntry>]) -> Option<String> {
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
                let expect = from.checked_add((d1 as i64) + (d2 as i64)).map(|x| x.rem_euclid(40));
                // v56b: advisory only — dice-index drift makes this unsafe to enforce
                let _ = (to, expect, from);
            }
        }
    }
    if po != no {
        // v56c: a roll can settle a purchase in the same beat; end carries the settled turn
        let ok = a == "buy" || a == "p2pbuy" || a == "roll" || a == "end" || a == "pass"
            || a.starts_with("accept:") || a.starts_with("lapse:") || a.starts_with("mgmt:")
            || a.starts_with("bid:") || a.starts_with("cash:") || a.starts_with("scn:");
        if !ok { return Some("deed_change_off_action"); }
    }
    let mut delta: i64 = 0;
    for p in 0..4usize {
        let d = match nc[p].checked_sub(pc[p]).and_then(|d| d.checked_abs()) {
            Some(d) => d,
            None => return Some("cash_overflow"),
        };
        delta = match delta.checked_add(d) { Some(x) => x, None => return Some("cash_overflow") };
    }
    if delta > 1500 { return Some("cash_delta_cap"); }
    // v56e: XP is derived from the chain by every client, never transmitted as truth.
    // The old invariants only fired on legitimate resync rollback.
    let _ = (&px, &nx);
    None
}

// v56: the relay answers whose turn it is, directly.
// v57: derived from the stored log — never a counter.
async fn get_turn(path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let map = rooms();
    let Some(r) = map.get(&id).filter(|r| !expired(r, now())) else { return not_found() };
    let seats = r.rules.as_ref().map(|t| t.seats).unwrap_or(4).max(1);
    let last = r.rules.as_ref().and_then(|rules| derive_rr_last(&r.log, rules));
    // v56d: before rotation starts, the chain-derived opener is the expected actor
    let expect: Option<u8> = match last {
        Some(l) => Some((l % seats) + 1),
        None => {
            let fa = r.rules.as_ref().and_then(|t| t.derive_opener_from.clone());
            match fa {
                Some(first_action) => derive_opener(&r.log, &first_action, seats),
                None => None,
            }
        }
    };
    let out = json!({
        "room": id,
        "expect_roller": expect,
        "last_rr_seat": last,
        "head": r.log.len(),
        "chain": r.chain
    });
    drop(map);
    HttpResponse::Ok().json(out)
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
        return bad("bad tag");
    }
    let (seed, head) = {
        let map = rooms();
        let Some(r) = map.get(&id).filter(|r| !expired(r, now())) else { return not_found() };
        (r.seed_commit.clone(), r.log.len())
    };
    let i = q.i.unwrap_or(head as u64);
    let mut hz = Sha256::new();
    hz.update(seed.as_bytes());
    hz.update(tag.as_bytes());
    hz.update(i.to_le_bytes());
    let d = hz.finalize();
    let u32s: Vec<u32> = d.chunks(4).take(8)
        .map(|c| u32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect();
    HttpResponse::Ok().json(json!({"room": id, "tag": tag, "i": i, "hex": hex::encode(d), "u32s": u32s, "head": head}))
}

// v55: expose the derivation so clients can pre-pin their own rolls.
async fn get_dice(path: web::Path<String>, q: web::Query<DiceQ>) -> HttpResponse {
    let id = path.into_inner();
    let (seed, head) = {
        let map = rooms();
        let Some(r) = map.get(&id).filter(|r| !expired(r, now())) else { return not_found() };
        (r.seed_commit.clone(), r.log.len())
    };
    let i = q.i.unwrap_or(head as u64);
    let (d1, d2) = derive_dice(&seed, i);
    HttpResponse::Ok().json(json!({"room": id, "i": i, "d1": d1, "d2": d2, "v": (d1 as i64)+(d2 as i64), "head": head}))
}

async fn get_log(path: web::Path<String>, q: web::Query<AfterQ>) -> HttpResponse {
    let id = path.into_inner();
    let after = usize::try_from(q.after.unwrap_or(0)).unwrap_or(usize::MAX);
    // clone cheap Arc handles under the lock; serialize after releasing it
    let (entries, head, chain, seed_commit, started) = {
        let map = rooms();
        let Some(r) = map.get(&id).filter(|r| !expired(r, now())) else { return not_found() };
        let entries: Vec<Arc<LogEntry>> = r.log.iter().skip(after).cloned().collect();
        (entries, r.log.len(), r.chain.clone(), r.seed_commit.clone(), r.started)
    };
    let refs: Vec<&LogEntry> = entries.iter().map(|e| &**e).collect();
    HttpResponse::Ok().json(json!({
        "room": id,
        "after": after,
        "head": head,
        "chain": chain,
        "seed_commit": seed_commit,
        "started": started,
        "entries": refs
    }))
}

// ---------- wiring ----------

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/game")
            // v58: game bodies are small; don't inherit the app-wide 16 MB JSON limit
            .app_data(web::PayloadConfig::new(MAX_BODY_BYTES))
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

#[cfg(test)]
mod tests {
    use super::*;

    fn decode_addr(addr: &str) -> Option<(String, Vec<u8>)> {
        let (pfx, data) = addr.split_once(':')?;
        let d5: Vec<u8> = data.bytes()
            .map(|c| ADDR_CHARSET.iter().position(|x| *x == c).map(|p| p as u8))
            .collect::<Option<Vec<u8>>>()?;
        let mut v: Vec<u8> = pfx.bytes().map(|c| c & 0x1f).collect();
        v.push(0);
        v.extend_from_slice(&d5);
        if addr_polymod(&v) != 0 { return None; }
        // 5 -> 8 bit, drop checksum (last 8 chars)
        let payload5 = &d5[..d5.len() - 8];
        let (mut buf, mut bits, mut out) = (0u32, 0u32, Vec::new());
        for &x in payload5 {
            buf = (buf << 5) | x as u32;
            bits += 5;
            if bits >= 8 { bits -= 8; out.push(((buf >> bits) & 0xff) as u8); buf &= (1 << bits) - 1; }
        }
        Some((pfx.to_string(), out))
    }

    #[test]
    fn address_roundtrip_known_repo_addresses() {
        for a in [
            "kaspatest:qp35q2e5maacw03gyuh5pdr389y92nxp4dttxlr728pf0xcxytxd7nspt3z2k",
            "kaspatest:qzuwzvff0hn629auv0hk067wfxnwx5t2zw6dayz84ktknklm7s3sjm67xzh87",
        ] {
            let (pfx, payload) = decode_addr(a).expect("checksum must verify");
            assert_eq!(payload.len(), 33);
            assert_eq!(payload[0], 0);
            assert_eq!(kaspa_address(&pfx, 0, &payload[1..]), a);
        }
        // a corrupted char must fail the checksum
        assert!(decode_addr("kaspatest:qp35q2e5maacw03gyuh5pdr389y92nxp4dttxlr728pf0xcxytxd7nspt3z2q").is_none());
    }

    // v59 vector: @noble/curves schnorr (aux = 32 zero bytes) over the exact
    // kv_net_bridge.ts kvRelaySigMessage V2 layout (priv = 0x…03); the address was
    // produced by canonical_agreement_steps.ts deriveAddress(xonly, 'testnet-10').
    #[test]
    fn noble_v2_signature_vector_verifies_and_binds_host() {
        let pubh = "02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9";
        let sigh = "88ca5e7d0a9f5589df37a04a672d9f800f06d017f9dbce205a54e45aff5fcecc4b809bc5ccce1c0650bc1d1459be19443ca0da5bb5a0778c56046ffdb2ac1ea1";
        let ts: u64 = 1760000000;
        let host = "1.2.3.4:35816";
        let method = "POST";
        let pq = "/api/game/room/abc123/append?x=1";
        let body = r#"{"wallet":"w","kind":"move","body":{"s":1,"a":"roll"}}"#;
        let addr = "kaspatest:qrunpzspjfvvxyzfx38ct7ya2g5m2vwggkpklxdsscqlzyauuqm0jaux3xvse";
        let a = verify_sig(pubh, sigh, ts, host, method, pq, body.as_bytes(), ts + 10).expect("sig must verify");
        assert!(wallet_matches_key(addr, &a));
        assert!(!wallet_matches_key(&addr.replacen("kaspatest", "kaspa", 1), &a));
        // another node (host) / tampered body / path / stale ts must fail
        assert!(verify_sig(pubh, sigh, ts, "5.6.7.8:35816", method, pq, body.as_bytes(), ts).is_none());
        assert!(verify_sig(pubh, sigh, ts, host, method, pq, b"{}", ts).is_none());
        assert!(verify_sig(pubh, sigh, ts, host, method, "/api/game/room/x/start", body.as_bytes(), ts).is_none());
        assert!(verify_sig(pubh, sigh, ts, host, method, pq, body.as_bytes(), ts + 301).is_none());
    }

    #[test]
    fn overflow_paths_do_not_panic() {
        let mx = i64::MAX;
        let prev = format!("{m},0,0,0|0,0,0,0|", m = -mx);
        let next = format!("{m},0,0,0|0,0,0,0|", m = mx);
        assert_eq!(check_transition(&prev, &next, "roll", 1, Some((6, 6))), Some("cash_overflow"));
        let prev2 = format!("{},0,0,0|{},0,0,0|", i64::MIN, mx);
        assert_eq!(check_transition(&prev2, &prev2, "roll", 1, Some((6, 6))), None); // pos i64::MAX + dice: no panic
        let cash: serde_json::Map<String, serde_json::Value> =
            serde_json::from_str(&format!("{{\"a\":{},\"b\":{}}}", i64::MIN, mx)).unwrap();
        assert_eq!(fx_cash_total(&cash), None);
        let cash2: serde_json::Map<String, serde_json::Value> = serde_json::from_str("{\"a\":1e300}").unwrap();
        assert_eq!(fx_cash_total(&cash2), None);
    }

    #[test]
    fn first_opener_wins() {
        let rules = TurnOrderReq { seats: 4, round_robin: vec!["roll".into()], follow: vec![], exempt: vec![],
            seed: vec!["opener".into()], derive_opener_from: None, dice: vec![] };
        let mk = |i: u64, s: u64, a: &str| Arc::new(LogEntry { i, ts: 0, wallet: "w".into(), kind: "move".into(),
            body: json!({"s": s, "a": a}), h: String::new() });
        let log = vec![mk(0, 2, "opener"), mk(1, 3, "opener")];
        assert_eq!(derive_rr_last(&log, &rules), Some(1)); // expect seat 2 next
        let log2 = vec![mk(0, 2, "opener"), mk(1, 2, "roll"), mk(2, 1, "opener")];
        assert_eq!(derive_rr_last(&log2, &rules), Some(2));
    }

    // ---------- v59 handler-level tests ----------
    use actix_web::{test as at, App};

    fn sign_headers(sk: u8, host: &str, method: &str, pq: &str, body: &str) -> Vec<(String, String)> {
        let mut kb = [0u8; 32];
        kb[31] = sk;
        let kp = secp256k1::Keypair::from_seckey_slice(secp256k1::SECP256K1, &kb).unwrap();
        let ts = now();
        let d = relay_msg_digest(host, method, pq, body.as_bytes(), ts);
        let sig = secp256k1::SECP256K1.sign_schnorr_no_aux_rand(&secp256k1::Message::from_digest(d), &kp);
        vec![
            ("x-kv-pub".into(), hex::encode(kp.public_key().serialize())),
            ("x-kv-ts".into(), ts.to_string()),
            ("x-kv-sig".into(), hex::encode(sig.as_ref())),
        ]
    }

    const HOST: &str = "9.9.9.9:35816";

    /// POST `body` to `path`; sk = Some(k) signs for HOST (or `sig_host` if given).
    macro_rules! post {
        ($app:expr, $path:expr, $body:expr, $sk:expr, $sig_host:expr) => {{
            let path: &str = &$path;
            let raw = ($body).to_string();
            let mut rq = at::TestRequest::post().uri(path)
                .insert_header(("host", HOST))
                .insert_header(("content-type", "application/json"))
                .set_payload(raw.clone());
            let sk: Option<u8> = $sk;
            let sh: Option<&str> = $sig_host;
            if let Some(k) = sk {
                for (h, v) in sign_headers(k, sh.unwrap_or(HOST), "POST", path, &raw) { rq = rq.insert_header((h, v)); }
            }
            let resp = at::call_service($app, rq.to_request()).await;
            let st = resp.status().as_u16();
            let b = at::read_body(resp).await;
            (st, serde_json::from_slice::<serde_json::Value>(&b).unwrap_or(json!(null)))
        }};
    }

    fn rules_json() -> serde_json::Value {
        json!({ "seats":4, "round_robin":["roll"], "follow":["buy","pass","end","court"], "dice":["roll"],
                "exempt":["first"], "seed":["opener"], "derive_opener_from":"first" })
    }

    #[actix_web::test]
    async fn v2_signature_is_bound_to_the_host() {
        let app = at::init_service(App::new().configure(configure)).await;
        let (s, b) = post!(&app, "/api/game/room/create", json!({"room":"v59host1","wallet":"kcwA","seed_commit":"x"}), Some(11), None);
        assert_eq!(s, 200); assert_eq!(b["bound"], json!(true));
        // the same wallet signing for another node is not authenticated here
        let (s, b) = post!(&app, "/api/game/room/create", json!({"room":"v59host2","wallet":"kcwA","seed_commit":"x"}), Some(11), Some("1.1.1.1:35816"));
        assert_eq!(s, 200); assert_eq!(b["bound"], json!(false));
    }

    #[actix_web::test]
    async fn start_by_joined_member_and_hijack_refused() {
        let app = at::init_service(App::new().configure(configure)).await;
        let r = "v59member";
        post!(&app, "/api/game/room/create", json!({"room":r,"wallet":"kcwA","seed_commit":"x"}), Some(21), None);
        post!(&app, &format!("/api/game/room/{}/join", r), json!({"wallet":"kcwB"}), Some(22), None);
        let sp = format!("/api/game/room/{}/start", r);
        // outsiders: dropping a bound player, naming two unjoined wallets, or an unjoined non-first wallet
        assert_eq!(post!(&app, &sp, json!({"roster":["kcwC","kcwA"]}), Some(23), None).0, 403);
        assert_eq!(post!(&app, &sp, json!({"roster":["kcwC","kcwD","kcwA","kcwB"]}), None, None).0, 403);
        assert_eq!(post!(&app, &sp, json!({"roster":["kcwA","kcwB","kcwC"]}), Some(23), None).0, 403);
        // a joined (bound) member may start when every roster wallet joined
        let (s, b) = post!(&app, &sp, json!({"roster":["kcwB","kcwA"], "turn_order": rules_json()}), Some(22), None);
        assert_eq!(s, 200, "{}", b);
        // the member who started is the starter: its gun is accepted
        let ap = format!("/api/game/room/{}/append", r);
        let (_, b) = post!(&app, &ap, json!({"wallet":"kcwB","kind":"gun","body":{"startDaa":1}}), Some(22), None);
        assert_eq!(b["stored"], json!(true), "{}", b);
    }

    #[actix_web::test]
    async fn host_whose_create_missed_the_node_can_start() {
        // guest G's re-seed created the room here (G is creator, signed & bound)
        let app = at::init_service(App::new().configure(configure)).await;
        let r = "v59missed";
        post!(&app, "/api/game/room/create", json!({"room":r,"wallet":"kcwG","seed_commit":"x"}), Some(31), None);
        let (s, b) = post!(&app, &format!("/api/game/room/{}/start", r), json!({"roster":["kcwH","kcwG"], "turn_order": rules_json()}), Some(32), None);
        assert_eq!(s, 200, "{}", b);
        let ap = format!("/api/game/room/{}/append", r);
        // the host (starter) arms the gun; it was bound to its key by starting
        let (_, b) = post!(&app, &ap, json!({"wallet":"kcwH","kind":"gun","body":{"startDaa":1}}), Some(32), None);
        assert_eq!(b["stored"], json!(true), "{}", b);
        let (s, _) = post!(&app, &ap, json!({"wallet":"kcwH","kind":"move","body":{"s":1,"a":"first","v":5}}), None, None);
        assert_eq!(s, 403); // bound by its start: unsigned impersonation refused
    }

    #[actix_web::test]
    async fn unsigned_reseed_replay_succeeds() {
        // seedNode on a fresh node, unsigned: create, start (full roster), appends
        let app = at::init_service(App::new().configure(configure)).await;
        let r = "v59reseed";
        post!(&app, "/api/game/room/create", json!({"room":r,"wallet":"kcwG","seed_commit":"seed-v59reseed"}), None, None);
        let (s, b) = post!(&app, &format!("/api/game/room/{}/start", r), json!({"roster":["kcwH","kcwG"], "turn_order": rules_json()}), None, None);
        assert_eq!(s, 200, "{}", b);
        let ap = format!("/api/game/room/{}/append", r);
        for (seat, v) in [(1u8, 9), (2, 4), (3, 7), (4, 2)] {
            let (s, b) = post!(&app, &ap, json!({"wallet":"kcwG","kind":"move","body":{"s":seat,"a":"first","v":v,"snap":"1,1,1,1|0,0,0,0|"}}), None, None);
            assert_eq!(s, 200); assert_eq!(b["stored"], json!(true), "{}", b);
        }
        let (_, b) = post!(&app, &ap, json!({"wallet":"kcwG","kind":"move","body":{"s":1,"a":"opener","v":0}}), None, None);
        assert_eq!(b["stored"], json!(true), "{}", b);
        // a gun after the first move is refused
        let (_, b) = post!(&app, &ap, json!({"wallet":"kcwG","kind":"gun","body":{"startDaa":1}}), None, None);
        assert_eq!(b["reason"], json!("gun_after_first_move"));
    }

    #[actix_web::test]
    async fn opener_refused_until_rolloff_complete() {
        let app = at::init_service(App::new().configure(configure)).await;
        let r = "v59opener";
        post!(&app, "/api/game/room/create", json!({"room":r,"wallet":"kcwA","seed_commit":"x"}), None, None);
        post!(&app, &format!("/api/game/room/{}/join", r), json!({"wallet":"kcwB"}), None, None);
        post!(&app, &format!("/api/game/room/{}/start", r), json!({"roster":["kcwA","kcwB"], "turn_order": rules_json()}), None, None);
        let ap = format!("/api/game/room/{}/append", r);
        let op = |s: u8| json!({"wallet":"kcwB","kind":"move","body":{"s":s,"a":"opener","v":0}});
        // gun from a non-host member is refused
        let (_, b) = post!(&app, &ap, json!({"wallet":"kcwB","kind":"gun","body":{"startDaa":1}}), None, None);
        assert_eq!(b["reason"], json!("gun_not_host"));
        assert_eq!(post!(&app, &ap, op(2), None, None).1["reason"], json!("rolloff_incomplete"));
        for (seat, w, v) in [(1u8, "kcwA", 3), (2, "kcwB", 11), (3, "kcwA", 6)] {
            post!(&app, &ap, json!({"wallet":w,"kind":"move","body":{"s":seat,"a":"first","v":v}}), None, None);
        }
        assert_eq!(post!(&app, &ap, op(2), None, None).1["reason"], json!("rolloff_incomplete"));
        // bot seat 4: a snapshot from the guest is refused (bots belong to the host)
        let (_, b) = post!(&app, &ap, json!({"wallet":"kcwB","kind":"move","body":{"s":4,"a":"first","v":2,"snap":"1,1,1,1|0,0,0,0|"}}), None, None);
        assert_eq!(b["reason"], json!("snap_not_seat_owner"));
        post!(&app, &ap, json!({"wallet":"kcwA","kind":"move","body":{"s":4,"a":"first","v":2,"snap":"1,1,1,1|0,0,0,0|"}}), None, None);
        let (_, b) = post!(&app, &ap, op(1), None, None);
        assert_eq!(b["reason"], json!("opener_mismatch"));
        assert_eq!(b["expect"], json!(2));
        assert_eq!(post!(&app, &ap, op(2), None, None).1["stored"], json!(true));
        assert_eq!(post!(&app, &ap, op(2), None, None).1["reason"], json!("opener_already_set"));
    }
}
