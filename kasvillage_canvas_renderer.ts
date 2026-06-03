// ============================================================================
// KasVillage Canvas Renderer + Sprite Sheet Cache
// Consumes kasvillage_avatar_engine.ts output → draws real SVG paths to Canvas
// Caches pre-rendered frames to expo-file-system (not SecureStore)
// SecureStore = keys/identity (encrypted). FileSystem = sprite cache (disposable).
// ============================================================================

import {
  KasVillageAvatar,
  AvatarData,
  DepthPath,
  AngleProjection,
  ShadedColor,
  AnimationPose,
  JointSet,
  SPRITE_SIZE,
  TOTAL_ANGLES,
  ANGLE_STEP,
  ALL_POSES,
  POSES_PER_ANGLE,
  TOTAL_FRAMES,
  applyPose,
  projectAngle,
  computeAvatarShading,
  computePathShading,
  ShadingPreset,
  lerpJoints,
  trailJoint,
  deriveJoints,
  deriveSideJoints,
  classifyPathDepth,
} from './kasvillage_avatar_engine';

// ============================================================================
// PATH TRANSFORM — apply angle projection to SVG path d-string coordinates
// ============================================================================

/**
 * Transform all coordinates in an SVG path d-string by compressing X
 * toward center based on viewing angle. This is what makes the flat
 * SVG look 3D when rotated.
 *
 * @param d       SVG path data string
 * @param angleDeg Viewing angle (0=front, 90=side, 180=back)
 * @param cx      Center X of the SVG (200 for KasVillage avatars)
 */
