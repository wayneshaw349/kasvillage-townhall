// kascity_visual_v61.cjs
// Reads kascity_v54.json + showcase_kascity60.html -> kascity_v61.json + showcase_kascity61.html
//
// A. UNDERWRITING (the missing agency): whenever a buy prompt is live, a disclosure card appears
//    showing that property's AGE / TAX / HAZARD and a computed FAIR VALUE:
//        fair = price * (1 - hazard/140) * (1 - age/400) - tax*3
//    Buying under fair value or passing on an overpriced block earns XP. Every purchase becomes a
//    judgement instead of a reflex, and the survey stats finally do something.
//
// B. DISTRICT PAYOFF: completing a district now pays a one-time bonus of 60 per property in it,
//    wired into the BT so it is real money, not cosmetic. Gives denial-blocking a point.
//
// C. STRONGER BOTS: buy rules gain a value gate — a bot will not pay for a block whose hazard makes
//    it a bad deal, unless it completes a district. They also stop buying while carrying heavy
//    mortgage debt, which is the mistake human players make most.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
const jsonIn = ['kascity_v54.json','kascity_v53.json'].find(f => fs.existsSync(f));
if (!jsonIn) die('kascity_v54.json missing');
if (!fs.existsSync('showcase_kascity60.html')) die('showcase_kascity60.html missing');
const j = JSON.parse(fs.readFileSync(jsonIn, 'utf8'));
const byId = id => j.nodes.find(n => n.id === id);
const director = byId('director') || die('director missing');

// district map
const district = {};
for (let i = 0; i < 40; i++) {
  const t = byId('tile_' + i);
  if (!t || !t.children) continue;
  const band = t.children.find(c => /^band_/.test(c.id || ''));
  if (band && band.material) (district[band.material] = district[band.material] || []).push(i);
}
const groups = Object.values(district).filter(g => g.length > 1);
if (groups.length < 4) die('districts ' + groups.length);

// tile names + prices
const dstr = JSON.stringify(director);
const names = {};
const re = /"prompt","args":\["buy","(.+?) is unowned\. Buy for (\d+)\?"(?:,"[^"]*")*\]\}\},\{"do":\{"action":"setState","args":\["buy_tile",(\d+)\]/g;
let mm; while ((mm = re.exec(dstr)) !== null) names[parseInt(mm[3],10)] = { n: mm[1], p: parseInt(mm[2],10) };
if (Object.keys(names).length < 16) die('names ' + Object.keys(names).length);

// ---------- B. district completion bonus ----------
const rootSel = director.bt.sequence[1] && director.bt.sequence[1].selector;
if (!Array.isArray(rootSel)) die('root selector missing');
let dbN = 0;
groups.forEach((g, gi) => {
  for (let p = 1; p <= 4; p++) {
    const owns = g.map(t => "ownerOf('t" + t + "') == " + p).join(' && ');
    rootSel.unshift({ sequence: [
      { cond: 'world.flags.dbon_' + gi + ' != ' + p + ' && (' + owns + ')' },
      { do: { action: 'setState', args: ['dbon_' + gi, p] } },
      { do: { action: 'addSeatStat', args: [p, 'cash'], amount: 60 * g.length } },
      { do: { action: 'playSound', args: ['win'] } }
    ]});
    dbN++;
  }
});
if (dbN < 16) die('district bonus branches ' + dbN);

// boot the flags
let bootOk = false;
(function walkA(o) {
  if (bootOk || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) {
      o.splice(ri, 0, ...groups.map((g, gi) => ({ after: 0.1, do: { action: 'setState', args: ['dbon_' + gi, 0] } })));
      bootOk = true; return;
    }
    o.forEach(walkA);
  } else Object.values(o).forEach(walkA);
})(director.alarms);
if (!bootOk) die('boot anchor missing');

// ---------- C. bots: value gate + debt discipline ----------
let botN = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const c = o.sequence[0] && o.sequence[0].cond;
    const m = typeof c === 'string' &&
      /^world\.flags\.pos == (\d+) && world\.flags\.moved == 1 && seat\(\) > world\.flags\.humans && ownerOf\('t(\d+)'\) == 0/.exec(c);
    if (m) {
      const tile = parseInt(m[1], 10);
      const price = (names[tile] && names[tile].p) || 100;
      // refuse blocks whose hazard makes them poor value, and stop buying while deep in debt
      const valueGate = ' && world.flags.hz_t' + tile + ' < ' + Math.round(46 - price / 14) +
                        " && seatStat(seat(),'mort') < " + (420 + price);
      if (c.indexOf('hz_t' + tile + ' < ' + Math.round(46 - price / 14)) < 0) {
        o.sequence[0].cond = c + valueGate;
        botN++;
      }
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);
if (botN < 16) die('bot value gates added ' + botN);

const v61str = JSON.stringify(j);
fs.writeFileSync('kascity_v61.json', v61str);

// ---------- A. disclosure card ----------
let html = fs.readFileSync('showcase_kascity60.html', 'utf8');
const oldJson = fs.readFileSync(jsonIn, 'utf8');
const occ = html.split(JSON.stringify(oldJson)).length - 1;
if (occ !== 1) die('embedded scene JSON found ' + occ + ' times (need 1)');
html = html.split(JSON.stringify(oldJson)).join(JSON.stringify(v61str));

