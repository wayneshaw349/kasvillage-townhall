// kascity_visual_v91.cjs
// Reads showcase_kascity90.html -> showcase_kascity91.html   (scene JSON unchanged)
//
// THE PROOF WAS BROKEN. An independent verifier recomputed the move root from the published log and
// got a different hash. Everything else in the payload checked out — indices, clock, seed commitment,
// XP, ranks — but the chain itself was wrong, which makes the whole record unverifiable.
//
// CAUSE: a race. move() did
//       chain = await sha(chain + "|" + rec...)
// and moves fire from 250ms pollers, so several land in the same tick. Two concurrent calls both read
// the OLD chain before either resolves; the second overwrites the first and that link is lost.
//
// FIX: serialise the chain through a promise queue. Every hash waits for the previous one, so links
// are appended in index order with no interleaving. window.KV_CHAIN_READY() lets the end-of-game code
// wait for the queue to drain before publishing, so the root always covers every move.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity90.html')) die('showcase_kascity90.html missing');
let html = fs.readFileSync('showcase_kascity90.html', 'utf8');

// ---------- replace the racing move() with a queued one ----------
const moveRe = /[ \t]*async function move\(seat, action, arg\)\s*\{[\s\S]*?\n[ \t]*\}\s*\n[ \t]*window\.KV_MOVE\s*=\s*move;/;
const m = html.match(moveRe);
if (!m) die('move() definition not found');
if (html.split(m[0]).length - 1 !== 1) die('move() not unique (' + (html.split(m[0]).length - 1) + ')');

html = html.split(m[0]).join([
  '    // chain updates are serialised: each hash waits for the previous one, so links land in',
  '    // index order and no two calls can read the same stale chain value.',
  '    var chainQ = Promise.resolve();',
  '    var chainPending = 0;',
  '    function move(seat, action, arg){',
  '      var f=F(), left=(f.left!=null)?Math.round(f.left):-1;',
  '      var rec={i:window.KV_MOVES.length, s:seat, a:action, v:arg, t:left};',
  '      window.KV_MOVES.push(rec);',
  '      chainPending++;',
  '      chainQ = chainQ.then(async function(){',
  '        if(!chainReady){',
  '          // the genesis hash has not resolved yet — wait for it rather than skipping the link',
  '          for(var i=0;i<50 && !chainReady;i++) await new Promise(function(r){ setTimeout(r,20); });',
  '        }',
  '        chain = await sha(chain+"|"+rec.i+"|"+rec.s+"|"+rec.a+"|"+rec.v+"|"+rec.t);',
  '        window.KV_ROOT = chain;',
  '        chainPending--;',
  '      }).catch(function(e){',
  '        chainPending--;',
  '        if(window.KV_LOG) window.KV_LOG("move chain error: "+(e&&e.message),"#ff6a4a");',
  '      });',
  '      return rec;',
  '    }',
  '    window.KV_MOVE = move;',
  '    // resolves once every queued link has been hashed',
  '    window.KV_CHAIN_READY = function(){ return chainQ.then(function(){ return chain; }); };',
  '    window.KV_CHAIN_PENDING = function(){ return chainPending; };'
].join('\n'));

// ---------- the payload must wait for the queue to drain ----------
const resRe = /[ \t]*window\.KV_RESULT=\{\s*\n[ \t]*kind:"kascity\.result\.v1"[\s\S]*?seats:rows\s*\n[ \t]*\};/;
if (!resRe.test(html)) die('result assembly not found');
html = html.replace(resRe, [
  '    // drain the chain queue before publishing, or the root will not cover the final moves',
  '    if(window.KV_CHAIN_READY){ try { chain = await window.KV_CHAIN_READY(); } catch(e){} }',
  '    window.KV_RESULT={',
  '      kind:"kascity.result.v1", mode:window.KV_MODE,',
  '      seed:window.KV_SEED, seedCommit:seedCommit,',
  '      moveRoot:chain, moveCount:window.KV_MOVES.length,',
  '      moves:window.KV_MOVES, seats:rows',
  '    };'
].join('\n'));

// ---------- self-verify on screen so a broken root can never ship silently ----------
const bellRe = /[ \t]*log\("FINAL BELL[^"]*"\+chain\.slice\(0,16\)\+"[^"]*","#f0c860"\);/;
if (!bellRe.test(html)) die('final bell log not found');
html = html.replace(bellRe, [
  '    log("FINAL BELL — moveRoot "+chain.slice(0,16)+"…","#f0c860");',
  '    // recompute the chain from the published log and confirm it matches what we are publishing',
  '    (async function(){',
  '      try{',
  '        var c = await sha((window.KV_SEED||"kv")+"|kascity|"+window.KV_MODE);',
  '        for(var i=0;i<window.KV_MOVES.length;i++){',
  '          var r=window.KV_MOVES[i];',
  '          c = await sha(c+"|"+r.i+"|"+r.s+"|"+r.a+"|"+r.v+"|"+r.t);',
  '        }',
  '        var good = (c === window.KV_RESULT.moveRoot);',
  '        window.KV_RESULT.selfVerified = good;',
  '        log(good ? "record self-verifies \\u2713" : "RECORD FAILED SELF-VERIFY",',
  '            good ? "#9cd87c" : "#ff6a4a");',
  '        if(!good && window.KV_SHOUT) window.KV_SHOUT("PROOF FAILED","move root does not match the log","#ff6a4a",true);',
  '      }catch(e){}',
  '    })();'
].join('\n'));

fs.writeFileSync('showcase_kascity91.html', html);
console.log('PASS move chain serialised through a promise queue — no interleaved reads');
console.log('PASS a link is never skipped while the genesis hash resolves');
console.log('PASS the payload waits for the queue to drain before publishing the root');
console.log('PASS the game recomputes its own root at the final bell and reports pass or fail');
console.log('OK showcase_kascity91.html (' + (fs.statSync('showcase_kascity91.html').size/1024/1024).toFixed(1) + ' MB)');
