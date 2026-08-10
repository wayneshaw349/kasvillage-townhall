
// ============================================================================
// SPRITE CACHE — AsyncStorage persistence for instant game loads
// ============================================================================

const CACHE_KEY = 'kv_avatar_sprite_cache';
const CACHE_VERSION = '2';

interface CachedProjection {
  pathVisible: boolean[];
  pathZ: number[];
}

interface SpriteCache {
  version: string;
  race: string;
  gender: string;
  pathCount: number;
  projections: CachedProjection[];
}

/**
 * Build cache from a loaded avatar — pre-computes all 60 angle projections.
 */
export function buildSpriteCache(avatar: KasVillageAvatar): SpriteCache {
  const projections: CachedProjection[] = [];
  for (let a = 0; a < TOTAL_ANGLES; a++) {
    const deg = a * ANGLE_STEP;
    const proj = projectAngle(deg, avatar.frontJoints, avatar.sideJoints, avatar.depthPaths);
    projections.push({ pathVisible: proj.pathVisible, pathZ: proj.pathZ });
  }
  return {
    version: CACHE_VERSION,
    race: avatar.data.race,
    gender: avatar.data.gender,
    pathCount: avatar.data.paths.length,
    projections,
  };
}

export async function saveSpriteCache(cache: SpriteCache): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export async function loadSpriteCache(): Promise<SpriteCache | null> {
  try {
    const json = await AsyncStorage.getItem(CACHE_KEY);
    if (!json) return null;
    const cache: SpriteCache = JSON.parse(json);
    if (cache.version !== CACHE_VERSION) return null;
    return cache;
  } catch {
    return null;
  }
}

export async function clearSpriteCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
}

export function getCachedProjection(
  cache: SpriteCache | null,
  angleIndex: number,
  avatar: KasVillageAvatar
): { pathVisible: boolean[]; pathZ: number[] } {
  if (cache && cache.projections[angleIndex]) {
    return cache.projections[angleIndex];
  }
  const deg = angleIndex * ANGLE_STEP;
  const proj = projectAngle(deg, avatar.frontJoints, avatar.sideJoints, avatar.depthPaths);
  return { pathVisible: proj.pathVisible, pathZ: proj.pathZ };
}

// ============================================================================
// CHESS PIECE HELPERS
// ============================================================================

/**
 * Get SVG string for a chess piece at a given facing direction.
 */
export function getChessPieceSVG(
  avatar: KasVillageAvatar,
  facingDeg: number,
  pose: AnimationPose = 'idle',
  size: number = 48,
): string {
  const proj = projectAngle(facingDeg, avatar.frontJoints, avatar.sideJoints, avatar.depthPaths);
  const drawOrder = avatar.depthPaths
    .map((dp, i) => ({ ...dp, z: proj.pathZ[i], visible: proj.pathVisible[i] }))
    .filter(dp => dp.visible)
    .sort((a, b) => a.z - b.z);

  const pathEls = drawOrder.map(dp => {
    const fill = avatar.data.colors[dp.region] || '#1a1a2e';
    return '<path d="' + dp.d + '" fill="' + fill + '" stroke="#333" stroke-width="0.5" opacity="0.95"/>';
  }).join('\n');

  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 400 450" xmlns="http://www.w3.org/2000/svg">\n<g>\n' + pathEls + '\n</g>\n</svg>';
}

/**
 * Get renderable path data for React Native SVG chess pieces.
 *
 * Usage in GameScreen.tsx:
 *   const paths = getSpritePaths(avatar, 90, 'idle');
 *   <Svg width={48} height={48} viewBox="0 0 400 450">
 *     {paths.map((p, i) => (
 *       <Path key={i} d={p.d} fill={p.fill} stroke={p.stroke} />
 *     ))}
 *   </Svg>
 */
export function getSpritePaths(
  avatar: KasVillageAvatar,
  facingDeg: number,
  pose: AnimationPose = 'idle',
  strokeColor: string = '#333',
): Array<{ d: string; fill: string; stroke: string; z: number }> {
  const proj = projectAngle(facingDeg, avatar.frontJoints, avatar.sideJoints, avatar.depthPaths);

  return avatar.depthPaths
    .map((dp, i) => ({
      d: dp.d,
      fill: avatar.data.colors[dp.region] || '#1a1a2e',
      stroke: strokeColor,
      z: proj.pathZ[i],
      _visible: proj.pathVisible[i],
    }))
    .filter(p => p._visible)
    .sort((a, b) => a.z - b.z)
    .map(({ d, fill, stroke, z }) => ({ d, fill, stroke, z }));
}

/**
 * Initialize avatar engine with caching. One-call setup for games.
 */
export async function initGameAvatar(): Promise<KasVillageAvatar | null> {
  const avatar = await loadAvatarFromWallet();
  if (!avatar) return null;

  const cached = await loadSpriteCache();
  if (!cached || cached.race !== avatar.data.race || cached.gender !== avatar.data.gender || cached.pathCount !== avatar.data.paths.length) {
    const freshCache = buildSpriteCache(avatar);
    await saveSpriteCache(freshCache);
  }

  return avatar;
}
