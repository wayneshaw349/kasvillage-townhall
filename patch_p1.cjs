// patch_p1.cjs — Phase 1: thread timeoutN through canon
// Run: node patch_p1.cjs
const fs = require('fs');

function esc(x){ return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function rx(a){ return new RegExp(esc(a).replace(/\n/g, '\\r?\\n'), 'g'); }

const files = {};
function load(f){ files[f] = fs.readFileSync(f, 'utf8'); }
function guard(f, name, a, expect){
  const c = (files[f].match(rx(a)) || []).length;
  if (c !== expect) { console.error('ABORT ['+name+'] '+f+' count='+c+' expected='+expect); process.exit(1); }
  console.log('OK ['+name+'] '+f+' count='+c);
}
function sub(f, name, a, r){ files[f] = files[f].replace(rx(a), () => r); console.log('APPLIED ['+name+']'); }

const TC = 'townhall_client.ts';
const CA = 'canonical_agreement.ts';
const NA = 'NeighborAgreement.tsx';
load(TC); load(CA); load(NA);

// ---------- townhall_client.ts ----------
const T1 = "  buyerAmountSompi?: number;\n  sellerAmountSompi?: number;\n}): Promise<IrysUploadResult> {";
const T2 = "    { name: 'KV-SellerAmount', value: String(agreement.sellerAmountSompi || (agreement as any).sellerAmountSompi || 0) },";
const T3 = "          network: tags['KV-Network'] || 'testnet-10',\n          party_a: {";
guard(TC,'T1 param',T1,1); guard(TC,'T2 tag',T2,1); guard(TC,'T3 query',T3,1);

sub(TC,'T1',T1,"  buyerAmountSompi?: number;\r\n  sellerAmountSompi?: number;\r\n  timeoutN?: number;\r\n}): Promise<IrysUploadResult> {");
sub(TC,'T2',T2,T2+"\r\n    ...(Number((agreement as any).timeoutN || 0) > 0 ? [{ name: 'KV-TimeoutN', value: String((agreement as any).timeoutN) }] : []),");
sub(TC,'T3',T3,"          network: tags['KV-Network'] || 'testnet-10',\r\n          timeoutN: parseInt(tags['KV-TimeoutN'] || '0', 10),\r\n          party_a: {");

// ---------- canonical_agreement.ts ----------
const C1 = "  frostData: any;\n  idValid: boolean;\n}";
const C2 = "    signature: raw.signature || '',\n  };";
const C3 = "  const kvAgrId = tags.agreementId || tags.agreement_id || tags['KV-AgreementId'] || '';";
const C4 = "    frostAddress,\n    frostData,\n    idValid,\n  };";
const C5 = "    multisigAddress: canon.frostAddress,\n    frostData: canon.frostData,\n  };";
guard(CA,'C1 iface',C1,1); guard(CA,'C2 normalize',C2,1); guard(CA,'C3 extract',C3,1);
guard(CA,'C4 return',C4,1); guard(CA,'C5 toContract',C5,1);

sub(CA,'C1',C1,"  frostData: any;\r\n  idValid: boolean;\r\n  timeoutN: number;\r\n}");
sub(CA,'C2',C2,"    signature: raw.signature || '',\r\n    timeoutN: Number(raw.timeoutN || raw['KV-TimeoutN'] || 0),\r\n  };");
sub(CA,'C3',C3,C3+"\r\n  const kvTimeoutN = parseInt(String(tags.timeoutN || tags['KV-TimeoutN'] || '0'), 10) || 0;");
sub(CA,'C4',C4,"    frostAddress,\r\n    frostData,\r\n    idValid,\r\n    timeoutN: kvTimeoutN,\r\n  };");
// NOTE: emits timeoutN ONLY — never timeoutMinutes (would zero the buyer's 5e guard)
sub(CA,'C5',C5,"    multisigAddress: canon.frostAddress,\r\n    frostData: canon.frostData,\r\n    timeoutN: canon.timeoutN,\r\n  };");

// ---------- NeighborAgreement.tsx ----------
const N1 = "  timeoutMinutes?: number;";
const N2 = ", frostCounter: parsed.frostCounter };";
guard(NA,'N1 Contract iface',N1,1); guard(NA,'N2 fakeAgr',N2,1);

sub(NA,'N1',N1,"  timeoutMinutes?: number;\r\n  timeoutN?: number;");
sub(NA,'N2',N2,", frostCounter: parsed.frostCounter, timeoutN: Number(parsed.timeoutN || 0) };");

for (const f of [TC, CA, NA]) { fs.writeFileSync(f, files[f]); console.log('WROTE ' + f); }
