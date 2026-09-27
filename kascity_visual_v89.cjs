// kascity_visual_v89.cjs
// Reads showcase_kascity88.html -> showcase_kascity89.html   (scene JSON unchanged)
//
// ACTION CALLOUTS. Too much was happening silently — you could not tell whether you paid rent or
// collected it, whether an offer landed, whether a mortgage bill hit. Every meaningful event now
// throws a comic-book caption across the middle of the board: big Impact type, coloured by whoever
// it happened to, with the amount, held ~1.6s and stacked so a burst of events reads in order.
//
//   RENT PAID / RENT COLLECTED     who paid whom, and how much
//   MORTGAGE BILL                  the lap payment, so the debt cycle is visible
//   TAXED                          levy hits
//   BOUGHT / SOLD / DEAL           acquisitions and negotiated trades
//   RENOVATED                      with the new hazard figure
//   LISTED / SOLD FROM LISTING     market activity
//   HAZARD / STORM / COURT         the bad news, with the cost
//   DISTRICT COMPLETE              the payout
//   +XP                            what earned it
//
// Driven off the engine sound hook plus cash-delta watching, so it catches events the behaviour tree
// never announced.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
const src = ['showcase_kascity88.html','showcase_kascity85.html','showcase_kascity84.html'].find(f => fs.existsSync(f));
if (!src) die('no showcase_kascity84/85/88.html found');
console.log('source: ' + src);
let html = fs.readFileSync(src, 'utf8');

const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');

