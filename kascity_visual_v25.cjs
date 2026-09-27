// kascity_visual_v25.cjs
// Reads kascity_v24.json + scene_engine.html -> writes kascity_v25.json + showcase_kascity25.html
// 1) Corner cards: 3D portrait billboards + scattered HUD rows REPLACED by four fixed DOM cards,
//    one per screen corner (P1 TL, P2 TR, P3 BL, P4 BR): pixel face + CASH/BANK/MORTG + kaspa wallet
//    input, all grouped. Values mirrored live from the engine via a tiny KV_STATS hook.
// 2) Movable pieces: tokens become chunky 16-bit pixel characters (billboard child on each token node,
//    so all existing glide/movement logic still drives them). Distinct hat + outfit per player.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v24.json')) die('kascity_v24.json missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v24.json', 'utf8'));
const RES = j.resources || die('resources missing');
const byId = id => j.nodes.find(n => n.id === id);

// ---------- 1. remove 3D portraits ----------
let remP = 0;
for (let k = j.nodes.length - 1; k >= 0; k--) {
  if (/^portrait_p[1-4]$/.test(j.nodes[k].id || '')) { j.nodes.splice(k, 1); remP++; }
}
if (remP !== 4) die('portraits removed ' + remP);

// ---------- 2. chunky pixel token characters ----------
const I = '#241c12', SKIN = '#e8b488';
function tok(outfit, hat, hatCol) {
  // 14w x 17h chunky character, big head, outlined
  const r = [];
  const O = (x, y, w, h, c) => r.push({ rect: [x, y, w, h], color: c });
  // hat variants
  if (hat === 'cap') { O(3, 0, 8, 2, hatCol); O(2, 2, 10, 1, hatCol); O(10, 2, 4, 1, hatCol); }
  if (hat === 'mohawk') { O(6, 0, 2, 3, hatCol); O(3, 2, 8, 1, I); }
  if (hat === 'hood') { O(3, 0, 8, 3, hatCol); O(2, 1, 1, 4, hatCol); O(11, 1, 1, 4, hatCol); }
  if (hat === 'crown') { O(3, 0, 2, 2, hatCol); O(6, 0, 2, 2, hatCol); O(9, 0, 2, 2, hatCol); O(3, 2, 8, 1, hatCol); }
  // head
  O(2, 3, 10, 6, SKIN); O(2, 3, 1, 6, I); O(11, 3, 1, 6, I); O(2, 3, 10, 1, hat === 'cap' ? hatCol : I);
  O(4, 5, 2, 2, I); O(8, 5, 2, 2, I);            // eyes
  O(5, 8, 4, 1, '#a83a2e');                       // mouth
  // body
  O(3, 9, 8, 5, outfit); O(3, 9, 1, 5, I); O(10, 9, 1, 5, I);
  O(1, 10, 2, 3, outfit); O(11, 10, 2, 3, outfit); // arms
  O(5, 10, 4, 2, '#f4e4c1');                       // shirt patch
  // feet
  O(4, 14, 3, 2, I); O(8, 14, 3, 2, I);
  O(2, 16, 10, 1, 'rgba(0,0,0,0.25)');            // shadow line
  return { w: 14, h: 17, frames: [r] };
}
RES.sprites.tok_p1 = tok('#d94f4f', 'cap', '#a82a2a');
RES.sprites.tok_p2 = tok('#4f7fd9', 'mohawk', '#2a4ad0');
RES.sprites.tok_p3 = tok('#4fd98a', 'hood', '#2a9a5a');
RES.sprites.tok_p4 = tok('#d9c14f', 'crown', '#f0d020');
let tokN = 0;
for (let p = 1; p <= 4; p++) {
  const t = byId('token_p' + p);
  if (!t) die('token_p' + p + ' missing');
  delete t.mesh;                       // hide humanoid geometry
  t.children = (t.children || []).filter(c => c.id !== 'tok_spr_' + p);
  t.children.push({ id: 'tok_spr_' + p, type: 'Billboard', sprite: 'tok_p' + p, spriteSize: 1.5, aspect: 14 / 17, transform: { pos: [0, 0.85, 0] } });
  tokN++;
}
if (tokN !== 4) die('tokens ' + tokN);

// ---------- 3. HUD cleanup: drop grouped rows, park bind labels offscreen (keep live values) ----------
const hud = byId('hud') || die('hud missing');
const dropIds = [];
for (let p = 1; p <= 4; p++) dropIds.push('s' + p, 'b' + p, 'crl' + p, 'bkl' + p);
hud.children = hud.children.filter(c => dropIds.indexOf(c.id) < 0);
let parked = 0;
for (let p = 1; p <= 4; p++) {
  for (const id of ['c' + p, 'cr' + p, 'bk' + p]) {
    const n = hud.children.find(c => c.id === id);
    if (!n) die('hud ' + id + ' missing');
    n.pos = [-9999, -9999];
    parked++;
  }
}
if (parked !== 12) die('parked ' + parked);

// ---------- write json ----------
const v25str = JSON.stringify(j);
fs.writeFileSync('kascity_v25.json', v25str);

// ---------- engine patches ----------
const fnAnchor = 'function playSoundDef(d, at) {';
if (engine.split(fnAnchor).length - 1 !== 1) die('playSoundDef anchor mismatch');
engine = engine.split(fnAnchor).join(fnAnchor + '\n' +
  '  if (d && d.speech && d.speech.text && typeof SpeechSynthesisUtterance !== "undefined") {\n' +
  '    try { var _u = new SpeechSynthesisUtterance(String(d.speech.text));\n' +
  '      _u.pitch = d.speech.pitch == null ? 1 : d.speech.pitch;\n' +
  '      _u.rate = d.speech.rate == null ? 1 : d.speech.rate;\n' +
  '      _u.volume = d.speech.svol == null ? 1 : d.speech.svol;\n' +
  '      window.speechSynthesis.cancel(); window.speechSynthesis.speak(_u); } catch (e) {}\n' +
  '  }\n');
