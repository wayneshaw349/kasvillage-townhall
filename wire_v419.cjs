// wire_v419.cjs — v418 -> v419: draggable ROLL button + bots a tad harder (everything else kept)
//   KV_ROLL_DRAG: drag the 🎲 ROLL button anywhere; a tap still rolls; position remembered on this device.
//   KV_TAD_HARDER: leader guard kicks in at 6% ahead (was 15%), cash-short bots sell at 84% (was 76%),
//                  district-plan and final-count holds 1.20x (was 1.15x), "breaks up your district" 1.15x (was 1.10x).
const fs = require('fs');
const SRC = 'showcase_kascity_v418_smartbots.html', OUT = 'showcase_kascity_v419_rolldrag.html';
let s = fs.readFileSync(SRC, 'utf8');
const rep = (a, b, what) => { const c = s.split(a).length - 1; if (c !== 1) throw new Error(what + ': anchor x' + c); s = s.replace(a, b); };
rep('me<=(+f["nw"+x]||0)*1.15', 'me<=(+f["nw"+x]||0)*1.06', 'leader margin');
rep('intr*(need?0.76:0.98)*sellMul*dm.sell', 'intr*(need?0.84:0.98)*sellMul*dm.sell', 'need discount');
rep('ask*=1.15; why.push("part of', 'ask*=1.20; why.push("part of', 'district plan');
rep('ask*=1.15; why.push("holding', 'ask*=1.20; why.push("holding', 'final hold');
rep('val*=1.10; why.push("it breaks up your district")', 'val*=1.15; why.push("it breaks up your district")', 'break-up');
const DRAG = `<script>
// ---- KV_ROLL_DRAG: drag the ROLL button out of the way; a tap still rolls ----
(function(){
  var KEY="kv_roll_pos", moved=false, sx=0, sy=0, bx=0, by=0, down=false;
  function el(){ return document.getElementById("kvbigroll"); }
  function put(b,x,y){ var w=b.offsetWidth||120, h=b.offsetHeight||58; x=Math.max(4,Math.min(innerWidth-w-4,x)); y=Math.max(4,Math.min(innerHeight-h-4,y));
    b.style.setProperty("left",x+"px","important"); b.style.setProperty("top",y+"px","important"); b.style.setProperty("right","auto","important"); b.style.setProperty("bottom","auto","important"); return [x,y]; }
  function restore(){ var b=el(); if(!b) return false; b.style.touchAction="none";
    try{ var p=JSON.parse(localStorage.getItem(KEY)||"null"); if(p&&isFinite(p[0])&&isFinite(p[1])) put(b,p[0],p[1]); }catch(e){}
    if(!document.getElementById("kvroll_grip")){ var g=document.createElement("span"); g.id="kvroll_grip"; g.textContent=" \\u2807"; g.style.opacity=".6"; g.title="drag to move"; b.appendChild(g); }
    return true; }
  var t=setInterval(function(){ if(restore()) clearInterval(t); },300);
  function start(x,y,e){ var b=el(); if(!b||!e.target.closest||!e.target.closest("#kvbigroll")) return; var r=b.getBoundingClientRect(); down=true; moved=false; sx=x; sy=y; bx=r.left; by=r.top; }
  function move(x,y,e){ if(!down) return; if(!moved && Math.abs(x-sx)+Math.abs(y-sy)<10) return; moved=true; try{ e.preventDefault(); }catch(_){} var p=put(el(),bx+x-sx,by+y-sy); try{ localStorage.setItem(KEY,JSON.stringify(p)); }catch(_){} }
  function end(e){ if(!down) return; down=false; if(moved){ try{ e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); }catch(_){} setTimeout(function(){ moved=false; },350); } }
  function swallow(e){ if(moved && e.target.closest && e.target.closest("#kvbigroll")){ try{ e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); }catch(_){} } }
  window.addEventListener("touchstart",function(e){ var p=e.touches[0]; start(p.clientX,p.clientY,e); },{capture:true,passive:true});
  window.addEventListener("touchmove",function(e){ var p=e.touches[0]; move(p.clientX,p.clientY,e); },{capture:true,passive:false});
  window.addEventListener("touchend",end,{capture:true,passive:false});
  window.addEventListener("mousedown",function(e){ start(e.clientX,e.clientY,e); },true);
  window.addEventListener("mousemove",function(e){ move(e.clientX,e.clientY,e); },true);
  window.addEventListener("mouseup",end,true);
  window.addEventListener("pointerup",swallow,true); window.addEventListener("click",swallow,true);
  window.addEventListener("resize",function(){ var b=el(); if(!b) return; try{ var p=JSON.parse(localStorage.getItem(KEY)||"null"); if(p) put(b,p[0],p[1]); }catch(e){} });
  // double-tap the grip to put it back where it started
  document.addEventListener("dblclick",function(e){ if(e.target&&e.target.id==="kvroll_grip"){ try{ localStorage.removeItem(KEY); }catch(_){} var b=el(); ["left","top","right","bottom"].forEach(function(k){ b.style.removeProperty(k); }); } },true);
})();
</script>
`;
let at = s.lastIndexOf('</body>'); if (at < 0) at = s.length;
s = s.slice(0, at) + DRAG + s.slice(at);
fs.writeFileSync(OUT, s); console.log('wrote', OUT, Math.round(s.length / 1024) + ' KB');
