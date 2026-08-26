// kascity_visual_v125.cjs
// Reads showcase_kascity124.html -> showcase_kascity125.html
// Roll-for-first: after the winner is known the game starts by itself (synthetic tap on the board),
// and the winner's seat is re-applied once the engine reports it has started (t0>0), because the
// engine's start reset was overwriting the turn we set before it.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity124.html')) die('showcase_kascity124.html missing');
let html = fs.readFileSync('showcase_kascity124.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('setTimeout(function(){ ov.remove(); }, 1400);',
  'setTimeout(function(){' + EOL +
  '      ov.remove();' + EOL +
  '      var tries=0, applied=false;' + EOL +
  '      var iv=setInterval(function(){' + EOL +
  '        var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};' + EOL +
  '        if(!(f.t0>0)){' + EOL +
  '          if(tries++<20){ var c=document.querySelector("canvas"); if(c){ var r=c.getBoundingClientRect(); var o={bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,pointerId:1,pointerType:"mouse",isPrimary:true,button:0};' + EOL +
  '            try{ c.dispatchEvent(new PointerEvent("pointerdown",o)); c.dispatchEvent(new PointerEvent("pointerup",o)); c.dispatchEvent(new MouseEvent("click",o)); }catch(e){} document.dispatchEvent(new Event("pointerdown")); } }' + EOL +
  '          return;' + EOL +
  '        }' + EOL +
  '        if(!applied){ applied=true; if(window.KV_SETSTATE){ window.KV_SETSTATE("turn", w-1); window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0); window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1); } }' + EOL +
  '        var seatNow=((f.turn||0)%4)+1;' + EOL +
  '        if(seatNow===w || tries++>40){ clearInterval(iv); if(window.KV_LOG) window.KV_LOG("P"+w+" opens the game","#caa64c"); }' + EOL +
  '        else if(window.KV_SETSTATE){ window.KV_SETSTATE("turn", w-1); }' + EOL +
  '      }, 300);' + EOL +
  '    }, 1400);',
  'auto-start + winner re-applied after engine start');

fs.writeFileSync('showcase_kascity125.html', html);
console.log('OK showcase_kascity125.html (' + (fs.statSync('showcase_kascity125.html').size/1024/1024).toFixed(1) + ' MB)');
