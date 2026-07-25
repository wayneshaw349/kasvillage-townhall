const fs=require('fs');const F='SendKAS.tsx';let s=fs.readFileSync(F,'utf8');
if(s.includes('srcAddr')){console.log('already patched');process.exit(0);}
fs.writeFileSync(F+'.bak_balswap',s);
let fails=0;
function ap(name,a,b){const c=s.split(a).length-1;if(c!==1){console.error('SKIP '+name+' count '+c);fails++;return;}s=s.replace(a,b);console.log('ok '+name);}
ap('addr1',"      if (myAddress) {","      const srcAddr = sendSource === 'vault' ? (vaultAddr || '') : myAddress;\n      if (srcAddr) {");
ap('addr2',"          const prefix = myAddress.startsWith('kaspatest:') ? 'api-tn10' : 'api';","          const prefix = srcAddr.startsWith('kaspatest:') ? 'api-tn10' : 'api';");
ap('addr3',"          const resp = await fetch('https://' + prefix + '.kaspa.org/addresses/' + myAddress + '/balance');","          const resp = await fetch('https://' + prefix + '.kaspa.org/addresses/' + srcAddr + '/balance');");
ap('addr4',"              const ledger = await syncLedger(myAddress);","              const ledger = await syncLedger(srcAddr);");
ap('deps',"  }, [myAddress]);","  }, [myAddress, sendSource, vaultAddr]);");
if(fails>0){console.error('restoring bak');fs.writeFileSync(F,fs.readFileSync(F+'.bak_balswap','utf8'));process.exit(1);}
fs.writeFileSync(F,s);console.log('patched ok');
