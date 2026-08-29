// kascity_visual_v49.cjs   — 1 to 4 HUMAN PLAYERS
// Reads kascity_v47.json + showcase_kascity47.html -> kascity_v49.json + showcase_kascity49.html
// Replaces the fixed hotseat pair with a runtime choice. A start screen asks how many humans (1-4);
// seats above that count stay bots. Because the BT can't be re-patched at runtime, seat control is
// expressed as a world flag the bot branches read: bots act only when seat() > world.flags.humans.
//   humans = 1 -> solo vs 3 bots (40% XP)
//   humans = 2..4 -> p2p, full XP, every human seat co-signs the move root
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
for (const f of ['kascity_v47.json', 'showcase_kascity47.html']) if (!fs.existsSync(f)) die(f + ' missing');
const j = JSON.parse(fs.readFileSync('kascity_v47.json', 'utf8'));
const director = j.nodes.find(n => n.id === 'director') || die('director missing');

// ---------- 1. bot conditions become seat-count aware ----------
let botN = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const c0 = o.sequence[0] && o.sequence[0].cond;
    if (typeof c0 === 'string' && c0.indexOf('seat() != 1') >= 0) {
      o.sequence[0].cond = c0.split('seat() != 1').join('seat() > world.flags.humans');
      botN++;
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);
if (botN < 20) die('bot conditions rewritten ' + botN + ' (<20)');

// ---------- 2. human prompt branches ----------
let humN = 0;
(function walk2(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const c0 = o.sequence[0] && o.sequence[0].cond;
    if (typeof c0 === 'string' && c0.indexOf('seat() == 1') >= 0) {
      o.sequence[0].cond = c0.split('seat() == 1').join('seat() <= world.flags.humans');
      humN++;
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk2(v);
})(director.bt);
if (humN < 1) die('human prompt branches ' + humN);

// ---------- 3. boot seed (default 1; the start screen overwrites before play) ----------
let bootOk = false;
(function walkA(o) {
  if (bootOk || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) { o.splice(ri, 0, { after: 0.1, do: { action: 'setState', args: ['humans', 1] } }); bootOk = true; return; }
    o.forEach(walkA);
  } else Object.values(o).forEach(walkA);
})(director.alarms);
if (!bootOk) die('boot anchor missing');

const v49str = JSON.stringify(j);
fs.writeFileSync('kascity_v49.json', v49str);

// ---------- 4. showcase ----------
let html = fs.readFileSync('showcase_kascity47.html', 'utf8');
const oldJson = fs.readFileSync('kascity_v47.json', 'utf8');
if (html.split(JSON.stringify(oldJson)).length - 1 !== 1) die('embedded v47 JSON not found exactly once');
html = html.split(JSON.stringify(oldJson)).join(JSON.stringify(v49str));

const modeAnchor = 'window.KV_MODE = "solo";';
if (html.split(modeAnchor).length - 1 !== 1) die('mode anchor not found');
html = html.split(modeAnchor).join('window.KV_MODE = "solo";\nwindow.KV_HUMANS = [1];');

const multAnchor = 'var SOLO_MULT = 0.4;';
if (html.split(multAnchor).length - 1 !== 1) die('solo mult anchor not found');
html = html.split(multAnchor).join('var SOLO_MULT = 1.0; // set by the start screen');

const tailAnchor = '  window.KV_END=endGame;';
if (html.split(tailAnchor).length - 1 !== 1) die('endGame anchor not found');

