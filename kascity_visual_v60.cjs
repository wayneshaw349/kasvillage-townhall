// kascity_visual_v60.cjs
// Reads showcase_kascity59.html -> showcase_kascity60.html   (scene JSON unchanged)
//  1) Right column raised again and PLAY BY PLAY made collapsible (click its header).
//  2) HOLDINGS panel: a live list of who owns what, grouped by player, with counts and total value.
//     Ownership was only readable from the coloured rings on the board — this states it plainly.
//     Collapsible too, and it names the property rather than the block number.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity59.html')) die('showcase_kascity59.html missing');
let html = fs.readFileSync('showcase_kascity59.html', 'utf8');

// ---- 1. raise the stack ----
if (html.split('top:calc(50% + 42px)').length - 1 !== 1) die('feed offset not found');
html = html.split('top:calc(50% + 42px)').join('top:calc(50% + 10px)');
if (html.split('hdr.style.top="calc(50% + 18px)"').length - 1 !== 1) die('header offset not found');
html = html.split('hdr.style.top="calc(50% + 18px)"').join('hdr.style.top="calc(50% - 14px)"');

// ---- 2. make play-by-play collapsible ----
const hdrText = 'hdr.textContent="PLAY BY PLAY";';
if (html.split(hdrText).length - 1 !== 1) die('play-by-play header text not found');
html = html.split(hdrText).join(
  'hdr.innerHTML="<span>PLAY BY PLAY</span><span style=\'float:right\'>&#9660;</span>";\n' +
  '    hdr.style.cursor="pointer";\n' +
  '    var pbOpen=true;\n' +
  '    hdr.onclick=function(){ pbOpen=!pbOpen; wrap.style.display=pbOpen?"flex":"none";\n' +
  '      hdr.lastChild.innerHTML=pbOpen?"&#9660;":"&#9654;"; };');

// ---- 3. holdings panel ----
const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');

const holdings = [
  '  window.KV_END=endGame;',
  '',
  '  // ================= HOLDINGS: who owns what =================',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    var box=document.createElement("div");',
  '    box.style.cssText="position:fixed;left:8px;top:calc(50% - 90px);z-index:57;width:214px;'
    + 'font:11px/1.45 monospace;color:#f4e4c1;";',
  '    var hd=document.createElement("div");',
  '    hd.style.cssText="background:rgba(20,16,12,.94);border:1px solid #5a4a3a;border-radius:4px 4px 0 0;'
    + 'padding:3px 8px;cursor:pointer;letter-spacing:1px;color:#caa64c;font-weight:700;";',
  '    hd.innerHTML="<span>HOLDINGS</span><span style=\'float:right\'>&#9660;</span>";',
  '    var bd=document.createElement("div");',
  '    bd.style.cssText="background:rgba(20,16,12,.88);border:1px solid #5a4a3a;border-top:0;'
    + 'border-radius:0 0 4px 4px;padding:5px 8px;max-height:250px;overflow:auto;";',
  '    box.appendChild(hd); box.appendChild(bd); document.body.appendChild(box);',
  '    var open=true;',
  '    hd.onclick=function(){ open=!open; bd.style.display=open?"block":"none";',
  '      hd.lastChild.innerHTML=open?"&#9660;":"&#9654;"; };',
  '',
  '    setInterval(function(){',
  '      if(!open) return;',
  '      var N=window.KV_NAMES||{};',
  '      var by={1:[],2:[],3:[],4:[]}, free=0;',
  '      Object.keys(N).forEach(function(k){',
  '        var t=parseInt(k,10);',
  '        var o=window.KV_OWNER?window.KV_OWNER(t):null;',
  '        if(o&&by[o]) by[o].push({n:N[k].n,p:N[k].p||0});',
  '        else free++;',
  '      });',
  '      var h="";',
  '      for(var p=1;p<=4;p++){',
  '        var list=by[p], val=0;',
  '        list.forEach(function(x){ val+=x.p; });',
  '        var mine=(window.KV_HUMANS||[1]).indexOf(p)>=0;',
  '        h+="<div style=\'margin-bottom:4px\'>"+',
  '           "<span style=\'color:"+COL[p]+"\'>&#9632;</span> <b>P"+p+(mine?" (you)":"")+"</b> "+',
  '           "<span style=\'opacity:.6\'>"+list.length+" \\u00b7 "+val+"</span>";',
  '        if(list.length){',
  '          h+="<div style=\'padding-left:11px;opacity:.85\'>"+',
  '             list.map(function(x){return x.n;}).join("<br>")+"</div>";',
  '        } else {',
  '          h+="<div style=\'padding-left:11px;opacity:.4\'>none</div>";',
  '        }',
  '        h+="</div>";',
  '      }',
  '      h+="<div style=\'opacity:.5;border-top:1px solid #3a3228;padding-top:3px\'>unowned "+free+"</div>";',
  '      bd.innerHTML=h;',
  '    },600);',
  '  })();'
].join('\n');
html = html.split(anchor).join(holdings);

fs.writeFileSync('showcase_kascity60.html', html);
console.log('PASS right column raised 32px; PLAY BY PLAY now collapsible');
console.log('PASS HOLDINGS panel (left, collapsible): every property grouped by owner, with count and value');
console.log('OK showcase_kascity60.html (' + (fs.statSync('showcase_kascity60.html').size/1024/1024).toFixed(1) + ' MB)');
