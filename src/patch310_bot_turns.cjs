// patch310_bot_turns.cjs — with the composer removed, human seats play through the engine and are
// rendered from the chain, but bot seats had nothing driving them at all. The host posts them
// directly: roll (relay dice) -> buy|pass -> end. No prompts, no engine involvement, no composing
// for human seats. This is the only local move generator left besides your own tap.
// SRC showcase_kascity309.html -> DST showcase_kascity310.html
const fs = require("fs");
const SRC = "showcase_kascity309.html";
const DST = "showcase_kascity310.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const APPEND = `
<script>
// ---- __KV_V310: host-simulated bot turns, posted straight to the chain ----
(function(){
  var busy = false, lastAt = 0, lastKey = "";

  function M(){ return window.KV_MP2; }
  function flags(){ return (window.KV_FLAGS && window.KV_FLAGS()) || {}; }
  function cashOf(p){
    var v = null;
    try { v = window.KV_SEAT && window.KV_SEAT(p, "cash"); } catch(e){}
    if (v == null) v = flags()["cash" + p];
    return v == null ? 0 : Math.round(v);
  }
  function isBotSeat(p){
    var m = M();
    return !!m && m.role === "host" && m.roster.length && p > m.roster.length;
  }

  // whose turn, and at what stage, straight from the acked chain
  function chainTurn(){
    var mv = window.KV_MOVES || [], lastRoll = null, opener = null, firsts = [];
    for (var i = 0; i < mv.length; i++){
      var r = mv[i]; if (!r || !r.__acked) continue;
      var a = String(r.a || "");
      if (a === "first") firsts.push([r.s, +r.v || 0]);
      else if (a === "opener") opener = r.s;
      else if (a === "roll") lastRoll = r;
    }
    if (!lastRoll){
      var op = opener || deriveOpener(firsts);
      return op ? { seat: op, stage: "roll" } : null;
    }
    for (var j = 0; j < mv.length; j++){
      var q = mv[j]; if (!q || !q.__acked) continue;
      if (q.i <= lastRoll.i) continue;
      if (q.s === lastRoll.s && /^(buy|pass|end)$/.test(String(q.a))){
        return { seat: (lastRoll.s % 4) + 1, stage: "roll" };
      }
    }
    return { seat: lastRoll.s, stage: "decide" };
  }

  function deriveOpener(firsts){
    if (!firsts.length) return null;
    var active = [1,2,3,4], idx = 0;
    for (var g = 0; g < 16; g++){
      if (active.length === 1) return active[0];
      var vals = {}, n = 0;
      while (idx < firsts.length && n < active.length){
        var sv = firsts[idx][0], vv = firsts[idx][1]; idx++;
        if (active.indexOf(sv) >= 0 && vals[sv] == null){ vals[sv] = vv; n++; }
      }
      if (n < active.length) return null;
      var best = -Infinity;
      for (var k in vals) if (vals[k] > best) best = vals[k];
      active = active.filter(function(x){ return vals[x] === best; });
      if (!active.length) return null;
    }
    return null;
  }

  async function relayDice(){
    try{
      var m = M();
      var node = (m.ordList && m.ordList[m.ordIdx]) || (m.nodes && m.nodes[0]);
      var i = (m.head != null ? m.head : m.logN) || 0;
      var o = await fetch(node + "/api/game/room/" + m.room + "/dice?i=" + i).then(function(r){ return r.json(); });
      if (o && o.d1 != null) return { d1:+o.d1, d2:+o.d2, v:(+o.d1)+(+o.d2) };
    }catch(e){}
    return null;
  }

  // a bot's decision: a pure read of board state (seed-ready)
  function decide(seat, pos){
    var N = window.KV_NAMES || {};
    if (pos == null || !N[pos]) return { a: "pass", v: 0 };
    var owner = null;
    try { owner = window.KV_OWNER ? window.KV_OWNER(pos) : null; } catch(e){}
    if (owner) return { a: "pass", v: 0 };
    var price = 0;
    try { price = (window.KV_INTRINSIC && window.KV_INTRINSIC(pos)) || N[pos].p || 0; } catch(e){ price = N[pos].p || 0; }
    var cash = cashOf(seat);
    var label = "";
    try { label = ((window.KV_PROFNAME && window.KV_PROFNAME(seat)) || "").toLowerCase(); } catch(e){}
    var appetite = label.indexOf("develop") >= 0 ? 0.75
                 : label.indexOf("miser")   >= 0 ? 0.35
                 : label.indexOf("trader")  >= 0 ? 0.55 : 0.60;
    if (price > 0 && cash - price >= 200 && price <= cash * appetite) return { a: "buy", v: pos };
    return { a: "pass", v: 0 };
  }

  setInterval(async function(){
    try{
      var m = M();
      if (!m || !m.room || !m.started || m.halted) return;
      if (m.role !== "host") return;
      if (window.KV_SEALED) return;
      if (busy || Date.now() - lastAt < 2500) return;
      if (document.querySelector("[data-kvmodal]")) return;

      var t = chainTurn();
      if (!t || !isBotSeat(t.seat)) return;

      var key = t.seat + "/" + t.stage + "/" + ((m.head != null ? m.head : m.logN) || 0);
      if (key === lastKey) return;

      busy = true; lastAt = Date.now(); lastKey = key;

      if (t.stage === "roll"){
        var d = await relayDice();
        var total = d ? d.v : (2 + Math.floor(Math.random() * 11));
        if (window.KV_LOG) window.KV_LOG("bot P" + t.seat + " rolls " + total, "#caa64c");
        if (window.KV_MOVE) window.KV_MOVE(t.seat, "roll", total);
      } else {
        var pos = flags()["p" + t.seat];
        var dec = decide(t.seat, pos);
        var N = window.KV_NAMES || {};
        if (window.KV_LOG){
          window.KV_LOG("bot P" + t.seat + " " + (dec.a === "buy"
            ? ("buys " + ((N[dec.v] && N[dec.v].n) || ("block " + dec.v)))
            : "passes"), "#caa64c");
        }
        if (window.KV_MOVE){
          window.KV_MOVE(t.seat, dec.a, dec.v);
          setTimeout(function(){
            try { if (window.KV_MOVE) window.KV_MOVE(t.seat, "end", t.seat); } catch(e){}
          }, 600);
        }
      }

      setTimeout(function(){ busy = false; }, 1500);
    }catch(e){ busy = false; }
  }, 1200);

  if (window.KV_LOG) window.KV_LOG("bot turns post to the chain \\u2014 no prompts","#9cd87c");
})();
</script>
`;

s = s + APPEND;
fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
