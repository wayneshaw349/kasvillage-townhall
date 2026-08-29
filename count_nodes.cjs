const fs=require('fs');
const s=fs.readFileSync('kascity_v2.json','utf8');
const o=JSON.parse(s);
let seq=0,sel=0,cond=0,doN=0,total=0;
(function walk(n){
  if(Array.isArray(n)){n.forEach(walk);return;}
  if(!n||typeof n!=='object')return;
  if('sequence' in n)seq++;
  if('selector' in n)sel++;
  if('cond' in n)cond++;
  if('do' in n)doN++;
  total++;
  for(const k in n)walk(n[k]);
})(o);
console.log({seq,sel,cond,doN,total,cap:(o.compliance&&o.compliance.maxNodes)||512});
