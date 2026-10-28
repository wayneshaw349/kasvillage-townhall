# Chapter 1 - The Money Pipe
### File: `kaspa_rest_tx.ts` (~1,300 lines, the most important file in the wallet)

Every KAS that ever leaves your wallet goes through one function in this file:
`sendKaspaViaRest()`. Understand this file and you understand how all crypto
actually works under the hood.

## 1. There is no "balance" - there are coins
Your wallet doesn't hold a number like a bank account. It holds **UTXOs** -
"unspent transaction outputs." Think of them as physical coins of odd sizes:
you might "have 706 KAS" as one big 706-coin, or as 300 tiny ones.
The first thing `sendKaspaViaRest` does is ask a public Kaspa API:
*"what coins does this address own right now?"* (the `fetch(.../utxos)` call).

## 2. A transaction is just: melt coins, pour new ones
To send 25 KAS when you hold a 706-coin, you can't snap off a piece.
You melt the whole coin and pour out new ones:
- one 25-KAS coin addressed to the person you're paying (**the output**)
- one ~681-KAS coin addressed back to yourself (**the change**)
- a sliver left unpoured - that's **the fee**, and whoever mines the block keeps it.
In the code: `outputsData` is the pouring plan; `change` is computed as
`selectedAmount - sendAmount - fee`.

## 3. Dust - coins too small to be worth picking up
A 0.000001 KAS coin costs more in future fees to spend than it's worth.
The code calls these **dust** (`isDust()`) and refuses to create them; tiny change
gets absorbed into the fee instead (`fee += change`). Lesson: systems need rules
about values too small to matter, or they fill up with garbage.

## 4. Mass - why a transaction can be "too heavy"
Every input you melt makes the transaction physically bigger (more bytes to sign
and store). Kaspa caps a transaction's **mass** at 100,000 (`MAXIMUM_STANDARD_TX_MASS`).
Remember the pledge reclaim that failed with "mass 366092"? That was this rule:
hundreds of tiny coins melted at once made a transaction four times too heavy -
so we batch (`KV_SWEEP_BATCH`): melt ~80 coins per transaction, repeat until done.
Lesson: real systems have size limits, and good code works *with* them, not against them.

## 5. The fee auction
Fees aren't fixed. The code asks the network for the going rate
(`fetchFeeEstimate`), then runs a loop: pick coins -> compute mass -> compute fee ->
did the fee change which coins we need? -> repeat (up to 3 times). This
"estimate, adjust, re-estimate" loop is a classic pattern - you'll meet it again
anywhere a cost depends on the thing it's charging for.

## 6. Signing - proving it's you without showing your secret
Each melted coin must be signed. The code builds a **sighash** - a fingerprint
of the ENTIRE transaction (every input, every output, the fee, everything) -
then signs that fingerprint with your private key (`schnorr.sign`).
Two things follow, and they're the heart of all cryptocurrency:
- Nobody can alter the transaction after signing (any change breaks the fingerprint).
- Anybody can VERIFY the signature with your public key, but nobody can FORGE it
  without the private key. One-way math. That's the whole trick.

## 7. Broadcast - and why double-spends bounce
The signed transaction goes to a Kaspa node (`_wrpcSubmit`). The node checks:
do these coins exist, and has anything else already melted them? If another
pending transaction grabbed the same coin, you get *"already spent in the mempool"*
- which you've seen live. The **mempool** is the waiting room between
"sent" and "sealed into a block."

## 8. The guards we added
- `KV_TX_SIM` (chapter 4): before signing, a human-readable preview - and a human tap.
- Balance floor: coins pledged as collateral can't be accidentally spent.
- `KV_SWEEP_ALL`: "send everything" is only legal to yourself or with an explicit flag,
  so a rounding bug can never silently empty a wallet to a stranger.

## What this teaches you
**UTXO model** (vs account model) · **hashing as fingerprinting** ·
**public-key signatures** · **resource limits (mass) and batching** ·
**feedback loops (fee estimation)** · **defensive programming (dust, floors, flags)**.
Every other chapter builds on these six ideas.
