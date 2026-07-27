const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
if(s.includes('ROLE-BY-PUBKEY')){console.log('already');process.exit(0);}
const fails=[];let n=0;
function rep(A,B,t){const c=s.split(A).length-1;if(c!==1){fails.push(t+' count='+c);return;}s=s.split(A).join(B);n++;console.log('ok:',t,'('+c+')');}

// both guards call nextActionMsg(_exPh.phase, _exRec.role || 'seller') — replace role source:
// my wallet pubkey vs record's buyerPubkey decides. contract.buyerPubkey/sellerPubkey may be stale here,
// so compare against the record itself using the wallet identity kv pubkey in state if present.
const A="nextActionMsg(_exPh.phase, _exRec.role || 'seller')";
const B="nextActionMsg(_exPh.phase, (_exRec.origin === 'mine' ? 'buyer' : (_exRec.role || 'seller'))) /* ROLE-BY-PUBKEY: origin 'mine'=I authored=buyer; else stored role */";
const c=s.split(A).length-1;
if(c!==2){console.error('expected 2 call sites, got '+c+' - abort');process.exit(1);}
s=s.split(A).join(B);n=2;console.log('ok: both call sites');

fs.writeFileSync(F+'.bak_rolefix',O);fs.writeFileSync(F,s);console.log('patched ok -',n);
