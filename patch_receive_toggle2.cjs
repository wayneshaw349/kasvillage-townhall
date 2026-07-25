const fs=require('fs');
const F='ReceiveScreen.tsx';
let s=fs.readFileSync(F,'utf8');
if(s.includes('recvSource')){console.log('already patched');process.exit(0);}
fs.writeFileSync(F+'.bak_recv',s);
let fails=0;
function ap(name,a,b){
  let A=a,B=b,c=s.split(A).length-1;
  if(c!==1){A=a.replace(/\n/g,'\r\n');B=b.replace(/\n/g,'\r\n');c=s.split(A).length-1;}
  if(c!==1){console.error('SKIP '+name+' count '+c);fails++;return;}
  s=s.replace(A,B);console.log('ok '+name);
}

// 1. state
ap('state',
"  const [address, setAddress] = useState<string | null>(myAddress || null);",
"  const [address, setAddress] = useState<string | null>(myAddress || null);\n  const [vaultAddr, setVaultAddr] = useState<string | null>(null);\n  const [recvSource, setRecvSource] = useState<'hot' | 'vault'>('hot');");

// 2. load vault address alongside hot
ap('load',
"      const addr = myAddress || await SecureStore.getItemAsync(SECURESTORE_KEYS.KASPA_ADDRESS);",
"      const addr = myAddress || await SecureStore.getItemAsync(SECURESTORE_KEYS.KASPA_ADDRESS);\n      try { setVaultAddr(await SecureStore.getItemAsync('kv_vault_address')); } catch {}");

// 3. displayed address follows toggle
ap('shown',
"  const shortAddress = address",
"  const shownAddress = recvSource === 'vault' ? (vaultAddr || address) : address;\n  const shortAddress = shownAddress");
ap('shown2',
"    ? address.slice(0, 20) + '...' + address.slice(-12)",
"    ? shownAddress.slice(0, 20) + '...' + shownAddress.slice(-12)");

// 4. copy/share/QR use shownAddress
ap('copy',
"    if (!address) return;\n    await Clipboard.setStringAsync(address);",
"    if (!shownAddress) return;\n    await Clipboard.setStringAsync(shownAddress);");
ap('share',
"    if (!address) return;\n    await Share.share({ message: `My Kaspa address: ${address}` });",
"    if (!shownAddress) return;\n    await Share.share({ message: `My Kaspa address: ${shownAddress}` });");
ap('qr',
"                  value={address}",
"                  value={shownAddress || address}");

// 5. toggle UI above the QR block
ap('toggle',
"      {address && (",
"      {vaultAddr ? (\n        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, justifyContent: 'center' }}>\n          {([['hot', 'Hot Wallet'], ['vault', 'Vault']] as const).map(([src, label]) => (\n            <TouchableOpacity\n              key={src}\n              onPress={() => setRecvSource(src)}\n              style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1,\n                borderColor: recvSource === src ? '#49d6aa' : '#333',\n                backgroundColor: recvSource === src ? '#12241d' : 'transparent' }}\n            >\n              <Text style={{ color: recvSource === src ? '#49d6aa' : '#AAA', fontWeight: recvSource === src ? '700' : '400' }}>\n                {label}\n              </Text>\n            </TouchableOpacity>\n          ))}\n        </View>\n      ) : null}\n      {address && (");

if(fails>0){console.error('restoring bak');fs.writeFileSync(F,fs.readFileSync(F+'.bak_recv','utf8'));process.exit(1);}
fs.writeFileSync(F,s);
console.log('patched ok');
