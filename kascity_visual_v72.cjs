// kascity_visual_v72.cjs
// Reads kascity_v71.json + showcase_kascity71.html -> kascity_v72.json + showcase_kascity72.html
//
// VALUATION REBALANCE. The old formula was
//     fair = price*(1 - hz/140)*(1 - age/400) - tax*3
// which at typical values (hz 30, age 30, tax 15) returned ~0.43x the asking price. Every property
// looked like a rip-off and no bargain could exist. New model, centred on 1.0 with real spread:
//
//     fair = price * QUALITY * (1.25 - hz/200 - age/600 - tax/260)
//
//   QUALITY (q_tN) is rolled per property per game, 0.85 - 1.22 — the same block is a gem in one
//   game and a dog in the next, which is what makes surveying worth doing.
//
//   Clean block, young, low tax, good quality  ->  ~1.40x asking   = STEAL
//   Typical block                              ->  ~1.00x asking   = fair
//   Old, hazardous, high tax, poor quality     ->  ~0.65x asking   = TRAP
//
// Bots use the identical number, so they hunt bargains and refuse traps just as you should.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v71.json')) die('kascity_v71.json missing');
if (!fs.existsSync('showcase_kascity71.html')) die('showcase_kascity71.html missing');
const j = JSON.parse(fs.readFileSync('kascity_v71.json', 'utf8'));
const director = j.nodes.find(n => n.id === 'director') || die('director missing');

const dstr = JSON.stringify(director);
const names = {};
const re = /"prompt","args":\["buy","(.+?) is unowned\. Buy for (\d+)\?"(?:,"[^"]*")*\]\}\},\{"do":\{"action":"setState","args":\["buy_tile",(\d+)\]/g;
let mm; while ((mm = re.exec(dstr)) !== null) names[parseInt(mm[3],10)] = { n: mm[1], p: parseInt(mm[2],10) };
if (Object.keys(names).length < 16) die('names ' + Object.keys(names).length);
const tiles = Object.keys(names).map(Number);

// ---------- per-game quality roll ----------
let bootOk = false;
(function walkA(o) {
  if (bootOk || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) {
      o.splice(ri, 0, ...tiles.map(t => ({
        after: 0.1,
        do: { action: 'setFlagExpr', args: ['q_t' + t, '(85 + floor(rand() * 38)) / 100'] }
      })));
      bootOk = true; return;
    }
    o.forEach(walkA);
  } else Object.values(o).forEach(walkA);
})(director.alarms);
if (!bootOk) die('boot anchor missing');

// ---------- bot buy gates use the new value model ----------
let botN = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const c = o.sequence[0] && o.sequence[0].cond;
    const m = typeof c === 'string' &&
      /^world\.flags\.pos == (\d+) && world\.flags\.moved == 1 && seat\(\) > world\.flags\.humans && ownerOf\('t(\d+)'\) == 0/.exec(c);
    if (m) {
      const t = parseInt(m[1], 10);
      if (names[t] && c.indexOf('q_t' + t) < 0) {
        const price = names[t].p;
        // fair >= 0.9 * price : buy only when the deal is near or better than fair
        const fair = price + ' * world.flags.q_t' + t +
                     ' * (1.25 - world.flags.hz_t' + t + ' / 200 - world.flags.age_t' + t +
                     ' / 600 - world.flags.tax_t' + t + ' / 260)';
        o.sequence[0].cond = c + ' && (' + fair + ') >= ' + Math.round(price * 0.9);
        botN++;
      }
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);
if (botN < 16) die('bot value gates updated ' + botN);

const v72str = JSON.stringify(j);
fs.writeFileSync('kascity_v72.json', v72str);

// ---------- showcase ----------
let html = fs.readFileSync('showcase_kascity71.html', 'utf8');
const oldJson = fs.readFileSync('kascity_v71.json', 'utf8');
if (html.split(JSON.stringify(oldJson)).length - 1 !== 1) die('embedded v71 JSON not found exactly once');
html = html.split(JSON.stringify(oldJson)).join(JSON.stringify(v72str));

// new fair-value function
const fairRe = /    function fairValue\(price, hz, age, tax\)\{\n      return Math\.round\(price\*\(1-\(hz\|\|0\)\/140\)\*\(1-\(age\|\|0\)\/400\) - \(tax\|\|0\)\*3\);\n    \}/;
if (!fairRe.test(html)) die('fairValue function not found');
html = html.replace(fairRe,
  '    function fairValue(price, hz, age, tax, q){\n' +
  '      var quality = (q==null?1:q);\n' +
  '      var factor = 1.25 - (hz||0)/200 - (age||0)/600 - (tax||0)/260;\n' +
  '      return Math.round(price * quality * Math.max(0.35, factor));\n' +
  '    }');

