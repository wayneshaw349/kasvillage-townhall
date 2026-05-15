// KasVillage Identity Ritual - Orc & Halfling Silhouettes
// Male & Female versions, ~4000 bezier points each

import React from 'react';
import Svg, { Path, G } from 'react-native-svg';

type Gender = 'male' | 'female';

const seededRandom = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

const BODY_PARAMS = {
  male: { shoulderWidth: 1.18, hipWidth: 0.85, waistWidth: 0.98, neckWidth: 1.15, jawWidth: 1.12 },
  female: { shoulderWidth: 0.95, hipWidth: 1.08, waistWidth: 0.82, neckWidth: 0.9, jawWidth: 0.95 },
};

// ============================================================================
// ORC - Brutish with tusks, massive brow ridge, powerful build
// ============================================================================
export const generateOrcSilhouette = (gender: Gender, seed: number): string[] => {
  const p = BODY_PARAMS[gender];
  const r = (i: number) => seededRandom(seed + i);
  const paths: string[] = [];
  
  const cx = 200, baseY = 48;
  const headW = 50 * p.jawWidth;
  const headH = 52;
  
  // SKULL - Brutish, heavy, pronounced features
  let skull = `M ${cx} ${baseY}`;
  // Flat broad top with bumps and ridges
  for (let i = 0; i <= 35; i++) {
    const angle = (i / 35) * Math.PI;
    const bump = Math.sin(i * 0.7) * 3 + r(i) * 2;
    const rx = headW * (0.94 + r(i + 50) * 0.06);
    const ry = headH * 0.48;
    const x = cx + Math.sin(angle) * rx;
    const y = baseY + 10 - Math.cos(angle) * ry + bump;
    skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  
  // Massive brow ridge - defining orc feature
  skull += ` C ${cx + headW * 0.88} ${baseY + headH * 0.18} ${cx + headW * 1.12} ${baseY + headH * 0.28} ${cx + headW * 1.15} ${baseY + headH * 0.38}`;
  skull += ` C ${cx + headW * 1.18} ${baseY + headH * 0.42} ${cx + headW * 1.16} ${baseY + headH * 0.48} ${cx + headW * 1.1} ${baseY + headH * 0.52}`;
  
  // Wide brutal cheekbones
  skull += ` C ${cx + headW * 1.2} ${baseY + headH * 0.56} ${cx + headW * 1.18} ${baseY + headH * 0.65} ${cx + headW * 1.08} ${baseY + headH * 0.72}`;
  
  // Heavy square jaw
  skull += ` C ${cx + headW * 1.02} ${baseY + headH * 0.82} ${cx + headW * 0.85} ${baseY + headH * 0.94} ${cx + headW * 0.55} ${baseY + headH * 1.0}`;
  skull += ` C ${cx + headW * 0.35} ${baseY + headH * 1.03} ${cx + headW * 0.15} ${baseY + headH * 1.02} ${cx} ${baseY + headH}`;
  // Left side mirror
  skull += ` C ${cx - headW * 0.15} ${baseY + headH * 1.02} ${cx - headW * 0.35} ${baseY + headH * 1.03} ${cx - headW * 0.55} ${baseY + headH * 1.0}`;
  skull += ` C ${cx - headW * 0.85} ${baseY + headH * 0.94} ${cx - headW * 1.02} ${baseY + headH * 0.82} ${cx - headW * 1.08} ${baseY + headH * 0.72}`;
  skull += ` C ${cx - headW * 1.18} ${baseY + headH * 0.65} ${cx - headW * 1.2} ${baseY + headH * 0.56} ${cx - headW * 1.1} ${baseY + headH * 0.52}`;
  skull += ` C ${cx - headW * 1.16} ${baseY + headH * 0.48} ${cx - headW * 1.18} ${baseY + headH * 0.42} ${cx - headW * 1.15} ${baseY + headH * 0.38}`;
  skull += ` C ${cx - headW * 1.12} ${baseY + headH * 0.28} ${cx - headW * 0.88} ${baseY + headH * 0.18} ${cx - headW * 0.9} ${baseY + headH * 0.08}`;
  skull += ' Z';
  paths.push(skull);

  // TUSKS - Large protruding from lower jaw
  const tuskY = baseY + headH * 0.88;
  const tuskLength = gender === 'male' ? 38 : 28;
  
  // Right tusk - curved and detailed
  let rightTusk = `M ${cx + headW * 0.32} ${tuskY}`;
  rightTusk += ` C ${cx + headW * 0.38} ${tuskY - 8} ${cx + headW * 0.45} ${tuskY - 18} ${cx + headW * 0.52} ${tuskY - tuskLength * 0.6}`;
  rightTusk += ` C ${cx + headW * 0.55} ${tuskY - tuskLength * 0.8} ${cx + headW * 0.53} ${tuskY - tuskLength * 0.95} ${cx + headW * 0.48} ${tuskY - tuskLength}`;
  // Tusk tip
  rightTusk += ` C ${cx + headW * 0.46} ${tuskY - tuskLength - 3} ${cx + headW * 0.43} ${tuskY - tuskLength + 2} ${cx + headW * 0.42} ${tuskY - tuskLength + 6}`;
  // Inner curve back
  rightTusk += ` C ${cx + headW * 0.4} ${tuskY - tuskLength * 0.7} ${cx + headW * 0.35} ${tuskY - tuskLength * 0.4} ${cx + headW * 0.3} ${tuskY - 10}`;
  rightTusk += ` C ${cx + headW * 0.28} ${tuskY - 5} ${cx + headW * 0.26} ${tuskY - 2} ${cx + headW * 0.25} ${tuskY}`;
  rightTusk += ' Z';
  paths.push(rightTusk);
  
  // Tusk ridge detail
  paths.push(`M ${cx + headW * 0.35} ${tuskY - 5} C ${cx + headW * 0.42} ${tuskY - 15} ${cx + headW * 0.48} ${tuskY - tuskLength * 0.5} ${cx + headW * 0.5} ${tuskY - tuskLength * 0.75}`);
  
  // Left tusk (mirror)
  let leftTusk = `M ${cx - headW * 0.32} ${tuskY}`;
  leftTusk += ` C ${cx - headW * 0.38} ${tuskY - 8} ${cx - headW * 0.45} ${tuskY - 18} ${cx - headW * 0.52} ${tuskY - tuskLength * 0.6}`;
  leftTusk += ` C ${cx - headW * 0.55} ${tuskY - tuskLength * 0.8} ${cx - headW * 0.53} ${tuskY - tuskLength * 0.95} ${cx - headW * 0.48} ${tuskY - tuskLength}`;
  leftTusk += ` C ${cx - headW * 0.46} ${tuskY - tuskLength - 3} ${cx - headW * 0.43} ${tuskY - tuskLength + 2} ${cx - headW * 0.42} ${tuskY - tuskLength + 6}`;
  leftTusk += ` C ${cx - headW * 0.4} ${tuskY - tuskLength * 0.7} ${cx - headW * 0.35} ${tuskY - tuskLength * 0.4} ${cx - headW * 0.3} ${tuskY - 10}`;
  leftTusk += ` C ${cx - headW * 0.28} ${tuskY - 5} ${cx - headW * 0.26} ${tuskY - 2} ${cx - headW * 0.25} ${tuskY}`;
  leftTusk += ' Z';
  paths.push(leftTusk);
  paths.push(`M ${cx - headW * 0.35} ${tuskY - 5} C ${cx - headW * 0.42} ${tuskY - 15} ${cx - headW * 0.48} ${tuskY - tuskLength * 0.5} ${cx - headW * 0.5} ${tuskY - tuskLength * 0.75}`);

  // POINTED EARS - Small, pointed, bat-like
  const earY = baseY + headH * 0.32;
  const earLength = 22;
  const earWidth = 14;
  
  // Right ear
  let rightEar = `M ${cx + headW * 1.08} ${earY + 8}`;
  rightEar += ` C ${cx + headW * 1.12} ${earY + 4} ${cx + headW + earWidth * 0.5} ${earY - 5} ${cx + headW + earWidth * 0.8} ${earY - earLength * 0.6}`;
  rightEar += ` C ${cx + headW + earWidth} ${earY - earLength * 0.85} ${cx + headW + earWidth * 0.9} ${earY - earLength} ${cx + headW + earWidth * 0.7} ${earY - earLength - 5}`;
  // Pointed tip
  rightEar += ` C ${cx + headW + earWidth * 0.5} ${earY - earLength - 2} ${cx + headW + earWidth * 0.3} ${earY - earLength + 5} ${cx + headW + 5} ${earY - 8}`;
  rightEar += ` C ${cx + headW + 2} ${earY} ${cx + headW * 1.05} ${earY + 5} ${cx + headW * 1.02} ${earY + 12}`;
  rightEar += ' Z';
  paths.push(rightEar);
  // Ear inner ridge
  paths.push(`M ${cx + headW * 1.08} ${earY + 5} C ${cx + headW + 5} ${earY - 3} ${cx + headW + 8} ${earY - earLength * 0.4} ${cx + headW + 10} ${earY - earLength * 0.6}`);
  
  // Left ear (mirror)
  let leftEar = `M ${cx - headW * 1.08} ${earY + 8}`;
  leftEar += ` C ${cx - headW * 1.12} ${earY + 4} ${cx - headW - earWidth * 0.5} ${earY - 5} ${cx - headW - earWidth * 0.8} ${earY - earLength * 0.6}`;
  leftEar += ` C ${cx - headW - earWidth} ${earY - earLength * 0.85} ${cx - headW - earWidth * 0.9} ${earY - earLength} ${cx - headW - earWidth * 0.7} ${earY - earLength - 5}`;
  leftEar += ` C ${cx - headW - earWidth * 0.5} ${earY - earLength - 2} ${cx - headW - earWidth * 0.3} ${earY - earLength + 5} ${cx - headW - 5} ${earY - 8}`;
  leftEar += ` C ${cx - headW - 2} ${earY} ${cx - headW * 1.05} ${earY + 5} ${cx - headW * 1.02} ${earY + 12}`;
  leftEar += ' Z';
  paths.push(leftEar);
  paths.push(`M ${cx - headW * 1.08} ${earY + 5} C ${cx - headW - 5} ${earY - 3} ${cx - headW - 8} ${earY - earLength * 0.4} ${cx - headW - 10} ${earY - earLength * 0.6}`);

  // HAIR - Mohawk/topknot or wild mane
  let hair = `M ${cx} ${baseY - 2}`;
  if (gender === 'male') {
    // Aggressive mohawk with shaved sides
    const mohawkW = 12;
    const mohawkH = 35;
    hair += ` L ${cx - mohawkW} ${baseY - 8}`;
    // Spiky top
    for (let i = 0; i < 12; i++) {
      const spikeH = 20 + r(100 + i) * 25;
      const spikeX = cx - mohawkW + 2 + i * 2;
      const lean = (i - 5.5) * 1.5;
      hair += ` L ${spikeX + lean} ${baseY - spikeH}`;
      hair += ` L ${spikeX + 1 + lean * 0.5} ${baseY - 12 - r(120 + i) * 5}`;
    }
    hair += ` L ${cx + mohawkW} ${baseY - 8}`;
    hair += ` L ${cx + headW * 0.25} ${baseY + 2}`;
    hair += ' Z';
    
    // Shaved side details - scarification lines
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 4; i++) {
        const lineY = baseY + headH * 0.12 + i * 7;
        paths.push(`M ${cx + side * headW * 0.4} ${lineY} L ${cx + side * headW * 0.85} ${lineY + 3} L ${cx + side * headW * 0.85} ${lineY + 5} L ${cx + side * headW * 0.4} ${lineY + 2} Z`);
      }
    }
  } else {
    // Wild mane pulled back with braids
    for (let i = 0; i <= 25; i++) {
      const angle = (i / 25) * Math.PI;
      const wild = Math.sin(i * 0.8) * 5 + r(80 + i) * 8;
      const x = cx + Math.sin(angle) * (headW * 1.15 + wild);
      const y = baseY - 8 - Math.cos(angle) * headH * 0.5 - r(100 + i) * 10;
      hair += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    // Flows down with braids
    const hairLength = 70;
    hair += ` C ${cx + headW * 1.25} ${baseY + headH * 0.4} ${cx + headW * 1.2} ${baseY + headH + 20} ${cx + headW * 0.9} ${baseY + headH + hairLength}`;
    // Bottom
    hair += ` L ${cx - headW * 0.9} ${baseY + headH + hairLength}`;
    hair += ` C ${cx - headW * 1.2} ${baseY + headH + 20} ${cx - headW * 1.25} ${baseY + headH * 0.4} ${cx - headW * 1.15} ${baseY - 5}`;
    
    // Braid details
    for (let side = -1; side <= 1; side += 2) {
      for (let b = 0; b < 4; b++) {
        const braidX = cx + side * headW * 0.7;
        const braidY = baseY + headH + 30 + b * 12;
        paths.push(`M ${braidX - 4} ${braidY} C ${braidX} ${braidY + 3} ${braidX + 4} ${braidY + 3} ${braidX + 4} ${braidY + 6} C ${braidX} ${braidY + 9} ${braidX - 4} ${braidY + 9} ${braidX - 4} ${braidY + 6} Z`);
      }
    }
  }
  hair += ' Z';
  paths.push(hair);

  // DEEP-SET ANGRY EYES under heavy brow
  const eyeY = baseY + headH * 0.44;
  const eyeSpacing = headW * 0.34;
  const eyeW = 9, eyeH = 5;
  
  // Right eye - angry slant
  let rightEye = `M ${cx + eyeSpacing - eyeW - 2} ${eyeY + 3}`;
  rightEye += ` C ${cx + eyeSpacing - eyeW} ${eyeY + 1} ${cx + eyeSpacing - eyeW + 3} ${eyeY - 2} ${cx + eyeSpacing} ${eyeY - eyeH + 2}`;
  rightEye += ` C ${cx + eyeSpacing + eyeW - 3} ${eyeY - eyeH} ${cx + eyeSpacing + eyeW} ${eyeY - 2} ${cx + eyeSpacing + eyeW + 2} ${eyeY}`;
  rightEye += ` C ${cx + eyeSpacing + eyeW} ${eyeY + 3} ${cx + eyeSpacing + 3} ${eyeY + 4} ${cx + eyeSpacing - 3} ${eyeY + 3}`;
  rightEye += ` C ${cx + eyeSpacing - eyeW + 2} ${eyeY + 4} ${cx + eyeSpacing - eyeW - 1} ${eyeY + 4} ${cx + eyeSpacing - eyeW - 2} ${eyeY + 3} Z`;
  paths.push(rightEye);
  // Iris
  paths.push(`M ${cx + eyeSpacing - 3} ${eyeY - 1} C ${cx + eyeSpacing - 3} ${eyeY - 4} ${cx + eyeSpacing + 3} ${eyeY - 4} ${cx + eyeSpacing + 3} ${eyeY - 1} C ${cx + eyeSpacing + 3} ${eyeY + 2} ${cx + eyeSpacing - 3} ${eyeY + 2} ${cx + eyeSpacing - 3} ${eyeY - 1} Z`);
  
  // Left eye (mirror)
  let leftEye = `M ${cx - eyeSpacing + eyeW + 2} ${eyeY + 3}`;
  leftEye += ` C ${cx - eyeSpacing + eyeW} ${eyeY + 1} ${cx - eyeSpacing + eyeW - 3} ${eyeY - 2} ${cx - eyeSpacing} ${eyeY - eyeH + 2}`;
  leftEye += ` C ${cx - eyeSpacing - eyeW + 3} ${eyeY - eyeH} ${cx - eyeSpacing - eyeW} ${eyeY - 2} ${cx - eyeSpacing - eyeW - 2} ${eyeY}`;
  leftEye += ` C ${cx - eyeSpacing - eyeW} ${eyeY + 3} ${cx - eyeSpacing - 3} ${eyeY + 4} ${cx - eyeSpacing + 3} ${eyeY + 3}`;
  leftEye += ` C ${cx - eyeSpacing + eyeW - 2} ${eyeY + 4} ${cx - eyeSpacing + eyeW + 1} ${eyeY + 4} ${cx - eyeSpacing + eyeW + 2} ${eyeY + 3} Z`;
  paths.push(leftEye);
  paths.push(`M ${cx - eyeSpacing + 3} ${eyeY - 1} C ${cx - eyeSpacing + 3} ${eyeY - 4} ${cx - eyeSpacing - 3} ${eyeY - 4} ${cx - eyeSpacing - 3} ${eyeY - 1} C ${cx - eyeSpacing - 3} ${eyeY + 2} ${cx - eyeSpacing + 3} ${eyeY + 2} ${cx - eyeSpacing + 3} ${eyeY - 1} Z`);

  // HEAVY ANGRY BROWS - thick and slanted
  const browY = eyeY - eyeH - 3;
  // Right brow
  let rightBrow = `M ${cx + eyeSpacing - eyeW - 5} ${browY + 5}`;
  rightBrow += ` L ${cx + eyeSpacing - 2} ${browY - 6}`;
  rightBrow += ` L ${cx + eyeSpacing + eyeW + 6} ${browY - 2}`;
  rightBrow += ` L ${cx + eyeSpacing + eyeW + 4} ${browY + 2}`;
  rightBrow += ` L ${cx + eyeSpacing - 2} ${browY - 2}`;
  rightBrow += ` L ${cx + eyeSpacing - eyeW - 3} ${browY + 6}`;
  rightBrow += ' Z';
  paths.push(rightBrow);
  // Left brow
  let leftBrow = `M ${cx - eyeSpacing + eyeW + 5} ${browY + 5}`;
  leftBrow += ` L ${cx - eyeSpacing + 2} ${browY - 6}`;
  leftBrow += ` L ${cx - eyeSpacing - eyeW - 6} ${browY - 2}`;
  leftBrow += ` L ${cx - eyeSpacing - eyeW - 4} ${browY + 2}`;
  leftBrow += ` L ${cx - eyeSpacing + 2} ${browY - 2}`;
  leftBrow += ` L ${cx - eyeSpacing + eyeW + 3} ${browY + 6}`;
  leftBrow += ' Z';
  paths.push(leftBrow);

  // FLAT WIDE NOSE - brutish
  const noseY = baseY + headH * 0.62;
  let nose = `M ${cx} ${eyeY + 6}`;
  // Wide bridge
  nose += ` C ${cx + 4} ${eyeY + 12} ${cx + 8} ${noseY - 10} ${cx + 12} ${noseY - 3}`;
  // Flared nostril
  nose += ` C ${cx + 16} ${noseY} ${cx + 18} ${noseY + 5} ${cx + 16} ${noseY + 10}`;
  nose += ` C ${cx + 14} ${noseY + 14} ${cx + 8} ${noseY + 15} ${cx} ${noseY + 12}`;
  // Left nostril
  nose += ` C ${cx - 8} ${noseY + 15} ${cx - 14} ${noseY + 14} ${cx - 16} ${noseY + 10}`;
  nose += ` C ${cx - 18} ${noseY + 5} ${cx - 16} ${noseY} ${cx - 12} ${noseY - 3}`;
  nose += ` C ${cx - 8} ${noseY - 10} ${cx - 4} ${eyeY + 12} ${cx} ${eyeY + 6} Z`;
  paths.push(nose);
  // Nostril holes
  paths.push(`M ${cx + 8} ${noseY + 6} C ${cx + 10} ${noseY + 4} ${cx + 13} ${noseY + 5} ${cx + 12} ${noseY + 8} C ${cx + 11} ${noseY + 10} ${cx + 8} ${noseY + 9} ${cx + 8} ${noseY + 6} Z`);
  paths.push(`M ${cx - 8} ${noseY + 6} C ${cx - 10} ${noseY + 4} ${cx - 13} ${noseY + 5} ${cx - 12} ${noseY + 8} C ${cx - 11} ${noseY + 10} ${cx - 8} ${noseY + 9} ${cx - 8} ${noseY + 6} Z`);

  // SCARS - battle damage
  // Right cheek scar
  paths.push(`M ${cx + headW * 0.65} ${baseY + headH * 0.35} L ${cx + headW * 0.45} ${baseY + headH * 0.58} L ${cx + headW * 0.47} ${baseY + headH * 0.6} L ${cx + headW * 0.67} ${baseY + headH * 0.37} Z`);
  // Brow scar
  paths.push(`M ${cx - headW * 0.15} ${baseY + headH * 0.25} L ${cx + headW * 0.1} ${baseY + headH * 0.32} L ${cx + headW * 0.1} ${baseY + headH * 0.34} L ${cx - headW * 0.15} ${baseY + headH * 0.27} Z`);

  // MASSIVE NECK
  const neckTop = baseY + headH;
  const neckW = 38 * p.neckWidth;
  const neckH = 22;
  
  let neck = `M ${cx - headW * 0.55} ${neckTop}`;
  neck += ` C ${cx - neckW * 1.1} ${neckTop + 3} ${cx - neckW * 1.2} ${neckTop + neckH * 0.5} ${cx - neckW * 1.4} ${neckTop + neckH}`;
  // Thick neck muscles
  neck += ` C ${cx - neckW * 0.5} ${neckTop + neckH + 3} ${cx} ${neckTop + neckH + 5} ${cx + neckW * 0.5} ${neckTop + neckH + 3}`;
  neck += ` C ${cx + neckW * 1.2} ${neckTop + neckH * 0.5} ${cx + neckW * 1.1} ${neckTop + 3} ${cx + headW * 0.55} ${neckTop} Z`;
  paths.push(neck);
  
  // Neck tendons
  paths.push(`M ${cx - neckW * 0.5} ${neckTop + 3} C ${cx - neckW * 0.55} ${neckTop + 10} ${cx - neckW * 0.6} ${neckTop + 16} ${cx - neckW * 0.7} ${neckTop + neckH - 2}`);
  paths.push(`M ${cx + neckW * 0.5} ${neckTop + 3} C ${cx + neckW * 0.55} ${neckTop + 10} ${cx + neckW * 0.6} ${neckTop + 16} ${cx + neckW * 0.7} ${neckTop + neckH - 2}`);
  paths.push(`M ${cx} ${neckTop + 5} L ${cx} ${neckTop + neckH - 3}`);

  // MASSIVE TORSO - hulking muscular build
  const torsoTop = neckTop + neckH;
  const shoulderW = 98 * p.shoulderWidth;
  const waistW = 58 * p.waistWidth;
  const hipW = 52 * p.hipWidth;
  const torsoH = 95;

  let torso = `M ${cx - neckW * 1.4} ${torsoTop}`;
  // Massive trap muscles into shoulders
  torso += ` C ${cx - shoulderW * 0.5} ${torsoTop - 10} ${cx - shoulderW * 0.8} ${torsoTop + 8} ${cx - shoulderW} ${torsoTop + 22}`;
  // Huge shoulder caps
  torso += ` C ${cx - shoulderW - 15} ${torsoTop + 32} ${cx - shoulderW - 12} ${torsoTop + 48} ${cx - shoulderW + 5} ${torsoTop + 55}`;
  // Thick lats
  torso += ` C ${cx - shoulderW + 15} ${torsoTop + 65} ${cx - waistW - 15} ${torsoTop + torsoH * 0.55} ${cx - waistW - 8} ${torsoTop + torsoH * 0.65}`;
  // Blocky waist
  torso += ` C ${cx - waistW - 3} ${torsoTop + torsoH * 0.78} ${cx - hipW + 5} ${torsoTop + torsoH * 0.9} ${cx - hipW} ${torsoTop + torsoH}`;
  // Hip
  torso += ` C ${cx - hipW * 0.5} ${torsoTop + torsoH + 6} ${cx} ${torsoTop + torsoH + 8} ${cx + hipW * 0.5} ${torsoTop + torsoH + 6}`;
  torso += ` C ${cx + hipW} ${torsoTop + torsoH} ${cx + hipW - 5} ${torsoTop + torsoH * 0.9} ${cx + waistW + 8} ${torsoTop + torsoH * 0.65}`;
  torso += ` C ${cx + waistW + 15} ${torsoTop + torsoH * 0.55} ${cx + shoulderW - 15} ${torsoTop + 65} ${cx + shoulderW - 5} ${torsoTop + 55}`;
  torso += ` C ${cx + shoulderW + 12} ${torsoTop + 48} ${cx + shoulderW + 15} ${torsoTop + 32} ${cx + shoulderW} ${torsoTop + 22}`;
  torso += ` C ${cx + shoulderW * 0.8} ${torsoTop + 8} ${cx + shoulderW * 0.5} ${torsoTop - 10} ${cx + neckW * 1.4} ${torsoTop} Z`;
  paths.push(torso);

  // MASSIVE MUSCLE DEFINITION
  // Pecs
  let rightPec = `M ${cx - 8} ${torsoTop + 18}`;
  rightPec += ` C ${cx - 35} ${torsoTop + 12} ${cx - 52} ${torsoTop + 28} ${cx - 50} ${torsoTop + 45}`;
  rightPec += ` C ${cx - 48} ${torsoTop + 58} ${cx - 28} ${torsoTop + 62} ${cx - 8} ${torsoTop + 52}`;
  rightPec += ` C ${cx - 5} ${torsoTop + 42} ${cx - 6} ${torsoTop + 28} ${cx - 8} ${torsoTop + 18} Z`;
  paths.push(rightPec);
  let leftPec = `M ${cx + 8} ${torsoTop + 18}`;
  leftPec += ` C ${cx + 35} ${torsoTop + 12} ${cx + 52} ${torsoTop + 28} ${cx + 50} ${torsoTop + 45}`;
  leftPec += ` C ${cx + 48} ${torsoTop + 58} ${cx + 28} ${torsoTop + 62} ${cx + 8} ${torsoTop + 52}`;
  leftPec += ` C ${cx + 5} ${torsoTop + 42} ${cx + 6} ${torsoTop + 28} ${cx + 8} ${torsoTop + 18} Z`;
  paths.push(leftPec);
  
  // Abs - blocky 6-pack
  const absW = 22;
  for (let row = 0; row < 3; row++) {
    const absY = torsoTop + 60 + row * 16;
    paths.push(`M ${cx - absW} ${absY} Q ${cx} ${absY - 4} ${cx + absW} ${absY}`);
  }
  paths.push(`M ${cx} ${torsoTop + 55} L ${cx} ${torsoTop + torsoH - 8}`);
  // Obliques
  paths.push(`M ${cx - waistW + 5} ${torsoTop + 65} C ${cx - absW - 8} ${torsoTop + 70} ${cx - absW - 5} ${torsoTop + 85} ${cx - absW - 3} ${torsoTop + torsoH - 10}`);
  paths.push(`M ${cx + waistW - 5} ${torsoTop + 65} C ${cx + absW + 8} ${torsoTop + 70} ${cx + absW + 5} ${torsoTop + 85} ${cx + absW + 3} ${torsoTop + torsoH - 10}`);

  // MASSIVE ARMS
  const armStartY = torsoTop + 22;
  const upperArmL = 52;
  const forearmL = 48;
  const armW = gender === 'male' ? 28 : 22;

  // Left arm
  let leftArm = `M ${cx - shoulderW} ${armStartY}`;
  // Huge deltoid
  leftArm += ` C ${cx - shoulderW - 22} ${armStartY + 15} ${cx - shoulderW - 28} ${armStartY + 30} ${cx - shoulderW - 26} ${armStartY + 40}`;
  // Massive bicep bulge
  leftArm += ` C ${cx - shoulderW - 30} ${armStartY + 48} ${cx - shoulderW - 32} ${armStartY + upperArmL - 8} ${cx - shoulderW - 28} ${armStartY + upperArmL}`;
  // Elbow
  leftArm += ` C ${cx - shoulderW - 35} ${armStartY + upperArmL + 10} ${cx - shoulderW - 30} ${armStartY + upperArmL + 18} ${cx - shoulderW - 25} ${armStartY + upperArmL + 22}`;
  // Thick forearm
  leftArm += ` C ${cx - shoulderW - 22} ${armStartY + upperArmL + 40} ${cx - shoulderW - 18} ${armStartY + upperArmL + forearmL - 8} ${cx - shoulderW - 15} ${armStartY + upperArmL + forearmL}`;
  // Massive fist
  leftArm += ` C ${cx - shoulderW - 10} ${armStartY + upperArmL + forearmL + 28} ${cx - shoulderW + 20} ${armStartY + upperArmL + forearmL + 35} ${cx - shoulderW + 18} ${armStartY + upperArmL + forearmL + 5}`;
  // Inner arm
  leftArm += ` C ${cx - shoulderW + armW + 8} ${armStartY + upperArmL + 30} ${cx - shoulderW + armW + 5} ${armStartY + upperArmL + 15} ${cx - shoulderW + armW} ${armStartY + upperArmL}`;
  leftArm += ` C ${cx - shoulderW + armW - 5} ${armStartY + 35} ${cx - shoulderW + armW - 8} ${armStartY + 18} ${cx - shoulderW + 10} ${armStartY} Z`;
  paths.push(leftArm);

  // Right arm (mirror)
  let rightArm = `M ${cx + shoulderW} ${armStartY}`;
  rightArm += ` C ${cx + shoulderW + 22} ${armStartY + 15} ${cx + shoulderW + 28} ${armStartY + 30} ${cx + shoulderW + 26} ${armStartY + 40}`;
  rightArm += ` C ${cx + shoulderW + 30} ${armStartY + 48} ${cx + shoulderW + 32} ${armStartY + upperArmL - 8} ${cx + shoulderW + 28} ${armStartY + upperArmL}`;
  rightArm += ` C ${cx + shoulderW + 35} ${armStartY + upperArmL + 10} ${cx + shoulderW + 30} ${armStartY + upperArmL + 18} ${cx + shoulderW + 25} ${armStartY + upperArmL + 22}`;
  rightArm += ` C ${cx + shoulderW + 22} ${armStartY + upperArmL + 40} ${cx + shoulderW + 18} ${armStartY + upperArmL + forearmL - 8} ${cx + shoulderW + 15} ${armStartY + upperArmL + forearmL}`;
  rightArm += ` C ${cx + shoulderW + 10} ${armStartY + upperArmL + forearmL + 28} ${cx + shoulderW - 20} ${armStartY + upperArmL + forearmL + 35} ${cx + shoulderW - 18} ${armStartY + upperArmL + forearmL + 5}`;
  rightArm += ` C ${cx + shoulderW - armW - 8} ${armStartY + upperArmL + 30} ${cx + shoulderW - armW - 5} ${armStartY + upperArmL + 15} ${cx + shoulderW - armW} ${armStartY + upperArmL}`;
  rightArm += ` C ${cx + shoulderW - armW + 5} ${armStartY + 35} ${cx + shoulderW - armW + 8} ${armStartY + 18} ${cx + shoulderW - 10} ${armStartY} Z`;
  paths.push(rightArm);

  // Thick fingers
  const handY = armStartY + upperArmL + forearmL + 5;
  for (let side = -1; side <= 1; side += 2) {
    const handX = cx + side * (shoulderW - 5);
    for (let f = 0; f < 5; f++) {
      const fingerW = f === 0 ? 6 : 5;
      const fingerL = f === 0 ? 16 : 20 + (2 - Math.abs(f - 2)) * 3;
      const fingerX = handX + side * (f * 7 - 12);
      const fingerY = f === 0 ? handY + 8 : handY + 22;
      paths.push(`M ${fingerX - fingerW} ${fingerY} L ${fingerX - fingerW * 0.8} ${fingerY + fingerL} Q ${fingerX} ${fingerY + fingerL + 4} ${fingerX + fingerW * 0.8} ${fingerY + fingerL} L ${fingerX + fingerW} ${fingerY} Z`);
    }
  }

  // THICK POWERFUL LEGS
  const legTop = torsoTop + torsoH + 6;
  const thighL = 65;
  const calfL = 58;
  const legW = gender === 'male' ? 30 : 26;

  // Left leg
  let leftLeg = `M ${cx - hipW * 0.15} ${legTop}`;
  leftLeg += ` C ${cx - hipW * 0.4} ${legTop + 8} ${cx - hipW * 0.55} ${legTop + 18} ${cx - legW - 12} ${legTop + thighL * 0.5}`;
  leftLeg += ` C ${cx - legW - 16} ${legTop + thighL * 0.75} ${cx - legW - 14} ${legTop + thighL - 5} ${cx - legW - 12} ${legTop + thighL}`;
  // Knee
  leftLeg += ` C ${cx - legW - 18} ${legTop + thighL + 10} ${cx - legW - 12} ${legTop + thighL + 18} ${cx - legW - 8} ${legTop + thighL + 22}`;
  // Calf
  leftLeg += ` C ${cx - legW - 5} ${legTop + thighL + calfL * 0.4} ${cx - legW + 5} ${legTop + thighL + calfL * 0.75} ${cx - legW + 8} ${legTop + thighL + calfL}`;
  // Foot
  leftLeg += ` L ${cx - 42} ${legTop + thighL + calfL + 15}`;
  leftLeg += ` C ${cx - 50} ${legTop + thighL + calfL + 22} ${cx - 48} ${legTop + thighL + calfL + 32} ${cx - 12} ${legTop + thighL + calfL + 32}`;
  leftLeg += ` L ${cx - 12} ${legTop + thighL + calfL}`;
  // Inner leg
  leftLeg += ` C ${cx - 10} ${legTop + thighL + 20} ${cx - 14} ${legTop + 20} ${cx - hipW * 0.15} ${legTop} Z`;
  paths.push(leftLeg);

  // Right leg (mirror)
  let rightLeg = `M ${cx + hipW * 0.15} ${legTop}`;
  rightLeg += ` C ${cx + hipW * 0.4} ${legTop + 8} ${cx + hipW * 0.55} ${legTop + 18} ${cx + legW + 12} ${legTop + thighL * 0.5}`;
  rightLeg += ` C ${cx + legW + 16} ${legTop + thighL * 0.75} ${cx + legW + 14} ${legTop + thighL - 5} ${cx + legW + 12} ${legTop + thighL}`;
  rightLeg += ` C ${cx + legW + 18} ${legTop + thighL + 10} ${cx + legW + 12} ${legTop + thighL + 18} ${cx + legW + 8} ${legTop + thighL + 22}`;
  rightLeg += ` C ${cx + legW + 5} ${legTop + thighL + calfL * 0.4} ${cx + legW - 5} ${legTop + thighL + calfL * 0.75} ${cx + legW - 8} ${legTop + thighL + calfL}`;
  rightLeg += ` L ${cx + 42} ${legTop + thighL + calfL + 15}`;
  rightLeg += ` C ${cx + 50} ${legTop + thighL + calfL + 22} ${cx + 48} ${legTop + thighL + calfL + 32} ${cx + 12} ${legTop + thighL + calfL + 32}`;
  rightLeg += ` L ${cx + 12} ${legTop + thighL + calfL}`;
  rightLeg += ` C ${cx + 10} ${legTop + thighL + 20} ${cx + 14} ${legTop + 20} ${cx + hipW * 0.15} ${legTop} Z`;
  paths.push(rightLeg);

  return paths;
};

