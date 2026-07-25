const fs=require('fs');const F='arweave_upload.ts';let s=fs.readFileSync(F,'utf8');
if(s.includes('buildAns104Item')){console.log('already patched');process.exit(0);}
fs.writeFileSync(F+'.bak_push',s);
const A="export async function uploadToTurbo(";
if(s.split(A).length-1!==1){console.error('anchor abort');process.exit(1);}
s=s.replace(A,"export { buildAns104DataItem, buildAns104DataItem as buildAns104Item } from './avatar_arweave_upload';\n\n"+A);
fs.writeFileSync(F,s);console.log('fixed');
