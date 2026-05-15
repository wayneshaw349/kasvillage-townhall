// KasVillage Identity Ritual - Elf, Dark Elf, Dwarf, Alien Silhouettes
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
// ELF - Graceful, pointed ears, angular features, ethereal beauty
// ============================================================================
export const generateElfSilhouette = (gender: Gender, seed: number): string[] => {
  const p = BODY_PARAMS[gender];
  const r = (i: number) => seededRandom(seed + i);
  const paths: string[] = [];
  
  const cx = 200, baseY = 42;
  const headW = 34 * p.jawWidth;
  const headH = 48;
  
  // ELEGANT SKULL - High cheekbones, refined features
  let skull = `M ${cx} ${baseY}`;
  // Smooth elegant cranium
  for (let i = 0; i <= 35; i++) {
    const angle = (i / 35) * Math.PI;
    const subtle = Math.sin(i * 0.3) * 0.8;
    const rx = headW * (0.96 + r(i) * 0.02);
    const ry = headH * 0.54;
    const x = cx + Math.sin(angle) * rx;
    const y = baseY + 3 - Math.cos(angle) * ry + subtle;
    skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  // High elegant temples
  skull += ` C ${cx + headW * 0.94} ${baseY + headH * 0.28} ${cx + headW * 0.98} ${baseY + headH * 0.38} ${cx + headW * 0.96} ${baseY + headH * 0.46}`;
  // High sharp cheekbones - elven hallmark
  skull += ` C ${cx + headW * 1.02} ${baseY + headH * 0.52} ${cx + headW * 1.0} ${baseY + headH * 0.62} ${cx + headW * 0.88} ${baseY + headH * 0.72}`;
  // Refined angular jaw tapering to delicate chin
  skull += ` C ${cx + headW * 0.72} ${baseY + headH * 0.84} ${cx + headW * 0.48} ${baseY + headH * 0.94} ${cx + headW * 0.22} ${baseY + headH * 0.99}`;
  skull += ` C ${cx + headW * 0.08} ${baseY + headH * 1.02} ${cx} ${baseY + headH * 1.04} ${cx} ${baseY + headH * 1.04}`;
  // Left side mirror
  skull += ` C ${cx} ${baseY + headH * 1.04} ${cx - headW * 0.08} ${baseY + headH * 1.02} ${cx - headW * 0.22} ${baseY + headH * 0.99}`;
  skull += ` C ${cx - headW * 0.48} ${baseY + headH * 0.94} ${cx - headW * 0.72} ${baseY + headH * 0.84} ${cx - headW * 0.88} ${baseY + headH * 0.72}`;
  skull += ` C ${cx - headW * 1.0} ${baseY + headH * 0.62} ${cx - headW * 1.02} ${baseY + headH * 0.52} ${cx - headW * 0.96} ${baseY + headH * 0.46}`;
  skull += ` C ${cx - headW * 0.98} ${baseY + headH * 0.38} ${cx - headW * 0.94} ${baseY + headH * 0.28} ${cx - headW * 0.92} ${baseY + headH * 0.12}`;
  skull += ' Z';
  paths.push(skull);

  // ELEGANT FLOWING HAIR
  let hair = `M ${cx} ${baseY - 8}`;
  const hairVolume = gender === 'female' ? 1.25 : 1.1;
  // Smooth flowing crown
  for (let i = 0; i <= 40; i++) {
    const angle = (i / 40) * Math.PI;
    const flow = Math.sin(i * 0.2) * 3;
    const x = cx + Math.sin(angle) * headW * hairVolume + flow;
    const y = baseY - 12 - Math.cos(angle) * headH * 0.55 + r(i + 100) * 2;
    hair += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  
  if (gender === 'female') {
    // Long flowing elven hair
    const hairLength = 140 + r(200) * 50;
    hair += ` C ${cx + headW * 1.3} ${baseY + headH * 0.5} ${cx + headW * 1.25} ${baseY + headH + hairLength * 0.35} ${cx + headW * 1.0} ${baseY + headH + hairLength * 0.7}`;
    // Flowing strands
    for (let i = 0; i < 15; i++) {
      const wave = Math.sin(i * 0.5) * 12;
      hair += ` L ${cx + headW * (0.9 - i * 0.11) + wave} ${baseY + headH + hairLength * 0.7 + i * 6 + r(i + 300) * 4}`;
    }
    hair += ` L ${cx - headW * 1.0} ${baseY + headH + hairLength * 0.7}`;
    hair += ` C ${cx - headW * 1.25} ${baseY + headH + hairLength * 0.35} ${cx - headW * 1.3} ${baseY + headH * 0.5} ${cx - headW * hairVolume} ${baseY - 10}`;
  } else {
    // Male elven hair - shorter but still elegant
    hair += ` C ${cx + headW * 1.15} ${baseY + headH * 0.3} ${cx + headW * 1.1} ${baseY + headH * 0.55} ${cx + headW * 0.95} ${baseY + headH * 0.5}`;
    hair += ` L ${cx - headW * 0.95} ${baseY + headH * 0.5}`;
    hair += ` C ${cx - headW * 1.1} ${baseY + headH * 0.55} ${cx - headW * 1.15} ${baseY + headH * 0.3} ${cx - headW * hairVolume} ${baseY - 10}`;
  }
  hair += ' Z';
  paths.push(hair);
  
  // Hair detail strands
  for (let i = 0; i < 25; i++) {
    const startX = cx + (r(i + 400) - 0.5) * headW * 1.8;
    const startY = baseY - 5 + r(i + 450) * headH * 0.3;
    const len = 15 + r(i + 500) * 20;
    paths.push(`M ${startX} ${startY} Q ${startX + (r(i + 550) - 0.5) * 8} ${startY + len * 0.5} ${startX + (r(i + 600) - 0.5) * 6} ${startY + len}`);
  }

  // POINTED EARS - Signature elven feature
  const earY = baseY + headH * 0.28;
  const earLength = 42 + r(700) * 12;
  const earWidth = 12;
  
  // Right ear - long, elegantly pointed
  let rightEar = `M ${cx + headW * 0.94} ${earY + 10}`;
  rightEar += ` C ${cx + headW * 0.98 + 5} ${earY + 5} ${cx + headW + earWidth * 0.8} ${earY - 5} ${cx + headW + earWidth} ${earY - earLength * 0.3}`;
  rightEar += ` C ${cx + headW + earWidth * 1.1} ${earY - earLength * 0.55} ${cx + headW + earWidth * 0.9} ${earY - earLength * 0.85} ${cx + headW + earWidth * 0.5} ${earY - earLength}`;
  // Pointed tip
  rightEar += ` C ${cx + headW + earWidth * 0.3} ${earY - earLength - 5} ${cx + headW + earWidth * 0.1} ${earY - earLength + 3} ${cx + headW - 2} ${earY - earLength * 0.7}`;
  // Inner curve back
  rightEar += ` C ${cx + headW - 5} ${earY - earLength * 0.4} ${cx + headW * 0.96 - 3} ${earY - earLength * 0.15} ${cx + headW * 0.95} ${earY}`;
  rightEar += ` C ${cx + headW * 0.94} ${earY + 5} ${cx + headW * 0.94} ${earY + 8} ${cx + headW * 0.94} ${earY + 10}`;
  rightEar += ' Z';
  paths.push(rightEar);
  
  // Right ear inner detail
  paths.push(`M ${cx + headW * 0.96} ${earY + 2} C ${cx + headW + 3} ${earY - 8} ${cx + headW + 6} ${earY - earLength * 0.4} ${cx + headW + earWidth * 0.4} ${earY - earLength * 0.75}`);
  paths.push(`M ${cx + headW * 0.97} ${earY - 2} C ${cx + headW + 2} ${earY - 12} ${cx + headW + 4} ${earY - earLength * 0.35} ${cx + headW + earWidth * 0.3} ${earY - earLength * 0.6}`);
  
  // Left ear (mirror)
  let leftEar = `M ${cx - headW * 0.94} ${earY + 10}`;
  leftEar += ` C ${cx - headW * 0.98 - 5} ${earY + 5} ${cx - headW - earWidth * 0.8} ${earY - 5} ${cx - headW - earWidth} ${earY - earLength * 0.3}`;
  leftEar += ` C ${cx - headW - earWidth * 1.1} ${earY - earLength * 0.55} ${cx - headW - earWidth * 0.9} ${earY - earLength * 0.85} ${cx - headW - earWidth * 0.5} ${earY - earLength}`;
  leftEar += ` C ${cx - headW - earWidth * 0.3} ${earY - earLength - 5} ${cx - headW - earWidth * 0.1} ${earY - earLength + 3} ${cx - headW + 2} ${earY - earLength * 0.7}`;
  leftEar += ` C ${cx - headW + 5} ${earY - earLength * 0.4} ${cx - headW * 0.96 + 3} ${earY - earLength * 0.15} ${cx - headW * 0.95} ${earY}`;
  leftEar += ` C ${cx - headW * 0.94} ${earY + 5} ${cx - headW * 0.94} ${earY + 8} ${cx - headW * 0.94} ${earY + 10}`;
  leftEar += ' Z';
  paths.push(leftEar);
  
  paths.push(`M ${cx - headW * 0.96} ${earY + 2} C ${cx - headW - 3} ${earY - 8} ${cx - headW - 6} ${earY - earLength * 0.4} ${cx - headW - earWidth * 0.4} ${earY - earLength * 0.75}`);
  paths.push(`M ${cx - headW * 0.97} ${earY - 2} C ${cx - headW - 2} ${earY - 12} ${cx - headW - 4} ${earY - earLength * 0.35} ${cx - headW - earWidth * 0.3} ${earY - earLength * 0.6}`);

  // ALMOND-SHAPED EYES - Large, luminous
  const eyeY = baseY + headH * 0.42;
  const eyeSpacing = headW * 0.32;
  const eyeW = 12, eyeH = 6;
  
  for (let side = -1; side <= 1; side += 2) {
    const eyeX = cx + side * eyeSpacing;
    // Eye outline - almond shape with slight uptilt
    paths.push(`M ${eyeX - eyeW} ${eyeY + 1} C ${eyeX - eyeW * 0.7} ${eyeY - eyeH - 1} ${eyeX + eyeW * 0.7} ${eyeY - eyeH - 2} ${eyeX + eyeW} ${eyeY - 1} C ${eyeX + eyeW * 0.7} ${eyeY + eyeH * 0.5} ${eyeX - eyeW * 0.7} ${eyeY + eyeH * 0.6} ${eyeX - eyeW} ${eyeY + 1} Z`);
    // Iris - large
    const irisR = 5;
    paths.push(`M ${eyeX - irisR} ${eyeY - 1} C ${eyeX - irisR} ${eyeY - irisR - 1} ${eyeX + irisR} ${eyeY - irisR - 1} ${eyeX + irisR} ${eyeY - 1} C ${eyeX + irisR} ${eyeY + irisR - 1} ${eyeX - irisR} ${eyeY + irisR - 1} ${eyeX - irisR} ${eyeY - 1} Z`);
    // Pupil
    paths.push(`M ${eyeX - 2} ${eyeY - 1} C ${eyeX - 2} ${eyeY - 3} ${eyeX + 2} ${eyeY - 3} ${eyeX + 2} ${eyeY - 1} C ${eyeX + 2} ${eyeY + 1} ${eyeX - 2} ${eyeY + 1} ${eyeX - 2} ${eyeY - 1} Z`);
    // Eye shine
    paths.push(`M ${eyeX - 3} ${eyeY - 3} C ${eyeX - 3} ${eyeY - 4.5} ${eyeX - 1} ${eyeY - 4.5} ${eyeX - 1} ${eyeY - 3}`);
  }
  
  // Elegant arched brows
  const browY = eyeY - eyeH - 6;
  paths.push(`M ${cx + eyeSpacing - eyeW - 2} ${browY + 4} Q ${cx + eyeSpacing} ${browY - 5} ${cx + eyeSpacing + eyeW + 4} ${browY + 1}`);
  paths.push(`M ${cx - eyeSpacing + eyeW + 2} ${browY + 4} Q ${cx - eyeSpacing} ${browY - 5} ${cx - eyeSpacing - eyeW - 4} ${browY + 1}`);

  // Refined nose
  const noseY = baseY + headH * 0.68;
  paths.push(`M ${cx} ${eyeY + 8} C ${cx + 1.5} ${noseY - 10} ${cx + 4} ${noseY - 3} ${cx + 4.5} ${noseY} C ${cx + 5} ${noseY + 3} ${cx + 2} ${noseY + 5} ${cx} ${noseY + 4} C ${cx - 2} ${noseY + 5} ${cx - 5} ${noseY + 3} ${cx - 4.5} ${noseY} C ${cx - 4} ${noseY - 3} ${cx - 1.5} ${noseY - 10} ${cx} ${eyeY + 8} Z`);
  // Nose bridge highlight
  paths.push(`M ${cx} ${eyeY + 10} L ${cx} ${noseY - 2}`);

  // Elegant lips
  const lipY = baseY + headH * 0.85;
  const lipW = 9;
  // Upper lip with cupid's bow
  paths.push(`M ${cx - lipW} ${lipY} C ${cx - lipW * 0.6} ${lipY - 2} ${cx - 2} ${lipY - 3.5} ${cx} ${lipY - 2.5} C ${cx + 2} ${lipY - 3.5} ${cx + lipW * 0.6} ${lipY - 2} ${cx + lipW} ${lipY} C ${cx + lipW * 0.5} ${lipY + 0.5} ${cx} ${lipY} ${cx - lipW * 0.5} ${lipY + 0.5} Z`);
  // Lower lip
  paths.push(`M ${cx - lipW + 1} ${lipY + 1} C ${cx} ${lipY + 0.5} ${cx + lipW - 1} ${lipY + 1} ${cx + lipW - 1.5} ${lipY + 4} C ${cx} ${lipY + 6} ${cx - lipW + 1.5} ${lipY + 4} ${cx - lipW + 1} ${lipY + 1} Z`);

  // NECK - Slender, graceful
  const neckTop = baseY + headH * 1.02;
  const neckW = 14 * p.neckWidth;
  const neckH = 28;
  paths.push(`M ${cx - neckW} ${neckTop} C ${cx - neckW - 2} ${neckTop + neckH * 0.4} ${cx - neckW - 3} ${neckTop + neckH * 0.7} ${cx - neckW - 5} ${neckTop + neckH} L ${cx + neckW + 5} ${neckTop + neckH} C ${cx + neckW + 3} ${neckTop + neckH * 0.7} ${cx + neckW + 2} ${neckTop + neckH * 0.4} ${cx + neckW} ${neckTop} Z`);
  // Neck muscle suggestion
  paths.push(`M ${cx - 5} ${neckTop + 5} C ${cx - 6} ${neckTop + 12} ${cx - 7} ${neckTop + 20} ${cx - 8} ${neckTop + neckH}`);
  paths.push(`M ${cx + 5} ${neckTop + 5} C ${cx + 6} ${neckTop + 12} ${cx + 7} ${neckTop + 20} ${cx + 8} ${neckTop + neckH}`);

  // TORSO - Slender, graceful build
  const torsoTop = neckTop + neckH;
  const shoulderW = 68 * p.shoulderWidth;
  const waistW = 32 * p.waistWidth;
  const hipW = 42 * p.hipWidth;
  const torsoH = 105;
  
  let torso = `M ${cx - neckW - 5} ${torsoTop}`;
  // Shoulders - elegant slope
  torso += ` C ${cx - shoulderW * 0.5} ${torsoTop + 5} ${cx - shoulderW * 0.85} ${torsoTop + 12} ${cx - shoulderW} ${torsoTop + 22}`;
  // Side to waist
  torso += ` C ${cx - shoulderW + 3} ${torsoTop + 45} ${cx - waistW - 8} ${torsoTop + torsoH * 0.55} ${cx - waistW} ${torsoTop + torsoH * 0.62}`;
  // Waist to hip
  torso += ` C ${cx - waistW - 2} ${torsoTop + torsoH * 0.72} ${cx - hipW + 5} ${torsoTop + torsoH * 0.88} ${cx - hipW} ${torsoTop + torsoH}`;
  // Bottom
  torso += ` L ${cx + hipW} ${torsoTop + torsoH}`;
  // Right side (mirror)
  torso += ` C ${cx + hipW - 5} ${torsoTop + torsoH * 0.88} ${cx + waistW + 2} ${torsoTop + torsoH * 0.72} ${cx + waistW} ${torsoTop + torsoH * 0.62}`;
  torso += ` C ${cx + waistW + 8} ${torsoTop + torsoH * 0.55} ${cx + shoulderW - 3} ${torsoTop + 45} ${cx + shoulderW} ${torsoTop + 22}`;
  torso += ` C ${cx + shoulderW * 0.85} ${torsoTop + 12} ${cx + shoulderW * 0.5} ${torsoTop + 5} ${cx + neckW + 5} ${torsoTop}`;
  torso += ' Z';
  paths.push(torso);
  
  // Chest definition
  if (gender === 'female') {
    paths.push(`M ${cx - 25} ${torsoTop + 25} C ${cx - 30} ${torsoTop + 35} ${cx - 28} ${torsoTop + 48} ${cx - 18} ${torsoTop + 52}`);
    paths.push(`M ${cx + 25} ${torsoTop + 25} C ${cx + 30} ${torsoTop + 35} ${cx + 28} ${torsoTop + 48} ${cx + 18} ${torsoTop + 52}`);
  } else {
    paths.push(`M ${cx - 20} ${torsoTop + 22} C ${cx - 28} ${torsoTop + 30} ${cx - 25} ${torsoTop + 42} ${cx - 12} ${torsoTop + 45}`);
    paths.push(`M ${cx + 20} ${torsoTop + 22} C ${cx + 28} ${torsoTop + 30} ${cx + 25} ${torsoTop + 42} ${cx + 12} ${torsoTop + 45}`);
  }
  // Center line
  paths.push(`M ${cx} ${torsoTop + 18} L ${cx} ${torsoTop + torsoH - 5}`);
  // Waist definition
  paths.push(`M ${cx - waistW + 5} ${torsoTop + torsoH * 0.6} Q ${cx} ${torsoTop + torsoH * 0.58} ${cx + waistW - 5} ${torsoTop + torsoH * 0.6}`);

  // ARMS - Slender, graceful
  for (let side = -1; side <= 1; side += 2) {
    const shoulderX = cx + side * shoulderW;
    const armW = 8;
    // Upper arm
    paths.push(`M ${shoulderX} ${torsoTop + 20} C ${shoulderX + side * 5} ${torsoTop + 45} ${shoulderX + side * 8} ${torsoTop + 70} ${shoulderX + side * 6} ${torsoTop + 95} L ${shoulderX - side * 2} ${torsoTop + 95} C ${shoulderX - side * 5} ${torsoTop + 70} ${shoulderX - side * 8} ${torsoTop + 45} ${shoulderX - side * 10} ${torsoTop + 22} Z`);
    
    // Forearm
    const elbowY = torsoTop + 95;
    paths.push(`M ${shoulderX + side * 6} ${elbowY} C ${shoulderX + side * 10} ${elbowY + 25} ${shoulderX + side * 12} ${elbowY + 55} ${shoulderX + side * 10} ${elbowY + 80} L ${shoulderX - side * 2} ${elbowY + 82} C ${shoulderX - side * 4} ${elbowY + 55} ${shoulderX - side * 2} ${elbowY + 25} ${shoulderX - side * 2} ${elbowY} Z`);
    
    // Hand - elegant long fingers
    const handY = elbowY + 80;
    const handX = shoulderX + side * 5;
    paths.push(`M ${handX - side * 8} ${handY} C ${handX - side * 10} ${handY + 12} ${handX - side * 8} ${handY + 28} ${handX - side * 5} ${handY + 35} L ${handX + side * 8} ${handY + 35} C ${handX + side * 10} ${handY + 28} ${handX + side * 8} ${handY + 12} ${handX + side * 5} ${handY} Z`);
    // Fingers
    for (let f = 0; f < 4; f++) {
      const fx = handX - side * 4 + f * side * 4;
      const fLen = 22 + (f === 1 ? 4 : f === 2 ? 2 : 0);
      paths.push(`M ${fx - 1.5} ${handY + 34} L ${fx - 1} ${handY + 34 + fLen} L ${fx + 1} ${handY + 34 + fLen} L ${fx + 1.5} ${handY + 34} Z`);
    }
    // Thumb
    paths.push(`M ${handX - side * 7} ${handY + 8} C ${handX - side * 14} ${handY + 12} ${handX - side * 16} ${handY + 22} ${handX - side * 14} ${handY + 28} L ${handX - side * 10} ${handY + 26} C ${handX - side * 10} ${handY + 18} ${handX - side * 9} ${handY + 12} ${handX - side * 7} ${handY + 8} Z`);
  }

  // LEGS - Long, slender
  const legTop = torsoTop + torsoH;
  for (let side = -1; side <= 1; side += 2) {
    const legX = cx + side * hipW * 0.5;
    // Thigh
    paths.push(`M ${legX - 12} ${legTop} C ${legX - 14} ${legTop + 35} ${legX - 12} ${legTop + 70} ${legX - 10} ${legTop + 95} L ${legX + 10} ${legTop + 95} C ${legX + 12} ${legTop + 70} ${legX + 14} ${legTop + 35} ${legX + 12} ${legTop} Z`);
    // Lower leg
    paths.push(`M ${legX - 10} ${legTop + 95} C ${legX - 9} ${legTop + 130} ${legX - 8} ${legTop + 165} ${legX - 7} ${legTop + 195} L ${legX + 7} ${legTop + 195} C ${legX + 8} ${legTop + 165} ${legX + 9} ${legTop + 130} ${legX + 10} ${legTop + 95} Z`);
    // Foot
    paths.push(`M ${legX - 7} ${legTop + 195} C ${legX - 8} ${legTop + 202} ${legX - 10} ${legTop + 208} ${legX - 12} ${legTop + 210} L ${legX + 8} ${legTop + 210} C ${legX + 10} ${legTop + 205} ${legX + 8} ${legTop + 198} ${legX + 7} ${legTop + 195} Z`);
  }

  return paths;
};

// ============================================================================
// DARK ELF - Similar to elf but with more angular, sinister features
// ============================================================================
export const generateDarkElfSilhouette = (gender: Gender, seed: number): string[] => {
  const p = BODY_PARAMS[gender];
  const r = (i: number) => seededRandom(seed + i);
  const paths: string[] = [];
  
  const cx = 200, baseY = 42;
  const headW = 35 * p.jawWidth;
  const headH = 49;
  
  // ANGULAR SKULL - Sharper, more severe features than high elf
  let skull = `M ${cx} ${baseY}`;
  for (let i = 0; i <= 32; i++) {
    const angle = (i / 32) * Math.PI;
    const angular = Math.sin(i * 0.4) * 1.2;
    const rx = headW * (0.94 + r(i) * 0.03);
    const ry = headH * 0.52;
    const x = cx + Math.sin(angle) * rx;
    const y = baseY + 4 - Math.cos(angle) * ry + angular;
    skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  // Very sharp temples
  skull += ` C ${cx + headW * 0.92} ${baseY + headH * 0.26} ${cx + headW * 0.98} ${baseY + headH * 0.36} ${cx + headW * 0.95} ${baseY + headH * 0.44}`;
  // Severe cheekbones
  skull += ` C ${cx + headW * 1.04} ${baseY + headH * 0.5} ${cx + headW * 1.02} ${baseY + headH * 0.6} ${cx + headW * 0.9} ${baseY + headH * 0.7}`;
  // Sharp angular jaw
  skull += ` C ${cx + headW * 0.75} ${baseY + headH * 0.82} ${cx + headW * 0.5} ${baseY + headH * 0.92} ${cx + headW * 0.25} ${baseY + headH * 0.98}`;
  skull += ` L ${cx} ${baseY + headH * 1.05}`;
  // Left side mirror
  skull += ` L ${cx - headW * 0.25} ${baseY + headH * 0.98}`;
  skull += ` C ${cx - headW * 0.5} ${baseY + headH * 0.92} ${cx - headW * 0.75} ${baseY + headH * 0.82} ${cx - headW * 0.9} ${baseY + headH * 0.7}`;
  skull += ` C ${cx - headW * 1.02} ${baseY + headH * 0.6} ${cx - headW * 1.04} ${baseY + headH * 0.5} ${cx - headW * 0.95} ${baseY + headH * 0.44}`;
  skull += ` C ${cx - headW * 0.98} ${baseY + headH * 0.36} ${cx - headW * 0.92} ${baseY + headH * 0.26} ${cx - headW * 0.9} ${baseY + headH * 0.1}`;
  skull += ' Z';
  paths.push(skull);

  // WILD/SWEPT BACK HAIR
  let hair = `M ${cx} ${baseY - 10}`;
  const hairVolume = gender === 'female' ? 1.3 : 1.15;
  // Swept back dramatic crown
  for (let i = 0; i <= 38; i++) {
    const angle = (i / 38) * Math.PI;
    const spike = (r(i + 100) - 0.5) * 8;
    const x = cx + Math.sin(angle) * headW * hairVolume + spike;
    const y = baseY - 15 - Math.cos(angle) * headH * 0.58 + r(i + 150) * 3;
    hair += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  
  if (gender === 'female') {
    const hairLength = 130 + r(200) * 40;
    hair += ` C ${cx + headW * 1.35} ${baseY + headH * 0.4} ${cx + headW * 1.3} ${baseY + headH + hairLength * 0.3} ${cx + headW * 1.1} ${baseY + headH + hairLength * 0.65}`;
    // Wild strands
    for (let i = 0; i < 12; i++) {
      const spike = (r(i + 300) - 0.5) * 18;
      hair += ` L ${cx + headW * (0.95 - i * 0.14) + spike} ${baseY + headH + hairLength * 0.65 + i * 7 + r(i + 350) * 5}`;
    }
    hair += ` L ${cx - headW * 1.1} ${baseY + headH + hairLength * 0.65}`;
    hair += ` C ${cx - headW * 1.3} ${baseY + headH + hairLength * 0.3} ${cx - headW * 1.35} ${baseY + headH * 0.4} ${cx - headW * hairVolume} ${baseY - 12}`;
  } else {
    hair += ` C ${cx + headW * 1.2} ${baseY + headH * 0.25} ${cx + headW * 1.15} ${baseY + headH * 0.5} ${cx + headW} ${baseY + headH * 0.45}`;
    hair += ` L ${cx - headW} ${baseY + headH * 0.45}`;
    hair += ` C ${cx - headW * 1.15} ${baseY + headH * 0.5} ${cx - headW * 1.2} ${baseY + headH * 0.25} ${cx - headW * hairVolume} ${baseY - 12}`;
  }
  hair += ' Z';
  paths.push(hair);

  // POINTED EARS - Longer, more dramatic than high elf
  const earY = baseY + headH * 0.26;
  const earLength = 52 + r(700) * 15;
  const earWidth = 14;
  
  // Right ear
  let rightEar = `M ${cx + headW * 0.93} ${earY + 12}`;
  rightEar += ` C ${cx + headW + 6} ${earY + 3} ${cx + headW + earWidth} ${earY - 10} ${cx + headW + earWidth * 1.1} ${earY - earLength * 0.35}`;
  rightEar += ` C ${cx + headW + earWidth * 1.2} ${earY - earLength * 0.6} ${cx + headW + earWidth} ${earY - earLength * 0.88} ${cx + headW + earWidth * 0.6} ${earY - earLength}`;
  // Very sharp tip
  rightEar += ` L ${cx + headW + earWidth * 0.4} ${earY - earLength - 8}`;
  rightEar += ` C ${cx + headW + earWidth * 0.2} ${earY - earLength + 5} ${cx + headW - 3} ${earY - earLength * 0.65} ${cx + headW - 5} ${earY - earLength * 0.35}`;
  rightEar += ` C ${cx + headW * 0.95 - 3} ${earY - earLength * 0.1} ${cx + headW * 0.94} ${earY + 5} ${cx + headW * 0.93} ${earY + 12}`;
  rightEar += ' Z';
  paths.push(rightEar);
  
  // Left ear (mirror)
  let leftEar = `M ${cx - headW * 0.93} ${earY + 12}`;
  leftEar += ` C ${cx - headW - 6} ${earY + 3} ${cx - headW - earWidth} ${earY - 10} ${cx - headW - earWidth * 1.1} ${earY - earLength * 0.35}`;
  leftEar += ` C ${cx - headW - earWidth * 1.2} ${earY - earLength * 0.6} ${cx - headW - earWidth} ${earY - earLength * 0.88} ${cx - headW - earWidth * 0.6} ${earY - earLength}`;
  leftEar += ` L ${cx - headW - earWidth * 0.4} ${earY - earLength - 8}`;
  leftEar += ` C ${cx - headW - earWidth * 0.2} ${earY - earLength + 5} ${cx - headW + 3} ${earY - earLength * 0.65} ${cx - headW + 5} ${earY - earLength * 0.35}`;
  leftEar += ` C ${cx - headW * 0.95 + 3} ${earY - earLength * 0.1} ${cx - headW * 0.94} ${earY + 5} ${cx - headW * 0.93} ${earY + 12}`;
  leftEar += ' Z';
  paths.push(leftEar);

  // NARROWED EYES - More severe, predatory
  const eyeY = baseY + headH * 0.43;
  const eyeSpacing = headW * 0.34;
  const eyeW = 13, eyeH = 5;
  
  for (let side = -1; side <= 1; side += 2) {
    const eyeX = cx + side * eyeSpacing;
    // Narrow slanted eyes
    paths.push(`M ${eyeX - eyeW} ${eyeY + 2} C ${eyeX - eyeW * 0.6} ${eyeY - eyeH - 2} ${eyeX + eyeW * 0.6} ${eyeY - eyeH - 3} ${eyeX + eyeW} ${eyeY - 2} C ${eyeX + eyeW * 0.6} ${eyeY + eyeH * 0.3} ${eyeX - eyeW * 0.6} ${eyeY + eyeH * 0.4} ${eyeX - eyeW} ${eyeY + 2} Z`);
    // Iris
    paths.push(`M ${eyeX - 4} ${eyeY - 1} C ${eyeX - 4} ${eyeY - 5} ${eyeX + 4} ${eyeY - 5} ${eyeX + 4} ${eyeY - 1} C ${eyeX + 4} ${eyeY + 3} ${eyeX - 4} ${eyeY + 3} ${eyeX - 4} ${eyeY - 1} Z`);
    // Slit pupil
    paths.push(`M ${eyeX - 1} ${eyeY - 3} L ${eyeX + 1} ${eyeY - 3} L ${eyeX + 1} ${eyeY + 2} L ${eyeX - 1} ${eyeY + 2} Z`);
  }
  
  // Sharp angled brows
  const browY = eyeY - eyeH - 7;
  paths.push(`M ${cx + eyeSpacing - eyeW} ${browY + 5} L ${cx + eyeSpacing + eyeW + 5} ${browY - 3}`);
  paths.push(`M ${cx - eyeSpacing + eyeW} ${browY + 5} L ${cx - eyeSpacing - eyeW - 5} ${browY - 3}`);

  // Sharp nose
  const noseY = baseY + headH * 0.7;
  paths.push(`M ${cx} ${eyeY + 8} L ${cx + 3} ${noseY - 5} L ${cx + 5} ${noseY + 2} L ${cx} ${noseY + 5} L ${cx - 5} ${noseY + 2} L ${cx - 3} ${noseY - 5} Z`);

  // Thin cruel lips
  const lipY = baseY + headH * 0.88;
  const lipW = 8;
  paths.push(`M ${cx - lipW} ${lipY} C ${cx - lipW * 0.5} ${lipY - 1.5} ${cx} ${lipY - 2} ${cx + lipW * 0.5} ${lipY - 1.5} L ${cx + lipW} ${lipY} C ${cx + lipW * 0.5} ${lipY + 0.5} ${cx - lipW * 0.5} ${lipY + 0.5} ${cx - lipW} ${lipY} Z`);
  paths.push(`M ${cx - lipW + 1} ${lipY + 1} C ${cx} ${lipY + 0.5} ${cx + lipW - 1} ${lipY + 1} ${cx + lipW - 2} ${lipY + 3} C ${cx} ${lipY + 4.5} ${cx - lipW + 2} ${lipY + 3} ${cx - lipW + 1} ${lipY + 1} Z`);

  // NECK - Slender
  const neckTop = baseY + headH * 1.03;
  const neckW = 13 * p.neckWidth;
  const neckH = 26;
  paths.push(`M ${cx - neckW} ${neckTop} C ${cx - neckW - 2} ${neckTop + neckH * 0.4} ${cx - neckW - 4} ${neckTop + neckH * 0.8} ${cx - neckW - 6} ${neckTop + neckH} L ${cx + neckW + 6} ${neckTop + neckH} C ${cx + neckW + 4} ${neckTop + neckH * 0.8} ${cx + neckW + 2} ${neckTop + neckH * 0.4} ${cx + neckW} ${neckTop} Z`);

  // TORSO - Lithe, athletic
  const torsoTop = neckTop + neckH;
  const shoulderW = 65 * p.shoulderWidth;
  const waistW = 30 * p.waistWidth;
  const hipW = 40 * p.hipWidth;
  const torsoH = 100;
  
  let torso = `M ${cx - neckW - 6} ${torsoTop}`;
  torso += ` C ${cx - shoulderW * 0.5} ${torsoTop + 6} ${cx - shoulderW * 0.85} ${torsoTop + 14} ${cx - shoulderW} ${torsoTop + 24}`;
  torso += ` C ${cx - shoulderW + 4} ${torsoTop + 48} ${cx - waistW - 6} ${torsoTop + torsoH * 0.58} ${cx - waistW} ${torsoTop + torsoH * 0.65}`;
  torso += ` C ${cx - waistW - 3} ${torsoTop + torsoH * 0.75} ${cx - hipW + 4} ${torsoTop + torsoH * 0.9} ${cx - hipW} ${torsoTop + torsoH}`;
  torso += ` L ${cx + hipW} ${torsoTop + torsoH}`;
  torso += ` C ${cx + hipW - 4} ${torsoTop + torsoH * 0.9} ${cx + waistW + 3} ${torsoTop + torsoH * 0.75} ${cx + waistW} ${torsoTop + torsoH * 0.65}`;
  torso += ` C ${cx + waistW + 6} ${torsoTop + torsoH * 0.58} ${cx + shoulderW - 4} ${torsoTop + 48} ${cx + shoulderW} ${torsoTop + 24}`;
  torso += ` C ${cx + shoulderW * 0.85} ${torsoTop + 14} ${cx + shoulderW * 0.5} ${torsoTop + 6} ${cx + neckW + 6} ${torsoTop}`;
  torso += ' Z';
  paths.push(torso);

  // Chest/muscle definition
  paths.push(`M ${cx} ${torsoTop + 15} L ${cx} ${torsoTop + torsoH - 8}`);
  if (gender === 'female') {
    paths.push(`M ${cx - 22} ${torsoTop + 22} C ${cx - 28} ${torsoTop + 32} ${cx - 26} ${torsoTop + 45} ${cx - 16} ${torsoTop + 50}`);
    paths.push(`M ${cx + 22} ${torsoTop + 22} C ${cx + 28} ${torsoTop + 32} ${cx + 26} ${torsoTop + 45} ${cx + 16} ${torsoTop + 50}`);
  } else {
    paths.push(`M ${cx - 18} ${torsoTop + 20} C ${cx - 26} ${torsoTop + 28} ${cx - 24} ${torsoTop + 40} ${cx - 10} ${torsoTop + 44}`);
    paths.push(`M ${cx + 18} ${torsoTop + 20} C ${cx + 26} ${torsoTop + 28} ${cx + 24} ${torsoTop + 40} ${cx + 10} ${torsoTop + 44}`);
  }

  // ARMS
  for (let side = -1; side <= 1; side += 2) {
    const shoulderX = cx + side * shoulderW;
    paths.push(`M ${shoulderX} ${torsoTop + 22} C ${shoulderX + side * 6} ${torsoTop + 48} ${shoulderX + side * 9} ${torsoTop + 75} ${shoulderX + side * 7} ${torsoTop + 98} L ${shoulderX - side * 3} ${torsoTop + 98} C ${shoulderX - side * 6} ${torsoTop + 75} ${shoulderX - side * 9} ${torsoTop + 48} ${shoulderX - side * 11} ${torsoTop + 24} Z`);
    
    const elbowY = torsoTop + 98;
    paths.push(`M ${shoulderX + side * 7} ${elbowY} C ${shoulderX + side * 11} ${elbowY + 28} ${shoulderX + side * 13} ${elbowY + 58} ${shoulderX + side * 11} ${elbowY + 85} L ${shoulderX - side * 3} ${elbowY + 87} C ${shoulderX - side * 5} ${elbowY + 58} ${shoulderX - side * 3} ${elbowY + 28} ${shoulderX - side * 3} ${elbowY} Z`);
    
    // Hand
    const handY = elbowY + 85;
    const handX = shoulderX + side * 5;
    paths.push(`M ${handX - side * 9} ${handY} C ${handX - side * 11} ${handY + 14} ${handX - side * 9} ${handY + 30} ${handX - side * 6} ${handY + 38} L ${handX + side * 9} ${handY + 38} C ${handX + side * 11} ${handY + 30} ${handX + side * 9} ${handY + 14} ${handX + side * 6} ${handY} Z`);
    // Long sharp fingers
    for (let f = 0; f < 4; f++) {
      const fx = handX - side * 5 + f * side * 4.5;
      const fLen = 25 + (f === 1 ? 5 : f === 2 ? 3 : 0);
      paths.push(`M ${fx - 1.5} ${handY + 37} L ${fx - 0.5} ${handY + 37 + fLen} L ${fx + 0.5} ${handY + 37 + fLen} L ${fx + 1.5} ${handY + 37} Z`);
    }
  }

  // LEGS
  const legTop = torsoTop + torsoH;
  for (let side = -1; side <= 1; side += 2) {
    const legX = cx + side * hipW * 0.5;
    paths.push(`M ${legX - 11} ${legTop} C ${legX - 13} ${legTop + 38} ${legX - 11} ${legTop + 75} ${legX - 9} ${legTop + 100} L ${legX + 9} ${legTop + 100} C ${legX + 11} ${legTop + 75} ${legX + 13} ${legTop + 38} ${legX + 11} ${legTop} Z`);
    paths.push(`M ${legX - 9} ${legTop + 100} C ${legX - 8} ${legTop + 138} ${legX - 7} ${legTop + 175} ${legX - 6} ${legTop + 205} L ${legX + 6} ${legTop + 205} C ${legX + 7} ${legTop + 175} ${legX + 8} ${legTop + 138} ${legX + 9} ${legTop + 100} Z`);
    paths.push(`M ${legX - 6} ${legTop + 205} C ${legX - 7} ${legTop + 212} ${legX - 9} ${legTop + 218} ${legX - 11} ${legTop + 220} L ${legX + 7} ${legTop + 220} C ${legX + 9} ${legTop + 215} ${legX + 7} ${legTop + 208} ${legX + 6} ${legTop + 205} Z`);
  }

  return paths;
};

// ============================================================================
// DWARF - Stocky, broad, heavy features, magnificent beard
// ============================================================================
export const generateDwarfSilhouette = (gender: Gender, seed: number): string[] => {
  const p = BODY_PARAMS[gender];
  const r = (i: number) => seededRandom(seed + i);
  const paths: string[] = [];
  
  const cx = 200, baseY = 55;
  const headW = 44 * p.jawWidth;
  const headH = 50;
  
  // BROAD HEAVY SKULL
  let skull = `M ${cx} ${baseY}`;
  for (let i = 0; i <= 30; i++) {
    const angle = (i / 30) * Math.PI;
    const rugged = (r(i) - 0.5) * 4;
    const rx = headW * (0.92 + r(i + 50) * 0.05);
    const ry = headH * 0.48;
    const x = cx + Math.sin(angle) * rx + rugged;
    const y = baseY + 6 - Math.cos(angle) * ry;
    if (i === 0) skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    else skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  // Heavy brow
  skull += ` L ${cx + headW * 0.95} ${baseY + headH * 0.32}`;
  skull += ` L ${cx + headW * 1.05} ${baseY + headH * 0.42}`;
  skull += ` L ${cx + headW * 1.02} ${baseY + headH * 0.52}`;
  // Broad cheeks
  skull += ` C ${cx + headW * 1.08} ${baseY + headH * 0.62} ${cx + headW * 1.05} ${baseY + headH * 0.75} ${cx + headW * 0.95} ${baseY + headH * 0.85}`;
  // Square strong jaw
  skull += ` L ${cx + headW * 0.85} ${baseY + headH * 0.92}`;
  skull += ` L ${cx + headW * 0.55} ${baseY + headH * 0.98}`;
  skull += ` L ${cx + headW * 0.2} ${baseY + headH * 1.0}`;
  skull += ` L ${cx} ${baseY + headH * 1.02}`;
  // Left side
  skull += ` L ${cx - headW * 0.2} ${baseY + headH * 1.0}`;
  skull += ` L ${cx - headW * 0.55} ${baseY + headH * 0.98}`;
  skull += ` L ${cx - headW * 0.85} ${baseY + headH * 0.92}`;
  skull += ` C ${cx - headW * 1.05} ${baseY + headH * 0.75} ${cx - headW * 1.08} ${baseY + headH * 0.62} ${cx - headW * 1.02} ${baseY + headH * 0.52}`;
  skull += ` L ${cx - headW * 1.05} ${baseY + headH * 0.42}`;
  skull += ` L ${cx - headW * 0.95} ${baseY + headH * 0.32}`;
  skull += ' Z';
  paths.push(skull);

  // THICK WILD HAIR
  let hair = `M ${cx} ${baseY - 5}`;
  const hairVolume = 1.2;
  for (let i = 0; i <= 35; i++) {
    const angle = (i / 35) * Math.PI;
    const wild = (r(i + 100) - 0.5) * 10;
    const x = cx + Math.sin(angle) * headW * hairVolume + wild;
    const y = baseY - 10 - Math.cos(angle) * headH * 0.5 + r(i + 150) * 4;
    hair += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  hair += ` C ${cx + headW * 1.25} ${baseY + headH * 0.35} ${cx + headW * 1.2} ${baseY + headH * 0.55} ${cx + headW * 1.1} ${baseY + headH * 0.5}`;
  hair += ` L ${cx - headW * 1.1} ${baseY + headH * 0.5}`;
  hair += ` C ${cx - headW * 1.2} ${baseY + headH * 0.55} ${cx - headW * 1.25} ${baseY + headH * 0.35} ${cx - headW * hairVolume} ${baseY - 8}`;
  hair += ' Z';
  paths.push(hair);
  
  // Wild hair strands
  for (let i = 0; i < 20; i++) {
    const sx = cx + (r(i + 200) - 0.5) * headW * 2;
    const sy = baseY - 5 + r(i + 250) * headH * 0.25;
    const len = 8 + r(i + 300) * 12;
    paths.push(`M ${sx} ${sy} L ${sx + (r(i + 350) - 0.5) * 8} ${sy - len}`);
  }

  // MAGNIFICENT BEARD (male) or braided hair (female)
  const beardTop = baseY + headH * 0.75;
  if (gender === 'male') {
    const beardLength = 85 + r(400) * 30;
    // Main beard mass
    let beard = `M ${cx - headW * 0.85} ${beardTop}`;
    beard += ` C ${cx - headW * 0.95} ${beardTop + beardLength * 0.25} ${cx - headW * 0.9} ${beardTop + beardLength * 0.5} ${cx - headW * 0.7} ${beardTop + beardLength * 0.75}`;
    beard += ` C ${cx - headW * 0.5} ${beardTop + beardLength * 0.9} ${cx - headW * 0.25} ${beardTop + beardLength} ${cx} ${beardTop + beardLength * 1.05}`;
    beard += ` C ${cx + headW * 0.25} ${beardTop + beardLength} ${cx + headW * 0.5} ${beardTop + beardLength * 0.9} ${cx + headW * 0.7} ${beardTop + beardLength * 0.75}`;
    beard += ` C ${cx + headW * 0.9} ${beardTop + beardLength * 0.5} ${cx + headW * 0.95} ${beardTop + beardLength * 0.25} ${cx + headW * 0.85} ${beardTop}`;
    beard += ' Z';
    paths.push(beard);
    
    // Beard braids
    for (let b = 0; b < 3; b++) {
      const bx = cx + (b - 1) * headW * 0.35;
      for (let i = 0; i < 8; i++) {
        const by = beardTop + beardLength * 0.3 + i * 10;
        const wave = Math.sin(i * 0.8) * 4;
        paths.push(`M ${bx - 4 + wave} ${by} C ${bx + wave} ${by + 3} ${bx + 4 + wave} ${by + 6} ${bx + wave} ${by + 10}`);
      }
    }
    
    // Beard rings/beads
    for (let i = 0; i < 3; i++) {
      const rx = cx + (i - 1) * headW * 0.35;
      const ry = beardTop + beardLength * 0.5 + i * 15;
      paths.push(`M ${rx - 4} ${ry} A 4,4 0 1,1 ${rx + 4} ${ry} A 4,4 0 1,1 ${rx - 4} ${ry}`);
    }
    
    // Mustache
    paths.push(`M ${cx - headW * 0.4} ${beardTop - 8} C ${cx - headW * 0.55} ${beardTop - 5} ${cx - headW * 0.6} ${beardTop + 5} ${cx - headW * 0.5} ${beardTop + 15} C ${cx - headW * 0.35} ${beardTop + 10} ${cx - headW * 0.15} ${beardTop + 5} ${cx} ${beardTop + 3}`);
    paths.push(`M ${cx + headW * 0.4} ${beardTop - 8} C ${cx + headW * 0.55} ${beardTop - 5} ${cx + headW * 0.6} ${beardTop + 5} ${cx + headW * 0.5} ${beardTop + 15} C ${cx + headW * 0.35} ${beardTop + 10} ${cx + headW * 0.15} ${beardTop + 5} ${cx} ${beardTop + 3}`);
  } else {
    // Female dwarf - elaborate braided beard/chin hair or braided hair
    const braidLength = 50 + r(400) * 20;
    for (let b = 0; b < 2; b++) {
      const bx = cx + (b === 0 ? -1 : 1) * headW * 0.5;
      let braid = `M ${bx} ${beardTop + 5}`;
      for (let i = 0; i < 6; i++) {
        const wave = Math.sin(i * 0.9) * 6 * (b === 0 ? 1 : -1);
        braid += ` L ${bx + wave} ${beardTop + 5 + i * (braidLength / 6)}`;
      }
      paths.push(braid);
    }
  }

  // SMALL DEEP-SET EYES
  const eyeY = baseY + headH * 0.45;
  const eyeSpacing = headW * 0.28;
  const eyeW = 8, eyeH = 4;
  
  for (let side = -1; side <= 1; side += 2) {
    const eyeX = cx + side * eyeSpacing;
    paths.push(`M ${eyeX - eyeW} ${eyeY} C ${eyeX - eyeW * 0.6} ${eyeY - eyeH} ${eyeX + eyeW * 0.6} ${eyeY - eyeH} ${eyeX + eyeW} ${eyeY} C ${eyeX + eyeW * 0.6} ${eyeY + eyeH * 0.6} ${eyeX - eyeW * 0.6} ${eyeY + eyeH * 0.6} ${eyeX - eyeW} ${eyeY} Z`);
    paths.push(`M ${eyeX - 3} ${eyeY - 1} C ${eyeX - 3} ${eyeY - 3.5} ${eyeX + 3} ${eyeY - 3.5} ${eyeX + 3} ${eyeY - 1} C ${eyeX + 3} ${eyeY + 1.5} ${eyeX - 3} ${eyeY + 1.5} ${eyeX - 3} ${eyeY - 1} Z`);
    paths.push(`M ${eyeX - 1.5} ${eyeY - 1} C ${eyeX - 1.5} ${eyeY - 2.5} ${eyeX + 1.5} ${eyeY - 2.5} ${eyeX + 1.5} ${eyeY - 1} C ${eyeX + 1.5} ${eyeY + 0.5} ${eyeX - 1.5} ${eyeY + 0.5} ${eyeX - 1.5} ${eyeY - 1} Z`);
  }
  
  // Thick bushy brows
  const browY = eyeY - eyeH - 4;
  paths.push(`M ${cx + eyeSpacing - eyeW - 5} ${browY + 5} C ${cx + eyeSpacing - 3} ${browY - 4} ${cx + eyeSpacing + 5} ${browY - 3} ${cx + eyeSpacing + eyeW + 5} ${browY + 3}`);
  paths.push(`M ${cx - eyeSpacing + eyeW + 5} ${browY + 5} C ${cx - eyeSpacing + 3} ${browY - 4} ${cx - eyeSpacing - 5} ${browY - 3} ${cx - eyeSpacing - eyeW - 5} ${browY + 3}`);
  // Brow thickness
  paths.push(`M ${cx + eyeSpacing - eyeW - 3} ${browY + 7} C ${cx + eyeSpacing} ${browY - 1} ${cx + eyeSpacing + eyeW + 3} ${browY + 5} ${cx + eyeSpacing + eyeW + 6} ${browY + 6}`);
  paths.push(`M ${cx - eyeSpacing + eyeW + 3} ${browY + 7} C ${cx - eyeSpacing} ${browY - 1} ${cx - eyeSpacing - eyeW - 3} ${browY + 5} ${cx - eyeSpacing - eyeW - 6} ${browY + 6}`);

  // BROAD NOSE
  const noseY = baseY + headH * 0.68;
  paths.push(`M ${cx} ${eyeY + 8} C ${cx + 4} ${noseY - 12} ${cx + 10} ${noseY - 5} ${cx + 12} ${noseY} C ${cx + 14} ${noseY + 6} ${cx + 8} ${noseY + 10} ${cx} ${noseY + 8} C ${cx - 8} ${noseY + 10} ${cx - 14} ${noseY + 6} ${cx - 12} ${noseY} C ${cx - 10} ${noseY - 5} ${cx - 4} ${noseY - 12} ${cx} ${eyeY + 8} Z`);
  // Nostrils
  paths.push(`M ${cx - 5} ${noseY + 4} C ${cx - 7} ${noseY + 6} ${cx - 6} ${noseY + 8} ${cx - 3} ${noseY + 7}`);
  paths.push(`M ${cx + 5} ${noseY + 4} C ${cx + 7} ${noseY + 6} ${cx + 6} ${noseY + 8} ${cx + 3} ${noseY + 7}`);

  // EARS - Slightly pointed but broad
  const earY = baseY + headH * 0.38;
  const earH = 22;
  for (let side = -1; side <= 1; side += 2) {
    paths.push(`M ${cx + side * headW * 1.0} ${earY} C ${cx + side * (headW + 10)} ${earY - 5} ${cx + side * (headW + 14)} ${earY + earH * 0.3} ${cx + side * (headW + 12)} ${earY + earH * 0.6} C ${cx + side * (headW + 10)} ${earY + earH} ${cx + side * headW * 1.02} ${earY + earH - 3} ${cx + side * headW * 0.98} ${earY + earH * 0.7} Z`);
  }

  // THICK NECK
  const neckTop = baseY + headH * 1.0;
  const neckW = 22 * p.neckWidth;
  const neckH = 18;
  paths.push(`M ${cx - neckW} ${neckTop} L ${cx - neckW - 8} ${neckTop + neckH} L ${cx + neckW + 8} ${neckTop + neckH} L ${cx + neckW} ${neckTop} Z`);

  // STOCKY BROAD TORSO
  const torsoTop = neckTop + neckH;
  const shoulderW = 95 * p.shoulderWidth;
  const waistW = 55 * p.waistWidth;
  const hipW = 52 * p.hipWidth;
  const torsoH = 85;
  
  let torso = `M ${cx - neckW - 8} ${torsoTop}`;
  torso += ` C ${cx - shoulderW * 0.6} ${torsoTop + 5} ${cx - shoulderW * 0.9} ${torsoTop + 10} ${cx - shoulderW} ${torsoTop + 18}`;
  torso += ` L ${cx - shoulderW} ${torsoTop + 35}`;
  torso += ` C ${cx - shoulderW + 5} ${torsoTop + 55} ${cx - waistW - 5} ${torsoTop + torsoH * 0.7} ${cx - waistW} ${torsoTop + torsoH * 0.8}`;
  torso += ` C ${cx - waistW - 3} ${torsoTop + torsoH * 0.9} ${cx - hipW + 3} ${torsoTop + torsoH * 0.95} ${cx - hipW} ${torsoTop + torsoH}`;
  torso += ` L ${cx + hipW} ${torsoTop + torsoH}`;
  torso += ` C ${cx + hipW - 3} ${torsoTop + torsoH * 0.95} ${cx + waistW + 3} ${torsoTop + torsoH * 0.9} ${cx + waistW} ${torsoTop + torsoH * 0.8}`;
  torso += ` C ${cx + waistW + 5} ${torsoTop + torsoH * 0.7} ${cx + shoulderW - 5} ${torsoTop + 55} ${cx + shoulderW} ${torsoTop + 35}`;
  torso += ` L ${cx + shoulderW} ${torsoTop + 18}`;
  torso += ` C ${cx + shoulderW * 0.9} ${torsoTop + 10} ${cx + shoulderW * 0.6} ${torsoTop + 5} ${cx + neckW + 8} ${torsoTop}`;
  torso += ' Z';
  paths.push(torso);
  
  // Barrel chest
  paths.push(`M ${cx - 35} ${torsoTop + 18} C ${cx - 45} ${torsoTop + 30} ${cx - 42} ${torsoTop + 50} ${cx - 25} ${torsoTop + 55}`);
  paths.push(`M ${cx + 35} ${torsoTop + 18} C ${cx + 45} ${torsoTop + 30} ${cx + 42} ${torsoTop + 50} ${cx + 25} ${torsoTop + 55}`);
  paths.push(`M ${cx} ${torsoTop + 12} L ${cx} ${torsoTop + torsoH - 8}`);

  // THICK MUSCULAR ARMS
  for (let side = -1; side <= 1; side += 2) {
    const shoulderX = cx + side * shoulderW;
    // Massive upper arm
    paths.push(`M ${shoulderX} ${torsoTop + 18} C ${shoulderX + side * 8} ${torsoTop + 35} ${shoulderX + side * 12} ${torsoTop + 55} ${shoulderX + side * 10} ${torsoTop + 75} L ${shoulderX - side * 8} ${torsoTop + 75} C ${shoulderX - side * 12} ${torsoTop + 55} ${shoulderX - side * 15} ${torsoTop + 35} ${shoulderX - side * 18} ${torsoTop + 20} Z`);
    
    // Forearm
    const elbowY = torsoTop + 75;
    paths.push(`M ${shoulderX + side * 10} ${elbowY} C ${shoulderX + side * 14} ${elbowY + 20} ${shoulderX + side * 16} ${elbowY + 45} ${shoulderX + side * 14} ${elbowY + 65} L ${shoulderX - side * 6} ${elbowY + 68} C ${shoulderX - side * 8} ${elbowY + 45} ${shoulderX - side * 6} ${elbowY + 20} ${shoulderX - side * 8} ${elbowY} Z`);
    
    // Broad strong hand
    const handY = elbowY + 65;
    const handX = shoulderX + side * 5;
    paths.push(`M ${handX - side * 12} ${handY} C ${handX - side * 14} ${handY + 10} ${handX - side * 12} ${handY + 25} ${handX - side * 8} ${handY + 32} L ${handX + side * 12} ${handY + 32} C ${handX + side * 14} ${handY + 25} ${handX + side * 12} ${handY + 10} ${handX + side * 8} ${handY} Z`);
    // Thick fingers
    for (let f = 0; f < 4; f++) {
      const fx = handX - side * 6 + f * side * 5;
      const fLen = 16 + (f === 1 ? 3 : f === 2 ? 2 : 0);
      paths.push(`M ${fx - 2.5} ${handY + 31} L ${fx - 2} ${handY + 31 + fLen} L ${fx + 2} ${handY + 31 + fLen} L ${fx + 2.5} ${handY + 31} Z`);
    }
  }

  // SHORT STURDY LEGS
  const legTop = torsoTop + torsoH;
  for (let side = -1; side <= 1; side += 2) {
    const legX = cx + side * hipW * 0.45;
    // Thick thigh
    paths.push(`M ${legX - 16} ${legTop} C ${legX - 18} ${legTop + 25} ${legX - 16} ${legTop + 50} ${legX - 14} ${legTop + 70} L ${legX + 14} ${legTop + 70} C ${legX + 16} ${legTop + 50} ${legX + 18} ${legTop + 25} ${legX + 16} ${legTop} Z`);
    // Lower leg
    paths.push(`M ${legX - 14} ${legTop + 70} C ${legX - 12} ${legTop + 95} ${legX - 11} ${legTop + 120} ${legX - 10} ${legTop + 140} L ${legX + 10} ${legTop + 140} C ${legX + 11} ${legTop + 120} ${legX + 12} ${legTop + 95} ${legX + 14} ${legTop + 70} Z`);
    // Broad foot
    paths.push(`M ${legX - 10} ${legTop + 140} C ${legX - 12} ${legTop + 148} ${legX - 16} ${legTop + 155} ${legX - 18} ${legTop + 158} L ${legX + 12} ${legTop + 158} C ${legX + 14} ${legTop + 152} ${legX + 12} ${legTop + 145} ${legX + 10} ${legTop + 140} Z`);
  }

  return paths;
};

// ============================================================================
// ALIEN - Elongated head, large eyes, slender limbs, otherworldly
// ============================================================================
export const generateAlienSilhouette = (gender: Gender, seed: number): string[] => {
  // Validate inputs
  const safeGender: Gender = (gender === 'female') ? 'female' : 'male';
  const safeSeed = (typeof seed === 'number' && !isNaN(seed)) ? seed : 24;
  
  const p = BODY_PARAMS[safeGender];
  const r = (i: number) => seededRandom(safeSeed + i);
  const paths: string[] = [];
  
  const cx = 200, baseY = 32;
  const headW = 38 * p.jawWidth;
  const headH = 65;
  
  // ELONGATED BULBOUS SKULL
  let skull = `M ${cx} ${baseY}`;
  // Top of head - elongated dome
  for (let i = 0; i <= 40; i++) {
    const angle = (i / 40) * Math.PI;
    const bulge = Math.sin(angle) * 8;
    const rx = headW * (0.85 + Math.sin(i * 0.15) * 0.08);
    const ry = headH * 0.6;
    const x = cx + Math.sin(angle) * rx;
    const y = baseY - bulge - Math.cos(angle) * ry;
    skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  // Narrow temples
  skull += ` C ${cx + headW * 0.85} ${baseY + headH * 0.25} ${cx + headW * 0.78} ${baseY + headH * 0.4} ${cx + headW * 0.7} ${baseY + headH * 0.52}`;
  // Narrow tapered face
  skull += ` C ${cx + headW * 0.6} ${baseY + headH * 0.65} ${cx + headW * 0.45} ${baseY + headH * 0.78} ${cx + headW * 0.3} ${baseY + headH * 0.88}`;
  skull += ` C ${cx + headW * 0.15} ${baseY + headH * 0.95} ${cx + headW * 0.05} ${baseY + headH * 1.0} ${cx} ${baseY + headH * 1.02}`;
  // Left side mirror
  skull += ` C ${cx - headW * 0.05} ${baseY + headH * 1.0} ${cx - headW * 0.15} ${baseY + headH * 0.95} ${cx - headW * 0.3} ${baseY + headH * 0.88}`;
  skull += ` C ${cx - headW * 0.45} ${baseY + headH * 0.78} ${cx - headW * 0.6} ${baseY + headH * 0.65} ${cx - headW * 0.7} ${baseY + headH * 0.52}`;
  skull += ` C ${cx - headW * 0.78} ${baseY + headH * 0.4} ${cx - headW * 0.85} ${baseY + headH * 0.25} ${cx - headW * 0.82} ${baseY + headH * 0.08}`;
  skull += ' Z';
  paths.push(skull);

  // CRANIAL RIDGES
  for (let i = 0; i < 5; i++) {
    const y = baseY - 25 + i * 8;
    const width = headW * (0.7 - i * 0.08);
    paths.push(`M ${cx - width} ${y} Q ${cx} ${y - 4} ${cx + width} ${y}`);
  }

  // MASSIVE ALMOND EYES - Classic alien look
  const eyeY = baseY + headH * 0.45;
  const eyeSpacing = headW * 0.38;
  const eyeW = 22, eyeH = 16;
  
  for (let side = -1; side <= 1; side += 2) {
    const eyeX = cx + side * eyeSpacing;
    // Huge almond eye
    paths.push(`M ${eyeX - eyeW * 0.8} ${eyeY + eyeH * 0.3} C ${eyeX - eyeW} ${eyeY - eyeH * 0.5} ${eyeX + eyeW * 0.3} ${eyeY - eyeH} ${eyeX + eyeW} ${eyeY - eyeH * 0.2} C ${eyeX + eyeW * 0.8} ${eyeY + eyeH * 0.5} ${eyeX - eyeW * 0.2} ${eyeY + eyeH * 0.8} ${eyeX - eyeW * 0.8} ${eyeY + eyeH * 0.3} Z`);
    // Dark solid eye interior
    paths.push(`M ${eyeX - eyeW * 0.6} ${eyeY + eyeH * 0.2} C ${eyeX - eyeW * 0.75} ${eyeY - eyeH * 0.3} ${eyeX + eyeW * 0.15} ${eyeY - eyeH * 0.7} ${eyeX + eyeW * 0.7} ${eyeY - eyeH * 0.1} C ${eyeX + eyeW * 0.55} ${eyeY + eyeH * 0.4} ${eyeX - eyeW * 0.1} ${eyeY + eyeH * 0.55} ${eyeX - eyeW * 0.6} ${eyeY + eyeH * 0.2} Z`);
    // Eye shine
    paths.push(`M ${eyeX - eyeW * 0.3} ${eyeY - eyeH * 0.4} C ${eyeX - eyeW * 0.4} ${eyeY - eyeH * 0.55} ${eyeX - eyeW * 0.1} ${eyeY - eyeH * 0.6} ${eyeX} ${eyeY - eyeH * 0.45}`);
  }

  // SMALL NOSE - Two slits
  const noseY = baseY + headH * 0.78;
  paths.push(`M ${cx - 4} ${noseY} L ${cx - 2} ${noseY + 5} L ${cx + 2} ${noseY + 5} L ${cx + 4} ${noseY} Z`);
  // Nostril slits
  paths.push(`M ${cx - 3} ${noseY + 2} L ${cx - 2} ${noseY + 4}`);
  paths.push(`M ${cx + 3} ${noseY + 2} L ${cx + 2} ${noseY + 4}`);

  // SMALL LIPLESS MOUTH
  const mouthY = baseY + headH * 0.92;
  paths.push(`M ${cx - 8} ${mouthY} Q ${cx} ${mouthY + 3} ${cx + 8} ${mouthY}`);
  paths.push(`M ${cx - 6} ${mouthY + 1} Q ${cx} ${mouthY + 2} ${cx + 6} ${mouthY + 1}`);

  // NO EXTERNAL EARS - Just small holes or ridges
  const earY = baseY + headH * 0.5;
  for (let side = -1; side <= 1; side += 2) {
    paths.push(`M ${cx + side * headW * 0.68} ${earY} C ${cx + side * headW * 0.72} ${earY - 3} ${cx + side * headW * 0.74} ${earY + 5} ${cx + side * headW * 0.7} ${earY + 8}`);
    // Small ear opening
    paths.push(`M ${cx + side * headW * 0.69} ${earY + 2} A 2,2 0 1,1 ${cx + side * headW * 0.71} ${earY + 4}`);
  }

  // LONG THIN NECK
  const neckTop = baseY + headH * 1.0;
  const neckW = 10 * p.neckWidth;
  const neckH = 35;
  paths.push(`M ${cx - neckW} ${neckTop} C ${cx - neckW - 2} ${neckTop + neckH * 0.4} ${cx - neckW - 4} ${neckTop + neckH * 0.8} ${cx - neckW - 8} ${neckTop + neckH} L ${cx + neckW + 8} ${neckTop + neckH} C ${cx + neckW + 4} ${neckTop + neckH * 0.8} ${cx + neckW + 2} ${neckTop + neckH * 0.4} ${cx + neckW} ${neckTop} Z`);

  // SLENDER TORSO
  const torsoTop = neckTop + neckH;
  const shoulderW = 55 * p.shoulderWidth;
  const waistW = 22 * p.waistWidth;
  const hipW = 30 * p.hipWidth;
  const torsoH = 95;
  
  let torso = `M ${cx - neckW - 8} ${torsoTop}`;
  torso += ` C ${cx - shoulderW * 0.5} ${torsoTop + 8} ${cx - shoulderW * 0.85} ${torsoTop + 18} ${cx - shoulderW} ${torsoTop + 28}`;
  torso += ` C ${cx - shoulderW + 5} ${torsoTop + 50} ${cx - waistW - 8} ${torsoTop + torsoH * 0.6} ${cx - waistW} ${torsoTop + torsoH * 0.7}`;
  torso += ` C ${cx - waistW - 2} ${torsoTop + torsoH * 0.82} ${cx - hipW + 4} ${torsoTop + torsoH * 0.92} ${cx - hipW} ${torsoTop + torsoH}`;
  torso += ` L ${cx + hipW} ${torsoTop + torsoH}`;
  torso += ` C ${cx + hipW - 4} ${torsoTop + torsoH * 0.92} ${cx + waistW + 2} ${torsoTop + torsoH * 0.82} ${cx + waistW} ${torsoTop + torsoH * 0.7}`;
  torso += ` C ${cx + waistW + 8} ${torsoTop + torsoH * 0.6} ${cx + shoulderW - 5} ${torsoTop + 50} ${cx + shoulderW} ${torsoTop + 28}`;
  torso += ` C ${cx + shoulderW * 0.85} ${torsoTop + 18} ${cx + shoulderW * 0.5} ${torsoTop + 8} ${cx + neckW + 8} ${torsoTop}`;
  torso += ' Z';
  paths.push(torso);
  
  // Subtle chest definition
  paths.push(`M ${cx} ${torsoTop + 15} L ${cx} ${torsoTop + torsoH - 10}`);
  paths.push(`M ${cx - 18} ${torsoTop + 22} C ${cx - 22} ${torsoTop + 35} ${cx - 18} ${torsoTop + 48} ${cx - 8} ${torsoTop + 52}`);
  paths.push(`M ${cx + 18} ${torsoTop + 22} C ${cx + 22} ${torsoTop + 35} ${cx + 18} ${torsoTop + 48} ${cx + 8} ${torsoTop + 52}`);

  // LONG THIN ARMS with extra joints
  for (let side = -1; side <= 1; side += 2) {
    const shoulderX = cx + side * shoulderW;
    // Upper arm
    paths.push(`M ${shoulderX} ${torsoTop + 26} C ${shoulderX + side * 5} ${torsoTop + 50} ${shoulderX + side * 6} ${torsoTop + 75} ${shoulderX + side * 4} ${torsoTop + 95} L ${shoulderX - side * 4} ${torsoTop + 95} C ${shoulderX - side * 6} ${torsoTop + 75} ${shoulderX - side * 7} ${torsoTop + 50} ${shoulderX - side * 8} ${torsoTop + 28} Z`);
    
    // Forearm - extra long
    const elbowY = torsoTop + 95;
    paths.push(`M ${shoulderX + side * 4} ${elbowY} C ${shoulderX + side * 7} ${elbowY + 35} ${shoulderX + side * 8} ${elbowY + 70} ${shoulderX + side * 6} ${elbowY + 100} L ${shoulderX - side * 4} ${elbowY + 102} C ${shoulderX - side * 5} ${elbowY + 70} ${shoulderX - side * 4} ${elbowY + 35} ${shoulderX - side * 4} ${elbowY} Z`);
    
    // Elongated hand with long fingers
    const handY = elbowY + 100;
    const handX = shoulderX + side * 2;
    paths.push(`M ${handX - side * 8} ${handY} C ${handX - side * 10} ${handY + 12} ${handX - side * 8} ${handY + 28} ${handX - side * 5} ${handY + 35} L ${handX + side * 8} ${handY + 35} C ${handX + side * 10} ${handY + 28} ${handX + side * 8} ${handY + 12} ${handX + side * 5} ${handY} Z`);
    // Very long thin fingers (4)
    for (let f = 0; f < 4; f++) {
      const fx = handX - side * 5 + f * side * 4;
      const fLen = 35 + (f === 1 ? 6 : f === 2 ? 4 : 0);
      paths.push(`M ${fx - 1} ${handY + 34} Q ${fx} ${handY + 34 + fLen * 0.5} ${fx + (r(f + 800) - 0.5) * 3} ${handY + 34 + fLen} L ${fx + 1} ${handY + 34} Z`);
    }
    // Long thumb
    paths.push(`M ${handX - side * 7} ${handY + 8} C ${handX - side * 14} ${handY + 15} ${handX - side * 16} ${handY + 28} ${handX - side * 12} ${handY + 40} L ${handX - side * 9} ${handY + 38} C ${handX - side * 10} ${handY + 25} ${handX - side * 9} ${handY + 15} ${handX - side * 7} ${handY + 8} Z`);
  }

  // LONG THIN LEGS
  const legTop = torsoTop + torsoH;
  for (let side = -1; side <= 1; side += 2) {
    const legX = cx + side * hipW * 0.55;
    // Thigh
    paths.push(`M ${legX - 8} ${legTop} C ${legX - 9} ${legTop + 40} ${legX - 8} ${legTop + 80} ${legX - 7} ${legTop + 110} L ${legX + 7} ${legTop + 110} C ${legX + 8} ${legTop + 80} ${legX + 9} ${legTop + 40} ${legX + 8} ${legTop} Z`);
    // Lower leg
    paths.push(`M ${legX - 7} ${legTop + 110} C ${legX - 6} ${legTop + 150} ${legX - 5} ${legTop + 190} ${legX - 4} ${legTop + 225} L ${legX + 4} ${legTop + 225} C ${legX + 5} ${legTop + 190} ${legX + 6} ${legTop + 150} ${legX + 7} ${legTop + 110} Z`);
    // Elongated foot
    paths.push(`M ${legX - 4} ${legTop + 225} C ${legX - 5} ${legTop + 232} ${legX - 8} ${legTop + 238} ${legX - 10} ${legTop + 240} L ${legX + 6} ${legTop + 240} C ${legX + 8} ${legTop + 235} ${legX + 6} ${legTop + 228} ${legX + 4} ${legTop + 225} Z`);
  }

  return paths;
};

// ============================================================================
// SHARED COMPONENT
// ============================================================================
interface AvatarSilhouetteProps {
  race: 'elf' | 'darkelf' | 'dwarf' | 'alien';
  gender: Gender;
  seed?: number;
  fillColor?: string;
  strokeColor?: string;
  width?: number;
  height?: number;
}

export const AvatarSilhouette: React.FC<AvatarSilhouetteProps> = ({
  race,
  gender,
  seed = Date.now(),
  fillColor = '#1a1a2e',
  strokeColor = '#8b5cf6',
  width = 400,
  height = 450,
}) => {
  const generators: Record<string, (g: Gender, s: number) => string[]> = {
    elf: generateElfSilhouette,
    darkelf: generateDarkElfSilhouette,
    dwarf: generateDwarfSilhouette,
    alien: generateAlienSilhouette,
  };
  
  const paths = generators[race](gender, seed);
  
  return (
    <Svg width={width} height={height} viewBox="0 0 400 450">
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
