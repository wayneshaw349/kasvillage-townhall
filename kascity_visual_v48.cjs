// kascity_visual_v48.cjs   — TWO-PLAYER (hotseat) + CO-SIGNED RESULT
// Reads kascity_v47.json + showcase_kascity47.html -> kascity_v48.json + showcase_kascity48.html
//
// 1) HOTSEAT: seat 2 becomes human. Its bot branches are disabled (auto-roll, auto-buy, auto-decline),
//    so seat 2 gets the same prompts seat 1 does. Seats 3 and 4 stay as bots.
// 2) TURN HANDOFF: a full-width banner names whose turn it is so two people sharing a screen know
//    who should be touching it.
// 3) FULL XP RATE: multiplayer has a real counterparty, so no solo discount.
// 4) CO-SIGNED PAYLOAD: mode "p2p" — both human seats must confirm the moveRoot before the result is
//    marked signable. Mutual attestation, same shape as a FROST agreement: if either refuses, the
//    result is emitted unsigned and earns nothing.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
for (const f of ['kascity_v47.json', 'showcase_kascity47.html']) if (!fs.existsSync(f)) die(f + ' missing');
const j = JSON.parse(fs.readFileSync('kascity_v47.json', 'utf8'));
const director = j.nodes.find(n => n.id === 'director') || die('director missing');

// ---------- 1. free seat 2 from the bots ----------
let botOff = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const c0 = o.sequence[0] && o.sequence[0].cond;
    if (typeof c0 === 'string' && c0.indexOf('seat() != 1') >= 0) {
      // bot logic now applies to seats 3 and 4 only
      o.sequence[0].cond = c0.split('seat() != 1').join('(seat() != 1 && seat() != 2)');
      botOff++;
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);
if (botOff < 20) die('bot conditions narrowed ' + botOff + ' (<20)');

