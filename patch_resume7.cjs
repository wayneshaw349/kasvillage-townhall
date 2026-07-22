const fs = require('fs');
const p = 'NeighborAgreement.tsx';
let src = fs.readFileSync(p, 'utf8');
function die(m){ console.error('[Resume7] ABORT - ' + m + ' (nothing written)'); process.exit(1); }

const re = /if \(_amts\.length === 0\) \{ _step = 3; console\.log\('\[Resume\] Escrow empty[^\n]*?\}/;
const hits = (src.match(new RegExp(re.source, 'g')) || []).length;
if (hits !== 1) die('empty-escrow branch: expected 1 match, found ' + hits);

const repl =
"if (_amts.length === 0) {\n" +
"                            // Empty escrow is AMBIGUOUS: never-funded (step 3) OR already released/reclaimed (step 7).\n" +
"                            // Defaulting to step 3 here is the resume-detects-completed bug - it invites re-funding a\n" +
"                            // finished agreement. Ask Arweave for a terminal inscription before deciding.\n" +
"                            let _term = false, _termStatus = '', _termTx = '';\n" +
"                            try {\n" +
"                              const _tq = '{ transactions(first: 1, tags: [{ name: \"KV-AgreementId\", values: [\"' + _p.agrId + '\"] }, { name: \"KV-Status\", values: [\"Released\",\"Refund\",\"Reclaimed\"] }], sort: HEIGHT_DESC) { edges { node { id tags { name value } } } } }';\n" +
"                              const _tr = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: _tq }) });\n" +
"                              const _tj = _tr.ok ? await _tr.json() : null;\n" +
"                              const _tn = _tj && _tj.data && _tj.data.transactions && _tj.data.transactions.edges && _tj.data.transactions.edges[0] ? _tj.data.transactions.edges[0].node : null;\n" +
"                              if (_tn) { _term = true; _termTx = _tn.id || ''; const _tm = {}; (_tn.tags || []).forEach((t) => { _tm[t.name] = t.value; }); _termStatus = _tm['KV-Status'] || ''; }\n" +
"                            } catch (e) { console.warn('[Resume] Terminal-status check failed, treating empty escrow as step 3:', e); }\n" +
"                            if (_term) { _step = 7; console.log('[Resume] Escrow empty but Arweave shows', _termStatus, '- agreement COMPLETE, step 7. tx:', _termTx.slice(0, 16)); }\n" +
"                            else { _step = 3; console.log('[Resume] Escrow empty, no terminal inscription - step 3 (never funded)'); }\n" +
"                          }";

const out = src.replace(re, repl);
if (out === src) die('replace produced no change');
const needle = '_step = 7; console.log(' + String.fromCharCode(39) + '[Resume] Escrow empty but Arweave shows';
if (out.indexOf(needle) === -1) die('step-7 branch not present after replace');
if (out.split('let _term = false').length - 1 !== 1) die('expected exactly 1 terminal-check block');
fs.writeFileSync(p, out, 'utf8');
console.log('[Resume7] OK - empty-escrow branch now checks Arweave for terminal status before defaulting to step 3.');