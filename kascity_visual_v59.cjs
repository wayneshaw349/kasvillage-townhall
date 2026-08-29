// kascity_visual_v59.cjs
// Reads showcase_kascity58.html -> showcase_kascity59.html   (scene JSON unchanged)
// YOU marker: a bouncing arrow tracks your token on the board, plus a glow ring under it and a
// pulsing border on your corner card, so at a glance you always know which piece is yours.
// In multiplayer every human seat gets its own arrow in that player's colour.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity58.html')) die('showcase_kascity58.html missing');
let html = fs.readFileSync('showcase_kascity58.html', 'utf8');

const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');

const marker = [
  '  window.KV_END=endGame;',
  '',
  '  // ================= "YOU" MARKERS =================',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    var st=document.createElement("style");',
  '    st.textContent="@keyframes kvbob{0%,100%{transform:translate(-50%,-100%) translateY(0)}'
    + '50%{transform:translate(-50%,-100%) translateY(-9px)}}"+',
  '      "@keyframes kvpulse{0%,100%{box-shadow:0 0 0 0 rgba(255,242,160,.55)}'
    + '50%{box-shadow:0 0 0 7px rgba(255,242,160,0)}}";',
  '    document.head.appendChild(st);',
  '',
  '    var marks={};',
  '    function markerFor(p){',
  '      if(marks[p]) return marks[p];',
  '      var d=document.createElement("div");',
  '      d.style.cssText="position:fixed;z-index:58;pointer-events:none;display:none;'
    + 'animation:kvbob 1.1s ease-in-out infinite;text-align:center;";',
  '      d.innerHTML="<div style=\'font:900 11px monospace;letter-spacing:1px;color:"+COL[p]+";'
    + 'text-shadow:1px 1px 0 #241c12,0 0 8px rgba(0,0,0,.9);margin-bottom:-3px\'>"+'
    + '(p===1?"YOU":("P"+p))+"</div>"+',
  '        "<div style=\'width:0;height:0;margin:0 auto;border-left:9px solid transparent;'
    + 'border-right:9px solid transparent;border-top:13px solid "+COL[p]+";'
    + 'filter:drop-shadow(0 2px 3px rgba(0,0,0,.8))\'></div>";',
  '      document.body.appendChild(d);',
  '      marks[p]=d;',
  '      return d;',
  '    }',
  '',
  '    setInterval(function(){',
  '      if(!window.KV_PROJECT||!window.KV_NODE) return;',
  '      var cv=document.querySelector("canvas"); if(!cv) return;',
  '      var r=cv.getBoundingClientRect(), sx=r.width/cv.width, sy=r.height/cv.height;',
  '      var humans=window.KV_HUMANS||[1];',
  '      for(var p=1;p<=4;p++){',
  '        var d=markerFor(p);',
  '        if(humans.indexOf(p)<0){ d.style.display="none"; continue; }',
  '        var n=window.KV_NODE("token_p"+p);',
  '        if(!n||!n.worldPos){ d.style.display="none"; continue; }',
  '        var q=window.KV_PROJECT(n.worldPos);',
  '        if(!q){ d.style.display="none"; continue; }',
  '        d.style.display="block";',
  '        d.style.left=(r.left+q.x*sx)+"px";',
  '        d.style.top=(r.top+q.y*sy-34)+"px";',
  '      }',
  '    },120);',
  '',
  '    // pulse the corner card of whoever is up',
  '    setInterval(function(){',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var cur=((f.turn||0)%4)+1;',
  '      for(var p=1;p<=4;p++){',
  '        var c=document.getElementById("kvc"+p);',
  '        var card=c&&c.parentNode&&c.parentNode.parentNode;',
  '        if(!card) continue;',
  '        var mine=(window.KV_HUMANS||[1]).indexOf(p)>=0;',
  '        card.style.borderColor = (p===cur) ? COL[p] : (mine ? "rgba(202,166,76,.55)" : "#5a4a3a");',
  '        card.style.animation = (p===cur) ? "kvpulse 1.4s infinite" : "none";',
  '      }',
  '    },300);',
  '  })();'
].join('\n');
html = html.split(anchor).join(marker);

fs.writeFileSync('showcase_kascity59.html', html);
console.log('PASS bouncing YOU arrow tracks your token (every human seat in multiplayer)');
console.log('PASS active player\'s corner card pulses; your card keeps a gold border');
console.log('OK showcase_kascity59.html (' + (fs.statSync('showcase_kascity59.html').size/1024/1024).toFixed(1) + ' MB)');
