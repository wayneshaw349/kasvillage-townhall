# Bug bounty sweep — 2026-10-19

Four parallel reviews (money/signing, publish/chain, FROST/IOU, app shell + Rust relay) + `tsc --noEmit`.
Fixed by `wire_bugfix_batch1.cjs` = **FIXED**. Everything else is open.

## Critical / high
| # | Area | Bug | Status |
|---|------|-----|--------|
| 1 | Auth | Cancel Face ID -> onboarding -> reuses wallet, rewrites quiz answers, opens dashboard | FIXED (A: Locked screen) |
| 2 | Money | Recipient address checksum never checked (1 typo = burned funds) | FIXED (B) |
| 3 | Money | Recipient on other network accepted | FIXED (B) |
| 4 | Money | Store delist sent whole balance (amount 0 = send all) | FIXED (C) |
| 5 | Money | Pledge withdraw always "Insufficient balance" (fee headroom too low) | FIXED (C) |
| 6 | IOU | Acceptance did not sign pay-to address; prefix pubkey match ("0" matches all) | FIXED (D) |
| 7 | IOU | Re-pasting an acceptance pays twice | FIXED (D) |
| 8 | Games | Unsigned game listings accepted; another key could take over a card / un-hide a delist | FIXED (E) |
| 9 | Pages | CSP disabled by `<!--<head>-->` | FIXED (F) |
| 10 | Wallet | Raw-key wallet deleted with no prompt on network mismatch | FIXED (K) |
| 11 | FROST | Seller refund nonces reused after a failed funding -> buyer can compute seller key | OPEN - agreement flow, needs Wayne's OK |
| 12 | Vault | Cosign screen shows only first recipient; 2nd output / fee hidden | OPEN |
| 13 | Chain | One dust tx with junk chunk (newest t wins) breaks fresh downloads of any game/store | OPEN |
| 14 | Mod | Fake flaggers: "qualified" = claims a rich store address, not proven | OPEN |
| 15 | Relay | Seats not bound to wallets; anyone can post moves for any seat | OPEN (needs signed moves) |
| 16 | Relay | Opener can be re-declared mid-game; anyone can /start a room first | OPEN |
| 17 | Relay | Rooms never expire while polled (cap DoS); i64 overflow bypasses cash caps | OPEN |
| 18 | Wallet | Any storage read error -> onboarding overwrites keys without stash | OPEN |

## Medium / low
| Bug | Status |
|-----|--------|
| Mailbox copy buttons dead (`Clipboard.setString` removed) | FIXED (G) |
| Mainnet: pledge / walk-span lookups hard-wired to api-tn10 | FIXED (H) |
| Store publish spinner stuck after content block | FIXED (I) |
| "Delete seed" did not delete | FIXED (I) |
| 0.29 KAS sent as 0.28999999 (SendKAS) | FIXED (J) — NeighborAgreement/proposal floats still OPEN |
| Game network redirect escapes allowlist | FIXED (L) |
| Store config hash computed before config final | OPEN |
| Fragment fetch never uses walk coordinates | OPEN |
| Double tap can publish twice | OPEN |
| Store cost dialog omits page chunks | OPEN |
| `_kvResolvePrivHex` decrypt fallback returns a wrong key | OPEN |
| `createWallet()` w/o network: mainnet address stored as testnet-10 | OPEN |
| Payload tx success trusted from relay (no txid check) | OPEN |
| Dust threshold formula (+148 term) | OPEN |
| Quiz attempts reset by killing the app; no re-lock on resume; backup cards w/o re-auth | OPEN |
| Restore keeps only one prev-wallet stash | OPEN |
| stat_records chain can be rewritten by owner; TownHall "signature" is a hash | OPEN |
| Encrypted relay: static keystream, no MAC (path disabled) | OPEN |
| Proposal nonce via Math.random | OPEN |
| Content filter: entity/tag-split bypass, no display-side filter, depth > 8 skipped | OPEN |
| Stealth "PO Box" send drops ephemeral key (hard to reach) | OPEN |
