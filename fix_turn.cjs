const fs=require('fs');
const F='kascity_v2.json';
const raw=fs.readFileSync(F,'utf8');
const s=JSON.parse(raw);
const d=(function f(l){let h=null;(l||[]).forEach(n=>{if(n&&n.id==='director'&&n.bt)h=n;const r=f(n&&n.children);if(r)h=r;});return h;})(s.nodes);
const p3=d.bt.selector.find(b=>b.sequence&&b.sequence[0]&&b.sequence[0].cond==='world.flags.phase == 3');
const sel=p3.sequence.filter(x=>Array.isArray(x.selector)).pop();
const tail=sel.selector[sel.selector.length-1];
const i=tail.sequence.findIndex(x=>x.do&&x.do.action==='setFlagExpr'&&x.do.args&&x.do.args[0]==='turn');
if(i<0){console.error('ABORT: turn setFlagExpr not found (already removed?)');process.exit(1);}
tail.sequence.splice(i,1);
fs.writeFileSync(F+'.bak2',raw,'utf8');
fs.writeFileSync(F,JSON.stringify(s),'utf8');
console.log('OK removed duplicate turn increment; nextSeat owns it');
