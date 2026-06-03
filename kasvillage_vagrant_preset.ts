// ============================================================================
// KasVillage Vagrant Story Preset + Detailed Enemy Avatars
//
// 1. SHADING PRESET: Vagrant Story aesthetic — stone, torchlight, earth tones
// 2. ENEMY BODY GENERATOR: Full SDK-level detail for enemy avatars
//    (skull, hair, eyes, iris, pupil, brows, nose, lips, ears, neck,
//     torso with armor, arms with fingers, legs with feet)
//
// Enemies get the SAME level of procedural detail as the player.
// Each race has unique body proportions, facial features, and armor style.
// ============================================================================

import type { Race, Gender } from './avatar_silhouette_generator';
import { deriveSeed } from './avatar_silhouette_generator';
import type { EnemyTemplate } from './kasvillage_enemy_avatars';

// ============================================================================
// VAGRANT STORY SHADING PRESET
// ============================================================================

export const VAGRANT_SHADING = {
  name: 'vagrant',

  // Ambient: dark medieval stone
  ambient: { r: 0.08, g: 0.06, b: 0.04 },

  // Key light: warm torchlight from upper-left
  keyLight: {
    direction: { x: -0.4, y: -0.6, z: 0.5 },
    color: { r: 0.78, g: 0.52, b: 0.1 },
    intensity: 0.7,
  },

  // Fill light: faint cool bounce from stone floor
  fillLight: {
    direction: { x: 0.2, y: 0.8, z: -0.3 },
    color: { r: 0.15, g: 0.12, b: 0.1 },
    intensity: 0.2,
  },

  // Rim light: subtle warm edge (second torch)
  rimLight: {
    direction: { x: 0.6, y: -0.3, z: -0.5 },
    color: { r: 0.6, g: 0.35, b: 0.08 },
    intensity: 0.3,
  },

  // Shadow color: deep warm brown (not pure black)
  shadow: { r: 0.06, g: 0.04, b: 0.02 },
  shadowIntensity: 0.75,

  // Skin tones shifted warm/parchment
  skinShift: { r: 0.05, g: 0.02, b: -0.03 },

  // Metal tones: tarnished, aged
  metalShift: { r: -0.05, g: -0.03, b: 0.02 },

  // Overall desaturation (0 = full color, 1 = grayscale)
  desaturation: 0.25,

  // Dithering for PS1-style edge quality
  ditherStrength: 0.02,
};

// ============================================================================
// VAGRANT COLOR PALETTE
// ============================================================================

export const VAGRANT_PALETTE = {
  // Skin tones (warm parchment)
  skin: {
    light:  '#C8A47A',
    medium: '#B8946A',
    dark:   '#A07850',
    shadow: '#7A5A38',
  },
  // Hair
  hair: {
    blonde: '#8B7E50',
    brown:  '#4A3A20',
    dark:   '#2A1A10',
    gray:   '#6A6A5A',
    red:    '#6B3A20',
  },
  // Metal / armor
  metal: {
    steel:    '#6A6A74',
    iron:     '#4A4A54',
    bronze:   '#7A6A40',
    gold:     '#8B7530',
    dark:     '#3A3A40',
    rust:     '#6A4030',
    tarnish:  '#5A5A50',
  },
  // Leather
  leather: {
    light:  '#6B5538',
    medium: '#4A3A28',
    dark:   '#2E2418',
    worn:   '#5A4A34',
  },
  // Cloth
  cloth: {
    white:  '#C8C0B0',
    cream:  '#B8AA90',
    red:    '#6B2020',
    blue:   '#2A3A5A',
    green:  '#2A4A2A',
    purple: '#3A2A4A',
    black:  '#1A1A1E',
  },
  // Stone environment
  stone: {
    light:  '#3A352E',
    medium: '#2A2520',
    dark:   '#1E1B16',
    shadow: '#0E0C09',
  },
  // Eyes
  eyes: {
    normal:   '#5A6A50',
    dark:     '#2A2A30',
    glowing:  '#CC4400',
    ethereal: '#66BBDD',
    demonic:  '#FF2200',
    golden:   '#C8A020',
  },
  // Fire / magic
  fire: {
    core:   '#FFD060',
    mid:    '#C8841A',
    outer:  '#8B5E14',
    ember:  '#6B3A10',
  },
};

// ============================================================================
// APPLY VAGRANT SHADING TO A COLOR
// ============================================================================

/**
 * Apply Vagrant Story lighting to a hex color.
 * Desaturates, warms, and darkens for medieval torchlight feel.
 */
