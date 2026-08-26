// kascity_visual_v113.cjs
// Reads showcase_kascity112.html -> showcase_kascity113.html
// Trade hand-off now checks itself: 1.5s after settle(), if the tile hasn't moved it logs WHY in
// red (owner, tr_state, cash vs amount, engine flags). REFUSES becomes a big banner with the bar.
// Lap rent: logs a grey "lap: P n" line whenever the depot sound fires so a silent rent path is visible.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity112.html')) die('showcase_kascity112.html missing');
let html = fs.readFileSync('showcase_kascity112.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

// 1) settle() self-check
rep('if(!okt && window.KV_LOG) window.KV_LOG("trade failed to register","#ff6a4a");',
    'if(!okt && window.KV_LOG) window.KV_LOG("trade failed to register","#ff6a4a");' + EOL +
    'setTimeout(function(){' + EOL +
    '  var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};' + EOL +
    '  var own=window.KV_OWNER?window.KV_OWNER(tile):null;' + EOL +
    '  var cash=(window.KV_SEAT&&window.KV_SEAT(buyer,"cash")); if(cash==null) cash=f["cash"+buyer];' + EOL +
    '  var N=window.KV_NAMES||{}, nm=(N[tile]&&N[tile].n)||("block "+tile);' + EOL +
    '  if(own===buyer){' + EOL +
    '    if(window.KV_SHOUT) window.KV_SHOUT("DEAL DONE", "P"+buyer+" now owns "+nm+" for "+amt, COL[buyer], (window.KV_HUMANS||[1]).indexOf(buyer)>=0);' + EOL +
    '  } else {' + EOL +
    '    var why="owner still P"+own+" \\u00b7 tr_state "+f.tr_state+" \\u00b7 tr_tile "+f.tr_tile+" \\u00b7 from "+f.tr_from+" to "+f.tr_to+" \\u00b7 amt "+f.tr_amt+" \\u00b7 buyer cash "+Math.round(cash||0)+" \\u00b7 phase "+f.phase+" \\u00b7 turn seat "+(((f.turn||0)%4)+1);' + EOL +
    '    if(window.KV_LOG) window.KV_LOG("TRANSFER DID NOT LAND: "+why,"#ff6a4a");' + EOL +
    '    if(window.KV_SHOUT) window.KV_SHOUT("TRANSFER FAILED", why, "#ff6a4a", true);' + EOL +
    '  }' + EOL +
    '}, 1500);',
    'settle() verifies the tile actually moved and reports why if not');

// 2) refusal banner with the number
rep('else if(window.KV_SFX) window.KV_SFX("dang");',
    'else { if(window.KV_SFX) window.KV_SFX("dang"); if(window.KV_SHOUT) window.KV_SHOUT("REFUSED", "P"+owner+" wanted "+Math.round(threshold)+" \\u00b7 you offered "+v, COL[owner], true); }',
    'REFUSES shows a banner with their bar');

// 3) lap trace
rep('if(lastLap[seat] && now-lastLap[seat]<3000) return;   // one rent roll per lap',
    'if(window.KV_LOG) window.KV_LOG("lap: P"+seat+" passed GO","#7a6a58");' + EOL +
    'if(lastLap[seat] && now-lastLap[seat]<3000) return;   // one rent roll per lap',
    'lap trace line on every GO pass');

fs.writeFileSync('showcase_kascity113.html', html);
console.log('OK showcase_kascity113.html (' + (fs.statSync('showcase_kascity113.html').size/1024/1024).toFixed(1) + ' MB)');
