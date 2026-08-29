// kascity_visual_v67.cjs
// Reads kascity_v66.json + showcase_kascity66.html -> kascity_v67.json + showcase_kascity67.html
//
// A. SCENARIO SEAT BUG: the modal was opening for bot seats. The check used the seat derived from
//    world.flags.turn, which drifts from the seat that actually owns the block, so a bot's problem
//    landed in front of you. It now resolves the seat from ownership and only presents a modal when
//    that seat is in KV_HUMANS — bots take the EV line silently.
//
// B. STARTING CASH: 2000 -> 1300. Tighter opening means early purchases are real decisions and the
//    mortgage bills bite sooner. Boot seeding, HUD mirrors and net-worth baselines all retimed.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v66.json')) die('kascity_v66.json missing');
if (!fs.existsSync('showcase_kascity66.html')) die('showcase_kascity66.html missing');
const j = JSON.parse(fs.readFileSync('kascity_v66.json', 'utf8'));
const director = j.nodes.find(n => n.id === 'director') || die('director missing');

// ---------- B. starting cash ----------
let cashN = 0, nwN = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { o.forEach(walk); return; }
  if (o.do && o.do.action === 'setSeatStat' && Array.isArray(o.do.args)
      && o.do.args[1] === 'cash' && o.do.args[2] === 2000) { o.do.args[2] = 1300; cashN++; }
  if (o.do && o.do.action === 'setState' && Array.isArray(o.do.args)
      && /^(cash[1-4]|nw[1-4])$/.test(o.do.args[0]) && o.do.args[1] === 2000) { o.do.args[1] = 1300; nwN++; }
  Object.values(o).forEach(walk);
})(director);
if (cashN < 4) die('seat cash seeds rewritten ' + cashN + ' (<4)');

const v67str = JSON.stringify(j);
fs.writeFileSync('kascity_v67.json', v67str);

// ---------- showcase ----------
let html = fs.readFileSync('showcase_kascity66.html', 'utf8');
const oldJson = fs.readFileSync('kascity_v66.json', 'utf8');
if (html.split(JSON.stringify(oldJson)).length - 1 !== 1) die('embedded v66 JSON not found exactly once');
html = html.split(JSON.stringify(oldJson)).join(JSON.stringify(v67str));

// ---------- A. scenario seat comes from ownership, not the turn flag ----------
const loopRe = /      var f=\(window\.KV_FLAGS&&window\.KV_FLAGS\(\)\)\|\|\{\};\n      var seat=\(\(f\.turn\|\|0\)%4\)\+1;\n      var pos=f\["p"\+seat\];/;
if (!loopRe.test(html)) die('scenario loop seat derivation not found');
html = html.replace(loopRe,
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};\n' +
  '      var seat=((f.turn||0)%4)+1;\n' +
  '      var pos=f["p"+seat];\n' +
  '      // trust ownership over the turn flag: whoever owns the block owns the problem\n' +
  '      if(pos!=null && window.KV_OWNER){\n' +
  '        var realOwner=window.KV_OWNER(pos);\n' +
  '        if(realOwner) seat=realOwner;\n' +
  '      }');

// present() must never open for a bot
const presentRe = /    function present\(sc, seat, tileName\)\{\n      busy=true;/;
if (!presentRe.test(html)) die('present() not found');
html = html.replace(presentRe,
  '    function present(sc, seat, tileName){\n' +
  '      var humans=window.KV_HUMANS||[1];\n' +
  '      if(humans.indexOf(seat)<0){\n' +
  '        // bot: resolve on expected value, no modal\n' +
  '        resolve(sc, bestIndex(sc, cashOfSeat(seat)), seat, false);\n' +
  '        return;\n' +
  '      }\n' +
  '      busy=true;');

// the forced SCN button should target a human seat when one owns something
const forceRe = /      var seat=\(\(f\.turn\|\|0\)%4\)\+1;\n      var N=window\.KV_NAMES\|\|\{\};\n      var owned=Object\.keys\(N\)\.filter/;
if (forceRe.test(html)) {
  html = html.replace(forceRe,
    '      var seat=((f.turn||0)%4)+1;\n' +
    '      var humans=window.KV_HUMANS||[1];\n' +
    '      if(humans.indexOf(seat)<0 && humans.length) seat=humans[0];\n' +
    '      var N=window.KV_NAMES||{};\n' +
    '      var owned=Object.keys(N).filter');
}

// starting-cash fallbacks in the UI
html = html.split('window.KV_RESULT.humans=').join('window.KV_RESULT.startCash=1300;\n    window.KV_RESULT.humans=');

fs.writeFileSync('showcase_kascity67.html', html);
console.log('PASS starting cash 2000 -> 1300 (' + cashN + ' seat seeds, ' + nwN + ' mirrors)');
console.log('PASS scenario seat resolved from ownership; bots never open a modal, they take the EV line');
console.log('OK kascity_v67.json + showcase_kascity67.html (' + (fs.statSync('showcase_kascity67.html').size/1024/1024).toFixed(1) + ' MB)');
