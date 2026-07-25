const fs=require('fs');
const F='SendKAS.tsx';
let s=fs.readFileSync(F,'utf8');
if(s.includes('sendSource')){console.log('already patched');process.exit(0);}
fs.writeFileSync(F+'.bak_source',s);
let fails=0;
function apply(name,anchor,repl){
  const c=s.split(anchor).length-1;
  if(c!==1){console.error('SKIP '+name+' (anchor count '+c+')');fails++;return;}
  s=s.replace(anchor,repl);
  console.log('ok '+name);
}

// 1. import engine
apply('import',
'  sendKASWithHybridSig,',
'  sendKASWithHybridSig,\n  sendKASFromVault,');

// 2. state
apply('state',
"  const [vaultAddr, setVaultAddr] = useState<string | null>(null);",
"  const [vaultAddr, setVaultAddr] = useState<string | null>(null);\n  const [sendSource, setSendSource] = useState<'hot' | 'vault'>('hot');");

// 3. route handleSend
apply('route',
`      const result: TransactionResult = await sendKASWithHybridSig(
        resolved.address,
        amountSompi,
        memo || undefined
      );`,
`      const result: TransactionResult = sendSource === 'vault'
        ? await sendKASFromVault(resolved.address, amountSompi, memo || undefined)
        : await sendKASWithHybridSig(resolved.address, amountSompi, memo || undefined);`);

// 4. UI: Send From row above Send To
apply('ui',
'                <Text style={styles.inputLabel}>Send To</Text>',
`                <Text style={styles.inputLabel}>Send From</Text>
                <View style={styles.sendToChips}>
                  {([['hot', 'Hot Wallet'], ['vault', 'Vault']] as const).map(([src, label]) => (
                    (src === 'hot' || vaultAddr) ? (
                    <TouchableOpacity
                      key={src}
                      style={[styles.sendToChip, sendSource === src && { borderColor: '#49d6aa', backgroundColor: '#12241d' }]}
                      onPress={() => setSendSource(src)}
                    >
                      <Text style={[styles.sendToChipText, sendSource === src && { color: '#49d6aa', fontWeight: '700' }]}>
                        {label}{sendSource === src ? ' \\u2713' : ''}
                      </Text>
                    </TouchableOpacity>
                    ) : null
                  ))}
                </View>
                <Text style={styles.inputLabel}>Send To</Text>`);

if(fails>0){console.error(fails+' anchors failed - file written with partial patches? NO - restoring bak');fs.writeFileSync(F,fs.readFileSync(F+'.bak_source','utf8'));process.exit(1);}
fs.writeFileSync(F,s);
console.log('patched ok');
