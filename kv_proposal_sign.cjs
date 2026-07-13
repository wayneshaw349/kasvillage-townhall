const fs = require('fs');
const f = 'kv_proposal.ts';
let s = fs.readFileSync(f, 'utf8');
let ok = true, log = [];

function apply(tag, a, b) {
  const n = s.split(a).length - 1;
  if (n === 1) { s = s.split(a).join(b); log.push('OK   ' + tag); }
  else if (s.includes(b.slice(0, 44))) { log.push('SKIP ' + tag + ' (already applied)'); }
  else { ok = false; log.push('MISS(' + n + ') ' + tag); }
}

// 1) import secp256k1 + a domain-separated body-hash helper
apply('import secp',
  "import { bytesToHex, hexToBytes } from '@noble/hashes/utils';",
  "import { bytesToHex, hexToBytes } from '@noble/hashes/utils';\nimport { secp256k1 } from '@noble/curves/secp256k1';\n\n// Hash over the raw proposal body string (wire fields 1..11, pipe-joined)\nfunction kvSigHash(bodyStr: string): Uint8Array { return sha256(new TextEncoder().encode('KV_SIG_V1:' + bodyStr)); }");

// 2a) add buyerPrivKeyHex (+ buyerPubkey) to generateProposal params
apply('gen param',
  "export function generateProposal(params: {\n  agrId: string;",
  "export function generateProposal(params: {\n  buyerPrivKeyHex?: string;\n  buyerPubkey?: string;\n  agrId: string;");

// 2b) build body, sign it, append SIG as field 12
apply('gen sign',
  "  return ['KV', params.agrId, params.buyerAddress, params.sellerAddress,\n    params.buyerAmountSompi.toString(), params.sellerAmountSompi.toString(),\n    params.network, params.buyerR, params.verificationCode, desc, (params as any).buyerPubkey || '', String((params as any).frostCounter ?? '')].join('|');",
  "  const _body = ['KV', params.agrId, params.buyerAddress, params.sellerAddress,\n    params.buyerAmountSompi.toString(), params.sellerAmountSompi.toString(),\n    params.network, params.buyerR, params.verificationCode, desc, (params as any).buyerPubkey || '', String((params as any).frostCounter ?? '')].join('|');\n  let _sig = '';\n  try {\n    if ((params as any).buyerPrivKeyHex) {\n      const _bodyOnly = _body.split('|').slice(1).join('|'); // fields 1..11 (drop 'KV')\n      _sig = secp256k1.sign(kvSigHash(_bodyOnly), hexToBytes((params as any).buyerPrivKeyHex)).toCompactHex();\n    }\n  } catch (e) { console.warn('[KV] proposal sign failed:', e); }\n  return _body + '|' + _sig;");

// 3a) capture SIG (field 12) in parseProposal
apply('parse read sig',
  "    frostCounter: (parts[11] !== undefined && parts[11] !== '') ? parseInt(parts[11], 10) : undefined,\n  };",
  "    frostCounter: (parts[11] !== undefined && parts[11] !== '') ? parseInt(parts[11], 10) : undefined,\n  };\n  const _sig = parts[12] || '';\n  const _bodyOnly = parts.slice(1, 12).join('|'); // EXACT received bytes the buyer signed");

// 3b) enforce signature before valid=true (verify over raw received body)
apply('parse verify',
  "  proposal.valid = true;\n  return proposal;\n}\n\nexport function verifyProposalForMe",
  "  // === SIGNATURE GATE ===\n  if (!_sig) {\n    proposal.valid = false;\n    proposal.error = 'Unsigned proposal (old format) - reject';\n    return proposal;\n  }\n  try {\n    const _okSig = secp256k1.verify(_sig, kvSigHash(_bodyOnly), proposal.buyerPubkey as string);\n    if (!_okSig) {\n      proposal.valid = false;\n      proposal.error = 'Bad signature - proposal was tampered';\n      return proposal;\n    }\n  } catch (e: any) {\n    proposal.valid = false;\n    proposal.error = 'Signature verify failed: ' + (e?.message || e);\n    return proposal;\n  }\n\n  proposal.valid = true;\n  return proposal;\n}\n\nexport function verifyProposalForMe");

if (ok) { fs.writeFileSync(f, s); console.log('WROTE ' + f); }
else { console.log('NO WRITE:'); }
log.forEach(l => console.log('  ' + l));
