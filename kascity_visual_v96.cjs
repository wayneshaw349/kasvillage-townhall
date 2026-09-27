// kascity_visual_v96.cjs
// Reads showcase_kascity95.html -> showcase_kascity96.html   (scene JSON unchanged)
//
// THE LEFT COLUMN WAS FOUR PANELS AT FIXED OFFSETS. RENT ROLL, MARKET, HOLDINGS and ON THE MARKET
// each sat at a hardcoded top value, but HOLDINGS grows with your portfolio — so as soon as anyone
// owned much, it ran straight through the listings panel below it. Nothing could be read.
//
// They become ONE panel with tabs. Only one section is open at a time, so each gets the full height
// instead of a slice, and nothing can overlap regardless of how much anyone owns.
//
//   HOLDINGS   who owns what, grouped by player, with counts and value
//   MARKET     everything currently listed, sorted best-deal-first, click to open
//   YOU        your rent roll per lap, market index, and a per-block breakdown
//
// The tab bar carries live counts, so you can see there are three listings without opening the tab.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity95.html')) die('showcase_kascity95.html missing');
let html = fs.readFileSync('showcase_kascity95.html', 'utf8');

// ---------- hide the old panels rather than unpicking each one ----------
const kills = [
  // rent roll strip
  /position:fixed;left:8px;top:92px;z-index:57;width:214px;/,
  // market index strip
  /position:fixed;left:8px;top:150px;z-index:57;width:214px;/,
  // holdings panel
  /position:fixed;left:8px;top:178px;z-index:57;width:214px;/,
  // listings panel
  /position:fixed;left:8px;top:206px;z-index:58;width:214px;/,
  // activity strip
  /position:fixed;left:8px;top:120px;z-index:57;width:214px;/
];
let hidden = 0;
for (const re of kills) {
  if (re.test(html)) { html = html.replace(re, 'position:fixed;left:-9999px;top:0;z-index:1;width:214px;'); hidden++; }
}
if (hidden < 3) die('only ' + hidden + ' old left panels found (expected 3+)');

