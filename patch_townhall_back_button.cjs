/**
 * patch_townhall_back_button.cjs
 * Adds onClose prop + ← Back button to TownHallScreen
 * Run: node patch_townhall_back_button.cjs
 */
const fs = require('fs');
const path = require('path');
const FILE = path.resolve(__dirname, 'townhallscreen.tsx');
let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('onClose?: () => void')) {
  console.log('[Patch] Already applied. Skipping.');
  process.exit(0);
}

// 1. Add onClose to props interface
const propsAnchor = `interface TownHallScreenProps {
  // No wallet send/receive - this is for verification proofs
}`;
if (!src.includes(propsAnchor)) {
  console.error('[Patch] Cannot find TownHallScreenProps. Aborting.');
  process.exit(1);
}
src = src.replace(propsAnchor, `interface TownHallScreenProps {
  onClose?: () => void;
}`);
console.log('[Patch] 1/3 Added onClose to props interface');

// 2. Destructure onClose in component
const compAnchor = 'export const TownHallScreen: React.FC<TownHallScreenProps> = () => {';
if (!src.includes(compAnchor)) {
  console.error('[Patch] Cannot find component signature. Aborting.');
  process.exit(1);
}
src = src.replace(compAnchor, 'export const TownHallScreen: React.FC<TownHallScreenProps> = ({ onClose }) => {');
console.log('[Patch] 2/3 Destructured onClose prop');

// 3. Add back button to titleBar
const titleAnchor = `        {/* Title */}
        <View style={styles.titleBar}>
          <Building2 size={rs.s(24)} color={COLORS.amber600} />
          <Text style={styles.title}>Town Hall</Text>
        </View>`;
if (!src.includes(titleAnchor)) {
  console.error('[Patch] Cannot find titleBar. Aborting.');
  process.exit(1);
}
src = src.replace(titleAnchor, `        {/* Title */}
        <View style={styles.titleBar}>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={{ paddingRight: 12, paddingVertical: 4 }}>
              <Text style={{ fontSize: 16, color: COLORS.amber600, fontWeight: 'bold' }}>\u2190 Back</Text>
            </TouchableOpacity>
          )}
          <Building2 size={rs.s(24)} color={COLORS.amber600} />
          <Text style={styles.title}>Town Hall</Text>
        </View>`);
console.log('[Patch] 3/3 Added Back button to titleBar');

fs.writeFileSync(FILE, src, 'utf8');
console.log('[Patch] \u2705 TownHallScreen patched — onClose wired + back button added');
