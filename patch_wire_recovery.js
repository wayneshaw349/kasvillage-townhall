// ============================================================================
// PATCH: Wire avatar recovery into ProfileScreen.tsx
// Run AFTER patch_avatar_profile.js AND patch_avatar_recovery.js
// Run: node patch_wire_recovery.js
// ============================================================================

const fs = require('fs');

let ps = fs.readFileSync('ProfileScreen.tsx', 'utf8');
let fixes = 0;

// 1. Add recoverAvatarFromArweave to imports
if (ps.includes('uploadAvatarSVG') && !ps.includes('recoverAvatarFromArweave')) {
  ps = ps.replace(
    "import { uploadAvatarSVG } from './avatar_arweave_upload';",
    "import { uploadAvatarSVG, recoverAvatarFromArweave } from './avatar_arweave_upload';"
  );
  fixes++;
  console.log('FIX 1: recoverAvatarFromArweave import added');
}

// 2. Replace simple getStoredAvatar with local-first + Arweave fallback
const oldLoad = "getStoredAvatar().then(id => { if (id) setAvatarIdentity(id); }).catch(() => {});";
const newLoad = `getStoredAvatar().then(async (id) => {
      if (id) {
        setAvatarIdentity(id);
      } else {
        // Local avatar missing — try Arweave recovery
        try {
          const pubkey = await SecureStore.getItemAsync('kaspa_pubkey');
          if (pubkey) {
            console.log('[Profile] No local avatar, attempting Arweave recovery...');
            const recovery = await recoverAvatarFromArweave(pubkey);
            if (recovery.success && recovery.identity) {
              setAvatarIdentity(recovery.identity as any);
              console.log('[Profile] Avatar recovered from Arweave:', recovery.arweaveTxId);
            }
          }
        } catch (e) { console.warn('[Profile] Avatar recovery failed:', e); }
      }
    }).catch(() => {});`;

if (ps.includes(oldLoad)) {
  ps = ps.replace(oldLoad, newLoad);
  fixes++;
  console.log('FIX 2: loadProfile now tries Arweave recovery when local is empty');
}

fs.writeFileSync('ProfileScreen.tsx', ps);
console.log('\n=== ' + fixes + ' fixes applied ===');
console.log('\nFlow:');
console.log('  1. loadProfile → getStoredAvatar() → found locally? → render');
console.log('  2. Not found locally → recoverAvatarFromArweave(pubkey)');
console.log('     → query Arweave → fetch paths → verify hash → store to SecureStore → render');
console.log('  3. Not on Arweave either → card hidden (no avatar)');
