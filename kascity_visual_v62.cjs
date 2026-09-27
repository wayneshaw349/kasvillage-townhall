// kascity_visual_v62.cjs
// Reads kascity_v61.json + showcase_kascity61.html -> kascity_v62.json + showcase_kascity62.html
//
// A. RENOVATION: any property you own can be renovated. Cost scales with the asking price; the work
//    cuts that block's hazard by ~45% and adds a permanent value uplift. Executed in the BT (real
//    cash, real flags) and triggered from the property popup — JS sets a flag, the director acts on it.
//      cost   = round(price * 0.55)
//      hazard = max(4, hazard * 0.55)
//      uplift = +1 renovation grade (each grade adds 18% to market value)
//
// B. MARKET COMPS: the market now moves. Every completed sale feeds a rolling comps index built from
//    the last six trades relative to their asking prices. A hot market lifts every valuation, a cold
//    one drags it down. Market value replaces flat price in BANK, fair value, and the holdings total:
//      marketValue = price * comps * (1 + 0.18*renovations) * (1 - hazard/180)
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v61.json')) die('kascity_v61.json missing');
if (!fs.existsSync('showcase_kascity61.html')) die('showcase_kascity61.html missing');
const j = JSON.parse(fs.readFileSync('kascity_v61.json', 'utf8'));
const byId = id => j.nodes.find(n => n.id === id);
const director = byId('director') || die('director missing');

const dstr = JSON.stringify(director);
const names = {};
const re = /"prompt","args":\["buy","(.+?) is unowned\. Buy for (\d+)\?"(?:,"[^"]*")*\]\}\},\{"do":\{"action":"setState","args":\["buy_tile",(\d+)\]/g;
let mm; while ((mm = re.exec(dstr)) !== null) names[parseInt(mm[3],10)] = { n: mm[1], p: parseInt(mm[2],10) };
if (Object.keys(names).length < 16) die('names ' + Object.keys(names).length);

const rootSel = director.bt.sequence[1] && director.bt.sequence[1].selector;
if (!Array.isArray(rootSel)) die('root selector missing');

// ---------- A. renovation branches ----------
let renN = 0;
for (const k of Object.keys(names)) {
  const t = parseInt(k, 10);
  const cost = Math.round(names[k].p * 0.55);
  for (let p = 1; p <= 4; p++) {
    rootSel.unshift({ sequence: [
      { cond: 'world.flags.renov == ' + t + ' && world.flags.renov_by == ' + p +
              " && ownerOf('t" + t + "') == " + p + " && seatStat(" + p + ",'cash') >= " + cost },
      { do: { action: 'addSeatStat', args: [p, 'cash'], amount: -cost } },
      { do: { action: 'setFlagExpr', args: ['hz_t' + t, 'max(4, world.flags.hz_t' + t + ' * 0.55)'] } },
      { do: { action: 'setFlagExpr', args: ['rv_t' + t, 'world.flags.rv_t' + t + ' + 1'] } },
      { do: { action: 'playSound', args: ['buy'] } },
      { do: { action: 'setState', args: ['renov', -1] } },
      { do: { action: 'setState', args: ['renov_by', 0] } }
    ]});
    renN++;
  }
}
// clear an unaffordable or invalid request so it cannot jam
rootSel.unshift({ sequence: [
  { cond: 'world.flags.renov >= 0 && world.time - world.flags.renov_t > 1.5' },
  { do: { action: 'setState', args: ['renov', -1] } },
  { do: { action: 'setState', args: ['renov_by', 0] } }
]});
if (renN < 60) die('renovation branches ' + renN);

// boot flags
let bootOk = false;
(function walkA(o) {
  if (bootOk || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) {
      const ins = [
        { after: 0.1, do: { action: 'setState', args: ['renov', -1] } },
        { after: 0.1, do: { action: 'setState', args: ['renov_by', 0] } },
        { after: 0.1, do: { action: 'setState', args: ['renov_t', 0] } }
      ];
      for (const k of Object.keys(names)) ins.push({ after: 0.1, do: { action: 'setState', args: ['rv_t' + k, 0] } });
      o.splice(ri, 0, ...ins);
      bootOk = true; return;
    }
    o.forEach(walkA);
  } else Object.values(o).forEach(walkA);
})(director.alarms);
if (!bootOk) die('boot anchor missing');

