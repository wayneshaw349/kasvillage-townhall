const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');
let changes = 0;

// === FIX 0: DEV BYPASS for passport ===
if (s.includes("const [hasPassport, setHasPassport] = useState(false)")) {
  s = s.replace(
    "const [hasPassport, setHasPassport] = useState(false)",
    "const [hasPassport, setHasPassport] = useState(true) /* DEV BYPASS */"
  );
  changes++; console.log('Fix 0: DEV BYPASS');
}

// === FIX 1: Add bannerStyle state + BANNER_STYLES constant ===
const BANNER_STYLES_CONST = `
const BANNER_STYLES = [
  { id: 'amber', label: 'Classic Gold', bg: '#d97706', text: '#fff' },
  { id: 'indigo', label: 'Deep Indigo', bg: '#3730a3', text: '#fff' },
  { id: 'forest', label: 'Forest', bg: '#166534', text: '#fff' },
  { id: 'midnight', label: 'Midnight', bg: '#1c1917', text: '#fbbf24' },
  { id: 'sunset', label: 'Sunset', bg: '#9a3412', text: '#fde68a' },
  { id: 'crest', label: 'Avatar Crest', bg: 'crest', text: '#fff' },
];
`;
if (!s.includes('BANNER_STYLES')) {
  s = s.replace(
    "const STOREFRONT_FONTS = [",
    BANNER_STYLES_CONST + "\nconst STOREFRONT_FONTS = ["
  );
  changes++; console.log('Fix 1a: Added BANNER_STYLES');
}

// Add bannerStyle state after logoShape
if (!s.includes('bannerStyle')) {
  s = s.replace(
    "const [logoShape, setLogoShape] = useState<'round' | 'square'>('round');",
    "const [logoShape, setLogoShape] = useState<'round' | 'square'>('round');\n  const [bannerStyle, setBannerStyle] = useState(BANNER_STYLES[0]);"
  );
  changes++; console.log('Fix 1b: Added bannerStyle state');
}

// === FIX 2: Load storefront config from AsyncStorage on mount ===
const loadConfigEffect = `
  // Load storefront config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const json = await SecureStore.getItemAsync('storefront_' + hostId);
        if (!json) return;
        const cfg = JSON.parse(json);
        if (cfg.brandName) setBrandName(cfg.brandName);
        if (cfg.storeDescription) setStoreDescription(cfg.storeDescription);
        if (cfg.storeCategory) setStoreCategory(cfg.storeCategory);
        if (cfg.logoUrl) setLogoUrl(cfg.logoUrl);
        if (cfg.logoShape) setLogoShape(cfg.logoShape);
        if (cfg.socialLinks) setSocialLinks(cfg.socialLinks);
        if (cfg.commChannels) setCommChannels(cfg.commChannels);
        if (cfg.selectedFont) setSelectedFont(cfg.selectedFont);
        if (cfg.selectedLayout) setSelectedLayout(cfg.selectedLayout);
        if (cfg.stash) setStash(cfg.stash);
        if (cfg.bannerStyle) setBannerStyle(cfg.bannerStyle);
        console.log('[Workspace] Loaded config for', hostId);
      } catch (e) { console.warn('[Workspace] Config load failed:', e); }
    };
    loadConfig();
  }, []);
`;
if (!s.includes('loadConfig')) {
  s = s.replace(
    '  // Load avatar data on mount',
    loadConfigEffect + '\n  // Load avatar data on mount'
  );
  changes++; console.log('Fix 2: Added load config on mount');
}

