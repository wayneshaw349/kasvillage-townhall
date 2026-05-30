const fs = require('fs');
let f = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
let fixes = 0;

// === FIX 1: Replace handleConfirmDelivery with simple step advancement ===
const hcdStart = f.indexOf('const handleConfirmDelivery = async ()');
if (hcdStart < 0) { console.log('handleConfirmDelivery not found'); process.exit(1); }

let depth = 0, inFunc = false, hcdEnd = -1;
for (let i = hcdStart; i < f.length; i++) {
  if (f[i] === '{') { depth++; inFunc = true; }
  if (f[i] === '}') { depth--; if (inFunc && depth === 0) { hcdEnd = i + 1; break; } }
}
// Consume trailing semicolon
let e = hcdEnd;
while (e < f.length && ' \n\r'.includes(f[e])) e++;
if (f[e] === ';') e++;

console.log('handleConfirmDelivery: line', f.substring(0, hcdStart).split('\n').length, '- size:', e - hcdStart);

const newHCD = `const handleConfirmDelivery = async () => {
    // CANONICAL: just advance to step 5 signing ceremony
    // No partial sig creation, no relay posting, no encryption
    // Step 5 has buildReleaseTemplate (buyer) and sellerSignTemplate (seller)
    Alert.alert(
      'Start Signing Ceremony',
      'Exchange TX template with seller via clipboard.\\nYour signing key (k) lives only during this process.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start', onPress: () => setStep(5) },
      ]
    );
  };`;

f = f.substring(0, hcdStart) + newHCD + f.substring(e);
fixes++;
console.log('FIX 1: handleConfirmDelivery replaced with step 5 advancement');

// === FIX 2: Disable PartialSig-Poll (old auto-cosign on step 4) ===
const pspMarker = "// Poll Arweave for counterparty's partial sig on step 4";
const pspIdx = f.indexOf(pspMarker);
if (pspIdx >= 0) {
  // Find the useEffect
  const useEffStart = f.lastIndexOf('useEffect', pspIdx);
  // Find closing "}, [" pattern
  let pspDepth = 0, pspEnd = -1;
  const pspBody = f.indexOf('{', useEffStart);
  for (let i = pspBody; i < f.length; i++) {
    if (f[i] === '{') pspDepth++;
    if (f[i] === '}') {
      pspDepth--;
      if (pspDepth === 0) {
        // Find end of useEffect: "}, [...]);"
        pspEnd = f.indexOf(';', i) + 1;
        break;
      }
    }
  }
  
  if (pspEnd > useEffStart) {
    const oldPSP = f.substring(useEffStart, pspEnd);
    const newPSP = `useEffect(() => {
    // DISABLED: PartialSig-Poll — old auto-cosign path
    // Seller now signs via canonical sellerSignTemplate at step 5 (clipboard)
    if (step === 4 && role === 'seller') {
      console.log('[PartialSig-Poll] DISABLED — use canonical template flow at step 5');
    }
  }, [step, contract.agreementId, role, contract.buyerPubkey]);`;
    
    f = f.substring(0, useEffStart) + newPSP + f.substring(pspEnd);
    fixes++;
    console.log('FIX 2: PartialSig-Poll disabled (was', oldPSP.length, 'chars)');
  }
} else {
  console.log('FIX 2: PartialSig-Poll marker not found — may already be patched');
}

// === FIX 3: Disable old Seller-Release bar completeFrost2Round calls ===
// These fire from the seller paste UI and hit disabled completeFrost2Round
const sellerReleaseLines = f.split('\n');
let fix3count = 0;
for (let i = 0; i < sellerReleaseLines.length; i++) {
  if (sellerReleaseLines[i].includes('[Seller-Release] Sig mode:') && 
      !sellerReleaseLines[i].trim().startsWith('//')) {
    // This is inside the old seller paste handler — add early return before it
    sellerReleaseLines[i] = '                      Alert.alert("Use Step 5", "Paste the TX template at Step 5 Signing Ceremony instead."); setIsLoading(false); return; // OLD PATH DISABLED\n' + '                      // ' + sellerReleaseLines[i].trim();
    fix3count++;
    break; // Only need to catch the first one (inside the onPress handler)
  }
}
if (fix3count > 0) {
  f = sellerReleaseLines.join('\n');
  fixes++;
  console.log('FIX 3: Old seller-release paste handler redirects to step 5');
}

// === FIX 4: Remove old R nonce input sections from step 4 ===
// Remove "Paste Seller Verification" and "Paste Buyer Verification" input boxes
// They belong to the old manual R exchange flow — canonical embeds R in template

