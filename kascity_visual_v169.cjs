// kascity_visual_v169.cjs
// Reads showcase_kascity168.html -> showcase_kascity169.html
// MULTI-NODE RELAY CLIENT.
// The app runs on 3 Flux instances behind one domain, with no shared state and no static IPs —
// nodes rotate, and one of the three is currently unreachable from outside. So the client:
//   * discovers the live instances at startup from the Flux API (with the domain as a fallback)
//   * probes each one and keeps those that answer /health
//   * WRITES every move to all healthy nodes (fire and forget, first success wins)
//   * READS from all of them and merges by move index, so it does not matter which node a peer used
//   * re-discovers every 60s and after repeated failures, so a rotated node is picked up
//   * keeps the full move log locally: a node that restarts empty is repopulated on the next write
// Console: KV.nodes() lists them, KV.rediscover() forces a refresh.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity168.html')) die('showcase_kascity168.html missing');
let html = fs.readFileSync('showcase_kascity168.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function rep(a, b, name) { const n = html.split(a).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); html = html.replace(a, b); console.log('PASS ' + name); }

const BLOCK = [
'// ---- multi-node relay (v169) ----',
'(function(){',
'  var APP = "kasvillage", PORT = 35816;',
'  var DOMAIN = "https://kasvillage.app.runonflux.io";',
'  var NODES = [];            // [{base, ok, fails}]',
'  var lastDiscovery = 0;',
'',
'  function log(m, c){ if (window.KV_LOG) window.KV_LOG(m, c || "#7a9ac9"); }',
'',
'  async function probe(base){',
'    try{',
'      var c = new AbortController(); var t = setTimeout(function(){ c.abort(); }, 4000);',
'      var r = await fetch(base + "/health", { signal: c.signal });',
'      clearTimeout(t);',
'      return r.ok;',
'    }catch(e){ return false; }',
'  }',
'',
'  async function discover(force){',
'    if (!force && Date.now() - lastDiscovery < 60000 && NODES.some(function(n){ return n.ok; })) return NODES;',
'    lastDiscovery = Date.now();',
'    var found = [];',
'    try{',
'      var c = new AbortController(); var t = setTimeout(function(){ c.abort(); }, 6000);',
'      var r = await fetch("https://api.runonflux.io/apps/location/" + APP, { signal: c.signal });',
'      clearTimeout(t);',
'      var j = await r.json();',
'      (j && j.data ? j.data : []).forEach(function(d){',
'        var ip = String(d.ip || "").split(":")[0];',
'        if (ip) found.push("http://" + ip + ":" + PORT);',
'      });',
'    }catch(e){ log("node discovery failed, using the domain only", "#e0a040"); }',
'    if (!found.length) found.push(DOMAIN);',
'    else found.push(DOMAIN);   // the load balancer is a useful extra path',
'',
'    var checked = await Promise.all(found.map(async function(base){',
'      return { base: base, ok: await probe(base), fails: 0 };',
'    }));',
'    NODES = checked;',
'    var live = NODES.filter(function(n){ return n.ok; });',
'    log("relay nodes: " + live.length + " of " + NODES.length + " reachable", live.length ? "#9cd87c" : "#ff6a4a");',
'    return NODES;',
'  }',
'',
'  function live(){ return NODES.filter(function(n){ return n.ok; }); }',
'',
'  async function once(node, path, opts){',
'    var c = new AbortController(); var t = setTimeout(function(){ c.abort(); }, 6000);',
'    try{',
'      var r = await fetch(node.base + path, Object.assign({ signal: c.signal,',
'        headers: { "Content-Type": "application/json" } }, opts || {}));',
'      clearTimeout(t);',
'      if (!r.ok) throw new Error("HTTP " + r.status);',
'      node.fails = 0;',
'      return await r.json();',
'    }catch(e){',
'      clearTimeout(t);',
'      node.fails = (node.fails || 0) + 1;',
'      if (node.fails >= 3) { node.ok = false; log("node dropped: " + node.base, "#e0a040"); }',
'      throw e;',
'    }',
'  }',
'',
'  // write to every healthy node; resolve on the first success',
'  async function broadcast(path, opts){',
'    if (!live().length) await discover(true);',
'    var nodes = live(); if (!nodes.length) throw new Error("no relay reachable");',
'    var results = await Promise.allSettled(nodes.map(function(n){ return once(n, path, opts); }));',
'    var good = results.filter(function(r){ return r.status === "fulfilled"; });',
'    if (!good.length) { await discover(true); throw new Error("all relays failed"); }',
'    return good[0].value;',
'  }',
'',
'  // read from every healthy node and merge the move lists by index',
'  async function gather(path){',
'    if (!live().length) await discover(true);',
'    var nodes = live(); if (!nodes.length) throw new Error("no relay reachable");',
'    var results = await Promise.allSettled(nodes.map(function(n){ return once(n, path, { method: "GET" }); }));',
'    var good = results.filter(function(r){ return r.status === "fulfilled"; }).map(function(r){ return r.value; });',
'    if (!good.length) { await discover(true); throw new Error("all relays failed"); }',
'    var byIndex = {}, players = [], ended = false, seed = null;',
'    good.forEach(function(res){',
'      (res.moves || []).forEach(function(m){ if (byIndex[m.index] == null) byIndex[m.index] = m; });',
'      if ((res.players || []).length > players.length) players = res.players;',
'      if (res.ended) ended = true;',
'      if (res.seed && !seed) seed = res.seed;',
'    });',
'    var moves = Object.keys(byIndex).map(Number).sort(function(a,b){ return a-b; }).map(function(i){ return byIndex[i]; });',
'    return { moves: moves, players: players, ended: ended, seed: seed };',
'  }',
'',
'  window.KV_RELAY = {',
'    discover: discover,',
'    nodes: function(){ return NODES.map(function(n){ return { base: n.base, ok: n.ok, fails: n.fails || 0 }; }); },',
'    post: function(path, body){ return broadcast(path, { method: "POST", body: JSON.stringify(body || {}) }); },',
'    get: function(path){ return gather(path); }',
'  };',
'',
'  if (window.KV) {',
'    window.KV.nodes = function(){ var n = window.KV_RELAY.nodes(); console.table(n); return n; };',
'    window.KV.rediscover = async function(){ await discover(true); return window.KV.nodes(); };',
'  }',
'',
'  discover(true);',
'})();',
''
].join(EOL);

// install the relay before the existing api() helper is used
rep('// ---- inbound: apply the peer\'s moves locally ----', BLOCK + EOL + '// ---- inbound: apply the peer\'s moves locally ----',
    'multi-node relay installed');

// route the existing api() through it
const apiHead = 'async function api(';
const ai = html.indexOf(apiHead);
if (ai < 0) die('api() not found');
html = html.slice(0, ai) +
  'async function api(path, opts){' + EOL +
  '  // v169: every call goes to all healthy relay nodes' + EOL +
  '  if (window.KV_RELAY) {' + EOL +
  '    if (!opts || !opts.method || String(opts.method).toUpperCase() === "GET") return window.KV_RELAY.get(path);' + EOL +
  '    var body = null; try { body = opts.body ? JSON.parse(opts.body) : {}; } catch(e){ body = {}; }' + EOL +
  '    return window.KV_RELAY.post(path, body);' + EOL +
  '  }' + EOL +
  '  return __api_direct(path, opts);' + EOL +
  '}' + EOL +
  'async function __api_direct(' +
  html.slice(ai + apiHead.length);
console.log('PASS api() routed through the multi-node relay');

fs.writeFileSync('showcase_kascity169.html', html);
console.log('OK showcase_kascity169.html (' + (fs.statSync('showcase_kascity169.html').size/1024/1024).toFixed(1) + ' MB)');
