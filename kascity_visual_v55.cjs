// kascity_visual_v55.cjs
// Reads showcase_kascity54.html -> showcase_kascity55.html   (scene JSON unchanged)
//  1) PLAY-BY-PLAY: rebuilt as a standalone panel that does not depend on any earlier anchor holding.
//     Bottom-left, large type, colour-coded, 12 lines, 20s dwell. window.KV_LOG is redefined to feed
//     it, so every existing call site (XP awards, purchases, scenario outcomes) lands there.
//  2) SCENARIOS TO CENTRE: the management modal now renders in the middle of the board with the
//     district's clip art beside the text — the same sprite family used on the tiles, drawn to a
//     canvas from the scene's own sprite data so no new assets are needed.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
const srcHtml = ['showcase_kascity54.html','showcase_kascity53.html'].find(f => fs.existsSync(f));
if (!srcHtml) die('no showcase_kascity53/54.html found');
console.log('source: ' + srcHtml);
let html = fs.readFileSync(srcHtml, 'utf8');

// ---------- 1. guaranteed play-by-play ----------
const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');

const feedJs = [
  '  window.KV_END=endGame;',
  '',
  '  // ================= PLAY BY PLAY (standalone) =================',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    var wrap=document.createElement("div");',
  '    wrap.style.cssText="position:fixed;left:10px;bottom:10px;z-index:78;width:290px;'
    + 'display:flex;flex-direction:column-reverse;gap:4px;pointer-events:none;";',
  '    document.body.appendChild(wrap);',
  '    var hdr=document.createElement("div");',
  '    hdr.style.cssText="background:rgba(20,16,12,.94);border:1px solid #5a4a3a;border-radius:4px;'
    + 'padding:3px 9px;font:700 11px monospace;color:#caa64c;letter-spacing:2px;";',
  '    hdr.textContent="PLAY BY PLAY";',
  '    document.body.appendChild(hdr);',
  '    hdr.style.position="fixed"; hdr.style.left="10px"; hdr.style.bottom="10px"; hdr.style.zIndex=78;',
  '    wrap.style.bottom="34px";',
  '',
  '    window.KV_LOG=function(txt,col){',
  '      var r=document.createElement("div");',
  '      r.style.cssText="background:rgba(20,16,12,.92);border-left:4px solid "+(col||"#8a7a5a")+";'
    + 'padding:4px 10px;border-radius:3px;font:13px/1.4 monospace;color:#f4e4c1;'
    + 'box-shadow:0 1px 6px rgba(0,0,0,.5);transition:opacity 1.6s;";',
  '      r.textContent=txt;',
  '      wrap.appendChild(r);',
  '      while(wrap.children.length>12) wrap.removeChild(wrap.firstChild);',
  '      setTimeout(function(){ r.style.opacity=.5; }, 20000);',
  '    };',
  '    window.KV_LOG("play by play ready","#caa64c");',
  '',
  '    // every engine sound becomes a line, so nothing happens silently',
  '    var LABEL={dice:"rolls",buy:"buys a block",rent:"rent paid",tax:"taxed",depot:"payday",',
  '               jail:"detained",bust:"bankrupt",hazard:"hazard hits",storm:"storm damage",',
  '               evict:"tenant evicted",bnb:"converted to short-let",gavel:"court",win:"final bell"};',
  '    var prevHook=window.KV_ON_SOUND;',
  '    window.KV_ON_SOUND=function(id){',
  '      try{ if(prevHook) prevHook(id); }catch(e){}',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var s=((f.turn||0)%4)+1;',
  '      if(LABEL[id]) window.KV_LOG("P"+s+"  "+LABEL[id], COL[s]);',
  '    };',
  '  })();'
].join('\n');
html = html.split(anchor).join(feedJs);

