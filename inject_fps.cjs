// inject_fps.cjs — paints a live frame-time overlay onto a showcase so you can
// compare devices with numbers instead of impressions.
//
//   node .\inject_fps.cjs showcase_village.html
//   node .\inject_fps.cjs            (defaults to every showcase_*.html)
//
// Reports, updated 2x/sec:
//   fps      current, averaged over the last second
//   avg      mean frame time in ms
//   p95      95th percentile frame time -- the number that governs how the
//            game FEELS. A 60fps average with a 40ms p95 stutters visibly.
//   worst    single worst frame since load
//   drops    frames over 20ms (i.e. missed 60fps)
//   nodes    scene node count, so you can correlate cost with scene weight
//
// Tap the overlay to reset the stats -- lets you measure a fresh window after
// the device has warmed up, which is how you catch thermal throttling.
const fs = require('fs');

const OVERLAY = [
  '<script id="KV_FPS">',
  '(function () {',
  '  var box = null, samples = [], all = [], worst = 0, drops = 0, total = 0;',
  '  var last = 0, lastPaint = 0, started = 0;',
  '',
  '  function el() {',
  '    if (box) return box;',
  '    box = document.createElement("div");',
  '    box.id = "kv_fps";',
  '    box.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;" +',
  '      "background:rgba(0,0,0,.72);color:#7fff9f;font:11px/1.35 monospace;" +',
  '      "padding:6px 8px;white-space:pre;pointer-events:auto;border-bottom-right-radius:6px";',
  '    box.addEventListener("touchstart", reset);',
  '    box.addEventListener("mousedown", reset);',
  '    (document.body || document.documentElement).appendChild(box);',
  '    return box;',
  '  }',
  '  function reset(e) {',
  '    samples = []; all = []; worst = 0; drops = 0; total = 0;',
  '    started = performance.now();',
  '    if (e && e.preventDefault) e.preventDefault();',
  '  }',
  '  function pct(arr, p) {',
  '    if (!arr.length) return 0;',
  '    var s = arr.slice().sort(function (a, b) { return a - b; });',
  '    return s[Math.min(s.length - 1, Math.floor(s.length * p))];',
  '  }',
  '  function nodeCount() {',
  '    try {',
  '      if (typeof scene === "undefined" || !scene || !scene.nodes) return "?";',
  '      var n = 0;',
  '      (function w(list) {',
  '        (list || []).forEach(function (x) { n++; if (x.children) w(x.children); });',
  '      })(scene.nodes);',
  '      return n;',
  '    } catch (e) { return "?"; }',
  '  }',
  '',
  '  function tick(t) {',
  '    if (last) {',
  '      var dt = t - last;',
  '      if (dt > 0 && dt < 2000) {',
  '        samples.push(dt); all.push(dt); total++;',
  '        if (dt > worst) worst = dt;',
  '        if (dt > 20) drops++;',
  '        if (all.length > 3000) all.shift();',
  '      }',
  '    }',
  '    last = t;',
  '',
  '    if (t - lastPaint > 500) {',
  '      lastPaint = t;',
  '      var sum = 0, i;',
  '      for (i = 0; i < samples.length; i++) sum += samples[i];',
  '      var avg = samples.length ? sum / samples.length : 0;',
  '      var fps = avg > 0 ? 1000 / avg : 0;',
  '      var secs = (t - started) / 1000;',
  '      el().textContent =',
  '        "fps   " + fps.toFixed(1) + "\\n" +',
  '        "avg   " + avg.toFixed(1) + "ms\\n" +',
  '        "p95   " + pct(all, 0.95).toFixed(1) + "ms\\n" +',
  '        "worst " + worst.toFixed(1) + "ms\\n" +',
  '        "drops " + drops + " / " + total +',
  '        "  (" + (total ? (drops / total * 100).toFixed(1) : "0") + "%)\\n" +',
  '        "nodes " + nodeCount() + "   " + secs.toFixed(0) + "s";',
  '      samples = [];',
  '    }',
  '    requestAnimationFrame(tick);',
  '  }',
  '',
  '  started = performance.now();',
  '  requestAnimationFrame(tick);',
  '})();',
  '</script>'
].join('\n');

function inject(file) {
  const raw = fs.readFileSync(file);
  let s = raw.toString('utf8');

  if (s.indexOf('KV_FPS') !== -1) {
    s = s.replace(/<script id="KV_FPS">[\s\S]*?<\/script>\s*/, '');
  }

  let at = 0;
  const body = s.indexOf('<body');
  if (body !== -1) {
    at = s.indexOf('>', body) + 1;
  } else {
    const st = s.indexOf('</style>');
    at = st !== -1 ? st + 8 : 0;
  }
  s = s.slice(0, at) + '\n' + OVERLAY + '\n' + s.slice(at);

  fs.writeFileSync(file, Buffer.from(s, 'utf8'));
  console.log('OK ' + file);
}

const arg = process.argv[2];
const files = arg ? [arg]
  : fs.readdirSync('.').filter(function (f) { return /^showcase_.*\.html$/.test(f); });

if (!files.length) { console.log('ABORT: no showcase found'); process.exit(1); }
files.forEach(inject);
console.log('\nfps overlay injected into ' + files.length + ' file(s). Tap the box to reset stats.');
