// ---- __KV_V417: sidewalk pieces, district street signs, slim roll-off banner ----
(function(){
  var W = 8.62;                                   // where pieces stand: inner half of the sidewalk
  var LANE = [-0.66, -0.22, 0.22, 0.66];          // four players side by side along the street
  var DIST = window.KV_DISTRICTS || [];
  var COLS = {1:"#d94f4f", 2:"#4f7fd9", 3:"#4fd98a", 4:"#d9c14f"};

  // 1) pieces stand on the sidewalk: only the drawn sprite moves, the token itself
  //    (position, walking, game logic) is untouched. Pieces sharing a lot stagger in a
  //    grid (along the street AND across the sidewalk) and shrink a little, so on the
  //    side columns - where the camera looks down the street - none hides behind another.
  // pieces stay on the STREET half of the sidewalk (anything nearer the lots gets covered
  // by the lot in front of it on the side columns); when several share a lot they spread
  // along the street and zig-zag a little so every head clears the piece in front
  function spots(n){
    if (n <= 1) return [[0, -0.15]];
    var out = [];
    for (var i = 0; i < n; i++){ var f = i / (n - 1) * 2 - 1; out.push([(n > 2 ? 1.0 : 0.8) * f, (i % 2 === 0) ? -0.38 : -0.04]); }
    return out;
  }
  function onRing(x, z){ return !(Math.abs(x) < 8.6 && Math.abs(z) < 8.6); }
  function place(p, slot){
    var tok = window.KV_NODE && window.KV_NODE("token_p" + p);
    if (!tok || !tok.transform || !tok.transform.pos) return;
    var x = tok.transform.pos[0], z = tok.transform.pos[2];
    if (!onRing(x, z)) return;                                     // mid-animation off the ring
    var along = slot[0], across = slot[1], tx, tz;
    var cornerish = Math.abs(Math.abs(x) - Math.abs(z)) < 1.2;
    if (!cornerish && Math.abs(x) > Math.abs(z) && slot.crowd > 1){   // side streets: the camera looks down the street, so pieces in a row hide each other -> 2-wide grid instead
      var rows = Math.ceil(slot.crowd / 2), row = Math.floor(slot.idx / 2);
      across = (slot.idx % 2) ? -0.1 : -1.15; along = rows > 1 ? (row ? 0.8 : -0.8) : 0;
    }
    if (cornerish){ tx = (x > 0 ? W : -W) + (x > 0 ? -1 : 1) * across; tz = (z > 0 ? W : -W) + (z > 0 ? -1 : 1) * along * 0.8; }
    else if (Math.abs(z) >= Math.abs(x)){ tz = (z > 0 ? W : -W) + (z > 0 ? 1 : -1) * across; tx = x + along; }
    else { tx = (x > 0 ? W : -W) + (x > 0 ? 1 : -1) * across; tz = z + along; }
    var dx = tx - x, dz = tz - z;
    /*KV_CLEAR*/(window.__kvPW = window.__kvPW || {})[p] = [tx, tz];
    /*KV_LIFT*/var lift = (!cornerish && Math.abs(x) > Math.abs(z)) ? 0.35 : 0;   // side streets: camera looks across the lots, so stand taller
    var s = (tok.transform.scale && tok.transform.scale[0]) || 1;
    var th = ((tok.transform.rot && tok.transform.rot[1]) || 0) * Math.PI / 180;
    // world offset -> token-local offset (inverse yaw, inverse scale)
    var c = Math.cos(th), si = Math.sin(th);
    var lx = ( c * dx - si * dz) / s, lz = ( si * dx + c * dz) / s;
    [["tok_spr_" + p, 0.85], (p === 1 ? ["you_pip", 1.5] : null)].forEach(function(e){
      if (!e) return;
      var n = window.KV_NODE(e[0]); if (!n || !n.transform) return;
      var cur = n.transform.pos || [0, e[1], 0];
      var ly = e[1] + lift / s;
      if (Math.abs(cur[0] - lx) > 1e-3 || Math.abs(cur[2] - lz) > 1e-3 || Math.abs((cur[1] || 0) - ly) > 1e-3){
        n.transform.pos = [lx, ly, lz];
        try { delete n._world; } catch(x1){}
      }
      if (e[0].indexOf("tok_spr_") === 0){
        if (n.__kvBase == null) n.__kvBase = n.spriteSize || 1.5;
        var want = slot.crowd > 2 ? n.__kvBase * 0.72 : (slot.crowd > 1 ? n.__kvBase * 0.82 : n.__kvBase);
        if (n.spriteSize !== want){ n.spriteSize = want; try { delete n._world; } catch(x2){} }
      }
    });
  }
  function placeAll(){
    var groups = {};
    for (var p = 1; p <= 4; p++){
      var tok = window.KV_NODE && window.KV_NODE("token_p" + p);
      if (!tok || !tok.transform || !tok.transform.pos) continue;
      var k = Math.round(tok.transform.pos[0] / 1.1) + "," + Math.round(tok.transform.pos[2] / 1.1);
      (groups[k] = groups[k] || []).push(p);
    }
    Object.keys(groups).forEach(function(k){
      var g = groups[k], sp = spots(g.length);
      g.forEach(function(p, i){ var sl = sp[i].slice(); sl.crowd = g.length; sl.idx = i; place(p, sl); });
    });
  }

  // 2) district signs: green until one player owns the whole block, then that player's colour
  var labels = {};
  function label(g){
    if (labels[g]) return labels[g];
    var d = document.createElement("div");
    d.style.cssText = "position:fixed;z-index:62;pointer-events:none;transform:translate(-50%,-100%);" +
      "font:700 9px monospace;letter-spacing:.5px;padding:1px 5px;border-radius:3px;white-space:nowrap;" +
      "background:rgba(20,16,12,.78);color:#e8f2e4;border:1px solid #2f7d46;display:none;";
    document.body.appendChild(d); labels[g] = d; return d;
  }
  function signs(){
    var f = (window.KV_FLAGS && window.KV_FLAGS()) || {};
    var cv = document.querySelector("canvas");
    var r = cv ? cv.getBoundingClientRect() : null, sx = r ? r.width / cv.width : 1, sy = r ? r.height / cv.height : 1;
    for (var g = 0; g < DIST.length; g++){
      var own = Math.round(f["dbon_" + g] || 0);
      var n = window.KV_NODE("sign_" + g);
      var want = (own >= 1 && own <= 4) ? ("p" + own) : "signG";
      if (n && n.material !== want){ n.material = want; try { delete n._world; } catch(e){} }
      var post = n || window.KV_NODE("signpost_" + g);
      var d = label(g);
      if (!post || !post.worldPos || !window.KV_PROJECT || !r){ d.style.display = "none"; continue; }
      var q = window.KV_PROJECT({ x: post.worldPos.x, y: post.worldPos.y + 0.32, z: post.worldPos.z });
      if (!q){ d.style.display = "none"; continue; }
      var bonus = DIST[g].bonus;
      if (own >= 1 && own <= 4){ d.textContent = "P" + own + "'S BLOCK"; d.style.borderColor = COLS[own]; d.style.color = COLS[own]; }
      else { d.textContent = "+" + bonus; d.style.borderColor = "#2f7d46"; d.style.color = "#e8f2e4"; }   // short until owned: less clutter on phones
      var Lx = r.left + q.x * sx, Ly = r.top + q.y * sy, near = false, PW = window.__kvPW || {};
      for (var pp in PW){ var pq = window.KV_PROJECT({ x: PW[pp][0], y: 0.7, z: PW[pp][1] }); if (pq && Math.abs(r.left + pq.x * sx - Lx) < 46 && Math.abs(r.top + pq.y * sy - Ly) < 40) near = true; }
      d.style.opacity = near ? "0.18" : "1";   // a piece is standing under the sign: let it show through
      d.style.left = Lx + "px"; d.style.top = Ly + "px"; d.style.display = "block";
    }
  }

  // 3) multiplayer: the roll-off is automatic, so its full-screen box becomes a slim banner
  var css = document.createElement("style");
  css.textContent =
    ".kvrf{background:transparent!important;inset:auto!important;top:8px!important;left:50%!important;right:auto!important;bottom:auto!important;" +
      "transform:translateX(-50%)!important;pointer-events:none!important;display:block!important;width:auto!important;height:auto!important}" +
    ".kvrf>div{min-width:0!important;padding:5px 14px!important;font:11px/1.6 monospace!important;background:#14100c!important;border-width:1px!important;box-shadow:0 4px 14px rgba(0,0,0,.6)!important}" +
    ".kvrf>div>div{display:inline-block!important;margin:0 7px!important}" +
    ".kvrf>div>div:first-child{display:block!important;font-size:13px!important;letter-spacing:1px!important;margin-bottom:0!important}" +
    ".kvrf>div>div:last-child{display:block!important;margin-top:2px!important}" +
    ".kvrf button{display:none!important}";
  (document.head || document.documentElement).appendChild(css);
  function slim(){
    var M = window.KV_MP2; if (!(M && M.room)) return;
    var ds = document.querySelectorAll("body > div");
    for (var i = 0; i < ds.length; i++){
      var o = ds[i];
      if (o.className.indexOf("kvrf") >= 0) continue;
      if (/WHO GOES FIRST|ROLL FOR FIRST/.test(o.textContent || "") && o.children.length === 1) o.className += " kvrf";
    }
  }

  setInterval(function(){ try { placeAll(); } catch(e){} }, 120);
  setInterval(function(){ try { signs(); } catch(e){} }, 150);
  setInterval(function(){ try { slim(); } catch(e){} }, 250);
  setInterval(function(){ try { fadeNames(); } catch(e){} }, 200);
  // street names on the lots fade while a piece stands under them, so the piece stays readable
  var names = null;
  function fadeNames(){
    var PW = window.__kvPW, cv = document.querySelector("canvas"); if (!PW || !window.KV_PROJECT || !cv) return;
    var r = cv.getBoundingClientRect(), sx = r.width / cv.width, sy = r.height / cv.height, pts = [];
    for (var p in PW){ var q = window.KV_PROJECT({ x: PW[p][0], y: 0.7, z: PW[p][1] }); if (q) pts.push([r.left + q.x * sx, r.top + q.y * sy]); }
    if (!names || !names.length) names = [].filter.call(document.querySelectorAll("body > div"), function(d){ return /z-index: 56/.test(d.style.cssText) && /width: 74px/.test(d.style.cssText); });
    names.forEach(function(d){
      if (d.style.display === "none") return;
      var b = d.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2, near = false;
      pts.forEach(function(t){ if (Math.abs(t[0] - cx) < 40 && Math.abs(t[1] - cy) < 22) near = true; });
      var o = near ? "0.2" : ""; if (d.style.opacity !== o) d.style.opacity = o;
    });
  }
})();
