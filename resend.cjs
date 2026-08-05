const fs = require('fs');
const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');
if (s.includes('TEMPLATE-RESEND')) throw new Error('already patched - abort');

const AN = "<Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: '#166534', marginBottom: 4 }}>SELLER STEP 2";
const n = s.split(AN).length - 1;
if (n !== 1) throw new Error('anchor found ' + n + 'x (expected 1) - abort');

const BTN =
"{/* TEMPLATE-RESEND: stored refund+kill templates re-copyable after resume */}\n" +
"                  <TouchableOpacity onPress={async () => { try { const _agr = contract.agreementId || ''; const _b64 = await SecureStore.getItemAsync('kv_refund_b64_' + _agr); if (!_b64) { Alert.alert('No Templates Stored', 'Refund/kill templates were never generated on this device for this agreement. They are created when you (seller) accept and freeze collateral.'); return; } const _hdr = 'KV-STEP-2-TEMPLATES|' + _agr + '\\nKasVillage refund+kill templates. In Neighbor Agreement, paste ALL of this into the box titled \"Paste seller refund template\" (amber), co-sign, and send your signature back.\\n\\n' + _b64; await Clipboard.setStringAsync(_hdr); recordPayload(_agr, 'templates', _b64, 'out').catch(() => {}); Alert.alert('Templates Copied', 'Re-copied the stored refund+kill templates. Send to the buyer to co-sign.'); } catch (e: any) { Alert.alert('Error', e.message); } }} style={{ backgroundColor: '#f59e0b', borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 8 }}>\n" +
"                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Copy Refund/Kill Templates (resend)</Text>\n" +
"                  </TouchableOpacity>\n" +
"                  " + AN;

fs.writeFileSync(F + '.bak_resend', s);
s = s.replace(AN, BTN);
fs.writeFileSync(F, s);

const v = fs.readFileSync(F, 'utf8');
if (!v.includes('TEMPLATE-RESEND')) throw new Error('POST: marker missing');
if ((v.match(/kv_refund_b64_/g) || []).length < 3) throw new Error('POST: store read missing');
console.log('OK - template resend button on seller step-3 (.bak_resend)');
