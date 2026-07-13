const fs=require('fs');
// --- auto-release stale holds every wallet-state refresh ---
let i=fs.readFileSync('IOUBalanceSheetShare.tsx','utf8');
i=i.replace("export async function getWalletState(address: string): Promise<WalletState> {","export async function getWalletState(address: string): Promise<WalletState> {\n  try { await releaseStaleAllocations(); } catch {}");
fs.writeFileSync('IOUBalanceSheetShare.tsx',i);
// --- QRPayNearby choose-screen revamp ---
let q=fs.readFileSync('QRPayNearby.tsx','utf8');
const a=q.indexOf("{/* Text/DM Proposal */}");
const b=q.indexOf("{/* Bluetooth Option */}");
if(a<0||b<0){console.log('ANCHOR FAIL');process.exit(1);}
q=q.slice(0,a)+q.slice(b);
q=q.replace("<Text style={{ color: '#666', fontSize: rs(11), textAlign: 'center', marginBottom: rs(8) }}>Connect with nearby users</Text>","<Text style={{ color: '#666', fontSize: rs(11), textAlign: 'center', marginBottom: rs(8) }}>Pair via QR + Bluetooth — works iPhone & Android</Text>");
q=q.replace(">ðŸ“¶ BLE Receive</Text>",">ðŸ“· Request (show QR)</Text>");
q=q.replace(">ðŸ“¶ BLE Send</Text>",">ðŸ“¤ Send (scan QR)</Text>");
// IOU button after BLE row
q=q.replace("</View>\n            </View>\n\n            {/* Hotspot Info */}","</View>\n              <TouchableOpacity style={{ marginTop: rs(8), backgroundColor: '#1A1A2E', borderRadius: rs(12), padding: rs(14), alignItems: 'center', borderWidth: 1, borderColor: '#D4AF37' }} onPress={() => setShowIOUSheet(true)}>\n                <Text style={{ color: '#D4AF37', fontSize: rs(13), fontWeight: '600' }}>ðŸ“’ IOU Balance Sheet</Text>\n              </TouchableOpacity>\n            </View>\n\n            {/* Hotspot Info */}");
q=q.replace("const [mode, setMode] = useState<Mode>('choose');","const [mode, setMode] = useState<Mode>('choose');\n  const [showIOUSheet, setShowIOUSheet] = useState(false);");
fs.writeFileSync('QRPayNearby.tsx',q);console.log('done');
