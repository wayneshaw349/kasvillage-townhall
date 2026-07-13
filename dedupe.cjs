const fs=require('fs');let q=fs.readFileSync('QRPayNearby.tsx','utf8');
q=q.replace("const [showIOUSheet, setShowIOUSheet] = useState(false);\n  const [requestAmount, setRequestAmount] = useState('');","const [showIOUSheet, setShowIOUSheet] = useState(false);");
fs.writeFileSync('QRPayNearby.tsx',q);console.log('done');