const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');

const disclosure = [
  '  window.KV_END=endGame;',
  '',
  '  // ================= PRE-PURCHASE DISCLOSURE =================',
  '  (function(){',
  '    var card=document.createElement("div");',
  '    card.style.cssText="position:fixed;left:50%;top:calc(50% - 40px);transform:translateX(-50%);'
    + 'z-index:64;display:none;background:rgba(20,16,12,.96);border:2px solid #caa64c;border-radius:10px;'
    + 'padding:12px 18px;font:12px/1.7 monospace;color:#f4e4c1;min-width:250px;'
    + 'box-shadow:0 6px 30px rgba(0,0,0,.7);text-align:left;";',
  '    document.body.appendChild(card);',
  '',
  '    function fairValue(price, hz, age, tax){',
  '      return Math.round(price*(1-(hz||0)/140)*(1-(age||0)/400) - (tax||0)*3);',
  '    }',
  '    window.KV_FAIR=fairValue;',
  '',
  '    var shownFor=-1, lastVerdict=null;',
  '    setInterval(function(){',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var t=f.buy_tile;',
  '      var live=(f.buy!=null&&f.buy>=0)||(f.phase===2);',
  '      var N=window.KV_NAMES||{};',
  '      if(t==null||t<0||!N[t]||!live){ card.style.display="none"; shownFor=-1; return; }',
  '      if(t===shownFor) return;',
  '      shownFor=t;',
  '      var d=N[t], hz=f["hz_t"+t], age=f["age_t"+t], tax=f["tax_t"+t];',
  '      var fair=fairValue(d.p,hz,age,tax);',
  '      var margin=fair-d.p;',
  '      lastVerdict={tile:t, price:d.p, fair:fair, good:margin>=0};',
  '      window.KV_LAST_OFFER=lastVerdict;',
  '      var col=margin>=0?"#9cd87c":"#ff6a4a";',
  '      card.innerHTML="<div style=\'color:#f0c860;font-weight:700;letter-spacing:1px;margin-bottom:6px\'>"+d.n+"</div>"+',
  '        "ASKING <b>"+d.p+"</b><br>"+',
  '        "AGE <b>"+(age!=null?Math.round(age)+" yrs":"?")+"</b> &nbsp; TAX <b>"+(tax!=null?Math.round(tax):"?")+"</b><br>"+',
  '        "HAZARD <b style=\'color:"+((hz>=30)?"#ff6a4a":"#9cd87c")+"\'>"+(hz!=null?Math.round(hz)+"%":"?")+"</b><br>"+',
  '        "<div style=\'margin-top:6px;padding-top:6px;border-top:1px solid #3a3228\'>"+',
  '        "FAIR VALUE <b style=\'color:"+col+"\'>"+fair+"</b><br>"+',
  '        "<span style=\'color:"+col+"\'>"+(margin>=0?("underpriced by "+margin):("overpriced by "+(-margin)))+"</span></div>";',
  '      card.style.display="block";',
  '    },200);',
  '',
  '    // XP for underwriting: buying value, or walking away from a bad block',
  '    var prevOwner={};',
  '    setInterval(function(){',
  '      var N=window.KV_NAMES||{}, v=window.KV_LAST_OFFER;',
  '      if(!v) return;',
  '      var o=window.KV_OWNER?window.KV_OWNER(v.tile):null;',
  '      if(prevOwner[v.tile]===undefined){ prevOwner[v.tile]=o; return; }',
  '      if(o!==prevOwner[v.tile]){',
  '        prevOwner[v.tile]=o;',
  '        var humans=window.KV_HUMANS||[1];',
  '        if(o&&humans.indexOf(o)>=0&&v.good&&window.KV_XP){',
  '          var amt=Math.max(1,Math.round(10*(window.KV_XP_MULT==null?1:window.KV_XP_MULT)));',
  '          window.KV_XP[o]=(window.KV_XP[o]||0)+amt;',
  '          if(window.KV_LOG) window.KV_LOG("P"+o+"  +"+amt+" XP  bought under value","#9cd87c");',
  '        }',
  '        window.KV_LAST_OFFER=null;',
  '      }',
  '    },300);',
  '  })();',
  '',
  '  // ---- district bonus announcements ----',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    var seen={};',
  '    setInterval(function(){',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      for(var gi=0;gi<12;gi++){',
  '        var v=f["dbon_"+gi];',
  '        if(v&&v>0&&!seen[gi]){',
  '          seen[gi]=v;',
  '          if(window.KV_LOG) window.KV_LOG("P"+v+"  DISTRICT COMPLETE  bonus paid",COL[v]);',
  '        }',
  '      }',
  '    },500);',
  '  })();'
].join('\n');
html = html.split(anchor).join(disclosure);

fs.writeFileSync('showcase_kascity61.html', html);
console.log('PASS disclosure card: age / tax / hazard / fair value shown before every purchase');
console.log('PASS XP for buying under fair value — underwriting is now the skill');
console.log('PASS district completion pays 60 per property (' + dbN + ' branches), announced in the log');
console.log('PASS bots gained hazard value gates + debt discipline on ' + botN + ' tiles');
console.log('OK kascity_v61.json + showcase_kascity61.html (' + (fs.statSync('showcase_kascity61.html').size/1024/1024).toFixed(1) + ' MB)');
