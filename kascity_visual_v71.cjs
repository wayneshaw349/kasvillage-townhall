// kascity_visual_v71.cjs
// Reads kascity_v70.json + showcase_kascity70.html -> kascity_v71.json + showcase_kascity71.html
//
// NEGOTIATION AT ANY PRICE. Until now every offer was hardcoded at 90% of asking, because
// addSeatStat takes a literal amount. One small engine patch fixes that:
//     addSeatStat now accepts an optional "amountExpr" evaluated with the same
//     evalExpr(compileExpr(...), exprCtx(self)) path setFlagExpr already uses.
// With that, ONE generic pair of branches settles any trade at any price, replacing hundreds of
// per-tile hardcoded ones.
//
//   You:   click any property someone else owns -> a slider from 40% to 220% of market value, with
//          fair value and their likely threshold marked. Name your price.
//   Owner: bot compares your bid against its own intrinsic valuation and answers with a reason.
//          Overpay to prise a block out of a district; lowball an owner who is short of cash.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v70.json')) die('kascity_v70.json missing');
if (!fs.existsSync('showcase_kascity70.html')) die('showcase_kascity70.html missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
const j = JSON.parse(fs.readFileSync('kascity_v70.json', 'utf8'));
const director = j.nodes.find(n => n.id === 'director') || die('director missing');
const rootSel = director.bt.sequence[1] && director.bt.sequence[1].selector;
if (!Array.isArray(rootSel)) die('root selector missing');

const dstr = JSON.stringify(director);
const names = {};
const re = /"prompt","args":\["buy","(.+?) is unowned\. Buy for (\d+)\?"(?:,"[^"]*")*\]\}\},\{"do":\{"action":"setState","args":\["buy_tile",(\d+)\]/g;
let mm; while ((mm = re.exec(dstr)) !== null) names[parseInt(mm[3],10)] = { n: mm[1], p: parseInt(mm[2],10) };
if (Object.keys(names).length < 16) die('names ' + Object.keys(names).length);

// ---------- generic trade settlement ----------
// flags: tr_tile, tr_from (buyer), tr_to (seller), tr_amt, tr_state (1 = pending, 2 = accepted)
const tiles = Object.keys(names).map(Number);
let trN = 0;
for (const t of tiles) {
  for (let buyer = 1; buyer <= 4; buyer++) {
    for (let seller = 1; seller <= 4; seller++) {
      if (buyer === seller) continue;
      rootSel.unshift({ sequence: [
        { cond: 'world.flags.tr_state == 2 && world.flags.tr_tile == ' + t +
                ' && world.flags.tr_from == ' + buyer + ' && world.flags.tr_to == ' + seller +
                " && ownerOf('t" + t + "') == " + seller +
                " && seatStat(" + buyer + ",'cash') >= world.flags.tr_amt" },
        { do: { action: 'claim', args: ['t' + t, buyer] } },
        { do: { action: 'addSeatStat', args: [buyer, 'cash'], amountExpr: '0 - world.flags.tr_amt' } },
        { do: { action: 'addSeatStat', args: [seller, 'cash'], amountExpr: 'world.flags.tr_amt' } },
        { do: { action: 'addSeatStat', args: [buyer, 'props'], amount: 1 } },
        { do: { action: 'addSeatStat', args: [seller, 'props'], amount: -1 } },
        { do: { action: 'addSeatStat', args: [buyer, 'propval'], amountExpr: 'world.flags.tr_amt' } },
        { do: { action: 'addSeatStat', args: [seller, 'propval'], amountExpr: '0 - world.flags.tr_amt' } },
        { do: { action: 'hide', args: [], to: 'own_' + t + '_' + seller } },
        { do: { action: 'show', args: [], to: 'own_' + t + '_' + buyer } },
        { do: { action: 'playSound', args: ['buy'] } },
        { do: { action: 'setState', args: ['evseat', buyer] } },
        { do: { action: 'setState', args: ['evtile', t] } },
        { do: { action: 'setState', args: ['tr_state', 0] } },
        { do: { action: 'setState', args: ['tr_tile', -1] } }
      ]});
      trN++;
    }
  }
}
if (trN < 200) die('trade branches ' + trN);

// expiry so a pending trade cannot jam the tree
rootSel.push({ sequence: [
  { cond: 'world.flags.tr_state > 0 && world.time - world.flags.tr_t > 30' },
  { do: { action: 'setState', args: ['tr_state', 0] } },
  { do: { action: 'setState', args: ['tr_tile', -1] } }
]});

// boot
let bootOk = false;
(function walkA(o) {
  if (bootOk || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) {
      o.splice(ri, 0,
        { after: 0.1, do: { action: 'setState', args: ['tr_state', 0] } },
        { after: 0.1, do: { action: 'setState', args: ['tr_tile', -1] } },
        { after: 0.1, do: { action: 'setState', args: ['tr_from', 0] } },
        { after: 0.1, do: { action: 'setState', args: ['tr_to', 0] } },
        { after: 0.1, do: { action: 'setState', args: ['tr_amt', 0] } },
        { after: 0.1, do: { action: 'setState', args: ['tr_t', 0] } });
      bootOk = true; return;
    }
    o.forEach(walkA);
  } else Object.values(o).forEach(walkA);
})(director.alarms);
if (!bootOk) die('boot anchor missing');

const v71str = JSON.stringify(j);
fs.writeFileSync('kascity_v71.json', v71str);

// ---------- engine: amountExpr ----------
let html = fs.readFileSync('showcase_kascity70.html', 'utf8');
const oldJson = fs.readFileSync('kascity_v70.json', 'utf8');
if (html.split(JSON.stringify(oldJson)).length - 1 !== 1) die('embedded v70 JSON not found exactly once');
html = html.split(JSON.stringify(oldJson)).join(JSON.stringify(v71str));

const amtRe = /asSt\[asK\] = \(asSt\[asK\] \|\| 0\) \+ \(a\.amount != null \? a\.amount : 0\);/;
if (!amtRe.test(html)) die('addSeatStat amount line not found in showcase engine');
html = html.replace(amtRe,
  'var asAmt = 0;\n' +
  '      if (a.amountExpr != null) {\n' +
  '        try { var _ae = evalExpr(compileExpr(String(a.amountExpr)), exprCtx(self));\n' +
  '          if (typeof _ae === "number" && isFinite(_ae)) asAmt = _ae; } catch (e) { asAmt = 0; }\n' +
  '      } else if (a.amount != null) { asAmt = a.amount; }\n' +
  '      asSt[asK] = (asSt[asK] || 0) + asAmt;');

// ---------- negotiation UI ----------
const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');
html = html.split(anchor).join([
  '  window.KV_END=endGame;',
  '',
  '  // ================= NEGOTIATION =================',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    function F(){ return (window.KV_FLAGS&&window.KV_FLAGS())||{}; }',
  '    function intrinsic(t){',
  '      var N=window.KV_NAMES||{}, d=N[t]; if(!d) return 0;',
  '      var f=F(), hz=f["hz_t"+t]||0, rv=f["rv_t"+t]||0;',
  '      return Math.round(d.p*(1-hz/180)*(1+0.18*rv));',
  '    }',
  '    window.KV_INTRINSIC=intrinsic;',
  '',
  '    window.KV_BID=function(tile){',
  '      var N=window.KV_NAMES||{}, d=N[tile]; if(!d) return;',
  '      var f=F();',
  '      var me=((f.turn||0)%4)+1;',
  '      var owner=window.KV_OWNER?window.KV_OWNER(tile):null;',
  '      if(!owner||owner===me) return;',
  '      var mkt=window.KV_MARKET?window.KV_MARKET(tile):d.p;',
  '      var intr=intrinsic(tile);',
  '      var myCash=(window.KV_SEAT&&Math.round(window.KV_SEAT(me,"cash")))||0;',
  '      var lo=Math.max(10,Math.round(mkt*0.4)), hi=Math.round(mkt*2.2);',
  '      var val=Math.min(myCash, Math.max(lo, mkt));',
  '',
  '      var ov=document.createElement("div");',
  '      ov.style.cssText="position:fixed;inset:0;z-index:77;background:rgba(10,8,6,.6);display:flex;align-items:center;justify-content:center;";',
  '      var box=document.createElement("div");',
  '      box.style.cssText="background:#14100c;border:2px solid "+COL[me]+";border-radius:12px;padding:18px 22px;font:12px/1.7 monospace;color:#f4e4c1;min-width:340px;box-shadow:0 8px 40px rgba(0,0,0,.7);";',
  '      box.innerHTML="<div style=\'color:#f0c860;font-weight:700;letter-spacing:1px\'>BID ON "+d.n.toUpperCase()+"</div>"+',
  '        "<div style=\'opacity:.75;margin:6px 0 10px\'>owned by <span style=\'color:"+COL[owner]+"\'>P"+owner+"</span>"+',
  '        " &nbsp;market <b>"+mkt+"</b> &nbsp;their value <b>"+intr+"</b></div>";',
  '      var out=document.createElement("div");',
  '      out.style.cssText="font:900 26px Impact,sans-serif;color:#f8f0d8;text-align:center;margin:4px 0 2px;";',
  '      var hint=document.createElement("div");',
  '      hint.style.cssText="text-align:center;font-size:11px;margin-bottom:8px;";',
  '      var sl=document.createElement("input");',
  '      sl.type="range"; sl.min=lo; sl.max=hi; sl.value=val; sl.step=5;',
  '      sl.style.cssText="width:100%;accent-color:"+COL[me]+";";',
  '      function refresh(){',
  '        var v=+sl.value;',
  '        out.textContent=v;',
  '        var afford=v<=myCash;',
  '        var likely=v>=intr;',
  '        out.style.color=afford?(likely?"#9cd87c":"#f8f0d8"):"#ff6a4a";',
  '        hint.innerHTML = !afford ? "<span style=\'color:#ff6a4a\'>more than you have ("+myCash+")</span>"',
  '          : (likely ? "<span style=\'color:#9cd87c\'>above their valuation \\u2014 likely accepted</span>"',
  '                    : "<span style=\'opacity:.7\'>below their valuation \\u2014 they may refuse</span>");',
  '      }',
  '      sl.oninput=refresh;',
  '      box.appendChild(out); box.appendChild(hint); box.appendChild(sl);',
  '      var row=document.createElement("div"); row.style.cssText="display:flex;gap:8px;margin-top:12px;";',
  '      var send=document.createElement("button");',
  '      send.textContent="Send offer";',
  '      send.style.cssText="flex:1;padding:8px;background:#22303a;color:#cfe6f4;border:1px solid #4f7fd9;border-radius:5px;font:12px monospace;cursor:pointer;";',
  '      var cancel=document.createElement("button");',
  '      cancel.textContent="Cancel";',
  '      cancel.style.cssText="flex:0 0 90px;padding:8px;background:#2a2118;color:#f4e4c1;border:1px solid #5a4a3a;border-radius:5px;font:12px monospace;cursor:pointer;";',
  '      cancel.onclick=function(){ ov.remove(); };',
  '      send.onclick=function(){',
  '        var v=+sl.value;',
  '        ov.remove();',
  '        if(v>myCash){ window.KV_LOG("offer failed \\u2014 not enough cash","#ff6a4a"); return; }',
  '        window.KV_LOG("P"+me+"  offers  "+v+"  for "+d.n, COL[me]);',
  '        if(window.KV_MOVE) window.KV_MOVE(me,"bid:"+tile,v);',
  '        var humans=window.KV_HUMANS||[1];',
  '        if(humans.indexOf(owner)>=0){ askHuman(tile,me,owner,v,d.n); return; }',
  '        // bot decides on its own valuation plus how badly it needs cash',
  '        var theirCash=(window.KV_SEAT&&Math.round(window.KV_SEAT(owner,"cash")))||0;',
  '        var theirMort=(window.KV_SEAT&&Math.round(window.KV_SEAT(owner,"mort")))||0;',
  '        var need=(theirCash<200||theirMort>300);',
  '        var threshold=intr*(need?0.82:1.05);',
  '        var accept=v>=threshold;',
  '        var why=accept?(need?"needs the cash":"beats their valuation"):"below what they will take";',
  '        setTimeout(function(){',
  '          window.KV_LOG("P"+owner+"  "+(accept?"ACCEPTS":"REFUSES")+"  \\u2014 "+why, COL[owner]);',
  '          if(accept) settle(tile,me,owner,v);',
  '          else if(window.KV_SFX) window.KV_SFX("dang");',
  '        }, 900);',
  '      };',
  '      row.appendChild(send); row.appendChild(cancel); box.appendChild(row);',
  '      ov.appendChild(box); document.body.appendChild(ov);',
  '      refresh();',
  '    };',
  '',
  '    function askHuman(tile,buyer,seller,amt,nm){',
  '      var ov=document.createElement("div");',
  '      ov.style.cssText="position:fixed;inset:0;z-index:77;background:rgba(10,8,6,.6);display:flex;align-items:center;justify-content:center;";',
  '      var box=document.createElement("div");',
  '      box.style.cssText="background:#14100c;border:2px solid "+COL[seller]+";border-radius:12px;padding:18px 22px;font:12px/1.7 monospace;color:#f4e4c1;min-width:300px;text-align:center;";',
  '      box.innerHTML="<div style=\'color:#f0c860;font-weight:700\'>P"+seller+" \\u2014 OFFER RECEIVED</div>"+',
  '        "<div style=\'margin:8px 0\'>P"+buyer+" offers <b style=\'color:#9cd87c\'>"+amt+"</b> for "+nm+"</div>"+',
  '        "<div style=\'opacity:.65;font-size:11px\'>your valuation "+intrinsic(tile)+"</div>";',
  '      ["Accept","Refuse"].forEach(function(lbl,ix){',
  '        var b=document.createElement("button");',
  '        b.textContent=lbl;',
  '        b.style.cssText="margin:10px 5px 0;padding:7px 18px;background:"+(ix?"#2a2118":"#22303a")+";color:#f4e4c1;border:1px solid "+(ix?"#5a4a3a":"#4f7fd9")+";border-radius:5px;font:12px monospace;cursor:pointer;";',
  '        b.onclick=function(){',
  '          ov.remove();',
  '          window.KV_LOG("P"+seller+"  "+(ix?"REFUSES":"ACCEPTS")+"  "+amt, COL[seller]);',
  '          if(!ix) settle(tile,buyer,seller,amt);',
  '        };',
  '        box.appendChild(b);',
  '      });',
  '      ov.appendChild(box); document.body.appendChild(ov);',
  '    }',
  '',
  '    function settle(tile,buyer,seller,amt){',
  '      if(!window.KV_SETSTATE) return;',
  '      window.KV_SETSTATE("tr_tile",tile);',
  '      window.KV_SETSTATE("tr_from",buyer);',
  '      window.KV_SETSTATE("tr_to",seller);',
  '      window.KV_SETSTATE("tr_amt",amt);',
  '      window.KV_SETSTATE("tr_t",0);',
  '      window.KV_SETSTATE("tr_state",2);',
  '      if(window.KV_XP){',
  '        var intr=intrinsic(tile);',
  '        var mult=(window.KV_XP_MULT==null?1:window.KV_XP_MULT);',
  '        if(amt<intr){ var g=Math.max(1,Math.round(18*mult));',
  '          window.KV_XP[buyer]=(window.KV_XP[buyer]||0)+g;',
  '          window.KV_LOG("P"+buyer+"  +"+g+" XP  bought below value",COL[buyer]); }',
  '        var s=Math.max(1,Math.round(15*mult));',
  '        window.KV_XP[seller]=(window.KV_XP[seller]||0)+s;',
  '        window.KV_LOG("P"+seller+"  +"+s+" XP  negotiated sale",COL[seller]);',
  '      }',
  '    }',
  '  })();'
].join('\n'));

// replace the fixed-price offer button with the bid slider
const obRe = /        ob\.textContent="Make offer \(" \+ Math\.round\(\(d\.p\|\|100\)\*0\.9\) \+ "\)";/;
const obRe2 = /        ob\.textContent="Make offer \("\+Math\.round\(\(d\.p\|\|100\)\*0\.9\)\+"\)";/;
if (obRe.test(html)) html = html.replace(obRe, '        ob.textContent="Negotiate\\u2026";');
else if (obRe2.test(html)) html = html.replace(obRe2, '        ob.textContent="Negotiate\\u2026";');
else die('offer button label not found');

const obClickRe = /          if\(window\.KV_SETSTATE\)\{\n            window\.KV_SETSTATE\("offer_ask", i\);[\s\S]*?\n          \}\n          pop\.style\.display="none";/;
if (!obClickRe.test(html)) die('offer button handler not found');
html = html.replace(obClickRe,
  '          pop.style.display="none";\n' +
  '          if(window.KV_BID) window.KV_BID(i);\n' +
  '          if(false) pop.style.display="none";');

fs.writeFileSync('showcase_kascity71.html', html);
console.log('PASS engine: addSeatStat now accepts amountExpr (same evalExpr path as setFlagExpr)');
console.log('PASS ' + trN + ' generic trade-settlement branches — any tile, any pair, any price');
console.log('PASS bid slider 40%-220% of market with fair value and the owner\'s threshold shown');
console.log('PASS bots weigh your bid against intrinsic value and their cash need, and say why');
console.log('PASS XP: 18 for buying below value, 15 for negotiating a sale');
console.log('OK kascity_v71.json + showcase_kascity71.html (' + (fs.statSync('showcase_kascity71.html').size/1024/1024).toFixed(1) + ' MB)');
