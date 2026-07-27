const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
if(s.includes('KILL-HEADER')){console.log('already');process.exit(0);}
const fails=[];let n=0;
function rep(A,B,t){const c=s.split(A).length-1;if(c!==1){fails.push(t+' count='+c);return;}s=s.replace(A,B);n++;console.log('ok:',t);}

// 1: kill paste-side — slice from first '{' so headers are tolerated
rep(
"const _kt = JSON.parse(_kRaw);",
"const _kt = JSON.parse(_kRaw.indexOf('{') >= 0 ? _kRaw.slice(_kRaw.indexOf('{')) : _kRaw); /* KILL-HEADER tolerant */",
"kill-paste-slice");

// 2: kill copy — prepend title instruction
rep(
"try { await Clipboard.setStringAsync(JSON.stringify(_killAgg.txBody)); } catch {}",
"try { await Clipboard.setStringAsync('KasVillage kill tx. In Neighbor Agreement, paste ALL of this into the box titled \"Paste Kill Tx from Seller\".\\n\\n' + JSON.stringify(_killAgg.txBody)); } catch {}",
"kill-header");

// 3: cosign copy — prepend title instruction
rep(
"try { await Clipboard.setStringAsync(_res.partialSig + '|' + _kres.partialSig); } catch {}",
"try { await Clipboard.setStringAsync('KasVillage co-signatures. In Neighbor Agreement, paste ALL of this into the box titled \"Paste Buyers Refund Sign\".\\n\\n' + _res.partialSig + '|' + _kres.partialSig); } catch {}",
"cosign-header");

if(fails.length){console.error('ABORT - nothing written:');fails.forEach(f=>console.error('  -',f));process.exit(1);}
fs.writeFileSync(F+'.bak_headers3',O);fs.writeFileSync(F,s);console.log('patched ok -',n);
