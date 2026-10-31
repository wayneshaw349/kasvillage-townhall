# TownHall stats SNARK — findings + plan (paused 2026-10-30)

## What's wrong today
1. **Proof not bound to the numbers.** The circuit declares an instance column but never
   calls `constrain_instance`, and `create_proof` is given empty instances (`&[&[&[]]]`).
   The proof says "a valid witness exists", not "pubkey X has these stats".
2. **Gates don't match integer math.** `p_complete_basic` checks `p*(2+S+F) == (1+S)*SCALE`
   and `confidence_blend` / `enhanced_factors` check exact products, but the witness
   values come from floor division. Most real proofs fail and silently fall back to a
   SHA-256 hash with proof_type `Hash-V2-ERR:...`.
3. **App never verifies the proof.** `counterparty_lookup.ts verifyStatsProofLocally` only
   re-checks the XP formula, yet the UI shows "✓ ZK Verified".
4. **Not network-aware.** `KASPA_API` is hardcoded to api-tn10; Arweave records are not
   filtered by `KV-Network`.
5. **No Arweave on mainnet.** Stats must come from the Kaspa chain itself.

## Plan
- [x] `src/kaspa_chain_stats.rs`: Rust port of `counterparty_scan.ts` v2 (same rules:
      exact-2 funders, busy-address filter, kill = self-pay, settled/deadlocked/open),
      pubkey -> address derivation, network-aware. NOT yet in `main.rs` (`mod` line pending).
- [ ] Witness from the chain scan (successes=settled, deadlocks=deadlocked, pending=open;
      refund vs release and roles/reasons are not on chain: reason_other=deadlocks,
      roles neutral, documented in the API response).
- [ ] Gates: add remainder witnesses (`p*(2+n) + r == (1+S)*SCALE`, `0 <= r < 2+n`) so
      floor division is provable; same for the blend/factor gates.
- [ ] Public inputs via `constrain_instance`: pubkey-hash limbs, events-root limbs,
      successes, deadlocks, xp, p_basic, p_enhanced, total; pass them to `create_proof`.
- [ ] Real `verify_proof` (VerifierIPA + SingleStrategy) + `POST /api/verify/stats-proof`.
- [ ] App: recompute successes/deadlocks with `counterparty_scan` and require they match
      the proof's public inputs; label "ZK Verified" only when both checks pass.
- [ ] Bump relay to v74, new VK fingerprint at `/api/verify/stats-vk`.

Until then: **Phone Proof (dual-signed bundles + live chain scan) is the trust layer.**
