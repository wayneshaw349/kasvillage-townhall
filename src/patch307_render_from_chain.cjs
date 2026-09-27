// patch307_render_from_chain.cjs — the render fix.
//
// Diagnosis: the chain is correct and both boards agree on it, but the visible board is produced by
// making the ENGINE replay each move. That replay is what fails — hence drains, fuses, force-adopts,
// resyncs, and boards that disagree while the chain does not.
//
// Fix: every chain entry's snapshot is applied to the board directly, for every seat including our
// own, the moment it arrives. The chain is rendered, not re-enacted. The replay queue is left empty
// in relay games, so the drain, its 16s fuse and the resync cascade have nothing to do.
//
//   * poll: on each acked entry -> KV_ADOPT(snap) + apply fx, then log it. Nothing is queued.
//   * the "fresh adopt = teleport" suppression is removed: adopts are now the normal case.
//   * our own moves still post as before; the chain echo re-renders them, so both boards converge
//     on identical state by construction.
//
// SRC showcase_kascity306.html -> DST showcase_kascity307.html
const fs = require("fs");
const SRC = "showcase_kascity306.html";
const DST = "showcase_kascity307.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function need(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

const A = '          M.queue = M.queue || [];\n' +
'          M.queue.push(m);   // __KV_V233: log order IS apply order';

need(A, 1, "A poller queue push");
if (fails.length) { console.error("ABORT — anchors:\n" + fails.join("\n")); process.exit(1); }

// ---- render instead of queue ----
s = s.replace(A,
'          // __KV_V307: render the chain. the snapshot IS the board state; nothing is replayed.\n' +
'          M.queue = M.queue || [];\n' +
'          try{\n' +
'            var mvR = (window.KV_MOVES = window.KV_MOVES || []);\n' +
'            var prev = mvR[m.i];\n' +
'            mvR[m.i] = { i:m.i, s:m.s, a:m.a, v:m.v, t:m.t, hash:m.hash, snap:m.snap, fx:m.fx,\n' +
'                         d1:m.d1, d2:m.d2, __sent:1, __acked:1 };\n' +
'            // 1) state: the mover published what the board looks like after their move\n' +
'            if(m.snap && window.KV_ADOPT){\n' +
'              window.__KV_CTL_WRITE = 1;\n' +
'              window.KV_ADOPT(m.snap);\n' +
'              window.__KV_CTL_WRITE = 0;\n' +
'            }\n' +
'            // 2) effects the snapshot does not carry (deeds are in the snap; cash deltas may not be)\n' +
'            if(m.fx && m.s !== M.seat){\n' +
'              try{\n' +
'                if(m.fx.deed){\n' +
'                  Object.keys(m.fx.deed).forEach(function(t){\n' +
'                    try{ var w=window.KV_WORLD; if(w && w.owners) w.owners["t"+t] = +m.fx.deed[t] || 0; }catch(e3){}\n' +
'                  });\n' +
'                }\n' +
'                if(m.fx.__scn){\n' +
'                  var sx = m.fx.__scn;\n' +
'                  log("P"+m.s+"  "+sx.opt+"  \\u2192  "+(sx.sw>=0?"+":"")+sx.sw, sx.good?"#9cd87c":"#ff6a4a");\n' +
'                  if(window.KV_SFX) window.KV_SFX(sx.good?"ching":"dang");\n' +
'                }\n' +
'              }catch(eFx){}\n' +
'            }\n' +
'            // 3) the turn pointer follows the chain, not the engine\n' +
'            if(window.KV_SETSTATE && /^(roll|buy|pass|end)$/.test(String(m.a))){\n' +
'              var nextSeat = (String(m.a)==="roll") ? m.s : ((m.s % 4) + 1);\n' +
'              var fNow = (window.KV_FLAGS && window.KV_FLAGS()) || {};\n' +
'              if((fNow.seat||1) !== nextSeat){\n' +
'                window.__KV_CTL_WRITE = 1;\n' +
'                window.KV_SETSTATE("turn", nextSeat-1);\n' +
'                window.KV_SETSTATE("seat", nextSeat);\n' +
'                window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);\n' +
'                window.KV_SETSTATE("rollshow",0); window.KV_SETSTATE("rollv",0); window.KV_SETSTATE("rollt",0);\n' +
'                window.KV_SETSTATE("asked",0);\n' +
'                window.KV_SETSTATE("go", (nextSeat===M.seat || (M.owns && M.owns(nextSeat))) ? 0 : -1);\n' +
'                window.KV_SETSTATE("buy",-1); window.KV_SETSTATE("buy_tile",-1);\n' +
'                window.__KV_CTL_WRITE = 0;\n' +
'              }\n' +
'            }\n' +
'            // 4) narrate, once, for moves we did not make\n' +
'            if(!prev && m.s !== M.seat){\n' +
'              var aR = String(m.a);\n' +
'              if(aR==="roll"){\n' +
'                log("P"+m.s+"  rolled  "+(m.d1!=null?(m.d1+" + "+m.d2+" = "):"")+m.v, COL[m.s]);\n' +
'              } else if(aR==="buy"){\n' +
'                var N=window.KV_NAMES||{};\n' +
'                log("P"+m.s+"  buys  "+((N[m.v]&&N[m.v].n)||("block "+m.v)), "#9cd87c");\n' +
'              } else if(aR==="pass"){\n' +
'                log("P"+m.s+"  passes", "#7a6a58");\n' +
'              }\n' +
'            }\n' +
'          }catch(eRender){}\n' +
'          // nothing is queued: the board is rendered, not replayed');

// ---- the teleport suppression no longer applies; adopts are normal now ----
const B = '      if (__relay && Date.now()-(window.__KV_ADOPT_AT||0)<6000) { continue; }   // __KV_V262: fresh adopt = teleport, not a crime';
if (s.split(B).length - 1 === 1) {
  s = s.replace(B,
'      if (__relay) { continue; }   // __KV_V307: in a relay game the chain places every token');
}

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
