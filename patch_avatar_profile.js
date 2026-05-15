// ============================================================================
// PATCH: Avatar SVG on ProfileScreen (toggle hidden) + uploadAvatarSVG
// Run: node patch_avatar_profile.js
// ============================================================================

const fs = require('fs');
let fixes = 0;

// ============================================================================
// PATCH 1: ProfileScreen.tsx
// ============================================================================

let ps = fs.readFileSync('ProfileScreen.tsx', 'utf8');

// 1A: Add imports
const importAnchor = "import MnemonicExportModal from './MnemonicExportModal';";
const newImport = `import MnemonicExportModal from './MnemonicExportModal';
import { getStoredAvatar, StoredAvatarRenderer, generateSVGString, type AvatarIdentity } from './avatar_silhouette_generator';
import { uploadAvatarSVG } from './avatar_arweave_upload';`;

if (ps.includes(importAnchor) && !ps.includes('StoredAvatarRenderer')) {
  ps = ps.replace(importAnchor, newImport);
  fixes++;
  console.log('FIX 1A: Avatar imports added');
} else if (ps.includes('StoredAvatarRenderer')) {
  console.log('SKIP 1A: Already present');
}

// 1B: Add state variables — find setMnemonicVisible line and insert after
if (!ps.includes('avatarIdentity')) {
  const mnemonicLine = ps.indexOf('setMnemonicVisible');
  if (mnemonicLine > -1) {
    const lineEnd = ps.indexOf('\n', ps.indexOf(');', mnemonicLine));
    const stateCode = `
  const [avatarIdentity, setAvatarIdentity] = useState<AvatarIdentity | null>(null);
  const [showLikeness, setShowLikeness] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUploadTx, setAvatarUploadTx] = useState<string | null>(null);
`;
    ps = ps.slice(0, lineEnd + 1) + stateCode + ps.slice(lineEnd + 1);
    fixes++;
    console.log('FIX 1B: State variables added');
  }
}

// 1C: Load avatar in loadProfile
if (!ps.includes('getStoredAvatar')) {
  const loadIdx = ps.indexOf('loadProfile');
  if (loadIdx > -1) {
    const fnStart = ps.indexOf('{', loadIdx);
    if (fnStart > -1) {
      ps = ps.slice(0, fnStart + 1) + `
    getStoredAvatar().then(id => { if (id) setAvatarIdentity(id); }).catch(() => {});
` + ps.slice(fnStart + 1);
      fixes++;
      console.log('FIX 1C: Avatar loading added');
    }
  }
}

// 1D: Add upload handler before the return statement
if (!ps.includes('handleUploadAvatar')) {
  const returnIdx = ps.lastIndexOf('return (');
  if (returnIdx > -1) {
    const handler = `  const handleUploadAvatar = async () => {
    if (!avatarIdentity) { Alert.alert('No Avatar', 'Complete the Identity Ritual first.'); return; }
    setAvatarUploading(true);
    try {
      const result = await uploadAvatarSVG({
        paths: avatarIdentity.paths, hash: avatarIdentity.hash,
        race: avatarIdentity.race, gender: avatarIdentity.gender, network: 'testnet-10',
      });
      if (result.success) {
        setAvatarUploadTx(result.svgTxId || null);
        Alert.alert('Uploaded!', 'Avatar SVG + paths on Arweave.\\nTX: ' + (result.svgTxId || '').slice(0, 20) + '...');
      } else { Alert.alert('Failed', result.error || 'Unknown error'); }
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Upload failed'); }
    finally { setAvatarUploading(false); }
  };

  `;
    ps = ps.slice(0, returnIdx) + handler + ps.slice(returnIdx);
    fixes++;
    console.log('FIX 1D: Upload handler added');
  }
}

