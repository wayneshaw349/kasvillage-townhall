const fs=require('fs');
const b=fs.readFileSync('App.tsx');
if(b.slice(0,6).toString('hex')!=='efbfbdefbfbd'){console.log('ABORT unexpected head: '+b.slice(0,8).toString('hex'));process.exit(1);}
const body=b.slice(6).toString('utf16le');
console.log('BODY: '+JSON.stringify(body));
fs.writeFileSync('App.tsx.orig-utf16', b);
const T="const __KVTAG=Math.random().toString(36).slice(2,6);\n"
      +"const __kvOrigLog=console.log;\n"
      +"console.log=(...a)=>__kvOrigLog('<'+__KVTAG+'>',...a);\n\n";
fs.writeFileSync('App.tsx', T+body, {encoding:'utf8'});
const n=fs.readFileSync('App.tsx');
console.log('firstByte '+n[0].toString(16)+' len '+n.length);
