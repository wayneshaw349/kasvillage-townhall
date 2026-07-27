const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
[4046,4163].forEach(n=>{const l=s[n-1];console.log(n+': ['+l.trim().slice(0,140)+']');const i=l.indexOf('Paste');if(i>=0){const seg=l.slice(i,i+45);console.log('   HEX: '+Buffer.from(seg,'utf8').toString('hex'));}});
