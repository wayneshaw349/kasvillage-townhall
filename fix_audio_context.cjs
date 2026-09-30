// fix_audio_context.cjs - music survives the wait (no republish).
//
// The sequencer was never the problem:
//   function sched(){ ... var i = step %% 64; ... }   <- wraps, loops forever
//
// It schedules against ctx.currentTime, and iOS SUSPENDS an AudioContext
// during inactivity - a suspended context's clock stops dead, so the while
// loop schedules nothing and the track goes silent with no error. Waiting on
// another player's turn is precisely when nobody touches the screen.
//
// ctx is a closure local inside the game, and the game is immutable on chain.
// So we wrap window.AudioContext BEFORE the page's scripts run, keep a handle
// on every instance, and resume any that fall asleep - on a 1.5s tick, on
// touch, and on visibilitychange. Games only; pages get nothing.
// Requires wire_kv_pay.cjs (the KV_WNET_INJECT line it anchors on).
// Run from layer1 root:  node src\\fix_audio_context.cjs
const fs = require("fs");
const P = "OnChainPageView.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("KV_AUDIO_KEEP")) { console.log("already patched"); process.exit(0); }
function rep(name, a, b) {
  const f = s.split(a).length - 1;
  if (f !== 1) { console.error("ABORT [" + name + "]: found " + f + ", expected 1"); process.exit(1); }
  s = s.split(a).join(b); console.log("ok  [" + name + "]");
}
rep("audio-keep-const", "function injectCsp(raw: string): string {", "// iOS suspends a Web Audio AudioContext during inactivity. The game's\n// sequencer loops correctly (step % 64, driven by setInterval) - but it\n// schedules against ctx.currentTime, and a suspended context's clock STOPS.\n// So `while (nt < ctx.currentTime + .12)` schedules nothing, the music goes\n// silent with no error, and only a gesture plus resume() revives it. Which is\n// why it always died while waiting on someone else's turn: that is exactly\n// when nobody is touching the screen.\n//\n// The context is a closure local, so we wrap the constructor BEFORE the page\n// loads, keep every instance, and resume any that fall asleep. The game is on\n// chain and immutable; this fixes it from outside without a republish.\nconst KV_AUDIO_KEEP = \"(function(){try{var C=window.AudioContext||window.webkitAudioContext;if(!C)return;var made=[];function W(){var c=new C();made.push(c);return c;}W.prototype=C.prototype;try{window.AudioContext=W;}catch(e){}try{window.webkitAudioContext=W;}catch(e){}function kick(){for(var i=0;i<made.length;i++){var c=made[i];if(c&&c.state==='suspended'){try{c.resume();}catch(e){}}}}setInterval(kick,1500);document.addEventListener('touchstart',kick,true);document.addEventListener('touchend',kick,true);document.addEventListener('visibilitychange',kick);window.__kvAudioKick=kick;}catch(e){}})();true;\";\n\nfunction injectCsp(raw: string): string {");
rep("inject-for-games", "        injectedJavaScriptBeforeContentLoaded={CONSOLE_TAP + BRIDGE + KV_WNET_INJECT}", "        injectedJavaScriptBeforeContentLoaded={CONSOLE_TAP + BRIDGE + KV_WNET_INJECT + (props.game ? KV_AUDIO_KEEP : '')}");
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + ". Suspended AudioContexts now get resumed.");
