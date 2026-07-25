const fs=require('fs');
const F='VaultBackupScreen.tsx';
let s=fs.readFileSync(F,'utf8');
if(s.includes('/* scroll-fix */')){console.log('already patched');process.exit(0);}
fs.writeFileSync(F+'.bak_scroll',s);

// 1. import ScrollView
const IMP=/import\s*\{([^}]*)\}\s*from\s*'react-native';/;
const m=s.match(IMP);
if(!m){console.error('import anchor abort');process.exit(1);}
if(!/ScrollView/.test(m[1])) s=s.replace(IMP,(w,g)=>w.replace('{'+g+'}','{'+g.replace(/\s*$/,'')+', ScrollView }').replace('} }','}'));
// safer explicit rebuild:
s=s.replace(IMP,(w)=>{
  if(/ScrollView/.test(w)) return w;
  return w.replace('}',', ScrollView }');
});

// 2. wrap body in ScrollView
const A='      <View style={styles.body}>';
if(s.split(A).length-1!==1){console.error('body anchor abort');process.exit(1);}
s=s.replace(A,'      {/* scroll-fix */}\n      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={true}>');

// 3. close it — find the matching close: last </View> before </SafeAreaView>
const B=/(\n\s*)<\/View>(\s*\n\s*<\/SafeAreaView>)/;
if(!B.test(s)){console.error('close anchor abort');process.exit(1);}
s=s.replace(B,'$1</ScrollView>$2');

if(!s.includes('<ScrollView contentContainerStyle')){console.error('post-check failed');process.exit(1);}
fs.writeFileSync(F,s);
console.log('patched ok');