function transformPathForAngle(d: string, angleDeg: number, cx: number = 200): string {
  const rad = (angleDeg * Math.PI) / 180;
  const cosA = Math.abs(Math.cos(rad));
  const sinA = Math.abs(Math.sin(rad));
  // X compression: full width at front (0°), narrow at side (90°)
  const xScale = cosA + sinA * 0.3;
  // Flip X for angles 90-270 (facing away shows mirror)
  const flipX = Math.sin(rad) < -0.1 ? -1 : 1;

  // Replace all numeric X,Y coordinate pairs in path commands
  // Handles M, L, C, Q, S, T, A commands
  return d.replace(
    /(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/g,
    (_match, xStr, yStr) => {
      const x = parseFloat(xStr);
      const y = parseFloat(yStr);
      const newX = cx + (x - cx) * xScale * flipX;
      return `${newX.toFixed(2)},${y}`;
    }
  );
}

/**
 * Apply joint offset to all coordinates in a path.
 * Shifts the entire path by the joint's delta from base position.
 */
function translatePath(d: string, dx: number, dy: number): string {
  return d.replace(
    /(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/g,
    (_match, xStr, yStr) => {
      const x = parseFloat(xStr) + dx;
      const y = parseFloat(yStr) + dy;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }
  );
}

// ============================================================================
// REGION → JOINT MAPPING
// Which joint controls which body region's movement
// ============================================================================

function getJointForRegion(region: string, side: 'left' | 'right' | 'center'): keyof JointSet {
  switch (region) {
    case 'hair':
    case 'eyes':
    case 'eyebrows':
      return 'head';
    case 'lips':
    case 'skin':
      // Skin paths: face → head, neck → center_mass
      return 'head'; // conservative — most skin paths are face
    case 'primary':
      return 'center_mass'; // torso
    case 'secondary':
      // Legs
      return side === 'left' ? 'hip_L' : side === 'right' ? 'hip_R' : 'center_mass';
    case 'accent':
      // Feet
      return side === 'left' ? 'foot_L' : side === 'right' ? 'foot_R' : 'center_mass';
    default:
      return 'center_mass';
  }
}

// ============================================================================
// SINGLE FRAME RENDERER — draws one avatar at one angle + pose to Canvas
// ============================================================================

export interface RenderOptions {
  /** Sprite output size in pixels */
  size: number;
  /** Shading preset */
  shading: ShadingPreset;
  /** Draw joint debug markers */
  debugJoints: boolean;
  /** Background color (null = transparent) */
  background: string | null;
}

const DEFAULT_OPTIONS: RenderOptions = {
  size: SPRITE_SIZE,
  shading: 'daylight',
  debugJoints: false,
  background: null,
};

/**
 * Render a single frame of the avatar to an offscreen canvas.
 * Returns the canvas (for blitting or extracting image data).
 */
export function renderFrame(
  avatar: KasVillageAvatar,
  angleDeg: number,
  pose: AnimationPose,
  time: number = 0,
  options: Partial<RenderOptions> = {},
): OffscreenCanvas | HTMLCanvasElement {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const size = opts.size;

  // Create offscreen canvas
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(size, size)
    : (() => { const c = document.createElement('canvas'); c.width = size; c.height = size; return c; })();

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (!ctx) return canvas;

  // Background
  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, size, size);
  }

  // Scale: SVG is 400×450, fit into sprite size
  const svgW = 400, svgH = 450;
  const scale = Math.min(size / svgW, size / svgH);
  const offsetX = (size - svgW * scale) / 2;
  const offsetY = (size - svgH * scale) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Get projection (visibility + Z order)
  const projection = projectAngle(
    angleDeg,
    avatar.frontJoints,
    avatar.sideJoints,
    avatar.depthPaths
  );

  // Get posed joints
  const posedJoints = applyPose(projection.joints, pose, time);

  // Base joints (un-posed) for calculating deltas
  const baseProjection = projectAngle(
    angleDeg,
    avatar.frontJoints,
    avatar.sideJoints,
    avatar.depthPaths
  );

  // Compute shading
  const shading = computeAvatarShading(avatar, opts.shading);

  // Build draw list: visible paths sorted by Z
  const drawList: Array<{
    path: DepthPath;
    z: number;
    shade: ShadedColor;
    jointKey: keyof JointSet;
  }> = [];

  for (let i = 0; i < avatar.depthPaths.length; i++) {
    if (!projection.pathVisible[i]) continue;
    drawList.push({
      path: avatar.depthPaths[i],
      z: projection.pathZ[i],
      shade: shading[i],
      jointKey: getJointForRegion(avatar.depthPaths[i].region, avatar.depthPaths[i].side),
    });
  }

  drawList.sort((a, b) => a.z - b.z);

  // Draw shadow ellipse
  const cm = posedJoints.center_mass;
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  const cosA = Math.abs(Math.cos((angleDeg * Math.PI) / 180));
  ctx.ellipse(cm.x, 430, 35 * cosA + 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draw each path
  for (const item of drawList) {
    // 1. Transform path coordinates for angle
    let d = transformPathForAngle(item.path.d, angleDeg);

    // 2. Apply joint offset (pose delta)
    const baseJoint = baseProjection.joints[item.jointKey];
    const posedJoint = posedJoints[item.jointKey];
    if (baseJoint && posedJoint) {
      const dx = posedJoint.x - baseJoint.x;
      const dy = posedJoint.y - baseJoint.y;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        d = translatePath(d, dx, dy);
      }
    }

    // 3. Draw with shading
    const path2d = new Path2D(d);

    // Main fill
    ctx.fillStyle = item.shade.lit;
    ctx.fill(path2d);

    // Shadow pass (darker in crevices)
    if (item.shade.shadowOpacity > 0.1) {
      ctx.globalAlpha = item.shade.shadowOpacity * 0.3;
      ctx.fillStyle = item.shade.shadow;
      ctx.fill(path2d);
      ctx.globalAlpha = 1;
    }

    // Highlight pass (specular)
    if (item.shade.highlightOpacity > 0.1) {
      ctx.globalAlpha = item.shade.highlightOpacity * 0.25;
      ctx.fillStyle = item.shade.highlight;
      ctx.fill(path2d);
      ctx.globalAlpha = 1;
    }

    // Rim light (edge stroke)
    if (item.shade.rimOpacity > 0.05) {
      ctx.strokeStyle = item.shade.rim;
      ctx.lineWidth = 1;
      ctx.globalAlpha = item.shade.rimOpacity * 0.4;
      ctx.stroke(path2d);
      ctx.globalAlpha = 1;
    }

    // Base outline
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    ctx.stroke(path2d);
  }

  // Debug: draw joints
  if (opts.debugJoints) {
    for (const [key, pos] of Object.entries(posedJoints)) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = key === 'center_mass' ? '#FF0' : '#0FF';
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }

  ctx.restore();
  return canvas;
}

