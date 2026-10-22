// kv_relay — the slim KasVillage game relay for third-party developers.
//
// Game rooms only: rooms, turn order, the move log, seat-binding anti-cheat
// (KV_RELAY_V2 signatures), roll-off rules, byte budgets, 6 h room age.
// No TownHall, no keys, no disk state — everything lives in memory and
// expires on its own. Deploy it anywhere with a public HTTPS front
// (a Flux app, Railway, Fly.io, a box behind a Cloudflare Tunnel, ...) and
// paste that address into the wallet's MP SERVER field (Workspace → games).
//
// Settings (environment variables):
//   PORT           listen port (default 35816)
//   KV_RELAY_HOSTS optional comma list pinning the host names accepted in
//                  signatures; leave UNSET on Flux (node addresses rotate)
//   RUST_LOG       log level (default info)
#[path = "../game_rooms.rs"]
mod game_rooms;

use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use serde_json::json;

async fn health() -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "service": "kv-relay",
        "version": env!("CARGO_PKG_VERSION"),
        "mode": if cfg!(debug_assertions) { "dev" } else { "release" },
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(35816);
    log::info!("kv-relay listening on 0.0.0.0:{port}");
    HttpServer::new(|| {
        App::new()
            .route("/health", web::get().to(health))
            .configure(game_rooms::configure)
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
