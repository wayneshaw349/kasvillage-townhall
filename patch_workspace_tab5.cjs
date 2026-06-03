const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');
let changes = 0;

// === 1: Import SDK scanner functions ===
if (!s.includes('scanDAppCode')) {
  // Add import after the existing procedural background import
  s = s.replace(
    "import { ProceduralBackground } from './expo_procedural_backgrounds';",
    `import { ProceduralBackground } from './expo_procedural_backgrounds';
import { scanDAppCode, prepareDAppRegistration, SDK_VERSION, SDK_TEMPLATE_HASH, kvFetch } from './procedural_sdk';`
  );
  changes++; console.log('1: Imported SDK scanner');
}

// === 2: Replace the Quality Gate Modal with real SDK-wired version ===
// Find and replace the QualityGateModal component
const oldQGStart = "const QualityGateModal: React.FC<QualityGateModalProps> = ({ visible, onClose, onVerified, userXp = 0 }) => {";
const oldQGEnd = "const qgStyles = StyleSheet.create({";

const si = s.indexOf(oldQGStart);
const ei = s.indexOf(oldQGEnd);

if (si >= 0 && ei > si) {
  const newQualityGate = `const QualityGateModal: React.FC<QualityGateModalProps> = ({ visible, onClose, onVerified, userXp = 0 }) => {
  const [step, setStep] = useState(1);
  const [isChecking, setIsChecking] = useState(false);
  const [pastedCode, setPastedCode] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [manifest, setManifest] = useState({
    name: '',
    gameUrl: 'https://',
    category: 'GameRPG',
    description: '',
    stakeAmount: 100,
    customDomains: '',
  });
  
  const hasProhibitedContent = containsRestrictedContent(manifest.name) || 
                               containsRestrictedContent(manifest.description) ||
                               PROHIBITED_CATEGORIES.includes(manifest.category);

  // Run real SDK scanner on pasted code
  const runCodeScan = () => {
    if (!pastedCode || pastedCode.length < 20) {
      Alert.alert('No Code', 'Paste your DApp code to scan');
      return;
    }
    setIsChecking(true);
    try {
      const customDomains = manifest.customDomains.split(',').map(d => d.trim()).filter(Boolean);
      const result = scanDAppCode(pastedCode, customDomains);
      setScanResult(result);
      console.log('[SDK-Scan]', result.passed ? 'PASSED' : 'FAILED', 
        'violations:', result.violations.length, 
        'warnings:', result.warnings.length,
        'lines:', result.stats.linesScanned);
    } catch (e) {
      Alert.alert('Scan Error', String(e));
    }
    setIsChecking(false);
  };

  const canProceed = scanResult?.passed && !hasProhibitedContent && manifest.name.length > 0;
  
  const getProjectedBoard = () => {
    if (manifest.stakeAmount >= 500) return { name: 'ELITE BOARD', color: COLORS.purple600 };
    if (manifest.stakeAmount >= 100) return { name: 'MAIN BOARD', color: COLORS.green600 };
    return { name: 'INCUBATOR', color: COLORS.amber600 };
  };
  const board = getProjectedBoard();
  
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={qgStyles.overlay}>
        <View style={qgStyles.modal}>
          <View style={qgStyles.header}>
            <View>
              <View style={qgStyles.headerTitle}>
                <ShieldCheck size={rs.s(20)} color={COLORS.amber500} />
                <Text style={qgStyles.headerText}>DApp Quality Gate</Text>
              </View>
              <Text style={qgStyles.headerSubtext}>SDK v{SDK_VERSION} • Step {step} of 3</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={rs.s(24)} color={COLORS.stone500} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={qgStyles.content}>
            {step === 1 && (
              <View style={qgStyles.stepContent}>
                <InputField label="App Name" value={manifest.name} onChangeText={(text) => setManifest({ ...manifest, name: text })} placeholder="e.g. Kaspa Quest" />
                
                <Text style={inputStyles.label}>Category</Text>
                <View style={qgStyles.categoryRow}>
                  {['GameRPG', 'GameStrategy', 'UtilityTool'].map(cat => (
                    <TouchableOpacity key={cat} style={[qgStyles.categoryBtn, manifest.category === cat && qgStyles.categoryBtnActive]} onPress={() => setManifest({ ...manifest, category: cat })}>
                      <Text style={[qgStyles.categoryText, manifest.category === cat && qgStyles.categoryTextActive]}>{cat.replace('Game', '').replace('Utility', '')}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                {hasProhibitedContent && (
                  <View style={qgStyles.prohibitedBox}>
                    <View style={qgStyles.prohibitedHeader}><Ban size={rs.s(20)} color={COLORS.red600} /><Text style={qgStyles.prohibitedTitle}>Prohibited Content</Text></View>
                    <Text style={qgStyles.prohibitedText}>Name or description contains restricted terms.</Text>
                  </View>
                )}

                <InputField label="Custom API Domains (comma-separated)" value={manifest.customDomains} onChangeText={(text) => setManifest({ ...manifest, customDomains: text })} placeholder="api.mygame.com, ws.mygame.com" note="Domains your DApp needs beyond the default whitelist" />

                {/* Code Paste + SDK Scan */}
                <View style={{ backgroundColor: COLORS.stone50, borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(16), borderWidth: 1, borderColor: COLORS.stone200 }}>
                  <Text style={{ fontSize: rs.font(12), fontWeight: 'bold', color: COLORS.stone800, marginBottom: rs.s(6) }}>📋 Paste DApp Code for SDK Scan</Text>
                  <Text style={{ fontSize: rs.font(10), color: COLORS.stone500, marginBottom: rs.s(8) }}>
                    The SDK scanner checks for image uploads, realistic faces, eval(), iframes, and {IMAGE_BYPASS_PATTERNS.length}+ violation patterns.
                  </Text>
                  <TextInput
                    style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.stone300, borderRadius: rs.s(8), padding: rs.s(10), fontSize: rs.font(10), fontFamily: 'monospace', color: COLORS.stone700, minHeight: rs.s(120), textAlignVertical: 'top' }}
                    value={pastedCode}
                    onChangeText={setPastedCode}
                    placeholder="Paste your full DApp source code here..."
                    placeholderTextColor={COLORS.stone400}
                    multiline
                  />
                  <Text style={{ fontSize: rs.font(9), color: COLORS.stone400, marginTop: 4 }}>{pastedCode.length} chars • {pastedCode.split('\\n').length} lines</Text>
                  
                  <TouchableOpacity
                    style={{ backgroundColor: pastedCode.length > 20 ? COLORS.indigo600 : COLORS.stone300, borderRadius: rs.s(10), paddingVertical: rs.s(12), alignItems: 'center', marginTop: rs.s(8), flexDirection: 'row', justifyContent: 'center', gap: rs.s(8) }}
                    onPress={runCodeScan}
                    disabled={isChecking || pastedCode.length < 20}
                  >
                    {isChecking ? <ActivityIndicator color="#fff" size="small" /> : <ShieldCheck size={rs.s(16)} color="#fff" />}
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(13) }}>{isChecking ? 'Scanning...' : 'Run SDK Scanner'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Scan Results */}
                {scanResult && (
                  <View style={{ backgroundColor: scanResult.passed ? COLORS.green50 : COLORS.red50, borderRadius: rs.s(12), padding: rs.s(14), marginBottom: rs.s(16), borderWidth: 2, borderColor: scanResult.passed ? COLORS.green500 : COLORS.red500 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs.s(8), marginBottom: rs.s(8) }}>
                      {scanResult.passed ? <ShieldCheck size={rs.s(20)} color={COLORS.green600} /> : <Ban size={rs.s(20)} color={COLORS.red600} />}
                      <Text style={{ fontSize: rs.font(16), fontWeight: '900', color: scanResult.passed ? COLORS.green800 : COLORS.red800 }}>
                        {scanResult.passed ? 'SCAN PASSED ✓' : 'SCAN FAILED ✗'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: rs.font(11), color: COLORS.stone600, marginBottom: rs.s(6) }}>
                      {scanResult.stats.linesScanned} lines scanned • {scanResult.stats.patternsChecked} patterns checked • {scanResult.stats.whitelistApplied} whitelisted
                    </Text>
                    
                    {scanResult.violations.length > 0 && (
                      <View style={{ marginTop: rs.s(4) }}>
                        <Text style={{ fontSize: rs.font(11), fontWeight: 'bold', color: COLORS.red800, marginBottom: 4 }}>Violations ({scanResult.violations.length}):</Text>
                        {scanResult.violations.slice(0, 10).map((v: any, i: number) => (
                          <View key={i} style={{ backgroundColor: '#fff', borderRadius: 6, padding: 8, marginBottom: 4 }}>
                            <Text style={{ fontSize: rs.font(10), fontWeight: 'bold', color: COLORS.red700 }}>Line {v.line}: {v.pattern}</Text>
                            <Text style={{ fontSize: rs.font(9), fontFamily: 'monospace', color: COLORS.stone500 }} numberOfLines={1}>{v.code}</Text>
                            <Text style={{ fontSize: rs.font(8), color: v.severity === 'critical' ? COLORS.red600 : COLORS.amber600 }}>Severity: {v.severity}</Text>
                          </View>
                        ))}
                        {scanResult.violations.length > 10 && <Text style={{ fontSize: rs.font(10), color: COLORS.red600 }}>...and {scanResult.violations.length - 10} more</Text>}
                      </View>
                    )}
                    
                    {scanResult.warnings.length > 0 && (
                      <View style={{ marginTop: rs.s(8) }}>
                        <Text style={{ fontSize: rs.font(11), fontWeight: 'bold', color: COLORS.amber800 }}>Warnings ({scanResult.warnings.length}):</Text>
                        {scanResult.warnings.slice(0, 5).map((w: any, i: number) => (
                          <Text key={i} style={{ fontSize: rs.font(9), color: COLORS.amber700, marginTop: 2 }}>⚠ Line {w.line}: {w.note}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                )}
                
                <TouchableOpacity
                  style={[qgStyles.proceedBtn, !canProceed && qgStyles.proceedBtnDisabled]}
                  onPress={() => setStep(2)}
                  disabled={!canProceed}
                >
                  <Text style={qgStyles.proceedBtnText}>{!scanResult ? 'Scan Code First' : !scanResult.passed ? 'Fix Violations to Continue' : 'Continue to XP Stake'}</Text>
                  <ChevronRight size={rs.s(18)} color={COLORS.white} />
                </TouchableOpacity>
                
                {!scanResult && (
                  <Text style={{ fontSize: rs.font(10), color: COLORS.stone400, textAlign: 'center', marginTop: rs.s(8) }}>
                    DApps are NOT visible in KasVillage unless they pass the SDK scan
                  </Text>
                )}
              </View>
            )}
            
            {step === 2 && (
              <View style={qgStyles.stepContent}>
                <Text style={qgStyles.stepTitle}>Commit XP Reputation</Text>
                <Text style={qgStyles.stepSubtitle}>Higher commitment = better board placement</Text>
                
                <View style={qgStyles.xpBox}>
                  <Text style={qgStyles.xpLabel}>XP Commitment</Text>
                  <Text style={qgStyles.xpValue}>{manifest.stakeAmount * 10} XP</Text>
                  <View style={qgStyles.xpButtons}>
                    {[50, 100, 250, 500].map(val => (
                      <TouchableOpacity key={val} style={[qgStyles.xpBtn, manifest.stakeAmount === val && qgStyles.xpBtnActive]} onPress={() => setManifest({ ...manifest, stakeAmount: val })}>
                        <Text style={[qgStyles.xpBtnText, manifest.stakeAmount === val && qgStyles.xpBtnTextActive]}>{val * 10}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                
                <View style={[qgStyles.boardPreview, { borderColor: board.color }]}>
                  <Text style={[qgStyles.boardName, { color: board.color }]}>{board.name}</Text>
                  <Text style={qgStyles.boardDesc}>
                    {manifest.stakeAmount >= 500 ? 'Premium placement, highest visibility' : manifest.stakeAmount >= 100 ? 'Verified apps, good visibility' : 'Testing/beta apps, limited visibility'}
                  </Text>
                </View>
                
                <View style={qgStyles.buttonRow}>
                  <TouchableOpacity style={qgStyles.backBtn} onPress={() => setStep(1)}><Text style={qgStyles.backBtnText}>← Back</Text></TouchableOpacity>
                  <TouchableOpacity style={qgStyles.stakeBtn} onPress={async () => {
                    try {
                      // Prepare registration with real code hash
                      const myPubkey = await SecureStore.getItemAsync('kv_public_key') || '';
                      const reg = prepareDAppRegistration(pastedCode, SDK_TEMPLATE_HASH, myPubkey, 'DAPP_' + Date.now(), manifest.customDomains.split(',').map(d => d.trim()).filter(Boolean));
                      console.log('[DApp-Reg] Hash:', reg.codeHash, 'SDK:', reg.sdkHash, 'passed:', reg.scanResult.passed);
                      // Inscribe to Arweave
                      try {
                        const { uploadToIrys } = await import('./arweave_upload');
                        await uploadToIrys(JSON.stringify({ ...reg, name: manifest.name, category: manifest.category, description: manifest.description, board: board.name, xpStake: manifest.stakeAmount * 10 }), [
                          { name: 'App-Name', value: 'KasVillage' },
                          { name: 'KV-Type', value: 'DApp' },
                          { name: 'KV-DAppName', value: manifest.name },
                          { name: 'KV-Category', value: manifest.category },
                          { name: 'KV-CodeHash', value: reg.codeHash },
                          { name: 'KV-SDKHash', value: reg.sdkHash },
                          { name: 'KV-Board', value: board.name },
                          { name: 'KV-Owner', value: myPubkey },
                          { name: 'Content-Type', value: 'application/json' },
                        ]);
                        console.log('[DApp-Reg] Inscribed to Arweave');
                      } catch (e) { console.warn('[DApp-Reg] Arweave failed (local only):', e); }
                      Alert.alert('XP Committed', manifest.stakeAmount * 10 + ' XP locked for ' + manifest.name);
                      setStep(3);
                    } catch (e) { Alert.alert('Error', String(e)); }
                  }}><Text style={qgStyles.stakeBtnText}>Commit & Publish</Text></TouchableOpacity>
                </View>
              </View>
            )}
            
            {step === 3 && (
              <View style={qgStyles.stepContent}>
                <View style={qgStyles.successIcon}><ShieldCheck size={rs.s(48)} color={COLORS.green600} /></View>
                <Text style={qgStyles.successTitle}>DApp Verified & Published!</Text>
                <Text style={qgStyles.successSubtitle}>"{manifest.name}" is now live on the {board.name}</Text>
                <View style={{ backgroundColor: COLORS.stone50, borderRadius: rs.s(10), padding: rs.s(12), marginBottom: rs.s(16) }}>
                  <Text style={{ fontSize: rs.font(10), color: COLORS.stone600 }}>SDK Version: {SDK_VERSION}</Text>
                  <Text style={{ fontSize: rs.font(10), color: COLORS.stone600 }}>Lines Scanned: {scanResult?.stats?.linesScanned || 0}</Text>
                  <Text style={{ fontSize: rs.font(10), color: COLORS.stone600 }}>Violations: 0</Text>
                  <Text style={{ fontSize: rs.font(10), color: COLORS.stone600 }}>Code Hash: on Arweave</Text>
                  <Text style={{ fontSize: rs.font(10), color: COLORS.green600, fontWeight: 'bold', marginTop: 4 }}>✓ Periodic re-scan enabled via TownHall</Text>
                </View>
                <TouchableOpacity style={qgStyles.doneBtn} onPress={() => { onVerified({ ...manifest, scanResult }); onClose(); }}><Text style={qgStyles.doneBtnText}>Done</Text></TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

`;

  s = s.slice(0, si) + newQualityGate + s.slice(ei);
  changes++; console.log('2: Replaced Quality Gate with SDK-wired version');
} else {
  console.log('2: WARN - Quality Gate boundaries not found');
}

fs.writeFileSync(f, s);
console.log('\nTotal changes:', changes);

const v = fs.readFileSync(f, 'utf8');
console.log('Verify - scanDAppCode import:', v.includes("from './procedural_sdk'"));
console.log('Verify - runCodeScan:', v.includes('runCodeScan'));
console.log('Verify - scanResult display:', v.includes('SCAN PASSED'));
console.log('Verify - violations list:', v.includes('scanResult.violations'));
console.log('Verify - prepareDAppRegistration:', v.includes('prepareDAppRegistration'));
console.log('Verify - Arweave inscription:', v.includes("KV-Type', value: 'DApp'"));
console.log('Verify - SDK_VERSION:', v.includes('SDK_VERSION'));
console.log('Verify - not visible note:', v.includes('NOT visible'));
