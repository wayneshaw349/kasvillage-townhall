const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
if(s.includes('PASTE-SANITIZE')){console.log('already');process.exit(0);}
const fails=[];let n=0;
function rep(A,B,t){const c=s.split(A).length-1;if(c!==1){fails.push(t+' count='+c);return;}s=s.replace(A,B);n++;console.log('ok:',t);}

// AMBER: buyer template paste (4056)
rep(
"const _pp = v.split('|');",
"const _ppLines = v.trim().split(/\\r?\\n/).filter(x => x.trim()); const _ppPayload = _ppLines.length ? _ppLines[_ppLines.length - 1] : v; /* PASTE-SANITIZE: instruction headers ride above the payload */ const _pp = _ppPayload.split('|');",
"amber-sanitize");

// seller cosign paste (4176) — same tolerance so future headers can't break it
rep(
"const _rp = v.split('|');",
"const _rpLines = v.trim().split(/\\r?\\n/).filter(x => x.trim()); const _rpPayload = _rpLines.length ? _rpLines[_rpLines.length - 1] : v; const _rp = _rpPayload.split('|');",
"cosign-sanitize");

if(fails.length){console.error('ABORT:');fails.forEach(f=>console.error('  -',f));process.exit(1);}
fs.writeFileSync(F+'.bak_sanitize',O);fs.writeFileSync(F,s);console.log('patched ok -',n);