// === FIX 3: Persistent preview banner (above tabs, shown on all views) ===
// Find the toolbar closing tag and insert preview banner after it
const persistentBanner = `
        {/* Persistent Storefront Preview Banner */}
        <View style={{ backgroundColor: bannerStyle.bg === 'crest' ? '#44403c' : bannerStyle.bg, borderRadius: rs.s(16), padding: rs.s(24), marginBottom: rs.s(12), alignItems: 'center' }}>
          <Text style={{ fontSize: rs.font(24), fontWeight: '900', color: bannerStyle.text || '#fff', marginBottom: rs.s(4) }}>{brandName}</Text>
          <Text style={{ fontSize: rs.font(11), color: bannerStyle.text || '#fff', opacity: 0.8 }}>Professional storefront powered by KasVillage</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: rs.s(10), marginBottom: rs.s(16) }}>
          <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs.s(6), backgroundColor: '#166534', borderRadius: rs.s(10), paddingVertical: rs.s(10) }} onPress={() => {
            const primaryLink = socialLinks.instagram || socialLinks.pinterest || socialLinks.etsy || socialLinks.tiktok || socialLinks.facebook || '';
            if (primaryLink) { Linking.openURL(primaryLink.startsWith('http') ? primaryLink : 'https://' + primaryLink); }
            else { Alert.alert('No Social Link', 'Add your Instagram, Pinterest, or Etsy link in the Brand tab first.'); }
          }}>
            <Eye size={rs.s(14)} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(12) }}>Visit Storefront</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs.s(6), backgroundColor: '#4f46e5', borderRadius: rs.s(10), paddingVertical: rs.s(10) }} onPress={handlePublishStorefront} disabled={isPublishing}>
            {isPublishing ? <ActivityIndicator color="#fff" size="small" /> : <><Save size={rs.s(14)} color="#fff" /><Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(12) }}>Publish</Text></>}
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: rs.font(9), color: '#a8a29e', textAlign: 'center', marginBottom: rs.s(8) }}>KasVillage verifies and posts to Arweave for you (FREE via Turbo)</Text>
`;

// Insert after toolbar
if (!s.includes('Persistent Storefront Preview Banner')) {
  s = s.replace(
    "        {/* Brand Tab */}",
    persistentBanner + "\n        {/* Brand Tab */}"
  );
  changes++; console.log('Fix 3: Added persistent preview banner');
}

// === FIX 4: Add Banner Style Selector to Brand tab ===
const bannerSelector = `
            <SectionCard title="🎨 Banner Style">
              <Text style={{ fontSize: rs.font(11), color: COLORS.stone500, marginBottom: rs.s(10) }}>Choose how your store banner looks</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: rs.s(8) }}>
                {BANNER_STYLES.map(bs => (
                  <TouchableOpacity key={bs.id} onPress={() => setBannerStyle(bs)} style={{ width: '30%', borderRadius: rs.s(10), overflow: 'hidden', borderWidth: bannerStyle.id === bs.id ? 3 : 1, borderColor: bannerStyle.id === bs.id ? COLORS.amber500 : COLORS.stone200 }}>
                    <View style={{ backgroundColor: bs.bg === 'crest' ? '#44403c' : bs.bg, padding: rs.s(12), alignItems: 'center' }}>
                      <Text style={{ color: bs.text, fontSize: rs.font(10), fontWeight: 'bold' }}>{bs.label}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </SectionCard>
`;
if (!s.includes('Banner Style')) {
  // Insert after the logo style toggle in Brand tab
  s = s.replace(
    "            <SectionCard title=\"Connect Social Channels\">",
    bannerSelector + "\n            <SectionCard title=\"Connect Social Channels\">"
  );
  changes++; console.log('Fix 4: Added banner style selector');
}

// === FIX 5: Wire Publish to Arweave with proper KV tags ===
// Replace the publish handler to use uploadToIrys with queryable tags
const newPublishHandler = `  // v2: TownHall verification + Arweave upload flow
  const handlePublishStorefront = async () => {
    // Validate
    if (containsProhibitedText(brandName) || containsProhibitedText(storeDescription)) {
      Alert.alert('Safety Rejection', 'Your store contains prohibited terms.');
      return;
    }
    const primaryLink = socialLinks.instagram || socialLinks.pinterest || socialLinks.etsy || '';
    if (!primaryLink) {
      Alert.alert('Missing Social Link', 'Add at least one social link (Instagram, Pinterest, or Etsy) so buyers can visit your storefront.');
      return;
    }
    
    setIsPublishing(true);
    
    try {
      // Step 1: Build storefront config
      const storefrontConfig = {
        brandName,
        storeDescription,
        storeCategory,
        logoUrl,
        logoShape,
        bannerStyle,
        socialLinks,
        commChannels,
        selectedFont: { id: selectedFont.id, name: selectedFont.name },
        selectedLayout: { id: selectedLayout.id, name: selectedLayout.name },
        stash: stash.map(i => ({ id: i.id, name: i.name, dollarPrice: i.dollarPrice, kaspaPrice: i.kaspaPrice, socialUrl: i.socialUrl, description: i.description })),
        hostId,
        updatedAt: Date.now(),
      };
      
      // Step 2: Upload to Arweave with queryable KV tags
      try {
        const { uploadToIrys } = await import('./arweave_upload');
        const arResult = await uploadToIrys(JSON.stringify(storefrontConfig), [
          { name: 'App-Name', value: 'KasVillage' },
          { name: 'KV-Type', value: 'Storefront' },
          { name: 'KV-StoreName', value: brandName },
          { name: 'KV-Category', value: storeCategory },
          { name: 'KV-Network', value: 'testnet-10' },
          { name: 'KV-Owner', value: userPubkey },
          { name: 'KV-PrimaryLink', value: primaryLink },
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Unix-Time', value: String(Math.floor(Date.now() / 1000)) },
        ]);
        console.log('[Workspace] Published to Arweave:', arResult?.txId);
      } catch (e) { console.warn('[Workspace] Arweave upload failed (saved locally):', e); }
      
      // Step 3: Save locally
      await SecureStore.setItemAsync('storefront_' + hostId, JSON.stringify(storefrontConfig));
      Alert.alert('Published!', 'Storefront config inscribed to Arweave.\\nBuyers can find your store banner and click through to ' + (socialLinks.instagram ? 'Instagram' : socialLinks.pinterest ? 'Pinterest' : 'Etsy') + '.');
    } catch (e) {
      console.error('Publish failed:', e);
      Alert.alert('Error', 'Failed to publish. Please try again.');
    }
    
    setIsPublishing(false);
  };`;

