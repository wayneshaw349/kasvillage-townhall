// make_361.cjs — THE COMPLETE BUILD from the proven 345 foundation.
// SRC = showcase_kascity345.html  ->  OUT = showcase_kascity361.html
// Usage (layer1 root):  node src\make_361.cjs
//
// One script = everything from 346..361 on the 345 base:
//
// __KV_V348:
// (1) HONEST ROLL — the button's fallback goes through the chain-driver
//     (requestStep) or a resync, throttled; no more funnel-blocked fake
//     "stepped and rolled" loop (the 318-era joiner-opener freeze).
// (2) CHAIN-CLOCK BELL — when the newest acked entry shows t<=0 for 10s and
//     no end_game exists, the host rings the bell directly.
// (3) ONE BELL ONLY — the ceremony never posts a second end_game.
// (4) RECORDER FREEZE — after any bell, late non-bell moves are dropped.
// (5) SEAL AT THE FIRST BELL — the published log is truncated there.
// (6) stateRoot = hash of the last kept entry.
// (7) NULL-SAFE moveRoot — field finding (kc4502beee, first stateRoot-matching
//     game): the canonical rederive loop threw on moves[0]=null, the catch
//     swallowed it, and each board published its own divergent live chain as
//     moveRoot. Skipping null slots makes both boards derive the SAME root
//     from the same i|s|a|v|t fields — your two result files prove the field
//     data already agrees. Same fix in the self-verify loop.

//
// __KV_V349 — DEED INTEGRITY (room kc152380eb: i23 published an empty owns
// list, erasing t14>4,t8>3,t9>1 from shared state while cash survived):
// (8) ADOPT HYDRATES DEEDS ALWAYS — KV_ADOPT's owners block was guarded by
//     `w.owners &&`; the engine creates w.owners lazily on the first EXECUTED
//     claim, so a board that never ran a real buy (the joiner) skipped deed
//     hydration on every adopt/resync while cash and positions applied.
//     Root cause of the erase. Fix: create w.owners if missing, then merge.
// (9) OWNS-SHRINK GUARD — before publishing a non-mgmt/court/bell move, if
//     our snap's owns-set is smaller than the newest acked chain snap's, the
//     chain's owns list is spliced into our snap and re-adopted into the
//     engine. A snap that shrinks ownership without cause never leaves this
//     board — protects the sealed stateRoot from baking in a wipe.

//
// __KV_V350 — ONE CHAIN, ONE TRUTH (room kc6e4bc597: the two boards resynced
// from different relays — 97 entries vs 93 — because ord() pins reads to
// whichever node last answered, and diverged nodes made two local truths):
// (10) LONGEST-LOG ELECTION — log reads query EVERY candidate in parallel
//      and adopt the response with the highest head. The chain is
//      append-only, so the longest valid log IS the chain. Reads pin to
//      that node (M.ordIdx), which also makes it fan-out's authoritative
//      primary. Lagging nodes are named in the log ("relay divergence")
//      so the storage bug on the relays stays visible.
// (11) Both read sites — the incremental poll and the full resync — go
//      through the election instead of the sticky single orderer.
//      (No auto-reseed of lagging nodes: /append assigns indices
//      server-side; blind re-pushes could corrupt a lagging log. The
//      relay is the right place to fix storage.)

//
// __KV_V351 — NO SILENT DEADLOCKS (room kc0c51ce65: chain expected bot P4,
// a stuck dice/rent overlay vetoed every watchdog on both boards, and P4's
// turnlock could only be cleared by the resyncs the modal was vetoing):
// (12) STUCK-MODAL REAPER — if the chain has not grown for 25s while a
//      [data-kvmodal] is open, and neither the chain nor the engine says it
//      is this board's human turn (a real decision dialog is never eaten),
//      the stuck modal is removed and a resync fires — which also clears
//      the turnlock (V317) and un-vetoes all four watchdogs at once.
// (13) TURNLOCK TTL — locks carry a timestamp and self-release after 20s,
//      so a stale dropped-roll lock cannot outlive its cause.

//
// __KV_V352 — ONE HISTORY (room kc63aeffb1 final stall: two nodes both at
// head 66 carried DIFFERENT histories; the host's node derived "expects P4",
// the joiner's "expects P1", and a length-only election let each board pin
// its own truth — a mutual stall no watchdog could see):
// (14) DETERMINISTIC SPLIT ELECTION — among nodes at the max head, group
//      responses by chain hash: the majority history wins, ties broken by
//      lowest hash. Every board applies the same rule to the same
//      candidates, so every board adopts the SAME history.
// (15) SPLIT VISIBILITY + HEAL — a content split is logged in red naming
//      the adopted node, and when our adopted history changes identity
//      without growing, a throttled full resync re-reads everything from
//      the winning node.

//
// __KV_V353 — THE CHAIN-ACKED ROLLER IS NEVER LOCKED (room kcd968b774: bot
// P3 tried to buy Foundry Way three times; every attempt died on the local
// turnlock. The lock's free-scan starts at the LOCAL array length recorded
// at drop time, but the chain-acked roll lands at a lower index, so the
// scan never frees — and the 20s TTL is slower than a bot's decision
// window. Board buys by bots almost never reached the chain):
// (16) When the newest ACKED roll on the chain belongs to the locked seat
//      — the chain itself says this seat is the current roller — the lock
//      is stale by definition and frees immediately, before the old
//      forward scan and the TTL even run.

//
// __KV_V354 — RESYNC LANDS WHERE THE RELAY POINTS (room kcb94918c3: the
// joiner looped "RESYNC ... engine to P4" while relay and host both said
// "expects P2". The resync derived the seat from the LAST ENTRY OF ANY
// KIND — but trade legs, cash: and mgmt: entries land from seats that
// are not the roller, so the client and the relay's v57 gate computed
// different seats from the same log):
// (17) The resync now derives the seat the way the relay's gate does:
//      the last ROLL entry's seat L; closed by a later "end" from L
//      → (L%4)+1, otherwise L. Client and relay can no longer disagree
//      about where a resync lands.

//
// __KV_V355 — ACTOR, NOT ROLLER + CLOSE THE HALF-OPEN TURN (room kc5c12a655:
// P1's roll and buy landed on-chain at i53-54 but the closing "end" was never
// appended — the host engine had free-run past it. The relay's /turn answers
// the next ROLLER (P2, rotation advanced at the stored roll); the chain's
// actual need was the next ACTOR (P1, to close). The joiner's drift detector
// compared against the roller and its resync computed the actor — an
// unbreakable 10-minute loop — while the host, whose engine sat on the
// roller, saw nothing wrong at all):
// (18) M.chainActor() — one shared rule: last acked roll/opener seat L, a
//      later acked "end" by L → (L%4)+1, else L.
// (19) The drift detector compares against chainActor() (relay roller only
//      as fallback before any roll exists) — detector and resync can never
//      disagree again.
// (20) HALF-OPEN-TURN HEALER — chain stagnant >8s with an unclosed roll
//      whose seat this board owns (own human seat or hosted bot) → post the
//      missing "end", throttled. The owning board closes its own turns.

//
// __KV_V356 — REPLAYS PAY NO SALARY, THE BELL ENDS THE GAME, THE WINNER
// OPENS (room kc87e61256):
// (21) LAP GUARD — the engine paid GO salary on every adopted/replayed
//      position walk: hundreds of paydays in seconds, local P2 cash past
//      30,000. The chain refused every inflated snap (cash_delta_cap) and
//      resyncs clawed it back, but the local storm kept re-running.
//      KV_ADOPT now stamps __KV_NO_LAP; the payday hook skips laps within
//      4s of a chain apply — an adopt walk is a replay, not travel.
// (22) POST-BELL QUIET — after the bell the engine kept asking for rolls
//      and the HUD said YOUR TURN; the recorder freeze dropped every post
//      — two minutes of mashing a dead button. The roll-answer path now
//      checks for the bell and says once: "the bell has rung — the
//      record is sealed", then stays quiet.
// (23) THE CONTEST WINNER OPENS — the host published "opener: P1" while
//      the first-contest winner was P3; all three relays refused it
//      (opener_mismatch → the "stored on 0/3" line). The publish now
//      derives the winner from the chain's own "first" entries, the same
//      rule the relay's gate applies.

//
// __KV_V357 — THE BELL PRESENTS THE PROOF (room kc87e61256 closed the 348
// verification: both boards produced byte-identical results, moveRoot
// def6df5e…, stateRoot f50abf8a…, selfVerified on both. But the FINAL
// BELL overlay only opens when THIS board's own engine ceremony rings;
// a bell arriving from the chain — the host watchdog or the other board
// — only froze and sealed, presenting nothing):
// (24) Any acked end_game observed on-chain, with no local seal yet,
//      calls KV_END() once — every board lands on the FINAL BELL screen
//      with rankings, roots and the copy-verifiable-result button.

//
// __KV_V358 — THE OPENER WAITS FOR THE CHAIN (room kc24dad92d: the host
// published "opener: P2" while the acked contest winner was P3 — the v356
// winner derivation read LOCAL first entries 14s after GO, before all four
// acked firsts had been adopted, and picked the max of a partial set):
// (25) The winner is derived from ACKED first entries only, and the opener
//      publish defers (re-polling) until all four are on-chain. The gate
//      already dropped every premature local roll; now the prompt agrees
//      with the chain from the start.

//
// __KV_V359 — THE CHAIN CALLS THE TURNS (the free-run theater kept baiting
// premature rolls: the engine showed "tap to roll" for the local seat while
// the chain expected someone else; the gate dropped every one, but the
// player was still tricked into tapping):
// (26) PRE-TURN TAP SHIELD — the engine's roll prompt for OUR seat is
//      hidden whenever chainActor() is someone else, with a one-line note
//      naming who the chain is waiting on; it reappears the moment the
//      chain opens our turn. Programmatic bot-ask answers still land.
// (27) LIVE ANNOUNCEMENTS — "GAME LIVE — PX opens" when the chain's
//      first turn actually starts, and "YOUR TURN" each time the chain's
//      expected actor becomes this board's seat.

//
// __KV_V360 — STALLS EXPLAIN THEMSELVES, THEN GET BROKEN (room kcbef53702:
// chain frozen 5+ minutes on host-owned P3; healer, detector and reaper all
// evaluated their conditions and silently declined — no way to see which
// condition lied from the logs):
// (28) STALL-SCAN — chain stagnant ≥12s with no bell prints one labeled
//      line per 12s with every value the watchdogs judge: head, actor,
//      newest acked roll and its closer, ownership, engine seat, relay
//      expectation. The next freeze names its own cause.
// (29) OWNED-SEAT FAILSAFE — stagnant ≥20s, no bell, expected seat ours
//      or an owned bot: force resync + requestStep first; if the chain is
//      still frozen one cycle later, post "end" for that seat directly.
//      Whatever condition lied, an owned-seat stall now breaks in ~40s.

//
// __KV_V362 — THE CLOCK ANSWERS TO THE GUN + REFUSALS NAME THEMSELVES
// (rooms kcaa866a0c and kc78bd3f96: the game clock is the engine flag `left`,
// posted as every entry's t. Nothing re-anchors it after GO, so resync churn
// (a dice-corrected resync on nearly every roll) pauses the engine tick and
// stretches or rewinds the clock: 7:00 ran 10m25s in kc78bd3f96, and the 348
// watchdog honestly rang a bell the HUD disagreed with):
// (32) GUN TIMESTAMP — GO stamps M.__goAt (wall clock). One clock, one origin.
// (33) CLOCK WARDEN — every 2s, trueLeft = 420 - (now - __goAt). If the
//      engine's `left` deviates by more than 3s, the warden re-anchors
//      left/mark/t0 to the gun and says so. Every posted t is now gun-true,
//      the bell rings when the gun says 0:00, and no resync can move it.
// (34) FAN-OUT REFUSALS SPEAK — a node that answers stored:false with a
//      reason other than "duplicate" is a refusal, not a miss; the reason
//      is logged (throttled). "stored on 0/3" can no longer hide its cause.

//
// __KV_V363 — THE FAILSAFE ONLY CLOSES A TURN THE CHAIN OPENED
// (room kc8ef6132c: chain at P4@18 closed by i20, actor P1, but P1 had not
// rolled yet. The v360 failsafe stage-2 posted "end" for P1's unopened turn;
// relay v57's gate refused it — "fan-out refused by 65.108.72.85 —
// not_the_roller", "stored on 0/3". First confirmed member of the refusal
// class that also ate the missing `first` entries in kcaa866a0c.)
// (35) Stage-2 posts "end" ONLY when the newest acked roll belongs to the
//      expected seat and is unclosed. Otherwise it re-asks the step —
//      nothing invalid ever leaves the board, and the gate stays quiet.

//
// __KV_V364 — HUMANS TRADE DEEDS FOR REAL KASPA (KAS-only trades, non-custodial)
// Buyer pays seller's KAS address wallet-to-wallet; the game only records and
// verifies. The game clock never waits — the DEED waits. Amounts travel as
// centi-KAS integers (v=50 means 0.50 KAS). fx carries the address / txid.
// Chain entries: kaslist:<tile> (v=price, fx=addr) · kasbid:<tile> (v=offer)
// · kasaccept:<tile>:<buyer> (v=amt, fx=addr, deed -> escrow-pending)
// · kaspay:<tile> (buyer, fx=txid) · kassettle:<tile>:<buyer> (fx=txid,
// deed transfers ONLY on the acked settle, after THIS board verifies the tx
// on Kaspa itself) · kasvoid:<tile> (no settle 60s after accept).
// Verification: api.kaspa.org/transactions/<txid> — outputs to the seller
// address must sum >= the agreed amount and the tx must be accepted. Both
// boards verify independently; the sealed result carries the txid as proof.
// (36) fx PASSTHROUGH — the first KV_MOVE wrapper dropped the 4th arg;
//      it now forwards fx (the second wrapper already used apply).
// (37) KAS ESCROW ENGINE — watches the chain for kas* entries, runs the
//      pending/paid/settle/void state machine, verifies on Kaspa, and
//      transfers the deed (owners only, no in-game cash) on acked settle.
//      The seller's board posts the settle and the void; every board
//      re-verifies before honoring a settle.
// (38) KAS CONSOLE — KV.kaslist(tile,kas,addr) · KV.kasbid(tile,kas) ·
//      KV.kasaccept(tile,buyerSeat) · KV.kaspaid(tile,txid) · KV.kas()
//      (pending table). Dialog toggle comes after mechanics prove out.
// NOTE: relay v58 must whitelist actions starting with "kas" in the turn
// gate (same class as mgmt:/court) or the gate answers not_the_roller.

