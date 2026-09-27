// kascity_visual_v73.cjs
// Reads kascity_v72.json + showcase_kascity72.html -> kascity_v73.json + showcase_kascity73.html
//
// BOTS AS DEVELOPERS. Each bot turn they now run the same arithmetic a landlord would:
//
//   current  = P * q * (1.32 - hz/120      - age/600 - tax/260) * (1 + 0.12*rv)
//   improved = P * q * (1.32 - hz*0.45/120 - age/600 - tax/260) * (1 + 0.12*(rv+1))
//   cost     = 0.25 * P
//   (retuned: at the old numbers renovation NEVER cleared its cost, so nobody would ever do it)
//
//   RENOVATE when   improved - current > cost * 1.2      (the work clears a 20% margin)
//                   and cash covers the job with 150 spare, and grade < 3
//   Note age never improves — an old block has a permanent drag, so renovation pays best on
//   young, hazardous property. That is the judgement the algorithm now makes.
//
//   LIST FOR SALE when they have improved it and the market will pay: asking = improved * 1.12,
//   or when they are cash-starved, asking = improved * 0.92 (a distressed listing).
//   Listings show on the board as FOR SALE with a Buy now button.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v72.json')) die('kascity_v72.json missing');
if (!fs.existsSync('showcase_kascity72.html')) die('showcase_kascity72.html missing');
const j = JSON.parse(fs.readFileSync('kascity_v72.json', 'utf8'));
const director = j.nodes.find(n => n.id === 'director') || die('director missing');
const rootSel = director.bt.sequence[1] && director.bt.sequence[1].selector;
if (!Array.isArray(rootSel)) die('root selector missing');