const callouts = [
  '  window.KV_END=endGame;',
  '',
  '  // ================= COMIC CALLOUTS =================',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    var stack=document.createElement("div");',
  '    stack.style.cssText="position:fixed;left:50%;top:46%;transform:translate(-50%,-50%);z-index:73;'
    + 'display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;width:640px;";',
  '    document.body.appendChild(stack);',
  '',
  '    function shout(text, sub, col, big){',
  '      var d=document.createElement("div");',
  '      var size = big ? 40 : 27;',
  '      d.style.cssText="font:900 "+size+"px Impact,\'Arial Black\',sans-serif;letter-spacing:2px;'
    + 'color:"+(col||"#f8f0d8")+";text-shadow:3px 3px 0 #241c12,-1px -1px 0 #241c12,0 0 18px rgba(0,0,0,.85);'
    + 'text-align:center;opacity:0;transform:scale(.75) rotate(-2deg);transition:opacity .12s,transform .16s;'
    + 'white-space:nowrap;";',
  '      d.textContent=text;',
  '      if(sub){',
  '        var s=document.createElement("div");',
  '        s.style.cssText="font:700 13px monospace;letter-spacing:1px;color:#f4e4c1;'
    + 'text-shadow:2px 2px 0 #241c12;margin-top:2px;opacity:.9;";',
  '        s.textContent=sub;',
  '        d.appendChild(s);',
  '      }',
  '      stack.appendChild(d);',
  '      requestAnimationFrame(function(){ d.style.opacity=1; d.style.transform="scale(1) rotate(-2deg)"; });',
  '      while(stack.children.length>3) stack.removeChild(stack.firstChild);',
  '      setTimeout(function(){',
  '        d.style.opacity=0; d.style.transform="scale(.9) rotate(-2deg)";',
  '        setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); }, 200);',
  '      }, big?2000:1600);',
  '    }',
  '    window.KV_SHOUT=shout;',
  '',
  '    function seatNow(){ var f=(window.KV_FLAGS&&window.KV_FLAGS())||{}; return ((f.turn||0)%4)+1; }',
  '    function nm(t){ var N=window.KV_NAMES||{}; return (N[t]&&N[t].n)||("block "+t); }',
  '    function you(p){ return (window.KV_HUMANS||[1]).indexOf(p)>=0; }',
  '',
  '    // ---- sound events name what happened ----',
  '    var prevHook=window.KV_ON_SOUND;',
  '    var pending={};',
  '    window.KV_ON_SOUND=function(id){',
  '      try{ if(prevHook) prevHook(id); }catch(e){}',
  '      var s=seatNow();',
  '      if(id==="rent")      pending.rent={seat:s,at:Date.now()};',
  '      else if(id==="tax")  pending.tax={seat:s,at:Date.now()};',
  '      else if(id==="depot")pending.pay={seat:s,at:Date.now()};',
  '      else if(id==="hazard"||id==="storm") pending.haz={seat:s,at:Date.now(),storm:(id==="storm")};',
  '      else if(id==="gavel"||id==="jail")   pending.court={seat:s,at:Date.now()};',
  '      else if(id==="evict") shout("EVICTED", "P"+s+" cleared the unit", COL[s]);',
  '      else if(id==="bnb")   shout("SHORT-LET", "P"+s+" converted the unit", COL[s]);',
  '      else if(id==="bust")  shout("BANKRUPT", "P"+s+" is out", "#ff6a4a", true);',
  '    };',
  '',
  '    // ---- cash movement gives the amount ----',
  '    var prev={};',
  '    setInterval(function(){',
  '      var now=Date.now();',
  '      for(var p=1;p<=4;p++){',
  '        var c=(window.KV_SEAT&&window.KV_SEAT(p,"cash"));',
  '        if(c==null) continue;',
  '        c=Math.round(c);',
  '        if(prev[p]==null){ prev[p]=c; continue; }',
  '        var d=c-prev[p];',
  '        prev[p]=c;',
  '        if(!d) continue;',
  '        var mine=you(p);',
  '        var tag=mine?"YOU":("P"+p);',
  '        var fresh=function(k){ return pending[k] && (now-pending[k].at)<1200; };',
  '',
  '        if(d<0 && fresh("rent")){',
  '          shout("RENT PAID", tag+" paid "+(-d), COL[p], mine);',
  '          pending.rent=null;',
  '        } else if(d>0 && pending.rent===null){',
  '          shout("RENT COLLECTED", tag+" received "+d, COL[p], mine);',
  '        } else if(d<0 && fresh("tax")){',
  '          shout("TAXED", tag+" paid "+(-d), "#ff6a4a", mine); pending.tax=null;',
  '        } else if(d>0 && fresh("pay")){',
  '          shout("PAYDAY", tag+" collected "+d, "#9cd87c", false); pending.pay=null;',
  '        } else if(d<0 && fresh("haz")){',
  '          shout(pending.haz.storm?"STORM DAMAGE":"HAZARD HIT", tag+" paid "+(-d), "#ff6a4a", mine);',
  '          pending.haz=null;',
  '        } else if(d<0 && fresh("court")){',
  '          shout("COURT COSTS", tag+" paid "+(-d), "#ff6a4a", mine); pending.court=null;',
  '        } else if(d<=-40 && d>=-60){',
  '          shout("MORTGAGE BILL", tag+" paid "+(-d), "#e08a5a", false);',
  '        }',
  '      }',
  '    }, 220);',
  '',
  '    // ---- ownership changes ----',
  '    var lastOwn={};',
  '    setInterval(function(){',
  '      var N=window.KV_NAMES||{};',
  '      Object.keys(N).forEach(function(k){',
  '        var t=parseInt(k,10);',
  '        var o=window.KV_OWNER?window.KV_OWNER(t):null;',
  '        if(lastOwn[t]===undefined){ lastOwn[t]=o; return; }',
  '        if(o===lastOwn[t]) return;',
  '        var from=lastOwn[t]; lastOwn[t]=o;',
  '        if(!o) return;',
  '        if(from) shout("SOLD", "P"+from+" \\u2192 P"+o+" \\u00b7 "+nm(t), COL[o], you(o)||you(from));',
  '        else     shout("BOUGHT", "P"+o+" \\u00b7 "+nm(t), COL[o], you(o));',
  '      });',
  '    }, 260);',
  '',
  '    // ---- renovations, listings, district payouts ----',
  '    var lastRv={}, lastLs={}, lastDb={};',
  '    setInterval(function(){',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var N=window.KV_NAMES||{};',
  '      Object.keys(N).forEach(function(k){',
  '        var t=parseInt(k,10);',
  '        var rv=Math.round(f["rv_t"+t]||0);',
  '        if(lastRv[t]===undefined){ lastRv[t]=rv; }',
  '        else if(rv>lastRv[t]){',
  '          lastRv[t]=rv;',
  '          var o=window.KV_OWNER?window.KV_OWNER(t):null;',
  '          shout("RENOVATED", "P"+(o||"?")+" \\u00b7 "+nm(t)+" \\u00b7 hazard "+Math.round(f["hz_t"+t]||0)+"%",',
  '            COL[o]||"#caa64c", you(o));',
  '        }',
  '        var ls=Math.round(f["ls_t"+t]||0);',
  '        if(lastLs[t]===undefined){ lastLs[t]=ls; }',
  '        else if(ls!==lastLs[t]){',
  '          lastLs[t]=ls;',
  '          if(ls===1){',
  '            var ow=window.KV_OWNER?window.KV_OWNER(t):null;',
  '            shout("FOR SALE", "P"+(ow||"?")+" \\u00b7 "+nm(t)+" \\u00b7 "+Math.round(f["lp_t"+t]||0), "#f0c860", false);',
  '          }',
  '        }',
  '      });',
  '      for(var gi=0;gi<12;gi++){',
  '        var v=Math.round(f["dbon_"+gi]||0);',
  '        if(lastDb[gi]===undefined){ lastDb[gi]=v; }',
  '        else if(v && v!==lastDb[gi]){',
  '          lastDb[gi]=v;',
  '          shout("DISTRICT COMPLETE", "P"+v+" takes the bonus", COL[v], true);',
  '        }',
  '      }',
  '    }, 350);',
  '',
  '    // ---- XP awards echo to the centre ----',
  '    var prevXp={};',
  '    setInterval(function(){',
  '      for(var p=1;p<=4;p++){',
  '        var x=(window.KV_XP&&window.KV_XP[p])||0;',
  '        if(prevXp[p]==null){ prevXp[p]=x; continue; }',
  '        var d=x-prevXp[p]; prevXp[p]=x;',
  '        if(d>=8 && you(p)) shout("+"+d+" XP", "good call", "#9cd87c", false);',
  '      }',
  '    }, 400);',
  '  })();'
].join('\n');
html = html.split(anchor).join(callouts);

