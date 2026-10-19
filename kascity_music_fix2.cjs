// kascity_music_fix2.cjs - music plays the whole 7 minutes.
// Cause: every sound effect (dice, ching, boo...) played as a separate audio file, and on iPhone starting
// one of those interrupts the music engine - so the music stopped at the first roll.
// Fix: sound effects now play through the SAME audio engine as the music (decoded once, mixed in),
// and any tap restarts the music engine if the phone paused it.
// Usage: node kascity_music_fix2.cjs <input.html> <output.html>   (run after kascity_music_fix.cjs)
const fs = require('fs');
const [, , IN, OUT] = process.argv;
if (!IN || !OUT) { console.error('usage: node kascity_music_fix2.cjs <input.html> <output.html>'); process.exit(1); }
let s = fs.readFileSync(IN, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('__KV_MUSICFIX2')) { console.log(IN + ': already has music fix 2 - nothing to do'); process.exit(0); }
if (!s.includes('__KV_MUSICFIX')) { console.error('run kascity_music_fix.cjs first - aborting, nothing written'); process.exit(1); }
const A = '    if(ctx.state!=="running"){ try{ ctx.resume(); }catch(e){} }\n    return ctx;';
const c = s.split(A).length - 1;
if (c !== 1) { console.error('music engine found ' + c + 'x - expected 1. Aborting - nothing written.'); process.exit(1); }
s = s.replace(A, '    if(ctx.state!=="running"){ try{ ctx.resume(); }catch(e){} }\n    window.__kvMMctx=ctx; window.__kvMMout=out;   // __KV_MUSICFIX2: sound effects share this engine\n    return ctx;');
const TAIL = `<script>
// ---- __KV_MUSICFIX2: sound effects through the music's audio engine; taps revive the engine ----
(function(){
  var bufs={}, own=null;
  function ctx(){ if(window.__kvMMctx) return window.__kvMMctx; if(!own){ var C=window.AudioContext||window.webkitAudioContext; if(C) own=new C(); } return own; }
  function decode(k){ var c=ctx(); var a=window.KV_VOX&&window.KV_VOX[k]; if(!c||!a||!a.src||bufs[k]) return;
    bufs[k]="loading";
    try{ var b64=String(a.src).split(",")[1]||""; var bin=atob(b64); var u=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
      var done=function(buf){ bufs[k]=buf; }, fail=function(){ bufs[k]=null; };
      var p=c.decodeAudioData(u.buffer, done, fail); if(p&&p.then) p.then(done,fail); }catch(e){ bufs[k]=null; } }
  function revive(){ var c=window.__kvMMctx; if(c&&c.state!=="running"){ try{ c.resume(); }catch(e){} } if(own&&own.state!=="running"){ try{ own.resume(); }catch(e){} } }
  ["touchend","pointerup","click"].forEach(function(t){ document.addEventListener(t,revive,true); });
  setInterval(revive,2000);
  var last={}, old=window.KV_SFX;
  window.KV_SFX=function(k){
    var c=ctx(), b=bufs[k];
    if(!c||!b||b==="loading"){ decode(k); return; }   // first use decodes; never falls back to the old audio-file path
    var n=Date.now(), cd=(k==="why")?3800:220; if(last[k]&&n-last[k]<cd) return; last[k]=n;
    try{ revive(); var src=c.createBufferSource(); src.buffer=b; var g=c.createGain(); g.gain.value=0.9; src.connect(g);
      g.connect(c===window.__kvMMctx&&window.__kvMMout?window.__kvMMout:c.destination); src.start(); }catch(e){}
  };
  setTimeout(function(){ try{ for(var k in (window.KV_VOX||{})) decode(k); }catch(e){} },1500);
  document.addEventListener("pointerdown",function once(){ try{ for(var k in (window.KV_VOX||{})) decode(k); }catch(e){} document.removeEventListener("pointerdown",once,true); },true);
})();
</script>
`;
s = s.replace(/\s*$/, '\n') + TAIL;
fs.writeFileSync(OUT, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('OK - ' + OUT + ' written (' + fs.statSync(OUT).size + ' bytes)');
