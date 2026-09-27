// kascity_visual_v107.cjs
// Reads showcase_kascity106.html -> showcase_kascity107.html
// 1) ROLL FOR FIRST: before the game starts, each seat rolls 2d6 (you tap, bots auto); highest goes
//    first. Ties re-roll among the tied. Result is recorded in the move log as "first" so the proof covers it.
// 2) Turn counter in the WHAT HAD HAPPENED WAS header: rolls per seat, live — a lagging number = a missed turn.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity106.html')) die('showcase_kascity106.html missing');
let html = fs.readFileSync('showcase_kascity106.html', 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function once(s, name) { const n = html.split(s).length - 1; if (n !== 1) die(name + ': expected 1, got ' + n); }

const anchor = '// ---- stall detector (escalating) ----';
once(anchor, 'stall detector anchor');
const block = [
'// ---- roll for first (v107) ----',
'(function(){',
'  var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
'  var humans=window.KV_HUMANS||[1];',
'  var ov=document.createElement("div");',
'  ov.style.cssText="position:fixed;inset:0;z-index:90;background:rgba(10,8,6,.82);display:flex;align-items:center;justify-content:center;";',
'  var box=document.createElement("div");',
'  box.style.cssText="background:#14100c;border:2px solid #caa64c;border-radius:12px;padding:20px 28px;min-width:380px;font:13px/1.8 monospace;color:#f4e4c1;text-align:center;";',
'  ov.appendChild(box); document.body.appendChild(ov);',
'  ["pointerdown","keydown","click"].forEach(function(t){ ov.addEventListener(t,function(e){ e.stopPropagation(); }, true); });',
'  var rolls={}, pool=[1,2,3,4], round=0;',
'  function d6(){ return 1+Math.floor(Math.random()*6); }',
'  function render(msg){',
'    var h="<div style=\'font:900 26px Impact,sans-serif;color:#f0c860;letter-spacing:2px;margin-bottom:8px\'>ROLL FOR FIRST</div>";',
'    [1,2,3,4].forEach(function(s){',
'      var r=rolls[s];',
'      h+="<div><span style=\'color:"+COL[s]+";font-weight:700\'>P"+s+(humans.indexOf(s)>=0?" (you)":"")+"</span> &nbsp; "+(r?("<b>"+r[0]+" + "+r[1]+" = "+(r[0]+r[1])+"</b>"):"<span style=\'opacity:.4\'>—</span>")+(pool.indexOf(s)<0?" <span style=\'opacity:.4\'>out</span>":"")+"</div>";',
'    });',
'    h+="<div style=\'margin-top:10px;color:#caa64c\'>"+msg+"</div>";',
'    box.innerHTML=h;',
'  }',
'  function next(){',
'    var pending=pool.filter(function(s){ return !rolls[s]; });',
'    if(pending.length){',
'      var s=pending[0];',
'      if(humans.indexOf(s)>=0){',
'        render("your roll — tap to throw");',
'        var b=document.createElement("button");',
'        b.style.cssText="margin-top:10px;padding:9px 26px;background:#2f4a2f;color:#cfe6c4;border:1px solid #4fd98a;border-radius:6px;font:900 14px monospace;cursor:pointer;";',
'        b.textContent="ROLL"; box.appendChild(b);',
'        b.onclick=function(e){ e.stopPropagation(); rolls[s]=[d6(),d6()]; if(window.KV_MOVE) window.KV_MOVE(s,"first",rolls[s][0]+rolls[s][1]); next(); };',
'      } else {',
'        render("P"+s+" rolling…");',
'        setTimeout(function(){ rolls[s]=[d6(),d6()]; if(window.KV_MOVE) window.KV_MOVE(s,"first",rolls[s][0]+rolls[s][1]); next(); }, 550);',
'      }',
'      return;',
'    }',
'    var best=-1; pool.forEach(function(s){ best=Math.max(best, rolls[s][0]+rolls[s][1]); });',
'    var top=pool.filter(function(s){ return rolls[s][0]+rolls[s][1]===best; });',
'    if(top.length>1 && round<6){',
'      round++; pool=top; top.forEach(function(s){ delete rolls[s]; });',
'      render("tie at "+best+" — "+top.map(function(s){return "P"+s;}).join(", ")+" roll again");',
'      setTimeout(next, 900); return;',
'    }',
'    var w=top[0];',
'    render("<b style=\'color:"+COL[w]+"\'>P"+w+(humans.indexOf(w)>=0?" (you)":"")+"</b> goes first");',
'    if(window.KV_SETSTATE) window.KV_SETSTATE("turn", w-1);',
'    if(window.KV_LOG) window.KV_LOG("P"+w+" rolled "+best+" — goes first", COL[w]);',
'    setTimeout(function(){ ov.remove(); }, 1400);',
'  }',
'  render("who goes first?");',
'  setTimeout(next, 800);',
'})();',
'',
'// ---- per-seat turn counter in the feed header (v107) ----',
'setInterval(function(){',
'  var heads=document.querySelectorAll("div"); var head=null;',
'  for(var i=0;i<heads.length;i++){ if(heads[i].textContent.indexOf("WHAT HAD HAPPENED WAS")===0 && heads[i].children.length<2){ head=heads[i]; break; } }',
'  if(!head) return;',
'  var c={1:0,2:0,3:0,4:0}; (window.KV_MOVES||[]).forEach(function(m){ if(m.a==="roll") c[m.s]++; });',
'  var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
'  head.innerHTML="WHAT HAD HAPPENED WAS <span style=\'float:right;letter-spacing:0;font-weight:600\'>turns "+[1,2,3,4].map(function(s){ return "<span style=\'color:"+COL[s]+"\'>P"+s+" "+c[s]+"</span>"; }).join(" · ")+"</span>";',
'}, 1000);',
''
].join(EOL);
html = html.replace(anchor, block + EOL + anchor);
console.log('PASS roll-for-first overlay before the first tap; winner seated first; recorded as "first" moves');
console.log('PASS live per-seat roll counter in the feed header');

fs.writeFileSync('showcase_kascity107.html', html);
console.log('OK showcase_kascity107.html (' + (fs.statSync('showcase_kascity107.html').size/1024/1024).toFixed(1) + ' MB)');
