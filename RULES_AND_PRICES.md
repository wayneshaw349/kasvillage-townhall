# KasVillage — Rules & Prices (for humans and their AIs)

One page: everything needed to build and publish. Check your work offline with
`node scan_check.cjs game|dapp <file>` — the in-wallet scan is authoritative.

## The human rule
AI can build here; only a human can act here. Every publish is signed with Face ID and
staked with the publisher's own KAS; every spend passes an on-device transaction
simulation; moderation needs a cold key a human physically holds. No autonomous
publishing, spending or moderation — by design.

## Lanes
| Lane | What | Scan | Pledge |
|---|---|---|---|
| **Game** | Self-contained HTML, published in chunks on Kaspa L1 | Game gate (below) | Chunk dust across fragments (~2.5 KAS per fragment; KasCity ≈ 67 fragments ≈ ~170 KAS). **Reclaimable** via Profile → My Pledges when you retire the post. |
| **DApp** | JS built on the SDK, registered + attested | DApp scan (below) | 5 KAS anchor |
| **Store / Service** | Storefront listing | Content scan | 5 KAS |
| **Academic** | Research abstract | Content scan | 1 KAS |

## Game gate (publish-time, mirrors `html_chunks.ts`)
Blocked: seed/recovery-phrase or mnemonic prompts · `setApprovalForAll` · obfuscated
`eval`/`Function`/`document.write` (atob/unescape) · `<iframe>` · clipboard writes ·
**any network call** (`fetch`, XHR, sendBeacon) · external `<script src>` · **any image**
(`<img>`, `data:image/`, base64-embedded) · any external `href/src/action`.
Allowed: `kv://` links, `#anchors`, `data:audio/`, `data:font/`. Graphics must be procedural
(canvas/SVG drawn in code). One file, everything inline.

## DApp scan (mirrors `procedural_sdk.ts` → `scanDAppCode`)
- **Must import ≥1 SDK module** (`procedural_sdk`, `kasvillage_game_v1`, `kasvillage_canvas_renderer`,
  `kasvillage_avatar_engine`, `kasvillage_wallet_bridge`, …). No import = fail.
- Critical: `<img src>` · camera (`getUserMedia`) · iframes · fetching image files · photo uploads.
- High: `innerHTML`/`outerHTML` assignment · `document.write` · `insertAdjacentHTML` · `eval`.
- Network: use `kvFetch()`; allowed domains: `api.kaspa.org`, `api-1.kaspa.org`, `arweave.net`,
  `ar-io.net`, `node.irys.xyz`, `up.arweave.bundlr.network`, `api.spotify.com`, localhost/LAN,
  plus your own domain registered at submission. CDNs for libraries (no images):
  `fonts.googleapis.com`, `fonts.gstatic.com`, `cdnjs.cloudflare.com`, `unpkg.com`,
  `cdn.jsdelivr.net`, `esm.sh`.

## Getting the engine
Tap any module chip in Workspace (copies the GitHub raw URL — paste into your AI), or grab
everything at once: `kasvillage_sdk_complete.zip` · manual: `kasvillage_engine_manual_rev2.md`
(both in this repo). Template: Workspace → Copy Integration Template.

## Ranking (how listings order in the Mailbox)
- Full pledge points at 5 KAS staked (more KAS ≠ more rank).
- Stores/Services: pledge 25% · freshness 35% (7-day half-life) · deal activity 20% · dev XP 20%.
- DApps/Academics: pledge 30% · freshness 50% · dev XP 20%.
- DApp boards by stake: **Elite ≥ 500 KAS** · **Main ≥ 100** · **Incubator** below.
- XP: +10 per settled escrow deal, −50 per deadlock (full bar at 500).

## Trust & moderation
- 3 community flags auto-delist a listing in every wallet (flags expire with pruning, ~30–40 h);
  a moderator can delist with the reason published on-chain; owners are notified in-app.
- Games/DApps receive a read-only `window.KV_TRUST = { snail, waitMs, newUser }` — respect it.
- Pruning: saved copies keep games alive; any holder can repost (keep) a pruned game — content
  is re-verified against the original hash, so reposts can't be tampered.

## Publish flow (human steps)
1. Build (AI welcome) → 2. `node scan_check.cjs …` until it passes → 3. Workspace →
scan/publish → 4. Face ID → 5. pledge staked → 6. live in the Mailbox, hash-verified, sandboxed.
Testnet-10 KAS comes from the Kaspa community faucet.

## XP - one ladder everywhere (KV_XP_ONE_LADDER)
Earn: +10 per settled escrow deal. Lose: -50 per deadlock (everywhere: wallet, relay, ranking).
No XP for posting, chatting or playing - only completed commerce a counterparty co-signed.
Anyone can re-derive your XP from the chain; the number on your profile is the number the world computes.

Tiers (status): Base 0 -> Verified 200 -> Custodian 500 -> Sentinel 1000 -> Archon 2000.
At 500 (Custodian) you are also Elite (priority processing) and at FULL RANKING WEIGHT:
XP's share of Mailbox rank maxes out at 500 by design, so reputation whales cannot bury
fresh builders - Sentinel and Archon are prestige and trust signals, not extra rank.