export function applyVagrantShading(hex: string, depth: number = 0.5): string {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;

  // Desaturate
  const gray = r * 0.299 + g * 0.587 + b * 0.114;
  const desat = VAGRANT_SHADING.desaturation;
  r = r * (1 - desat) + gray * desat;
  g = g * (1 - desat) + gray * desat;
  b = b * (1 - desat) + gray * desat;

  // Warm shift (torchlight)
  r += VAGRANT_SHADING.skinShift.r * (1 - depth);
  g += VAGRANT_SHADING.skinShift.g * (1 - depth);
  b += VAGRANT_SHADING.skinShift.b * (1 - depth);

  // Darken based on depth
  const shadowMix = depth * VAGRANT_SHADING.shadowIntensity;
  r = r * (1 - shadowMix) + VAGRANT_SHADING.shadow.r * shadowMix;
  g = g * (1 - shadowMix) + VAGRANT_SHADING.shadow.g * shadowMix;
  b = b * (1 - shadowMix) + VAGRANT_SHADING.shadow.b * shadowMix;

  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

// ============================================================================
// DETAILED ENEMY BODY GENERATOR — full SDK-level paths
// ============================================================================

/**
 * Generate full-detail enemy avatar paths matching player avatar quality.
 * Each enemy gets: skull, hair, eyes (3 layers), brows, nose, lips, ears,
 * neck, torso with armor detail, arms with fingers, legs with feet.
 *
 * Race determines: proportions, facial features, hair, armor style, extras
 * (horns, fangs, wings, tails, glowing markings, etc.)
 */
export function generateDetailedEnemyPaths(
  template: EnemyTemplate,
): { paths: string[]; colors: string[] } {
  const seed = deriveSeed(template.id + template.race + template.name);
  let s = seed;
  const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s % 10000) / 10000; };

  const scale = template.scale;
  const cx = 200;
  const paths: string[] = [];
  const colors: string[] = [];
  const pal = template.palette;

  // Race-specific body params
  const params = getEnemyBodyParams(template.race, template.gender, scale);

  // ── SKULL ──
  const headW = params.headW;
  const headH = params.headH;
  const baseY = params.headY;

  let skull = `M ${cx} ${baseY}`;
  for (let i = 0; i <= 30; i++) {
    const angle = (i / 30) * Math.PI;
    const variation = (r() - 0.5) * 2 * scale;
    const rx = headW * (0.95 + r() * 0.04);
    const ry = headH * 0.52;
    const x = cx + Math.sin(angle) * rx + variation;
    const y = baseY + 4 - Math.cos(angle) * ry;
    skull += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  // Jawline curves
  skull += ` C ${cx + headW * 0.92} ${baseY + headH * 0.32} ${cx + headW * 0.98} ${baseY + headH * 0.45} ${cx + headW * params.jawWidth} ${baseY + headH * 0.55}`;
  skull += ` C ${cx + headW * 0.98} ${baseY + headH * 0.65} ${cx + headW * 0.88} ${baseY + headH * 0.78} ${cx + headW * 0.72} ${baseY + headH * 0.88}`;
  skull += ` C ${cx + headW * 0.5} ${baseY + headH * 0.96} ${cx + headW * 0.2} ${baseY + headH} ${cx} ${baseY + headH * 1.02}`;
  skull += ` C ${cx - headW * 0.2} ${baseY + headH} ${cx - headW * 0.5} ${baseY + headH * 0.96} ${cx - headW * 0.72} ${baseY + headH * 0.88}`;
  skull += ` C ${cx - headW * 0.88} ${baseY + headH * 0.78} ${cx - headW * 0.98} ${baseY + headH * 0.65} ${cx - headW * params.jawWidth} ${baseY + headH * 0.55}`;
  skull += ` C ${cx - headW * 0.98} ${baseY + headH * 0.45} ${cx - headW * 0.92} ${baseY + headH * 0.32} ${cx - headW * 0.88} ${baseY + headH * 0.15} Z`;
  paths.push(skull);
  colors.push(applyVagrantShading(pal.skin, 0.3));

  // ── HAIR ──
  const hairPaths = generateEnemyHair(template.race, cx, baseY, headW, headH, r, scale);
  for (const hp of hairPaths) {
    paths.push(hp);
    colors.push(applyVagrantShading(pal.hair, 0.2));
  }

  // ── EYES (3 layers: white, iris, pupil) ──
  const eyeY = baseY + headH * 0.44;
  const eyeSpacing = headW * (0.28 + r() * 0.06);
  const eyeW = (7 + r() * 3) * scale;
  const eyeH = (4 + r() * 2) * scale;

  for (let side = -1; side <= 1; side += 2) {
    const eyeX = cx + side * eyeSpacing;
    // Eye white
    paths.push(`M ${eyeX - eyeW} ${eyeY} C ${eyeX - eyeW} ${eyeY - eyeH} ${eyeX + eyeW} ${eyeY - eyeH} ${eyeX + eyeW} ${eyeY} C ${eyeX + eyeW} ${eyeY + eyeH * 0.6} ${eyeX - eyeW} ${eyeY + eyeH * 0.6} ${eyeX - eyeW} ${eyeY} Z`);
    colors.push('#E8E0D0');
    // Iris
    const irisR = (2.5 + r()) * scale;
    paths.push(`M ${eyeX - irisR} ${eyeY - 1} C ${eyeX - irisR} ${eyeY - irisR - 1} ${eyeX + irisR} ${eyeY - irisR - 1} ${eyeX + irisR} ${eyeY - 1} C ${eyeX + irisR} ${eyeY + irisR - 1} ${eyeX - irisR} ${eyeY + irisR - 1} ${eyeX - irisR} ${eyeY - 1} Z`);
    colors.push(applyVagrantShading(pal.eyes, 0.1));
    // Pupil
    const pupilR = 1.5 * scale;
    paths.push(`M ${eyeX - pupilR} ${eyeY - 1} C ${eyeX - pupilR} ${eyeY - pupilR - 1} ${eyeX + pupilR} ${eyeY - pupilR - 1} ${eyeX + pupilR} ${eyeY - 1} C ${eyeX + pupilR} ${eyeY + pupilR * 0.5} ${eyeX - pupilR} ${eyeY + pupilR * 0.5} ${eyeX - pupilR} ${eyeY - 1} Z`);
    colors.push('#0A0A0E');
  }

  // ── BROWS ──
  const browY = eyeY - eyeH - (4 + r() * 3) * scale;
  const browArch = (3 + r() * 4) * scale;
  paths.push(`M ${cx + eyeSpacing - eyeW - 3} ${browY + 3} Q ${cx + eyeSpacing} ${browY - browArch} ${cx + eyeSpacing + eyeW + 3} ${browY + 2}`);
  colors.push(applyVagrantShading(pal.hair, 0.4));
  paths.push(`M ${cx - eyeSpacing + eyeW + 3} ${browY + 3} Q ${cx - eyeSpacing} ${browY - browArch} ${cx - eyeSpacing - eyeW - 3} ${browY + 2}`);
  colors.push(applyVagrantShading(pal.hair, 0.4));

  // ── NOSE ──
  const noseY = baseY + headH * 0.65;
  const noseW = (3 + r() * 3) * scale;
  paths.push(`M ${cx} ${eyeY + 6} C ${cx + 2} ${noseY - 8} ${cx + noseW} ${noseY} ${cx + noseW + 2} ${noseY + 5} C ${cx + noseW + 3} ${noseY + 8} ${cx + 2} ${noseY + 10} ${cx} ${noseY + 8} C ${cx - 2} ${noseY + 10} ${cx - noseW - 3} ${noseY + 8} ${cx - noseW - 2} ${noseY + 5} C ${cx - noseW} ${noseY} ${cx - 2} ${noseY - 8} ${cx} ${eyeY + 6} Z`);
  colors.push(applyVagrantShading(pal.skin, 0.35));

  // ── LIPS ──
  const lipY = baseY + headH * 0.8;
  const lipW = (7 + r() * 4) * scale;
  paths.push(`M ${cx - lipW} ${lipY} C ${cx - lipW * 0.5} ${lipY - 2} ${cx - 1.5} ${lipY - 3} ${cx} ${lipY - 2.5} C ${cx + 1.5} ${lipY - 3} ${cx + lipW * 0.5} ${lipY - 2} ${cx + lipW} ${lipY} C ${cx + lipW * 0.5} ${lipY + 1} ${cx} ${lipY + 0.5} ${cx - lipW * 0.5} ${lipY + 1} Z`);
  colors.push(applyVagrantShading('#A07060', 0.3));
  paths.push(`M ${cx - lipW + 1} ${lipY + 1.5} C ${cx} ${lipY + 1} ${cx + lipW - 1} ${lipY + 1.5} ${cx + lipW - 2} ${lipY + 4 + r() * 2} C ${cx} ${lipY + 6 + r()} ${cx - lipW + 2} ${lipY + 4 + r() * 2} ${cx - lipW + 1} ${lipY + 1.5} Z`);
  colors.push(applyVagrantShading('#A87868', 0.3));

  // ── EARS ──
  const earY = baseY + headH * 0.4;
  const earH = (16 + r() * 6) * scale;
  for (let side = -1; side <= 1; side += 2) {
    const earExt = params.earExtension; // pointed ears for elves, etc.
    paths.push(`M ${cx + side * headW * 0.95} ${earY} C ${cx + side * (headW + 4 + earExt)} ${earY - 3 - earExt * 2} ${cx + side * (headW + 7 + earExt)} ${earY + earH * 0.4} ${cx + side * (headW + 5)} ${earY + earH * 0.7} C ${cx + side * (headW + 3)} ${earY + earH} ${cx + side * headW * 0.96} ${earY + earH - 5} ${cx + side * headW * 0.94} ${earY + earH * 0.6} Z`);
    colors.push(applyVagrantShading(pal.skin, 0.35));
  }

  // ── NECK ──
  const neckTop = baseY + headH * 1.02;
  const neckW = params.neckW;
  const neckH = params.neckH;
  paths.push(`M ${cx - headW * 0.28} ${neckTop} C ${cx - neckW * 0.95} ${neckTop + 5} ${cx - neckW} ${neckTop + neckH * 0.6} ${cx - neckW * 1.1} ${neckTop + neckH} L ${cx + neckW * 1.1} ${neckTop + neckH} C ${cx + neckW} ${neckTop + neckH * 0.6} ${cx + neckW * 0.95} ${neckTop + 5} ${cx + headW * 0.28} ${neckTop} Z`);
  colors.push(applyVagrantShading(pal.skin, 0.4));

  // ── TORSO WITH ARMOR ──
  const torsoTop = neckTop + neckH;
  const shoulderW = params.shoulderW;
  const waistW = params.waistW;
  const hipW = params.hipW;
  const torsoH = params.torsoH;

  // Base torso
  let torso = `M ${cx - neckW * 1.1} ${torsoTop}`;
  torso += ` C ${cx - shoulderW * 0.5} ${torsoTop - 3} ${cx - shoulderW * 0.8} ${torsoTop + 10} ${cx - shoulderW} ${torsoTop + 18}`;
  torso += ` C ${cx - shoulderW - 5} ${torsoTop + 26} ${cx - shoulderW - 2} ${torsoTop + 38} ${cx - shoulderW + 4} ${torsoTop + 45}`;
  torso += ` C ${cx - waistW - 8} ${torsoTop + torsoH * 0.55} ${cx - waistW - 3} ${torsoTop + torsoH * 0.72} ${cx - waistW} ${torsoTop + torsoH * 0.82}`;
  torso += ` C ${cx - hipW + 4} ${torsoTop + torsoH * 0.92} ${cx - hipW} ${torsoTop + torsoH} ${cx - hipW + 2} ${torsoTop + torsoH + 4}`;
  torso += ` L ${cx + hipW - 2} ${torsoTop + torsoH + 4}`;
  torso += ` C ${cx + hipW} ${torsoTop + torsoH} ${cx + hipW - 4} ${torsoTop + torsoH * 0.92} ${cx + waistW} ${torsoTop + torsoH * 0.82}`;
  torso += ` C ${cx + waistW + 3} ${torsoTop + torsoH * 0.72} ${cx + waistW + 8} ${torsoTop + torsoH * 0.55} ${cx + shoulderW - 4} ${torsoTop + 45}`;
  torso += ` C ${cx + shoulderW + 2} ${torsoTop + 38} ${cx + shoulderW + 5} ${torsoTop + 26} ${cx + shoulderW} ${torsoTop + 18}`;
  torso += ` C ${cx + shoulderW * 0.8} ${torsoTop + 10} ${cx + shoulderW * 0.5} ${torsoTop - 3} ${cx + neckW * 1.1} ${torsoTop} Z`;
  paths.push(torso);
  colors.push(applyVagrantShading(pal.primary, 0.35));

  // Armor chest plate
  paths.push(`M ${cx - shoulderW * 0.4} ${torsoTop + 8} C ${cx - shoulderW * 0.6} ${torsoTop + 6} ${cx - shoulderW * 0.7} ${torsoTop + 18} ${cx - shoulderW * 0.65} ${torsoTop + 30} C ${cx - shoulderW * 0.4} ${torsoTop + 38} ${cx - 6} ${torsoTop + 40} ${cx} ${torsoTop + 35} Z`);
  colors.push(applyVagrantShading(pal.secondary, 0.25));
  paths.push(`M ${cx + shoulderW * 0.4} ${torsoTop + 8} C ${cx + shoulderW * 0.6} ${torsoTop + 6} ${cx + shoulderW * 0.7} ${torsoTop + 18} ${cx + shoulderW * 0.65} ${torsoTop + 30} C ${cx + shoulderW * 0.4} ${torsoTop + 38} ${cx + 6} ${torsoTop + 40} ${cx} ${torsoTop + 35} Z`);
  colors.push(applyVagrantShading(pal.secondary, 0.25));

  // Center seam
  paths.push(`M ${cx} ${torsoTop} L ${cx} ${torsoTop + torsoH * 0.8}`);
  colors.push(applyVagrantShading(pal.secondary, 0.5));

  // Belt
  paths.push(`M ${cx - waistW - 4} ${torsoTop + torsoH * 0.78} C ${cx} ${torsoTop + torsoH * 0.82} ${cx + waistW + 4} ${torsoTop + torsoH * 0.78} ${cx + waistW + 4} ${torsoTop + torsoH * 0.78} L ${cx + waistW + 2} ${torsoTop + torsoH * 0.86} C ${cx} ${torsoTop + torsoH * 0.9} ${cx - waistW - 2} ${torsoTop + torsoH * 0.86} ${cx - waistW - 4} ${torsoTop + torsoH * 0.78} Z`);
  colors.push(applyVagrantShading(pal.accent, 0.3));

  // Belt buckle
  const buckleY = torsoTop + torsoH * 0.8;
  paths.push(`M ${cx - 4} ${buckleY} L ${cx + 4} ${buckleY} L ${cx + 4} ${buckleY + 8} L ${cx - 4} ${buckleY + 8} Z`);
  colors.push(applyVagrantShading(pal.accent, 0.15));

  // ── SHOULDER ARMOR (pauldrons) ──
  for (let side = -1; side <= 1; side += 2) {
    const pX = cx + side * shoulderW;
    paths.push(`M ${pX - side * 8} ${torsoTop + 8} C ${pX + side * 4} ${torsoTop} ${pX + side * 12} ${torsoTop + 6} ${pX + side * 10} ${torsoTop + 20} C ${pX + side * 8} ${torsoTop + 28} ${pX - side * 2} ${torsoTop + 26} ${pX - side * 8} ${torsoTop + 8} Z`);
    colors.push(applyVagrantShading(pal.secondary, 0.2));
  }

  // ── ARMS WITH HANDS AND FINGERS ──
  const armStartY = torsoTop + 18;
  const upperArmL = 42 * scale;
  const forearmL = 38 * scale;
  const armW = template.gender === 'male' ? 9 * scale : 6.5 * scale;

  for (let side = -1; side <= 1; side += 2) {
    // Upper arm + forearm
    let arm = `M ${cx + side * shoulderW} ${armStartY}`;
    arm += ` C ${cx + side * (shoulderW + 7)} ${armStartY + 12} ${cx + side * (shoulderW + 10)} ${armStartY + upperArmL - 10} ${cx + side * (shoulderW + 8)} ${armStartY + upperArmL}`;
    arm += ` C ${cx + side * (shoulderW + 11)} ${armStartY + upperArmL + 10} ${cx + side * (shoulderW + 8)} ${armStartY + upperArmL + forearmL - 10} ${cx + side * (shoulderW + 6)} ${armStartY + upperArmL + forearmL}`;
    arm += ` C ${cx + side * (shoulderW + 3)} ${armStartY + upperArmL + forearmL + 16} ${cx + side * (shoulderW - 9)} ${armStartY + upperArmL + forearmL + 20} ${cx + side * (shoulderW - 7)} ${armStartY + upperArmL + forearmL + 5}`;
    arm += ` C ${cx + side * (shoulderW - armW - 3)} ${armStartY + upperArmL + 20} ${cx + side * (shoulderW - armW)} ${armStartY + 12} ${cx + side * (shoulderW - 4)} ${armStartY} Z`;
    paths.push(arm);
    colors.push(applyVagrantShading(side === -1 ? pal.skin : pal.skin, 0.35));

    // Gauntlet / armguard
    const gauntletY = armStartY + upperArmL;
    paths.push(`M ${cx + side * (shoulderW + 5)} ${gauntletY - 4} C ${cx + side * (shoulderW + 10)} ${gauntletY} ${cx + side * (shoulderW + 10)} ${gauntletY + forearmL * 0.4} ${cx + side * (shoulderW + 7)} ${gauntletY + forearmL * 0.5} L ${cx + side * (shoulderW - armW)} ${gauntletY + forearmL * 0.5} C ${cx + side * (shoulderW - armW - 2)} ${gauntletY + forearmL * 0.4} ${cx + side * (shoulderW - armW)} ${gauntletY} ${cx + side * (shoulderW + 1)} ${gauntletY - 4} Z`);
    colors.push(applyVagrantShading(pal.secondary, 0.3));

    // Fingers (5 per hand)
    const handY = armStartY + upperArmL + forearmL + 5;
    const handX = cx + side * (shoulderW - 2);
    for (let f = 0; f < 5; f++) {
      const fingerW = 1.8 * scale;
      const fingerL = f === 0 ? 10 * scale : (14 + (2 - Math.abs(f - 2)) * 2.5 + r() * 2) * scale;
      const fingerX = handX + side * (f * 3.5 * scale - 5 * scale);
      const fingerY = f === 0 ? handY + 5 * scale : handY + 12 * scale;
      paths.push(`M ${fingerX - fingerW} ${fingerY} L ${fingerX - fingerW * 0.7} ${fingerY + fingerL} Q ${fingerX} ${fingerY + fingerL + 2} ${fingerX + fingerW * 0.7} ${fingerY + fingerL} L ${fingerX + fingerW} ${fingerY} Z`);
      colors.push(applyVagrantShading(pal.skin, 0.35));
    }
  }

  // ── LEGS WITH FEET ──
  const legTop = torsoTop + torsoH + 5;
  const thighL = 52 * scale;
  const calfL = 48 * scale;
  const legW = (template.gender === 'male' ? 13 : 10) * scale;

  for (let side = -1; side <= 1; side += 2) {
    // Leg
    let leg = `M ${cx + side * hipW * 0.12} ${legTop}`;
    leg += ` C ${cx + side * hipW * 0.32} ${legTop + 8} ${cx + side * hipW * 0.48} ${legTop + 18} ${cx + side * (legW + 5)} ${legTop + thighL * 0.55}`;
    leg += ` C ${cx + side * (legW + 8)} ${legTop + thighL * 0.8} ${cx + side * (legW + 6)} ${legTop + thighL} ${cx + side * (legW + 4)} ${legTop + thighL + 5}`;
    leg += ` C ${cx + side * (legW + 6)} ${legTop + thighL + 18} ${cx + side * (legW + 2)} ${legTop + thighL + calfL - 10} ${cx + side * legW} ${legTop + thighL + calfL}`;
    // Foot
    leg += ` L ${cx + side * (legW + 3)} ${legTop + thighL + calfL + 6}`;
    leg += ` C ${cx + side * 30 * scale} ${legTop + thighL + calfL + 12} ${cx + side * 32 * scale} ${legTop + thighL + calfL + 20} ${cx + side * 6} ${legTop + thighL + calfL + 20}`;
    leg += ` L ${cx + side * 5} ${legTop + thighL + calfL + 4}`;
    leg += ` C ${cx + side * 4} ${legTop + thighL + 16} ${cx + side * 7} ${legTop + 16} ${cx + side * hipW * 0.12} ${legTop} Z`;
    paths.push(leg);
    colors.push(applyVagrantShading(pal.primary, 0.4));

    // Greave / shin armor
    const greaveY = legTop + thighL + 5;
    paths.push(`M ${cx + side * (legW + 3)} ${greaveY} C ${cx + side * (legW + 6)} ${greaveY + 4} ${cx + side * (legW + 5)} ${greaveY + calfL * 0.6} ${cx + side * (legW + 2)} ${greaveY + calfL * 0.7} L ${cx + side * 6} ${greaveY + calfL * 0.7} C ${cx + side * 5} ${greaveY + calfL * 0.5} ${cx + side * 4} ${greaveY + 4} ${cx + side * (legW - 2)} ${greaveY} Z`);
    colors.push(applyVagrantShading(pal.secondary, 0.3));
  }

  // ── RACE-SPECIFIC EXTRAS ──
  const extras = generateRaceExtras(template.race, cx, baseY, headW, headH, params, r, scale);
  for (const extra of extras) {
    paths.push(extra.path);
    colors.push(applyVagrantShading(extra.color, extra.depth));
  }

  return { paths, colors };
}

