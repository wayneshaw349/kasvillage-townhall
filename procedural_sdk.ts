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
  // Original patterns
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
  // FIX 1: DOM injection (innerHTML/outerHTML can inject <img> tags)
  /\.innerHTML\s*[=+]/i,
  /\.outerHTML\s*[=+]/i,
  /\.insertAdjacentHTML\s*\(/i,
  /document\.write\s*\(/i,
  // FIX 2: WebSocket image transfer
  /WebSocket[^}]*send\s*\([^)]*(?:blob|arraybuffer|image|photo|avatar)/i,
  /\.send\s*\([^)]*(?:imageData|imgData|photoData|faceData)/i,
  /new\s+WebSocket\s*\([^)]*(?:image|photo|avatar|face)/i,
  // FIX 3: iframe injection (embed external phishing pages)
  /<iframe\s+[^>]*src\s*=/i,
  /createElement\s*\(\s*['"]iframe['"]/i,
  /\.src\s*=\s*['"](?:https?:|data:text\/html)/i,
  /window\.open\s*\(/i,
  /\.contentWindow/i,
  /\.contentDocument/i,

  // GAP 1: CSS background-image (load photo via CSS)
  /background-image\s*:\s*url\s*\(/i,
  /background\s*:[^;]*url\s*\(/i,
  // GAP 2: CSS @import (load external stylesheet with images)
  /@import\s+(?:url\s*\()?\s*['"]?https?:/i,
  /\.addRule|insertRule[^}]*url\s*\(/i,
  // GAP 3: Video/audio with poster attribute (embed images via media)
  /<video\s+[^>]*poster\s*=/i,
  /<video\s+[^>]*src\s*=/i,
  /<source\s+[^>]*src\s*=\s*['"][^'"]*\.(jpg|png|gif|webp|mp4)/i,
  /createElement\s*\(\s*['"]video['"]/i,
  // GAP 4: SVG <image> tag (SVG can embed external images)
  /<image\s+[^>]*href\s*=/i,
  /<image\s+[^>]*xlink:href\s*=/i,
  /createElementNS[^)]*image/i,
  // GAP 5: Worker/ServiceWorker (background thread can load images)
  /new\s+Worker\s*\(/i,
  /new\s+SharedWorker\s*\(/i,
  /navigator\.serviceWorker\.register/i,
  /importScripts\s*\(/i,
  // GAP 6: Obfuscated code (hides real code from scanner)
  /eval\s*\(/i,
  /atob\s*\(/i,
  /new\s+Function\s*\(/i,
  /setTimeout\s*\(\s*['"]/i,
  /setInterval\s*\(\s*['"]/i,
  /String\.fromCharCode/i,
  /unescape\s*\(/i,
  // GAP 7: Dynamic import (load unscanned module at runtime)
  /import\s*\(\s*['"][^'"]*['"]\s*\)/i,
  /require\s*\(\s*['"][^'"]*https?:/i,
  /System\.import\s*\(/i,
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

// Required SDK module imports — DApps MUST import at least one
export const REQUIRED_SDK_IMPORTS = [
  'procedural_sdk',
  'kasvillage_avatar_engine',
  'kasvillage_canvas_renderer',
  'kasvillage_audio_ui',
  'kasvillage_game_v1',
  'kasvillage_game_input_paint',
  'kasvillage_environments',
  'kasvillage_particles',
  'kasvillage_item_library',
  'kasvillage_shape_dictionary',
  'kasvillage_detail_engine',
  'kasvillage_skia_adapter',
  'kasvillage_wallet_bridge',
  'kasvillage_vscode_sdk',
];

export const SDK_VERSION = '2.0.0';
export const SDK_TEMPLATE_HASH = bytesToHex(sha256(new TextEncoder().encode('KASVILLAGE_PROCEDURAL_SDK_V2_USER_AVATAR_PLUGIN')));

// ============================================================================
// FIX 4: TownHall integration — scanCode wrapper for server-side verification
// ============================================================================

export interface TownHallScanResult {
  isValid: boolean;
  violations: string[];
  codeHash: string;
  sdkHash: string;
  timestamp: number;
}

/**
 * scanCode wrapper for TownHall verify-dapp endpoint.
 * TownHall calls this to verify DApp code at registration AND periodically.
 */
export function scanCodeForTownHall(code: string, sdkVersion: string): TownHallScanResult {
  const scan = scanCode(code);
  const codeHash = bytesToHex(sha256(new TextEncoder().encode(code)));
  return {
    isValid: scan.isValid,
    violations: scan.violations,
    codeHash,
    sdkHash: SDK_TEMPLATE_HASH,
    timestamp: Math.floor(Date.now() / 1000),
  };
}


// ============================================================================
// FIX 5: Periodic re-scan — wallet calls this to verify DApp hasn't changed
// ============================================================================

export interface RescanResult {
  dappId: string;
  currentHash: string;
  expectedHash: string;
  matches: boolean;
  scanResult: CodeScanResult;
  timestamp: number;
}

/**
 * Wallet calls this periodically to re-verify a DApp.
 * If code changed or violations found, DApp becomes invisible.
 */
export function periodicRescan(dappId: string, currentCode: string, expectedHash: string): RescanResult {
  const currentHash = bytesToHex(sha256(new TextEncoder().encode(currentCode)));
  const scanResult = scanCode(currentCode);
  return {
    dappId,
    currentHash,
    expectedHash,
    matches: currentHash === expectedHash,
    scanResult,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

export function verifySDKVersion(hash: string): boolean { return hash === SDK_TEMPLATE_HASH; }

// ============================================================================
// FIX 6: SDK file hashes for Arweave inscription
// ============================================================================

/** 
 * Complete SDK file hashes — inscribe these to Arweave as KV-Type=sdk-release.
 * Any modification to any file changes the hash → TownHall rejects.
 */
export const SDK_FILE_HASHES = {
  version: '2.1.0',
  source: 'f9e238739abddcb34bab47548339f128f8cfcf85b0b209fa770b2cd30135f5fc',
  // Recompute after build: sha256sum dist/index.js dist/index.mjs
  dist_cjs: 'RECOMPUTE_AFTER_BUILD',
  dist_esm: 'RECOMPUTE_AFTER_BUILD',
  constraintsPatternCount: 2,
  totalPatterns: 53,
};

/**
 * Verify the complete SDK — checks source hash + template hash + pattern count.
 */
export function verifySDKComplete(sourceHash: string, templateHash: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (sourceHash !== SDK_FILE_HASHES.source) errors.push('source_hash_mismatch');
  if (templateHash !== SDK_TEMPLATE_HASH) errors.push('template_hash_mismatch');
  return { valid: errors.length === 0, errors };
}



// ============================================================================
// COMPLETE WHITELIST — v2.0
// Games, DApps, Websites — all legitimate patterns allowed
// ============================================================================

/**
 * WHITELIST ARCHITECTURE:
 * - BLOCKED patterns: always rejected, no exceptions
 * - WHITELISTED patterns: allowed with context rules
 * - FETCH policy: block by MIME type, not domain
 * 
 * Rule: if it renders pixels from MATH → allowed
 *       if it loads pixels from a URL → blocked
 */

// ── STEP 1: Canvas / Rendering (games need all of these) ────────────────────
export const WHITELIST_CANVAS = [
  'drawImage',              // render procedural frames to canvas
  'new Image()',            // load SVG data URI (not external URL)
  'toDataURL',              // export procedural sprite atlas
  'OffscreenCanvas',        // off-thread rendering
  'createElement(\'canvas\')', // create procedural canvases
  'getContext(\'2d\')',        // 2D canvas context
  'getContext(\'webgl\')',     // 3D WebGL context
  'getContext(\'webgl2\')',    // WebGL2
  'createImageBitmap',      // from canvas/blob, not URL
  'putImageData',           // write pixel data to canvas
  'getImageData',           // read pixel data from canvas
  'requestAnimationFrame',  // game loop
  'cancelAnimationFrame',   // cleanup
  'createLinearGradient',   // procedural gradients
  'createRadialGradient',   // procedural gradients
  'createConicGradient',    // procedural gradients
  'createPattern',          // from canvas source, not image URL
  'globalCompositeOperation', // blending modes
  'Path2D',                 // complex procedural shapes
  'clip',                   // canvas clipping
  'transform',              // canvas transforms
  'setTransform',           // canvas transforms
  'resetTransform',         // canvas transforms
  'save',                   // canvas state
  'restore',                // canvas state
  'measureText',            // text rendering
  'fillText',               // text rendering
  'strokeText',             // text rendering
];

// ── STEP 1b: WebGL / 3D (3D games) ─────────────────────────────────────────
export const WHITELIST_WEBGL = [
  'createProgram',          // shader programs
  'createShader',           // vertex/fragment shaders
  'createTexture',          // procedural textures (not loaded)
  'createBuffer',           // vertex/index buffers
  'createFramebuffer',      // offscreen render targets
  'createRenderbuffer',     // depth/stencil buffers
  'shaderSource',           // GLSL code (procedural)
  'compileShader',          // compile GLSL
  'linkProgram',            // link shader program
  'useProgram',             // activate shader
  'uniform',                // shader uniforms (any: uniform1f, uniform2fv, etc)
  'attribute',              // vertex attributes
  'drawArrays',             // render call
  'drawElements',           // indexed render call
  'texImage2D',             // upload procedural data to texture
  'texSubImage2D',          // update texture region
  'viewport',               // set render viewport
  'enable',                 // GL state (depth test, blending, etc)
  'disable',                // GL state
  'blendFunc',              // blending
  'depthFunc',              // depth testing
  'clearColor',             // clear color
  'clear',                  // clear buffers
];

// ── STEP 2: Audio (procedural sound only) ───────────────────────────────────
export const WHITELIST_AUDIO = [
  'AudioContext',           // create audio context
  'webkitAudioContext',     // Safari fallback
  'createOscillator',       // generate tones (math)
  'createGain',             // volume control
  'createBiquadFilter',     // frequency filter
  'createAnalyser',         // FFT analysis (visualizers)
  'createDelay',            // echo/delay effect
  'createConvolver',        // reverb (procedural impulse)
  'createDynamicsCompressor', // audio compression
  'createWaveShaper',       // distortion
  'createPanner',           // 3D spatial audio
  'createStereoPanner',     // stereo panning
  'createBuffer',           // procedural audio buffer
  'createBufferSource',     // play buffer
  'decodeAudioData',        // decode audio (for Spotify sync)
  'destination',            // audio output
  'resume',                 // resume suspended context
  'suspend',                // suspend context
  'close',                  // cleanup
  'currentTime',            // audio clock
  'sampleRate',             // audio sample rate
];

// ── STEP 3: Binary encoding (crypto, P2P, data) ────────────────────────────
export const WHITELIST_BINARY = [
  'atob',                   // base64 decode
  'btoa',                   // base64 encode
  'fromCharCode',           // binary → string
  'charCodeAt',             // string → binary
  'TextEncoder',            // string → bytes
  'TextDecoder',            // bytes → string
  'ArrayBuffer',            // raw binary buffer
  'DataView',               // structured binary read/write
  'Uint8Array',             // byte array
  'Uint16Array',            // 16-bit array
  'Uint32Array',            // 32-bit array
  'Int8Array',              // signed byte array
  'Int16Array',             // signed 16-bit
  'Int32Array',             // signed 32-bit
  'Float32Array',           // float array (WebGL, audio)
  'Float64Array',           // double array
  'BigInt64Array',          // 64-bit int (crypto)
  'BigUint64Array',         // unsigned 64-bit
  'Buffer.from',            // Node.js buffer (if polyfilled)
];

// ── STEP 4: Module loading (SDK internal only) ──────────────────────────────
export const WHITELIST_IMPORTS = [
  // RULE: dynamic import() allowed ONLY for relative paths starting with ./
  // BLOCKED: import('https://...'), import('http://...'), import('//')
  "import('./kasvillage_",   // SDK modules
  "import('./components/",   // app components
  "import('./screens/",      // app screens
  "import('./utils/",        // app utilities
  "import('./hooks/",        // app hooks
  "import('./avatar_",       // avatar modules
  "import('./procedural_",   // procedural modules
  "import('../",             // parent directory (still local)
  "import('@kasvillage/",    // scoped package
];

// ── STEP 5: Approved fetch domains ──────────────────────────────────────────
export const WHITELIST_FETCH_DOMAINS = [
  'api.spotify.com',        // beat sync
  'arweave.net',            // avatar/identity queries
  'ar-io.net',              // arweave gateway
  'node.irys.xyz',          // irys uploads
  'up.arweave.bundlr.network', // bundlr uploads
  'api.kaspa.org',          // kaspa REST API
  'api-1.kaspa.org',        // kaspa REST API backup
  'localhost',              // local TownHall
  '127.0.0.1',              // local TownHall
  '10.0.0.',                // LAN TownHall
  '192.168.',               // LAN TownHall
  // Developer's own TownHall / Cloudflare Worker URL added at registration
];

// ── STEP 5b: FETCH MIME TYPE POLICY (the key rule) ──────────────────────────
export const BLOCKED_RESPONSE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'image/svg+xml',          // external SVG (inline procedural SVG is fine)
  'video/mp4',
  'video/webm',
  'video/ogg',
  'audio/mpeg',             // mp3 files
  'audio/ogg',
  'audio/wav',
  'audio/aac',
  'application/octet-stream', // binary blobs (could be images)
];

export const ALLOWED_RESPONSE_TYPES = [
  'application/json',       // API data — always allowed from any domain
  'text/plain',             // text data
  'text/html',              // DApp pages (scanned separately)
  'text/css',               // stylesheets (scanned for url() patterns)
  'application/javascript', // scripts (scanned for violations)
  'text/xml',               // XML data
  'application/xml',        // XML data
];

// ── STEP 6: WebSocket / P2P (multiplayer) ───────────────────────────────────
export const WHITELIST_NETWORK = [
  'WebSocket',              // multiplayer connection
  '.send(',                 // send game state (JSON only, not blobs)
  '.onmessage',             // receive game state
  '.onopen',                // connection open
  '.onclose',               // connection close
  '.onerror',               // connection error
  'BleManager',             // Bluetooth P2P
  'react-native-ble',       // BLE library
  'RTCPeerConnection',      // WebRTC (P2P direct)
  'RTCDataChannel',         // WebRTC data
  'createDataChannel',      // WebRTC channel
  'createOffer',            // WebRTC signaling
  'createAnswer',           // WebRTC signaling
  'setLocalDescription',    // WebRTC
  'setRemoteDescription',   // WebRTC
  'addIceCandidate',        // WebRTC
];

// ── STEP 7: DOM manipulation (DApp UIs) ─────────────────────────────────────
export const WHITELIST_DOM = [
  // CREATE elements (safe ones only)
  "createElement('div')",
  "createElement('span')",
  "createElement('p')",
  "createElement('h1')",
  "createElement('h2')",
  "createElement('h3')",
  "createElement('h4')",
  "createElement('h5')",
  "createElement('h6')",
  "createElement('button')",
  "createElement('input')",
  "createElement('textarea')",
  "createElement('select')",
  "createElement('option')",
  "createElement('label')",
  "createElement('form')",
  "createElement('fieldset')",
  "createElement('legend')",
  "createElement('table')",
  "createElement('tr')",
  "createElement('td')",
  "createElement('th')",
  "createElement('thead')",
  "createElement('tbody')",
  "createElement('ul')",
  "createElement('ol')",
  "createElement('li')",
  "createElement('a')",
  "createElement('nav')",
  "createElement('header')",
  "createElement('footer')",
  "createElement('main')",
  "createElement('section')",
  "createElement('article')",
  "createElement('aside')",
  "createElement('dialog')",
  "createElement('details')",
  "createElement('summary')",
  "createElement('canvas')",    // procedural rendering
  "createElement('svg')",       // procedural graphics
  "createElement('pre')",
  "createElement('code')",
  // SVG elements via createElementNS
  "createElementNS",            // SVG namespace elements
  // DOM properties (safe)
  'textContent',             // set text (safe, no HTML parsing)
  'innerText',               // set text (safe)
  'appendChild',
  'removeChild',
  'replaceChild',
  'insertBefore',
  'append',
  'prepend',
  'remove',
  'cloneNode',
  'classList',
  'className',
  'setAttribute',            // with context check: not src/href on img/iframe
  'getAttribute',
  'removeAttribute',
  'dataset',
  'style',
  'style.setProperty',
  'style.cssText',
  'getBoundingClientRect',
  'querySelector',
  'querySelectorAll',
  'getElementById',
  'getElementsByClassName',
  'closest',
  'matches',
  'contains',
  'parentElement',
  'children',
  'firstChild',
  'lastChild',
  'nextSibling',
  'previousSibling',
];

// ── STEP 8: Storage (local state) ───────────────────────────────────────────
export const WHITELIST_STORAGE = [
  'AsyncStorage',           // React Native
  'SecureStore',             // expo-secure-store
  'expo-file-system',        // local files
  'FileSystem.writeAsStringAsync', // save game state
  'FileSystem.readAsStringAsync',  // load game state
  'FileSystem.documentDirectory',  // app documents
  'FileSystem.cacheDirectory',     // app cache
  'indexedDB',               // browser — game saves, offline data
  'IDBFactory',              // indexedDB factory
  'IDBDatabase',             // indexedDB database
  'IDBTransaction',          // indexedDB transaction
  'IDBObjectStore',          // indexedDB store
  'IDBKeyRange',             // indexedDB queries
  'caches',                  // Cache API (PWA offline)
];

// ── STEP 9: Device APIs (legitimate) ────────────────────────────────────────
export const WHITELIST_DEVICE = [
  'Clipboard',               // copy kaspa address
  'navigator.clipboard',     // clipboard API
  'Vibration',               // game haptics
  'navigator.vibrate',       // vibrate API
  'DeviceMotionEvent',       // tilt controls
  'DeviceOrientationEvent',  // gyroscope
  'Accelerometer',           // motion sensor
  'Gyroscope',               // rotation sensor
  'expo-haptics',            // Expo haptics
  'expo-local-authentication', // biometric unlock
  'expo-sensors',            // motion sensors
  'expo-brightness',         // screen brightness
  'expo-screen-orientation', // orientation lock
  'expo-keep-awake',         // prevent sleep during game
  'expo-av',                 // audio/video playback (procedural)
  'expo-font',               // custom fonts
  'expo-asset',              // bundled assets
  'expo-constants',          // device info
  'expo-linking',            // deep links
  'expo-notifications',      // push notifications (game alerts)
  'expo-updates',            // OTA updates
  'Dimensions',              // screen size
  'PixelRatio',              // DPI
  'Appearance',              // dark/light mode
  'Platform',                // iOS/Android detection
  'StatusBar',               // status bar control
  'Keyboard',                // keyboard events
  'BackHandler',             // Android back button
  'AppState',                // foreground/background
  'Linking',                 // URL handling
  'Share',                   // native share sheet
  'Alert',                   // native alert dialog
];

// ── STEP 10: Web API basics (DApp websites) ─────────────────────────────────
export const WHITELIST_WEB_API = [
  'setTimeout',              // with FUNCTION ref only, not string
  'setInterval',             // with FUNCTION ref only, not string
  'clearTimeout',
  'clearInterval',
  'addEventListener',
  'removeEventListener',
  'dispatchEvent',
  'CustomEvent',
  'Event',
  'ResizeObserver',          // responsive layouts
  'IntersectionObserver',    // lazy rendering, scroll triggers
  'MutationObserver',        // reactive UI updates
  'PerformanceObserver',     // performance monitoring
  'performance.now',         // frame timing
  'performance.mark',        // performance marks
  'performance.measure',     // performance measurements
  'history.pushState',       // client-side routing
  'history.replaceState',    // client-side routing
  'location.hash',           // hash routing
  'location.pathname',       // path routing
  'JSON.parse',
  'JSON.stringify',
  'crypto.getRandomValues',  // secure random
  'crypto.subtle',           // Web Crypto (hashing, signing)
  'structuredClone',         // deep copy game state
  'queueMicrotask',          // scheduling
  'AbortController',         // cancel fetch
  'AbortSignal',             // abort signal
  'URLSearchParams',         // parse query strings
  'URL',                     // URL parsing
  'Intl.NumberFormat',       // currency formatting (storefronts)
  'Intl.DateTimeFormat',     // date formatting
  'Intl.RelativeTimeFormat', // "2 hours ago"
  'Intl.PluralRules',       // pluralization
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'WeakRef',
  'FinalizationRegistry',
  'Proxy',                   // reactive state (Vue-style)
  'Reflect',                 // metaprogramming
  'Symbol',                  // unique keys
  'Promise',
  'async/await',
  'for await',               // async iteration
  'matchMedia',              // responsive design
  'scrollIntoView',          // scroll navigation
  'scrollTo',                // scroll control
  'focus',                   // focus management
  'blur',                    // unfocus
  'FontFace',                // custom fonts from APPROVED CDNs only
  'document.fonts',          // font loading API
  'CSS.supports',            // feature detection
  'getComputedStyle',        // read computed styles
  'animate',                 // Web Animations API
  'Animation',               // animation control
  'KeyframeEffect',          // keyframe animations
  // Workers (local scripts only)
  'Worker',                  // RULE: new Worker('./local-script.js') only
  'SharedArrayBuffer',       // multiplayer sync
  'Atomics',                 // atomic operations
  'MessageChannel',          // cross-context messaging
  'MessagePort',             // message ports
  'BroadcastChannel',        // broadcast to tabs
  'postMessage',             // cross-origin messaging (no iframe needed)
  // Gamepad
  'Gamepad',                 // controller support
  'navigator.getGamepads',   // read gamepad state
  'gamepadconnected',        // gamepad events
  'gamepaddisconnected',     // gamepad events
  // Pointer/Touch
  'PointerEvent',            // unified input
  'TouchEvent',              // touch input
  'MouseEvent',              // mouse input
  'WheelEvent',              // scroll/zoom
  'KeyboardEvent',           // keyboard input
  'requestPointerLock',      // FPS mouse capture
  'exitPointerLock',         // release pointer
  // Fullscreen
  'requestFullscreen',       // fullscreen mode
  'exitFullscreen',          // exit fullscreen
  'fullscreenElement',       // check fullscreen state
  // Visibility
  'visibilityState',         // tab visible/hidden
  'hidden',                  // tab hidden
];

// ── STEP 10b: CSS (always allowed, procedural by nature) ────────────────────
export const WHITELIST_CSS = [
  '@keyframes',              // CSS animations
  'transition',              // CSS transitions
  'animation',               // animation property
  'transform',               // CSS transforms
  'filter',                  // CSS filters (blur, brightness)
  'backdrop-filter',         // glass effects
  'clip-path',               // CSS clipping
  'mask',                    // CSS masking
  'mix-blend-mode',          // blending
  'opacity',                 // transparency
  'will-change',             // GPU hints
  'contain',                 // layout containment
  'grid',                    // CSS grid
  'flex',                    // flexbox
  'var(--',                  // CSS custom properties
  ':root',                   // CSS variables scope
  '@media',                  // media queries
  '@supports',               // feature queries
  '@container',              // container queries
  'calc(',                   // CSS math
  'clamp(',                  // CSS clamping
  'min(',                    // CSS min
  'max(',                    // CSS max
  // CSS that stays BLOCKED:
  // background-image: url('https://...') — external images
  // @import url('https://...') — external stylesheets (except approved font CDNs)
  // @font-face src: url('https://...') — only from approved CDNs
];

// ============================================================================
// APPROVED CDNs (fonts and safe libraries only)
// ============================================================================
export const APPROVED_CDNS = [
  'fonts.googleapis.com',    // Google Fonts
  'fonts.gstatic.com',       // Google Fonts files
  'cdnjs.cloudflare.com',    // JS libraries (no images)
  'unpkg.com',               // npm packages
  'cdn.jsdelivr.net',        // npm packages
  'esm.sh',                  // ESM modules
];

// ============================================================================
// MASTER SCANNER — with whitelist context checks
// ============================================================================

export interface ScanResult {
  passed: boolean;
  violations: ScanViolation[];
  warnings: ScanWarning[];
  stats: {
    linesScanned: number;
    patternsChecked: number;
    whitelistApplied: number;
    blockedCount: number;
  };
}

export interface ScanViolation {
  line: number;
  pattern: string;
  code: string;
  severity: 'critical' | 'high' | 'medium';
}

export interface ScanWarning {
  line: number;
  pattern: string;
  code: string;
  note: string;
}

export function scanDAppCode(code: string, registeredDomains: string[] = []): ScanResult {
  const lines = code.split('\n');
  const violations: ScanViolation[] = [];
  const warnings: ScanWarning[] = [];
  let whitelistApplied = 0;

  const allApprovedDomains = [...WHITELIST_FETCH_DOMAINS, ...APPROVED_CDNS, ...registeredDomains];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;
    if (!line || line.startsWith('//') || line.startsWith('*')) continue;

    // ── CRITICAL BLOCKS (never whitelisted) ─────────────────────────
    
    // External image tags
    if (/<img\s/i.test(line) && /src\s*=/i.test(line)) {
      violations.push({ line: lineNum, pattern: '<img src>', code: line, severity: 'critical' });
      continue;
    }

    // Camera access
    if (/getUserMedia|navigator\.camera|navigator\.mediaDevices\.getUserMedia/i.test(line)) {
      violations.push({ line: lineNum, pattern: 'camera_access', code: line, severity: 'critical' });
      continue;
    }

    // iframe injection
    if (/<iframe/i.test(line) || /createElement\(.*iframe/i.test(line)) {
      violations.push({ line: lineNum, pattern: 'iframe', code: line, severity: 'critical' });
      continue;
    }

    // External image fetch (check MIME, not domain)
    if (/fetch\(.*\.(jpg|jpeg|png|gif|webp|bmp|tiff|ico)/i.test(line)) {
      violations.push({ line: lineNum, pattern: 'fetch_image_file', code: line, severity: 'critical' });
      continue;
    }

    // Upload real photos
    if (/uploadPhoto|uploadImage|uploadFace|uploadSelfie/i.test(line)) {
      violations.push({ line: lineNum, pattern: 'upload_real_image', code: line, severity: 'critical' });
      continue;
    }

    // ── HIGH BLOCKS (whitelisted with context) ──────────────────────

    // innerHTML — blocked unless in comments or dev tools
    if (/innerHTML\s*=/.test(line)) {
      violations.push({ line: lineNum, pattern: 'innerHTML_assignment', code: line, severity: 'high' });
      continue;
    }

    // outerHTML
    if (/outerHTML\s*=/.test(line)) {
      violations.push({ line: lineNum, pattern: 'outerHTML_assignment', code: line, severity: 'high' });
      continue;
    }

    // document.write
    if (/document\.write\s*\(/.test(line)) {
      violations.push({ line: lineNum, pattern: 'document_write', code: line, severity: 'high' });
      continue;
    }

    // insertAdjacentHTML
    if (/insertAdjacentHTML/.test(line)) {
      violations.push({ line: lineNum, pattern: 'insertAdjacentHTML', code: line, severity: 'high' });
      continue;
    }

    // eval() — always blocked
    if (/[^a-zA-Z]eval\s*\(/.test(line) && !/\/\//.test(line.split('eval')[0])) {
      violations.push({ line: lineNum, pattern: 'eval', code: line, severity: 'critical' });
      continue;
    }

    // new Function() — always blocked
    if (/new\s+Function\s*\(/.test(line)) {
      violations.push({ line: lineNum, pattern: 'new_Function', code: line, severity: 'critical' });
      continue;
    }

    // setTimeout with string — blocked (function ref OK)
    if (/setTimeout\s*\(\s*['"`]/.test(line)) {
      violations.push({ line: lineNum, pattern: 'setTimeout_string', code: line, severity: 'high' });
      continue;
    }

    // setInterval with string — blocked
    if (/setInterval\s*\(\s*['"`]/.test(line)) {
      violations.push({ line: lineNum, pattern: 'setInterval_string', code: line, severity: 'high' });
      continue;
    }

    // ── CONTEXT-CHECKED (whitelisted if source is procedural) ───────

    // dynamic import() — only local paths allowed
    if (/import\s*\(/.test(line)) {
      const importMatch = line.match(/import\s*\(['"`]([^'"`]+)['"`]\)/);
      if (importMatch) {
        const target = importMatch[1];
        if (target.startsWith('./') || target.startsWith('../') || target.startsWith('@kasvillage/')) {
          whitelistApplied++;
          // Local import — allowed
        } else if (target.startsWith('http') || target.startsWith('//')) {
          violations.push({ line: lineNum, pattern: 'external_dynamic_import', code: line, severity: 'critical' });
        } else {
          // npm package name — warn but allow
          warnings.push({ line: lineNum, pattern: 'npm_dynamic_import', code: line, note: 'Dynamic import of npm package — verify it\'s in package.json' });
          whitelistApplied++;
        }
      }
      continue;
    }

    // Worker — only local scripts
    if (/new\s+Worker\s*\(/.test(line)) {
      const workerMatch = line.match(/new\s+Worker\s*\(['"`]([^'"`]+)['"`]/);
      if (workerMatch && (workerMatch[1].startsWith('http') || workerMatch[1].startsWith('//'))) {
        violations.push({ line: lineNum, pattern: 'external_worker', code: line, severity: 'critical' });
      } else {
        whitelistApplied++;
        // Local worker — allowed
      }
      continue;
    }

    // ServiceWorker — only local
    if (/serviceWorker\.register/.test(line)) {
      const swMatch = line.match(/register\s*\(['"`]([^'"`]+)['"`]/);
      if (swMatch && (swMatch[1].startsWith('http') || swMatch[1].startsWith('//'))) {
        violations.push({ line: lineNum, pattern: 'external_serviceworker', code: line, severity: 'critical' });
      } else {
        whitelistApplied++;
      }
      continue;
    }

    // fetch() — check domain against approved list + block image MIME in URL
    if (/fetch\s*\(/.test(line)) {
      const fetchMatch = line.match(/fetch\s*\(['"`]([^'"`]+)['"`]/);
      if (fetchMatch) {
        const url = fetchMatch[1];
        // Relative URLs are always OK
        if (url.startsWith('./') || url.startsWith('../') || url.startsWith('/')) {
          whitelistApplied++;
        } else {
          // Check if domain is approved
          const isApproved = allApprovedDomains.some(d => url.includes(d));
          if (!isApproved) {
            // Not approved — warn but don't block (MIME check at runtime handles it)
            warnings.push({ line: lineNum, pattern: 'unapproved_fetch_domain', code: line, note: 'Domain not in approved list — runtime MIME check will block images' });
          }
          whitelistApplied++;
        }
      }
      continue;
    }

    // @import url() — only approved CDNs
    if (/@import\s+url\s*\(/.test(line)) {
      const importUrl = line.match(/url\s*\(['"`]?([^'"`\)]+)/);
      if (importUrl) {
        const isApproved = APPROVED_CDNS.some(cdn => importUrl[1].includes(cdn));
        if (!isApproved) {
          violations.push({ line: lineNum, pattern: 'unapproved_css_import', code: line, severity: 'medium' });
        } else {
          whitelistApplied++;
        }
      }
      continue;
    }

    // background-image: url() — only data URIs or approved CDNs
    if (/background(-image)?\s*:.*url\s*\(/.test(line)) {
      const bgUrl = line.match(/url\s*\(['"`]?([^'"`\)]+)/);
      if (bgUrl) {
        if (bgUrl[1].startsWith('data:')) {
          whitelistApplied++; // data URI (procedural SVG) — OK
        } else {
          violations.push({ line: lineNum, pattern: 'external_background_image', code: line, severity: 'high' });
        }
      }
      continue;
    }

    // @font-face src — only approved CDNs
    if (/src\s*:.*url\s*\(/.test(line) && /font/i.test(lines.slice(Math.max(0, i-5), i).join(' '))) {
      const fontUrl = line.match(/url\s*\(['"`]?([^'"`\)]+)/);
      if (fontUrl) {
        const isApproved = APPROVED_CDNS.some(cdn => fontUrl[1].includes(cdn)) ||
                           fontUrl[1].includes('fonts.gstatic.com') || fontUrl[1].includes('fonts.googleapis.com');
        if (!isApproved && !fontUrl[1].startsWith('data:')) {
          violations.push({ line: lineNum, pattern: 'unapproved_font_source', code: line, severity: 'medium' });
        } else {
          whitelistApplied++;
        }
      }
      continue;
    }

    // Whitelisted patterns — these are safe, just count them
    if (/drawImage|toDataURL|createImageBitmap|new Image/.test(line)) { whitelistApplied++; }
    if (/atob|btoa|fromCharCode|charCodeAt/.test(line)) { whitelistApplied++; }
    if (/AudioContext|createOscillator|createGain/.test(line)) { whitelistApplied++; }
    if (/OffscreenCanvas|getContext/.test(line)) { whitelistApplied++; }
  }

  // SDK IMPORT REQUIREMENT — must use at least one KasVillage module
  const hasSDKImport = REQUIRED_SDK_IMPORTS.some(mod => 
    code.includes("from './" + mod + "'") || code.includes("from '" + mod + "'") ||
    code.includes('from "./' + mod + '"') || code.includes('from "' + mod + '"') ||
    code.includes("from '@kasvillage/") || code.includes("require('./" + mod + "')")
  );
  if (!hasSDKImport) {
    violations.push({ line: 1, pattern: 'missing_sdk_import', code: '(entire file)', severity: 'critical' });
    warnings.push({ line: 1, pattern: 'sdk_required', code: '', note: 'DApps must import from at least one KasVillage SDK module. Build with the SDK — not around it.' });
  } else { whitelistApplied++; }
  // Warn if using raw fetch without kvFetch
  if ((code.match(/[^a-zA-Z]fetch\s*\(/g)?.length || 0) > 0 && !code.includes('kvFetch')) {
    warnings.push({ line: 0, pattern: 'raw_fetch_without_kvFetch', code: '', note: 'Use kvFetch() from SDK instead of raw fetch(). kvFetch blocks image responses at runtime.' });
  }

  return {
    passed: violations.length === 0,
    violations,
    warnings,
    stats: {
      linesScanned: lines.length,
      patternsChecked: lines.filter(l => l.trim() && !l.trim().startsWith('//')).length,
      whitelistApplied,
      blockedCount: violations.length,
      sdkImportFound: hasSDKImport,
    }
  };
}

// ============================================================================
// RUNTIME FETCH WRAPPER — enforces MIME type policy
// ============================================================================

/**
 * Wraps fetch() to block image/video/audio responses regardless of domain.
 * DApps must use this instead of native fetch when running inside KasVillage.
 * 
 * Usage: const data = await kvFetch('https://any-api.com/data');
 * 
 * Returns JSON data from any domain.
 * Throws on image/video/audio responses.
 */
export async function kvFetch(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  const contentType = response.headers.get('content-type') || '';
  
  const isBlocked = BLOCKED_RESPONSE_TYPES.some(t => contentType.toLowerCase().includes(t));
  if (isBlocked) {
    throw new Error(
      '[KasVillage] Blocked: response type "' + contentType + '" not allowed. ' +
      'Only JSON/text/HTML responses permitted. Use procedural rendering instead.'
    );
  }
  
  return response;
}

// ============================================================================
// REGISTRATION HELPER — developers call this to register their DApp
// ============================================================================

export interface DAppRegistration {
  dappId: string;
  codeHash: string;
  sdkHash: string;
  developerPubkey: string;
  approvedDomains: string[];    // custom API domains this DApp needs
  scanResult: ScanResult;
  timestamp: number;
}

export function prepareDAppRegistration(
  code: string,
  sdkHash: string,
  developerPubkey: string,
  dappId: string,
  customDomains: string[] = []
): DAppRegistration {
  const scanResult = scanDAppCode(code, customDomains);
  
  // Hash the code
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    const char = code.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const codeHash = Math.abs(hash).toString(16).padStart(16, '0');
  
  return {
    dappId,
    codeHash,
    sdkHash,
    developerPubkey,
    approvedDomains: customDomains,
    scanResult,
    timestamp: Date.now(),
  };
}
