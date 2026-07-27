const s=require('fs').readFileSync('local_agreements.ts','utf8');
console.log('LEN:',s.length,'chars');
console.log('=== AgrStep type ===');
const m=s.match(/export type AgrStep[\s\S]*?;/);console.log(m?m[0]:'not found');
console.log('=== has derivePhase / L1 read? ===');
console.log('derivePhase:',s.includes('derivePhase'));
console.log('balance/L1 read:',/fetch|balance|utxo|frostAddr.*bal/i.test(s));
console.log('=== exported functions ===');
(s.match(/export (async )?function \w+/g)||[]).forEach(f=>console.log(' ',f));
