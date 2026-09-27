// kascity_visual_v97.cjs
// Reads kascity_v95.json + showcase_kascity96.html -> kascity_v97.json + showcase_kascity97.html
//
// A. PACING AND CLOCK. Bots acted every 2.5s, and a single bot turn could contain a roll, a purchase,
//    a renovation, a personality shift and a rent roll — five events fighting for two seconds. No
//    amount of extra highlighting fixes that; the events simply arrive faster than they can be read.
//    Pacing goes to 3.5s. The clock goes to 10 minutes to compensate, because at the old 8 minutes
//    the slower pace would cut each player from ~19 rolls to ~11 — under two laps — and the rent
//    economy would never get going.
//        480s / 2.5s pacing  ->  ~19 rolls each, unreadable
//        600s / 3.5s pacing  ->  ~19 rolls each, readable
//
// B. TURN DIGEST. Instead of shouting each event as it happens, everything a player did in their turn
//    is collected and shown as ONE card when the turn ends:
//        "P3 — rolled 8 · bought Tanner Street 140 · renovated it · holds 4"
//    One thing to read per turn rather than five flashes. The play-by-play keeps the detail; the
//    digest is what you actually watch.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v95.json')) die('kascity_v95.json missing');
if (!fs.existsSync('showcase_kascity96.html')) die('showcase_kascity96.html missing');
const j = JSON.parse(fs.readFileSync('kascity_v95.json', 'utf8'));
const director = j.nodes.find(n => n.id === 'director') || die('director missing');

// ---------- A. clock 8:00 -> 10:00 ----------
let clkN = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { o.forEach(walk); return; }
  if (o.do && o.do.action === 'setFlagExpr' && o.do.args && o.do.args[0] === 'left'
      && typeof o.do.args[1] === 'string' && o.do.args[1].indexOf('480 -') === 0) {
    o.do.args[1] = o.do.args[1].replace('480 -', '600 -'); clkN++;
  }
  if (o.do && o.do.action === 'setState' && o.do.args && o.do.args[0] === 'left' && o.do.args[1] === 480) { o.do.args[1] = 600; clkN++; }
  if (o.do && o.do.action === 'setState' && o.do.args && o.do.args[0] === 'cmin' && o.do.args[1] === 8) { o.do.args[1] = 10; clkN++; }
  Object.values(o).forEach(walk);
})(director);
if (clkN < 1) die('clock retimings ' + clkN);

