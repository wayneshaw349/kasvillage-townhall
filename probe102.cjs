const L=require('fs').readFileSync('showcase_kascity100.html','utf8').split(/\r?\n/);
const J=L[9921];
function f(re,k,w){w=w||110;const all=[...J.matchAll(re)];console.log('== '+re.source+' ('+all.length+')');
  all.slice(0,k).forEach(x=>console.log('  @'+x.index+' '+J.slice(Math.max(0,x.index-w),x.index+w).replace(/\s+/g,' ')));}
f(/flags\.left\s*[-=]/g,5);
f(/"left"\s*:\s*\d+/g,3);
f(/flags\.turn\b\s*=/g,4);
f(/flags\.(mgmt|deck|card|scen)\w*\s*=\s*[^0\s]/g,6);
f(/flags\.(mgmt|deck|card|scen)\w*\s*(==|>)\s*0/g,4);
f(/flags\.(stall|stuck|watchdog)\w*/g,3);
console.log('---- JS side');
const re=/KV_MOVES\.push|function move\(|KV_SEALED|KV_CHAIN_READY\s*=|\bbid\b.*(open|show)|offer.*(open|show)|display="block"/i;
let n=0;L.forEach((l,i)=>{if(i<9921&&n<40&&re.test(l)){console.log((i+1)+': '+l.trim().slice(0,190));n++}});
