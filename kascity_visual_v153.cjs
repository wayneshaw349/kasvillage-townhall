// kascity_visual_v153.cjs
// Reads showcase_kascity152.html -> showcase_kascity153.html
// The scenario resolver could sell a block out from under a trade that was mid-flight, paying the
// scenario's seat instead of the owner, which is what produced "buyer +120, seller +0".
// 1) A card sale may only take a block the card's own seat actually owns (verified against
//    world.owners), and pays that seat market value + swing (v152 pays; this adds the check).
// 2) Scenarios are suppressed while a human trade is armed or an offer dialog is open, so the two
//    systems can never touch the same block in the same window.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity152.html')) die('showcase_kascity152.html missing');
let html = fs.readFileSync('showcase_kascity152.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

// 1) ownership check inside ownedTileOf: only blocks the seat truly owns
rep('function ownedTileOf(seat){',
    'function ownedTileOf(seat){' + EOL +
    '  // v153: a card may only sell what its own seat holds, per the engine ledger' + EOL +
    '  function __owns(t){ try{ var w=(window.KV_WORLD&&window.KV_WORLD.owners)?window.KV_WORLD:null; if(w){ var o=w.owners["t"+t]; if(o==null) o=w.owners[String(t)]; return o===seat; } }catch(e){} return window.KV_OWNER&&window.KV_OWNER(t)===seat; }' + EOL +
    '  var __guard=__owns;',
    'ownedTileOf gains an ownership guard');
rep('if(pos!=null && window.KV_OWNER && window.KV_OWNER(pos)===seat) return pos;',
    'if(pos!=null && __guard(pos)) return pos;',
    'card sale: position check uses the ledger');
rep('return window.KV_OWNER && window.KV_OWNER(t)===seat;',
    'return __guard(t);',
    'card sale: list scan uses the ledger');

// 2) scenarios stand down while a human trade is armed or a dialog is open
rep('function resolve(sc, oi, seat, isHuman){',
    'function __tradeBusy(){ try{ var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};' + EOL +
    '    if(f.htr_state===2 || f.tr_state===2) return true;' + EOL +
    '    if(document.querySelector("[data-kvmodal]")) return true; }catch(e){} return false; }' + EOL +
    'function resolve(sc, oi, seat, isHuman){' + EOL +
    '  if(__tradeBusy() && !isHuman){ if(window.KV_LOG) window.KV_LOG("scenario held: a trade is settling","#7a6a58"); setTimeout(function(){ try{ resolve(sc,oi,seat,isHuman); }catch(e){} }, 1200); return; }',
    'scenarios wait while a trade is settling');

fs.writeFileSync('showcase_kascity153.html', html);
console.log('OK showcase_kascity153.html (' + (fs.statSync('showcase_kascity153.html').size/1024/1024).toFixed(1) + ' MB)');
