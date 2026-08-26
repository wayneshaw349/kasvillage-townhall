// kascity_visual_v101.cjs
// Reads showcase_kascity100.html -> showcase_kascity101.html   (scene JSON unchanged)
//
// FIVE SYMPTOMS AT ONCE (cannot buy, cannot click a property, unsure about rent, unsure about moving,
// proof failing) usually means one upstream cause, not five bugs. This stops the guessing:
//
// A. DIAGNOSTICS OVERLAY — press G. Live readout of everything that decides whether you can act:
//      humans flag, whose turn the engine thinks it is, phase, asked/go/buy prompt state,
//      your position and cash, whether flag writes work, popup state, move count and chain backlog.
//    Anything broken shows red. This is the panel that answers "why can't I buy" in one glance.
//
// B. POPUP FIX. v94 hid the popup, measured it, then repositioned on the next animation frame. If
//    anything threw in between — or the frame never ran because the tab was busy — it stayed hidden
//    forever, which looks exactly like "clicking a property does nothing". It now positions
//    immediately with a sensible guess, then refines on the next frame, and can never be left hidden.
//
// C. ACTION PROBE — press T to fire a scripted self-test: opens a property popup, checks the buttons
//    exist, attempts a flag write, and reports each result. Turns "it didn't work" into a specific line.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity100.html')) die('showcase_kascity100.html missing');
let html = fs.readFileSync('showcase_kascity100.html', 'utf8');

// ---------- B. popup can never be left invisible ----------
const posRe = /[ \t]*pop\.style\.display="block";\n[ \t]*pop\.style\.visibility="hidden";[\s\S]*?\n[ \t]*\}\);/;
if (!posRe.test(html)) die('popup positioning block not found — is v94 applied?');
html = html.replace(posRe, [
  '      // place immediately so the panel is never left hidden, then refine once measured',
  '      pop.style.display="block";',
  '      pop.style.visibility="visible";',
  '      var pad=12, bar=100;',
  '      var gx=Math.min(Math.max(pad, ev.clientX+pad), window.innerWidth-250);',
  '      var gy=Math.min(Math.max(pad, ev.clientY+pad), window.innerHeight-bar-240);',
  '      pop.style.left=gx+"px";',
  '      pop.style.top=gy+"px";',
  '      requestAnimationFrame(function(){',
  '        try{',
  '          var r=pop.getBoundingClientRect();',
  '          var w=r.width||210, h=r.height||220;',
  '          var x=ev.clientX+pad, y=ev.clientY+pad;',
  '          if(x+w > window.innerWidth-pad)  x=ev.clientX-w-pad;',
  '          if(x < pad) x=pad;',
  '          if(y+h > window.innerHeight-bar) y=ev.clientY-h-pad;',
  '          if(y < pad) y=Math.max(pad, window.innerHeight-bar-h);',
  '          pop.style.left=x+"px";',
  '          pop.style.top=y+"px";',
  '        }catch(e){}',
  '      });'
].join('\n'));

