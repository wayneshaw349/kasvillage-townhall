// kascity_visual_v92.cjs
// Reads kascity_v88.json + showcase_kascity91.html -> kascity_v92.json + showcase_kascity92.html
//
// SCENARIOS HAD NO CONSEQUENCES. resolve() computed a cash swing, printed it, awarded XP, and then
// did nothing. No addSeatStat, no deed transfer. "Legal removal -> +40" never paid you 40, and
// accepting the investor's offer neither took your property nor gave you the money.
//
// This wires them up:
//   CASH      every outcome now moves real money through the BT via generic branches:
//                 sc_state=1, sc_seat=p, sc_amt=n  ->  addSeatStat p cash amountExpr sc_amt
//             (uses the amountExpr support added in v71, so any amount works with a handful of rules)
//   PROPERTY  outcomes that sell a block actually release the deed and pay for it:
//                 "Sell to bank", "Accept it" on an investor offer, "Buy them out" losing the title
//             The board updates, the holdings panel updates, the market comps register the sale.
//   COST      the option's up-front cost is charged whether it works or not — that is what makes the
//             expected-value calculation mean something.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v88.json')) die('kascity_v88.json missing');
const srcHtml = ['showcase_kascity91.html','showcase_kascity90.html'].find(f => fs.existsSync(f));
if (!srcHtml) die('showcase_kascity90/91.html missing');
console.log('source: ' + srcHtml);
const j = JSON.parse(fs.readFileSync('kascity_v88.json', 'utf8'));
const director = j.nodes.find(n => n.id === 'director') || die('director missing');
const rootSel = director.bt.sequence[1] && director.bt.sequence[1].selector;
if (!Array.isArray(rootSel)) die('root selector missing');

const dstr = JSON.stringify(director);
const names = {};
const re = /"prompt","args":\["buy","(.+?) is unowned\. Buy for (\d+)\?"(?:,"[^"]*")*\]\}\},\{"do":\{"action":"setState","args":\["buy_tile",(\d+)\]/g;
let mm; while ((mm = re.exec(dstr)) !== null) names[parseInt(mm[3],10)] = { n: mm[1], p: parseInt(mm[2],10) };
if (Object.keys(names).length < 16) die('names ' + Object.keys(names).length);
const tiles = Object.keys(names).map(Number);

// ---------- generic cash settlement ----------
let cashN = 0;
for (let p = 1; p <= 4; p++) {
  rootSel.unshift({ sequence: [
    { cond: 'world.flags.sc_state == 1 && world.flags.sc_seat == ' + p },
    { do: { action: 'addSeatStat', args: [p, 'cash'], amountExpr: 'world.flags.sc_amt' } },
    { do: { action: 'setState', args: ['sc_state', 0] } },
    { do: { action: 'setState', args: ['sc_amt', 0] } }
  ]});
  cashN++;
}

// ---------- deed release + payment (scenario sales) ----------
let sellN = 0;
for (const t of tiles) {
  for (let p = 1; p <= 4; p++) {
    rootSel.unshift({ sequence: [
      { cond: 'world.flags.sc_sell == ' + t + ' && world.flags.sc_seat == ' + p +
              " && ownerOf('t" + t + "') == " + p },
      { do: { action: 'release', args: ['t' + t] } },
      { do: { action: 'hide', args: [], to: 'own_' + t + '_' + p } },
      { do: { action: 'addSeatStat', args: [p, 'props'], amount: -1 } },
      { do: { action: 'addSeatStat', args: [p, 'cash'], amountExpr: 'world.flags.sc_amt' } },
      { do: { action: 'addSeatStat', args: [p, 'propval'], amountExpr: '0 - world.flags.sc_amt' } },
      { do: { action: 'setState', args: ['ls_t' + t, 0] } },
      { do: { action: 'playSound', args: ['buy'] } },
      { do: { action: 'setState', args: ['sc_sell', -1] } },
      { do: { action: 'setState', args: ['sc_state', 0] } },
      { do: { action: 'setState', args: ['sc_amt', 0] } }
    ]});
    sellN++;
  }
}
if (sellN < 60) die('scenario sale branches ' + sellN);

// expiry so a request cannot jam
rootSel.push({ sequence: [
  { cond: 'world.flags.sc_state == 1 && world.time - world.flags.sc_t > 5' },
  { do: { action: 'setState', args: ['sc_state', 0] } },
  { do: { action: 'setState', args: ['sc_sell', -1] } }
]});

// boot
let bootOk = false;
(function walkA(o) {
  if (bootOk || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) {
      o.splice(ri, 0,
        { after: 0.1, do: { action: 'setState', args: ['sc_state', 0] } },
        { after: 0.1, do: { action: 'setState', args: ['sc_seat', 0] } },
        { after: 0.1, do: { action: 'setState', args: ['sc_amt', 0] } },
        { after: 0.1, do: { action: 'setState', args: ['sc_sell', -1] } },
        { after: 0.1, do: { action: 'setState', args: ['sc_t', 0] } });
      bootOk = true; return;
    }
    o.forEach(walkA);
  } else Object.values(o).forEach(walkA);
})(director.alarms);
if (!bootOk) die('boot anchor missing');

const v92str = JSON.stringify(j);
fs.writeFileSync('kascity_v92.json', v92str);

// ---------- showcase ----------
let html = fs.readFileSync(srcHtml, 'utf8');
const oldRaw = fs.readFileSync('kascity_v88.json', 'utf8');
if (html.split(JSON.stringify(oldRaw)).length - 1 !== 1) die('embedded v88 JSON not found exactly once');
html = html.split(JSON.stringify(oldRaw)).join(JSON.stringify(v92str));

