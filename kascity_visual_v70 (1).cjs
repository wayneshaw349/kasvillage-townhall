// kascity_visual_v70.cjs
// Reads kascity_v69.json + showcase_kascity69.html -> kascity_v70.json + showcase_kascity70.html
//
// A. RENOVATION NEVER RAN. The expiry branch ("clear the request after 1.5s") was unshifted last, so
//    it sat at the FRONT of the selector, and renov_t was seeded 0 — meaning world.time - 0 > 1.5 was
//    true on the very first tick. The request was wiped before any work branch could match.
//    Fixes: expiry moved behind the work branches, its window widened to 4s, renov_t stamped from
//    world.time by the BT itself, and renovation now ENDS YOUR TURN (phase 3) — it costs a turn.
//
// B. VISIBLE UPGRADE: renovated blocks show a star per grade on the board label and a brighter ring,
//    and the play-by-play announces the new hazard figure so the improvement is legible.
//
// C. OFFER / TRADE BUTTON: you can now bid on any property another player owns, from its popup.
//    It sets offer_ask + phase 21, which is the path the engine already uses for offers.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v69.json')) die('kascity_v69.json missing');
if (!fs.existsSync('showcase_kascity69.html')) die('showcase_kascity69.html missing');
const j = JSON.parse(fs.readFileSync('kascity_v69.json', 'utf8'));
const director = j.nodes.find(n => n.id === 'director') || die('director missing');
const rootSel = director.bt.sequence[1] && director.bt.sequence[1].selector;
if (!Array.isArray(rootSel)) die('root selector missing');

// ---------- A. fix the expiry branch ----------
let expiryIdx = -1;
for (let i = 0; i < rootSel.length; i++) {
  const c = rootSel[i] && rootSel[i].sequence && rootSel[i].sequence[0] && rootSel[i].sequence[0].cond;
  if (typeof c === 'string' && c.indexOf('world.flags.renov >= 0 && world.time - world.flags.renov_t') === 0) { expiryIdx = i; break; }
}
if (expiryIdx < 0) die('renovation expiry branch not found');
const expiry = rootSel.splice(expiryIdx, 1)[0];
expiry.sequence[0].cond = 'world.flags.renov >= 0 && world.time - world.flags.renov_t > 4';

// find the last renovation work branch so expiry can go after it
let lastWork = -1;
for (let i = 0; i < rootSel.length; i++) {
  const c = rootSel[i] && rootSel[i].sequence && rootSel[i].sequence[0] && rootSel[i].sequence[0].cond;
  if (typeof c === 'string' && /^world\.flags\.renov == \d+ && world\.flags\.renov_by == \d/.test(c)) lastWork = i;
}
if (lastWork < 0) die('renovation work branches not found');
rootSel.splice(lastWork + 1, 0, expiry);

// stamp renov_t in-engine and end the turn
let workN = 0;
for (const br of rootSel) {
  const c = br && br.sequence && br.sequence[0] && br.sequence[0].cond;
  if (typeof c !== 'string' || !/^world\.flags\.renov == \d+ && world\.flags\.renov_by == \d/.test(c)) continue;
  if (!br.sequence.some(e => e && e.do && e.do.args && e.do.args[0] === 'phase')) {
    br.sequence.push({ do: { action: 'setState', args: ['phase', 3] } });
  }
  workN++;
}
if (workN < 60) die('renovation work branches patched ' + workN);

// a branch that stamps the clock the moment a request appears
rootSel.unshift({ sequence: [
  { cond: 'world.flags.renov >= 0 && world.flags.renov_t == 0' },
  { do: { action: 'setFlagExpr', args: ['renov_t', 'world.time'] } }
]});

const v70str = JSON.stringify(j);
fs.writeFileSync('kascity_v70.json', v70str);

// ---------- showcase ----------
let html = fs.readFileSync('showcase_kascity69.html', 'utf8');
const oldJson = fs.readFileSync('kascity_v69.json', 'utf8');
if (html.split(JSON.stringify(oldJson)).length - 1 !== 1) die('embedded v69 JSON not found exactly once');
html = html.split(JSON.stringify(oldJson)).join(JSON.stringify(v70str));

// renovate request: reset the stamp so the BT re-stamps it
const renRe = /      window\.KV_SETSTATE\("renov_t", \(f\.__t\|\|0\)\);/;
if (!renRe.test(html)) die('renov_t set line not found');
html = html.replace(renRe, '      window.KV_SETSTATE("renov_t", 0);');

