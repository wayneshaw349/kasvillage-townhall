const L=require('fs').readFileSync('showcase_kascity140.html','utf8').split(/\r?\n/);
const R=L.find(l=>l.indexOf('world.flags.left')>=0&&l.length>100000)||'';
const J=R.replace(/\\"/g,'"');
function f(re,k,w){w=w||500;const all=[...J.matchAll(re)];console.log('== '+re.source+' ('+all.length+')');all.slice(0,k).forEach(m=>console.log('  @'+m.index+' '+J.slice(Math.max(0,m.index-100),m.index+w).replace(/\s+/g,' ')));}
f(/world\.flags\.renov\s*[>=<]/g,4);
f(/"renov",-1/g,3,150);
f(/renov_by/g,3,300);
f(/"rv_t\d+"/g,2,250);
