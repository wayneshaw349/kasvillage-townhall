const fs = require('fs');
const f = 'src\\main.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
let fixes = 0;

for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();

  // 1. Fix test_citadel_tiers_from_avatar
  if (t === 'fn test_citadel_tiers_from_avatar() {') {
    let end = i;
    let depth = 0;
    for (let j = i; j < i+50; j++) {
      for (const ch of lines[j]) { if (ch==='{') depth++; if (ch==='}') depth--; }
      if (depth === 0) { end = j; break; }
    }
    const ind = '        ';
    const newTest = [
      lines[i],
      ind + 'let mut avatar = CanonicalAvatar::default();',
      ind + 'assert_eq!(avatar.citadel_tier(), CitadelTier::Guest);',
      ind + 'assert!(!avatar.can_buy());',
      ind + 'assert!(!avatar.can_sell());',
      ind + '',
      ind + '// Add 5 traits = Resident (can buy, cannot sell)',
      ind + 'avatar.class = "Warrior".to_string();',
      ind + 'avatar.race = "Human".to_string();',
      ind + 'avatar.occupation = "Knight".to_string();',
      ind + 'avatar.mutant = "Super Strength".to_string();',
      ind + 'avatar.animal = "Wolf".to_string();',
      ind + '',
      ind + 'assert_eq!(avatar.citadel_tier(), CitadelTier::Resident);',
      ind + 'assert!(avatar.can_buy());',
      ind + 'assert!(!avatar.can_sell());',
      ind + '',
      ind + '// Add 1 more = 6 traits = Passport (can sell)',
      ind + 'avatar.personality = "Brave".to_string();',
      ind + '',
      ind + 'assert_eq!(avatar.citadel_tier(), CitadelTier::Passport);',
      ind + 'assert!(avatar.can_sell());',
      '    }',
    ];
    lines.splice(i, end - i + 1, ...newTest);
    fixes++; console.log('Fixed test_citadel_tiers_from_avatar at L' + (i+1));
  }

  // 2. Fix test_verify_user_resident
  if (t === 'fn test_verify_user_resident() {') {
    let end = i;
    let depth = 0;
    for (let j = i; j < i+50; j++) {
      for (const ch of lines[j]) { if (ch==='{') depth++; if (ch==='}') depth--; }
      if (depth === 0) { end = j; break; }
    }
    const ind = '        ';
    const newTest = [
      lines[i],
      ind + 'let stats = UserStatsL1 {',
      ind + '    pubkey_hash: "test".into(),',
      ind + '    xp: 200, successes: 5, deadlocks: 1,',
      ind + '    completion_pct: 80, dispute_pct: 20,',
      ind + '    snail_mode: false, attestation_hash: "".into(), timestamp: 0,',
      ind + '};',
      ind + 'let mut traits = CitadelTraits::default();',
      ind + '// Set 5 traits (can buy, cannot sell)',
      ind + 'traits.name = true; traits.class = true; traits.race = true;',
      ind + 'traits.occupation = true; traits.origin_story = true;',
      ind + '',
      ind + 'let att = DeviceAttestation {',
      ind + '    platform: "ios".into(), attestation_blob: "valid".into(),',
      ind + '    key_id: None, nonce: "n".into(), timestamp: 0,',
      ind + '    device_integrity: true, app_integrity: true,',
      ind + '};',
      ind + '',
      ind + 'let result = verify_user_full(&stats, &traits, &att);',
      ind + 'assert_eq!(result.access_level, "RESIDENT");',
      ind + 'assert!(result.can_buy);',
      ind + 'assert!(!result.can_sell);',
      '    }',
    ];
    lines.splice(i, end - i + 1, ...newTest);
    fixes++; console.log('Fixed test_verify_user_resident at L' + (i+1));
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Fixes: ' + fixes);
