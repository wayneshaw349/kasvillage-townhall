const L=require('fs').readFileSync('showcase_kascity112.html','utf8').split(/\r?\n/);
const R=L.find(l=>l.indexOf('world.flags.left')>=0&&l.length>100000)||'';
const J=R.replace(/\\"/g,'"');
function f(re,k,w){w=w||420;const all=[...J.matchAll(re)];console.log('== '+re.source+' ('+all.length+')');all.slice(0,k).forEach(m=>console.log('  @'+m.index+' '+J.slice(Math.max(0,m.index-80),m.index+w).replace(/\s+/g,' ')));}
f(/world\.flags\.tr_state\s*==\s*2/g,2);
f(/"tr_state",\s*[013]\]/g,3,200);
f(/"sc_state",\s*1\]/g,1,200);
f(/world\.flags\.sc_state\s*==\s*1/g,1,420);
f(/"playSound","args":\["depot"\]/g,1,200);
console.log('== JS sound hook');
const re=/KV_ON_SOUND\s*=|KV_ON_SOUND\(|function playSound|KV_SETSTATE\s*=\s*function|window\.KV_SETSTATE\s*=/;
L.forEach((l,i)=>{if(l.length<1500&&re.test(l))console.log((i+1)+': '+l.trim().slice(0,200))});
