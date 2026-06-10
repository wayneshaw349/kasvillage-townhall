const fs = require("fs");
let s = fs.readFileSync("QRPayNearby.tsx", "utf8");
let fixes = 0;

// Remove QRCode import
if (s.includes("import QRCode from 'react-native-qrcode-svg';")) {
  s = s.replace("import QRCode from 'react-native-qrcode-svg';\n", "");
  fixes++;
  console.log("  → QRCode import removed");
}

// Change mode type
if (s.includes("'receive' | 'send' |")) {
  s = s.replace(
    "type Mode = 'choose' | 'receive' | 'send' | 'ble_send' | 'ble_receive';",
    "type Mode = 'choose' | 'ble_send' | 'ble_receive';"
  );
  fixes++;
  console.log("  → Mode type updated");
}

// Remove QR Receive card
const recvCard = `<TouchableOpacity style={styles.modeCard} onPress={() => setMode('receive')}>`;
if (s.includes(recvCard)) {
  const start = s.indexOf(recvCard);
  const end = s.indexOf("</TouchableOpacity>", start) + "</TouchableOpacity>".length;
  s = s.slice(0, start) + s.slice(end);
  fixes++;
  console.log("  → QR Receive card removed");
}

// Remove QR Send card
const sendCard = `<TouchableOpacity style={styles.modeCard} onPress={() => setMode('send')}>`;
if (s.includes(sendCard)) {
  const start = s.indexOf(sendCard);
  const end = s.indexOf("</TouchableOpacity>", start) + "</TouchableOpacity>".length;
  s = s.slice(0, start) + s.slice(end);
  fixes++;
  console.log("  → QR Send card removed");
}

// Update BLE section header
s = s.replace(
  "Or use Bluetooth (same platform only)",
  "Connect with nearby users"
);

// Remove RECEIVE MODE QR block
const recvModeStart = s.indexOf("{/* RECEIVE MODE — Show QR */}");
const recvModeEnd = s.indexOf("{/* SEND MODE");
if (recvModeStart > -1 && recvModeEnd > -1) {
  s = s.slice(0, recvModeStart) + s.slice(recvModeEnd);
  fixes++;
  console.log("  → QR Receive mode block removed");
}

// Remove SEND MODE paste block
const sendModeStart = s.indexOf("{/* SEND MODE — Paste/Scan */}");
const sendModeEnd = s.indexOf("{/* BLE RECEIVE");
if (sendModeStart > -1 && sendModeEnd > -1) {
  s = s.slice(0, sendModeStart) + s.slice(sendModeEnd);
  fixes++;
  console.log("  → QR Send mode block removed");
}

fs.writeFileSync("QRPayNearby.tsx", s, "utf8");
console.log(`done: ${fixes} changes — QR removed, BLE + hotspot kept`);
