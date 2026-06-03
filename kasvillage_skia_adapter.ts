// ============================================================================
// KasVillage Skia Adapter
// Translates Canvas API → @shopify/react-native-skia
// Drop-in replacement for browser Canvas rendering
// Install: npx expo install @shopify/react-native-skia
// ============================================================================

import {
  Skia,
  SkCanvas,
  SkPaint,
  SkPath,
  PaintStyle,
  BlendMode,
  SkImage,
  SkSurface,
} from '@shopify/react-native-skia';

import {
  KasVillageAvatar,
  AvatarData,
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
  ShadingPreset,
  ShadedColor,
  DepthPath,
} from './kasvillage_avatar_engine';

// ============================================================================
// PAINT FACTORY — reusable paint objects (avoid GC pressure per frame)
// ============================================================================

function makeFillPaint(color: string, alpha: number = 1): SkPaint {
  const paint = Skia.Paint();
  paint.setStyle(PaintStyle.Fill);
  paint.setColor(Skia.Color(color));
  paint.setAlphaf(alpha);
  paint.setAntiAlias(true);
  return paint;
}

function makeStrokePaint(color: string, width: number, alpha: number = 1): SkPaint {
  const paint = Skia.Paint();
  paint.setStyle(PaintStyle.Stroke);
  paint.setColor(Skia.Color(color));
  paint.setStrokeWidth(width);
  paint.setAlphaf(alpha);
  paint.setAntiAlias(true);
  return paint;
}

// ============================================================================
// PATH TRANSFORM — same logic as canvas renderer, returns SkPath
// ============================================================================

/** Transform SVG path d-string coordinates for angle projection */
function transformPathForAngle(d: string, angleDeg: number, cx: number = 200): string {
  const rad = (angleDeg * Math.PI) / 180;
  const cosA = Math.abs(Math.cos(rad));
  const sinA = Math.abs(Math.sin(rad));
  const xScale = cosA + sinA * 0.3;
  const flipX = Math.sin(rad) < -0.1 ? -1 : 1;

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

/** Translate all coordinates by dx, dy */
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

/** Convert SVG d-string to SkPath */
function svgToSkPath(d: string): SkPath | null {
  return Skia.Path.MakeFromSVGString(d);
}

/** Region → joint mapping (same as canvas renderer) */
function getJointForRegion(region: string, side: 'left' | 'right' | 'center'): keyof JointSet {
  switch (region) {
    case 'hair': case 'eyes': case 'eyebrows': return 'head';
    case 'lips': case 'skin': return 'head';
    case 'primary': return 'center_mass';
    case 'secondary':
      return side === 'left' ? 'hip_L' : side === 'right' ? 'hip_R' : 'center_mass';
    case 'accent':
      return side === 'left' ? 'foot_L' : side === 'right' ? 'foot_R' : 'center_mass';
    default: return 'center_mass';
  }
}

// ============================================================================
// SINGLE FRAME RENDERER — draws one avatar frame to SkCanvas
// ============================================================================

export interface SkiaRenderOptions {
  size: number;
  shading: ShadingPreset;
  debugJoints: boolean;
}

const DEFAULT_SKIA_OPTIONS: SkiaRenderOptions = {
  size: SPRITE_SIZE,
  shading: 'daylight',
  debugJoints: false,
};

/**
 * Render a single avatar frame to an offscreen Skia surface.
 * Returns SkImage that can be drawn to screen or saved to file.
 */
export function renderFrameSkia(
  avatar: KasVillageAvatar,
  angleDeg: number,
  pose: AnimationPose,
  time: number = 0,
  options: Partial<SkiaRenderOptions> = {},
): SkImage | null {
  const opts = { ...DEFAULT_SKIA_OPTIONS, ...options };
  const size = opts.size;

  // Create offscreen surface
  const surface = Skia.Surface.MakeOffscreen(size, size);
  if (!surface) return null;
  const canvas = surface.getCanvas();

  // Scale: SVG is 400×450, fit into sprite size
  const svgW = 400, svgH = 450;
  const scale = Math.min(size / svgW, size / svgH);
  const offsetX = (size - svgW * scale) / 2;
  const offsetY = (size - svgH * scale) / 2;

  canvas.save();
  canvas.translate(offsetX, offsetY);
  canvas.scale(scale, scale);

  // Get projection
  const projection = projectAngle(angleDeg, avatar.frontJoints, avatar.sideJoints, avatar.depthPaths);
  const posedJoints = applyPose(projection.joints, pose, time);
  const baseProjection = projectAngle(angleDeg, avatar.frontJoints, avatar.sideJoints, avatar.depthPaths);

  // Compute shading
  const shading = computeAvatarShading(avatar, opts.shading);

  // Build draw list
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
  const cosA = Math.abs(Math.cos((angleDeg * Math.PI) / 180));
  const shadowPaint = makeFillPaint('#000000', 0.12);
  const shadowPath = Skia.Path.Make();
  shadowPath.addOval({
    x: cm.x - (35 * cosA + 12),
    y: 430 - 6,
    width: (35 * cosA + 12) * 2,
    height: 12,
  });
  canvas.drawPath(shadowPath, shadowPaint);

  // Draw each path
  for (const item of drawList) {
    // 1. Transform for angle
    let d = transformPathForAngle(item.path.d, angleDeg);

    // 2. Apply joint offset
    const baseJoint = baseProjection.joints[item.jointKey];
    const posedJoint = posedJoints[item.jointKey];
    if (baseJoint && posedJoint) {
      const dx = posedJoint.x - baseJoint.x;
      const dy = posedJoint.y - baseJoint.y;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        d = translatePath(d, dx, dy);
      }
    }

    // 3. Convert to SkPath
    const skPath = svgToSkPath(d);
    if (!skPath) continue;

    // 4. Draw with shading — 4 passes like canvas renderer

    // Main fill
    const fillPaint = makeFillPaint(item.shade.lit);
    canvas.drawPath(skPath, fillPaint);

    // Shadow pass
    if (item.shade.shadowOpacity > 0.1) {
      const shadowFill = makeFillPaint(item.shade.shadow, item.shade.shadowOpacity * 0.3);
      canvas.drawPath(skPath, shadowFill);
    }

    // Highlight pass
    if (item.shade.highlightOpacity > 0.1) {
      const highlightFill = makeFillPaint(item.shade.highlight, item.shade.highlightOpacity * 0.25);
      canvas.drawPath(skPath, highlightFill);
    }

    // Rim light stroke
    if (item.shade.rimOpacity > 0.05) {
      const rimStroke = makeStrokePaint(item.shade.rim, 1, item.shade.rimOpacity * 0.4);
      canvas.drawPath(skPath, rimStroke);
    }

    // Base outline
    const outlineStroke = makeStrokePaint('#000000', 0.5, 0.15);
    canvas.drawPath(skPath, outlineStroke);
  }

  // Debug joints
  if (opts.debugJoints) {
    for (const [key, pos] of Object.entries(posedJoints)) {
      const color = key === 'center_mass' ? '#FFFF00' : '#00FFFF';
      const jointPaint = makeFillPaint(color);
      canvas.drawCircle(pos.x, pos.y, 3, jointPaint);
    }
  }

  canvas.restore();
  surface.flush();
  return surface.makeImageSnapshot();
}

