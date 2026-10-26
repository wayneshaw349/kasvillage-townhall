// ---- __KV_V417: sidewalk pieces, district street signs, slim roll-off banner ----
(function(){
  var W = 7.55; /*KV_GREEN*/                                   // where pieces stand: inner half of the sidewalk
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
      across = (slot.idx % 2) ? -0.05 : -0.85; along = rows > 1 ? (row ? 0.8 : -0.8) : 0;
    }
    if (cornerish){ tx = (x > 0 ? W : -W) + (x > 0 ? -1 : 1) * across; tz = (z > 0 ? W : -W) + (z > 0 ? -1 : 1) * along * 0.8; }
    else if (Math.abs(z) >= Math.abs(x)){ tz = (z > 0 ? W : -W) + (z > 0 ? 1 : -1) * across; tx = x + along; }
    else { tx = (x > 0 ? W : -W) + (x > 0 ? 1 : -1) * across; tz = z + along; }
    /*KV_GLIDE*/ var Gl = (window.__kvGlide = window.__kvGlide || {}), G = Gl[p] || (Gl[p] = { x: tx, z: tz });
    if (Math.hypot(tx - G.x, tz - G.z) > 3 && !G.a) G.a = { x: G.x, z: G.z, t0: Date.now() };   // a jump (resync, card move): slide, never teleport
    if (G.a){ var gk = Math.min(1, (Date.now() - G.a.t0) / 450); gk = gk * (2 - gk); tx = G.a.x + (tx - G.a.x) * gk; tz = G.a.z + (tz - G.a.z) * gk; if (gk >= 1) G.a = null; }
    G.x = tx; G.z = tz;
    var dx = tx - x, dz = tz - z;
    /*KV_CLEAR*/(window.__kvPW = window.__kvPW || {})[p] = [tx, tz];
    /*KV_LIFT*/var lift = 0;   // side streets: camera looks across the lots, so stand taller
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
        var want = n.__kvHid ? 0.001 : (slot.crowd > 2 ? n.__kvBase * 0.72 : (slot.crowd > 1 ? n.__kvBase * 0.82 : n.__kvBase));   // __kvHid: a mishap is playing
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

  setInterval(function(){ try { placeAll(); } catch(e){} }, 50);
  setInterval(function(){ try { signs(); } catch(e){} }, 150);
  setInterval(function(){ try { slim(); } catch(e){} }, 250);
  setInterval(function(){ try { fadeNames(); } catch(e){} }, 200);

  // ---- __KV_V417_MISHAP: a roll the record did not take becomes a funny mishap ----
  // Instead of a banner and a snap-back, your piece is struck by lightning, blown away, swallowed by a
  // sinkhole, slips, or gets chased off - then it is back on its real lot. Recorded rolls: nothing extra.
  (function(){
    var busy = 0, AC = null;
    function ac(){ try { var A = window.AudioContext || window.webkitAudioContext; if (!A) return null; AC = window.__kvStartAC || AC || (window.__kvStartAC = new A()); if (AC.state === "suspended") AC.resume(); return AC; } catch(e){ return null; } }
    function noise(c, dur){ var b = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; var s = c.createBufferSource(); s.buffer = b; return s; }
    function env(c, node, t0, a, peak, rel){ var g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + rel); node.connect(g); g.connect(c.destination); return g; }
    function tone(c, type, f0, f1, t0, dur, vol){ var o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur); env(c, o, t0, 0.01, vol, dur); o.start(t0); o.stop(t0 + dur + 0.05); }
    var SFX = {
      bolt: function(c){ var t = c.currentTime, n = noise(c, 1.2), f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(6000, t); f.frequency.exponentialRampToValueAtTime(120, t + 1.1); n.connect(f); env(c, f, t, 0.005, 0.5, 1.1); n.start(t); tone(c, "square", 90, 40, t + 0.05, 0.5, 0.15); },
      wind: function(c){ var t = c.currentTime, n = noise(c, 1.6), f = c.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1400, t + 0.7); f.frequency.exponentialRampToValueAtTime(250, t + 1.5); n.connect(f); env(c, f, t, 0.4, 0.35, 1.1); n.start(t); },
      sink: function(c){ var t = c.currentTime; tone(c, "sine", 700, 60, t, 0.9, 0.25); tone(c, "triangle", 110, 40, t + 0.85, 0.35, 0.4); },
      slip: function(c){ var t = c.currentTime; tone(c, "sine", 300, 1100, t, 0.18, 0.2); tone(c, "sine", 1100, 200, t + 0.2, 0.35, 0.2); tone(c, "square", 120, 60, t + 0.6, 0.15, 0.15); },
      chase: function(c){ var t = c.currentTime; for (var i = 0; i < 9; i++) tone(c, "square", 220 + (i % 2) * 60, 160, t + i * 0.11, 0.06, 0.08); tone(c, "sawtooth", 500, 900, t + 0.2, 0.25, 0.06); }
    };
    var KINDS = [
      { k: "bolt",  icon: "⚡", say: "Struck by lightning!" },
      { k: "wind",  icon: "🌪️", say: "Blown away by the wind!" },
      { k: "sink",  icon: "🕳️", say: "A sinkhole opened up!" },
      { k: "slip",  icon: "🍌", say: "Slipped on a banana!" },
      { k: "chase", icon: "🏃", say: "Chased off by a crowd!" }
    ];
    function el(css, html){ var d = document.createElement("div"); d.style.cssText = "position:fixed;pointer-events:none;z-index:2147483500;" + css; if (html != null) d.innerHTML = html; document.body.appendChild(d); return d; }
    function anim(d, frames, ms){ try { return d.animate(frames, { duration: ms, easing: "ease-out", fill: "forwards" }); } catch(e){ return null; } }
    function where(s){
      try {
        var cv = document.querySelector("canvas"), r = cv.getBoundingClientRect(), PW = (window.__kvPW || {})[s];
        var tok = window.KV_NODE && window.KV_NODE("token_p" + s), wp = PW ? { x: PW[0], y: 0.7, z: PW[1] } : (tok && tok.worldPos ? { x: tok.worldPos.x, y: 0.7, z: tok.worldPos.z } : null);
        var q = wp && window.KV_PROJECT && window.KV_PROJECT(wp); if (!q) return null;
        return { x: r.left + q.x * r.width / cv.width, y: r.top + q.y * r.height / cv.height };
      } catch(e){ return null; }
    }
    window.__kvMishap = function(s, kind){
      if (Date.now() - busy < 2500) return; busy = Date.now();
      var K = KINDS.filter(function(x){ return x.k === kind; })[0] || KINDS[Math.floor(Math.random() * KINDS.length)];
      var p = where(s) || { x: innerWidth / 2, y: innerHeight / 2 };
      (window.__kvHidePiece = window.__kvHidePiece || {})[s] = Date.now() + 1500;        // the piece vanishes while it happens
      var c = ac(); if (c && SFX[K.k]) SFX[K.k](c);
      try { if (navigator.vibrate) navigator.vibrate([60, 40, 120]); } catch(e){}
      var bits = [];
      if (K.k === "bolt"){
        var fl = el("inset:0;background:#fff;opacity:0"); bits.push(fl); anim(fl, [{ opacity: 0 }, { opacity: .85 }, { opacity: 0 }, { opacity: .6 }, { opacity: 0 }], 420);
        var b = el("left:" + (p.x - 22) + "px;top:0;width:44px;height:" + p.y + "px",
          "<svg width='44' height='100%' viewBox='0 0 44 100' preserveAspectRatio='none'><polyline points='30,0 12,38 26,40 8,100' fill='none' stroke='#fff6a8' stroke-width='5'/><polyline points='30,0 12,38 26,40 8,100' fill='none' stroke='#ffd23f' stroke-width='2'/></svg>");
        bits.push(b); anim(b, [{ opacity: 1 }, { opacity: 1, offset: .5 }, { opacity: 0 }], 600);
        var sm = el("left:" + (p.x - 20) + "px;top:" + (p.y - 30) + "px;font-size:34px", "💥"); bits.push(sm); anim(sm, [{ transform: "scale(.4)", opacity: 1 }, { transform: "scale(1.6) translateY(-20px)", opacity: 0 }], 1100);
      } else if (K.k === "wind"){
        var tw = el("left:" + (p.x - 24) + "px;top:" + (p.y - 40) + "px;font-size:44px", "🌪️"); bits.push(tw);
        anim(tw, [{ transform: "translateX(0) rotate(0)", opacity: 1 }, { transform: "translateX(" + (innerWidth * .5) + "px) rotate(720deg)", opacity: 0 }], 1500);
        for (var i = 0; i < 4; i++){ var w = el("left:" + (p.x - 60) + "px;top:" + (p.y - 30 + i * 14) + "px;font-size:20px", "💨"); bits.push(w); anim(w, [{ transform: "translateX(0)", opacity: .9 }, { transform: "translateX(" + (180 + i * 40) + "px)", opacity: 0 }], 900 + i * 150); }
      } else if (K.k === "sink"){
        var h = el("left:" + (p.x - 30) + "px;top:" + (p.y - 6) + "px;width:60px;height:18px;border-radius:50%;background:radial-gradient(#000 40%,#2a1d12 70%,transparent 72%)"); bits.push(h);
        anim(h, [{ transform: "scale(0)" }, { transform: "scale(1.3)", offset: .3 }, { transform: "scale(1.3)", offset: .75 }, { transform: "scale(0)" }], 1400);
        var dn = el("left:" + (p.x - 16) + "px;top:" + (p.y - 34) + "px;font-size:28px", "😵"); bits.push(dn); anim(dn, [{ transform: "translateY(0) scale(1)", opacity: 1 }, { transform: "translateY(26px) scale(.2)", opacity: 0 }], 900);
      } else if (K.k === "slip"){
        var bn = el("left:" + (p.x - 14) + "px;top:" + (p.y - 8) + "px;font-size:26px", "🍌"); bits.push(bn); anim(bn, [{ opacity: 1 }, { opacity: 1, offset: .7 }, { opacity: 0 }], 1400);
        var st = el("left:" + (p.x - 18) + "px;top:" + (p.y - 50) + "px;font-size:30px", "💫"); bits.push(st); anim(st, [{ transform: "rotate(0) translateY(0)", opacity: 1 }, { transform: "rotate(540deg) translateY(-30px)", opacity: 0 }], 1300);
      } else {
        for (var j = 0; j < 4; j++){ var r = el("left:" + (-50 - j * 36) + "px;top:" + (p.y - 30 + (j % 2) * 10) + "px;font-size:26px", "🏃"); bits.push(r); anim(r, [{ transform: "translateX(0)" }, { transform: "translateX(" + (p.x + 140 + j * 36) + "px)" }], 1300); }
        var ex = el("left:" + (p.x - 10) + "px;top:" + (p.y - 50) + "px;font:900 26px Impact,sans-serif;color:#ffd23f", "!"); bits.push(ex); anim(ex, [{ transform: "scale(.5)", opacity: 1 }, { transform: "scale(1.5)", opacity: 0 }], 900);
      }
      var cap = el("left:50%;top:22%;transform:translateX(-50%);background:#14100c;border:2px solid #caa64c;border-radius:9px;padding:6px 14px;font:700 13px monospace;color:#f0c860;white-space:nowrap", K.icon + " " + K.say);
      bits.push(cap); anim(cap, [{ opacity: 0, transform: "translateX(-50%) scale(.8)" }, { opacity: 1, transform: "translateX(-50%) scale(1)", offset: .15 }, { opacity: 1, offset: .8 }, { opacity: 0 }], 2000);
      setTimeout(function(){ bits.forEach(function(d){ try { d.remove(); } catch(e){} }); }, 2200);
      // bring the piece home from the record while it is out of sight
      setTimeout(function(){ try { var M = window.KV_MP2; if (M && M.resync && (!window.__kvMishapRs || Date.now() - window.__kvMishapRs > 4000)){ window.__kvMishapRs = Date.now(); M.resync("mishap"); } } catch(e){} }, 300);
    };
    // the piece stays invisible while the mishap plays (placeAll sizes the sprite)
    setInterval(function(){
      var H = window.__kvHidePiece || {};
      for (var s in H){ var n = window.KV_NODE && window.KV_NODE("tok_spr_" + s); if (!n) continue; n.__kvHid = Date.now() < H[s]; if (!n.__kvHid) delete H[s]; }
    }, 60);
  })();

  // ---- __KV_V417_ROLLFB: tell the player what the record did with their roll ----
  (function(){
    var COL = {1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"}, seenI = null, lastNo = 0;
    function me(){ var M = window.KV_MP2; return (M && M.room && M.started) ? M.seat : null; }
    window.__kvRollNo = function(why){
      if (Date.now() - lastNo < 1500) return; lastNo = Date.now();
      if (/already rolled|waiting for/i.test(why)){                                    // a blocked tap: nothing moved, just a hint
        var d = toast("<span style='font:400 12px monospace;color:#e8dcc0'>" + why + "</span>", 1200); d.style.padding = "5px 12px"; return;
      }
      var s = me(); if (s && window.__kvMishap) window.__kvMishap(s);                   // the record turned the roll away: make it part of the game
    };
    setInterval(function(){
      try {
        var s = me(); if (!s) return;
        var mv = window.KV_MOVES || [];
        if (seenI === null){ seenI = 0; for (var k = 0; k < mv.length; k++) if (mv[k] && mv[k].__acked) seenI = Math.max(seenI, k); return; }   // only rolls from now on
        for (var i = seenI + 1; i < mv.length; i++){
          var r = mv[i]; if (!r || !r.__acked) break;
          seenI = i;
          if (false && String(r.a) === "roll" && +r.s === +s){   /* recorded rolls: nothing extra, by design */
            var dv = (r.d1 != null && r.d2 != null) ? (r.d1 + " + " + r.d2 + " = " + (+r.d1 + +r.d2)) : ("rolled " + r.v);
            var d = toast("<b style='font:900 15px monospace;color:" + (COL[s] || "#f0c860") + "'>✓ ROLL RECORDED</b><br><span style='font:400 11px monospace;color:#e8dcc0'>" + dv + "</span>", 1500);
            d.style.borderColor = COL[s] || "#caa64c"; d.style.top = "30%";
          }
        }
      } catch(e){}
    }, 250);
    // the relay or the turn gate turned our own roll away
    setInterval(function(){
      var f = window.KV_LOG; if (!f || f.__kvFb) return;
      var g = function(m){
        try {
          var s = me(), t = String(m || ""), x;
          if (s && (x = t.match(/^dropped P(\d) roll — (.*)$/)) && +x[1] === +s) window.__kvRollNo(x[2]);
          else if (s && (x = t.match(/^relay refused roll P(\d)/)) && +x[1] === +s) window.__kvRollNo("the relay did not take it — syncing");
        } catch(e){}
        return f.apply(this, arguments);
      };
      g.__kvFb = 1; window.KV_LOG = g;
    }, 300);
  })();

  // ---- __KV_V417_ONEROLL: one roll per turn on your screen ----
  // Your own taps on Roll only count when the chain says it is your turn and you have not rolled yet.
  // Extra taps used to move your piece again locally (the chain kept one roll, then a resync pulled you
  // back), so the board showed two or three moves. Replays of other players (synthetic clicks) pass.
  (function(){
    function chainTurn(me){
      var mv = (window.KV_MOVES || []), M = window.KV_MP2 || {}, lr = null, lri = -1;
      for (var i = mv.length - 1; i >= 0; i--){ var r = mv[i]; if (r && String(r.a) === "roll" && (r.__acked || (r.__sent && +r.s === +me))){ lr = r; lri = i; break; } }
      if (!lr){ var op = M.opener || null; return { exp: op, rolled: false }; }
      var closed = false;
      for (var j = lri + 1; j < mv.length; j++){ var q = mv[j]; if (q && q.__acked && +q.s === +lr.s && /^(buy|pass|end|court)$/.test(String(q.a))){ closed = true; break; } }
      if (!closed) return { exp: +lr.s, rolled: +lr.s === +me };
      return { exp: (+lr.s % 4) + 1, rolled: false };
    }
    function isRoll(el){
      if (!el || !el.closest) return false;
      if (el.closest("#kvbigroll")) return true;
      var c = el.closest("div[data-i],button"); return !!(c && /^\s*▸?\s*Roll\b|^ROLL$/i.test((c.textContent || "").trim()));
    }
    var lastNote = 0;
    function guard(e){
      try {
        if (!e.isTrusted) return;                                                   // engine replays are synthetic
        var M = window.KV_MP2; if (!(M && M.room && M.started)) return;
        if (!isRoll(e.target)) return;
        var me = M.seat, st = chainTurn(me);
        if (st.exp == null) return;                                                 // opener not known yet: leave it
        if (st.exp === me && !st.rolled) return;                                    // your turn, first roll: go
        e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        if (Date.now() - lastNote > 1500 && e.type === "click"){
          lastNote = Date.now();
          if (window.__kvRollNo) window.__kvRollNo(st.rolled ? "you already rolled — finish your turn" : ("waiting for P" + st.exp + "…")); else toast(st.rolled ? "You already rolled — finish your turn" : ("Waiting for P" + st.exp + "…"), 1300);
        }
      } catch(x){}
    }
    ["pointerdown", "mousedown", "touchstart", "pointerup", "mouseup", "touchend", "click"].forEach(function(t){ document.addEventListener(t, guard, true); });
  })();

  // ---- __KV_V417_QUIET: sync housekeeping stays in COPY LOG, off the player's screen ----
  (function(){
    var TECH = /RESYNC|resyncing|drifted|dropped P\d|self-heal|half-open|holding your roll|stall-scan|failsafe|relay divergence|reads pinned|fan-out|corrected dice|turnlock|blocked an outside|blocked P\d|cleared a stale|stuck modal|orderer|append: adopted|adopted (snapshot|relay)|engine (on|lagging|untouched)|mid-fuse|lag breaker|chain expects|the chain is on|clock re-anchored|relay (refused|nodes|:)|node discovery|chain polling|final bell — the chain|state updated from|update after move|adopted \w+ P\d @|armed —|observe mode|systems ok|^offers: |KV_RELAY|composer removed|retired —|derived from the chain|posts to the chain|play by play ready/i;
    function scrub(n){
      try { if (n && n.nodeType === 1 && n.tagName === "DIV" && /border-left:\s*4px solid/.test(n.getAttribute("style") || "") && TECH.test(n.textContent || "")) n.style.display = "none"; } catch(e){}
    }
    try {
      new MutationObserver(function(ms){ ms.forEach(function(m){ for (var i = 0; i < m.addedNodes.length; i++) scrub(m.addedNodes[i]); }); })
        .observe(document.body, { childList: true, subtree: true });
    } catch(e){}
  })();

  // ---- __KV_V417_RENO: renovate works on your own turn + "your turn" alert when you come back ----
  function chime2(){
    try {
      var A = window.AudioContext || window.webkitAudioContext; if (!A) return;
      var c = window.__kvStartAC || (window.__kvStartAC = new A()); if (c.state === "suspended") c.resume();
      [[880, 0], [1175, 0.14]].forEach(function(n){
        var o = c.createOscillator(), g = c.createGain(); o.type = "square"; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, c.currentTime + n[1]); g.gain.exponentialRampToValueAtTime(0.1, c.currentTime + n[1] + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + n[1] + 0.12);
        o.connect(g); g.connect(c.destination); o.start(c.currentTime + n[1]); o.stop(c.currentTime + n[1] + 0.14);
      });
    } catch(e){}
  }
  function dlgText(){ try { var D = window.DLG; return D ? JSON.stringify(D).slice(0, 400) : ""; } catch(e){ return ""; } }
  // a) the "Tap to roll" prompt pauses the engine, so a renovation tapped on your own turn sat
  //    queued until you rolled. Step the prompt aside for one beat: the renovation applies, then
  //    the engine asks for your roll again. Buy/Pass and other choices are never touched.
  setInterval(function(){
    var f = window.KV_RENOVATE; if (!f || f.__kvReno) return;
    var g = function(t){
      var r = f.apply(this, arguments);
      try {
        var fl = (window.KV_FLAGS && window.KV_FLAGS()) || {};
        if (window.DLG && fl.renov === t && /Tap to roll/i.test(dlgText())){
          window.DLG = null; try { hideDialogue(); } catch(e){}
          if (window.KV_SETSTATE) window.KV_SETSTATE("asked", 0);
        } else if (window.DLG && fl.renov === t){
          toast("Renovation queued<br><span style='font:400 11px monospace;color:#e8dcc0'>it starts as soon as you choose</span>", 2200);
        }
      } catch(e){}
      return r;
    };
    g.__kvReno = true; window.KV_RENOVATE = g;
  }, 300);
  // b) back from a break and it is already your turn: say so
  setTimeout(function(){ if (!(window.__kvBack && window.__kvBack.rejoined)) return;
    var told = false, t0 = Date.now(), iv2 = setInterval(function(){
      if (told || Date.now() - t0 > 45000){ clearInterval(iv2); return; }
      var M = window.KV_MP2, fl = (window.KV_FLAGS && window.KV_FLAGS()) || {};
      if (!(M && M.started && M.seat) || chainMoves().length === 0) return;
      if (Date.now() - t0 < 2500) return;                                              // let the catch-up land first
      told = true; clearInterval(iv2);
      if (+fl.turn === +M.seat){
        var col = {1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"}[M.seat] || "#f0c860";
        var d = toast("<div style='font:900 24px Impact,sans-serif;letter-spacing:2px'>YOUR TURN</div><span style='font:400 11px monospace;color:#e8dcc0'>you're back in - roll when ready</span>", 2600);
        d.style.borderColor = col; chime2();
        try { if (navigator.vibrate) navigator.vibrate([100, 50, 100]); } catch(e){}
        try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ kvhaptic: "turn" })); } catch(e){}
      }
    }, 400);
  }, 0);

  // ---- __KV_V417_SYNC: show when a turn is being resumed / caught up, chime when it lands on you ----
  (function(){
    var pill = null, hideT = 0;
    var COLS = {1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};
    function show(txt, seat){
      if (!pill){
        pill = document.createElement("div");
        pill.style.cssText = "position:fixed;left:50%;top:46px;transform:translateX(-50%);z-index:2147483500;pointer-events:none;" +
          "background:rgba(20,16,12,.92);color:#f4e4c1;border:1px solid #caa64c;border-radius:14px;padding:4px 12px;font:700 11px monospace;" +
          "white-space:nowrap;box-shadow:0 3px 12px rgba(0,0,0,.5);transition:opacity .3s;opacity:0";
        document.body.appendChild(pill);
      }
      pill.innerHTML = "<span style='display:inline-block;animation:kvspin 1s linear infinite'>⟳</span> " + txt;
      pill.style.borderColor = COLS[seat] || "#caa64c";
      pill.style.opacity = "1";
      clearTimeout(hideT); hideT = setTimeout(function(){ if (pill) pill.style.opacity = "0"; }, 2500);
    }
    var st = document.createElement("style"); st.textContent = "@keyframes kvspin{to{transform:rotate(360deg)}}";
    (document.head || document.documentElement).appendChild(st);
    function chime(){
      try {
        var A = window.AudioContext || window.webkitAudioContext; if (!A) return;
        var c = window.__kvStartAC || (window.__kvStartAC = new A()); if (c.state === "suspended") c.resume();
        [[784, 0], [1047, 0.12]].forEach(function(n){
          var o = c.createOscillator(), g = c.createGain(); o.type = "triangle"; o.frequency.value = n[0];
          g.gain.setValueAtTime(0.0001, c.currentTime + n[1]); g.gain.exponentialRampToValueAtTime(0.14, c.currentTime + n[1] + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + n[1] + 0.18);
          o.connect(g); g.connect(c.destination); o.start(c.currentTime + n[1]); o.stop(c.currentTime + n[1] + 0.2);
        });
      } catch(e){}
      try { if (navigator.vibrate) navigator.vibrate(90); } catch(e){}
      try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ kvhaptic: "turn" })); } catch(e){}
    }
    function seen(txt){
      txt = String(txt || ""); var m;
      if (/^YOUR TURN/.test(txt)){ chime(); return; }
      if (/RESYNC|resyncing|self-heal|half-open turn|holding your roll|drifted/.test(txt)){
        m = txt.match(/engine to P(\d)/) || txt.match(/closing P(\d)/) || txt.match(/chain (?:expects|is on) P(\d)/) || txt.match(/\((P\d)\)/);
        var s = m ? +String(m[1]).replace("P", "") : 0;
        var me = window.KV_MP2 && window.KV_MP2.seat;
        show(s ? (s === me ? "catching up — your turn is resuming" : "catching up — resuming P" + s + "'s turn") : "catching up with the table…", s);
      }
    }
    setInterval(function(){
      var f = window.KV_LOG; if (!f || f.__kvSyncWrap) return;
      var g = function(txt){ try { if (window.KV_MP2 && window.KV_MP2.room) seen(txt); } catch(e){} return f.apply(this, arguments); };
      g.__kvSyncWrap = true; window.KV_LOG = g;
    }, 200);
  })();

  // ---- __KV_V417_START: tell every player the moment the game starts ----
  (function(){
    var was = null;
    function beep(){
      try {
        var A = window.AudioContext || window.webkitAudioContext; if (!A) return;
        var c = window.__kvStartAC || (window.__kvStartAC = new A()); if (c.state === "suspended") c.resume();
        [[660, 0], [880, 0.16], [1175, 0.32]].forEach(function(n){
          var o = c.createOscillator(), g = c.createGain(); o.type = "square"; o.frequency.value = n[0];
          g.gain.setValueAtTime(0.0001, c.currentTime + n[1]); g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + n[1] + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + n[1] + 0.14);
          o.connect(g); g.connect(c.destination); o.start(c.currentTime + n[1]); o.stop(c.currentTime + n[1] + 0.16);
        });
      } catch(e){}
    }
    // unlock audio on the first tap (iPhone only plays sound after a touch)
    ["pointerdown", "touchstart"].forEach(function(t){ document.addEventListener(t, function u(){ try { var A = window.AudioContext || window.webkitAudioContext; if (A && !window.__kvStartAC) window.__kvStartAC = new A(); if (window.__kvStartAC) window.__kvStartAC.resume(); } catch(e){} }, { once: true, capture: true }); });
    setInterval(function(){
      var M = window.KV_MP2; if (!(M && M.room)) { was = null; return; }
      var now = !!M.started;
      if (was === false && now){
        var inPlay = (window.KV_MOVES || []).some(function(m){ return m && m.__acked && String(m.a) === "roll"; });
        if (!inPlay && !(window.__kvBack && window.__kvBack.rejoined)){
          var me = M.seat || "?", col = {1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"}[me] || "#f0c860";
          var d = document.createElement("div");
          d.style.cssText = "position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);z-index:2147483600;background:#14100c;border:3px solid " + col +
            ";border-radius:12px;padding:14px 26px;text-align:center;box-shadow:0 8px 28px rgba(0,0,0,.7);pointer-events:none";
          d.innerHTML = "<div style='font:900 30px Impact,sans-serif;letter-spacing:3px;color:#f0c860'>GAME ON!</div>" +
            "<div style='font:700 14px monospace;color:" + col + ";margin-top:4px'>you are P" + me + "</div>";
          document.body.appendChild(d); setTimeout(function(){ try { d.remove(); } catch(e){} }, 2600);
          beep();
          try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch(e){}
          try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ kvhaptic: "start" })); } catch(e){}
        }
      }
      was = now;
    }, 250);
  })();

  // ---- __KV_V417_BACK: smooth leave / smooth return ----
  // a) a phone that leaves and comes back must not throw the roll-off again: once the chain
  //    has the seat's roll-for-first (or play has started) a new "first" is dropped locally
  function chainMoves(){ return (window.KV_MOVES || []).filter(function(m){ return m && m.__acked; }); }
  function rolloffClosedFor(seat, value){
    var mv = chainMoves();
    if (mv.some(function(m){ return String(m.a) === "roll"; })) return true;           // play has started
    var mine = mv.filter(function(m){ return String(m.a) === "first" && +m.s === +seat; });
    var L = ((window.KV_MP2 && window.KV_MP2.firstList) || {})[seat] || [];
    return Math.max(mine.length, L.length) > 0 && __kvBack.rejoined;                    // a rejoin re-throwing a roll it already made
  }
  var __kvBack = window.__kvBack = { rejoined: false };
  setInterval(function(){
    var f = window.KV_MOVE; if (!f || f.__kvBackGuard) return;
    var g = function(seat, action, value){
      if (String(action) === "first" && window.KV_MP2 && window.KV_MP2.room && rolloffClosedFor(seat, value)) return;   // already on the chain
      return f.apply(this, arguments);
    };
    g.__kvBackGuard = true; window.KV_MOVE = g;
  }, 200);

  // b) keep the "last table" fresh while playing, and forget it once the game is sealed
  setInterval(function(){
    try {
      var M = window.KV_MP2; if (!(M && M.room && M.started)) return;
      if (chainMoves().some(function(m){ return String(m.a) === "end_game"; })){ localStorage.removeItem("kv_last_table"); return; }
      var o = JSON.parse(localStorage.getItem("kv_last_table") || "null");
      if (o && o.room === M.room){ o.at = Date.now(); localStorage.setItem("kv_last_table", JSON.stringify(o)); }
    } catch(e){}
  }, 15000);

  // c) coming back: no menu - straight back to your seat, with a short "welcome back"
  function toast(txt, ms){
    var d = document.createElement("div");
    d.style.cssText = "position:fixed;left:50%;top:44%;transform:translate(-50%,-50%);z-index:2147483600;background:#14100c;color:#f0c860;" +
      "border:2px solid #caa64c;border-radius:10px;padding:10px 18px;font:700 14px monospace;text-align:center;box-shadow:0 6px 20px rgba(0,0,0,.6)";
    d.innerHTML = txt; document.body.appendChild(d);
    setTimeout(function(){ try { d.remove(); } catch(e){} }, ms || 2500); return d;
  }
  try {
    var boot = JSON.parse(localStorage.getItem("kv_mp2") || "null");
    if (boot && boot.room && boot.back){
      __kvBack.rejoined = true;
      var t = toast("Welcome back<br><span style='font:400 11px monospace;color:#e8dcc0'>catching up on table " + boot.room + "…</span>", 6000);
      var w = setInterval(function(){ if (chainMoves().length > 0 && window.KV_MP2 && window.KV_MP2.started){ clearInterval(w); setTimeout(function(){ try { t.remove(); } catch(e){} }, 900); } }, 300);
    }
  } catch(e){}
  (function(){
    var tries = 0, iv = setInterval(function(){
      if (++tries > 40) { clearInterval(iv); return; }                                  // ~8s: the start screen never showed
      var ov = window.__KV_LOBBY_OV; if (!ov || !ov.parentNode) return;
      var b = [].filter.call(ov.querySelectorAll("button"), function(x){ return /Rejoin table kc/.test(x.textContent.trim()); })[0];
      if (!b) return;
      clearInterval(iv);
      var o = null; try { o = JSON.parse(localStorage.getItem("kv_last_table") || "null"); } catch(e){}
      if (!o || !o.room || Date.now() - o.at > 10 * 60e3) return;                        // older than a game: let them choose
      if (o.autoAt && Date.now() - o.autoAt < 60e3) return;                              // just tried: never loop
      o.autoAt = Date.now(); try { localStorage.setItem("kv_last_table", JSON.stringify(o)); } catch(e){}
      var cancel = false, n = 3;
      var t = toast("Back to your seat in <b id='kvbn'>3</b>…<br><button id='kvbc' style='margin-top:8px;padding:5px 14px;background:#2a2118;color:#f0c860;border:1px solid #6a5a34;border-radius:6px;font:700 12px monospace;cursor:pointer'>stay on menu</button>", 4000);
      var c = t.querySelector("#kvbc"); if (c) c.onclick = function(e){ e.stopPropagation(); cancel = true; try { t.remove(); } catch(x){} };
      var cd = setInterval(function(){
        if (cancel){ clearInterval(cd); return; }
        if (--n > 0){ var e = t.querySelector("#kvbn"); if (e) e.textContent = n; return; }
        clearInterval(cd);
        b.click();                                                                       // the lobby's own rejoin (it reloads in 200ms)
        try { localStorage.setItem("kv_mp2", JSON.stringify({ room: o.room, role: o.role, back: 1 })); } catch(e){}
      }, 1000);
    }, 200);
  })();
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
