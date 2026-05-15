// patch_asyncstorage.js
// Moves growing data (>2KB risk) from SecureStore to AsyncStorage
// Private keys STAY in SecureStore (secure enclave)
// Growing arrays (payments, watched addresses, stats) → AsyncStorage
//
// Run: node patch_asyncstorage.js

const fs = require('fs');

// ============================================================================
// 1. Fix stealth_watcher.ts — STEALTH_PAYMENTS + WATCHED_ADDRESSES
// ============================================================================
let stealth = fs.readFileSync('stealth_watcher.ts', 'utf8');

// Add AsyncStorage import if not present
if (!stealth.includes('AsyncStorage')) {
  stealth = stealth.replace(
    "import * as SecureStore from 'expo-secure-store';",
    "import * as SecureStore from 'expo-secure-store';\nimport AsyncStorage from '@react-native-async-storage/async-storage';"
  );
  console.log('1a: AsyncStorage import added to stealth_watcher.ts');
}

// Replace SecureStore writes for STEALTH_PAYMENTS with AsyncStorage
// There are TWO instances (line ~729 and ~795)
let count = 0;
stealth = stealth.replace(
  /await SecureStore\.setItemAsync\(SECURESTORE_KEYS\.STEALTH_PAYMENTS, JSON\.stringify\(serialized\)\);/g,
  () => {
    count++;
    return "await AsyncStorage.setItem(SECURESTORE_KEYS.STEALTH_PAYMENTS, JSON.stringify(serialized));";
  }
);
console.log(`1b: Replaced ${count} STEALTH_PAYMENTS writes → AsyncStorage`);

// Replace SecureStore reads for STEALTH_PAYMENTS with AsyncStorage
stealth = stealth.replace(
  /await SecureStore\.getItemAsync\(SECURESTORE_KEYS\.STEALTH_PAYMENTS\)/g,
  "await AsyncStorage.getItem(SECURESTORE_KEYS.STEALTH_PAYMENTS)"
);
console.log('1c: Replaced STEALTH_PAYMENTS reads → AsyncStorage');

// Replace WATCHED_ADDRESSES if it exists
stealth = stealth.replace(
  /await SecureStore\.setItemAsync\(SECURESTORE_KEYS\.WATCHED_ADDRESSES,/g,
  "await AsyncStorage.setItem(SECURESTORE_KEYS.WATCHED_ADDRESSES,"
);
stealth = stealth.replace(
  /await SecureStore\.getItemAsync\(SECURESTORE_KEYS\.WATCHED_ADDRESSES\)/g,
  "await AsyncStorage.getItem(SECURESTORE_KEYS.WATCHED_ADDRESSES)"
);
console.log('1d: Replaced WATCHED_ADDRESSES → AsyncStorage');

// Replace stealth index counter (grows over time)
stealth = stealth.replace(
  /await SecureStore\.setItemAsync\(indexKey,/g,
  "await AsyncStorage.setItem(indexKey,"
);
stealth = stealth.replace(
  /await SecureStore\.getItemAsync\(indexKey\)/g,
  "await AsyncStorage.getItem(indexKey)"
);
console.log('1e: Replaced index counter → AsyncStorage');

fs.writeFileSync('stealth_watcher.ts', stealth);
console.log('1f: stealth_watcher.ts saved. Lines:', stealth.split('\n').length);

// ============================================================================
// 2. Fix wallet_registration_v2.ts — USER_STATS
// ============================================================================
let reg = fs.readFileSync('wallet_registration_v2.ts', 'utf8');

if (!reg.includes('AsyncStorage')) {
  reg = reg.replace(
    "import * as SecureStore from 'expo-secure-store';",
    "import * as SecureStore from 'expo-secure-store';\nimport AsyncStorage from '@react-native-async-storage/async-storage';"
  );
  console.log('2a: AsyncStorage import added to wallet_registration_v2.ts');
}

// USER_STATS can grow — move to AsyncStorage
reg = reg.replace(
  /await SecureStore\.setItemAsync\(STORE_KEYS\.USER_STATS,/g,
  "await AsyncStorage.setItem(STORE_KEYS.USER_STATS,"
);
reg = reg.replace(
  /await SecureStore\.getItemAsync\(STORE_KEYS\.USER_STATS\)/g,
  "await AsyncStorage.getItem(STORE_KEYS.USER_STATS)"
);
console.log('2b: USER_STATS → AsyncStorage');

fs.writeFileSync('wallet_registration_v2.ts', reg);
console.log('2c: wallet_registration_v2.ts saved. Lines:', reg.split('\n').length);

// ============================================================================
// 3. Check if AsyncStorage is installed
// ============================================================================
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps['@react-native-async-storage/async-storage']) {
    console.log('3: AsyncStorage already installed');
  } else {
    console.log('3: NEED TO INSTALL: npm install @react-native-async-storage/async-storage');
  }
} catch (e) {
  console.log('3: Could not check package.json');
}

console.log('\n=== DONE ===');
console.log('SecureStore (encrypted, <2KB): private keys, device keys, enabled flags');
console.log('AsyncStorage (unencrypted, unlimited): payments, watched addresses, stats');
console.log('');
console.log('IMPORTANT: Private keys NEVER moved — still in SecureStore secure enclave.');
