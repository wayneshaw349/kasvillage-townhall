// kascity_visual_v86.cjs
// Reads kascity_v85.json + showcase_kascity85.html -> kascity_v86.json + showcase_kascity86.html
//
// MARKET LOOSENING. With the livelock fixed the triggers finally get turns, but the thresholds are
// still tuned for a wealthier game than 1300 start cash produces. Every gate is relaxed:
//
//   RENOVATE   uplift > cost*1.2  ->  cost*1.0    (any profitable improvement is worth doing)
//              cash >= cost+60    ->  cost+20
//              grade cap rv < 3   ->  rv < 4
//   LIST       cash < 420 gate    ->  cash < 900   (a bot with stock will list without being desperate)
//              distress cash<320  ->  cash < 500,  mort > 120 -> mort > 60
//   BUY LISTED cash >= ask+80     ->  ask+30
//              ask <= valuation   ->  ask <= valuation*1.08  (they will pay slightly over for a fit)
//   OFFERS     bots accept at 82% of valuation when needy -> 76%, and 105% when comfortable -> 98%
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v85.json')) die('kascity_v85.json missing');
if (!fs.existsSync('showcase_kascity85.html')) die('showcase_kascity85.html missing');
const j = JSON.parse(fs.readFileSync('kascity_v85.json', 'utf8'));
const director = j.nodes.find(n => n.id === 'director') || die('director missing');

let renTh = 0, renCash = 0, renCap = 0, lsCash = 0, dsGate = 0, buyCash = 0, buyVal = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const step = o.sequence[0];
    const c = step && step.cond;
    if (typeof c === 'string') {

      // ---- bot renovation trigger ----
      if (c.indexOf('world.flags.renov == -1') === 0 && c.indexOf('seat() > world.flags.humans') >= 0) {
        let n = c;
        // uplift threshold: "> NNN" at the tail of the ROI comparison
        n = n.replace(/\)\) > (\d+)$/, function (_, v) {
          renTh++;
          return ')) > ' + Math.max(5, Math.round(parseInt(v, 10) / 1.2));
        });
        // affordability
        n = n.replace(/'cash'\) >= (\d+)/, function (_, v) {
          renCash++;
          return "'cash') >= " + Math.max(15, parseInt(v, 10) - 40);
        });
        // grade cap
        if (n.indexOf('< 3') >= 0) { n = n.replace(/(world\.flags\.rv_t\d+) < 3/, '$1 < 4'); renCap++; }
        step.cond = n;
      }

      // ---- listing triggers ----
      if (/^world\.flags\.ls_t\d+ == 0 && seat\(\) > world\.flags\.humans/.test(c)) {
        let n = c;
        n = n.replace(/'cash'\) < 420/, "'cash') < 900");
        n = n.replace(/'cash'\) < (\d+)$/, function (_, v) {
          const val = parseInt(v, 10);
          if (val >= 900) return "'cash') < " + val;
          lsCash++;
          return "'cash') < " + Math.round(val * 1.9);
        });
        if (n.indexOf("'cash') < 320") >= 0) {
          n = n.replace("'cash') < 320", "'cash') < 500").replace("'mort') > 120", "'mort') > 60");
          dsGate++;
        }
        step.cond = n;
      }

      // ---- bots buying a listing ----
      if (c.indexOf('world.flags.tr_state == 0 && world.flags.ls_t') === 0) {
        let n = c;
        n = n.replace(/world\.flags\.lp_t(\d+) \+ 80/, function (_, t) { buyCash++; return 'world.flags.lp_t' + t + ' + 30'; });
        n = n.replace(/world\.flags\.lp_t(\d+) <= \(/, function (_, t) { buyVal++; return 'world.flags.lp_t' + t + ' <= 1.08 * ('; });
        step.cond = n;
      }
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);

if (renTh < 60) die('renovation ROI thresholds loosened ' + renTh + ' (<60)');
if (buyCash < 60) die('listing-purchase gates loosened ' + buyCash + ' (<60)');

const v86str = JSON.stringify(j);
fs.writeFileSync('kascity_v86.json', v86str);

// ---------- showcase: offer acceptance thresholds ----------
let html = fs.readFileSync('showcase_kascity85.html', 'utf8');
const oldRaw = fs.readFileSync('kascity_v85.json', 'utf8');
if (html.split(JSON.stringify(oldRaw)).length - 1 !== 1) die('embedded v85 JSON not found exactly once');
html = html.split(JSON.stringify(oldRaw)).join(JSON.stringify(v86str));

const thRe = /var threshold=intr\*\(need\?0\.82:1\.05\);/;
if (!thRe.test(html)) die('offer threshold not found');
html = html.replace(thRe, 'var threshold=intr*(need?0.76:0.98);');

const needRe = /var need=\(theirCash<200\|\|theirMort>300\);/;
if (!needRe.test(html)) die('need test not found');
html = html.replace(needRe, 'var need=(theirCash<380||theirMort>150);');

// market activity readout so you can see whether it is actually moving
const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');
html = html.split(anchor).join([
  '  window.KV_END=endGame;',
  '',
  '  // ---- market activity counter ----',
  '  (function(){',
  '    var box=document.createElement("div");',
  '    box.style.cssText="position:fixed;left:8px;top:120px;z-index:57;width:214px;'
    + 'background:rgba(20,16,12,.92);border:1px solid #5a4a3a;border-radius:4px;padding:3px 8px;'
    + 'font:10px monospace;color:#f4e4c1;box-sizing:border-box;";',
  '    document.body.appendChild(box);',
  '    setInterval(function(){',
  '      var mv=window.KV_MOVES||[];',
  '      var r=0,l=0,t=0;',
  '      mv.forEach(function(m){',
  '        if(m.a==="renovate") r++;',
  '        else if(String(m.a).indexOf("list:")===0) l++;',
  '        else if(m.a==="p2pbuy"||String(m.a).indexOf("bid:")===0) t++;',
  '      });',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var listed=0;',
  '      Object.keys(window.KV_NAMES||{}).forEach(function(k){ if(Math.round(f["ls_t"+k]||0)===1) listed++; });',
  '      box.innerHTML="<span style=\'color:#caa64c;font-weight:700\'>ACTIVITY</span> "+',
  '        "<span style=\'float:right;opacity:.85\'>rv "+r+" \\u00b7 ls "+listed+" \\u00b7 tr "+t+"</span>";',
  '    }, 700);',
  '  })();'
].join('\n'));

fs.writeFileSync('showcase_kascity86.html', html);
console.log('PASS renovation: ROI threshold /1.2 (' + renTh + '), affordability -40 (' + renCash + '), grade cap 4 (' + renCap + ')');
console.log('PASS listings: cash gate widened (' + lsCash + '), distress at cash<500 mort>60 (' + dsGate + ')');
console.log('PASS listing purchases: cash ask+30 (' + buyCash + '), will pay up to 108% of valuation (' + buyVal + ')');
console.log('PASS offers: bots accept from 76% when needy, 98% when comfortable; "needy" widened');
console.log('PASS ACTIVITY readout top-left counts renovations, live listings and trades');
console.log('OK kascity_v86.json + showcase_kascity86.html (' + (fs.statSync('showcase_kascity86.html').size/1024/1024).toFixed(1) + ' MB)');
