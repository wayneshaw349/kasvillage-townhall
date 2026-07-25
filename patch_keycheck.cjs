const fs=require('fs');
const F='AppNaviagator.tsx';
let s=fs.readFileSync(F,'utf8');
const A="console.log('[AppNav] Your PubKey:', publicKey);";
const n=s.split(A).length-1;
if(n!==1){console.error('ANCHOR COUNT '+n+' - abort');process.exit(1);}
fs.writeFileSync(F+'.bak_keycheck',s);
const INJ = `
        try {
          const _C='qpzry9x8gf2tvdw0s3jn54khce6mua7l';
          const _poly=(v)=>{let c=1n;for(const d of v){const c0=c>>35n;c=((c&0x07fffffffffn)<<5n)^BigInt(d);if(c0&0x01n)c^=0x98f2bc8e61n;if(c0&0x02n)c^=0x79b76d99e2n;if(c0&0x04n)c^=0xf33e5fb3c4n;if(c0&0x08n)c^=0xae2eabe2a8n;if(c0&0x10n)c^=0x1e4f43e470n;}return c^1n;};
          const _c85=(p)=>{const r=[];let b=0,q=0;for(const c of p){b=(b<<8)|c;q+=8;while(q>=5){q-=5;r.push((b>>q)&31);b&=(1<<q)-1;}}if(q>0)r.push((b<<(5-q))&31);return r;};
          if(publicKey && publicKey.length>=66 && kaspaAddrBoot){
            const _xo=[];for(let i=2;i<66;i+=2)_xo.push(parseInt(publicKey.substr(i,2),16));
            const _hrp=kaspaAddrBoot.split(':')[0]||'kaspatest';
            const _fv=_c85([0,..._xo]);
            const _pre=Array.from(_hrp).map(c=>c.charCodeAt(0)&0x1f);
            const _cs=_poly([..._pre,0,..._fv,0,0,0,0,0,0,0,0]);
            const _cb=[];for(let i=4;i>=0;i--)_cb.push(Number((_cs>>BigInt(i*8))&0xFFn));
            let _a=_hrp+':';for(const d of [..._fv,..._c85(_cb)])_a+=_C[d];
            console.log('[KeyCheck] derived:',_a.slice(0,22),'stored:',kaspaAddrBoot.slice(0,22),'match:',_a===kaspaAddrBoot);
          }
        } catch(e){ console.log('[KeyCheck] failed:', String(e)); }`;
s=s.replace(A, A+INJ);
fs.writeFileSync(F,s);
console.log('patched ok');
