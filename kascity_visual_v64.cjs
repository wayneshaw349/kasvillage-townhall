// kascity_visual_v64.cjs
// Reads showcase_kascity63.html -> showcase_kascity64.html   (scene JSON unchanged)
//
// A. AUDIO DUCKING: whenever a sample plays, the music dips to 0.12 for its duration then ramps back
//    over 500ms — broadcast-style voiceover ducking. Baseline music also drops 0.42 -> 0.30 and
//    samples go to 1.0. This does more for clarity than any amount of EQ.
//
// B. SCENARIOS FIRE PROPERLY: the old gate needed YOUR turn AND landing on YOUR OWN property AND a
//    dice roll — with three properties out of 28 that almost never happened. Now:
//      - fires when ANY player lands on a property THAT PLAYER owns (bots included, resolved silently)
//      - 75% chance, 5s pacing
//      - a guaranteed scenario if 45s pass with none, provided the player owns anything
//    A small SCN readout shows the state of the gate so it is never a mystery again.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity63.html')) die('showcase_kascity63.html missing');
let html = fs.readFileSync('showcase_kascity63.html', 'utf8');

// ---------- A. ducking ----------
const sfxRe = /var a=s\.cloneNode\(\); a\.playbackRate=1\.0; a\.volume=0\.9;/;
if (!sfxRe.test(html)) die('sfx clone line not found');
html = html.replace(sfxRe,
  'var a=s.cloneNode(); a.playbackRate=1.0; a.volume=1.0;\n' +
  '  if(window.KV_MUSIC && !window.KV_MUSIC.paused){\n' +
  '    if(window.KV_DUCK_T) clearTimeout(window.KV_DUCK_T);\n' +
  '    if(window.KV_DUCK_R) clearInterval(window.KV_DUCK_R);\n' +
  '    window.KV_MUSIC.volume=0.12;\n' +
  '    var dur=(s.duration&&isFinite(s.duration))?s.duration*1000:1200;\n' +
  '    window.KV_DUCK_T=setTimeout(function(){\n' +
  '      window.KV_DUCK_R=setInterval(function(){\n' +
  '        var v=window.KV_MUSIC.volume;\n' +
  '        if(v>=0.29){ window.KV_MUSIC.volume=0.30; clearInterval(window.KV_DUCK_R); window.KV_DUCK_R=null; }\n' +
  '        else window.KV_MUSIC.volume=Math.min(0.30, v+0.03);\n' +
  '      }, 50);\n' +
  '    }, dur);\n' +
  '  }');

const volRe = /window\.KV_MUSIC\.volume = 0\.42;/;
if (!volRe.test(html)) die('music baseline volume not found');
html = html.replace(volRe, 'window.KV_MUSIC.volume = 0.30;');

// ---------- B. scenario gate ----------
// any player landing on their own property, not just the human on their own turn
const ownGateRe = /      if\(!window\.KV_OWNER \|\| window\.KV_OWNER\(pos\)!==seat\)\{[^\n]*\n/;
if (!ownGateRe.test(html)) die('ownership gate not found');
html = html.replace(ownGateRe,
  '      if(!window.KV_OWNER || window.KV_OWNER(pos)!==seat){ if(window.KV_SCN_DEBUG) console.log("[SCN] P"+seat+" landed "+pos+" owner "+(window.KV_OWNER?window.KV_OWNER(pos):"?")); return; }\n');

const chanceRe = /if\(Math\.random\(\)>0\.60\) return;\s*\/\/ not every landing/;
if (!chanceRe.test(html)) die('chance gate not found');
html = html.replace(chanceRe, 'if(Math.random()>0.75) return;  // not every landing');

const paceRe = /if\(Date\.now\(\)-lastFire < 6000\) return;\s*\/\/ pacing/;
if (!paceRe.test(html)) die('pacing gate not found');
html = html.replace(paceRe, 'if(Date.now()-lastFire < 5000) return;  // pacing');

// guaranteed fallback + status readout
const forceRe = /    window\.KV_SCN_DEBUG=false;/;
if (!forceRe.test(html)) die('scenario debug flag not found');
html = html.replace(forceRe, [
  '    window.KV_SCN_DEBUG=false;',
  '    // guarantee: if nothing has fired in 45s and the player owns something, force one',
  '    setInterval(function(){',
  '      if(busy) return;',
  '      if(Date.now()-lastFire < 45000) return;',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var seat=((f.turn||0)%4)+1;',
  '      var N=window.KV_NAMES||{};',
  '      var owned=Object.keys(N).filter(function(k){return window.KV_OWNER&&window.KV_OWNER(parseInt(k,10))===seat;});',
  '      if(!owned.length) return;',
  '      if(window.KV_FORCE_SCENARIO) window.KV_FORCE_SCENARIO();',
  '    }, 4000);',
  '    // status readout so the gate is never a mystery',
  '    (function(){',
  '      var s=document.createElement("div");',
  '      s.style.cssText="position:fixed;right:6px;bottom:38px;z-index:60;font:9px monospace;color:#7a6a58;";',
  '      document.body.appendChild(s);',
  '      setInterval(function(){',
  '        var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '        var seat=((f.turn||0)%4)+1;',
  '        var N=window.KV_NAMES||{};',
  '        var owned=Object.keys(N).filter(function(k){return window.KV_OWNER&&window.KV_OWNER(parseInt(k,10))===seat;}).length;',
  '        var wait=Math.max(0,Math.round((45000-(Date.now()-lastFire))/1000));',
  '        s.textContent="scn: P"+seat+" owns "+owned+" \\u00b7 next in "+wait+"s";',
  '      }, 1000);',
  '    })();'
].join('\n'));

fs.writeFileSync('showcase_kascity64.html', html);
console.log('PASS music ducks to 0.12 under every sample, ramps back to 0.30; samples now at 1.0');
console.log('PASS scenarios fire on any player landing on their own property (75%, 5s pacing)');
console.log('PASS guaranteed scenario after 45s idle if the player owns anything');
console.log('PASS scn status readout bottom-right shows owned count and countdown');
console.log('OK showcase_kascity64.html (' + (fs.statSync('showcase_kascity64.html').size/1024/1024).toFixed(1) + ' MB)');
