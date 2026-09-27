// kascity_visual_v131.cjs
// Reads showcase_kascity130.html -> showcase_kascity131.html
// Auto-start no longer clicks the board centre (that hit your Roll prompt). It sends a single
// pointerdown at the top-left corner of the canvas, then when the engine reports started it applies
// the winner and clears any stale prompt (asked/go/buy/buy_tile).
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity130.html')) die('showcase_kascity130.html missing');
let html = fs.readFileSync('showcase_kascity130.html', 'utf8');
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

rep('var o={bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,pointerId:1,pointerType:"mouse",isPrimary:true,button:0};',
    'var o={bubbles:true,cancelable:true,clientX:r.left+3,clientY:r.top+3,pointerId:1,pointerType:"mouse",isPrimary:true,button:0};',
    'start tap at canvas corner');
rep('try{ c.dispatchEvent(new PointerEvent("pointerdown",o)); c.dispatchEvent(new PointerEvent("pointerup",o)); c.dispatchEvent(new MouseEvent("click",o)); }catch(e){}',
    'try{ c.dispatchEvent(new PointerEvent("pointerdown",o)); }catch(e){}',
    'pointerdown only — no click');
rep('if(!applied){ applied=true; if(window.KV_SETSTATE){ window.KV_SETSTATE("turn", w-1); window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0); window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1); } }',
    'if(!applied){ applied=true; if(window.KV_SETSTATE){ window.KV_SETSTATE("turn", w-1); window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0); window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1); window.KV_SETSTATE("buy",-1); window.KV_SETSTATE("buy_tile",-1); window.KV_SETSTATE("offer_ask",-1); } }',
    'stale prompt cleared when winner applied');

fs.writeFileSync('showcase_kascity131.html', html);
console.log('OK showcase_kascity131.html (' + (fs.statSync('showcase_kascity131.html').size/1024/1024).toFixed(1) + ' MB)');
