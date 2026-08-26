// kascity_visual_v104.cjs
// Reads showcase_kascity103.html -> showcase_kascity104.html   (patches the embedded scene JSON)
// Buy prompt is stamped with the turn that opened it; if the turn has moved on by the time it is
// answered, the answer is discarded (buy=-1, buy_tile=-1, phase=3) instead of buying on someone
// else's turn. Roll is already seat-guarded in the engine; bots auto-roll themselves.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity103.html')) die('showcase_kascity103.html missing');
let html = fs.readFileSync('showcase_kascity103.html', 'utf8');

// JSON is embedded with escaped quotes:  \"key\"
const Q  = '\\"';                                 // literal \" as it sits in the file
const QR = '\\\\"';                               // the same thing inside a RegExp source
function q(s) { return s.replace(/"/g, Q); }     // write JSON snippet in file form

// 1) stamp buy_turn right after each human buy prompt sets buy_tile
const stampRe = new RegExp(
  '(\\{' + QR + 'do' + QR + ':\\{' + QR + 'action' + QR + ':' + QR + 'prompt' + QR + ',' + QR + 'args' + QR + ':\\[' + QR + 'buy' + QR + ',[^\\]]*\\]\\}\\},' +
  '\\{' + QR + 'do' + QR + ':\\{' + QR + 'action' + QR + ':' + QR + 'setState' + QR + ',' + QR + 'args' + QR + ':\\[' + QR + 'buy_tile' + QR + ',\\d+\\]\\}\\})', 'g');
const stamps = (html.match(stampRe) || []).length;
if (stamps < 20 || stamps > 60) die('buy prompt+buy_tile pairs: expected 20-60, got ' + stamps);
html = html.replace(stampRe, '$1,' + q('{"do":{"action":"setFlagExpr","args":["buy_turn","world.flags.turn"]}}'));
console.log('PASS ' + stamps + ' buy prompts stamped with buy_turn');

// 2) stale-answer guard inserted immediately before the purchase sequence
const purchaseAnchor = q('{"sequence":[{"cond":"world.flags.phase == 2 && world.flags.buy >= 0"}');
const n = html.split(purchaseAnchor).length - 1;
if (n !== 1) die('purchase sequence anchor: expected 1, got ' + n);
const guard = q('{"sequence":[{"cond":"world.flags.buy >= 0 && world.flags.buy_turn != world.flags.turn"},' +
  '{"do":{"action":"setState","args":["buy",-1]}},{"do":{"action":"setState","args":["buy_tile",-1]}},' +
  '{"do":{"action":"setState","args":["phase",3]}},{"do":{"action":"playSound","args":["deny"]}}]},');
html = html.replace(purchaseAnchor, guard + purchaseAnchor);
console.log('PASS stale buy answer discarded when the turn has moved on');

fs.writeFileSync('showcase_kascity104.html', html);
console.log('OK showcase_kascity104.html (' + (fs.statSync('showcase_kascity104.html').size/1024/1024).toFixed(1) + ' MB)');
