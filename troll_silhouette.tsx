// KasVillage Identity Ritual - Troll Silhouette

import React from 'react';
import Svg, { Path, G } from 'react-native-svg';

type Gender = 'male' | 'female';

const seededRandom = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

const BODY_PARAMS = {
  male: { shoulderWidth: 1.15, hipWidth: 0.88, waistWidth: 0.95, neckWidth: 1.1, jawWidth: 1.08 },
  female: { shoulderWidth: 0.92, hipWidth: 1.08, waistWidth: 0.8, neckWidth: 0.88, jawWidth: 0.94 },
};

// ============================================================================
// TROLL - Hunched, long arms, warty skin, large nose, tusks, mossy patches
// ============================================================================
export const generateTrollSilhouette = (gender: Gender, seed: number = 55): string[] => {
  const p = BODY_PARAMS[gender];
  const paths: string[] = [];
  let s = seed;
  const r = () => seededRandom(s++);
  
  const cx = 200, baseY = 38;
  const headW = 48 * p.jawWidth;
  const headH = 55;
  
  // MISSHAPEN SKULL - Lumpy, asymmetric
  let skull = `M ${cx} ${baseY}`;
  for (let i = 0; i <= 32; i++) {
    const angle = (i / 32) * Math.PI;
    const lump = (r() - 0.5) * 10;
    const asymmetry = Math.sin(i * 0.7) * 5;
    const rx = headW * (0.85 + r() * 0.1);
    const ry = headH * 0.48;
    const x = cx + Math.sin(angle) * rx + lump + asymmetry;
    const y = baseY + 10 - Math.cos(angle) * ry + (r() - 0.5) * 4;
    skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  // Heavy sloping brow
  skull += ` L ${cx + headW * 0.9} ${baseY + headH * 0.32}`;
  skull += ` C ${cx + headW * 1.0} ${baseY + headH * 0.4} ${cx + headW * 1.05} ${baseY + headH * 0.5} ${cx + headW * 0.98} ${baseY + headH * 0.58}`;
  // Sunken cheeks
  skull += ` C ${cx + headW * 0.92} ${baseY + headH * 0.68} ${cx + headW * 0.85} ${baseY + headH * 0.78} ${cx + headW * 0.75} ${baseY + headH * 0.86}`;
  // Heavy jutting jaw
  skull += ` L ${cx + headW * 0.7} ${baseY + headH * 0.92}`;
  skull += ` L ${cx + headW * 0.55} ${baseY + headH * 1.02}`;
  skull += ` L ${cx + headW * 0.3} ${baseY + headH * 1.08}`;
  skull += ` L ${cx} ${baseY + headH * 1.1}`;
  // Left side
  skull += ` L ${cx - headW * 0.3} ${baseY + headH * 1.08}`;
  skull += ` L ${cx - headW * 0.55} ${baseY + headH * 1.02}`;
  skull += ` L ${cx - headW * 0.7} ${baseY + headH * 0.92}`;
  skull += ` C ${cx - headW * 0.85} ${baseY + headH * 0.78} ${cx - headW * 0.92} ${baseY + headH * 0.68} ${cx - headW * 0.98} ${baseY + headH * 0.58}`;
  skull += ` C ${cx - headW * 1.05} ${baseY + headH * 0.5} ${cx - headW * 1.0} ${baseY + headH * 0.4} ${cx - headW * 0.9} ${baseY + headH * 0.32}`;
  skull += ' Z';
  paths.push(skull);

  // WARTS AND BUMPS on face
  for (let w = 0; w < 8 + Math.floor(r() * 6); w++) {
    const wartX = cx + (r() - 0.5) * headW * 1.6;
    const wartY = baseY + headH * 0.2 + r() * headH * 0.7;
    const wartR = 3 + r() * 5;
    paths.push(`M ${wartX - wartR} ${wartY} C ${wartX - wartR} ${wartY - wartR * 0.8} ${wartX + wartR} ${wartY - wartR * 0.8} ${wartX + wartR} ${wartY} C ${wartX + wartR} ${wartY + wartR * 0.6} ${wartX - wartR} ${wartY + wartR * 0.6} ${wartX - wartR} ${wartY} Z`);
  }

  // SCRAGGLY HAIR - Thin, patchy
  for (let strand = 0; strand < 12 + Math.floor(r() * 8); strand++) {
    const strandX = cx + (r() - 0.5) * headW * 1.8;
    const strandStartY = baseY - 5 + r() * 15;
    const strandLen = 20 + r() * 35;
    let hair = `M ${strandX} ${strandStartY}`;
    for (let seg = 0; seg < 4; seg++) {
      const wave = (r() - 0.5) * 12;
      hair += ` Q ${strandX + wave} ${strandStartY + seg * strandLen / 3} ${strandX + wave * 0.5} ${strandStartY + (seg + 1) * strandLen / 3}`;
    }
    paths.push(hair);
  }

  // SMALL BEADY EYES - Deep set
  const eyeY = baseY + headH * 0.42;
  const eyeSpacing = headW * 0.32;
  for (let side = -1; side <= 1; side += 2) {
    const eyeX = cx + side * eyeSpacing;
    // Deep socket
    paths.push(`M ${eyeX - 8} ${eyeY - 6} L ${eyeX + 8} ${eyeY - 6} L ${eyeX + 10} ${eyeY + 4} L ${eyeX - 10} ${eyeY + 4} Z`);
    // Small beady eye
    paths.push(`M ${eyeX - 4} ${eyeY} C ${eyeX - 4} ${eyeY - 3} ${eyeX + 4} ${eyeY - 3} ${eyeX + 4} ${eyeY} C ${eyeX + 4} ${eyeY + 2} ${eyeX - 4} ${eyeY + 2} ${eyeX - 4} ${eyeY} Z`);
    // Tiny pupil
    paths.push(`M ${eyeX - 1.5} ${eyeY - 0.5} C ${eyeX - 1.5} ${eyeY - 2} ${eyeX + 1.5} ${eyeY - 2} ${eyeX + 1.5} ${eyeY - 0.5} C ${eyeX + 1.5} ${eyeY + 1} ${eyeX - 1.5} ${eyeY + 1} ${eyeX - 1.5} ${eyeY - 0.5} Z`);
  }

  // Heavy brow ridge
  paths.push(`M ${cx - headW * 0.75} ${baseY + headH * 0.28} L ${cx - headW * 0.4} ${baseY + headH * 0.22} L ${cx} ${baseY + headH * 0.2} L ${cx + headW * 0.4} ${baseY + headH * 0.22} L ${cx + headW * 0.75} ${baseY + headH * 0.28}`);
  paths.push(`M ${cx - headW * 0.7} ${baseY + headH * 0.32} L ${cx} ${baseY + headH * 0.26} L ${cx + headW * 0.7} ${baseY + headH * 0.32}`);

  // HUGE BULBOUS NOSE
  const noseY = baseY + headH * 0.58;
  let nose = `M ${cx - 5} ${eyeY + 8}`;
  nose += ` C ${cx - 8} ${noseY - 10} ${cx - 15} ${noseY - 5} ${cx - 20} ${noseY + 5}`;
  nose += ` C ${cx - 22} ${noseY + 12} ${cx - 20} ${noseY + 20} ${cx - 15} ${noseY + 25}`;
  nose += ` C ${cx - 10} ${noseY + 30} ${cx - 5} ${noseY + 32} ${cx} ${noseY + 30}`;
  nose += ` C ${cx + 5} ${noseY + 32} ${cx + 10} ${noseY + 30} ${cx + 15} ${noseY + 25}`;
  nose += ` C ${cx + 20} ${noseY + 20} ${cx + 22} ${noseY + 12} ${cx + 20} ${noseY + 5}`;
  nose += ` C ${cx + 15} ${noseY - 5} ${cx + 8} ${noseY - 10} ${cx + 5} ${eyeY + 8}`;
  nose += ' Z';
  paths.push(nose);
  // Nostrils
  paths.push(`M ${cx - 10} ${noseY + 18} C ${cx - 14} ${noseY + 15} ${cx - 14} ${noseY + 22} ${cx - 8} ${noseY + 20} Z`);
  paths.push(`M ${cx + 10} ${noseY + 18} C ${cx + 14} ${noseY + 15} ${cx + 14} ${noseY + 22} ${cx + 8} ${noseY + 20} Z`);
  // Nose warts
  for (let nw = 0; nw < 3; nw++) {
    const nwX = cx + (r() - 0.5) * 25;
    const nwY = noseY + 5 + r() * 20;
    const nwR = 2 + r() * 3;
    paths.push(`M ${nwX - nwR} ${nwY} C ${nwX - nwR} ${nwY - nwR} ${nwX + nwR} ${nwY - nwR} ${nwX + nwR} ${nwY} C ${nwX + nwR} ${nwY + nwR * 0.5} ${nwX - nwR} ${nwY + nwR * 0.5} ${nwX - nwR} ${nwY} Z`);
  }

  // WIDE MOUTH with TUSKS
  const mouthY = baseY + headH * 0.92;
  const mouthW = 22 + r() * 5;
  // Mouth opening
  paths.push(`M ${cx - mouthW} ${mouthY} C ${cx - mouthW * 0.6} ${mouthY - 5} ${cx} ${mouthY - 6} ${cx + mouthW * 0.6} ${mouthY - 5} L ${cx + mouthW} ${mouthY} C ${cx + mouthW * 0.6} ${mouthY + 8} ${cx} ${mouthY + 10} ${cx - mouthW * 0.6} ${mouthY + 8} Z`);
  // Lower lip
  paths.push(`M ${cx - mouthW + 3} ${mouthY + 8} C ${cx} ${mouthY + 6} ${cx + mouthW - 3} ${mouthY + 8} ${cx + mouthW - 5} ${mouthY + 15} C ${cx} ${mouthY + 18} ${cx - mouthW + 5} ${mouthY + 15} ${cx - mouthW + 3} ${mouthY + 8} Z`);
  
  // TUSKS jutting up from lower jaw
  const tuskH = gender === 'male' ? 25 + r() * 10 : 18 + r() * 8;
  // Right tusk
  paths.push(`M ${cx + 12} ${mouthY + 5} C ${cx + 15} ${mouthY - 5} ${cx + 18} ${mouthY - tuskH * 0.6} ${cx + 16} ${mouthY - tuskH} C ${cx + 14} ${mouthY - tuskH + 3} ${cx + 12} ${mouthY - tuskH * 0.5} ${cx + 10} ${mouthY + 2} Z`);
  // Left tusk
  paths.push(`M ${cx - 12} ${mouthY + 5} C ${cx - 15} ${mouthY - 5} ${cx - 18} ${mouthY - tuskH * 0.6} ${cx - 16} ${mouthY - tuskH} C ${cx - 14} ${mouthY - tuskH + 3} ${cx - 12} ${mouthY - tuskH * 0.5} ${cx - 10} ${mouthY + 2} Z`);

  // LARGE FLOPPY EARS
  const earY = baseY + headH * 0.35;
  const earH = 35 + r() * 15;
  const earW = 25 + r() * 10;
  // Right ear
  let rightEar = `M ${cx + headW * 0.85} ${earY}`;
  rightEar += ` C ${cx + headW + earW * 0.3} ${earY - 10} ${cx + headW + earW * 0.7} ${earY + 5} ${cx + headW + earW} ${earY + earH * 0.4}`;
  rightEar += ` C ${cx + headW + earW + 5} ${earY + earH * 0.7} ${cx + headW + earW - 5} ${earY + earH} ${cx + headW + earW * 0.5} ${earY + earH + 10}`;
  rightEar += ` C ${cx + headW + earW * 0.2} ${earY + earH + 5} ${cx + headW * 0.95} ${earY + earH * 0.7} ${cx + headW * 0.9} ${earY + earH * 0.4}`;
  rightEar += ' Z';
  paths.push(rightEar);
  // Ear fold detail
  paths.push(`M ${cx + headW * 0.92} ${earY + 8} C ${cx + headW + earW * 0.4} ${earY + 15} ${cx + headW + earW * 0.6} ${earY + earH * 0.5} ${cx + headW + earW * 0.4} ${earY + earH * 0.8}`);
  
  // Left ear
  let leftEar = `M ${cx - headW * 0.85} ${earY}`;
  leftEar += ` C ${cx - headW - earW * 0.3} ${earY - 10} ${cx - headW - earW * 0.7} ${earY + 5} ${cx - headW - earW} ${earY + earH * 0.4}`;
  leftEar += ` C ${cx - headW - earW - 5} ${earY + earH * 0.7} ${cx - headW - earW + 5} ${earY + earH} ${cx - headW - earW * 0.5} ${earY + earH + 10}`;
  leftEar += ` C ${cx - headW - earW * 0.2} ${earY + earH + 5} ${cx - headW * 0.95} ${earY + earH * 0.7} ${cx - headW * 0.9} ${earY + earH * 0.4}`;
  leftEar += ' Z';
  paths.push(leftEar);
  paths.push(`M ${cx - headW * 0.92} ${earY + 8} C ${cx - headW - earW * 0.4} ${earY + 15} ${cx - headW - earW * 0.6} ${earY + earH * 0.5} ${cx - headW - earW * 0.4} ${earY + earH * 0.8}`);

  // THICK HUNCHED NECK
  const neckTop = baseY + headH * 1.1;
  const neckW = 38 * p.neckWidth;
  const neckH = 20;
  paths.push(`M ${cx - headW * 0.5} ${neckTop} C ${cx - neckW * 1.1} ${neckTop + 5} ${cx - neckW * 1.3} ${neckTop + neckH * 0.6} ${cx - neckW * 1.5} ${neckTop + neckH} L ${cx + neckW * 1.5} ${neckTop + neckH} C ${cx + neckW * 1.3} ${neckTop + neckH * 0.6} ${cx + neckW * 1.1} ${neckTop + 5} ${cx + headW * 0.5} ${neckTop} Z`);

  // HUNCHED MASSIVE TORSO
  const torsoTop = neckTop + neckH;
  const shoulderW = 90 * p.shoulderWidth;
  const waistW = 55 * p.waistWidth;
  const hipW = 50 * p.hipWidth;
  const torsoH = 100;

  let torso = `M ${cx - neckW * 1.5} ${torsoTop}`;
  // Hunched shoulders (one higher than other for asymmetry)
  const hunchOffset = (r() - 0.5) * 15;
  torso += ` C ${cx - shoulderW * 0.5} ${torsoTop - 12 + hunchOffset} ${cx - shoulderW * 0.85} ${torsoTop + 5 + hunchOffset} ${cx - shoulderW} ${torsoTop + 25}`;
  torso += ` C ${cx - shoulderW - 12} ${torsoTop + 40} ${cx - shoulderW - 8} ${torsoTop + 58} ${cx - shoulderW + 5} ${torsoTop + 68}`;
  // Pot belly
  torso += ` C ${cx - waistW - 20} ${torsoTop + torsoH * 0.55} ${cx - waistW - 15} ${torsoTop + torsoH * 0.75} ${cx - waistW - 5} ${torsoTop + torsoH * 0.88}`;
  torso += ` L ${cx - hipW} ${torsoTop + torsoH}`;
  torso += ` C ${cx - hipW * 0.4} ${torsoTop + torsoH + 5} ${cx + hipW * 0.4} ${torsoTop + torsoH + 5} ${cx + hipW} ${torsoTop + torsoH}`;
  torso += ` C ${cx + waistW + 15} ${torsoTop + torsoH * 0.75} ${cx + waistW + 20} ${torsoTop + torsoH * 0.55} ${cx + shoulderW - 5} ${torsoTop + 68}`;
  torso += ` C ${cx + shoulderW + 8} ${torsoTop + 58} ${cx + shoulderW + 12} ${torsoTop + 40} ${cx + shoulderW} ${torsoTop + 25}`;
  torso += ` C ${cx + shoulderW * 0.85} ${torsoTop + 5 - hunchOffset} ${cx + shoulderW * 0.5} ${torsoTop - 12 - hunchOffset} ${cx + neckW * 1.5} ${torsoTop} Z`;
  paths.push(torso);

  // Belly button
  paths.push(`M ${cx - 4} ${torsoTop + torsoH * 0.7} C ${cx - 4} ${torsoTop + torsoH * 0.7 - 4} ${cx + 4} ${torsoTop + torsoH * 0.7 - 4} ${cx + 4} ${torsoTop + torsoH * 0.7} C ${cx + 4} ${torsoTop + torsoH * 0.7 + 4} ${cx - 4} ${torsoTop + torsoH * 0.7 + 4} ${cx - 4} ${torsoTop + torsoH * 0.7} Z`);

  // MOSSY/WARTY PATCHES on body
  for (let patch = 0; patch < 6 + Math.floor(r() * 4); patch++) {
    const patchX = cx + (r() - 0.5) * waistW * 2;
    const patchY = torsoTop + 25 + r() * torsoH * 0.65;
    const patchW = 12 + r() * 18;
    const patchH = 10 + r() * 15;
    let moss = `M ${patchX - patchW / 2} ${patchY}`;
    for (let mp = 0; mp < 8; mp++) {
      const angle = (mp / 8) * Math.PI * 2;
      const wobble = r() * 5;
      moss += ` L ${patchX + Math.cos(angle) * (patchW / 2 + wobble)} ${patchY + Math.sin(angle) * (patchH / 2 + wobble)}`;
    }
    moss += ' Z';
    paths.push(moss);
  }

  // Body warts
  for (let bw = 0; bw < 10 + Math.floor(r() * 8); bw++) {
    const bwX = cx + (r() - 0.5) * shoulderW * 1.8;
    const bwY = torsoTop + 20 + r() * torsoH * 0.8;
    const bwR = 2 + r() * 4;
    paths.push(`M ${bwX - bwR} ${bwY} C ${bwX - bwR} ${bwY - bwR * 0.8} ${bwX + bwR} ${bwY - bwR * 0.8} ${bwX + bwR} ${bwY} C ${bwX + bwR} ${bwY + bwR * 0.5} ${bwX - bwR} ${bwY + bwR * 0.5} ${bwX - bwR} ${bwY} Z`);
  }

  // LONG DANGLING ARMS - Reach past knees
  const armStartY = torsoTop + 25;
  const upperArmL = 65;
  const forearmL = 70;
  const armW = gender === 'male' ? 22 : 18;

  for (let side = -1; side <= 1; side += 2) {
    let arm = `M ${cx + side * shoulderW} ${armStartY}`;
    // Long upper arm
    arm += ` C ${cx + side * (shoulderW + 18)} ${armStartY + 25} ${cx + side * (shoulderW + 25)} ${armStartY + 50} ${cx + side * (shoulderW + 22)} ${armStartY + upperArmL}`;
    // Forearm
    arm += ` C ${cx + side * (shoulderW + 28)} ${armStartY + upperArmL + 20} ${cx + side * (shoulderW + 25)} ${armStartY + upperArmL + forearmL - 20} ${cx + side * (shoulderW + 20)} ${armStartY + upperArmL + forearmL}`;
    // Large gnarled hand
    arm += ` L ${cx + side * (shoulderW + 22)} ${armStartY + upperArmL + forearmL + 15}`;
    arm += ` C ${cx + side * (shoulderW + 12)} ${armStartY + upperArmL + forearmL + 45} ${cx + side * (shoulderW - 18)} ${armStartY + upperArmL + forearmL + 50} ${cx + side * (shoulderW - 15)} ${armStartY + upperArmL + forearmL + 15}`;
    arm += ` C ${cx + side * (shoulderW - armW - 8)} ${armStartY + upperArmL + 40} ${cx + side * (shoulderW - armW - 5)} ${armStartY + 30} ${cx + side * (shoulderW - 12)} ${armStartY} Z`;
    paths.push(arm);

    // Arm warts
    for (let aw = 0; aw < 4; aw++) {
      const awX = cx + side * (shoulderW + 5 + r() * 15);
      const awY = armStartY + 20 + r() * (upperArmL + forearmL - 30);
      const awR = 2 + r() * 3;
      paths.push(`M ${awX - awR} ${awY} C ${awX - awR} ${awY - awR} ${awX + awR} ${awY - awR} ${awX + awR} ${awY} C ${awX + awR} ${awY + awR * 0.5} ${awX - awR} ${awY + awR * 0.5} ${awX - awR} ${awY} Z`);
    }

    // Thick clawed fingers
    const handY = armStartY + upperArmL + forearmL + 15;
    const handX = cx + side * (shoulderW - 5);
    for (let f = 0; f < 4; f++) {
      const fingerW = 5;
      const fingerL = 28 + (2 - Math.abs(f - 1.5)) * 8 + r() * 5;
      const fingerX = handX + side * (f * 10 - 12);
      const fingerY = handY + 30;
      // Thick gnarled finger
      paths.push(`M ${fingerX - fingerW} ${fingerY} C ${fingerX - fingerW - 2} ${fingerY + fingerL * 0.4} ${fingerX - fingerW} ${fingerY + fingerL * 0.8} ${fingerX - 2} ${fingerY + fingerL - 5} L ${fingerX} ${fingerY + fingerL + 5} L ${fingerX + 2} ${fingerY + fingerL - 5} C ${fingerX + fingerW} ${fingerY + fingerL * 0.8} ${fingerX + fingerW + 2} ${fingerY + fingerL * 0.4} ${fingerX + fingerW} ${fingerY} Z`);
    }
  }

  // THICK BOWED LEGS
  const legTop = torsoTop + torsoH;
  const thighL = 55;
  const calfL = 50;
  const legW = gender === 'male' ? 24 : 20;

  for (let side = -1; side <= 1; side += 2) {
    const bowOut = 15; // Bowed legs curve outward
    let leg = `M ${cx + side * hipW * 0.18} ${legTop}`;
    // Thick thigh curving outward
    leg += ` C ${cx + side * hipW * 0.45} ${legTop + 12} ${cx + side * (hipW * 0.6 + bowOut)} ${legTop + 28} ${cx + side * (legW + 12 + bowOut)} ${legTop + thighL * 0.55}`;
    leg += ` C ${cx + side * (legW + 18 + bowOut)} ${legTop + thighL * 0.8} ${cx + side * (legW + 15 + bowOut * 0.5)} ${legTop + thighL} ${cx + side * (legW + 12)} ${legTop + thighL + 8}`;
    // Thick calf
    leg += ` C ${cx + side * (legW + 16)} ${legTop + thighL + 25} ${cx + side * (legW + 12)} ${legTop + thighL + calfL - 15} ${cx + side * (legW + 10)} ${legTop + thighL + calfL}`;
    // Large flat foot
    leg += ` L ${cx + side * (legW + 15)} ${legTop + thighL + calfL + 12}`;
    leg += ` L ${cx + side * 55} ${legTop + thighL + calfL + 20}`;
    leg += ` L ${cx + side * 58} ${legTop + thighL + calfL + 32}`;
    leg += ` L ${cx + side * 8} ${legTop + thighL + calfL + 32}`;
    leg += ` L ${cx + side * 6} ${legTop + thighL + calfL + 10}`;
    leg += ` C ${cx + side * 8} ${legTop + thighL + 22} ${cx + side * 12} ${legTop + 28} ${cx + side * hipW * 0.18} ${legTop} Z`;
    paths.push(leg);

    // Leg warts
    for (let lw = 0; lw < 3; lw++) {
      const lwX = cx + side * (legW + r() * 10);
      const lwY = legTop + 20 + r() * (thighL + calfL - 40);
      const lwR = 2 + r() * 3;
      paths.push(`M ${lwX - lwR} ${lwY} C ${lwX - lwR} ${lwY - lwR} ${lwX + lwR} ${lwY - lwR} ${lwX + lwR} ${lwY} C ${lwX + lwR} ${lwY + lwR * 0.5} ${lwX - lwR} ${lwY + lwR * 0.5} ${lwX - lwR} ${lwY} Z`);
    }

    // Toe claws
    for (let tc = 0; tc < 3; tc++) {
      const toeX = cx + side * (20 + tc * 15);
      const toeY = legTop + thighL + calfL + 30;
      paths.push(`M ${toeX - 3} ${toeY} L ${toeX} ${toeY + 12} L ${toeX + 3} ${toeY} Z`);
    }
  }

  // HUNCHED BACK detail - spine bumps visible
  for (let spine = 0; spine < 6; spine++) {
    const spineY = torsoTop + 15 + spine * 15;
    const spineX = cx - 5 + (r() - 0.5) * 8;
    paths.push(`M ${spineX - 6} ${spineY} C ${spineX - 5} ${spineY - 5} ${spineX + 5} ${spineY - 5} ${spineX + 6} ${spineY} C ${spineX + 5} ${spineY + 4} ${spineX - 5} ${spineY + 4} ${spineX - 6} ${spineY} Z`);
  }

  return paths;
};

// ============================================================================
// COMPONENT EXPORT
// ============================================================================
interface AvatarSilhouetteProps {
  race: 'troll';
  gender: Gender;
  size?: number;
  fillColor?: string;
  strokeColor?: string;
  onPathsGenerated?: (paths: string[]) => void;
}

export const AvatarSilhouette: React.FC<AvatarSilhouetteProps> = ({
  race,
  gender,
  size = 400,
  fillColor = '#1a1a2e',
  strokeColor = '#8b5cf6',
  onPathsGenerated,
}) => {
  const [paths] = React.useState<string[]>(() => {
    const generatedPaths = generateTrollSilhouette(gender);
    if (onPathsGenerated) {
      onPathsGenerated(generatedPaths);
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

export default AvatarSilhouette;
