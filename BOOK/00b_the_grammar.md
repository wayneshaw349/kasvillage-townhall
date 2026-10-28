# Chapter 0 - The Grammar
### How to read (and write) a line of TypeScript, using lines from your own wallet

Code is sentences. Every line has a subject, a verb, and punctuation with exact meaning.
Learn these ~15 patterns and you can read 95% of this repo.

---
## 1. Making a box and putting something in it
```ts
const fee = 10000n;
let selectedAmount = 0n;
```
- `const` = a box whose contents never get swapped ("constant"). `let` = a box you may refill.
- `=` is NOT "equals" - it's an arrow: *put the right side into the left box.*
- `10000n` - the `n` makes it a **BigInt**: a whole number that can be astronomically large
  without rounding. Money math uses BigInt everywhere in this wallet, because `0.1 + 0.2`
  in normal numbers is 0.30000000000000004 - fine for a game score, a disaster for KAS.


<details><summary>▶ <b>Press here — see it live in the wallet</b> (kaspa_rest_tx.ts, line 518)</summary>

[Open the real line on GitHub →](https://github.com/wayneshaw349/kasvillage-townhall/blob/6b4e58d2fceebc182cf6e00687f085c2ba98c478/kaspa_rest_tx.ts#L518)

```ts
let fee = 10000n; // Initial estimate
let selectedUtxos: UtxoResponse[] = [];
let selectedAmount = 0n;
```
</details>

## 2. The type label (the "Script" in TypeScript)
```ts
const address: string = 'kaspatest:qp75...';
function isDust(valueSompi: bigint, scriptLen: number): boolean
```
- After a name, `: string` is a label on the box: only text goes in here.
- On a function, the LAST `: boolean` labels what comes OUT (true/false).
- Why bother? The computer proof-reads you: put a number in a text box and
  `tsc` (our type-checker) refuses before the bug reaches a phone.


<details><summary>▶ <b>Press here — see it live in the wallet</b> (kaspa_rest_tx.ts, line 249)</summary>

[Open the real line on GitHub →](https://github.com/wayneshaw349/kasvillage-townhall/blob/6b4e58d2fceebc182cf6e00687f085c2ba98c478/kaspa_rest_tx.ts#L249)

```ts
export function isDust(valueSompi: bigint, scriptLen: number): boolean {
  // takes a coin value + script size, answers true/false: too small to bother?
```
</details>

## 3. Functions - a machine with a slot in and a slot out
```ts
export function kvPledgeScore(pledgeKas: number): number {
  return Math.min(Math.max(pledgeKas || 0, 0) / KV_PLEDGE_FULL_KAS, 1);
}
```
- `function name(ingredients): result-type { recipe }`.
- `return` = "the answer is - and we're done."
- `export` = other files may import and use this machine.
- `pledgeKas || 0` = "pledgeKas, or 0 if it's empty" - a seatbelt against missing data.
- Read the math inside-out: clamp below at 0, divide by 5, clamp above at 1.
  A sentence: "turn any pledge into a score between 0 and 1, full marks at 5 KAS."


<details><summary>▶ <b>Press here — see it live in the wallet</b> (mailbox_kaspa_api.ts, line 60)</summary>

[Open the real line on GitHub →](https://github.com/wayneshaw349/kasvillage-townhall/blob/6b4e58d2fceebc182cf6e00687f085c2ba98c478/mailbox_kaspa_api.ts#L60)

```ts
export function kvPledgeScore(pledgeKas: number): number {
  return Math.min(Math.max(pledgeKas || 0, 0) / KV_PLEDGE_FULL_KAS, 1);
}
```
</details>

## 4. The arrow function - same machine, shorter grammar
```ts
const kas = (s: bigint) => (Number(s) / 1e8).toFixed(2);
```
- `(input) => output`. Say it as "s becomes...".
- `1e8` = 1 with 8 zeros. Kaspa stores **sompi**; 100,000,000 sompi = 1 KAS -
  so this one-liner is the sompi-to-KAS converter you see everywhere.


<details><summary>▶ <b>Press here — see it live in the wallet</b> (tx_preview.ts, line 14)</summary>

[Open the real line on GitHub →](https://github.com/wayneshaw349/kasvillage-townhall/blob/6b4e58d2fceebc182cf6e00687f085c2ba98c478/tx_preview.ts#L14)

```ts
const kas = (s: bigint) => (Number(s) / 1e8).toLocaleString(undefined, { maximumFractionDigits: 4 });
```
</details>

## 5. async / await - "this takes a while; wait here"
```ts
const resp = await fetch(`${API_BASES[network]}/addresses/${senderAddress}/utxos`);
const utxos = await resp.json();
```
- Talking to the internet isn't instant. `await` = pause THIS recipe until the answer
  arrives (the rest of the app keeps running). Any function that uses `await` must be
  marked `async`.
- The backticks \` make a **template string**: `${...}` drops a value into the text.
  Here it builds a URL like `https://api-tn10.kaspa.org/addresses/kaspatest:q.../utxos`.


<details><summary>▶ <b>Press here — see it live in the wallet</b> (kaspa_rest_tx.ts, line 468)</summary>

[Open the real line on GitHub →](https://github.com/wayneshaw349/kasvillage-townhall/blob/6b4e58d2fceebc182cf6e00687f085c2ba98c478/kaspa_rest_tx.ts#L468)

```ts
const resp = await fetch(`${API_BASES[network]}/addresses/${senderAddress}/utxos`);
if (!resp.ok) throw new Error(`UTXO fetch failed: ${resp.status}`);
const utxos: UtxoResponse[] = await resp.json();
```
</details>

## 6. Objects - a labeled bag of values
```ts
return { success: false, error: 'Amount too small' };
const { senderAddress, recipientAddress } = params;
```
- `{ name: value, ... }` is a bag. Line 2 is **destructuring**: reach into the bag
  `params` and pull out just the two things you need, by name.


<details><summary>▶ <b>Press here — see it live in the wallet</b> (kaspa_rest_tx.ts, line 456)</summary>

[Open the real line on GitHub →](https://github.com/wayneshaw349/kasvillage-townhall/blob/6b4e58d2fceebc182cf6e00687f085c2ba98c478/kaspa_rest_tx.ts#L456)

```ts
const { senderAddress, recipientAddress, amountSompi, privateKeyHex, network, payload } = params;
```
</details>

## 7. Arrays and the three verbs you'll see constantly
```ts
const inputValues = selectedUtxos.map(u => BigInt(u.utxoEntry.amount));
const bad = recs.filter(r => !verifyRecord(r));
let total = 0n; for (const u of utxos) total += BigInt(u.amount);
```
- `.map` = transform every item (coins -> just their amounts).
- `.filter` = keep only the items that pass a test.
- `for (const u of utxos)` = "for each coin u in the pile..." - the plain loop.


<details><summary>▶ <b>Press here — see it live in the wallet</b> (kaspa_rest_tx.ts, line 548)</summary>

[Open the real line on GitHub →](https://github.com/wayneshaw349/kasvillage-townhall/blob/6b4e58d2fceebc182cf6e00687f085c2ba98c478/kaspa_rest_tx.ts#L548)

```ts
const inputValues = selectedUtxos.map(u => BigInt(u.utxoEntry.amount));
```
</details>

## 8. if / ternary - forks in the road
```ts
if (selectedAmount < totalNeeded) return { success: false, error: 'Insufficient balance' };
const net = addr.startsWith('kaspa:') ? 'mainnet' : 'testnet-10';
```
- `condition ? A : B` is a one-line if: "kaspa:? then mainnet, else testnet."
- Returning early on the bad case ("guard clause") keeps recipes flat and readable.


<details><summary>▶ <b>Press here — see it live in the wallet</b> (kaspa_rest_tx.ts, line 540)</summary>

[Open the real line on GitHub →](https://github.com/wayneshaw349/kasvillage-townhall/blob/6b4e58d2fceebc182cf6e00687f085c2ba98c478/kaspa_rest_tx.ts#L540)

```ts
if (selectedAmount < totalNeeded) {
  return { success: false, error: `Insufficient balance: have ${selectedAmount} sompi, need ${totalNeeded}` };
}
```
</details>

## 9. try / catch - the safety net
```ts
try { return JSON.parse(raw).records || []; }
catch { return []; }
```
- "Attempt this; if it explodes, don't crash the app - do the backup plan."
- `JSON.parse` turns text into an object (and throws if the text is garbage) -
  its twin `JSON.stringify` goes the other way. Every chain record rides through these.


<details><summary>▶ <b>Press here — see it live in the wallet</b> (tx_preview.ts, line 69)</summary>

[Open the real line on GitHub →](https://github.com/wayneshaw349/kasvillage-townhall/blob/6b4e58d2fceebc182cf6e00687f085c2ba98c478/tx_preview.ts#L69)

```ts
async function known(): Promise<string[]> {
  try { return JSON.parse((await AsyncStorage.getItem(KNOWN_KEY)) || '[]'); } catch { return []; }
}
```
</details>

## 10. Punctuation cheat sheet
`;` end of sentence · `//` note to humans, invisible to the machine ·
`!x` not-x · `===` *really* equals (always use three) · `!==` really-not ·
`?.` "if it exists, reach inside; else give up quietly" ·
`&&` and · `||` or/fallback · `=>` becomes · `` ` `` template text ·
`x++`/`x += y` grow x · `async/await` wait politely · `n` suffix = BigInt money.


<details><summary>▶ <b>Press here — see it live in the wallet</b> (kaspa_payload.ts, line 313)</summary>

[Open the real line on GitHub →](https://github.com/wayneshaw349/kasvillage-townhall/blob/6b4e58d2fceebc182cf6e00687f085c2ba98c478/kaspa_payload.ts#L313)

```ts
export async function getPledgeSompi(address: string, network = require('./kv_net').KV_NET): Promise<bigint> {
  // 1 name + ingredients + result type  2 guard  3 fetch  4 add up  5 return
```
</details>

---
## How to WRITE a function (the ritual)
1. Say it in English first: "given an address, give me its total sompi."
2. Write the signature - name, ingredients with types, result type:
   `async function totalAt(address: string): Promise<bigint>`
3. Guard the bad cases first (`if (!address) return 0n;`).
4. Do the work. 5. `return` the answer. 6. Wrap risky parts in try/catch.
That's the shape of nearly every function in this repo - open `getPledgeSompi`
in `kaspa_payload.ts` and you'll see the ritual exactly.

**Drill:** pick any line in `kaspa_rest_tx.ts`, cover it, and say what it does
out loud using the grammar above. If you can't, find its pattern here. Repeat
daily - this is vocabulary practice, and fluency comes fast because you already
know what the program MEANS. You wrote it.