const bindAnchor = 'if (n.type === "ProgressBar" && n.bind) {';
if (engine.split(bindAnchor).length - 1 !== 1) die('bind anchor mismatch');
engine = engine.split(bindAnchor).join(
  'if (n.type === "Label" && n.bind) { var cvb = resolvePath(n.bind.split("."), exprCtx(null)); if (cvb != null && cvb === cvb) { n.text = "" + Math.round(cvb); (window.KV_STATS || (window.KV_STATS = {}))[n.bind] = Math.round(cvb); } }\n    ' + bindAnchor);

// ---------- DOM corner cards ----------
const faceCol = { 1: '#f0a0c0', 2: '#7fb8d8', 3: '#8cd87c', 4: '#f0d860' };
function faceRects(skin) {
  const W = 20, r = [];
  const O = (x, y, w, h, c) => r.push([x, y, w, h, c]);
  O(0, 0, W, 22, I); O(1, 1, 18, 4, I);
  O(1, 5, 18, 11, skin);
  O(3, 4, 3, 2, I); O(14, 4, 3, 2, I);
  O(5, 9, 2, 2, I); O(13, 9, 2, 2, I);
  O(9, 11, 2, 2, '#d09a70'); O(7, 14, 6, 1, '#a83a2e');
  O(1, 16, 18, 5, ['#d94f4f', '#4f7fd9', '#4fd98a', '#d9c14f'][{'#f0a0c0':0,'#7fb8d8':1,'#8cd87c':2,'#f0d860':3}[skin]]);
  O(8, 16, 4, 5, I);
  return r;
}
const faces = {};
for (let p = 1; p <= 4; p++) faces[p] = faceRects(faceCol[p]);

const cardsJs = [
  'window.KV_WALLETS = window.KV_WALLETS || {}; window.KV_STATS = window.KV_STATS || {};',
  'var KV_FACES = ' + JSON.stringify(faces) + ';',
  '(function(){',
  '  var spots = { 1: "left:8px;top:8px;", 2: "right:8px;top:8px;", 3: "left:8px;bottom:92px;", 4: "right:8px;bottom:92px;" };',
  '  var names = { 1: "P1 (you)", 2: "P2", 3: "P3", 4: "P4" };',
  '  for (var p = 1; p <= 4; p++) (function(p){',
  '    var card = document.createElement("div");',
  '    card.style.cssText = "position:fixed;" + spots[p] + "width:158px;z-index:50;background:rgba(20,16,12,0.82);" +',
  '      "border:1px solid #5a4a3a;border-radius:6px;padding:6px;color:#f4e4c1;font:11px monospace;";',
  '    var cv = document.createElement("canvas"); cv.width = 20; cv.height = 22;',
  '    cv.style.cssText = "width:40px;height:44px;image-rendering:pixelated;float:left;margin-right:6px;";',
  '    var g = cv.getContext("2d"); var R = KV_FACES[p];',
  '    for (var i = 0; i < R.length; i++) { g.fillStyle = R[i][4]; g.fillRect(R[i][0], R[i][1], R[i][2], R[i][3]); }',
  '    var info = document.createElement("div");',
  '    info.innerHTML = "<b>" + names[p] + "</b><br>" +',
  '      "CASH <span id=kvc" + p + " style=color:#f8f0d8>-</span><br>" +',
  '      "BANK <span id=kvb" + p + " style=color:#f0c860>-</span><br>" +',
  '      "MORTG <span id=kvm" + p + " style=color:#e08a5a>-</span>";',
  '    var w = document.createElement("input");',
  '    w.id = "kvw" + p; w.placeholder = "kaspa wallet";',
  '    w.style.cssText = "width:100%;margin-top:5px;box-sizing:border-box;background:#1a1410;color:#f4e4c1;" +',
  '      "border:1px solid #5a4a3a;border-radius:4px;padding:2px 5px;font:10px monospace;";',
  '    w.addEventListener("input", function(){ window.KV_WALLETS[p] = w.value.trim(); });',
  '    card.appendChild(cv); card.appendChild(info); card.appendChild(w);',
  '    document.body.appendChild(card);',
  '  })(p);',
  '  setInterval(function(){',
  '    for (var p = 1; p <= 4; p++) {',
  '      var c = window.KV_STATS["seats." + p + ".cash"], b = window.KV_STATS["world.flags.nw" + p], m = window.KV_STATS["seats." + p + ".mort"];',
  '      if (c != null) document.getElementById("kvc" + p).textContent = c;',
  '      if (b != null) document.getElementById("kvb" + p).textContent = b;',
  '      if (m != null) document.getElementById("kvm" + p).textContent = m;',
  '    }',
  '  }, 250);',
  '})();'
].join('\n');

fs.writeFileSync('showcase_kascity25.html', engine.replace('</script>', [
  '', '// ---- injected kascity v25 showcase ----', cardsJs,
  'try { loadScene(' + JSON.stringify(v25str) + '); }',
  "catch (e) { console.error('kascity25 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS 3D portraits removed; DOM corner cards x4 (face + cash/bank/mortg + wallet)');
console.log('PASS tokens -> chunky pixel characters (cap/mohawk/hood/crown), movement logic untouched');
console.log('PASS HUD rows consolidated; live values mirrored via KV_STATS');
console.log('OK kascity_v25.json + showcase_kascity25.html');
