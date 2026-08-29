// kascity_visual_v58.cjs
// Reads showcase_kascity57.html -> showcase_kascity58.html   (scene JSON unchanged)
//  1) play-by-play raised another ~40px
//  2) SCENARIO DIAGNOSTICS — the modal may never have fired, because it needs ALL of:
//       your turn + landed on a property + you own it + a 45% roll + 9s since the last one
//     Since nobody owns anything early, the realistic wait is long. This adds:
//       - console logging of every gate that blocks a scenario check
//       - a "SCN" test button (bottom-right) that forces one immediately so you can see the modal
//       - trigger relaxed: 60% chance, 6s pacing
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity57.html')) die('showcase_kascity57.html missing');
let html = fs.readFileSync('showcase_kascity57.html', 'utf8');

// ---- 1. raise the panel ----
if (html.split('top:calc(50% + 82px)').length - 1 !== 1) die('feed offset not found');
html = html.split('top:calc(50% + 82px)').join('top:calc(50% + 42px)');
if (html.split('hdr.style.top="calc(50% + 58px)"').length - 1 !== 1) die('header offset not found');
html = html.split('hdr.style.top="calc(50% + 58px)"').join('hdr.style.top="calc(50% + 18px)"');

// ---- 2. relax the trigger ----
const chanceRe = /if\(Math\.random\(\)>0\.45\) return;\s*\/\/ not every landing/;
if (!chanceRe.test(html)) die('scenario chance gate not found');
html = html.replace(chanceRe, 'if(Math.random()>0.60) return;  // not every landing');

const paceRe = /if\(Date\.now\(\)-lastFire < 9000\) return;\s*\/\/ pacing/;
if (!paceRe.test(html)) die('scenario pacing gate not found');
html = html.replace(paceRe, 'if(Date.now()-lastFire < 6000) return;  // pacing');

// ---- 3. expose the scenario machinery + force button ----
const setIntervalRe = /    setInterval\(function\(\)\{\n      if\(busy\) return;/;
if (!setIntervalRe.test(html)) die('scenario loop not found');
html = html.replace(setIntervalRe,
  '    window.KV_SCN_DEBUG=false;\n' +
  '    window.KV_FORCE_SCENARIO=function(){\n' +
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};\n' +
  '      var seat=((f.turn||0)%4)+1;\n' +
  '      var N=window.KV_NAMES||{};\n' +
  '      var owned=Object.keys(N).filter(function(k){return window.KV_OWNER&&window.KV_OWNER(parseInt(k,10))===seat;});\n' +
  '      var tile=owned.length?parseInt(owned[0],10):parseInt(Object.keys(N)[0],10);\n' +
  '      var pool=window.KV_DECK.filter(function(s){return !used[seat+":"+s.id];});\n' +
  '      if(!pool.length){ console.log("[SCN] deck exhausted for P"+seat); return; }\n' +
  '      var sc=pool[Math.floor(Math.random()*pool.length)];\n' +
  '      used[seat+":"+sc.id]=1; lastFire=Date.now();\n' +
  '      console.log("[SCN] forcing", sc.id, "for P"+seat, "on", N[tile] && N[tile].n);\n' +
  '      present(sc, seat, (N[tile]&&N[tile].n)||("Block "+tile));\n' +
  '    };\n' +
  '    (function(){\n' +
  '      var b=document.createElement("button");\n' +
  '      b.textContent="SCN";\n' +
  '      b.style.cssText="position:fixed;right:200px;bottom:8px;z-index:60;height:24px;padding:0 7px;font:9px monospace;background:rgba(20,16,12,.85);color:#caa64c;border:1px solid #5a4a3a;border-radius:3px;cursor:pointer;";\n' +
  '      b.onclick=function(e){e.stopPropagation(); window.KV_FORCE_SCENARIO();};\n' +
  '      document.body.appendChild(b);\n' +
  '    })();\n' +
  '    setInterval(function(){\n' +
  '      if(busy) return;');

// ---- 4. log why a check bails ----
const ownGate = /      if\(!window\.KV_OWNER \|\| window\.KV_OWNER\(pos\)!==seat\) return;\s*\/\/ only your own property/;
if (!ownGate.test(html)) die('ownership gate not found');
html = html.replace(ownGate,
  '      if(!window.KV_OWNER || window.KV_OWNER(pos)!==seat){ if(window.KV_SCN_DEBUG) console.log("[SCN] P"+seat+" on "+pos+" but owner is "+(window.KV_OWNER?window.KV_OWNER(pos):"?")); return; }');

fs.writeFileSync('showcase_kascity58.html', html);
console.log('PASS play-by-play raised a further 40px');
console.log('PASS scenario trigger relaxed: 60% per landing, 6s pacing');
console.log('PASS SCN button (bottom-right) forces a scenario; window.KV_SCN_DEBUG=true logs why checks bail');
console.log('OK showcase_kascity58.html (' + (fs.statSync('showcase_kascity58.html').size/1024/1024).toFixed(1) + ' MB)');
