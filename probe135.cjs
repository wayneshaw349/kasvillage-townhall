const L=require('fs').readFileSync('showcase_kascity133.html','utf8').split(/\r?\n/);
const R=L.find(l=>l.indexOf('world.flags.left')>=0&&l.length>100000)||'';
const J=R.replace(/\\"/g,'"');
function f(re,k,w){w=w||350;const all=[...J.matchAll(re)];console.log('== '+re.source+' ('+all.length+')');all.slice(0,k).forEach(m=>console.log('  @'+m.index+' '+J.slice(Math.max(0,m.index-w),m.index+w).replace(/\s+/g,' ')));}
f(/"alive"/g,4);
f(/'alive'\)\s*[<=>]/g,3,200);
console.log('== JS personality');
const re=/KV_PROFNAME\s*=|MATE_PULL|WOBBLE|\baggr\b|msl_p|"developer"|"trader"|"miser"|now a /i;
let n=0;L.forEach((l,i)=>{if(l.length<1500&&re.test(l)&&n<40){console.log((i+1)+': '+l.trim().slice(0,200));n++}});