//
// __KV_V365 — THE BELL RINGS FROM THE GUN + A PAYMENT IS NEVER ORPHANED
// (room kc872f289f: the gun hit 0:00 during a 2-minute idle; the 348 watchdog
// rings on ACKED entries with t<=0, and a silent chain has none — the bell
// waited ~2min for play to resume. Harness test: the 60s auto-void fired while
// the buyer was still in their wallet; the payment landed on Kaspa with the
// escrow already dead.)
// (39) GUN-EXPIRY BELL — the host board rings when the GUN says the game is
//      over: gun-left <= 0 for 10s, unsealed, no end_game acked -> post
//      end_game. No acked-entry dependency; a quiet chain can still end.
// (40) PAYMENT ALWAYS WINS — the wall-clock auto-void is REMOVED from the
//      escrow engine. A kaspay whose escrow is missing (voided or unseen)
//      rebuilds it from the chain's own kasaccept and settles on
//      verification. kasvoid remains a manual seller action (KV.kasvoid).
//      Trades are also fenced off the endgame: no kasaccept posts when the
//      gun has under 90s left, and KV.kaspaid refuses under 60s with a
//      DO-NOT-SEND warning — a sealed chain cannot settle, so late KAS must
//      never leave the buyer's wallet.
// (41) TESTNET VERIFY — a kaspatest: seller address routes verification to
//      api-tn10.kaspa.org; mainnet addresses stay on api.kaspa.org.

//
// __KV_V366 — THE KAS TRADE PANEL (UI over the proven escrow engine)
// The harness proved the money path end-to-end on testnet (room ktppkuoc:
// list -> accept -> pay -> dual verification -> settle). v366 puts buttons
// on it inside the game. Console commands remain.
// (42) kasbuy:<tile>:<seller> — a buyer-posted accept at list price. The
//      engine resolves amount/address from the chain's own kaslist, so every
//      board derives the same escrow. K.listings tracks live listings.
// (43) THE PANEL — a KAS button beside the board opens a panel: my address
//      (kept in localStorage), list-my-tile (owned tiles dropdown + KAS
//      price), live listings (Buy for others), and open escrows (buyer
//      pastes the txid there). Fence rules surface in the panel: no listing
//      or buying under 90s on the gun, no txid submit under 60s.
//      Tile badges on the board itself: deferred to v367.

//
// __KV_V367 — THE BOTTOM TOOLBAR (one bar owns the floating UI)
// Play-by-play and the game log were always the same stream (the GAME LOG
// panel that log() writes). v367 gathers the scattered fixed elements into
// one bar along the bottom, each opening as a drop-up:
// (44) KV TOOLBAR — a runtime adopter: builds the bar and, as each element
//      appears, moves it in. ROLL (the V240 button, its show/hide logic
//      untouched) · LOG (the GAME LOG panel, one stream, one place) ·
//      KAS (the v366 panel, now a drop-up) · room status on the right.
//      Nothing about game logic changes; this is furniture.
// __KV_V368 — WHAT HAD HAPPENED WAS joins the bar. GAME LOG and the WHW
//      strip are two views of the same events (raw feed vs styled 60-row
//      narrative). The strip lived along the bottom where the bar now sits,
//      so it becomes a drop-up of its own: the WHAT HAPPENED button.
// __KV_V369 — NO BOOT FLASH: both feed panels are hidden at their creation
//      site (visibility:hidden on their opening cssText), so nothing shows
//      before the bar adopts them; adoption restores visibility inside the
//      closed drop-ups. The board is all there is until a button is pressed.
// __KV_V370 — THE BAR FINISHES THE JOB (screenshot round)
//      HOLDINGS (the left tabbed panel: HOLDINGS/MARKET/YOU/EVENTS) and
//      PLAY BY PLAY (the right styled feed — the GAME LOG's twin: same
//      log() lines, different skin) join the bar as drop-ups.
//      CRITICAL FIX: the engine's buy/pass prompt sheet is anchored at the
//      bottom of the screen and the bar was covering the Pass option. The
//      adopter now lifts any engine element anchored at the screen bottom
//      to sit ABOVE the bar — Buy and Pass are both reachable again.

const fs = require("fs");
const SRC = "showcase_kascity345.html";
const OUT = "showcase_kascity411.html";

let html = fs.readFileSync(SRC, "utf8");
let patches = 0;

function replaceCounted(name, anchor, replacement, expected) {
  const parts = html.split(anchor);
  const found = parts.length - 1;
  if (found !== expected) {
    console.error(`ABORT [${name}]: expected ${expected}, found ${found}`);
    process.exit(1);
  }
  html = parts.join(replacement);
  patches++;
  console.log(`ok  [${name}]`);
}

// ---- (1) honest ROLL fallback ----
replaceCounted(
  "honest-roll-fallback",
  '          if(window.KV_SETSTATE){\n' +
  '            if(window.KV_CLEAR_DICE) window.KV_CLEAR_DICE();   // __KV_V283\n' +
  '            window.KV_SETSTATE("turn",M.seat-1); window.KV_SETSTATE("seat",M.seat);\n' +
  '            window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0); window.KV_SETSTATE("asked",0);\n' +
  '            window.KV_SETSTATE("go",0);\n' +
  '            log("ROLL: stepped the engine to P"+M.seat+" and rolled","#9cd87c");\n' +
  '          }',
  '          if(M.__rollKick && Date.now()-M.__rollKick<6000){          // __KV_V348\n' +
  '            log("ROLL: waiting for the engine to ask","#7a8a9a");\n' +
  '            return;\n' +
  '          }\n' +
  '          M.__rollKick=Date.now();\n' +
  '          if(window.KV_TURN_CTL && M.requestStep){\n' +
  '            M.requestStep(M.seat,"roll-button");\n' +
  '            log("ROLL: asked the chain-driver to open our turn","#9cd87c");\n' +
  '          } else if(M.resync){\n' +
  '            M.resync("roll button");\n' +
  '          }',
  1
);

// ---- (2) chain-clock bell watchdog ----
replaceCounted(
  "bell-watchdog",
  "  // ---- __KV_V237: full-log resync -- the flux chain is the record; rebuild from it ----",
  "  // ---- __KV_V348: the chain clock rings the bell -- not the engine's ceremony ----\n" +
  "  (function(){\n" +
  "    var due=0;\n" +
  "    setInterval(function(){\n" +
  "      try{\n" +
  "        if(!M.started || M.halted) return;\n" +
  "        var mv=window.KV_MOVES||[]; var lastT=null, hasBell=false;\n" +
  "        for(var i=mv.length-1;i>=0;i--){ var r=mv[i]; if(!r) continue;\n" +
  "          if(String(r.a)===\"end_game\"){ hasBell=true; break; }\n" +
  "          if(lastT===null && r.__acked && r.t!=null) lastT=+r.t;\n" +
  "        }\n" +
  "        if(hasBell || lastT===null || lastT>0){ due=0; return; }\n" +
  "        if(!due){ due=Date.now(); return; }\n" +
  "        if(Date.now()-due<10000) return;\n" +
  "        due=0;\n" +
  "        if(M.role!==\"host\") return;\n" +
  "        log(\"clock expired on the chain \\u2014 ringing the bell\",\"#f0c860\");\n" +
  "        if(window.KV_MOVE) window.KV_MOVE(M.seat||1,\"end_game\",0);\n" +
  "      }catch(e){}\n" +
  "    }, 3000);\n" +
  "  })();\n\n" +
  "  // ---- __KV_V237: full-log resync -- the flux chain is the record; rebuild from it ----",
  1
);

// ---- (3) never ring a second bell ----
replaceCounted(
  "one-bell-only",
  'window.KV_MOVE(__M.seat||1, "end_game", 0);',
  'var __hasBell=false;                                             // __KV_V348\n' +
  '        try{ var __mvB=window.KV_MOVES||[];\n' +
  '          for(var __bi=0;__bi<__mvB.length;__bi++){ var __br=__mvB[__bi];\n' +
  '            if(__br&&String(__br.a)==="end_game"){ __hasBell=true; break; } }\n' +
  '        }catch(__eB){}\n' +
  '        if(!__hasBell) window.KV_MOVE(__M.seat||1, "end_game", 0);\n' +
  '        else log("the bell is already on the chain \\u2014 not ringing twice","#f0c860");',
  1
);

// ---- (4) recorder freeze once any bell exists ----
replaceCounted(
  "recorder-freeze",
  "var rec={i:__idx, s:seat, a:action, v:arg, t:left};",
  "try{                                                              // __KV_V348\n" +
  "        if(String(action)!==\"end_game\"){\n" +
  "          var __mvZ=window.KV_MOVES||[];\n" +
  "          for(var __zi=__mvZ.length-1;__zi>=0;__zi--){ var __zr=__mvZ[__zi];\n" +
  "            if(__zr&&String(__zr.a)===\"end_game\"){\n" +
  "              if(!window.__KV_FRZLOG){ window.__KV_FRZLOG=1;\n" +
  "                if(window.KV_LOG) window.KV_LOG(\"final bell \\u2014 the chain is frozen, dropping late moves\",\"#f0c860\"); }\n" +
  "              return;\n" +
  "            } }\n" +
  "        }\n" +
  "      }catch(__eZ){}\n" +
  "      var rec={i:__idx, s:seat, a:action, v:arg, t:left};",
  1
);

// ---- (5) publish exactly up to the first bell ----
replaceCounted(
  "seal-at-first-bell",
  "window.KV_MOVES = window.KV_MOVES.slice();   // freeze the array we are about to publish",
  "window.KV_MOVES = window.KV_MOVES.slice();   // freeze the array we are about to publish\n" +
  "    try{                                                          // __KV_V348\n" +
  "      for(var __ti=0;__ti<window.KV_MOVES.length;__ti++){ var __tr=window.KV_MOVES[__ti];\n" +
  "        if(__tr&&String(__tr.a)===\"end_game\"){\n" +
  "          window.KV_MOVES=window.KV_MOVES.slice(0,__ti+1);\n" +
  "          log(\"sealed at the first bell \\u2014 i\"+__ti,\"#f0c860\");\n" +
  "          break;\n" +
  "        } }\n" +
  "    }catch(__eT){}",
  1
);

// ---- (6) stateRoot = hash of the last kept entry ----
replaceCounted(
  "stateroot-from-log",
  'stateRoot: (window.KV_STATE_ROOT || ""), moveCount:window.KV_MOVES.length,',
  'stateRoot: (((window.KV_MOVES[window.KV_MOVES.length-1]||{}).hash) || window.KV_STATE_ROOT || ""), moveCount:window.KV_MOVES.length,   // __KV_V348',
  1
);

// ---- (7a) null-safe canonical rederive ----
replaceCounted(
  "nullsafe-rederive",
  'for(var __i=0;__i<window.KV_MOVES.length;__i++){ var __r=window.KV_MOVES[__i]; __c = await sha(__c+"|"+__r.i+"|"+__r.s+"|"+__r.a+"|"+__r.v+"|"+__r.t); }',
  'for(var __i=0;__i<window.KV_MOVES.length;__i++){ var __r=window.KV_MOVES[__i]; if(!__r) continue;   // __KV_V348: null slot\n' +
  '__c = await sha(__c+"|"+__r.i+"|"+__r.s+"|"+__r.a+"|"+__r.v+"|"+__r.t); }',
  1
);

// ---- (7b) null-safe self-verify ----
replaceCounted(
  "nullsafe-selfverify",
  '          var r=window.KV_MOVES[i];\n' +
  '          c = await sha(c+"|"+r.i+"|"+r.s+"|"+r.a+"|"+r.v+"|"+r.t);',
  '          var r=window.KV_MOVES[i]; if(!r) continue;               // __KV_V348: null slot\n' +
  '          c = await sha(c+"|"+r.i+"|"+r.s+"|"+r.a+"|"+r.v+"|"+r.t);',
  1
);

// ---- (8) __KV_V349: ADOPT hydrates deeds even when owners was never initialized ----
replaceCounted(
  "adopt-hydrates-deeds",
  '      if(w && w.owners && parts[2]!=null){\n' +
  '        var incoming={};',
  '      if(w && parts[2]!=null){                                     // __KV_V349: hydrate even when owners was never initialized\n' +
  '        w.owners = w.owners || {};\n' +
  '        var incoming={};',
  1
);

// ---- (9) __KV_V349: owns-shrink guard on outgoing snaps ----
replaceCounted(
  "owns-shrink-guard",
  '        } else if(window.KV_SNAPSHOT) rec.snap = window.KV_SNAPSHOT();\n' +
  '      }catch(e){}   // __KV_V210 + __KV_V316: state at record time',
  '        } else if(window.KV_SNAPSHOT) rec.snap = window.KV_SNAPSHOT();\n' +
  '        if(rec.snap && !/^(mgmt:|court|end_game)/.test(String(action))){   // __KV_V349: owns may not shrink without cause\n' +
  '          var __mvG=window.KV_MOVES||[], __cgS=null;\n' +
  '          for(var __gi=__mvG.length-1;__gi>=0;__gi--){ var __gr=__mvG[__gi]; if(__gr&&__gr.__acked&&__gr.snap){ __cgS=__gr.snap; break; } }\n' +
  '          if(__cgS){\n' +
  '            var __po=String(__cgS).split("|")[2]||"", __no=String(rec.snap).split("|")[2]||"";\n' +
  '            var __pc=__po?__po.split(",").filter(Boolean).length:0;\n' +
  '            var __nc=__no?__no.split(",").filter(Boolean).length:0;\n' +
  '            if(__pc>0 && __nc<__pc){\n' +
  '              var __spG=String(rec.snap).split("|"); __spG[2]=__po; rec.snap=__spG.join("|");\n' +
  '              try{ if(window.KV_ADOPT) window.KV_ADOPT(rec.snap); }catch(__eG2){}\n' +
  '              if(window.KV_LOG) window.KV_LOG("owns-guard: kept "+__pc+" deed(s) from the chain (engine had "+__nc+")","#f0c860");\n' +
  '            }\n' +
  '          }\n' +
  '        }\n' +
  '      }catch(e){}   // __KV_V210 + __KV_V316 + __KV_V349: state at record time',
  1
);

