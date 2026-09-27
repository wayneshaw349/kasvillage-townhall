// kascity_visual_v83.cjs
// Reads kascity_v78.json + showcase_kascity82.html -> kascity_v83.json + showcase_kascity83.html
//
// A. DEAL BANNERS. Accept and decline were a line in the log you could miss. Every offer outcome now
//    lands as a large centred banner — green ACCEPTED with the price, red DECLINED with the reason —
//    held for 2.2s so it registers.
//
// B. THE MARKET NEVER RAN. A full 8-minute game produced 50 rolls, 16 buys, 11 scenarios and ZERO
//    renovations, listings or trades. The thresholds were set for a richer game than 1300 start cash
//    produces. Loosened so the market actually moves:
//      renovate  cash >= cost + 150  ->  cost + 60      (150 spare was unreachable while buying)
//      list      requires rv >= 1    ->  rv >= 1 OR holding 3+ props and short of cash
//      distress  cash<180 & mort>250 ->  cash<320 & mort>120
//    Bots should now improve property, list it, and deal with each other inside a single game.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v78.json')) die('kascity_v78.json missing');
if (!fs.existsSync('showcase_kascity82.html')) die('showcase_kascity82.html missing');
const j = JSON.parse(fs.readFileSync('kascity_v78.json', 'utf8'));
const director = j.nodes.find(n => n.id === 'director') || die('director missing');

// ---------- B. loosen the gates ----------
let renFix = 0, lsFix = 0, dsFix = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const c = o.sequence[0] && o.sequence[0].cond;
    if (typeof c === 'string') {
      // bot renovation affordability
      if (c.indexOf('world.flags.renov == -1') === 0 && /'cash'\) >= (\d+)/.test(c)) {
        o.sequence[0].cond = c.replace(/'cash'\) >= (\d+)/, function (_, n) {
          return "'cash') >= " + Math.max(20, parseInt(n, 10) - 90);
        });
        renFix++;
      }
      // premium listing: allow a cash-hungry landlord to list unimproved stock too
      const lm = /^world\.flags\.ls_t(\d+) == 0 && seat\(\) > world\.flags\.humans && seat\(\) == (\d) && ownerOf\('t\d+'\) == \d && world\.flags\.rv_t\d+ >= 1 && seatStat\(\d,'cash'\) < (\d+)$/.exec(c);
      if (lm) {
        const t = lm[1], p = lm[2];
        o.sequence[0].cond = 'world.flags.ls_t' + t + ' == 0 && seat() > world.flags.humans && seat() == ' + p +
          " && ownerOf('t" + t + "') == " + p +
          ' && (world.flags.rv_t' + t + " >= 1 || (seatStat(" + p + ",'props') >= 3 && seatStat(" + p + ",'cash') < 420))" +
          " && seatStat(" + p + ",'cash') < " + lm[3];
        lsFix++;
      }
      // distressed listing
      if (c.indexOf("'cash') < 180 && seatStat(") >= 0 && c.indexOf("'mort') > 250") >= 0) {
        o.sequence[0].cond = c.replace("'cash') < 180", "'cash') < 320").replace("'mort') > 250", "'mort') > 120");
        dsFix++;
      }
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);
if (renFix < 60) die('renovation gates loosened ' + renFix + ' (<60)');
if (lsFix + dsFix < 60) die('listing gates loosened ' + (lsFix + dsFix) + ' (<60)');

const v83str = JSON.stringify(j);
fs.writeFileSync('kascity_v83.json', v83str);

// ---------- showcase ----------
let html = fs.readFileSync('showcase_kascity82.html', 'utf8');
const oldRaw = fs.readFileSync('kascity_v78.json', 'utf8');
if (html.split(JSON.stringify(oldRaw)).length - 1 !== 1) die('embedded v78 JSON not found exactly once');
html = html.split(JSON.stringify(oldRaw)).join(JSON.stringify(v83str));

