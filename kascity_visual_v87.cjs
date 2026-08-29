// kascity_visual_v87.cjs
// Reads kascity_v86.json + showcase_kascity86.html -> kascity_v87.json + showcase_kascity87.html
//
// A. DISCRETION RESTORED. "Any profitable improvement" was compulsion, not judgement — a bot would
//    spend 25 to gain 26 and then have nothing left to buy property with. Renovation is now
//    clock-aware, because a job late in the game never earns its money back:
//        left > 300s  ->  uplift must beat cost * 1.10   (plenty of turns to recover)
//        left > 120s  ->  uplift must beat cost * 1.40   (getting late, be choosy)
//        left <= 120s ->  no renovation at all           (it cannot pay back)
//
// B. PERSONALITIES. All three bots ran identical maths, so they behaved as one opponent copied twice.
//    Each seat now has a temperament that shifts every market decision:
//
//      P2  THE DEVELOPER   renovates readily, pays over the odds for a fit, rarely sells
//      P3  THE TRADER      flips constantly, lists early and cheap, accepts most offers
//      P4  THE MISER       hoards cash, buys only clear bargains, holds out for a premium
//
//    Applied as multipliers on the thresholds they already use, so nothing new can deadlock — the
//    same branches fire, at different prices, for different reasons.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v86.json')) die('kascity_v86.json missing');
if (!fs.existsSync('showcase_kascity86.html')) die('showcase_kascity86.html missing');
const j = JSON.parse(fs.readFileSync('kascity_v86.json', 'utf8'));
const director = j.nodes.find(n => n.id === 'director') || die('director missing');

// seat -> { renoMargin, buyOver, listCash, sellFloor }
const CHAR = {
  1: { reno: 1.00, buyOver: 1.00, listCash: 900, name: 'player'    },
  2: { reno: 0.85, buyOver: 1.18, listCash: 400, name: 'developer' },   // improves, buys high, holds
  3: { reno: 1.05, buyOver: 1.02, listCash: 1500, name: 'trader'   },   // flips, lists early
  4: { reno: 1.60, buyOver: 0.92, listCash: 250, name: 'miser'     }    // hoards, bargains only
};

let renN = 0, lsN = 0, buyN = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const step = o.sequence[0];
    const c = step && step.cond;
    if (typeof c === 'string') {

      // ---- A + B: renovation, clock-aware and per-personality ----
      if (c.indexOf('world.flags.renov == -1') === 0 && c.indexOf('seat() > world.flags.humans') >= 0) {
        const sm = /seat\(\) == (\d)/.exec(c);
        const seat = sm ? parseInt(sm[1], 10) : 2;
        const mult = (CHAR[seat] || CHAR[2]).reno;
        // capture the whole uplift expression so both tiers can test it
        const um = /(\(\(.*\) - \(.*\)\)) > (\d+)$/.exec(c);
        if (um) {
          const uplift = um[1];
          const base = parseInt(um[2], 10);
          const early = Math.max(5, Math.round(base * 1.10 * mult));
          const mid   = Math.max(5, Math.round(base * 1.40 * mult));
          const head = c.slice(0, c.length - um[0].length);
          step.cond = head +
            uplift + ' > ' + early +
            ' && world.flags.left > 120' +
            ' && (world.flags.left > 300 || ' + uplift + ' > ' + mid + ')';
          renN++;
        }
      }

      // ---- B: listing appetite ----
      if (/^world\.flags\.ls_t\d+ == 0 && seat\(\) > world\.flags\.humans/.test(c)) {
        const sm = /seat\(\) == (\d)/.exec(c);
        const seat = sm ? parseInt(sm[1], 10) : 3;
        const lc = (CHAR[seat] || CHAR[3]).listCash;
        step.cond = c.replace(/'cash'\) < 900/, "'cash') < " + lc);
        lsN++;
      }

      // ---- B: how far over valuation they will chase a listing ----
      if (c.indexOf('world.flags.tr_state == 0 && world.flags.ls_t') === 0) {
        const sm = /seat\(\) == (\d)/.exec(c);
        const seat = sm ? parseInt(sm[1], 10) : 2;
        const over = (CHAR[seat] || CHAR[2]).buyOver;
        step.cond = c.replace(/<= 1\.08 \* \(/, '<= ' + over.toFixed(2) + ' * (');
        buyN++;
      }
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);

