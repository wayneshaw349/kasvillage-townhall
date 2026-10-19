// kascity_audio_unlock.cjs - iPhone silent-switch fix.
// iPhone mutes the game's synth engine (music + effects) when the side switch is on silent, UNLESS a normal
// audio file is playing. The old effects were audio files, so they kept sound on by accident; now that
// effects go through the synth, nothing kept it on. This starts a looping silent audio clip on the first
// tap, which tells iPhone "this app plays media" - music and effects then play with the switch either way.
// Usage: node kascity_audio_unlock.cjs <input.html> <output.html>   (run after kascity_music_fix3.cjs)
const fs = require('fs');
const [, , IN, OUT] = process.argv;
if (!IN || !OUT) { console.error('usage: node kascity_audio_unlock.cjs <input.html> <output.html>'); process.exit(1); }
let s = fs.readFileSync(IN, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('__KV_AUDIO_UNLOCK')) { console.log(IN + ': already unlocked - nothing to do'); process.exit(0); }
const TAIL = `<script>
// ---- __KV_AUDIO_UNLOCK: a looping silent clip keeps iPhone in "media" mode so the synth is never muted ----
(function(){
  function silentWav(){ var n=4000, b=new Uint8Array(44+n), v=new DataView(b.buffer);
    function str(o,t){ for(var i=0;i<t.length;i++) b[o+i]=t.charCodeAt(i); }
    str(0,"RIFF"); v.setUint32(4,36+n,true); str(8,"WAVE"); str(12,"fmt "); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
    v.setUint32(24,8000,true); v.setUint32(28,8000,true); v.setUint16(32,1,true); v.setUint16(34,8,true); str(36,"data"); v.setUint32(40,n,true);
    for(var i=0;i<n;i++) b[44+i]=128;
    var s=""; for(var j=0;j<b.length;j++) s+=String.fromCharCode(b[j]); return "data:audio/wav;base64,"+btoa(s); }
  var tag=null;
  function unlock(){
    try{
      if(!tag){ tag=document.createElement("audio"); tag.src=silentWav(); tag.loop=true; tag.setAttribute("playsinline",""); tag.setAttribute("webkit-playsinline",""); tag.preload="auto"; tag.volume=1; window.__kvUnlockTag=tag; }
      if(tag.paused){ var p=tag.play(); if(p&&p.catch) p.catch(function(){}); }
    }catch(e){}
    try{ var c=window.__kvMMctx; if(c&&c.state!=="running") c.resume(); }catch(e){}
  }
  ["touchend","click","pointerup"].forEach(function(t){ document.addEventListener(t,unlock,true); });
  document.addEventListener("visibilitychange",function(){ if(!document.hidden) unlock(); });
})();
</script>
`;
s = s.replace(/\s*$/, '\n') + TAIL;
fs.writeFileSync(OUT, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('OK - ' + OUT + ' written (' + fs.statSync(OUT).size + ' bytes)');
