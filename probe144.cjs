const L=require('fs').readFileSync('showcase_kascity143.html','utf8').split(/\r?\n/);
const re=/CASH|BANK\b/;
let n=0;L.forEach((l,i)=>{if(l.length<1500&&re.test(l)&&l.indexOf('textContent')<0&&n<25){console.log((i+1)+': '+l.trim().slice(0,220));n++}});
console.log('== sv / seat readers');
const re2=/function sv\(|window\.KV_SEAT\s*=|c\.seats\[|seats\[p\]/;
L.forEach((l,i)=>{if(l.length<1500&&re2.test(l))console.log((i+1)+': '+l.trim().slice(0,220))});
console.log('== engine: what addSeatStat writes');
const s=L.findIndex(l=>l.indexOf('"addSeatStat"')>=0&&l.indexOf('case')>=0||l.indexOf("addSeatStat")>=0&&l.indexOf("function")>=0);
if(s>=0)for(let i=s;i<s+25;i++)console.log((i+1)+': '+L[i].trim().slice(0,220));
