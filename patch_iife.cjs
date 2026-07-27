const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
const A="{ const _mr: any = manualLookupResult; const _aid = _mr.agreementId || _mr.agreement_id; try { await laUpsert(";
const B="{ (async () => { const _mr: any = manualLookupResult; const _aid = _mr.agreementId || _mr.agreement_id; try { await laUpsert(";
const c=s.split(A).length-1;
if(c!==1){console.error('open count='+c+' abort');process.exit(1);}
s=s.replace(A,B);
// close the IIFE: find the tail of my block (the fallback accept call + closing brace) and wrap
const A2="handleAcceptFromInbox({ ...manualLookupResult, _verificationCode: manualVerCode }); }";
const B2="handleAcceptFromInbox({ ...manualLookupResult, _verificationCode: manualVerCode }); })(); }";
const c2=s.split(A2).length-1;
if(c2!==1){console.error('close count='+c2+' abort — reverting');process.exit(1);}
s=s.replace(A2,B2);
fs.writeFileSync(F+'.bak_iife',O);fs.writeFileSync(F,s);console.log('ok - wrapped in async IIFE');
