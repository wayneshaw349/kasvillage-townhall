// kascity_visual_v134.cjs
// Reads showcase_kascity133.html -> showcase_kascity134.html
// 1) Bankruptcy recovery: a seat marked alive=0 (cash < 0) is restored the moment its cash is
//    back at >= 0, with a "BACK IN BUSINESS" cue. Before this a single bad card benched a player
//    for the rest of the game.
// 2) The bot-offer engine's why:<reason> diagnostics no longer enter the move record.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity133.html')) die('showcase_kascity133.html missing');
let html = fs.readFileSync('showcase_kascity133.html', 'utf8');
function q(s) { return s.replace(/"/g, '\\"'); }

// 1) recovery sequences in the global block (same anchor v133 used)
const anchorU = '{"sequence":[{"cond":"world.flags.sc_state == 1 && world.flags.sc_seat == 4"}';
const anchorE = q(anchorU);
if (html.split(anchorE).length - 1 !== 1) die('global anchor not unique');
let seqs = [];
for (let p = 1; p <= 4; p++) {
  seqs.push('{"sequence":[{"cond":"seatStat(' + p + ',\'cash\') >= 0 && seatStat(' + p + ',\'alive\') == 0"},' +
    '{"do":{"action":"setSeatStat","args":[' + p + ',"alive",1]}},' +
    '{"do":{"action":"setState","args":["revived",' + p + ']}},' +
    '{"do":{"action":"playSound","args":["win"]}}]}');
}
html = html.replace(anchorE, q(seqs.join(',')) + ',' + anchorE);
console.log('PASS 4 bankruptcy-recovery sequences (alive restored when cash >= 0)');

// JS banner on revive
const bannerAnchor = '// ---- XP awards echo to the centre ----';
if (html.split(bannerAnchor).length - 1 !== 1) die('banner anchor not unique');
html = html.replace(bannerAnchor,
  '// ---- revive banner (v134) ----\n' +
  'var lastRev=0; setInterval(function(){ var f=(window.KV_FLAGS&&window.KV_FLAGS())||{}; var r=f.revived||0; if(r&&r!==lastRev){ lastRev=r; shout("BACK IN BUSINESS","P"+r+" is solvent again", COL[r], you(r)); if(window.KV_LOG) window.KV_LOG("P"+r+" back in business", COL[r]); } },600);\n\n' +
  bannerAnchor);
console.log('PASS BACK IN BUSINESS banner');

// 2) why() no longer records moves
const whyRec = ' if(window.KV_MOVE && Date.now()-lastRec>60000){ lastRec=Date.now(); window.KV_MOVE(0,"why:"+String(m).replace(/[^a-z0-9 .+]/gi,"").slice(0,60),0); }';
if (html.split(whyRec).length - 1 !== 1) die('why recorder not unique');
html = html.replace(whyRec, '');
console.log('PASS why: diagnostics removed from the move record');

fs.writeFileSync('showcase_kascity134.html', html);
console.log('OK showcase_kascity134.html (' + (fs.statSync('showcase_kascity134.html').size/1024/1024).toFixed(1) + ' MB)');
