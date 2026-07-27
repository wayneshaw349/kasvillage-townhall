const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
if(s.includes('PASTE-INSTRUCTIONS')){console.log('already');process.exit(0);}
const fails=[];let n=0;
function rep(A,B,t){const c=s.split(A).length-1;if(c!==1){fails.push(t+' count='+c);return;}s=s.replace(A,B);n++;console.log('ok:',t);}

// P1: buyer re-copy of stored proposal (body-immutable path, 3986-3988)
rep(
"Clipboard.setStringAsync(_storedRec.proposalBody);",
"Clipboard.setStringAsync('KasVillage agreement proposal. Open Neighbor Agreement, tap Resume, and paste ALL of this into the BLUE box (Paste Buyer Proposal). /* PASTE-INSTRUCTIONS */\\n\\n' + _storedRec.proposalBody);",
"p1-stored");

// P2: seller templates copy (refund|kill) — buyer pastes in AMBER
rep(
"try { await Clipboard.setStringAsync(_refund.templateB64 + '|' + _kill.templateB64); } catch {}",
"try { await Clipboard.setStringAsync('KasVillage refund+kill templates. Paste ALL of this into your AMBER box (refund template) in Neighbor Agreement, co-sign, and send your signature back.\\n\\n' + _refund.templateB64 + '|' + _kill.templateB64); } catch {}",
"p2-templates");

if(fails.length){console.error('ABORT:');fails.forEach(f=>console.error('  -',f));process.exit(1);}
fs.writeFileSync(F+'.bak_pasteinstr',O);fs.writeFileSync(F,s);console.log('patched ok -',n);
