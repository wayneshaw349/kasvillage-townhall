const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
if(s.includes('_verified')){console.log('already');process.exit(0);}
const fails=[];let n=0;
function rep(A,B,tag){const c=s.split(A).length-1;if(c!==1){fails.push(tag+' (count='+c+')');return;}s=s.replace(A,B);n++;console.log('ok:',tag);}

// 1: compute _verified inside the local map, from the stored proposalBody
rep(
"          const _b = Number(l.buyerAmountSompi || 0); const _se = Number(l.sellerAmountSompi || 0);",
"          const _b = Number(l.buyerAmountSompi || 0); const _se = Number(l.sellerAmountSompi || 0);\n          let _verified = true; try { if (l.proposalBody) { const _vp = parseProposal(l.proposalBody); _verified = !!_vp && _vp.valid !== false; } } catch { _verified = false; }",
"map-verify");

// 2: carry _verified onto the item
rep(
"partyA: { pubkey: l.buyerPubkey || '', amount_sompi: _b + _se }, _score: l.updatedAt || l.createdAt || 0, _local: true };",
"partyA: { pubkey: l.buyerPubkey || '', amount_sompi: _b + _se }, _score: l.updatedAt || l.createdAt || 0, _local: true, _verified };",
"item-verify");

// 3: render a warning banner when a local record fails verification
rep(
"                    <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: '#92400E' }}>",
"                    {agr._local && agr._verified === false && (<Text style={{ fontSize: rs.font(10), fontWeight: 'bold', color: '#DC2626', marginBottom: 4 }}>\u26A0 Unverified \u2014 stored proposal signature did not check out. Do not accept; ask for a fresh proposal.</Text>)}\n                    <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: '#92400E' }}>",
"render-banner");

if(fails.length){console.error('ABORT:');fails.forEach(f=>console.error('  -',f));process.exit(1);}
fs.writeFileSync(F+'.bak_inboxverify',O);fs.writeFileSync(F,s);console.log('patched ok -',n,'edits');
