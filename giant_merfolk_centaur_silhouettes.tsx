// KasVillage Identity Ritual - Giant, Merfolk, Centaur Silhouettes

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
// GIANT - Massive humanoid, thick features, primitive jewelry, scars
// ============================================================================
export const generateGiantSilhouette = (gender: Gender, seed: number = 33): string[] => {
  const p = BODY_PARAMS[gender];
  const paths: string[] = [];
  let s = seed;
  const r = () => seededRandom(s++);
  
  const cx = 200, baseY = 25;
  const headW = 55 * p.jawWidth;
  const headH = 58;
  
  // MASSIVE SKULL - Heavy brow, thick features
  let skull = `M ${cx} ${baseY}`;
  for (let i = 0; i <= 30; i++) {
    const angle = (i / 30) * Math.PI;
    const bumps = (r() - 0.5) * 5;
    const rx = headW * (0.9 + r() * 0.06);
    const ry = headH * 0.48;
    const x = cx + Math.sin(angle) * rx + bumps;
    const y = baseY + 8 - Math.cos(angle) * ry;
    skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  // Heavy protruding brow
  skull += ` L ${cx + headW * 0.95} ${baseY + headH * 0.28}`;
  skull += ` L ${cx + headW * 1.08} ${baseY + headH * 0.38}`;
  skull += ` L ${cx + headW * 1.05} ${baseY + headH * 0.48}`;
  // Broad cheeks
  skull += ` C ${cx + headW * 1.1} ${baseY + headH * 0.58} ${cx + headW * 1.05} ${baseY + headH * 0.7} ${cx + headW * 0.92} ${baseY + headH * 0.8}`;
  // Heavy square jaw
  skull += ` L ${cx + headW * 0.8} ${baseY + headH * 0.9}`;
  skull += ` L ${cx + headW * 0.5} ${baseY + headH * 0.98}`;
  skull += ` L ${cx + headW * 0.15} ${baseY + headH * 1.02}`;
  skull += ` L ${cx} ${baseY + headH * 1.04}`;
  // Left side
  skull += ` L ${cx - headW * 0.15} ${baseY + headH * 1.02}`;
  skull += ` L ${cx - headW * 0.5} ${baseY + headH * 0.98}`;
  skull += ` L ${cx - headW * 0.8} ${baseY + headH * 0.9}`;
  skull += ` C ${cx - headW * 1.05} ${baseY + headH * 0.7} ${cx - headW * 1.1} ${baseY + headH * 0.58} ${cx - headW * 1.05} ${baseY + headH * 0.48}`;
  skull += ` L ${cx - headW * 1.08} ${baseY + headH * 0.38}`;
  skull += ` L ${cx - headW * 0.95} ${baseY + headH * 0.28}`;
  skull += ' Z';
  paths.push(skull);

  // WILD THICK HAIR
  let hair = `M ${cx} ${baseY - 8}`;
  for (let i = 0; i <= 35; i++) {
    const angle = (i / 35) * Math.PI;
    const wild = (r() - 0.5) * 15;
    const spike = r() > 0.7 ? r() * 12 : 0;
    const x = cx + Math.sin(angle) * (headW * 1.15 + wild);
    const y = baseY - 12 - Math.cos(angle) * headH * 0.5 - spike;
    hair += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  if (gender === 'female') {
    const hairLen = 60 + r() * 30;
    hair += ` C ${cx + headW * 1.3} ${baseY + headH * 0.5} ${cx + headW * 1.25} ${baseY + headH + hairLen * 0.5} ${cx + headW * 1.0} ${baseY + headH + hairLen}`;
    for (let i = 0; i < 8; i++) {
      hair += ` L ${cx + headW * (0.9 - i * 0.2) + (r() - 0.5) * 10} ${baseY + headH + hairLen + i * 5}`;
    }
    hair += ` L ${cx - headW * 1.0} ${baseY + headH + hairLen}`;
    hair += ` C ${cx - headW * 1.25} ${baseY + headH + hairLen * 0.5} ${cx - headW * 1.3} ${baseY + headH * 0.5} ${cx - headW * 1.15} ${baseY - 10}`;
  } else {
    hair += ` C ${cx + headW * 1.2} ${baseY + headH * 0.4} ${cx + headW * 1.1} ${baseY + headH * 0.6} ${cx + headW * 0.95} ${baseY + headH * 0.55}`;
    hair += ` L ${cx - headW * 0.95} ${baseY + headH * 0.55}`;
    hair += ` C ${cx - headW * 1.1} ${baseY + headH * 0.6} ${cx - headW * 1.2} ${baseY + headH * 0.4} ${cx - headW * 1.15} ${baseY - 10}`;
  }
  hair += ' Z';
  paths.push(hair);

  // SMALL DEEP-SET EYES under heavy brow
  const eyeY = baseY + headH * 0.45;
  const eyeSpacing = headW * 0.35;
  for (let side = -1; side <= 1; side += 2) {
    const eyeX = cx + side * eyeSpacing;
    // Deep socket
    paths.push(`M ${eyeX - 10} ${eyeY - 8} L ${eyeX + 10} ${eyeY - 8} L ${eyeX + 12} ${eyeY + 5} L ${eyeX - 12} ${eyeY + 5} Z`);
    // Small eye
    paths.push(`M ${eyeX - 6} ${eyeY} C ${eyeX - 6} ${eyeY - 4} ${eyeX + 6} ${eyeY - 4} ${eyeX + 6} ${eyeY} C ${eyeX + 6} ${eyeY + 3} ${eyeX - 6} ${eyeY + 3} ${eyeX - 6} ${eyeY} Z`);
    paths.push(`M ${eyeX - 2} ${eyeY - 1} C ${eyeX - 2} ${eyeY - 3} ${eyeX + 2} ${eyeY - 3} ${eyeX + 2} ${eyeY - 1} C ${eyeX + 2} ${eyeY + 1} ${eyeX - 2} ${eyeY + 1} ${eyeX - 2} ${eyeY - 1} Z`);
  }

  // BROAD FLAT NOSE
  const noseY = baseY + headH * 0.65;
  paths.push(`M ${cx - 5} ${eyeY + 8} L ${cx - 8} ${noseY - 5} L ${cx - 15} ${noseY + 8} L ${cx - 12} ${noseY + 15} L ${cx} ${noseY + 18} L ${cx + 12} ${noseY + 15} L ${cx + 15} ${noseY + 8} L ${cx + 8} ${noseY - 5} L ${cx + 5} ${eyeY + 8} Z`);
  // Nostrils
  paths.push(`M ${cx - 8} ${noseY + 10} C ${cx - 10} ${noseY + 8} ${cx - 6} ${noseY + 6} ${cx - 5} ${noseY + 10} Z`);
  paths.push(`M ${cx + 8} ${noseY + 10} C ${cx + 10} ${noseY + 8} ${cx + 6} ${noseY + 6} ${cx + 5} ${noseY + 10} Z`);

  // THICK-LIPPED MOUTH
  const mouthY = baseY + headH * 0.88;
  const mouthW = 18 + r() * 5;
  paths.push(`M ${cx - mouthW} ${mouthY} C ${cx - mouthW * 0.5} ${mouthY - 4} ${cx} ${mouthY - 5} ${cx + mouthW * 0.5} ${mouthY - 4} L ${cx + mouthW} ${mouthY} C ${cx + mouthW * 0.5} ${mouthY + 3} ${cx} ${mouthY + 2} ${cx - mouthW * 0.5} ${mouthY + 3} Z`);
  paths.push(`M ${cx - mouthW + 2} ${mouthY + 3} C ${cx} ${mouthY + 2} ${cx + mouthW - 2} ${mouthY + 3} ${cx + mouthW - 3} ${mouthY + 10} C ${cx} ${mouthY + 12} ${cx - mouthW + 3} ${mouthY + 10} ${cx - mouthW + 2} ${mouthY + 3} Z`);

  // SMALL EARS
  const earY = baseY + headH * 0.4;
  for (let side = -1; side <= 1; side += 2) {
    paths.push(`M ${cx + side * headW} ${earY} C ${cx + side * (headW + 8)} ${earY - 5} ${cx + side * (headW + 12)} ${earY + 10} ${cx + side * (headW + 10)} ${earY + 22} C ${cx + side * (headW + 6)} ${earY + 28} ${cx + side * headW * 0.98} ${earY + 25} ${cx + side * headW * 0.96} ${earY + 18} Z`);
  }

  // FACIAL SCARS
  for (let s = 0; s < 2 + Math.floor(r() * 2); s++) {
    const scarX = cx + (r() - 0.5) * headW * 1.2;
    const scarY = baseY + headH * 0.4 + r() * headH * 0.4;
    const scarLen = 15 + r() * 20;
    const scarAngle = (r() - 0.5) * 1.5;
    paths.push(`M ${scarX} ${scarY} L ${scarX + Math.cos(scarAngle) * scarLen} ${scarY + Math.sin(scarAngle) * scarLen}`);
  }

  // PRIMITIVE BONE/TOOTH JEWELRY in hair
  for (let j = 0; j < 3 + Math.floor(r() * 3); j++) {
    const jx = cx + (r() - 0.5) * headW * 1.5;
    const jy = baseY - 5 + r() * 15;
    const jlen = 8 + r() * 10;
    paths.push(`M ${jx - 2} ${jy} L ${jx} ${jy + jlen} L ${jx + 2} ${jy} Z`);
  }

  // THICK NECK
  const neckTop = baseY + headH * 1.04;
  const neckW = 42 * p.neckWidth;
  const neckH = 22;
  paths.push(`M ${cx - headW * 0.55} ${neckTop} L ${cx - neckW * 1.2} ${neckTop + neckH} L ${cx + neckW * 1.2} ${neckTop + neckH} L ${cx + headW * 0.55} ${neckTop} Z`);
  // Neck tendons
  paths.push(`M ${cx - 15} ${neckTop + 3} L ${cx - 18} ${neckTop + neckH - 2}`);
  paths.push(`M ${cx + 15} ${neckTop + 3} L ${cx + 18} ${neckTop + neckH - 2}`);

  // MASSIVE TORSO
  const torsoTop = neckTop + neckH;
  const shoulderW = 105 * p.shoulderWidth;
  const waistW = 60 * p.waistWidth;
  const hipW = 55 * p.hipWidth;
  const torsoH = 105;

  let torso = `M ${cx - neckW * 1.2} ${torsoTop}`;
  torso += ` C ${cx - shoulderW * 0.5} ${torsoTop - 8} ${cx - shoulderW * 0.8} ${torsoTop + 12} ${cx - shoulderW} ${torsoTop + 28}`;
  torso += ` C ${cx - shoulderW - 10} ${torsoTop + 40} ${cx - shoulderW - 5} ${torsoTop + 55} ${cx - shoulderW + 8} ${torsoTop + 65}`;
  torso += ` C ${cx - waistW - 12} ${torsoTop + torsoH * 0.6} ${cx - waistW - 5} ${torsoTop + torsoH * 0.8} ${cx - waistW} ${torsoTop + torsoH * 0.9}`;
  torso += ` L ${cx - hipW} ${torsoTop + torsoH}`;
  torso += ` L ${cx + hipW} ${torsoTop + torsoH}`;
  torso += ` C ${cx + waistW + 5} ${torsoTop + torsoH * 0.8} ${cx + waistW + 12} ${torsoTop + torsoH * 0.6} ${cx + shoulderW - 8} ${torsoTop + 65}`;
  torso += ` C ${cx + shoulderW + 5} ${torsoTop + 55} ${cx + shoulderW + 10} ${torsoTop + 40} ${cx + shoulderW} ${torsoTop + 28}`;
  torso += ` C ${cx + shoulderW * 0.8} ${torsoTop + 12} ${cx + shoulderW * 0.5} ${torsoTop - 8} ${cx + neckW * 1.2} ${torsoTop} Z`;
  paths.push(torso);

  // Massive pecs
  paths.push(`M ${cx - 8} ${torsoTop + 20} C ${cx - 40} ${torsoTop + 15} ${cx - 55} ${torsoTop + 35} ${cx - 50} ${torsoTop + 55} C ${cx - 45} ${torsoTop + 70} ${cx - 20} ${torsoTop + 72} ${cx - 8} ${torsoTop + 58} Z`);
  paths.push(`M ${cx + 8} ${torsoTop + 20} C ${cx + 40} ${torsoTop + 15} ${cx + 55} ${torsoTop + 35} ${cx + 50} ${torsoTop + 55} C ${cx + 45} ${torsoTop + 70} ${cx + 20} ${torsoTop + 72} ${cx + 8} ${torsoTop + 58} Z`);
  
  // Abs
  paths.push(`M ${cx} ${torsoTop + 62} L ${cx} ${torsoTop + torsoH - 8}`);
  for (let row = 0; row < 3; row++) {
    const absY = torsoTop + 68 + row * 14;
    paths.push(`M ${cx - 22} ${absY} Q ${cx} ${absY - 4} ${cx + 22} ${absY}`);
  }

  // Body scars
  for (let s = 0; s < 3 + Math.floor(r() * 3); s++) {
    const scarX = cx + (r() - 0.5) * waistW * 1.5;
    const scarY = torsoTop + 30 + r() * 60;
    const scarLen = 20 + r() * 25;
    paths.push(`M ${scarX} ${scarY} L ${scarX + (r() - 0.5) * 15} ${scarY + scarLen}`);
  }

  // MASSIVE ARMS
  const armStartY = torsoTop + 28;
  const upperArmL = 60;
  const forearmL = 55;
  const armW = gender === 'male' ? 32 : 26;

  for (let side = -1; side <= 1; side += 2) {
    let arm = `M ${cx + side * shoulderW} ${armStartY}`;
    arm += ` C ${cx + side * (shoulderW + 22)} ${armStartY + 20} ${cx + side * (shoulderW + 30)} ${armStartY + 45} ${cx + side * (shoulderW + 28)} ${armStartY + upperArmL}`;
    arm += ` C ${cx + side * (shoulderW + 35)} ${armStartY + upperArmL + 15} ${cx + side * (shoulderW + 30)} ${armStartY + upperArmL + forearmL - 15} ${cx + side * (shoulderW + 25)} ${armStartY + upperArmL + forearmL}`;
    // Huge hand
    arm += ` L ${cx + side * (shoulderW + 28)} ${armStartY + upperArmL + forearmL + 15}`;
    arm += ` C ${cx + side * (shoulderW + 15)} ${armStartY + upperArmL + forearmL + 45} ${cx + side * (shoulderW - 20)} ${armStartY + upperArmL + forearmL + 48} ${cx + side * (shoulderW - 18)} ${armStartY + upperArmL + forearmL + 12}`;
    arm += ` C ${cx + side * (shoulderW - armW - 5)} ${armStartY + upperArmL + 35} ${cx + side * (shoulderW - armW)} ${armStartY + 25} ${cx + side * (shoulderW - 10)} ${armStartY} Z`;
    paths.push(arm);

    // Thick fingers
    const handY = armStartY + upperArmL + forearmL + 15;
    const handX = cx + side * (shoulderW - 5);
    for (let f = 0; f < 4; f++) {
      const fingerW = 5;
      const fingerL = 25 + (2 - Math.abs(f - 1.5)) * 6;
      const fingerX = handX + side * (f * 9 - 12);
      const fingerY = handY + 28;
      paths.push(`M ${fingerX - fingerW} ${fingerY} L ${fingerX - fingerW * 0.7} ${fingerY + fingerL} Q ${fingerX} ${fingerY + fingerL + 3} ${fingerX + fingerW * 0.7} ${fingerY + fingerL} L ${fingerX + fingerW} ${fingerY} Z`);
    }
  }

  // MASSIVE LEGS
  const legTop = torsoTop + torsoH;
  const thighL = 65;
  const calfL = 60;
  const legW = gender === 'male' ? 28 : 24;

  for (let side = -1; side <= 1; side += 2) {
    let leg = `M ${cx + side * hipW * 0.15} ${legTop}`;
    leg += ` C ${cx + side * hipW * 0.4} ${legTop + 10} ${cx + side * hipW * 0.55} ${legTop + 25} ${cx + side * (legW + 12)} ${legTop + thighL * 0.55}`;
    leg += ` C ${cx + side * (legW + 18)} ${legTop + thighL * 0.8} ${cx + side * (legW + 15)} ${legTop + thighL} ${cx + side * (legW + 12)} ${legTop + thighL + 8}`;
    leg += ` C ${cx + side * (legW + 16)} ${legTop + thighL + 25} ${cx + side * (legW + 10)} ${legTop + thighL + calfL - 15} ${cx + side * (legW + 8)} ${legTop + thighL + calfL}`;
    // Huge foot
    leg += ` L ${cx + side * (legW + 12)} ${legTop + thighL + calfL + 12}`;
    leg += ` L ${cx + side * 55} ${legTop + thighL + calfL + 22}`;
    leg += ` L ${cx + side * 58} ${legTop + thighL + calfL + 35}`;
    leg += ` L ${cx + side * 8} ${legTop + thighL + calfL + 35}`;
    leg += ` L ${cx + side * 6} ${legTop + thighL + calfL + 8}`;
    leg += ` C ${cx + side * 8} ${legTop + thighL + 20} ${cx + side * 12} ${legTop + 25} ${cx + side * hipW * 0.15} ${legTop} Z`;
    paths.push(leg);
  }

  return paths;
};

// ============================================================================
// MERFOLK - Fish tail, scales, fins, gills, webbed hands
// ============================================================================
export const generateMerfolkSilhouette = (gender: Gender, seed: number = 66): string[] => {
  const p = BODY_PARAMS[gender];
  const paths: string[] = [];
  let s = seed;
  const r = () => seededRandom(s++);
  
  const cx = 200, baseY = 45;
  const headW = 36 * p.jawWidth;
  const headH = 46;
  
  // ELEGANT HEAD
  let skull = `M ${cx} ${baseY}`;
  for (let i = 0; i <= 35; i++) {
    const angle = (i / 35) * Math.PI;
    const wave = Math.sin(i * 0.4) * 1.5;
    const rx = headW * (0.95 + r() * 0.03);
    const ry = headH * 0.52;
    const x = cx + Math.sin(angle) * rx + wave;
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

  // FLOWING AQUATIC HAIR with seaweed-like strands
  let hair = `M ${cx} ${baseY - 6}`;
  for (let i = 0; i <= 30; i++) {
    const angle = (i / 30) * Math.PI;
    const flow = Math.sin(i * 0.5 + r() * 2) * 8;
    const x = cx + Math.sin(angle) * (headW * 1.1 + flow);
    const y = baseY - 10 - Math.cos(angle) * headH * 0.5;
    hair += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  const hairLen = gender === 'female' ? 120 + r() * 40 : 50 + r() * 20;
  hair += ` C ${cx + headW * 1.25} ${baseY + headH * 0.5} ${cx + headW * 1.3} ${baseY + headH + hairLen * 0.4} ${cx + headW * 1.0} ${baseY + headH + hairLen}`;
  // Flowing strands
  for (let s = 0; s < 12; s++) {
    const wave = Math.sin(s * 0.6 + r() * 3) * 15;
    hair += ` C ${cx + headW * (0.9 - s * 0.12) + wave} ${baseY + headH + hairLen + s * 4} ${cx + headW * (0.8 - s * 0.12) - wave} ${baseY + headH + hairLen + s * 5} ${cx + headW * (0.7 - s * 0.12)} ${baseY + headH + hairLen + s * 3}`;
  }
  hair += ` L ${cx - headW * 1.0} ${baseY + headH + hairLen}`;
  hair += ` C ${cx - headW * 1.3} ${baseY + headH + hairLen * 0.4} ${cx - headW * 1.25} ${baseY + headH * 0.5} ${cx - headW * 1.1} ${baseY - 8}`;
  hair += ' Z';
  paths.push(hair);

  // LARGE EXPRESSIVE EYES
  const eyeY = baseY + headH * 0.42;
  const eyeSpacing = headW * 0.3;
  const eyeW = 10 + r() * 2, eyeH = 7 + r() * 2;
  for (let side = -1; side <= 1; side += 2) {
    const eyeX = cx + side * eyeSpacing;
    paths.push(`M ${eyeX - eyeW} ${eyeY} C ${eyeX - eyeW} ${eyeY - eyeH} ${eyeX + eyeW} ${eyeY - eyeH} ${eyeX + eyeW} ${eyeY} C ${eyeX + eyeW} ${eyeY + eyeH * 0.6} ${eyeX - eyeW} ${eyeY + eyeH * 0.6} ${eyeX - eyeW} ${eyeY} Z`);
    // Large iris
    paths.push(`M ${eyeX - 5} ${eyeY - 1} C ${eyeX - 5} ${eyeY - 6} ${eyeX + 5} ${eyeY - 6} ${eyeX + 5} ${eyeY - 1} C ${eyeX + 5} ${eyeY + 4} ${eyeX - 5} ${eyeY + 4} ${eyeX - 5} ${eyeY - 1} Z`);
    paths.push(`M ${eyeX - 2.5} ${eyeY - 1} C ${eyeX - 2.5} ${eyeY - 3.5} ${eyeX + 2.5} ${eyeY - 3.5} ${eyeX + 2.5} ${eyeY - 1} C ${eyeX + 2.5} ${eyeY + 1.5} ${eyeX - 2.5} ${eyeY + 1.5} ${eyeX - 2.5} ${eyeY - 1} Z`);
    // Sparkle
    paths.push(`M ${eyeX + 3} ${eyeY - 4} L ${eyeX + 4.5} ${eyeY - 5} L ${eyeX + 5} ${eyeY - 3} Z`);
  }

  // Delicate brows
  paths.push(`M ${cx + eyeSpacing - eyeW - 3} ${eyeY - eyeH - 4} Q ${cx + eyeSpacing} ${eyeY - eyeH - 9} ${cx + eyeSpacing + eyeW + 3} ${eyeY - eyeH - 3}`);
  paths.push(`M ${cx - eyeSpacing + eyeW + 3} ${eyeY - eyeH - 4} Q ${cx - eyeSpacing} ${eyeY - eyeH - 9} ${cx - eyeSpacing - eyeW - 3} ${eyeY - eyeH - 3}`);

  // Small elegant nose
  const noseY = baseY + headH * 0.62;
  paths.push(`M ${cx} ${eyeY + 6} C ${cx + 2} ${noseY - 5} ${cx + 4} ${noseY} ${cx + 4} ${noseY + 4} C ${cx + 5} ${noseY + 6} ${cx + 2} ${noseY + 8} ${cx} ${noseY + 6} C ${cx - 2} ${noseY + 8} ${cx - 5} ${noseY + 6} ${cx - 4} ${noseY + 4} C ${cx - 4} ${noseY} ${cx - 2} ${noseY - 5} ${cx} ${eyeY + 6} Z`);

  // Full lips
  const lipY = baseY + headH * 0.78;
  const lipW = 10;
  paths.push(`M ${cx - lipW} ${lipY} C ${cx - lipW * 0.5} ${lipY - 2.5} ${cx - 1.5} ${lipY - 3.5} ${cx} ${lipY - 3} C ${cx + 1.5} ${lipY - 3.5} ${cx + lipW * 0.5} ${lipY - 2.5} ${cx + lipW} ${lipY} C ${cx + lipW * 0.5} ${lipY + 1.5} ${cx} ${lipY + 1} ${cx - lipW * 0.5} ${lipY + 1.5} Z`);
  paths.push(`M ${cx - lipW + 1} ${lipY + 2} C ${cx} ${lipY + 1.5} ${cx + lipW - 1} ${lipY + 2} ${cx + lipW - 2} ${lipY + 5} C ${cx} ${lipY + 7} ${cx - lipW + 2} ${lipY + 5} ${cx - lipW + 1} ${lipY + 2} Z`);

  // POINTED EARS with fin-like extensions
  const earY = baseY + headH * 0.38;
  for (let side = -1; side <= 1; side += 2) {
    // Main ear
    paths.push(`M ${cx + side * headW * 0.95} ${earY + 5} C ${cx + side * (headW + 5)} ${earY} ${cx + side * (headW + 15)} ${earY - 15} ${cx + side * (headW + 18)} ${earY - 25} C ${cx + side * (headW + 15)} ${earY - 22} ${cx + side * (headW + 8)} ${earY - 10} ${cx + side * (headW + 5)} ${earY + 8} C ${cx + side * (headW + 3)} ${earY + 18} ${cx + side * headW * 0.96} ${earY + 22} ${cx + side * headW * 0.94} ${earY + 15} Z`);
    // Fin membrane details
    paths.push(`M ${cx + side * (headW + 2)} ${earY + 5} L ${cx + side * (headW + 12)} ${earY - 15}`);
    paths.push(`M ${cx + side * (headW + 4)} ${earY + 8} L ${cx + side * (headW + 15)} ${earY - 10}`);
  }

  // GILLS on neck
  const gillY = baseY + headH * 0.85;
  for (let side = -1; side <= 1; side += 2) {
    for (let g = 0; g < 3; g++) {
      const gx = cx + side * (headW * 0.65 + g * 3);
      const gy = gillY + g * 6;
      paths.push(`M ${gx} ${gy} C ${gx + side * 8} ${gy + 2} ${gx + side * 8} ${gy + 8} ${gx} ${gy + 10}`);
    }
  }

  // NECK
  const neckTop = baseY + headH * 1.02;
  const neckW = 16 * p.neckWidth;
  const neckH = 24;
  paths.push(`M ${cx - headW * 0.28} ${neckTop} C ${cx - neckW * 0.95} ${neckTop + 5} ${cx - neckW} ${neckTop + neckH * 0.6} ${cx - neckW * 1.1} ${neckTop + neckH} L ${cx + neckW * 1.1} ${neckTop + neckH} C ${cx + neckW} ${neckTop + neckH * 0.6} ${cx + neckW * 0.95} ${neckTop + 5} ${cx + headW * 0.28} ${neckTop} Z`);

  // HUMANOID UPPER TORSO
  const torsoTop = neckTop + neckH;
  const shoulderW = 55 * p.shoulderWidth;
  const waistW = 28 * p.waistWidth;
  const torsoH = 75;

  let torso = `M ${cx - neckW * 1.1} ${torsoTop}`;
  torso += ` C ${cx - shoulderW * 0.5} ${torsoTop - 3} ${cx - shoulderW * 0.8} ${torsoTop + 10} ${cx - shoulderW} ${torsoTop + 18}`;
  torso += ` C ${cx - shoulderW - 5} ${torsoTop + 26} ${cx - shoulderW - 2} ${torsoTop + 38} ${cx - shoulderW + 4} ${torsoTop + 45}`;
  torso += ` C ${cx - waistW - 8} ${torsoTop + torsoH * 0.6} ${cx - waistW - 3} ${torsoTop + torsoH * 0.8} ${cx - waistW} ${torsoTop + torsoH}`;
  torso += ` L ${cx + waistW} ${torsoTop + torsoH}`;
  torso += ` C ${cx + waistW + 3} ${torsoTop + torsoH * 0.8} ${cx + waistW + 8} ${torsoTop + torsoH * 0.6} ${cx + shoulderW - 4} ${torsoTop + 45}`;
  torso += ` C ${cx + shoulderW + 2} ${torsoTop + 38} ${cx + shoulderW + 5} ${torsoTop + 26} ${cx + shoulderW} ${torsoTop + 18}`;
  torso += ` C ${cx + shoulderW * 0.8} ${torsoTop + 10} ${cx + shoulderW * 0.5} ${torsoTop - 3} ${cx + neckW * 1.1} ${torsoTop} Z`;
  paths.push(torso);

  // Chest definition
  if (gender === 'female') {
    paths.push(`M ${cx - 5} ${torsoTop + 18} C ${cx - 18} ${torsoTop + 16} ${cx - 24} ${torsoTop + 28} ${cx - 22} ${torsoTop + 38} C ${cx - 20} ${torsoTop + 45} ${cx - 10} ${torsoTop + 46} ${cx - 5} ${torsoTop + 40} Z`);
    paths.push(`M ${cx + 5} ${torsoTop + 18} C ${cx + 18} ${torsoTop + 16} ${cx + 24} ${torsoTop + 28} ${cx + 22} ${torsoTop + 38} C ${cx + 20} ${torsoTop + 45} ${cx + 10} ${torsoTop + 46} ${cx + 5} ${torsoTop + 40} Z`);
  }

  // Scale pattern on torso
  for (let row = 0; row < 5; row++) {
    const rowY = torsoTop + 50 + row * 10;
    for (let col = -2; col <= 2; col++) {
      const scaleX = cx + col * 10;
      paths.push(`M ${scaleX} ${rowY - 4} C ${scaleX + 5} ${rowY - 2} ${scaleX + 5} ${rowY + 3} ${scaleX} ${rowY + 5} C ${scaleX - 5} ${rowY + 3} ${scaleX - 5} ${rowY - 2} ${scaleX} ${rowY - 4} Z`);
    }
  }

  // WEBBED ARMS
  const armStartY = torsoTop + 18;
  const upperArmL = 44;
  const forearmL = 40;
  const armW = gender === 'male' ? 9 : 7;

  for (let side = -1; side <= 1; side += 2) {
    let arm = `M ${cx + side * shoulderW} ${armStartY}`;
    arm += ` C ${cx + side * (shoulderW + 8)} ${armStartY + 14} ${cx + side * (shoulderW + 11)} ${armStartY + upperArmL - 10} ${cx + side * (shoulderW + 9)} ${armStartY + upperArmL}`;
    arm += ` C ${cx + side * (shoulderW + 12)} ${armStartY + upperArmL + 10} ${cx + side * (shoulderW + 9)} ${armStartY + upperArmL + forearmL - 10} ${cx + side * (shoulderW + 7)} ${armStartY + upperArmL + forearmL}`;
    arm += ` C ${cx + side * (shoulderW + 4)} ${armStartY + upperArmL + forearmL + 18} ${cx + side * (shoulderW - 10)} ${armStartY + upperArmL + forearmL + 22} ${cx + side * (shoulderW - 8)} ${armStartY + upperArmL + forearmL + 6}`;
    arm += ` C ${cx + side * (shoulderW - armW - 4)} ${armStartY + upperArmL + 22} ${cx + side * (shoulderW - armW)} ${armStartY + 14} ${cx + side * (shoulderW - 4)} ${armStartY} Z`;
    paths.push(arm);

    // Webbed fingers
    const handY = armStartY + upperArmL + forearmL + 6;
    const handX = cx + side * (shoulderW - 3);
    for (let f = 0; f < 5; f++) {
      const fingerW = 2;
      const fingerL = f === 0 ? 14 : 20 + (2 - Math.abs(f - 2)) * 4;
      const fingerX = handX + side * (f * 5 - 8);
      const fingerY = f === 0 ? handY + 6 : handY + 14;
      paths.push(`M ${fingerX - fingerW} ${fingerY} L ${fingerX - fingerW * 0.7} ${fingerY + fingerL} Q ${fingerX} ${fingerY + fingerL + 2} ${fingerX + fingerW * 0.7} ${fingerY + fingerL} L ${fingerX + fingerW} ${fingerY} Z`);
    }
    // Webbing between fingers
    for (let w = 0; w < 4; w++) {
      const webX1 = handX + side * (w * 5 - 6);
      const webX2 = handX + side * ((w + 1) * 5 - 6);
      const webY = handY + 16;
      paths.push(`M ${webX1} ${webY} C ${(webX1 + webX2) / 2} ${webY + 12} ${(webX1 + webX2) / 2} ${webY + 12} ${webX2} ${webY}`);
    }
  }

  // FISH TAIL - Transition from waist
  const tailStart = torsoTop + torsoH;
  const tailLength = 160;
  const tailWidth = waistW * 1.2;

  // Transition scales at hip
  let tail = `M ${cx - waistW} ${tailStart}`;
  // Tail curves and tapers
  tail += ` C ${cx - tailWidth} ${tailStart + 20} ${cx - tailWidth * 0.9} ${tailStart + 50} ${cx - tailWidth * 0.7} ${tailStart + 80}`;
  tail += ` C ${cx - tailWidth * 0.5} ${tailStart + 110} ${cx - tailWidth * 0.3} ${tailStart + 140} ${cx - 12} ${tailStart + tailLength - 20}`;
  // Tail fin fluke (left side)
  tail += ` C ${cx - 20} ${tailStart + tailLength - 5} ${cx - 50} ${tailStart + tailLength + 20} ${cx - 70} ${tailStart + tailLength + 35}`;
  tail += ` C ${cx - 55} ${tailStart + tailLength + 25} ${cx - 35} ${tailStart + tailLength + 5} ${cx} ${tailStart + tailLength}`;
  // Tail fin fluke (right side)
  tail += ` C ${cx + 35} ${tailStart + tailLength + 5} ${cx + 55} ${tailStart + tailLength + 25} ${cx + 70} ${tailStart + tailLength + 35}`;
  tail += ` C ${cx + 50} ${tailStart + tailLength + 20} ${cx + 20} ${tailStart + tailLength - 5} ${cx + 12} ${tailStart + tailLength - 20}`;
  // Return up
  tail += ` C ${cx + tailWidth * 0.3} ${tailStart + 140} ${cx + tailWidth * 0.5} ${tailStart + 110} ${cx + tailWidth * 0.7} ${tailStart + 80}`;
  tail += ` C ${cx + tailWidth * 0.9} ${tailStart + 50} ${cx + tailWidth} ${tailStart + 20} ${cx + waistW} ${tailStart}`;
  tail += ' Z';
  paths.push(tail);

  // Tail scales
  for (let row = 0; row < 12; row++) {
    const rowY = tailStart + 15 + row * 12;
    const rowWidth = tailWidth * (1 - row * 0.06);
    const scaleCount = Math.max(3, 6 - Math.floor(row / 3));
    for (let col = 0; col < scaleCount; col++) {
      const scaleX = cx + (col - (scaleCount - 1) / 2) * (rowWidth * 2 / scaleCount) * 0.8;
      const scaleW = 6 - row * 0.3;
      paths.push(`M ${scaleX} ${rowY - scaleW} C ${scaleX + scaleW} ${rowY - scaleW * 0.3} ${scaleX + scaleW} ${rowY + scaleW * 0.5} ${scaleX} ${rowY + scaleW} C ${scaleX - scaleW} ${rowY + scaleW * 0.5} ${scaleX - scaleW} ${rowY - scaleW * 0.3} ${scaleX} ${rowY - scaleW} Z`);
    }
  }

  // Tail fin details
  paths.push(`M ${cx} ${tailStart + tailLength} L ${cx - 40} ${tailStart + tailLength + 25}`);
  paths.push(`M ${cx} ${tailStart + tailLength} L ${cx - 55} ${tailStart + tailLength + 30}`);
  paths.push(`M ${cx} ${tailStart + tailLength} L ${cx + 40} ${tailStart + tailLength + 25}`);
  paths.push(`M ${cx} ${tailStart + tailLength} L ${cx + 55} ${tailStart + tailLength + 30}`);

  // DORSAL FIN on back
  const finStartY = torsoTop + 30;
  let dorsalFin = `M ${cx} ${finStartY}`;
  dorsalFin += ` C ${cx - 5} ${finStartY - 10} ${cx - 8} ${finStartY - 25} ${cx - 5} ${finStartY - 40}`;
  dorsalFin += ` C ${cx - 3} ${finStartY - 50} ${cx + 3} ${finStartY - 50} ${cx + 5} ${finStartY - 40}`;
  dorsalFin += ` C ${cx + 8} ${finStartY - 25} ${cx + 5} ${finStartY - 10} ${cx} ${finStartY} Z`;
  paths.push(dorsalFin);
  // Fin rays
  for (let ray = 0; ray < 4; ray++) {
    const rayY = finStartY - 10 - ray * 10;
    paths.push(`M ${cx - 3} ${rayY} L ${cx + 3} ${rayY}`);
  }

  return paths;
};

// ============================================================================
// CENTAUR - Human upper body, horse lower body
// ============================================================================
export const generateCentaurSilhouette = (gender: Gender, seed: number = 88): string[] => {
  const p = BODY_PARAMS[gender];
  const paths: string[] = [];
  let s = seed;
  const r = () => seededRandom(s++);
  
  const cx = 200, baseY = 35;
  const headW = 36 * p.jawWidth;
  const headH = 44;
  
  // HUMAN HEAD
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

  // FLOWING HAIR
  let hair = `M ${cx} ${baseY - 5}`;
  const hairVolume = 1.08 + r() * 0.12;
  for (let i = 0; i <= 30; i++) {
    const angle = (i / 30) * Math.PI;
    const strand = (r() - 0.5) * 6;
    const x = cx + Math.sin(angle) * headW * hairVolume + strand;
    const y = baseY - 8 - Math.cos(angle) * headH * 0.5 + r() * 3;
    hair += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  const hairLen = gender === 'female' ? 90 + r() * 40 : 30 + r() * 20;
  hair += ` C ${cx + headW * 1.2} ${baseY + headH * 0.5} ${cx + headW * 1.2} ${baseY + headH + hairLen * 0.5} ${cx + headW * 0.95} ${baseY + headH + hairLen}`;
  for (let i = 0; i < 8; i++) {
    const wave = (r() - 0.5) * 12;
    hair += ` L ${cx + headW * (0.85 - i * 0.18) + wave} ${baseY + headH + hairLen + i * 4}`;
  }
  hair += ` L ${cx - headW * 0.95} ${baseY + headH + hairLen}`;
  hair += ` C ${cx - headW * 1.2} ${baseY + headH + hairLen * 0.5} ${cx - headW * 1.2} ${baseY + headH * 0.5} ${cx - headW * hairVolume} ${baseY - 6}`;
  hair += ' Z';
  paths.push(hair);

  // EYES
  const eyeY = baseY + headH * 0.44;
  const eyeSpacing = headW * (0.28 + r() * 0.05);
  const eyeW = 8 + r() * 2, eyeH = 5 + r() * 1.5;
  for (let side = -1; side <= 1; side += 2) {
    const eyeX = cx + side * eyeSpacing;
    paths.push(`M ${eyeX - eyeW} ${eyeY} C ${eyeX - eyeW} ${eyeY - eyeH} ${eyeX + eyeW} ${eyeY - eyeH} ${eyeX + eyeW} ${eyeY} C ${eyeX + eyeW} ${eyeY + eyeH * 0.6} ${eyeX - eyeW} ${eyeY + eyeH * 0.6} ${eyeX - eyeW} ${eyeY} Z`);
    paths.push(`M ${eyeX - 3} ${eyeY - 1} C ${eyeX - 3} ${eyeY - 4} ${eyeX + 3} ${eyeY - 4} ${eyeX + 3} ${eyeY - 1} C ${eyeX + 3} ${eyeY + 2} ${eyeX - 3} ${eyeY + 2} ${eyeX - 3} ${eyeY - 1} Z`);
    paths.push(`M ${eyeX - 1.5} ${eyeY - 1} C ${eyeX - 1.5} ${eyeY - 2.5} ${eyeX + 1.5} ${eyeY - 2.5} ${eyeX + 1.5} ${eyeY - 1} C ${eyeX + 1.5} ${eyeY + 0.5} ${eyeX - 1.5} ${eyeY + 0.5} ${eyeX - 1.5} ${eyeY - 1} Z`);
  }

  // Brows
  const browY = eyeY - eyeH - 5;
  paths.push(`M ${cx + eyeSpacing - eyeW - 3} ${browY + 3} Q ${cx + eyeSpacing} ${browY - 5} ${cx + eyeSpacing + eyeW + 3} ${browY + 2}`);
  paths.push(`M ${cx - eyeSpacing + eyeW + 3} ${browY + 3} Q ${cx - eyeSpacing} ${browY - 5} ${cx - eyeSpacing - eyeW - 3} ${browY + 2}`);

  // Nose
  const noseY = baseY + headH * 0.64;
  paths.push(`M ${cx} ${eyeY + 6} C ${cx + 2} ${noseY - 6} ${cx + 4} ${noseY} ${cx + 5} ${noseY + 4} C ${cx + 5} ${noseY + 7} ${cx + 2} ${noseY + 9} ${cx} ${noseY + 7} C ${cx - 2} ${noseY + 9} ${cx - 5} ${noseY + 7} ${cx - 5} ${noseY + 4} C ${cx - 4} ${noseY} ${cx - 2} ${noseY - 6} ${cx} ${eyeY + 6} Z`);

  // Lips
  const lipY = baseY + headH * 0.8;
  const lipW = 9;
  paths.push(`M ${cx - lipW} ${lipY} C ${cx - lipW * 0.5} ${lipY - 2} ${cx - 1.5} ${lipY - 3} ${cx} ${lipY - 2.5} C ${cx + 1.5} ${lipY - 3} ${cx + lipW * 0.5} ${lipY - 2} ${cx + lipW} ${lipY} C ${cx + lipW * 0.5} ${lipY + 1} ${cx} ${lipY + 0.5} ${cx - lipW * 0.5} ${lipY + 1} Z`);
  paths.push(`M ${cx - lipW + 1} ${lipY + 1.5} C ${cx} ${lipY + 1} ${cx + lipW - 1} ${lipY + 1.5} ${cx + lipW - 2} ${lipY + 4} C ${cx} ${lipY + 5.5} ${cx - lipW + 2} ${lipY + 4} ${cx - lipW + 1} ${lipY + 1.5} Z`);

  // Ears
  const earY = baseY + headH * 0.4;
  for (let side = -1; side <= 1; side += 2) {
    paths.push(`M ${cx + side * headW * 0.95} ${earY} C ${cx + side * (headW + 5)} ${earY - 3} ${cx + side * (headW + 8)} ${earY + 8} ${cx + side * (headW + 6)} ${earY + 16} C ${cx + side * (headW + 4)} ${earY + 22} ${cx + side * headW * 0.96} ${earY + 20} ${cx + side * headW * 0.94} ${earY + 14} Z`);
  }

  // NECK
  const neckTop = baseY + headH * 1.02;
  const neckW = 16 * p.neckWidth;
  const neckH = 24;
  paths.push(`M ${cx - headW * 0.28} ${neckTop} C ${cx - neckW * 0.95} ${neckTop + 5} ${cx - neckW} ${neckTop + neckH * 0.6} ${cx - neckW * 1.1} ${neckTop + neckH} L ${cx + neckW * 1.1} ${neckTop + neckH} C ${cx + neckW} ${neckTop + neckH * 0.6} ${cx + neckW * 0.95} ${neckTop + 5} ${cx + headW * 0.28} ${neckTop} Z`);

  // HUMAN TORSO (upper body)
  const torsoTop = neckTop + neckH;
  const shoulderW = 58 * p.shoulderWidth;
  const waistW = 32 * p.waistWidth;
  const torsoH = 70;

  let torso = `M ${cx - neckW * 1.1} ${torsoTop}`;
  torso += ` C ${cx - shoulderW * 0.5} ${torsoTop - 3} ${cx - shoulderW * 0.8} ${torsoTop + 10} ${cx - shoulderW} ${torsoTop + 18}`;
  torso += ` C ${cx - shoulderW - 5} ${torsoTop + 26} ${cx - shoulderW - 2} ${torsoTop + 38} ${cx - shoulderW + 4} ${torsoTop + 45}`;
  torso += ` C ${cx - waistW - 8} ${torsoTop + torsoH * 0.6} ${cx - waistW - 3} ${torsoTop + torsoH * 0.85} ${cx - waistW} ${torsoTop + torsoH}`;
  torso += ` L ${cx + waistW} ${torsoTop + torsoH}`;
  torso += ` C ${cx + waistW + 3} ${torsoTop + torsoH * 0.85} ${cx + waistW + 8} ${torsoTop + torsoH * 0.6} ${cx + shoulderW - 4} ${torsoTop + 45}`;
  torso += ` C ${cx + shoulderW + 2} ${torsoTop + 38} ${cx + shoulderW + 5} ${torsoTop + 26} ${cx + shoulderW} ${torsoTop + 18}`;
  torso += ` C ${cx + shoulderW * 0.8} ${torsoTop + 10} ${cx + shoulderW * 0.5} ${torsoTop - 3} ${cx + neckW * 1.1} ${torsoTop} Z`;
  paths.push(torso);

  // Chest
  if (gender === 'female') {
    paths.push(`M ${cx - 5} ${torsoTop + 18} C ${cx - 18} ${torsoTop + 16} ${cx - 24} ${torsoTop + 28} ${cx - 22} ${torsoTop + 36} C ${cx - 20} ${torsoTop + 42} ${cx - 10} ${torsoTop + 43} ${cx - 5} ${torsoTop + 38} Z`);
    paths.push(`M ${cx + 5} ${torsoTop + 18} C ${cx + 18} ${torsoTop + 16} ${cx + 24} ${torsoTop + 28} ${cx + 22} ${torsoTop + 36} C ${cx + 20} ${torsoTop + 42} ${cx + 10} ${torsoTop + 43} ${cx + 5} ${torsoTop + 38} Z`);
  } else {
    paths.push(`M ${cx - 6} ${torsoTop + 20} C ${cx - 22} ${torsoTop + 18} ${cx - 28} ${torsoTop + 30} ${cx - 25} ${torsoTop + 40} C ${cx - 22} ${torsoTop + 46} ${cx - 10} ${torsoTop + 46} ${cx - 6} ${torsoTop + 36} Z`);
    paths.push(`M ${cx + 6} ${torsoTop + 20} C ${cx + 22} ${torsoTop + 18} ${cx + 28} ${torsoTop + 30} ${cx + 25} ${torsoTop + 40} C ${cx + 22} ${torsoTop + 46} ${cx + 10} ${torsoTop + 46} ${cx + 6} ${torsoTop + 36} Z`);
  }

  // ARMS
  const armStartY = torsoTop + 18;
  const upperArmL = 45;
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
      const fingerL = f === 0 ? 12 : 16 + (2 - Math.abs(f - 2)) * 3;
      const fingerX = handX + side * (f * 4 - 6);
      const fingerY = f === 0 ? handY + 6 : handY + 14;
      paths.push(`M ${fingerX - fingerW} ${fingerY} L ${fingerX - fingerW * 0.7} ${fingerY + fingerL} Q ${fingerX} ${fingerY + fingerL + 2} ${fingerX + fingerW * 0.7} ${fingerY + fingerL} L ${fingerX + fingerW} ${fingerY} Z`);
    }
  }

  // HORSE BODY - Starts at human waist
  const horseTop = torsoTop + torsoH;
  const horseLength = 140;
  const horseHeight = 80;
  const horseChest = 50;

  // Horse barrel body
  let horseBody = `M ${cx - waistW} ${horseTop}`;
  // Connects human waist to horse chest
  horseBody += ` C ${cx - waistW - 10} ${horseTop + 15} ${cx - horseChest - 20} ${horseTop + 30} ${cx - horseChest - 30} ${horseTop + horseHeight * 0.4}`;
  // Horse underbelly
  horseBody += ` C ${cx - horseChest - 35} ${horseTop + horseHeight * 0.6} ${cx - 20} ${horseTop + horseHeight} ${cx + 30} ${horseTop + horseHeight}`;
  // Towards hindquarters
  horseBody += ` C ${cx + 60} ${horseTop + horseHeight} ${cx + horseLength * 0.7} ${horseTop + horseHeight * 0.85} ${cx + horseLength * 0.85} ${horseTop + horseHeight * 0.6}`;
  // Rump
  horseBody += ` C ${cx + horseLength} ${horseTop + horseHeight * 0.4} ${cx + horseLength + 10} ${horseTop + horseHeight * 0.15} ${cx + horseLength + 5} ${horseTop - 5}`;
  // Back line
  horseBody += ` C ${cx + horseLength - 10} ${horseTop - 15} ${cx + horseLength * 0.6} ${horseTop - 20} ${cx + 20} ${horseTop - 10}`;
  // Connect back to human waist
  horseBody += ` C ${cx - 10} ${horseTop - 5} ${cx + waistW + 5} ${horseTop + 5} ${cx + waistW} ${horseTop}`;
  horseBody += ' Z';
  paths.push(horseBody);

  // HORSE LEGS (4 legs)
  const legPositions = [
    { x: cx - horseChest - 20, y: horseTop + horseHeight * 0.45, front: true },
    { x: cx - 10, y: horseTop + horseHeight - 5, front: true },
    { x: cx + horseLength * 0.6, y: horseTop + horseHeight * 0.9, front: false },
    { x: cx + horseLength * 0.9, y: horseTop + horseHeight * 0.55, front: false },
  ];

  for (const legPos of legPositions) {
    const legLen = legPos.front ? 85 : 80;
    const legW = 12;
    let leg = `M ${legPos.x - legW / 2} ${legPos.y}`;
    leg += ` C ${legPos.x - legW / 2 - 3} ${legPos.y + legLen * 0.3} ${legPos.x - legW / 2 - 2} ${legPos.y + legLen * 0.6} ${legPos.x - legW / 2 + 2} ${legPos.y + legLen * 0.75}`;
    // Hock/knee joint
    leg += ` L ${legPos.x - legW / 2 - 4} ${legPos.y + legLen * 0.78}`;
    leg += ` L ${legPos.x - legW / 2 + 3} ${legPos.y + legLen * 0.82}`;
    // Lower leg
    leg += ` L ${legPos.x - 3} ${legPos.y + legLen - 8}`;
    // Hoof
    leg += ` L ${legPos.x - 10} ${legPos.y + legLen}`;
    leg += ` L ${legPos.x + 10} ${legPos.y + legLen}`;
    leg += ` L ${legPos.x + 3} ${legPos.y + legLen - 8}`;
    // Return up
    leg += ` L ${legPos.x + legW / 2 - 3} ${legPos.y + legLen * 0.82}`;
    leg += ` L ${legPos.x + legW / 2 + 4} ${legPos.y + legLen * 0.78}`;
    leg += ` L ${legPos.x + legW / 2 - 2} ${legPos.y + legLen * 0.75}`;
    leg += ` C ${legPos.x + legW / 2 + 2} ${legPos.y + legLen * 0.6} ${legPos.x + legW / 2 + 3} ${legPos.y + legLen * 0.3} ${legPos.x + legW / 2} ${legPos.y}`;
    leg += ' Z';
    paths.push(leg);
  }

  // HORSE TAIL
  const tailX = cx + horseLength + 5;
  const tailY = horseTop - 5;
  let tail = `M ${tailX} ${tailY}`;
  for (let i = 0; i < 15; i++) {
    const wave = Math.sin(i * 0.5 + r() * 3) * 12;
    tail += ` C ${tailX + 15 + wave} ${tailY + i * 8} ${tailX + 20 - wave} ${tailY + i * 8 + 4} ${tailX + 18 + wave * 0.5} ${tailY + i * 8 + 8}`;
  }
  // Return
  for (let i = 14; i >= 0; i--) {
    const wave = Math.sin(i * 0.5 + r() * 3) * 8;
    tail += ` C ${tailX + 10 - wave} ${tailY + i * 8 + 4} ${tailX + 5 + wave} ${tailY + i * 8} ${tailX + 8 - wave * 0.5} ${tailY + i * 8 - 4}`;
  }
  tail += ' Z';
  paths.push(tail);

  // Horse mane along back
  for (let m = 0; m < 8; m++) {
    const maneX = cx + 10 + m * 15;
    const maneY = horseTop - 12 - Math.sin(m * 0.5) * 5;
    const maneLen = 15 + r() * 10;
    paths.push(`M ${maneX} ${maneY} C ${maneX - 5} ${maneY + maneLen * 0.4} ${maneX - 8} ${maneY + maneLen * 0.8} ${maneX - 10 - r() * 5} ${maneY + maneLen}`);
  }

  return paths;
};

// ============================================================================
// COMPONENT EXPORTS
// ============================================================================
interface AvatarSilhouetteProps {
  race: 'giant' | 'merfolk' | 'centaur';
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
  const generators: Record<string, (g: Gender) => string[]> = {
    giant: generateGiantSilhouette,
    merfolk: generateMerfolkSilhouette,
    centaur: generateCentaurSilhouette,
  };
  
  const [paths] = React.useState<string[]>(() => {
    const generator = generators[race] || generateGiantSilhouette;
    const generatedPaths = generator(gender);
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