// 1E: Add AvatarLikenessCard component before the main export
const likenessCard = `
const AvatarLikenessCard: React.FC<{
  identity: AvatarIdentity | null;
  showLikeness: boolean;
  onToggle: () => void;
  uploading: boolean;
  uploadTx: string | null;
  onUpload: () => void;
}> = ({ identity, showLikeness, onToggle, uploading, uploadTx, onUpload }) => {
  if (!identity) return null;

  return (
    <View style={styles.traitsCard}>
      <TouchableOpacity onPress={onToggle} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.cardTitle}>{showLikeness ? '\\u25BC' : '\\u25B6'} Avatar Likeness</Text>
        <Text style={{ color: '#A8A29E', fontSize: rs(11) }}>{showLikeness ? 'Hide' : 'Show'}</Text>
      </TouchableOpacity>

      {showLikeness && (
        <View style={{ alignItems: 'center', paddingVertical: rs(12) }}>
          <View style={{ 
            backgroundColor: '#0f0f23', borderRadius: rs(16), padding: rs(16),
            borderWidth: 1, borderColor: '#8b5cf6',
          }}>
            <StoredAvatarRenderer identity={identity} size={rs(200)} fillColor="#1a1a2e" strokeColor="#8b5cf6" />
          </View>
          <Text style={{ color: '#A8A29E', fontSize: rs(10), marginTop: rs(8) }}>
            {identity.race} | {identity.gender} | {identity.paths.length} paths
          </Text>
          <Text style={{ color: '#78716C', fontSize: rs(9), marginTop: rs(2) }}>
            Hash: {identity.hash.slice(0, 24)}...
          </Text>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.editButton, uploading && { opacity: 0.5 }]} 
        onPress={onUpload} disabled={uploading}
      >
        <Text style={styles.editButtonText}>
          {uploading ? 'Uploading...' : uploadTx ? 'Re-upload to Arweave' : 'Upload Likeness to Arweave'}
        </Text>
      </TouchableOpacity>

      {uploadTx && (
        <Text style={{ color: '#10B981', fontSize: rs(10), textAlign: 'center', marginTop: rs(8) }}>
          Uploaded: {uploadTx.slice(0, 24)}...
        </Text>
      )}
    </View>
  );
};
`;

if (!ps.includes('AvatarLikenessCard')) {
  const mainIdx = ps.indexOf('export const ProfileScreen');
  const altIdx = ps.indexOf('const ProfileScreen');
  const insertIdx = mainIdx > -1 ? mainIdx : altIdx;
  if (insertIdx > -1) {
    ps = ps.slice(0, insertIdx) + likenessCard + '\n' + ps.slice(insertIdx);
    fixes++;
    console.log('FIX 1E: AvatarLikenessCard component added');
  }
}

// 1F: Render AvatarLikenessCard after AvatarTraits
if (!ps.includes('<AvatarLikenessCard')) {
  const traitsIdx = ps.indexOf('<AvatarTraits');
  if (traitsIdx > -1) {
    const closingIdx = ps.indexOf('/>', traitsIdx);
    if (closingIdx > -1) {
      const insert = `\n            
            <AvatarLikenessCard 
              identity={avatarIdentity}
              showLikeness={showLikeness}
              onToggle={() => setShowLikeness(!showLikeness)}
              uploading={avatarUploading}
              uploadTx={avatarUploadTx}
              onUpload={handleUploadAvatar}
            />`;
      ps = ps.slice(0, closingIdx + 2) + insert + ps.slice(closingIdx + 2);
      fixes++;
      console.log('FIX 1F: AvatarLikenessCard rendered after AvatarTraits');
    }
  }
}

fs.writeFileSync('ProfileScreen.tsx', ps);

// ============================================================================
// PATCH 2: avatar_arweave_upload.ts — Add uploadAvatarSVG
// ============================================================================

let au = fs.readFileSync('avatar_arweave_upload.ts', 'utf8');

