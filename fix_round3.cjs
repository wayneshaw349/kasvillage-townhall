const fs = require('fs');
const f = 'C:\\Users\\wayne\\Downloads\\townhall_verification_complete.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
let fixes = 0;

for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  const ln = i + 1;

  // 1. ALL last_deadlock_timestamp -> last_deadlock_daa
  if (lines[i].includes('last_deadlock_timestamp')) {
    lines[i] = lines[i].replace(/last_deadlock_timestamp/g, 'last_deadlock_daa');
    fixes++; console.log('L' + ln + ': last_deadlock_timestamp -> last_deadlock_daa');
  }

  // 2. Fix deref comparison
  if (t === 'let matches = body.loaded_hash == verified_hash.as_ref().unwrap();') {
    lines[i] = lines[i].replace('== verified_hash.as_ref().unwrap()', '== *verified_hash.as_ref().unwrap()');
    fixes++; console.log('L' + ln + ': added deref on verified_hash');
  }

  // 3. Fix api_verify_dapp ProofInputs construction
  // Replace [u8;32]/[u8;33] locals with String versions
  if (t === 'let mut content_hash = [0u8; 32];') {
    lines[i] = ''; fixes++; console.log('L' + ln + ': removed content_hash [u8;32] decl');
  }
  if (t.startsWith('hex::decode_to_slice(&scan_result.code_hash')) {
    lines[i] = lines[i].replace(t, 'let content_hash = scan_result.code_hash.clone();');
    fixes++; console.log('L' + ln + ': simplified content_hash');
  }
  if (t === 'let mut owner_pubkey = [0u8; 33];') {
    lines[i] = ''; fixes++; console.log('L' + ln + ': removed owner_pubkey [u8;33] decl');
  }
  if (t.startsWith('hex::decode_to_slice(&body.owner_pubkey')) {
    lines[i] = lines[i].replace(t, 'let owner_pubkey = body.owner_pubkey.clone();');
    fixes++; console.log('L' + ln + ': simplified owner_pubkey');
  }
  if (t === 'let mut device_hash = [0u8; 32];') {
    lines[i] = ''; fixes++; console.log('L' + ln + ': removed device_hash [u8;32] decl');
  }
  if (t === 'let device_attestation_hash = compute_hash(&body.device_attestation);') {
    // This is fine, keep it
  }
  if (t.startsWith('hex::decode_to_slice(&device_attestation_hash')) {
    lines[i] = ''; fixes++; console.log('L' + ln + ': removed device_hash decode');
  }
  if (t === 'device_attestation_hash: device_hash,') {
    lines[i] = lines[i].replace('device_hash', 'device_attestation_hash');
    fixes++; console.log('L' + ln + ': device_hash -> device_attestation_hash');
  }

  // 4. Fix extend_from_slice for String fields in generate_verification_proof
  if (t === 'proof_data.extend_from_slice(&inputs.content_hash);') {
    lines[i] = lines[i].replace('&inputs.content_hash', 'inputs.content_hash.as_bytes()');
    fixes++; console.log('L' + ln + ': content_hash extend -> as_bytes');
  }
  if (t === 'proof_data.extend_from_slice(&inputs.owner_pubkey);') {
    lines[i] = lines[i].replace('&inputs.owner_pubkey', 'inputs.owner_pubkey.as_bytes()');
    fixes++; console.log('L' + ln + ': owner_pubkey extend -> as_bytes');
  }
  if (t === 'proof_data.extend_from_slice(&inputs.device_attestation_hash);') {
    lines[i] = lines[i].replace('&inputs.device_attestation_hash', 'inputs.device_attestation_hash.as_bytes()');
    fixes++; console.log('L' + ln + ': device_attestation_hash extend -> as_bytes');
  }

  // 5. Fix pub_hasher for String fields
  if (t === 'pub_hasher.update(&inputs.content_hash);') {
    lines[i] = lines[i].replace('&inputs.content_hash', 'inputs.content_hash.as_bytes()');
    fixes++; console.log('L' + ln + ': pub_hasher content_hash -> as_bytes');
  }
  if (t === 'pub_hasher.update(&inputs.owner_pubkey);') {
    lines[i] = lines[i].replace('&inputs.owner_pubkey', 'inputs.owner_pubkey.as_bytes()');
    fixes++; console.log('L' + ln + ': pub_hasher owner_pubkey -> as_bytes');
  }
}

// Remove blank lines created by deletions (consecutive blank lines)
let cleaned = [];
let prevBlank = false;
for (const line of lines) {
  if (line.trim() === '') {
    if (!prevBlank) cleaned.push(line);
    prevBlank = true;
  } else {
    cleaned.push(line);
    prevBlank = false;
  }
}

fs.writeFileSync(f, cleaned.join('\r\n'));
console.log('Total fixes: ' + fixes + ', lines: ' + cleaned.length);
