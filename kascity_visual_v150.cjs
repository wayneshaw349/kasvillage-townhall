// kascity_visual_v150.cjs
// Reads showcase_kascity149.html -> showcase_kascity150.html
// FORENSIC DEBUG. On every accept, samples the world 10x/second for 6s and prints, per change:
//   - ownership of the tile, the instant it flips, with a JS stack trace of whoever flipped it
//   - htr_/tr_ channel values each tick (so an overwrite is visible frame by frame)
//   - both balances each tick
//   - which of the two conditions the engine needs is failing right now, spelled out
// Nothing is fixed here; this identifies who claims the tile before the payment runs.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity149.html')) die('showcase_kascity149.html missing');
let html = fs.readFileSync('showcase_kascity149.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

// 1) wrap the engine's claim action so every ownership write is traced
rep('case "claim": {',
    'case "claim": {' + EOL +
    '      try { if (window.KV_TRACE_CLAIM) window.KV_TRACE_CLAIM(String(a.args && a.args[0]), a.args && a.args[1] != null ? a.args[1] : (world.flags.seat || 1), new Error().stack || ""); } catch (e) {}',
    'engine claim traced');

// 2) forensic sampler on accept
rep('var okt=window.KV_SETSTATE("htr_state",2);',
    'var okt=window.KV_SETSTATE("htr_state",2);' + EOL +
    '(function(){' + EOL +
    '  var key="t"+tile, t0=Date.now(), lastOwn=null, lastSig="", n=0;' + EOL +
    '  function L(m,c){ if(window.KV_LOG) window.KV_LOG(m,c||"#c9a0ff"); }' + EOL +
    '  window.KV_TRACE_CLAIM=function(k,to,stack){' + EOL +
    '    if(k!==key) return;' + EOL +
    '    var where=(stack.split("\\n")[2]||stack.split("\\n")[1]||"?").trim().slice(0,90);' + EOL +
    '    L("FORENSIC claim "+k+" -> P"+to+"  @"+(Date.now()-t0)+"ms  from: "+where, "#ff8adf");' + EOL +
    '  };' + EOL +
    '  var iv=setInterval(function(){' + EOL +
    '    var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};' + EOL +
    '    var own=window.KV_OWNER?window.KV_OWNER(tile):null;' + EOL +
    '    var sig=[own,f.htr_state,f.htr_tile,f.htr_from,f.htr_to,f.htr_amt,f.tr_state,f.tr_tile,f.tr_from,f.tr_to,f.tr_amt,cashNow(buyer),cashNow(seller)].join("/");' + EOL +
    '    if(sig!==lastSig){ lastSig=sig; n++;' + EOL +
    '      L("FORENSIC "+(Date.now()-t0)+"ms owner=P"+own+" | htr "+f.htr_state+"/"+f.htr_tile+"/"+f.htr_from+"\\u2192"+f.htr_to+"/"+f.htr_amt+" | tr "+f.tr_state+"/"+f.tr_tile+"/"+f.tr_from+"\\u2192"+f.tr_to+"/"+f.tr_amt+" | cash "+cashNow(buyer)+"/"+cashNow(seller));' + EOL +
    '      if(own!==seller && lastOwn===seller){' + EOL +
    '        L("FORENSIC \\u2014 OWNERSHIP LEFT THE SELLER at "+(Date.now()-t0)+"ms; from here ownerOf==seller is false and the paying branch can never match", "#ff4a3a");' + EOL +
    '        L("FORENSIC \\u2014 needed: htr_state==2 (is "+f.htr_state+"), htr_tile=="+tile+" (is "+f.htr_tile+"), htr_from=="+buyer+" (is "+f.htr_from+"), htr_to=="+seller+" (is "+f.htr_to+"), ownerOf=="+seller+" (is "+own+"), buyerCash "+cashNow(buyer)+" >= "+amt, "#ff4a3a");' + EOL +
    '      }' + EOL +
    '      lastOwn=own;' + EOL +
    '    }' + EOL +
    '    if(Date.now()-t0>6000){ clearInterval(iv); window.KV_TRACE_CLAIM=null; L("FORENSIC end \\u2014 "+n+" state changes sampled"); }' + EOL +
    '  }, 100);' + EOL +
    '})();',
    'forensic sampler on accept');

fs.writeFileSync('showcase_kascity150.html', html);
console.log('OK showcase_kascity150.html (' + (fs.statSync('showcase_kascity150.html').size/1024/1024).toFixed(1) + ' MB)');
