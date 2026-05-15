// ============================================================================
// kasvillage-procedural-sdk v2.0.0
// ============================================================================
// Constrained procedural generation for KasVillage DApps/Games
// - No realistic human faces
// - No image uploads/bypasses
// - User avatar plugin support
// ============================================================================

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

// ============================================================================
// TYPES
// ============================================================================

export type Gender = 'male' | 'female' | 'neutral';

export type Race =
  | 'human' | 'cyborg' | 'mutant' | 'ethereal' | 'beast'
  | 'elf' | 'darkelf' | 'orc' | 'halfling' | 'dragonkin'
  | 'fae' | 'vampire' | 'werewolf' | 'angel' | 'golem'
  | 'elemental' | 'undead' | 'dwarf' | 'alien' | 'giant'
  | 'merfolk' | 'centaur' | 'troll' | 'gnome' | 'sprite' | 'phoenix';

export interface GeneratedCharacter {
  paths: string[];
  hash: string;
  race: Race;
  gender: Gender;
  seed: string;
  isValid: boolean;
  violations: string[];
}

export interface GeneratedBackground {
  elements: BackgroundElement[];
  palette: string[];
  hash: string;
  section: string;
  seed: string;
}

export interface BackgroundElement {
  type: 'rect' | 'circle' | 'path' | 'polygon';
  props: Record<string, string | number>;
}

export interface UserAvatarPlugin {
  enabled: boolean;
  avatarHash: string;
  paths: string[];
  race: Race;
  gender: Gender;
  apt: string;
  l1Verified: boolean;
}

export interface AvatarContext {
  userAvatar: UserAvatarPlugin | null;
  useUserAvatar: boolean;
  fallbackRace: Race;
  fallbackGender: Gender;
}

export interface PathAnalysis {
  isRealistic: boolean;
  violations: string[];
  confidence: number;
}

export interface ColorAnalysis {
  isRealisticSkin: boolean;
  violation: string | null;
}

export interface CodeScanResult {
  isValid: boolean;
  violations: string[];
}

// ============================================================================
// BANNED REALISTIC PROPORTIONS
// ============================================================================

const BANNED_EYE_RATIO = { min: 2.4, max: 3.6 };
const BANNED_FACE_ASPECT = { min: 0.58, max: 0.72 };

const BANNED_SKIN_TONES = [
  { h: [15, 45], s: [20, 60], l: [60, 85] },
  { h: [20, 40], s: [30, 55], l: [40, 65] },
  { h: [15, 35], s: [40, 70], l: [20, 45] },
];

export const ALLOWED_STYLIZATIONS = {
  eyeRatios: { anime: { max: 2.2 }, alien: { min: 4.0 } },
  faceAspects: { round: { max: 0.55 }, long: { min: 0.75 } },
  fantasyColors: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'],
};

const IMAGE_BYPASS_PATTERNS = [
  /<img\s+[^>]*src\s*=/i,
  /Image\s*\.\s*load/i,
  /fetch\s*\([^)]*\.(jpg|jpeg|png|gif|webp)/i,
  /createImageBitmap/i,
  /drawImage\s*\(/i,
  /FileReader[^}]*readAsDataURL/i,
  /data:image\/(jpeg|png|gif|webp)/i,
  /\.toDataURL\s*\(/i,
  /(uploadPhoto|uploadImage|uploadAvatar|uploadPicture|uploadFace)/i,
  /(camera|webcam|getUserMedia|mediaDevices\.getUserMedia)/i,
  /(deepfake|face\s*swap|face\s*morph|face\s*gen)/i,
];

// ============================================================================
// COLOR UTILITIES
// ============================================================================

function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
  if (!hex || hex.length < 7 || !hex.startsWith('#')) return null;
  
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  
  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function analyzeColor(hex: string): ColorAnalysis {
  const hsl = hexToHSL(hex);
  if (!hsl) return { isRealisticSkin: false, violation: null };
  
  for (const tone of BANNED_SKIN_TONES) {
    if (
      hsl.h >= tone.h[0] && hsl.h <= tone.h[1] &&
      hsl.s >= tone.s[0] && hsl.s <= tone.s[1] &&
      hsl.l >= tone.l[0] && hsl.l <= tone.l[1]
    ) {
      return { isRealisticSkin: true, violation: `realistic_skin_tone:${hex}` };
    }
  }
  
  return { isRealisticSkin: false, violation: null };
}

// ============================================================================
// PATH ANALYSIS
// ============================================================================

interface BezierBounds { minX: number; maxX: number; minY: number; maxY: number; }

function extractBezierBounds(pathData: string): BezierBounds[] {
  const bounds: BezierBounds[] = [];
  const cubicRe = /[Cc]\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)/g;
  
  let match;
  while ((match = cubicRe.exec(pathData)) !== null) {
    const xs = [parseFloat(match[1]), parseFloat(match[3]), parseFloat(match[5])];
    const ys = [parseFloat(match[2]), parseFloat(match[4]), parseFloat(match[6])];
    bounds.push({
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minY: Math.min(...ys), maxY: Math.max(...ys),
    });
  }
  
  return bounds;
}

