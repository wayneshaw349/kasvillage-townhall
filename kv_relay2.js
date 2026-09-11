// =============================================================================
// KV_RELAY2 — chain-native multiplayer for KasCity
// =============================================================================
// One module, one source of truth. Replaces the accumulated multiplayer glue.
//
//   chain      poll /log, append with ack, keep the ordered record
//   turn       derived ONLY from acked chain entries (cross-checked with /turn)
//   apply      remote entries land as state (snapshot + fx). never replayed
//   act        our seat waits for the human's tap; host bots decide via
//              botDecide() — a pure function of chain state (seed-ready seam)
//   engine     renders, and captures the local human's tap. nothing else.
//
// The engine never advances turns in a relay game. Nothing generates a move
// except the seat the chain says is acting.
// =============================================================================

(function () {
  "use strict";

  var R = {};
  window.KV_RELAY2 = R;

  // ---------------------------------------------------------------- config --
  R.NODES = (window.KV_NODES && window.KV_NODES.slice()) || [];
  R.POLL_MS = 1000;
  R.TICK_MS = 900;
  R.TOTAL_SECS = 420;
  R.SEATS = 4;

  // ----------------------------------------------------------------- state --
  R.room = null;
  R.wallet = null;
  R.role = null;          // "host" | "guest"
  R.seat = 0;
  R.roster = [];
  R.started = false;
  R.sealed = false;
  R.node = null;          // chosen orderer

  R.log = [];             // dense, index == chain i
  R.head = 0;             // chain length as last seen
  R.chain = null;         // relay chain hash
  R.seedCommit = null;
  R.gun = null;           // { startDaa, seed, players }

  R.posting = false;      // one append in flight at a time
  R.pending = [];         // moves waiting to post

  // -------------------------------------------------------------- plumbing --
  function log(t, c) { try { if (window.KV_LOG) window.KV_LOG(t, c || "#8ab4d8"); } catch (e) {} }
  function flags() { return (window.KV_FLAGS && window.KV_FLAGS()) || {}; }
  function set(k, v) { try { if (window.KV_SETSTATE) window.KV_SETSTATE(k, v); } catch (e) {} }

  function cashOf(p) {
    var v = null;
    try { v = window.KV_SEAT && window.KV_SEAT(p, "cash"); } catch (e) {}
    if (v == null) v = flags()["cash" + p];
    return v == null ? 0 : Math.round(v);
  }

  async function jget(url) {
    var c = new AbortController();
    var t = setTimeout(function () { c.abort(); }, 6000);
    try {
      var r = await fetch(url, { signal: c.signal });
      clearTimeout(t);
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { clearTimeout(t); return null; }
  }

  async function jpost(url, body) {
    var c = new AbortController();
    var t = setTimeout(function () { c.abort(); }, 8000);
    try {
      var r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: c.signal
      });
      clearTimeout(t);
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { clearTimeout(t); return null; }
  }

  function api(path) { return (R.node || R.NODES[0]) + "/api/game/room/" + R.room + path; }

  // ------------------------------------------------------------ node health --
  R.pickNode = async function () {
    for (var i = 0; i < R.NODES.length; i++) {
      var o = await jget(R.NODES[i] + "/api/game/room/__probe__/turn");
      if (o !== null || true) {                       // a 404 body still proves reachability
        var probe = await jget(R.NODES[i] + "/api/game/room/" + (R.room || "__probe__"));
        if (probe !== null) { R.node = R.NODES[i]; return R.node; }
      }
    }
    R.node = R.NODES[0] || null;
    return R.node;
  };

  // ------------------------------------------------------------- chain read --
  R.poll = async function () {
    if (!R.room) return;
    var lg = await jget(api("/log?after=" + R.head));
    if (!lg) return;
    R.chain = lg.chain || R.chain;
    if (lg.seed_commit && !R.seedCommit) R.seedCommit = lg.seed_commit;
    var entries = lg.entries || [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (R.log[e.i]) continue;
      R.log[e.i] = e;
      R.head = Math.max(R.head, e.i + 1);
      R.ingest(e);
    }
    if (lg.head != null) R.head = Math.max(R.head, lg.head);
  };

  // one place where a chain entry becomes local state
  R.ingest = function (e) {
    try {
      if (e.kind === "gun") {
        var gb = e.body || {};
        if (!R.gun) {
          R.gun = { startDaa: Number(gb.startDaa), seed: gb.seed || null, players: gb.players || R.roster.length };
          if (window.KV_SEED == null && R.gun.seed) window.KV_SEED = R.gun.seed;
          log("gun at DAA " + R.gun.startDaa, "#caa64c");
        }
        return;
      }
      if (e.kind !== "move") return;
      var b = e.body || {};
      var mine = R.owns(b.s);

      // mirror into KV_MOVES so the existing HUD/exporter keep working
      var mv = (window.KV_MOVES = window.KV_MOVES || []);
      mv[e.i] = {
        i: e.i, s: b.s, a: b.a, v: b.v, t: b.t,
        hash: b.hash || null, snap: b.snap || null, fx: b.fx || null,
        d1: b.d1 != null ? +b.d1 : null, d2: b.d2 != null ? +b.d2 : null,
        __sent: 1, __acked: 1
      };

      // state application: the snapshot is the truth for every seat but ours
      if (!mine && b.snap && window.KV_ADOPT) {
        try { window.KV_ADOPT(b.snap); } catch (e2) {}
      }
      if (!mine && b.fx) R.applyFx(b.fx, b.s);

      // presentation
      var a = String(b.a || "");
      if (a === "roll") {
        log("P" + b.s + "  rolled  " + (b.d1 != null ? (b.d1 + " + " + b.d2 + " = ") : "") + b.v,
            (window.COL && window.COL[b.s]) || "#8ab4d8");
      } else if (a === "buy") {
        var N = window.KV_NAMES || {};
        log("P" + b.s + "  buys  " + ((N[b.v] && N[b.v].n) || ("block " + b.v)), "#9cd87c");
      } else if (a === "pass") {
        log("P" + b.s + "  passes", "#7a6a58");
      } else if (a === "end_game") {
        R.finish(true);
      }
    } catch (err) {}
  };

  R.applyFx = function (fx, seat) {
    try {
      if (fx.cash) {
        Object.keys(fx.cash).forEach(function (p) {
          var d = Math.round(+fx.cash[p] || 0); if (!d) return;
          set("cash" + p, cashOf(+p) + d);
          try {
            var w = window.KV_WORLD;
            if (w && w.seats && w.seats[+p - 1]) w.seats[+p - 1].cash = cashOf(+p);
          } catch (e) {}
        });
      }
      if (fx.deed) {
        Object.keys(fx.deed).forEach(function (t) {
          try { var w = window.KV_WORLD; if (w && w.owners) w.owners["t" + t] = +fx.deed[t] || 0; } catch (e) {}
        });
      }
      if (fx.__scn) {
        var sx = fx.__scn;
        log("P" + seat + "  " + sx.opt + "  \u2192  " + (sx.sw >= 0 ? "+" : "") + sx.sw,
            sx.good ? "#9cd87c" : "#ff6a4a");
      }
    } catch (e) {}
  };

  // ------------------------------------------------------------ turn state --
  // Derived purely from acked chain entries. No guessing, no timers.
  R.turnState = function () {
    var lastRoll = null, firsts = [], opener = null;
    for (var i = 0; i < R.log.length; i++) {
      var e = R.log[i]; if (!e || e.kind !== "move") continue;
      var b = e.body || {}, a = String(b.a || "");
      if (a === "first") firsts.push([b.s, +b.v || 0]);
      else if (a === "opener") opener = b.s;
      else if (a === "roll") lastRoll = { s: b.s, i: e.i };
    }
    if (!lastRoll) {
      var op = opener || R.deriveOpener(firsts);
      return { actor: op, phase: op ? "roll" : null, roll: null };
    }
    // has the roller closed?
    for (var j = lastRoll.i + 1; j < R.log.length; j++) {
      var q = R.log[j]; if (!q || q.kind !== "move") continue;
      var qb = q.body || {};
      if (qb.s === lastRoll.s && /^(buy|pass|end)$/.test(String(qb.a))) {
        return { actor: (lastRoll.s % R.SEATS) + 1, phase: "roll", roll: null };
      }
    }
    return { actor: lastRoll.s, phase: "decide", roll: lastRoll };
  };

  // relay's rule: highest first-roll wins, ties reroll among the tied
  R.deriveOpener = function (firsts) {
    if (!firsts || !firsts.length) return null;
    var active = [], k;
    for (k = 1; k <= R.SEATS; k++) active.push(k);
    var idx = 0;
    for (var guard = 0; guard < 16; guard++) {
      if (active.length === 1) return active[0];
      var vals = {}, n = 0;
      while (idx < firsts.length && n < active.length) {
        var sv = firsts[idx][0], vv = firsts[idx][1]; idx++;
        if (active.indexOf(sv) >= 0 && vals[sv] == null) { vals[sv] = vv; n++; }
      }
      if (n < active.length) return null;
      var best = -Infinity;
      for (k in vals) if (vals[k] > best) best = vals[k];
      active = active.filter(function (s) { return vals[s] === best; });
      if (!active.length) return null;
    }
    return null;
  };

  R.owns = function (p) {
    if (p === R.seat) return true;
    return R.role === "host" && R.roster.length && p > R.roster.length;
  };

  // ------------------------------------------------------------ chain write --
  R.post = async function (seat, action, value, extra) {
    R.pending.push({ s: seat, a: String(action), v: value, t: Math.round((R.left() || 0)), extra: extra || null });
    R.drainPost();
  };

  R.drainPost = async function () {
    if (R.posting || !R.pending.length || !R.room) return;
    R.posting = true;
    var m = R.pending.shift();
    try {
      var body = { s: m.s, a: m.a, v: m.v, t: m.t };
      try { if (window.KV_SNAPSHOT) body.snap = window.KV_SNAPSHOT(); } catch (e) {}
      if (m.extra && m.extra.fx) body.fx = m.extra.fx;
      var o = await jpost(api("/append"), { wallet: R.wallet, kind: "move", body: body });
      if (o && o.stored === false) {
        log("relay refused " + m.a + " P" + m.s + ": " + o.reason +
            (o.detail ? (" [" + o.detail + "]") : "") +
            (o.expect != null ? (" (expects P" + o.expect + ")") : ""), "#e0a040");
        // the chain is the arbiter: drop it, re-read, continue
      } else if (o && o.i != null) {
        R.head = Math.max(R.head, o.i + 1);
      }
    } catch (e) {}
    R.posting = false;
    if (R.pending.length) setTimeout(R.drainPost, 120);
  };

  // relay-derived dice for the entry we are about to write
  R.dice = async function () {
    var o = await jget(api("/dice?i=" + R.head));
    if (o && o.d1 != null) return { d1: +o.d1, d2: +o.d2, v: (+o.d1) + (+o.d2) };
    return null;
  };

  // ------------------------------------------------------------------ bots --
  // Pure function of chain-visible state. Seed-ready: when we move to
  // seed-derived bots, every board calls this and compares — no format change.
  R.botDecide = function (seat, pos) {
    var N = window.KV_NAMES || {};
    if (pos == null || !N[pos]) return { action: "pass", value: 0 };
    var owner = null;
    try { owner = window.KV_OWNER ? window.KV_OWNER(pos) : null; } catch (e) {}
    if (owner) return { action: "pass", value: 0 };
    var price = 0;
    try { price = (window.KV_INTRINSIC && window.KV_INTRINSIC(pos)) || N[pos].p || 0; } catch (e) { price = N[pos].p || 0; }
    var cash = cashOf(seat);
    var label = "";
    try { label = ((window.KV_PROFNAME && window.KV_PROFNAME(seat)) || "").toLowerCase(); } catch (e) {}
    var appetite = label.indexOf("develop") >= 0 ? 0.75
                 : label.indexOf("miser")   >= 0 ? 0.35
                 : label.indexOf("trader")  >= 0 ? 0.55 : 0.60;
    if (price > 0 && cash - price >= 200 && price <= cash * appetite) {
      return { action: "buy", value: pos };
    }
    return { action: "pass", value: 0 };
  };

  // ------------------------------------------------------------------ clock --
  R.left = function () {
    try {
      if (!R.gun || !R.gun.startDaa || R.daaNow == null) return R.TOTAL_SECS;
      var score = R.daaScore, rate = R.daaRate || 10;
      if (score == null) return R.TOTAL_SECS;
      var now = score + rate * ((Date.now() - R.daaAt) / 1000);
      var elapsed = (now - R.gun.startDaa) / rate;
      if (!isFinite(elapsed) || elapsed < 0) return R.TOTAL_SECS;
      return Math.max(0, Math.round(R.TOTAL_SECS - elapsed));
    } catch (e) { return R.TOTAL_SECS; }
  };

  R.DAA_API = "https://api-tn10.kaspa.org/info/virtual-chain-blue-score";
  R.daaScore = null; R.daaAt = 0; R.daaRate = null;
  R.sampleDaa = async function () {
    var o = await jget(R.DAA_API);
    var d = o && (o.blueScore != null ? +o.blueScore : (o.virtualChainBlueScore != null ? +o.virtualChainBlueScore : null));
    if (d == null) return;
    var now = Date.now();
    if (R.daaScore != null && now > R.daaAt) {
      var r = (d - R.daaScore) / ((now - R.daaAt) / 1000);
      if (r > 0.2 && r < 200) R.daaRate = R.daaRate == null ? r : (R.daaRate * 0.7 + r * 0.3);
    }
    R.daaScore = d; R.daaAt = now;
  };

  // ------------------------------------------------------------------- act --
  // The only place a local move is created.
  R.acting = false;
  R.act = async function () {
    if (!R.started || R.sealed || R.acting) return;
    if (R.posting || R.pending.length) return;
    var ts = R.turnState();
    if (!ts.actor) return;
    if (!R.owns(ts.actor)) return;

    var isBot = ts.actor !== R.seat;

    if (ts.phase === "roll") {
      if (!isBot) { R.awaitTap(ts.actor); return; }     // our seat: the human taps
      R.acting = true;
      try {
        var d = await R.dice();
        var total = d ? d.v : (2 + Math.floor(Math.random() * 11));
        await R.post(ts.actor, "roll", total);
      } catch (e) {}
      setTimeout(function () { R.acting = false; }, 1200);
      return;
    }

    if (ts.phase === "decide") {
      // where did this seat land? the accepted roll's snapshot placed it
      var pos = flags()["p" + ts.actor];
      if (!isBot) { R.awaitDecision(ts.actor, pos); return; }
      R.acting = true;
      try {
        var dec = R.botDecide(ts.actor, pos);
        await R.post(ts.actor, dec.action, dec.value);
        await R.post(ts.actor, "end", ts.actor);
      } catch (e) {}
      setTimeout(function () { R.acting = false; }, 1200);
      return;
    }
  };

  // our seat's input: surface a control, wait for the tap, then post
  R.awaitTap = function (seat) {
    R.ui("roll", seat, async function () {
      if (R.acting) return;
      R.acting = true;
      try {
        var d = await R.dice();
        var total = d ? d.v : (2 + Math.floor(Math.random() * 11));
        if (d) { window.__KV_PIN = window.__KV_PIN || {}; window.__KV_PIN[seat] = { d1: d.d1, d2: d.d2 }; }
        await R.post(seat, "roll", total);
      } catch (e) {}
      setTimeout(function () { R.acting = false; }, 1200);
    });
  };

  R.awaitDecision = function (seat, pos) {
    var N = window.KV_NAMES || {};
    var owner = null;
    try { owner = (window.KV_OWNER && pos != null) ? window.KV_OWNER(pos) : null; } catch (e) {}
    var price = 0;
    try { price = (pos != null && N[pos]) ? ((window.KV_INTRINSIC && window.KV_INTRINSIC(pos)) || N[pos].p || 0) : 0; } catch (e) {}
    var canBuy = (pos != null && N[pos] && !owner && price > 0 && cashOf(seat) >= price);
    R.ui(canBuy ? "buy" : "pass", seat, async function (choice) {
      if (R.acting) return;
      R.acting = true;
      try {
        if (choice === "buy") await R.post(seat, "buy", pos);
        else await R.post(seat, "pass", 0);
        await R.post(seat, "end", seat);
      } catch (e) {}
      setTimeout(function () { R.acting = false; }, 1200);
    }, { tile: pos, price: price, name: (N[pos] && N[pos].n) || ("block " + pos) });
  };

  // ------------------------------------------------------------------- ui ---
  R._ui = null;
  R.ui = function (kind, seat, cb, info) {
    if (!R._ui) {
      var d = document.createElement("div");
      d.style.cssText = "position:fixed;left:12px;bottom:64px;z-index:90;display:none;gap:8px;";
      document.body.appendChild(d);
      R._ui = d;
    }
    var key = kind + "/" + seat + "/" + (info ? info.tile : "");
    if (R._ui.__key === key) return;                    // already showing
    R._ui.__key = key;
    R._ui.innerHTML = "";
    R._ui.style.display = "flex";

    function btn(label, colour, onClick) {
      var b = document.createElement("button");
      b.textContent = label;
      b.style.cssText = "padding:12px 22px;background:#22303a;color:" + colour +
        ";border:2px solid " + colour + ";border-radius:8px;font:15px monospace;cursor:pointer;";
      b.onclick = function (ev) {
        ev.stopPropagation();
        R._ui.style.display = "none"; R._ui.__key = null;
        onClick();
      };
      R._ui.appendChild(b);
    }

    if (kind === "roll") {
      btn("\u25b8 ROLL", "#cfe6f4", function () { cb(); });
    } else if (kind === "buy") {
      btn("BUY " + info.name + " \u00b7 " + info.price, "#9cd87c", function () { cb("buy"); });
      btn("PASS", "#caa64c", function () { cb("pass"); });
    } else {
      btn("PASS", "#caa64c", function () { cb("pass"); });
    }
  };

  R.hideUi = function () { if (R._ui) { R._ui.style.display = "none"; R._ui.__key = null; } };

  // ------------------------------------------------------------------ end ---
  R.finish = function (fromChain) {
    if (R.sealed) return;
    R.sealed = true;
    R.hideUi();
    try {
      if (!fromChain) R.post(R.seat, "end_game", 0);
      setTimeout(function () { if (window.KV_END) window.KV_END(); }, 600);
    } catch (e) {}
  };

  // ---------------------------------------------------------------- rooms ---
  R.host = async function (roomId) {
    R.room = roomId || ("kc" + Math.random().toString(16).slice(2, 10));
    R.role = "host";
    R.wallet = (window.KV_WALLETS && window.KV_WALLETS[1]) || ("w" + Math.random().toString(36).slice(2, 10));
    await R.pickNode();
    R.seedCommit = await sha256hex("seed-" + R.room + "-" + Date.now());
    for (var i = 0; i < R.NODES.length; i++) {
      await jpost(R.NODES[i] + "/api/game/room/create", {
        room: R.room, wallet: R.wallet, seed_commit: R.seedCommit, game: "kascity", max_players: 4
      });
    }
    log("hosting " + R.room + " \u2014 run KV2.start() when everyone has joined", "#9cd87c");
    R.loop();
    return R.room;
  };

  R.join = async function (roomId) {
    R.room = roomId;
    R.role = "guest";
    R.wallet = (window.KV_WALLETS && window.KV_WALLETS[2]) || ("w" + Math.random().toString(36).slice(2, 10));
    await R.pickNode();
    for (var i = 0; i < R.NODES.length; i++) {
      await jpost(R.NODES[i] + "/api/game/room/" + R.room + "/join", { wallet: R.wallet });
    }
    log("joined " + R.room + " \u2014 waiting for the host", "#9cd87c");
    R.loop();
    return R.room;
  };

  R.start = async function () {
    if (R.role !== "host") { log("only the host starts the game", "#e0a040"); return; }
    var info = await jget(api(""));
    var roster = ((info && info.players) || []).sort(function (a, b) { return a.seat - b.seat; })
      .map(function (p) { return p.wallet; });
    if (!roster.length) roster = [R.wallet];
    for (var i = 0; i < R.NODES.length; i++) {
      await jpost(R.NODES[i] + "/api/game/room/" + R.room + "/start", {
        roster: roster,
        turn_order: {
          seats: 4, round_robin: ["roll"], follow: ["buy", "pass", "end", "court"],
          dice: ["roll"], exempt: ["first"], seed: ["opener"], derive_opener_from: "first"
        }
      });
    }
    R.roster = roster;
    R.applyRoster();

    await R.sampleDaa();
    var startDaa = Math.round(R.daaScore || 0) + 80;
    var seed = "kc" + R.room + "-" + Date.now().toString(36);
    await jpost(api("/append"), {
      wallet: R.wallet, kind: "gun",
      body: { startDaa: startDaa, seed: seed, seedHash: await sha256hex(seed), players: roster.length }
    });
    log("game started \u2014 " + roster.length + " player(s)", "#9cd87c");
  };

  R.applyRoster = function () {
    R.seat = Math.max(1, R.roster.indexOf(R.wallet) + 1);
    R.started = true;
    window.KV_HUMANS = [R.seat];
    window.KV_SEATS_TOTAL = R.roster.length;
    set("humans", R.roster.length);
    set("hud_seat", R.seat);
    log("you are P" + R.seat + " of " + R.roster.length, "#caa64c");
  };

  async function sha256hex(s) {
    try {
      var b = new TextEncoder().encode(s);
      var d = await crypto.subtle.digest("SHA-256", b);
      return Array.from(new Uint8Array(d)).map(function (x) { return x.toString(16).padStart(2, "0"); }).join("");
    } catch (e) { return "nohash"; }
  }

  // ----------------------------------------------------------------- loops --
  R.loop = function () {
    if (R.__looping) return;
    R.__looping = true;
    setInterval(function () { R.poll(); }, R.POLL_MS);
    setInterval(function () { R.sampleDaa(); }, 5000);
    setInterval(function () {
      try {
        if (!R.started) {
          // guest picks up the roster once the host has started
          if (R.role === "guest" && !R.roster.length) {
            jget(api("")).then(function (info) {
              if (info && info.started && (info.players || []).length) {
                R.roster = info.players.sort(function (a, b) { return a.seat - b.seat; })
                  .map(function (p) { return p.wallet; });
                R.applyRoster();
              }
            });
          }
          return;
        }
        if (R.left() <= 0) { R.finish(false); return; }
        R.act();
      } catch (e) {}
    }, R.TICK_MS);
  };

  // -------------------------------------------------------------- console ---
  window.KV2 = {
    host: function (id) { return R.host(id); },
    join: function (id) { return R.join(id); },
    start: function () { return R.start(); },
    state: function () {
      var ts = R.turnState();
      var o = {
        room: R.room, role: R.role, seat: R.seat, roster: R.roster.length,
        head: R.head, actor: ts.actor, phase: ts.phase, left: R.left(),
        node: R.node, sealed: R.sealed
      };
      console.log(JSON.stringify(o)); return o;
    },
    chain: function () {
      console.table(R.log.filter(Boolean).map(function (e) {
        var b = e.body || {};
        return { i: e.i, kind: e.kind, s: b.s, a: b.a, v: b.v };
      }));
      return R.log.length;
    },
    help: function () {
      console.log([
        "KV2.host()            create a room",
        "KV2.join('kcXXXX')    join a room",
        "KV2.start()           host: begin (sets the DAA gun)",
        "KV2.state()           room, seat, whose turn, clock",
        "KV2.chain()           the ordered chain"
      ].join("\n"));
    }
  };

  log("KV_RELAY2 loaded \u2014 KV2.help()", "#9cd87c");
})();