// ============================================================================
// SPRITE SHEET GENERATOR — Skia version
// ============================================================================

/**
 * Pre-render all 1500 frames into a single SkImage atlas.
 * Same layout as canvas renderer: cols = poses, rows = angles.
 */
export async function generateSpriteSheetSkia(
  avatar: KasVillageAvatar,
  shading: ShadingPreset = 'daylight',
  spriteSize: number = SPRITE_SIZE,
  onProgress?: (progress: number) => void,
): Promise<SkImage | null> {
  const cols = POSES_PER_ANGLE;
  const rows = TOTAL_ANGLES;
  const atlasW = cols * spriteSize;
  const atlasH = rows * spriteSize;

  const surface = Skia.Surface.MakeOffscreen(atlasW, atlasH);
  if (!surface) return null;
  const atlasCanvas = surface.getCanvas();

  let rendered = 0;
  const total = TOTAL_FRAMES;

  for (let angleIdx = 0; angleIdx < TOTAL_ANGLES; angleIdx++) {
    const angleDeg = angleIdx * ANGLE_STEP;

    for (let poseIdx = 0; poseIdx < ALL_POSES.length; poseIdx++) {
      const pose = ALL_POSES[poseIdx];

      // Render single frame
      const frameImage = renderFrameSkia(avatar, angleDeg, pose, 0, {
        size: spriteSize,
        shading,
        debugJoints: false,
      });

      if (frameImage) {
        // Blit to atlas position
        const x = poseIdx * spriteSize;
        const y = angleIdx * spriteSize;
        const destRect = { x, y, width: spriteSize, height: spriteSize };
        const srcRect = { x: 0, y: 0, width: spriteSize, height: spriteSize };
        const imgPaint = Skia.Paint();
        atlasCanvas.drawImageRect(frameImage, srcRect, destRect, imgPaint);
      }

      rendered++;
      if (onProgress && rendered % 25 === 0) {
        onProgress(rendered / total);
        await new Promise(r => setTimeout(r, 0));
      }
    }
  }

  if (onProgress) onProgress(1);
  surface.flush();
  return surface.makeImageSnapshot();
}

// ============================================================================
// SAVE TO FILESYSTEM — SkImage → PNG file
// ============================================================================

import * as FileSystem from 'expo-file-system';

const CACHE_DIR = `${FileSystem.documentDirectory}kv_sprites/`;
const ATLAS_FILE = `${CACHE_DIR}atlas.png`;
const META_FILE = `${CACHE_DIR}meta.json`;

async function ensureCacheDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

/**
 * Save SkImage atlas to FileSystem as PNG.
 */