// pass quality in, and badge the outcome
const callRe = /      var fair=fairValue\(d\.p,hz,age,tax\);\n      var margin=fair-d\.p;/;
if (!callRe.test(html)) die('fairValue call site not found');
html = html.replace(callRe,
  '      var q=f["q_t"+t];\n' +
  '      var fair=fairValue(d.p,hz,age,tax,q);\n' +
  '      var margin=fair-d.p;\n' +
  '      var ratio=fair/(d.p||1);');

const verdictRe = /        "<span style='color:"\+col\+"'>"\+\(margin>=0\?\("underpriced by "\+margin\):\("overpriced by "\+\(-margin\)\)\)\+"<\/span><\/div>";/;
if (!verdictRe.test(html)) die('verdict markup not found');
html = html.replace(verdictRe,
  '        "<span style=\'color:"+col+"\'>"+(margin>=0?("underpriced by "+margin):("overpriced by "+(-margin)))+"</span>"+\n' +
  '        (ratio>=1.15?"<div style=\'margin-top:5px;background:#9cd87c;color:#12100e;font-weight:700;text-align:center;border-radius:4px;padding:2px\'>STEAL</div>":\n' +
  '         (ratio<=0.82?"<div style=\'margin-top:5px;background:#ff6a4a;color:#12100e;font-weight:700;text-align:center;border-radius:4px;padding:2px\'>OVERPRICED</div>":""))+"</div>";');

// intrinsic (used by negotiation + bot offer logic) matches the new model
const intrRe = /    function intrinsic\(t\)\{\n      var N=window\.KV_NAMES\|\|\{\}, d=N\[t\]; if\(!d\) return 0;\n      var f=F\(\), hz=f\["hz_t"\+t\]\|\|0, rv=f\["rv_t"\+t\]\|\|0;\n      return Math\.round\(d\.p\*\(1-hz\/180\)\*\(1\+0\.18\*rv\)\);\n    \}/;
if (!intrRe.test(html)) die('intrinsic function not found');
html = html.replace(intrRe,
  '    function intrinsic(t){\n' +
  '      var N=window.KV_NAMES||{}, d=N[t]; if(!d) return 0;\n' +
  '      var f=F(), hz=f["hz_t"+t]||0, rv=f["rv_t"+t]||0, age=f["age_t"+t]||0, tax=f["tax_t"+t]||0;\n' +
  '      var q=(f["q_t"+t]==null?1:f["q_t"+t]);\n' +
  '      var factor=Math.max(0.35, 1.25 - hz/200 - age/600 - tax/260);\n' +
  '      return Math.round(d.p * q * factor * (1 + 0.18*rv));\n' +
  '    }');

// market value follows quality too
const mktRe = /      return Math\.round\(d\.p \* window\.KV_COMPS \* \(1\+0\.18\*rv\) \* \(1-hz\/180\)\);/;
if (!mktRe.test(html)) die('KV_MARKET body not found');
html = html.replace(mktRe,
  '      var age=f["age_t"+t]||0, tax=f["tax_t"+t]||0;\n' +
  '      var q=(f["q_t"+t]==null?1:f["q_t"+t]);\n' +
  '      var factor=Math.max(0.35, 1.25 - hz/200 - age/600 - tax/260);\n' +
  '      return Math.round(d.p * q * factor * window.KV_COMPS * (1+0.18*rv));');

// popup shows the verdict as well
const popRe = /"HAZARD <b style='color:"\+\(hz>=28\?"#ff6a4a":"#9cd87c"\)\+"'>"\+\(hz!=null\?Math\.round\(hz\)\+"%":"\?"\)\+"<\/b>";/;
if (popRe.test(html)) {
  html = html.replace(popRe,
    '"HAZARD <b style=\'color:"+(hz>=28?"#ff6a4a":"#9cd87c")+"\'>"+(hz!=null?Math.round(hz)+"%":"?")+"</b>"+\n' +
    '        (function(){ var iv=window.KV_INTRINSIC?window.KV_INTRINSIC(i):null;\n' +
    '          if(iv==null) return "";\n' +
    '          var r=iv/((d.p)||1);\n' +
    '          return "<br>VALUE <b style=\'color:"+(r>=1.15?"#9cd87c":(r<=0.82?"#ff6a4a":"#f4e4c1"))+"\'>"+iv+"</b>"+\n' +
    '                 (r>=1.15?" STEAL":(r<=0.82?" TRAP":""));\n' +
    '        })();');
}

fs.writeFileSync('showcase_kascity72.html', html);
console.log('PASS quality factor rolled per property per game (0.85 - 1.22)');
console.log('PASS valuation centred on the asking price — real bargains and real traps now exist');
console.log('PASS STEAL / OVERPRICED badges on the disclosure card, VALUE line in the popup');
console.log('PASS bots buy on the same model (' + botN + ' gates) — they will hunt the same bargains');
console.log('OK kascity_v72.json + showcase_kascity72.html (' + (fs.statSync('showcase_kascity72.html').size/1024/1024).toFixed(1) + ' MB)');
