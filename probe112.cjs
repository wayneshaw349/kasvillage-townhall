const L=require('fs').readFileSync('showcase_kascity111.html','utf8').split(/\r?\n/);
for(let i=9009;i<9050;i++)console.log((i+1)+': '+L[i].trim().slice(0,220));
console.log('..');
const re=/KV_SEED\s*=|meta\.seed|seedCommit\s*=|KV_TRANSFER|function transfer|"p2pbuy"|RENT COLLECTED|in the lead|LEADER|KV_XFER|KV_SELL|KV_ACCEPT/;
L.forEach((l,i)=>{if(l.length<1500&&re.test(l))console.log((i+1)+': '+l.trim().slice(0,200))});
