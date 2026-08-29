// kascity_visual_v159.cjs
// Reads showcase_kascity156.html -> showcase_kascity159.html   (branches from 156, trading LIVE)
// STEP-BY-STEP TRACE. Instead of a few checkpoints, this instruments the machinery itself and
// records an ordered narrative of everything that touches money or ownership from the moment you
// press Accept until 8 seconds later:
//   - every KV_SETSTATE write (key + value + who called it, one stack frame)
//   - every engine addSeatStat (seat, stat, amount, resulting balance)
//   - every engine claim / release (tile, new owner, caller)
//   - every KV_PAY entry and exit with its verdict
//   - a numbered sequence so the order is unambiguous in the result JSON
// Each is recorded as a move: seat 0, action "S<n>:<what>", v = the number involved.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity156.html')) die('showcase_kascity156.html missing');
let html = fs.readFileSync('showcase_kascity156.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

// ---- recorder, installed early (next to KV_SETSTATE so `world` is in scope) ----
rep('window.KV_SETSTATE = function (k, v) {',
  'window.__TR = { on:false, n:0, t0:0 };' + EOL +
  'window.__TRACE = function (what, num) {' + EOL +
  '  if (!window.__TR.on) return;' + EOL +
  '  var n = ++window.__TR.n, ms = Date.now() - window.__TR.t0;' + EOL +
  '  var line = "S" + (n < 10 ? "0" + n : n) + " @" + ms + "ms " + what;' + EOL +
  '  if (window.KV_MOVE) window.KV_MOVE(0, line.slice(0, 70), (typeof num === "number" ? num : 0));' + EOL +
  '  if (window.KV_LOG) window.KV_LOG(line, "#c9a0ff");' + EOL +
  '};' + EOL +
  'window.__WHO = function () {' + EOL +
  '  try { var s = (new Error().stack || "").split("\\n"); for (var i = 2; i < s.length; i++) {' + EOL +
  '    var t = s[i].trim(); if (t && t.indexOf("__TRACE") < 0 && t.indexOf("__WHO") < 0) return t.replace(/^at /, "").slice(0, 28); } } catch (e) {}' + EOL +
  '  return "?";' + EOL +
  '};' + EOL + EOL +
  'window.KV_SETSTATE = function (k, v) {' + EOL +
  '  if (window.__TR && window.__TR.on) window.__TRACE("setState " + k + "=" + v + " by " + window.__WHO(), (typeof v === "number" ? v : 0));',
  'tracer + KV_SETSTATE instrumented');

// ---- engine money and ownership actions ----
rep('      asSt[asK] = (asSt[asK] || 0) + asAmt;',
  '      asSt[asK] = (asSt[asK] || 0) + asAmt;' + EOL +
  '      if (window.__TR && window.__TR.on && asK === "cash") window.__TRACE("engine PAYS seat" + asIdx + " " + (asAmt >= 0 ? "+" : "") + Math.round(asAmt) + " -> " + Math.round(asSt[asK]), Math.round(asAmt));',
  'engine addSeatStat traced');

rep('      world.owners[String(a.args[0])] = a.args[1] != null ? a.args[1] : (world.flags.seat || 1);',
  '      world.owners[String(a.args[0])] = a.args[1] != null ? a.args[1] : (world.flags.seat || 1);' + EOL +
  '      if (window.__TR && window.__TR.on) window.__TRACE("engine CLAIM " + a.args[0] + " -> P" + world.owners[String(a.args[0])] + " by " + window.__WHO(), 0);',
  'engine claim traced');

rep('      delete world.owners[String(a.args[0])];',
  '      if (window.__TR && window.__TR.on) window.__TRACE("engine RELEASE " + a.args[0], 0);' + EOL +
  '      delete world.owners[String(a.args[0])];',
  'engine release traced');

// ---- KV_PAY entry / exit ----
rep('window.KV_PAY = function (tile, buyer, seller, amt) {',
  'window.KV_PAY = function (tile, buyer, seller, amt) {' + EOL +
  '  window.__TRACE("KV_PAY enter tile=" + tile + " buyer=P" + buyer + " seller=P" + seller + " amt=" + amt + " by " + window.__WHO(), amt);',
  'KV_PAY entry traced');

// ---- start/stop the recorder around the accept ----
rep('var okt=true;',
  'window.__TR = { on:true, n:0, t0:Date.now() };' + EOL +
  'window.__TRACE("ACCEPT tile=" + tile + " buyer=P" + buyer + " seller=P" + seller + " amt=" + amt, amt);' + EOL +
  '(function(){ function c(p){ try{ var w=window.KV_WORLD; if(w&&w.seats&&w.seats[p-1]) return Math.round(w.seats[p-1].cash||0);}catch(e){} return -1; }' + EOL +
  '  var o=null; try{ var w=window.KV_WORLD; o=w&&w.owners?(w.owners["t"+tile]||0):0; }catch(e){}' + EOL +
  '  window.__TRACE("state before: owner=P"+o+" buyerP"+buyer+"="+c(buyer)+" sellerP"+seller+"="+c(seller), c(seller));' + EOL +
  '  setTimeout(function(){ var o2=0; try{ var w=window.KV_WORLD; o2=w&&w.owners?(w.owners["t"+tile]||0):0; }catch(e){}' + EOL +
  '    window.__TRACE("state after 8s: owner=P"+o2+" buyerP"+buyer+"="+c(buyer)+" sellerP"+seller+"="+c(seller), c(seller));' + EOL +
  '    window.__TR.on=false; }, 8000); })();' + EOL +
  'var okt=true;',
  'recorder armed on accept, runs 8s');

fs.writeFileSync('showcase_kascity159.html', html);
console.log('OK showcase_kascity159.html (' + (fs.statSync('showcase_kascity159.html').size/1024/1024).toFixed(1) + ' MB)');