// Find and remove the buyer-side R input block
const buyerRBlock = f.indexOf('Paste Seller Verification');
if (buyerRBlock >= 0) {
  // Find the enclosing View
  let viewStart = f.lastIndexOf('<View style={{ backgroundColor: "#eef2ff"', buyerRBlock);
  if (viewStart < 0) viewStart = f.lastIndexOf('<View style={{ backgroundColor: \'#eef2ff\'', buyerRBlock);
  if (viewStart >= 0) {
    // Find matching closing </View>
    let vDepth = 0, viewEnd = -1;
    for (let i = viewStart; i < f.length; i++) {
      if (f.substring(i, i + 5) === '<View') vDepth++;
      if (f.substring(i, i + 7) === '</View>') {
        vDepth--;
        if (vDepth === 0) { viewEnd = i + 7; break; }
      }
    }
    if (viewEnd > viewStart && viewEnd - viewStart < 3000) {
      const removed = f.substring(viewStart, viewEnd);
      if (removed.includes('Paste Seller Verification') || removed.includes('Copy My R Nonce')) {
        f = f.substring(0, viewStart) + '{/* REMOVED: old R nonce exchange — canonical embeds R in template */}' + f.substring(viewEnd);
        fixes++;
        console.log('FIX 4a: Removed buyer-side R input block (' + removed.length + ' chars)');
      }
    }
  }
}

// Find and remove seller-side R sharing block ("Your Nonce (R)")
const sellerRBlock = f.indexOf('Your Nonce (R)');
if (sellerRBlock >= 0) {
  let sViewStart = f.lastIndexOf('<View style={{ backgroundColor:', sellerRBlock);
  // Walk back to find the right View (the one containing "Your Nonce")
  while (sViewStart >= 0 && !f.substring(sViewStart, sellerRBlock).includes('fffbeb')) {
    sViewStart = f.lastIndexOf('<View style={{ backgroundColor:', sViewStart - 1);
  }
  if (sViewStart >= 0) {
    let svDepth = 0, sViewEnd = -1;
    for (let i = sViewStart; i < f.length; i++) {
      if (f.substring(i, i + 5) === '<View') svDepth++;
      if (f.substring(i, i + 7) === '</View>') {
        svDepth--;
        if (svDepth === 0) { sViewEnd = i + 7; break; }
      }
    }
    if (sViewEnd > sViewStart && sViewEnd - sViewStart < 2000) {
      f = f.substring(0, sViewStart) + '{/* REMOVED: old seller R share — canonical embeds R in template */}' + f.substring(sViewEnd);
      fixes++;
      console.log('FIX 4b: Removed seller-side R share block');
    }
  }
}

// Also remove the "Copy My Verification" buttons that copy R to clipboard
const copyVerifPattern = 'Copy My Verification';
let cvCount = 0;
while (f.includes(copyVerifPattern)) {
  // Find the TouchableOpacity containing it
  const cvIdx = f.indexOf(copyVerifPattern);
  let toStart = f.lastIndexOf('<TouchableOpacity', cvIdx);
  if (toStart >= 0 && cvIdx - toStart < 1000) {
    let toEnd = f.indexOf('</TouchableOpacity>', cvIdx);
    if (toEnd >= 0) {
      toEnd += '</TouchableOpacity>'.length;
      f = f.substring(0, toStart) + '{/* REMOVED: old R copy button */}' + f.substring(toEnd);
      cvCount++;
    } else break;
  } else break;
}
if (cvCount > 0) {
  fixes++;
  console.log('FIX 4c: Removed', cvCount, 'Copy My Verification buttons');
}

fs.writeFileSync('NeighborAgreement.tsx', f);
console.log('\nTotal fixes:', fixes);
console.log('Emojis:', (f.match(/[\u{1F000}-\u{1FFFF}]/gu) || []).length);

// Verify
console.log('\n--- Verification ---');
console.log('handleConfirmDelivery has setStep(5):', f.includes("onPress: () => setStep(5)"));
console.log('PartialSig-Poll disabled:', f.includes('PartialSig-Poll] DISABLED'));
console.log('Old seller-release redirects:', f.includes('Use Step 5'));
console.log('buyerBuildTemplate present:', (f.match(/buyerBuildTemplate/g) || []).length, 'hits');
console.log('Old R inputs removed:', !f.includes('Paste Seller Verification') && !f.includes('Your Nonce (R)'));
console.log('Copy My Verification removed:', !f.includes('Copy My Verification'));
