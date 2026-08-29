// kascity_visual_v69.cjs
// Reads kascity_v67.json + showcase_kascity68.html -> kascity_v69.json + showcase_kascity69.html
//
// A. REAL DICE: movement came from drawCard('fate') — a shuffled deck, so values cycled through a
//    permutation and never repeated until reshuffle. That is why rolls felt scripted. Each roll now
//    generates two independent dice:
//        d1 = floor(rand()*6)+1,  d2 = floor(rand()*6)+1,  step = d1+d2
//    Genuine 2-12 distribution, doubles possible, no memory between rolls.
//
// B. ROLLING DICE VISUAL: two pip dice tumble in the centre of the board for ~900ms, then settle on
//    the values actually rolled. Doubles get a gold flash.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v67.json')) die('kascity_v67.json missing');
if (!fs.existsSync('showcase_kascity68.html')) die('showcase_kascity68.html missing');
const j = JSON.parse(fs.readFileSync('kascity_v67.json', 'utf8'));
const director = j.nodes.find(n => n.id === 'director') || die('director missing');

// ---------- A. swap the deck draw for two dice ----------
let rollN = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const seq = o.sequence;
    const si = seq.findIndex(e => e && e.do && e.do.action === 'setFlagExpr'
                              && e.do.args && e.do.args[0] === 'sum'
                              && typeof e.do.args[1] === 'string'
                              && e.do.args[1].indexOf("lastCard('fate')") >= 0);
    if (si >= 0) {
      const expr = seq[si].do.args[1];                       // e.g. "world.flags.p2 + lastCard('fate') + 2"
      const posFlag = /(world\.flags\.p[1-4])/.exec(expr);
      if (posFlag) {
        seq.splice(si, 0,
          { do: { action: 'setFlagExpr', args: ['d1', 'floor(rand() * 6) + 1'] } },
          { do: { action: 'setFlagExpr', args: ['d2', 'floor(rand() * 6) + 1'] } },
          { do: { action: 'setFlagExpr', args: ['dice_t', 'world.time'] } }
        );
        seq[si + 3].do.args[1] = posFlag[1] + ' + world.flags.d1 + world.flags.d2';
        rollN++;
      }
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);
if (rollN < 3) die('roll branches converted ' + rollN + ' (<3)');

// rollv (used by the old numeral display) tracks the real total
let rvN = 0;
(function walk2(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { o.forEach(walk2); return; }
  if (o.do && o.do.action === 'setFlagExpr' && o.do.args && o.do.args[0] === 'rollv') {
    o.do.args[1] = 'world.flags.d1 + world.flags.d2'; rvN++;
  }
  Object.values(o).forEach(walk2);
})(director.bt);

// boot the dice flags
let bootOk = false;
(function walkA(o) {
  if (bootOk || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) {
      o.splice(ri, 0,
        { after: 0.1, do: { action: 'setState', args: ['d1', 1] } },
        { after: 0.1, do: { action: 'setState', args: ['d2', 1] } },
        { after: 0.1, do: { action: 'setState', args: ['dice_t', 0] } });
      bootOk = true; return;
    }
    o.forEach(walkA);
  } else Object.values(o).forEach(walkA);
})(director.alarms);
if (!bootOk) die('boot anchor missing');

const v69str = JSON.stringify(j);
fs.writeFileSync('kascity_v69.json', v69str);

// ---------- B. rolling dice visual ----------
let html = fs.readFileSync('showcase_kascity68.html', 'utf8');
const oldJson = fs.readFileSync('kascity_v67.json', 'utf8');
if (html.split(JSON.stringify(oldJson)).length - 1 !== 1) die('embedded v67 JSON not found exactly once');
html = html.split(JSON.stringify(oldJson)).join(JSON.stringify(v69str));

const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');

