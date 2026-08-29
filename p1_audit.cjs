// p1_audit.cjs — usage: node p1_audit.cjs result.json
const fs=require('fs');
const r=JSON.parse(fs.readFileSync(process.argv[2]||'result.json','utf8'));
const M=r.moves||[];
const num=x=>String(x);
let buys=0,sells=0;
console.log('P1 timeline (t counts down):');
for(let i=0;i<M.length;i++){
  const m=M[i];
  if(m.s===1&&m.a==='buy'){buys++;console.log('  t'+m.t+'  BUY tile '+m.v);}
  if(m.a&&m.a.indexOf('bid:')===0&&m.s!==1)console.log('  t'+m.t+'  P'+m.s+' bids '+m.v+' on tile '+m.a.slice(4));
  if(m.s===1&&m.a&&m.a.indexOf('bid:')===0)console.log('  t'+m.t+'  P1 bids '+m.v+' on tile '+m.a.slice(4));
  if(m.a&&(m.a.indexOf('accept:')===0||m.a.indexOf('refuse:')===0||m.a.indexOf('counter:')===0))console.log('  t'+m.t+'  P'+m.s+' '+m.a+' (bar '+m.v+')');
  if(m.a==='p2pbuy')console.log('  t'+m.t+'  TRANSFER tile '+m.v+' -> P'+m.s+(m.s!==1?'  (P1 sold if P1 owned it)':'  (P1 bought)'));
  if(m.a&&m.a.indexOf('cash:')===0)console.log('  t'+m.t+'  AUDIT tile '+m.a.slice(5)+'  P'+m.s+' balance now '+m.v);
  if(m.s===1&&m.a&&m.a.indexOf('mgmt:')===0)console.log('  t'+m.t+'  CARD '+m.a.slice(5));
  if(m.s===1&&m.a==='renovate')console.log('  t'+m.t+'  RENOVATE tile '+m.v);
}
const sold=new Set();
M.forEach((m,i)=>{ if(m.a==='p2pbuy'&&m.s!==1){ /* was it P1's? check a preceding accept by P1 or bid on it */ }});
console.log('\nSummary: P1 buys from bank: '+buys);
const seat=(r.seats||[]).find(s=>s.seat===1)||{};
console.log('P1 final: netWorth '+seat.netWorth+', props '+seat.props+', xp '+seat.xp+', rank '+seat.rank);
console.log('\nRead the AUDIT pairs: for each sale, compare adjacent P1 balance-now values.');