const svgUploadFn = `

// =============================================================================
// UPLOAD AVATAR SVG + PATHS FOR DEVELOPER ACCESS
// =============================================================================

export interface AvatarSVGUploadParams {
  paths: string[];
  hash: string;
  race: string;
  gender: string;
  network: string;
}

export interface AvatarSVGUploadResult {
  success: boolean;
  svgTxId?: string;
  pathsTxId?: string;
  svgUrl?: string;
  pathsUrl?: string;
  error?: string;
}

function buildSVGFromPaths(paths: string[], fill = '#1a1a2e', stroke = '#8b5cf6'): string {
  const p = paths.map(d => \`<path d="\${d}" fill="\${fill}" stroke="\${stroke}" stroke-width="0.5" opacity="0.95"/>\`).join('\\n');
  return \`<svg width="400" height="450" viewBox="0 0 400 450" xmlns="http://www.w3.org/2000/svg">\\n<g>\\n\${p}\\n</g>\\n</svg>\`;
}

/**
 * Upload avatar SVG + paths JSON to Arweave for developer access.
 * 
 * Creates two Arweave inscriptions:
 *   1. avatar-svg   (image/svg+xml)     — ready to display in any browser/webview
 *   2. avatar-paths  (application/json) — raw paths for custom-color rendering in games
 * 
 * Developer query:
 *   By pubkey:  tags: KV-Type=avatar-svg, KV-Pubkey={pubkey}
 *   By address: tags: KV-Type=avatar-svg, KV-Address={kaspa_address}
 *   Verify:     SHA256(JSON.stringify(paths)) === KV-Identity tag value
 */
export async function uploadAvatarSVG(params: AvatarSVGUploadParams): Promise<AvatarSVGUploadResult> {
  const { paths, hash, race, gender, network } = params;

  const privKeyHex = await SecureStore.getItemAsync('kv_private_key');
  const kaspaAddress = await SecureStore.getItemAsync('kaspa_address_tutorial') || '';
  const pubkey = await SecureStore.getItemAsync('kaspa_pubkey') || '';

  if (!privKeyHex) return { success: false, error: 'No private key found' };

  const commonTags: ArweaveTag[] = [
    { name: 'App-Name', value: 'KasVillage' },
    { name: 'KV-Identity', value: hash },
    { name: 'KV-Address', value: kaspaAddress },
    { name: 'KV-Pubkey', value: pubkey },
    { name: 'KV-Race', value: race },
    { name: 'KV-Gender', value: gender },
    { name: 'KV-Network', value: network },
    { name: 'KV-PathCount', value: String(paths.length) },
    { name: 'Unix-Time', value: String(Math.floor(Date.now() / 1000)) },
  ];

  try {
    // 1. SVG upload
    const svgStr = buildSVGFromPaths(paths);
    const svgBytes = new TextEncoder().encode(svgStr);
    const svgTags: ArweaveTag[] = [
      ...commonTags,
      { name: 'Content-Type', value: 'image/svg+xml' },
      { name: 'KV-Type', value: 'avatar-svg' },
    ];
    console.log('[AvatarSVG] Uploading SVG:', svgBytes.length, 'bytes');
    const svgItem = await buildAns104DataItem(svgBytes, svgTags, privKeyHex);
    const svgResult = await uploadToIrys(svgItem);
    if (!svgResult.success) return { success: false, error: 'SVG upload failed: ' + svgResult.error };
    console.log('[AvatarSVG] SVG uploaded:', svgResult.txId);

    // 2. Paths JSON upload
    const pathsPayload = JSON.stringify({ paths, hash, race, gender, pathCount: paths.length });
    const pathsBytes = new TextEncoder().encode(pathsPayload);
    const pathsTags: ArweaveTag[] = [
      ...commonTags,
      { name: 'Content-Type', value: 'application/json' },
      { name: 'KV-Type', value: 'avatar-paths' },
    ];
    console.log('[AvatarSVG] Uploading paths:', pathsBytes.length, 'bytes');
    const pathsItem = await buildAns104DataItem(pathsBytes, pathsTags, privKeyHex);
    const pathsResult = await uploadToIrys(pathsItem);
    if (!pathsResult.success) console.warn('[AvatarSVG] Paths failed (non-fatal):', pathsResult.error);
    else console.log('[AvatarSVG] Paths uploaded:', pathsResult.txId);

    return {
      success: true,
      svgTxId: svgResult.txId, pathsTxId: pathsResult?.txId,
      svgUrl: svgResult.arweaveUrl, pathsUrl: pathsResult?.arweaveUrl,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[AvatarSVG] Error:', error);
    return { success: false, error };
  }
}
`;

if (!au.includes('uploadAvatarSVG')) {
  au += svgUploadFn;
  fs.writeFileSync('avatar_arweave_upload.ts', au);
  fixes++;
  console.log('FIX 2: uploadAvatarSVG added to avatar_arweave_upload.ts');
} else {
  console.log('SKIP 2: Already exists');
}

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n=== ' + fixes + ' fixes applied ===');
console.log('\nProfileScreen behavior:');
console.log('  - "▶ Avatar Likeness" collapsed by default');
console.log('  - Tap to expand/collapse SVG preview');
console.log('  - "Upload Likeness to Arweave" button always visible');
console.log('  - No avatar = card hidden entirely');
console.log('\nArweave uploads (2 items):');
console.log('  1. avatar-svg   image/svg+xml   — browser-ready SVG');
console.log('  2. avatar-paths application/json — paths for game engines');
console.log('\nDeveloper API:');
console.log('  Query: KV-Type=avatar-svg + KV-Pubkey={pubkey}');
console.log('  Fetch: GET https://arweave.net/{txId}');
console.log('  Verify: SHA256(JSON.stringify(paths)) === KV-Identity');
console.log('\nVerify: npx tsc --noEmit --pretty 2>&1 | Select-String "error TS" | Select-Object -First 5');
