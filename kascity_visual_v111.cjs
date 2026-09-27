// kascity_visual_v111.cjs
// Reads showcase_kascity110.html -> showcase_kascity111.html
// "more than you have (0)": KV_SEAT(me,"cash") returns null in the bid panel, ||0 made it zero.
// Same fallback the rest of the file uses (flags.cashN) is applied to every cash/mort read in the
// bid + list panels, so "you", "their cash" and the bar are all read the same way.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity110.html')) die('showcase_kascity110.html missing');
let html = fs.readFileSync('showcase_kascity110.html', 'utf8');

function fix(varName, seatExpr, key) {
  const old = 'var ' + varName + '=(window.KV_SEAT&&Math.round(window.KV_SEAT(' + seatExpr + ',"' + key + '")))||0;';
  const neu = 'var ' + varName + '=(function(){var v=(window.KV_SEAT&&window.KV_SEAT(' + seatExpr + ',"' + key + '"));if(v==null){var ff=(window.KV_FLAGS&&window.KV_FLAGS())||{};v=ff["' + key + '"+(' + seatExpr + ')];}return v==null?0:Math.round(v);})();';
  const n = html.split(old).length - 1;
  if (n < 1 || n > 4) die(varName + ': expected 1-4, got ' + n);
  html = html.split(old).join(neu);
  console.log('PASS ' + varName + ' (' + n + ' site' + (n > 1 ? 's' : '') + ') falls back to flags.' + key + 'N');
}
fix('myCash', 'me', 'cash');
fix('theirCash2', 'owner', 'cash');
fix('theirMort2', 'owner', 'mort');
fix('theirCash', 'owner', 'cash');
fix('theirMort', 'owner', 'mort');

fs.writeFileSync('showcase_kascity111.html', html);
console.log('OK showcase_kascity111.html (' + (fs.statSync('showcase_kascity111.html').size/1024/1024).toFixed(1) + ' MB)');
