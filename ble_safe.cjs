const fs=require('fs');let q=fs.readFileSync('QRPayNearby.tsx','utf8');
q=q.replace("onPress={() => { setMode('ble_receive'); startReceiving(address, avatarName); }}","onPress={() => { setMode('ble_receive'); try { startReceiving(address, avatarName); } catch(e) { console.warn('[BLE] Not available:', e); } }}");
q=q.replace("onPress={() => { setMode('ble_send'); startScanning(20000); }}","onPress={() => { setMode('ble_send'); try { startScanning(20000); } catch(e) { console.warn('[BLE] Not available:', e); } }}");
fs.writeFileSync('QRPayNearby.tsx',q);console.log('done');
