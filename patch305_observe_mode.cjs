// patch305_observe_mode.cjs — step back to a working board.
// The old relay path runs the game again (board, clock, engine, lobby, roster) exactly as it did.
// KV_RELAY2 stays loaded but in OBSERVE mode: it reads the chain, derives turn state, and reports
// via KV2.state()/KV2.chain() — it posts nothing and drives nothing.
// From here we migrate one responsibility at a time instead of switching everything at once.
// SRC showcase_kascity304.html -> DST showcase_kascity305.html
const fs = require("fs");
const SRC = "showcase_kascity304.html";
const DST = "showcase_kascity305.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function need(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

// 1) give the old path back its game
const A = '    // __KV_V300: KV_RELAY2 owns relay games; the legacy path stays dormant\n' +
'    if(window.KV_RELAY2){ M.roster=roster; M.started=false; return; }\n' +
'    M.roster=roster; M.started=true;';
need(A, 1, "A 300 dormancy switch");

if (fails.length) { console.error("ABORT — anchors:\n" + fails.join("\n")); process.exit(1); }

s = s.replace(A,
'    // __KV_V305: the legacy path runs the game again; KV_RELAY2 observes only\n' +
'    M.roster=roster; M.started=true;');

// 2) KV_RELAY2 becomes an observer: no posting, no acting, no engine writes
const APPEND = `
<script>
// ---- __KV_V305: KV_RELAY2 observe mode ----
(function(){
  var iv=setInterval(function(){
    var R=window.KV_RELAY2; if(!R) return;
    clearInterval(iv);
    R.OBSERVE = true;

    // never write to the chain
    R.post = async function(){ return null; };
    R.drainPost = async function(){ R.pending = []; R.posting = false; };
    // never drive the engine
    R.act = async function(){ };
    R.postFirsts = async function(){ };
    R.maybeOpen = function(){ };
    R.finish = function(){ };
    R.ui = function(){ };
    R.hideUi = function(){ };
    // applying remote state is the legacy path's job while we are in observe mode
    R.ingest = (function(orig){
      return function(e){
        try{
          if(!e) return;
          if(e.kind==="gun" && !R.gun){
            var gb=e.body||{};
            R.gun={ startDaa:Number(gb.startDaa), seed:gb.seed||null, players:gb.players||0 };
          }
        }catch(err){}
      };
    })(R.ingest);

    // follow whatever room the legacy path is in, so KV2.state() is useful
    setInterval(function(){
      try{
        var M=window.KV_MP2;
        if(M && M.room && R.room!==M.room){
          R.room=M.room; R.cursor=0; R.head=0; R.log=[];
          R.node=(M.ordList && M.ordList[M.ordIdx]) || M.nodes && M.nodes[0] || R.node;
          R.role=M.role; R.seat=M.seat; R.roster=(M.roster||[]).slice();
          R.started=!!M.started;
          if(!R.__looping) R.loop();
        } else if(M){
          R.seat=M.seat; R.role=M.role; R.roster=(M.roster||[]).slice(); R.started=!!M.started;
        }
      }catch(err){}
    }, 1500);

    if(window.KV_LOG) window.KV_LOG("KV_RELAY2 in observe mode \\u2014 KV2.state() reports, nothing drives","#7a6a58");
  }, 300);
})();
</script>
`;

s = s + APPEND;
fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
console.log("Use the normal KV.host()/KV.join() lobby again. KV2.state()/KV2.chain() report only.");
