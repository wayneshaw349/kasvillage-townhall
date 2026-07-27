const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
if(s.includes('BODY-IMMUTABLE')){console.log('already');process.exit(0);}
const A="const shareText = generateProposal({";
const B="/* BODY-IMMUTABLE: a proposal body is generated ONCE. Re-copying must reuse the stored body verbatim - regeneration with a fresh R/counter forks the ceremony under the same agrId. */\n                          const _storedRec = await (await import('./local_agreements')).getAgreement(contract.agreementId || '');\n                          if (_storedRec && _storedRec.proposalBody && _storedRec.proposalBody.startsWith('KV|')) {\n                            Clipboard.setStringAsync(_storedRec.proposalBody);\n                            Alert.alert('Copied (unchanged)', 'The ORIGINAL signed proposal was re-copied - identical to what your counterparty already has. Send it via DM; they paste it in the BLUE box.');\n                            return;\n                          }\n                          const shareText = generateProposal({";
const c=s.split(A).length-1;
if(c!==1){console.error('anchor count='+c+' abort');process.exit(1);}
fs.writeFileSync(F+'.bak_bodyimmutable',O);fs.writeFileSync(F,s.replace(A,B));console.log('patched ok');
