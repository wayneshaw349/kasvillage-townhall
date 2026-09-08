// patch278_seeded_rng.cjs — v57 client half: deterministic RNG for scenarios + offers.
// Installs window.KV_RND(tag,i) — sfc32 seeded from (seed_commit | tag | i), same inputs as the
// relay's /derive oracle. Caches seed_commit from the v55b /log response. Swaps the divergence
// sites (scenario success, card picks, landing-fire, offer jitter/targeting) off Math.random.
// Cosmetic randomness (particles, camera, UI dice faces) is left on Math.random.
// Appended helper at EOF + targeted replacements. SRC 277 -> DST 278.
const fs = require("fs");
const SRC = "showcase_kascity277.html";
const DST = "showcase_kascity278.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function must(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

const S1 = 'if(lg){ M.chainHead = lg.chain || M.chainHead; M.head = (lg.head!=null ? lg.head : M.head); }';
const R1 = 'var good=Math.random()<o.p;';
const R2a = 'var sc=pool[Math.floor(Math.random()*pool.length)];';   // appears twice (12029, 12074)
const R3 = 'if(Math.random()>0.55) { firedLanding[memo]=1; return; }';
const R4 = 'var amt=Math.round(intr*mul*dmB.buy*(0.95+Math.random()*0.12)/5)*5;';

must(S1, 1, "S1 log seed capture point");
must(R1, 1, "R1 scenario success");
if (s.split(R2a).length - 1 < 2) fails.push("R2 card picks: expected 2+ found " + (s.split(R2a).length - 1));
must(R3, 1, "R3 landing fire");
must(R4, 1, "R4 offer jitter");

if (fails.length) {
  console.error("ABORT — anchors:\n" + fails.join("\n"));
  process.exit(1);
}

// capture seed_commit from /log
s = s.replace(S1, S1 + '\n' +
'        if(lg && lg.seed_commit && !window.__KV_SEED){ window.__KV_SEED=lg.seed_commit; }   // __KV_V278');

// scenario success: seeded on the current chain head
s = s.replace(R1, 'var good=window.KV_RND("scn_ok", (window.KV_MP2&&window.KV_MP2.head)||0) < o.p;   // __KV_V278');

// card picks: both sites, seeded on head (distinct tags so the two picks differ)
let picks = 0;
s = s.split(R2a).map(function(seg, idx, arr){
  return seg;
}).join(R2a); // no-op placeholder to keep structure; do explicit two-step below
// replace first occurrence
s = s.replace(R2a, 'var sc=pool[Math.floor(window.KV_RND("scn_pick_a",(window.KV_MP2&&window.KV_MP2.head)||0)*pool.length)];   // __KV_V278');
// replace (now) first remaining occurrence
s = s.replace(R2a, 'var sc=pool[Math.floor(window.KV_RND("scn_pick_b",(window.KV_MP2&&window.KV_MP2.head)||0)*pool.length)];   // __KV_V278');

// landing fire chance
s = s.replace(R3, 'if(window.KV_RND("scn_fire",(window.KV_MP2&&window.KV_MP2.head)||0)>0.55) { firedLanding[memo]=1; return; }   // __KV_V278');

// offer jitter
s = s.replace(R4, 'var amt=Math.round(intr*mul*dmB.buy*(0.95+window.KV_RND("offer_amt",(window.KV_MP2&&window.KV_MP2.head)||0)*0.12)/5)*5;   // __KV_V278');

// EOF helper: sfc32 seeded from sha-ish mix of seed_commit|tag|i (sync, no fetch)
const HELPER = `
<script>
// ---- __KV_V278: deterministic RNG (v57 client half) ----
(function(){
  function mix(str){
    // xmur3
    var h=1779033703 ^ str.length;
    for(var i=0;i<str.length;i++){ h=Math.imul(h ^ str.charCodeAt(i),3432918353); h=h<<13 | h>>>19; }
    return function(){ h=Math.imul(h ^ (h>>>16),2246822507); h=Math.imul(h ^ (h>>>13),3266489909); h ^= h>>>16; return h>>>0; };
  }
  function sfc32(a,b,c,d){
    return function(){
      a>>>=0; b>>>=0; c>>>=0; d>>>=0;
      var t=(a+b)|0;
      a=b ^ b>>>9; b=c+(c<<3)|0; c=(c<<21 | c>>>11);
      d=d+1|0; t=t+d|0; c=c+t|0;
      return (t>>>0)/4294967296;
    };
  }
  // one draw in [0,1) for (tag,i), independent of call order
  window.KV_RND=function(tag,i){
    var seed=window.__KV_SEED||"nogame";
    var segs=mix(seed+"|"+tag+"|"+i);
    var r=sfc32(segs(),segs(),segs(),segs());
    r(); r();   // warm
    return r();
  };
})();
</script>
`;

s = s + HELPER;
fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
