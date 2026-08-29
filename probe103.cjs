const L=require('fs').readFileSync('showcase_kascity100.html','utf8').split(/\r?\n/);
const J=L[9921];
function f(re,k,w){w=w||120;const all=[...J.matchAll(re)];console.log('== '+re.source+' ('+all.length+')');
  all.slice(0,k).forEach(x=>console.log('  @'+x.index+' '+J.slice(Math.max(0,x.index-w),x.index+w).replace(/\s+/g,' ')));}
f(/\bleft\b(?!\s*[<>]|\s*-\s*\d)/g,6);
f(/\bturn\b/g,6);
f(/mgmt/g,6);
f(/\bbid\b/g,4);
f(/\bdice\b|\broll\b/g,4);
console.log('---- JS');
function r(a,b){for(let i=a-1;i<b;i++)console.log((i+1)+': '+L[i].trim().slice(0,220))}
r(7170,7203); console.log('..'); r(8088,8112); console.log('..'); r(9490,9512);
