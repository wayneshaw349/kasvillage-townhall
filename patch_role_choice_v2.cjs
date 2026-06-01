const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

// 1. Change alert title and message — remove auto-detected role line
const oldTitle = "Alert.alert('Confirm Role', 'Agreement: ' + entry.agrId.slice(0,12) + '\\nRole: ' + (entry.role === 'buyer' ? '\\u{1F6D2} BUYER' : '\\u{1F3EA} SELLER') + '\\nFROST: ' + (entry.frostAddr || '').slice(0,25) + '...' + '\\nBalance: ' + entry.buyerAmount + ' + ' + entry.sellerAmount + ' KAS' + '\\nStep: ' + entry.step, [";
const newTitle = "Alert.alert('Load Agreement', 'AGR: ' + entry.agrId.slice(0,12) + '\\nFROST: ' + (entry.frostAddr || '').slice(0,25) + '...' + '\\nBuyer: ' + entry.buyerAmount + ' / Seller: ' + entry.sellerAmount + ' KAS' + '\\nStep: ' + entry.step + '\\n\\nWhat is your role?', [";

if (!s.includes("Alert.alert('Confirm Role'")) {
  console.log('Confirm Role not found'); process.exit(1);
}

s = s.replace(
  "Alert.alert('Confirm Role', 'Agreement: ' + entry.agrId.slice(0,12) + '\\nRole: ' + (entry.role === \\'buyer\\' ? \\'🛒 BUYER\\' : \\'🏪 SELLER\\') + \\'\\nFROST: \\' + (entry.frostAddr || \\'\\').slice(0,25) + \\'...' + '\\nBalance: ' + entry.buyerAmount + ' + ' + entry.sellerAmount + ' KAS' + '\\nStep: ' + entry.step, [",
  "PLACEHOLDER"
);

// Simpler approach: use indexOf to find and splice
let s2 = fs.readFileSync(f, 'utf8');

// Find the Confirm Role alert
const confirmIdx = s2.indexOf("Alert.alert('Confirm Role'");
if (confirmIdx < 0) { console.log('Confirm Role not found'); process.exit(1); }

// Find the [ that starts the buttons array
const btnArrayStart = s2.indexOf(', [', confirmIdx);
// Find { text: 'Cancel' }
const cancelIdx = s2.indexOf("{ text: 'Cancel' }", btnArrayStart);
// Find { text: 'Load'
const loadIdx = s2.indexOf("{ text: 'Load'", cancelIdx);
if (loadIdx < 0) { console.log('Load button not found'); process.exit(1); }

// Replace "{ text: 'Load'" with "{ text: '🛒 Buyer'"
s2 = s2.slice(0, loadIdx) + "{ text: '🛒 Buyer'" + s2.slice(loadIdx + "{ text: 'Load'".length);

// Now find the setRole(entry.role) and replace with setRole('buyer')
const setRoleIdx = s2.indexOf("setRole(entry.role)", loadIdx);
if (setRoleIdx < 0) { console.log('setRole(entry.role) not found'); process.exit(1); }
s2 = s2.slice(0, setRoleIdx) + "setRole('buyer')" + s2.slice(setRoleIdx + "setRole(entry.role)".length);

// Find the closing of the Buyer button handler: setStep(entry.step);\n...}},
const setStepIdx = s2.indexOf("setStep(entry.step);", setRoleIdx);
// Find the }}, after it
const closeBuyerIdx = s2.indexOf('}},', setStepIdx);
if (closeBuyerIdx < 0) { console.log('Buyer close not found'); process.exit(1); }

// Insert Seller button after the }},
const sellerBtn = `
                              { text: '🏪 Seller', onPress: async () => {
                                await saveAgreementSession({ step: entry.step, role: 'seller', agreementType: 'trade', contract: { agreementId: entry.agrId, multisigAddress: entry.frostAddr, itemPriceKas: entry.buyerAmount, sellerCommitmentKas: entry.sellerAmount, buyerPubkey: entry.buyerPubkey, sellerPubkey: entry.sellerPubkey, itemDescription: entry.description, stipulations: '', expiryHours: 24 }, buyerLocked: entry.step >= 4, sellerLocked: entry.step >= 4, counterpartyAddress: null, counterpartyKaspaAddr: '', savedAt: Date.now() });
                                setRole('seller');
                                setAgreementType('trade');
                                setContract({
                                  agreementId: entry.agrId, multisigAddress: entry.frostAddr,
                                  itemPriceKas: entry.buyerAmount, sellerCommitmentKas: entry.sellerAmount,
                                  buyerPubkey: entry.buyerPubkey, sellerPubkey: entry.sellerPubkey,
                                  itemDescription: entry.description, stipulations: '', expiryHours: 24,
                                  frostData: entry.frostAddr ? { address: entry.frostAddr, network: 'testnet-10' } : undefined,
                                });
                                if (entry.step >= 4) { setBuyerLocked(true); setSellerLocked(true); }
                                setStep(entry.step);
                              }},`;

const insertAt = closeBuyerIdx + 3; // after }},
s2 = s2.slice(0, insertAt) + sellerBtn + s2.slice(insertAt);

// Also change the alert title
s2 = s2.replace(
  "Alert.alert('Confirm Role', 'Agreement: ' + entry.agrId.slice(0,12) + '\\nRole: ' + (entry.role === 'buyer' ? '🛒 BUYER' : '🏪 SELLER') + '\\nFROST: ' + (entry.frostAddr || '').slice(0,25) + '...' + '\\nBalance: ' + entry.buyerAmount + ' + ' + entry.sellerAmount + ' KAS' + '\\nStep: ' + entry.step",
  "Alert.alert('Load Agreement', 'AGR: ' + entry.agrId.slice(0,12) + '\\nFROST: ' + (entry.frostAddr || '').slice(0,25) + '...' + '\\nBuyer: ' + entry.buyerAmount + ' / Seller: ' + entry.sellerAmount + ' KAS\\nStep: ' + entry.step + '\\n\\nWhat is your role?'"
);

// Also fix the buyer button's saveAgreementSession to use role: 'buyer' instead of entry.role
s2 = s2.replace(
  "await saveAgreementSession({ step: entry.step, role: entry.role, agreementType: 'trade'",
  "await saveAgreementSession({ step: entry.step, role: 'buyer', agreementType: 'trade'"
);

fs.writeFileSync(f, s2);
console.log('Done: [Cancel] [🛒 Buyer] [🏪 Seller]');
console.log('Verify Buyer:', s2.includes("text: '🛒 Buyer'"));
console.log('Verify Seller:', s2.includes("text: '🏪 Seller'"));
console.log('Verify title:', s2.includes("Load Agreement"));
