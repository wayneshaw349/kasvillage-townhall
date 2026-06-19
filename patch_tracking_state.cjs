const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
const target = "const [sellerResponseB64, setSellerResponseB64] = useState('');";
const stateDecl = "const [sellerTrackingNum, setSellerTrackingNum] = useState('');";
if (!c.includes(stateDecl)) {
  c = c.replace(target, target + "\n  " + stateDecl);
  console.log('Added sellerTrackingNum useState');
} else {
  console.log('Already exists');
}
fs.writeFileSync('NeighborAgreement.tsx', c);
