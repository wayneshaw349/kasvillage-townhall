// kascity_music_fix.cjs - KasCity music, phone landscape:
//  - MUSIC MAKER panel fits the sideways screen, next to the left buttons, with a big CLOSE button
//    (before: it was taller than the screen, so the close X was off-screen)
//  - game music never drops out: notes are scheduled ~0.6 s ahead (was 0.12 s, so a busy frame made gaps),
//    a stalled clock skips ahead instead of bursting, and a paused audio engine is resumed automatically
// Usage: node kascity_music_fix.cjs <input.html> <output.html>   (run after kascity_polish.cjs)
const fs = require('fs');
const [, , IN, OUT] = process.argv;
if (!IN || !OUT) { console.error('usage: node kascity_music_fix.cjs <input.html> <output.html>'); process.exit(1); }
let s = fs.readFileSync(IN, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('__KV_MUSICFIX')) { console.log(IN + ': already has the music fix - nothing to do'); process.exit(0); }
const A = '  function sched(){ var sp=60/song.bpm/4;\n    while(nt<ctx.currentTime+.12){';
const B = '  function sched(){ var sp=60/song.bpm/4; /* __KV_MUSICFIX */\n    if(ctx.state!=="running"){ try{ ctx.resume(); }catch(e){} }\n    if(nt<ctx.currentTime-.05) nt=ctx.currentTime+.05;\n    while(nt<ctx.currentTime+.6){';
const c = s.split(A).length - 1;
if (c !== 1) { console.error('music scheduler found ' + c + 'x - expected 1. Aborting - nothing written.'); process.exit(1); }
s = s.replace(A, B);
const TAIL = `<script>
// ---- __KV_MUSICFIX_UI: music maker fits the sideways phone, with a clear close ----
(function(){
  var css=document.createElement("style");
  css.textContent="html.kvland #kv_mm{left:104px!important;right:auto!important;top:8px!important;bottom:auto!important;max-height:calc(100% - 16px)!important;width:min(420px,calc(100% - 320px))!important;box-sizing:border-box!important}"+
    "#kvmm_close{position:sticky;top:0;z-index:2;display:block;width:100%;margin:0 0 8px;padding:9px;border-radius:8px;border:2px solid #f0c860;background:#2a2118;color:#f0c860;font:800 14px system-ui,sans-serif;cursor:pointer}";
  document.head.appendChild(css);
  setInterval(function(){
    var p=document.getElementById("kv_mm"); if(!p||document.getElementById("kvmm_close")) return;
    var b=document.createElement("button"); b.id="kvmm_close"; b.textContent="\\u2715 CLOSE MUSIC MAKER (music keeps playing)";
    ["pointerdown","mousedown","touchstart"].forEach(function(t){ b.addEventListener(t,function(e){ e.stopPropagation(); }); });
    b.onclick=function(e){ e.stopPropagation(); p.style.display="none"; var pad=document.getElementById("pad"); if(pad) pad.style.pointerEvents=""; };
    p.insertBefore(b,p.firstChild);
  },500);
})();
</script>
`;
s = s.replace(/\s*$/, '\n') + TAIL;
fs.writeFileSync(OUT, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('OK - ' + OUT + ' written (' + fs.statSync(OUT).size + ' bytes)');
