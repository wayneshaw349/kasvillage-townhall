const L=require('fs').readFileSync('showcase_kascity103.html','utf8').split(/\r?\n/);
const R=L.find(l=>l.indexOf("world.flags.left")>=0&&l.length>100000);
if(!R){console.log("no JSON line");process.exit(1)}
const J=R.replace(/\\"/g,'"');
function f(re,k,w){w=w||300;const all=[...J.matchAll(re)];console.log('== '+re.source+' ('+all.length+')');
  all.slice(0,k).forEach(x=>console.log('  @'+x.index+' '+J.slice(Math.max(0,x.index-w),x.index+w).replace(/\s+/g,' ')));}
f(/"prompt","args":\["go"/g,1);
f(/"prompt","args":\["buy/g,2);
f(/"prompt","args":\["[a-z_]+"/g,0);
console.log('   prompt ids: '+[...new Set([...J.matchAll(/"prompt","args":\["([a-z_]+)"/g)].map(m=>m[1]))].join(','));
f(/world\.flags\.buy\s*[>=]/g,2);
f(/"setState","args":\["phase",\s*3\]/g,1);
f(/world\.flags\.asked/g,2);
f(/\brent\b/g,3);