const extra = [
  '  window.KV_END=endGame;',
  '',
  '  // ================= START SCREEN: 1-4 humans =================',
  '  (function(){',
  '    var COL2={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    var ov=document.createElement("div");',
  '    ov.style.cssText="position:fixed;inset:0;z-index:80;background:rgba(10,8,6,.94);display:flex;align-items:center;justify-content:center;";',
  '    var box=document.createElement("div");',
  '    box.style.cssText="background:#14100c;border:2px solid #caa64c;border-radius:10px;padding:26px 34px;font:13px/1.8 monospace;color:#f4e4c1;text-align:center;";',
  '    box.innerHTML="<div style=\'font:900 30px Impact,sans-serif;color:#f0c860;letter-spacing:3px\'>KASCITY</div>"+',
  '      "<div style=\'opacity:.75;margin-bottom:16px\'>how many people are playing?</div>";',
  '    [1,2,3,4].forEach(function(n){',
  '      var b=document.createElement("button");',
  '      b.textContent=n+(n===1?" player":" players");',
  '      b.style.cssText="display:block;width:190px;margin:7px auto;padding:9px;background:#2a2118;color:#f4e4c1;border:1px solid #5a4a3a;border-radius:6px;font:13px monospace;cursor:pointer;";',
  '      b.onmouseenter=function(){b.style.background="#3a2f22";};',
  '      b.onmouseleave=function(){b.style.background="#2a2118";};',
  '      b.onclick=function(){',
  '        window.KV_HUMANS=[]; for(var k=1;k<=n;k++) window.KV_HUMANS.push(k);',
  '        window.KV_MODE = (n===1) ? "solo" : "p2p";',
  '        window.KV_XP_MULT = (n===1) ? 0.4 : 1.0;',
  '        if(window.KV_SETSTATE) window.KV_SETSTATE("humans", n);',
  '        ov.remove();',
  '        if(window.KV_LOG) window.KV_LOG(n+" player"+(n>1?"s":"")+" — "+window.KV_MODE+" mode","#f0c860");',
  '      };',
  '      box.appendChild(b);',
  '    });',
  '    var note=document.createElement("div");',
  '    note.style.cssText="margin-top:14px;font-size:11px;opacity:.6;max-width:230px";',
  '    note.textContent="solo earns 40% XP — reputation comes from playing neighbours";',
  '    box.appendChild(note);',
  '    ov.appendChild(box); document.body.appendChild(ov);',
  '  })();',
  '',
  '  // ---- turn banner ----',
  '  (function(){',
  '    var COL2={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    var tb=document.createElement("div");',
  '    tb.style.cssText="position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:59;padding:5px 22px;border-radius:5px;font:900 15px monospace;letter-spacing:2px;color:#12100e;box-shadow:0 2px 10px rgba(0,0,0,.5);";',
  '    document.body.appendChild(tb);',
  '    var last=null;',
  '    setInterval(function(){',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var s=((f.turn||0)%4)+1;',
  '      if(s===last)return; last=s;',
  '      var human=(window.KV_HUMANS||[1]).indexOf(s)>=0;',
  '      tb.textContent = human ? ("PLAYER "+s+" — YOUR TURN") : ("P"+s+" thinking…");',
  '      tb.style.background=COL2[s]||"#f4e4c1";',
  '      tb.style.opacity = human ? 1 : 0.72;',
  '    },300);',
  '  })();',
  '',
  '  // ---- co-sign: every human seat confirms the move root ----',
  '  window.KV_SIGS={};',
  '  window.KV_COSIGN=function(){',
  '    var humans=window.KV_HUMANS||[1];',
  '    if(humans.length<2){',
  '      if(window.KV_RESULT){ window.KV_RESULT.signed=true; window.KV_RESULT.solo=true; }',
  '      return;   // solo needs no counterparty: the full move log is published for replay',
  '    }',
  '    var box=document.createElement("div");',
  '    box.style.cssText="position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:72;background:#14100c;border:1px solid #caa64c;border-radius:8px;padding:10px 16px;font:12px monospace;color:#f4e4c1;text-align:center;";',
  '    box.innerHTML="<b>CONFIRM RESULT</b><br><span style=\'opacity:.7\'>every player must agree to the move root</span><br>";',
  '    humans.forEach(function(p){',
  '      var b=document.createElement("button");',
  '      b.textContent="P"+p+" confirm";',
  '      b.style.cssText="margin:8px 4px 0;padding:6px 12px;background:#2a2118;color:#f4e4c1;border:1px solid #5a4a3a;border-radius:5px;font:12px monospace;cursor:pointer;";',
  '      b.onclick=function(){',
  '        window.KV_SIGS[p]={ wallet:(window.KV_WALLETS&&window.KV_WALLETS[p])||null, at:new Date().toISOString() };',
  '        b.textContent="P"+p+" \\u2713"; b.disabled=true; b.style.opacity=.6;',
  '        if(humans.every(function(q){return window.KV_SIGS[q];}) && window.KV_RESULT){',
  '          window.KV_RESULT.signatures=window.KV_SIGS;',
  '          window.KV_RESULT.signed=true;',
  '          if(window.KV_LOG) window.KV_LOG("result co-signed — XP claimable","#9cd87c");',
  '          box.innerHTML="<b style=\'color:#9cd87c\'>CO-SIGNED \\u2713</b>";',
  '        }',
  '      };',
  '      box.appendChild(b);',
  '    });',
  '    document.body.appendChild(box);',
  '  };'
].join('\n');
html = html.split(tailAnchor).join(extra);

// XP multiplier driven by the start screen
const xpLine = 'var a = Math.max(1, Math.round(amt * (window.KV_MODE==="solo" ? SOLO_MULT : 1)));';
if (html.split(xpLine).length - 1 !== 1) die('xp multiplier line not found');
html = html.split(xpLine).join('var a = Math.max(1, Math.round(amt * (window.KV_XP_MULT==null?1:window.KV_XP_MULT)));');

// mode + humans into the payload, then co-sign
const bellAnchor = 'log("FINAL BELL — moveRoot "+chain.slice(0,16)+"…","#f0c860");';
if (html.split(bellAnchor).length - 1 !== 1) die('final bell anchor not found');
html = html.split(bellAnchor).join(
  'window.KV_RESULT.humans=(window.KV_HUMANS||[1]).length;\n' +
  '    window.KV_RESULT.mode=window.KV_MODE;\n' +
  '    window.KV_RESULT.signed=false;\n' +
  '    ' + bellAnchor + '\n' +
  '    if(window.KV_COSIGN) window.KV_COSIGN();');

// expose setState so the start screen can write the humans flag into the BT
const readyHook = 'window.KV_SEED = (scene.meta && scene.meta.seed) || "kv";';
if (html.split(readyHook).length - 1 !== 1) die('seed hook not found');
html = html.split(readyHook).join(readyHook +
  '\n  window.KV_SETSTATE = function (k, v) { try { var c = exprCtx(null); if (c && c.world && c.world.flags) c.world.flags[k] = v; } catch (e) {} };');

fs.writeFileSync('showcase_kascity49.html', html);
console.log('PASS bot control is now seat() > world.flags.humans (' + botN + ' conditions)');
console.log('PASS human prompts are seat() <= world.flags.humans (' + humN + ' branches)');
console.log('PASS start screen selects 1-4 players; solo 40% XP, 2+ full rate');
console.log('PASS co-sign required from every human seat (skipped for solo, which publishes the move log)');
console.log('OK kascity_v49.json + showcase_kascity49.html (' + (fs.statSync('showcase_kascity49.html').size/1024/1024).toFixed(1) + ' MB)');