// ---- (10) __KV_V350+V352: longest-log election with deterministic split resolution ----
replaceCounted(
  "longest-log-election",
  '  M.ord = ord;',
  '  M.ord = ord;\n' +
  '  // __KV_V350: the chain is append-only \u2014 the longest valid log IS the chain.\n' +
  '  // __KV_V352: when nodes at the same head carry different histories, the\n' +
  '  // majority chain wins (ties: lowest hash) \u2014 the same deterministic rule on\n' +
  '  // every board, so every board adopts the SAME history. Never a sticky orderer.\n' +
  '  async function ordLogAll(after){\n' +
  '    var L = await ordListF();\n' +
  '    var path = "/api/game/room/"+M.room+"/log?after="+(after||0);\n' +
  '    var rs = await Promise.allSettled(L.map(function(u){ return one(u, path); }));\n' +
  '    var got=[];\n' +
  '    for(var k=0;k<L.length;k++){\n' +
  '      var r=rs[k]; if(r.status!=="fulfilled" || !r.value) continue;\n' +
  '      var v=r.value;\n' +
  '      var h=(v.head!=null)?+v.head:(((v.entries||[]).length)+(after||0));\n' +
  '      got.push({u:L[k], v:v, h:h, c:String(v.chain||"")});\n' +
  '    }\n' +
  '    if(!got.length) return ord(path);   // every candidate failed the parallel read \u2014 old path decides\n' +
  '    var bestH=-1; for(var g=0;g<got.length;g++) if(got[g].h>bestH) bestH=got[g].h;\n' +
  '    var tops=got.filter(function(g){ return g.h===bestH; });\n' +
  '    var byChain={};                                                  // __KV_V352\n' +
  '    for(var t=0;t<tops.length;t++){ (byChain[tops[t].c]=byChain[tops[t].c]||[]).push(tops[t]); }\n' +
  '    var chains=Object.keys(byChain);\n' +
  '    chains.sort(function(a,b){ var d=byChain[b].length-byChain[a].length; return d!==0?d:(a<b?-1:1); });\n' +
  '    var winner=byChain[chains[0]][0];\n' +
  '    if(chains.length>1 && (!M.__splitLog || Date.now()-M.__splitLog>15000)){\n' +
  '      M.__splitLog=Date.now();\n' +
  '      log("relay content split at head "+bestH+": "+chains.length+" histories \u2014 adopting "+winner.u,"#e05050");\n' +
  '    }\n' +
  '    var bi=L.indexOf(winner.u);\n' +
  '    if(bi>=0 && M.ordIdx!==bi){ M.ordIdx=bi; log("reads pinned to the longest chain: "+winner.u+" (head "+bestH+")","#caa64c"); }\n' +
  '    for(var q=0;q<got.length;q++){ if(got[q].h<bestH && (!M.__lagLog || Date.now()-M.__lagLog>15000)){\n' +
  '      M.__lagLog=Date.now();\n' +
  '      log("relay divergence: "+got[q].u+" head "+got[q].h+" < "+bestH,"#e0a040");\n' +
  '    } }\n' +
  '    if(M.__pinChain && winner.c && winner.c!==M.__pinChain && bestH<=(M.__pinHead||0)){   // __KV_V352: history changed identity without growing\n' +
  '      M.__pinChain=winner.c; M.__pinHead=bestH;\n' +
  '      if(M.resync && (!M.__splitRs || Date.now()-M.__splitRs>20000)){\n' +
  '        M.__splitRs=Date.now();\n' +
  '        setTimeout(function(){ try{ M.resync("relay content split"); }catch(e){} },0);\n' +
  '      }\n' +
  '    } else { M.__pinChain=winner.c; M.__pinHead=bestH; }\n' +
  '    return winner.v;\n' +
  '  }\n' +
  '  M.ordLogAll = ordLogAll;',
  1
);

// ---- (11a) __KV_V350: the incremental poll reads the elected longest chain ----
replaceCounted(
  "poll-longest",
  'var lg = await ord("/api/game/room/"+M.room+"/log?after="+(M.logN||0));',
  'var lg = await ordLogAll(M.logN||0);   // __KV_V350: longest chain wins',
  1
);

// ---- (11b) __KV_V350: the full resync reads the elected longest chain ----
replaceCounted(
  "resync-longest",
  'var lg = await ord("/api/game/room/"+M.room+"/log?after=0");',
  'var lg = await ordLogAll(0);   // __KV_V350: longest chain wins',
  1
);

// ---- (12) __KV_V351: stuck-modal reaper ----
// Runs after the bell-watchdog patch, which re-emits the V237 comment once.
replaceCounted(
  "stuck-modal-reaper",
  "  // ---- __KV_V237: full-log resync -- the flux chain is the record; rebuild from it ----",
  "  // ---- __KV_V351: stuck-modal reaper -- a frozen chain never hides behind a dialog ----\n" +
  "  (function(){\n" +
  "    var lastH=-1, lastAt=Date.now();\n" +
  "    setInterval(function(){\n" +
  "      try{\n" +
  "        if(!M.started || M.halted) return;\n" +
  "        var h=Math.max(M.head||0, M.logN||0, (window.KV_MOVES||[]).length);\n" +
  "        if(h!==lastH){ lastH=h; lastAt=Date.now(); return; }\n" +
  "        if(Date.now()-lastAt<25000) return;\n" +
  "        var mods=document.querySelectorAll(\"[data-kvmodal]\");\n" +
  "        if(!mods.length) return;\n" +
  "        var exp=(M.__relayTurn||{}).exp;\n" +
  "        var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};\n" +
  "        if(exp===M.seat || (f.seat||0)===M.seat) return;   // our human may genuinely be deciding\n" +
  "        for(var i=0;i<mods.length;i++){ try{ mods[i].remove(); }catch(eR){} }\n" +
  "        log(\"chain frozen \"+Math.round((Date.now()-lastAt)/1000)+\"s behind a dialog \\u2014 cleared \"+mods.length+\" stuck modal(s)\",\"#e0a040\");\n" +
  "        lastAt=Date.now();\n" +
  "        if(M.resync) M.resync(\"stuck modal cleared\");\n" +
  "      }catch(e){}\n" +
  "    }, 5000);\n" +
  "  })();\n\n" +
  "  // ---- __KV_V237: full-log resync -- the flux chain is the record; rebuild from it ----",
  1
);

// ---- (13a) __KV_V351: turnlock carries a timestamp (both set sites) ----
replaceCounted(
  "turnlock-timestamp",
  'window.__KV_TURNLOCK[seat]=(window.KV_MOVES||[]).length;',
  'window.__KV_TURNLOCK[seat]=(window.KV_MOVES||[]).length; (window.__KV_TURNLOCK_AT=window.__KV_TURNLOCK_AT||{})[seat]=Date.now();   // __KV_V351',
  2
);

// ---- (13b) __KV_V351: turnlock self-releases after 20s ----
replaceCounted(
  "turnlock-ttl",
  '          if(__free){ delete __TL[seat]; }',
  '          if(!__free && Date.now()-(((window.__KV_TURNLOCK_AT||{})[seat])||0)>20000){   // __KV_V351: stale lock\n' +
  '            __free=true;\n' +
  '            if(window.KV_LOG) window.KV_LOG("turnlock expired for P"+seat+" \\u2014 releasing","#7a6a58");\n' +
  '          }\n' +
  '          if(__free){ delete __TL[seat]; }',
  1
);

// ---- (16) __KV_V353: the chain-acked roller is never locked ----
replaceCounted(
  "chain-roller-unlock",
  'var __mvL=window.KV_MOVES||[], __free=false;',
  'var __mvL=window.KV_MOVES||[], __free=false;\n' +
  '          for(var __ri=__mvL.length-1;__ri>=0;__ri--){              // __KV_V353: newest acked roll decides\n' +
  '            var __rr=__mvL[__ri];\n' +
  '            if(__rr && __rr.__acked && String(__rr.a)==="roll"){ if(+__rr.s===+seat) __free=true; break; }\n' +
  '          }',
  1
);

// ---- (17) __KV_V354: resync derives the seat the way the relay's gate does ----
replaceCounted(
  "resync-relay-rule",
  'exp = (String(lastMove.a)==="roll"||String(lastMove.a)==="opener") ? lastMove.s : ((lastMove.s%4)+1);',
  'var __lr=null, __lri=-1;                                 // __KV_V354: last ROLL decides, not last entry\n' +
  '          for(var __xi=arr.length-1;__xi>=0;__xi--){ var __xr=arr[__xi];\n' +
  '            if(__xr && (String(__xr.a)==="roll"||String(__xr.a)==="opener")){ __lr=__xr; __lri=__xi; break; } }\n' +
  '          if(__lr){\n' +
  '            var __closed=false;\n' +
  '            for(var __yi=__lri+1;__yi<arr.length;__yi++){ var __yr=arr[__yi];\n' +
  '              if(__yr && String(__yr.a)==="end" && +__yr.s===+__lr.s){ __closed=true; break; } }\n' +
  '            exp = __closed ? ((__lr.s%4)+1) : __lr.s;\n' +
  '          } else {\n' +
  '            exp = (String(lastMove.a)==="roll"||String(lastMove.a)==="opener") ? lastMove.s : ((lastMove.s%4)+1);\n' +
  '          }',
  1
);

// ---- (18) __KV_V355: one shared expected-actor rule ----
replaceCounted(
  "chain-actor-fn",
  '  // ---- __KV_V238: divergence detector -- engine state vs the chain\'s newest snapshot ----',
  '  // ---- __KV_V355: the expected ACTOR, derived from the chain \u2014 one rule for every consumer ----\n' +
  '  M.chainActor = function(){\n' +
  '    var mv=window.KV_MOVES||[], lr=null, ri=-1;\n' +
  '    for(var i=mv.length-1;i>=0;i--){ var r=mv[i];\n' +
  '      if(r&&r.__acked&&(String(r.a)==="roll"||String(r.a)==="opener")){ lr=r; ri=i; break; } }\n' +
  '    if(!lr) return null;\n' +
  '    for(var j=ri+1;j<mv.length;j++){ var e=mv[j];\n' +
  '      if(e&&e.__acked&&String(e.a)==="end"&&+e.s===+lr.s) return ((lr.s%4)+1); }\n' +
  '    return lr.s;\n' +
  '  };\n\n' +
  '  // ---- __KV_V355: half-open-turn healer \u2014 the owning board closes its own turns ----\n' +
  '  (function(){\n' +
  '    var lastH=-1, lastAt=Date.now();\n' +
  '    setInterval(function(){\n' +
  '      try{\n' +
  '        if(!M.started || M.halted) return;\n' +
  '        var mv=window.KV_MOVES||[];\n' +
  '        for(var bi=0;bi<mv.length;bi++){ var br=mv[bi]; if(br&&String(br.a)==="end_game") return; }\n' +
  '        var h=Math.max(M.head||0, M.logN||0, mv.length);\n' +
  '        if(h!==lastH){ lastH=h; lastAt=Date.now(); return; }\n' +
  '        if(Date.now()-lastAt<8000) return;\n' +
  '        var act=M.chainActor&&M.chainActor(); if(!act) return;\n' +
  '        var lr=null;\n' +
  '        for(var i2=mv.length-1;i2>=0;i2--){ var r2=mv[i2];\n' +
  '          if(r2&&r2.__acked&&(String(r2.a)==="roll"||String(r2.a)==="opener")){ lr=r2; break; } }\n' +
  '        if(!lr || +lr.s!==+act) return;                       // turn already closed \u2014 nothing to heal\n' +
  '        if(!(act===M.seat || (M.owns&&M.owns(act)))) return;   // only the owning board closes\n' +
  '        if(M.__healEnd && Date.now()-M.__healEnd<15000) return;\n' +
  '        M.__healEnd=Date.now();\n' +
  '        log("closing P"+act+"\'s half-open turn \u2014 the chain was waiting","#e0a040");\n' +
  '        if(window.KV_MOVE) window.KV_MOVE(act,"end",0);\n' +
  '      }catch(e){}\n' +
  '    }, 5000);\n' +
  '  })();\n\n' +
  '  // ---- __KV_V238: divergence detector -- engine state vs the chain\'s newest snapshot ----',
  1
);

// ---- (19) __KV_V355: the drift detector compares against the actor ----
replaceCounted(
  "detector-uses-actor",
  'var __RTd=M.__relayTurn||{}; var __expD=__RTd.exp;',
  'var __expD=(M.chainActor&&M.chainActor())||((M.__relayTurn||{}).exp);   // __KV_V355: actor, not roller',
  1
);

// ---- (21a) __KV_V356: chain applies stamp the no-lap window ----
replaceCounted(
  "no-lap-stamp",
  '  window.KV_ADOPT = function(snap){',
  '  window.KV_ADOPT = function(snap){\n' +
  '    window.__KV_NO_LAP = Date.now();                             // __KV_V356: an adopt walk is a replay, not travel',
  1
);

// ---- (21b) __KV_V356: the payday hook skips replayed laps ----
replaceCounted(
  "no-lap-guard",
  'if(id!=="depot") return;',
  'if(id!=="depot") return;\n' +
  '      if(window.__KV_NO_LAP && Date.now()-window.__KV_NO_LAP<4000) return;   // __KV_V356: no salary on replays',
  1
);

// ---- (22) __KV_V356: after the bell, the roll path goes quiet ----
replaceCounted(
  "post-bell-quiet",
  "var el=document.querySelector(\"div[data-i='0']\");",
  'var __mvQ=window.KV_MOVES||[];                        // __KV_V356: the record is sealed\n' +
  '          for(var __qi=__mvQ.length-1;__qi>=0;__qi--){ var __qr=__mvQ[__qi];\n' +
  '            if(__qr&&String(__qr.a)==="end_game"){\n' +
  '              if(!window.__KV_BELLNOTE){ window.__KV_BELLNOTE=1; log("the bell has rung \\u2014 the record is sealed","#f0c860"); }\n' +
  '              return;\n' +
  '            } }\n' +
  "          var el=document.querySelector(\"div[data-i='0']\");",
  1
);

// ---- (23) __KV_V356: the contest winner opens ----
replaceCounted(
  "winner-opens",
  'var seat=g.seat||(((g.turn||0)%4)+1);',
  'var seat=g.seat||(((g.turn||0)%4)+1);\n' +
  '              try{ var __fw={}, __fn=0, __mvO=window.KV_MOVES||[];   // __KV_V356+V358: ACKED firsts only\n' +
  '                for(var __oi2=0;__oi2<__mvO.length;__oi2++){ var __orX=__mvO[__oi2];\n' +
  '                  if(__orX&&__orX.__acked&&String(__orX.a)==="first"&&__fw[__orX.s]==null){ __fw[__orX.s]=+__orX.v; __fn++; } }\n' +
  '                if(__fn<4){                                       // __KV_V358: the contest is not on-chain yet\n' +
  '                  if(t2<80) setTimeout(function(){ openBot(t2+1); }, 300);\n' +
  '                  return;\n' +
  '                }\n' +
  '                var __bw=null;\n' +
  '                for(var __s2=1;__s2<=4;__s2++){ if(__fw[__s2]!=null&&(__bw==null||__fw[__s2]>__fw[__bw])) __bw=__s2; }\n' +
  '                if(__bw) seat=__bw;\n' +
  '              }catch(__eW){}',
  1
);