export function analyzePath(svgPath: string): PathAnalysis {
  const violations: string[] = [];
  let confidence = 0;
  
  const bounds = extractBezierBounds(svgPath);
  if (bounds.length === 0) return { isRealistic: false, violations: [], confidence: 0 };
  
  for (const b of bounds) {
    const width = b.maxX - b.minX;
    const height = b.maxY - b.minY;
    if (height > 1) {
      const ratio = width / height;
      if (ratio >= BANNED_EYE_RATIO.min && ratio <= BANNED_EYE_RATIO.max) {
        violations.push(`eye_ratio:${ratio.toFixed(2)}`);
        confidence += 0.3;
      }
    }
  }
  
  if (bounds.length >= 5) {
    const allMinX = Math.min(...bounds.map(b => b.minX));
    const allMaxX = Math.max(...bounds.map(b => b.maxX));
    const allMinY = Math.min(...bounds.map(b => b.minY));
    const allMaxY = Math.max(...bounds.map(b => b.maxY));
    
    const width = allMaxX - allMinX;
    const height = allMaxY - allMinY;
    
    if (width > 10 && height > 10) {
      const aspect = width / height;
      if (aspect >= BANNED_FACE_ASPECT.min && aspect <= BANNED_FACE_ASPECT.max) {
        violations.push(`face_aspect:${aspect.toFixed(2)}`);
        confidence += 0.5;
      }
    }
  }
  
  return { isRealistic: confidence >= 0.7, violations, confidence: Math.min(confidence, 1) };
}

// ============================================================================
// SEEDED RANDOM
// ============================================================================

function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return () => {
    hash = (hash * 1103515245 + 12345) | 0;
    return ((hash >>> 16) & 0x7fff) / 0x7fff;
  };
}

// ============================================================================
// RACE PALETTES
// ============================================================================

const RACE_PALETTES: Record<Race, string[]> = {
  human: ['#c9a88c', '#a67b5b', '#8d5524'],
  cyborg: ['#64748b', '#3b82f6', '#06b6d4'],
  mutant: ['#84cc16', '#a3e635', '#65a30d'],
  ethereal: ['#c084fc', '#a855f7', '#7c3aed'],
  beast: ['#78350f', '#92400e', '#b45309'],
  elf: ['#d1fae5', '#a7f3d0', '#6ee7b7'],
  darkelf: ['#581c87', '#6b21a8', '#7c3aed'],
  orc: ['#365314', '#3f6212', '#4d7c0f'],
  halfling: ['#fcd34d', '#fbbf24', '#f59e0b'],
  dragonkin: ['#dc2626', '#b91c1c', '#991b1b'],
  fae: ['#f0abfc', '#e879f9', '#d946ef'],
  vampire: ['#1e1b4b', '#312e81', '#3730a3'],
  werewolf: ['#451a03', '#78350f', '#92400e'],
  angel: ['#fefce8', '#fef9c3', '#fef08a'],
  golem: ['#57534e', '#78716c', '#a8a29e'],
  elemental: ['#0ea5e9', '#ef4444', '#22c55e', '#f59e0b'],
  undead: ['#44403c', '#57534e', '#78716c'],
  dwarf: ['#7c2d12', '#9a3412', '#c2410c'],
  alien: ['#22d3ee', '#06b6d4', '#0891b2'],
  giant: ['#6b7280', '#9ca3af', '#d1d5db'],
  merfolk: ['#0d9488', '#14b8a6', '#2dd4bf'],
  centaur: ['#92400e', '#a16207', '#ca8a04'],
  troll: ['#064e3b', '#065f46', '#047857'],
  gnome: ['#7e22ce', '#9333ea', '#a855f7'],
  sprite: ['#fce7f3', '#fbcfe8', '#f9a8d4'],
  phoenix: ['#ea580c', '#f97316', '#fb923c'],
};

// ============================================================================
// CHARACTER GENERATION
// ============================================================================

