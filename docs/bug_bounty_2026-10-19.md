# Bug bounty sweep — 2026-10-19

3 audit rounds (4 parallel reviewers each) + `tsc --noEmit` + `cargo test`.
Patches, in order: `wire_wallet_hardening.cjs` → `wire_page_content_gate.cjs` → `wire_store_ready.cjs` → `wire_bugfix_batch1.cjs` → `wire_bugfix_batch2.cjs`.
Mainnet switch is deliberately NOT included (next step).

## Fixed
- Auth: Face ID cancel / boot error / recovery Cancel / "New identity" / vault cards can no longer reach the wallet without unlock + quiz; quiz attempts survive app kill; re-lock after 5 min in background (returns to same screen); backup cards + seed export need fresh auth; PIN-only phones handled; restore asks before replacing a wallet.
- Money: address checksum + same-network check; 0 / dust amounts to others refused (kv://pay rounding no longer sends a whole coin); explicit `sweepAll` for pledge withdraw; KIP-9 storage mass per rusty-kaspa; dust 600 sompi; relay txid must match the predicted txid; delist sends 0.2 KAS not the balance; reposts/flags/grants 0.2 KAS (0.1 hit the storage-mass limit).
- Keys: resolved private key must match the stored pubkey; wallet create/restore always stashes the previous wallet (rolling 5); raw-key wallets never silently deleted; createWallet network consistent; stealth sends disabled; mock release / malformed neighbor lock now throw.
- Vault cosigner: shows every recipient + real fee; refuses inflated fees; small vault-emptying sends work.
- FROST: one-use nonces (buyer + seller) with signed-tx reuse on retry; chain check before re-funding (no double fund); kill tx saved before pending record is deleted; template amounts/fee verified against escrow + agreed split; paste step guard; in-flight locks; relay messages random nonce + HMAC, no unauthenticated fallback.
- IOU: acceptance signs pay-to address; full pubkey match; closed IOUs can't be re-pasted; createdAt hashed; countersign dedupe; amount >= 600 sompi.
- Stat records v2 (escrow txid, timeout, description bound); TownHall Schnorr signatures; academic/service send their ts.
- Chain content: only signed chunks, owner-filtered when known, candidate assembly by chain order until the hash matches (junk tx can't break installs); decompression caps; walk only accepts txs paying the expected address (relay block feed now includes outputs); fragment walks use coordinates.
- Listings: game cards and store directory: signed only, first-seen (oldest) owner per head/address, provable funder wins disputes, delists per signer, `_bv` internal flag stripped from chain JSON.
- Flags: flagger qualifies by own address balance or provably funded store, signatures checked, network checks capped (stop at 3 qualified), errors not cached.
- Content filter: entity decode, tag-split tricks, depth 64, display-side gate; page CSP always injected at the top (comment/attribute tricks).
- Games bridge: redirects can't leave the allowlist; clipboard guard; relay requests signed (V2: host + method + path + body hash + time) only for chain games.
- Relay (Rust): seats bound to signing wallets; seat ownership for moves + snapshots; opener only after the roll-off and only the derived one; start rules (creator / joined members / host whose create missed a node / unsigned reseed); gun only from host before first move; GETs don't extend rooms; 6 h max age; byte budgets; 128 KB body limit; checked math; no lock-poison panics.
- Misc: Mailbox copy buttons; mainnet-aware pledge/span lookups; publish double-tap locks; store cost dialog includes page chunks; config hash computed last; spinner reset; "Delete seed" deletes; sompi rounding; comma decimals.

## Known residuals (low)
- Set `KV_RELAY_HOSTS` (each node's public ip:port + domain) on the Flux relay so signed requests can't be replayed to another node with a forged Host header.
- Relay + wallet must deploy together (old V1 signatures count as unsigned).
- Before start, anyone with the room code can start a node early with the joined roster (no more power than a member).
- Change up to 0.2 KAS is folded into the fee when keeping it would break the storage-mass limit.
- A funding tx still in the mempool isn't visible to the REST check (a conflicting rebuild, not a double fund).
- `test_snail_mode_status` in src/main.rs fails (pre-existing, unrelated).
- `node_registry.ts` calls `sendKaspaViaRest` with unsupported args (pre-existing, already broken).
- `fetchDAppAttest` still picks the newest complete set at a dapp address.