// ---- (24) __KV_V357: a bell from the chain opens the results ----
replaceCounted(
  "bell-presents-proof",
  "  // ---- __KV_V237: full-log resync -- the flux chain is the record; rebuild from it ----",
  "  // ---- __KV_V357: a bell from the chain presents the sealed result ----\n" +
  "  (function(){\n" +
  "    setInterval(function(){\n" +
  "      try{\n" +
  "        if(window.KV_SEALED || window.__KV_BELLOPEN) return;\n" +
  "        if(!M.started) return;\n" +
  "        var mv=window.KV_MOVES||[];\n" +
  "        for(var i=mv.length-1;i>=0;i--){ var r=mv[i];\n" +
  "          if(r && r.__acked && String(r.a)===\"end_game\"){\n" +
  "            window.__KV_BELLOPEN=1;\n" +
  "            log(\"the bell arrived from the chain \\u2014 presenting the sealed result\",\"#f0c860\");\n" +
  "            if(window.KV_END) setTimeout(function(){ try{ window.KV_END(); }catch(e){} }, 300);\n" +
  "            return;\n" +
  "          } }\n" +
  "      }catch(e){}\n" +
  "    }, 2500);\n" +
  "  })();\n\n" +
  "  // ---- __KV_V237: full-log resync -- the flux chain is the record; rebuild from it ----",
  1
);

// ---- (26+27) __KV_V359: the chain calls the turns ----
replaceCounted(
  "chain-calls-turns",
  "  // ---- __KV_V237: full-log resync -- the flux chain is the record; rebuild from it ----",
  "  // ---- __KV_V359: the chain calls the turns -- shield the prompt, announce the moments ----\n" +
  "  (function(){\n" +
  "    var lastA=null, live=0;\n" +
  "    setInterval(function(){\n" +
  "      try{\n" +
  "        if(!M.started || window.KV_SEALED) return;\n" +
  "        var a=M.chainActor&&M.chainActor();\n" +
  "        if(a && !live){ live=1;\n" +
  "          log(\"GAME LIVE \\u2014 P\"+a+\" opens; roll when the game says YOUR TURN\",\"#9cd87c\");\n" +
  "          if(window.KV_SHOUT) window.KV_SHOUT(\"GAME LIVE\",\"P\"+a+\" opens \\u2014 the chain is running\",\"#9cd87c\");\n" +
  "        }\n" +
  "        if(a && a!==lastA){\n" +
  "          if(a===M.seat){\n" +
  "            log(\"YOUR TURN \\u2014 the chain expects P\"+a,\"#f0c860\");\n" +
  "            if(window.KV_SHOUT) window.KV_SHOUT(\"YOUR TURN\",\"the chain expects you\",\"#f0c860\");\n" +
  "          }\n" +
  "          lastA=a;\n" +
  "        }\n" +
  "        var pr=document.querySelector(\"div[data-i='0']\");\n" +
  "        if(pr){\n" +
  "          var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};\n" +
  "          var eng=((f.turn||0)%4)+1;\n" +
  "          if(eng===M.seat && a && a!==M.seat){\n" +
  "            if(pr.style.visibility!==\"hidden\"){ pr.style.visibility=\"hidden\";\n" +
  "              if(!M.__shieldAt || Date.now()-M.__shieldAt>8000){ M.__shieldAt=Date.now();\n" +
  "                log(\"holding your roll \\u2014 the chain is on P\"+a,\"#7a8a9a\"); } }\n" +
  "          } else if(pr.style.visibility===\"hidden\"){ pr.style.visibility=\"\"; }\n" +
  "        }\n" +
  "      }catch(e){}\n" +
  "    }, 800);\n" +
  "  })();\n\n" +
  "  // ---- __KV_V237: full-log resync -- the flux chain is the record; rebuild from it ----",
  1
);

// ---- (28+29) __KV_V360: stall-scan + owned-seat failsafe ----
replaceCounted(
  "stall-failsafe",
  "  // ---- __KV_V237: full-log resync -- the flux chain is the record; rebuild from it ----",
  "  // ---- __KV_V360: stalls explain themselves, then get broken ----\n" +
  "  (function(){\n" +
  "    var lastH=-1, lastAt=Date.now(), stage=0;\n" +
  "    setInterval(function(){\n" +
  "      try{\n" +
  "        if(!M.started || M.halted) return;\n" +
  "        var mv=window.KV_MOVES||[];\n" +
  "        for(var bi=mv.length-1;bi>=0;bi--){ var br=mv[bi]; if(br&&String(br.a)===\"end_game\") return; }\n" +
  "        var h=Math.max(M.head||0, M.logN||0, mv.length);\n" +
  "        if(h!==lastH){ lastH=h; lastAt=Date.now(); stage=0; return; }\n" +
  "        var idle=Date.now()-lastAt;\n" +
  "        if(idle<12000) return;\n" +
  "        var lr=null, lri=-1;\n" +
  "        for(var i=mv.length-1;i>=0;i--){ var r=mv[i];\n" +
  "          if(r&&r.__acked&&(String(r.a)===\"roll\"||String(r.a)===\"opener\")){ lr=r; lri=i; break; } }\n" +
  "        var closer=null;\n" +
  "        if(lr){ for(var j=lri+1;j<mv.length;j++){ var e=mv[j];\n" +
  "          if(e&&e.__acked&&String(e.a)===\"end\"&&+e.s===+lr.s){ closer=j; break; } } }\n" +
  "        var act=M.chainActor&&M.chainActor();\n" +
  "        var rex=(M.__relayTurn||{}).exp;\n" +
  "        var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};\n" +
  "        var eng=((f.turn||0)%4)+1;\n" +
  "        var E=act||rex;\n" +
  "        var own=E?(E===M.seat||(M.owns&&M.owns(E))):false;\n" +
  "        log(\"stall-scan: idle=\"+Math.round(idle/1000)+\"s head=\"+h+\" actor=\"+(act||\"-\")+\" relayExp=\"+(rex||\"-\")+\" lastAckRoll=\"+(lr?(\"P\"+lr.s+\"@\"+lr.i):\"none\")+\" closedBy=\"+(closer==null?\"none\":(\"i\"+closer))+\" owns=\"+own+\" engine=P\"+eng,\"#8a9aae\");\n" +
  "        if(idle<20000 || !E || !own) return;\n" +
  "        if(M.__fsAt && Date.now()-M.__fsAt<15000) return;\n" +
  "        M.__fsAt=Date.now();\n" +
  "        if(stage===0){ stage=1;\n" +
  "          log(\"failsafe: forcing resync + opening P\"+E+\"'s turn\",\"#e0a040\");\n" +
  "          try{ if(M.resync) M.resync(\"stall failsafe\"); }catch(e1){}\n" +
  "          setTimeout(function(){ try{ if(M.requestStep) M.requestStep(E,\"stall failsafe\"); }catch(e2){} }, 1200);\n" +
  "        } else {\n" +
  "          if(lr && +lr.s===+E && closer==null){   // __KV_V363: only close a turn the chain opened\n" +
  "            log(\"failsafe: closing P\"+E+\"'s turn on the chain\",\"#e0a040\");\n" +
  "            try{ if(window.KV_MOVE) window.KV_MOVE(E,\"end\",0); }catch(e3){}\n" +
  "          } else {\n" +
  "            log(\"failsafe: P\"+E+\" has no open roll on the chain \u2014 re-asking the step\",\"#e0a040\");\n" +
  "            try{ if(M.requestStep) M.requestStep(E,\"stall failsafe re-ask\"); }catch(e4){}\n" +
  "          }\n" +
  "          stage=0;\n" +
  "        }\n" +
  "      }catch(e){}\n" +
  "    }, 6000);\n" +
  "  })();\n\n" +
  "  // ---- __KV_V237: full-log resync -- the flux chain is the record; rebuild from it ----",
  1
);


// ---- (29) __KV_V361: fan-out counts the relay's dedup as stored ----
// (relay v57 answers reason:"duplicate" when the entry already reached a node
// via the orderer or the other board; the client counted that as a miss and
// printed "stored on 0/3" while every node in fact held the entry. Real
// failures were invisible behind the same line.)
replaceCounted(
  "fanout-duplicate-is-stored",
  "      if(byU[L[k]] && byU[L[k]].stored===true) stored++;",
  "      var __fo=byU[L[k]];   // __KV_V361: the relay's dedup IS storage\n" +
  "      if(__fo && (__fo.stored===true || String(__fo.reason||\"\")===\"duplicate\" || String((__fo.result||{}).reason||\"\")===\"duplicate\")) stored++;\n" +
  "      else if(__fo){   // __KV_V362: a fulfilled non-store is a refusal \u2014 name it\n" +
  "        if(!M.__fanRef || Date.now()-M.__fanRef>10000){ M.__fanRef=Date.now();\n" +
  "          var __why=String(__fo.reason||(__fo.result||{}).reason||__fo.error||JSON.stringify(__fo).slice(0,60)||\"unspecified\");\n" +
  "          log(\"fan-out refused by \"+L[k]+\" \u2014 \"+__why.slice(0,70), \"#e0a040\");\n" +
  "        }\n" +
  "      }\n" +
  "      else if(r.status===\"rejected\" && (!M.__fanErr || Date.now()-M.__fanErr>15000)){\n" +
  "        M.__fanErr=Date.now();\n" +
  "        log(\"fan-out miss: \"+L[k]+\" \u2014 \"+String((r.reason&&r.reason.message)||r.reason||\"no response\").slice(0,80), \"#e0a040\");\n" +
  "      }",
  1
);

// ---- (30) __KV_V361: the sealed game goes quiet ----
// (room kca0026358: both boards kept polling for 25+ minutes after the bell,
// printing "relay divergence: ... head 126 < 127" every 15s for a node the
// client deliberately never reseeds. Sealed means done: the poll stops.)
replaceCounted(
  "sealed-poll-stop",
  "    if(!M.room || M.polling) return;",
  "    if(!M.room || M.polling) return;\n" +
  "    if(window.KV_SEALED){   // __KV_V361: the record is sealed \u2014 nothing left to poll\n" +
  "      if(!M.__sealBye){ M.__sealBye=1; log(\"chain polling stopped \u2014 the record is sealed\",\"#8a9aae\"); }\n" +
  "      return;\n" +
  "    }",
  1
);

// ---- (31) __KV_V361: net worth from the sealed chain, not the local index ----
// (room kca0026358: seat 3 ranked with netWorth 1708 on one board and 1761 on
// the other \u2014 propValOf prices deeds through the LOCAL market index, which
// drifts per board. The sealed snap is shared truth: cash from part 0, deeds
// from part 2 at base price. Both boards now print the same seats block.)
replaceCounted(
  "seal-networth-from-chain",
  "    rows.sort(function(a,b){return b.netWorth-a.netWorth;});",
  "    try{   // __KV_V361: value the ranking from the last acked chain snap\n" +
  "      var __mvW=window.KV_MOVES||[], __sW=null;\n" +
  "      for(var __wi=__mvW.length-1;__wi>=0;__wi--){ var __wr=__mvW[__wi]; if(__wr&&__wr.__acked&&__wr.snap){ __sW=String(__wr.snap); break; } }\n" +
  "      if(__sW){\n" +
  "        var __pW=__sW.split(\"|\"), __cashW=(__pW[0]||\"\").split(\",\"), __ownW=(__pW[2]||\"\").split(\",\").filter(Boolean);\n" +
  "        var __pvW={1:0,2:0,3:0,4:0}, __NW=window.KV_NAMES||{};\n" +
  "        for(var __oi=0;__oi<__ownW.length;__oi++){ var __mm=/^t(\\d+)>([1-4])$/.exec(__ownW[__oi]); if(!__mm) continue;\n" +
  "          var __tW=+__mm[1], __sO=+__mm[2]; __pvW[__sO]=(__pvW[__sO]||0)+((__NW[__tW]&&__NW[__tW].p)||0); }\n" +
  "        rows.forEach(function(__r){ var __cW=+__cashW[__r.seat-1];\n" +
  "          if(isFinite(__cW)) __r.netWorth=Math.round(__cW+(__pvW[__r.seat]||0)); });\n" +
  "      }\n" +
  "    }catch(__eW){}\n" +
  "    rows.sort(function(a,b){return b.netWorth-a.netWorth;});",
  1
);

// ---- (32) __KV_V362: GO stamps the gun on the wall clock ----
replaceCounted(
  "gun-timestamp",
  '          window.KV_SETSTATE("t0", (__w && __w.time) ? __w.time : 0.01);\n' +
  '          window.KV_SETSTATE("left", 420);\n' +
  '          window.KV_SETSTATE("mark", 420);',
  '          window.KV_SETSTATE("t0", (__w && __w.time) ? __w.time : 0.01);\n' +
  '          window.KV_SETSTATE("left", 420);\n' +
  '          window.KV_SETSTATE("mark", 420);\n' +
  '          M.__goAt = Date.now();   // __KV_V362: the gun is the one clock origin',
  1
);

