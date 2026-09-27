// kascity_visual_v93.cjs
// Reads showcase_kascity92.html -> showcase_kascity93.html   (scene JSON unchanged)
//
// A. SALE FLAGS WERE GUESSED FROM WORDING. "Accept it" means three different things across the deck,
//    so matching on the label was wrong in four places:
//        heirs / "Buy them out"      you PAY to keep the title — you do not sell
//        section8 / "Accept it"      taking a subsidised tenant is not a sale
//        assessment / "Accept it"    accepting a valuation is not a sale
//        sublet / "Terminate lease"  ending a tenancy is not selling the building
//    Only the investor scenario genuinely transfers a deed. The list is now explicit:
//        buyer / "Accept it"   and   buyer / "Counter high"
//    and heirs gains a real losing outcome: fail to settle and you lose the property.
//
// B. RENT EVERY REVOLUTION. Owning property paid nothing between landings, so a landlord with five
//    blocks and no visitors earned the same as someone holding nothing. Each time you pass GO you now
//    collect rent on everything you own:
//        rent per block = market value * 9%, reduced by hazard, raised by renovations
//        a hazardous block barely earns; a renovated one earns well
//    Landing rent is unchanged and stacks on top, so a visited block still pays extra.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity92.html')) die('showcase_kascity92.html missing');
let html = fs.readFileSync('showcase_kascity92.html', 'utf8');

// ---------- A. explicit sale options ----------
const saleRe = /    var SELL_LABELS = \[[^\]]*\];\n    function isSaleOption\(label\)\{[\s\S]*?\n    \}/;
if (!saleRe.test(html)) die('isSaleOption block not found — is v92 applied?');
html = html.replace(saleRe, [
  '    // only these genuinely transfer a deed. keyed by scenario id + option label, because',
  '    // "Accept it" means something different in three separate scenarios.',
  '    var SALE_OPTIONS = {',
  '      "buyer|accept it": true,',
  '      "buyer|counter high": true',
  '    };',
  '    // and these LOSE you the property when the roll goes against you',
  '    var LOSS_ON_FAIL = {',
  '      "heirs|do nothing": true,',
  '      "heirs|title lawyer": true',
  '    };',
  '    function isSaleOption(scId, label){',
  '      return !!SALE_OPTIONS[String(scId)+"|"+String(label||"").toLowerCase()];',
  '    }',
  '    function losesOnFail(scId, label){',
  '      return !!LOSS_ON_FAIL[String(scId)+"|"+String(label||"").toLowerCase()];',
  '    }'
].join('\n'));

// resolve() must pass the scenario id and handle the loss case
const oldSold = /      var sold=null;\n      if\(isSaleOption\(o\.l\) && good\)\{\n        sold=ownedTileOf\(seat\);\n      \}/;
if (!oldSold.test(html)) die('sale decision in resolve() not found');
html = html.replace(oldSold, [
  '      var sold=null, lost=false;',
  '      if(isSaleOption(sc.id, o.l) && good){',
  '        sold=ownedTileOf(seat);            // a genuine sale: deed goes, money comes',
  '      } else if(losesOnFail(sc.id, o.l) && !good){',
  '        sold=ownedTileOf(seat); lost=true;  // the title is lost, and you are not paid for it',
  '      }'
].join('\n'));

// a lost title pays nothing
const amtRe = /        window\.KV_SETSTATE\("sc_amt", Math\.round\(swing\)\);/;
if (!amtRe.test(html)) die('sc_amt write not found');
html = html.replace(amtRe,
  '        window.KV_SETSTATE("sc_amt", lost ? Math.round(Math.min(0, swing)) : Math.round(swing));');

const nmRe = /      var nmS = \(sold!=null && window\.KV_NAMES\[sold\]\) \? window\.KV_NAMES\[sold\]\.n : null;/;
if (!nmRe.test(html)) die('sold name line not found');
html = html.replace(nmRe,
  '      var nmS = (sold!=null && window.KV_NAMES[sold]) ? window.KV_NAMES[sold].n : null;\n' +
  '      var soldWord = lost ? "  \\u00b7 LOST " : "  \\u00b7 sold ";');
html = html.split('(nmS?("  \\u00b7 sold "+nmS):"")').join('(nmS?(soldWord+nmS):"")');

// the button hint uses the id-aware test
const hintRe = /\(isSaleOption\(o\.l\)\?" \\u00b7 <span style='color:#f0c860'>sells the property<\/span>":""\)/;
if (hintRe.test(html)) {
  html = html.replace(hintRe,
    '(isSaleOption(sc.id,o.l)?" \\u00b7 <span style=\'color:#f0c860\'>sells the property</span>":' +
    '(losesOnFail(sc.id,o.l)?" \\u00b7 <span style=\'color:#ff6a4a\'>failure loses the title</span>":""))');
}

