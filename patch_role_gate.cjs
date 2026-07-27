const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
if(s.includes('ROLE-MATCH-GUARD')){console.log('already');process.exit(0);}
const fails=[];let n=0;
function rep(A,B,t){const c=s.split(A).length-1;if(c!==1){fails.push(t+' count='+c);return;}s=s.replace(A,B);n++;console.log('ok:',t);}

// 1: AMBER title -> Buyer Step 1
rep(
"AMBER box \u2014 The seller has frozen",
"BUYER STEP 1 \u2014 paste the seller's templates below (amber). The seller has frozen",
"amber-title");

// 2: GREEN title -> Buyer Step 2
rep(
">GREEN box \u2014 Paste Kill Tx from Seller",
">BUYER STEP 2 \u2014 Paste Kill Tx from Seller (green)",
"green-title");

// 3: PURPLE title -> Seller Step 2
rep(
">PURPLE box \u2014 Paste Buyer's Refund Sign",
">SELLER STEP 2 \u2014 Paste Buyer's Refund Sign (purple)",
"purple-title");

// 4: accept flow match guard (before setRole(myRole))
rep(
"setRole(myRole);",
"if (role && role !== myRole) { Alert.alert('Role Mismatch', 'You selected ' + role.toUpperCase() + ', but this proposal lists your wallet as the ' + myRole.toUpperCase() + '. Check that you pasted the right agreement, then pick the matching role.'); setIsLoading(false); setAcceptingId(null); return; } /* ROLE-MATCH-GUARD */\n      setRole(myRole);",
"accept-guard");

// 5: third-paste match guard (before setRole(_role))
rep(
"setRole(_role);",
"if (role && role !== _role) { Alert.alert('Role Mismatch', 'You selected ' + role.toUpperCase() + ', but this proposal lists your wallet as the ' + _role.toUpperCase() + '. Check that you pasted the right agreement.'); setIsLoading(false); return; }\n                        setRole(_role);",
"paste3-guard");

// 6: AMBER wrapper role gate
rep(
"{waitingForTemplates && (",
"{waitingForTemplates && role !== 'seller' && (",
"amber-gate");

if(fails.length){console.error('ABORT - nothing written:');fails.forEach(f=>console.error('  -',f));process.exit(1);}
fs.writeFileSync(F+'.bak_rolegate',O);fs.writeFileSync(F,s);console.log('patched ok -',n);
