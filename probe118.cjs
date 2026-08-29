const L=require('fs').readFileSync('showcase_kascity117.html','utf8').split(/\r?\n/);
function r(a,b){for(let i=a-1;i<b&&i<L.length;i++)console.log((i+1)+': '+L[i].trim().slice(0,200))}
const a=L.findIndex(l=>l.indexOf('"  LISTS  "')>=0);
console.log('== bot listing block'); r(Math.max(1,a-45), a+15);
const b=L.findIndex(l=>l.indexOf('// ---- narrate bot offer decisions ----')>=0);
console.log('== bot offer narration'); r(b+1, b+40);
console.log('== engine mkoffer prompt');
const R=L.find(l=>l.indexOf('world.flags.left')>=0&&l.length>100000)||'';
const J=R.replace(/\\"/g,'"');
const m=J.indexOf('"prompt","args":["mkoffer"');
if(m>=0) console.log(J.slice(Math.max(0,m-700),m+300).replace(/\s+/g,' '));
