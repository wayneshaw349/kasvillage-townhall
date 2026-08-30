// fix_seats_game_rooms.cjs — deterministic seats via authoritative roster at /start
// Problem observed in smoke test: per-node join order assigns different seats on
// different stateless nodes. Fix: join registers wallets (seat provisional);
// /start accepts {"roster":["w1","w2",...]} and overwrites players with seats 1..N
// identically on every node. Idempotent: re-posting the same roster is a no-op;
// a different roster after start is rejected.
const fs = require("fs");
const P = "src/game_rooms.rs";
let s = fs.readFileSync(P, "utf8");

if (s.indexOf("pub struct StartReq") !== -1) {
  console.error("ABORT: roster start already applied. File untouched.");
  process.exit(1);
}

// anchor 1: JoinReq struct (add StartReq after it)
const A1 = `#[derive(Deserialize)]
pub struct JoinReq {
    pub wallet: String,
}`;
// anchor 2: whole start_room handler
const A2 = `async fn start_room(path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let mut map = ROOMS.lock().unwrap();
    let Some(r) = map.get_mut(&id) else {
        return HttpResponse::NotFound().json(json!({"error":"no such room"}));
    };
    r.touched_at = now();
    r.started = true; // idempotent
    HttpResponse::Ok().json(json!({"room": id, "started": true, "players": r.players}))
}`;
// anchor 3: route line
const A3 = `.route("/room/{id}/start", web::post().to(start_room))`;

const norm = t => t.replace(/\r\n/g, "\n");
const sN = norm(s);
for (const [i,a] of [[1,A1],[2,A2],[3,A3]].map(([i,a])=>[i,norm(a)])) {
  const c = sN.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor "+i+" count "+c+" (expected 1). File untouched."); process.exit(1); }
}
// work on normalized then keep LF (file is LF from creation)
s = sN;

s = s.replace(norm(A1), norm(A1) + `

#[derive(Deserialize)]
pub struct StartReq {
    pub roster: Vec<String>, // ordered wallets; index+1 = seat; same list broadcast to every node
}`);

s = s.replace(norm(A2), `async fn start_room(path: web::Path<String>, body: web::Json<StartReq>) -> HttpResponse {
    let id = path.into_inner();
    if body.roster.is_empty() || body.roster.len() > MAX_PLAYERS {
        return HttpResponse::BadRequest().json(json!({"error":"roster must have 1..4 wallets"}));
    }
    let mut map = ROOMS.lock().unwrap();
    let Some(r) = map.get_mut(&id) else {
        return HttpResponse::NotFound().json(json!({"error":"no such room"}));
    };
    r.touched_at = now();
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
}`);

fs.writeFileSync(P, s);
console.log("OK: /start now takes authoritative roster; seats deterministic across nodes");
console.log("Next: cargo check");
