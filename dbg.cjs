// dbg.cjs — serves kascity.json in the engine with a live flag banner.
const fs = require('fs');
const http = require('http');

const eng = fs.readFileSync('scene_engine.html', 'utf8');
const scene = fs.readFileSync('kascity.json', 'utf8');

const probe = [
  '<div id="kvp" style="position:fixed;top:0;left:0;right:0;z-index:99999;',
  'font:13px monospace;padding:6px;background:#111;color:#0f0">loading…</div>',
  '<script>',
  'var T=0;',
  'window.addEventListener("message",function(e){',
  '  try{var m=JSON.parse(e.data);',
  '    if(m.kv==="ready"){kvp.textContent="READY — polling flags";}',
  '    if(m.kv==="error"){kvp.style.background="#600";kvp.textContent="ERROR: "+m.message;}',
  '  }catch(x){}',
  '});',
  'window.onerror=function(msg,src,line){kvp.style.background="#600";kvp.textContent="JS: "+msg+" @"+line;};',
  'setInterval(function(){',
  '  try{ if(window.world){',
  '    kvp.textContent="ready="+(world.flags.ready||0)+" phase="+(world.flags.phase||0)',
  '      +" asked="+(world.flags.asked||0)+" go="+(world.flags.go)+" seat="+(world.flags.seat||0)',
  '      +" pos="+(world.flags.pos||0)+" t="+(++T);',
  '  } }catch(x){}',
  '},500);',
  '</scr'+'ipt>',
].join('');

const inj = '<script>window.__KV_SCENE__=' + scene.replace(/</g, '\\u003c') + ';</scr' + 'ipt>';
fs.writeFileSync('kcprev.html', probe + inj + eng);

http.createServer((q, s) => {
  const p = q.url === '/' ? '/kcprev.html' : q.url;
  let body;
  try { body = fs.readFileSync('.' + p); }
  catch (e) { s.writeHead(404); s.end('no'); return; }
  s.writeHead(200, { 'Content-Type': 'text/html' });
  s.end(body);
}).listen(8080, '0.0.0.0', () => console.log('http://localhost:8080/  (Ctrl+C to stop)'));
