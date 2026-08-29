// kascity_visual_v99.cjs
// Reads showcase_kascity98.html -> showcase_kascity99.html   (scene JSON unchanged)
//
// A. THE FEED. Renamed to "WHAT HAD HAPPENED WAS", set in larger bold type, and every line is now
//    coloured by MEANING rather than uniformly: the player in their own colour, money in green or
//    red by direction, property names in gold, and the verb picked out in white. Scrollable, newest
//    first, with the clock time on each line.
//
// B. DO NEGATIVE SCENARIOS ACTUALLY BITE? Rather than take my word for it, the SCENARIO LEDGER tracks
//    every outcome per player and shows the running total: how many went well, how many went badly,
//    and the net cash swing. If the numbers move, consequences are landing. If they sit at zero, they
//    are not — and you will be able to see which.
//    It also records each result so the tab can list them: "boiler · Patch repair · failed · -80".
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity98.html')) die('showcase_kascity98.html missing');
let html = fs.readFileSync('showcase_kascity98.html', 'utf8');

// ---------- A. header + type ----------
if (html.indexOf('head.textContent="WHAT HAPPENED";') < 0) die('feed header not found');
html = html.replace('head.textContent="WHAT HAPPENED";', 'head.textContent="WHAT HAD HAPPENED WAS";');

const stripRe = /strip\.style\.cssText="position:fixed;left:270px;right:250px;bottom:8px;height:72px;z-index:59;'?\s*\+?\s*'?[^"]*";/;
if (!stripRe.test(html)) die('feed strip style not found');
html = html.replace(stripRe,
  'strip.style.cssText="position:fixed;left:270px;right:250px;bottom:6px;height:88px;z-index:59;' +
  'background:rgba(20,16,12,.9);border:1px solid #4a3f30;border-radius:7px;' +
  'overflow-y:auto;overflow-x:hidden;padding:6px 12px;font:13px/1.55 monospace;color:#f4e4c1;";');

const headRe = /head\.style\.cssText="position:sticky;top:-5px;background:rgba\(20,16,12,\.95\);color:#caa64c;'?\s*\+?\s*'?[^"]*";/;
if (!headRe.test(html)) die('feed header style not found');
html = html.replace(headRe,
  'head.style.cssText="position:sticky;top:-6px;background:rgba(20,16,12,.97);color:#caa64c;' +
  'font-weight:900;letter-spacing:3px;font-size:10px;padding:3px 0 4px;margin:-6px 0 4px;";');

// colour the line by meaning
const rowRe = /[ \t]*row\.innerHTML="<span style='opacity:\.4'>"\+mm\+":"\+ss\+"<\/span>  "\+txt;/;
if (!rowRe.test(html)) die('feed row markup not found');
html = html.replace(rowRe, [
  '      var PC={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '      var body=String(txt);',
  '      // player tags in their own colour',
  '      body=body.replace(/\\bP([1-4])\\b/g, function(_,d){',
  '        return "<b style=\'color:"+PC[d]+"\'>P"+d+"</b>";',
  '      });',
  '      // money: green when gained, red when paid',
  '      body=body.replace(/\\+(\\d+)/g, "<b style=\'color:#9cd87c\'>+$1</b>");',
  '      body=body.replace(/\\b(paid|lost|taxed|owes)\\b ?(\\d+)?/gi, function(_,w,n){',
  '        return "<b style=\'color:#ff6a4a\'>"+w+(n?(" "+n):"")+"</b>";',
  '      });',
  '      // the verb picked out in white',
  '      body=body.replace(/\\b(bought|sold|renovated|listed|collected|received|acquired|evicted|wins|shifts)\\b/gi,',
  '        "<b style=\'color:#ffffff\'>$1</b>");',
  '      // XP in green',
  '      body=body.replace(/\\bXP\\b/g, "<b style=\'color:#9cd87c\'>XP</b>");',
  '      row.innerHTML="<span style=\'opacity:.35;font-size:11px\'>"+mm+":"+ss+"</span>  "+body;'
].join('\n'));

// ---------- B. scenario ledger ----------
const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');
html = html.split(anchor).join([
  '  window.KV_END=endGame;',
  '',
  '  // ================= SCENARIO LEDGER =================',
  '  // proves whether outcomes actually move money, rather than asking you to take it on trust',
  '  window.KV_SCN_LEDGER = { 1:{good:0,bad:0,net:0,items:[]}, 2:{good:0,bad:0,net:0,items:[]},',
  '                           3:{good:0,bad:0,net:0,items:[]}, 4:{good:0,bad:0,net:0,items:[]} };',
  '  window.KV_SCN_RECORD = function(seat, id, label, good, swing){',
  '    var L=window.KV_SCN_LEDGER[seat]; if(!L) return;',
  '    if(good) L.good++; else L.bad++;',
  '    L.net += swing;',
  '    L.items.unshift({ id:id, label:label, good:good, swing:swing });',
  '    if(L.items.length>12) L.items.pop();',
  '  };'
].join('\n'));

