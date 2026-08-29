// kascity_visual_v79.cjs
// Reads showcase_kascity77.html -> showcase_kascity79.html   (scene JSON unchanged)
//
// A. LOBBY MOVES TO THE START SCREEN. Host / Join / Direct link were floating bars sitting on top of
//    the board mid-game. They now live on the opening screen beside the 1-4 player choice, which is
//    where you actually decide how you are playing. The floating bars are removed.
// B. PANEL OVERLAP. GAME LOG and PLAY BY PLAY were drawing over each other on the right edge.
//    GAME LOG is pinned to the upper right, PLAY BY PLAY sits below it with a fixed gap.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
const src = ['showcase_kascity77.html','showcase_kascity78.html'].find(f => fs.existsSync(f));
if (!src) die('showcase_kascity77.html missing');
console.log('source: ' + src);
let html = fs.readFileSync(src, 'utf8');

// ---------- A. strip the floating lobby bars ----------
let removed = 0;
const barPatterns = [
  // v75 relay bar
  /\n\s*var bar=el\("div","position:fixed;left:50%;bottom:52px;[\s\S]*?join\.onclick=function\(e\)\{ e\.stopPropagation\(\); if\(code\.value\.trim\(\)\) window\.KV_JOIN\(code\.value\); \};/,
  // v76 direct-link bar
  /\n\s*var bar=el\("div","position:fixed;left:50%;bottom:84px;[\s\S]*?b1\.onclick=function\(e\)\{ e\.stopPropagation\(\); openPanel\(\); \};/,
  // v77 three-node bar
  /\n\s*var bar=el\("div","position:fixed;left:50%;bottom:118px;[\s\S]*?jn\.onclick=function\(e\)\{ e\.stopPropagation\(\); if\(c\.value\.trim\(\)\) window\.KV_MP_JOIN\(c\.value\); \};/
];
for (const re of barPatterns) {
  if (re.test(html)) { html = html.replace(re, '\n      /* lobby moved to the start screen */'); removed++; }
}
if (removed < 1) die('no floating lobby bars matched — check the source build');

// ---------- A. add the lobby to the start screen ----------
const noteRe = /    var note=document\.createElement\("div"\);\n    note\.style\.cssText="margin-top:14px;font-size:11px;opacity:\.6;max-width:230px";\n    note\.textContent="solo earns 40% XP — reputation comes from playing neighbours";\n    box\.appendChild\(note\);/;
if (!noteRe.test(html)) die('start screen note block not found');

html = html.replace(noteRe, [
  '    var note=document.createElement("div");',
  '    note.style.cssText="margin-top:12px;font-size:11px;opacity:.6;max-width:250px";',
  '    note.textContent="solo earns 40% XP — reputation comes from playing neighbours";',
  '    box.appendChild(note);',
  '',
  '    // ---- play online ----',
  '    var hr=document.createElement("div");',
  '    hr.style.cssText="margin:16px 0 10px;border-top:1px solid #3a3228;padding-top:12px;color:#caa64c;font-weight:700;letter-spacing:2px;font-size:11px;";',
  '    hr.textContent="PLAY ONLINE";',
  '    box.appendChild(hr);',
  '',
  '    var wifi=document.createElement("div");',
  '    wifi.style.cssText="font-size:10px;opacity:.65;margin-bottom:9px;max-width:250px;line-height:1.5;";',
  '    wifi.textContent="both players need WiFi. mobile data blocks the connection.";',
  '    box.appendChild(wifi);',
  '',
  '    function lobbyBtn(label, col, brd, fn){',
  '      var b=document.createElement("button");',
  '      b.textContent=label;',
  '      b.style.cssText="display:block;width:250px;margin:5px auto;padding:8px;background:"+col+";color:#f4e4c1;border:1px solid "+brd+";border-radius:6px;font:12px monospace;cursor:pointer;";',
  '      b.onclick=function(e){ e.stopPropagation(); fn(b); };',
  '      box.appendChild(b);',
  '      return b;',
  '    }',
  '',
  '    lobbyBtn("Host a game","#2f4a2f","#4fd98a", async function(b){',
  '      b.textContent="opening…";',
  '      var room = window.KV_MP_HOST ? await window.KV_MP_HOST() : (window.KV_HOST ? await window.KV_HOST() : null);',
  '      if(room){',
  '        b.textContent="ROOM  "+room;',
  '        b.style.background="#1b3a24";',
  '        wifi.textContent="share this code, then press Start when they join";',
  '        var go=lobbyBtn("Start game","#22303a","#4f7fd9", function(){ ov.remove(); });',
  '        go.scrollIntoView({block:"nearest"});',
  '      } else { b.textContent="Host a game"; wifi.textContent="could not reach the relay — solo still works"; }',
  '    });',
  '',
  '    var joinRow=document.createElement("div");',
  '    joinRow.style.cssText="display:flex;gap:6px;width:250px;margin:5px auto;";',
  '    var code=document.createElement("input");',
  '    code.placeholder="room code";',
  '    code.style.cssText="flex:1;padding:8px;background:#1a1410;color:#f4e4c1;border:1px solid #5a4a3a;border-radius:6px;font:12px monospace;box-sizing:border-box;";',
  '    code.onclick=function(e){ e.stopPropagation(); };',
  '    var jn=document.createElement("button");',
  '    jn.textContent="Join";',
  '    jn.style.cssText="flex:0 0 74px;padding:8px;background:#2a2118;color:#f4e4c1;border:1px solid #5a4a3a;border-radius:6px;font:12px monospace;cursor:pointer;";',
  '    jn.onclick=async function(e){',
  '      e.stopPropagation();',
  '      if(!code.value.trim()) return;',
  '      jn.textContent="…";',
  '      var seat = window.KV_MP_JOIN ? await window.KV_MP_JOIN(code.value) : (window.KV_JOIN ? await window.KV_JOIN(code.value) : null);',
  '      if(seat){ ov.remove(); } else { jn.textContent="Join"; wifi.textContent="could not join that room"; }',
  '    };',
  '    joinRow.appendChild(code); joinRow.appendChild(jn);',
  '    box.appendChild(joinRow);',
  '',
  '    lobbyBtn("Direct link (same WiFi)","#2a2118","#5a4a3a", function(){',
  '      if(window.KV_DIRECT_PANEL) window.KV_DIRECT_PANEL();',
  '      else if(window.KV_LOG) window.KV_LOG("direct link unavailable in this build","#ff6a4a");',
  '    });'
].join('\n'));

// expose the direct-link panel so the start screen can open it
const openPanelRe = /      function openPanel\(\)\{/;
if (openPanelRe.test(html)) {
  html = html.replace(openPanelRe, '      window.KV_DIRECT_PANEL = openPanel;\n      function openPanel(){');
}

// ---------- B. separate the two right-hand panels ----------
const glRe = /var panel=el\("div","position:fixed;right:6px;top:50%;transform:translateY\(-50%\);z-index:57;width:236px;/;
if (!glRe.test(html)) die('game log panel style not found');
html = html.replace(glRe,
  'var panel=el("div","position:fixed;right:6px;top:150px;z-index:57;width:236px;');

html = html.split('top:calc(50% + 10px)').join('top:430px');
html = html.split('hdr.style.top="calc(50% - 14px)"').join('hdr.style.top="406px"');

fs.writeFileSync('showcase_kascity79.html', html);
console.log('PASS ' + removed + ' floating lobby bar(s) removed from the board');
console.log('PASS Host / room code + Join / Direct link now on the start screen under PLAY ONLINE');
console.log('PASS WiFi requirement stated on the start screen');
console.log('PASS GAME LOG pinned top-right, PLAY BY PLAY below it — no more overlap');
console.log('OK showcase_kascity79.html (' + (fs.statSync('showcase_kascity79.html').size/1024/1024).toFixed(1) + ' MB)');
