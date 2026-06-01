const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

// Find the Load onPress handler in Active Agreements
const anchor = "{ text: 'Load', onPress: async () => {";
const idx = s.indexOf(anchor);
if (idx < 0) { console.log('Anchor not found'); process.exit(1); }

if (s.includes('// FULL STATE RESTORE')) { console.log('Already patched'); process.exit(0); }

// Find the old setStep/setRole/setContract block
const blockStart = s.indexOf('setStep(entry.step)', idx);
const blockEnd = s.indexOf('}}', blockStart) + 2; // end of onPress + alert option

// Build the replacement
const oldBlock = s.slice(blockStart, s.indexOf('}},', blockStart) + 1);

const newBlock = `// FULL STATE RESTORE from Active Agreements
                                setRole(entry.role);
                                setAgreementType('trade');
                                setContract({
                                  agreementId: entry.agrId,
                                  multisigAddress: entry.frostAddr,
                                  itemPriceKas: entry.buyerAmount,
                                  sellerCommitmentKas: entry.sellerAmount,
                                  buyerPubkey: entry.buyerPubkey,
                                  sellerPubkey: entry.sellerPubkey,
                                  itemDescription: entry.description,
                                  stipulations: '',
                                  expiryHours: 24,
                                  frostData: entry.frostAddr ? { address: entry.frostAddr, network: 'testnet-10' } : undefined,
                                });
                                if (entry.step >= 4) {
                                  setBuyerLocked(true);
                                  setSellerLocked(true);
                                }
                                setStep(entry.step);`;

s = s.replace(oldBlock, newBlock);
fs.writeFileSync(f, s);
console.log('Fixed: full state restore on Active Agreement load');
console.log('Verify agreementType:', s.includes("setAgreementType('trade')"));
console.log('Verify frostData:', s.includes('frostData: entry.frostAddr'));
console.log('Verify locks:', s.includes('setBuyerLocked(true)'));
