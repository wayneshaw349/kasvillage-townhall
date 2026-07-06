const fs=require('fs');let s=fs.readFileSync('IOUBalanceSheetShare.tsx','utf8');
if(!s.includes('frostAddr'))s=s.replace("const [newIOUMode, setNewIOUMode]","const [frostAddr, setFrostAddr] = useState('');\n  const [counterpartyInput, setCounterpartyInput] = useState('');\n  const [frostBalance, setFrostBalance] = useState(0n);\n  const [showActive, setShowActive] = useState(false);\n  const [newIOUMode, setNewIOUMode]");
fs.writeFileSync('IOUBalanceSheetShare.tsx',s);console.log('done');
