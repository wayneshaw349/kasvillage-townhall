const L=require('fs').readFileSync('showcase_kascity151.html','utf8').split(/\r?\n/);
const R=L.find(l=>l.indexOf('world.flags.left')>=0&&l.length>100000)||'';
const J=R.replace(/\\"/g,'"');
console.log('== scene sequences mentioning buyer (context 700 chars)');
let i=0,n=0;
while((i=J.indexOf('buyer',i+1))>0 && n<8){
  const s=J.lastIndexOf('{"sequence":[',i);
  if(s<0 || i-s>1200) continue;
  n++; console.log('--- '+n+' @'+s+' ---');
  console.log(J.slice(s,s+700).replace(/\s+/g,' '));
}
console.log('\n== JS side: buyer scenario handler');
const re=/buyer\|accept|"buyer"|sc_sell|sc_amt|KV_FORCE_SCENARIO|scn\b/;
let m=0;L.forEach((l,idx)=>{if(l.length<1500&&re.test(l)&&m<40){console.log((idx+1)+': '+l.trim().slice(0,200));m++}});