// ============================================================================
// SPRITE SHEET GENERATOR — pre-render all 1500 frames
// ============================================================================

export interface SpriteSheet {
  /** Width of each sprite */
  spriteSize: number;
  /** Total sprites */
  totalFrames: number;
  /** Angles rendered */
  angles: number;
  /** Poses per angle */
  posesPerAngle: number;
  /** The atlas canvas containing all sprites in a grid */
  atlas: HTMLCanvasElement | OffscreenCanvas;
  /** Grid columns in the atlas */
  cols: number;
  /** Grid rows in the atlas */
  rows: number;
}

/**
 * Pre-render all frames into a single atlas canvas.
 * Grid layout: cols = posesPerAngle (25), rows = angles (60)
 * Total atlas size: 25 * 128 = 3200 x 60 * 128 = 7680
 *
 * @param onProgress callback with 0.0–1.0 progress
 */
export async function generateSpriteSheet(
  avatar: KasVillageAvatar,
  shading: ShadingPreset = 'daylight',
  spriteSize: number = SPRITE_SIZE,
  onProgress?: (progress: number) => void,
): Promise<SpriteSheet> {
  const cols = POSES_PER_ANGLE;
  const rows = TOTAL_ANGLES;
  const atlasW = cols * spriteSize;
  const atlasH = rows * spriteSize;

  const atlas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(atlasW, atlasH)
    : (() => { const c = document.createElement('canvas'); c.width = atlasW; c.height = atlasH; return c; })();

  const ctx = atlas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (!ctx) throw new Error('Failed to create atlas canvas context');

  let rendered = 0;
  const total = TOTAL_FRAMES;

  for (let angleIdx = 0; angleIdx < TOTAL_ANGLES; angleIdx++) {
    const angleDeg = angleIdx * ANGLE_STEP;

    for (let poseIdx = 0; poseIdx < ALL_POSES.length; poseIdx++) {
      const pose = ALL_POSES[poseIdx];

      // Render single frame
      const frame = renderFrame(avatar, angleDeg, pose, 0, {
        size: spriteSize,
        shading,
        debugJoints: false,
        background: null,
      });

      // Blit to atlas position
      const x = poseIdx * spriteSize;
      const y = angleIdx * spriteSize;
      ctx.drawImage(frame as any, x, y);

      rendered++;
      if (onProgress && rendered % 25 === 0) {
        onProgress(rendered / total);
        // Yield to prevent blocking UI
        await new Promise(r => setTimeout(r, 0));
      }
    }
  }

  if (onProgress) onProgress(1);

  return {
    spriteSize,
    totalFrames: total,
    angles: TOTAL_ANGLES,
    posesPerAngle: POSES_PER_ANGLE,
    atlas,
    cols,
    rows,
  };
}

// ============================================================================
// SPRITE SHEET CACHE — expo-file-system (not SecureStore)
// 
// Sprite atlas is a rendered image — derived from avatar, not sensitive.
// Someone stealing the PNG gets a picture, can't reverse to keys.
// SecureStore holds keys/identity. FileSystem holds disposable cache.
// Delete cache → re-render from SecureStore data. No data loss.
// ============================================================================

import * as FileSystem from 'expo-file-system';

const CACHE_DIR = `${FileSystem.documentDirectory}kv_sprites/`;
const ATLAS_FILE = `${CACHE_DIR}atlas.png`;
const HOOKS_FILE = `${CACHE_DIR}hooks.json`;
const META_FILE = `${CACHE_DIR}meta.json`;

interface SpriteCacheMeta {
  avatarHash: string;
  shading: ShadingPreset;
  spriteSize: number;
  totalFrames: number;
  cols: number;
  rows: number;
  createdAt: number;
}

/** Ensure cache directory exists */
async function ensureCacheDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

/**
 * Save a rendered sprite sheet to FileSystem.
 * Single PNG file — no chunking needed, no size limits.
 */
