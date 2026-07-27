const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
const A="                      <TouchableOpacity\n                        onPress={() => {\n                          // Verify code matches before accepting";
const B="                      <TouchableOpacity\n                        onPress={async () => {\n                          // Verify code matches before accepting";
const c=s.split(A).length-1;
if(c!==1){console.error('count='+c+' - trying single-line');
  const A2="onPress={() => {\n                          // Verify code matches before accepting";
  const B2="onPress={async () => {\n                          // Verify code matches before accepting";
  const c2=s.split(A2).length-1;
  if(c2!==1){console.error('single-line count='+c2+' abort');process.exit(1);}
  fs.writeFileSync(F+'.bak_async',O);fs.writeFileSync(F,s.replace(A2,B2));console.log('ok (single-line)');process.exit(0);
}
fs.writeFileSync(F+'.bak_async',O);fs.writeFileSync(F,s.replace(A,B));console.log('ok');