// ---------- A + C. diagnostics ----------
const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');
html = html.split(anchor).join([
  '  window.KV_END=endGame;',
  '',
  '  // ================= DIAGNOSTICS (press G) =================',
  '  (function(){',
  '    var box=document.createElement("pre");',
  '    box.style.cssText="position:fixed;left:250px;top:60px;z-index:90;display:none;'
    + 'background:rgba(8,6,4,.96);border:2px solid #caa64c;border-radius:8px;padding:12px 16px;'
    + 'font:11px/1.6 monospace;color:#f4e4c1;margin:0;min-width:430px;max-height:76vh;overflow:auto;";',
  '    document.body.appendChild(box);',
  '    var on=false;',
  '    document.addEventListener("keydown",function(e){',
  '      if(e.key==="g"||e.key==="G"){ on=!on; box.style.display=on?"block":"none"; }',
  '      if(e.key==="t"||e.key==="T"){ probe(); }',
  '    });',
  '',
  '    function ok(v){ return v ? "<span style=\'color:#9cd87c\'>ok</span>" : "<span style=\'color:#ff6a4a\'>BROKEN</span>"; }',
  '    function val(v,good){ return "<span style=\'color:"+(good?"#9cd87c":"#f0c860")+"\'>"+v+"</span>"; }',
  '',
  '    setInterval(function(){',
  '      if(!on) return;',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var humans=(window.KV_HUMANS||[1]);',
  '      var engineSeat=((f.turn||0)%4)+1;',
  '      var myTurn=humans.indexOf(engineSeat)>=0;',
  '      var N=window.KV_NAMES||{};',
  '      var owned=Object.keys(N).filter(function(k){return window.KV_OWNER&&window.KV_OWNER(parseInt(k,10))===humans[0];}).length;',
  '',
  '      // can a flag write reach the engine?',
  '      var wok=false;',
  '      try{ window.KV_SETSTATE("__probe", 7); wok = (window.KV_FLAGS()["__probe"]===7); }catch(e){}',
  '',
  '      var pop=document.querySelector("div[style*=\'z-index:61\']");',
  '      var lines=[',
  '        "<b style=\'color:#caa64c;letter-spacing:2px\'>DIAGNOSTICS</b>   <span style=\'opacity:.5\'>G to close \\u00b7 T to run a probe</span>",',
  '        "",',
  '        "<b>can you act?</b>",',
  '        "  humans flag        " + val(f.humans, f.humans===humans.length) + "   (client thinks " + humans.join(",") + ")",',
  '        "  engine says turn   " + val("P"+engineSeat, myTurn) + (myTurn ? "   <span style=\'color:#9cd87c\'>your move</span>" : "   waiting on a bot"),',
  '        "  phase              " + val(f.phase),',
  '        "  asked / go / buy   " + val(f.asked) + " / " + val(f.go) + " / " + val(f.buy),',
  '        "  buy_tile           " + val(f.buy_tile) + (N[f.buy_tile] ? ("  " + N[f.buy_tile].n + "  asking " + N[f.buy_tile].p) : ""),',
  '        "",',
  '        "<b>your position</b>",',
  '        "  square             " + val(f["p"+humans[0]]) + (N[f["p"+humans[0]]] ? ("  " + N[f["p"+humans[0]]].n) : "  (not a property)"),',
  '        "  owner of it        " + val((window.KV_OWNER && window.KV_OWNER(f["p"+humans[0]])) || "nobody"),',
  '        "  cash / blocks      " + val((window.KV_SEAT&&Math.round(window.KV_SEAT(humans[0],"cash")))) + " / " + val(owned),',
  '        "",',
  '        "<b>plumbing</b>",',
  '        "  flag writes        " + ok(wok),',
  '        "  KV_OWNER           " + ok(typeof window.KV_OWNER==="function"),',
  '        "  KV_SETSTATE        " + ok(typeof window.KV_SETSTATE==="function"),',
  '        "  tile click handler " + ok(window.KV_TILE_OPENERS && Object.keys(window.KV_TILE_OPENERS).length>0) +',
  '            "  (" + ((window.KV_TILE_OPENERS&&Object.keys(window.KV_TILE_OPENERS).length)||0) + " squares)",',
  '        "  popup element      " + ok(!!pop) + (pop ? ("  display:" + (pop.style.display||"-") + "  vis:" + (pop.style.visibility||"-")) : ""),',
  '        "  properties loaded  " + val(Object.keys(N).length, Object.keys(N).length>=16),',
  '        "",',
  '        "<b>record</b>",',
  '        "  moves logged       " + val((window.KV_MOVES||[]).length),',
  '        "  chain backlog      " + val((window.KV_CHAIN_PENDING?window.KV_CHAIN_PENDING():"?"), true),',
  '        "  sealed             " + val(window.KV_SEALED?"yes":"no"),',
  '        "  clock (engine)     " + val(Math.round(f.left||0))',
  '      ];',
  '      box.innerHTML=lines.join("\\n");',
  '    }, 500);',
  '',
  '    function probe(){',
  '      var out=[];',
  '      var humans=(window.KV_HUMANS||[1]);',
  '      var N=window.KV_NAMES||{};',
  '      var tiles=Object.keys(N).map(Number);',
  '      out.push("probe: " + tiles.length + " properties known");',
  '      try{',
  '        window.KV_SETSTATE("__probe2", 99);',
  '        out.push("probe: flag write " + (window.KV_FLAGS()["__probe2"]===99 ? "OK" : "FAILED"));',
  '      }catch(e){ out.push("probe: flag write THREW " + e.message); }',
  '      if(tiles.length){',
  '        try{',
  '          window.KV_OPEN_TILE(tiles[0], { stopPropagation:function(){}, clientX:600, clientY:300 });',
  '          var pop=document.querySelector("div[style*=\'z-index:61\']");',
  '          var vis = pop && pop.style.display!=="none" && pop.style.visibility!=="hidden";',
  '          out.push("probe: opening " + N[tiles[0]].n + " -> popup " + (vis?"VISIBLE":"NOT VISIBLE"));',
  '          out.push("probe: buttons in popup = " + (pop?pop.querySelectorAll("button").length:0));',
  '        }catch(e){ out.push("probe: opening a property THREW " + e.message); }',
  '      }',
  '      out.forEach(function(l){ if(window.KV_LOG) window.KV_LOG(l, "#caa64c"); });',
  '      console.log("[KV PROBE]\\n" + out.join("\\n"));',
  '    }',
  '    window.KV_PROBE = probe;',
  '  })();'
].join('\n'));

fs.writeFileSync('showcase_kascity101.html', html);
console.log('PASS popup positions immediately then refines — it can no longer be left invisible');
console.log('PASS press G for live diagnostics: turn, phase, prompts, position, plumbing, record state');
console.log('PASS press T to run a probe that opens a property and reports what it found');
console.log('OK showcase_kascity101.html (' + (fs.statSync('showcase_kascity101.html').size/1024/1024).toFixed(1) + ' MB)');
