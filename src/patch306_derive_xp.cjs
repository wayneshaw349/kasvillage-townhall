// patch306_derive_xp.cjs — XP becomes a pure function of the chain.
//
// Why: XP was an accumulator carried in snapshots. A resync rolled it back, the relay saw the drop
// and refused the move (xp_decrease), which caused more resyncs. Worse, a modified client could
// simply post inflated XP and the relay would accept it as long as it only rose.
//
// Now: deriveXp(moves) computes every seat's XP from the recorded actions, using the same rules the
// engine used. Every board and every verifier gets the same totals from the same log. Nothing is
// transmitted, so nothing can be forged and a rollback cannot lose progress.
//
// Award rules (unchanged amounts, x KV_XP_MULT, min 1):
//   buy   under intrinsic value .................. +10
//   p2pbuy: buyer paid under intrinsic ........... +18 buyer
//   p2pbuy: seller ............................... +15 seller
//   renovate ..................................... +8
//   mgmt:* with __scn.best ....................... +12
//   rent collected (fx.cash to the owner) ........ +total/15
//   district complete ............................ +30
//   end of game: winner +60, runner-up +25
//
// SRC showcase_kascity305.html -> DST showcase_kascity306.html
const fs = require("fs");
const SRC = "showcase_kascity305.html";
const DST = "showcase_kascity306.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const APPEND = `
<script>
// ---- __KV_V306: XP derived from the chain ----
(function(){
  function mult(){ return window.KV_XP_MULT == null ? 1 : window.KV_XP_MULT; }
  function award(n){ return Math.max(1, Math.round(n * mult())); }
  function intrinsic(t){
    try{
      if (window.KV_INTRINSIC) return window.KV_INTRINSIC(t) || 0;
      var N = window.KV_NAMES || {};
      return (N[t] && N[t].p) || 0;
    }catch(e){ return 0; }
  }

  // the whole scoreboard, from the log alone
  window.KV_DERIVE_XP = function(moves){
    var xp = {1:0, 2:0, 3:0, 4:0};
    var mv = moves || window.KV_MOVES || [];
    var districtsDone = {};

    for (var i = 0; i < mv.length; i++){
      var r = mv[i]; if (!r) continue;
      var a = String(r.a || ""), s = +r.s || 0;
      if (s < 1 || s > 4) continue;

      // bank purchase under intrinsic value
      if (a === "buy"){
        var t = +r.v;
        var paid = null;
        try { if (r.fx && r.fx.cash && r.fx.cash[s] != null) paid = Math.abs(+r.fx.cash[s]); } catch(e){}
        var worth = intrinsic(t);
        if (worth > 0 && (paid == null || paid < worth)) xp[s] += award(10);
        continue;
      }

      // peer purchase: buyer under value, seller always
      if (a === "p2pbuy"){
        var tile = +r.v, amt = null;
        try { if (r.fx && r.fx.cash && r.fx.cash[s] != null) amt = Math.abs(+r.fx.cash[s]); } catch(e){}
        var iv = intrinsic(tile);
        if (iv > 0 && amt != null && amt < iv) xp[s] += award(18);
        // the seller is whoever the deed left; recorded as the other party's cash: entry
        for (var j = i + 1; j < Math.min(mv.length, i + 4); j++){
          var q = mv[j]; if (!q) continue;
          if (String(q.a).indexOf("cash:") === 0 && +q.s !== s){ xp[+q.s] += award(15); break; }
        }
        continue;
      }

      if (a === "renovate"){ xp[s] += award(8); continue; }

      // scenario resolved on its best line
      if (a.indexOf("mgmt:") === 0){
        try { if (r.fx && r.fx.__scn && r.fx.__scn.best) xp[s] += award(12); } catch(e){}
        continue;
      }

      // rent collected: a positive cash effect to a seat that is not the mover
      if (r.fx && r.fx.cash){
        try{
          Object.keys(r.fx.cash).forEach(function(p){
            var d = +r.fx.cash[p] || 0;
            if (d > 0 && +p !== s){
              var g = Math.max(1, Math.round((d / 15) * mult()));
              xp[+p] += g;
            }
          });
        }catch(e){}
      }
    }

    // districts completed, from final ownership
    try{
      var G = window.KV_DISTRICTS || [];
      for (var d = 0; d < G.length; d++){
        var tiles = G[d].tiles || [];
        for (var p2 = 1; p2 <= 4; p2++){
          var all = tiles.length > 0;
          for (var k = 0; k < tiles.length; k++){
            if (!window.KV_OWNER || window.KV_OWNER(tiles[k]) !== p2){ all = false; break; }
          }
          if (all && !districtsDone[d + ":" + p2]){ districtsDone[d + ":" + p2] = 1; xp[p2] += award(30); }
        }
      }
    }catch(e){}

    return xp;
  };

  // end-of-game bonuses, applied to a derived table (not stored)
  window.KV_DERIVE_XP_FINAL = function(rowsSortedByNetWorth){
    var xp = window.KV_DERIVE_XP();
    try{
      if (rowsSortedByNetWorth && rowsSortedByNetWorth[0]) xp[rowsSortedByNetWorth[0].seat] += Math.round(60 * mult());
      if (rowsSortedByNetWorth && rowsSortedByNetWorth[1]) xp[rowsSortedByNetWorth[1].seat] += Math.round(25 * mult());
    }catch(e){}
    return xp;
  };

  // KV_XP becomes a live view of the derivation rather than an accumulator.
  // Writes are ignored; reads recompute (cached briefly so the HUD stays cheap).
  var cache = null, cacheAt = 0, cacheLen = -1;
  function table(){
    var len = (window.KV_MOVES || []).length;
    if (cache && len === cacheLen && Date.now() - cacheAt < 400) return cache;
    cache = window.KV_DERIVE_XP();
    cacheAt = Date.now(); cacheLen = len;
    return cache;
  }

  var view = {};
  [1,2,3,4].forEach(function(p){
    Object.defineProperty(view, p, {
      enumerable: true,
      get: function(){ return table()[p] || 0; },
      set: function(){ /* derived: writes ignored */ }
    });
  });
  try { window.KV_XP = view; } catch(e){}

  if (window.KV_LOG) window.KV_LOG("XP derived from the chain \\u2014 no longer transmitted","#9cd87c");
})();
</script>
`;

s = s + APPEND;
fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