// ============================================================================
// BODY PARAMS PER RACE
// ============================================================================

interface EnemyBodyParams {
  headW: number;
  headH: number;
  headY: number;
  jawWidth: number;
  neckW: number;
  neckH: number;
  shoulderW: number;
  waistW: number;
  hipW: number;
  torsoH: number;
  earExtension: number;
}

function getEnemyBodyParams(race: Race, gender: Gender, scale: number): EnemyBodyParams {
  const g = gender === 'male' ? 1 : 0.88;
  const base: EnemyBodyParams = {
    headW: 34 * scale, headH: 42 * scale, headY: 45,
    jawWidth: 0.95, neckW: 15 * scale * g, neckH: 22 * scale,
    shoulderW: 55 * scale * g, waistW: 28 * scale, hipW: 34 * scale,
    torsoH: 82 * scale, earExtension: 0,
  };

  switch (race) {
    case 'orc':
    case 'troll':
      base.headW *= 1.15; base.jawWidth = 1.1; base.shoulderW *= 1.2;
      base.neckW *= 1.2; base.torsoH *= 1.05; break;
    case 'golem':
      base.headW *= 1.1; base.shoulderW *= 1.35; base.neckW *= 1.4;
      base.torsoH *= 1.2; base.jawWidth = 1.15; break;
    case 'elf': case 'darkelf': case 'fae':
      base.headW *= 0.92; base.shoulderW *= 0.9;
      base.earExtension = 12 * scale; break;
    case 'dwarf':
      base.headW *= 1.05; base.shoulderW *= 1.05; base.torsoH *= 0.85;
      base.neckW *= 1.1; break;
    case 'halfling': case 'gnome':
      base.headW *= 1.1; base.shoulderW *= 0.8; base.torsoH *= 0.75; break;
    case 'dragonkin':
      base.jawWidth = 1.08; base.shoulderW *= 1.1; base.earExtension = 8 * scale; break;
    case 'vampire':
      base.headW *= 0.95; base.jawWidth = 0.9; break;
    case 'werewolf': case 'beast':
      base.headW *= 1.08; base.jawWidth = 1.12; base.shoulderW *= 1.15;
      base.neckW *= 1.15; break;
    case 'angel':
      base.shoulderW *= 1.05; break;
    case 'undead':
      base.headW *= 0.95; base.shoulderW *= 0.9; base.waistW *= 0.85; break;
    case 'ethereal':
      base.headW *= 0.9; base.shoulderW *= 0.85; break;
    case 'phoenix':
      base.shoulderW *= 1.1; base.earExtension = 6 * scale; break;
    case 'giant':
      base.headW *= 0.95; base.shoulderW *= 1.25; base.torsoH *= 1.15;
      base.neckW *= 1.2; break;
  }

  return base;
}

