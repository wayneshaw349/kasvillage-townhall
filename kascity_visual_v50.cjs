// kascity_visual_v50.cjs
// Reads kascity_v49.json + showcase_kascity49.html + audio -> kascity_v50.json + showcase_kascity50.html
// The v47 rebuild may have dropped the per-sound vox tags. This re-asserts them, reports exactly which
// sound ids exist so we can see what's actually reachable, and adds:
//   ching -> buy, rent, depot, bnb        (money made)
//   boo   -> tax, levy                    (taxes)
//   gavel -> gavel, evict, jail           (court)
//   dang  -> hazard, storm, bust          (hazards)
//   fw    -> win
// Plus an ORIGINAL spoken line on tax events (no third-party lyrics) and a test panel to click each.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
const need = ['kascity_v49.json','showcase_kascity49.html','sfx_ching.mp3','sfx_boo.mp3','sfx_gavel.mp3','sfx_dang.mp3','sfx_fireworks.mp3'];
for (const f of need) if (!fs.existsSync(f)) die(f + ' missing');
const j = JSON.parse(fs.readFileSync('kascity_v49.json', 'utf8'));
const snd = (j.resources && j.resources.sounds) || die('resources.sounds missing');

console.log('sound ids present: ' + Object.keys(snd).join(', '));

const map = {
  ching: ['buy', 'rent', 'depot', 'bnb'],
  boo:   ['tax', 'levy'],
  gavel: ['gavel', 'evict', 'jail'],
  dang:  ['hazard', 'storm', 'bust'],
  fw:    ['win']
};
let wired = 0; const hit = [], miss = [];
for (const [sfx, ids] of Object.entries(map)) {
  for (const id of ids) {
    if (!snd[id]) { miss.push(id); continue; }
    snd[id].vox = sfx;
    delete snd[id].speech;
    hit.push(id + '\u2192' + sfx);
    wired++;
  }
}
if (wired < 8) die('wired ' + wired + ' (<8); present ids: ' + Object.keys(snd).join(','));

// original spoken line on tax — written for this game, not sampled from anyone
if (snd.tax) snd.tax.speech = { text: 'Everybody wants a cut of your paper.', pitch: 0.55, rate: 1.0, svol: 1.0 };
if (snd.hazard) snd.hazard.speech = { text: 'Repairs. That is going to cost you.', pitch: 0.55, rate: 1.0, svol: 0.9 };

const v50str = JSON.stringify(j);
fs.writeFileSync('kascity_v50.json', v50str);

// ---------- showcase ----------
let html = fs.readFileSync('showcase_kascity49.html', 'utf8');
const oldJson = fs.readFileSync('kascity_v49.json', 'utf8');
if (html.split(JSON.stringify(oldJson)).length - 1 !== 1) die('embedded v49 JSON not found exactly once');
html = html.split(JSON.stringify(oldJson)).join(JSON.stringify(v50str));

// make sure the engine hook fires speech as well as samples
const hookAnchor = '  if (d.vox && window.KV_SFX) { try { window.KV_SFX(d.vox); } catch (e) {} }';
if (html.split(hookAnchor).length - 1 !== 1) die('vox hook not found in showcase');
html = html.split(hookAnchor).join(hookAnchor + '\n' +
  '  if (d.speech && d.speech.text && typeof SpeechSynthesisUtterance !== "undefined") {\n' +
  '    try { var _u = new SpeechSynthesisUtterance(String(d.speech.text));\n' +
  '      _u.pitch = d.speech.pitch == null ? 1 : d.speech.pitch;\n' +
  '      _u.rate = d.speech.rate == null ? 1 : d.speech.rate;\n' +
  '      _u.volume = d.speech.svol == null ? 1 : d.speech.svol;\n' +
  '      window.speechSynthesis.cancel(); window.speechSynthesis.speak(_u); } catch (e) {}\n' +
  '  }');

// test panel so every sample can be verified without waiting for the event
const musicBtnAnchor = 'mb.onclick=function(e){e.stopPropagation();';
if (html.split(musicBtnAnchor).length - 1 < 1) die('music button anchor not found');
const testPanel = [
  '',
  '  (function(){',
  '    var tp=document.createElement("div");',
  '    tp.style.cssText="position:fixed;right:44px;bottom:8px;z-index:60;display:flex;gap:3px;";',
  '    [["ching","$"],["boo","BOO"],["gavel","GAV"],["dang","AAH"],["fw","FW"]].forEach(function(pair){',
  '      var b=document.createElement("button");',
  '      b.textContent=pair[1];',
  '      b.style.cssText="height:24px;padding:0 6px;font:9px monospace;background:rgba(20,16,12,.85);color:#f4e4c1;border:1px solid #5a4a3a;border-radius:3px;cursor:pointer;";',
  '      b.onclick=function(e){e.stopPropagation(); if(window.KV_SFX) window.KV_SFX(pair[0]);};',
  '      tp.appendChild(b);',
  '    });',
  '    document.body.appendChild(tp);',
  '  })();',
  ''
].join('\n');
const endAnchor = '  window.KV_END=endGame;';
if (html.split(endAnchor).length - 1 !== 1) die('endGame anchor not found');
html = html.split(endAnchor).join(endAnchor + testPanel);

fs.writeFileSync('showcase_kascity50.html', html);
console.log('PASS wired: ' + hit.join(', '));
if (miss.length) console.log('NOTE absent sound ids (skipped): ' + miss.join(', '));
console.log('PASS original voice lines on tax + hazard (no third-party lyrics)');
console.log('PASS test panel bottom-right: $ BOO GAV AAH FW');
console.log('OK kascity_v50.json + showcase_kascity50.html (' + (fs.statSync('showcase_kascity50.html').size/1024/1024).toFixed(1) + ' MB)');
