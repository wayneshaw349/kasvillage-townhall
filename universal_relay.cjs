// universal_relay.cjs — generalize game_rooms into a universal relay:
//   1. `game` label on create (stored, echoed in info; join/start unaffected)
//   2. per-room `max_players` on create (1..8, default 4)
//   3. optional `turn_deadline_secs` on create (echoed in info; client-enforced)
// Anchors must each appear exactly once; aborts before writing otherwise.
const fs = require("fs");
const P = "src/game_rooms.rs";
let s = fs.readFileSync(P, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("max_players") !== -1) {
  console.error("ABORT: universal fields already applied. File untouched.");
  process.exit(1);
}

const anchors = {
  A1: `const MAX_PLAYERS: usize = 4;`,
  A2: `    seed_commit: String,
    players: Vec<Player>,
    started: bool,`,
  A3: `pub struct CreateReq {
    pub room: String,        // client-chosen id (same id posted to all nodes)
    pub wallet: String,      // creator wallet address
    pub seed_commit: String, // sha256 commitment to the game seed
}`,
  A4: `    // idempotent: re-create of an existing room with same seed_commit = ok (broadcast retry)
    if let Some(r) = map.get(&body.room) {
        if r.seed_commit == body.seed_commit {
            return HttpResponse::Ok().json(json!({"room": body.room, "existed": true}));
        }
        return HttpResponse::Conflict().json(json!({"error":"room exists with different seed"}));
    }`,
  A5: `        seed_commit: body.seed_commit.clone(),
        players: vec![Player { wallet: body.wallet.clone(), seat: 1, joined_at: t }],
        started: false,`,
  A6: `    if r.players.len() >= MAX_PLAYERS {
        return HttpResponse::Conflict().json(json!({"error":"room full"}));
    }`,
  A7: `    if body.roster.is_empty() || body.roster.len() > MAX_PLAYERS {
        return HttpResponse::BadRequest().json(json!({"error":"roster must have 1..4 wallets"}));
    }`,
  A8: `    HttpResponse::Ok().json(json!({
        "room": r.id,
        "created_at": r.created_at,
        "seed_commit": r.seed_commit,
        "players": r.players,
        "started": r.started,
        "move_count": r.moves.len()
    }))`,
};
for (const [k, a] of Object.entries(anchors)) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + k + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

s = s.replace(anchors.A1,
`const DEFAULT_MAX_PLAYERS: usize = 4;
const HARD_MAX_PLAYERS: usize = 8;`);

s = s.replace(anchors.A2,
`    seed_commit: String,
    game: String,
    max_players: usize,
    turn_deadline_secs: Option<u64>,
    players: Vec<Player>,
    started: bool,`);

s = s.replace(anchors.A3,
`pub struct CreateReq {
    pub room: String,        // client-chosen id (same id posted to all nodes)
    pub wallet: String,      // creator wallet address
    pub seed_commit: String, // sha256 commitment to the game seed
    #[serde(default = "default_game")]
    pub game: String,        // game label, e.g. "kascity", "fighter"
    pub max_players: Option<usize>,       // 1..8, default 4
    pub turn_deadline_secs: Option<u64>,  // echoed only; enforced by clients
}

fn default_game() -> String { "kascity".to_string() }`);

s = s.replace(anchors.A4,
`    let maxp = body.max_players.unwrap_or(DEFAULT_MAX_PLAYERS);
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
    }`);

s = s.replace(anchors.A5,
`        seed_commit: body.seed_commit.clone(),
        game: body.game.clone(),
        max_players: maxp,
        turn_deadline_secs: body.turn_deadline_secs,
        players: vec![Player { wallet: body.wallet.clone(), seat: 1, joined_at: t }],
        started: false,`);

s = s.replace(anchors.A6,
`    if r.players.len() >= r.max_players {
        return HttpResponse::Conflict().json(json!({"error":"room full"}));
    }`);

s = s.replace(anchors.A7,
`    if body.roster.is_empty() {
        return HttpResponse::BadRequest().json(json!({"error":"roster must not be empty"}));
    }`);

// roster length must respect the room's own max_players (checked after room lookup)
const A7b = `    r.touched_at = now();
    let incoming: Vec<String> = body.roster.clone();`;
if (s.split(A7b).length - 1 !== 1) { console.error("ABORT: anchor A7b not unique. File untouched."); process.exit(1); }
s = s.replace(A7b,
`    r.touched_at = now();
    if body.roster.len() > r.max_players {
        return HttpResponse::BadRequest().json(json!({"error":"roster exceeds room max_players"}));
    }
    let incoming: Vec<String> = body.roster.clone();`);

s = s.replace(anchors.A8,
`    HttpResponse::Ok().json(json!({
        "room": r.id,
        "game": r.game,
        "created_at": r.created_at,
        "seed_commit": r.seed_commit,
        "max_players": r.max_players,
        "turn_deadline_secs": r.turn_deadline_secs,
        "players": r.players,
        "started": r.started,
        "move_count": r.moves.len()
    }))`);

fs.writeFileSync(P, s);
console.log("OK: universal relay fields added (game label, per-room max_players 1..8, turn_deadline_secs echo)");
console.log("Next: cargo check");
