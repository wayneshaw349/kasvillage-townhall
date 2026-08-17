// inject_errbox.cjs — paints any JS error onto the black page, no F12 needed.
// usage: node .\inject_errbox.cjs showcase_fx.html
const fs = require('fs');

const F = process.argv[2] || 'showcase_fx.html';
const buf = fs.readFileSync(F);
let s = buf.toString('utf8');

if (s.indexOf('KV_ERRBOX') !== -1) {
  s = s.replace(/<script id="KV_ERRBOX">[\s\S]*?<\/script>\s*/, '');
}

const lines = [
  '<script id="KV_ERRBOX">',
  '(function () {',
  '  function box(t) {',
  '    var d = document.getElementById("kv_errbox");',
  '    if (!d) {',
  '      d = document.createElement("div");',
  '      d.id = "kv_errbox";',
  '      d.style.cssText = "position:fixed;left:0;top:0;right:0;z-index:2147483647;' +
    'background:#a00;color:#fff;font:12px/1.4 monospace;padding:8px;white-space:pre-wrap;max-height:60%;overflow:auto";',
  '      (document.body || document.documentElement).appendChild(d);',
  '    }',
  '    d.textContent += t + "\\n\\n";',
  '  }',
  '  window.addEventListener("error", function (ev) {',
  '    var e = ev.error;',
  '    box("ERROR: " + ev.message + " @" + ev.lineno + ":" + ev.colno + (e && e.stack ? "\\n" + e.stack : ""));',
  '  });',
  '  window.addEventListener("unhandledrejection", function (ev) {',
  '    box("REJECT: " + (ev.reason && ev.reason.stack ? ev.reason.stack : String(ev.reason)));',
  '  });',
  '  var ce = console.error;',
  '  console.error = function () {',
  '    try { box("CONSOLE: " + Array.prototype.join.call(arguments, " ")); } catch (x) {}',
  '    return ce.apply(console, arguments);',
  '  };',
  '  setTimeout(function () {',
  '    var c = document.querySelector("canvas");',
  '    if (!c) { box("DIAG: no <canvas> in document"); return; }',
  '    box("DIAG: canvas " + c.width + "x" + c.height + " css " + c.clientWidth + "x" + c.clientHeight +',
  '        " display=" + getComputedStyle(c).display + " opacity=" + getComputedStyle(c).opacity);',
  '  }, 1500);',
  '})();',
  '</script>'
].join('\n');

let insertAt = 0;
const anchor = s.indexOf('<body');
if (anchor !== -1) {
  insertAt = s.indexOf('>', anchor) + 1;
} else {
  const st = s.indexOf('</style>');
  insertAt = st !== -1 ? st + 8 : 0;
  console.log('no <body> — injecting at offset ' + insertAt);
}
s = s.slice(0, insertAt) + '\n' + lines + '\n' + s.slice(insertAt);

fs.writeFileSync(F, Buffer.from(s, 'utf8'));
console.log('OK errbox injected into ' + F);