const dstr = JSON.stringify(director);
const names = {};
const re = /"prompt","args":\["buy","(.+?) is unowned\. Buy for (\d+)\?"(?:,"[^"]*")*\]\}\},\{"do":\{"action":"setState","args":\["buy_tile",(\d+)\]/g;
let mm; while ((mm = re.exec(dstr)) !== null) names[parseInt(mm[3],10)] = { n: mm[1], p: parseInt(mm[2],10) };
if (Object.keys(names).length < 16) die('names ' + Object.keys(names).length);
const tiles = Object.keys(names).map(Number);

function valExpr(t, P, hzExpr, rvExpr) {
  return P + ' * world.flags.q_t' + t +
         ' * (1.32 - ' + hzExpr + ' / 120 - world.flags.age_t' + t + ' / 600 - world.flags.tax_t' + t + ' / 260)' +
         ' * (1 + 0.12 * ' + rvExpr + ')';
}

// ---------- retune the existing renovation work branches ----------
let fixCost = 0;
(function walkR(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const c = o.sequence[0] && o.sequence[0].cond;
    const m = typeof c === 'string' && /^world\.flags\.renov == (\d+) && world\.flags\.renov_by == (\d)/.exec(c);
    if (m) {
      const tt = parseInt(m[1], 10);
      const pp = names[tt] ? names[tt].p : 100;
      const newCost = Math.round(pp * 0.25);
      o.sequence[0].cond = c.replace(/'cash'\) >= \d+/, "'cash') >= " + newCost);
      for (const step of o.sequence) {
        if (step && step.do && step.do.action === 'addSeatStat' && step.do.args && step.do.args[1] === 'cash'
            && typeof step.do.amount === 'number' && step.do.amount < 0) {
          step.do.amount = -newCost;
        }
        if (step && step.do && step.do.action === 'setFlagExpr' && step.do.args
            && step.do.args[0] === 'hz_t' + tt) {
          step.do.args[1] = 'max(4, world.flags.hz_t' + tt + ' * 0.45)';
        }
      }
      fixCost++;
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walkR(v);
})(director.bt);
if (fixCost < 60) die('renovation work branches retuned ' + fixCost);

let renN = 0, lstN = 0;
for (const t of tiles) {
  const P = names[t].p;
  const cost = Math.round(P * 0.25);
  const cur  = valExpr(t, P, 'world.flags.hz_t' + t, 'world.flags.rv_t' + t);
  const post = valExpr(t, P, 'world.flags.hz_t' + t + ' * 0.45', '(world.flags.rv_t' + t + ' + 1)');

  for (let p = 1; p <= 4; p++) {
    // --- renovate when the uplift clears the cost with margin ---
    rootSel.unshift({ sequence: [
      { cond: 'world.flags.renov == -1 && world.flags.tr_state == 0' +
              ' && seat() > world.flags.humans && seat() == ' + p +
              " && ownerOf('t" + t + "') == " + p +
              ' && world.flags.rv_t' + t + ' < 3' +
              " && seatStat(" + p + ",'cash') >= " + (cost + 150) +
              ' && ((' + post + ') - (' + cur + ')) > ' + Math.round(cost * 1.2) },
      { do: { action: 'setState', args: ['renov_by', p] } },
      { do: { action: 'setState', args: ['renov_t', 0] } },
      { do: { action: 'setState', args: ['renov', t] } }
    ]});
    renN++;

    // --- list an improved block at a premium ---
    rootSel.unshift({ sequence: [
      { cond: 'world.flags.ls_t' + t + ' == 0 && seat() > world.flags.humans && seat() == ' + p +
              " && ownerOf('t" + t + "') == " + p +
              ' && world.flags.rv_t' + t + ' >= 1' +
              " && seatStat(" + p + ",'cash') < " + (P * 3) },
      { do: { action: 'setFlagExpr', args: ['lp_t' + t, '(' + cur + ') * 1.12'] } },
      { do: { action: 'setState', args: ['ls_t' + t, 1] } }
    ]});
    lstN++;

    // --- distressed listing: cash-starved, debt-heavy ---
    rootSel.unshift({ sequence: [
      { cond: 'world.flags.ls_t' + t + ' == 0 && seat() > world.flags.humans && seat() == ' + p +
              " && ownerOf('t" + t + "') == " + p +
              " && seatStat(" + p + ",'cash') < 180 && seatStat(" + p + ",'mort') > 250" },
      { do: { action: 'setFlagExpr', args: ['lp_t' + t, '(' + cur + ') * 0.92'] } },
      { do: { action: 'setState', args: ['ls_t' + t, 1] } }
    ]});
    lstN++;
  }

  // clear the listing if the block changes hands
  rootSel.push({ sequence: [
    { cond: 'world.flags.ls_t' + t + " == 1 && ownerOf('t" + t + "') == 0" },
    { do: { action: 'setState', args: ['ls_t' + t, 0] } }
  ]});
}
if (renN < 60) die('bot renovation branches ' + renN);
if (lstN < 120) die('listing branches ' + lstN);

// boot the listing flags
let bootOk = false;
(function walkA(o) {
  if (bootOk || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) {
      const ins = [];
      for (const t of tiles) {
        ins.push({ after: 0.1, do: { action: 'setState', args: ['ls_t' + t, 0] } });
        ins.push({ after: 0.1, do: { action: 'setState', args: ['lp_t' + t, 0] } });
      }
      o.splice(ri, 0, ...ins);
      bootOk = true; return;
    }
    o.forEach(walkA);
  } else Object.values(o).forEach(walkA);
})(director.alarms);
if (!bootOk) die('boot anchor missing');

const v73str = JSON.stringify(j);
fs.writeFileSync('kascity_v73.json', v73str);

// ---------- showcase ----------
let html = fs.readFileSync('showcase_kascity72.html', 'utf8');
const oldJson = fs.readFileSync('kascity_v72.json', 'utf8');
if (html.split(JSON.stringify(oldJson)).length - 1 !== 1) die('embedded v72 JSON not found exactly once');
html = html.split(JSON.stringify(oldJson)).join(JSON.stringify(v73str));

