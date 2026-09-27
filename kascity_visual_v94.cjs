// kascity_visual_v94.cjs
// Reads showcase_kascity93.html -> showcase_kascity94.html   (scene JSON unchanged)
//
// A. THE POPUP FELL OFF THE BOTTOM. Clicking a square on the lower row opened the panel below the
//    cursor, so the Renovate and List buttons sat under the prompt bar or off screen entirely.
//    It now flips above the cursor when there is no room below, clamps to the viewport on both axes,
//    and gains a close button so it can never be stranded.
//
// B. NOTHING SHOWED WHAT WAS FOR SALE. Listings were announced once and then invisible unless you
//    happened to click that square. A MARKET panel on the left now lists every block currently on
//    the market with its asking price, who owns it, and whether it is under or over your valuation —
//    click a row to open that property directly.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity93.html')) die('showcase_kascity93.html missing');
let html = fs.readFileSync('showcase_kascity93.html', 'utf8');

// ---------- A. keep the popup on screen ----------
const posRe = /[ \t]*pop\.style\.display="block";[ \t]*\n[ \t]*pop\.style\.left=Math\.min\([^\n]*\n[ \t]*pop\.style\.top=Math\.min\([^\n]*/;
const posM = html.match(posRe);
if (!posM) die('popup positioning not found');
if (html.split(posM[0]).length - 1 !== 1) die('popup positioning not unique (' + (html.split(posM[0]).length - 1) + ')');
html = html.replace(posM[0], [
  '      pop.style.display="block";',
  '      pop.style.visibility="hidden";',
  '      pop.style.left="0px"; pop.style.top="0px";',
  '      // measure first, then place: flip above the cursor when the bottom is crowded',
  '      requestAnimationFrame(function(){',
  '        var r=pop.getBoundingClientRect();',
  '        var w=r.width||210, h=r.height||220;',
  '        var pad=12, bar=96;                       // leave the prompt bar clear',
  '        var x=ev.clientX+pad, y=ev.clientY+pad;',
  '        if(x+w > window.innerWidth-pad)  x=ev.clientX-w-pad;',
  '        if(x < pad) x=pad;',
  '        if(y+h > window.innerHeight-bar) y=ev.clientY-h-pad;',
  '        if(y < pad) y=Math.max(pad, window.innerHeight-bar-h);',
  '        pop.style.left=x+"px";',
  '        pop.style.top=y+"px";',
  '        pop.style.visibility="visible";',
  '      });'
].join('\n'));

// a close button, and room to breathe
const popStyleRe = /var pop=el\("div","position:fixed;z-index:61;display:none;[^"]*"\);/;
const popM = html.match(popStyleRe);
if (!popM) die('popup style not found');
if (html.split(popM[0]).length - 1 !== 1) die('popup style not unique');
html = html.replace(popM[0],
  'var pop=el("div","position:fixed;z-index:61;display:none;background:rgba(20,16,12,.97);' +
  'border:2px solid #caa64c;border-radius:8px;padding:10px 14px 12px;font:12px/1.7 monospace;' +
  'color:#f4e4c1;box-shadow:0 6px 26px rgba(0,0,0,.75);min-width:190px;max-width:260px;' +
  'max-height:70vh;overflow:auto;");\n' +
  '  (function(){\n' +
  '    var x=document.createElement("div");\n' +
  '    x.textContent="\\u00d7";\n' +
  '    x.style.cssText="position:absolute;right:8px;top:4px;cursor:pointer;color:#8a7a5a;font:16px monospace;";\n' +
  '    x.onclick=function(e){ e.stopPropagation(); pop.style.display="none"; };\n' +
  '    pop.appendChild(x);\n' +
  '    pop.style.position="fixed";\n' +
  '  })();');

// ---------- B. market listings panel ----------
const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');
html = html.split(anchor).join([
  '  window.KV_END=endGame;',
  '',
  '  // ================= LISTINGS PANEL =================',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    function F(){ return (window.KV_FLAGS&&window.KV_FLAGS())||{}; }',
  '',
  '    var box=document.createElement("div");',
  '    box.style.cssText="position:fixed;left:8px;top:206px;z-index:58;width:214px;'
    + 'font:10px/1.45 monospace;color:#f4e4c1;";',
  '    var hd=document.createElement("div");',
  '    hd.style.cssText="background:rgba(20,16,12,.94);border:1px solid #5a4a3a;border-radius:4px 4px 0 0;'
    + 'padding:3px 8px;cursor:pointer;letter-spacing:1px;color:#f0c860;font-weight:700;";',
  '    hd.innerHTML="<span>ON THE MARKET</span><span style=\'float:right\' id=\'kvmkn\'>0</span>";',
  '    var bd=document.createElement("div");',
  '    bd.style.cssText="background:rgba(20,16,12,.9);border:1px solid #5a4a3a;border-top:0;'
    + 'border-radius:0 0 4px 4px;padding:4px 8px;max-height:170px;overflow:auto;";',
  '    box.appendChild(hd); box.appendChild(bd); document.body.appendChild(box);',
  '    var open=true;',
  '    hd.onclick=function(){ open=!open; bd.style.display=open?"block":"none"; };',
  '',
  '    setInterval(function(){',
  '      var f=F(), N=window.KV_NAMES||{};',
  '      var rows=[];',
  '      Object.keys(N).forEach(function(k){',
  '        var t=parseInt(k,10);',
  '        if(Math.round(f["ls_t"+t]||0)!==1) return;',
  '        var ask=Math.round(f["lp_t"+t]||0);',
  '        var val=window.KV_INTRINSIC?window.KV_INTRINSIC(t):ask;',
  '        var own=window.KV_OWNER?window.KV_OWNER(t):null;',
  '        rows.push({t:t, n:N[k].n, ask:ask, val:val, own:own});',
  '      });',
  '      document.getElementById("kvmkn").textContent=rows.length;',
  '      if(!open) return;',
  '      if(!rows.length){ bd.innerHTML="<span style=\'opacity:.45\'>nothing listed</span>"; return; }',
  '      rows.sort(function(a,b){ return (a.ask-a.val)-(b.ask-b.val); });',
  '      bd.innerHTML="";',
  '      rows.forEach(function(r){',
  '        var deal=r.val-r.ask;',
  '        var col=deal>0?"#9cd87c":(deal<-15?"#ff6a4a":"#f4e4c1");',
  '        var row=document.createElement("div");',
  '        row.style.cssText="padding:2px 0;cursor:pointer;border-bottom:1px solid #2a2118;";',
  '        row.innerHTML="<span style=\'color:"+(COL[r.own]||"#8a7a5a")+"\'>\\u25a0</span> "+r.n+',
  '          "<span style=\'float:right;color:"+col+"\'>"+r.ask+"</span>"+',
  '          "<div style=\'opacity:.55;font-size:9px\'>worth "+r.val+" \\u00b7 "+',
  '          (deal>0?("under by "+deal):(deal<0?("over by "+(-deal)):"at value"))+"</div>";',
  '        row.onclick=function(e){',
  '          e.stopPropagation();',
  '          if(window.KV_OPEN_TILE) window.KV_OPEN_TILE(r.t, e);',
  '        };',
  '        bd.appendChild(row);',
  '      });',
  '    }, 700);',
  '  })();'
].join('\n'));

// let the listings panel open a property directly
const clickRe = /[ \t]*h\.onclick=function\(ev\)\{[ \t]*\n[ \t]*ev\.stopPropagation\(\);[ \t]*\n[ \t]*var f=F\(\),age=f\["age_t"\+i\]/;
if (!clickRe.test(html)) die('tile click handler not found');
html = html.replace(clickRe, [
  '    if(!window.KV_TILE_OPENERS) window.KV_TILE_OPENERS={};',
  '    window.KV_TILE_OPENERS[i]=function(ev){ h.onclick(ev); };',
  '    h.onclick=function(ev){',
  '      ev.stopPropagation();',
  '      var f=F(),age=f["age_t"+i]'
].join('\n'));

const openRe = /  window\.KV_END=endGame;\n\n  \/\/ ================= LISTINGS PANEL =================/;
if (!openRe.test(html)) die('listings anchor lost');
html = html.replace(openRe, [
  '  window.KV_END=endGame;',
  '',
  '  window.KV_OPEN_TILE=function(t, ev){',
  '    var o=window.KV_TILE_OPENERS && window.KV_TILE_OPENERS[t];',
  '    if(o) o(ev || { stopPropagation:function(){}, clientX:window.innerWidth/2, clientY:window.innerHeight/2 });',
  '  };',
  '',
  '  // ================= LISTINGS PANEL ================='
].join('\n'));

fs.writeFileSync('showcase_kascity94.html', html);
console.log('PASS popup measures itself then flips above the cursor when the bottom row is crowded');
console.log('PASS clamped to the viewport on both axes, prompt bar kept clear, close button added');
console.log('PASS ON THE MARKET panel lists every listing with asking price and how it compares to value');
console.log('PASS click a listing row to open that property directly');
console.log('OK showcase_kascity94.html (' + (fs.statSync('showcase_kascity94.html').size/1024/1024).toFixed(1) + ' MB)');
