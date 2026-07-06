const fs=require('fs');let s=fs.readFileSync('IOUBalanceSheetShare.tsx','utf8');

// Replace the empty state with full flow UI
s=s.replace(/<><Text style=\{styles\.empty\}>No IOUs yet<\/Text>/,`<><Text style={styles.empty}>No IOUs yet</Text>
            <Text style={{ color: '#888', fontSize: 12, marginTop: 8, textAlign: 'center' }}>Create a FROST 2-of-2 collateral wallet with your counterparty, then issue IOUs backed by locked KAS.</Text>`);

// Add FROST address input section before New IOU buttons
s=s.replace(/<View style=\{\{ flexDirection: 'row', gap: 12, marginTop: 16 \}\}>/,`{/* FROST Address Input */}
            <View style={{ marginTop: 16, backgroundColor: '#1a1a2e', borderRadius: 10, padding: 14 }}>
              <Text style={{ color: '#D4AF37', fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>FROST 2-of-2 Collateral</Text>
              <Text style={{ color: '#888', fontSize: 11, marginBottom: 8 }}>Enter your shared FROST escrow address to track collateral and issue IOUs.</Text>
              <TextInput value={frostAddr} onChangeText={setFrostAddr} placeholder="kaspa:... or kaspatest:..." placeholderTextColor="#555" style={{ backgroundColor: '#0a0a0a', color: '#fff', padding: 10, borderRadius: 8, fontSize: 13, borderWidth: 1, borderColor: '#333', fontFamily: 'monospace' }} />
              <Text style={{ color: '#888', fontSize: 11, marginTop: 10, marginBottom: 4 }}>Counterparty Pubkey or APT</Text>
              <TextInput value={counterpartyInput} onChangeText={setCounterpartyInput} placeholder="02... or APT-XXXX" placeholderTextColor="#555" style={{ backgroundColor: '#0a0a0a', color: '#fff', padding: 10, borderRadius: 8, fontSize: 13, borderWidth: 1, borderColor: '#333', fontFamily: 'monospace' }} />
              {frostAddr ? (
                <TouchableOpacity onPress={async () => { try { const { getBalance } = await import('./kaspa_unified'); const bal = await getBalance(frostAddr); setFrostBalance(bal); } catch(e:any) { Alert.alert('Error', e.message); } }} style={{ marginTop: 10, backgroundColor: '#49d6aa20', padding: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#49d6aa' }}>
                  <Text style={{ color: '#49d6aa', fontWeight: '600', fontSize: 13 }}>Check Collateral Balance</Text>
                </TouchableOpacity>
              ) : null}
              {frostBalance > 0n && (
                <Text style={{ color: '#49d6aa', fontSize: 14, fontWeight: 'bold', marginTop: 8, textAlign: 'center' }}>Locked: {(Number(frostBalance) / 1e8).toFixed(4)} KAS</Text>
              )}
            </View>

            {/* Active IOUs */}
            <TouchableOpacity onPress={() => setShowActive(!showActive)} style={{ marginTop: 12, backgroundColor: '#1a1a2e', padding: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#D4AF37', fontWeight: 'bold', fontSize: 13 }}>Active IOUs</Text>
              <Text style={{ color: '#888', fontSize: 12 }}>{showActive ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
            {showActive && (
              <View style={{ backgroundColor: '#0a0a0a', borderRadius: 8, padding: 10, marginTop: 4 }}>
                <Text style={{ color: '#888', fontSize: 12, textAlign: 'center' }}>No active IOUs — create one below</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>`);

fs.writeFileSync('IOUBalanceSheetShare.tsx',s);console.log('done');