// ============================================================================
// RACE-SPECIFIC HAIR
// ============================================================================

function generateEnemyHair(
  race: Race, cx: number, baseY: number, headW: number, headH: number,
  r: () => number, scale: number,
): string[] {
  const hairPaths: string[] = [];
  const vol = 1.05 + r() * 0.15;

  switch (race) {
    case 'orc': case 'troll': {
      // Mohawk or bald with scars
      let mohawk = `M ${cx - 3 * scale} ${baseY - 10}`;
      for (let i = 0; i <= 8; i++) {
        const spike = (r() - 0.3) * 12 * scale;
        mohawk += ` L ${cx + (i - 4) * 3 * scale} ${baseY - 15 - spike}`;
      }
      mohawk += ` L ${cx + 3 * scale} ${baseY - 10} Z`;
      hairPaths.push(mohawk);
      break;
    }
    case 'vampire': {
      // Slicked back
      let hair = `M ${cx} ${baseY - 5}`;
      for (let i = 0; i <= 20; i++) {
        const angle = (i / 20) * Math.PI;
        const x = cx + Math.sin(angle) * headW * vol;
        const y = baseY - 8 - Math.cos(angle) * headH * 0.5;
        hair += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      hair += ` C ${cx + headW * 1.1} ${baseY + headH * 0.4} ${cx + headW * 1.0} ${baseY + headH * 0.6} ${cx + headW * 0.9} ${baseY + headH * 0.55}`;
      hair += ` L ${cx - headW * 0.9} ${baseY + headH * 0.55}`;
      hair += ` C ${cx - headW * 1.0} ${baseY + headH * 0.6} ${cx - headW * 1.1} ${baseY + headH * 0.4} ${cx - headW * vol} ${baseY - 6} Z`;
      hairPaths.push(hair);
      break;
    }
    case 'angel': {
      // Flowing long hair
      let hair = `M ${cx} ${baseY - 6}`;
      for (let i = 0; i <= 25; i++) {
        const angle = (i / 25) * Math.PI;
        const strand = (r() - 0.5) * 4;
        const x = cx + Math.sin(angle) * headW * vol + strand;
        const y = baseY - 8 - Math.cos(angle) * headH * 0.5 + r() * 2;
        hair += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      const hairLen = 70 * scale;
      hair += ` C ${cx + headW * 1.15} ${baseY + headH * 0.5} ${cx + headW * 1.1} ${baseY + headH + hairLen * 0.4} ${cx + headW * 0.85} ${baseY + headH + hairLen}`;
      hair += ` L ${cx - headW * 0.85} ${baseY + headH + hairLen}`;
      hair += ` C ${cx - headW * 1.1} ${baseY + headH + hairLen * 0.4} ${cx - headW * 1.15} ${baseY + headH * 0.5} ${cx - headW * vol} ${baseY - 6} Z`;
      hairPaths.push(hair);
      break;
    }
    case 'golem': case 'elemental':
      // No hair — rocky head
      break;
    default: {
      // Standard spiky hair (VS style)
      let hair = `M ${cx} ${baseY - 8}`;
      const spikeCount = 6 + Math.floor(r() * 5);
      for (let i = 0; i <= spikeCount; i++) {
        const angle = (i / spikeCount) * Math.PI;
        const spikeLen = (8 + r() * 12) * scale;
        const x = cx + Math.sin(angle) * headW * vol + (r() - 0.5) * 4;
        const y = baseY - 10 - Math.cos(angle) * headH * 0.5 - spikeLen;
        hair += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        // Valley between spikes
        if (i < spikeCount) {
          const vx = cx + Math.sin((i + 0.5) / spikeCount * Math.PI) * headW * (vol - 0.1);
          const vy = baseY - 6 - Math.cos((i + 0.5) / spikeCount * Math.PI) * headH * 0.45;
          hair += ` L ${vx.toFixed(1)} ${vy.toFixed(1)}`;
        }
      }
      hair += ` C ${cx + headW * 1.05} ${baseY + headH * 0.35} ${cx + headW * 0.95} ${baseY + headH * 0.5} ${cx + headW * 0.88} ${baseY + headH * 0.45}`;
      hair += ` L ${cx - headW * 0.88} ${baseY + headH * 0.45}`;
      hair += ` C ${cx - headW * 0.95} ${baseY + headH * 0.5} ${cx - headW * 1.05} ${baseY + headH * 0.35} ${cx - headW * vol} ${baseY - 6} Z`;
      hairPaths.push(hair);
    }
  }

  return hairPaths;
}

// ============================================================================
// RACE-SPECIFIC EXTRAS (horns, fangs, wings, markings, etc.)
// ============================================================================

interface ExtraPath { path: string; color: string; depth: number; }

function generateRaceExtras(
  race: Race, cx: number, baseY: number, headW: number, headH: number,
  params: EnemyBodyParams, r: () => number, scale: number,
): ExtraPath[] {
  const extras: ExtraPath[] = [];

  switch (race) {
    case 'orc':
      // Tusks
      extras.push({ path: `M ${cx - headW * 0.35} ${baseY + headH * 0.85} L ${cx - headW * 0.3} ${baseY + headH * 1.05} L ${cx - headW * 0.25} ${baseY + headH * 0.85} Z`, color: '#E8E0D0', depth: 0.2 });
      extras.push({ path: `M ${cx + headW * 0.35} ${baseY + headH * 0.85} L ${cx + headW * 0.3} ${baseY + headH * 1.05} L ${cx + headW * 0.25} ${baseY + headH * 0.85} Z`, color: '#E8E0D0', depth: 0.2 });
      break;
    case 'dragonkin':
      // Horns curving back
      for (let side = -1; side <= 1; side += 2) {
        extras.push({ path: `M ${cx + side * headW * 0.6} ${baseY - headH * 0.1} C ${cx + side * headW * 0.9} ${baseY - headH * 0.4} ${cx + side * headW * 1.2} ${baseY - headH * 0.6} ${cx + side * headW * 1.0} ${baseY - headH * 0.8}`, color: '#5A5244', depth: 0.2 });
      }
      break;
    case 'vampire':
      // Fangs
      extras.push({ path: `M ${cx - 4} ${baseY + headH * 0.82} L ${cx - 3} ${baseY + headH * 0.95} L ${cx - 2} ${baseY + headH * 0.82} Z`, color: '#E8E0D0', depth: 0.1 });
      extras.push({ path: `M ${cx + 2} ${baseY + headH * 0.82} L ${cx + 3} ${baseY + headH * 0.95} L ${cx + 4} ${baseY + headH * 0.82} Z`, color: '#E8E0D0', depth: 0.1 });
      break;
    case 'angel': {
      // Wings (behind body)
      const wingTop = params.headY + headH + params.neckH;
      for (let side = -1; side <= 1; side += 2) {
        extras.push({ path: `M ${cx + side * params.shoulderW * 0.8} ${wingTop + 10} C ${cx + side * params.shoulderW * 2} ${wingTop - 20} ${cx + side * params.shoulderW * 2.5} ${wingTop + 30} ${cx + side * params.shoulderW * 2.2} ${wingTop + 80} C ${cx + side * params.shoulderW * 1.8} ${wingTop + 100} ${cx + side * params.shoulderW} ${wingTop + 60} ${cx + side * params.shoulderW * 0.8} ${wingTop + 10} Z`, color: '#C8C0B0', depth: 0.15 });
      }
      break;
    }
    case 'undead':
      // Exposed jaw bone
      extras.push({ path: `M ${cx - headW * 0.5} ${baseY + headH * 0.88} C ${cx - headW * 0.3} ${baseY + headH * 1.05} ${cx + headW * 0.3} ${baseY + headH * 1.05} ${cx + headW * 0.5} ${baseY + headH * 0.88}`, color: '#8A8470', depth: 0.3 });
      break;
    case 'phoenix': {
      // Flame crest on head
      for (let i = 0; i < 5; i++) {
        const fx = cx + (i - 2) * 6 * scale;
        const fh = (15 + r() * 15) * scale;
        extras.push({ path: `M ${fx - 3} ${baseY - headH * 0.3} L ${fx} ${baseY - headH * 0.3 - fh} L ${fx + 3} ${baseY - headH * 0.3} Z`, color: i % 2 === 0 ? '#C8841A' : '#FFD060', depth: 0.05 });
      }
      break;
    }
    case 'golem':
      // Crack lines on face
      extras.push({ path: `M ${cx - 5} ${baseY + headH * 0.2} L ${cx - 8} ${baseY + headH * 0.5} L ${cx - 12} ${baseY + headH * 0.7}`, color: '#1A1714', depth: 0.5 });
      extras.push({ path: `M ${cx + 3} ${baseY + headH * 0.3} L ${cx + 7} ${baseY + headH * 0.55}`, color: '#1A1714', depth: 0.5 });
      break;
    case 'werewolf':
      // Snout extension
      extras.push({ path: `M ${cx - headW * 0.3} ${baseY + headH * 0.6} C ${cx - headW * 0.2} ${baseY + headH * 0.7} ${cx} ${baseY + headH * 0.85} ${cx} ${baseY + headH * 0.9} C ${cx} ${baseY + headH * 0.85} ${cx + headW * 0.2} ${baseY + headH * 0.7} ${cx + headW * 0.3} ${baseY + headH * 0.6} Z`, color: '#7A6B55', depth: 0.3 });
      break;
  }

  return extras;
}

// ============================================================================
// EXPORTS
// ============================================================================
// VAGRANT_SHADING                    — shading preset config
// VAGRANT_PALETTE                    — color palette
// applyVagrantShading(hex, depth)    — apply VS lighting to any color
// generateDetailedEnemyPaths(template) — full SDK-detail enemy avatar
// ============================================================================