// record every resolution
const recRe = /[ \t]*if\(window\.KV_MOVE\) window\.KV_MOVE\(seat,"mgmt:"\+sc\.id,oi\);/;
if (!recRe.test(html)) die('scenario move record not found');
html = html.replace(recRe, [
  '      if(window.KV_SCN_RECORD) window.KV_SCN_RECORD(seat, sc.id, o.l, good, Math.round(swing));',
  '      if(window.KV_MOVE) window.KV_MOVE(seat,"mgmt:"+sc.id,oi);'
].join('\n'));

// add a SCENARIOS tab to the left panel
const tabsRe = /[ \t]*var TABS=\["HOLDINGS","MARKET","YOU"\];/;
if (!tabsRe.test(html)) die('left panel tabs not found — is v96 applied?');
html = html.replace(tabsRe, '    var TABS=["HOLDINGS","MARKET","YOU","EVENTS"];');

const renderRe = /[ \t]*function render\(\)\{\n[ \t]*if\(active==="HOLDINGS"\) renderHoldings\(\);\n[ \t]*else if\(active==="MARKET"\) renderMarket\(\);\n[ \t]*else renderYou\(\);\n[ \t]*\}/;
if (!renderRe.test(html)) die('panel render switch not found');
html = html.replace(renderRe, [
  '    function renderEvents(){',
  '      var L=window.KV_SCN_LEDGER||{};',
  '      var h="<div style=\'opacity:.6;font-size:9px;margin-bottom:5px\'>scenario outcomes and what they cost</div>";',
  '      for(var p=1;p<=4;p++){',
  '        var e=L[p]; if(!e) continue;',
  '        var mine=(window.KV_HUMANS||[1]).indexOf(p)>=0;',
  '        var netCol = e.net>0 ? "#9cd87c" : (e.net<0 ? "#ff6a4a" : "#8a7a5a");',
  '        h+="<div style=\'margin-bottom:5px\'>"+',
  '           "<span style=\'color:"+COL[p]+"\'>\\u25a0</span> <b>P"+p+(mine?" (you)":"")+"</b>"+',
  '           "<span style=\'float:right;color:"+netCol+"\'>"+(e.net>0?"+":"")+e.net+"</span>"+',
  '           "<div style=\'padding-left:11px;opacity:.55;font-size:9px\'>"+e.good+" worked \\u00b7 "+e.bad+" backfired</div>";',
  '        e.items.slice(0,3).forEach(function(it){',
  '          h+="<div style=\'padding-left:11px;font-size:9px;opacity:.75\'>"+',
  '             "<span style=\'color:"+(it.good?"#9cd87c":"#ff6a4a")+"\'>"+(it.good?"\\u2713":"\\u2717")+"</span> "+',
  '             it.id+" \\u00b7 "+it.label+" <span style=\'color:"+(it.swing>=0?"#9cd87c":"#ff6a4a")+"\'>"+',
  '             (it.swing>=0?"+":"")+it.swing+"</span></div>";',
  '        });',
  '        h+="</div>";',
  '      }',
  '      body.innerHTML=h;',
  '    }',
  '',
  '    function render(){',
  '      if(active==="HOLDINGS") renderHoldings();',
  '      else if(active==="MARKET") renderMarket();',
  '      else if(active==="EVENTS") renderEvents();',
  '      else renderYou();',
  '    }'
].join('\n'));

// count on the EVENTS tab
const countRe = /[ \t]*btns\.YOU\.innerHTML="YOU"\+\(mineN\?\(" <span style='color:#9cd87c'>"\+mineN\+"<\/span>"\):""\);/;
if (countRe.test(html)) {
  html = html.replace(countRe, [
    '      btns.YOU.innerHTML="YOU"+(mineN?(" <span style=\'color:#9cd87c\'>"+mineN+"</span>"):"");',
    '      var L=window.KV_SCN_LEDGER||{}, mp=me(), bad=(L[mp]&&L[mp].bad)||0, gd=(L[mp]&&L[mp].good)||0;',
    '      btns.EVENTS.innerHTML="EVENTS"+((gd+bad)?(" <span style=\'color:"+(bad>gd?"#ff6a4a":"#9cd87c")+"\'>"+(gd+bad)+"</span>"):"");'
  ].join('\n'));
}

fs.writeFileSync('showcase_kascity99.html', html);
console.log('PASS feed renamed WHAT HAD HAPPENED WAS, 13px bold, taller, scrollable');
console.log('PASS lines coloured by meaning — player colours, green gains, red losses, white verbs');
console.log('PASS EVENTS tab: per-player tally of scenarios that worked vs backfired, and the net cash');
console.log('PASS the last three outcomes listed per player with the exact swing');
console.log('OK showcase_kascity99.html (' + (fs.statSync('showcase_kascity99.html').size/1024/1024).toFixed(1) + ' MB)');
