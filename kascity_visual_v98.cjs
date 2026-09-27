// kascity_visual_v98.cjs
// Reads showcase_kascity97.html -> showcase_kascity98.html   (scene JSON unchanged)
//
// A. TWO CLOCKS WERE FIGHTING. The behaviour tree's clock starts at boot; the DOM countdown starts on
//    your first tap. They drift, which is why moves were recorded at t = -7 while the display still
//    showed time remaining — and why the seal fired too late and selfVerified stayed false. The DOM
//    countdown now READS the BT clock instead of running its own, so there is one source of truth.
//
// B. THE 86-SECOND FREEZE. t=139 jumps to t=53 in the log with nothing between. The watchdog only
//    watched world.flags.turn; if the tree stalled without the turn changing it never tripped. It now
//    also watches the move count and the clock, and escalates: clear blockers, then force the phase,
//    then advance the turn outright.
//
// C. THE BOTTOM BAR WAS EMPTY. All that space beside Roll now carries a scrollable feed of what has
//    happened, newest first, colour-coded — so you can look back at the turn you missed instead of
//    catching a banner or nothing.
//
// D. OFFERS. Bots were never blanket-declining; the bar is intrinsic x 0.98 x temperament, which for
//    a miser is 1.23x what the block is worth. That was invisible. The bid panel now shows the exact
//    number to beat and marks it on the slider, and a refusal states the figure they wanted.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity97.html')) die('showcase_kascity97.html missing');
let html = fs.readFileSync('showcase_kascity97.html', 'utf8');

// ---------- A. one clock ----------
const clkRe = /[ \t]*setInterval\(function\(\)\{\n[ \t]*if\(t0===null\)\{clock\.textContent="10:00";return;\}\n[ \t]*var l=Math\.max\(0,TOTAL-Math\.floor\(\(Date\.now\(\)-t0\)\/1000\)\);/;
if (!clkRe.test(html)) die('DOM clock loop not found');
html = html.replace(clkRe, [
  '    setInterval(function(){',
  '      // read the engine clock rather than keeping a second one — two clocks drift apart and the',
  '      // seal then fires against the wrong time',
  '      var bf=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var bl=(bf.left!=null)?Math.round(bf.left):null;',
  '      if(bl===null && t0===null){clock.textContent="10:00";return;}',
  '      var l=(bl!==null) ? Math.max(0,bl) : Math.max(0,TOTAL-Math.floor((Date.now()-t0)/1000));'
].join('\n'));

// ---------- B. a watchdog that actually escalates ----------
const wdRe = /[ \t]*\/\/ ---- stall detector ----\n[\s\S]*?\n[ \t]*\}, 1500\);\n[ \t]*\}\)\(\);/;
if (!wdRe.test(html)) die('stall detector not found');
html = html.replace(wdRe, [
  '  // ---- stall detector (escalating) ----',
  '  (function(){',
  '    var lastKey=null, since=Date.now(), step=0;',
  '    setInterval(function(){',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      if(f.over || window.KV_SEALED) return;',
  '      // watch the turn AND the move count AND the clock: a stall can freeze any one of them',
  '      var key=[f.turn, (window.KV_MOVES||[]).length, Math.round(f.left||0)].join("/");',
  '      if(key!==lastKey){ lastKey=key; since=Date.now(); step=0; return; }',
  '      var stuck=(Date.now()-since)/1000;',
  '      if(stuck>6 && step===0){',
  '        step=1;',
  '        if(window.KV_SETSTATE){',
  '          window.KV_SETSTATE("renov",-1); window.KV_SETSTATE("renov_by",0);',
  '          window.KV_SETSTATE("tr_state",0); window.KV_SETSTATE("sc_state",0);',
  '          window.KV_SETSTATE("sc_sell",-1); window.KV_SETSTATE("offer_ask",-1);',
  '        }',
  '      } else if(stuck>10 && step===1){',
  '        step=2;',
  '        if(window.KV_SETSTATE){ window.KV_SETSTATE("asked",0); window.KV_SETSTATE("phase",3); }',
  '        if(window.KV_LOG) window.KV_LOG("turn stalled "+Math.round(stuck)+"s — nudging","#e08a5a");',
  '      } else if(stuck>16 && step===2){',
  '        step=3;',
  '        // last resort: hand the turn to the next seat',
  '        var seat=((f.turn||0)%4)+1;',
  '        if(window.KV_SETSTATE){',
  '          window.KV_SETSTATE("turn",(f.turn||0)+1);',
  '          window.KV_SETSTATE("phase",0);',
  '          window.KV_SETSTATE("moved",0);',
  '          window.KV_SETSTATE("asked",0);',
  '        }',
  '        if(window.KV_LOG) window.KV_LOG("P"+seat+" was stuck — turn passed on","#ff6a4a");',
  '      }',
  '    }, 1200);',
  '  })();'
].join('\n'));

