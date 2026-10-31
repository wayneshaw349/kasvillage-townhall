# TownHall proofs — status (2026-10-30: DONE, shipped as relay v74)

Two sessions independently reached the same findings; this file documented the plan while
work was paused. The implementation now lives in:

- `src/townhall_verification_complete.rs` — chain-sourced stats (`scan_chain_escrows`,
  the Rust port of `counterparty_scan.ts` v2, address derivation tested against the dev
  wallet's real address), instance-bound stats / DApp / academic circuits, real
  `verify_proof`, `stats_instances` / `dapp_instances` / `academic_instances`.
- `src/dkim_verify.rs` — real RFC 6376 DKIM (RSA-SHA256 vs DNS key, DoH), academic policy
  (aligned From, academic d=, pubkey challenge in the signed Subject), dkimpy-conformant
  (15 fixtures in `tests/fixtures/dkim_cases.json`, regenerate with
  `tools/mk_dkim_fixtures.py`).
- Endpoints: `POST /api/verify/stats-check`, `/api/verify/dapp-check`,
  `/api/verify/academic-check` — anyone verifies a relayed proof against the published VK.

## One deliberate deviation from the original plan
The plan proposed in-circuit remainder witnesses for the floor divisions
(`p*(2+n) + r == (1+S)*SCALE`, `0 <= r < 2+n`). Without range-check lookups, `r < 2+n` is
not enforceable in-circuit, and an unconstrained remainder lets a prover shift `p` —
a soundness hole dressed as a gate. Instead: the division/saturation formulas are enforced
by every verifier in exact u64 arithmetic over the SAME bound public inputs, and the
circuits keep only the exact counting identities. Same guarantee, no fake rigor.

## What the proofs do NOT yet do (future, research-tier)
- In-circuit DKIM (zkEmail-style RSA inside the SNARK) and in-circuit scan execution:
  today those run outside the circuit on re-checkable public inputs, so a lying relay is
  CATCHABLE (re-derive the events root / re-run DKIM or the scan on the pinned data),
  not mathematically impossible.
- Enhanced p_complete is bound but its derivation uses non-public recency data; the basic
  p_complete is the verifiable one.

Phone Proof (dual-signed bundles + live chain scan) remains the peer-to-peer trust layer.