const diceJs = [
  '  window.KV_END=endGame;',
  '',
  '  // ================= ROLLING DICE =================',
  '  (function(){',
  '    var PIPS={1:[[1,1]],2:[[0,0],[2,2]],3:[[0,0],[1,1],[2,2]],',
  '              4:[[0,0],[2,0],[0,2],[2,2]],5:[[0,0],[2,0],[1,1],[0,2],[2,2]],',
  '              6:[[0,0],[2,0],[0,1],[2,1],[0,2],[2,2]]};',
  '    function face(v,gold){',
  '      var c=document.createElement("canvas"); c.width=c.height=48;',
  '      var g=c.getContext("2d");',
  '      g.fillStyle=gold?"#f6e2a0":"#f4ecd8"; g.strokeStyle="#241c12"; g.lineWidth=3;',
  '      g.beginPath(); g.roundRect(3,3,42,42,8); g.fill(); g.stroke();',
  '      g.fillStyle="#241c12";',
  '      (PIPS[v]||[]).forEach(function(p){',
  '        g.beginPath(); g.arc(11+p[0]*13, 11+p[1]*13, 4.2, 0, 6.3); g.fill();',
  '      });',
  '      return c.toDataURL();',
  '    }',
  '    var box=document.createElement("div");',
  '    box.style.cssText="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:62;'
    + 'display:none;gap:14px;align-items:center;pointer-events:none;";',
  '    var d1=document.createElement("img"), d2=document.createElement("img");',
  '    [d1,d2].forEach(function(d){',
  '      d.style.cssText="width:64px;height:64px;image-rendering:pixelated;'
    + 'filter:drop-shadow(0 6px 12px rgba(0,0,0,.75));";',
  '      box.appendChild(d);',
  '    });',
  '    document.body.appendChild(box);',
  '    var total=document.createElement("div");',
  '    total.style.cssText="position:fixed;left:50%;top:calc(50% + 58px);transform:translateX(-50%);'
    + 'z-index:62;display:none;font:900 22px Impact,sans-serif;color:#f8f0d8;'
    + 'text-shadow:2px 2px 0 #241c12;pointer-events:none;";',
  '    document.body.appendChild(total);',
  '',
  '    var lastT=null, spinning=false;',
  '    function roll(a,b){',
  '      if(spinning) return;',
  '      spinning=true;',
  '      box.style.display="flex"; total.style.display="none";',
  '      var n=0;',
  '      var iv=setInterval(function(){',
  '        d1.src=face(1+Math.floor(Math.random()*6),false);',
  '        d2.src=face(1+Math.floor(Math.random()*6),false);',
  '        box.style.transform="translate(-50%,-50%) rotate("+((n%2)?6:-6)+"deg)";',
  '        if(++n>14){',
  '          clearInterval(iv);',
  '          var dbl=(a===b);',
  '          d1.src=face(a,dbl); d2.src=face(b,dbl);',
  '          box.style.transform="translate(-50%,-50%) rotate(0deg)";',
  '          total.textContent=(a+b)+(dbl?"  DOUBLES":"");',
  '          total.style.color=dbl?"#f0c860":"#f8f0d8";',
  '          total.style.display="block";',
  '          setTimeout(function(){',
  '            box.style.display="none"; total.style.display="none"; spinning=false;',
  '          }, 1400);',
  '        }',
  '      }, 62);',
  '    }',
  '',
  '    setInterval(function(){',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var t=f.dice_t;',
  '      if(t==null||t===lastT) return;',
  '      lastT=t;',
  '      var a=Math.round(f.d1||1), b=Math.round(f.d2||1);',
  '      roll(a,b);',
  '      var seat=((f.turn||0)%4)+1;',
  '      if(window.KV_LOG) window.KV_LOG("P"+seat+"  rolled  "+a+" + "+b+" = "+(a+b),',
  '        {1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"}[seat]);',
  '    }, 150);',
  '  })();'
].join('\n');
html = html.split(anchor).join(diceJs);

fs.writeFileSync('showcase_kascity69.html', html);
console.log('PASS ' + rollN + ' roll branches now use two independent dice (true 2-12, doubles possible)');
console.log('PASS rollv retargeted (' + rvN + ' sites) to the real dice total');
console.log('PASS animated tumbling dice in the centre, doubles flash gold, roll printed in the log');
console.log('OK kascity_v69.json + showcase_kascity69.html (' + (fs.statSync('showcase_kascity69.html').size/1024/1024).toFixed(1) + ' MB)');