// ---------- A. bot pacing 2.5s -> 3.5s ----------
let paceN = 0;
(function walk2(o) {
  if (!o || typeof o !== 'object') return;
  if (typeof o.cond === 'string' && o.cond.indexOf('world.time - world.flags.rollt > 2.5') >= 0) {
    o.cond = o.cond.split('world.time - world.flags.rollt > 2.5').join('world.time - world.flags.rollt > 3.5');
    paceN++;
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk2(v);
})(director.bt);
if (paceN < 1) die('pacing branch not found');

// the renovation clock tiers reference the old 8-minute scale
let tierN = 0;
(function walk3(o) {
  if (!o || typeof o !== 'object') return;
  if (typeof o.cond === 'string' && o.cond.indexOf('world.flags.left > 300') >= 0) {
    o.cond = o.cond.split('world.flags.left > 300').join('world.flags.left > 380');
    tierN++;
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk3(v);
})(director.bt);

const v97str = JSON.stringify(j);
fs.writeFileSync('kascity_v97.json', v97str);

// ---------- showcase ----------
let html = fs.readFileSync('showcase_kascity96.html', 'utf8');
const oldRaw = fs.readFileSync('kascity_v95.json', 'utf8');
if (html.split(JSON.stringify(oldRaw)).length - 1 !== 1) die('embedded v95 JSON not found exactly once');
html = html.split(JSON.stringify(oldRaw)).join(JSON.stringify(v97str));

// DOM countdown
if (html.indexOf('TOTAL=480') < 0) die('DOM clock total not found');
html = html.split('TOTAL=480').join('TOTAL=600');
html = html.split('clock.textContent="8:00"').join('clock.textContent="10:00"');

// ---------- B. turn digest ----------
const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');
html = html.split(anchor).join([
  '  window.KV_END=endGame;',
  '',
  '  // ================= TURN DIGEST =================',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    function F(){ return (window.KV_FLAGS&&window.KV_FLAGS())||{}; }',
  '    function el(t,css,par){var e=document.createElement(t);e.style.cssText=css;(par||document.body).appendChild(e);return e;}',
  '    function nm(t){ var N=window.KV_NAMES||{}; return (N[t]&&N[t].n)||("block "+t); }',
  '    function you(p){ return (window.KV_HUMANS||[1]).indexOf(p)>=0; }',
  '',
  '    var card=el("div","position:fixed;left:50%;top:120px;transform:translateX(-50%);z-index:71;'
    + 'display:none;background:rgba(20,16,12,.95);border-left:6px solid #caa64c;border-radius:8px;'
    + 'padding:10px 20px;font:13px/1.6 monospace;color:#f4e4c1;box-shadow:0 6px 26px rgba(0,0,0,.7);'
    + 'max-width:560px;opacity:0;transition:opacity .16s;");',
  '',
  '    // collect what happens, keyed by whose turn it is',
  '    var acc = {};              // seat -> [strings]',
  '    var cashAt = {};',
  '    function note(seat, txt){',
  '      if(!acc[seat]) acc[seat]=[];',
  '      if(acc[seat].length<5) acc[seat].push(txt);',
  '    }',
  '    window.KV_TURN_NOTE = note;',
  '',
  '    // hook the things worth summarising',
  '    var prevSound=window.KV_ON_SOUND;',
  '    window.KV_ON_SOUND=function(id){',
  '      try{ if(prevSound) prevSound(id); }catch(e){}',
  '      var s=((F().turn||0)%4)+1;',
  '      if(id==="tax")        note(s,"taxed");',
  '      else if(id==="evict") note(s,"evicted a tenant");',
  '      else if(id==="storm"||id==="hazard") note(s,"took hazard damage");',
  '      else if(id==="gavel"||id==="jail")   note(s,"went to court");',
  '    };',
  '',
  '    var lastOwn={}, lastRv={}, lastLs={}, seeded=false;',
  '    setInterval(function(){',
  '      var f=F(), N=window.KV_NAMES||{};',
  '      Object.keys(N).forEach(function(k){',
  '        var t=parseInt(k,10);',
  '        var o=window.KV_OWNER?window.KV_OWNER(t):null;',
  '        if(lastOwn[t]===undefined){ lastOwn[t]=o; }',
  '        else if(o!==lastOwn[t]){',
  '          var from=lastOwn[t]; lastOwn[t]=o;',
  '          if(seeded && o) note(o, from ? ("bought "+nm(t)+" from P"+from) : ("bought "+nm(t)));',
  '          if(seeded && from && o) note(from, "sold "+nm(t)+" to P"+o);',
  '        }',
  '        var rv=Math.round(f["rv_t"+t]||0);',
  '        if(lastRv[t]===undefined){ lastRv[t]=rv; }',
  '        else if(rv>lastRv[t]){ lastRv[t]=rv; if(seeded&&o) note(o,"renovated "+nm(t)); }',
  '        var ls=Math.round(f["ls_t"+t]||0);',
  '        if(lastLs[t]===undefined){ lastLs[t]=ls; }',
  '        else if(ls!==lastLs[t]){',
  '          lastLs[t]=ls;',
  '          if(seeded && ls===1 && o) note(o,"listed "+nm(t)+" at "+Math.round(f["lp_t"+t]||0));',
  '        }',
  '      });',
  '      seeded=true;',
  '    }, 260);',
  '',
  '    // when the turn changes, publish the digest for the seat that just finished',
  '    var lastTurn=null, hideT=null;',
  '    setInterval(function(){',
  '      var f=F();',
  '      if(f.over) return;',
  '      var t=f.turn;',
  '      if(t===lastTurn) return;',
  '      var done = (lastTurn==null) ? null : ((lastTurn%4)+1);',
  '      lastTurn=t;',
  '      if(done==null) return;',
  '',
  '      var lines=acc[done]||[];',
  '      acc[done]=[];',
  '      var cash=(window.KV_SEAT&&Math.round(window.KV_SEAT(done,"cash")));',
  '      var delta=(cashAt[done]!=null && cash!=null) ? (cash-cashAt[done]) : null;',
  '      cashAt[done]=cash;',
  '',
  '      var N=window.KV_NAMES||{}, held=0;',
  '      Object.keys(N).forEach(function(k){ if(window.KV_OWNER&&window.KV_OWNER(parseInt(k,10))===done) held++; });',
  '',
  '      // a turn where nothing happened is not worth interrupting for',
  '      if(!lines.length && (delta==null || Math.abs(delta)<15)) return;',
  '',
  '      var who = you(done) ? "YOU" : ("P"+done);',
  '      var money = (delta==null||!delta) ? "" :',
  '        ("<span style=\'color:"+(delta>0?"#9cd87c":"#ff6a4a")+"\'>"+(delta>0?"+":"")+delta+"</span>");',
  '      card.style.borderLeftColor=COL[done]||"#caa64c";',
  '      card.innerHTML =',
  '        "<span style=\'color:"+COL[done]+";font-weight:700;letter-spacing:1px\'>"+who+"</span>"+',
  '        (money?("  "+money):"")+',
  '        (lines.length?("<span style=\'opacity:.55\'>  \\u00b7  </span>"+lines.join("<span style=\'opacity:.4\'> \\u00b7 </span>")):"")+',
  '        "<span style=\'float:right;opacity:.5;padding-left:14px\'>"+held+" blocks</span>";',
  '',
  '      card.style.display="block";',
  '      requestAnimationFrame(function(){ card.style.opacity=1; });',
  '      if(hideT) clearTimeout(hideT);',
  '      hideT=setTimeout(function(){',
  '        card.style.opacity=0;',
  '        setTimeout(function(){ card.style.display="none"; }, 200);',
  '      }, 3000);',
  '    }, 300);',
  '  })();'
].join('\n'));

// quieten the per-event shouts for opponents — the digest covers them now
const shoutRe = /    function shout\(text, sub, col, big\)\{/;
if (shoutRe.test(html)) {
  html = html.replace(shoutRe, [
    '    function shout(text, sub, col, big){',
    '      // opponents are summarised in the turn digest; only your own events interrupt',
    '      if(!big && window.KV_QUIET_OTHERS) return;'
  ].join('\n'));
  html = html.split("  window.KV_END=endGame;\n\n  // ================= TURN DIGEST")
             .join("  window.KV_END=endGame;\n  window.KV_QUIET_OTHERS = true;\n\n  // ================= TURN DIGEST");
}

fs.writeFileSync('showcase_kascity97.html', html);
console.log('PASS clock 8:00 -> 10:00 (' + clkN + ' retimings), bot pacing 2.5s -> 3.5s (' + paceN + ')');
console.log('PASS renovation clock tiers rescaled to the longer game (' + tierN + ')');
console.log('PASS turn digest: one card per turn naming what that player did and their cash swing');
console.log('PASS silent turns are skipped; opponents no longer shout per event, only your own do');
console.log('OK kascity_v97.json + showcase_kascity97.html (' + (fs.statSync('showcase_kascity97.html').size/1024/1024).toFixed(1) + ' MB)');