// ---- (33) __KV_V362: the clock warden — left answers to the gun, always ----
replaceCounted(
  "clock-warden",
  "  // ---- __KV_V237: full-log resync -- the flux chain is the record; rebuild from it ----",
  "  // ---- __KV_V362: the clock answers to the gun -- no resync can move it ----\n" +
  "  (function(){\n" +
  "    setInterval(function(){\n" +
  "      try{\n" +
  "        if(!M.started || M.halted || window.KV_SEALED || !M.__goAt) return;\n" +
  "        var mv=window.KV_MOVES||[];\n" +
  "        for(var bi=mv.length-1;bi>=0;bi--){ var br=mv[bi]; if(br&&String(br.a)===\"end_game\") return; }\n" +
  "        var want=Math.max(0, 420 - Math.round((Date.now()-M.__goAt)/1000));\n" +
  "        var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};\n" +
  "        var have=(f.left!=null)?Math.round(f.left):null;\n" +
  "        if(have==null || Math.abs(have-want)<=3) return;\n" +
  "        if(window.KV_SETSTATE){\n" +
  "          var __w2=window.KV_WORLD;\n" +
  "          window.KV_SETSTATE(\"left\", want);\n" +
  "          window.KV_SETSTATE(\"mark\", want);\n" +
  "          window.KV_SETSTATE(\"t0\", (__w2 && __w2.time) ? __w2.time : 0.01);\n" +
  "        }\n" +
  "        if(!M.__clkLog || Date.now()-M.__clkLog>20000){ M.__clkLog=Date.now();\n" +
  "          log(\"clock re-anchored to the gun \u2014 engine said \"+have+\"s, the gun says \"+want+\"s\",\"#caa64c\");\n" +
  "        }\n" +
  "      }catch(e){}\n" +
  "    }, 2000);\n" +
  "    // __KV_V365: the gun rings the bell — a quiet chain can still end\n" +
  "    setInterval(function(){\n" +
  "      try{\n" +
  "        if(!M.started || M.halted || window.KV_SEALED || !M.__goAt) return;\n" +
  "        if(M.role!==\"host\") return;\n" +
  "        var left=420 - Math.round((Date.now()-M.__goAt)/1000);\n" +
  "        if(left > -10) return;   // 10s of grace past zero\n" +
  "        var mv=window.KV_MOVES||[];\n" +
  "        for(var bi=mv.length-1;bi>=0;bi--){ var br=mv[bi]; if(br&&String(br.a)===\"end_game\") return; }\n" +
  "        if(M.__gunBell) return; M.__gunBell=1;\n" +
  "        log(\"the gun says the game is over \u2014 ringing the bell\",\"#caa64c\");\n" +
  "        try{ if(window.KV_MOVE) window.KV_MOVE(M.seat,\"end_game\",0); }catch(e9){}\n" +
  "      }catch(e){}\n" +
  "    }, 2000);\n" +
  "  })();\n\n" +
  "  // ---- __KV_V237: full-log resync -- the flux chain is the record; rebuild from it ----",
  1
);

// ---- (36) __KV_V364: the first KV_MOVE wrapper forwards fx ----
replaceCounted(
  "kasmove-fx-passthrough",
  'window.KV_MOVE = function(seat, action, value){\n      var r = baseMove ? baseMove(seat, action, value) : null;',
  'window.KV_MOVE = function(seat, action, value, fx){                       // __KV_V364\n      var r = baseMove ? baseMove(seat, action, value, fx) : null;',
  1
);

// ---- (37) __KV_V364: the KAS escrow engine ----
replaceCounted(
  "kas-escrow-engine",
  "  // ---- __KV_V237: full-log resync -- the flux chain is the record; rebuild from it ----",
  "  // ---- __KV_V364: deeds trade for real Kaspa -- the game records, Kaspa settles ----\n" +
  "  (function(){\n" +
  "    var K = window.KV_KAS = { pending:{}, seenI:{}, listings:{} };\n" +
  "    K.api = function(addr){ return String(addr||\"\").indexOf(\"kaspatest:\")===0 ? \"https://api-tn10.kaspa.org\" : \"https://api.kaspa.org\"; };   // __KV_V365\n" +
  "    K.verify = async function(txid, addr, centiKas){\n" +
  "      var r = await fetch(K.api(addr)+\"/transactions/\"+encodeURIComponent(txid)+\"?inputs=false&outputs=true\");\n" +
  "      if(!r.ok) throw new Error(\"tx not found (\"+r.status+\")\");\n" +
  "      var tx = await r.json();\n" +
  "      if(tx.is_accepted===false) throw new Error(\"tx not accepted yet\");\n" +
  "      var need = Math.round(centiKas*1e6);   // centi-KAS -> sompi\n" +
  "      var got = 0, outs = tx.outputs||[];\n" +
  "      for(var i=0;i<outs.length;i++){\n" +
  "        var oa = outs[i].script_public_key_address || outs[i].address || \"\";\n" +
  "        if(String(oa)===String(addr)) got += (+outs[i].amount||0);\n" +
  "      }\n" +
  "      if(got < need) throw new Error(\"paid \"+got+\" sompi, need \"+need);\n" +
  "      return { got:got, need:need };\n" +
  "    };\n" +
  "    function fmt(c){ return (c/100).toFixed(2)+\" KAS\"; }\n" +
  "    function nameOf(t){ var N=window.KV_NAMES||{}; return (N[t]&&N[t].n)||(\"block \"+t); }\n" +
  "    function xfer(tile, buyer){\n" +
  "      try{ var w=window.KV_WORLD; if(w){ w.owners=w.owners||{}; w.owners[\"t\"+tile]=+buyer; } }catch(e){}\n" +
  "    }\n" +
  "    setInterval(function(){\n" +
  "      try{\n" +
  "        if(!M.started || M.halted) return;\n" +
  "        var mv=window.KV_MOVES||[];\n" +
  "        for(var i=0;i<mv.length;i++){\n" +
  "          var r=mv[i]; if(!r || !r.__acked || K.seenI[i]) continue;\n" +
  "          var a=String(r.a||\"\"); if(a.indexOf(\"kas\")!==0) continue;\n" +
  "          K.seenI[i]=1;\n" +
  "          var pp=a.split(\":\"), kind=pp[0], tile=+pp[1]||0, extra=pp[2];\n" +
  "          if(kind===\"kaslist\"){\n" +
  "            K.listings[tile]={ amt:+r.v, addr:String(r.fx||\"\"), seller:+r.s };   // __KV_V366\n" +
  "            log(\"P\"+r.s+\"  LISTS \"+nameOf(tile)+\"  at \"+fmt(+r.v)+\"  (Kaspa)\",\"#7cc9e8\");\n" +
  "          } else if(kind===\"kasbuy\"){   // __KV_V366: buyer-posted accept at list price\n" +
  "            var L1=K.listings[tile];\n" +
  "            if(!L1){ log(\"kasbuy for \"+nameOf(tile)+\" with no listing on the chain \u2014 ignored\",\"#e05050\"); }\n" +
  "            else {\n" +
  "              K.pending[tile]={ amt:L1.amt, addr:L1.addr, seller:L1.seller, buyer:+r.s, at:Date.now(), paid:null, settled:false };\n" +
  "              log(\"KAS TRADE  \"+nameOf(tile)+\"  P\"+r.s+\" -> P\"+L1.seller+\"  \"+fmt(L1.amt)+\" \u2014 deed in escrow, buyer pays the seller's address\",\"#f0c860\");\n" +
  "            }\n" +
  "          } else if(kind===\"kasbid\"){\n" +
  "            log(\"P\"+r.s+\"  bids \"+fmt(+r.v)+\"  for \"+nameOf(tile)+\"  (Kaspa)\",\"#7cc9e8\");\n" +
  "          } else if(kind===\"kasaccept\"){\n" +
  "            K.pending[tile]={ amt:+r.v, addr:String(r.fx||\"\"), seller:+r.s, buyer:+extra||0, at:Date.now(), paid:null, settled:false };\n" +
  "            log(\"KAS TRADE  \"+nameOf(tile)+\"  P\"+extra+\" -> P\"+r.s+\"  \"+fmt(+r.v)+\" \u2014 deed in escrow, pay the seller's address\",\"#f0c860\");\n" +
  "          } else if(kind===\"kaspay\"){\n" +
  "            var p1=K.pending[tile];\n" +
  "            if(!p1){   // __KV_V365: payment always wins — rebuild the escrow from the chain's accept\n" +
  "              for(var k2=i-1;k2>=0;k2--){ var b2=mv[k2]; if(!b2||!b2.__acked) continue;\n" +
  "                var q2=String(b2.a||\"\").split(\":\");\n" +
  "                if((q2[0]===\"kasaccept\"||q2[0]===\"kasbuy\") && +q2[1]===tile){\n" +
  "                  if(q2[0]===\"kasbuy\"){ var L2=K.listings[tile]||{}; p1=K.pending[tile]={ amt:(L2.amt!=null?L2.amt:+b2.v), addr:String(L2.addr||\"\"), seller:+(L2.seller||q2[2]||0), buyer:+b2.s, at:Date.now(), paid:null, settled:false }; }\n" +
  "                  else p1=K.pending[tile]={ amt:+b2.v, addr:String(b2.fx||\"\"), seller:+b2.s, buyer:+q2[2]||0, at:Date.now(), paid:null, settled:false };\n" +
  "                  log(\"KAS escrow revived from the chain's accept \u2014 a payment is never orphaned\",\"#f0c860\"); break; } }\n" +
  "              if(!p1){ log(\"kaspay for \"+nameOf(tile)+\" with no accept on the chain \u2014 nothing to settle against\",\"#e05050\"); continue; }\n" +
  "            }\n" +
  "            p1.paid=String(r.fx||\"\");\n" +
  "            log(\"KAS payment posted for \"+nameOf(tile)+\" \u2014 txid \"+p1.paid.slice(0,16)+\"\u2026 verifying on Kaspa\",\"#7cc9e8\");\n" +
  "            if(M.seat===p1.seller){   // the payee's board settles \u2014 ONCE (__KV_V409)\n" +
  "              (function(tl,pd){\n" +
  "                K.setl=K.setl||{}; if(K.setl[tl]) return; \n" +
  "                for(var q9=0;q9<mv.length;q9++){ var m9=mv[q9]; if(m9&&String(m9.a||\"\").indexOf(\"kassettle:\"+tl+\":\")===0){ K.setl[tl]=1; return; } }\n" +
  "                K.setl[tl]=1;\n" +
  "                K.verify(pd.paid,pd.addr,pd.amt).then(function(){\n" +
  "                // __KV_V410: the settle CARRIES the deed \u2014 fx={txid,deed:{tile:buyer}}.\n" +
  "                // The engine's generic fx applier flips ownership on every board as a\n" +
  "                // recorded change, the exact mechanism in-game remote accepts use.\n" +
  "                var fxO={ txid:String(pd.paid||\"\"), deed:{} }; fxO.deed[tl]=+pd.buyer;\n" +
  "                if(window.KV_MOVE) window.KV_MOVE(M.seat,\"kassettle:\"+tl+\":\"+pd.buyer,pd.amt,fxO);\n" +
  "              }).catch(function(e){ log(\"KAS verify failed for \"+nameOf(tl)+\" \u2014 \"+String(e.message||e).slice(0,70),\"#e05050\"); }); })(tile,p1);\n" +
  "            }\n" +
  "          } else if(kind===\"kassettle\"){\n" +
  "            var p2=K.pending[tile]||{ amt:+r.v, addr:\"\", buyer:+extra||0 };\n" +
  "            (function(tl,pd,fxT,by){\n" +
  "              var chk = pd.addr ? K.verify(fxT,pd.addr,pd.amt) : Promise.resolve();   // no local accept seen: honor the acked settle\n" +
  "              chk.then(function(){\n" +
  "                // __KV_V409: raw w.owners writes tripped the engine's reconciler on EVERY\n" +
  "                // board \u2014 each posted a corrective p2pbuy as itself and the deed flip-flopped.\n" +
  "                // Now ONLY the buyer's board transfers, chain-natively, exactly once; all\n" +
  "                // other boards just apply the buyer's p2pbuy when it arrives off the chain.\n" +
  "                // __KV_V410: no p2pbuy \u2014 the settle's own fx.deed moved the ownership;\n" +
  "                // a bare p2pbuy was ignored by the engine without a live trade behind it.\n" +
  "                if(K.pending[tl]) K.pending[tl].settled=true; delete K.pending[tl]; delete K.listings[tl];   // __KV_V366\n" +
  "                log(\"KAS DEAL  \"+nameOf(tl)+\"  deed \u2192 P\"+by+\"  for \"+fmt(+pd.amt)+\"  txid \"+String(fxT).slice(0,16)+\"\u2026 (verified)\",\"#9cd87c\");\n" +
  "              }).catch(function(e){\n" +
  "                log(\"KAS settle REFUSED locally for \"+nameOf(tl)+\" \u2014 \"+String(e.message||e).slice(0,70)+\" \u2014 deed NOT transferred on this board\",\"#e05050\");\n" +
  "              });\n" +
  "            })(tile, p2, String((r.fx&&r.fx.txid)||r.fx||\"\"), +extra||0);\n" +
  "          } else if(kind===\"kasvoid\"){\n" +
  "            delete K.pending[tile];   // the listing survives a void \u2014 the deed is still for sale\n" +
  "            log(\"KAS trade for \"+nameOf(tile)+\" voided \u2014 deed stays with the seller\",\"#7a6a58\");\n" +
  "          }\n" +
  "        }\n" +
  "        // __KV_V365: no wall-clock auto-void — a void can never race a payment; KV.kasvoid is manual\n" +
  "      }catch(e){}\n" +
  "    }, 2000);\n" +
  "  })();\n\n" +
  "  // ---- __KV_V237: full-log resync -- the flux chain is the record; rebuild from it ----",
  1
);

// ---- (38) __KV_V364: KAS console commands ----
replaceCounted(
  "kas-console",
  '    window.KV.resync=function(){ return M.resync("manual"); };   // __KV_V237',
  '    window.KV.resync=function(){ return M.resync("manual"); };   // __KV_V237\n' +
  '    // __KV_V364: KAS trade console (amounts in KAS, e.g. 0.5)\n' +
  '    window.KV.kaslist=function(tile,kas,addr){ if(!addr||String(addr).indexOf("kaspa")!==0){ console.log("need your kaspa: address"); return; } return window.KV_MOVE(M.seat,"kaslist:"+tile,Math.round(kas*100),String(addr)); };\n' +
  '    window.KV.kasbid=function(tile,kas){ return window.KV_MOVE(M.seat,"kasbid:"+tile,Math.round(kas*100)); };\n' +
  '    window.KV.kasleft=function(){ return M.__goAt ? Math.max(0,420-Math.round((Date.now()-M.__goAt)/1000)) : 420; };   // __KV_V365\n' +
  '    window.KV.kasvoid=function(tile){ return window.KV_MOVE(M.seat,"kasvoid:"+tile,0); };\n' +
  '    window.KV.kasaccept=function(tile,buyerSeat){\n' +
  '      if(window.KV.kasleft()<90){ console.log("under 90s on the gun — too late to open a KAS trade this game"); return; }\n' +
  '      var mv=window.KV_MOVES||[],ls=null,bd=null;\n' +
  '      for(var i=mv.length-1;i>=0;i--){ var r=mv[i]; if(!r) continue; var a=String(r.a||"");\n' +
  '        if(!ls&&a==="kaslist:"+tile) ls=r;\n' +
  '        if(!bd&&a==="kasbid:"+tile&&(+r.s===+buyerSeat)) bd=r; }\n' +
  '      if(!ls){ console.log("no kaslist for tile "+tile+" on the chain"); return; }\n' +
  '      var amt=bd?+bd.v:+ls.v;\n' +
  '      return window.KV_MOVE(M.seat,"kasaccept:"+tile+":"+buyerSeat,amt,String(ls.fx||"")); };\n' +
  '    window.KV.kaspaid=function(tile,txid){\n' +
  '      if(window.KV.kasleft()<60){ console.log("under 60s on the gun — DO NOT SEND KAS: a sealed chain cannot settle. Trade after the game."); return; }\n' +
  '      return window.KV_MOVE(M.seat,"kaspay:"+tile,0,String(txid)); };\n' +
  '    window.KV.kas=function(){ console.table(window.KV_KAS?window.KV_KAS.pending:{}); return window.KV_KAS&&window.KV_KAS.pending; };',
  1
);

