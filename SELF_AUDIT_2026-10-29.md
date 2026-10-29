# Self-Audit — 2026-10-29 (pre-mainnet)
Scope: full repo at branch tip. Automated sweeps + targeted review. The wallet is
self-custodial and unaudited by a third party; this is the maintainer-side pass.

## PASS
- **Secrets:** no private keys, mnemonics, API keys or passwords in the repo (pattern sweep, all file types).
- **Personal data:** maintainer email appears nowhere in app or game code.
- **Key rotation:** retired attest key powerless and unpinned; moderator key rotated — new pubkey consistent at all 5 enforcement sites; cold secret never stored.
- **Money-path guards intact:** sweep-all legal only to self or explicit flag; tx mass cap + batching; dust rules; pledged-balance floor; KV_TX_SIM simulation gate on user-facing sends and DApp pay requests.
- **WebView sandbox:** no key material injected into game pages; DApp payments route through the RN side with Face ID + simulation.
- **Publish gates:** game gate patterns intact; current KasCity showcase **passes** the offline gate (0 clipboard writes); DApp scan still requires an SDK import.
- **Dev tooling:** DEV tiles and probes behind __DEV__; cold-key QR file git-ignored (now committed repo-wide).
- **Types:** 100 pre-existing tsc errors, down from 115 at audit start; zero regressions from this cycle's features.

## FIXED IN THIS AUDIT
1. **KV_NET misses (real bug):** `VaultSetupScreen`, `GenerateVaultScreen`, `frost_complete.ts`
   still defaulted to `'testnet-10'` — vault/escrow creation would have targeted testnet after a
   mainnet flip. Now wired to `kv_net`.
2. **Stale patcher purge:** 13 one-time patchers/probes embedding the OLD moderator key deleted
   (rerunning one could have regressed the rotation). History retains them.
3. `.gitignore`: cold-key QR added at repo level (was only appended locally by the tool).

## NOTED / ACCEPTED
- `qrcode` is a local dev-only install (not in package.json); make_key_qr prints the install hint.
- Relay tests not re-run in this environment (compile exceeds session limits); source unchanged
  since last green 12/12 at v71.
- Remaining `'testnet-10'` literals are map keys, type unions, comparisons, tests and demos — correct.
- No third-party security audit (deliberate: open source + disclaimer + small-amounts guidance).

## STANDING PRE-MAINNET LIST
- Native-speaker review of the Kikongo / Twi / Yorùbá / Igbo renderings.
- Flux spec: confirm TOWNHALL_ATTEST_SK removed (relay falls back to unsigned canary by design).
- Flip via wire_mainnet_flip.cjs; republish games/stores on mainnet; relay mainnet env.

## Addendum — second pass (same day, pre-mainnet)
- REMOVED 4 personal Outlook header files ("Received from *.NAMP*.txt") that were tracked in the repo — personal email routing data, never belonged in git.
- REMOVED stale `modkey.pub.txt` (held the OLD moderator pubkey 0357e12a…; current key 0268c16d… lives in VillageMailbox/Workspace/kaspa_payload only).
- Scrubbed the literal dev email from a comment in wire_no_contact_leak.cjs.
- Fixed 3 more stray `= 'testnet-10'` defaults missed by pass 1: canonical_agreement_steps.ts (fetchFeeEstimate), stealth_watcher.ts (createStealthPayment), vault_generator.ts (deriveWallet) — all now default from kv_net. All known callers already passed network explicitly; this is defense in depth for the flip.
- Verified: zero private keys in tracked files (buyer/seller/harvest fixtures are pubkeys only); canary scanner returns unsigned verdict gracefully without TOWNHALL_ATTEST_SK (by design); KV_SWEEP_BATCH guard present; SNAIL_GATED touches no money screens; game-gate BLOCKED_PATTERNS intact; secret QR png gitignored and absent; tsc error count unchanged (100, none in touched files).
- Noted, left alone: duplicate "(1)/(2)" dev-history files (kascity_visual_v*, halo2 (1).rs, etc.) — clutter, not risk.
