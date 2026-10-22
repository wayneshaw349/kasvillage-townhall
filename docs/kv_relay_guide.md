# KasVillage multiplayer in 3 steps (developer guide)

Your game runs inside the KasVillage wallet. For multiplayer, you run one small
server — the **kv-relay** — and tell the wallet its address. The relay gives
your game rooms, turn order, a shared move log, cross-platform sync, and
seat-binding anti-cheat (each seat is locked to the wallet key that signed for
it). It keeps everything in memory; rooms expire on their own after 6 hours.

Your server, your responsibility: you are hosting your game's traffic and are
responsible for what runs on it. Real-money gambling is banned on KasVillage
and gets games delisted.

## 1. Deploy the image

The image is `wayneshaw349/kv-relay` (about 7 MB binary inside). It needs no
keys, no database, no disk. One setting: `PORT` (default 35816).

**Flux** (decentralized, runs on several machines):
- FluxOS → Apps → Register New App, with:
  - name: your app name, e.g. `mygamerelay` (this becomes your address)
  - repotag: `wayneshaw349/kv-relay:latest`
  - port 35816 exposed, container port 35816
  - environment: `PORT=35816` (do **not** set `KV_RELAY_HOSTS` — Flux machine
    addresses rotate)
  - cpu 0.5 / ram 500 MB / hdd 5 GB is plenty to start
- Your address is `https://<name>.app.runonflux.io`.

**Railway / Fly.io / any Docker host:** deploy the image, expose the port over
HTTPS. Your address is whatever HTTPS domain the host gives you.

**Your own machine + Cloudflare Tunnel:** `docker run -p 35816:35816
wayneshaw349/kv-relay` and point a tunnel at it. Free, but it is only up while
your machine is.

The wallet requires a public **HTTPS** host name — no plain http://, no bare
IPs, no ports in the address, nothing on a private network.

## 2. Connect it in the wallet

Workspace → games tab → **MP SERVER** → paste your address → **Test & Save**.
The wallet checks `/health`, creates a test room, and reads it back. Green
check = compatible.

## 3. Announce your game

Publish and ANNOUNCE as usual. The server address rides inside your signed
announce. Players' wallets then let **your game** talk to **your server** —
nothing else changes for them, and nothing of theirs is exposed to you: the
server only ever sees what the game sends it (room codes and moves).

## The rooms API your game speaks

The wallet injects `window` networking for allowed hosts; the game calls:

- `POST /api/game/room/create` `{room, wallet, seed_commit, game, max_players?}`
- `POST /api/game/room/{room}/join` `{wallet}`
- `POST /api/game/room/{room}/start` `{roster, turn_order?}`
- `POST /api/game/room/{room}/move` / `.../append` (signed; seat-bound)
- `GET  /api/game/room/{room}` and `.../log?after=N` and `.../turn`
- `GET  /health`

Signatures are added by the wallet automatically (KV_RELAY_V2, host-bound).
Limits: 500 rooms per instance, 4 MB per room, 128 KB per request, 6 h max
room age. Reads never extend a room's life.