// ---- (43) __KV_V366: the KAS trade panel ----
replaceCounted(
  "kas-panel",
  "  // ---- __KV_V237: full-log resync -- the flux chain is the record; rebuild from it ----",
  "  // ---- __KV_V366: the KAS trade panel -- buttons on the proven escrow ----\n" +
  "  (function(){\n" +
  "    var css=document.createElement(\"style\");\n" +
  "    css.textContent=\"#kvkbtn{position:fixed;right:12px;bottom:12px;z-index:9800;background:#3a2f1c;color:#f0c860;border:1px solid #6a5a34;padding:2px 8px;font:700 10px Consolas,monospace;cursor:pointer;border-radius:6px}\"+\n" +
  "      \"#kvkpan{position:fixed;right:12px;bottom:36px;z-index:9800;width:340px;max-height:70vh;overflow-y:auto;background:#141210;color:#e8ddc8;border:1px solid #6a5a34;border-radius:8px;padding:10px;font:12px/1.5 Consolas,monospace;display:none}\"+\n" +
  "      \"#kvkpan h4{margin:8px 0 4px;color:#caa64c;font-size:12px}#kvkpan input,#kvkpan select{background:#201c17;color:#e8ddc8;border:1px solid #4a4438;padding:3px 5px;font:inherit}\"+\n" +
  "      \"#kvkpan button{background:#3a2f1c;color:#f0c860;border:1px solid #6a5a34;padding:3px 10px;font:inherit;cursor:pointer;margin:2px}#kvkpan .row{margin:3px 0;border-bottom:1px dotted #3a342c;padding:3px 0}#kvkpan .mut{color:#7a6a58}\";\n" +
  "    document.head.appendChild(css);\n" +
  "    var btn=document.createElement(\"button\"); btn.id=\"kvkbtn\"; btn.textContent=\"\\u26a1 KAS\";\n" +
  "    var pan=document.createElement(\"div\"); pan.id=\"kvkpan\";\n" +
  "    document.body.appendChild(btn); document.body.appendChild(pan);\n" +
  "    btn.onclick=function(){ pan.style.display = pan.style.display===\"block\" ? \"none\" : \"block\"; render(); };\n" +
  "    function esc(x){ return String(x).replace(/[<>&\"]/g,function(c){return {\"<\":\"&lt;\",\">\":\"&gt;\",\"&\":\"&amp;\",'\"':\"&quot;\"}[c];}); }\n" +
  "    function fmt(c){ return (c/100).toFixed(2)+\" KAS\"; }\n" +
  "    // __KV_V407: people paste labels along with addresses (like: Kaspa address: kaspatest:qp...).\n" +
  "    // Extract the real kaspa:/kaspatest: string from whatever is in the field.\n" +
  "    function cleanAddr(v){ var m=/((kaspa(?:test)?):[a-z0-9]{10,})/i.exec(String(v||\"\")); return m? m[1].toLowerCase() : String(v||\"\").trim(); }\n" +
  "    function myAddr(){ try{ return cleanAddr(localStorage.getItem(\"kv_kas_addr\")||\"\"); }catch(e){ return \"\"; } }\n" +
  "    function setMsg(t,c){ var m=document.getElementById(\"kvk_msg\"); if(m){ m.textContent=t||\"\"; m.style.color=c||\"#e05050\"; } }\n" +  "    // __KV_V403: the engine's global key handler eats typing in these inputs\n" +
  "    // (only unbound keys like k got through). Shield every input from the game\n" +
  "    // and give each a \\ud83d\\udccb paste helper that the engine cannot intercept.\n" +
  "    function armInputs(){\n" +
  "      var ins=pan.querySelectorAll(\"input\");\n" +
  "      for(var k5=0;k5<ins.length;k5++){ (function(el){\n" +
  "        if(el.__sh) return; el.__sh=1;\n" +
  "        [\"keydown\",\"keyup\",\"keypress\",\"paste\"].forEach(function(t5){\n" +
  "          el.addEventListener(t5,function(e5){ e5.stopPropagation(); }); });\n" +
  "        var pb=document.createElement(\"button\"); pb.textContent=\"\\ud83d\\udccb\"; pb.title=\"paste from clipboard\";\n" +
  "        pb.style.marginLeft=\"4px\";\n" +
  "        pb.onclick=function(){\n" +
  "          var done=function(v5){ if(v5){ el.value=(\"\"+v5).trim(); try{ el.dispatchEvent(new Event(\"input\")); }catch(e6){} } };\n" +
  "          try{ navigator.clipboard.readText().then(done,function(){ done(window.prompt(\"paste here:\")||\"\"); }); }\n" +
  "          catch(e7){ done(window.prompt(\"paste here:\")||\"\"); }\n" +
  "        };\n" +
  "        el.parentNode.insertBefore(pb, el.nextSibling);\n" +
  "      })(ins[k5]); }\n" +
  "    }\n" +
  "    function owners(){ var w=window.KV_WORLD; return (w&&w.owners)||{}; }\n" +
  "    function render(){\n" +
  "      // __KV_V406: THE input killer, found at last \u2014 this panel re-renders its\n" +
  "      // whole innerHTML every 2s (the countdown), destroying the inputs mid-\n" +
  "      // keystroke. That was every dead address field since v366. While the\n" +
  "      // person is typing in any panel input, the render waits; and values\n" +
  "      // typed but not yet saved survive the next rebuild.\n" +
  "      if(pan.style.display===\"block\"&&pan.contains(document.activeElement)&&document.activeElement.tagName===\"INPUT\") return;\n" +
  "      var keep={}; var olds=pan.querySelectorAll(\"input\");\n" +
  "      for(var k7=0;k7<olds.length;k7++){ if(olds[k7].id) keep[olds[k7].id]=olds[k7].value; }\n" +
  "      if(pan.style.display!==\"block\") return;\n" +
  "      var K=window.KV_KAS||{listings:{},pending:{}}, N=window.KV_NAMES||{}, ow=owners();\n" +
  "      var left=(window.KV&&window.KV.kasleft)?window.KV.kasleft():420;\n" +
  "      var h=\"<h4>KAS trades \\u2014 \"+(left>0?left+\"s on the gun\":\"game over\")+\"</h4>\";\n" +
  "      h+=\"<div>my address <input id='kvk_addr' style='width:210px' value='\"+esc(myAddr())+\"' placeholder='kaspa:... / kaspatest:...'> <button id='kvk_save'>save</button></div>\";\n" +
  "      h+=\"<h4>list my block</h4>\";\n" +
  "      var opts=\"\"; Object.keys(N).forEach(function(t){ if(+ow[\"t\"+t]===+M.seat && !K.listings[t]) opts+=\"<option value='\"+t+\"'>\"+esc(N[t].n)+\"</option>\"; });\n" +
  "      if(opts) h+=\"<div><select id='kvk_tile'>\"+opts+\"</select> <input id='kvk_kas' style='width:52px' value='0.10'> KAS <button id='kvk_list'>List</button></div><div id='kvk_msg' style='font-size:11px;margin:2px 0'></div>\";\n" +
  "      else h+=\"<div class='mut'>no unlisted blocks of yours</div>\";\n" +
  "      h+=\"<h4>listings</h4>\"; var any=0;\n" +
  "      Object.keys(K.listings).forEach(function(t){ var L=K.listings[t]; any=1;\n" +
  "        h+=\"<div class='row'>\"+esc((N[t]&&N[t].n)||(\"block \"+t))+\" \\u00b7 \"+fmt(L.amt)+\" \\u00b7 P\"+L.seller;\n" +
  "        if(+L.seller!==+M.seat && !K.pending[t]) h+=\" <button data-buy='\"+t+\"'>Buy</button>\";\n" +
  "        if(K.pending[t]) h+=\" <span class='mut'>escrow open</span>\";\n" +
  "        h+=\"</div>\"; });\n" +
  "      if(!any) h+=\"<div class='mut'>none on the chain</div>\";\n" +
  "      h+=\"<h4>open escrows</h4>\"; var anyP=0;\n" +
  "      Object.keys(K.pending).forEach(function(t){ var p=K.pending[t]; anyP=1;\n" +
  "        h+=\"<div class='row'>\"+esc((N[t]&&N[t].n)||(\"block \"+t))+\" \\u00b7 \"+fmt(p.amt)+\" \\u00b7 P\"+p.buyer+\" pays P\"+p.seller;\n" +
  "        if(+p.buyer===+M.seat){\n" +
  "          h+=\"<div>send \"+fmt(p.amt)+\" to:<br><span style='word-break:break-all;color:#7cc9e8'>\"+esc(p.addr)+\"</span></div>\";\n" +
  "          var ow9=(function(){ try{ var w9=window.KV_WORLD; return w9&&w9.owners?(+w9.owners[\"t\"+t]||0):0; }catch(e9){ return 0; } })();\n" +
  "          if(ow9 && +ow9!==+p.seller){\n" +
  "            h+=\"<div style='color:#e05050'>\\u26a0 tile now owned by P\"+ow9+\" \\u2014 sold in-game mid-escrow. Do NOT send KAS; this escrow is dead.</div>\";   // __KV_V411\n" +
  "          } else\n" +
  "          h+=(p.paid?\"<div class='mut'>txid posted \\u2014 verifying/settling\\u2026</div>\":\"<div><input id='kvk_tx_\"+t+\"' style='width:200px' placeholder='paste txid'> <button data-paid='\"+t+\"'>I paid</button> <span id='kvk_pm_\"+t+\"' style='font-size:11px'></span></div>\");\n" +
  "        } else if(+p.seller===+M.seat){ h+=\" <button data-void='\"+t+\"'>void</button>\"+(p.paid?\" <span class='mut'>verifying\\u2026</span>\":\"\"); }\n" +
  "        h+=\"</div>\"; });\n" +
  "      if(!anyP) h+=\"<div class='mut'>none</div>\";\n" +
  "      pan.innerHTML=h;\n" +
  "      for(var k8 in keep){ var el8=document.getElementById(k8); if(el8&&keep[k8]!==undefined&&keep[k8]!==\"\") el8.value=keep[k8]; }\n" +
  "      armInputs();\n" +
  "      var sv=document.getElementById(\"kvk_save\"); if(sv) sv.onclick=function(){ try{ localStorage.setItem(\"kv_kas_addr\", cleanAddr(document.getElementById(\"kvk_addr\").value)); }catch(e){} render(); };\n" +
  "      var lb=document.getElementById(\"kvk_list\"); if(lb) lb.onclick=function(){\n" +
  "        var ad=myAddr()||cleanAddr(document.getElementById(\"kvk_addr\").value);\n" +
  "        if(ad.indexOf(\"kaspa\")!==0){ setMsg(\"need a kaspa:/kaspatest: address \\u2014 fix the field and save\"); log(\"KAS panel: save your kaspa address first\",\"#e05050\"); return; }\n" +
  "        if(window.KV.kasleft()<90){ setMsg(\"under 90s on the gun \\u2014 too late to list this game\",\"#e0a040\"); log(\"under 90s on the gun \\u2014 too late to list this game\",\"#e0a040\"); return; }\n" +
  "        setMsg(\"listing\\u2026\",\"#9cd87c\");\n" +
  "        window.KV.kaslist(+document.getElementById(\"kvk_tile\").value, +document.getElementById(\"kvk_kas\").value, ad); };\n" +
  "      pan.querySelectorAll(\"[data-buy]\").forEach(function(b){ b.onclick=function(){\n" +
  "        if(window.KV.kasleft()<90){ log(\"under 90s on the gun \\u2014 too late to buy this game\",\"#e0a040\"); return; }\n" +
  "        var t=b.getAttribute(\"data-buy\"), L=window.KV_KAS.listings[t];\n" +
  "        window.KV_MOVE(M.seat,\"kasbuy:\"+t+\":\"+L.seller,L.amt); }; });\n" +
  "      pan.querySelectorAll(\"[data-paid]\").forEach(function(b){ b.onclick=function(){\n" +
  "        var t=b.getAttribute(\"data-paid\"), tx=(document.getElementById(\"kvk_tx_\"+t)||{}).value||\"\";\n" +
  "        var pm=document.getElementById(\"kvk_pm_\"+t);\n" +
  "        var say=function(m9,c9){ if(pm){ pm.textContent=m9; pm.style.color=c9||\"#e05050\"; } log(m9,c9||\"#e05050\"); };   // __KV_V411: inline AND feed\n" +
  "        if(tx.trim().length<32){ say(\"paste the txid from your wallet first\"); return; }\n" +
  "        if(window.KV.kasleft&&window.KV.kasleft()<60){ say(\"under 60s on the gun \\u2014 too late; do NOT send KAS this game\",\"#e0a040\"); return; }\n" +
  "        say(\"posting txid \\u2014 the seller's board verifies on Kaspa\\u2026\",\"#9cd87c\");\n" +
  "        window.KV.kaspaid(+t, tx.trim()); }; });\n" +
  "      pan.querySelectorAll(\"[data-void]\").forEach(function(b){ b.onclick=function(){ window.KV.kasvoid(+b.getAttribute(\"data-void\")); }; });\n" +
  "    }\n" +
  "    setInterval(render, 2000);\n" +
  "  })();\n\n" +
  "  // ---- __KV_V237: full-log resync -- the flux chain is the record; rebuild from it ----",
  1
);