export async function cacheSpriteSheet(
  sheet: SpriteSheet,
  avatarHash: string,
  shading: ShadingPreset,
): Promise<void> {
  await ensureCacheDir();

  // Convert atlas to base64 PNG
  let base64: string;

  if ('convertToBlob' in sheet.atlas) {
    const blob = await (sheet.atlas as OffscreenCanvas).convertToBlob({ type: 'image/png' });
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    base64 = btoa(binary);
  } else {
    const dataUrl = (sheet.atlas as HTMLCanvasElement).toDataURL('image/png');
    base64 = dataUrl.split(',')[1];
  }

  // Write atlas PNG
  await FileSystem.writeAsStringAsync(ATLAS_FILE, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Write metadata
  const meta: SpriteCacheMeta = {
    avatarHash,
    shading,
    spriteSize: sheet.spriteSize,
    totalFrames: sheet.totalFrames,
    cols: sheet.cols,
    rows: sheet.rows,
    createdAt: Date.now(),
  };
  await FileSystem.writeAsStringAsync(META_FILE, JSON.stringify(meta));
}

/**
 * Save hook positions alongside the atlas.
 * Joint coordinates per angle/pose — just numbers, not sensitive.
 */
export async function cacheHookData(
  avatar: KasVillageAvatar,
): Promise<void> {
  await ensureCacheDir();

  const hooks: Record<string, Record<string, { x: number; y: number }>> = {};

  for (let angleIdx = 0; angleIdx < TOTAL_ANGLES; angleIdx++) {
    const angleDeg = angleIdx * ANGLE_STEP;
    for (const pose of ALL_POSES) {
      const proj = projectAngle(angleDeg, avatar.frontJoints, avatar.sideJoints, avatar.depthPaths);
      const posedJoints = applyPose(proj.joints, pose, 0);
      const key = `${angleDeg}_${pose}`;
      hooks[key] = {};
      for (const [jointName, pos] of Object.entries(posedJoints)) {
        hooks[key][jointName] = { x: Math.round(pos.x * 10) / 10, y: Math.round(pos.y * 10) / 10 };
      }
    }
  }

  await FileSystem.writeAsStringAsync(HOOKS_FILE, JSON.stringify(hooks));
}

/**
 * Load cached hook data.
 */
export async function loadCachedHooks(): Promise<Record<string, Record<string, { x: number; y: number }>> | null> {
  try {
    const info = await FileSystem.getInfoAsync(HOOKS_FILE);
    if (!info.exists) return null;
    const json = await FileSystem.readAsStringAsync(HOOKS_FILE);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Load a cached sprite sheet from FileSystem.
 * Returns null if no cache exists or avatar has changed.
 */
export async function loadCachedSpriteSheet(
  avatarHash: string,
  shading: ShadingPreset,
): Promise<SpriteSheet | null> {
  try {
    // Check meta
    const metaInfo = await FileSystem.getInfoAsync(META_FILE);
    if (!metaInfo.exists) return null;

    const metaStr = await FileSystem.readAsStringAsync(META_FILE);
    const meta: SpriteCacheMeta = JSON.parse(metaStr);
    if (meta.avatarHash !== avatarHash || meta.shading !== shading) return null;

    // Check atlas exists
    const atlasInfo = await FileSystem.getInfoAsync(ATLAS_FILE);
    if (!atlasInfo.exists) return null;

    // Read atlas as base64
    const base64 = await FileSystem.readAsStringAsync(ATLAS_FILE, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Decode base64 → Image → Canvas
    const atlas = await new Promise<HTMLCanvasElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        if (!ctx) { reject(new Error('No 2d context')); return; }
        ctx.drawImage(img, 0, 0);
        resolve(c);
      };
      img.onerror = reject;
      img.src = `data:image/png;base64,${base64}`;
    });

    return {
      spriteSize: meta.spriteSize,
      totalFrames: meta.totalFrames,
      angles: TOTAL_ANGLES,
      posesPerAngle: POSES_PER_ANGLE,
      atlas,
      cols: meta.cols,
      rows: meta.rows,
    };
  } catch {
    return null;
  }
}

/**
 * Clear cached sprite sheet and hooks.
 * Avatar data in SecureStore is untouched — only disposable cache is deleted.
 */
export async function clearSpriteCache(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (info.exists) {
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    }
  } catch {
    // Silent fail on cache clear
  }
}

