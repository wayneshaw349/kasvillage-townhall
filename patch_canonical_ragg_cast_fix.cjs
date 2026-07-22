#!/usr/bin/env node
// Fixes the leftover 3 errors from the previous canonical patch: `as typeof G`
// narrowed Ragg to the ambient (incomplete) type. Change to `as any` — Ragg's
// .add/.negate/.toRawBytes are runtime-proven; this is type-only.
// Usage:  node patch_canonical_ragg_cast_fix.cjs [path\to\canonical_agreement_steps.ts]
const fs=require('fs');
const FILE=process.argv[2]||'canonical_agreement_steps.ts';
let s=fs.readFileSync(FILE,'utf8');
const FIND="  let Ragg = (G.multiply(nonce.k) as any).add(Rc) as typeof G; // type-only cast; runtime proven";
const REPL="  let Ragg: any = (G.multiply(nonce.k) as any).add(Rc); // type-only cast; runtime proven";
if(s.includes(REPL)){console.log('[skip] already fixed.');process.exit(0);}
const count=s.split(FIND).length-1;
if(count!==1){console.error('[ABORT] anchor found '+count+' times (expected 1). No writes.');process.exit(1);}
s=s.replace(FIND,REPL);
if(!s.includes('let Ragg: any =')){console.error('[ABORT] post-condition failed.');process.exit(1);}
fs.writeFileSync(FILE,s);
console.log('[ok] Ragg cast fixed (any). Re-run: npx tsc --noEmit');