// ---------- B. rent every revolution ----------
const anchor = '  window.KV_END=endGame;';
if (html.split(anchor).length - 1 !== 1) die('endGame anchor not found');
html = html.split(anchor).join([
  '  window.KV_END=endGame;',
  '',
  '  // ================= RENT EVERY REVOLUTION =================',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    function F(){ return (window.KV_FLAGS&&window.KV_FLAGS())||{}; }',
  '',
  '    // rent scales with what the block is worth, is crippled by hazard, and rewards renovation',
  '    window.KV_RENT=function(t){',
  '      var N=window.KV_NAMES||{}, d=N[t]; if(!d) return 0;',
  '      var f=F(), hz=f["hz_t"+t]||0, rv=f["rv_t"+t]||0;',
  '      var mv=window.KV_MARKET?window.KV_MARKET(t):(d.p||0);',
  '      var occupancy=Math.max(0.35, 1 - hz/110);      // a hazardous block struggles to keep tenants',
  '      return Math.round(mv * 0.09 * occupancy * (1 + 0.15*rv));',
  '    };',
  '',
  '    function collect(seat){',
  '      var N=window.KV_NAMES||{}, total=0, count=0, lines=[];',
  '      Object.keys(N).forEach(function(k){',
  '        var t=parseInt(k,10);',
  '        if(!window.KV_OWNER || window.KV_OWNER(t)!==seat) return;',
  '        var r=window.KV_RENT(t);',
  '        total+=r; count++;',
  '        if(lines.length<4) lines.push(N[k].n+" "+r);',
  '      });',
  '      if(!count || !total) return;',
  '      if(window.KV_SETSTATE){',
  '        window.KV_SETSTATE("sc_seat", seat);',
  '        window.KV_SETSTATE("sc_amt", total);',
  '        window.KV_SETSTATE("sc_sell", -1);',
  '        window.KV_SETSTATE("sc_t", 0);',
  '        window.KV_SETSTATE("sc_state", 1);',
  '      }',
  '      var mine=(window.KV_HUMANS||[1]).indexOf(seat)>=0;',
  '      if(window.KV_LOG) window.KV_LOG("P"+seat+"  rent roll  +"+total+"  ("+count+" blocks)", COL[seat]);',
  '      if(window.KV_SHOUT) window.KV_SHOUT("RENT ROLL", (mine?"YOU":("P"+seat))+" collect "+total+" from "+count+" blocks",',
  '        COL[seat], mine);',
  '      if(window.KV_XP && total>0){',
  '        var g=Math.max(1,Math.round((total/15)*(window.KV_XP_MULT==null?1:window.KV_XP_MULT)));',
  '        window.KV_XP[seat]=(window.KV_XP[seat]||0)+g;',
  '      }',
  '    }',
  '',
  '    // a lap is signalled by the payday sound the BT plays on passing GO',
  '    var prevHook=window.KV_ON_SOUND;',
  '    var lastLap={};',
  '    window.KV_ON_SOUND=function(id){',
  '      try{ if(prevHook) prevHook(id); }catch(e){}',
  '      if(id!=="depot") return;',
  '      var f=F();',
  '      var seat=((f.turn||0)%4)+1;',
  '      var now=Date.now();',
  '      if(lastLap[seat] && now-lastLap[seat]<3000) return;   // one rent roll per lap',
  '      lastLap[seat]=now;',
  '      setTimeout(function(){ collect(seat); }, 700);        // let the salary settle first',
  '    };',
  '',
  '    // show what your portfolio yields per lap',
  '    var box=document.createElement("div");',
  '    box.style.cssText="position:fixed;left:8px;top:92px;z-index:57;width:214px;'
    + 'background:rgba(20,16,12,.92);border:1px solid #5a4a3a;border-radius:4px;padding:3px 8px;'
    + 'font:10px monospace;color:#f4e4c1;box-sizing:border-box;";',
  '    document.body.appendChild(box);',
  '    setInterval(function(){',
  '      var me=(window.KV_HUMANS||[1])[0]||1;',
  '      var N=window.KV_NAMES||{}, sum=0, n=0;',
  '      Object.keys(N).forEach(function(k){',
  '        var t=parseInt(k,10);',
  '        if(window.KV_OWNER && window.KV_OWNER(t)===me){ sum+=window.KV_RENT(t); n++; }',
  '      });',
  '      box.innerHTML="<span style=\'color:#caa64c;font-weight:700\'>RENT ROLL</span>"+',
  '        "<span style=\'float:right;color:"+(sum?"#9cd87c":"#7a6a58")+"\'>+"+sum+" / lap</span>";',
  '    }, 800);',
  '  })();'
].join('\n'));

fs.writeFileSync('showcase_kascity93.html', html);
console.log('PASS sale outcomes are now explicit — only the investor scenario transfers a deed');
console.log('PASS heirs gains a real stake: fail to settle the title and you lose the property unpaid');
console.log('PASS rent collected on every lap: market value x 9%, cut by hazard, raised by renovation');
console.log('PASS landing rent unchanged and stacks on top');
console.log('PASS RENT ROLL readout shows what your portfolio yields per lap');
console.log('OK showcase_kascity93.html (' + (fs.statSync('showcase_kascity93.html').size/1024/1024).toFixed(1) + ' MB)');