// ---- (44) __KV_V367: the bottom toolbar ----
replaceCounted(
  "kv-toolbar",
  "  // ---- __KV_V237: full-log resync -- the flux chain is the record; rebuild from it ----",
  "  // ---- __KV_V367: the bottom toolbar -- one bar owns the floating UI ----\n" +
  "  (function(){\n" +
  "    var css=document.createElement(\"style\");\n" +
  "    css.textContent=\"#kvbar{position:fixed;left:0;right:0;bottom:0;z-index:9700;height:34px;display:flex;align-items:center;flex-wrap:nowrap;overflow:hidden;gap:5px;padding:1px 8px;background:rgba(16,13,10,.94);border-top:1px solid #5a4a3a;font:12px monospace;color:#f4e4c1}\"+\n" +
  "      \"#kvbar .kvtb{background:#2a2118;color:#f0c860;border:1px solid #6a5a34;border-radius:4px;padding:1px 8px;font:10px monospace;cursor:pointer;white-space:nowrap;line-height:1.4}\"+\n" +
  "      \"#kvbar .kvtb.on{background:#3a2f1c;border-color:#caa64c}\"+\n" +
  "      \"#kvbar_stat{margin-left:auto;color:#c8b898;font:10px monospace;white-space:nowrap}\"+\n" +
  "      \"#kvbar_roll{display:inline-flex;align-items:center;height:100%;max-width:46vw;overflow:hidden;gap:4px;flex:0 1 auto}\"+\n" +
  "      \"#kvbar_roll button{display:none !important}\"+\n" +
  "      \"[data-kvsheet]{left:310px !important;right:150px !important}\"+\n" +
  "      \"[data-kvsheet][data-kvforeign]{display:none !important}\"+\n" +
  "      \"[data-kvsheet]{max-height:30px !important;overflow:hidden !important;display:flex !important;align-items:center !important;gap:8px !important;padding:2px 10px !important;background:rgba(16,13,10,.96) !important}\"+\n" +
  "      \"[data-kvsheet] *{display:inline-block !important;position:static !important;white-space:nowrap !important;margin:0 6px 0 0 !important;padding:0 5px !important;font-size:11px !important;line-height:24px !important;max-width:38vw !important;vertical-align:middle !important}\"+\n" +
  "      \"#kvbar_dlog{position:fixed;left:8px;bottom:36px;z-index:9700;display:none}\"+\n" +
  "      \"#kvbar_dwhw{position:fixed;left:8px;bottom:36px;z-index:9700;display:none;width:min(620px,92vw)}\"+\n" +
  "      \"#kvbar_dhold{position:fixed;left:8px;bottom:36px;z-index:9700;display:none;max-height:60vh;overflow-y:auto}\"+\n" +
  "      \"#kvbar_dpbp{position:fixed;right:8px;bottom:36px;z-index:9700;display:none;max-height:60vh;overflow-y:auto}\";\n" +
  "    document.head.appendChild(css);\n" +
  "    var bar=document.createElement(\"div\"); bar.id=\"kvbar\";\n" +
  "    bar.innerHTML=\"<span id='kvbar_roll'></span><button class='kvtb' id='kvbar_startb' style='display:none;background:#2c4a2c;border-color:#4a7a4a'>\\u25b6 START GAME</button><button class='kvtb' id='kvbar_holdb'>\\ud83c\\udfe0 HOLDINGS</button><button class='kvtb' id='kvbar_pbpb'>\\ud83d\\udcca PLAY BY PLAY</button><button class='kvtb' id='kvbar_whwb'>\\ud83d\\udcd6 WHAT HAD HAPPENED WAS</button><button class='kvtb' id='kvbar_logb'>\\ud83d\\udcdc LOG</button><button class='kvtb' id='kvbar_copyb' title='copy the move log for analysis'>\\ud83d\\udccb COPY LOG</button><input id='kvbar_addr' placeholder='kaspa my address' title='your kaspa address \\u2014 used by KAS trades' style='width:170px;background:#201c17;color:#e8ddc8;border:1px solid #4a4438;padding:2px 6px;font:10px monospace'><span id='kvbar_kas'></span><span id='kvbar_stat'></span>\";\n" +
  "    document.body.appendChild(bar);\n" +
  "    var dlog=document.createElement(\"div\"); dlog.id=\"kvbar_dlog\"; document.body.appendChild(dlog);\n" +
  "    var lb=document.getElementById(\"kvbar_logb\");\n" +
  "    lb.onclick=function(){ var on=dlog.style.display!==\"block\"; dlog.style.display=on?\"block\":\"none\"; lb.className=\"kvtb\"+(on?\" on\":\"\"); };\n" +
  "    var dwhw=document.createElement(\"div\"); dwhw.id=\"kvbar_dwhw\"; document.body.appendChild(dwhw);\n" +
  "    var dhold=document.createElement(\"div\"); dhold.id=\"kvbar_dhold\"; document.body.appendChild(dhold);\n" +
  "    var hb=document.getElementById(\"kvbar_holdb\");\n" +
  "    hb.onclick=function(){ var on=dhold.style.display!==\"block\"; dhold.style.display=on?\"block\":\"none\"; hb.className=\"kvtb\"+(on?\" on\":\"\"); };\n" +
  "    var dpbp=document.createElement(\"div\"); dpbp.id=\"kvbar_dpbp\"; document.body.appendChild(dpbp);\n" +
  "    var pb=document.getElementById(\"kvbar_pbpb\");\n" +
  "    pb.onclick=function(){ var on=dpbp.style.display!==\"block\"; dpbp.style.display=on?\"block\":\"none\"; pb.className=\"kvtb\"+(on?\" on\":\"\"); };\n" +
  "    var wb=document.getElementById(\"kvbar_whwb\");\n" +
  "    wb.onclick=function(){ var on=dwhw.style.display!==\"block\"; dwhw.style.display=on?\"block\":\"none\"; wb.className=\"kvtb\"+(on?\" on\":\"\"); };\n" +
  "    function adopt(){\n" +
  "      try{\n" +
  "        // ROLL (V240 button): textContent match, keep its own show/hide logic\n" +
  "        var slot=document.getElementById(\"kvbar_roll\");\n" +
  "        if(slot && !slot.firstChild){\n" +
  "          var bs=document.querySelectorAll(\"button\");\n" +
  "          for(var i=0;i<bs.length;i++){ var b=bs[i];\n" +
  "            if(/ROLL/.test(b.textContent||\"\") && b.id!==\"kvbar_logb\" && !bar.contains(b) && !b.closest(\"[data-kvmodal]\")){\n" +
  "              b.style.position=\"static\"; b.style.left=\"\"; b.style.bottom=\"\"; b.style.boxShadow=\"none\";\n" +
  "              b.style.padding=\"7px 18px\"; b.style.font=\"700 13px monospace\"; b.style.borderRadius=\"5px\";\n" +
  "              slot.appendChild(b); break; } }\n" +
  "        }\n" +
  "        // GAME LOG panel: the fixed div whose header says GAME LOG\n" +
  "        if(!dlog.firstChild){\n" +
  "          var ds=document.querySelectorAll(\"div\");\n" +
  "          for(var j=0;j<ds.length;j++){ var d=ds[j];\n" +
  "            if(d.style && d.style.position===\"fixed\" && d.firstChild && /GAME LOG/.test((d.firstChild.textContent||\"\")) && !bar.contains(d) && d!==dlog){\n" +
  "              d.style.position=\"static\"; d.style.right=\"\"; d.style.top=\"\"; d.style.width=\"300px\"; d.style.visibility=\"visible\";   // __KV_V369\n" +
  "              dlog.appendChild(d); break; } }\n" +
  "        }\n" +
  "        // HOLDINGS tabbed panel (left) -> drop-up\n" +
  "        { var hs=document.querySelectorAll(\"div\");\n" +
  "          for(var h2=0;h2<hs.length;h2++){ var hd=hs[h2]; if(!hd.style||hd.style.position!==\"fixed\"||bar.contains(hd)||hd===dhold||dhold.contains(hd)) continue;\n" +
  "            var ht=hd.textContent||\"\";\n" +
  "            if(ht.indexOf(\"HOLDINGS\")>=0 && ht.indexOf(\"MARKET\")>=0 && ht.indexOf(\"EVENTS\")>=0 && hd.querySelectorAll(\"div\").length<80){\n" +
  "              if(!dhold.firstChild){ hd.style.position=\"static\"; hd.style.left=\"\"; hd.style.top=\"\"; hd.style.bottom=\"\"; dhold.appendChild(hd); }\n" +
  "              else hd.style.display=\"none\";   // __KV_V388: the engine grew a twin \u2014 hide it\n" +
  "              break; } }\n" +
  "        }\n" +
  "        // PLAY BY PLAY feed (right) -> drop-up (the GAME LOG's twin)\n" +
  "        { var ps=document.querySelectorAll(\"div\");\n" +
  "          for(var p2=0;p2<ps.length;p2++){ var pd2=ps[p2]; if(!pd2.style||pd2.style.position!==\"fixed\"||bar.contains(pd2)||pd2===dpbp||dpbp.contains(pd2)) continue;\n" +
  "            var pt=(pd2.firstChild&&pd2.firstChild.textContent)||\"\";\n" +
  "            if(/PLAY BY PLAY/.test(pt)){\n" +
  "              if(!dpbp.firstChild){ pd2.style.position=\"static\"; pd2.style.left=\"\"; pd2.style.right=\"\"; pd2.style.top=\"\"; pd2.style.bottom=\"\"; pd2.style.width=\"320px\"; dpbp.appendChild(pd2); }\n" +
  "              else pd2.style.display=\"none\";   // __KV_V388: twin PBP \u2014 hide it\n" +
  "              break; } }\n" +
  "        }\n" +
  "        // __KV_V372: the engine's bottom action sheet (buy/pass, prompts) rides ABOVE the bar.\n" +
  "        // v370 only looked at body children anchored by bottom; the sheet lives deeper and\n" +
  "        // can be top-anchored, so now: scan every div, fixed OR absolute, hugging the screen\n" +
  "        // bottom \u2014 and v373 adopts it straight into the bar\'s roll slot.\n" +
  "        var all=document.querySelectorAll(\"div\");\n" +
  "        for(var l2=0;l2<all.length;l2++){ var le=all[l2];\n" +
  "          if(le===bar||bar.contains(le)||dlog.contains(le)||dwhw.contains(le)||dhold.contains(le)||dpbp.contains(le)) continue;\n" +
  "          var kid=le.id||\"\"; if(kid===\"kvkpan\"||kid===\"kvkbtn\"||kid.indexOf(\"kvbar\")===0) continue;\n" +
  "          if(le.__kvLift===0) continue;                       // rejected before \u2014 skip fast\n" +
  "          if(le.__kvLift!==1){\n" +
  "            var st2=window.getComputedStyle?getComputedStyle(le):le.style;\n" +
  "            if(st2.position!==\"fixed\"&&st2.position!==\"absolute\"){ le.__kvLift=0; continue; }\n" +
  "            var rc=le.getBoundingClientRect();\n" +
  "            if(!(rc.height>28&&rc.height<300&&rc.width>200&&rc.bottom>window.innerHeight-10&&rc.top>window.innerHeight*0.4)) continue;\n" +
  "            le.__kvLift=1; le.setAttribute(\"data-kvsheet\",\"1\");\n" +
  "          }\n" +
  "          // __KV_V386: back to the proven v372 lift \u2014 the sheet floats just above the\n" +
  "          // slim bar, full width, untouched by us. Re-asserted every tick so the engine's\n" +
  "          // re-renders can't sink it back under the border.\n" +
  "        }\n" +
  "        for(var l3=0;l3<all.length;l3++){ var lf=all[l3];\n" +
  "          if(lf.__kvLift!==1) continue;\n" +
  "          if((lf.style.transform||\"\").indexOf(\"translateY(-36px)\")<0) lf.style.transform=\"translateY(-36px)\";\n" +
  "        }\n" +
  "        // __KV_V401: the roll UI exists only on YOUR turn. When the engine is\n" +
  "        // provably acting for another seat (room game, started, both seat numbers\n" +
  "        // known and different), the sheet is display:none \u2014 nothing to spam, nothing\n" +
  "        // to mislead. It reappears the moment the turn is yours. Unsure = visible.\n" +
  "        // The sheet also lives at left:310px, clear of both gamepad circles, so its\n" +
  "        // taps land on it naturally (the left joystick was eating left-edge presses).\n" +
  "        var sg=document.querySelector(\"[data-kvsheet]\");\n" +
  "        if(sg){ var mpG=window.KV_MP2, fG=(window.KV_FLAGS&&window.KV_FLAGS())||{};\n" +
  "          var foreign=!!(mpG&&mpG.room&&mpG.started&&(mpG.seat>=1)&&(fG.seat>=1)&&(+fG.seat!==+mpG.seat));\n" +
  "          if(foreign){ if(!sg.hasAttribute(\"data-kvforeign\")) sg.setAttribute(\"data-kvforeign\",\"1\"); }\n" +
  "          else if(sg.hasAttribute(\"data-kvforeign\")) sg.removeAttribute(\"data-kvforeign\");\n" +
  "          window.__kvGuard={room:!!(mpG&&mpG.room),started:!!(mpG&&mpG.started),mySeat:mpG&&mpG.seat,engineSeat:fG.seat,hidden:foreign};\n" +
  "        }\n" +
  "        // __KV_V392: headerless twin feeds \u2014 any floating fixed panel carrying the\n" +
  "        // log() stream (stall-scan / clock re-anchored lines) is a duplicate of what the\n" +
  "        // LOG and PLAY BY PLAY drop-ups already hold. Hide it on sight.\n" +
  "        for(var f2=0;f2<all.length;f2++){ var fe=all[f2];\n" +
  "          if(fe.__kvFeed===0) continue;\n" +
  "          if(fe.__kvFeed===1){\n" +
  "            if(dlog.contains(fe)||dwhw.contains(fe)||dpbp.contains(fe)||dhold.contains(fe)){ fe.__kvFeed=0; fe.style.display=\"\"; }\n" +
  "            else if(fe.style.display!==\"none\") fe.style.display=\"none\";\n" +
  "            continue; }\n" +
  "          if(bar.contains(fe)||dlog.contains(fe)||dwhw.contains(fe)||dhold.contains(fe)||dpbp.contains(fe)){ fe.__kvFeed=0; continue; }\n" +
  "          var sf=window.getComputedStyle?getComputedStyle(fe):fe.style;\n" +
  "          if(sf.position!==\"fixed\"){ fe.__kvFeed=0; continue; }\n" +
  "          var tf=fe.textContent||\"\";\n" +
  "          if((tf.indexOf(\"stall-scan:\")>=0||tf.indexOf(\"clock re-anchored\")>=0)&&fe.querySelectorAll(\"div\").length<200&&!fe.querySelector(\"[data-kvmodal]\")&&tf.indexOf(\"HOLDINGS\")<0){\n" +
  "            fe.__kvFeed=1; fe.style.display=\"none\";\n" +
  "          }\n" +
  "        }\n" +
  "        // __KV_V373: bottom player cards ride up two inches \u2014 the lower board shows through\n" +
  "        for(var p3=0;p3<all.length;p3++){ var pe=all[p3];\n" +
  "          if(pe.__kvPc===0) continue;\n" +
  "          if(pe.__kvPc===1){ if((pe.style.transform||\"\").indexOf(\"-210\")<0) pe.style.transform=\"translateY(-210px)\"; continue; }\n" +
  "          var t3=(pe.textContent||\"\").trim();\n" +
  "          if(!(/^P[34]\\b/.test(t3)&&t3.indexOf(\"CASH\")>=0&&pe.children.length<15)){ pe.__kvPc=0; continue; }\n" +
  "          var s3=window.getComputedStyle?getComputedStyle(pe):pe.style;\n" +
  "          if(s3.position!==\"fixed\"){ pe.__kvPc=0; continue; }\n" +
  "          if(pe.getBoundingClientRect().top>window.innerHeight*0.5){ pe.__kvPc=1; pe.style.transform=\"translateY(-210px)\"; }\n" +
  "          else pe.__kvPc=0;\n" +
  "        }\n" +
  "        // WHAT HAD HAPPENED WAS strip -> its own drop-up\n" +
  "        if(!dwhw.firstChild){\n" +
  "          var ws=document.querySelectorAll(\"div\");\n" +
  "          for(var w2=0;w2<ws.length;w2++){ var wd=ws[w2];\n" +
  "            if(wd.style && wd.style.position===\"fixed\" && wd.firstChild && /WHAT HAD HAPPENED WAS/.test((wd.firstChild.textContent||\"\")) && !bar.contains(wd) && wd!==dwhw){\n" +
  "              wd.style.position=\"static\"; wd.style.left=\"\"; wd.style.right=\"\"; wd.style.bottom=\"\";\n" +
  "              wd.style.height=\"240px\"; wd.style.width=\"100%\"; wd.style.visibility=\"visible\";   // __KV_V369\n" +
  "              dwhw.appendChild(wd); break; } }\n" +
  "        }\n" +
  "        // KAS button + panel (v366)\n" +
  "        var kslot=document.getElementById(\"kvbar_kas\"), kb=document.getElementById(\"kvkbtn\"), kp=document.getElementById(\"kvkpan\");\n" +  "        // __KV_V405: the bar carries the kaspa address \u2014 always clickable (the bar\n" +
  "        // sits above the pad), saved to kv_kas_addr on every keystroke, which is\n" +
  "        // exactly what the KAS trade flow (myAddr) reads for listing and escrow.\n" +
  "        var ab=document.getElementById(\"kvbar_addr\");\n" +
  "        if(ab&&!ab.__w){ ab.__w=1;\n" +
  "          try{ ab.value=localStorage.getItem(\"kv_kas_addr\")||\"\"; }catch(e){}\n" +
  "          [\"keydown\",\"keyup\",\"keypress\",\"paste\"].forEach(function(t6){\n" +
  "            ab.addEventListener(t6,function(e6){ e6.stopPropagation(); }); });\n" +
  "          ab.addEventListener(\"input\",function(){ try{ localStorage.setItem(\"kv_kas_addr\", ab.value.trim()); }catch(e){} });\n" +
  "        }\n" +
  "        // __KV_V404: the right gamepad circle covers the KAS panel and eats the\n" +
  "        // click that would focus its inputs. While the panel is open, the pad is\n" +
  "        // pointer-inert; it comes back the moment the panel closes.\n" +
  "        var padEl=document.getElementById(\"pad\");\n" +
  "        if(padEl&&kp){ var kOpen=(kp.style.display===\"block\");\n" +
  "          if(kOpen&&padEl.style.pointerEvents!==\"none\") padEl.style.pointerEvents=\"none\";\n" +
  "          if(!kOpen&&padEl.style.pointerEvents===\"none\") padEl.style.pointerEvents=\"\";\n" +
  "        }\n" +
  "        if(kslot && kb && !kslot.firstChild){\n" +
  "          kb.style.position=\"static\"; kb.style.right=\"\"; kb.style.bottom=\"\"; kb.style.padding=\"7px 14px\"; kb.style.borderRadius=\"5px\";\n" +
  "          kslot.appendChild(kb);\n" +
  "        }\n" +
  "        if(kp) kp.style.bottom=\"52px\";\n" +
  "        // room status strip (top center) -> bar right\n" +
  "        var st=document.getElementById(\"kvbar_stat\");\n" +
  "        if(st && !st.__took){\n" +
  "          var es=document.querySelectorAll(\"div\");\n" +
  "          for(var k=0;k<es.length;k++){ var e2=es[k];\n" +
  "            if(e2.style && e2.style.position===\"fixed\" && /^ROOM /.test(e2.textContent||\"\") && !bar.contains(e2)){\n" +
  "              e2.style.position=\"static\"; e2.style.left=\"\"; e2.style.top=\"\"; e2.style.transform=\"\"; e2.style.background=\"none\"; e2.style.padding=\"0\";\n" +
  "              st.appendChild(e2); st.__took=1; break; } }\n" +
  "        }\n" +
  "        // __KV_V402b: the move log rides the clipboard \u2014 every move with seat,\n" +
  "        // action, dice and ack state, ready to paste for movement analysis.\n" +
  "        var cb=document.getElementById(\"kvbar_copyb\");\n" +
  "        if(cb&&!cb.__w){ cb.__w=1; cb.onclick=function(){\n" +
  "          var txt;\n" +
  "          try{ var mv=(window.KV_MOVES||[]).map(function(m){ return {i:m.i,s:m.s,a:m.a,v:m.v,t:m.t,d1:m.d1,d2:m.d2,acked:(m.__acked?1:0),snap:m.snap||null}; });\n" +
  "            txt=JSON.stringify({room:((window.KV_MP2||{}).room)||null,seat:((window.KV_MP2||{}).seat)||null,n:mv.length,moves:mv});\n" +
  "          }catch(e){ txt=\"copy failed: \"+e; }\n" +
  "          var ok=function(){ cb.textContent=\"\\u2713 COPIED\"; setTimeout(function(){ cb.textContent=\"\\ud83d\\udccb COPY LOG\"; },1200); };\n" +
  "          try{ navigator.clipboard.writeText(txt).then(ok,function(){\n" +
  "            var ta=document.createElement(\"textarea\"); ta.value=txt; document.body.appendChild(ta); ta.select();\n" +
  "            try{ document.execCommand(\"copy\"); }catch(e2){} ta.parentNode.removeChild(ta); ok(); });\n" +
  "          }catch(e3){ var ta2=document.createElement(\"textarea\"); ta2.value=txt; document.body.appendChild(ta2); ta2.select();\n" +
  "            try{ document.execCommand(\"copy\"); }catch(e4){} ta2.parentNode.removeChild(ta2); ok(); }\n" +
  "        }; }\n" +
  "        // __KV_V375: hosting needs a START \u2014 the bar shows it while the host waits.\n" +
  "        var sb=document.getElementById(\"kvbar_startb\");\n" +
  "        if(sb){ var mp=window.KV_MP2;\n" +
  "          var want=!!(mp&&mp.room&&mp.role===\"host\"&&!mp.started);\n" +
  "          sb.style.display=want?\"\":\"none\";\n" +
  "          if(!sb.__w){ sb.__w=1; sb.onclick=function(){ sb.disabled=true; sb.textContent=\"starting\\u2026\";\n" +
  "            try{ window.KV.start(); }catch(e){}\n" +
  "            setTimeout(function(){ sb.disabled=false; sb.textContent=\"\\u25b6 START GAME\"; },4000); }; }\n" +
  "        }\n" +
  "        // __KV_V374: the host screen transitions away \u2014 the bar keeps the room code forever.\n" +
  "        // Click the ROOM status to copy just the code for sending to visitors.\n" +
  "        if(st && st.__took && !st.__cp){ st.__cp=1;\n" +
  "          st.style.cursor=\"pointer\"; st.title=\"click to copy the room code\";\n" +
  "          st.onclick=function(){\n" +
  "            var m=/ROOM\\s+(\\S+)/.exec(st.textContent||\"\"); if(!m) return;\n" +
  "            var code=m[1], done=function(){ var o=st.style.color; st.style.color=\"#9cd87c\";\n" +
  "              st.textContent=st.textContent.replace(/copied!\\s*/,\"\");\n" +
  "              setTimeout(function(){ st.style.color=o; },900); };\n" +
  "            try{ navigator.clipboard.writeText(code).then(done,done); }\n" +
  "            catch(e){ try{ var ta=document.createElement(\"textarea\"); ta.value=code; document.body.appendChild(ta);\n" +
  "              ta.select(); document.execCommand(\"copy\"); ta.parentNode.removeChild(ta); done(); }catch(e2){} }\n" +
  "          };\n" +
  "        }\n" +
  "      }catch(e){}\n" +
  "    }\n" +
  "    setInterval(adopt, 1000);\n" +
  "  })();\n\n" +
  "  // ---- __KV_V237: full-log resync -- the flux chain is the record; rebuild from it ----",
  1
);