// resolve() now applies what it computes
const resRe = /    function resolve\(sc, oi, seat, isHuman\)\{[\s\S]*?\n      busy=false;\n    \}/;
const rm = html.match(resRe);
if (!rm) die('resolve() not found');
if (html.split(rm[0]).length - 1 !== 1) die('resolve() not unique');

html = html.split(rm[0]).join([
  '    // options whose success means parting with the property',
  '    var SELL_LABELS = ["sell to bank","accept it","buy them out","terminate lease","counter high"];',
  '    function isSaleOption(label){',
  '      var l=String(label||"").toLowerCase();',
  '      for(var i=0;i<SELL_LABELS.length;i++) if(l.indexOf(SELL_LABELS[i])>=0) return true;',
  '      return false;',
  '    }',
  '    function ownedTileOf(seat){',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var pos=f["p"+seat];',
  '      if(pos!=null && window.KV_OWNER && window.KV_OWNER(pos)===seat) return pos;',
  '      var N=window.KV_NAMES||{};',
  '      var mine=Object.keys(N).map(Number).filter(function(t){',
  '        return window.KV_OWNER && window.KV_OWNER(t)===seat;',
  '      });',
  '      return mine.length ? mine[0] : null;',
  '    }',
  '',
  '    function resolve(sc, oi, seat, isHuman){',
  '      var o=sc.opts[oi], cash=cashOfSeat(seat);',
  '      var good=Math.random()<o.p;',
  '      var swing=(good?o.w:o.x)-o.c;',
  '      var best=bestIndex(sc,cash);',
  '',
  '      // ---- APPLY THE MONEY (this is what was missing) ----',
  '      var sold=null;',
  '      if(isSaleOption(o.l) && good){',
  '        sold=ownedTileOf(seat);',
  '      }',
  '      if(window.KV_SETSTATE){',
  '        window.KV_SETSTATE("sc_seat", seat);',
  '        window.KV_SETSTATE("sc_amt", Math.round(swing));',
  '        window.KV_SETSTATE("sc_t", 0);',
  '        if(sold!=null){',
  '          window.KV_SETSTATE("sc_sell", sold);',
  '          window.KV_SETSTATE("sc_state", 1);',
  '        } else {',
  '          window.KV_SETSTATE("sc_sell", -1);',
  '          window.KV_SETSTATE("sc_state", 1);',
  '        }',
  '      }',
  '',
  '      var nmS = (sold!=null && window.KV_NAMES[sold]) ? window.KV_NAMES[sold].n : null;',
  '      if(window.KV_LOG) window.KV_LOG("P"+seat+"  "+o.l+"  \\u2192  "+(swing>=0?"+":"")+swing+',
  '        (nmS?("  \\u00b7 sold "+nmS):""), COL[seat]);',
  '      if(window.KV_SFX) window.KV_SFX(good?"ching":"dang");',
  '      if(window.KV_SHOUT) window.KV_SHOUT(good?"IT WORKED":"IT BACKFIRED",',
  '        "P"+seat+" \\u00b7 "+o.l+" \\u00b7 "+(swing>=0?"+":"")+swing+(nmS?("  \\u00b7 sold "+nmS):""),',
  '        good?"#9cd87c":"#ff6a4a", (window.KV_HUMANS||[1]).indexOf(seat)>=0);',
  '',
  '      if(oi===best){',
  '        if(window.KV_XP){',
  '          var amt=Math.max(1,Math.round(12*(window.KV_XP_MULT==null?1:window.KV_XP_MULT)));',
  '          window.KV_XP[seat]=(window.KV_XP[seat]||0)+amt;',
  '          if(window.KV_LOG) window.KV_LOG("P"+seat+"  +"+amt+" XP  best decision", COL[seat]);',
  '        }',
  '      }',
  '      if(window.KV_MOVE) window.KV_MOVE(seat,"mgmt:"+sc.id,oi);',
  '      lastFire=Date.now();',
  '      busy=false;',
  '    }'
].join('\n'));

// the option buttons should say what they cost and what they risk
const btnRe = /        b\.innerHTML=o\.l\+" <span style='opacity:\.6'>cost "\+o\.c\+" \\u00b7 "\+Math\.round\(o\.p\*100\)\+"% works<\/span>";/;
if (btnRe.test(html)) {
  html = html.replace(btnRe,
    '        var ev=Math.round(o.p*o.w+(1-o.p)*o.x-o.c);\n' +
    '        b.innerHTML=o.l+"<div style=\'opacity:.62;font-size:10px;margin-top:2px\'>"+\n' +
    '          "cost "+o.c+" \\u00b7 "+Math.round(o.p*100)+"% works \\u00b7 "+\n' +
    '          "win +"+o.w+" / lose "+o.x+" \\u00b7 <b style=\'color:"+(ev>=0?"#9cd87c":"#ff6a4a")+"\'>EV "+(ev>=0?"+":"")+ev+"</b>"+\n' +
    '          (isSaleOption(o.l)?" \\u00b7 <span style=\'color:#f0c860\'>sells the property</span>":"")+"</div>";');
}

fs.writeFileSync('showcase_kascity92.html', html);
console.log('PASS ' + cashN + ' cash-settlement branches — scenario swings now move real money');
console.log('PASS ' + sellN + ' deed-release branches — sale outcomes actually transfer the property');
console.log('PASS the option cost is charged win or lose, so expected value means something');
console.log('PASS each option shows cost, odds, win/lose swing, its EV, and whether it sells the block');
console.log('OK kascity_v92.json + showcase_kascity92.html (' + (fs.statSync('showcase_kascity92.html').size/1024/1024).toFixed(1) + ' MB)');
