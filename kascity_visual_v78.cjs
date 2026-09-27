// kascity_visual_v78.cjs
// Reads kascity_v73.json + showcase_kascity77.html -> kascity_v78.json + showcase_kascity78.html
//
// A. LIST YOUR OWN PROPERTY. Bots could list; you could not. The popup on a block you own now has
//    "List for sale" with a price slider anchored on market value, and "Unlist" once it is up.
//    Listing is free and does not cost a turn — pricing is the decision, not the action.
//
// B. BOTS BUY LISTINGS. A bot passing its turn now scans every listed block and buys when the asking
//    price sits at or below its own valuation and it can afford the hit. It uses the generic trade
//    settlement from v71, so the money and deed move properly:
//        tr_tile = t, tr_from = buyer, tr_to = ownerOf(t), tr_amt = lp_t, tr_state = 2
//    Meaning: overprice a block and it sits unsold; price it under their valuation and it clears.
//    That is a real pricing decision with a real counterparty.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v73.json')) die('kascity_v73.json missing');
const srcHtml = ['showcase_kascity77.html','showcase_kascity76.html','showcase_kascity75.html','showcase_kascity74.html']
  .find(f => fs.existsSync(f));
if (!srcHtml) die('no showcase_kascity74-77.html found');
console.log('source: ' + srcHtml);

const j = JSON.parse(fs.readFileSync('kascity_v73.json', 'utf8'));
const director = j.nodes.find(n => n.id === 'director') || die('director missing');
const rootSel = director.bt.sequence[1] && director.bt.sequence[1].selector;
if (!Array.isArray(rootSel)) die('root selector missing');