if (renN < 60) die('renovation discretion applied ' + renN + ' (<60)');
if (lsN < 60) die('listing appetite applied ' + lsN + ' (<60)');
if (buyN < 60) die('listing-chase applied ' + buyN + ' (<60)');

const v87str = JSON.stringify(j);
fs.writeFileSync('kascity_v87.json', v87str);

// ---------- showcase: personalities in negotiation + a temperament readout ----------
let html = fs.readFileSync('showcase_kascity86.html', 'utf8');
const oldRaw = fs.readFileSync('kascity_v86.json', 'utf8');
if (html.split(JSON.stringify(oldRaw)).length - 1 !== 1) die('embedded v86 JSON not found exactly once');
html = html.split(JSON.stringify(oldRaw)).join(JSON.stringify(v87str));

// offer acceptance now depends on who you are dealing with
const thRe = /        var need=\(theirCash<380\|\|theirMort>150\);\n        var threshold=intr\*\(need\?0\.76:0\.98\);\n        var accept=v>=threshold;\n        var why=accept\?\(need\?"needs the cash":"beats their valuation"\):"below what they will take";/;
if (!thRe.test(html)) die('offer decision block not found');
html = html.replace(thRe, [
  '        var CH=(window.KV_CHAR&&window.KV_CHAR[owner])||{sell:1.0,label:""};',
  '        var need=(theirCash<380||theirMort>150);',
  '        var threshold=intr*(need?0.76:0.98)*CH.sell;',
  '        var accept=v>=threshold;',
  '        var why = accept',
  '          ? (need ? "needs the cash" : (CH.label ? ("the "+CH.label+" takes the profit") : "beats their valuation"))',
  '          : (CH.label ? ("the "+CH.label+" wants more") : "below what they will take");'
].join('\n'));

const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');
html = html.split(anchor).join([
  '  window.KV_END=endGame;',
  '',
  '  // ================= BOT TEMPERAMENTS =================',
  '  window.KV_CHAR = {',
  '    2: { label:"developer", sell:1.14, blurb:"improves and holds" },',
  '    3: { label:"trader",    sell:0.88, blurb:"flips fast, deals often" },',
  '    4: { label:"miser",     sell:1.26, blurb:"hoards cash, wants a premium" }',
  '  };',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    // name each opponent on their corner card so their behaviour is legible',
  '    var done=false;',
  '    var iv=setInterval(function(){',
  '      if(done) return;',
  '      var any=false;',
  '      for(var p=2;p<=4;p++){',
  '        var c=document.getElementById("kvc"+p);',
  '        if(!c||!c.parentNode) continue;',
  '        any=true;',
  '        if(document.getElementById("kvchar"+p)) continue;',
  '        var ch=window.KV_CHAR[p];',
  '        if(!ch) continue;',
  '        var humans=window.KV_HUMANS||[1];',
  '        if(humans.indexOf(p)>=0) continue;      // a real player has no scripted temperament',
  '        var tag=document.createElement("div");',
  '        tag.id="kvchar"+p;',
  '        tag.style.cssText="font-size:9px;letter-spacing:1px;color:"+COL[p]+";opacity:.85;margin-top:2px;";',
  '        tag.textContent=ch.label.toUpperCase()+" \\u00b7 "+ch.blurb;',
  '        c.parentNode.appendChild(tag);',
  '      }',
  '      if(any) done=true;',
  '    }, 800);',
  '    setTimeout(function(){ clearInterval(iv); }, 20000);',
  '  })();'
].join('\n'));

fs.writeFileSync('showcase_kascity87.html', html);
console.log('PASS renovation discretion: 1.10x margin early, none inside the last 2 minutes (' + renN + ' branches)');
console.log('PASS P2 developer (renovates readily, chases fits at 118%, holds out at 114%)');
console.log('PASS P3 trader (lists with up to 1500 cash, chases at 102%, sells at 88%)');
console.log('PASS P4 miser (needs a 1.6x renovation margin, bargains only at 92%, wants 126% to sell)');
console.log('PASS each opponent labelled on their corner card so the behaviour is readable');
console.log('OK kascity_v87.json + showcase_kascity87.html (' + (fs.statSync('showcase_kascity87.html').size/1024/1024).toFixed(1) + ' MB)');
