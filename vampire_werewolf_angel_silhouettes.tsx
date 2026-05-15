// KasVillage Identity Ritual - Vampire, Werewolf, Angel Silhouettes
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
// VAMPIRE - Aristocratic, pale, sharp features, fangs, high collar cape
// ============================================================================
export const generateVampireSilhouette = (gender: Gender, seed: number): string[] => {
  const p = BODY_PARAMS[gender];
  const r = (i: number) => seededRandom(seed + i);
  const paths: string[] = [];
  
  const cx = 200, baseY = 42;
  const headW = 38 * p.jawWidth;
  const headH = 48;
  
  // ARISTOCRATIC SKULL - Sharp angular features
  let skull = `M ${cx} ${baseY}`;
  // High forehead with widow's peak suggestion
  for (let i = 0; i <= 32; i++) {
    const angle = (i / 32) * Math.PI;
    const sharp = Math.sin(i * 0.5) * 1.5;
    const rx = headW * (0.95 + r(i) * 0.03);
    const ry = headH * 0.52;
    const x = cx + Math.sin(angle) * rx;
    const y = baseY + 4 - Math.cos(angle) * ry + sharp;
    skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  // Sharp temples
  skull += ` C ${cx + headW * 0.92} ${baseY + headH * 0.3} ${cx + headW * 1.0} ${baseY + headH * 0.38} ${cx + headW * 0.98} ${baseY + headH * 0.45}`;
  // High sharp cheekbones - aristocratic
  skull += ` C ${cx + headW * 1.05} ${baseY + headH * 0.52} ${cx + headW * 1.02} ${baseY + headH * 0.62} ${cx + headW * 0.92} ${baseY + headH * 0.7}`;
  // Angular jaw tapering to pointed chin
  skull += ` C ${cx + headW * 0.8} ${baseY + headH * 0.82} ${cx + headW * 0.55} ${baseY + headH * 0.92} ${cx + headW * 0.3} ${baseY + headH * 0.98}`;
  skull += ` C ${cx + headW * 0.12} ${baseY + headH * 1.02} ${cx} ${baseY + headH * 1.05} ${cx} ${baseY + headH * 1.05}`;
  // Left side mirror
  skull += ` C ${cx} ${baseY + headH * 1.05} ${cx - headW * 0.12} ${baseY + headH * 1.02} ${cx - headW * 0.3} ${baseY + headH * 0.98}`;
  skull += ` C ${cx - headW * 0.55} ${baseY + headH * 0.92} ${cx - headW * 0.8} ${baseY + headH * 0.82} ${cx - headW * 0.92} ${baseY + headH * 0.7}`;
  skull += ` C ${cx - headW * 1.02} ${baseY + headH * 0.62} ${cx - headW * 1.05} ${baseY + headH * 0.52} ${cx - headW * 0.98} ${baseY + headH * 0.45}`;
  skull += ` C ${cx - headW * 1.0} ${baseY + headH * 0.38} ${cx - headW * 0.92} ${baseY + headH * 0.3} ${cx - headW * 0.9} ${baseY + headH * 0.15}`;
  skull += ' Z';
  paths.push(skull);

  // SLICKED BACK HAIR with widow's peak
  let hair = `M ${cx} ${baseY - 5}`;
  // Widow's peak point
  hair += ` L ${cx} ${baseY + 8}`;
  hair += ` L ${cx + 8} ${baseY + 2}`;
  // Sweep back over skull
  for (let i = 0; i <= 20; i++) {
    const angle = (i / 20) * Math.PI * 0.9;
    const slick = i * 0.3;
    const x = cx + Math.sin(angle) * (headW * 1.08 + slick);
    const y = baseY - 6 - Math.cos(angle) * headH * 0.48 + slick * 0.5;
    hair += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  
  if (gender === 'female') {
    // Long flowing hair
    hair += ` C ${cx + headW * 1.25} ${baseY + headH * 0.4} ${cx + headW * 1.3} ${baseY + headH + 30} ${cx + headW * 1.1} ${baseY + headH + 80}`;
    for (let i = 0; i < 8; i++) {
      const wave = Math.sin(i * 0.7) * 8;
      hair += ` C ${cx + headW * (1.0 - i * 0.15) + wave} ${baseY + headH + 85 + i * 8} ${cx + headW * (0.9 - i * 0.15) - wave} ${baseY + headH + 90 + i * 8} ${cx + headW * (0.8 - i * 0.15)} ${baseY + headH + 95 + i * 6}`;
    }
    hair += ` L ${cx - headW * 0.8} ${baseY + headH + 150}`;
    for (let i = 7; i >= 0; i--) {
      const wave = Math.sin(i * 0.7) * 8;
      hair += ` C ${cx - headW * (0.9 - i * 0.15) + wave} ${baseY + headH + 90 + i * 8} ${cx - headW * (1.0 - i * 0.15) - wave} ${baseY + headH + 85 + i * 8} ${cx - headW * (1.05 - i * 0.12)} ${baseY + headH + 80 + i * 5}`;
    }
    hair += ` C ${cx - headW * 1.3} ${baseY + headH + 30} ${cx - headW * 1.25} ${baseY + headH * 0.4} ${cx - headW * 1.1} ${baseY - 5}`;
  } else {
    // Short slicked back
    hair += ` C ${cx + headW * 1.15} ${baseY + headH * 0.35} ${cx + headW * 1.1} ${baseY + headH * 0.55} ${cx + headW * 0.95} ${baseY + headH * 0.5}`;
    hair += ` L ${cx - headW * 0.95} ${baseY + headH * 0.5}`;
    hair += ` C ${cx - headW * 1.1} ${baseY + headH * 0.55} ${cx - headW * 1.15} ${baseY + headH * 0.35} ${cx - headW * 1.1} ${baseY - 5}`;
  }
  // Back to widow's peak
  hair += ` L ${cx - 8} ${baseY + 2}`;
  hair += ' Z';
  paths.push(hair);
  
  // Slick hair lines
  for (let i = -3; i <= 3; i++) {
    const lineX = cx + i * 8;
    paths.push(`M ${lineX} ${baseY + 5} C ${lineX + i * 2} ${baseY - 5} ${lineX + i * 3} ${baseY - 15} ${lineX + i * 4} ${baseY - 20}`);
  }

  // INTENSE EYES - Hypnotic, slightly slanted
  const eyeY = baseY + headH * 0.42;
  const eyeSpacing = headW * 0.32;
  const eyeW = 10, eyeH = 6;
  
  // Right eye - sharp almond shape
  let rightEye = `M ${cx + eyeSpacing - eyeW - 3} ${eyeY + 2}`;
  rightEye += ` C ${cx + eyeSpacing - eyeW} ${eyeY - 1} ${cx + eyeSpacing - 4} ${eyeY - eyeH} ${cx + eyeSpacing + 2} ${eyeY - eyeH + 1}`;
  rightEye += ` C ${cx + eyeSpacing + eyeW - 2} ${eyeY - eyeH + 2} ${cx + eyeSpacing + eyeW + 2} ${eyeY - 1} ${cx + eyeSpacing + eyeW + 4} ${eyeY + 1}`;
  rightEye += ` C ${cx + eyeSpacing + eyeW + 1} ${eyeY + 3} ${cx + eyeSpacing + 3} ${eyeY + eyeH * 0.6} ${cx + eyeSpacing - 3} ${eyeY + eyeH * 0.5}`;
  rightEye += ` C ${cx + eyeSpacing - eyeW} ${eyeY + eyeH * 0.4} ${cx + eyeSpacing - eyeW - 2} ${eyeY + 3} ${cx + eyeSpacing - eyeW - 3} ${eyeY + 2} Z`;
  paths.push(rightEye);
  // Iris
  paths.push(`M ${cx + eyeSpacing - 4} ${eyeY - 1} C ${cx + eyeSpacing - 4} ${eyeY - 5} ${cx + eyeSpacing + 4} ${eyeY - 5} ${cx + eyeSpacing + 4} ${eyeY - 1} C ${cx + eyeSpacing + 4} ${eyeY + 3} ${cx + eyeSpacing - 4} ${eyeY + 3} ${cx + eyeSpacing - 4} ${eyeY - 1} Z`);
  // Pupil - vertical slit for vampiric look
  paths.push(`M ${cx + eyeSpacing - 1} ${eyeY - 3} C ${cx + eyeSpacing + 1} ${eyeY - 2} ${cx + eyeSpacing + 1} ${eyeY + 2} ${cx + eyeSpacing - 1} ${eyeY + 3} C ${cx + eyeSpacing - 1.5} ${eyeY + 1} ${cx + eyeSpacing - 1.5} ${eyeY - 1} ${cx + eyeSpacing - 1} ${eyeY - 3} Z`);
  
  // Left eye
  let leftEye = `M ${cx - eyeSpacing + eyeW + 3} ${eyeY + 2}`;
  leftEye += ` C ${cx - eyeSpacing + eyeW} ${eyeY - 1} ${cx - eyeSpacing + 4} ${eyeY - eyeH} ${cx - eyeSpacing - 2} ${eyeY - eyeH + 1}`;
  leftEye += ` C ${cx - eyeSpacing - eyeW + 2} ${eyeY - eyeH + 2} ${cx - eyeSpacing - eyeW - 2} ${eyeY - 1} ${cx - eyeSpacing - eyeW - 4} ${eyeY + 1}`;
  leftEye += ` C ${cx - eyeSpacing - eyeW - 1} ${eyeY + 3} ${cx - eyeSpacing - 3} ${eyeY + eyeH * 0.6} ${cx - eyeSpacing + 3} ${eyeY + eyeH * 0.5}`;
  leftEye += ` C ${cx - eyeSpacing + eyeW} ${eyeY + eyeH * 0.4} ${cx - eyeSpacing + eyeW + 2} ${eyeY + 3} ${cx - eyeSpacing + eyeW + 3} ${eyeY + 2} Z`;
  paths.push(leftEye);
  paths.push(`M ${cx - eyeSpacing + 4} ${eyeY - 1} C ${cx - eyeSpacing + 4} ${eyeY - 5} ${cx - eyeSpacing - 4} ${eyeY - 5} ${cx - eyeSpacing - 4} ${eyeY - 1} C ${cx - eyeSpacing - 4} ${eyeY + 3} ${cx - eyeSpacing + 4} ${eyeY + 3} ${cx - eyeSpacing + 4} ${eyeY - 1} Z`);
  paths.push(`M ${cx - eyeSpacing + 1} ${eyeY - 3} C ${cx - eyeSpacing - 1} ${eyeY - 2} ${cx - eyeSpacing - 1} ${eyeY + 2} ${cx - eyeSpacing + 1} ${eyeY + 3} C ${cx - eyeSpacing + 1.5} ${eyeY + 1} ${cx - eyeSpacing + 1.5} ${eyeY - 1} ${cx - eyeSpacing + 1} ${eyeY - 3} Z`);

  // Sharp arched brows
  const browY = eyeY - eyeH - 5;
  paths.push(`M ${cx + eyeSpacing - eyeW - 5} ${browY + 6} L ${cx + eyeSpacing} ${browY - 4} L ${cx + eyeSpacing + eyeW + 6} ${browY + 2} L ${cx + eyeSpacing + eyeW + 4} ${browY + 4} L ${cx + eyeSpacing} ${browY - 1} L ${cx + eyeSpacing - eyeW - 3} ${browY + 7} Z`);
  paths.push(`M ${cx - eyeSpacing + eyeW + 5} ${browY + 6} L ${cx - eyeSpacing} ${browY - 4} L ${cx - eyeSpacing - eyeW - 6} ${browY + 2} L ${cx - eyeSpacing - eyeW - 4} ${browY + 4} L ${cx - eyeSpacing} ${browY - 1} L ${cx - eyeSpacing + eyeW + 3} ${browY + 7} Z`);

  // AQUILINE NOSE - Sharp aristocratic
  const noseY = baseY + headH * 0.65;
  let nose = `M ${cx} ${eyeY + 5}`;
  nose += ` C ${cx + 2} ${eyeY + 12} ${cx + 4} ${noseY - 12} ${cx + 5} ${noseY - 5}`;
  // Slight hook/aquiline curve
  nose += ` C ${cx + 6} ${noseY - 2} ${cx + 6} ${noseY + 2} ${cx + 5} ${noseY + 5}`;
  nose += ` C ${cx + 8} ${noseY + 7} ${cx + 9} ${noseY + 10} ${cx + 7} ${noseY + 12}`;
  nose += ` Q ${cx + 3} ${noseY + 14} ${cx} ${noseY + 12}`;
  nose += ` Q ${cx - 3} ${noseY + 14} ${cx - 7} ${noseY + 12}`;
  nose += ` C ${cx - 9} ${noseY + 10} ${cx - 8} ${noseY + 7} ${cx - 5} ${noseY + 5}`;
  nose += ` C ${cx - 6} ${noseY + 2} ${cx - 6} ${noseY - 2} ${cx - 5} ${noseY - 5}`;
  nose += ` C ${cx - 4} ${noseY - 12} ${cx - 2} ${eyeY + 12} ${cx} ${eyeY + 5} Z`;
  paths.push(nose);

  // LIPS with FANGS
  const lipY = baseY + headH * 0.82;
  const lipW = 12;
  // Upper lip with slight sneer
  let upperLip = `M ${cx - lipW} ${lipY}`;
  upperLip += ` C ${cx - lipW * 0.6} ${lipY - 2} ${cx - 2} ${lipY - 3.5} ${cx} ${lipY - 3}`;
  upperLip += ` C ${cx + 2} ${lipY - 3.5} ${cx + lipW * 0.6} ${lipY - 2} ${cx + lipW} ${lipY}`;
  upperLip += ` C ${cx + lipW * 0.5} ${lipY + 1.5} ${cx} ${lipY + 1} ${cx - lipW * 0.5} ${lipY + 1.5} Z`;
  paths.push(upperLip);
  // Lower lip
  let lowerLip = `M ${cx - lipW + 2} ${lipY + 2}`;
  lowerLip += ` C ${cx - lipW * 0.4} ${lipY + 2.5} ${cx} ${lipY + 2} ${cx + lipW * 0.4} ${lipY + 2.5}`;
  lowerLip += ` C ${cx + lipW - 2} ${lipY + 2} ${cx + lipW - 3} ${lipY + 6} ${cx} ${lipY + 7}`;
  lowerLip += ` C ${cx - lipW + 3} ${lipY + 6} ${cx - lipW + 2} ${lipY + 2} ${cx - lipW + 2} ${lipY + 2} Z`;
  paths.push(lowerLip);
  
  // FANGS - protruding from upper lip
  const fangLength = gender === 'male' ? 12 : 10;
  // Right fang
  paths.push(`M ${cx + 5} ${lipY + 1} L ${cx + 6} ${lipY + fangLength} L ${cx + 7.5} ${lipY + fangLength - 2} L ${cx + 8} ${lipY + 1} Z`);
  // Left fang
  paths.push(`M ${cx - 5} ${lipY + 1} L ${cx - 6} ${lipY + fangLength} L ${cx - 7.5} ${lipY + fangLength - 2} L ${cx - 8} ${lipY + 1} Z`);

  // ELEGANT EARS
  const earY = baseY + headH * 0.38;
  // Right ear - slightly pointed
  let rightEar = `M ${cx + headW * 0.95} ${earY}`;
  rightEar += ` C ${cx + headW + 4} ${earY - 3} ${cx + headW + 8} ${earY + 2} ${cx + headW + 10} ${earY + 8}`;
  rightEar += ` C ${cx + headW + 11} ${earY + 14} ${cx + headW + 8} ${earY + 22} ${cx + headW + 4} ${earY + 25}`;
  rightEar += ` C ${cx + headW + 1} ${earY + 27} ${cx + headW * 0.96} ${earY + 24} ${cx + headW * 0.94} ${earY + 20}`;
  rightEar += ' Z';
  paths.push(rightEar);
  paths.push(`M ${cx + headW * 0.98} ${earY + 5} C ${cx + headW + 3} ${earY + 8} ${cx + headW + 4} ${earY + 15} ${cx + headW + 2} ${earY + 20}`);
  
  // Left ear
  let leftEar = `M ${cx - headW * 0.95} ${earY}`;
  leftEar += ` C ${cx - headW - 4} ${earY - 3} ${cx - headW - 8} ${earY + 2} ${cx - headW - 10} ${earY + 8}`;
  leftEar += ` C ${cx - headW - 11} ${earY + 14} ${cx - headW - 8} ${earY + 22} ${cx - headW - 4} ${earY + 25}`;
  leftEar += ` C ${cx - headW - 1} ${earY + 27} ${cx - headW * 0.96} ${earY + 24} ${cx - headW * 0.94} ${earY + 20}`;
  leftEar += ' Z';
  paths.push(leftEar);
  paths.push(`M ${cx - headW * 0.98} ${earY + 5} C ${cx - headW - 3} ${earY + 8} ${cx - headW - 4} ${earY + 15} ${cx - headW - 2} ${earY + 20}`);

  // NECK - Elegant
  const neckTop = baseY + headH * 1.05;
  const neckW = 18 * p.neckWidth;
  const neckH = 25;
  
  let neck = `M ${cx - headW * 0.3} ${neckTop}`;
  neck += ` C ${cx - neckW * 1.0} ${neckTop + 5} ${cx - neckW * 1.1} ${neckTop + neckH * 0.6} ${cx - neckW * 1.2} ${neckTop + neckH}`;
  neck += ` L ${cx + neckW * 1.2} ${neckTop + neckH}`;
  neck += ` C ${cx + neckW * 1.1} ${neckTop + neckH * 0.6} ${cx + neckW * 1.0} ${neckTop + 5} ${cx + headW * 0.3} ${neckTop} Z`;
  paths.push(neck);

  // HIGH COLLAR CAPE - Dramatic vampire cape
  const capeTop = neckTop + neckH - 5;
  const collarH = 55;
  
  // Right collar standing up
  let rightCollar = `M ${cx + neckW * 0.8} ${capeTop}`;
  rightCollar += ` C ${cx + neckW * 1.5} ${capeTop - 10} ${cx + 55} ${capeTop - collarH * 0.5} ${cx + 60} ${capeTop - collarH * 0.75}`;
  rightCollar += ` C ${cx + 62} ${capeTop - collarH * 0.9} ${cx + 58} ${capeTop - collarH} ${cx + 52} ${capeTop - collarH + 5}`;
  // Collar inner curve
  rightCollar += ` C ${cx + 45} ${capeTop - collarH * 0.7} ${cx + 38} ${capeTop - collarH * 0.4} ${cx + 32} ${capeTop - 8}`;
  rightCollar += ` C ${cx + 28} ${capeTop} ${cx + neckW * 1.0} ${capeTop + 3} ${cx + neckW * 0.8} ${capeTop} Z`;
  paths.push(rightCollar);
  
  // Left collar
  let leftCollar = `M ${cx - neckW * 0.8} ${capeTop}`;
  leftCollar += ` C ${cx - neckW * 1.5} ${capeTop - 10} ${cx - 55} ${capeTop - collarH * 0.5} ${cx - 60} ${capeTop - collarH * 0.75}`;
  leftCollar += ` C ${cx - 62} ${capeTop - collarH * 0.9} ${cx - 58} ${capeTop - collarH} ${cx - 52} ${capeTop - collarH + 5}`;
  leftCollar += ` C ${cx - 45} ${capeTop - collarH * 0.7} ${cx - 38} ${capeTop - collarH * 0.4} ${cx - 32} ${capeTop - 8}`;
  leftCollar += ` C ${cx - 28} ${capeTop} ${cx - neckW * 1.0} ${capeTop + 3} ${cx - neckW * 0.8} ${capeTop} Z`;
  paths.push(leftCollar);
  
  // Collar detail lines
  for (let i = 0; i < 5; i++) {
    const t = i / 5;
    paths.push(`M ${cx + 35 + t * 20} ${capeTop - 10 - t * 30} C ${cx + 38 + t * 18} ${capeTop - 15 - t * 28} ${cx + 40 + t * 15} ${capeTop - 20 - t * 25} ${cx + 42 + t * 12} ${capeTop - 25 - t * 20}`);
    paths.push(`M ${cx - 35 - t * 20} ${capeTop - 10 - t * 30} C ${cx - 38 - t * 18} ${capeTop - 15 - t * 28} ${cx - 40 - t * 15} ${capeTop - 20 - t * 25} ${cx - 42 - t * 12} ${capeTop - 25 - t * 20}`);
  }

  // TORSO with cape draped over
  const torsoTop = capeTop + 5;
  const shoulderW = 65 * p.shoulderWidth;
  const waistW = 32 * p.waistWidth;
  const hipW = 38 * p.hipWidth;
  const torsoH = 90;

  let torso = `M ${cx - neckW * 1.2} ${torsoTop}`;
  torso += ` C ${cx - shoulderW * 0.5} ${torsoTop - 3} ${cx - shoulderW * 0.8} ${torsoTop + 10} ${cx - shoulderW} ${torsoTop + 18}`;
  torso += ` C ${cx - shoulderW - 6} ${torsoTop + 25} ${cx - shoulderW - 3} ${torsoTop + 38} ${cx - shoulderW + 4} ${torsoTop + 45}`;
  torso += ` C ${cx - waistW - 10} ${torsoTop + torsoH * 0.5} ${cx - waistW - 4} ${torsoTop + torsoH * 0.7} ${cx - waistW} ${torsoTop + torsoH * 0.8}`;
  torso += ` C ${cx - hipW + 4} ${torsoTop + torsoH * 0.92} ${cx - hipW} ${torsoTop + torsoH} ${cx - hipW + 2} ${torsoTop + torsoH + 4}`;
  torso += ` C ${cx - hipW * 0.4} ${torsoTop + torsoH + 7} ${cx} ${torsoTop + torsoH + 8} ${cx + hipW * 0.4} ${torsoTop + torsoH + 7}`;
  torso += ` C ${cx + hipW} ${torsoTop + torsoH + 4} ${cx + hipW - 4} ${torsoTop + torsoH * 0.92} ${cx + waistW} ${torsoTop + torsoH * 0.8}`;
  torso += ` C ${cx + waistW + 4} ${torsoTop + torsoH * 0.7} ${cx + waistW + 10} ${torsoTop + torsoH * 0.5} ${cx + shoulderW - 4} ${torsoTop + 45}`;
  torso += ` C ${cx + shoulderW + 3} ${torsoTop + 38} ${cx + shoulderW + 6} ${torsoTop + 25} ${cx + shoulderW} ${torsoTop + 18}`;
  torso += ` C ${cx + shoulderW * 0.8} ${torsoTop + 10} ${cx + shoulderW * 0.5} ${torsoTop - 3} ${cx + neckW * 1.2} ${torsoTop} Z`;
  paths.push(torso);

  // Vest/jacket details
  paths.push(`M ${cx} ${torsoTop + 15} L ${cx} ${torsoTop + torsoH - 10}`);
  paths.push(`M ${cx - 12} ${torsoTop + 20} L ${cx - 10} ${torsoTop + torsoH - 15}`);
  paths.push(`M ${cx + 12} ${torsoTop + 20} L ${cx + 10} ${torsoTop + torsoH - 15}`);
  // Buttons
  for (let b = 0; b < 5; b++) {
    const buttonY = torsoTop + 25 + b * 14;
    paths.push(`M ${cx - 3} ${buttonY} C ${cx - 3} ${buttonY - 2.5} ${cx + 3} ${buttonY - 2.5} ${cx + 3} ${buttonY} C ${cx + 3} ${buttonY + 2.5} ${cx - 3} ${buttonY + 2.5} ${cx - 3} ${buttonY} Z`);
  }

  // CAPE flowing down from shoulders
  let capeRight = `M ${cx + shoulderW} ${torsoTop + 18}`;
  capeRight += ` C ${cx + shoulderW + 25} ${torsoTop + 50} ${cx + shoulderW + 35} ${torsoTop + 100} ${cx + shoulderW + 40} ${torsoTop + 150}`;
  capeRight += ` C ${cx + shoulderW + 45} ${torsoTop + 200} ${cx + hipW + 50} ${torsoTop + 250} ${cx + hipW + 35} ${torsoTop + 280}`;
  capeRight += ` L ${cx + hipW + 5} ${torsoTop + 285}`;
  capeRight += ` C ${cx + hipW + 8} ${torsoTop + 230} ${cx + hipW + 5} ${torsoTop + 180} ${cx + hipW} ${torsoTop + 130}`;
  capeRight += ` C ${cx + hipW - 5} ${torsoTop + 80} ${cx + shoulderW - 10} ${torsoTop + 50} ${cx + shoulderW - 5} ${torsoTop + 30}`;
  capeRight += ' Z';
  paths.push(capeRight);
  
  let capeLeft = `M ${cx - shoulderW} ${torsoTop + 18}`;
  capeLeft += ` C ${cx - shoulderW - 25} ${torsoTop + 50} ${cx - shoulderW - 35} ${torsoTop + 100} ${cx - shoulderW - 40} ${torsoTop + 150}`;
  capeLeft += ` C ${cx - shoulderW - 45} ${torsoTop + 200} ${cx - hipW - 50} ${torsoTop + 250} ${cx - hipW - 35} ${torsoTop + 280}`;
  capeLeft += ` L ${cx - hipW - 5} ${torsoTop + 285}`;
  capeLeft += ` C ${cx - hipW - 8} ${torsoTop + 230} ${cx - hipW - 5} ${torsoTop + 180} ${cx - hipW} ${torsoTop + 130}`;
  capeLeft += ` C ${cx - hipW + 5} ${torsoTop + 80} ${cx - shoulderW + 10} ${torsoTop + 50} ${cx - shoulderW + 5} ${torsoTop + 30}`;
  capeLeft += ' Z';
  paths.push(capeLeft);
  
  // Cape drape folds
  for (let f = 0; f < 6; f++) {
    const foldY = torsoTop + 60 + f * 35;
    paths.push(`M ${cx + shoulderW + 5 + f * 5} ${foldY} C ${cx + shoulderW + 10 + f * 6} ${foldY + 15} ${cx + shoulderW + 8 + f * 5} ${foldY + 30} ${cx + shoulderW + 12 + f * 5} ${foldY + 35}`);
    paths.push(`M ${cx - shoulderW - 5 - f * 5} ${foldY} C ${cx - shoulderW - 10 - f * 6} ${foldY + 15} ${cx - shoulderW - 8 - f * 5} ${foldY + 30} ${cx - shoulderW - 12 - f * 5} ${foldY + 35}`);
  }

  // ARMS (partially visible from cape)
  const armStartY = torsoTop + 18;
  const upperArmL = 48;
  const forearmL = 44;
  const armW = gender === 'male' ? 11 : 8;

  // Left arm
  let leftArm = `M ${cx - shoulderW} ${armStartY}`;
  leftArm += ` C ${cx - shoulderW - 8} ${armStartY + 15} ${cx - shoulderW - 12} ${armStartY + upperArmL - 10} ${cx - shoulderW - 10} ${armStartY + upperArmL}`;
  leftArm += ` C ${cx - shoulderW - 14} ${armStartY + upperArmL + 10} ${cx - shoulderW - 10} ${armStartY + upperArmL + forearmL - 10} ${cx - shoulderW - 8} ${armStartY + upperArmL + forearmL}`;
  leftArm += ` C ${cx - shoulderW - 4} ${armStartY + upperArmL + forearmL + 18} ${cx - shoulderW + 10} ${armStartY + upperArmL + forearmL + 22} ${cx - shoulderW + 8} ${armStartY + upperArmL + forearmL + 5}`;
  leftArm += ` C ${cx - shoulderW + armW + 4} ${armStartY + upperArmL + 25} ${cx - shoulderW + armW} ${armStartY + 15} ${cx - shoulderW + 5} ${armStartY} Z`;
  paths.push(leftArm);

  // Right arm
  let rightArm = `M ${cx + shoulderW} ${armStartY}`;
  rightArm += ` C ${cx + shoulderW + 8} ${armStartY + 15} ${cx + shoulderW + 12} ${armStartY + upperArmL - 10} ${cx + shoulderW + 10} ${armStartY + upperArmL}`;
  rightArm += ` C ${cx + shoulderW + 14} ${armStartY + upperArmL + 10} ${cx + shoulderW + 10} ${armStartY + upperArmL + forearmL - 10} ${cx + shoulderW + 8} ${armStartY + upperArmL + forearmL}`;
  rightArm += ` C ${cx + shoulderW + 4} ${armStartY + upperArmL + forearmL + 18} ${cx + shoulderW - 10} ${armStartY + upperArmL + forearmL + 22} ${cx + shoulderW - 8} ${armStartY + upperArmL + forearmL + 5}`;
  rightArm += ` C ${cx + shoulderW - armW - 4} ${armStartY + upperArmL + 25} ${cx + shoulderW - armW} ${armStartY + 15} ${cx + shoulderW - 5} ${armStartY} Z`;
  paths.push(rightArm);

  // Elegant long fingers
  const handY = armStartY + upperArmL + forearmL + 5;
  for (let side = -1; side <= 1; side += 2) {
    const handX = cx + side * (shoulderW - 3);
    for (let f = 0; f < 5; f++) {
      const fingerW = 2;
      const fingerL = f === 0 ? 12 : 18 + (2 - Math.abs(f - 2)) * 3;
      const fingerX = handX + side * (f * 4 - 6);
      const fingerY = f === 0 ? handY + 8 : handY + 15;
      // Long elegant pointed fingers
      paths.push(`M ${fingerX - fingerW} ${fingerY} L ${fingerX - fingerW * 0.5} ${fingerY + fingerL - 3} L ${fingerX} ${fingerY + fingerL + 2} L ${fingerX + fingerW * 0.5} ${fingerY + fingerL - 3} L ${fingerX + fingerW} ${fingerY} Z`);
    }
  }

  // LEGS
  const legTop = torsoTop + torsoH + 5;
  const thighL = 60;
  const calfL = 55;
  const legW = gender === 'male' ? 16 : 13;

  // Left leg
  let leftLeg = `M ${cx - hipW * 0.12} ${legTop}`;
  leftLeg += ` C ${cx - hipW * 0.32} ${legTop + 8} ${cx - hipW * 0.48} ${legTop + 18} ${cx - legW - 6} ${legTop + thighL * 0.55}`;
  leftLeg += ` C ${cx - legW - 9} ${legTop + thighL * 0.8} ${cx - legW - 7} ${legTop + thighL} ${cx - legW - 5} ${legTop + thighL + 6}`;
  leftLeg += ` C ${cx - legW - 7} ${legTop + thighL + 20} ${cx - legW - 3} ${legTop + thighL + calfL - 10} ${cx - legW} ${legTop + thighL + calfL}`;
  // Pointed boot
  leftLeg += ` L ${cx - legW - 4} ${legTop + thighL + calfL + 8}`;
  leftLeg += ` C ${cx - 38} ${legTop + thighL + calfL + 15} ${cx - 42} ${legTop + thighL + calfL + 22} ${cx - 45} ${legTop + thighL + calfL + 25}`;
  leftLeg += ` C ${cx - 35} ${legTop + thighL + calfL + 28} ${cx - 10} ${legTop + thighL + calfL + 28} ${cx - 8} ${legTop + thighL + calfL + 5}`;
  leftLeg += ` C ${cx - 6} ${legTop + thighL + 18} ${cx - 10} ${legTop + 18} ${cx - hipW * 0.12} ${legTop} Z`;
  paths.push(leftLeg);

  // Right leg
  let rightLeg = `M ${cx + hipW * 0.12} ${legTop}`;
  rightLeg += ` C ${cx + hipW * 0.32} ${legTop + 8} ${cx + hipW * 0.48} ${legTop + 18} ${cx + legW + 6} ${legTop + thighL * 0.55}`;
  rightLeg += ` C ${cx + legW + 9} ${legTop + thighL * 0.8} ${cx + legW + 7} ${legTop + thighL} ${cx + legW + 5} ${legTop + thighL + 6}`;
  rightLeg += ` C ${cx + legW + 7} ${legTop + thighL + 20} ${cx + legW + 3} ${legTop + thighL + calfL - 10} ${cx + legW} ${legTop + thighL + calfL}`;
  rightLeg += ` L ${cx + legW + 4} ${legTop + thighL + calfL + 8}`;
  rightLeg += ` C ${cx + 38} ${legTop + thighL + calfL + 15} ${cx + 42} ${legTop + thighL + calfL + 22} ${cx + 45} ${legTop + thighL + calfL + 25}`;
  rightLeg += ` C ${cx + 35} ${legTop + thighL + calfL + 28} ${cx + 10} ${legTop + thighL + calfL + 28} ${cx + 8} ${legTop + thighL + calfL + 5}`;
  rightLeg += ` C ${cx + 6} ${legTop + thighL + 18} ${cx + 10} ${legTop + 18} ${cx + hipW * 0.12} ${legTop} Z`;
  paths.push(rightLeg);

  return paths;
};

// ============================================================================
// WEREWOLF - Lupine humanoid, fur, claws, wolf head, muscular
// ============================================================================
export const generateWerewolfSilhouette = (gender: Gender, seed: number): string[] => {
  const p = BODY_PARAMS[gender];
  const r = (i: number) => seededRandom(seed + i);
  const paths: string[] = [];
  
  const cx = 200, baseY = 35;
  const headW = 48 * p.jawWidth;
  const headH = 55;
  
  // WOLF SKULL - Elongated muzzle, fur
  let skull = `M ${cx} ${baseY}`;
  // Furry crown with tufts
  for (let i = 0; i <= 35; i++) {
    const angle = (i / 35) * Math.PI;
    const fur = Math.sin(i * 1.5) * 4 + r(i) * 3;
    const rx = headW * (0.9 + r(i + 30) * 0.05);
    const ry = headH * 0.48;
    const x = cx + Math.sin(angle) * rx;
    const y = baseY + 8 - Math.cos(angle) * ry + fur;
    skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  // Pronounced brow
  skull += ` C ${cx + headW * 0.88} ${baseY + headH * 0.3} ${cx + headW * 1.0} ${baseY + headH * 0.38} ${cx + headW * 0.95} ${baseY + headH * 0.45}`;
  // Wide powerful jaw with fur
  skull += ` C ${cx + headW * 1.02} ${baseY + headH * 0.52} ${cx + headW * 0.98} ${baseY + headH * 0.62} ${cx + headW * 0.85} ${baseY + headH * 0.72}`;
  // Muzzle begins
  skull += ` C ${cx + headW * 0.75} ${baseY + headH * 0.8} ${cx + headW * 0.55} ${baseY + headH * 0.88} ${cx + headW * 0.35} ${baseY + headH * 0.92}`;
  skull += ` C ${cx + headW * 0.15} ${baseY + headH * 0.95} ${cx} ${baseY + headH * 0.96} ${cx} ${baseY + headH * 0.96}`;
  // Left side mirror
  skull += ` C ${cx} ${baseY + headH * 0.96} ${cx - headW * 0.15} ${baseY + headH * 0.95} ${cx - headW * 0.35} ${baseY + headH * 0.92}`;
  skull += ` C ${cx - headW * 0.55} ${baseY + headH * 0.88} ${cx - headW * 0.75} ${baseY + headH * 0.8} ${cx - headW * 0.85} ${baseY + headH * 0.72}`;
  skull += ` C ${cx - headW * 0.98} ${baseY + headH * 0.62} ${cx - headW * 1.02} ${baseY + headH * 0.52} ${cx - headW * 0.95} ${baseY + headH * 0.45}`;
  skull += ` C ${cx - headW * 1.0} ${baseY + headH * 0.38} ${cx - headW * 0.88} ${baseY + headH * 0.3} ${cx - headW * 0.85} ${baseY + headH * 0.15}`;
  skull += ' Z';
  paths.push(skull);

  // WOLF MUZZLE - Extended snout
  const muzzleY = baseY + headH * 0.65;
  const muzzleL = 35;
  let muzzle = `M ${cx - headW * 0.35} ${muzzleY}`;
  muzzle += ` C ${cx - headW * 0.4} ${muzzleY + 8} ${cx - headW * 0.35} ${muzzleY + 18} ${cx - 18} ${muzzleY + muzzleL - 8}`;
  // Nose tip
  muzzle += ` C ${cx - 12} ${muzzleY + muzzleL - 3} ${cx - 8} ${muzzleY + muzzleL} ${cx} ${muzzleY + muzzleL + 2}`;
  muzzle += ` C ${cx + 8} ${muzzleY + muzzleL} ${cx + 12} ${muzzleY + muzzleL - 3} ${cx + 18} ${muzzleY + muzzleL - 8}`;
  muzzle += ` C ${cx + headW * 0.35} ${muzzleY + 18} ${cx + headW * 0.4} ${muzzleY + 8} ${cx + headW * 0.35} ${muzzleY}`;
  muzzle += ' Z';
  paths.push(muzzle);
  
  // Wolf nose
  paths.push(`M ${cx - 8} ${muzzleY + muzzleL - 5} C ${cx - 10} ${muzzleY + muzzleL - 10} ${cx - 5} ${muzzleY + muzzleL - 12} ${cx} ${muzzleY + muzzleL - 10} C ${cx + 5} ${muzzleY + muzzleL - 12} ${cx + 10} ${muzzleY + muzzleL - 10} ${cx + 8} ${muzzleY + muzzleL - 5} C ${cx + 5} ${muzzleY + muzzleL - 2} ${cx - 5} ${muzzleY + muzzleL - 2} ${cx - 8} ${muzzleY + muzzleL - 5} Z`);
  // Nostril details
  paths.push(`M ${cx - 5} ${muzzleY + muzzleL - 6} C ${cx - 6} ${muzzleY + muzzleL - 8} ${cx - 3} ${muzzleY + muzzleL - 9} ${cx - 2} ${muzzleY + muzzleL - 7} Z`);
  paths.push(`M ${cx + 5} ${muzzleY + muzzleL - 6} C ${cx + 6} ${muzzleY + muzzleL - 8} ${cx + 3} ${muzzleY + muzzleL - 9} ${cx + 2} ${muzzleY + muzzleL - 7} Z`);
  
  // Snarling mouth line
  paths.push(`M ${cx - 15} ${muzzleY + muzzleL - 2} C ${cx - 8} ${muzzleY + muzzleL + 5} ${cx + 8} ${muzzleY + muzzleL + 5} ${cx + 15} ${muzzleY + muzzleL - 2}`);

  // POINTED WOLF EARS - Large and alert
  const earY = baseY + headH * 0.08;
  const earH = 45;
  const earW = 22;
  
  // Right ear
  let rightEar = `M ${cx + headW * 0.6} ${earY + 15}`;
  rightEar += ` C ${cx + headW * 0.7} ${earY + 5} ${cx + headW * 0.8} ${earY - 10} ${cx + headW * 0.75 + earW * 0.3} ${earY - earH * 0.5}`;
  rightEar += ` C ${cx + headW * 0.7 + earW * 0.5} ${earY - earH * 0.75} ${cx + headW * 0.65 + earW * 0.6} ${earY - earH * 0.95} ${cx + headW * 0.6 + earW * 0.5} ${earY - earH}`;
  // Pointed tip
  rightEar += ` C ${cx + headW * 0.55 + earW * 0.3} ${earY - earH * 0.9} ${cx + headW * 0.5 + earW * 0.1} ${earY - earH * 0.7} ${cx + headW * 0.5} ${earY - earH * 0.4}`;
  rightEar += ` C ${cx + headW * 0.52} ${earY - 8} ${cx + headW * 0.55} ${earY + 5} ${cx + headW * 0.58} ${earY + 18}`;
  rightEar += ' Z';
  paths.push(rightEar);
  // Inner ear detail
  paths.push(`M ${cx + headW * 0.58} ${earY + 10} C ${cx + headW * 0.62} ${earY - 5} ${cx + headW * 0.65} ${earY - 20} ${cx + headW * 0.6 + earW * 0.35} ${earY - earH * 0.6}`);
  
  // Left ear
  let leftEar = `M ${cx - headW * 0.6} ${earY + 15}`;
  leftEar += ` C ${cx - headW * 0.7} ${earY + 5} ${cx - headW * 0.8} ${earY - 10} ${cx - headW * 0.75 - earW * 0.3} ${earY - earH * 0.5}`;
  leftEar += ` C ${cx - headW * 0.7 - earW * 0.5} ${earY - earH * 0.75} ${cx - headW * 0.65 - earW * 0.6} ${earY - earH * 0.95} ${cx - headW * 0.6 - earW * 0.5} ${earY - earH}`;
  leftEar += ` C ${cx - headW * 0.55 - earW * 0.3} ${earY - earH * 0.9} ${cx - headW * 0.5 - earW * 0.1} ${earY - earH * 0.7} ${cx - headW * 0.5} ${earY - earH * 0.4}`;
  leftEar += ` C ${cx - headW * 0.52} ${earY - 8} ${cx - headW * 0.55} ${earY + 5} ${cx - headW * 0.58} ${earY + 18}`;
  leftEar += ' Z';
  paths.push(leftEar);
  paths.push(`M ${cx - headW * 0.58} ${earY + 10} C ${cx - headW * 0.62} ${earY - 5} ${cx - headW * 0.65} ${earY - 20} ${cx - headW * 0.6 - earW * 0.35} ${earY - earH * 0.6}`);

  // FUR TEXTURE on head
  for (let i = 0; i < 25; i++) {
    const furX = cx + (r(100 + i) - 0.5) * headW * 1.6;
    const furY = baseY + r(120 + i) * headH * 0.5;
    const furL = 5 + r(140 + i) * 8;
    const furAngle = (r(160 + i) - 0.5) * 0.8;
    paths.push(`M ${furX} ${furY} L ${furX + Math.sin(furAngle) * furL} ${furY - Math.cos(furAngle) * furL}`);
  }

  // FERAL EYES - Yellow wolf eyes
  const eyeY = baseY + headH * 0.42;
  const eyeSpacing = headW * 0.35;
  const eyeW = 10, eyeH = 7;
  
  // Right eye - angular feral
  let rightEye = `M ${cx + eyeSpacing - eyeW - 2} ${eyeY + 2}`;
  rightEye += ` C ${cx + eyeSpacing - eyeW} ${eyeY - 1} ${cx + eyeSpacing - 3} ${eyeY - eyeH} ${cx + eyeSpacing + 2} ${eyeY - eyeH + 2}`;
  rightEye += ` C ${cx + eyeSpacing + eyeW - 2} ${eyeY - eyeH + 3} ${cx + eyeSpacing + eyeW + 1} ${eyeY} ${cx + eyeSpacing + eyeW + 3} ${eyeY + 2}`;
  rightEye += ` C ${cx + eyeSpacing + eyeW} ${eyeY + 4} ${cx + eyeSpacing + 2} ${eyeY + eyeH * 0.6} ${cx + eyeSpacing - 4} ${eyeY + eyeH * 0.5}`;
  rightEye += ` C ${cx + eyeSpacing - eyeW} ${eyeY + eyeH * 0.4} ${cx + eyeSpacing - eyeW - 1} ${eyeY + 3} ${cx + eyeSpacing - eyeW - 2} ${eyeY + 2} Z`;
  paths.push(rightEye);
  // Wolf iris
  paths.push(`M ${cx + eyeSpacing - 4} ${eyeY - 1} C ${cx + eyeSpacing - 4} ${eyeY - 5} ${cx + eyeSpacing + 4} ${eyeY - 5} ${cx + eyeSpacing + 4} ${eyeY - 1} C ${cx + eyeSpacing + 4} ${eyeY + 3} ${cx + eyeSpacing - 4} ${eyeY + 3} ${cx + eyeSpacing - 4} ${eyeY - 1} Z`);
  // Vertical slit pupil
  paths.push(`M ${cx + eyeSpacing - 1.5} ${eyeY - 4} L ${cx + eyeSpacing + 1.5} ${eyeY - 3} L ${cx + eyeSpacing + 1.5} ${eyeY + 3} L ${cx + eyeSpacing - 1.5} ${eyeY + 4} Z`);
  
  // Left eye
  let leftEye = `M ${cx - eyeSpacing + eyeW + 2} ${eyeY + 2}`;
  leftEye += ` C ${cx - eyeSpacing + eyeW} ${eyeY - 1} ${cx - eyeSpacing + 3} ${eyeY - eyeH} ${cx - eyeSpacing - 2} ${eyeY - eyeH + 2}`;
  leftEye += ` C ${cx - eyeSpacing - eyeW + 2} ${eyeY - eyeH + 3} ${cx - eyeSpacing - eyeW - 1} ${eyeY} ${cx - eyeSpacing - eyeW - 3} ${eyeY + 2}`;
  leftEye += ` C ${cx - eyeSpacing - eyeW} ${eyeY + 4} ${cx - eyeSpacing - 2} ${eyeY + eyeH * 0.6} ${cx - eyeSpacing + 4} ${eyeY + eyeH * 0.5}`;
  leftEye += ` C ${cx - eyeSpacing + eyeW} ${eyeY + eyeH * 0.4} ${cx - eyeSpacing + eyeW + 1} ${eyeY + 3} ${cx - eyeSpacing + eyeW + 2} ${eyeY + 2} Z`;
  paths.push(leftEye);
  paths.push(`M ${cx - eyeSpacing + 4} ${eyeY - 1} C ${cx - eyeSpacing + 4} ${eyeY - 5} ${cx - eyeSpacing - 4} ${eyeY - 5} ${cx - eyeSpacing - 4} ${eyeY - 1} C ${cx - eyeSpacing - 4} ${eyeY + 3} ${cx - eyeSpacing + 4} ${eyeY + 3} ${cx - eyeSpacing + 4} ${eyeY - 1} Z`);
  paths.push(`M ${cx - eyeSpacing + 1.5} ${eyeY - 4} L ${cx - eyeSpacing - 1.5} ${eyeY - 3} L ${cx - eyeSpacing - 1.5} ${eyeY + 3} L ${cx - eyeSpacing + 1.5} ${eyeY + 4} Z`);

  // Heavy brows
  paths.push(`M ${cx + eyeSpacing - eyeW - 6} ${eyeY - eyeH - 2} L ${cx + eyeSpacing + 2} ${eyeY - eyeH - 8} L ${cx + eyeSpacing + eyeW + 5} ${eyeY - eyeH - 3} L ${cx + eyeSpacing + eyeW + 3} ${eyeY - eyeH} L ${cx + eyeSpacing} ${eyeY - eyeH - 4} L ${cx + eyeSpacing - eyeW - 4} ${eyeY - eyeH + 1} Z`);
  paths.push(`M ${cx - eyeSpacing + eyeW + 6} ${eyeY - eyeH - 2} L ${cx - eyeSpacing - 2} ${eyeY - eyeH - 8} L ${cx - eyeSpacing - eyeW - 5} ${eyeY - eyeH - 3} L ${cx - eyeSpacing - eyeW - 3} ${eyeY - eyeH} L ${cx - eyeSpacing} ${eyeY - eyeH - 4} L ${cx - eyeSpacing + eyeW + 4} ${eyeY - eyeH + 1} Z`);

  // THICK FURRY NECK
  const neckTop = baseY + headH * 0.96;
  const neckW = 32 * p.neckWidth;
  const neckH = 28;
  
  let neck = `M ${cx - headW * 0.5} ${neckTop}`;
  // Furry edges
  neck += ` C ${cx - neckW * 1.2} ${neckTop + 5} ${cx - neckW * 1.4} ${neckTop + neckH * 0.5} ${cx - neckW * 1.5} ${neckTop + neckH}`;
  neck += ` L ${cx + neckW * 1.5} ${neckTop + neckH}`;
  neck += ` C ${cx + neckW * 1.4} ${neckTop + neckH * 0.5} ${cx + neckW * 1.2} ${neckTop + 5} ${cx + headW * 0.5} ${neckTop} Z`;
  paths.push(neck);
  
  // Neck fur
  for (let i = 0; i < 12; i++) {
    const furX = cx + (i - 5.5) * 8;
    const furY = neckTop + 5;
    paths.push(`M ${furX} ${furY} L ${furX + (r(200 + i) - 0.5) * 4} ${furY + 8 + r(210 + i) * 6}`);
  }

  // MASSIVE MUSCULAR TORSO
  const torsoTop = neckTop + neckH;
  const shoulderW = 88 * p.shoulderWidth;
  const waistW = 50 * p.waistWidth;
  const hipW = 48 * p.hipWidth;
  const torsoH = 95;

  let torso = `M ${cx - neckW * 1.5} ${torsoTop}`;
  // Huge trap muscles
  torso += ` C ${cx - shoulderW * 0.5} ${torsoTop - 8} ${cx - shoulderW * 0.8} ${torsoTop + 10} ${cx - shoulderW} ${torsoTop + 22}`;
  torso += ` C ${cx - shoulderW - 12} ${torsoTop + 32} ${cx - shoulderW - 8} ${torsoTop + 48} ${cx - shoulderW + 5} ${torsoTop + 55}`;
  torso += ` C ${cx - waistW - 15} ${torsoTop + torsoH * 0.55} ${cx - waistW - 6} ${torsoTop + torsoH * 0.72} ${cx - waistW} ${torsoTop + torsoH * 0.82}`;
  torso += ` C ${cx - hipW + 5} ${torsoTop + torsoH * 0.92} ${cx - hipW} ${torsoTop + torsoH} ${cx - hipW + 3} ${torsoTop + torsoH + 5}`;
  torso += ` C ${cx - hipW * 0.4} ${torsoTop + torsoH + 8} ${cx} ${torsoTop + torsoH + 10} ${cx + hipW * 0.4} ${torsoTop + torsoH + 8}`;
  torso += ` C ${cx + hipW} ${torsoTop + torsoH + 5} ${cx + hipW - 5} ${torsoTop + torsoH * 0.92} ${cx + waistW} ${torsoTop + torsoH * 0.82}`;
  torso += ` C ${cx + waistW + 6} ${torsoTop + torsoH * 0.72} ${cx + waistW + 15} ${torsoTop + torsoH * 0.55} ${cx + shoulderW - 5} ${torsoTop + 55}`;
  torso += ` C ${cx + shoulderW + 8} ${torsoTop + 48} ${cx + shoulderW + 12} ${torsoTop + 32} ${cx + shoulderW} ${torsoTop + 22}`;
  torso += ` C ${cx + shoulderW * 0.8} ${torsoTop + 10} ${cx + shoulderW * 0.5} ${torsoTop - 8} ${cx + neckW * 1.5} ${torsoTop} Z`;
  paths.push(torso);

  // Chest/pec definition with fur
  paths.push(`M ${cx - 8} ${torsoTop + 18} C ${cx - 32} ${torsoTop + 14} ${cx - 48} ${torsoTop + 28} ${cx - 45} ${torsoTop + 45} C ${cx - 42} ${torsoTop + 58} ${cx - 25} ${torsoTop + 62} ${cx - 8} ${torsoTop + 52} Z`);
  paths.push(`M ${cx + 8} ${torsoTop + 18} C ${cx + 32} ${torsoTop + 14} ${cx + 48} ${torsoTop + 28} ${cx + 45} ${torsoTop + 45} C ${cx + 42} ${torsoTop + 58} ${cx + 25} ${torsoTop + 62} ${cx + 8} ${torsoTop + 52} Z`);
  
  // Abs
  paths.push(`M ${cx} ${torsoTop + 55} L ${cx} ${torsoTop + torsoH - 10}`);
  for (let row = 0; row < 3; row++) {
    const absY = torsoTop + 60 + row * 14;
    paths.push(`M ${cx - 18} ${absY} Q ${cx} ${absY - 3} ${cx + 18} ${absY}`);
  }
  
  // Body fur texture
  for (let i = 0; i < 40; i++) {
    const furX = cx + (r(300 + i) - 0.5) * waistW * 2;
    const furY = torsoTop + 20 + r(320 + i) * torsoH * 0.7;
    const furL = 4 + r(340 + i) * 5;
    paths.push(`M ${furX} ${furY} L ${furX + (r(360 + i) - 0.5) * 3} ${furY + furL}`);
  }

  // MASSIVE CLAWED ARMS
  const armStartY = torsoTop + 22;
  const upperArmL = 55;
  const forearmL = 50;
  const armW = gender === 'male' ? 26 : 20;

  // Left arm
  let leftArm = `M ${cx - shoulderW} ${armStartY}`;
  leftArm += ` C ${cx - shoulderW - 20} ${armStartY + 18} ${cx - shoulderW - 28} ${armStartY + 38} ${cx - shoulderW - 25} ${armStartY + upperArmL}`;
  leftArm += ` C ${cx - shoulderW - 32} ${armStartY + upperArmL + 12} ${cx - shoulderW - 26} ${armStartY + upperArmL + forearmL - 12} ${cx - shoulderW - 22} ${armStartY + upperArmL + forearmL}`;
  // Clawed hand
  leftArm += ` L ${cx - shoulderW - 18} ${armStartY + upperArmL + forearmL + 10}`;
  leftArm += ` C ${cx - shoulderW - 10} ${armStartY + upperArmL + forearmL + 32} ${cx - shoulderW + 18} ${armStartY + upperArmL + forearmL + 38} ${cx - shoulderW + 15} ${armStartY + upperArmL + forearmL + 10}`;
  leftArm += ` C ${cx - shoulderW + armW + 8} ${armStartY + upperArmL + 32} ${cx - shoulderW + armW + 5} ${armStartY + 22} ${cx - shoulderW + 8} ${armStartY} Z`;
  paths.push(leftArm);

  // Right arm
  let rightArm = `M ${cx + shoulderW} ${armStartY}`;
  rightArm += ` C ${cx + shoulderW + 20} ${armStartY + 18} ${cx + shoulderW + 28} ${armStartY + 38} ${cx + shoulderW + 25} ${armStartY + upperArmL}`;
  rightArm += ` C ${cx + shoulderW + 32} ${armStartY + upperArmL + 12} ${cx + shoulderW + 26} ${armStartY + upperArmL + forearmL - 12} ${cx + shoulderW + 22} ${armStartY + upperArmL + forearmL}`;
  rightArm += ` L ${cx + shoulderW + 18} ${armStartY + upperArmL + forearmL + 10}`;
  rightArm += ` C ${cx + shoulderW + 10} ${armStartY + upperArmL + forearmL + 32} ${cx + shoulderW - 18} ${armStartY + upperArmL + forearmL + 38} ${cx + shoulderW - 15} ${armStartY + upperArmL + forearmL + 10}`;
  rightArm += ` C ${cx + shoulderW - armW - 8} ${armStartY + upperArmL + 32} ${cx + shoulderW - armW - 5} ${armStartY + 22} ${cx + shoulderW - 8} ${armStartY} Z`;
  paths.push(rightArm);

  // Clawed fingers
  const handY = armStartY + upperArmL + forearmL + 10;
  for (let side = -1; side <= 1; side += 2) {
    const handX = cx + side * (shoulderW - 8);
    for (let f = 0; f < 5; f++) {
      const fingerW = 4;
      const fingerL = f === 0 ? 18 : 25 + (2 - Math.abs(f - 2)) * 5;
      const clawL = 12;
      const fingerX = handX + side * (f * 7 - 12);
      const fingerY = f === 0 ? handY + 8 : handY + 20;
      // Finger
      paths.push(`M ${fingerX - fingerW} ${fingerY} L ${fingerX - fingerW * 0.7} ${fingerY + fingerL} L ${fingerX} ${fingerY + fingerL + 2} L ${fingerX + fingerW * 0.7} ${fingerY + fingerL} L ${fingerX + fingerW} ${fingerY} Z`);
      // Claw
      paths.push(`M ${fingerX - 2} ${fingerY + fingerL} L ${fingerX} ${fingerY + fingerL + clawL} L ${fingerX + 2} ${fingerY + fingerL} Z`);
    }
  }

  // WOLF TAIL
  const tailStart = torsoTop + torsoH;
  const tailLength = 80;
  
  let tail = `M ${cx + 5} ${tailStart}`;
  tail += ` C ${cx + 15} ${tailStart + 15} ${cx + 30} ${tailStart + 35} ${cx + 50} ${tailStart + 55}`;
  tail += ` C ${cx + 65} ${tailStart + 70} ${cx + 75} ${tailStart + tailLength - 10} ${cx + 78} ${tailStart + tailLength}`;
  // Furry tail tip
  tail += ` C ${cx + 82} ${tailStart + tailLength + 8} ${cx + 80} ${tailStart + tailLength + 5} ${cx + 72} ${tailStart + tailLength - 5}`;
  tail += ` C ${cx + 60} ${tailStart + tailLength - 20} ${cx + 45} ${tailStart + 50} ${cx + 30} ${tailStart + 30}`;
  tail += ` C ${cx + 18} ${tailStart + 15} ${cx + 8} ${tailStart + 5} ${cx - 5} ${tailStart}`;
  tail += ' Z';
  paths.push(tail);
  
  // Tail fur
  for (let i = 0; i < 10; i++) {
    const t = i / 10;
    const furX = cx + 15 + t * 55;
    const furY = tailStart + 15 + t * 60;
    paths.push(`M ${furX} ${furY} L ${furX + 5 + r(400 + i) * 5} ${furY + 3 + r(410 + i) * 4}`);
  }

  // POWERFUL DIGITIGRADE LEGS
  const legTop = torsoTop + torsoH + 8;
  const thighL = 60;
  const calfL = 55;
  const legW = gender === 'male' ? 24 : 20;

  // Left leg
  let leftLeg = `M ${cx - hipW * 0.15} ${legTop}`;
  leftLeg += ` C ${cx - hipW * 0.4} ${legTop + 10} ${cx - hipW * 0.55} ${legTop + 22} ${cx - legW - 10} ${legTop + thighL * 0.55}`;
  // Reverse knee
  leftLeg += ` C ${cx - legW - 15} ${legTop + thighL * 0.78} ${cx - legW - 18} ${legTop + thighL} ${cx - legW - 12} ${legTop + thighL + 10}`;
  leftLeg += ` C ${cx - legW - 8} ${legTop + thighL + 28} ${cx - legW + 5} ${legTop + thighL + calfL - 15} ${cx - legW + 8} ${legTop + thighL + calfL}`;
  // Clawed paw
  leftLeg += ` L ${cx - 40} ${legTop + thighL + calfL + 15}`;
  leftLeg += ` C ${cx - 50} ${legTop + thighL + calfL + 22} ${cx - 48} ${legTop + thighL + calfL + 32} ${cx - 12} ${legTop + thighL + calfL + 32}`;
  leftLeg += ` L ${cx - 10} ${legTop + thighL + calfL + 5}`;
  leftLeg += ` C ${cx - 8} ${legTop + thighL + 22} ${cx - 12} ${legTop + 22} ${cx - hipW * 0.15} ${legTop} Z`;
  paths.push(leftLeg);
  
  // Toe claws (left)
  for (let c = 0; c < 4; c++) {
    const clawX = cx - 42 + c * 10;
    const clawY = legTop + thighL + calfL + 28;
    paths.push(`M ${clawX} ${clawY} L ${clawX - 2} ${clawY + 12} L ${clawX + 2} ${clawY + 12} Z`);
  }

  // Right leg
  let rightLeg = `M ${cx + hipW * 0.15} ${legTop}`;
  rightLeg += ` C ${cx + hipW * 0.4} ${legTop + 10} ${cx + hipW * 0.55} ${legTop + 22} ${cx + legW + 10} ${legTop + thighL * 0.55}`;
  rightLeg += ` C ${cx + legW + 15} ${legTop + thighL * 0.78} ${cx + legW + 18} ${legTop + thighL} ${cx + legW + 12} ${legTop + thighL + 10}`;
  rightLeg += ` C ${cx + legW + 8} ${legTop + thighL + 28} ${cx + legW - 5} ${legTop + thighL + calfL - 15} ${cx + legW - 8} ${legTop + thighL + calfL}`;
  rightLeg += ` L ${cx + 40} ${legTop + thighL + calfL + 15}`;
  rightLeg += ` C ${cx + 50} ${legTop + thighL + calfL + 22} ${cx + 48} ${legTop + thighL + calfL + 32} ${cx + 12} ${legTop + thighL + calfL + 32}`;
  rightLeg += ` L ${cx + 10} ${legTop + thighL + calfL + 5}`;
  rightLeg += ` C ${cx + 8} ${legTop + thighL + 22} ${cx + 12} ${legTop + 22} ${cx + hipW * 0.15} ${legTop} Z`;
  paths.push(rightLeg);
  
  // Toe claws (right)
  for (let c = 0; c < 4; c++) {
    const clawX = cx + 42 - c * 10;
    const clawY = legTop + thighL + calfL + 28;
    paths.push(`M ${clawX} ${clawY} L ${clawX - 2} ${clawY + 12} L ${clawX + 2} ${clawY + 12} Z`);
  }

  return paths;
};

// ============================================================================
// ANGEL - Divine being with feathered wings, halo, ethereal beauty
// ============================================================================
export const generateAngelSilhouette = (gender: Gender, seed: number): string[] => {
  const p = BODY_PARAMS[gender];
  const r = (i: number) => seededRandom(seed + i);
  const paths: string[] = [];
  
  const cx = 200, baseY = 55;
  const headW = 36 * p.jawWidth;
  const headH = 44;
  
  // HALO - Divine ring above head
  const haloY = baseY - 25;
  const haloRx = 32, haloRy = 8;
  // Outer ring
  let halo = `M ${cx - haloRx} ${haloY}`;
  halo += ` C ${cx - haloRx} ${haloY - haloRy} ${cx + haloRx} ${haloY - haloRy} ${cx + haloRx} ${haloY}`;
  halo += ` C ${cx + haloRx} ${haloY + haloRy} ${cx - haloRx} ${haloY + haloRy} ${cx - haloRx} ${haloY} Z`;
  paths.push(halo);
  // Inner ring (hole)
  const innerRx = haloRx - 6, innerRy = haloRy - 2;
  paths.push(`M ${cx - innerRx} ${haloY} C ${cx - innerRx} ${haloY - innerRy} ${cx + innerRx} ${haloY - innerRy} ${cx + innerRx} ${haloY} C ${cx + innerRx} ${haloY + innerRy} ${cx - innerRx} ${haloY + innerRy} ${cx - innerRx} ${haloY} Z`);
  // Halo glow lines
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const glowX = cx + Math.cos(angle) * (haloRx + 5);
    const glowY = haloY + Math.sin(angle) * (haloRy + 3);
    const glowL = 6 + r(i) * 4;
    paths.push(`M ${glowX} ${glowY} L ${glowX + Math.cos(angle) * glowL} ${glowY + Math.sin(angle) * glowL * 0.4}`);
  }

  // BEAUTIFUL SERENE FACE
  let skull = `M ${cx} ${baseY}`;
  for (let i = 0; i <= 35; i++) {
    const angle = (i / 35) * Math.PI;
    const soft = Math.sin(i * 0.25) * 0.8;
    const rx = headW * (0.96 + soft * 0.02);
    const ry = headH * 0.52;
    const x = cx + Math.sin(angle) * rx;
    const y = baseY + 3 - Math.cos(angle) * ry;
    skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  // Soft graceful cheeks
  skull += ` C ${cx + headW * 0.92} ${baseY + headH * 0.35} ${cx + headW * 0.98} ${baseY + headH * 0.45} ${cx + headW * 0.96} ${baseY + headH * 0.52}`;
  skull += ` C ${cx + headW * 1.0} ${baseY + headH * 0.58} ${cx + headW * 0.96} ${baseY + headH * 0.68} ${cx + headW * 0.88} ${baseY + headH * 0.76}`;
  // Graceful jaw to gentle chin
  skull += ` C ${cx + headW * 0.75} ${baseY + headH * 0.86} ${cx + headW * 0.5} ${baseY + headH * 0.95} ${cx + headW * 0.25} ${baseY + headH * 0.99}`;
  skull += ` C ${cx + headW * 0.1} ${baseY + headH * 1.01} ${cx} ${baseY + headH * 1.02} ${cx} ${baseY + headH * 1.02}`;
  skull += ` C ${cx} ${baseY + headH * 1.02} ${cx - headW * 0.1} ${baseY + headH * 1.01} ${cx - headW * 0.25} ${baseY + headH * 0.99}`;
  skull += ` C ${cx - headW * 0.5} ${baseY + headH * 0.95} ${cx - headW * 0.75} ${baseY + headH * 0.86} ${cx - headW * 0.88} ${baseY + headH * 0.76}`;
  skull += ` C ${cx - headW * 0.96} ${baseY + headH * 0.68} ${cx - headW * 1.0} ${baseY + headH * 0.58} ${cx - headW * 0.96} ${baseY + headH * 0.52}`;
  skull += ` C ${cx - headW * 0.98} ${baseY + headH * 0.45} ${cx - headW * 0.92} ${baseY + headH * 0.35} ${cx - headW * 0.9} ${baseY + headH * 0.2}`;
  skull += ' Z';
  paths.push(skull);

  // FLOWING GOLDEN HAIR
  let hair = `M ${cx} ${baseY - 8}`;
  // Soft wavy crown
  for (let i = 0; i <= 28; i++) {
    const angle = (i / 28) * Math.PI;
    const wave = Math.sin(i * 0.5) * 3;
    const x = cx + Math.sin(angle) * (headW * 1.12 + wave);
    const y = baseY - 10 - Math.cos(angle) * headH * 0.5 + Math.sin(i * 0.8) * 2;
    hair += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  
  if (gender === 'female') {
    // Long flowing waves
    const hairLength = 100;
    hair += ` C ${cx + headW * 1.3} ${baseY + headH * 0.4} ${cx + headW * 1.35} ${baseY + headH + 30} ${cx + headW * 1.2} ${baseY + headH + hairLength * 0.5}`;
    // Flowing strands
    for (let i = 0; i < 12; i++) {
      const waveX = Math.sin(i * 0.4) * 10;
      const x = cx + headW * (1.1 - i * 0.12) + waveX;
      const y = baseY + headH + hairLength * 0.5 + i * 6;
      hair += ` C ${x + waveX * 0.3} ${y + 2} ${x - waveX * 0.3} ${y + 5} ${x - waveX * 0.2} ${y + 6}`;
    }
    hair += ` L ${cx - headW * 0.4} ${baseY + headH + hairLength}`;
    for (let i = 11; i >= 0; i--) {
      const waveX = Math.sin(i * 0.4) * 10;
      const x = cx - headW * (1.1 - i * 0.12) - waveX;
      const y = baseY + headH + hairLength * 0.5 + i * 6;
      hair += ` C ${x - waveX * 0.2} ${y + 5} ${x + waveX * 0.3} ${y + 2} ${x + waveX * 0.2} ${y - 3}`;
    }
    hair += ` C ${cx - headW * 1.35} ${baseY + headH + 30} ${cx - headW * 1.3} ${baseY + headH * 0.4} ${cx - headW * 1.12} ${baseY - 8}`;
  } else {
    // Shorter wavy
    hair += ` C ${cx + headW * 1.2} ${baseY + headH * 0.4} ${cx + headW * 1.15} ${baseY + headH + 15} ${cx + headW * 0.9} ${baseY + headH + 35}`;
    for (let i = 0; i < 5; i++) {
      const wave = Math.sin(i * 0.6) * 5;
      hair += ` C ${cx + headW * (0.8 - i * 0.2) + wave} ${baseY + headH + 38 + i * 4} ${cx + headW * (0.7 - i * 0.2) - wave} ${baseY + headH + 40 + i * 4} ${cx + headW * (0.6 - i * 0.2)} ${baseY + headH + 42 + i * 3}`;
    }
    hair += ` L ${cx - headW * 0.6} ${baseY + headH + 55}`;
    hair += ` C ${cx - headW * 1.15} ${baseY + headH + 15} ${cx - headW * 1.2} ${baseY + headH * 0.4} ${cx - headW * 1.12} ${baseY - 8}`;
  }
  hair += ' Z';
  paths.push(hair);

  // SERENE EYES - Kind and luminous
  const eyeY = baseY + headH * 0.42;
  const eyeSpacing = headW * 0.3;
  const eyeW = 10, eyeH = 7;
  
  // Right eye
  let rightEye = `M ${cx + eyeSpacing - eyeW} ${eyeY}`;
  rightEye += ` C ${cx + eyeSpacing - eyeW} ${eyeY - eyeH} ${cx + eyeSpacing + eyeW} ${eyeY - eyeH} ${cx + eyeSpacing + eyeW} ${eyeY}`;
  rightEye += ` C ${cx + eyeSpacing + eyeW} ${eyeY + eyeH * 0.6} ${cx + eyeSpacing - eyeW} ${eyeY + eyeH * 0.6} ${cx + eyeSpacing - eyeW} ${eyeY} Z`;
  paths.push(rightEye);
  // Iris
  paths.push(`M ${cx + eyeSpacing - 4} ${eyeY - 1} C ${cx + eyeSpacing - 4} ${eyeY - 5} ${cx + eyeSpacing + 4} ${eyeY - 5} ${cx + eyeSpacing + 4} ${eyeY - 1} C ${cx + eyeSpacing + 4} ${eyeY + 3} ${cx + eyeSpacing - 4} ${eyeY + 3} ${cx + eyeSpacing - 4} ${eyeY - 1} Z`);
  // Pupil
  paths.push(`M ${cx + eyeSpacing - 2} ${eyeY - 1} C ${cx + eyeSpacing - 2} ${eyeY - 3} ${cx + eyeSpacing + 2} ${eyeY - 3} ${cx + eyeSpacing + 2} ${eyeY - 1} C ${cx + eyeSpacing + 2} ${eyeY + 1} ${cx + eyeSpacing - 2} ${eyeY + 1} ${cx + eyeSpacing - 2} ${eyeY - 1} Z`);
  // Sparkle
  paths.push(`M ${cx + eyeSpacing + 2} ${eyeY - 3} C ${cx + eyeSpacing + 3.5} ${eyeY - 4.5} ${cx + eyeSpacing + 5} ${eyeY - 3} ${cx + eyeSpacing + 3.5} ${eyeY - 1.5} Z`);
  
  // Left eye
  let leftEye = `M ${cx - eyeSpacing + eyeW} ${eyeY}`;
  leftEye += ` C ${cx - eyeSpacing + eyeW} ${eyeY - eyeH} ${cx - eyeSpacing - eyeW} ${eyeY - eyeH} ${cx - eyeSpacing - eyeW} ${eyeY}`;
  leftEye += ` C ${cx - eyeSpacing - eyeW} ${eyeY + eyeH * 0.6} ${cx - eyeSpacing + eyeW} ${eyeY + eyeH * 0.6} ${cx - eyeSpacing + eyeW} ${eyeY} Z`;
  paths.push(leftEye);
  paths.push(`M ${cx - eyeSpacing + 4} ${eyeY - 1} C ${cx - eyeSpacing + 4} ${eyeY - 5} ${cx - eyeSpacing - 4} ${eyeY - 5} ${cx - eyeSpacing - 4} ${eyeY - 1} C ${cx - eyeSpacing - 4} ${eyeY + 3} ${cx - eyeSpacing + 4} ${eyeY + 3} ${cx - eyeSpacing + 4} ${eyeY - 1} Z`);
  paths.push(`M ${cx - eyeSpacing + 2} ${eyeY - 1} C ${cx - eyeSpacing + 2} ${eyeY - 3} ${cx - eyeSpacing - 2} ${eyeY - 3} ${cx - eyeSpacing - 2} ${eyeY - 1} C ${cx - eyeSpacing - 2} ${eyeY + 1} ${cx - eyeSpacing + 2} ${eyeY + 1} ${cx - eyeSpacing + 2} ${eyeY - 1} Z`);
  paths.push(`M ${cx - eyeSpacing - 2} ${eyeY - 3} C ${cx - eyeSpacing - 3.5} ${eyeY - 4.5} ${cx - eyeSpacing - 5} ${eyeY - 3} ${cx - eyeSpacing - 3.5} ${eyeY - 1.5} Z`);

  // Gentle arched brows
  paths.push(`M ${cx + eyeSpacing - eyeW - 4} ${eyeY - eyeH - 4} Q ${cx + eyeSpacing} ${eyeY - eyeH - 10} ${cx + eyeSpacing + eyeW + 4} ${eyeY - eyeH - 3}`);
  paths.push(`M ${cx - eyeSpacing + eyeW + 4} ${eyeY - eyeH - 4} Q ${cx - eyeSpacing} ${eyeY - eyeH - 10} ${cx - eyeSpacing - eyeW - 4} ${eyeY - eyeH - 3}`);

  // Delicate nose
  const noseY = baseY + headH * 0.62;
  paths.push(`M ${cx} ${eyeY + 6} C ${cx + 2} ${noseY - 6} ${cx + 4} ${noseY} ${cx + 5} ${noseY + 3} C ${cx + 6} ${noseY + 6} ${cx + 4} ${noseY + 8} ${cx} ${noseY + 7} C ${cx - 4} ${noseY + 8} ${cx - 6} ${noseY + 6} ${cx - 5} ${noseY + 3} C ${cx - 4} ${noseY} ${cx - 2} ${noseY - 6} ${cx} ${eyeY + 6} Z`);

  // Gentle serene smile
  const lipY = baseY + headH * 0.78;
  const lipW = 10;
  // Upper lip
  paths.push(`M ${cx - lipW} ${lipY} C ${cx - lipW * 0.5} ${lipY - 2} ${cx - 1.5} ${lipY - 3} ${cx} ${lipY - 2.5} C ${cx + 1.5} ${lipY - 3} ${cx + lipW * 0.5} ${lipY - 2} ${cx + lipW} ${lipY} C ${cx + lipW * 0.5} ${lipY + 1} ${cx} ${lipY + 0.5} ${cx - lipW * 0.5} ${lipY + 1} Z`);
  // Lower lip
  paths.push(`M ${cx - lipW + 1} ${lipY + 1.5} C ${cx - lipW * 0.3} ${lipY + 2} ${cx} ${lipY + 1.5} ${cx + lipW * 0.3} ${lipY + 2} C ${cx + lipW - 1} ${lipY + 1.5} ${cx + lipW - 2} ${lipY + 5} ${cx} ${lipY + 6} C ${cx - lipW + 2} ${lipY + 5} ${cx - lipW + 1} ${lipY + 1.5} ${cx - lipW + 1} ${lipY + 1.5} Z`);

  // Elegant ears
  const earY = baseY + headH * 0.4;
  paths.push(`M ${cx + headW * 0.94} ${earY} C ${cx + headW + 4} ${earY - 3} ${cx + headW + 8} ${earY + 3} ${cx + headW + 8} ${earY + 10} C ${cx + headW + 8} ${earY + 18} ${cx + headW + 2} ${earY + 22} ${cx + headW * 0.94} ${earY + 18} Z`);
  paths.push(`M ${cx - headW * 0.94} ${earY} C ${cx - headW - 4} ${earY - 3} ${cx - headW - 8} ${earY + 3} ${cx - headW - 8} ${earY + 10} C ${cx - headW - 8} ${earY + 18} ${cx - headW - 2} ${earY + 22} ${cx - headW * 0.94} ${earY + 18} Z`);

  // GRACEFUL NECK
  const neckTop = baseY + headH * 1.02;
  const neckW = 14 * p.neckWidth;
  const neckH = 24;
  
  let neck = `M ${cx - headW * 0.25} ${neckTop}`;
  neck += ` C ${cx - neckW * 0.95} ${neckTop + 5} ${cx - neckW * 1.0} ${neckTop + neckH * 0.6} ${cx - neckW * 1.1} ${neckTop + neckH}`;
  neck += ` L ${cx + neckW * 1.1} ${neckTop + neckH}`;
  neck += ` C ${cx + neckW * 1.0} ${neckTop + neckH * 0.6} ${cx + neckW * 0.95} ${neckTop + 5} ${cx + headW * 0.25} ${neckTop} Z`;
  paths.push(neck);

  // ROBED TORSO - Flowing divine garments
  const torsoTop = neckTop + neckH;
  const shoulderW = 55 * p.shoulderWidth;
  const waistW = 28 * p.waistWidth;
  const hipW = 35 * p.hipWidth;
  const torsoH = 85;

  let torso = `M ${cx - neckW * 1.1} ${torsoTop}`;
  torso += ` C ${cx - shoulderW * 0.45} ${torsoTop - 3} ${cx - shoulderW * 0.75} ${torsoTop + 8} ${cx - shoulderW} ${torsoTop + 15}`;
  torso += ` C ${cx - shoulderW - 5} ${torsoTop + 22} ${cx - shoulderW - 2} ${torsoTop + 32} ${cx - shoulderW + 4} ${torsoTop + 38}`;
  torso += ` C ${cx - waistW - 8} ${torsoTop + torsoH * 0.5} ${cx - waistW - 3} ${torsoTop + torsoH * 0.68} ${cx - waistW} ${torsoTop + torsoH * 0.78}`;
  torso += ` C ${cx - hipW + 4} ${torsoTop + torsoH * 0.9} ${cx - hipW} ${torsoTop + torsoH} ${cx - hipW + 2} ${torsoTop + torsoH + 4}`;
  torso += ` C ${cx - hipW * 0.4} ${torsoTop + torsoH + 6} ${cx} ${torsoTop + torsoH + 7} ${cx + hipW * 0.4} ${torsoTop + torsoH + 6}`;
  torso += ` C ${cx + hipW} ${torsoTop + torsoH + 4} ${cx + hipW - 4} ${torsoTop + torsoH * 0.9} ${cx + waistW} ${torsoTop + torsoH * 0.78}`;
  torso += ` C ${cx + waistW + 3} ${torsoTop + torsoH * 0.68} ${cx + waistW + 8} ${torsoTop + torsoH * 0.5} ${cx + shoulderW - 4} ${torsoTop + 38}`;
  torso += ` C ${cx + shoulderW + 2} ${torsoTop + 32} ${cx + shoulderW + 5} ${torsoTop + 22} ${cx + shoulderW} ${torsoTop + 15}`;
  torso += ` C ${cx + shoulderW * 0.75} ${torsoTop + 8} ${cx + shoulderW * 0.45} ${torsoTop - 3} ${cx + neckW * 1.1} ${torsoTop} Z`;
  paths.push(torso);

  // Robe neckline detail
  paths.push(`M ${cx - 15} ${torsoTop + 5} C ${cx - 12} ${torsoTop + 15} ${cx - 8} ${torsoTop + 25} ${cx} ${torsoTop + 30} C ${cx + 8} ${torsoTop + 25} ${cx + 12} ${torsoTop + 15} ${cx + 15} ${torsoTop + 5}`);
  // Robe drape folds
  paths.push(`M ${cx - 10} ${torsoTop + 35} L ${cx - 12} ${torsoTop + torsoH - 10}`);
  paths.push(`M ${cx + 10} ${torsoTop + 35} L ${cx + 12} ${torsoTop + torsoH - 10}`);
  paths.push(`M ${cx} ${torsoTop + 30} L ${cx} ${torsoTop + torsoH}`);

  // LARGE FEATHERED WINGS
  const wingAttachY = torsoTop + 20;
  const wingSpan = 140;
  const wingHeight = 160;
  
  // Right wing - Multiple layers of feathers
  let rightWing = `M ${cx + shoulderW - 8} ${wingAttachY}`;
  // Wing arm
  rightWing += ` C ${cx + shoulderW + 25} ${wingAttachY - 30} ${cx + shoulderW + 60} ${wingAttachY - wingHeight * 0.5} ${cx + shoulderW + wingSpan * 0.65} ${wingAttachY - wingHeight * 0.75}`;
  // Wing top edge
  rightWing += ` C ${cx + shoulderW + wingSpan * 0.8} ${wingAttachY - wingHeight * 0.9} ${cx + shoulderW + wingSpan * 0.95} ${wingAttachY - wingHeight * 0.95} ${cx + shoulderW + wingSpan} ${wingAttachY - wingHeight * 0.85}`;
  // Feathered edge scallops - primary feathers
  for (let f = 0; f < 8; f++) {
    const t = f / 7;
    const featherX = cx + shoulderW + wingSpan * (1 - t * 0.5);
    const featherY = wingAttachY - wingHeight * (0.85 - t * 0.6);
    const scallop = 12 + f * 4;
    rightWing += ` C ${featherX - 5} ${featherY + scallop * 0.3} ${featherX - 15} ${featherY + scallop * 0.6} ${featherX - 20} ${featherY + scallop}`;
  }
  // Wing bottom back to body
  rightWing += ` C ${cx + shoulderW + 40} ${wingAttachY + 50} ${cx + shoulderW + 15} ${wingAttachY + 70} ${cx + shoulderW - 5} ${wingAttachY + 55}`;
  rightWing += ' Z';
  paths.push(rightWing);
  
  // Wing feather details - multiple rows
  // Primary feathers
  for (let f = 0; f < 10; f++) {
    const t = f / 10;
    const featherStartX = cx + shoulderW + 5;
    const featherStartY = wingAttachY + 20;
    const featherEndX = cx + shoulderW + wingSpan * (0.95 - t * 0.45);
    const featherEndY = wingAttachY - wingHeight * (0.8 - t * 0.55);
    paths.push(`M ${featherStartX} ${featherStartY} C ${featherStartX + 30} ${featherStartY - 30 - t * 20} ${featherEndX - 30} ${featherEndY + 40} ${featherEndX} ${featherEndY}`);
  }
  // Secondary feathers
  for (let f = 0; f < 8; f++) {
    const t = f / 8;
    const featherX = cx + shoulderW + 20 + t * 60;
    const featherY = wingAttachY - 20 - t * 50;
    paths.push(`M ${featherX} ${featherY} L ${featherX + 15} ${featherY - 25}`);
  }
  
  // Left wing (mirror)
  let leftWing = `M ${cx - shoulderW + 8} ${wingAttachY}`;
  leftWing += ` C ${cx - shoulderW - 25} ${wingAttachY - 30} ${cx - shoulderW - 60} ${wingAttachY - wingHeight * 0.5} ${cx - shoulderW - wingSpan * 0.65} ${wingAttachY - wingHeight * 0.75}`;
  leftWing += ` C ${cx - shoulderW - wingSpan * 0.8} ${wingAttachY - wingHeight * 0.9} ${cx - shoulderW - wingSpan * 0.95} ${wingAttachY - wingHeight * 0.95} ${cx - shoulderW - wingSpan} ${wingAttachY - wingHeight * 0.85}`;
  for (let f = 0; f < 8; f++) {
    const t = f / 7;
    const featherX = cx - shoulderW - wingSpan * (1 - t * 0.5);
    const featherY = wingAttachY - wingHeight * (0.85 - t * 0.6);
    const scallop = 12 + f * 4;
    leftWing += ` C ${featherX + 5} ${featherY + scallop * 0.3} ${featherX + 15} ${featherY + scallop * 0.6} ${featherX + 20} ${featherY + scallop}`;
  }
  leftWing += ` C ${cx - shoulderW - 40} ${wingAttachY + 50} ${cx - shoulderW - 15} ${wingAttachY + 70} ${cx - shoulderW + 5} ${wingAttachY + 55}`;
  leftWing += ' Z';
  paths.push(leftWing);
  
  // Left wing feather details
  for (let f = 0; f < 10; f++) {
    const t = f / 10;
    const featherStartX = cx - shoulderW - 5;
    const featherStartY = wingAttachY + 20;
    const featherEndX = cx - shoulderW - wingSpan * (0.95 - t * 0.45);
    const featherEndY = wingAttachY - wingHeight * (0.8 - t * 0.55);
    paths.push(`M ${featherStartX} ${featherStartY} C ${featherStartX - 30} ${featherStartY - 30 - t * 20} ${featherEndX + 30} ${featherEndY + 40} ${featherEndX} ${featherEndY}`);
  }
  for (let f = 0; f < 8; f++) {
    const t = f / 8;
    const featherX = cx - shoulderW - 20 - t * 60;
    const featherY = wingAttachY - 20 - t * 50;
    paths.push(`M ${featherX} ${featherY} L ${featherX - 15} ${featherY - 25}`);
  }

  // GRACEFUL ARMS
  const armStartY = torsoTop + 15;
  const upperArmL = 45;
  const forearmL = 40;
  const armW = gender === 'male' ? 9 : 7;

  // Left arm
  let leftArm = `M ${cx - shoulderW} ${armStartY}`;
  leftArm += ` C ${cx - shoulderW - 8} ${armStartY + 14} ${cx - shoulderW - 11} ${armStartY + upperArmL - 10} ${cx - shoulderW - 9} ${armStartY + upperArmL}`;
  leftArm += ` C ${cx - shoulderW - 12} ${armStartY + upperArmL + 10} ${cx - shoulderW - 9} ${armStartY + upperArmL + forearmL - 10} ${cx - shoulderW - 7} ${armStartY + upperArmL + forearmL}`;
  leftArm += ` C ${cx - shoulderW - 4} ${armStartY + upperArmL + forearmL + 18} ${cx - shoulderW + 10} ${armStartY + upperArmL + forearmL + 22} ${cx - shoulderW + 8} ${armStartY + upperArmL + forearmL + 6}`;
  leftArm += ` C ${cx - shoulderW + armW + 4} ${armStartY + upperArmL + 22} ${cx - shoulderW + armW} ${armStartY + 14} ${cx - shoulderW + 4} ${armStartY} Z`;
  paths.push(leftArm);

  // Right arm
  let rightArm = `M ${cx + shoulderW} ${armStartY}`;
  rightArm += ` C ${cx + shoulderW + 8} ${armStartY + 14} ${cx + shoulderW + 11} ${armStartY + upperArmL - 10} ${cx + shoulderW + 9} ${armStartY + upperArmL}`;
  rightArm += ` C ${cx + shoulderW + 12} ${armStartY + upperArmL + 10} ${cx + shoulderW + 9} ${armStartY + upperArmL + forearmL - 10} ${cx + shoulderW + 7} ${armStartY + upperArmL + forearmL}`;
  rightArm += ` C ${cx + shoulderW + 4} ${armStartY + upperArmL + forearmL + 18} ${cx + shoulderW - 10} ${armStartY + upperArmL + forearmL + 22} ${cx + shoulderW - 8} ${armStartY + upperArmL + forearmL + 6}`;
  rightArm += ` C ${cx + shoulderW - armW - 4} ${armStartY + upperArmL + 22} ${cx + shoulderW - armW} ${armStartY + 14} ${cx + shoulderW - 4} ${armStartY} Z`;
  paths.push(rightArm);

  // Delicate fingers
  const handY = armStartY + upperArmL + forearmL + 6;
  for (let side = -1; side <= 1; side += 2) {
    const handX = cx + side * (shoulderW - 3);
    for (let f = 0; f < 5; f++) {
      const fingerW = 2;
      const fingerL = f === 0 ? 11 : 16 + (2 - Math.abs(f - 2)) * 3;
      const fingerX = handX + side * (f * 4 - 6);
      const fingerY = f === 0 ? handY + 6 : handY + 14;
      paths.push(`M ${fingerX - fingerW} ${fingerY} L ${fingerX - fingerW * 0.7} ${fingerY + fingerL} Q ${fingerX} ${fingerY + fingerL + 2} ${fingerX + fingerW * 0.7} ${fingerY + fingerL} L ${fingerX + fingerW} ${fingerY} Z`);
    }
  }

  // FLOWING ROBE/LEGS
  const legTop = torsoTop + torsoH + 5;
  const robeLength = 120;
  
  // Flowing robe covering legs
  let robe = `M ${cx - hipW - 5} ${legTop}`;
  // Robe billows out elegantly
  robe += ` C ${cx - hipW - 15} ${legTop + 30} ${cx - hipW - 25} ${legTop + 70} ${cx - hipW - 20} ${legTop + robeLength - 20}`;
  // Bottom hem with slight wave
  robe += ` C ${cx - hipW - 15} ${legTop + robeLength - 5} ${cx - hipW * 0.5} ${legTop + robeLength + 5} ${cx} ${legTop + robeLength}`;
  robe += ` C ${cx + hipW * 0.5} ${legTop + robeLength + 5} ${cx + hipW + 15} ${legTop + robeLength - 5} ${cx + hipW + 20} ${legTop + robeLength - 20}`;
  robe += ` C ${cx + hipW + 25} ${legTop + 70} ${cx + hipW + 15} ${legTop + 30} ${cx + hipW + 5} ${legTop}`;
  robe += ' Z';
  paths.push(robe);
  
  // Robe fold details
  paths.push(`M ${cx - 15} ${legTop + 10} C ${cx - 18} ${legTop + 50} ${cx - 20} ${legTop + 80} ${cx - 18} ${legTop + robeLength - 10}`);
  paths.push(`M ${cx + 15} ${legTop + 10} C ${cx + 18} ${legTop + 50} ${cx + 20} ${legTop + 80} ${cx + 18} ${legTop + robeLength - 10}`);
  paths.push(`M ${cx} ${legTop + 5} L ${cx} ${legTop + robeLength - 5}`);
  paths.push(`M ${cx - hipW + 5} ${legTop + 15} C ${cx - hipW} ${legTop + 50} ${cx - hipW - 5} ${legTop + 85} ${cx - hipW - 8} ${legTop + robeLength - 15}`);
  paths.push(`M ${cx + hipW - 5} ${legTop + 15} C ${cx + hipW} ${legTop + 50} ${cx + hipW + 5} ${legTop + 85} ${cx + hipW + 8} ${legTop + robeLength - 15}`);

  // DIVINE LIGHT RAYS emanating
  for (let ray = 0; ray < 16; ray++) {
    const angle = (ray / 16) * Math.PI * 2;
    const rayStartR = 50;
    const rayEndR = 180;
    const rayX1 = cx + Math.cos(angle) * rayStartR;
    const rayY1 = baseY + headH * 0.5 + Math.sin(angle) * rayStartR * 0.6;
    const rayX2 = cx + Math.cos(angle) * rayEndR;
    const rayY2 = baseY + headH * 0.5 + Math.sin(angle) * rayEndR * 0.6;
    if (Math.abs(angle - Math.PI / 2) > 0.3 && Math.abs(angle - Math.PI * 1.5) > 0.3) {
      paths.push(`M ${rayX1} ${rayY1} L ${rayX2} ${rayY2}`);
    }
  }

  return paths;
};

// ============================================================================
// COMPONENT EXPORTS
// ============================================================================
interface AvatarSilhouetteProps {
  race: 'vampire' | 'werewolf' | 'angel';
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
    vampire: generateVampireSilhouette,
    werewolf: generateWerewolfSilhouette,
    angel: generateAngelSilhouette,
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
