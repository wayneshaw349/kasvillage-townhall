// patch253_feedcopy.cjs
// SRC showcase_kascity252.html -> DST showcase_kascity253.html
// Copyable play-by-play. Wraps KV_LOG so every feed line is captured with a timestamp:
//   KV.feed(n)      -> prints the last n lines (default 200) and copies them to the clipboard
//   KV.feed("all")  -> the whole capture
//   floating [copy log] button (bottom-right) does the same with one click
// Appended as a late script; no engine anchors touched.

const fs = require("fs");
const SRC = "showcase_kascity252.html";
const DST = "showcase_kascity253.html";

let raw = fs.readFileSync(SRC, "utf8");
const hadCRLF = raw.indexOf("\r\n") >= 0;
let s = hadCRLF ? raw.replace(/\r\n/g, "\n") : raw;

// file has no closing </html>; the block is appended at EOF

const block = `<script>
// __KV_V253: copyable feed
(function(){
  window.__KVFEED = window.__KVFEED || [];
  function ts(){ var d=new Date(); return d.toTimeString().slice(0,8); }
  function wrap(){
    if(!window.KV_LOG || window.KV_LOG.__wrapped) return setTimeout(wrap, 400);
    var orig = window.KV_LOG;
    var w = function(msg, color){
      try{ window.__KVFEED.push(ts()+" "+String(msg)); if(window.__KVFEED.length>3000) window.__KVFEED.splice(0, 500); }catch(e){}
      return orig.apply(this, arguments);
    };
    w.__wrapped = true;
    window.KV_LOG = w;
  }
  wrap();
  function grab(n){
    var a = window.__KVFEED || [];
    var out = (n==="all") ? a : a.slice(-(n||200));
    return out.join("\\n");
  }
  function toClip(text){
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){ console.log("copied "+text.split("\\n").length+" feed lines to the clipboard"); },
        function(){ console.log(text); console.log("(clipboard blocked -- text printed above)"); });
    } else { console.log(text); }
  }
  function wireCmd(){
    if(window.KV){ window.KV.feed = function(n){ var t=grab(n); toClip(t); return (window.__KVFEED||[]).length+" lines captured"; }; }
    else setTimeout(wireCmd, 400);
  }
  wireCmd();
  function btn(){
    if(!document.body) return setTimeout(btn, 400);
    var b=document.createElement("button");
    b.textContent="copy log";
    b.style.cssText="position:fixed;right:10px;bottom:10px;z-index:79;padding:5px 10px;background:#2a2118;color:#caa64c;border:1px solid #5a4a3a;border-radius:5px;font:10px monospace;cursor:pointer;opacity:.75;";
    b.onclick=function(){ toClip(grab(400)); b.textContent="copied!"; setTimeout(function(){ b.textContent="copy log"; }, 1200); };
    document.body.appendChild(b);
  }
  btn();
})();
</script>
`;

s = s + "\n" + block;

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");
const chk = fs.readFileSync(DST, "utf8");
if (chk.indexOf("__KV_V253: copyable feed") < 0) { console.error("POST-WRITE CHECK FAILED"); process.exit(1); }
console.log("OK -> " + DST);
