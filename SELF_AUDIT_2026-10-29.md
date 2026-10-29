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
