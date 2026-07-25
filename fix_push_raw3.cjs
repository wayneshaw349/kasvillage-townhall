const fs=require('fs');
{let F='arweave_upload.ts',s=fs.readFileSync(F,'utf8');
 if(!s.includes('uploadDataItemRaw')){
  const A="buildAns104DataItem as buildAns104Item }";
  if(s.split(A).length-1!==1){console.error('a2 abort');process.exit(1);}
  s=s.replace(A,"buildAns104DataItem as buildAns104Item, uploadDataItemRaw }");
  fs.writeFileSync(F,s);console.log('ok re-export');}else console.log('re-export present');}
{let F='push_notifications.ts',s=fs.readFileSync(F,'utf8');
 if(!s.includes('uploadDataItemRaw')){
  const A=".uploadToIrys || (arweaveUpload as any).default?.uploadToIrys;";
  if(s.split(A).length-1!==1){console.error('a3 abort');process.exit(1);}
  s=s.replace(A,".uploadDataItemRaw || (arweaveUpload as any).default?.uploadDataItemRaw;");
  fs.writeFileSync(F,s);console.log('ok use-raw');}else console.log('use-raw present');}