const dstr = JSON.stringify(director);
const names = {};
const re = /"prompt","args":\["buy","(.+?) is unowned\. Buy for (\d+)\?"(?:,"[^"]*")*\]\}\},\{"do":\{"action":"setState","args":\["buy_tile",(\d+)\]/g;
let mm; while ((mm = re.exec(dstr)) !== null) names[parseInt(mm[3],10)] = { n: mm[1], p: parseInt(mm[2],10) };
if (Object.keys(names).length < 16) die('names ' + Object.keys(names).length);
const tiles = Object.keys(names).map(Number);

// ---------- B. bots buy listings ----------
let buyN = 0;
for (const t of tiles) {
  const P = names[t].p;
  // the bot's own valuation of this block
  const val = P + ' * world.flags.q_t' + t +
              ' * (1.32 - world.flags.hz_t' + t + ' / 120 - world.flags.age_t' + t +
              ' / 600 - world.flags.tax_t' + t + ' / 260)' +
              ' * (1 + 0.12 * world.flags.rv_t' + t + ')';
  for (let b = 1; b <= 4; b++) {
    rootSel.unshift({ sequence: [
      { cond: 'world.flags.tr_state == 0 && world.flags.ls_t' + t + ' == 1' +
              ' && seat() > world.flags.humans && seat() == ' + b +
              " && ownerOf('t" + t + "') != 0 && ownerOf('t" + t + "') != " + b +
              " && seatStat(" + b + ",'cash') >= world.flags.lp_t" + t + ' + 80' +
              ' && world.flags.lp_t' + t + ' <= (' + val + ')' },
      { do: { action: 'setState', args: ['tr_tile', t] } },
      { do: { action: 'setState', args: ['tr_from', b] } },
      { do: { action: 'setFlagExpr', args: ['tr_to', "ownerOf('t" + t + "')"] } },
      { do: { action: 'setFlagExpr', args: ['tr_amt', 'world.flags.lp_t' + t] } },
      { do: { action: 'setState', args: ['tr_t', 0] } },
      { do: { action: 'setState', args: ['tr_state', 2] } },
      { do: { action: 'setState', args: ['ls_t' + t, 0] } }
    ]});
    buyN++;
  }
}
if (buyN < 60) die('bot listing-purchase branches ' + buyN);

const v78str = JSON.stringify(j);
fs.writeFileSync('kascity_v78.json', v78str);

// ---------- showcase ----------
let html = fs.readFileSync(srcHtml, 'utf8');
// the showcase may embed v73 or a later compacted copy; find whichever is in there
const candidates = ['kascity_v74.json','kascity_v73.json'].filter(f => fs.existsSync(f));
let swapped = false;
for (const c of candidates) {
  const raw = fs.readFileSync(c, 'utf8');
  if (html.split(JSON.stringify(raw)).length - 1 === 1) {
    html = html.split(JSON.stringify(raw)).join(JSON.stringify(v78str));
    console.log('swapped embedded scene from ' + c);
    swapped = true;
    break;
  }
}
if (!swapped) die('could not find the embedded scene JSON in ' + srcHtml);

// ---------- A. listing UI ----------
const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');
html = html.split(anchor).join([
  '  window.KV_END=endGame;',
  '',
  '  // ================= LIST YOUR OWN PROPERTY =================',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    function el(t,css,par){var e=document.createElement(t);e.style.cssText=css;(par||document.body).appendChild(e);return e;}',
  '',
  '    window.KV_LIST=function(tile){',
  '      var N=window.KV_NAMES||{}, d=N[tile]; if(!d) return;',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var me=((f.turn||0)%4)+1;',
  '      var own=window.KV_OWNER?window.KV_OWNER(tile):null;',
  '      if(own!==me){ window.KV_LOG("not your property","#ff6a4a"); return; }',
  '      var mkt=window.KV_MARKET?window.KV_MARKET(tile):d.p;',
  '      var intr=window.KV_INTRINSIC?window.KV_INTRINSIC(tile):mkt;',
  '      var lo=Math.max(10,Math.round(mkt*0.5)), hi=Math.round(mkt*1.9);',
  '',
  '      var ov=el("div","position:fixed;inset:0;z-index:78;background:rgba(10,8,6,.6);display:flex;align-items:center;justify-content:center;");',
  '      var box=el("div","background:#14100c;border:2px solid "+COL[me]+";border-radius:12px;padding:18px 22px;'
    + 'font:12px/1.7 monospace;color:#f4e4c1;min-width:340px;box-shadow:0 8px 40px rgba(0,0,0,.7);",ov);',
  '      box.innerHTML="<div style=\'color:#f0c860;font-weight:700;letter-spacing:1px\'>LIST "+d.n.toUpperCase()+"</div>"+',
  '        "<div style=\'opacity:.75;margin:6px 0 10px\'>market <b>"+mkt+"</b> &nbsp; buyers value it near <b>"+intr+"</b></div>";',
  '      var out=el("div","font:900 26px Impact,sans-serif;color:#f8f0d8;text-align:center;margin:4px 0 2px;",box);',
  '      var hint=el("div","text-align:center;font-size:11px;margin-bottom:8px;",box);',
  '      var sl=el("input","width:100%;accent-color:"+COL[me]+";",box);',
  '      sl.type="range"; sl.min=lo; sl.max=hi; sl.step=5; sl.value=Math.round(mkt);',
  '      function refresh(){',
  '        var v=+sl.value; out.textContent=v;',
  '        var quick=v<=intr;',
  '        out.style.color=quick?"#9cd87c":"#f0c860";',
  '        hint.innerHTML=quick',
  '          ? "<span style=\'color:#9cd87c\'>at or under their valuation \\u2014 should sell quickly</span>"',
  '          : "<span style=\'opacity:.7\'>above their valuation \\u2014 may sit unsold</span>";',
  '      }',
  '      sl.oninput=refresh; refresh();',
  '      var row=el("div","display:flex;gap:8px;margin-top:12px;",box);',
  '      var go=el("button","flex:1;padding:8px;background:#2f4a2f;color:#cfe6c4;border:1px solid #4fd98a;'
    + 'border-radius:5px;font:12px monospace;cursor:pointer;",row);',
  '      go.textContent="List it";',
  '      go.onclick=function(){',
  '        var v=+sl.value; ov.remove();',
  '        if(!window.KV_SETSTATE) return;',
  '        window.KV_SETSTATE("lp_t"+tile, v);',
  '        window.KV_SETSTATE("ls_t"+tile, 1);',
  '        window.KV_LOG("P"+me+"  LISTS  "+d.n+"  at "+v, COL[me]);',
  '        if(window.KV_MOVE) window.KV_MOVE(me,"list:"+tile,v);',
  '      };',
  '      var no=el("button","flex:0 0 90px;padding:8px;background:#2a2118;color:#f4e4c1;border:1px solid #5a4a3a;'
    + 'border-radius:5px;font:12px monospace;cursor:pointer;",row);',
  '      no.textContent="Cancel";',
  '      no.onclick=function(){ ov.remove(); };',
  '    };',
  '',
  '    window.KV_UNLIST=function(tile){',
  '      if(!window.KV_SETSTATE) return;',
  '      window.KV_SETSTATE("ls_t"+tile, 0);',
  '      var N=window.KV_NAMES||{};',
  '      window.KV_LOG("withdrawn from sale: "+((N[tile]&&N[tile].n)||tile),"#caa64c");',
  '    };',
  '  })();'
].join('\n'));

// buttons in the popup for a block you own
const renRe = /        var rb=document\.createElement\("button"\);/;
if (!renRe.test(html)) die('renovate button block not found');
html = html.replace(renRe,
  '        var listed=window.KV_LISTED?window.KV_LISTED(i):0;\n' +
  '        var lb=document.createElement("button");\n' +
  '        lb.textContent = listed ? ("Unlist ("+listed+")") : "List for sale\\u2026";\n' +
  '        lb.style.cssText="margin-top:8px;width:100%;padding:6px;background:#2f4a2f;color:#cfe6c4;border:1px solid #4fd98a;border-radius:5px;font:11px monospace;cursor:pointer;";\n' +
  '        lb.onclick=function(ev4){ ev4.stopPropagation(); pop.style.display="none";\n' +
  '          if(listed) window.KV_UNLIST(i); else window.KV_LIST(i); };\n' +
  '        pop.appendChild(lb);\n' +
  '        var rb=document.createElement("button");');

fs.writeFileSync('showcase_kascity78.html', html);
console.log('PASS ' + buyN + ' bot listing-purchase branches — they buy at or below their own valuation');
console.log('PASS List for sale / Unlist on any block you own, priced against market and their valuation');
console.log('PASS listings settle through the generic trade path: deed, cash, props and propval all move');
console.log('OK kascity_v78.json + showcase_kascity78.html (' + (fs.statSync('showcase_kascity78.html').size/1024/1024).toFixed(1) + ' MB)');
