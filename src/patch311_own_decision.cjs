// patch311_own_decision.cjs — after your own roll lands on the chain, the turn needs a buy/pass to
// close. With the composer gone and the engine's prompt path unreliable under the funnel, that step
// had no owner, so the game stalled on the human's turn.
//
// This surfaces a BUY/PASS control whenever the chain shows OUR seat has rolled and not closed, and
// posts the choice (plus "end") to the chain. It defers to the engine's own prompt if one is visible,
// so normal play is unchanged when the engine does surface it.
// SRC showcase_kascity310.html -> DST showcase_kascity311.html
const fs = require("fs");
const SRC = "showcase_kascity310.html";
const DST = "showcase_kascity311.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const APPEND = `
<script>
// ---- __KV_V311: our own seat's buy/pass, posted to the chain ----
(function(){
  var panel = null, shownKey = null, busy = false;

  function M(){ return window.KV_MP2; }
  function flags(){ return (window.KV_FLAGS && window.KV_FLAGS()) || {}; }
  function cashOf(p){
    var v = null;
    try { v = window.KV_SEAT && window.KV_SEAT(p, "cash"); } catch(e){}
    if (v == null) v = flags()["cash" + p];
    return v == null ? 0 : Math.round(v);
  }

  // our seat has an open roll on the chain?
  function openRoll(){
    var m = M(); if (!m || !m.started) return null;
    var mv = window.KV_MOVES || [], lastRoll = null;
    for (var i = mv.length - 1; i >= 0; i--){
      var r = mv[i]; if (!r || !r.__acked) continue;
      if (String(r.a) === "roll"){ lastRoll = r; break; }
    }
    if (!lastRoll || lastRoll.s !== m.seat) return null;
    for (var j = 0; j < mv.length; j++){
      var q = mv[j]; if (!q || !q.__acked) continue;
      if (q.i <= lastRoll.i) continue;
      if (q.s === lastRoll.s && /^(buy|pass|end)$/.test(String(q.a))) return null;   // already closed
    }
    return lastRoll;
  }

  function ensure(){
    if (panel) return panel;
    panel = document.createElement("div");
    panel.style.cssText = "position:fixed;left:12px;bottom:120px;z-index:95;display:none;gap:8px;";
    document.body.appendChild(panel);
    return panel;
  }

  function hide(){ if (panel){ panel.style.display = "none"; } shownKey = null; }

  function show(seat, pos){
    var N = window.KV_NAMES || {};
    var owner = null;
    try { owner = (pos != null && window.KV_OWNER) ? window.KV_OWNER(pos) : null; } catch(e){}
    var price = 0;
    try { price = (pos != null && N[pos]) ? ((window.KV_INTRINSIC && window.KV_INTRINSIC(pos)) || N[pos].p || 0) : 0; } catch(e){}
    var canBuy = (pos != null && N[pos] && !owner && price > 0 && cashOf(seat) >= price);

    var p = ensure();
    p.innerHTML = "";
    p.style.display = "flex";

    function btn(label, colour, onClick){
      var b = document.createElement("button");
      b.textContent = label;
      b.style.cssText = "padding:12px 20px;background:#22303a;color:" + colour +
        ";border:2px solid " + colour + ";border-radius:8px;font:14px monospace;cursor:pointer;" +
        "box-shadow:0 4px 18px rgba(0,0,0,.5);";
      b.onclick = function(ev){
        ev.stopPropagation();
        if (busy) return;
        busy = true;
        hide();
        try { onClick(); } catch(e){}
        setTimeout(function(){ busy = false; }, 1500);
      };
      p.appendChild(b);
    }

    function close(action, value){
      if (!window.KV_MOVE) return;
      window.KV_MOVE(seat, action, value);
      setTimeout(function(){
        try { if (window.KV_MOVE) window.KV_MOVE(seat, "end", seat); } catch(e){}
      }, 600);
    }

    if (canBuy){
      btn("BUY " + ((N[pos] && N[pos].n) || ("block " + pos)) + " \\u00b7 " + price, "#9cd87c",
          function(){ close("buy", pos); });
    }
    btn("PASS", "#caa64c", function(){ close("pass", 0); });
  }

  setInterval(function(){
    try{
      var m = M();
      if (!m || !m.room || !m.started || m.halted || window.KV_SEALED){ hide(); return; }
      var lr = openRoll();
      if (!lr){ hide(); return; }
      // if the engine is already asking, let it
      var prompt = document.querySelector("div[data-i]");
      if (prompt && (prompt.offsetWidth || prompt.offsetHeight)){
        var txt = "";
        try { txt = prompt.parentElement.parentElement.textContent || ""; } catch(e){}
        if (/buy|pass|deed|block/i.test(txt)){ hide(); return; }
      }
      var pos = flags()["p" + m.seat];
      var key = m.seat + "/" + lr.i + "/" + pos;
      if (key === shownKey) return;
      shownKey = key;
      show(m.seat, pos);
    }catch(e){}
  }, 900);

  if (window.KV_LOG) window.KV_LOG("your buy/pass posts to the chain","#9cd87c");
})();
</script>
`;

s = s + APPEND;
fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
