// KasVillage Identity Ritual - Golem, Elemental, Undead Silhouettes
// Male & Female versions, ~4000 bezier points each

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
// GOLEM - Stone/clay construct, cracks, runes, glowing core
// ============================================================================
export const generateGolemSilhouette = (gender: Gender, seed: number): string[] => {
  const p = BODY_PARAMS[gender];
  const r = (i: number) => seededRandom(seed + i);
  const paths: string[] = [];
  
  const cx = 200, baseY = 32;
  const headW = 52 * p.jawWidth;
  const headH = 55;
  
  // MASSIVE STONE HEAD - Blocky angular
  let skull = `M ${cx} ${baseY}`;
  // Angular rocky crown with chunks
  for (let i = 0; i <= 25; i++) {
    const angle = (i / 25) * Math.PI;
    const chunk = (r(i) - 0.5) * 12;
    const rx = headW * (0.88 + r(i + 20) * 0.08);
    const ry = headH * 0.48;
    const x = cx + Math.sin(angle) * rx;
    const y = baseY + 8 - Math.cos(angle) * ry + chunk;
    if (i === 0) skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    else skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  // Heavy angular brow
  skull += ` L ${cx + headW * 0.95} ${baseY + headH * 0.35}`;
  skull += ` L ${cx + headW * 1.05} ${baseY + headH * 0.42}`;
  skull += ` L ${cx + headW * 1.0} ${baseY + headH * 0.52}`;
  // Blocky cheek
  skull += ` L ${cx + headW * 0.95} ${baseY + headH * 0.65}`;
  skull += ` L ${cx + headW * 0.85} ${baseY + headH * 0.78}`;
  // Square jaw
  skull += ` L ${cx + headW * 0.7} ${baseY + headH * 0.88}`;
  skull += ` L ${cx + headW * 0.45} ${baseY + headH * 0.95}`;
  skull += ` L ${cx + headW * 0.15} ${baseY + headH * 1.0}`;
  skull += ` L ${cx} ${baseY + headH * 1.02}`;
  // Left side mirror
  skull += ` L ${cx - headW * 0.15} ${baseY + headH * 1.0}`;
  skull += ` L ${cx - headW * 0.45} ${baseY + headH * 0.95}`;
  skull += ` L ${cx - headW * 0.7} ${baseY + headH * 0.88}`;
  skull += ` L ${cx - headW * 0.85} ${baseY + headH * 0.78}`;
  skull += ` L ${cx - headW * 0.95} ${baseY + headH * 0.65}`;
  skull += ` L ${cx - headW * 1.0} ${baseY + headH * 0.52}`;
  skull += ` L ${cx - headW * 1.05} ${baseY + headH * 0.42}`;
  skull += ` L ${cx - headW * 0.95} ${baseY + headH * 0.35}`;
  skull += ' Z';
  paths.push(skull);

  // CRACK PATTERNS across head
  for (let c = 0; c < 8; c++) {
    const startX = cx + (r(100 + c) - 0.5) * headW * 1.5;
    const startY = baseY + r(110 + c) * headH * 0.8;
    let crack = `M ${startX} ${startY}`;
    let crackX = startX, crackY = startY;
    for (let seg = 0; seg < 4 + Math.floor(r(120 + c) * 4); seg++) {
      crackX += (r(130 + c * 10 + seg) - 0.5) * 15;
      crackY += r(140 + c * 10 + seg) * 12;
      crack += ` L ${crackX} ${crackY}`;
    }
    paths.push(crack);
  }

  // GLOWING EYES - Deep set geometric
  const eyeY = baseY + headH * 0.45;
  const eyeSpacing = headW * 0.38;
  const eyeW = 12, eyeH = 8;
  
  // Right eye socket (angular)
  paths.push(`M ${cx + eyeSpacing - eyeW} ${eyeY - eyeH * 0.3} L ${cx + eyeSpacing - eyeW + 3} ${eyeY - eyeH} L ${cx + eyeSpacing + eyeW - 3} ${eyeY - eyeH} L ${cx + eyeSpacing + eyeW} ${eyeY - eyeH * 0.3} L ${cx + eyeSpacing + eyeW} ${eyeY + eyeH * 0.5} L ${cx + eyeSpacing + eyeW - 4} ${eyeY + eyeH} L ${cx + eyeSpacing - eyeW + 4} ${eyeY + eyeH} L ${cx + eyeSpacing - eyeW} ${eyeY + eyeH * 0.5} Z`);
  // Glowing core
  paths.push(`M ${cx + eyeSpacing - 4} ${eyeY - 2} L ${cx + eyeSpacing} ${eyeY - 5} L ${cx + eyeSpacing + 4} ${eyeY - 2} L ${cx + eyeSpacing + 4} ${eyeY + 3} L ${cx + eyeSpacing} ${eyeY + 5} L ${cx + eyeSpacing - 4} ${eyeY + 3} Z`);
  
  // Left eye socket
  paths.push(`M ${cx - eyeSpacing + eyeW} ${eyeY - eyeH * 0.3} L ${cx - eyeSpacing + eyeW - 3} ${eyeY - eyeH} L ${cx - eyeSpacing - eyeW + 3} ${eyeY - eyeH} L ${cx - eyeSpacing - eyeW} ${eyeY - eyeH * 0.3} L ${cx - eyeSpacing - eyeW} ${eyeY + eyeH * 0.5} L ${cx - eyeSpacing - eyeW + 4} ${eyeY + eyeH} L ${cx - eyeSpacing + eyeW - 4} ${eyeY + eyeH} L ${cx - eyeSpacing + eyeW} ${eyeY + eyeH * 0.5} Z`);
  paths.push(`M ${cx - eyeSpacing + 4} ${eyeY - 2} L ${cx - eyeSpacing} ${eyeY - 5} L ${cx - eyeSpacing - 4} ${eyeY - 2} L ${cx - eyeSpacing - 4} ${eyeY + 3} L ${cx - eyeSpacing} ${eyeY + 5} L ${cx - eyeSpacing + 4} ${eyeY + 3} Z`);

  // Heavy brow ridge
  paths.push(`M ${cx - headW * 0.85} ${baseY + headH * 0.3} L ${cx - headW * 0.5} ${baseY + headH * 0.22} L ${cx} ${baseY + headH * 0.2} L ${cx + headW * 0.5} ${baseY + headH * 0.22} L ${cx + headW * 0.85} ${baseY + headH * 0.3}`);

  // NOSE - Flat angular block
  const noseY = baseY + headH * 0.6;
  paths.push(`M ${cx - 8} ${eyeY + 8} L ${cx - 10} ${noseY} L ${cx - 12} ${noseY + 10} L ${cx - 8} ${noseY + 15} L ${cx} ${noseY + 18} L ${cx + 8} ${noseY + 15} L ${cx + 12} ${noseY + 10} L ${cx + 10} ${noseY} L ${cx + 8} ${eyeY + 8} Z`);

  // MOUTH - Carved slot
  const mouthY = baseY + headH * 0.85;
  paths.push(`M ${cx - 18} ${mouthY} L ${cx - 15} ${mouthY - 4} L ${cx} ${mouthY - 5} L ${cx + 15} ${mouthY - 4} L ${cx + 18} ${mouthY} L ${cx + 15} ${mouthY + 5} L ${cx} ${mouthY + 6} L ${cx - 15} ${mouthY + 5} Z`);

  // RUNES carved into forehead
  const runeY = baseY + headH * 0.15;
  // Central rune
  paths.push(`M ${cx} ${runeY - 8} L ${cx + 6} ${runeY} L ${cx + 4} ${runeY + 8} L ${cx} ${runeY + 12} L ${cx - 4} ${runeY + 8} L ${cx - 6} ${runeY} Z`);
  paths.push(`M ${cx} ${runeY - 4} L ${cx} ${runeY + 8}`);
  paths.push(`M ${cx - 4} ${runeY + 2} L ${cx + 4} ${runeY + 2}`);
  // Side runes
  for (let side = -1; side <= 1; side += 2) {
    const runeX = cx + side * 22;
    paths.push(`M ${runeX - 3} ${runeY} L ${runeX} ${runeY - 5} L ${runeX + 3} ${runeY} L ${runeX} ${runeY + 6} Z`);
    paths.push(`M ${runeX} ${runeY - 3} L ${runeX} ${runeY + 4}`);
  }

  // MASSIVE NECK - Stone pillar
  const neckTop = baseY + headH * 1.02;
  const neckW = 38 * p.neckWidth;
  const neckH = 25;
  
  paths.push(`M ${cx - headW * 0.5} ${neckTop} L ${cx - neckW} ${neckTop + neckH * 0.3} L ${cx - neckW * 1.1} ${neckTop + neckH} L ${cx + neckW * 1.1} ${neckTop + neckH} L ${cx + neckW} ${neckTop + neckH * 0.3} L ${cx + headW * 0.5} ${neckTop} Z`);
  // Neck cracks
  paths.push(`M ${cx - 12} ${neckTop + 5} L ${cx - 15} ${neckTop + neckH - 3}`);
  paths.push(`M ${cx + 10} ${neckTop + 3} L ${cx + 8} ${neckTop + neckH - 5}`);

  // MASSIVE STONE TORSO
  const torsoTop = neckTop + neckH;
  const shoulderW = 95 * p.shoulderWidth;
  const waistW = 55 * p.waistWidth;
  const hipW = 52 * p.hipWidth;
  const torsoH = 100;

  let torso = `M ${cx - neckW * 1.1} ${torsoTop}`;
  // Blocky massive shoulders
  torso += ` L ${cx - shoulderW * 0.6} ${torsoTop - 5}`;
  torso += ` L ${cx - shoulderW * 0.85} ${torsoTop + 8}`;
  torso += ` L ${cx - shoulderW} ${torsoTop + 25}`;
  torso += ` L ${cx - shoulderW - 5} ${torsoTop + 40}`;
  torso += ` L ${cx - shoulderW + 5} ${torsoTop + 55}`;
  // Waist
  torso += ` L ${cx - waistW - 5} ${torsoTop + torsoH * 0.6}`;
  torso += ` L ${cx - waistW} ${torsoTop + torsoH * 0.8}`;
  torso += ` L ${cx - hipW} ${torsoTop + torsoH}`;
  torso += ` L ${cx - hipW * 0.3} ${torsoTop + torsoH + 5}`;
  torso += ` L ${cx + hipW * 0.3} ${torsoTop + torsoH + 5}`;
  torso += ` L ${cx + hipW} ${torsoTop + torsoH}`;
  torso += ` L ${cx + waistW} ${torsoTop + torsoH * 0.8}`;
  torso += ` L ${cx + waistW + 5} ${torsoTop + torsoH * 0.6}`;
  torso += ` L ${cx + shoulderW - 5} ${torsoTop + 55}`;
  torso += ` L ${cx + shoulderW + 5} ${torsoTop + 40}`;
  torso += ` L ${cx + shoulderW} ${torsoTop + 25}`;
  torso += ` L ${cx + shoulderW * 0.85} ${torsoTop + 8}`;
  torso += ` L ${cx + shoulderW * 0.6} ${torsoTop - 5}`;
  torso += ` L ${cx + neckW * 1.1} ${torsoTop} Z`;
  paths.push(torso);

  // GLOWING CORE in chest
  const coreY = torsoTop + 35;
  const coreR = 18;
  // Outer ring
  for (let ring = 0; ring < 3; ring++) {
    const ringR = coreR - ring * 5;
    let core = `M ${cx - ringR} ${coreY}`;
    for (let i = 1; i <= 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      core += ` L ${cx + Math.cos(angle) * ringR} ${coreY + Math.sin(angle) * ringR}`;
    }
    core += ' Z';
    paths.push(core);
  }
  // Core glow rays
  for (let ray = 0; ray < 8; ray++) {
    const angle = (ray / 8) * Math.PI * 2;
    paths.push(`M ${cx + Math.cos(angle) * (coreR + 3)} ${coreY + Math.sin(angle) * (coreR + 3)} L ${cx + Math.cos(angle) * (coreR + 12)} ${coreY + Math.sin(angle) * (coreR + 12)}`);
  }

  // Stone plate/segment lines
  paths.push(`M ${cx - 35} ${torsoTop + 55} L ${cx - 32} ${torsoTop + torsoH - 10}`);
  paths.push(`M ${cx + 35} ${torsoTop + 55} L ${cx + 32} ${torsoTop + torsoH - 10}`);
  // More cracks
  for (let c = 0; c < 6; c++) {
    const crackX = cx + (r(200 + c) - 0.5) * waistW * 1.5;
    const crackY = torsoTop + 50 + r(210 + c) * 40;
    paths.push(`M ${crackX} ${crackY} L ${crackX + (r(220 + c) - 0.5) * 15} ${crackY + 10 + r(230 + c) * 15}`);
  }

  // RUNES on torso
  const runeChestY = torsoTop + 65;
  for (let side = -1; side <= 1; side += 2) {
    const runeX = cx + side * 25;
    paths.push(`M ${runeX} ${runeChestY - 10} L ${runeX + 8 * side} ${runeChestY} L ${runeX} ${runeChestY + 12} L ${runeX - 5 * side} ${runeChestY + 5} Z`);
  }

  // MASSIVE ARMS - Stone pillars
  const armStartY = torsoTop + 25;
  const upperArmL = 55;
  const forearmL = 52;
  const armW = gender === 'male' ? 28 : 22;

  // Left arm
  let leftArm = `M ${cx - shoulderW} ${armStartY}`;
  leftArm += ` L ${cx - shoulderW - 15} ${armStartY + 15}`;
  leftArm += ` L ${cx - shoulderW - 22} ${armStartY + 35}`;
  leftArm += ` L ${cx - shoulderW - 20} ${armStartY + upperArmL}`;
  leftArm += ` L ${cx - shoulderW - 25} ${armStartY + upperArmL + 15}`;
  leftArm += ` L ${cx - shoulderW - 22} ${armStartY + upperArmL + forearmL - 10}`;
  leftArm += ` L ${cx - shoulderW - 18} ${armStartY + upperArmL + forearmL}`;
  // Blocky hand
  leftArm += ` L ${cx - shoulderW - 20} ${armStartY + upperArmL + forearmL + 12}`;
  leftArm += ` L ${cx - shoulderW - 5} ${armStartY + upperArmL + forearmL + 35}`;
  leftArm += ` L ${cx - shoulderW + 18} ${armStartY + upperArmL + forearmL + 32}`;
  leftArm += ` L ${cx - shoulderW + 15} ${armStartY + upperArmL + forearmL + 8}`;
  leftArm += ` L ${cx - shoulderW + armW} ${armStartY + upperArmL + 20}`;
  leftArm += ` L ${cx - shoulderW + armW - 5} ${armStartY + 20}`;
  leftArm += ` L ${cx - shoulderW + 8} ${armStartY} Z`;
  paths.push(leftArm);

  // Right arm
  let rightArm = `M ${cx + shoulderW} ${armStartY}`;
  rightArm += ` L ${cx + shoulderW + 15} ${armStartY + 15}`;
  rightArm += ` L ${cx + shoulderW + 22} ${armStartY + 35}`;
  rightArm += ` L ${cx + shoulderW + 20} ${armStartY + upperArmL}`;
  rightArm += ` L ${cx + shoulderW + 25} ${armStartY + upperArmL + 15}`;
  rightArm += ` L ${cx + shoulderW + 22} ${armStartY + upperArmL + forearmL - 10}`;
  rightArm += ` L ${cx + shoulderW + 18} ${armStartY + upperArmL + forearmL}`;
  rightArm += ` L ${cx + shoulderW + 20} ${armStartY + upperArmL + forearmL + 12}`;
  rightArm += ` L ${cx + shoulderW + 5} ${armStartY + upperArmL + forearmL + 35}`;
  rightArm += ` L ${cx + shoulderW - 18} ${armStartY + upperArmL + forearmL + 32}`;
  rightArm += ` L ${cx + shoulderW - 15} ${armStartY + upperArmL + forearmL + 8}`;
  rightArm += ` L ${cx + shoulderW - armW} ${armStartY + upperArmL + 20}`;
  rightArm += ` L ${cx + shoulderW - armW + 5} ${armStartY + 20}`;
  rightArm += ` L ${cx + shoulderW - 8} ${armStartY} Z`;
  paths.push(rightArm);

  // Blocky stone fingers
  const handY = armStartY + upperArmL + forearmL + 12;
  for (let side = -1; side <= 1; side += 2) {
    const handX = cx + side * (shoulderW - 5);
    for (let f = 0; f < 4; f++) {
      const fingerW = 6;
      const fingerL = 20 + (2 - Math.abs(f - 1.5)) * 5;
      const fingerX = handX + side * (f * 8 - 10);
      const fingerY = handY + 18;
      paths.push(`M ${fingerX - fingerW} ${fingerY} L ${fingerX - fingerW + 1} ${fingerY + fingerL - 3} L ${fingerX - 2} ${fingerY + fingerL} L ${fingerX + 2} ${fingerY + fingerL} L ${fingerX + fingerW - 1} ${fingerY + fingerL - 3} L ${fingerX + fingerW} ${fingerY} Z`);
    }
  }

  // Arm cracks and runes
  for (let side = -1; side <= 1; side += 2) {
    const armX = cx + side * (shoulderW + 5);
    paths.push(`M ${armX} ${armStartY + 20} L ${armX + side * 3} ${armStartY + 45}`);
    paths.push(`M ${armX - side * 5} ${armStartY + upperArmL + 20} L ${armX - side * 8} ${armStartY + upperArmL + 40}`);
    // Arm rune
    const runeArmY = armStartY + upperArmL + 25;
    paths.push(`M ${armX} ${runeArmY - 5} L ${armX + 4 * side} ${runeArmY} L ${armX} ${runeArmY + 6} Z`);
  }

  // MASSIVE LEGS - Stone pillars
  const legTop = torsoTop + torsoH + 5;
  const thighL = 58;
  const calfL = 55;
  const legW = gender === 'male' ? 26 : 22;

  // Left leg
  let leftLeg = `M ${cx - hipW * 0.15} ${legTop}`;
  leftLeg += ` L ${cx - hipW * 0.4} ${legTop + 8}`;
  leftLeg += ` L ${cx - legW - 8} ${legTop + thighL * 0.4}`;
  leftLeg += ` L ${cx - legW - 12} ${legTop + thighL * 0.7}`;
  leftLeg += ` L ${cx - legW - 10} ${legTop + thighL}`;
  leftLeg += ` L ${cx - legW - 14} ${legTop + thighL + 12}`;
  leftLeg += ` L ${cx - legW - 10} ${legTop + thighL + calfL - 12}`;
  leftLeg += ` L ${cx - legW - 8} ${legTop + thighL + calfL}`;
  // Blocky foot
  leftLeg += ` L ${cx - legW - 12} ${legTop + thighL + calfL + 10}`;
  leftLeg += ` L ${cx - 45} ${legTop + thighL + calfL + 18}`;
  leftLeg += ` L ${cx - 48} ${legTop + thighL + calfL + 28}`;
  leftLeg += ` L ${cx - 8} ${legTop + thighL + calfL + 28}`;
  leftLeg += ` L ${cx - 6} ${legTop + thighL + calfL + 8}`;
  leftLeg += ` L ${cx - 8} ${legTop + thighL + 15}`;
  leftLeg += ` L ${cx - 10} ${legTop + 15}`;
  leftLeg += ` L ${cx - hipW * 0.15} ${legTop} Z`;
  paths.push(leftLeg);

  // Right leg
  let rightLeg = `M ${cx + hipW * 0.15} ${legTop}`;
  rightLeg += ` L ${cx + hipW * 0.4} ${legTop + 8}`;
  rightLeg += ` L ${cx + legW + 8} ${legTop + thighL * 0.4}`;
  rightLeg += ` L ${cx + legW + 12} ${legTop + thighL * 0.7}`;
  rightLeg += ` L ${cx + legW + 10} ${legTop + thighL}`;
  rightLeg += ` L ${cx + legW + 14} ${legTop + thighL + 12}`;
  rightLeg += ` L ${cx + legW + 10} ${legTop + thighL + calfL - 12}`;
  rightLeg += ` L ${cx + legW + 8} ${legTop + thighL + calfL}`;
  rightLeg += ` L ${cx + legW + 12} ${legTop + thighL + calfL + 10}`;
  rightLeg += ` L ${cx + 45} ${legTop + thighL + calfL + 18}`;
  rightLeg += ` L ${cx + 48} ${legTop + thighL + calfL + 28}`;
  rightLeg += ` L ${cx + 8} ${legTop + thighL + calfL + 28}`;
  rightLeg += ` L ${cx + 6} ${legTop + thighL + calfL + 8}`;
  rightLeg += ` L ${cx + 8} ${legTop + thighL + 15}`;
  rightLeg += ` L ${cx + 10} ${legTop + 15}`;
  rightLeg += ` L ${cx + hipW * 0.15} ${legTop} Z`;
  paths.push(rightLeg);

  // Leg cracks
  for (let side = -1; side <= 1; side += 2) {
    const legX = cx + side * (legW + 5);
    paths.push(`M ${legX} ${legTop + 25} L ${legX + side * 4} ${legTop + 50}`);
    paths.push(`M ${legX - side * 3} ${legTop + thighL + 25} L ${legX - side * 5} ${legTop + thighL + 45}`);
  }

  return paths;
};

// ============================================================================
// ELEMENTAL - Fire/water/air/earth spirit, flowing energy, no fixed form
// ============================================================================
export const generateElementalSilhouette = (gender: Gender, seed: number): string[] => {
  const p = BODY_PARAMS[gender];
  const r = (i: number) => seededRandom(seed + i);
  const paths: string[] = [];
  
  const cx = 200, baseY = 40;
  const headW = 38 * p.jawWidth;
  const headH = 48;
  
  // ETHEREAL HEAD - Flowing energy form
  let skull = `M ${cx} ${baseY}`;
  // Swirling energy crown
  for (let i = 0; i <= 40; i++) {
    const angle = (i / 40) * Math.PI;
    const flow = Math.sin(i * 0.8 + r(i) * 2) * 8;
    const tendril = Math.sin(i * 1.5) * 5;
    const rx = headW * (0.9 + r(i + 20) * 0.15) + flow;
    const ry = headH * 0.5;
    const x = cx + Math.sin(angle) * rx + tendril;
    const y = baseY + 5 - Math.cos(angle) * ry;
    skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  // Flowing face shape
  skull += ` C ${cx + headW * 0.95} ${baseY + headH * 0.35} ${cx + headW * 1.05} ${baseY + headH * 0.48} ${cx + headW * 0.98} ${baseY + headH * 0.58}`;
  skull += ` C ${cx + headW * 1.02} ${baseY + headH * 0.68} ${cx + headW * 0.92} ${baseY + headH * 0.8} ${cx + headW * 0.75} ${baseY + headH * 0.88}`;
  skull += ` C ${cx + headW * 0.5} ${baseY + headH * 0.96} ${cx + headW * 0.2} ${baseY + headH * 1.0} ${cx} ${baseY + headH * 1.02}`;
  skull += ` C ${cx - headW * 0.2} ${baseY + headH * 1.0} ${cx - headW * 0.5} ${baseY + headH * 0.96} ${cx - headW * 0.75} ${baseY + headH * 0.88}`;
  skull += ` C ${cx - headW * 0.92} ${baseY + headH * 0.8} ${cx - headW * 1.02} ${baseY + headH * 0.68} ${cx - headW * 0.98} ${baseY + headH * 0.58}`;
  skull += ` C ${cx - headW * 1.05} ${baseY + headH * 0.48} ${cx - headW * 0.95} ${baseY + headH * 0.35} ${cx - headW * 0.88} ${baseY + headH * 0.2}`;
  skull += ' Z';
  paths.push(skull);

  // ENERGY WISPS from head
  for (let w = 0; w < 12; w++) {
    const wispAngle = (w / 12) * Math.PI + r(50 + w) * 0.3;
    const wispStartX = cx + Math.sin(wispAngle) * headW * 0.85;
    const wispStartY = baseY + 5 - Math.cos(wispAngle) * headH * 0.4;
    const wispLength = 25 + r(60 + w) * 25;
    let wisp = `M ${wispStartX} ${wispStartY}`;
    for (let seg = 0; seg < 5; seg++) {
      const t = (seg + 1) / 5;
      const swirl = Math.sin(seg * 1.2 + r(70 + w * 5 + seg) * 3) * 12;
      const wX = wispStartX + Math.sin(wispAngle) * wispLength * t + swirl;
      const wY = wispStartY - Math.cos(wispAngle) * wispLength * t - seg * 3;
      wisp += ` Q ${wX + swirl * 0.5} ${wY - 5} ${wX} ${wY}`;
    }
    paths.push(wisp);
  }

  // GLOWING EYES - Pure energy orbs
  const eyeY = baseY + headH * 0.42;
  const eyeSpacing = headW * 0.3;
  const eyeR = 8;
  
  // Right eye - swirling energy
  for (let ring = 0; ring < 3; ring++) {
    const ringR = eyeR - ring * 2.5;
    let eye = `M ${cx + eyeSpacing + ringR} ${eyeY}`;
    for (let i = 1; i <= 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const wobble = Math.sin(i * 2 + ring) * 1.5;
      eye += ` L ${cx + eyeSpacing + Math.cos(angle) * (ringR + wobble)} ${eyeY + Math.sin(angle) * (ringR + wobble)}`;
    }
    eye += ' Z';
    paths.push(eye);
  }
  // Eye energy rays
  for (let ray = 0; ray < 6; ray++) {
    const angle = (ray / 6) * Math.PI * 2;
    paths.push(`M ${cx + eyeSpacing + Math.cos(angle) * (eyeR + 2)} ${eyeY + Math.sin(angle) * (eyeR + 2)} L ${cx + eyeSpacing + Math.cos(angle) * (eyeR + 8)} ${eyeY + Math.sin(angle) * (eyeR + 8)}`);
  }
  
  // Left eye
  for (let ring = 0; ring < 3; ring++) {
    const ringR = eyeR - ring * 2.5;
    let eye = `M ${cx - eyeSpacing - ringR} ${eyeY}`;
    for (let i = 1; i <= 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const wobble = Math.sin(i * 2 + ring) * 1.5;
      eye += ` L ${cx - eyeSpacing + Math.cos(angle) * (ringR + wobble)} ${eyeY + Math.sin(angle) * (ringR + wobble)}`;
    }
    eye += ' Z';
    paths.push(eye);
  }
  for (let ray = 0; ray < 6; ray++) {
    const angle = (ray / 6) * Math.PI * 2;
    paths.push(`M ${cx - eyeSpacing + Math.cos(angle) * (eyeR + 2)} ${eyeY + Math.sin(angle) * (eyeR + 2)} L ${cx - eyeSpacing + Math.cos(angle) * (eyeR + 8)} ${eyeY + Math.sin(angle) * (eyeR + 8)}`);
  }

  // MOUTH - Energy slit
  const mouthY = baseY + headH * 0.78;
  let mouth = `M ${cx - 15} ${mouthY}`;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const wave = Math.sin(i * 0.8) * 3;
    mouth += ` L ${cx - 15 + t * 30} ${mouthY + wave}`;
  }
  paths.push(mouth);

  // FLOWING NECK - Energy stream
  const neckTop = baseY + headH * 1.02;
  const neckW = 20 * p.neckWidth;
  const neckH = 25;
  
  let neck = `M ${cx - headW * 0.3} ${neckTop}`;
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const wave = Math.sin(i * 1.2) * 8;
    neck += ` C ${cx - neckW - wave} ${neckTop + t * neckH} ${cx - neckW + wave} ${neckTop + t * neckH + 3} ${cx - neckW * (1 + t * 0.2) + wave * 0.5} ${neckTop + t * neckH + 3}`;
  }
  neck += ` L ${cx + neckW * 1.2} ${neckTop + neckH}`;
  for (let i = 8; i >= 0; i--) {
    const t = i / 8;
    const wave = Math.sin(i * 1.2) * 8;
    neck += ` C ${cx + neckW + wave} ${neckTop + t * neckH + 3} ${cx + neckW - wave} ${neckTop + t * neckH} ${cx + neckW * (1 + t * 0.2) - wave * 0.5} ${neckTop + t * neckH}`;
  }
  neck += ` L ${cx + headW * 0.3} ${neckTop} Z`;
  paths.push(neck);

  // ENERGY TORSO - Swirling form
  const torsoTop = neckTop + neckH;
  const shoulderW = 65 * p.shoulderWidth;
  const waistW = 35 * p.waistWidth;
  const hipW = 40 * p.hipWidth;
  const torsoH = 90;

  let torso = `M ${cx - neckW * 1.2} ${torsoTop}`;
  // Flowing shoulder
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const wave = Math.sin(i * 0.9 + r(100 + i) * 2) * 10;
    torso += ` C ${cx - neckW * 1.2 - t * (shoulderW - neckW * 1.2) + wave} ${torsoTop + t * 25 - 5} ${cx - shoulderW + wave * 0.5} ${torsoTop + 20 + t * 5} ${cx - shoulderW - wave * 0.3} ${torsoTop + 25 + t * 8}`;
  }
  // Flowing side
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const wave = Math.sin(i * 0.7 + r(120 + i) * 2) * 12;
    const y = torsoTop + 45 + t * (torsoH - 45);
    const w = shoulderW - t * (shoulderW - waistW);
    torso += ` C ${cx - w + wave} ${y - 5} ${cx - w - wave * 0.5} ${y} ${cx - w + wave * 0.3} ${y + 5}`;
  }
  // Bottom
  torso += ` C ${cx - hipW} ${torsoTop + torsoH + 3} ${cx - hipW * 0.3} ${torsoTop + torsoH + 8} ${cx} ${torsoTop + torsoH + 10}`;
  torso += ` C ${cx + hipW * 0.3} ${torsoTop + torsoH + 8} ${cx + hipW} ${torsoTop + torsoH + 3} ${cx + waistW} ${torsoTop + torsoH * 0.85}`;
  // Right side up
  for (let i = 8; i >= 0; i--) {
    const t = i / 8;
    const wave = Math.sin(i * 0.7 + r(140 + i) * 2) * 12;
    const y = torsoTop + 45 + t * (torsoH - 45);
    const w = shoulderW - t * (shoulderW - waistW);
    torso += ` C ${cx + w - wave * 0.3} ${y + 5} ${cx + w + wave * 0.5} ${y} ${cx + w - wave} ${y - 5}`;
  }
  for (let i = 6; i >= 0; i--) {
    const t = i / 6;
    const wave = Math.sin(i * 0.9 + r(160 + i) * 2) * 10;
    torso += ` C ${cx + shoulderW + wave * 0.3} ${torsoTop + 25 + t * 8} ${cx + shoulderW - wave * 0.5} ${torsoTop + 20 + t * 5} ${cx + neckW * 1.2 + t * (shoulderW - neckW * 1.2) - wave} ${torsoTop + t * 25 - 5}`;
  }
  torso += ' Z';
  paths.push(torso);

  // ENERGY CORE
  const coreY = torsoTop + 40;
  for (let ring = 0; ring < 4; ring++) {
    const ringR = 22 - ring * 5;
    let core = `M ${cx + ringR} ${coreY}`;
    for (let i = 1; i <= 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const pulse = Math.sin(i * 3 + ring * 2) * 3;
      core += ` L ${cx + Math.cos(angle) * (ringR + pulse)} ${coreY + Math.sin(angle) * (ringR + pulse)}`;
    }
    core += ' Z';
    paths.push(core);
  }
  // Core energy tendrils
  for (let t = 0; t < 8; t++) {
    const angle = (t / 8) * Math.PI * 2;
    let tendril = `M ${cx + Math.cos(angle) * 25} ${coreY + Math.sin(angle) * 25}`;
    for (let seg = 0; seg < 4; seg++) {
      const segAngle = angle + (r(200 + t * 4 + seg) - 0.5) * 0.5;
      const dist = 30 + seg * 12;
      tendril += ` Q ${cx + Math.cos(segAngle) * (dist - 5)} ${coreY + Math.sin(segAngle) * (dist - 5)} ${cx + Math.cos(segAngle) * dist} ${coreY + Math.sin(segAngle) * dist}`;
    }
    paths.push(tendril);
  }

  // FLOWING ARMS - Energy streams
  const armStartY = torsoTop + 30;
  const armLength = 95;

  for (let side = -1; side <= 1; side += 2) {
    const armX = cx + side * shoulderW;
    let arm = `M ${armX} ${armStartY}`;
    // Main arm flow
    for (let i = 0; i <= 15; i++) {
      const t = i / 15;
      const wave = Math.sin(i * 0.6 + r(250 + Math.abs(side) * 20 + i) * 3) * 15;
      const x = armX + side * (8 + t * 15) + wave;
      const y = armStartY + t * armLength;
      arm += ` C ${x + wave * 0.3} ${y - 3} ${x - wave * 0.2} ${y} ${x} ${y + 3}`;
    }
    // Hand energy burst
    const handY = armStartY + armLength;
    const handX = armX + side * 25;
    for (let f = 0; f < 5; f++) {
      const fingerAngle = (f / 5) * Math.PI * 0.6 - Math.PI * 0.3;
      const fingerLen = 20 + r(280 + f) * 15;
      paths.push(`M ${handX} ${handY} Q ${handX + Math.cos(fingerAngle + side * 0.5) * fingerLen * 0.6} ${handY + Math.sin(fingerAngle) * fingerLen * 0.6 + 5} ${handX + Math.cos(fingerAngle + side * 0.5) * fingerLen} ${handY + Math.sin(fingerAngle) * fingerLen + 10}`);
    }
    // Return path
    for (let i = 15; i >= 0; i--) {
      const t = i / 15;
      const wave = Math.sin(i * 0.6 + r(300 + Math.abs(side) * 20 + i) * 3) * 15;
      const x = armX + side * (-5 + t * 10) + wave;
      const y = armStartY + t * armLength;
      arm += ` C ${x} ${y + 3} ${x + wave * 0.2} ${y} ${x - wave * 0.3} ${y - 3}`;
    }
    arm += ' Z';
    paths.push(arm);
  }

  // FLOWING LEGS - Energy streams dissolving
  const legTop = torsoTop + torsoH + 8;
  const legLength = 110;

  for (let side = -1; side <= 1; side += 2) {
    const legStartX = cx + side * hipW * 0.3;
    let leg = `M ${legStartX} ${legTop}`;
    // Leg flow
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      const wave = Math.sin(i * 0.5 + r(350 + Math.abs(side) * 25 + i) * 3) * 12;
      const spread = t * t * 15; // Legs spread/dissolve at bottom
      const x = legStartX + side * (5 + spread) + wave;
      const y = legTop + t * legLength;
      leg += ` C ${x + wave * 0.3} ${y - 2} ${x - wave * 0.2} ${y + 1} ${x} ${y + 3}`;
    }
    // Dissolving foot energy
    const footY = legTop + legLength;
    const footX = legStartX + side * 25;
    for (let w = 0; w < 6; w++) {
      const wispAngle = (w / 6) * Math.PI * 0.8 - Math.PI * 0.4;
      const wispLen = 15 + r(400 + w) * 20;
      paths.push(`M ${footX + w * side * 3} ${footY} Q ${footX + Math.cos(wispAngle) * wispLen * 0.5 + w * side * 3} ${footY + wispLen * 0.6} ${footX + Math.cos(wispAngle) * wispLen + w * side * 2} ${footY + wispLen}`);
    }
    // Return
    for (let i = 18; i >= 0; i--) {
      const t = i / 18;
      const wave = Math.sin(i * 0.5 + r(420 + Math.abs(side) * 25 + i) * 3) * 12;
      const spread = t * t * 15;
      const x = legStartX + side * (-8 + spread * 0.3) + wave;
      const y = legTop + t * legLength;
      leg += ` C ${x} ${y + 3} ${x + wave * 0.2} ${y + 1} ${x - wave * 0.3} ${y - 2}`;
    }
    leg += ' Z';
    paths.push(leg);
  }

  // AMBIENT ENERGY PARTICLES
  for (let p = 0; p < 25; p++) {
    const partX = cx + (r(500 + p) - 0.5) * 180;
    const partY = baseY + r(520 + p) * 280;
    const partR = 2 + r(540 + p) * 4;
    paths.push(`M ${partX - partR} ${partY} L ${partX} ${partY - partR} L ${partX + partR} ${partY} L ${partX} ${partY + partR} Z`);
  }

  return paths;
};

