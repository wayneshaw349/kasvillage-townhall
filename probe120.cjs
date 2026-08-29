const L=require('fs').readFileSync('showcase_kascity119.html','utf8').split(/\r?\n/);
const s=L.findIndex(l=>l.indexOf('// ---- stall detector (escalating) ----')>=0);
for(let i=s;i<s+60&&i<L.length;i++)console.log((i+1)+': '+L[i].trim().slice(0,220));