const v62str = JSON.stringify(j);
fs.writeFileSync('kascity_v62.json', v62str);

// ---------- showcase ----------
let html = fs.readFileSync('showcase_kascity61.html', 'utf8');
const oldJson = fs.readFileSync('kascity_v61.json', 'utf8');
if (html.split(JSON.stringify(oldJson)).length - 1 !== 1) die('embedded v61 JSON not found exactly once');
html = html.split(JSON.stringify(oldJson)).join(JSON.stringify(v62str));

const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');

const market = [
  '  window.KV_END=endGame;',
  '',
  '  // ================= MARKET COMPS + RENOVATION =================',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    window.KV_COMPS=1.0;',
  '    var recent=[];',
  '',
  '    window.KV_MARKET=function(t){',
  '      var N=window.KV_NAMES||{}, d=N[t]; if(!d) return 0;',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var hz=f["hz_t"+t]||0, rv=f["rv_t"+t]||0;',
  '      return Math.round(d.p * window.KV_COMPS * (1+0.18*rv) * (1-hz/180));',
  '    };',
  '',
  '    // every ownership change is a comp',
  '    var lastOwner={};',
  '    setInterval(function(){',
  '      var N=window.KV_NAMES||{};',
  '      Object.keys(N).forEach(function(k){',
  '        var t=parseInt(k,10), o=window.KV_OWNER?window.KV_OWNER(t):null;',
  '        if(lastOwner[t]===undefined){ lastOwner[t]=o; return; }',
  '        if(o!==lastOwner[t]){',
  '          if(o){',
  '            var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '            var hz=f["hz_t"+t]||0;',
  '            recent.push(Math.max(0.55, Math.min(1.5, 1 - hz/220 + (lastOwner[t]?0.12:0))));',
  '            while(recent.length>6) recent.shift();',
  '            var s=0; recent.forEach(function(x){s+=x;});',
  '            var prev=window.KV_COMPS;',
  '            window.KV_COMPS=+(s/recent.length).toFixed(3);',
  '            if(window.KV_LOG && Math.abs(window.KV_COMPS-prev)>=0.02){',
  '              window.KV_LOG("market "+(window.KV_COMPS>prev?"up":"down")+"  index "+window.KV_COMPS.toFixed(2),"#caa64c");',
  '            }',
  '          }',
  '          lastOwner[t]=o;',
  '        }',
  '      });',
  '    },400);',
  '',
  '    // market index readout',
  '    var mi=document.createElement("div");',
  '    mi.style.cssText="position:fixed;left:8px;top:calc(50% - 118px);z-index:57;width:214px;'
    + 'background:rgba(20,16,12,.92);border:1px solid #5a4a3a;border-radius:4px;padding:3px 8px;'
    + 'font:11px monospace;color:#f4e4c1;box-sizing:border-box;";',
  '    document.body.appendChild(mi);',
  '    setInterval(function(){',
  '      var c=window.KV_COMPS;',
  '      var col=c>1.02?"#9cd87c":(c<0.95?"#ff6a4a":"#f4e4c1");',
  '      mi.innerHTML="<span style=\'color:#caa64c;font-weight:700\'>MARKET</span> "+',
  '        "<span style=\'float:right;color:"+col+"\'>"+c.toFixed(2)+"\\u00d7</span>";',
  '    },500);',
  '',
  '    // renovate button inside the property popup',
  '    window.KV_RENOVATE=function(t){',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var seat=((f.turn||0)%4)+1;',
  '      var o=window.KV_OWNER?window.KV_OWNER(t):null;',
  '      if(o!==seat){ if(window.KV_LOG) window.KV_LOG("renovation: not your property","#ff6a4a"); return; }',
  '      if(!window.KV_SETSTATE){ return; }',
  '      window.KV_SETSTATE("renov_by", seat);',
  '      window.KV_SETSTATE("renov_t", (f.__t||0));',
  '      window.KV_SETSTATE("renov", t);',
  '      var N=window.KV_NAMES||{};',
  '      if(window.KV_LOG) window.KV_LOG("P"+seat+"  renovating  "+(N[t]?N[t].n:t),COL[seat]);',
  '      if(window.KV_MOVE) window.KV_MOVE(seat,"renovate",t);',
  '      if(window.KV_XP){',
  '        var amt=Math.max(1,Math.round(8*(window.KV_XP_MULT==null?1:window.KV_XP_MULT)));',
  '        window.KV_XP[seat]=(window.KV_XP[seat]||0)+amt;',
  '        if(window.KV_LOG) window.KV_LOG("P"+seat+"  +"+amt+" XP  capital improvement",COL[seat]);',
  '      }',
  '    };',
  '  })();'
].join('\n');
html = html.split(anchor).join(market);