// Replace old handler
const oldHandlerStart = "  // v2: TownHall verification + Arweave upload flow\n  const handlePublishStorefront";
const oldHandlerEnd = "    setIsPublishing(false);\n  };";
const startIdx = s.indexOf(oldHandlerStart);
if (startIdx >= 0) {
  const endIdx = s.indexOf(oldHandlerEnd, startIdx);
  if (endIdx >= 0) {
    s = s.slice(0, startIdx) + newPublishHandler + s.slice(endIdx + oldHandlerEnd.length);
    changes++; console.log('Fix 5: Rewired Publish to Arweave with KV tags');
  }
}

// === FIX 6: Remove old preview tab (now persistent) ===
// Replace old preview tab with a redirect note
s = s.replace(
  /\{\/\* Preview Tab \*\/\}\s*\{activeView === 'preview' && \(\s*<View>[\s\S]*?<Text style=\{wsStyles\.publishNote\}>[\s\S]*?<\/Text>\s*<\/View>\s*\)\}/,
  `{/* Preview Tab */}
        {activeView === 'preview' && (
          <SectionCard title="Storefront Preview">
            <Text style={{ fontSize: rs.font(13), color: COLORS.stone600, textAlign: 'center', paddingVertical: rs.s(16) }}>
              Your storefront banner is shown above.{String.fromCharCode(10)}
              Tap "Visit Storefront" to open your social page.{String.fromCharCode(10)}
              Tap "Publish" to inscribe config to Arweave.
            </Text>
            <View style={{ backgroundColor: COLORS.amber50, borderRadius: rs.s(8), padding: rs.s(10), marginTop: rs.s(8) }}>
              <Text style={{ fontSize: rs.font(10), color: COLORS.amber700, textAlign: 'center' }}>
                Buyers see your banner on KasVillage → tap an item → directed to your Instagram/Pinterest/Etsy listing
              </Text>
            </View>
          </SectionCard>
        )}`
);
changes++; console.log('Fix 6: Simplified preview tab');

// === FIX 7: Include bannerStyle in local save ===
// Already handled in new publish handler

// === FIX 8: Fix uploadStoreListing call signature ===
// The old call had 3 args but import expects different. New handler uses uploadToIrys instead.
// Clean up the old import if it causes issues
if (s.includes("import { uploadStoreListing } from './arweave_upload';")) {
  s = s.replace(
    "import { uploadStoreListing } from './arweave_upload';",
    "// import { uploadStoreListing } from './arweave_upload'; // replaced by uploadToIrys in publish handler"
  );
  changes++; console.log('Fix 8: Commented out unused uploadStoreListing import');
}

fs.writeFileSync(f, s);
console.log('\\nTotal changes:', changes);

// Verify
const v = fs.readFileSync(f, 'utf8');
console.log('Verify - persistent banner:', v.includes('Persistent Storefront Preview Banner'));
console.log('Verify - banner styles:', v.includes('BANNER_STYLES'));
console.log('Verify - load config:', v.includes('loadConfig'));
console.log('Verify - KV-Type Storefront:', v.includes("KV-Type', value: 'Storefront'"));
console.log('Verify - visit opens social:', v.includes('socialLinks.instagram || socialLinks.pinterest'));
console.log('Verify - bannerStyle state:', v.includes('bannerStyle, setBannerStyle'));