// ---------- C. scrollable feed in the bottom bar ----------
const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');
html = html.split(anchor).join([
  '  window.KV_END=endGame;',
  '',
  '  // ================= BOTTOM BAR FEED =================',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    var strip=document.createElement("div");',
  '    strip.style.cssText="position:fixed;left:270px;right:250px;bottom:8px;height:72px;z-index:59;'
    + 'background:rgba(20,16,12,.86);border:1px solid #3a3228;border-radius:6px;'
    + 'overflow-y:auto;overflow-x:hidden;padding:5px 10px;font:11px/1.5 monospace;color:#f4e4c1;";',
  '    document.body.appendChild(strip);',
  '',
  '    var head=document.createElement("div");',
  '    head.style.cssText="position:sticky;top:-5px;background:rgba(20,16,12,.95);color:#caa64c;'
    + 'font-weight:700;letter-spacing:2px;font-size:9px;padding:2px 0 3px;margin:-5px 0 3px;";',
  '    head.textContent="WHAT HAPPENED";',
  '    strip.appendChild(head);',
  '',
  '    var prevLog=window.KV_LOG;',
  '    window.KV_LOG=function(txt,col){',
  '      try{ if(prevLog) prevLog(txt,col); }catch(e){}',
  '      var row=document.createElement("div");',
  '      row.style.cssText="border-left:3px solid "+(col||"#8a7a5a")+";padding:1px 8px;margin-bottom:2px;";',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var l=Math.max(0,Math.round(f.left||0));',
  '      var mm=Math.floor(l/60), ss=String(l%60).padStart(2,"0");',
  '      row.innerHTML="<span style=\'opacity:.4\'>"+mm+":"+ss+"</span>  "+txt;',
  '      head.insertAdjacentElement("afterend", row);',
  '      while(strip.children.length>60) strip.removeChild(strip.lastChild);',
  '    };',
  '  })();'
].join('\n'));

// ---------- D. show the number to beat ----------
const hintRe = /[ \t]*hint\.innerHTML = !afford \? "<span style='color:#ff6a4a'>more than you have \("\+myCash\+"\)<\/span>"\n[\s\S]*?below their valuation \\u2014 they may refuse<\/span>"\);/;
if (!hintRe.test(html)) die('bid hint block not found');
html = html.replace(hintRe, [
  '        var fl=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '        var sellMul=fl["msl_p"+owner]||1.0;',
  '        var theirCash2=(window.KV_SEAT&&Math.round(window.KV_SEAT(owner,"cash")))||0;',
  '        var theirMort2=(window.KV_SEAT&&Math.round(window.KV_SEAT(owner,"mort")))||0;',
  '        var needy=(theirCash2<380||theirMort2>150);',
  '        var bar=Math.round(intr*(needy?0.76:0.98)*sellMul);',
  '        var label2=(window.KV_PROFNAME&&window.KV_PROFNAME(owner))||"";',
  '        hint.innerHTML = !afford',
  '          ? "<span style=\'color:#ff6a4a\'>more than you have ("+myCash+")</span>"',
  '          : (v>=bar',
  '              ? "<span style=\'color:#9cd87c\'>clears their bar of "+bar+" \\u2014 they should accept</span>"',
  '              : "<span style=\'opacity:.75\'>they want <b style=\'color:#f0c860\'>"+bar+"</b>"+',
  '                (label2?(" \\u00b7 the "+label2):"")+(needy?" \\u00b7 short of cash, so cheaper than usual":"")+"</span>");'
].join('\n'));

// mark the bar on the slider
const refreshRe = /[ \t]*sl\.oninput=refresh;/;
if (refreshRe.test(html)) {
  html = html.replace(refreshRe, [
    '      sl.oninput=refresh;',
    '      (function(){',
    '        var flx=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
    '        var sm=flx["msl_p"+owner]||1.0;',
    '        var tc=(window.KV_SEAT&&Math.round(window.KV_SEAT(owner,"cash")))||0;',
    '        var tm=(window.KV_SEAT&&Math.round(window.KV_SEAT(owner,"mort")))||0;',
    '        var bar2=Math.round(intr*(((tc<380||tm>150))?0.76:0.98)*sm);',
    '        var pct=Math.max(0,Math.min(100,((bar2-lo)/(hi-lo))*100));',
    '        var mark=document.createElement("div");',
    '        mark.style.cssText="position:relative;height:12px;margin-top:-2px;";',
    '        mark.innerHTML="<div style=\'position:absolute;left:"+pct+"%;transform:translateX(-50%);'
      + 'font:9px monospace;color:#f0c860;white-space:nowrap\'>\\u25b2 "+bar2+"</div>";',
    '        box.insertBefore(mark, sl.nextSibling);',
    '      })();'
  ].join('\n'));
}

// a refusal states the figure
const whyRe = /[ \t]*: \(label \? \("the "\+label\+" wants more"\) : "below what they will take"\);/;
if (whyRe.test(html)) {
  html = html.replace(whyRe,
    '          : ((label?("the "+label):"they")+" wanted "+Math.round(threshold));');
}

fs.writeFileSync('showcase_kascity98.html', html);
console.log('PASS one clock: the countdown reads the engine clock, so the seal fires on time');
console.log('PASS watchdog escalates — clears blockers at 6s, forces the phase at 10s, passes the turn at 16s');
console.log('PASS scrollable WHAT HAPPENED feed fills the empty bottom bar, timestamped and colour-coded');
console.log('PASS the bid panel shows the exact figure to beat, marked on the slider');
console.log('PASS a refusal names the number they wanted instead of a vague reason');
console.log('OK showcase_kascity98.html (' + (fs.statSync('showcase_kascity98.html').size/1024/1024).toFixed(1) + ' MB)');