/**
 * Get cache size in bytes (for storage management UI).
 */
export async function getSpriteCacheSize(): Promise<number> {
  try {
    const atlasInfo = await FileSystem.getInfoAsync(ATLAS_FILE);
    const hooksInfo = await FileSystem.getInfoAsync(HOOKS_FILE);
    let total = 0;
    if (atlasInfo.exists && 'size' in atlasInfo) total += atlasInfo.size || 0;
    if (hooksInfo.exists && 'size' in hooksInfo) total += hooksInfo.size || 0;
    return total;
  } catch {
    return 0;
  }
}

// ============================================================================
// GAME RENDERER — blits from sprite sheet to game canvas
// ============================================================================

/**
 * Blit a single sprite from the atlas to the game canvas.
 * This is what runs every frame at 60fps — just one drawImage call.
 */
export function blitSprite(
  gameCtx: CanvasRenderingContext2D,
  sheet: SpriteSheet,
  angleIdx: number,
  poseIdx: number,
  destX: number,
  destY: number,
  scale: number = 1,
  flipX: boolean = false,
): void {
  const srcX = poseIdx * sheet.spriteSize;
  const srcY = angleIdx * sheet.spriteSize;
  const destW = sheet.spriteSize * scale;
  const destH = sheet.spriteSize * scale;

  gameCtx.save();

  if (flipX) {
    gameCtx.translate(destX + destW, destY);
    gameCtx.scale(-1, 1);
    gameCtx.drawImage(
      sheet.atlas as any,
      srcX, srcY, sheet.spriteSize, sheet.spriteSize,
      0, 0, destW, destH,
    );
  } else {
    gameCtx.drawImage(
      sheet.atlas as any,
      srcX, srcY, sheet.spriteSize, sheet.spriteSize,
      destX, destY, destW, destH,
    );
  }

  gameCtx.restore();
}

/**
 * Blit by angle (degrees) and pose name — convenience wrapper.
 */
export function blitByAngleAndPose(
  gameCtx: CanvasRenderingContext2D,
  sheet: SpriteSheet,
  angleDeg: number,
  pose: AnimationPose,
  destX: number,
  destY: number,
  scale: number = 1,
  flipX: boolean = false,
): void {
  const angleIdx = Math.round(((angleDeg % 360 + 360) % 360) / ANGLE_STEP) % TOTAL_ANGLES;
  const poseIdx = ALL_POSES.indexOf(pose);
  if (poseIdx < 0) return;
  blitSprite(gameCtx, sheet, angleIdx, poseIdx, destX, destY, scale, flipX);
}

// ============================================================================
// FULL PIPELINE — one function from wallet to game-ready
// ============================================================================

/**
 * Load avatar from wallet → check cache → render if needed → return sheet.
 * This is the single entry point for any game developer.
 *
 * Usage:
 *   const { avatar, sheet } = await prepareAvatar('daylight', (p) => setProgress(p));
 *   // Game loop:
 *   blitByAngleAndPose(ctx, sheet, facing, pose, x, y);
 */
export async function prepareAvatar(
  avatarData: AvatarData,
  shading: ShadingPreset = 'daylight',
  onProgress?: (progress: number) => void,
): Promise<{ avatar: KasVillageAvatar; sheet: SpriteSheet }> {
  const avatar = new KasVillageAvatar(avatarData);

  // Check cache (FileSystem — fast, unlimited size)
  const hash = `${avatarData.race}_${avatarData.gender}_${avatarData.paths.length}`;
  const cached = await loadCachedSpriteSheet(hash, shading);
  if (cached) {
    if (onProgress) onProgress(1);
    return { avatar, sheet: cached };
  }

  // Generate fresh sprite sheet
  const sheet = await generateSpriteSheet(avatar, shading, SPRITE_SIZE, onProgress);

  // Cache to FileSystem for next time (non-blocking)
  try {
    await cacheSpriteSheet(sheet, hash, shading);
    await cacheHookData(avatar);
  } catch {
    // Cache failure is non-fatal — re-renders next launch
  }

  return { avatar, sheet };
}