// ---- (45) __KV_V369: pre-hide the GAME LOG panel at creation (no boot flash) ----
replaceCounted(
  "prehide-gamelog",
  'var panel=el("div","position:fixed;right:6px;top:150px;z-index:57;width:236px;font:12px/1.5 monospace;color:#f4e4c1;");',
  'var panel=el("div","visibility:hidden;position:fixed;right:6px;top:150px;z-index:57;width:236px;font:12px/1.5 monospace;color:#f4e4c1;");   // __KV_V369',
  1
);

// ---- (46) __KV_V369: pre-hide the WHW strip at creation (no boot flash) ----
replaceCounted(
  "prehide-whw",
  'strip.style.cssText="position:fixed;left:270px;right:250px;bottom:6px;height:54px;',
  'strip.style.cssText="visibility:hidden;position:fixed;left:270px;right:250px;bottom:6px;height:54px;',
  1
);

// ---- banner ----
replaceCounted(
  "banner",
  "KasCity console ready [v345: 344 + pre-dice gate]",
  "KasCity console ready [v411: dead escrows warn loudly, I-paid explains itself]",
  1
);

/* ---- __KV_V372: XP travels with real kaspa ---------------------------------
   KV_DERIVE_XP reads the whole scoreboard from the chain, so KAS purchases
   earn XP the same way: kassettle:<tile>:<buyer> pays the buyer the biggest
   award in the game (real kaspa left a real wallet) and the seller a cut for
   closing the deal. Nothing is transmitted; every board derives the same XP. */
replaceCounted("v372-kas-xp",
  '      // bank purchase under intrinsic value\n      if (a === "buy"){',
  '      // KAS purchase: real kaspa was spent \u2014 the biggest XP award in the game\n' +
  '      if (a.indexOf("kassettle:") === 0){\n' +
  '        var dup9=false; for(var q9=1;q9<i;q9++){ var p9=mv[q9]; if(p9&&String(p9.a||"")===a){ dup9=true; break; } }\n' +
  '        if(dup9) continue;                            // __KV_V409: duplicate settles pay nothing\n' +
  '        var kb = +String(a).split(":")[2] || 0;\n' +
  '        if (kb >= 1 && kb <= 4) xp[kb] += award(30);   // the buyer paid in kaspa\n' +
  '        xp[s] += award(15);                            // the seller closed a KAS deal\n' +
  '        continue;\n' +
  '      }\n\n' +
  '      // bank purchase under intrinsic value\n      if (a === "buy"){',
  1);



/* ---- __KV_V402a: the scoreboard is derived from the FROZEN log --------------
   endGame built rows (with live XP) BEFORE the resync/drain froze KV_MOVES, so
   two boards could publish different XP for identical chains (the 95-vs-105).
   Recompute every seat's XP from the frozen log itself, placement included. */
replaceCounted("v402-frozen-xp",
  'window.KV_MOVES = window.KV_MOVES.slice();   // freeze the array we are about to publish',
  'window.KV_MOVES = window.KV_MOVES.slice();   // freeze the array we are about to publish\n' +
  '    try{ if(window.KV_DERIVE_XP_FINAL){ var __fx=window.KV_DERIVE_XP_FINAL(rows);\n' +
  '      rows.forEach(function(r){ r.xp=__fx[r.seat]||0; }); } }catch(__eX){}   // __KV_V402\n',
  1);


/* ---- __KV_V404b: engine keys stand down while typing ------------------------
   All three global keydown handlers (game keys, G/T diagnostics, D debug) now
   ignore events whose target is an input/textarea, so typing an address can
   never trigger game shortcuts. */
replaceCounted("v404-keys-1",
  'window.addEventListener("keydown", function (e) {\n    if (CON.enabled && e.key === CON_KEY)',
  'window.addEventListener("keydown", function (e) {\n    if (e.target&&(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||e.target.isContentEditable)) return;   // __KV_V404\n    if (CON.enabled && e.key === CON_KEY)',
  1);
replaceCounted("v404-keys-2",
  'document.addEventListener("keydown",function(e){\n      if(e.key==="g"||e.key==="G")',
  'document.addEventListener("keydown",function(e){\n      if(e.target&&(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||e.target.isContentEditable)) return;   // __KV_V404\n      if(e.key==="g"||e.key==="G")',
  1);
replaceCounted("v404-keys-3",
  'document.addEventListener("keydown",function(e){\n      if(e.key!=="d"&&e.key!=="D")return;',
  'document.addEventListener("keydown",function(e){\n      if(e.target&&(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||e.target.isContentEditable)) return;   // __KV_V404\n      if(e.key!=="d"&&e.key!=="D")return;',
  1);


/* ---- __KV_V408: fx survives the whole KV_MOVE wrapper stack -----------------
   KV_MOVE is wrapped five deep. Two old inner wrappers (KV_MP fan-out and
   KV_P2P) forward only (seat,action,value) — the 4th arg died there, so every
   kaslist/kaspay hit the recorder with fx=null: no seller address on listings,
   no txid on payments, no settle ever. Both links now carry fx through. */
replaceCounted("v408-fx-mp",
  'window.KV_MOVE=function(seat,action,value){\n      var r=prevMove?prevMove(seat,action,value):null;\n      var M=window.KV_MP;',
  'window.KV_MOVE=function(seat,action,value,fx){                                // __KV_V408\n      var r=prevMove?prevMove(seat,action,value,fx):null;\n      var M=window.KV_MP;',
  1);
replaceCounted("v408-fx-p2p",
  'window.KV_MOVE=function(seat,action,value){\n      var r=prevMove?prevMove(seat,action,value):null;\n      var P=window.KV_P2P;',
  'window.KV_MOVE=function(seat,action,value,fx){                                // __KV_V408\n      var r=prevMove?prevMove(seat,action,value,fx):null;\n      var P=window.KV_P2P;',
  1);

fs.writeFileSync(OUT, html);

console.log(`\nwrote ${OUT} (${patches} patches, ${html.length} bytes)`);