// ---------- A. deal banner ----------
const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');
html = html.split(anchor).join([
  '  window.KV_END=endGame;',
  '',
  '  // ================= DEAL BANNER =================',
  '  (function(){',
  '    var bn=document.createElement("div");',
  '    bn.style.cssText="position:fixed;left:50%;top:44%;transform:translate(-50%,-50%) scale(.9);z-index:74;'
    + 'display:none;padding:14px 34px;border-radius:12px;text-align:center;'
    + 'font:900 30px Impact,\'Arial Black\',sans-serif;letter-spacing:3px;color:#12100e;'
    + 'box-shadow:0 10px 40px rgba(0,0,0,.75);transition:transform .18s,opacity .18s;opacity:0;";',
  '    document.body.appendChild(bn);',
  '    var hideT=null;',
  '    window.KV_DEAL=function(ok, headline, detail){',
  '      bn.style.background = ok ? "#4fd98a" : "#ff6a4a";',
  '      bn.innerHTML = headline + (detail ? ("<div style=\'font:600 13px monospace;letter-spacing:1px;margin-top:5px;opacity:.85\'>"+detail+"</div>") : "");',
  '      bn.style.display="block";',
  '      requestAnimationFrame(function(){',
  '        bn.style.opacity=1; bn.style.transform="translate(-50%,-50%) scale(1)";',
  '      });',
  '      if(window.KV_SFX) window.KV_SFX(ok?"ching":"dang");',
  '      if(hideT) clearTimeout(hideT);',
  '      hideT=setTimeout(function(){',
  '        bn.style.opacity=0; bn.style.transform="translate(-50%,-50%) scale(.9)";',
  '        setTimeout(function(){ bn.style.display="none"; }, 200);',
  '      }, 2200);',
  '    };',
  '  })();'
].join('\n'));

// bot answer on your bid
const botAnsRe = /          window\.KV_LOG\("P"\+owner\+"  "\+\(accept\?"ACCEPTS":"REFUSES"\)\+"  \\u2014 "\+why, COL\[owner\]\);/;
if (!botAnsRe.test(html)) die('bot offer answer not found');
html = html.replace(botAnsRe,
  '          window.KV_LOG("P"+owner+"  "+(accept?"ACCEPTS":"REFUSES")+"  \\u2014 "+why, COL[owner]);\n' +
  '          if(window.KV_DEAL) window.KV_DEAL(accept, accept?"DEAL":"DECLINED",\n' +
  '            "P"+owner+" \\u00b7 "+v+" for "+d.n+" \\u00b7 "+why);');

// human answering a bid
const humanAnsRe = /          window\.KV_LOG\("P"\+seller\+"  "\+\(ix\?"REFUSES":"ACCEPTS"\)\+"  "\+amt, COL\[seller\]\);/;
if (!humanAnsRe.test(html)) die('human offer answer not found');
html = html.replace(humanAnsRe,
  '          window.KV_LOG("P"+seller+"  "+(ix?"REFUSES":"ACCEPTS")+"  "+amt, COL[seller]);\n' +
  '          if(window.KV_DEAL) window.KV_DEAL(!ix, ix?"DECLINED":"DEAL",\n' +
  '            "P"+seller+" \\u00b7 "+amt+" for "+nm);');

// a listing selling
const listSoldRe = /          if\(o&&window\.KV_LOG\) window\.KV_LOG\("P"\+o\+"  LISTS  "\+N\[k\]\.n\+"  at "\+ask\+\(rv\?"  \(renovated\)":"  \(needs cash\)"\), COL\[o\]\);/;
if (listSoldRe.test(html)) {
  html = html.replace(listSoldRe,
    '          if(o&&window.KV_LOG) window.KV_LOG("P"+o+"  LISTS  "+N[k].n+"  at "+ask+(rv?"  (renovated)":"  (needs cash)"), COL[o]);\n' +
    '          if(o&&window.KV_DEAL) window.KV_DEAL(true,"FOR SALE","P"+o+" \\u00b7 "+N[k].n+" \\u00b7 "+ask);');
}

fs.writeFileSync('showcase_kascity83.html', html);
console.log('PASS deal banner: bold DEAL / DECLINED with price and reason, 2.2s');
console.log('PASS renovation affordability loosened on ' + renFix + ' branches (cost+150 -> cost+60)');
console.log('PASS listing gates loosened (' + lsFix + ' premium, ' + dsFix + ' distressed)');
console.log('OK kascity_v83.json + showcase_kascity83.html (' + (fs.statSync('showcase_kascity83.html').size/1024/1024).toFixed(1) + ' MB)');
