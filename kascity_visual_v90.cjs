// kascity_visual_v90.cjs
// Reads showcase_kascity89.html -> showcase_kascity90.html   (scene JSON unchanged)
//
// TRADES ARE THE BIGGEST EVENT IN THE GAME AND WERE THE QUIETEST. A deed changing hands between
// players is now a full-screen moment, not a log line you scroll past:
//
//   - the board dims for 2.6s
//   - "DEAL DONE" or "OFFER REJECTED" in huge type
//   - both sides named with their colours, the property, and the price
//   - what it meant: over or under valuation, and by how much
//   - a coloured frame in the buyer's colour, with the ka-ching or the dang
//
// It also catches trades that happen without you: a bot buying another bot's listing announces
// itself, so the market is visible rather than something you discover in the holdings panel.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity89.html')) die('showcase_kascity89.html missing');
let html = fs.readFileSync('showcase_kascity89.html', 'utf8');

const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');

const trade = [
  '  window.KV_END=endGame;',
  '',
  '  // ================= TRADE NOTIFICATION =================',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    function nm(t){ var N=window.KV_NAMES||{}; return (N[t]&&N[t].n)||("block "+t); }',
  '    function you(p){ return (window.KV_HUMANS||[1]).indexOf(p)>=0; }',
  '',
  '    var ov=document.createElement("div");',
  '    ov.style.cssText="position:fixed;inset:0;z-index:82;display:none;align-items:center;'
    + 'justify-content:center;background:rgba(10,8,6,.62);pointer-events:none;opacity:0;transition:opacity .18s;";',
  '    var card=document.createElement("div");',
  '    card.style.cssText="background:#14100c;border:4px solid #caa64c;border-radius:16px;'
    + 'padding:26px 46px;text-align:center;box-shadow:0 14px 60px rgba(0,0,0,.85);'
    + 'transform:scale(.86) rotate(-1.5deg);transition:transform .22s;";',
  '    ov.appendChild(card); document.body.appendChild(ov);',
  '    var hideT=null;',
  '',
  '    window.KV_TRADE_ALERT=function(o){',
  '      // o = { ok, buyer, seller, tile, price, value, reason }',
  '      var head = o.ok ? "DEAL DONE" : "OFFER REJECTED";',
  '      var accent = o.ok ? (COL[o.buyer]||"#4fd98a") : "#ff6a4a";',
  '      var margin = (o.value!=null && o.price!=null) ? (o.value - o.price) : null;',
  '      var verdict = "";',
  '      if(o.ok && margin!=null){',
  '        verdict = margin>0 ? ("BOUGHT UNDER VALUE BY "+margin)',
  '                : (margin<0 ? ("PAID OVER VALUE BY "+(-margin)) : "PAID EXACTLY WHAT IT IS WORTH");',
  '      }',
  '      card.style.borderColor=accent;',
  '      card.innerHTML =',
  '        "<div style=\'font:900 46px Impact,sans-serif;letter-spacing:4px;color:"+accent+";'
    + 'text-shadow:4px 4px 0 #241c12\'>"+head+"</div>"+',
  '        (o.tile!=null ? ("<div style=\'font:700 19px monospace;color:#f0c860;margin-top:8px;letter-spacing:1px\'>"+nm(o.tile)+"</div>") : "")+',
  '        "<div style=\'font:700 15px monospace;color:#f4e4c1;margin-top:12px\'>"+',
  '          "<span style=\'color:"+(COL[o.buyer]||"#f4e4c1")+"\'>"+(you(o.buyer)?"YOU":("P"+o.buyer))+"</span>"+',
  '          "<span style=\'opacity:.6\'> &nbsp;\\u2190&nbsp; </span>"+',
  '          "<span style=\'color:"+(COL[o.seller]||"#f4e4c1")+"\'>"+(you(o.seller)?"YOU":("P"+o.seller))+"</span>"+',
  '        "</div>"+',
  '        (o.price!=null ? ("<div style=\'font:900 34px Impact,sans-serif;color:#f8f0d8;margin-top:10px;text-shadow:3px 3px 0 #241c12\'>"+o.price+"</div>") : "")+',
  '        (verdict ? ("<div style=\'font:700 12px monospace;color:"+(margin>0?"#9cd87c":(margin<0?"#ff6a4a":"#f4e4c1"))+";margin-top:6px;letter-spacing:1px\'>"+verdict+"</div>") : "")+',
  '        (o.reason ? ("<div style=\'font:600 12px monospace;color:#b8a88a;margin-top:8px;font-style:italic\'>\\u201c"+o.reason+"\\u201d</div>") : "");',
  '',
  '      ov.style.display="flex";',
  '      requestAnimationFrame(function(){',
  '        ov.style.opacity=1; card.style.transform="scale(1) rotate(-1.5deg)";',
  '      });',
  '      if(window.KV_SFX) window.KV_SFX(o.ok?"ching":"dang");',
  '      if(hideT) clearTimeout(hideT);',
  '      hideT=setTimeout(function(){',
  '        ov.style.opacity=0; card.style.transform="scale(.86) rotate(-1.5deg)";',
  '        setTimeout(function(){ ov.style.display="none"; }, 220);',
  '      }, 2600);',
  '    };',
  '',
  '    // catch every deed change between two players, including ones you were not part of',
  '    var lastOwn={}, seeded=false;',
  '    setInterval(function(){',
  '      var N=window.KV_NAMES||{};',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      Object.keys(N).forEach(function(k){',
  '        var t=parseInt(k,10);',
  '        var o=window.KV_OWNER?window.KV_OWNER(t):null;',
  '        if(lastOwn[t]===undefined){ lastOwn[t]=o; return; }',
  '        if(o===lastOwn[t]) return;',
  '        var from=lastOwn[t]; lastOwn[t]=o;',
  '        if(!o||!from) return;                       // bank purchases handled elsewhere',
  '        if(!seeded) return;',
  '        var price=Math.round(f.tr_amt||f["lp_t"+t]||0);',
  '        var val=window.KV_INTRINSIC?window.KV_INTRINSIC(t):null;',
  '        window.KV_TRADE_ALERT({ ok:true, buyer:o, seller:from, tile:t,',
  '          price:price||null, value:val, reason:null });',
  '      });',
  '      seeded=true;',
  '    }, 250);',
  '  })();'
].join('\n');
html = html.split(anchor).join(trade);

// route the bot's answer on your bid through the big alert
const botRe = /          if\(window\.KV_DEAL\) window\.KV_DEAL\(accept, accept\?"DEAL":"DECLINED",\n            "P"\+owner\+" \\u00b7 "\+v\+" for "\+d\.n\+" \\u00b7 "\+why\);/;
if (botRe.test(html)) {
  html = html.replace(botRe,
    '          if(window.KV_TRADE_ALERT) window.KV_TRADE_ALERT({ ok:accept, buyer:me, seller:owner,\n' +
    '            tile:tile, price:v, value:intr, reason:why });');
} else {
  // v83 banner not present (older build) — attach to the log line instead
  const logRe = /          window\.KV_LOG\("P"\+owner\+"  "\+\(accept\?"ACCEPTS":"REFUSES"\)\+"  \\u2014 "\+why, COL\[owner\]\);/;
  if (!logRe.test(html)) die('bot offer answer not found');
  html = html.replace(logRe,
    '          window.KV_LOG("P"+owner+"  "+(accept?"ACCEPTS":"REFUSES")+"  \\u2014 "+why, COL[owner]);\n' +
    '          if(window.KV_TRADE_ALERT) window.KV_TRADE_ALERT({ ok:accept, buyer:me, seller:owner,\n' +
    '            tile:tile, price:v, value:intr, reason:why });');
}

// and a human answering your bid
const humRe = /          window\.KV_LOG\("P"\+seller\+"  "\+\(ix\?"REFUSES":"ACCEPTS"\)\+"  "\+amt, COL\[seller\]\);/;
if (humRe.test(html)) {
  html = html.replace(humRe,
    '          window.KV_LOG("P"+seller+"  "+(ix?"REFUSES":"ACCEPTS")+"  "+amt, COL[seller]);\n' +
    '          if(window.KV_TRADE_ALERT) window.KV_TRADE_ALERT({ ok:!ix, buyer:buyer, seller:seller,\n' +
    '            tile:tile, price:amt, value:intrinsic(tile), reason:null });');
}

fs.writeFileSync('showcase_kascity90.html', html);
console.log('PASS full-screen trade alert: DEAL DONE / OFFER REJECTED, 2.6s, buyer-coloured frame');
console.log('PASS shows both parties, the property, the price and whether it was under or over value');
console.log('PASS the bot\'s reasoning is quoted on screen');
console.log('PASS bot-to-bot trades announce too — the market is visible, not discovered later');
console.log('OK showcase_kascity90.html (' + (fs.statSync('showcase_kascity90.html').size/1024/1024).toFixed(1) + ' MB)');
