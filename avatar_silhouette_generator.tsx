// KasVillage Identity Ritual - Avatar Silhouette Generator
// NO SEED - Pure runtime randomness - Hash inscribed, paths stored locally
// Flow: Generate → Preview → Confirm → Hash → Inscribe hash → Store paths locally

import React from 'react';
import Svg, { Path, G } from 'react-native-svg';
import * as SecureStore from 'expo-secure-store';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

export type Gender = 'male' | 'female';
export type Race = 
  | 'human' | 'cyborg' | 'mutant' | 'ethereal' | 'beast'
  | 'elf' | 'darkelf' | 'orc' | 'halfling' | 'dragonkin' | 'fae'
  | 'vampire' | 'werewolf' | 'angel' | 'golem' | 'elemental' | 'undead'
  | 'dwarf' | 'alien' | 'giant' | 'merfolk' | 'centaur' | 'troll'
  | 'gnome' | 'sprite' | 'phoenix';

const seededRandom = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

// Derive a numeric seed from a public key / identity string
export const deriveSeed = (publicKeyHex: string): number => {
  let h = 0;
  for (let i = 0; i < publicKeyHex.length; i++) {
    h = (Math.imul(31, h) + publicKeyHex.charCodeAt(i)) >>> 0;
  }
  return h;
};

const BODY_PARAMS = {
  male: { shoulderWidth: 1.15, hipWidth: 0.88, waistWidth: 0.95, neckWidth: 1.1, jawWidth: 1.08 },
  female: { shoulderWidth: 0.92, hipWidth: 1.08, waistWidth: 0.8, neckWidth: 0.88, jawWidth: 0.94 },
};

// ============================================================================
// HASH & STORAGE UTILITIES
// ============================================================================

export interface AvatarIdentity {
  paths: string[];
  hash: string;
  race: Race;
  gender: Gender;
  createdAt: number;
}

/**
 * Compute SHA256 hash of avatar paths
 */
export const computeAvatarHash = (paths: string[]): string => {
  const pathsJSON = new TextEncoder().encode(JSON.stringify(paths));
  return bytesToHex(sha256(pathsJSON));
};

/**
 * Store avatar paths securely on device
 */
export const storeAvatarLocally = async (identity: AvatarIdentity): Promise<void> => {
  await SecureStore.setItemAsync('kv_avatar_identity', JSON.stringify(identity));
};

/**
 * Retrieve stored avatar from device
 */
export const getStoredAvatar = async (): Promise<AvatarIdentity | null> => {
  const stored = await SecureStore.getItemAsync('kv_avatar_identity');
  return stored ? JSON.parse(stored) : null;
};

/**
 * Verify avatar paths match a hash
 */
export const verifyAvatarHash = (paths: string[], expectedHash: string): boolean => {
  const computedHash = computeAvatarHash(paths);
  return computedHash === expectedHash;
};

/**
 * Generate full SVG string from paths (for local backup/export)
 */
export const generateSVGString = (
  paths: string[],
  fillColor = '#1a1a2e',
  strokeColor = '#8b5cf6'
): string => {
  const pathElements = paths
    .map(d => `<path d="${d}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="0.5" opacity="0.95"/>`)
    .join('\n');
  
  return `<svg width="400" height="450" viewBox="0 0 400 450" xmlns="http://www.w3.org/2000/svg">
<g>
${pathElements}
</g>
</svg>`;
};

/**
 * Prepare inscription payload (32 bytes hash)
 */
export const prepareInscriptionPayload = (hash: string): {
  type: 'KV2U';
  field: 'avatarHash';
  value: string;
  bytes: number;
} => ({
  type: 'KV2U',
  field: 'avatarHash',
  value: hash,
  bytes: 32,
});

// ============================================================================
// GENERATOR FUNCTIONS - Each returns string[] of SVG path data
// ============================================================================