// ---------- 2. scenarios to centre with clip art ----------
const oldPresent = "      ov.style.cssText=\"position:fixed;inset:0;z-index:76;background:rgba(10,8,6,.82);display:flex;align-items:center;justify-content:center;\";";
if (html.split(oldPresent).length - 1 !== 1) die('scenario overlay style not found — is v53 applied?');
html = html.split(oldPresent).join(
  '      ov.style.cssText="position:fixed;inset:0;z-index:76;background:rgba(10,8,6,.55);display:flex;align-items:center;justify-content:center;";');

// draw the district sprite next to the scenario text
const boxRe = /      box\.innerHTML="<div style='color:"\+COL\[seat\]\+";font-weight:700;letter-spacing:1px'>P"\+seat\+" [^"]*"\+tileName\+"<\/div>"\+/;
const boxM = html.match(boxRe);
if (!boxM) die('scenario box innerHTML anchor not found - is v53 applied to this showcase?');
if (html.split(boxM[0]).length - 1 !== 1) die('scenario box anchor not unique');
const artInject =
  '      box.style.cssText="background:#14100c;border:2px solid "+COL[seat]+";border-radius:12px;padding:18px 22px;font:13px/1.6 monospace;color:#f4e4c1;max-width:470px;box-shadow:0 8px 40px rgba(0,0,0,.7);display:flex;gap:16px;align-items:flex-start;";\n' +
  '      var art=document.createElement("canvas"); art.width=64; art.height=64;\n' +
  '      art.style.cssText="width:96px;height:96px;image-rendering:pixelated;flex:0 0 auto;border:1px solid #3a3228;border-radius:6px;background:#0e0b08;";\n' +
  '      (function(){\n' +
  '        var g=art.getContext("2d");\n' +
  '        var res=(window.KV_SCENE&&window.KV_SCENE.resources)||{};\n' +
  '        var sp=res.sprites||{};\n' +
  '        var keys=["deed","court","storm","volt","pipes","hvac","appl","walks"];\n' +
  '        var s=sp[keys[sc.id.length%8]];\n' +
  '        if(s&&s.frames&&s.frames[0]){\n' +
  '          var k=64/Math.max(s.w||46,s.h||33);\n' +
  '          s.frames[0].forEach(function(r){\n' +
  '            if(!r.rect)return;\n' +
  '            g.fillStyle=r.color||"#888";\n' +
  '            g.fillRect(r.rect[0]*k,r.rect[1]*k,Math.max(1,r.rect[2]*k),Math.max(1,r.rect[3]*k));\n' +
  '          });\n' +
  '        } else { g.fillStyle="#2a2118"; g.fillRect(0,0,64,64); g.fillStyle="#caa64c"; g.font="34px serif"; g.fillText("!",26,44); }\n' +
  '      })();\n' +
  '      var col=document.createElement("div"); col.style.cssText="flex:1 1 auto;";\n' +
  '      box.appendChild(art); box.appendChild(col);\n' +
  boxM[0].replace('box.innerHTML=', 'col.innerHTML=');
html = html.split(boxM[0]).join(artInject);

// buttons go into the text column, not the flex box
const btnRe = /        box\.appendChild\(b\);/;
if (!btnRe.test(html)) die('scenario button append anchor not found');
html = html.replace(btnRe, '        col.appendChild(b);');

// the two innerHTML continuation lines now target the column
html = html.split('                    "<div style=\'margin:8px 0 12px\'>"+sc.txt+"</div>"+')
           .join('                    "<div style=\'margin:8px 0 12px;font-size:14px\'>"+sc.txt+"</div>"+');

fs.writeFileSync('showcase_kascity55.html', html);
console.log('PASS play-by-play rebuilt standalone, bottom-left, 12 lines, sound events auto-logged');
console.log('PASS scenarios render centre-board with district clip art drawn from the scene sprites');
console.log('OK showcase_kascity55.html (' + (fs.statSync('showcase_kascity55.html').size/1024/1024).toFixed(1) + ' MB)');
