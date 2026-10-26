// wire_v417_stream.cjs - KasCity v417: Streamer Mode for the DM offer panel.
//   🎥 toggle in "my contact"; your handle is hidden while it's on; "Contact Px" copies the handle
//   instead of showing it on screen; scam warning on offers. Game files only (no wallet files touched).
//   node wire_v417_stream.cjs   (project folder; safe to run twice; backups *.bak_stream)
const fs = require('fs');
const MARK = '__KV_V417_STREAM';
const WARN = "<div style='font-size:11px;color:#e0a040'>⚠ Only trust the handle you open from here. Never pay first to someone who DMs you.</div>";
const HUNKS = [
  ['    function myContact(){',
   '    /* __KV_V417_STREAM */ function kvSM(){ try{ return window.__kvStreamer===true||localStorage.getItem("kv_streamer")==="1"; }catch(e){ return window.__kvStreamer===true; } }\n' +
   '    function kvMask(c){ c=String(c||""); return c.length<5 ? "•••" : c.slice(0,2)+"•••"+c.slice(-2); }\n' +
   '    function myContact(){'],
  ['      try{ window.prompt("Contact P"+o.buyer+" and send this message:", o.contact+"  —  "+text); }catch(e){}',
   '      if(kvSM()){ var cp=o.contact+"  —  "+text; try{ navigator.clipboard.writeText(cp); log("🎥 P"+o.buyer+"\'s contact ("+kvMask(o.contact)+") + message copied — paste it off-stream","#c4b5fd"); }catch(e){ log("🎥 streamer mode: turn it off to see P"+o.buyer+"\'s contact","#c4b5fd"); } return; }\n' +
   '      try{ window.prompt("Contact P"+o.buyer+" and send this message:", o.contact+"  —  "+text); }catch(e){}'],
  ["h+=\"<h4>my contact</h4><div><input id='kvo_c' style='width:200px' value='\"+esc(myContact())+\"' placeholder='@telegram or email'> <button id='kvo_cs'>save</button></div>\";",
   "var sm=kvSM(); h+=\"<h4>my contact <button id='kvo_sm' style='font-size:11px;\"+(sm?\"background:#4c1d95;color:#fff\":\"\")+\"'>🎥 streamer \"+(sm?\"ON\":\"off\")+\"</button></h4><div><input id='kvo_c' type='\"+(sm?\"password\":\"text\")+\"' style='width:200px' value='\"+esc(myContact())+\"' placeholder='@telegram or email'> <button id='kvo_cs'>save</button></div>\";"],
  ['      h+="<h4>offers on my blocks</h4>"; var any=0;',
   '      h+="<h4>offers on my blocks</h4>' + WARN.replace(/"/g, '\\"') + '"; var any=0;'],
  ['      var sd=document.getElementById("kvo_send"); if(sd) sd.onclick=function(){',
   '      var smb=document.getElementById("kvo_sm"); if(smb) smb.onclick=function(){ var on=!kvSM(); try{ localStorage.setItem("kv_streamer", on?"1":"0"); }catch(e){} window.__kvStreamer=on; log(on?"🎥 streamer mode ON — contacts hidden":"streamer mode off","#c4b5fd"); render(true); };\n' +
   '      var sd=document.getElementById("kvo_send"); if(sd) sd.onclick=function(){'],
];
const FILES = ['showcase_kascity_v417.html', 'dev_kascity_v417_browser.html'];
let bad = 0;
for (const f of FILES) {
  if (!fs.existsSync(f)) { console.log('  skip  ' + f + ' (not found)'); continue; }
  const raw = fs.readFileSync(f, 'utf8'); const crlf = /\r\n/.test(raw);
  let t = crlf ? raw.replace(/\r\n/g, '\n') : raw;
  if (t.includes(MARK)) { console.log('  done  ' + f + ' (already patched)'); continue; }
  let ok = true;
  for (const [a, b] of HUNKS) { if (t.split(a).length !== 2) { ok = false; console.log('    missing: ' + a.slice(0, 70)); break; } t = t.replace(a, () => b); }
  if (!ok) { console.log('  FAIL  ' + f + ' (left untouched)'); bad++; continue; }
  fs.writeFileSync(f + '.bak_stream', raw);
  fs.writeFileSync(f, crlf ? t.replace(/\n/g, '\r\n') : t);
  console.log('  ok    ' + f);
}
console.log(bad ? '\n' + bad + ' file(s) failed' : '\nDone. Publish showcase_kascity_v417.html (never the dev_ copy).');
