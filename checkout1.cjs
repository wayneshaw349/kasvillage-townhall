const fs=require('fs');let q=fs.readFileSync('QRPayNearby.tsx','utf8');
// Add expo-camera import
q=q.replace("import QRCode from 'react-native-qrcode-svg';","import QRCode from 'react-native-qrcode-svg';\nimport { CameraView, useCameraPermissions } from 'expo-camera';\nimport { sha256 } from '@noble/hashes/sha256';");
// Add shop+verify to Mode type
q=q.replace("| 'tally' | 'catalog';","| 'tally' | 'catalog' | 'shop' | 'verify';");
// Add state after removeFromCart
q=q.replace("const removeFromCart = (id: string) =>","const [cameraActive, setCameraActive] = useState(false);\n  const [receiptQR, setReceiptQR] = useState('');\n  const [receiptItems, setReceiptItems] = useState<CartLine[]>([]);\n  const [verifyResult, setVerifyResult] = useState<'valid'|'invalid'|null>(null);\n  const [scannedReceipt, setScannedReceipt] = useState<any>(null);\n  const [cameraPermission, requestCameraPermission] = useCameraPermissions();\n  const bytesToHex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2,'0')).join('');\n  const buildReceiptHash = (lines: CartLine[], txId: string) => {\n    const canonical = JSON.stringify(lines.sort((a,b)=>a.item.id.localeCompare(b.item.id)).map(l=>({id:l.item.id,name:l.item.name,priceKas:l.item.priceKas,qty:l.qty})));\n    return bytesToHex(sha256(new TextEncoder().encode(canonical + txId)));\n  };\n  const removeFromCart = (id: string) =>");
fs.writeFileSync('QRPayNearby.tsx',q);console.log('patch1 done');
