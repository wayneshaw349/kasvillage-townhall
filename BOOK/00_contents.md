# The KasVillage Book
### Learn computer science from the wallet you built

Built first, understood second - that's the order AI makes possible, and it's a fine
way to learn. Each chapter takes one real file from this repo and walks through what
it does and *why*, in plain language. Read with the file open beside you.

**Chapter 0 - The Grammar** - how to read and write a line of TypeScript, using lines from this repo

## Part I - Money (the core)
1. **The Money Pipe** - `kaspa_rest_tx.ts` - what a transaction really is: coins in, coins out, nothing else
2. The Vault - `kasvillage_cold_wallet.tsx` - hot vs cold keys, and why two signatures beat one
3. The Handshake - `canonical_agreement_steps.ts` - FROST 2-of-2 escrow: strangers trusting math instead of each other
4. The Simulation - `tx_preview.ts` - reading a transaction out loud before you sign it

## Part II - Truth (the chain as a database)
5. Records on a Coin - `kaspa_payload.ts` - how a payment carries a signed message
6. Publishing a Game - `payload_publish.ts` + `game_chunks.ts` - cutting an HTML file into chunks a chain can hold
7. The Mailbox - `mailbox_kaspa_api.ts` - a search engine where rank is staked, not bought
8. Reputation - `stat_records.ts` + `counterparty_scan.ts` - hash chains, dual signatures, and proving your history to a stranger

## Part III - People (the app)
9. The Front Door - `AppNaviagator.tsx` - screens as a state machine
10. The Slow Lane - `snail_rule.ts` - one small file that is pure policy
11. Streamer Mode - `streamer_mode.ts` - global state, subscribers, and masking
12. The Sandbox - `OnChainPageView.tsx` - running untrusted code safely inside your own app

## Part IV - The Relay (Rust)
13. Rooms and Turns - `src/game_rooms.rs` - why multiplayer needs a referee
14. The ZK Module - `src/halo2_snark_module.rs` - proving something is true without showing it

*Each chapter ends with "What this teaches you" - the general CS idea hiding in the specific code.*
