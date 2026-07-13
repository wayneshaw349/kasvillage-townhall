const fs=require('fs');
// AppNaviagator: pass onNavigateSend into QRPayNearby
let a=fs.readFileSync('AppNaviagator.tsx','utf8');
a=a.replace("return <QRPayNearby onClose={() => setScreen('dashboard')} />;","return <QRPayNearby onClose={() => setScreen('dashboard')} onNavigateSend={(addr?: string, sompi?: number) => { (globalThis as any).__kvSendPrefill = { addr, sompi }; setScreen('send_kas'); }} />;");
// SendKAS render: read prefill
a=a.replace("        <SendKAS\n          visible={true}\n          onClose={() => setScreen('dashboard')}","        <SendKAS\n          visible={true}\n          initialAddress={(globalThis as any).__kvSendPrefill?.addr}\n          initialAmount={(globalThis as any).__kvSendPrefill?.sompi}\n          onClose={() => setScreen('dashboard')}");
fs.writeFileSync('AppNaviagator.tsx',a);
// QRPayNearby: add prop + route Send KAS button
let q=fs.readFileSync('QRPayNearby.tsx','utf8');
q=q.replace("export const QRPayNearby: React.FC<{ onClose: () => void }> = ({ onClose }) => {","export const QRPayNearby: React.FC<{ onClose: () => void; onNavigateSend?: (addr?: string, sompi?: number) => void }> = ({ onClose, onNavigateSend }) => {");
q=q.replace("onPress={() => { try { stopReceiving(); } catch {} setMode('send_proposal'); }}>\n                <Text style={{ color: '#000', fontWeight: '700', fontSize: rs(14) }}>Send KAS</Text>","onPress={() => { try { stopReceiving(); } catch {} const amt = parseFloat(requestAmount) || 0; onNavigateSend && onNavigateSend(resolvedAddress || undefined, amt > 0 ? Math.floor(amt * 1e8) : undefined); }}>\n                <Text style={{ color: '#000', fontWeight: '700', fontSize: rs(14) }}>Send KAS</Text>");
fs.writeFileSync('QRPayNearby.tsx',q);console.log('done');
