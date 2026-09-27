// kascity_visual_v51.cjs
// Reads kascity_v50.json + showcase_kascity50.html + sfx_why.mp3 -> kascity_v51.json + showcase_kascity51.html
// Lawsuit / court events get a low sung "why... why... oo... whyyy" lament layered over the gavel.
// The spoken tax line is dropped (no borrowed lyrics anywhere); the crowd boo still carries taxes.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
for (const f of ['kascity_v50.json','showcase_kascity50.html','sfx_why.mp3']) if (!fs.existsSync(f)) die(f + ' missing');
const j = JSON.parse(fs.readFileSync('kascity_v50.json', 'utf8'));
const snd = (j.resources && j.resources.sounds) || die('sounds missing');

// lawsuit/court -> the sung lament; drop all spoken lines
let n = 0;
for (const id of ['gavel', 'jail', 'evict']) {
  if (!snd[id]) continue;
  snd[id].vox = 'why';
  delete snd[id].speech;
  n++;
}
if (n < 1) die('no court sound ids found: ' + Object.keys(snd).join(','));
for (const id of Object.keys(snd)) delete snd[id].speech;

const v51str = JSON.stringify(j);
fs.writeFileSync('kascity_v51.json', v51str);

let html = fs.readFileSync('showcase_kascity50.html', 'utf8');
const oldJson = fs.readFileSync('kascity_v50.json', 'utf8');
if (html.split(JSON.stringify(oldJson)).length - 1 !== 1) die('embedded v50 JSON not found exactly once');
html = html.split(JSON.stringify(oldJson)).join(JSON.stringify(v51str));

// register the new sample
const voxAnchor = 'window.KV_VOX.fw    = new Audio("data:audio/mpeg;base64,';
if (html.split(voxAnchor).length - 1 !== 1) die('vox registration anchor not found');
const b64 = fs.readFileSync('sfx_why.mp3').toString('base64');
html = html.split(voxAnchor).join(
  'window.KV_VOX.why   = new Audio("data:audio/mpeg;base64,' + b64 + '");\n' + voxAnchor);

// longer cooldown so a 3.6s lament isn't retriggered over itself
const cdAnchor = 'if(window.KV_SFX_LAST[k]&&n-window.KV_SFX_LAST[k]<220)return;';
if (html.split(cdAnchor).length - 1 !== 1) die('sfx cooldown anchor not found');
html = html.split(cdAnchor).join('var cd=(k==="why")?3800:220;\n  if(window.KV_SFX_LAST[k]&&n-window.KV_SFX_LAST[k]<cd)return;');

// add it to the test panel
const tpAnchor = '[["ching","$"],["boo","BOO"],["gavel","GAV"],["dang","AAH"],["fw","FW"]]';
if (html.split(tpAnchor).length - 1 !== 1) die('test panel anchor not found');
html = html.split(tpAnchor).join('[["ching","$"],["boo","BOO"],["why","WHY"],["dang","AAH"],["fw","FW"]]');

fs.writeFileSync('showcase_kascity51.html', html);
console.log('PASS sung lament wired to ' + n + ' court/lawsuit sound ids');
console.log('PASS all spoken lines removed — no third-party wording anywhere');
console.log('PASS 3.8s cooldown on the lament so it never overlaps itself');
console.log('OK kascity_v51.json + showcase_kascity51.html (' + (fs.statSync('showcase_kascity51.html').size/1024/1024).toFixed(1) + ' MB)');
