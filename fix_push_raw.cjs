const fs=require('fs');let fails=0;
function ap(F,name,a,b){let s=fs.readFileSync(F,'utf8');
 if(s.includes(b.slice(0,42))){console.log('skip '+name);return;}
 const c=s.split(a).length-1;
 if(c!==1){console.error('SKIP '+name+' count '+c);fails++;return;}
 fs.writeFileSync(F+'.bak_pushraw',s);
 fs.writeFileSync(F,s.replace(a,b));console.log('ok '+name);}

// 1. avatar: export raw uploader under distinct name
ap('avatar_arweave_upload.ts','raw-export',
"export async function recoverAvatarFromArweave(",
"export const uploadDataItemRaw = uploadToIrys;\n\nexport async function recoverAvatarFromArweave(");

// 2. arweave_upload: re-export it
ap('arweave_upload.ts','re-export',
"export { buildAns104DataItem, buildAns104DataItem as buildAns104Item } from './avatar_arweave_upload';",
"export { buildAns104DataItem, buildAns104DataItem as buildAns104Item, uploadDataItemRaw } from './avatar_arweave_upload';");

// 3. push: prefer the raw uploader
ap('push_notifications.ts','use-raw',
"    const uploadFn = (arweaveUpload as any).uploadToIrys || (arweaveUpload as any).default?.uploadToIrys;",
"    const uploadFn = (arweaveUpload as any).uploadDataItemRaw || (arweaveUpload as any).default?.uploadDataItemRaw;");

if(fails>0)process.exit(1);
console.log('all patched');
