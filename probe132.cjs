const L=require('fs').readFileSync('showcase_kascity131.html','utf8').split(/\r?\n/);
const re=/function seat\b|seat\s*[:=]\s*function|seat\(\)\s*\{|\bseat:\s*\(|currentSeat|world\.seat\b|\.seat\s*=|flags\.turn\s*%|turn\s*%\s*4/;
let n=0;L.forEach((l,i)=>{if(l.length<1500&&re.test(l)&&n<40){console.log((i+1)+': '+l.trim().slice(0,220));n++}});
const s=L.findIndex(l=>l.indexOf('function exprCtx')>=0);
if(s>=0){console.log('== exprCtx');for(let i=s;i<s+45&&i<L.length;i++)console.log((i+1)+': '+L[i].trim().slice(0,220));}
const R=L.find(l=>l.indexOf('world.flags.left')>=0&&l.length>100000)||'';
const J=R.replace(/\\"/g,'"');
console.log('== engine: how the turn advances');
[...J.matchAll(/"setFlagExpr","args":\["turn","[^"]+"\]/g)].slice(0,3).forEach(m=>console.log('  @'+m.index+' '+J.slice(m.index-400,m.index+200).replace(/\s+/g,' ')));
[...J.matchAll(/"setState","args":\["turn",[^\]]+\]/g)].slice(0,2).forEach(m=>console.log('  @'+m.index+' '+J.slice(m.index-300,m.index+120).replace(/\s+/g,' ')));
[...J.matchAll(/"(nextSeat|advanceSeat|endTurn|setSeat)"/g)].slice(0,3).forEach(m=>console.log('  @'+m.index+' '+J.slice(m.index-300,m.index+200).replace(/\s+/g,' ')));
