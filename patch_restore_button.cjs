const fs=require('fs');
const F='ProfileScreen.tsx';
let s=fs.readFileSync(F,'utf8');
if(s.includes('onNavigateVaultRestore')){console.log('already patched');process.exit(0);}
fs.writeFileSync(F+'.bak_restorebtn',s);
let fails=0;
function apply(name,anchor,repl){
  const c=s.split(anchor).length-1;
  if(c!==1){console.error('SKIP '+name+' anchor count '+c);fails++;return;}
  s=s.replace(anchor,repl);
  console.log('ok '+name);
}

// 1. prop in signature (both type and destructure, single anchor covering both)
apply('prop-type',
'onNavigateVaultBackup?: () => void }>',
'onNavigateVaultBackup?: () => void; onNavigateVaultRestore?: () => void }>');
apply('prop-destructure',
'onNavigateBookshelf, onNavigateVaultBackup }) =>',
'onNavigateBookshelf, onNavigateVaultBackup, onNavigateVaultRestore }) =>');

// 2. button after Vault Backup TouchableOpacity close (line 714 context)
apply('button',
`              <Text style={styles.seedExportSub}>Split your seed into 2-of-4 recovery cards</Text>
            </View>
          </TouchableOpacity>`,
`              <Text style={styles.seedExportSub}>Split your seed into 2-of-4 recovery cards</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.seedExportButton}
            onPress={() => onNavigateVaultRestore?.()}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.seedExportText}>Restore from Cards</Text>
              <Text style={styles.seedExportSub}>Scan 2 backup cards to load a wallet or vault key</Text>
            </View>
          </TouchableOpacity>`);

if(fails>0){
  // CRLF retry for the multi-line button anchor
  const a=`              <Text style={styles.seedExportSub}>Split your seed into 2-of-4 recovery cards</Text>\r
            </View>\r
          </TouchableOpacity>`;
  if(s.split(a).length-1===1 && !s.includes('Restore from Cards')){
    const r=a+`\r
          <TouchableOpacity\r
            style={styles.seedExportButton}\r
            onPress={() => onNavigateVaultRestore?.()}\r
          >\r
            <View style={{ flex: 1 }}>\r
              <Text style={styles.seedExportText}>Restore from Cards</Text>\r
              <Text style={styles.seedExportSub}>Scan 2 backup cards to load a wallet or vault key</Text>\r
            </View>\r
          </TouchableOpacity>`;
    s=s.replace(a,r);
    console.log('ok button (crlf)');
    fails--;
  }
}
if(fails>0){console.error('restoring bak');fs.writeFileSync(F,fs.readFileSync(F+'.bak_restorebtn','utf8'));process.exit(1);}
if(!s.includes('Restore from Cards')){console.error('post-check failed - restoring');fs.writeFileSync(F,fs.readFileSync(F+'.bak_restorebtn','utf8'));process.exit(1);}
fs.writeFileSync(F,s);
console.log('patched ok');
