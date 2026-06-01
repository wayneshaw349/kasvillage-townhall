const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

// Find the Confirm Role alert
const old = `Alert.alert('Confirm Role', 'Agreement: ' + entry.agrId.slice(0,12) + '\\nRole: ' + (entry.role === 'buyer' ? '🛒 BUYER' : '🏪 SELLER') + '\\nFROST: ' + (entry.frostAddr || '').slice(0,25) + '...' + '\\nBalance: ' + entry.buyerAmount + ' + ' + entry.sellerAmount + ' KAS' + '\\nStep: ' + entry.step`;

if (!s.includes(old)) { console.log('Anchor not found'); process.exit(1); }

const newAlert = `Alert.alert('Load Agreement', 'AGR: ' + entry.agrId.slice(0,12) + '\\nFROST: ' + (entry.frostAddr || '').slice(0,25) + '...' + '\\nBuyer: ' + entry.buyerAmount + ' / Seller: ' + entry.sellerAmount + ' KAS' + '\\nStep: ' + entry.step + '\\n\\nWhat is your role?'`;

s = s.replace(old, newAlert);

// Now replace the button options: Cancel + Load → Cancel + Buyer + Seller
const oldButtons = `{ text: 'Cancel' },
                              { text: 'Load', onPress: async () => {
                                // Save minimal session to restore
                                await saveAgreementSession({ step: entry.step, role: entry.role, agreementType: 'trade'`;

const newButtons = `{ text: 'Cancel' },
                              { text: '🛒 Buyer', onPress: async () => {
                                entry.role = 'buyer';
                                await saveAgreementSession({ step: entry.step, role: 'buyer', agreementType: 'trade'`;

if (!s.includes(oldButtons)) { console.log('Buttons anchor not found'); process.exit(1); }
s = s.replace(oldButtons, newButtons);

// Add Seller button after the buyer onPress closing
// Find the end of the Load/Buyer button handler and add Seller
const buyerCloseMarker = `setStep(entry.step);
                              }},`;
const idx = s.indexOf(buyerCloseMarker);
if (idx < 0) { console.log('Buyer close not found'); process.exit(1); }

const insertAt = idx + buyerCloseMarker.length;
const sellerButton = `
                              { text: '🏪 Seller', onPress: async () => {
                                entry.role = 'seller';
                                await saveAgreementSession({ step: entry.step, role: 'seller', agreementType: 'trade', contract: { agreementId: entry.agrId, multisigAddress: entry.frostAddr, itemPriceKas: entry.buyerAmount, sellerCommitmentKas: entry.sellerAmount, buyerPubkey: entry.buyerPubkey, sellerPubkey: entry.sellerPubkey, itemDescription: entry.description, stipulations: '', expiryHours: 24 }, buyerLocked: entry.step >= 4, sellerLocked: entry.step >= 4, counterpartyAddress: null, counterpartyKaspaAddr: '', savedAt: Date.now() });
                                setRole('seller');
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
                                if (entry.step >= 4) { setBuyerLocked(true); setSellerLocked(true); }
                                setStep(entry.step);
                              }},`;

s = s.slice(0, insertAt) + sellerButton + s.slice(insertAt);

fs.writeFileSync(f, s);
console.log('Done: buyer/seller choice buttons');
console.log('Verify Buyer btn:', s.includes("'🛒 Buyer'"));
console.log('Verify Seller btn:', s.includes("'🏪 Seller'"));