// human prompts must now fire for seat 1 AND seat 2
let promptOn = 0;
(function walk2(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const c0 = o.sequence[0] && o.sequence[0].cond;
    if (typeof c0 === 'string' && c0.indexOf('seat() == 1') >= 0) {
      o.sequence[0].cond = c0.split('seat() == 1').join('(seat() == 1 || seat() == 2)');
      promptOn++;
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk2(v);
})(director.bt);
if (promptOn < 1) die('human prompt branches ' + promptOn);

const v48str = JSON.stringify(j);
fs.writeFileSync('kascity_v48.json', v48str);

// ---------- 2. showcase: mode, turn banner, co-sign ----------
let html = fs.readFileSync('showcase_kascity47.html', 'utf8');

const modeAnchor = 'window.KV_MODE = "solo";';
if (html.split(modeAnchor).length - 1 !== 1) die('mode anchor not found');
html = html.split(modeAnchor).join('window.KV_MODE = "p2p";\nwindow.KV_HUMANS = [1,2];');

// scene JSON swap
const oldJson = fs.readFileSync('kascity_v47.json', 'utf8');
if (html.split(JSON.stringify(oldJson)).length - 1 !== 1) die('embedded v47 JSON not found exactly once');
html = html.split(JSON.stringify(oldJson)).join(JSON.stringify(v48str));

// turn banner + co-sign UI
const tailAnchor = '  window.KV_END=endGame;';
if (html.split(tailAnchor).length - 1 !== 1) die('endGame anchor not found');
const extra = [
  '  window.KV_END=endGame;',
  '',
  '  // ---- whose turn (hotseat handoff) ----',
  '  (function(){',
  '    var COL2={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    var tb=document.createElement("div");',
  '    tb.style.cssText="position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:59;padding:5px 22px;border-radius:5px;font:900 15px monospace;letter-spacing:2px;color:#12100e;box-shadow:0 2px 10px rgba(0,0,0,.5);";',
  '    document.body.appendChild(tb);',
  '    var lastSeat=null;',
  '    setInterval(function(){',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var s=((f.turn||0)%4)+1;',
  '      if(s===lastSeat)return; lastSeat=s;',
  '      var human=(window.KV_HUMANS||[]).indexOf(s)>=0;',
  '      tb.textContent = human ? ("PLAYER "+s+" — YOUR TURN") : ("P"+s+" thinking…");',
  '      tb.style.background=COL2[s]||"#f4e4c1";',
  '      tb.style.opacity = human ? 1 : 0.72;',
  '    },300);',
  '  })();',
  '',
  '  // ---- co-signing: both humans confirm the moveRoot or the result earns nothing ----',
  '  window.KV_SIGS={};',
  '  window.KV_COSIGN=function(){',
  '    var box=document.createElement("div");',
  '    box.style.cssText="position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:72;background:#14100c;border:1px solid #caa64c;border-radius:8px;padding:10px 16px;font:12px monospace;color:#f4e4c1;text-align:center;";',
  '    box.innerHTML="<b>CONFIRM RESULT</b><br><span style=\'opacity:.7\'>both players must agree to the move root</span><br>";',
  '    (window.KV_HUMANS||[1,2]).forEach(function(p){',
  '      var b=document.createElement("button");',
  '      b.textContent="P"+p+" confirm";',
  '      b.style.cssText="margin:8px 5px 0;padding:6px 14px;background:#2a2118;color:#f4e4c1;border:1px solid #5a4a3a;border-radius:5px;font:12px monospace;cursor:pointer;";',
  '      b.onclick=function(){',
  '        window.KV_SIGS[p]={ wallet:(window.KV_WALLETS&&window.KV_WALLETS[p])||null, at:new Date().toISOString() };',
  '        b.textContent="P"+p+" \\u2713"; b.disabled=true; b.style.opacity=.6;',
  '        var need=(window.KV_HUMANS||[1,2]);',
  '        var all=need.every(function(q){return window.KV_SIGS[q];});',
  '        if(all&&window.KV_RESULT){',
  '          window.KV_RESULT.signatures=window.KV_SIGS;',
  '          window.KV_RESULT.signed=true;',
  '          window.KV_LOG("result co-signed — XP claimable","#9cd87c");',
  '          box.innerHTML="<b style=\'color:#9cd87c\'>CO-SIGNED \\u2713</b><br><span style=\'opacity:.7\'>result is claimable</span>";',
  '        }',
  '      };',
  '      box.appendChild(b);',
  '    });',
  '    document.body.appendChild(box);',
  '  };'
].join('\n');
html = html.split(tailAnchor).join(extra);

// trigger co-sign at the final bell
const bellAnchor = 'log("FINAL BELL — moveRoot "+chain.slice(0,16)+"…","#f0c860");';
if (html.split(bellAnchor).length - 1 !== 1) die('final bell anchor not found');
html = html.split(bellAnchor).join(bellAnchor + '\n    window.KV_RESULT.signed=false;\n    if(window.KV_COSIGN) window.KV_COSIGN();');

// full XP rate in p2p
const multAnchor = 'var SOLO_MULT = 0.4;';
if (html.split(multAnchor).length - 1 !== 1) die('solo mult anchor not found');
html = html.split(multAnchor).join('var SOLO_MULT = (window.KV_MODE === "solo") ? 0.4 : 1.0;');

fs.writeFileSync('showcase_kascity48.html', html);
console.log('PASS seat 2 freed from bot control (' + botOff + ' conditions narrowed to seats 3-4)');
console.log('PASS human prompts extended to seats 1 and 2 (' + promptOn + ' branches)');
console.log('PASS turn banner for hotseat handoff');
console.log('PASS co-sign gate: both humans confirm moveRoot or result stays unsigned');
console.log('PASS full XP rate in p2p mode (no solo discount)');
console.log('OK kascity_v48.json + showcase_kascity48.html (' + (fs.statSync('showcase_kascity48.html').size/1024/1024).toFixed(1) + ' MB)');
