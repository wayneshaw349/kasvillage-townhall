// fix_game_audio.cjs - music keeps playing while you wait your turn.
//
// The game already sets window.KV_MUSIC.loop = true, so looping was never
// broken. The WebView was:
//
//   allowsInlineMediaPlayback={false}
//
// On iOS that pushes media out of inline playback, and react-native-webview
// defaults mediaPlaybackRequiresUserAction to TRUE - so once the track is
// interrupted it needs a fresh user gesture to resume. While you are watching
// another player's turn you are not tapping anything, so it never resumes.
// That is why it always seemed to die during the wait.
//
// Both flags now enable for games only. Ordinary pages keep the lockdown -
// they have no business autoplaying audio.
// Run from layer1 root:  node src\\fix_game_audio.cjs
const fs = require("fs");
const P = "OnChainPageView.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("mediaPlaybackRequiresUserAction")) { console.log("already patched"); process.exit(0); }
const n = s.split("        allowsInlineMediaPlayback={false}").length - 1;
if (n !== 1) { console.error("ABORT: found " + n + ", expected 1"); process.exit(1); }
s = s.split("        allowsInlineMediaPlayback={false}").join("        // Games need inline audio. With allowsInlineMediaPlayback false, iOS\n        // forces media out of inline playback entirely, and with the default\n        // mediaPlaybackRequiresUserAction=true, anything that interrupts the\n        // track needs a FRESH user gesture to resume - which never comes while\n        // you are sitting watching someone else's turn. KV_MUSIC.loop was\n        // already true; the loop was never the problem.\n        // Both stay locked down for ordinary pages, which have no business\n        // autoplaying anything.\n        allowsInlineMediaPlayback={!!props.game}\n        mediaPlaybackRequiresUserAction={!props.game}");
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("ok  [inline-audio]");
console.log("\npatched " + P + ". Game audio plays inline and survives the wait.");
