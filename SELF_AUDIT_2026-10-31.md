# Self-Audit — 2026-10-31 (mainnet live)
Scope: branch sdk57-upgrade at 55ee5c0 + relay. Automated sweeps + four independent
review passes (money path & keys, recent features, Rust relay, WebView & publishing).
Every finding below was checked against the code before fixing.

## CRITICAL (found + fixed)
- **Leaked private key in the public repo:** `modkey_qr.png` (committed Oct 18) was a QR of the
  RETIRED moderator private key `0357e12a…`. Removed (29d2963), `*_qr.png` git-ignored. The current
  key `0268c16d…` was never exposed. The old key stays in git history: treat it as public forever.
  Builds from before the Oct 29 rotation still honour it.

## FIXED
Relay (v80):
1. Remote crash: `node_registry::verify_record` sliced an attacker string by bytes (`&o[2..]`) — one
   on-chain record could panic the registry, audit loop and game index. Now `strip_prefix`.
2. Remote crash: `kaspa_relay::hex_decode` byte-sliced user hex — one POST to submit-tx panicked a worker. Now `hex::decode`.
3. `/api/code/register` accepted any non-empty "signature" (baseline overwrite + unbounded map). Closed (410) unless `KV_CODE_REGISTER_OPEN=1`.
4. Operator announces ordered by signed `t` (replaying an old announce no longer wins); future-dated rejected.
5. Game index de-dupes per (publisher, head): copying a head can no longer claim or hide someone else's game.
6. Bond check sorts coins by size (dust can't hide a 10 KAS bond).
7. SSRF: operator URLs and canary scans resolve the host and refuse loopback/private/link-local/CGNAT/v4-mapped; no redirects; bodies streamed with a cap.
8. 60 s cache on `/api/nodes/registry` and `/api/games/index`; `?fresh=1` audits at most once a minute.
9. A bad-request 5xx no longer resets the shared mainnet connection (only transport errors do).
10. DKIM endpoint: headers capped at 256 KB, at most 5 signatures' keys fetched.

App:
11. Escrow double-fund: the 10 s poll ignored the persisted "already sent" marker; crash-recovery ignored the in-flight guard. Both now honoured.
12. Ambiguous submit: a timeout after the node accepted a tx was reported as "failed" (retry = pay twice). Now looks up the predicted txid first; otherwise warns "may still land".
13. Locked-funds floor applied to every sender — blocked pledge reclaims and vault sends while any IOU was open. Now main-wallet only.
14. Academic pledge nonces repeated every ~11.6 days and overlapped old game nonce bases → monotonic counter from 20000.
15. Network defaults: `kv_network` (never written) → `kvActiveNet()` in proposals/QR pay; vault_generator defaults → KV_NET; EntertainmentCenter chain games hardcoded testnet → KV_NET.
16. Operator tips: confirmation dialog; phone re-check now requires api+payout from a SIGNED registry announce and a challenge that is a registry coin older than ~30 h (a lying relay can't steer tips).
17. Archive reads: operator `block_time` (not covered by the txid hash) no longer used — time comes from the public UTXO DAA score; one 6 s deadline, parallel operators, body-covering timeouts, persisted misses, only KVP1 payloads cached.
18. Android shows max 3 Alert buttons — age pickers now two-step (17+ was unreachable).
19. DApp age approval keyed by id+rating (a re-rated DApp asks again).
20. Stats proof must be ABOUT the looked-up pubkey (public `pubkey_hash` = sha256(pubkey)) before showing verified.
21. Track record: deal dates from the SIGNED escrow DAA score (anchor/ts are unsigned); share sheet asks "Summary" vs "With signed bundle" and says what each reveals.
22. Moderator-removed games no longer play from the installed cache.
23. Listing links (Q&A / repository) open only `https:`/`mailto:`.

24. **FROST 2-of-2 now two-nonce (KV_MUSIG2)** for release, refund and kill: each signer sends (R1, R2); effective
    nonce R = R1agg + b·R2agg with b = H(tag, R1agg, R2agg, P, m) — defeats Wagner/ROS concurrent-session forgery
    (including across several agreements with the same key). Same pastes, same escrow address, standard BIP340
    signature on chain. Old one-nonce templates/answers are refused with an "update KasVillage" message.
    Tested: 311/311 checks (25 random wallet pairs, 1-4 inputs, refund + kill, independent BIP340 verify,
    old-format refusal). Vault 2-device signing converted too (see second pass).

## NEEDS A DECISION (not changed)
- **Dev relay host + `'unsafe-eval'` (HIGH):** a publisher's `relay` host joins the game's network allowlist, giving a game a data exit (e.g. a fake seed prompt). Options: per-host user consent, or moderator-approved hosts; drop `'unsafe-eval'` if games don't need it.
- **Apple 3.1.1 (HIGH for review):** iOS shows "N KAS / board", "send to the address on the card", and grants unlock items in-game. Hide price/contact/grant unlocks on iOS, or make boards free on iOS.
- **Head squatting (MEDIUM):** whoever announces a head first owns the card. Bind head → publisher (manifest signed by, or funded from, the announce key).
- **Moderator delist is per head (MEDIUM):** a 1-byte change = new head. Option: moderator delists also apply to the publisher key.
- **3-flag auto-hide with no appeal (MEDIUM):** ~30 KAS of reusable balance + 0.6 KAS hides any game. Existing decision (no arbitration); options: require flagger history/age, or time-locked stake.
- **Some sends skip simulation/Face ID:** IOU Pay & Settle, keeper tip.
- **Archive cache size:** capped per address but not globally (LRU).

## CHECKED CLEAN
- Secrets: no live keys (only the public BIP39 "abandon…about" test vector); no email in code.
- Key logging: boolean presence only. Keys never sent over network or into WebViews.
- txid/sighash/FROST sighash byte layouts match rusty-kaspa; nonce single-use with persisted flag.
- Sweeps, dust/mass rules, change tracking, address encode/decode round-trip.
- WebView: origin whitelist, navigation block, kv://pay behind Face ID + simulation (off on iOS), hash-verified fragments → manifest → head, verified-only game cache, CSP first.
- Relay: schnorr canon matches JS canonJson; rest_tx_id matches consensus; game_rooms body caps and sig skew; RSA key bounds; no secret logging.
- `wordSafeChunks` splits words inside BASE64 chunks to avoid false positives at the relay; the real content gate runs on the HTML before chunking — not evasion.
- Relay tests: 142/142 pass after fixes. App tsc: 97 errors, all pre-existing (none in touched code).

## Second pass — same day (after mainnet tests)
Mainnet proof with real coins, two-nonce signing: release `a0c38078…`, timeout refund `2a8518b9…`,
kill (both deals), cancel `206c9757…` (2.00 + 2.99832 in → 1.998004 buyer + 2.997006 seller, fee 0.00331).

Independent crypto review of KV_MUSIG2: correct vs MuSig2/BIP327 (nonce coefficient over the
aggregated nonces + x-only key + message; parity for P and R; order inside the MuSig2 model;
downgrade refused everywhere; no double-sign path). 780/780 randomized checks.

Fixed in this pass:
1. **Vault 2-device signing → two-nonce** (a 2-of-2 vault exists to survive one compromised device;
   a hijacked cosigner + dust could run the ROS forgery). Old-format templates/answers refused;
   k2 wiped with k. 150/150 vault checks.
2. Stored nonces must equal the template's R/R2 before signing (crash between two writes).
3. Cancelling counterparty nonce (point at infinity) → clear refusal instead of a raw throw.
4. Seller refund/kill nonces deleted outright if marking them used fails (matches the buyer path).
5. Regression in my double-fund fix: the shared in-flight guard was claimed after an `await`, so the
   poll and crash-recovery could still both fund; now claimed before any await, released on every
   failure (kept only when the tx "may still land"). Crash-recovery failures no longer stall the poll.
6. Regression: track-record dates read the signed escrowDaaScore, which callers sign as 0 → every
   date blank. Now: signed DAA → on-chain release anchor → phone clock (counted and labelled).
7. Regression: academic nonce counter restarted after reinstall (address reuse). Now clock-seeded from
   13,000,000 (above old academics and games), never goes backwards.
8. Regression: canary scanner stopped following redirects (3xx scored "clean"). Now follows up to 3 by
   hand, re-checking each hop for private/non-web targets.
9. SSRF guard DNS lookup capped at 3 s.
10. Age prompt on iOS has a Cancel again (two-step, ≤3 buttons for Android).
11. Agreements read the network from the agreement/active net, not the stale `kaspa_network` key
    (proposal blue score was testnet, pasted-pubkey counterparty address was `kaspatest:`).

## Third pass — same day (link whitelist, blocklist, IOU / wallet / Phone Proof areas)
Fixed:
1. **HIGH — IOU payment could go to a stranger.** IOUs named no recipient, and an acceptance from ANY key
   verified ("Signed by <unsigned name>"). New IOUs require the recipient's public key; an acceptance from
   any other key (or an old recipient-less IOU) is refused; the UI shows the signed key, not the name.
2. **HIGH — backslash whitelist bypass** (`https://evil.com\.youtube.com` read as youtube.com, opened as
   evil.com). Backslash, whitespace, control and non-ASCII characters are refused; host must be [a-z0-9.-].
3. **HIGH — relay SSRF / blocklist bypass with the same trick** (`http://169.254.169.254\@example.com`).
   The link checker and operator audits now parse URLs with the HTTP client's own (WHATWG) parser,
   refuse IP literals and user@ parts, and **pin each connection to the addresses that were checked**
   (closes DNS rebinding too).
4. **MEDIUM — IOU could be paid twice** (double tap, or retry after an ambiguous submit). One shared pay
   path: in-flight guard, persisted "paying" marker with the txid, closed-IOU check, confirm/simulation.
5. **MEDIUM — paying an IOU was blocked by its own lock** (needed ~2x the amount). The IOU being settled
   is excluded from the balance floor.
6. **MEDIUM — Phone Proof bundles could repeat one real deal** or be self-attested. Duplicate agreement /
   escrow ids and self-signed records are now errors.
7. LOW — accepting an IOU locked the recipient's own coins (they are OWED). No longer locked.
8. LOW — seed export told users to screenshot the words. Now: write by hand, never photograph.
9. LOW — link check request had no timeout (now 25 s); store buttons opened raw/untrimmed URLs
   (now normalised through the whitelist; bare `instagram.com/x` still works).

Still open (low / design):
- Phone Proof: owner can still drop records and re-chain (cp signs each record, not the chain) - fix
  needs the owner to sign the chain tip and/or an on-chain count anchor; frostAddr not re-derived.
- Whitelisted hosts with redirectors (l.facebook.com, youtube.com/redirect) - both show a warning page.
- Mnemonic restore doesn't run BIP39 checksum validation (typo restores an empty wallet).
Relay tests 143/143. App tsc: 97 (all pre-existing).

10. (follow-up) IOU / collateral locks are tagged with the wallet address that made them and only
    count against that wallet (KV_LOCK_SCOPE): tutorial locks no longer block mainnet sends. Rows from
    before this change carry no address and still count everywhere until they are settled or expire.