function generateBody(race: Race, gender: Gender, rand: () => number): string[] {
  const paths: string[] = [];
  const cx = 200;
  
  const headW = 30 + rand() * 15;
  const headH = 40 + rand() * 20;
  
  let headPath = `M ${cx} 20 `;
  if (race === 'elf' || race === 'fae' || race === 'sprite') {
    headPath += `C ${cx + headW} 30 ${cx + headW * 0.8} ${20 + headH} ${cx} ${20 + headH * 1.2} `;
    headPath += `C ${cx - headW * 0.8} ${20 + headH} ${cx - headW} 30 ${cx} 20 Z`;
  } else if (race === 'orc' || race === 'troll' || race === 'giant') {
    headPath += `L ${cx + headW * 1.2} 35 L ${cx + headW} ${20 + headH} `;
    headPath += `L ${cx - headW} ${20 + headH} L ${cx - headW * 1.2} 35 Z`;
  } else if (race === 'alien' || race === 'ethereal') {
    const craniumH = headH * 1.5;
    headPath += `C ${cx + headW * 0.6} 10 ${cx + headW} ${20 + craniumH * 0.3} ${cx + headW * 0.7} ${20 + craniumH * 0.6} `;
    headPath += `C ${cx + headW * 0.5} ${20 + craniumH} ${cx - headW * 0.5} ${20 + craniumH} ${cx - headW * 0.7} ${20 + craniumH * 0.6} `;
    headPath += `C ${cx - headW} ${20 + craniumH * 0.3} ${cx - headW * 0.6} 10 ${cx} 20 Z`;
  } else {
    const squareness = rand();
    if (squareness > 0.5) {
      headPath += `L ${cx + headW} 25 L ${cx + headW} ${20 + headH - 10} `;
      headPath += `C ${cx + headW * 0.5} ${20 + headH} ${cx - headW * 0.5} ${20 + headH} ${cx - headW} ${20 + headH - 10} `;
      headPath += `L ${cx - headW} 25 Z`;
    } else {
      headPath += `C ${cx + headW * 1.3} 20 ${cx + headW * 1.3} ${20 + headH} ${cx} ${20 + headH * 1.1} `;
      headPath += `C ${cx - headW * 1.3} ${20 + headH} ${cx - headW * 1.3} 20 ${cx} 20 Z`;
    }
  }
  paths.push(headPath);
  
  const eyeY = 45 + rand() * 10;
  const eyeSpacing = 15 + rand() * 10;
  const isAnimeStyle = rand() > 0.3;
  const eyeW = isAnimeStyle ? 8 + rand() * 4 : 15 + rand() * 5;
  const eyeH = isAnimeStyle ? 6 + rand() * 4 : 3 + rand() * 2;
  
  for (const side of [-1, 1]) {
    const ex = cx + side * eyeSpacing;
    if (isAnimeStyle) {
      paths.push(`M ${ex - eyeW / 2} ${eyeY} C ${ex - eyeW / 2} ${eyeY - eyeH} ${ex + eyeW / 2} ${eyeY - eyeH} ${ex + eyeW / 2} ${eyeY} C ${ex + eyeW / 2} ${eyeY + eyeH} ${ex - eyeW / 2} ${eyeY + eyeH} ${ex - eyeW / 2} ${eyeY} Z`);
    } else {
      paths.push(`M ${ex - eyeW / 2} ${eyeY} L ${ex} ${eyeY - eyeH} L ${ex + eyeW / 2} ${eyeY} L ${ex} ${eyeY + eyeH / 2} Z`);
    }
  }
  
  const shoulderW = gender === 'male' ? 50 : 40;
  const torsoH = 80 + rand() * 20;
  paths.push(`M ${cx - shoulderW} 100 L ${cx - shoulderW * 0.7} ${100 + torsoH} L ${cx + shoulderW * 0.7} ${100 + torsoH} L ${cx + shoulderW} 100 Z`);
  
  return paths;
}

export function generateCharacter(race: Race, gender: Gender, seed?: string): GeneratedCharacter {
  const actualSeed = seed || `${race}-${gender}-${Date.now()}`;
  const rand = seededRandom(actualSeed);
  
  const paths = generateBody(race, gender, rand);
  const violations: string[] = [];
  
  for (const path of paths) {
    const analysis = analyzePath(path);
    if (analysis.isRealistic) violations.push(...analysis.violations);
  }
  
  const hash = bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(paths))));
  
  return { paths, hash, race, gender, seed: actualSeed, isValid: violations.length === 0, violations };
}

// ============================================================================
// BACKGROUND GENERATION
// ============================================================================

const SECTION_THEMES: Record<string, { shapes: number; complexity: number }> = {
  workspace: { shapes: 8, complexity: 0.3 },
  mailbox: { shapes: 12, complexity: 0.5 },
  dashboard: { shapes: 6, complexity: 0.2 },
  tradfi_ed: { shapes: 10, complexity: 0.4 },
};

