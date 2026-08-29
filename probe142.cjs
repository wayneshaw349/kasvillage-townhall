const L=require('fs').readFileSync('showcase_kascity140.html','utf8').split(/\r?\n/);
const R=L.find(l=>l.indexOf('world.flags.left')>=0&&l.length>100000)||'';
const J=R.replace(/\\"/g,'"');
function f(re,k,w){w=w||520;const all=[...J.matchAll(re)];console.log('== '+re.source+' ('+all.length+')');all.slice(0,k).forEach(m=>console.log('  @'+m.index+' '+J.slice(Math.max(0,m.index-w),m.index+120).replace(/\s+/g,' ')));}
f(/amountExpr":"0 - \(/g,4);
f(/renov_by/g,6,260);
f(/world\.flags\.renov ==/g,4,80);
console.log('== JS charge?');
const re=/renov.*cash|cash.*renov|RENOV_COST|renovCost/i;
let n=0;L.forEach((l,i)=>{if(l.length<1500&&re.test(l)&&n<20){console.log((i+1)+': '+l.trim().slice(0,200));n++}});
