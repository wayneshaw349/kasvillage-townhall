const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
if(s.includes('nextActionMsg')){console.log('already');process.exit(0);}
const fails=[];let n=0;
function rep(A,B,t){const c=s.split(A).length-1;if(c!==1){fails.push(t+' count='+c);return;}s=s.replace(A,B);n++;console.log('ok:',t);}

// helper: role x phase -> plain instruction. Injected once near the accept guard.
const HELPER="    const nextActionMsg = (ph: string, rl: string): string => {\n      const seller = rl === 'seller';\n      switch (ph) {\n        case 'proposed': return seller ? 'Review the proposal and tap Accept to begin.' : 'Waiting for the seller to accept your proposal.';\n        case 'agreed': return seller ? 'Next: your refund + kill templates. Tap the agreement to build and copy them, then DM to the buyer (they paste in their AMBER box).' : 'Next: the seller sends you two templates. Paste them into your AMBER box, co-sign, and send your signature back (it goes in their PURPLE box).';\n        case 'templates_ready': return seller ? 'Your templates are with the buyer. When their co-signature comes back, paste it into your PURPLE box - your collateral funds right after.' : 'Paste the seller\\'s templates into your AMBER box, co-sign, and send the signature back (their PURPLE box).';\n        case 'cosigned': return seller ? 'Co-signature received - your collateral is funding now.' : 'Waiting for the seller to fund. Their kill tx will arrive next - paste it in your GREEN box.';\n        case 'seller_funded': return seller ? 'Your collateral is in escrow. Send the kill tx to the buyer (their GREEN box) so they can fund.' : 'Seller funded. Paste their kill tx into your GREEN box - your payment sends automatically after.';\n        case 'kill_dead': return seller ? 'Refund is dead - waiting for the buyer to fund.' : 'Refund is dead - your payment sends on the next poll automatically.';\n        case 'fully_funded': return 'Escrow is fully funded. Proceed to Release.';\n        default: return 'Continuing where the agreement is.';\n      }\n    };\n";

// inject helper before handleAcceptFromInbox definition
rep(
"  const handleAcceptFromInbox = async (agreement: any) => {",
HELPER + "  const handleAcceptFromInbox = async (agreement: any) => {",
"helper");

// accept guard: role-aware message
rep(
"setStep(4); Alert.alert('Resuming Agreement', 'You already hold this agreement (' + _exPh.phase + '). Continuing where it is - not re-accepting.'); return;",
"setStep(4); Alert.alert('Resuming - ' + _exPh.phase.replace('_',' '), nextActionMsg(_exPh.phase, _exRec.role || 'seller')); return;",
"accept-msg");

// paste guard: role-aware message
rep(
"setStep(4); Alert.alert(\"Resuming Agreement\", \"You already hold this agreement (\" + _exPh.phase + \"). Not re-accepting - continuing where it is.\"); return;",
"setStep(4); Alert.alert('Resuming - ' + _exPh.phase.replace('_',' '), nextActionMsg(_exPh.phase, _exRec.role || 'seller')); return;",
"paste-msg");

if(fails.length){console.error('ABORT:');fails.forEach(f=>console.error('  -',f));process.exit(1);}
fs.writeFileSync(F+'.bak_nextaction',O);fs.writeFileSync(F,s);console.log('patched ok -',n);