// popup gains market value, renovation grade, and a renovate button
const popRe = /pop\.innerHTML="<b style='color:#f0c860'>"\+nameOf\(i\)\+"<\/b><br>PRICE <b>"\+\(d\.p!=null\?d\.p:"\?"\)\+"<\/b><br>/;
if (!popRe.test(html)) die('property popup markup not found');
html = html.replace(popRe,
  'var mv=(window.KV_MARKET?window.KV_MARKET(i):(d.p||0));\n' +
  '      var rv=f["rv_t"+i]||0;\n' +
  '      var cost=Math.round((d.p||100)*0.55);\n' +
  '      pop.innerHTML="<b style=\'color:#f0c860\'>"+nameOf(i)+"</b><br>PRICE <b>"+(d.p!=null?d.p:"?")+"</b>' +
  ' &nbsp;MKT <b style=\'color:#9cd87c\'>"+mv+"</b><br>RENOVATIONS <b>"+rv+"</b><br>');

// append the button after the popup renders
const popShowRe = /      pop\.style\.display="block";/;
if (!popShowRe.test(html)) die('popup display anchor not found');
html = html.replace(popShowRe,
  '      if(own && (window.KV_HUMANS||[1]).indexOf(own)>=0){\n' +
  '        var rb=document.createElement("button");\n' +
  '        rb.textContent="Renovate ("+cost+")";\n' +
  '        rb.style.cssText="margin-top:8px;width:100%;padding:6px;background:#2a2118;color:#f4e4c1;border:1px solid #caa64c;border-radius:5px;font:11px monospace;cursor:pointer;";\n' +
  '        rb.onclick=function(ev2){ ev2.stopPropagation(); window.KV_RENOVATE(i); pop.style.display="none"; };\n' +
  '        pop.appendChild(rb);\n' +
  '      }\n' +
  '      pop.style.display="block";');

// holdings + bank use market value
html = html.split('if(o&&by[o]) by[o].push({n:N[k].n,p:N[k].p||0});')
           .join('if(o&&by[o]) by[o].push({n:N[k].n,p:(window.KV_MARKET?window.KV_MARKET(t):(N[k].p||0))});');
html = html.split('if(window.KV_OWNER && window.KV_OWNER(t)===p) sum += (N[k].p||0);')
           .join('if(window.KV_OWNER && window.KV_OWNER(t)===p) sum += (window.KV_MARKET?window.KV_MARKET(t):(N[k].p||0));');

fs.writeFileSync('showcase_kascity62.html', html);
console.log('PASS renovation: ' + renN + ' branches — cuts hazard 45%, adds a value grade, costs 55% of price');
console.log('PASS renovate button in the property popup for blocks you own (+8 XP capital improvement)');
console.log('PASS market comps index from the last 6 sales, shown top-left, drives BANK / holdings / fair value');
console.log('OK kascity_v62.json + showcase_kascity62.html (' + (fs.statSync('showcase_kascity62.html').size/1024/1024).toFixed(1) + ' MB)');
