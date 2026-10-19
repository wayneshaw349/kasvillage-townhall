// kascity_music_fix3.cjs - music + sound effects, safe version (replaces kascity_music_fix2 - build from v6).
//  - the first tap anywhere (even on the start screen) starts the music, inside the tap so iPhone allows it
//  - sound effects play through the music's own audio engine once it is running and the sound is decoded;
//    until then they play the old way, so nothing is ever silent
//  - after every sound effect, and on every tap, the music engine is woken if the phone paused it
//  - never creates a second audio engine
// Usage: node kascity_music_fix3.cjs <input.html> <output.html>   (input = showcase_kascity_v6.html)
const fs = require('fs');
const [, , IN, OUT] = process.argv;
if (!IN || !OUT) { console.error('usage: node kascity_music_fix3.cjs <input.html> <output.html>'); process.exit(1); }
let s = fs.readFileSync(IN, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('__KV_MUSICFIX3')) { console.log(IN + ': already has music fix 3 - nothing to do'); process.exit(0); }
if (s.includes('__KV_MUSICFIX2')) { console.error(IN + ' has music fix 2 - build from showcase_kascity_v6.html instead. Aborting.'); process.exit(1); }
if (!s.includes('__KV_MUSICFIX')) { console.error('run kascity_music_fix.cjs first - aborting, nothing written'); process.exit(1); }
const A = '    if(ctx.state!=="running"){ try{ ctx.resume(); }catch(e){} }\n    return ctx;';
const c = s.split(A).length - 1;
if (c !== 1) { console.error('music engine found ' + c + 'x - expected 1. Aborting - nothing written.'); process.exit(1); }
s = s.replace(A, '    if(ctx.state!=="running"){ try{ ctx.resume(); }catch(e){} }\n    window.__kvMMctx=ctx; window.__kvMMout=out;   // __KV_MUSICFIX3: sound effects share this engine\n    return ctx;');
const TAIL = `<script>
// ---- __KV_MUSICFIX3: music starts on the first tap; effects share the music engine; engine kept awake ----
(function(){
  var bufs={}, last={};
  function mm(){ var c=window.__kvMMctx; return (c&&c.state!=="closed")?c:null; }
  function revive(){ var c=mm(); if(c&&c.state!=="running"){ try{ c.resume(); }catch(e){} } }
  function kick(){ revive(); try{ var m=window.KV_MUSIC; if(m&&m.__kvmm&&m.paused&&!window.__kvMusicOff) m.play(); }catch(e){} }
  // first tap anywhere (capture phase, so the start screen can't swallow it) starts the music
  var first=true;
  function gesture(){ if(first){ first=false; kick(); } else revive(); }
  ["pointerdown","touchstart","click"].forEach(function(t){ document.addEventListener(t,gesture,true); });
  ["touchend","pointerup"].forEach(function(t){ document.addEventListener(t,revive,true); });
  setInterval(revive,1500);
  // the corner note / MUSIC mute is respected
  document.addEventListener("click",function(e){ var t=e.target; if(!t||!t.closest) return;
    if(t.closest("#kvx_note")) setTimeout(function(){ var m=window.KV_MUSIC; window.__kvMusicOff=!!(m&&m.paused); },0); },true);
  function decode(k){ var c=mm(), a=window.KV_VOX&&window.KV_VOX[k]; if(!c||!a||!a.src||bufs[k]) return; bufs[k]="loading";
    try{ var bin=atob(String(a.src).split(",")[1]||""), u=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
      var ok=function(b){ bufs[k]=b; }, no=function(){ bufs[k]="bad"; };
      var p=c.decodeAudioData(u.buffer,ok,no); if(p&&p.then) p.then(ok,no); }catch(e){ bufs[k]="bad"; } }
  var old=window.KV_SFX;
  window.KV_SFX=function(k){
    var c=mm(), b=bufs[k];
    if(c && c.state==="running" && b && b!=="loading" && b!=="bad"){
      var n=Date.now(), cd=(k==="why")?3800:220; if(last[k]&&n-last[k]<cd) return; last[k]=n;
      try{ var s=c.createBufferSource(); s.buffer=b; var g=c.createGain(); g.gain.value=0.9; s.connect(g); g.connect(window.__kvMMout||c.destination); s.start(); return; }catch(e){}
    }
    if(c) decode(k);
    try{ if(old) old(k); }catch(e){}
    [120,600,1500,3200].forEach(function(ms){ setTimeout(revive,ms); });
  };
  setInterval(function(){ if(mm()) for(var k in (window.KV_VOX||{})) decode(k); },2000);
})();
</script>
`;
s = s.replace(/\s*$/, '\n') + TAIL;
fs.writeFileSync(OUT, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('OK - ' + OUT + ' written (' + fs.statSync(OUT).size + ' bytes)');