export function generateBackground(section: string, seed: string): GeneratedBackground {
  const rand = seededRandom(seed);
  const theme = SECTION_THEMES[section] || { shapes: 8, complexity: 0.3 };
  const palette = ['#1a1a2e', '#16213e', '#0f3460', '#8b5cf6', '#06b6d4'];
  
  const elements: BackgroundElement[] = [];
  
  for (let i = 0; i < theme.shapes; i++) {
    const type = rand() > 0.5 ? 'rect' : 'circle';
    const color = palette[Math.floor(rand() * palette.length)];
    const opacity = 0.1 + rand() * 0.3;
    
    if (type === 'rect') {
      elements.push({
        type: 'rect',
        props: { x: rand() * 400, y: rand() * 400, width: 20 + rand() * 80, height: 20 + rand() * 80, fill: color, opacity, rx: rand() * 10 },
      });
    } else {
      elements.push({
        type: 'circle',
        props: { cx: rand() * 400, cy: rand() * 400, r: 10 + rand() * 40, fill: color, opacity },
      });
    }
  }
  
  const hash = bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(elements))));
  return { elements, palette, hash, section, seed };
}

// ============================================================================
// CODE SCANNING
// ============================================================================

export function scanCode(code: string): CodeScanResult {
  const violations: string[] = [];
  
  for (const pattern of IMAGE_BYPASS_PATTERNS) {
    if (pattern.test(code)) violations.push(`image_bypass:${pattern.source.slice(0, 30)}`);
  }
  
  const hexColors = code.match(/#[0-9A-Fa-f]{6}\b/g) || [];
  const skinToneCount = hexColors.filter(hex => analyzeColor(hex).isRealisticSkin).length;
  if (skinToneCount >= 3) violations.push(`excessive_skin_tones:${skinToneCount}`);
  
  const pathMatches = code.match(/d\s*=\s*["']([^"']+)["']/g) || [];
  for (const match of pathMatches) {
    const pathData = match.replace(/d\s*=\s*["']/, '').replace(/["']$/, '');
    const analysis = analyzePath(pathData);
    if (analysis.isRealistic) violations.push(...analysis.violations);
  }
  
  return { isValid: violations.length === 0, violations };
}

// ============================================================================
// USER AVATAR PLUGIN
// ============================================================================

const USER_AVATAR_KEY = 'kv_avatar_identity';
const USER_L1_HASH_KEY = 'kv_avatar_l1_hash';

let storage: { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void>; } | null = null;

export function setStorage(s: typeof storage): void { storage = s; }

export async function loadUserAvatar(): Promise<UserAvatarPlugin | null> {
  if (!storage) return null;
  try {
    const stored = await storage.get(USER_AVATAR_KEY);
    if (!stored) return null;
    const avatar = JSON.parse(stored);
    const l1Hash = await storage.get(USER_L1_HASH_KEY);
    const computedHash = bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(avatar.paths))));
    return { enabled: true, avatarHash: avatar.hash, paths: avatar.paths, race: avatar.race, gender: avatar.gender, apt: avatar.apt || '', l1Verified: l1Hash === computedHash };
  } catch { return null; }
}

export async function initAvatarContext(fallbackRace: Race = 'human', fallbackGender: Gender = 'neutral'): Promise<AvatarContext> {
  const userAvatar = await loadUserAvatar();
  return { userAvatar, useUserAvatar: userAvatar?.l1Verified ?? false, fallbackRace, fallbackGender };
}

export function getAvatar(context: AvatarContext, seed?: string): GeneratedCharacter | UserAvatarPlugin {
  if (context.useUserAvatar && context.userAvatar) return context.userAvatar;
  return generateCharacter(context.fallbackRace, context.fallbackGender, seed);
}

export function isUserAvatar(avatar: GeneratedCharacter | UserAvatarPlugin): avatar is UserAvatarPlugin {
  return 'apt' in avatar && 'l1Verified' in avatar;
}

export function renderAvatar(avatar: GeneratedCharacter | UserAvatarPlugin, options: { scale?: number; showBadge?: boolean } = {}): { paths: string[]; badge?: string } {
  const { scale = 1, showBadge = true } = options;
  const paths = scale === 1 ? avatar.paths : avatar.paths.map(p => p.replace(/([-\d.]+)/g, (m) => (parseFloat(m) * scale).toFixed(2)));
  const badge = showBadge && isUserAvatar(avatar) && avatar.l1Verified ? 'M 85 5 L 90 10 L 98 2' : undefined;
  return { paths, badge };
}

// ============================================================================
// SDK VERSION & HASH
// ============================================================================

export const SDK_VERSION = '2.0.0';
export const SDK_TEMPLATE_HASH = bytesToHex(sha256(new TextEncoder().encode('KASVILLAGE_PROCEDURAL_SDK_V2_USER_AVATAR_PLUGIN')));
export function verifySDKVersion(hash: string): boolean { return hash === SDK_TEMPLATE_HASH; }