const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');
html = html.split(anchor).join([
  '  window.KV_END=endGame;',
  '',
  '  // ================= LISTINGS =================',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    function F(){ return (window.KV_FLAGS&&window.KV_FLAGS())||{}; }',
  '    var seen={};',
  '    setInterval(function(){',
  '      var f=F(), N=window.KV_NAMES||{};',
  '      Object.keys(N).forEach(function(k){',
  '        var on=Math.round(f["ls_t"+k]||0);',
  '        if(seen[k]===on) return;',
  '        seen[k]=on;',
  '        if(on===1){',
  '          var o=window.KV_OWNER?window.KV_OWNER(parseInt(k,10)):null;',
  '          var ask=Math.round(f["lp_t"+k]||0);',
  '          var rv=Math.round(f["rv_t"+k]||0);',
  '          if(o&&window.KV_LOG) window.KV_LOG("P"+o+"  LISTS  "+N[k].n+"  at "+ask+(rv?"  (renovated)":"  (needs cash)"), COL[o]);',
  '        }',
  '      });',
  '    }, 500);',
  '',
  '    // FOR SALE tag on the board label',
  '    window.KV_LISTED=function(t){ var f=F(); return Math.round(f["ls_t"+t]||0)===1 ? Math.round(f["lp_t"+t]||0) : 0; };',
  '  })();'
].join('\n'));

// board label carries the listing (anchor on the label textContent assignment)
const labRe = /if\(lab\[i\]\.textContent!==want\) lab\[i\]\.textContent=want;/;
if (!labRe.test(html)) die('label textContent line not found — is v70 applied?');
html = html.replace(labRe,
  'if(lab[i].textContent!==want) lab[i].textContent=want;\n' +
  '      var askv=window.KV_LISTED?window.KV_LISTED(i):0;\n' +
  '      if(askv){ lab[i].textContent=want+" \\u00b7 FOR SALE "+askv; lab[i].style.color="#f0c860"; }');

// buy-now button in the popup
const negRe = /        ob\.textContent="Negotiate\\u2026";/;
if (!negRe.test(html)) die('negotiate button not found');
html = html.replace(negRe,
  '        var askNow=window.KV_LISTED?window.KV_LISTED(i):0;\n' +
  '        ob.textContent = askNow ? ("Buy now ("+askNow+")") : "Negotiate\\u2026";\n' +
  '        if(askNow) ob.style.borderColor="#f0c860";');


// ---------- retune the JS valuation formulas to match ----------
const jsPairs = [
  ['var factor = 1.25 - (hz||0)/200 - (age||0)/600 - (tax||0)/260;',
   'var factor = 1.32 - (hz||0)/120 - (age||0)/600 - (tax||0)/260;'],
  ["var factor=Math.max(0.35, 1.25 - hz/200 - age/600 - tax/260);\n      return Math.round(d.p * q * factor * (1 + 0.18*rv));",
   "var factor=Math.max(0.35, 1.32 - hz/120 - age/600 - tax/260);\n      return Math.round(d.p * q * factor * (1 + 0.12*rv));"],
  ["var factor=Math.max(0.35, 1.25 - hz/200 - age/600 - tax/260);\n      return Math.round(d.p * q * factor * window.KV_COMPS * (1+0.18*rv));",
   "var factor=Math.max(0.35, 1.32 - hz/120 - age/600 - tax/260);\n      return Math.round(d.p * q * factor * window.KV_COMPS * (1+0.12*rv));"],
  ['var cost=Math.round((d.p||100)*0.55);', 'var cost=Math.round((d.p||100)*0.25);']
];
let jsFix = 0;
for (const [a, b] of jsPairs) {
  if (html.indexOf(a) >= 0) { html = html.split(a).join(b); jsFix++; }
}
if (jsFix < 3) die('js formula retunes applied ' + jsFix + ' (<3)');

fs.writeFileSync('showcase_kascity73.html', html);
console.log('PASS renovation retuned: cost 0.25P, hazard -55%, grade +12% (' + fixCost + ' work branches)');
console.log('PASS ' + renN + ' bot renovation-ROI branches: they renovate only when uplift beats cost by 20%');
console.log('PASS age is a permanent drag — bots correctly favour young hazardous blocks for improvement');
console.log('PASS ' + lstN + ' listing branches: premium listing after improving, distressed listing when short of cash');
console.log('PASS FOR SALE shown on the board with asking price, Buy now in the popup, listings narrated');
console.log('PASS ' + jsFix + ' JS valuation formulas retuned to match');
console.log('OK kascity_v73.json + showcase_kascity73.html (' + (fs.statSync('showcase_kascity73.html').size/1024/1024).toFixed(1) + ' MB)');