// ============================================================================
// HALFLING - Small cheerful, curly hair, big feet, rosy cheeks
// ============================================================================
export const generateHalflingSilhouette = (gender: Gender, seed: number): string[] => {
  // Validate inputs
  const safeGender: Gender = (gender === 'female') ? 'female' : 'male';
  const safeSeed = (typeof seed === 'number' && !isNaN(seed)) ? seed : 12;
  
  const p = BODY_PARAMS[safeGender];
  const r = (i: number) => seededRandom(safeSeed + i);
  const paths: string[] = [];
  
  const cx = 200, baseY = 85; // Lower start for shorter stature
  const headW = 44; // Larger head proportionally
  const headH = 48;
  
  // ROUND CHEERFUL FACE
  let skull = `M ${cx} ${baseY}`;
  // Very round skull
  for (let i = 0; i <= 40; i++) {
    const angle = (i / 40) * Math.PI;
    const round = 1 + Math.sin(i * 0.2) * 0.02;
    const rx = headW * round * (0.96 + r(i) * 0.03);
    const ry = headH * 0.54 * round;
    const x = cx + Math.sin(angle) * rx;
    const y = baseY + headH * 0.48 - Math.cos(angle) * ry;
    skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  // Soft round cheeks
  skull += ` C ${cx + headW * 0.92} ${baseY + headH * 0.55} ${cx + headW * 0.98} ${baseY + headH * 0.65} ${cx + headW * 0.9} ${baseY + headH * 0.75}`;
  // Soft round chin
  skull += ` C ${cx + headW * 0.75} ${baseY + headH * 0.88} ${cx + headW * 0.45} ${baseY + headH * 0.98} ${cx} ${baseY + headH}`;
  skull += ` C ${cx - headW * 0.45} ${baseY + headH * 0.98} ${cx - headW * 0.75} ${baseY + headH * 0.88} ${cx - headW * 0.9} ${baseY + headH * 0.75}`;
  skull += ` C ${cx - headW * 0.98} ${baseY + headH * 0.65} ${cx - headW * 0.92} ${baseY + headH * 0.55} ${cx - headW * 0.88} ${baseY + headH * 0.35}`;
  skull += ' Z';
  paths.push(skull);

  // VOLUMINOUS CURLY HAIR
  let hair = `M ${cx} ${baseY - 8}`;
  const curlCount = 40;
  for (let i = 0; i <= curlCount; i++) {
    const angle = (i / curlCount) * Math.PI;
    const baseR = headW * 1.22;
    const curl = Math.sin(i * 2.5) * 8 + Math.cos(i * 1.8) * 5 + r(50 + i) * 6;
    const x = cx + Math.sin(angle) * (baseR + curl);
    const y = baseY - 10 - Math.cos(angle) * headH * 0.52 + Math.abs(Math.sin(i * 3)) * 6;
    hair += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  
  if (gender === 'female') {
    // Long bouncy curls
    const hairLength = 65;
    hair += ` C ${cx + headW * 1.4} ${baseY + headH * 0.3} ${cx + headW * 1.5} ${baseY + headH * 0.8} ${cx + headW * 1.25} ${baseY + headH + hairLength * 0.4}`;
    // Bouncy curls on right
    for (let i = 0; i < 12; i++) {
      const curlX = cx + headW * (1.15 - i * 0.14);
      const curlY = baseY + headH + hairLength * 0.4 + i * 5;
      const curlSize = 6 + Math.sin(i) * 3;
      hair += ` C ${curlX + curlSize} ${curlY + 2} ${curlX + curlSize * 0.5} ${curlY + 6} ${curlX - curlSize * 0.5} ${curlY + 5}`;
    }
    hair += ` L ${cx - headW * 0.5} ${baseY + headH + hairLength}`;
    // Left side curls going back up
    for (let i = 11; i >= 0; i--) {
      const curlX = cx - headW * (1.15 - i * 0.14);
      const curlY = baseY + headH + hairLength * 0.4 + i * 5;
      const curlSize = 6 + Math.sin(i) * 3;
      hair += ` C ${curlX - curlSize * 0.5} ${curlY + 5} ${curlX - curlSize} ${curlY + 2} ${curlX} ${curlY - 2}`;
    }
    hair += ` C ${cx - headW * 1.5} ${baseY + headH * 0.8} ${cx - headW * 1.4} ${baseY + headH * 0.3} ${cx - headW * 1.25} ${baseY - 8}`;
  } else {
    // Shorter but still very curly
    hair += ` C ${cx + headW * 1.3} ${baseY + headH * 0.4} ${cx + headW * 1.2} ${baseY + headH * 0.7} ${cx + headW * 1.0} ${baseY + headH * 0.65}`;
    // Some curls at the sides
    for (let i = 0; i < 5; i++) {
      const curlY = baseY + headH * 0.5 + i * 8;
      hair += ` C ${cx + headW * 1.1} ${curlY} ${cx + headW * 1.15} ${curlY + 4} ${cx + headW * 1.05} ${curlY + 6}`;
    }
    hair += ` L ${cx - headW * 1.05} ${baseY + headH * 0.9}`;
    for (let i = 4; i >= 0; i--) {
      const curlY = baseY + headH * 0.5 + i * 8;
      hair += ` C ${cx - headW * 1.15} ${curlY + 4} ${cx - headW * 1.1} ${curlY} ${cx - headW * 1.05} ${curlY - 3}`;
    }
    hair += ` C ${cx - headW * 1.2} ${baseY + headH * 0.7} ${cx - headW * 1.3} ${baseY + headH * 0.4} ${cx - headW * 1.25} ${baseY - 8}`;
  }
  hair += ' Z';
  paths.push(hair);
  
  // Individual curl details
  for (let i = 0; i < 8; i++) {
    const curlX = cx + (i - 3.5) * headW * 0.22;
    const curlY = baseY - 5 + r(200 + i) * 10;
    const curlR = 4 + r(210 + i) * 3;
    paths.push(`M ${curlX} ${curlY} C ${curlX + curlR} ${curlY - curlR} ${curlX + curlR * 2} ${curlY} ${curlX + curlR} ${curlY + curlR} C ${curlX} ${curlY + curlR * 1.5} ${curlX - curlR} ${curlY + curlR} ${curlX - curlR} ${curlY}`);
  }

  // LARGE FRIENDLY EYES
  const eyeY = baseY + headH * 0.42;
  const eyeSpacing = headW * 0.28;
  const eyeW = 10, eyeH = 8;
  
  // Right eye - large and round
  let rightEye = `M ${cx + eyeSpacing - eyeW} ${eyeY}`;
  rightEye += ` C ${cx + eyeSpacing - eyeW} ${eyeY - eyeH} ${cx + eyeSpacing + eyeW} ${eyeY - eyeH} ${cx + eyeSpacing + eyeW} ${eyeY}`;
  rightEye += ` C ${cx + eyeSpacing + eyeW} ${eyeY + eyeH * 0.8} ${cx + eyeSpacing - eyeW} ${eyeY + eyeH * 0.8} ${cx + eyeSpacing - eyeW} ${eyeY} Z`;
  paths.push(rightEye);
  // Iris
  paths.push(`M ${cx + eyeSpacing - 4} ${eyeY - 1} C ${cx + eyeSpacing - 4} ${eyeY - 5} ${cx + eyeSpacing + 4} ${eyeY - 5} ${cx + eyeSpacing + 4} ${eyeY - 1} C ${cx + eyeSpacing + 4} ${eyeY + 3} ${cx + eyeSpacing - 4} ${eyeY + 3} ${cx + eyeSpacing - 4} ${eyeY - 1} Z`);
  // Pupil
  paths.push(`M ${cx + eyeSpacing - 2} ${eyeY - 1} C ${cx + eyeSpacing - 2} ${eyeY - 3} ${cx + eyeSpacing + 2} ${eyeY - 3} ${cx + eyeSpacing + 2} ${eyeY - 1} C ${cx + eyeSpacing + 2} ${eyeY + 1} ${cx + eyeSpacing - 2} ${eyeY + 1} ${cx + eyeSpacing - 2} ${eyeY - 1} Z`);
  // Eye shine
  paths.push(`M ${cx + eyeSpacing + 2} ${eyeY - 3} C ${cx + eyeSpacing + 3} ${eyeY - 4} ${cx + eyeSpacing + 4} ${eyeY - 3} ${cx + eyeSpacing + 3} ${eyeY - 2} Z`);
  
  // Left eye
  let leftEye = `M ${cx - eyeSpacing + eyeW} ${eyeY}`;
  leftEye += ` C ${cx - eyeSpacing + eyeW} ${eyeY - eyeH} ${cx - eyeSpacing - eyeW} ${eyeY - eyeH} ${cx - eyeSpacing - eyeW} ${eyeY}`;
  leftEye += ` C ${cx - eyeSpacing - eyeW} ${eyeY + eyeH * 0.8} ${cx - eyeSpacing + eyeW} ${eyeY + eyeH * 0.8} ${cx - eyeSpacing + eyeW} ${eyeY} Z`;
  paths.push(leftEye);
  paths.push(`M ${cx - eyeSpacing + 4} ${eyeY - 1} C ${cx - eyeSpacing + 4} ${eyeY - 5} ${cx - eyeSpacing - 4} ${eyeY - 5} ${cx - eyeSpacing - 4} ${eyeY - 1} C ${cx - eyeSpacing - 4} ${eyeY + 3} ${cx - eyeSpacing + 4} ${eyeY + 3} ${cx - eyeSpacing + 4} ${eyeY - 1} Z`);
  paths.push(`M ${cx - eyeSpacing + 2} ${eyeY - 1} C ${cx - eyeSpacing + 2} ${eyeY - 3} ${cx - eyeSpacing - 2} ${eyeY - 3} ${cx - eyeSpacing - 2} ${eyeY - 1} C ${cx - eyeSpacing - 2} ${eyeY + 1} ${cx - eyeSpacing + 2} ${eyeY + 1} ${cx - eyeSpacing + 2} ${eyeY - 1} Z`);
  paths.push(`M ${cx - eyeSpacing - 2} ${eyeY - 3} C ${cx - eyeSpacing - 3} ${eyeY - 4} ${cx - eyeSpacing - 4} ${eyeY - 3} ${cx - eyeSpacing - 3} ${eyeY - 2} Z`);

  // FRIENDLY ARCHED EYEBROWS
  const browY = eyeY - eyeH - 4;
  paths.push(`M ${cx + eyeSpacing - eyeW - 3} ${browY + 4} Q ${cx + eyeSpacing} ${browY - 5} ${cx + eyeSpacing + eyeW + 3} ${browY + 3}`);
  paths.push(`M ${cx - eyeSpacing + eyeW + 3} ${browY + 4} Q ${cx - eyeSpacing} ${browY - 5} ${cx - eyeSpacing - eyeW - 3} ${browY + 3}`);

  // ROSY CHEEKS
  const cheekY = baseY + headH * 0.58;
  // Right cheek - rosy circle
  paths.push(`M ${cx + headW * 0.55} ${cheekY - 5} C ${cx + headW * 0.68} ${cheekY - 8} ${cx + headW * 0.75} ${cheekY} ${cx + headW * 0.72} ${cheekY + 8} C ${cx + headW * 0.68} ${cheekY + 14} ${cx + headW * 0.55} ${cheekY + 12} ${cx + headW * 0.5} ${cheekY + 5} C ${cx + headW * 0.48} ${cheekY} ${cx + headW * 0.5} ${cheekY - 3} ${cx + headW * 0.55} ${cheekY - 5} Z`);
  // Left cheek
  paths.push(`M ${cx - headW * 0.55} ${cheekY - 5} C ${cx - headW * 0.68} ${cheekY - 8} ${cx - headW * 0.75} ${cheekY} ${cx - headW * 0.72} ${cheekY + 8} C ${cx - headW * 0.68} ${cheekY + 14} ${cx - headW * 0.55} ${cheekY + 12} ${cx - headW * 0.5} ${cheekY + 5} C ${cx - headW * 0.48} ${cheekY} ${cx - headW * 0.5} ${cheekY - 3} ${cx - headW * 0.55} ${cheekY - 5} Z`);

  // BUTTON NOSE
  const noseY = baseY + headH * 0.6;
  let nose = `M ${cx} ${eyeY + 6}`;
  nose += ` C ${cx + 2} ${noseY - 6} ${cx + 5} ${noseY - 2} ${cx + 7} ${noseY + 2}`;
  nose += ` C ${cx + 8} ${noseY + 5} ${cx + 5} ${noseY + 8} ${cx} ${noseY + 7}`;
  nose += ` C ${cx - 5} ${noseY + 8} ${cx - 8} ${noseY + 5} ${cx - 7} ${noseY + 2}`;
  nose += ` C ${cx - 5} ${noseY - 2} ${cx - 2} ${noseY - 6} ${cx} ${eyeY + 6} Z`;
  paths.push(nose);
  // Nose tip highlight
  paths.push(`M ${cx - 2} ${noseY + 2} C ${cx - 1} ${noseY} ${cx + 1} ${noseY} ${cx + 2} ${noseY + 2} C ${cx + 1} ${noseY + 4} ${cx - 1} ${noseY + 4} ${cx - 2} ${noseY + 2} Z`);

  // CHEERFUL SMILE
  const lipY = baseY + headH * 0.75;
  // Big happy smile
  let smile = `M ${cx - 14} ${lipY}`;
  smile += ` Q ${cx - 8} ${lipY - 2} ${cx} ${lipY - 1}`;
  smile += ` Q ${cx + 8} ${lipY - 2} ${cx + 14} ${lipY}`;
  smile += ` Q ${cx + 10} ${lipY + 10} ${cx} ${lipY + 12}`;
  smile += ` Q ${cx - 10} ${lipY + 10} ${cx - 14} ${lipY} Z`;
  paths.push(smile);
  // Smile line
  paths.push(`M ${cx - 12} ${lipY + 2} Q ${cx} ${lipY + 4} ${cx + 12} ${lipY + 2}`);

  // Small rounded ears
  const earY = baseY + headH * 0.4;
  // Right ear
  paths.push(`M ${cx + headW * 0.92} ${earY} C ${cx + headW + 5} ${earY - 5} ${cx + headW + 10} ${earY} ${cx + headW + 10} ${earY + 10} C ${cx + headW + 10} ${earY + 18} ${cx + headW + 3} ${earY + 22} ${cx + headW * 0.92} ${earY + 18} Z`);
  // Left ear
  paths.push(`M ${cx - headW * 0.92} ${earY} C ${cx - headW - 5} ${earY - 5} ${cx - headW - 10} ${earY} ${cx - headW - 10} ${earY + 10} C ${cx - headW - 10} ${earY + 18} ${cx - headW - 3} ${earY + 22} ${cx - headW * 0.92} ${earY + 18} Z`);

  // SHORT NECK
  const neckTop = baseY + headH;
  const neckW = 16 * p.neckWidth;
  const neckH = 15;
  
  let neck = `M ${cx - headW * 0.32} ${neckTop}`;
  neck += ` C ${cx - neckW * 1.1} ${neckTop + 4} ${cx - neckW * 1.0} ${neckTop + neckH} ${cx - neckW * 1.2} ${neckTop + neckH}`;
  neck += ` L ${cx + neckW * 1.2} ${neckTop + neckH}`;
  neck += ` C ${cx + neckW * 1.0} ${neckTop + neckH} ${cx + neckW * 1.1} ${neckTop + 4} ${cx + headW * 0.32} ${neckTop} Z`;
  paths.push(neck);

  // STOUT ROUND TORSO
  const torsoTop = neckTop + neckH;
  const shoulderW = 52 * p.shoulderWidth;
  const waistW = 40 * p.waistWidth;
  const hipW = 42 * p.hipWidth;
  const torsoH = 65; // Shorter torso

  let torso = `M ${cx - neckW * 1.2} ${torsoTop}`;
  // Rounded shoulders
  torso += ` C ${cx - shoulderW * 0.5} ${torsoTop - 3} ${cx - shoulderW * 0.8} ${torsoTop + 8} ${cx - shoulderW} ${torsoTop + 15}`;
  torso += ` C ${cx - shoulderW - 6} ${torsoTop + 22} ${cx - shoulderW - 4} ${torsoTop + 32} ${cx - shoulderW + 3} ${torsoTop + 38}`;
  // Round belly
  torso += ` C ${cx - waistW - 5} ${torsoTop + torsoH * 0.5} ${cx - waistW - 8} ${torsoTop + torsoH * 0.7} ${cx - waistW - 5} ${torsoTop + torsoH * 0.85}`;
  torso += ` C ${cx - hipW + 2} ${torsoTop + torsoH * 0.95} ${cx - hipW} ${torsoTop + torsoH} ${cx - hipW + 5} ${torsoTop + torsoH + 5}`;
  // Round hip
  torso += ` C ${cx - hipW * 0.4} ${torsoTop + torsoH + 10} ${cx} ${torsoTop + torsoH + 12} ${cx + hipW * 0.4} ${torsoTop + torsoH + 10}`;
  torso += ` C ${cx + hipW} ${torsoTop + torsoH + 5} ${cx + hipW - 2} ${torsoTop + torsoH * 0.95} ${cx + waistW + 5} ${torsoTop + torsoH * 0.85}`;
  torso += ` C ${cx + waistW + 8} ${torsoTop + torsoH * 0.7} ${cx + waistW + 5} ${torsoTop + torsoH * 0.5} ${cx + shoulderW - 3} ${torsoTop + 38}`;
  torso += ` C ${cx + shoulderW + 4} ${torsoTop + 32} ${cx + shoulderW + 6} ${torsoTop + 22} ${cx + shoulderW} ${torsoTop + 15}`;
  torso += ` C ${cx + shoulderW * 0.8} ${torsoTop + 8} ${cx + shoulderW * 0.5} ${torsoTop - 3} ${cx + neckW * 1.2} ${torsoTop} Z`;
  paths.push(torso);

  // Soft chest definition
  if (gender === 'female') {
    paths.push(`M ${cx - 5} ${torsoTop + 18} C ${cx - 18} ${torsoTop + 16} ${cx - 24} ${torsoTop + 26} ${cx - 22} ${torsoTop + 34} C ${cx - 20} ${torsoTop + 40} ${cx - 12} ${torsoTop + 42} ${cx - 5} ${torsoTop + 38} Z`);
    paths.push(`M ${cx + 5} ${torsoTop + 18} C ${cx + 18} ${torsoTop + 16} ${cx + 24} ${torsoTop + 26} ${cx + 22} ${torsoTop + 34} C ${cx + 20} ${torsoTop + 40} ${cx + 12} ${torsoTop + 42} ${cx + 5} ${torsoTop + 38} Z`);
  }
  
  // Belly button
  paths.push(`M ${cx - 3} ${torsoTop + torsoH * 0.6} C ${cx - 2} ${torsoTop + torsoH * 0.58} ${cx + 2} ${torsoTop + torsoH * 0.58} ${cx + 3} ${torsoTop + torsoH * 0.6} C ${cx + 2} ${torsoTop + torsoH * 0.64} ${cx - 2} ${torsoTop + torsoH * 0.64} ${cx - 3} ${torsoTop + torsoH * 0.6} Z`);

  // ARMS - Short and sturdy
  const armStartY = torsoTop + 15;
  const upperArmL = 35;
  const forearmL = 32;
  const armW = gender === 'male' ? 12 : 10;

  // Left arm
  let leftArm = `M ${cx - shoulderW} ${armStartY}`;
  leftArm += ` C ${cx - shoulderW - 10} ${armStartY + 12} ${cx - shoulderW - 14} ${armStartY + upperArmL - 8} ${cx - shoulderW - 12} ${armStartY + upperArmL}`;
  leftArm += ` C ${cx - shoulderW - 16} ${armStartY + upperArmL + 8} ${cx - shoulderW - 12} ${armStartY + upperArmL + forearmL - 8} ${cx - shoulderW - 10} ${armStartY + upperArmL + forearmL}`;
  // Small hand
  leftArm += ` C ${cx - shoulderW - 5} ${armStartY + upperArmL + forearmL + 18} ${cx - shoulderW + 12} ${armStartY + upperArmL + forearmL + 22} ${cx - shoulderW + 10} ${armStartY + upperArmL + forearmL + 5}`;
  leftArm += ` C ${cx - shoulderW + armW + 4} ${armStartY + upperArmL + 18} ${cx - shoulderW + armW} ${armStartY + 12} ${cx - shoulderW + 5} ${armStartY} Z`;
  paths.push(leftArm);

  // Right arm
  let rightArm = `M ${cx + shoulderW} ${armStartY}`;
  rightArm += ` C ${cx + shoulderW + 10} ${armStartY + 12} ${cx + shoulderW + 14} ${armStartY + upperArmL - 8} ${cx + shoulderW + 12} ${armStartY + upperArmL}`;
  rightArm += ` C ${cx + shoulderW + 16} ${armStartY + upperArmL + 8} ${cx + shoulderW + 12} ${armStartY + upperArmL + forearmL - 8} ${cx + shoulderW + 10} ${armStartY + upperArmL + forearmL}`;
  rightArm += ` C ${cx + shoulderW + 5} ${armStartY + upperArmL + forearmL + 18} ${cx + shoulderW - 12} ${armStartY + upperArmL + forearmL + 22} ${cx + shoulderW - 10} ${armStartY + upperArmL + forearmL + 5}`;
  rightArm += ` C ${cx + shoulderW - armW - 4} ${armStartY + upperArmL + 18} ${cx + shoulderW - armW} ${armStartY + 12} ${cx + shoulderW - 5} ${armStartY} Z`;
  paths.push(rightArm);

  // Small fingers
  const handY = armStartY + upperArmL + forearmL + 5;
  for (let side = -1; side <= 1; side += 2) {
    const handX = cx + side * (shoulderW - 3);
    for (let f = 0; f < 5; f++) {
      const fingerW = f === 0 ? 3.5 : 3;
      const fingerL = f === 0 ? 10 : 13 + (2 - Math.abs(f - 2)) * 2;
      const fingerX = handX + side * (f * 4.5 - 7);
      const fingerY = f === 0 ? handY + 6 : handY + 14;
      paths.push(`M ${fingerX - fingerW} ${fingerY} L ${fingerX - fingerW * 0.8} ${fingerY + fingerL} Q ${fingerX} ${fingerY + fingerL + 2} ${fingerX + fingerW * 0.8} ${fingerY + fingerL} L ${fingerX + fingerW} ${fingerY} Z`);
    }
  }

  // SHORT LEGS with BIG FEET
  const legTop = torsoTop + torsoH + 8;
  const thighL = 40; // Short legs
  const calfL = 35;
  const legW = gender === 'male' ? 18 : 16;

  // Left leg
  let leftLeg = `M ${cx - hipW * 0.12} ${legTop}`;
  leftLeg += ` C ${cx - hipW * 0.35} ${legTop + 6} ${cx - hipW * 0.48} ${legTop + 15} ${cx - legW - 6} ${legTop + thighL * 0.6}`;
  leftLeg += ` C ${cx - legW - 10} ${legTop + thighL * 0.85} ${cx - legW - 8} ${legTop + thighL} ${cx - legW - 6} ${legTop + thighL + 5}`;
  leftLeg += ` C ${cx - legW - 8} ${legTop + thighL + 15} ${cx - legW - 4} ${legTop + thighL + calfL - 8} ${cx - legW - 2} ${legTop + thighL + calfL}`;
  // BIG HAIRY FOOT
  const footY = legTop + thighL + calfL;
  leftLeg += ` L ${cx - legW - 2} ${footY + 5}`;
  leftLeg += ` C ${cx - legW - 5} ${footY + 8} ${cx - 45} ${footY + 12} ${cx - 48} ${footY + 18}`;
  // Big toe area
  leftLeg += ` C ${cx - 52} ${footY + 22} ${cx - 50} ${footY + 28} ${cx - 45} ${footY + 30}`;
  leftLeg += ` L ${cx - 8} ${footY + 30}`;
  leftLeg += ` L ${cx - 8} ${footY + 5}`;
  // Inner leg
  leftLeg += ` C ${cx - 6} ${legTop + thighL + 12} ${cx - 10} ${legTop + 15} ${cx - hipW * 0.12} ${legTop} Z`;
  paths.push(leftLeg);
  
  // Foot hair tufts (left)
  for (let i = 0; i < 6; i++) {
    const tuftX = cx - 45 + i * 6;
    const tuftY = footY + 18;
    paths.push(`M ${tuftX} ${tuftY} C ${tuftX - 2} ${tuftY - 5} ${tuftX + 2} ${tuftY - 6} ${tuftX + 1} ${tuftY - 2}`);
  }

  // Right leg
  let rightLeg = `M ${cx + hipW * 0.12} ${legTop}`;
  rightLeg += ` C ${cx + hipW * 0.35} ${legTop + 6} ${cx + hipW * 0.48} ${legTop + 15} ${cx + legW + 6} ${legTop + thighL * 0.6}`;
  rightLeg += ` C ${cx + legW + 10} ${legTop + thighL * 0.85} ${cx + legW + 8} ${legTop + thighL} ${cx + legW + 6} ${legTop + thighL + 5}`;
  rightLeg += ` C ${cx + legW + 8} ${legTop + thighL + 15} ${cx + legW + 4} ${legTop + thighL + calfL - 8} ${cx + legW + 2} ${legTop + thighL + calfL}`;
  // BIG FOOT
  rightLeg += ` L ${cx + legW + 2} ${footY + 5}`;
  rightLeg += ` C ${cx + legW + 5} ${footY + 8} ${cx + 45} ${footY + 12} ${cx + 48} ${footY + 18}`;
  rightLeg += ` C ${cx + 52} ${footY + 22} ${cx + 50} ${footY + 28} ${cx + 45} ${footY + 30}`;
  rightLeg += ` L ${cx + 8} ${footY + 30}`;
  rightLeg += ` L ${cx + 8} ${footY + 5}`;
  rightLeg += ` C ${cx + 6} ${legTop + thighL + 12} ${cx + 10} ${legTop + 15} ${cx + hipW * 0.12} ${legTop} Z`;
  paths.push(rightLeg);
  
  // Foot hair tufts (right)
  for (let i = 0; i < 6; i++) {
    const tuftX = cx + 45 - i * 6;
    const tuftY = footY + 18;
    paths.push(`M ${tuftX} ${tuftY} C ${tuftX + 2} ${tuftY - 5} ${tuftX - 2} ${tuftY - 6} ${tuftX - 1} ${tuftY - 2}`);
  }

  return paths;
};

// ============================================================================
// COMPONENT EXPORTS
// ============================================================================
interface AvatarSilhouetteProps {
  race: 'orc' | 'halfling';
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
    orc: generateOrcSilhouette,
    halfling: generateHalflingSilhouette,
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