export const generateHumanSilhouette = (gender: Gender, seed: number = 1): string[] => {
  const p = BODY_PARAMS[gender];
  const paths: string[] = [];
  let s = seed;
  const r = () => seededRandom(s++);
  const cx = 200, baseY = 45;
  const headW = 36 * p.jawWidth;
  const headH = 46;

  // Skull with micro-variations
  let skull = `M ${cx} ${baseY}`;
  for (let i = 0; i <= 35; i++) {
    const angle = (i / 35) * Math.PI;
    const variation = (r() - 0.5) * 2;
    const rx = headW * (0.95 + r() * 0.04);
    const ry = headH * 0.52;
    const x = cx + Math.sin(angle) * rx + variation;
    const y = baseY + 4 - Math.cos(angle) * ry;
    skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  skull += ` C ${cx + headW * 0.92} ${baseY + headH * 0.32} ${cx + headW * 0.98} ${baseY + headH * 0.45} ${cx + headW * 0.95} ${baseY + headH * 0.55}`;
  skull += ` C ${cx + headW * 0.98} ${baseY + headH * 0.65} ${cx + headW * 0.88} ${baseY + headH * 0.78} ${cx + headW * 0.72} ${baseY + headH * 0.88}`;
  skull += ` C ${cx + headW * 0.5} ${baseY + headH * 0.96} ${cx + headW * 0.2} ${baseY + headH * 1.0} ${cx} ${baseY + headH * 1.02}`;
  skull += ` C ${cx - headW * 0.2} ${baseY + headH * 1.0} ${cx - headW * 0.5} ${baseY + headH * 0.96} ${cx - headW * 0.72} ${baseY + headH * 0.88}`;
  skull += ` C ${cx - headW * 0.88} ${baseY + headH * 0.78} ${cx - headW * 0.98} ${baseY + headH * 0.65} ${cx - headW * 0.95} ${baseY + headH * 0.55}`;
  skull += ` C ${cx - headW * 0.98} ${baseY + headH * 0.45} ${cx - headW * 0.92} ${baseY + headH * 0.32} ${cx - headW * 0.88} ${baseY + headH * 0.15}`;
  skull += ' Z';
  paths.push(skull);

  // Hair with random variations
  let hair = `M ${cx} ${baseY - 5}`;
  const hairVolume = 1.05 + r() * 0.15;
  for (let i = 0; i <= 30; i++) {
    const angle = (i / 30) * Math.PI;
    const strand = (r() - 0.5) * 6;
    const x = cx + Math.sin(angle) * headW * hairVolume + strand;
    const y = baseY - 8 - Math.cos(angle) * headH * 0.5 + r() * 3;
    hair += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  if (gender === 'female') {
    const hairLength = 80 + r() * 40;
    hair += ` C ${cx + headW * 1.2} ${baseY + headH * 0.5} ${cx + headW * 1.15} ${baseY + headH + hairLength * 0.4} ${cx + headW * 0.9} ${baseY + headH + hairLength}`;
    for (let i = 0; i < 10; i++) {
      const wave = (r() - 0.5) * 15;
      hair += ` L ${cx + headW * (0.8 - i * 0.15) + wave} ${baseY + headH + hairLength + i * 3}`;
    }
    hair += ` L ${cx - headW * 0.9} ${baseY + headH + hairLength}`;
    hair += ` C ${cx - headW * 1.15} ${baseY + headH + hairLength * 0.4} ${cx - headW * 1.2} ${baseY + headH * 0.5} ${cx - headW * hairVolume} ${baseY - 6}`;
  } else {
    hair += ` C ${cx + headW * 1.1} ${baseY + headH * 0.4} ${cx + headW * 1.0} ${baseY + headH * 0.6} ${cx + headW * 0.9} ${baseY + headH * 0.55}`;
    hair += ` L ${cx - headW * 0.9} ${baseY + headH * 0.55}`;
    hair += ` C ${cx - headW * 1.0} ${baseY + headH * 0.6} ${cx - headW * 1.1} ${baseY + headH * 0.4} ${cx - headW * hairVolume} ${baseY - 6}`;
  }
  hair += ' Z';
  paths.push(hair);

  // Eyes with unique variations
  const eyeY = baseY + headH * 0.44;
  const eyeSpacing = headW * (0.28 + r() * 0.06);
  const eyeW = 8 + r() * 3, eyeH = 5 + r() * 2;
  for (let side = -1; side <= 1; side += 2) {
    const eyeX = cx + side * eyeSpacing;
    paths.push(`M ${eyeX - eyeW} ${eyeY} C ${eyeX - eyeW} ${eyeY - eyeH} ${eyeX + eyeW} ${eyeY - eyeH} ${eyeX + eyeW} ${eyeY} C ${eyeX + eyeW} ${eyeY + eyeH * 0.6} ${eyeX - eyeW} ${eyeY + eyeH * 0.6} ${eyeX - eyeW} ${eyeY} Z`);
    const irisR = 3 + r();
    paths.push(`M ${eyeX - irisR} ${eyeY - 1} C ${eyeX - irisR} ${eyeY - irisR - 1} ${eyeX + irisR} ${eyeY - irisR - 1} ${eyeX + irisR} ${eyeY - 1} C ${eyeX + irisR} ${eyeY + irisR - 1} ${eyeX - irisR} ${eyeY + irisR - 1} ${eyeX - irisR} ${eyeY - 1} Z`);
    paths.push(`M ${eyeX - 1.5} ${eyeY - 1} C ${eyeX - 1.5} ${eyeY - 2.5} ${eyeX + 1.5} ${eyeY - 2.5} ${eyeX + 1.5} ${eyeY - 1} C ${eyeX + 1.5} ${eyeY + 0.5} ${eyeX - 1.5} ${eyeY + 0.5} ${eyeX - 1.5} ${eyeY - 1} Z`);
  }

  // Brows
  const browY = eyeY - eyeH - 5 - r() * 3;
  const browArch = 3 + r() * 4;
  paths.push(`M ${cx + eyeSpacing - eyeW - 3} ${browY + 3} Q ${cx + eyeSpacing} ${browY - browArch} ${cx + eyeSpacing + eyeW + 3} ${browY + 2}`);
  paths.push(`M ${cx - eyeSpacing + eyeW + 3} ${browY + 3} Q ${cx - eyeSpacing} ${browY - browArch} ${cx - eyeSpacing - eyeW - 3} ${browY + 2}`);

  // Nose
  const noseY = baseY + headH * 0.65;
  const noseW = 4 + r() * 3;
  paths.push(`M ${cx} ${eyeY + 6} C ${cx + 2} ${noseY - 8} ${cx + noseW} ${noseY} ${cx + noseW + 2} ${noseY + 5} C ${cx + noseW + 3} ${noseY + 8} ${cx + 2} ${noseY + 10} ${cx} ${noseY + 8} C ${cx - 2} ${noseY + 10} ${cx - noseW - 3} ${noseY + 8} ${cx - noseW - 2} ${noseY + 5} C ${cx - noseW} ${noseY} ${cx - 2} ${noseY - 8} ${cx} ${eyeY + 6} Z`);

  // Lips
  const lipY = baseY + headH * 0.8;
  const lipW = 8 + r() * 4;
  paths.push(`M ${cx - lipW} ${lipY} C ${cx - lipW * 0.5} ${lipY - 2 - r()} ${cx - 1.5} ${lipY - 3} ${cx} ${lipY - 2.5} C ${cx + 1.5} ${lipY - 3} ${cx + lipW * 0.5} ${lipY - 2 - r()} ${cx + lipW} ${lipY} C ${cx + lipW * 0.5} ${lipY + 1} ${cx} ${lipY + 0.5} ${cx - lipW * 0.5} ${lipY + 1} Z`);
  paths.push(`M ${cx - lipW + 1} ${lipY + 1.5} C ${cx} ${lipY + 1} ${cx + lipW - 1} ${lipY + 1.5} ${cx + lipW - 2} ${lipY + 4 + r() * 2} C ${cx} ${lipY + 6 + r()} ${cx - lipW + 2} ${lipY + 4 + r() * 2} ${cx - lipW + 1} ${lipY + 1.5} Z`);

  // Ears
  const earY = baseY + headH * 0.4;
  const earH = 18 + r() * 6;
  for (let side = -1; side <= 1; side += 2) {
    paths.push(`M ${cx + side * headW * 0.95} ${earY} C ${cx + side * (headW + 5)} ${earY - 3} ${cx + side * (headW + 8)} ${earY + earH * 0.4} ${cx + side * (headW + 6)} ${earY + earH * 0.7} C ${cx + side * (headW + 4)} ${earY + earH} ${cx + side * headW * 0.96} ${earY + earH - 5} ${cx + side * headW * 0.94} ${earY + earH * 0.6} Z`);
  }

  // Neck
  const neckTop = baseY + headH * 1.02;
  const neckW = 16 * p.neckWidth;
  const neckH = 25;
  paths.push(`M ${cx - headW * 0.28} ${neckTop} C ${cx - neckW * 0.95} ${neckTop + 5} ${cx - neckW} ${neckTop + neckH * 0.6} ${cx - neckW * 1.1} ${neckTop + neckH} L ${cx + neckW * 1.1} ${neckTop + neckH} C ${cx + neckW} ${neckTop + neckH * 0.6} ${cx + neckW * 0.95} ${neckTop + 5} ${cx + headW * 0.28} ${neckTop} Z`);

  // Torso
  const torsoTop = neckTop + neckH;
  const shoulderW = 58 * p.shoulderWidth;
  const waistW = 30 * p.waistWidth;
  const hipW = 36 * p.hipWidth;
  const torsoH = 88;

  let torso = `M ${cx - neckW * 1.1} ${torsoTop}`;
  torso += ` C ${cx - shoulderW * 0.5} ${torsoTop - 3} ${cx - shoulderW * 0.8} ${torsoTop + 10} ${cx - shoulderW} ${torsoTop + 18}`;
  torso += ` C ${cx - shoulderW - 5} ${torsoTop + 26} ${cx - shoulderW - 2} ${torsoTop + 38} ${cx - shoulderW + 4} ${torsoTop + 45}`;
  torso += ` C ${cx - waistW - 8} ${torsoTop + torsoH * 0.55} ${cx - waistW - 3} ${torsoTop + torsoH * 0.72} ${cx - waistW} ${torsoTop + torsoH * 0.82}`;
  torso += ` C ${cx - hipW + 4} ${torsoTop + torsoH * 0.92} ${cx - hipW} ${torsoTop + torsoH} ${cx - hipW + 2} ${torsoTop + torsoH + 4}`;
  torso += ` C ${cx - hipW * 0.4} ${torsoTop + torsoH + 6} ${cx} ${torsoTop + torsoH + 7} ${cx + hipW * 0.4} ${torsoTop + torsoH + 6}`;
  torso += ` C ${cx + hipW} ${torsoTop + torsoH + 4} ${cx + hipW - 4} ${torsoTop + torsoH * 0.92} ${cx + waistW} ${torsoTop + torsoH * 0.82}`;
  torso += ` C ${cx + waistW + 3} ${torsoTop + torsoH * 0.72} ${cx + waistW + 8} ${torsoTop + torsoH * 0.55} ${cx + shoulderW - 4} ${torsoTop + 45}`;
  torso += ` C ${cx + shoulderW + 2} ${torsoTop + 38} ${cx + shoulderW + 5} ${torsoTop + 26} ${cx + shoulderW} ${torsoTop + 18}`;
  torso += ` C ${cx + shoulderW * 0.8} ${torsoTop + 10} ${cx + shoulderW * 0.5} ${torsoTop - 3} ${cx + neckW * 1.1} ${torsoTop} Z`;
  paths.push(torso);

  // Chest definition
  if (gender === 'female') {
    paths.push(`M ${cx - 5} ${torsoTop + 18} C ${cx - 18} ${torsoTop + 16} ${cx - 24} ${torsoTop + 28} ${cx - 22} ${torsoTop + 38} C ${cx - 20} ${torsoTop + 45} ${cx - 10} ${torsoTop + 46} ${cx - 5} ${torsoTop + 40} Z`);
    paths.push(`M ${cx + 5} ${torsoTop + 18} C ${cx + 18} ${torsoTop + 16} ${cx + 24} ${torsoTop + 28} ${cx + 22} ${torsoTop + 38} C ${cx + 20} ${torsoTop + 45} ${cx + 10} ${torsoTop + 46} ${cx + 5} ${torsoTop + 40} Z`);
  } else {
    paths.push(`M ${cx - 6} ${torsoTop + 22} C ${cx - 22} ${torsoTop + 20} ${cx - 28} ${torsoTop + 32} ${cx - 25} ${torsoTop + 42} C ${cx - 22} ${torsoTop + 48} ${cx - 10} ${torsoTop + 48} ${cx - 6} ${torsoTop + 38} Z`);
    paths.push(`M ${cx + 6} ${torsoTop + 22} C ${cx + 22} ${torsoTop + 20} ${cx + 28} ${torsoTop + 32} ${cx + 25} ${torsoTop + 42} C ${cx + 22} ${torsoTop + 48} ${cx + 10} ${torsoTop + 48} ${cx + 6} ${torsoTop + 38} Z`);
  }

  // Arms
  const armStartY = torsoTop + 18;
  const upperArmL = 46;
  const forearmL = 42;
  const armW = gender === 'male' ? 10 : 7;

  for (let side = -1; side <= 1; side += 2) {
    let arm = `M ${cx + side * shoulderW} ${armStartY}`;
    arm += ` C ${cx + side * (shoulderW + 8)} ${armStartY + 14} ${cx + side * (shoulderW + 11)} ${armStartY + upperArmL - 10} ${cx + side * (shoulderW + 9)} ${armStartY + upperArmL}`;
    arm += ` C ${cx + side * (shoulderW + 12)} ${armStartY + upperArmL + 10} ${cx + side * (shoulderW + 9)} ${armStartY + upperArmL + forearmL - 10} ${cx + side * (shoulderW + 7)} ${armStartY + upperArmL + forearmL}`;
    arm += ` C ${cx + side * (shoulderW + 4)} ${armStartY + upperArmL + forearmL + 18} ${cx + side * (shoulderW - 10)} ${armStartY + upperArmL + forearmL + 22} ${cx + side * (shoulderW - 8)} ${armStartY + upperArmL + forearmL + 6}`;
    arm += ` C ${cx + side * (shoulderW - armW - 4)} ${armStartY + upperArmL + 22} ${cx + side * (shoulderW - armW)} ${armStartY + 14} ${cx + side * (shoulderW - 4)} ${armStartY} Z`;
    paths.push(arm);

    // Fingers
    const handY = armStartY + upperArmL + forearmL + 6;
    const handX = cx + side * (shoulderW - 3);
    for (let f = 0; f < 5; f++) {
      const fingerW = 2;
      const fingerL = f === 0 ? 12 : 16 + (2 - Math.abs(f - 2)) * 3 + r() * 2;
      const fingerX = handX + side * (f * 4 - 6);
      const fingerY = f === 0 ? handY + 6 : handY + 14;
      paths.push(`M ${fingerX - fingerW} ${fingerY} L ${fingerX - fingerW * 0.7} ${fingerY + fingerL} Q ${fingerX} ${fingerY + fingerL + 2} ${fingerX + fingerW * 0.7} ${fingerY + fingerL} L ${fingerX + fingerW} ${fingerY} Z`);
    }
  }

  // Legs
  const legTop = torsoTop + torsoH + 5;
  const thighL = 58;
  const calfL = 54;
  const legW = gender === 'male' ? 15 : 12;

  for (let side = -1; side <= 1; side += 2) {
    let leg = `M ${cx + side * hipW * 0.12} ${legTop}`;
    leg += ` C ${cx + side * hipW * 0.32} ${legTop + 8} ${cx + side * hipW * 0.48} ${legTop + 18} ${cx + side * (legW + 6)} ${legTop + thighL * 0.55}`;
    leg += ` C ${cx + side * (legW + 9)} ${legTop + thighL * 0.8} ${cx + side * (legW + 7)} ${legTop + thighL} ${cx + side * (legW + 5)} ${legTop + thighL + 6}`;
    leg += ` C ${cx + side * (legW + 7)} ${legTop + thighL + 20} ${cx + side * (legW + 3)} ${legTop + thighL + calfL - 10} ${cx + side * legW} ${legTop + thighL + calfL}`;
    leg += ` L ${cx + side * (legW + 4)} ${legTop + thighL + calfL + 8}`;
    leg += ` C ${cx + side * 35} ${legTop + thighL + calfL + 15} ${cx + side * 38} ${legTop + thighL + calfL + 25} ${cx + side * 8} ${legTop + thighL + calfL + 25}`;
    leg += ` L ${cx + side * 6} ${legTop + thighL + calfL + 5}`;
    leg += ` C ${cx + side * 5} ${legTop + thighL + 18} ${cx + side * 8} ${legTop + 18} ${cx + side * hipW * 0.12} ${legTop} Z`;
    paths.push(leg);
  }

  return paths;
};

// Simplified generators for other races - build on human base
export const generateCyborgSilhouette = (gender: Gender, seed: number = 2): string[] => {
  let s = seed;
  const r = () => seededRandom(s++);
  const paths = generateHumanSilhouette(gender, seed + 1000);
  // Cybernetic plates
  for (let i = 0; i < 8 + Math.floor(r() * 5); i++) {
    const plateX = 200 + (r() - 0.5) * 120;
    const plateY = 95 + r() * 200;
    const plateW = 10 + r() * 15;
    const plateH = 8 + r() * 12;
    paths.push(`M ${plateX - plateW/2} ${plateY - plateH/2} L ${plateX + plateW/2} ${plateY - plateH/2} L ${plateX + plateW/2} ${plateY + plateH/2} L ${plateX - plateW/2} ${plateY + plateH/2} Z`);
  }
  // Circuit lines
  for (let i = 0; i < 12; i++) {
    const startX = 200 + (r() - 0.5) * 100;
    const startY = 130 + r() * 150;
    let circuit = `M ${startX} ${startY}`;
    for (let seg = 0; seg < 3 + Math.floor(r() * 3); seg++) {
      circuit += ` L ${startX + (r() - 0.5) * 30} ${startY + seg * 15}`;
    }
    paths.push(circuit);
  }
  return paths;
};

export const generateMutantSilhouette = (gender: Gender, seed: number = 3): string[] => {
  let s = seed;
  const r = () => seededRandom(s++);
  const paths = generateHumanSilhouette(gender, seed + 2000);
  for (let i = 0; i < 5 + Math.floor(r() * 4); i++) {
    const growthX = 200 + (r() - 0.5) * 100;
    const growthY = 100 + r() * 200;
    const growthR = 8 + r() * 15;
    paths.push(`M ${growthX - growthR} ${growthY} C ${growthX - growthR} ${growthY - growthR * 1.2} ${growthX + growthR} ${growthY - growthR * 1.2} ${growthX + growthR} ${growthY} C ${growthX + growthR} ${growthY + growthR * 0.8} ${growthX - growthR} ${growthY + growthR * 0.8} ${growthX - growthR} ${growthY} Z`);
  }
  return paths;
};

export const generateEtherealSilhouette = (gender: Gender, seed: number = 4): string[] => {
  let s = seed;
  const r = () => seededRandom(s++);
  const paths = generateHumanSilhouette(gender, seed + 3000);
  for (let i = 0; i < 20; i++) {
    const wispX = 200 + (r() - 0.5) * 150;
    const wispY = 50 + r() * 300;
    const wispLen = 20 + r() * 40;
    let wisp = `M ${wispX} ${wispY}`;
    for (let seg = 0; seg < 4; seg++) {
      const wave = (r() - 0.5) * 20;
      wisp += ` Q ${wispX + wave} ${wispY - seg * wispLen/4 - 5} ${wispX + wave * 0.5} ${wispY - (seg + 1) * wispLen/4}`;
    }
    paths.push(wisp);
  }
  return paths;
};

export const generateBeastSilhouette = (gender: Gender, seed: number = 5): string[] => {
  const p = BODY_PARAMS[gender];
  const paths: string[] = [];
  let s = seed;
  const r = () => seededRandom(s++);
  const cx = 200, baseY = 35;
  const headW = 48 * p.jawWidth;
  const headH = 52;

  // Beast skull with muzzle
  let skull = `M ${cx} ${baseY}`;
  for (let i = 0; i <= 30; i++) {
    const angle = (i / 30) * Math.PI;
    const fur = (r() - 0.5) * 6;
    const rx = headW * (0.88 + r() * 0.08);
    const ry = headH * 0.45;
    skull += ` L ${cx + Math.sin(angle) * rx + fur} ${baseY + 8 - Math.cos(angle) * ry}`;
  }
  skull += ` C ${cx + headW * 0.85} ${baseY + headH * 0.5} ${cx + headW * 0.75} ${baseY + headH * 0.7} ${cx + headW * 0.5} ${baseY + headH * 0.85}`;
  skull += ` C ${cx + headW * 0.25} ${baseY + headH * 0.95} ${cx} ${baseY + headH} ${cx - headW * 0.25} ${baseY + headH * 0.95}`;
  skull += ` C ${cx - headW * 0.5} ${baseY + headH * 0.85} ${cx - headW * 0.75} ${baseY + headH * 0.7} ${cx - headW * 0.85} ${baseY + headH * 0.5}`;
  skull += ' Z';
  paths.push(skull);

  // Muzzle
  paths.push(`M ${cx - 18} ${baseY + headH * 0.6} C ${cx - 22} ${baseY + headH * 0.6 + 15} ${cx - 15} ${baseY + headH * 0.6 + 30} ${cx} ${baseY + headH * 0.6 + 35} C ${cx + 15} ${baseY + headH * 0.6 + 30} ${cx + 22} ${baseY + headH * 0.6 + 15} ${cx + 18} ${baseY + headH * 0.6} Z`);
  
  // Beast ears
  const earH = 35 + r() * 15;
  for (let side = -1; side <= 1; side += 2) {
    paths.push(`M ${cx + side * headW * 0.6} ${baseY + 15} C ${cx + side * headW * 0.7} ${baseY - earH * 0.3} ${cx + side * headW * 0.75} ${baseY - earH * 0.8} ${cx + side * headW * 0.65} ${baseY - earH} C ${cx + side * headW * 0.55} ${baseY - earH * 0.7} ${cx + side * headW * 0.5} ${baseY - earH * 0.3} ${cx + side * headW * 0.55} ${baseY + 10} Z`);
  }

  // Feral eyes
  const eyeY = baseY + headH * 0.4;
  for (let side = -1; side <= 1; side += 2) {
    const eyeX = cx + side * headW * 0.35;
    paths.push(`M ${eyeX - 10} ${eyeY + 2} C ${eyeX - 8} ${eyeY - 6} ${eyeX + 8} ${eyeY - 6} ${eyeX + 10} ${eyeY + 2} C ${eyeX + 8} ${eyeY + 5} ${eyeX - 8} ${eyeY + 5} ${eyeX - 10} ${eyeY + 2} Z`);
    paths.push(`M ${eyeX - 1.5} ${eyeY - 3} L ${eyeX + 1.5} ${eyeY - 2} L ${eyeX + 1.5} ${eyeY + 3} L ${eyeX - 1.5} ${eyeY + 4} Z`);
  }

  // Fur texture
  for (let i = 0; i < 40; i++) {
    const furX = cx + (r() - 0.5) * headW * 1.8;
    const furY = baseY + r() * headH;
    const furL = 5 + r() * 8;
    paths.push(`M ${furX} ${furY} L ${furX + (r() - 0.5) * 4} ${furY - furL}`);
  }

  // Body
  const neckTop = baseY + headH;
  const torsoTop = neckTop + 25;
  const shoulderW = 85 * p.shoulderWidth;
  const hipW = 50 * p.hipWidth;
  const torsoH = 95;

  paths.push(`M ${cx - 30} ${neckTop} C ${cx - 40} ${neckTop + 10} ${cx - 45} ${neckTop + 20} ${cx - 50} ${torsoTop} L ${cx + 50} ${torsoTop} C ${cx + 45} ${neckTop + 20} ${cx + 40} ${neckTop + 10} ${cx + 30} ${neckTop} Z`);

  let torso = `M ${cx - 50} ${torsoTop}`;
  torso += ` C ${cx - shoulderW * 0.7} ${torsoTop + 10} ${cx - shoulderW} ${torsoTop + 25} ${cx - shoulderW} ${torsoTop + 40}`;
  torso += ` C ${cx - shoulderW + 5} ${torsoTop + torsoH * 0.6} ${cx - hipW - 5} ${torsoTop + torsoH * 0.85} ${cx - hipW} ${torsoTop + torsoH}`;
  torso += ` L ${cx + hipW} ${torsoTop + torsoH}`;
  torso += ` C ${cx + hipW + 5} ${torsoTop + torsoH * 0.85} ${cx + shoulderW - 5} ${torsoTop + torsoH * 0.6} ${cx + shoulderW} ${torsoTop + 40}`;
  torso += ` C ${cx + shoulderW} ${torsoTop + 25} ${cx + shoulderW * 0.7} ${torsoTop + 10} ${cx + 50} ${torsoTop} Z`;
  paths.push(torso);

  // Clawed arms
  for (let side = -1; side <= 1; side += 2) {
    paths.push(`M ${cx + side * shoulderW} ${torsoTop + 25} C ${cx + side * (shoulderW + 20)} ${torsoTop + 60} ${cx + side * (shoulderW + 25)} ${torsoTop + 100} ${cx + side * (shoulderW + 20)} ${torsoTop + 140} L ${cx + side * (shoulderW - 5)} ${torsoTop + 145} C ${cx + side * (shoulderW - 10)} ${torsoTop + 100} ${cx + side * (shoulderW - 5)} ${torsoTop + 50} ${cx + side * (shoulderW - 10)} ${torsoTop + 25} Z`);
    for (let c = 0; c < 4; c++) {
      const clawX = cx + side * (shoulderW + 5 - c * 6);
      paths.push(`M ${clawX - 2} ${torsoTop + 145} L ${clawX} ${torsoTop + 160 + r() * 5} L ${clawX + 2} ${torsoTop + 145} Z`);
    }
  }

  // Digitigrade legs
  const legTop = torsoTop + torsoH;
  for (let side = -1; side <= 1; side += 2) {
    paths.push(`M ${cx + side * hipW * 0.3} ${legTop} C ${cx + side * hipW * 0.5} ${legTop + 30} ${cx + side * 25} ${legTop + 55} ${cx + side * 30} ${legTop + 70} C ${cx + side * 25} ${legTop + 90} ${cx + side * 20} ${legTop + 110} ${cx + side * 25} ${legTop + 130} L ${cx + side * 40} ${legTop + 145} L ${cx + side * 10} ${legTop + 145} L ${cx + side * 8} ${legTop + 125} C ${cx + side * 5} ${legTop + 80} ${cx + side * 10} ${legTop + 30} ${cx + side * hipW * 0.15} ${legTop} Z`);
    for (let c = 0; c < 3; c++) {
      paths.push(`M ${cx + side * (15 + c * 10) - 2} ${legTop + 143} L ${cx + side * (15 + c * 10)} ${legTop + 155} L ${cx + side * (15 + c * 10) + 2} ${legTop + 143} Z`);
    }
  }

  // Tail
  paths.push(`M ${cx - 5} ${legTop} C ${cx - 20} ${legTop + 20} ${cx - 50} ${legTop + 50} ${cx - 70} ${legTop + 80} C ${cx - 75} ${legTop + 85} ${cx - 72} ${legTop + 82} ${cx - 65} ${legTop + 75} C ${cx - 45} ${legTop + 45} ${cx - 15} ${legTop + 15} ${cx + 5} ${legTop} Z`);

  return paths;
};

// Race generators map
// Import real generators from dedicated files
import { generateElfSilhouette, generateDarkElfSilhouette, generateDwarfSilhouette, generateAlienSilhouette } from './elf_darkelf_dwarf_alien_silhouettes';
import { generateOrcSilhouette, generateHalflingSilhouette } from './orc_halfling_silhouettes';
import { generateGolemSilhouette, generateElementalSilhouette, generateUndeadSilhouette } from './golem_elemental_undead_silhouettes';
import { generateGiantSilhouette, generateMerfolkSilhouette, generateCentaurSilhouette } from './giant_merfolk_centaur_silhouettes';
import { generateTrollSilhouette } from './troll_silhouette';
import { generateGnomeSilhouette, generatePhoenixSilhouette, generateSpriteSilhouette } from './gnome_phoenix_sprite_silhouettes';
import { generateVampireSilhouette, generateWerewolfSilhouette, generateAngelSilhouette } from './vampire_werewolf_angel_silhouettes';
import { generateDragonkinSilhouette, generateFaeSilhouette } from './dragonkin_fae_silhouettes';

export type RaceGenerator = (gender: Gender, seed: number) => string[];

export const RACE_GENERATORS: Record<Race, RaceGenerator> = {
  human:     generateHumanSilhouette,
  cyborg:    generateCyborgSilhouette,
  mutant:    generateMutantSilhouette,
  ethereal:  generateEtherealSilhouette,
  beast:     generateBeastSilhouette,
  elf:       generateElfSilhouette,
  darkelf:   generateDarkElfSilhouette,
  dwarf:     generateDwarfSilhouette,
  alien:     generateAlienSilhouette,
  orc:       generateOrcSilhouette,
  halfling:  generateHalflingSilhouette,
  golem:     generateGolemSilhouette,
  elemental: generateElementalSilhouette,
  undead:    generateUndeadSilhouette,
  giant:     generateGiantSilhouette,
  merfolk:   generateMerfolkSilhouette,
  centaur:   generateCentaurSilhouette,
  troll:     generateTrollSilhouette,
  gnome:     generateGnomeSilhouette,
  phoenix:   generatePhoenixSilhouette,
  sprite:    generateSpriteSilhouette,
  vampire:   generateVampireSilhouette,
  werewolf:  generateWerewolfSilhouette,
  angel:     generateAngelSilhouette,
  dragonkin: generateDragonkinSilhouette,
  fae:       generateFaeSilhouette,
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
interface AvatarSilhouetteProps {
  race: Race;
  gender: Gender;
  seed?: number;          // derived from user's public key via deriveSeed()
  publicKey?: string;     // alternative: pass pubkey, seed auto-derived
  size?: number;
  fillColor?: string;
  strokeColor?: string;
  onIdentityGenerated?: (identity: AvatarIdentity) => void;
}

export const AvatarSilhouette: React.FC<AvatarSilhouetteProps> = ({
  race,
  gender,
  seed,
  publicKey,
  size = 400,
  fillColor = '#1a1a2e',
  strokeColor = '#8b5cf6',
  onIdentityGenerated,
}) => {
  const resolvedSeed = seed ?? (publicKey ? deriveSeed(publicKey) : 42);

  const [paths] = React.useState<string[]>(() => {
    const generator = RACE_GENERATORS[race] || generateHumanSilhouette;
    const generatedPaths = generator(gender, resolvedSeed);
    
    if (onIdentityGenerated) {
      const hash = computeAvatarHash(generatedPaths);
      onIdentityGenerated({
        paths: generatedPaths,
        hash,
        race,
        gender,
        createdAt: Date.now(),
      });
    }
    
    return generatedPaths;
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 400 450">
      <G>
        {paths.map((d, i) => (
          <Path
            key={i}
            d={d}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={0.5}
            opacity={0.95}
          />
        ))}
      </G>
    </Svg>
  );
};

// ============================================================================
// AVATAR CREATION FLOW COMPONENT
// ============================================================================
interface AvatarCreationFlowProps {
  race: Race;
  gender: Gender;
  publicKey?: string;       // pass directly if already in memory
  onConfirm: (identity: AvatarIdentity) => Promise<void>;
  onCancel: () => void;
}

export const AvatarCreationFlow: React.FC<AvatarCreationFlowProps> = ({
  race,
  gender,
  publicKey: publicKeyProp,
  onConfirm,
  onCancel,
}) => {
  const [identity, setIdentity] = React.useState<AvatarIdentity | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [regenerateKey, setRegenerateKey] = React.useState(0);
  const [resolvedPubkey, setResolvedPubkey] = React.useState<string>(publicKeyProp ?? '');

  // Load pubkey from SecureStore if not passed as prop
  React.useEffect(() => {
    if (publicKeyProp) {
      setResolvedPubkey(publicKeyProp);
      return;
    }
    SecureStore.getItemAsync('kasvillage_public_key').then(stored => {
      if (stored) {
        setResolvedPubkey(stored);
        // Re-key the AvatarSilhouette so it re-generates with the correct seed
        setRegenerateKey(k => k + 1);
      }
    });
  }, [publicKeyProp]);

  // Derive deterministic seed — same pubkey always produces same avatar
  const seed = resolvedPubkey ? deriveSeed(resolvedPubkey) : undefined;

  const handleRegenerate = () => {
    setIdentity(null);
    setRegenerateKey(k => k + 1);
  };

  const handleConfirm = async () => {
    if (!identity) return;
    setConfirming(true);
    try {
      await storeAvatarLocally(identity);
      await onConfirm(identity);
    } catch (error) {
      console.error('Failed to confirm avatar:', error);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <React.Fragment>
      <AvatarSilhouette
        key={regenerateKey}
        race={race}
        gender={gender}
        seed={seed}
        publicKey={resolvedPubkey || undefined}
        size={300}
        onIdentityGenerated={setIdentity}
      />
      
      {identity && (
        <React.Fragment>
          {/* Hash preview */}
          <React.Fragment>
            {/* Text: Hash: {identity.hash.slice(0, 16)}... */}
          </React.Fragment>
          
          {/* Action buttons */}
          {/* Regenerate button: handleRegenerate */}
          {/* Confirm button: handleConfirm, disabled: confirming */}
          {/* Cancel button: onCancel */}
        </React.Fragment>
      )}
    </React.Fragment>
  );
};

// ============================================================================
// RENDER FROM STORED IDENTITY
// ============================================================================
interface StoredAvatarRendererProps {
  identity: AvatarIdentity;
  size?: number;
  fillColor?: string;
  strokeColor?: string;
}

export const StoredAvatarRenderer: React.FC<StoredAvatarRendererProps> = ({
  identity,
  size = 400,
  fillColor = '#1a1a2e',
  strokeColor = '#8b5cf6',
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 400 450">
      <G>
        {identity.paths.map((d, i) => (
          <Path
            key={i}
            d={d}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={0.5}
            opacity={0.95}
          />
        ))}
      </G>
    </Svg>
  );
};

export default AvatarSilhouette;