export async function saveAtlasToFile(
  atlasImage: SkImage,
  avatarHash: string,
  shading: ShadingPreset,
): Promise<void> {
  await ensureCacheDir();

  // SkImage → base64 PNG
  const encoded = atlasImage.encodeToBase64();

  await FileSystem.writeAsStringAsync(ATLAS_FILE, encoded, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const meta = {
    avatarHash,
    shading,
    spriteSize: SPRITE_SIZE,
    totalFrames: TOTAL_FRAMES,
    cols: POSES_PER_ANGLE,
    rows: TOTAL_ANGLES,
    createdAt: Date.now(),
  };
  await FileSystem.writeAsStringAsync(META_FILE, JSON.stringify(meta));
}

/**
 * Load cached atlas from FileSystem as SkImage.
 */
export async function loadAtlasFromFile(
  avatarHash: string,
  shading: ShadingPreset,
): Promise<SkImage | null> {
  try {
    const metaInfo = await FileSystem.getInfoAsync(META_FILE);
    if (!metaInfo.exists) return null;

    const metaStr = await FileSystem.readAsStringAsync(META_FILE);
    const meta = JSON.parse(metaStr);
    if (meta.avatarHash !== avatarHash || meta.shading !== shading) return null;

    const atlasInfo = await FileSystem.getInfoAsync(ATLAS_FILE);
    if (!atlasInfo.exists) return null;

    const base64 = await FileSystem.readAsStringAsync(ATLAS_FILE, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const data = Skia.Data.fromBase64(base64);
    return Skia.Image.MakeImageFromEncoded(data);
  } catch {
    return null;
  }
}

// ============================================================================
// GAME RENDERER — blit from atlas SkImage to game SkCanvas
// ============================================================================

/**
 * Blit a single sprite from the atlas to the game canvas.
 * Skia equivalent of the Canvas drawImage call.
 */
export function blitSpriteSkia(
  canvas: SkCanvas,
  atlasImage: SkImage,
  angleIdx: number,
  poseIdx: number,
  destX: number,
  destY: number,
  spriteSize: number = SPRITE_SIZE,
  scale: number = 1,
  flipX: boolean = false,
): void {
  const srcX = poseIdx * spriteSize;
  const srcY = angleIdx * spriteSize;
  const destW = spriteSize * scale;
  const destH = spriteSize * scale;

  const srcRect = { x: srcX, y: srcY, width: spriteSize, height: spriteSize };

  canvas.save();

  if (flipX) {
    canvas.translate(destX + destW, destY);
    canvas.scale(-1, 1);
    canvas.drawImageRect(
      atlasImage,
      srcRect,
      { x: 0, y: 0, width: destW, height: destH },
      Skia.Paint(),
    );
  } else {
    canvas.drawImageRect(
      atlasImage,
      srcRect,
      { x: destX, y: destY, width: destW, height: destH },
      Skia.Paint(),
    );
  }

  canvas.restore();
}

/**
 * Blit by angle degrees and pose name.
 */
export function blitByAngleAndPoseSkia(
  canvas: SkCanvas,
  atlasImage: SkImage,
  angleDeg: number,
  pose: AnimationPose,
  destX: number,
  destY: number,
  spriteSize: number = SPRITE_SIZE,
  scale: number = 1,
  flipX: boolean = false,
): void {
  const angleIdx = Math.round(((angleDeg % 360 + 360) % 360) / ANGLE_STEP) % TOTAL_ANGLES;
  const poseIdx = ALL_POSES.indexOf(pose);
  if (poseIdx < 0) return;
  blitSpriteSkia(canvas, atlasImage, angleIdx, poseIdx, destX, destY, spriteSize, scale, flipX);
}

// ============================================================================
// FULL PIPELINE — Skia version of prepareAvatar
// ============================================================================

/**
 * Complete pipeline: check cache → render if needed → return SkImage atlas.
 *
 * Usage with Skia Canvas component:
 *   const atlas = await prepareAvatarSkia(avatarData, 'horror');
 *   // In <Canvas> onDraw:
 *   blitByAngleAndPoseSkia(canvas, atlas, facing, pose, x, y);
 */
export async function prepareAvatarSkia(
  avatarData: AvatarData,
  shading: ShadingPreset = 'daylight',
  onProgress?: (progress: number) => void,
): Promise<{ avatar: KasVillageAvatar; atlas: SkImage } | null> {
  const avatar = new KasVillageAvatar(avatarData);
  const hash = `${avatarData.race}_${avatarData.gender}_${avatarData.paths.length}`;

  // Check FileSystem cache
  const cached = await loadAtlasFromFile(hash, shading);
  if (cached) {
    if (onProgress) onProgress(1);
    return { avatar, atlas: cached };
  }

  // Generate fresh
  const atlas = await generateSpriteSheetSkia(avatar, shading, SPRITE_SIZE, onProgress);
  if (!atlas) return null;

  // Cache to FileSystem
  try {
    await saveAtlasToFile(atlas, hash, shading);
  } catch {
    // Non-fatal
  }

  return { avatar, atlas };
}
