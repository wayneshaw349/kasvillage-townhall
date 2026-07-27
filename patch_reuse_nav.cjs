const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
if(s.includes('AMBER box')){console.log('already');process.exit(0);}
const A="Alert.alert('Templates Re-Copied', 'Your existing frozen templates were copied again (unchanged). Send both to the buyer. Nothing was re-built.');";
const B="setStep(4); Alert.alert('Templates Re-Copied \u2014 paste in the AMBER box', 'Your existing frozen templates were copied again (unchanged). Send both to the buyer \u2014 they paste this into the AMBER refund-template box on their screen. When they send back their co-signature, paste it in your PURPLE box below. Nothing was re-built.');";
const c=s.split(A).length-1;
if(c!==1){console.error('count='+c+' abort');process.exit(1);}
fs.writeFileSync(F+'.bak_reusenav',O);fs.writeFileSync(F,s.replace(A,B));console.log('patched ok');
