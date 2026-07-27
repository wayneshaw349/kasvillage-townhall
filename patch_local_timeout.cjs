const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
if(s.includes('LOCAL-TIMEOUT-FILL')){console.log('already');process.exit(0);}
const A="if (immediateSendAmount > 0 && !(Number(canon.timeoutN) > 0)) {";
const B="/* LOCAL-TIMEOUT-FILL: device record is authoritative - TownHall snake_case records drop timeoutN. */\n          if (!(Number(canon.timeoutN) > 0)) { try { const _laT = await (await import('./local_agreements')).getAgreement(agrId); if (_laT && Number(_laT.timeoutN) > 0) { (canon as any).timeoutN = Number(_laT.timeoutN); console.log('[Refund] timeoutN filled from device record:', _laT.timeoutN); } } catch {} }\n          if (immediateSendAmount > 0 && !(Number(canon.timeoutN) > 0)) {";
const c=s.split(A).length-1;
if(c!==1){console.error('anchor count='+c+' abort');process.exit(1);}
fs.writeFileSync(F+'.bak_localtimeout',O);fs.writeFileSync(F,s.replace(A,B));console.log('patched ok');
