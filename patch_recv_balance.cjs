const fs=require('fs');
const F='ReceiveScreen.tsx';
let s=fs.readFileSync(F,'utf8');
if(s.includes('recvBalEffect')){console.log('already patched');process.exit(0);}
fs.writeFileSync(F+'.bak_recvbal',s);
let fails=0;
function ap(name,a,b){
  let A=a,B=b,c=s.split(A).length-1;
  if(c!==1){A=a.replace(/\n/g,'\r\n');B=b.replace(/\n/g,'\r\n');c=s.split(A).length-1;}
  if(c!==1){console.error('SKIP '+name+' count '+c);fails++;return;}
  s=s.replace(A,B);console.log('ok '+name);
}

// 1. remove the one-shot getBalance in the load effect
ap('rm-old',
"      const bal = await getBalance(addr);\n      setBalance(bal);",
"      // balance now loaded by toggle-aware effect below");

// 2. add toggle-aware REST balance effect after the load effect's deps line
ap('effect',
"  }, [visible, myAddress]);",
"  }, [visible, myAddress]);\n\n  // recvBalEffect: balance follows the Hot/Vault toggle, REST-based\n  useEffect(() => {\n    const a = recvSource === 'vault' ? vaultAddr : address;\n    if (!visible || !a) { return; }\n    (async () => {\n      try {\n        const prefix = a.startsWith('kaspatest:') ? 'api-tn10' : 'api';\n        const resp = await fetch('https://' + prefix + '.kaspa.org/addresses/' + a + '/balance');\n        if (resp.ok) {\n          const data = await resp.json();\n          setBalance(BigInt(data.balance || '0'));\n        }\n      } catch {}\n    })();\n  }, [visible, recvSource, address, vaultAddr]);");

if(fails>0){console.error('restoring bak');fs.writeFileSync(F,fs.readFileSync(F+'.bak_recvbal','utf8'));process.exit(1);}
fs.writeFileSync(F,s);
console.log('patched ok');
