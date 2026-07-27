const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
if(s.includes('COOLDOWN-TOLERANT')){console.log('already');process.exit(0);}
const A="                                if (!_arRes || !_arRes.success || !_arRes.txId) {\r\n                                  console.warn('[Refund] Arweave inscription FAILED:', _arRes && _arRes.error);";
const A_lf=A.replace(/\r\n/g,'\n');
const B="                                if (!_arRes || !_arRes.success || !_arRes.txId) {\n                                  /* COOLDOWN-TOLERANT: refund is already signed + persisted in SecureStore (kv_refund_pending_).\n                                     A rate-limit is not a durability failure - the SlothQueue holds the item and lands it when\n                                     poison decays. Funding must not be hostage to Irys cooldowns. Hard-block only on real failures. */\n                                  const _arErr = String((_arRes && _arRes.error) || '');\n                                  if (/cooldown|queued|rate/i.test(_arErr)) {\n                                    console.warn('[Refund] Arweave rate-limited (' + _arErr.slice(0,60) + ') - proceeding to fund; SlothQueue will land the inscription.');\n                                  } else {\n                                  console.warn('[Refund] Arweave inscription FAILED:', _arRes && _arRes.error);";
let hit=null;
if(s.includes(A)){hit=A;}else if(s.includes(A_lf)){hit=A_lf;}
if(!hit){console.error('open anchor count=0 abort');process.exit(1);}
if(s.split(hit).length-1!==1){console.error('open anchor not unique abort');process.exit(1);}
s=s.replace(hit,B);

// close the else: the abort lines get wrapped, then close brace after them
const A2="                                  Alert.alert('Backup Failed', 'Could not publish the signed refund to Arweave, so it would only exist on this phone. Nothing was sent - try again.');\r\n                                  setIsLoading(false); return;\r\n                                }";
const A2_lf=A2.replace(/\r\n/g,'\n');
const B2="                                  Alert.alert('Backup Failed', 'Could not publish the signed refund to Arweave, so it would only exist on this phone. Nothing was sent - try again.');\n                                  setIsLoading(false); return;\n                                  }\n                                }";
let hit2=null;
if(s.includes(A2)){hit2=A2;}else if(s.includes(A2_lf)){hit2=A2_lf;}
if(!hit2){console.error('close anchor count=0 abort — check Alert text spacing');process.exit(1);}
if(s.split(hit2).length-1!==1){console.error('close anchor not unique abort');process.exit(1);}
s=s.replace(hit2,B2);

fs.writeFileSync(F+'.bak_cooldown',O);fs.writeFileSync(F,s);console.log('patched ok');
