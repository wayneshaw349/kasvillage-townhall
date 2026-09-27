const fs = require("fs");
const P = "OnChainPageView.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("CONSOLE_TAP")) { console.log("already patched"); process.exit(0); }
let n = 0;
function rep(name, a, b, exp) {
  const f = s.split(a).length - 1;
  if (f !== exp) { console.error("ABORT [" + name + "]: " + f); process.exit(1); }
  s = s.split(a).join(b); n++; console.log("ok  [" + name + "]");
}
rep("tap-def",
"const BRIDGE = `",
"const CONSOLE_TAP = `\n(function(){\n  function post(kind, args){ try { window.ReactNativeWebView.postMessage(JSON.stringify({ kvlog: kind + ': ' + args.map(function(a){ try { return typeof a === 'string' ? a : JSON.stringify(a); } catch(e){ return String(a); } }).join(' ') })); } catch(e){} }\n  ['log','warn','error'].forEach(function(k){ var o = console[k]; console[k] = function(){ post(k, Array.prototype.slice.call(arguments)); o && o.apply(console, arguments); }; });\n  window.addEventListener('error', function(e){ post('onerror', [String(e.message || e), String(e.filename || '') + ':' + String(e.lineno || '')]); });\n  window.addEventListener('unhandledrejection', function(e){ post('unhandledrejection', [String((e.reason && e.reason.message) || e.reason)]); });\n})();\n`;\n\nconst BRIDGE = `",
1);
rep("tap-inject",
"injectedJavaScriptBeforeContentLoaded={BRIDGE + KV_WNET_INJECT}",
"injectedJavaScriptBeforeContentLoaded={CONSOLE_TAP + BRIDGE + KV_WNET_INJECT}",
1);
rep("tap-recv",
"  const onMessage = useCallback((event: any) => {\n    if (handleKvNetMessage(event.nativeEvent.data, (js) => webRef.current?.injectJavaScript(js))) return;",
"  const onMessage = useCallback((event: any) => {\n    try { const _d = JSON.parse(event?.nativeEvent?.data || '{}'); if (_d.kvlog !== undefined) { console.log('[GamePage]', _d.kvlog); return; } } catch {}\n    if (handleKvNetMessage(event.nativeEvent.data, (js) => webRef.current?.injectJavaScript(js))) return;",
1);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("patched " + P + " (" + n + "). Game console now mirrors to Metro as [GamePage].");