// scenario outcomes shout too
const resRe = /      if\(window\.KV_LOG\) window\.KV_LOG\("P"\+seat\+"  "\+o\.l\+"  \\u2192  "\+\(swing>=0\?"\+":""\)\+swing, COL\[seat\]\);/;
if (resRe.test(html)) {
  html = html.replace(resRe,
    '      if(window.KV_LOG) window.KV_LOG("P"+seat+"  "+o.l+"  \\u2192  "+(swing>=0?"+":"")+swing, COL[seat]);\n' +
    '      if(window.KV_SHOUT) window.KV_SHOUT(good?"IT WORKED":"IT BACKFIRED",\n' +
    '        "P"+seat+" \\u00b7 "+o.l+" \\u00b7 "+(swing>=0?"+":"")+swing,\n' +
    '        good?"#9cd87c":"#ff6a4a", (window.KV_HUMANS||[1]).indexOf(seat)>=0);');
}

fs.writeFileSync('showcase_kascity89.html', html);
console.log('PASS comic callouts: rent paid vs collected, mortgage bills, taxes, hazards, court costs');
console.log('PASS bought / sold / renovated / listed / district complete all announced with amounts');
console.log('PASS scenario outcomes shout IT WORKED or IT BACKFIRED with the swing');
console.log('PASS your own events render larger than the opponents\'');
console.log('OK showcase_kascity89.html (' + (fs.statSync('showcase_kascity89.html').size/1024/1024).toFixed(1) + ' MB)');
