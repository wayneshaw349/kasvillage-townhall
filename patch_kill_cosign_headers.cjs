const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
if(s.includes('KILL-HEADER')){console.log('already');process.exit(0);}
const fails=[];let n=0;
function rep(A,B,t){const c=s.split(A).length-1;if(c!==1){fails.push(t+' count='+c);return;}s=s.replace(A,B);n++;console.log('ok:',t);}

// kill copy: prepend title instruction (safe once paste-side slices from first '{')
rep(
"try { await Clipboard.setStringAsync(JSON.stringify(_killAgg.txBody)); } catch {}",
"try { await Clipboard.setStringAsync('KasVillage kill tx. In Neighbor Agreement, paste ALL of this into the box titled \"Paste Kill Tx from Seller\". /* KILL-HEADER */\\n\\n' + JSON.stringify(_killAgg.txBody)); } catch {}",
"kill-header");

// cosign copy: prepend title instruction (paste-side 4176 already header-tolerant via sanitize)
rep(
"try { await Clipboard.setStringAsync(_res.partialSig + '|' + _killRes.partialSig); } catch {}",
"try { await Clipboard.setStringAsync('KasVillage co-signatures. In Neighbor Agreement, paste ALL of this into the box titled \"Paste Buyers Refund Sign\".\\n\\n' + _res.partialSig + '|' + _killRes.partialSig); } catch {}",
"cosign-header");

if(fails.length){console.error('ABORT:');fails.forEach(f=>console.error('  -',f));process.exit(1);}
fs.writeFileSync(F+'.bak_killheader',O);fs.writeFileSync(F,s);console.log('patched ok -',n);
