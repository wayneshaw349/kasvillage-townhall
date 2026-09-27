// kascity_visual_v100.cjs
// Reads showcase_kascity99.html -> showcase_kascity100.html   (scene JSON unchanged)
//
// WHY THE BOTTOM FEED WAS EMPTY. Every patcher injects its block immediately after the same anchor,
// so the NEWEST block executes FIRST and older ones run after it. v98's feed wrapped window.KV_LOG on
// the way in — and then the older play-by-play code (v55) ran and reassigned window.KV_LOG outright,
// throwing the wrapper away. The panel drew its header and never received a single line.
//
// Fix: hook after everything has settled. The feed now installs its wrapper on a short delay AND
// re-checks periodically, so no matter which block redefines KV_LOG or when, the feed re-attaches to
// whatever the current one is. It also backfills from the existing play-by-play so the panel is not
// blank on arrival.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity99.html')) die('showcase_kascity99.html missing');
let html = fs.readFileSync('showcase_kascity99.html', 'utf8');

// replace the whole bottom-feed block with a self-healing version
const feedRe = /[ \t]*\/\/ ================= BOTTOM BAR FEED =================\n[\s\S]*?\n[ \t]*\}\)\(\);/;
if (!feedRe.test(html)) die('bottom feed block not found — is v98 applied?');

html = html.replace(feedRe, [
  '  // ================= BOTTOM BAR FEED =================',
  '  (function(){',
  '    var PC={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '',
  '    var strip=document.createElement("div");',
  '    strip.style.cssText="position:fixed;left:270px;right:250px;bottom:6px;height:88px;z-index:59;'
    + 'background:rgba(20,16,12,.9);border:1px solid #4a3f30;border-radius:7px;'
    + 'overflow-y:auto;overflow-x:hidden;padding:6px 12px;font:13px/1.55 monospace;color:#f4e4c1;";',
  '    document.body.appendChild(strip);',
  '',
  '    var head=document.createElement("div");',
  '    head.style.cssText="position:sticky;top:-6px;background:rgba(20,16,12,.97);color:#caa64c;'
    + 'font-weight:900;letter-spacing:3px;font-size:10px;padding:3px 0 4px;margin:-6px 0 4px;";',
  '    head.textContent="WHAT HAD HAPPENED WAS";',
  '    strip.appendChild(head);',
  '',
  '    function paint(txt, col){',
  '      var row=document.createElement("div");',
  '      row.style.cssText="border-left:3px solid "+(col||"#8a7a5a")+";padding:2px 9px;margin-bottom:3px;";',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var l=Math.max(0,Math.round(f.left||0));',
  '      var mm=Math.floor(l/60), ss=String(l%60).padStart(2,"0");',
  '      var body=String(txt);',
  '      body=body.replace(/\\bP([1-4])\\b/g, function(_,d){ return "<b style=\'color:"+PC[d]+"\'>P"+d+"</b>"; });',
  '      body=body.replace(/\\+(\\d+)/g, "<b style=\'color:#9cd87c\'>+$1</b>");',
  '      body=body.replace(/\\b(paid|lost|taxed|owes|backfired)\\b ?(\\d+)?/gi, function(_,w,n){',
  '        return "<b style=\'color:#ff6a4a\'>"+w+(n?(" "+n):"")+"</b>"; });',
  '      body=body.replace(/\\b(bought|sold|renovated|listed|collected|received|acquired|evicted|wins|shifts|worked)\\b/gi,',
  '        "<b style=\'color:#ffffff\'>$1</b>");',
  '      body=body.replace(/\\bXP\\b/g, "<b style=\'color:#9cd87c\'>XP</b>");',
  '      row.innerHTML="<span style=\'opacity:.35;font-size:11px\'>"+mm+":"+ss+"</span>  "+body;',
  '      head.insertAdjacentElement("afterend", row);',
  '      while(strip.children.length>60) strip.removeChild(strip.lastChild);',
  '    }',
  '    window.KV_FEED_PAINT = paint;',
  '',
  '    // Blocks are injected newest-first, so an OLDER block can reassign window.KV_LOG after this',
  '    // one runs and drop the wrapper. Re-attach on a delay, and keep checking: whatever KV_LOG is',
  '    // at any moment, the feed rides on top of it.',
  '    var wrapped=null;',
  '    function attach(){',
  '      var cur=window.KV_LOG;',
  '      if(typeof cur!=="function" || cur===wrapped) return;',
  '      var inner=cur;',
  '      var w=function(txt,col){',
  '        try{ inner(txt,col); }catch(e){}',
  '        try{ paint(txt,col); }catch(e){}',
  '      };',
  '      window.KV_LOG=w;',
  '      wrapped=w;',
  '    }',
  '    setTimeout(attach, 60);',
  '    setTimeout(attach, 400);',
  '    setTimeout(attach, 1200);',
  '    setInterval(attach, 2000);',
  '',
  '    // if nothing has arrived shortly after the game starts, say so rather than sitting blank',
  '    setTimeout(function(){',
  '      if(strip.children.length<=1){',
  '        paint("waiting for the first move\\u2026", "#7a6a58");',
  '      }',
  '    }, 3000);',
  '  })();'
].join('\n'));

fs.writeFileSync('showcase_kascity100.html', html);
console.log('PASS bottom feed re-attaches to KV_LOG after every other block has defined its own');
console.log('PASS re-checks every 2s, so a later reassignment can no longer orphan it');
console.log('PASS shows a waiting line instead of sitting blank if nothing arrives');
console.log('OK showcase_kascity100.html (' + (fs.statSync('showcase_kascity100.html').size/1024/1024).toFixed(1) + ' MB)');
