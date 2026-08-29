const L=require('fs').readFileSync('showcase_kascity103.html','utf8').split(/\r?\n/);
const J=L.find(l=>l.length>1000000);
function f(re,k,w){w=w||260;const all=[...J.matchAll(re)];console.log('== '+re.source+' ('+all.length+')');
  all.slice(0,k).forEach(x=>console.log('  @'+x.index+' '+J.slice(Math.max(0,x.index-w),x.index+w).replace(/\\"/g,'"').replace(/\s+/g,' ')));}
f(/"prompt","args":\["go"/g,2);
f(/"prompt","args":\["buy/g,2);
f(/flags\.buy\s*>=\s*0|flags\.buy\s*==\s*1/g,2);
f(/"setState","args":\["phase",3\]/g,2);
f(/"setState","args":\["asked",1\]/g,2);
f(/action":"rent|flags\.rent|"rent"/g,3);
