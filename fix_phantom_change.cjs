// fix_phantom_change.cjs - the real cause of the KasCity publish "orphan" loop:
// the wallet remembered a change output (297e7ed8...:1) from a send whose tx never landed on chain, and
// kept building new chunks on top of it -> every retry is an orphan, forever (until the app restarts).
//  1 remembered change older than 90 s that the explorer still hasn't seen is dropped (real change is
//    spent by the next chunk within seconds)
//  2 if a send still ends in "orphan", the remembered change it used is thrown away and the send is
//    rebuilt ONCE from real coins automatically
//  3 "already accepted by the consensus" / "already in the mempool" now count as success (the tx IS in)
const fs = require('fs');
const f = 'kaspa_rest_tx.ts';
let s = fs.readFileSync(f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_PHANTOM_CHANGE')) { console.log(f + ': already patched - skipping'); process.exit(0); }
const edits = [
  ["const _pendingChange = new Map<string, { txId: string; index: number; amount: string; script: string; address: string }>();",
   "const _pendingChange = new Map<string, { txId: string; index: number; amount: string; script: string; address: string; at?: number }>(); // KV_PHANTOM_CHANGE"],
  ["        if (_spentOutpoints.has(k)) continue;\n        if (utxos.some(",
   "        if (_spentOutpoints.has(k)) continue;\n        if (c.at && Date.now() - c.at > 90000 && !utxos.some(u => ((u as any).outpoint?.transactionId || '') + ':' + ((u as any).outpoint?.index ?? 0) === k)) { console.log('[REST-TX] dropping stale remembered change', k); _pendingChange.delete(k); continue; }\n        if (utxos.some("],
  ["address: senderAddress });\n      }\n    } catch (e) { console.warn('[REST-TX] spent-track record failed:', e); }",
   "address: senderAddress, at: Date.now() });\n      }\n    } catch (e) { console.warn('[REST-TX] spent-track record failed:', e); }"],
  ["      const _w = await _wrpcSubmit(tx, network, _predictedTxId);\n      if (_w.error) {\n        console.error('[REST-TX] wRPC submit FAILED:', _w.error);\n",
   "      const _w = await _wrpcSubmit(tx, network, _predictedTxId);\n      if (_w.error && /orphan/i.test(_w.error) && !(params as any).__orphanRebuilt) {\n        let _ph = 0;\n        for (const u of selectedUtxos) { const k = ((u as any).outpoint?.transactionId || '') + ':' + ((u as any).outpoint?.index ?? 0); if (_pendingChange.has(k)) { _pendingChange.delete(k); _spentOutpoints.add(k); _ph++; } }\n        if (_ph) { console.warn('[REST-TX] orphan came from remembered change that never landed - dropped ' + _ph + ', rebuilding from real coins'); return sendKaspaViaRest({ ...params, __orphanRebuilt: true } as any); }\n      }\n      if (_w.error) {\n        console.error('[REST-TX] wRPC submit FAILED:', _w.error);\n"],
  ["        const em = String(j.error || bodyText.slice(0, 200));\n",
   "        const em = String(j.error || bodyText.slice(0, 200));\n        if (/already accepted by the consensus|already in the mempool/i.test(em)) { console.log('[REST-TX] tx already in - counted as sent'); return { transactionId: idHint || '' }; }\n"],
];
if (s.includes('  const _waits = [1500, 3000, 5000, 8000, 12000];')) edits.push(['  const _waits = [1500, 3000, 5000, 8000, 12000];', '  const _waits = [3000];   // inner retry already waits 12 s; a real orphan is rebuilt by the sender']);
for (let i = 0; i < edits.length; i++) { const c = s.split(edits[i][0]).length - 1; if (c !== 1) { console.error(f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1. Aborting - nothing written.'); process.exit(1); } }
for (const [a, b] of edits) s = s.split(a).join(b);
fs.writeFileSync(f, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log(f + ': patched - phantom change dropped, orphan sends rebuilt from real coins, "already accepted" = sent.');
