// kascity_visual_v66.cjs
// Reads kascity_v63.json + showcase_kascity65.html -> kascity_v66.json + showcase_kascity66.html
//
// A. THE NPC BUG: bot buy branches now fail often (hazard/value/debt gates added in v61/v63). When a
//    bot's branch fails, the selector falls through to the generic human buy prompt — which never had
//    a seat guard — so the bot's decision was landing on the player. Every prompt-issuing branch now
//    carries "seat() <= world.flags.humans", and each prompt gets a bot fall-through that ends the
//    turn cleanly instead of asking a person.
//
// B. HOLDINGS: KV_OWNER only checked node.hidden / node.visible. The engine may signal visibility a
//    different way, so it now checks several signals and exposes KV_OWNER_DEBUG(tile) to show the raw
//    node state for one tile.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v63.json')) die('kascity_v63.json missing');
if (!fs.existsSync('showcase_kascity65.html')) die('showcase_kascity65.html missing');
const j = JSON.parse(fs.readFileSync('kascity_v63.json', 'utf8'));
const director = j.nodes.find(n => n.id === 'director') || die('director missing');

// ---------- A. guard every prompt branch ----------
let guarded = 0, fell = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.selector)) {
    const sel = o.selector;
    for (let i = 0; i < sel.length; i++) {
      const br = sel[i];
      if (!br || !Array.isArray(br.sequence)) continue;
      const hasPrompt = br.sequence.some(e => e && e.do && e.do.action === 'prompt');
      if (!hasPrompt) continue;
      const c0 = br.sequence[0] && br.sequence[0].cond;
      if (typeof c0 !== 'string') continue;
      if (c0.indexOf('world.flags.humans') >= 0) continue;      // already guarded
      br.sequence[0].cond = '(' + c0 + ') && seat() <= world.flags.humans';
      guarded++;
      // a bot reaching this point must end its turn rather than stall
      const m = /world\.flags\.pos == (\d+)/.exec(c0);
      if (m) {
        sel.splice(i + 1, 0, { sequence: [
          { cond: '(' + c0 + ') && seat() > world.flags.humans' },
          { do: { action: 'setState', args: ['phase', 3] } }
        ]});
        i++; fell++;
      }
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);
if (guarded < 4) die('prompt branches guarded ' + guarded + ' (<4)');

const v66str = JSON.stringify(j);
fs.writeFileSync('kascity_v66.json', v66str);

// ---------- showcase ----------
let html = fs.readFileSync('showcase_kascity65.html', 'utf8');
const oldJson = fs.readFileSync('kascity_v63.json', 'utf8');
const occ = html.split(JSON.stringify(oldJson)).length - 1;
if (occ !== 1) die('embedded v63 JSON found ' + occ + ' times (need 1)');
html = html.split(JSON.stringify(oldJson)).join(JSON.stringify(v66str));

// ---------- B. robust owner detection ----------
const ownRe = /window\.KV_OWNER = function \(tid\) \{[^\n]*\n/;
if (!ownRe.test(html)) die('KV_OWNER definition not found');
html = html.replace(ownRe,
  'window.KV_OWNER = function (tid) {\n' +
  '    var o = null;\n' +
  '    for (var s = 1; s <= 4; s++) {\n' +
  '      var n = window.KV_NODE("own_" + tid + "_" + s);\n' +
  '      if (!n) continue;\n' +
  '      var vis = (n.visible === true) || (n.hidden === false) ||\n' +
  '                (n.visible !== false && n.hidden !== true && n._shown === true);\n' +
  '      if (vis) o = s;\n' +
  '    }\n' +
  '    return o;\n' +
  '  };\n' +
  '  window.KV_OWNER_DEBUG = function (tid) {\n' +
  '    var out = [];\n' +
  '    for (var s = 1; s <= 4; s++) {\n' +
  '      var n = window.KV_NODE("own_" + tid + "_" + s);\n' +
  '      out.push("seat" + s + ": " + (n ? JSON.stringify({visible:n.visible, hidden:n.hidden, _dead:n._dead}) : "NO NODE"));\n' +
  '    }\n' +
  '    console.log("[OWNER " + tid + "]", out.join("  |  "));\n' +
  '    return out;\n' +
  '  };\n');

fs.writeFileSync('showcase_kascity66.html', html);
console.log('PASS ' + guarded + ' prompt branches now require seat() <= humans');
console.log('PASS ' + fell + ' bot fall-through branches added — a declining bot ends its turn, no prompt to you');
console.log('PASS KV_OWNER checks multiple visibility signals; KV_OWNER_DEBUG(tile) prints raw node state');
console.log('OK kascity_v66.json + showcase_kascity66.html (' + (fs.statSync('showcase_kascity66.html').size/1024/1024).toFixed(1) + ' MB)');
