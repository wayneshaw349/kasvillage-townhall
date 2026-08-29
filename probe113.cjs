const L=require('fs').readFileSync('showcase_kascity112.html','utf8').split(/\r?\n/);
function from(marker,n){const s=L.findIndex(l=>l.indexOf(marker)>=0);if(s<0){console.log('NOT FOUND: '+marker);return;}console.log('== '+marker);for(let i=s;i<s+n&&i<L.length;i++)console.log((i+1)+': '+L[i].trim().slice(0,220));}
from('function settle(tile,buyer,seller,amt){',40);
from('// ================= RENT EVERY REVOLUTION =================',60);
console.log('== tr_state / tr_tile in engine JSON');
const R=L.find(l=>l.indexOf('world.flags.left')>=0&&l.length>100000)||'';
const J=R.replace(/\\"/g,'"');
[...J.matchAll(/world\.flags\.tr_state\s*==\s*1/g)].slice(0,2).forEach(m=>console.log('  @'+m.index+' '+J.slice(m.index-60,m.index+520).replace(/\s+/g,' ')));