// C. offer button + renovation feedback in the popup
const showRe = /      if\(own && \(window\.KV_HUMANS\|\|\[1\]\)\.indexOf\(own\)>=0\)\{/;
if (!showRe.test(html)) die('popup renovate block not found');
html = html.replace(showRe,
  '      var me=((f.turn||0)%4)+1;\n' +
  '      var iAmHuman=(window.KV_HUMANS||[1]).indexOf(me)>=0;\n' +
  '      if(own && own!==me && iAmHuman){\n' +
  '        var ob=document.createElement("button");\n' +
  '        ob.textContent="Make offer ("+Math.round((d.p||100)*0.9)+")";\n' +
  '        ob.style.cssText="margin-top:8px;width:100%;padding:6px;background:#22303a;color:#cfe6f4;border:1px solid #4f7fd9;border-radius:5px;font:11px monospace;cursor:pointer;";\n' +
  '        ob.onclick=function(ev3){\n' +
  '          ev3.stopPropagation();\n' +
  '          if(window.KV_SETSTATE){\n' +
  '            window.KV_SETSTATE("offer_ask", i);\n' +
  '            window.KV_SETSTATE("oq", 0);\n' +
  '            window.KV_SETSTATE("phase", 21);\n' +
  '            if(window.KV_LOG) window.KV_LOG("P"+me+"  bidding on  "+nameOf(i),"#4f7fd9");\n' +
  '            if(window.KV_MOVE) window.KV_MOVE(me,"offer",i);\n' +
  '          }\n' +
  '          pop.style.display="none";\n' +
  '        };\n' +
  '        pop.appendChild(ob);\n' +
  '      }\n' +
  '      if(own && (window.KV_HUMANS||[1]).indexOf(own)>=0){');

// B. renovation stars on the board labels
const labRe = /      lab\[i\]\.style\.color=own\?COL\[own\]:"#f8f0d8";/;
if (!labRe.test(html)) die('label colour line not found');
html = html.replace(labRe,
  '      lab[i].style.color=own?COL[own]:"#f8f0d8";\n' +
  '      var fl=(window.KV_FLAGS&&window.KV_FLAGS())||{};\n' +
  '      var rvg=Math.round(fl["rv_t"+i]||0);\n' +
  '      var base=nameOf(i);\n' +
  '      var want=base+(rvg>0?(" "+Array(rvg+1).join("\\u2605")):"");\n' +
  '      if(lab[i].textContent!==want) lab[i].textContent=want;\n' +
  '      if(rvg>0){ lab[i].style.textShadow="1px 1px 0 #241c12, 0 0 8px "+(own?COL[own]:"#caa64c"); }');

// announce the improvement
const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');
html = html.split(anchor).join([
  '  window.KV_END=endGame;',
  '',
  '  // ---- renovation results ----',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    var seen={};',
  '    setInterval(function(){',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var N=window.KV_NAMES||{};',
  '      Object.keys(N).forEach(function(k){',
  '        var g=Math.round(f["rv_t"+k]||0);',
  '        if(seen[k]===undefined){ seen[k]=g; return; }',
  '        if(g>seen[k]){',
  '          seen[k]=g;',
  '          var o=window.KV_OWNER?window.KV_OWNER(parseInt(k,10)):null;',
  '          var hz=Math.round(f["hz_t"+k]||0);',
  '          if(window.KV_LOG) window.KV_LOG("P"+(o||"?")+"  RENOVATED  "+N[k].n+"  hazard now "+hz+"%", COL[o]||"#caa64c");',
  '          if(window.KV_SFX) window.KV_SFX("ching");',
  '        }',
  '      });',
  '    }, 400);',
  '  })();'
].join('\n'));

fs.writeFileSync('showcase_kascity70.html', html);
console.log('PASS renovation expiry moved behind the work branches, window 4s, clock stamped in-engine');
console.log('PASS renovating now ends your turn (' + workN + ' branches set phase 3)');
console.log('PASS renovated blocks show a star per grade and announce the new hazard figure');
console.log('PASS Make offer button on any property another player owns');
console.log('OK kascity_v70.json + showcase_kascity70.html (' + (fs.statSync('showcase_kascity70.html').size/1024/1024).toFixed(1) + ' MB)');
