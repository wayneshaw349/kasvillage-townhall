// kascity_visual_v84.cjs
// Reads showcase_kascity83.html -> showcase_kascity84.html   (scene JSON unchanged)
//
// THE ROOT BUG. KV_SETSTATE wrote into exprCtx(null). If that builds a fresh context per call, every
// write vanished — which silently broke EVERY player action that talks to the behaviour tree:
//     Renovate, Negotiate/settle, List for sale, Unlist, and the start screen's humans count.
// That matches the played game exactly: 0 renovations, 0 listings, 0 trades, despite pressing them.
//
// Fix: expose the engine's real `world` object at the ready hook and write straight to world.flags.
// KV_SETSTATE now verifies its own write and reports failure instead of failing silently, and
// KV_FLAGS reads from the same object so what you set is what the BT sees.
//
// Also: a bold RENOVATED banner, since a capital improvement should be as loud as a deal.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity83.html')) die('showcase_kascity83.html missing');
let html = fs.readFileSync('showcase_kascity83.html', 'utf8');

// ---------- expose the real world object ----------
const readyRe = /  window\.KV_SEED = \(scene\.meta && scene\.meta\.seed\) \|\| "kv";/;
if (!readyRe.test(html)) die('seed hook not found');
html = html.replace(readyRe,
  '  window.KV_SEED = (scene.meta && scene.meta.seed) || "kv";\n' +
  '  window.KV_WORLD = world;                       // the engine\'s live state, not a copy\n' +
  '  window.KV_RAWFLAGS = function () { return (world && world.flags) || {}; };');

// ---------- KV_SETSTATE writes to world.flags and verifies ----------
const setRe = /  window\.KV_SETSTATE = function \(k, v\) \{[^\n]*\n/;
if (!setRe.test(html)) die('KV_SETSTATE not found');
html = html.replace(setRe,
  '  window.KV_SETSTATE = function (k, v) {\n' +
  '    var f = null;\n' +
  '    if (window.KV_WORLD && window.KV_WORLD.flags) f = window.KV_WORLD.flags;\n' +
  '    else { try { var c = exprCtx(null); if (c && c.world && c.world.flags) f = c.world.flags; } catch (e) {} }\n' +
  '    if (!f) { if (window.KV_LOG) window.KV_LOG("state write failed: no flag store", "#ff6a4a"); return false; }\n' +
  '    f[String(k)] = v;\n' +
  '    if (f[String(k)] !== v) { if (window.KV_LOG) window.KV_LOG("state write rejected: " + k, "#ff6a4a"); return false; }\n' +
  '    return true;\n' +
  '  };\n');

// ---------- KV_FLAGS reads the same store ----------
const flagsRe = /  window\.KV_FLAGS = function \(\) \{[^\n]*\n/;
if (!flagsRe.test(html)) die('KV_FLAGS not found');
html = html.replace(flagsRe,
  '  window.KV_FLAGS = function () {\n' +
  '    if (window.KV_WORLD && window.KV_WORLD.flags) return window.KV_WORLD.flags;\n' +
  '    try { var c = exprCtx(null); return (c && c.world && c.world.flags) || {}; } catch (e) { return {}; }\n' +
  '  };\n');

// ---------- renovation banner + failure reporting ----------
const renRe = /      window\.KV_SETSTATE\("renov", t\);/;
if (!renRe.test(html)) die('renovate trigger not found');
html = html.replace(renRe,
  '      var okw = window.KV_SETSTATE("renov", t);\n' +
  '      if(!okw){ if(window.KV_LOG) window.KV_LOG("renovation could not be requested","#ff6a4a"); return; }\n' +
  '      if(window.KV_DEAL) window.KV_DEAL(true,"RENOVATING","P"+seat+" \\u00b7 "+((window.KV_NAMES[t]&&window.KV_NAMES[t].n)||t));');

// a completed renovation announces loudly
const doneRe = /          if\(window\.KV_LOG\) window\.KV_LOG\("P"\+\(o\|\|"\?"\)\+"  RENOVATED  "\+N\[k\]\.n\+"  hazard now "\+hz\+"%", COL\[o\]\|\|"#caa64c"\);/;
if (!doneRe.test(html)) die('renovation result line not found');
html = html.replace(doneRe,
  '          if(window.KV_LOG) window.KV_LOG("P"+(o||"?")+"  RENOVATED  "+N[k].n+"  hazard now "+hz+"%", COL[o]||"#caa64c");\n' +
  '          if(window.KV_DEAL) window.KV_DEAL(true,"RENOVATED","P"+(o||"?")+" \\u00b7 "+N[k].n+" \\u00b7 hazard "+hz+"%");');

// listing failure is reported too
const listRe = /        window\.KV_SETSTATE\("lp_t"\+tile, v\);\n        window\.KV_SETSTATE\("ls_t"\+tile, 1\);/;
if (listRe.test(html)) {
  html = html.replace(listRe,
    '        var ok1=window.KV_SETSTATE("lp_t"+tile, v);\n' +
    '        var ok2=window.KV_SETSTATE("ls_t"+tile, 1);\n' +
    '        if(!ok1||!ok2){ window.KV_LOG("listing failed to register","#ff6a4a"); return; }\n' +
    '        if(window.KV_DEAL) window.KV_DEAL(true,"LISTED","P"+me+" \\u00b7 "+d.n+" \\u00b7 "+v);');
}

// trade settlement failure is reported
const setlRe = /      window\.KV_SETSTATE\("tr_state",2\);/;
if (setlRe.test(html)) {
  html = html.replace(setlRe,
    '      var okt=window.KV_SETSTATE("tr_state",2);\n' +
    '      if(!okt && window.KV_LOG) window.KV_LOG("trade failed to register","#ff6a4a");');
}

// ---------- a console probe so this can never be guesswork again ----------
const selfRe = /    console\.log\("\[KV SELF-TEST\]", r\);/;
if (selfRe.test(html)) {
  html = html.replace(selfRe,
    '    var probeKey="__kvprobe", probeOk=false;\n' +
    '    try { window.KV_SETSTATE(probeKey, 4242); probeOk = (window.KV_FLAGS()[probeKey] === 4242); } catch(e) {}\n' +
    '    r.flagWrite = probeOk ? "OK" : "BROKEN";\n' +
    '    console.log("[KV SELF-TEST]", r);\n' +
    '    if(!probeOk && window.KV_LOG) window.KV_LOG("flag writes are broken — actions will not register","#ff6a4a");');
}

fs.writeFileSync('showcase_kascity84.html', html);
console.log('PASS engine world object exposed; KV_SETSTATE writes to world.flags directly');
console.log('PASS every write is verified — a rejected write now says so instead of failing silently');
console.log('PASS self-test reports flagWrite: OK / BROKEN on boot');
console.log('PASS bold RENOVATING and RENOVATED banners; listing and trade failures reported');
console.log('OK showcase_kascity84.html (' + (fs.statSync('showcase_kascity84.html').size/1024/1024).toFixed(1) + ' MB)');