// ============================================================================
// UNDEAD - Skeletal/zombie, decaying flesh, exposed bone, glowing eyes
// ============================================================================
export const generateUndeadSilhouette = (gender: Gender, seed: number): string[] => {
  const p = BODY_PARAMS[gender];
  const r = (i: number) => seededRandom(seed + i);
  const paths: string[] = [];
  
  const cx = 200, baseY = 38;
  const headW = 38 * p.jawWidth;
  const headH = 50;
  
  // SKULL - Partially exposed bone
  let skull = `M ${cx} ${baseY}`;
  // Skull dome with decay patches
  for (let i = 0; i <= 30; i++) {
    const angle = (i / 30) * Math.PI;
    const decay = (r(i) > 0.7) ? (r(i + 10) - 0.5) * 8 : 0;
    const rx = headW * (0.92 + r(i + 20) * 0.05);
    const ry = headH * 0.5;
    const x = cx + Math.sin(angle) * rx + decay;
    const y = baseY + 5 - Math.cos(angle) * ry;
    if (i === 0) skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    else skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  // Sunken temples
  skull += ` C ${cx + headW * 0.88} ${baseY + headH * 0.32} ${cx + headW * 0.92} ${baseY + headH * 0.42} ${cx + headW * 0.88} ${baseY + headH * 0.5}`;
  // Pronounced cheekbones
  skull += ` C ${cx + headW * 0.95} ${baseY + headH * 0.58} ${cx + headW * 0.9} ${baseY + headH * 0.68} ${cx + headW * 0.78} ${baseY + headH * 0.76}`;
  // Hollow cheeks
  skull += ` C ${cx + headW * 0.65} ${baseY + headH * 0.84} ${cx + headW * 0.45} ${baseY + headH * 0.9} ${cx + headW * 0.28} ${baseY + headH * 0.94}`;
  // Bony jaw
  skull += ` C ${cx + headW * 0.12} ${baseY + headH * 0.98} ${cx} ${baseY + headH * 1.0} ${cx} ${baseY + headH * 1.0}`;
  // Left side
  skull += ` C ${cx} ${baseY + headH * 1.0} ${cx - headW * 0.12} ${baseY + headH * 0.98} ${cx - headW * 0.28} ${baseY + headH * 0.94}`;
  skull += ` C ${cx - headW * 0.45} ${baseY + headH * 0.9} ${cx - headW * 0.65} ${baseY + headH * 0.84} ${cx - headW * 0.78} ${baseY + headH * 0.76}`;
  skull += ` C ${cx - headW * 0.9} ${baseY + headH * 0.68} ${cx - headW * 0.95} ${baseY + headH * 0.58} ${cx - headW * 0.88} ${baseY + headH * 0.5}`;
  skull += ` C ${cx - headW * 0.92} ${baseY + headH * 0.42} ${cx - headW * 0.88} ${baseY + headH * 0.32} ${cx - headW * 0.85} ${baseY + headH * 0.18}`;
  skull += ' Z';
  paths.push(skull);

  // EXPOSED BONE PATCHES
  for (let patch = 0; patch < 5; patch++) {
    const patchX = cx + (r(50 + patch) - 0.5) * headW * 1.4;
    const patchY = baseY + r(60 + patch) * headH * 0.6;
    const patchW = 8 + r(70 + patch) * 10;
    const patchH = 6 + r(80 + patch) * 8;
    paths.push(`M ${patchX - patchW / 2} ${patchY} C ${patchX - patchW / 2} ${patchY - patchH / 2} ${patchX + patchW / 2} ${patchY - patchH / 2} ${patchX + patchW / 2} ${patchY} C ${patchX + patchW / 2} ${patchY + patchH / 2} ${patchX - patchW / 2} ${patchY + patchH / 2} ${patchX - patchW / 2} ${patchY} Z`);
  }

  // HOLLOW EYE SOCKETS - Deep and dark
  const eyeY = baseY + headH * 0.44;
  const eyeSpacing = headW * 0.32;
  const eyeW = 12, eyeH = 10;
  
  // Right socket (deep angular)
  let rightSocket = `M ${cx + eyeSpacing - eyeW} ${eyeY - eyeH * 0.2}`;
  rightSocket += ` C ${cx + eyeSpacing - eyeW - 2} ${eyeY - eyeH} ${cx + eyeSpacing + eyeW + 2} ${eyeY - eyeH} ${cx + eyeSpacing + eyeW} ${eyeY - eyeH * 0.2}`;
  rightSocket += ` C ${cx + eyeSpacing + eyeW + 3} ${eyeY + eyeH * 0.3} ${cx + eyeSpacing + eyeW} ${eyeY + eyeH} ${cx + eyeSpacing} ${eyeY + eyeH + 2}`;
  rightSocket += ` C ${cx + eyeSpacing - eyeW} ${eyeY + eyeH} ${cx + eyeSpacing - eyeW - 3} ${eyeY + eyeH * 0.3} ${cx + eyeSpacing - eyeW} ${eyeY - eyeH * 0.2} Z`;
  paths.push(rightSocket);
  // Glowing pinpoint in socket
  paths.push(`M ${cx + eyeSpacing - 3} ${eyeY} C ${cx + eyeSpacing - 3} ${eyeY - 4} ${cx + eyeSpacing + 3} ${eyeY - 4} ${cx + eyeSpacing + 3} ${eyeY} C ${cx + eyeSpacing + 3} ${eyeY + 4} ${cx + eyeSpacing - 3} ${eyeY + 4} ${cx + eyeSpacing - 3} ${eyeY} Z`);
  
  // Left socket
  let leftSocket = `M ${cx - eyeSpacing + eyeW} ${eyeY - eyeH * 0.2}`;
  leftSocket += ` C ${cx - eyeSpacing + eyeW + 2} ${eyeY - eyeH} ${cx - eyeSpacing - eyeW - 2} ${eyeY - eyeH} ${cx - eyeSpacing - eyeW} ${eyeY - eyeH * 0.2}`;
  leftSocket += ` C ${cx - eyeSpacing - eyeW - 3} ${eyeY + eyeH * 0.3} ${cx - eyeSpacing - eyeW} ${eyeY + eyeH} ${cx - eyeSpacing} ${eyeY + eyeH + 2}`;
  leftSocket += ` C ${cx - eyeSpacing + eyeW} ${eyeY + eyeH} ${cx - eyeSpacing + eyeW + 3} ${eyeY + eyeH * 0.3} ${cx - eyeSpacing + eyeW} ${eyeY - eyeH * 0.2} Z`;
  paths.push(leftSocket);
  paths.push(`M ${cx - eyeSpacing + 3} ${eyeY} C ${cx - eyeSpacing + 3} ${eyeY - 4} ${cx - eyeSpacing - 3} ${eyeY - 4} ${cx - eyeSpacing - 3} ${eyeY} C ${cx - eyeSpacing - 3} ${eyeY + 4} ${cx - eyeSpacing + 3} ${eyeY + 4} ${cx - eyeSpacing + 3} ${eyeY} Z`);

  // NASAL CAVITY - Triangular hole
  const noseY = baseY + headH * 0.62;
  paths.push(`M ${cx} ${eyeY + 10} L ${cx + 8} ${noseY + 5} L ${cx + 6} ${noseY + 15} L ${cx} ${noseY + 18} L ${cx - 6} ${noseY + 15} L ${cx - 8} ${noseY + 5} Z`);
  // Nose bridge bone
  paths.push(`M ${cx - 3} ${eyeY + 8} L ${cx} ${eyeY + 5} L ${cx + 3} ${eyeY + 8} L ${cx + 2} ${noseY + 3} L ${cx} ${noseY + 5} L ${cx - 2} ${noseY + 3} Z`);

  // SKELETAL MOUTH - Lipless teeth showing
  const mouthY = baseY + headH * 0.82;
  // Upper jaw line
  paths.push(`M ${cx - 18} ${mouthY - 3} L ${cx - 12} ${mouthY - 5} L ${cx} ${mouthY - 6} L ${cx + 12} ${mouthY - 5} L ${cx + 18} ${mouthY - 3}`);
  // Teeth
  for (let t = -5; t <= 5; t++) {
    const toothX = cx + t * 3.2;
    const toothH = 6 + Math.abs(t) * 0.3;
    paths.push(`M ${toothX - 1.2} ${mouthY - 4} L ${toothX - 1} ${mouthY + toothH - 2} L ${toothX} ${mouthY + toothH} L ${toothX + 1} ${mouthY + toothH - 2} L ${toothX + 1.2} ${mouthY - 4} Z`);
  }
  // Lower jaw
  paths.push(`M ${cx - 16} ${mouthY + 8} L ${cx - 10} ${mouthY + 10} L ${cx} ${mouthY + 11} L ${cx + 10} ${mouthY + 10} L ${cx + 16} ${mouthY + 8}`);

  // TATTERED HAIR (sparse, stringy)
  if (gender === 'female') {
    for (let strand = 0; strand < 15; strand++) {
      const strandX = cx + (r(100 + strand) - 0.5) * headW * 2;
      const strandStartY = baseY - 5 + r(110 + strand) * 15;
      let hair = `M ${strandX} ${strandStartY}`;
      for (let seg = 0; seg < 6; seg++) {
        const segX = strandX + (r(120 + strand * 6 + seg) - 0.5) * 15;
        const segY = strandStartY + seg * 18 + r(130 + strand * 6 + seg) * 10;
        hair += ` Q ${segX + 5} ${segY - 5} ${segX} ${segY}`;
      }
      paths.push(hair);
    }
  } else {
    for (let strand = 0; strand < 8; strand++) {
      const strandX = cx + (r(100 + strand) - 0.5) * headW * 1.5;
      const strandStartY = baseY - 3 + r(110 + strand) * 10;
      let hair = `M ${strandX} ${strandStartY}`;
      for (let seg = 0; seg < 3; seg++) {
        const segX = strandX + (r(120 + strand * 3 + seg) - 0.5) * 10;
        const segY = strandStartY + seg * 12;
        hair += ` L ${segX} ${segY}`;
      }
      paths.push(hair);
    }
  }

  // EMACIATED NECK
  const neckTop = baseY + headH * 1.0;
  const neckW = 15 * p.neckWidth;
  const neckH = 28;
  
  let neck = `M ${cx - headW * 0.28} ${neckTop}`;
  // Visible tendons/vertebrae
  neck += ` C ${cx - neckW * 0.9} ${neckTop + 5} ${cx - neckW * 0.85} ${neckTop + neckH * 0.5} ${cx - neckW} ${neckTop + neckH}`;
  neck += ` L ${cx + neckW} ${neckTop + neckH}`;
  neck += ` C ${cx + neckW * 0.85} ${neckTop + neckH * 0.5} ${cx + neckW * 0.9} ${neckTop + 5} ${cx + headW * 0.28} ${neckTop} Z`;
  paths.push(neck);
  // Neck vertebrae bumps
  for (let v = 0; v < 4; v++) {
    const vY = neckTop + 5 + v * 6;
    paths.push(`M ${cx - 4} ${vY} C ${cx - 3} ${vY - 3} ${cx + 3} ${vY - 3} ${cx + 4} ${vY} C ${cx + 3} ${vY + 2} ${cx - 3} ${vY + 2} ${cx - 4} ${vY} Z`);
  }
  // Neck tendons
  paths.push(`M ${cx - 8} ${neckTop + 3} L ${cx - 10} ${neckTop + neckH - 3}`);
  paths.push(`M ${cx + 8} ${neckTop + 3} L ${cx + 10} ${neckTop + neckH - 3}`);

  // SKELETAL TORSO - Ribs visible
  const torsoTop = neckTop + neckH;
  const shoulderW = 60 * p.shoulderWidth;
  const waistW = 28 * p.waistWidth;
  const hipW = 35 * p.hipWidth;
  const torsoH = 90;

  let torso = `M ${cx - neckW} ${torsoTop}`;
  torso += ` C ${cx - shoulderW * 0.5} ${torsoTop - 3} ${cx - shoulderW * 0.8} ${torsoTop + 8} ${cx - shoulderW} ${torsoTop + 18}`;
  torso += ` C ${cx - shoulderW - 5} ${torsoTop + 26} ${cx - shoulderW - 2} ${torsoTop + 38} ${cx - shoulderW + 4} ${torsoTop + 45}`;
  // Sunken sides
  torso += ` C ${cx - waistW - 8} ${torsoTop + torsoH * 0.5} ${cx - waistW - 3} ${torsoTop + torsoH * 0.7} ${cx - waistW} ${torsoTop + torsoH * 0.82}`;
  torso += ` C ${cx - hipW + 4} ${torsoTop + torsoH * 0.92} ${cx - hipW} ${torsoTop + torsoH} ${cx - hipW + 2} ${torsoTop + torsoH + 4}`;
  torso += ` C ${cx - hipW * 0.4} ${torsoTop + torsoH + 6} ${cx} ${torsoTop + torsoH + 7} ${cx + hipW * 0.4} ${torsoTop + torsoH + 6}`;
  torso += ` C ${cx + hipW} ${torsoTop + torsoH + 4} ${cx + hipW - 4} ${torsoTop + torsoH * 0.92} ${cx + waistW} ${torsoTop + torsoH * 0.82}`;
  torso += ` C ${cx + waistW + 3} ${torsoTop + torsoH * 0.7} ${cx + waistW + 8} ${torsoTop + torsoH * 0.5} ${cx + shoulderW - 4} ${torsoTop + 45}`;
  torso += ` C ${cx + shoulderW + 2} ${torsoTop + 38} ${cx + shoulderW + 5} ${torsoTop + 26} ${cx + shoulderW} ${torsoTop + 18}`;
  torso += ` C ${cx + shoulderW * 0.8} ${torsoTop + 8} ${cx + shoulderW * 0.5} ${torsoTop - 3} ${cx + neckW} ${torsoTop} Z`;
  paths.push(torso);

  // VISIBLE RIBCAGE
  const ribStartY = torsoTop + 20;
  for (let rib = 0; rib < 8; rib++) {
    const ribY = ribStartY + rib * 8;
    const ribWidth = 35 - rib * 2;
    // Right rib
    paths.push(`M ${cx + 5} ${ribY} C ${cx + ribWidth * 0.5} ${ribY - 3} ${cx + ribWidth * 0.8} ${ribY - 1} ${cx + ribWidth} ${ribY + 2} C ${cx + ribWidth * 0.9} ${ribY + 4} ${cx + ribWidth * 0.6} ${ribY + 5} ${cx + 8} ${ribY + 3}`);
    // Left rib
    paths.push(`M ${cx - 5} ${ribY} C ${cx - ribWidth * 0.5} ${ribY - 3} ${cx - ribWidth * 0.8} ${ribY - 1} ${cx - ribWidth} ${ribY + 2} C ${cx - ribWidth * 0.9} ${ribY + 4} ${cx - ribWidth * 0.6} ${ribY + 5} ${cx - 8} ${ribY + 3}`);
  }
  // Sternum
  paths.push(`M ${cx} ${torsoTop + 15} L ${cx} ${torsoTop + 75}`);

  // Spine bumps
  for (let s = 0; s < 6; s++) {
    const spineY = torsoTop + torsoH * 0.3 + s * 12;
    paths.push(`M ${cx - 3} ${spineY} C ${cx - 2} ${spineY - 2} ${cx + 2} ${spineY - 2} ${cx + 3} ${spineY} C ${cx + 2} ${spineY + 2} ${cx - 2} ${spineY + 2} ${cx - 3} ${spineY} Z`);
  }

  // BONY ARMS
  const armStartY = torsoTop + 18;
  const upperArmL = 48;
  const forearmL = 44;
  const armW = gender === 'male' ? 8 : 6;

  // Left arm
  let leftArm = `M ${cx - shoulderW} ${armStartY}`;
  leftArm += ` C ${cx - shoulderW - 6} ${armStartY + 12} ${cx - shoulderW - 10} ${armStartY + upperArmL - 10} ${cx - shoulderW - 8} ${armStartY + upperArmL}`;
  // Visible elbow bone
  leftArm += ` L ${cx - shoulderW - 12} ${armStartY + upperArmL + 3}`;
  leftArm += ` L ${cx - shoulderW - 8} ${armStartY + upperArmL + 8}`;
  leftArm += ` C ${cx - shoulderW - 12} ${armStartY + upperArmL + 18} ${cx - shoulderW - 8} ${armStartY + upperArmL + forearmL - 10} ${cx - shoulderW - 6} ${armStartY + upperArmL + forearmL}`;
  // Skeletal hand
  leftArm += ` L ${cx - shoulderW - 8} ${armStartY + upperArmL + forearmL + 8}`;
  leftArm += ` L ${cx - shoulderW + 5} ${armStartY + upperArmL + forearmL + 25}`;
  leftArm += ` L ${cx - shoulderW + 8} ${armStartY + upperArmL + forearmL + 8}`;
  leftArm += ` C ${cx - shoulderW + armW + 3} ${armStartY + upperArmL + 22} ${cx - shoulderW + armW} ${armStartY + 15} ${cx - shoulderW + 4} ${armStartY} Z`;
  paths.push(leftArm);

  // Right arm
  let rightArm = `M ${cx + shoulderW} ${armStartY}`;
  rightArm += ` C ${cx + shoulderW + 6} ${armStartY + 12} ${cx + shoulderW + 10} ${armStartY + upperArmL - 10} ${cx + shoulderW + 8} ${armStartY + upperArmL}`;
  rightArm += ` L ${cx + shoulderW + 12} ${armStartY + upperArmL + 3}`;
  rightArm += ` L ${cx + shoulderW + 8} ${armStartY + upperArmL + 8}`;
  rightArm += ` C ${cx + shoulderW + 12} ${armStartY + upperArmL + 18} ${cx + shoulderW + 8} ${armStartY + upperArmL + forearmL - 10} ${cx + shoulderW + 6} ${armStartY + upperArmL + forearmL}`;
  rightArm += ` L ${cx + shoulderW + 8} ${armStartY + upperArmL + forearmL + 8}`;
  rightArm += ` L ${cx + shoulderW - 5} ${armStartY + upperArmL + forearmL + 25}`;
  rightArm += ` L ${cx + shoulderW - 8} ${armStartY + upperArmL + forearmL + 8}`;
  rightArm += ` C ${cx + shoulderW - armW - 3} ${armStartY + upperArmL + 22} ${cx + shoulderW - armW} ${armStartY + 15} ${cx + shoulderW - 4} ${armStartY} Z`;
  paths.push(rightArm);

  // Skeletal fingers (bone segments)
  const handY = armStartY + upperArmL + forearmL + 8;
  for (let side = -1; side <= 1; side += 2) {
    const handX = cx + side * (shoulderW - 3);
    for (let f = 0; f < 5; f++) {
      const fingerL = f === 0 ? 14 : 20 + (2 - Math.abs(f - 2)) * 4;
      const fingerX = handX + side * (f * 4 - 6);
      const fingerY = f === 0 ? handY + 5 : handY + 15;
      // Bone segments
      paths.push(`M ${fingerX - 1} ${fingerY} L ${fingerX - 0.5} ${fingerY + fingerL * 0.4} L ${fingerX + 0.5} ${fingerY + fingerL * 0.4} L ${fingerX + 1} ${fingerY} Z`);
      paths.push(`M ${fingerX - 0.8} ${fingerY + fingerL * 0.42} L ${fingerX - 0.3} ${fingerY + fingerL * 0.75} L ${fingerX + 0.3} ${fingerY + fingerL * 0.75} L ${fingerX + 0.8} ${fingerY + fingerL * 0.42} Z`);
      paths.push(`M ${fingerX - 0.5} ${fingerY + fingerL * 0.77} L ${fingerX} ${fingerY + fingerL} L ${fingerX + 0.5} ${fingerY + fingerL * 0.77} Z`);
    }
  }

  // EMACIATED LEGS
  const legTop = torsoTop + torsoH + 5;
  const thighL = 55;
  const calfL = 52;
  const legW = gender === 'male' ? 12 : 10;

  // Left leg
  let leftLeg = `M ${cx - hipW * 0.12} ${legTop}`;
  leftLeg += ` C ${cx - hipW * 0.32} ${legTop + 6} ${cx - hipW * 0.45} ${legTop + 15} ${cx - legW - 5} ${legTop + thighL * 0.5}`;
  leftLeg += ` C ${cx - legW - 8} ${legTop + thighL * 0.78} ${cx - legW - 6} ${legTop + thighL} ${cx - legW - 4} ${legTop + thighL + 5}`;
  // Visible knee cap
  leftLeg += ` L ${cx - legW - 8} ${legTop + thighL + 8}`;
  leftLeg += ` L ${cx - legW - 5} ${legTop + thighL + 15}`;
  leftLeg += ` C ${cx - legW - 7} ${legTop + thighL + 25} ${cx - legW - 4} ${legTop + thighL + calfL - 10} ${cx - legW - 2} ${legTop + thighL + calfL}`;
  // Bony foot
  leftLeg += ` L ${cx - legW - 5} ${legTop + thighL + calfL + 8}`;
  leftLeg += ` L ${cx - 35} ${legTop + thighL + calfL + 15}`;
  leftLeg += ` L ${cx - 38} ${legTop + thighL + calfL + 25}`;
  leftLeg += ` L ${cx - 8} ${legTop + thighL + calfL + 25}`;
  leftLeg += ` L ${cx - 6} ${legTop + thighL + calfL + 5}`;
  leftLeg += ` C ${cx - 5} ${legTop + thighL + 18} ${cx - 8} ${legTop + 15} ${cx - hipW * 0.12} ${legTop} Z`;
  paths.push(leftLeg);

  // Right leg
  let rightLeg = `M ${cx + hipW * 0.12} ${legTop}`;
  rightLeg += ` C ${cx + hipW * 0.32} ${legTop + 6} ${cx + hipW * 0.45} ${legTop + 15} ${cx + legW + 5} ${legTop + thighL * 0.5}`;
  rightLeg += ` C ${cx + legW + 8} ${legTop + thighL * 0.78} ${cx + legW + 6} ${legTop + thighL} ${cx + legW + 4} ${legTop + thighL + 5}`;
  rightLeg += ` L ${cx + legW + 8} ${legTop + thighL + 8}`;
  rightLeg += ` L ${cx + legW + 5} ${legTop + thighL + 15}`;
  rightLeg += ` C ${cx + legW + 7} ${legTop + thighL + 25} ${cx + legW + 4} ${legTop + thighL + calfL - 10} ${cx + legW + 2} ${legTop + thighL + calfL}`;
  rightLeg += ` L ${cx + legW + 5} ${legTop + thighL + calfL + 8}`;
  rightLeg += ` L ${cx + 35} ${legTop + thighL + calfL + 15}`;
  rightLeg += ` L ${cx + 38} ${legTop + thighL + calfL + 25}`;
  rightLeg += ` L ${cx + 8} ${legTop + thighL + calfL + 25}`;
  rightLeg += ` L ${cx + 6} ${legTop + thighL + calfL + 5}`;
  rightLeg += ` C ${cx + 5} ${legTop + thighL + 18} ${cx + 8} ${legTop + 15} ${cx + hipW * 0.12} ${legTop} Z`;
  paths.push(rightLeg);

  // TATTERED CLOTH remnants
  for (let tatter = 0; tatter < 6; tatter++) {
    const tattX = cx + (r(500 + tatter) - 0.5) * 80;
    const tattY = torsoTop + 50 + r(510 + tatter) * 60;
    const tattLen = 15 + r(520 + tatter) * 25;
    let cloth = `M ${tattX} ${tattY}`;
    for (let seg = 0; seg < 4; seg++) {
      const wave = (r(530 + tatter * 4 + seg) - 0.5) * 10;
      cloth += ` L ${tattX + wave} ${tattY + seg * tattLen / 3}`;
    }
    paths.push(cloth);
  }

  return paths;
};

// ============================================================================
// COMPONENT EXPORTS
// ============================================================================
interface AvatarSilhouetteProps {
  race: 'golem' | 'elemental' | 'undead';
  gender: Gender;
  seed: number;
  size?: number;
  fillColor?: string;
  strokeColor?: string;
}

export const AvatarSilhouette: React.FC<AvatarSilhouetteProps> = ({
  race,
  gender,
  seed,
  size = 400,
  fillColor = '#1a1a2e',
  strokeColor = '#8b5cf6',
}) => {
  const generators: Record<string, (g: Gender, s: number) => string[]> = {
    golem: generateGolemSilhouette,
    elemental: generateElementalSilhouette,
    undead: generateUndeadSilhouette,
  };
  
  const paths = generators[race]?.(gender, seed) || [];
  
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
