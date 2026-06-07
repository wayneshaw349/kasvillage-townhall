const fs = require('fs');
let s = fs.readFileSync('ProfileScreen.tsx', 'utf8');

// 1. Add missing state vars
if (!s.includes('avatarUploading')) {
  s = s.replace(
    'const [avatarIdentity, setAvatarIdentity] = useState<AvatarIdentity | null>(null);',
    'const [avatarUploading, setAvatarUploading] = useState(false);\n  const [avatarUploadTx, setAvatarUploadTx] = useState<string | null>(null);\n  const [avatarIdentity, setAvatarIdentity] = useState<AvatarIdentity | null>(null);'
  );
}

// 2. Stub recoverAvatarFromArweave
s = s.replace(
  /const recovery = await recoverAvatarFromArweave\(pubkey\);/g,
  'const recovery: any = { success: false, identity: null, arweaveTxId: null };'
);

// 3. Fix citadel_tier
s = s.replace(/realStats\.citadel_tier/g, '(realStats as any).citadel_tier');

// 4. Stub uploadAvatarSVG
if (!s.includes('uploadAvatarSVG stub')) {
  s = s.replace(
    'const result = await uploadAvatarSVG({',
    '// uploadAvatarSVG stub\n      const uploadAvatarSVG = async (p: any): Promise<{success:boolean;error?:string;svgTxId?:string|null}> => ({success:false,error:"Not wired",svgTxId:null});\n      const result = await uploadAvatarSVG({'
  );
}

fs.writeFileSync('ProfileScreen.tsx', s);
console.log('done');