// ---------- one tabbed panel ----------
const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');
html = html.split(anchor).join([
  '  window.KV_END=endGame;',
  '',
  '  // ================= LEFT PANEL (tabbed) =================',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    function F(){ return (window.KV_FLAGS&&window.KV_FLAGS())||{}; }',
  '    function el(t,css,par){var e=document.createElement(t);e.style.cssText=css;(par||document.body).appendChild(e);return e;}',
  '    function me(){ return (window.KV_HUMANS||[1])[0]||1; }',
  '',
  '    var wrap=el("div","position:fixed;left:8px;top:128px;z-index:58;width:226px;'
    + 'font:10px/1.5 monospace;color:#f4e4c1;");',
  '',
  '    var tabs=el("div","display:flex;gap:2px;",wrap);',
  '    var body=el("div","background:rgba(20,16,12,.93);border:1px solid #5a4a3a;border-top:0;'
    + 'border-radius:0 0 5px 5px;padding:6px 8px;height:300px;overflow:auto;box-sizing:border-box;",wrap);',
  '',
  '    var TABS=["HOLDINGS","MARKET","YOU"];',
  '    var active="HOLDINGS";',
  '    var btns={};',
  '    TABS.forEach(function(name){',
  '      var b=el("div","flex:1;text-align:center;padding:4px 2px;cursor:pointer;letter-spacing:1px;'
    + 'font-weight:700;border:1px solid #5a4a3a;border-radius:5px 5px 0 0;font-size:9px;",tabs);',
  '      b.textContent=name;',
  '      b.onclick=function(){ active=name; paintTabs(); render(); };',
  '      btns[name]=b;',
  '    });',
  '    function paintTabs(){',
  '      TABS.forEach(function(n){',
  '        var on=(n===active);',
  '        btns[n].style.background = on ? "rgba(20,16,12,.93)" : "rgba(20,16,12,.62)";',
  '        btns[n].style.color = on ? "#f0c860" : "#8a7a5a";',
  '        btns[n].style.borderBottom = on ? "1px solid rgba(20,16,12,.93)" : "1px solid #5a4a3a";',
  '      });',
  '    }',
  '    paintTabs();',
  '',
  '    function listedTiles(){',
  '      var f=F(), N=window.KV_NAMES||{}, out=[];',
  '      Object.keys(N).forEach(function(k){',
  '        var t=parseInt(k,10);',
  '        if(Math.round(f["ls_t"+t]||0)!==1) return;',
  '        var ask=Math.round(f["lp_t"+t]||0);',
  '        var val=window.KV_INTRINSIC?window.KV_INTRINSIC(t):ask;',
  '        out.push({t:t,n:N[k].n,ask:ask,val:val,own:window.KV_OWNER?window.KV_OWNER(t):null});',
  '      });',
  '      out.sort(function(a,b){ return (a.ask-a.val)-(b.ask-b.val); });',
  '      return out;',
  '    }',
  '',
  '    function renderHoldings(){',
  '      var N=window.KV_NAMES||{}, by={1:[],2:[],3:[],4:[]}, free=0;',
  '      Object.keys(N).forEach(function(k){',
  '        var t=parseInt(k,10), o=window.KV_OWNER?window.KV_OWNER(t):null;',
  '        if(o&&by[o]) by[o].push({n:N[k].n, v:(window.KV_MARKET?window.KV_MARKET(t):(N[k].p||0))});',
  '        else free++;',
  '      });',
  '      var h="";',
  '      for(var p=1;p<=4;p++){',
  '        var list=by[p], val=0;',
  '        list.forEach(function(x){ val+=x.v; });',
  '        var mine=(window.KV_HUMANS||[1]).indexOf(p)>=0;',
  '        h+="<div style=\'margin-bottom:5px\'>"+',
  '           "<span style=\'color:"+COL[p]+"\'>\\u25a0</span> <b>P"+p+(mine?" (you)":"")+"</b>"+',
  '           "<span style=\'float:right;opacity:.6\'>"+list.length+" \\u00b7 "+val+"</span>";',
  '        h+= list.length',
  '          ? ("<div style=\'padding-left:11px;opacity:.85\'>"+list.map(function(x){return x.n;}).join("<br>")+"</div>")',
  '          : "<div style=\'padding-left:11px;opacity:.35\'>none</div>";',
  '        h+="</div>";',
  '      }',
  '      h+="<div style=\'opacity:.5;border-top:1px solid #3a3228;padding-top:3px\'>unowned "+free+"</div>";',
  '      body.innerHTML=h;',
  '    }',
  '',
  '    function renderMarket(){',
  '      var rows=listedTiles();',
  '      if(!rows.length){ body.innerHTML="<div style=\'opacity:.45;padding-top:6px\'>nothing is listed right now</div>"; return; }',
  '      body.innerHTML="";',
  '      rows.forEach(function(r){',
  '        var deal=r.val-r.ask;',
  '        var col=deal>0?"#9cd87c":(deal<-15?"#ff6a4a":"#f4e4c1");',
  '        var row=el("div","padding:4px 0;cursor:pointer;border-bottom:1px solid #2a2118;",body);',
  '        row.innerHTML="<span style=\'color:"+(COL[r.own]||"#8a7a5a")+"\'>\\u25a0</span> "+r.n+',
  '          "<span style=\'float:right;color:"+col+";font-weight:700\'>"+r.ask+"</span>"+',
  '          "<div style=\'opacity:.55;font-size:9px;padding-left:11px\'>worth "+r.val+" \\u00b7 "+',
  '          (deal>0?("<span style=\'color:#9cd87c\'>under by "+deal+"</span>")',
  '                 :(deal<0?("over by "+(-deal)):"at value"))+"</div>";',
  '        row.onclick=function(e){ e.stopPropagation(); if(window.KV_OPEN_TILE) window.KV_OPEN_TILE(r.t,e); };',
  '      });',
  '    }',
  '',
  '    function renderYou(){',
  '      var p=me(), N=window.KV_NAMES||{}, f=F();',
  '      var rows=[], sum=0;',
  '      Object.keys(N).forEach(function(k){',
  '        var t=parseInt(k,10);',
  '        if(!window.KV_OWNER || window.KV_OWNER(t)!==p) return;',
  '        var r=window.KV_RENT?window.KV_RENT(t):0;',
  '        sum+=r;',
  '        rows.push({n:N[k].n, r:r, hz:Math.round(f["hz_t"+t]||0), rv:Math.round(f["rv_t"+t]||0)});',
  '      });',
  '      var comps=(window.KV_COMPS||1).toFixed(2);',
  '      var h="<div style=\'margin-bottom:6px\'><span style=\'color:#caa64c;font-weight:700\'>RENT ROLL</span>"+',
  '        "<span style=\'float:right;color:"+(sum?"#9cd87c":"#7a6a58")+"\'>+"+sum+" / lap</span></div>"+',
  '        "<div style=\'margin-bottom:6px\'><span style=\'color:#caa64c;font-weight:700\'>MARKET</span>"+',
  '        "<span style=\'float:right\'>"+comps+"\\u00d7</span></div>"+',
  '        "<div style=\'border-top:1px solid #3a3228;padding-top:4px\'></div>";',
  '      if(!rows.length) h+="<div style=\'opacity:.4\'>you own nothing yet</div>";',
  '      rows.forEach(function(r){',
  '        h+="<div style=\'padding:2px 0\'>"+r.n+',
  '           "<span style=\'float:right;color:#9cd87c\'>+"+r.r+"</span>"+',
  '           "<div style=\'opacity:.5;font-size:9px\'>hazard "+r.hz+"%"+(r.rv?(" \\u00b7 "+r.rv+"\\u2605"):"")+"</div></div>";',
  '      });',
  '      body.innerHTML=h;',
  '    }',
  '',
  '    function render(){',
  '      if(active==="HOLDINGS") renderHoldings();',
  '      else if(active==="MARKET") renderMarket();',
  '      else renderYou();',
  '    }',
  '',
  '    setInterval(function(){',
  '      // live counts on the tabs so you do not have to open one to know',
  '      var N=window.KV_NAMES||{};',
  '      var mineN=0;',
  '      Object.keys(N).forEach(function(k){ if(window.KV_OWNER && window.KV_OWNER(parseInt(k,10))===me()) mineN++; });',
  '      var lsN=listedTiles().length;',
  '      btns.HOLDINGS.textContent="HOLDINGS";',
  '      btns.MARKET.innerHTML="MARKET"+(lsN?(" <span style=\'color:#f0c860\'>"+lsN+"</span>"):"");',
  '      btns.YOU.innerHTML="YOU"+(mineN?(" <span style=\'color:#9cd87c\'>"+mineN+"</span>"):"");',
  '      render();',
  '    }, 800);',
  '    render();',
  '  })();'
].join('\n'));

fs.writeFileSync('showcase_kascity96.html', html);
console.log('PASS ' + hidden + ' overlapping left panels retired');
console.log('PASS one tabbed panel: HOLDINGS / MARKET / YOU, 300px of real space each');
console.log('PASS tab bar carries live counts — listings and your own blocks visible without opening');
console.log('PASS MARKET rows sorted best-deal-first and click through to the property');
console.log('OK showcase_kascity96.html (' + (fs.statSync('showcase_kascity96.html').size/1024/1024).toFixed(1) + ' MB)');
