const fs=require('fs');let q=fs.readFileSync('QRPayNearby.tsx','utf8');
q=q.replace("const [showIOUSheet, setShowIOUSheet] = useState(false);","const [showIOUSheet, setShowIOUSheet] = useState(false);\n  const [requestAmount, setRequestAmount] = useState('');");
q=q.replace("bleUUID: '6b617376-696c-6c61-6765-000000000001',","bleUUID: '6b617376-696c-6c61-6765-000000000001',\n    requestAmountKAS: parseFloat(requestAmount) || 0,");
q=q.replace("interface QRPayload {","interface QRPayload {\n  requestAmountKAS?: number;");
q=q.replace("{mode === 'ble_receive' && (\n          <View style={{ alignItems: 'center' }}>","{mode === 'ble_receive' && (\n          <View style={{ alignItems: 'center' }}>\n            <TextInput value={requestAmount} onChangeText={setRequestAmount} placeholder=\"Request amount (KAS) — optional\" placeholderTextColor=\"#666\" keyboardType=\"decimal-pad\" style={{ width: '100%', backgroundColor: '#1A1A2E', color: '#FFF', borderRadius: rs(10), padding: rs(12), marginBottom: rs(10), borderWidth: 1, borderColor: '#333' }} />");
fs.writeFileSync('QRPayNearby.tsx',q);console.log('done');
