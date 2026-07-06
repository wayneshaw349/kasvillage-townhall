const fs=require('fs');let s=fs.readFileSync('IOUBalanceSheetShare.tsx','utf8');s=s.replace("<Text style={styles.empty}>No IOUs yet</Text>",`<Text style={styles.empty}>No IOUs yet</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity onPress={() => setNewIOUMode('send')} style={{ flex: 1, backgroundColor: '#D4AF37', padding: 14, borderRadius: 10, alignItems: 'center' }}>
                <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 15 }}>New IOU</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setNewIOUMode('receive')} style={{ flex: 1, backgroundColor: '#49d6aa20', padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#49d6aa' }}>
                <Text style={{ color: '#49d6aa', fontWeight: 'bold', fontSize: 15 }}>Receive IOU</Text>
              </TouchableOpacity>
            </View>
            {newIOUMode === 'send' && (
              <View style={{ marginTop: 16, backgroundColor: '#1a1a2e', borderRadius: 10, padding: 14 }}>
                <Text style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>Amount (KAS)</Text>
                <TextInput value={proposalAmount} onChangeText={setProposalAmount} placeholder="0.00" placeholderTextColor="#555" keyboardType="decimal-pad" style={{ backgroundColor: '#0a0a0a', color: '#fff', padding: 10, borderRadius: 8, fontSize: 16, borderWidth: 1, borderColor: '#333' }} />
                <Text style={{ color: '#888', fontSize: 12, marginTop: 10, marginBottom: 8 }}>Description</Text>
                <TextInput value={proposalDesc} onChangeText={setProposalDesc} placeholder="What's this for?" placeholderTextColor="#555" style={{ backgroundColor: '#0a0a0a', color: '#fff', padding: 10, borderRadius: 8, fontSize: 14, borderWidth: 1, borderColor: '#333' }} />
                <TouchableOpacity onPress={async () => { setProposalSending(true); try { const p = await createProposal(parseFloat(proposalAmount) * 1e8, proposalDesc); await shareProposal(p); } catch(e:any) { Alert.alert('Error', e.message); } setProposalSending(false); }} disabled={proposalSending || !proposalAmount} style={{ marginTop: 12, backgroundColor: '#D4AF37', padding: 12, borderRadius: 8, alignItems: 'center', opacity: proposalSending || !proposalAmount ? 0.5 : 1 }}>
                  <Text style={{ color: '#000', fontWeight: 'bold' }}>{proposalSending ? 'Creating...' : 'Create & Share'}</Text>
                </TouchableOpacity>
              </View>
            )}
            {newIOUMode === 'receive' && (
              <View style={{ marginTop: 16, backgroundColor: '#1a1a2e', borderRadius: 10, padding: 14 }}>
                <Text style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>Paste proposal from sender</Text>
                <TextInput value={pasteInput} onChangeText={setPasteInput} placeholder="Paste proposal here..." placeholderTextColor="#555" multiline style={{ backgroundColor: '#0a0a0a', color: '#fff', padding: 10, borderRadius: 8, fontSize: 12, borderWidth: 1, borderColor: '#333', minHeight: 80 }} />
                <TouchableOpacity onPress={async () => { try { const d = decodeProposal(pasteInput.trim()); const v = await verifyProposal(d); setIncomingProposal(d); setProposalVerified(v); } catch(e:any) { Alert.alert('Invalid', e.message); } }} disabled={!pasteInput.trim()} style={{ marginTop: 12, backgroundColor: '#49d6aa', padding: 12, borderRadius: 8, alignItems: 'center', opacity: !pasteInput.trim() ? 0.5 : 1 }}>
                  <Text style={{ color: '#000', fontWeight: 'bold' }}>Verify Proposal</Text>
                </TouchableOpacity>
                {incomingProposal && (
                  <View style={{ marginTop: 12, backgroundColor: '#0a0a0a', padding: 12, borderRadius: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 14 }}>Amount: {(incomingProposal.amountSompi / 1e8).toFixed(4)} KAS</Text>
                    <Text style={{ color: '#888', fontSize: 12 }}>From: {incomingProposal.senderPubkey?.slice(0,16)}...</Text>
                    <Text style={{ color: proposalVerified ? '#27AE60' : '#e74c3c', fontSize: 12, marginTop: 4 }}>{proposalVerified ? 'Verified' : 'INVALID'}</Text>
                    {proposalVerified && (
                      <TouchableOpacity onPress={async () => { try { const a = await acceptProposal(incomingProposal); await shareAcceptance(a); Alert.alert('Accepted', 'IOU accepted and shared'); } catch(e:any) { Alert.alert('Error', e.message); } }} style={{ marginTop: 8, backgroundColor: '#27AE60', padding: 10, borderRadius: 8, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Accept IOU</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}`);fs.writeFileSync('IOUBalanceSheetShare.tsx',s);console.log('done');
