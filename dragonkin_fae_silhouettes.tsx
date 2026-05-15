// KasVillage Identity Ritual - Dragonkin & Fae Silhouettes
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
// DRAGONKIN - Reptilian humanoid with horns, scales, wings, tail
// ============================================================================
export const generateDragonkinSilhouette = (gender: Gender, seed: number): string[] => {
  // Validate inputs
  const safeGender: Gender = (gender === 'female') ? 'female' : 'male';
  const safeSeed = (typeof seed === 'number' && !isNaN(seed)) ? seed : 42;
  
  const p = BODY_PARAMS[safeGender];
  const r = (i: number) => seededRandom(safeSeed + i);
  const paths: string[] = [];
  
  const cx = 200, baseY = 38;
  const headW = 42 * p.jawWidth;
  const headH = 50;
  
  // REPTILIAN SKULL - Angular, scaled
  let skull = `M ${cx} ${baseY}`;
  // Angular cranium with scale texture suggestion
  for (let i = 0; i <= 30; i++) {
    const angle = (i / 30) * Math.PI;
    const ridge = Math.sin(i * 1.2) * 2;
    const rx = headW * (0.92 + r(i) * 0.04);
    const ry = headH * 0.52;
    const x = cx + Math.sin(angle) * rx;
    const y = baseY + 5 - Math.cos(angle) * ry + ridge;
    skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  // Pronounced brow ridge
  skull += ` C ${cx + headW * 0.9} ${baseY + headH * 0.28} ${cx + headW * 1.05} ${baseY + headH * 0.35} ${cx + headW * 1.02} ${baseY + headH * 0.42}`;
  // Angular cheekbones
  skull += ` C ${cx + headW * 1.08} ${baseY + headH * 0.5} ${cx + headW * 1.05} ${baseY + headH * 0.6} ${cx + headW * 0.95} ${baseY + headH * 0.68}`;
  // Strong angular jaw tapering to snout
  skull += ` C ${cx + headW * 0.88} ${baseY + headH * 0.78} ${cx + headW * 0.7} ${baseY + headH * 0.88} ${cx + headW * 0.5} ${baseY + headH * 0.95}`;
  skull += ` C ${cx + headW * 0.3} ${baseY + headH * 1.0} ${cx + headW * 0.12} ${baseY + headH * 1.02} ${cx} ${baseY + headH * 1.04}`;
  // Left side mirror
  skull += ` C ${cx - headW * 0.12} ${baseY + headH * 1.02} ${cx - headW * 0.3} ${baseY + headH * 1.0} ${cx - headW * 0.5} ${baseY + headH * 0.95}`;
  skull += ` C ${cx - headW * 0.7} ${baseY + headH * 0.88} ${cx - headW * 0.88} ${baseY + headH * 0.78} ${cx - headW * 0.95} ${baseY + headH * 0.68}`;
  skull += ` C ${cx - headW * 1.05} ${baseY + headH * 0.6} ${cx - headW * 1.08} ${baseY + headH * 0.5} ${cx - headW * 1.02} ${baseY + headH * 0.42}`;
  skull += ` C ${cx - headW * 1.05} ${baseY + headH * 0.35} ${cx - headW * 0.9} ${baseY + headH * 0.28} ${cx - headW * 0.88} ${baseY + headH * 0.15}`;
  skull += ' Z';
  paths.push(skull);

  // HORNS - Large curved horns
  const hornY = baseY + headH * 0.15;
  const hornLength = gender === 'male' ? 55 : 42;
  const hornCurve = gender === 'male' ? 35 : 28;
  
  // Right horn - sweeping back and up
  let rightHorn = `M ${cx + headW * 0.75} ${hornY}`;
  rightHorn += ` C ${cx + headW * 0.85} ${hornY - 8} ${cx + headW + hornCurve * 0.4} ${hornY - hornLength * 0.3} ${cx + headW + hornCurve * 0.7} ${hornY - hornLength * 0.5}`;
  rightHorn += ` C ${cx + headW + hornCurve * 0.9} ${hornY - hornLength * 0.7} ${cx + headW + hornCurve} ${hornY - hornLength * 0.88} ${cx + headW + hornCurve * 0.95} ${hornY - hornLength}`;
  // Horn tip
  rightHorn += ` C ${cx + headW + hornCurve * 0.9} ${hornY - hornLength - 4} ${cx + headW + hornCurve * 0.8} ${hornY - hornLength + 3} ${cx + headW + hornCurve * 0.75} ${hornY - hornLength + 8}`;
  // Inner curve back
  rightHorn += ` C ${cx + headW + hornCurve * 0.6} ${hornY - hornLength * 0.7} ${cx + headW + hornCurve * 0.35} ${hornY - hornLength * 0.4} ${cx + headW * 0.9} ${hornY - 12}`;
  rightHorn += ` C ${cx + headW * 0.82} ${hornY - 5} ${cx + headW * 0.72} ${hornY - 2} ${cx + headW * 0.65} ${hornY + 5}`;
  rightHorn += ' Z';
  paths.push(rightHorn);
  
  // Horn ridges
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const ridgeX = cx + headW * 0.8 + hornCurve * t * 0.8;
    const ridgeY = hornY - hornLength * t * 0.85;
    paths.push(`M ${ridgeX - 3} ${ridgeY + 2} L ${ridgeX + 5} ${ridgeY - 4} L ${ridgeX + 6} ${ridgeY - 2} L ${ridgeX - 2} ${ridgeY + 4} Z`);
  }
  
  // Left horn (mirror)
  let leftHorn = `M ${cx - headW * 0.75} ${hornY}`;
  leftHorn += ` C ${cx - headW * 0.85} ${hornY - 8} ${cx - headW - hornCurve * 0.4} ${hornY - hornLength * 0.3} ${cx - headW - hornCurve * 0.7} ${hornY - hornLength * 0.5}`;
  leftHorn += ` C ${cx - headW - hornCurve * 0.9} ${hornY - hornLength * 0.7} ${cx - headW - hornCurve} ${hornY - hornLength * 0.88} ${cx - headW - hornCurve * 0.95} ${hornY - hornLength}`;
  leftHorn += ` C ${cx - headW - hornCurve * 0.9} ${hornY - hornLength - 4} ${cx - headW - hornCurve * 0.8} ${hornY - hornLength + 3} ${cx - headW - hornCurve * 0.75} ${hornY - hornLength + 8}`;
  leftHorn += ` C ${cx - headW - hornCurve * 0.6} ${hornY - hornLength * 0.7} ${cx - headW - hornCurve * 0.35} ${hornY - hornLength * 0.4} ${cx - headW * 0.9} ${hornY - 12}`;
  leftHorn += ` C ${cx - headW * 0.82} ${hornY - 5} ${cx - headW * 0.72} ${hornY - 2} ${cx - headW * 0.65} ${hornY + 5}`;
  leftHorn += ' Z';
  paths.push(leftHorn);
  
  // Left horn ridges
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const ridgeX = cx - headW * 0.8 - hornCurve * t * 0.8;
    const ridgeY = hornY - hornLength * t * 0.85;
    paths.push(`M ${ridgeX + 3} ${ridgeY + 2} L ${ridgeX - 5} ${ridgeY - 4} L ${ridgeX - 6} ${ridgeY - 2} L ${ridgeX + 2} ${ridgeY + 4} Z`);
  }

  // SMALLER BROW HORNS
  const browHornY = baseY + headH * 0.32;
  // Right brow horn
  paths.push(`M ${cx + headW * 0.9} ${browHornY} C ${cx + headW * 1.0} ${browHornY - 5} ${cx + headW * 1.1} ${browHornY - 12} ${cx + headW * 1.05} ${browHornY - 18} C ${cx + headW * 1.0} ${browHornY - 15} ${cx + headW * 0.95} ${browHornY - 8} ${cx + headW * 0.85} ${browHornY + 3} Z`);
  // Left brow horn
  paths.push(`M ${cx - headW * 0.9} ${browHornY} C ${cx - headW * 1.0} ${browHornY - 5} ${cx - headW * 1.1} ${browHornY - 12} ${cx - headW * 1.05} ${browHornY - 18} C ${cx - headW * 1.0} ${browHornY - 15} ${cx - headW * 0.95} ${browHornY - 8} ${cx - headW * 0.85} ${browHornY + 3} Z`);

  // SCALE PATTERNS on face
  // Forehead scales
  for (let row = 0; row < 3; row++) {
    for (let col = -2; col <= 2; col++) {
      const scaleX = cx + col * 12;
      const scaleY = baseY + headH * 0.12 + row * 10;
      const scaleW = 5, scaleH = 4;
      paths.push(`M ${scaleX} ${scaleY - scaleH} C ${scaleX + scaleW} ${scaleY - scaleH * 0.5} ${scaleX + scaleW} ${scaleY + scaleH * 0.5} ${scaleX} ${scaleY + scaleH} C ${scaleX - scaleW} ${scaleY + scaleH * 0.5} ${scaleX - scaleW} ${scaleY - scaleH * 0.5} ${scaleX} ${scaleY - scaleH} Z`);
    }
  }
  // Cheek scales
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 5; i++) {
      const scaleX = cx + side * (headW * 0.6 + i * 3);
      const scaleY = baseY + headH * 0.55 + i * 6;
      paths.push(`M ${scaleX} ${scaleY - 3} C ${scaleX + 4 * side} ${scaleY - 1} ${scaleX + 4 * side} ${scaleY + 2} ${scaleX} ${scaleY + 4} C ${scaleX - 3 * side} ${scaleY + 2} ${scaleX - 3 * side} ${scaleY - 1} ${scaleX} ${scaleY - 3} Z`);
    }
  }

  // REPTILIAN EYES - Slitted pupils
  const eyeY = baseY + headH * 0.44;
  const eyeSpacing = headW * 0.38;
  const eyeW = 10, eyeH = 7;
  
  // Right eye - angular
  let rightEye = `M ${cx + eyeSpacing - eyeW - 2} ${eyeY + 1}`;
  rightEye += ` C ${cx + eyeSpacing - eyeW} ${eyeY - 2} ${cx + eyeSpacing - 3} ${eyeY - eyeH} ${cx + eyeSpacing + 2} ${eyeY - eyeH + 2}`;
  rightEye += ` C ${cx + eyeSpacing + eyeW - 2} ${eyeY - eyeH + 3} ${cx + eyeSpacing + eyeW} ${eyeY - 2} ${cx + eyeSpacing + eyeW + 2} ${eyeY + 1}`;
  rightEye += ` C ${cx + eyeSpacing + eyeW} ${eyeY + 3} ${cx + eyeSpacing + 3} ${eyeY + eyeH * 0.6} ${cx + eyeSpacing - 3} ${eyeY + eyeH * 0.5}`;
  rightEye += ` C ${cx + eyeSpacing - eyeW} ${eyeY + eyeH * 0.4} ${cx + eyeSpacing - eyeW - 1} ${eyeY + 2} ${cx + eyeSpacing - eyeW - 2} ${eyeY + 1} Z`;
  paths.push(rightEye);
  // Slitted pupil
  paths.push(`M ${cx + eyeSpacing} ${eyeY - 4} C ${cx + eyeSpacing + 1.5} ${eyeY - 2} ${cx + eyeSpacing + 1.5} ${eyeY + 2} ${cx + eyeSpacing} ${eyeY + 4} C ${cx + eyeSpacing - 1.5} ${eyeY + 2} ${cx + eyeSpacing - 1.5} ${eyeY - 2} ${cx + eyeSpacing} ${eyeY - 4} Z`);
  
  // Left eye
  let leftEye = `M ${cx - eyeSpacing + eyeW + 2} ${eyeY + 1}`;
  leftEye += ` C ${cx - eyeSpacing + eyeW} ${eyeY - 2} ${cx - eyeSpacing + 3} ${eyeY - eyeH} ${cx - eyeSpacing - 2} ${eyeY - eyeH + 2}`;
  leftEye += ` C ${cx - eyeSpacing - eyeW + 2} ${eyeY - eyeH + 3} ${cx - eyeSpacing - eyeW} ${eyeY - 2} ${cx - eyeSpacing - eyeW - 2} ${eyeY + 1}`;
  leftEye += ` C ${cx - eyeSpacing - eyeW} ${eyeY + 3} ${cx - eyeSpacing - 3} ${eyeY + eyeH * 0.6} ${cx - eyeSpacing + 3} ${eyeY + eyeH * 0.5}`;
  leftEye += ` C ${cx - eyeSpacing + eyeW} ${eyeY + eyeH * 0.4} ${cx - eyeSpacing + eyeW + 1} ${eyeY + 2} ${cx - eyeSpacing + eyeW + 2} ${eyeY + 1} Z`;
  paths.push(leftEye);
  paths.push(`M ${cx - eyeSpacing} ${eyeY - 4} C ${cx - eyeSpacing - 1.5} ${eyeY - 2} ${cx - eyeSpacing - 1.5} ${eyeY + 2} ${cx - eyeSpacing} ${eyeY + 4} C ${cx - eyeSpacing + 1.5} ${eyeY + 2} ${cx - eyeSpacing + 1.5} ${eyeY - 2} ${cx - eyeSpacing} ${eyeY - 4} Z`);

  // SNOUT - Extended muzzle
  const snoutY = baseY + headH * 0.7;
  let snout = `M ${cx - headW * 0.3} ${snoutY}`;
  snout += ` C ${cx - headW * 0.35} ${snoutY + 5} ${cx - headW * 0.32} ${snoutY + 12} ${cx - headW * 0.25} ${snoutY + 18}`;
  snout += ` C ${cx - headW * 0.15} ${snoutY + 22} ${cx - 8} ${snoutY + 25} ${cx} ${snoutY + 26}`;
  snout += ` C ${cx + 8} ${snoutY + 25} ${cx + headW * 0.15} ${snoutY + 22} ${cx + headW * 0.25} ${snoutY + 18}`;
  snout += ` C ${cx + headW * 0.32} ${snoutY + 12} ${cx + headW * 0.35} ${snoutY + 5} ${cx + headW * 0.3} ${snoutY}`;
  snout += ' Z';
  paths.push(snout);
  // Nostrils
  paths.push(`M ${cx + 10} ${snoutY + 15} C ${cx + 13} ${snoutY + 13} ${cx + 16} ${snoutY + 14} ${cx + 15} ${snoutY + 18} C ${cx + 14} ${snoutY + 20} ${cx + 11} ${snoutY + 19} ${cx + 10} ${snoutY + 15} Z`);
  paths.push(`M ${cx - 10} ${snoutY + 15} C ${cx - 13} ${snoutY + 13} ${cx - 16} ${snoutY + 14} ${cx - 15} ${snoutY + 18} C ${cx - 14} ${snoutY + 20} ${cx - 11} ${snoutY + 19} ${cx - 10} ${snoutY + 15} Z`);
  // Snout ridge
  paths.push(`M ${cx} ${baseY + headH * 0.5} L ${cx} ${snoutY + 20}`);

  // NECK - Thick scaled
  const neckTop = baseY + headH * 1.04;
  const neckW = 22 * p.neckWidth;
  const neckH = 28;
  
  let neck = `M ${cx - headW * 0.35} ${neckTop}`;
  neck += ` C ${cx - neckW * 1.1} ${neckTop + 5} ${cx - neckW * 1.2} ${neckTop + neckH * 0.6} ${cx - neckW * 1.3} ${neckTop + neckH}`;
  neck += ` L ${cx + neckW * 1.3} ${neckTop + neckH}`;
  neck += ` C ${cx + neckW * 1.2} ${neckTop + neckH * 0.6} ${cx + neckW * 1.1} ${neckTop + 5} ${cx + headW * 0.35} ${neckTop} Z`;
  paths.push(neck);
  // Neck scales
  for (let i = 0; i < 4; i++) {
    const scaleY = neckTop + 5 + i * 7;
    paths.push(`M ${cx - 8} ${scaleY} C ${cx - 5} ${scaleY - 3} ${cx + 5} ${scaleY - 3} ${cx + 8} ${scaleY} C ${cx + 5} ${scaleY + 4} ${cx - 5} ${scaleY + 4} ${cx - 8} ${scaleY} Z`);
  }

  // TORSO - Powerful scaled body
  const torsoTop = neckTop + neckH;
  const shoulderW = 72 * p.shoulderWidth;
  const waistW = 38 * p.waistWidth;
  const hipW = 42 * p.hipWidth;
  const torsoH = 95;

  let torso = `M ${cx - neckW * 1.3} ${torsoTop}`;
  torso += ` C ${cx - shoulderW * 0.5} ${torsoTop - 5} ${cx - shoulderW * 0.8} ${torsoTop + 10} ${cx - shoulderW} ${torsoTop + 20}`;
  torso += ` C ${cx - shoulderW - 8} ${torsoTop + 28} ${cx - shoulderW - 5} ${torsoTop + 42} ${cx - shoulderW + 5} ${torsoTop + 48}`;
  torso += ` C ${cx - waistW - 12} ${torsoTop + torsoH * 0.55} ${cx - waistW - 5} ${torsoTop + torsoH * 0.72} ${cx - waistW} ${torsoTop + torsoH * 0.82}`;
  torso += ` C ${cx - hipW + 5} ${torsoTop + torsoH * 0.92} ${cx - hipW} ${torsoTop + torsoH} ${cx - hipW + 3} ${torsoTop + torsoH + 5}`;
  torso += ` C ${cx - hipW * 0.4} ${torsoTop + torsoH + 8} ${cx} ${torsoTop + torsoH + 10} ${cx + hipW * 0.4} ${torsoTop + torsoH + 8}`;
  torso += ` C ${cx + hipW} ${torsoTop + torsoH + 5} ${cx + hipW - 5} ${torsoTop + torsoH * 0.92} ${cx + waistW} ${torsoTop + torsoH * 0.82}`;
  torso += ` C ${cx + waistW + 5} ${torsoTop + torsoH * 0.72} ${cx + waistW + 12} ${torsoTop + torsoH * 0.55} ${cx + shoulderW - 5} ${torsoTop + 48}`;
  torso += ` C ${cx + shoulderW + 5} ${torsoTop + 42} ${cx + shoulderW + 8} ${torsoTop + 28} ${cx + shoulderW} ${torsoTop + 20}`;
  torso += ` C ${cx + shoulderW * 0.8} ${torsoTop + 10} ${cx + shoulderW * 0.5} ${torsoTop - 5} ${cx + neckW * 1.3} ${torsoTop} Z`;
  paths.push(torso);

  // Chest scales pattern
  for (let row = 0; row < 6; row++) {
    const rowY = torsoTop + 25 + row * 14;
    const rowW = 35 - row * 3;
    for (let col = -2; col <= 2; col++) {
      const scaleX = cx + col * 12;
      if (Math.abs(scaleX - cx) < rowW) {
        paths.push(`M ${scaleX} ${rowY - 5} C ${scaleX + 6} ${rowY - 2} ${scaleX + 6} ${rowY + 3} ${scaleX} ${rowY + 6} C ${scaleX - 6} ${rowY + 3} ${scaleX - 6} ${rowY - 2} ${scaleX} ${rowY - 5} Z`);
      }
    }
  }

  // WINGS - Large dragon wings
  const wingAttachY = torsoTop + 25;
  const wingSpan = 120;
  const wingHeight = 140;
  
  // Right wing
  let rightWing = `M ${cx + shoulderW - 10} ${wingAttachY}`;
  // Wing arm bone
  rightWing += ` C ${cx + shoulderW + 20} ${wingAttachY - 15} ${cx + shoulderW + 50} ${wingAttachY - 40} ${cx + shoulderW + wingSpan * 0.6} ${wingAttachY - wingHeight * 0.5}`;
  // Wing tip
  rightWing += ` C ${cx + shoulderW + wingSpan * 0.8} ${wingAttachY - wingHeight * 0.7} ${cx + shoulderW + wingSpan} ${wingAttachY - wingHeight * 0.85} ${cx + shoulderW + wingSpan * 0.95} ${wingAttachY - wingHeight}`;
  // Wing edge scallops (membrane between fingers)
  const wingFingers = 5;
  for (let f = 0; f < wingFingers; f++) {
    const t = f / (wingFingers - 1);
    const fingerTipX = cx + shoulderW + wingSpan * (0.95 - t * 0.7);
    const fingerTipY = wingAttachY - wingHeight * (1 - t * 0.6);
    const scallop = 15 + f * 5;
    rightWing += ` C ${fingerTipX + 5} ${fingerTipY + scallop * 0.3} ${fingerTipX - 10} ${fingerTipY + scallop * 0.5} ${fingerTipX - 15} ${fingerTipY + scallop}`;
  }
  // Wing bottom edge back to body
  rightWing += ` C ${cx + shoulderW + 30} ${wingAttachY + 40} ${cx + shoulderW + 10} ${wingAttachY + 60} ${cx + shoulderW - 5} ${wingAttachY + 50}`;
  rightWing += ' Z';
  paths.push(rightWing);
  
  // Wing bone structure
  for (let f = 0; f < wingFingers; f++) {
    const t = f / (wingFingers - 1);
    const boneEndX = cx + shoulderW + wingSpan * (0.9 - t * 0.65);
    const boneEndY = wingAttachY - wingHeight * (0.95 - t * 0.55);
    paths.push(`M ${cx + shoulderW} ${wingAttachY + 10} C ${cx + shoulderW + 20} ${wingAttachY - 10} ${boneEndX - 20} ${boneEndY + 30} ${boneEndX} ${boneEndY}`);
  }
  
  // Left wing (mirror)
  let leftWing = `M ${cx - shoulderW + 10} ${wingAttachY}`;
  leftWing += ` C ${cx - shoulderW - 20} ${wingAttachY - 15} ${cx - shoulderW - 50} ${wingAttachY - 40} ${cx - shoulderW - wingSpan * 0.6} ${wingAttachY - wingHeight * 0.5}`;
  leftWing += ` C ${cx - shoulderW - wingSpan * 0.8} ${wingAttachY - wingHeight * 0.7} ${cx - shoulderW - wingSpan} ${wingAttachY - wingHeight * 0.85} ${cx - shoulderW - wingSpan * 0.95} ${wingAttachY - wingHeight}`;
  for (let f = 0; f < wingFingers; f++) {
    const t = f / (wingFingers - 1);
    const fingerTipX = cx - shoulderW - wingSpan * (0.95 - t * 0.7);
    const fingerTipY = wingAttachY - wingHeight * (1 - t * 0.6);
    const scallop = 15 + f * 5;
    leftWing += ` C ${fingerTipX - 5} ${fingerTipY + scallop * 0.3} ${fingerTipX + 10} ${fingerTipY + scallop * 0.5} ${fingerTipX + 15} ${fingerTipY + scallop}`;
  }
  leftWing += ` C ${cx - shoulderW - 30} ${wingAttachY + 40} ${cx - shoulderW - 10} ${wingAttachY + 60} ${cx - shoulderW + 5} ${wingAttachY + 50}`;
  leftWing += ' Z';
  paths.push(leftWing);
  
  // Left wing bones
  for (let f = 0; f < wingFingers; f++) {
    const t = f / (wingFingers - 1);
    const boneEndX = cx - shoulderW - wingSpan * (0.9 - t * 0.65);
    const boneEndY = wingAttachY - wingHeight * (0.95 - t * 0.55);
    paths.push(`M ${cx - shoulderW} ${wingAttachY + 10} C ${cx - shoulderW - 20} ${wingAttachY - 10} ${boneEndX + 20} ${boneEndY + 30} ${boneEndX} ${boneEndY}`);
  }

  // ARMS - Scaled and clawed
  const armStartY = torsoTop + 20;
  const upperArmL = 52;
  const forearmL = 48;
  const armW = gender === 'male' ? 14 : 11;

  // Left arm
  let leftArm = `M ${cx - shoulderW} ${armStartY}`;
  leftArm += ` C ${cx - shoulderW - 12} ${armStartY + 15} ${cx - shoulderW - 16} ${armStartY + upperArmL - 10} ${cx - shoulderW - 14} ${armStartY + upperArmL}`;
  leftArm += ` C ${cx - shoulderW - 18} ${armStartY + upperArmL + 10} ${cx - shoulderW - 14} ${armStartY + upperArmL + forearmL - 10} ${cx - shoulderW - 12} ${armStartY + upperArmL + forearmL}`;
  // Clawed hand
  leftArm += ` L ${cx - shoulderW - 10} ${armStartY + upperArmL + forearmL + 8}`;
  leftArm += ` C ${cx - shoulderW - 5} ${armStartY + upperArmL + forearmL + 25} ${cx - shoulderW + 12} ${armStartY + upperArmL + forearmL + 28} ${cx - shoulderW + 10} ${armStartY + upperArmL + forearmL + 8}`;
  leftArm += ` C ${cx - shoulderW + armW + 5} ${armStartY + upperArmL + 28} ${cx - shoulderW + armW} ${armStartY + 18} ${cx - shoulderW + 6} ${armStartY} Z`;
  paths.push(leftArm);

  // Right arm
  let rightArm = `M ${cx + shoulderW} ${armStartY}`;
  rightArm += ` C ${cx + shoulderW + 12} ${armStartY + 15} ${cx + shoulderW + 16} ${armStartY + upperArmL - 10} ${cx + shoulderW + 14} ${armStartY + upperArmL}`;
  rightArm += ` C ${cx + shoulderW + 18} ${armStartY + upperArmL + 10} ${cx + shoulderW + 14} ${armStartY + upperArmL + forearmL - 10} ${cx + shoulderW + 12} ${armStartY + upperArmL + forearmL}`;
  rightArm += ` L ${cx + shoulderW + 10} ${armStartY + upperArmL + forearmL + 8}`;
  rightArm += ` C ${cx + shoulderW + 5} ${armStartY + upperArmL + forearmL + 25} ${cx + shoulderW - 12} ${armStartY + upperArmL + forearmL + 28} ${cx + shoulderW - 10} ${armStartY + upperArmL + forearmL + 8}`;
  rightArm += ` C ${cx + shoulderW - armW - 5} ${armStartY + upperArmL + 28} ${cx + shoulderW - armW} ${armStartY + 18} ${cx + shoulderW - 6} ${armStartY} Z`;
  paths.push(rightArm);

  // Clawed fingers
  const handY = armStartY + upperArmL + forearmL + 8;
  for (let side = -1; side <= 1; side += 2) {
    const handX = cx + side * (shoulderW - 5);
    for (let f = 0; f < 4; f++) {
      const fingerW = 3;
      const fingerL = 18 + (2 - Math.abs(f - 1.5)) * 4;
      const fingerX = handX + side * (f * 5 - 6);
      const fingerY = handY + 12;
      // Finger with claw
      let finger = `M ${fingerX - fingerW} ${fingerY}`;
      finger += ` L ${fingerX - fingerW * 0.6} ${fingerY + fingerL - 5}`;
      finger += ` L ${fingerX} ${fingerY + fingerL + 6}`; // Claw tip
      finger += ` L ${fingerX + fingerW * 0.6} ${fingerY + fingerL - 5}`;
      finger += ` L ${fingerX + fingerW} ${fingerY} Z`;
      paths.push(finger);
    }
  }

  // TAIL - Long scaled tail
  const tailStart = torsoTop + torsoH + 5;
  const tailLength = 130;
  
  let tail = `M ${cx - 8} ${tailStart}`;
  // Tail curves down and to the side
  tail += ` C ${cx - 15} ${tailStart + 25} ${cx - 25} ${tailStart + 50} ${cx - 40} ${tailStart + 75}`;
  tail += ` C ${cx - 55} ${tailStart + 100} ${cx - 75} ${tailStart + tailLength - 20} ${cx - 85} ${tailStart + tailLength}`;
  // Tail tip - pointed or finned
  tail += ` C ${cx - 90} ${tailStart + tailLength + 8} ${cx - 88} ${tailStart + tailLength + 5} ${cx - 82} ${tailStart + tailLength - 5}`;
  // Return path
  tail += ` C ${cx - 68} ${tailStart + tailLength - 25} ${cx - 48} ${tailStart + 95} ${cx - 32} ${tailStart + 70}`;
  tail += ` C ${cx - 18} ${tailStart + 45} ${cx - 8} ${tailStart + 22} ${cx + 5} ${tailStart}`;
  tail += ' Z';
  paths.push(tail);
  
  // Tail scales
  for (let i = 0; i < 10; i++) {
    const t = i / 10;
    const scaleX = cx - 10 - t * 70;
    const scaleY = tailStart + 15 + t * 100;
    const scaleSize = 6 - t * 2;
    paths.push(`M ${scaleX} ${scaleY - scaleSize} C ${scaleX + scaleSize} ${scaleY - scaleSize * 0.3} ${scaleX + scaleSize} ${scaleY + scaleSize * 0.3} ${scaleX} ${scaleY + scaleSize} C ${scaleX - scaleSize * 0.7} ${scaleY + scaleSize * 0.3} ${scaleX - scaleSize * 0.7} ${scaleY - scaleSize * 0.3} ${scaleX} ${scaleY - scaleSize} Z`);
  }
  // Tail spines
  for (let i = 0; i < 8; i++) {
    const t = i / 8;
    const spineX = cx - 5 - t * 65;
    const spineY = tailStart + 10 + t * 95;
    const spineH = 8 - t * 3;
    paths.push(`M ${spineX} ${spineY} L ${spineX - 5} ${spineY - spineH} L ${spineX - 3} ${spineY - spineH + 2} L ${spineX + 2} ${spineY} Z`);
  }

  // LEGS - Digitigrade (reverse knee) scaled legs
  const legTop = torsoTop + torsoH + 5;
  const thighL = 55;
  const calfL = 50;
  const legW = gender === 'male' ? 20 : 17;

  // Left leg - digitigrade stance
  let leftLeg = `M ${cx - hipW * 0.12} ${legTop}`;
  leftLeg += ` C ${cx - hipW * 0.35} ${legTop + 8} ${cx - hipW * 0.5} ${legTop + 18} ${cx - legW - 8} ${legTop + thighL * 0.5}`;
  // Reverse knee joint
  leftLeg += ` C ${cx - legW - 12} ${legTop + thighL * 0.75} ${cx - legW - 15} ${legTop + thighL} ${cx - legW - 8} ${legTop + thighL + 8}`;
  // Lower leg angles forward
  leftLeg += ` C ${cx - legW - 5} ${legTop + thighL + 20} ${cx - legW + 5} ${legTop + thighL + calfL - 15} ${cx - legW + 8} ${legTop + thighL + calfL}`;
  // Clawed foot
  leftLeg += ` L ${cx - 35} ${legTop + thighL + calfL + 12}`;
  leftLeg += ` C ${cx - 42} ${legTop + thighL + calfL + 18} ${cx - 40} ${legTop + thighL + calfL + 28} ${cx - 12} ${legTop + thighL + calfL + 28}`;
  leftLeg += ` L ${cx - 8} ${legTop + thighL + calfL}`;
  leftLeg += ` C ${cx - 6} ${legTop + thighL + 15} ${cx - 10} ${legTop + 18} ${cx - hipW * 0.12} ${legTop} Z`;
  paths.push(leftLeg);
  
  // Foot claws (left)
  for (let c = 0; c < 3; c++) {
    const clawX = cx - 35 + c * 10;
    const clawY = legTop + thighL + calfL + 25;
    paths.push(`M ${clawX} ${clawY} L ${clawX - 2} ${clawY + 10} L ${clawX + 2} ${clawY + 10} Z`);
  }

  // Right leg
  let rightLeg = `M ${cx + hipW * 0.12} ${legTop}`;
  rightLeg += ` C ${cx + hipW * 0.35} ${legTop + 8} ${cx + hipW * 0.5} ${legTop + 18} ${cx + legW + 8} ${legTop + thighL * 0.5}`;
  rightLeg += ` C ${cx + legW + 12} ${legTop + thighL * 0.75} ${cx + legW + 15} ${legTop + thighL} ${cx + legW + 8} ${legTop + thighL + 8}`;
  rightLeg += ` C ${cx + legW + 5} ${legTop + thighL + 20} ${cx + legW - 5} ${legTop + thighL + calfL - 15} ${cx + legW - 8} ${legTop + thighL + calfL}`;
  rightLeg += ` L ${cx + 35} ${legTop + thighL + calfL + 12}`;
  rightLeg += ` C ${cx + 42} ${legTop + thighL + calfL + 18} ${cx + 40} ${legTop + thighL + calfL + 28} ${cx + 12} ${legTop + thighL + calfL + 28}`;
  rightLeg += ` L ${cx + 8} ${legTop + thighL + calfL}`;
  rightLeg += ` C ${cx + 6} ${legTop + thighL + 15} ${cx + 10} ${legTop + 18} ${cx + hipW * 0.12} ${legTop} Z`;
  paths.push(rightLeg);
  
  // Foot claws (right)
  for (let c = 0; c < 3; c++) {
    const clawX = cx + 35 - c * 10;
    const clawY = legTop + thighL + calfL + 25;
    paths.push(`M ${clawX} ${clawY} L ${clawX - 2} ${clawY + 10} L ${clawX + 2} ${clawY + 10} Z`);
  }

  return paths;
};

// ============================================================================
// FAE - Delicate ethereal being with butterfly wings, flower decorations
// ============================================================================
export const generateFaeSilhouette = (gender: Gender, seed: number): string[] => {
  // Validate inputs
  const safeGender: Gender = (gender === 'female') ? 'female' : 'male';
  const safeSeed = (typeof seed === 'number' && !isNaN(seed)) ? seed : 31;
  
  const p = BODY_PARAMS[safeGender];
  const r = (i: number) => seededRandom(safeSeed + i);
  const paths: string[] = [];
  
  const cx = 200, baseY = 52;
  const headW = 32 * p.jawWidth; // Smaller delicate head
  const headH = 42;
  
  // DELICATE SKULL - Heart-shaped face
  let skull = `M ${cx} ${baseY}`;
  // Soft rounded forehead
  for (let i = 0; i <= 30; i++) {
    const angle = (i / 30) * Math.PI;
    const soft = Math.sin(i * 0.3) * 0.5;
    const rx = headW * (0.94 + soft * 0.03);
    const ry = headH * 0.5;
    const x = cx + Math.sin(angle) * rx;
    const y = baseY + 3 - Math.cos(angle) * ry;
    skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  // Soft temples
  skull += ` C ${cx + headW * 0.92} ${baseY + headH * 0.32} ${cx + headW * 0.98} ${baseY + headH * 0.42} ${cx + headW * 0.95} ${baseY + headH * 0.5}`;
  // Delicate high cheekbones
  skull += ` C ${cx + headW * 1.02} ${baseY + headH * 0.56} ${cx + headW * 0.98} ${baseY + headH * 0.65} ${cx + headW * 0.88} ${baseY + headH * 0.72}`;
  // Heart-shaped chin taper
  skull += ` C ${cx + headW * 0.72} ${baseY + headH * 0.84} ${cx + headW * 0.45} ${baseY + headH * 0.94} ${cx + headW * 0.2} ${baseY + headH * 0.98}`;
  skull += ` C ${cx + headW * 0.08} ${baseY + headH * 1.0} ${cx} ${baseY + headH * 1.02} ${cx} ${baseY + headH * 1.02}`;
  // Left side mirror
  skull += ` C ${cx} ${baseY + headH * 1.02} ${cx - headW * 0.08} ${baseY + headH * 1.0} ${cx - headW * 0.2} ${baseY + headH * 0.98}`;
  skull += ` C ${cx - headW * 0.45} ${baseY + headH * 0.94} ${cx - headW * 0.72} ${baseY + headH * 0.84} ${cx - headW * 0.88} ${baseY + headH * 0.72}`;
  skull += ` C ${cx - headW * 0.98} ${baseY + headH * 0.65} ${cx - headW * 1.02} ${baseY + headH * 0.56} ${cx - headW * 0.95} ${baseY + headH * 0.5}`;
  skull += ` C ${cx - headW * 0.98} ${baseY + headH * 0.42} ${cx - headW * 0.92} ${baseY + headH * 0.32} ${cx - headW * 0.9} ${baseY + headH * 0.18}`;
  skull += ' Z';
  paths.push(skull);

  // POINTED EARS - Small elegant
  const earY = baseY + headH * 0.38;
  const earLength = 20;
  
  // Right ear
  let rightEar = `M ${cx + headW * 0.92} ${earY + 3}`;
  rightEar += ` C ${cx + headW + 3} ${earY} ${cx + headW + 8} ${earY - 8} ${cx + headW + 10} ${earY - earLength * 0.7}`;
  rightEar += ` C ${cx + headW + 11} ${earY - earLength * 0.9} ${cx + headW + 9} ${earY - earLength} ${cx + headW + 7} ${earY - earLength - 2}`;
  rightEar += ` C ${cx + headW + 4} ${earY - earLength + 3} ${cx + headW + 2} ${earY - earLength * 0.5} ${cx + headW - 1} ${earY - 2}`;
  rightEar += ` C ${cx + headW * 0.95} ${earY + 2} ${cx + headW * 0.93} ${earY + 8} ${cx + headW * 0.9} ${earY + 12}`;
  rightEar += ' Z';
  paths.push(rightEar);
  
  // Left ear
  let leftEar = `M ${cx - headW * 0.92} ${earY + 3}`;
  leftEar += ` C ${cx - headW - 3} ${earY} ${cx - headW - 8} ${earY - 8} ${cx - headW - 10} ${earY - earLength * 0.7}`;
  leftEar += ` C ${cx - headW - 11} ${earY - earLength * 0.9} ${cx - headW - 9} ${earY - earLength} ${cx - headW - 7} ${earY - earLength - 2}`;
  leftEar += ` C ${cx - headW - 4} ${earY - earLength + 3} ${cx - headW - 2} ${earY - earLength * 0.5} ${cx - headW + 1} ${earY - 2}`;
  leftEar += ` C ${cx - headW * 0.95} ${earY + 2} ${cx - headW * 0.93} ${earY + 8} ${cx - headW * 0.9} ${earY + 12}`;
  leftEar += ' Z';
  paths.push(leftEar);

  // FLOWER CROWN - Decorative flowers in hair
  const crownY = baseY - 5;
  // Multiple flowers across the crown
  for (let f = 0; f < 5; f++) {
    const flowerX = cx + (f - 2) * headW * 0.35;
    const flowerY = crownY - 8 + Math.sin(f * 1.2) * 4;
    const petalCount = 5 + Math.floor(r(300 + f) * 3);
    const petalSize = 6 + r(310 + f) * 4;
    
    // Petals
    for (let p = 0; p < petalCount; p++) {
      const angle = (p / petalCount) * Math.PI * 2;
      const petalX = flowerX + Math.cos(angle) * petalSize * 0.6;
      const petalY = flowerY + Math.sin(angle) * petalSize * 0.6;
      const petalEndX = flowerX + Math.cos(angle) * petalSize;
      const petalEndY = flowerY + Math.sin(angle) * petalSize;
      paths.push(`M ${flowerX} ${flowerY} C ${petalX - Math.sin(angle) * 3} ${petalY + Math.cos(angle) * 3} ${petalEndX - Math.sin(angle) * 2} ${petalEndY + Math.cos(angle) * 2} ${petalEndX} ${petalEndY} C ${petalEndX + Math.sin(angle) * 2} ${petalEndY - Math.cos(angle) * 2} ${petalX + Math.sin(angle) * 3} ${petalY - Math.cos(angle) * 3} ${flowerX} ${flowerY} Z`);
    }
    // Flower center
    paths.push(`M ${flowerX - 3} ${flowerY} C ${flowerX - 3} ${flowerY - 3} ${flowerX + 3} ${flowerY - 3} ${flowerX + 3} ${flowerY} C ${flowerX + 3} ${flowerY + 3} ${flowerX - 3} ${flowerY + 3} ${flowerX - 3} ${flowerY} Z`);
  }
  
  // Decorative vines connecting flowers
  let vine = `M ${cx - headW * 0.8} ${crownY}`;
  for (let i = 0; i < 10; i++) {
    const vx = cx - headW * 0.8 + i * headW * 0.18;
    const vy = crownY - 5 + Math.sin(i * 0.8) * 5;
    vine += ` C ${vx + 3} ${vy - 2} ${vx + 6} ${vy + 2} ${vx + 8} ${vy}`;
  }
  paths.push(vine);
  
  // Small leaves on vine
  for (let l = 0; l < 8; l++) {
    const leafX = cx - headW * 0.7 + l * headW * 0.2;
    const leafY = crownY - 3 + Math.sin(l * 0.8) * 4;
    const leafAngle = r(400 + l) * 0.5 - 0.25;
    paths.push(`M ${leafX} ${leafY} C ${leafX + 4 * Math.cos(leafAngle)} ${leafY - 6 * Math.sin(leafAngle)} ${leafX + 8 * Math.cos(leafAngle)} ${leafY - 4 * Math.sin(leafAngle)} ${leafX + 6} ${leafY + 2} C ${leafX + 3} ${leafY + 1} ${leafX + 1} ${leafY} ${leafX} ${leafY} Z`);
  }

  // FLOWING ETHEREAL HAIR
  let hair = `M ${cx} ${baseY - 3}`;
  if (gender === 'female') {
    // Long flowing magical hair
    const hairLength = headH * 2.5;
    // Top volume with soft waves
    for (let i = 0; i <= 25; i++) {
      const angle = (i / 25) * Math.PI;
      const wave = Math.sin(i * 0.6) * 3;
      const x = cx + Math.sin(angle) * (headW * 1.12 + wave);
      const y = baseY - 8 - Math.cos(angle) * headH * 0.5;
      hair += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    // Right cascade with ethereal wisps
    hair += ` C ${cx + headW * 1.35} ${baseY + headH * 0.3} ${cx + headW * 1.4} ${baseY + headH * 0.8} ${cx + headW * 1.25} ${baseY + hairLength * 0.4}`;
    // Flowing strands with sparkle-like detail
    for (let i = 0; i < 15; i++) {
      const waveX = Math.sin(i * 0.5) * 12;
      const x = cx + headW * (1.15 - i * 0.1) + waveX;
      const y = baseY + hairLength * 0.4 + i * 8;
      hair += ` C ${x + waveX * 0.4} ${y + 3} ${x - waveX * 0.4} ${y + 6} ${x - waveX * 0.3} ${y + 8}`;
    }
    hair += ` C ${cx + headW * 0.2} ${baseY + hairLength + 5} ${cx} ${baseY + hairLength + 10} ${cx - headW * 0.2} ${baseY + hairLength + 5}`;
    // Left side
    for (let i = 14; i >= 0; i--) {
      const waveX = Math.sin(i * 0.5) * 12;
      const x = cx - headW * (1.15 - i * 0.1) - waveX;
      const y = baseY + hairLength * 0.4 + i * 8;
      hair += ` C ${x - waveX * 0.3} ${y + 6} ${x + waveX * 0.4} ${y + 3} ${x + waveX * 0.3} ${y - 2}`;
    }
    hair += ` C ${cx - headW * 1.4} ${baseY + headH * 0.8} ${cx - headW * 1.35} ${baseY + headH * 0.3} ${cx - headW * 1.12} ${baseY - 6}`;
  } else {
    // Shorter but still ethereal
    for (let i = 0; i <= 22; i++) {
      const angle = (i / 22) * Math.PI;
      const wave = Math.sin(i * 0.7) * 3;
      const x = cx + Math.sin(angle) * (headW * 1.1 + wave);
      const y = baseY - 6 - Math.cos(angle) * headH * 0.48;
      hair += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    hair += ` C ${cx + headW * 1.2} ${baseY + headH * 0.4} ${cx + headW * 1.15} ${baseY + headH + 20} ${cx + headW * 0.85} ${baseY + headH + 35}`;
    for (let i = 0; i < 6; i++) {
      const wave = Math.sin(i) * 5;
      hair += ` C ${cx + headW * (0.75 - i * 0.2) + wave} ${baseY + headH + 38 + i * 3} ${cx + headW * (0.65 - i * 0.2) - wave} ${baseY + headH + 40 + i * 3} ${cx + headW * (0.55 - i * 0.2)} ${baseY + headH + 42 + i * 2}`;
    }
    hair += ` L ${cx - headW * 0.55} ${baseY + headH + 50}`;
    hair += ` C ${cx - headW * 1.15} ${baseY + headH + 20} ${cx - headW * 1.2} ${baseY + headH * 0.4} ${cx - headW * 1.1} ${baseY - 5}`;
  }
  hair += ' Z';
  paths.push(hair);

  // LARGE LUMINOUS EYES - Very large anime-style
  const eyeY = baseY + headH * 0.42;
  const eyeSpacing = headW * 0.32;
  const eyeW = 12, eyeH = 10;
  
  // Right eye - large and round
  let rightEye = `M ${cx + eyeSpacing - eyeW} ${eyeY}`;
  rightEye += ` C ${cx + eyeSpacing - eyeW} ${eyeY - eyeH} ${cx + eyeSpacing + eyeW} ${eyeY - eyeH} ${cx + eyeSpacing + eyeW} ${eyeY}`;
  rightEye += ` C ${cx + eyeSpacing + eyeW} ${eyeY + eyeH * 0.7} ${cx + eyeSpacing - eyeW} ${eyeY + eyeH * 0.7} ${cx + eyeSpacing - eyeW} ${eyeY} Z`;
  paths.push(rightEye);
  // Large iris
  paths.push(`M ${cx + eyeSpacing - 5} ${eyeY - 1} C ${cx + eyeSpacing - 5} ${eyeY - 6} ${cx + eyeSpacing + 5} ${eyeY - 6} ${cx + eyeSpacing + 5} ${eyeY - 1} C ${cx + eyeSpacing + 5} ${eyeY + 4} ${cx + eyeSpacing - 5} ${eyeY + 4} ${cx + eyeSpacing - 5} ${eyeY - 1} Z`);
  // Pupil
  paths.push(`M ${cx + eyeSpacing - 2.5} ${eyeY - 1} C ${cx + eyeSpacing - 2.5} ${eyeY - 3.5} ${cx + eyeSpacing + 2.5} ${eyeY - 3.5} ${cx + eyeSpacing + 2.5} ${eyeY - 1} C ${cx + eyeSpacing + 2.5} ${eyeY + 1.5} ${cx + eyeSpacing - 2.5} ${eyeY + 1.5} ${cx + eyeSpacing - 2.5} ${eyeY - 1} Z`);
  // Sparkle highlights
  paths.push(`M ${cx + eyeSpacing + 3} ${eyeY - 4} C ${cx + eyeSpacing + 4.5} ${eyeY - 5.5} ${cx + eyeSpacing + 6} ${eyeY - 4} ${cx + eyeSpacing + 4.5} ${eyeY - 2.5} Z`);
  paths.push(`M ${cx + eyeSpacing - 4} ${eyeY + 1} C ${cx + eyeSpacing - 3} ${eyeY} ${cx + eyeSpacing - 2} ${eyeY + 1} ${cx + eyeSpacing - 3} ${eyeY + 2} Z`);
  
  // Left eye
  let leftEye = `M ${cx - eyeSpacing + eyeW} ${eyeY}`;
  leftEye += ` C ${cx - eyeSpacing + eyeW} ${eyeY - eyeH} ${cx - eyeSpacing - eyeW} ${eyeY - eyeH} ${cx - eyeSpacing - eyeW} ${eyeY}`;
  leftEye += ` C ${cx - eyeSpacing - eyeW} ${eyeY + eyeH * 0.7} ${cx - eyeSpacing + eyeW} ${eyeY + eyeH * 0.7} ${cx - eyeSpacing + eyeW} ${eyeY} Z`;
  paths.push(leftEye);
  paths.push(`M ${cx - eyeSpacing + 5} ${eyeY - 1} C ${cx - eyeSpacing + 5} ${eyeY - 6} ${cx - eyeSpacing - 5} ${eyeY - 6} ${cx - eyeSpacing - 5} ${eyeY - 1} C ${cx - eyeSpacing - 5} ${eyeY + 4} ${cx - eyeSpacing + 5} ${eyeY + 4} ${cx - eyeSpacing + 5} ${eyeY - 1} Z`);
  paths.push(`M ${cx - eyeSpacing + 2.5} ${eyeY - 1} C ${cx - eyeSpacing + 2.5} ${eyeY - 3.5} ${cx - eyeSpacing - 2.5} ${eyeY - 3.5} ${cx - eyeSpacing - 2.5} ${eyeY - 1} C ${cx - eyeSpacing - 2.5} ${eyeY + 1.5} ${cx - eyeSpacing + 2.5} ${eyeY + 1.5} ${cx - eyeSpacing + 2.5} ${eyeY - 1} Z`);
  paths.push(`M ${cx - eyeSpacing - 3} ${eyeY - 4} C ${cx - eyeSpacing - 4.5} ${eyeY - 5.5} ${cx - eyeSpacing - 6} ${eyeY - 4} ${cx - eyeSpacing - 4.5} ${eyeY - 2.5} Z`);
  paths.push(`M ${cx - eyeSpacing + 4} ${eyeY + 1} C ${cx - eyeSpacing + 3} ${eyeY} ${cx - eyeSpacing + 2} ${eyeY + 1} ${cx - eyeSpacing + 3} ${eyeY + 2} Z`);

  // Delicate curved brows
  paths.push(`M ${cx + eyeSpacing - eyeW - 3} ${eyeY - eyeH - 4} Q ${cx + eyeSpacing} ${eyeY - eyeH - 8} ${cx + eyeSpacing + eyeW + 3} ${eyeY - eyeH - 3}`);
  paths.push(`M ${cx - eyeSpacing + eyeW + 3} ${eyeY - eyeH - 4} Q ${cx - eyeSpacing} ${eyeY - eyeH - 8} ${cx - eyeSpacing - eyeW - 3} ${eyeY - eyeH - 3}`);

  // TINY NOSE - Almost button-like
  const noseY = baseY + headH * 0.62;
  paths.push(`M ${cx} ${eyeY + 8} C ${cx + 1.5} ${noseY - 4} ${cx + 3} ${noseY} ${cx + 3.5} ${noseY + 2} Q ${cx + 2} ${noseY + 4} ${cx} ${noseY + 3} Q ${cx - 2} ${noseY + 4} ${cx - 3.5} ${noseY + 2} C ${cx - 3} ${noseY} ${cx - 1.5} ${noseY - 4} ${cx} ${eyeY + 8} Z`);

  // SMALL ROSEBUD LIPS
  const lipY = baseY + headH * 0.78;
  const lipW = 8;
  // Upper lip
  paths.push(`M ${cx - lipW} ${lipY} C ${cx - lipW * 0.5} ${lipY - 2} ${cx - 1} ${lipY - 3} ${cx} ${lipY - 2.5} C ${cx + 1} ${lipY - 3} ${cx + lipW * 0.5} ${lipY - 2} ${cx + lipW} ${lipY} C ${cx + lipW * 0.5} ${lipY + 1} ${cx} ${lipY + 0.5} ${cx - lipW * 0.5} ${lipY + 1} Z`);
  // Lower lip
  paths.push(`M ${cx - lipW + 1} ${lipY + 1} C ${cx - lipW * 0.3} ${lipY + 1.5} ${cx} ${lipY + 1} ${cx + lipW * 0.3} ${lipY + 1.5} C ${cx + lipW - 1} ${lipY + 1} ${cx + lipW - 2} ${lipY + 4} ${cx} ${lipY + 5} C ${cx - lipW + 2} ${lipY + 4} ${cx - lipW + 1} ${lipY + 1} ${cx - lipW + 1} ${lipY + 1} Z`);

  // SLENDER NECK
  const neckTop = baseY + headH * 1.02;
  const neckW = 10 * p.neckWidth;
  const neckH = 22;
  
  let neck = `M ${cx - headW * 0.2} ${neckTop}`;
  neck += ` C ${cx - neckW * 0.9} ${neckTop + 4} ${cx - neckW * 0.85} ${neckTop + neckH * 0.6} ${cx - neckW} ${neckTop + neckH}`;
  neck += ` L ${cx + neckW} ${neckTop + neckH}`;
  neck += ` C ${cx + neckW * 0.85} ${neckTop + neckH * 0.6} ${cx + neckW * 0.9} ${neckTop + 4} ${cx + headW * 0.2} ${neckTop} Z`;
  paths.push(neck);

  // DELICATE TORSO
  const torsoTop = neckTop + neckH;
  const shoulderW = 42 * p.shoulderWidth;
  const waistW = 20 * p.waistWidth;
  const hipW = 28 * p.hipWidth;
  const torsoH = 75;

  let torso = `M ${cx - neckW} ${torsoTop}`;
  // Delicate shoulder slope
  torso += ` C ${cx - shoulderW * 0.4} ${torsoTop - 2} ${cx - shoulderW * 0.7} ${torsoTop + 6} ${cx - shoulderW} ${torsoTop + 12}`;
  torso += ` C ${cx - shoulderW - 4} ${torsoTop + 16} ${cx - shoulderW - 2} ${torsoTop + 24} ${cx - shoulderW + 3} ${torsoTop + 28}`;
  // Very slender waist
  torso += ` C ${cx - waistW - 6} ${torsoTop + torsoH * 0.45} ${cx - waistW - 2} ${torsoTop + torsoH * 0.58} ${cx - waistW} ${torsoTop + torsoH * 0.65}`;
  torso += ` C ${cx - waistW + 2} ${torsoTop + torsoH * 0.75} ${cx - hipW + 4} ${torsoTop + torsoH * 0.88} ${cx - hipW} ${torsoTop + torsoH}`;
  // Graceful hip
  torso += ` C ${cx - hipW * 0.5} ${torsoTop + torsoH + 4} ${cx} ${torsoTop + torsoH + 5} ${cx + hipW * 0.5} ${torsoTop + torsoH + 4}`;
  torso += ` C ${cx + hipW} ${torsoTop + torsoH} ${cx + hipW - 4} ${torsoTop + torsoH * 0.88} ${cx + waistW} ${torsoTop + torsoH * 0.65}`;
  torso += ` C ${cx + waistW + 2} ${torsoTop + torsoH * 0.58} ${cx + waistW + 6} ${torsoTop + torsoH * 0.45} ${cx + shoulderW - 3} ${torsoTop + 28}`;
  torso += ` C ${cx + shoulderW + 2} ${torsoTop + 24} ${cx + shoulderW + 4} ${torsoTop + 16} ${cx + shoulderW} ${torsoTop + 12}`;
  torso += ` C ${cx + shoulderW * 0.7} ${torsoTop + 6} ${cx + shoulderW * 0.4} ${torsoTop - 2} ${cx + neckW} ${torsoTop} Z`;
  paths.push(torso);

  // Delicate chest
  if (gender === 'female') {
    paths.push(`M ${cx - 4} ${torsoTop + 16} C ${cx - 14} ${torsoTop + 14} ${cx - 18} ${torsoTop + 22} ${cx - 16} ${torsoTop + 28} C ${cx - 14} ${torsoTop + 32} ${cx - 8} ${torsoTop + 33} ${cx - 4} ${torsoTop + 30} Z`);
    paths.push(`M ${cx + 4} ${torsoTop + 16} C ${cx + 14} ${torsoTop + 14} ${cx + 18} ${torsoTop + 22} ${cx + 16} ${torsoTop + 28} C ${cx + 14} ${torsoTop + 32} ${cx + 8} ${torsoTop + 33} ${cx + 4} ${torsoTop + 30} Z`);
  }

  // BUTTERFLY WINGS - Large ethereal wings
  const wingAttachY = torsoTop + 18;
  const wingSpanUpper = 95;
  const wingSpanLower = 75;
  const wingHeightUpper = 110;
  const wingHeightLower = 80;
  
  // Right upper wing
  let rightUpperWing = `M ${cx + shoulderW - 5} ${wingAttachY}`;
  rightUpperWing += ` C ${cx + shoulderW + 15} ${wingAttachY - 25} ${cx + shoulderW + 45} ${wingAttachY - wingHeightUpper * 0.6} ${cx + shoulderW + wingSpanUpper * 0.7} ${wingAttachY - wingHeightUpper * 0.85}`;
  // Wing tip curves
  rightUpperWing += ` C ${cx + shoulderW + wingSpanUpper * 0.85} ${wingAttachY - wingHeightUpper} ${cx + shoulderW + wingSpanUpper} ${wingAttachY - wingHeightUpper * 0.9} ${cx + shoulderW + wingSpanUpper * 0.95} ${wingAttachY - wingHeightUpper * 0.75}`;
  // Outer edge scallops
  rightUpperWing += ` C ${cx + shoulderW + wingSpanUpper * 0.9} ${wingAttachY - wingHeightUpper * 0.55} ${cx + shoulderW + wingSpanUpper * 0.8} ${wingAttachY - wingHeightUpper * 0.35} ${cx + shoulderW + wingSpanUpper * 0.65} ${wingAttachY - wingHeightUpper * 0.15}`;
  rightUpperWing += ` C ${cx + shoulderW + wingSpanUpper * 0.45} ${wingAttachY + 5} ${cx + shoulderW + 20} ${wingAttachY + 15} ${cx + shoulderW} ${wingAttachY + 10}`;
  rightUpperWing += ' Z';
  paths.push(rightUpperWing);
  
  // Wing vein pattern (upper right)
  paths.push(`M ${cx + shoulderW} ${wingAttachY + 5} C ${cx + shoulderW + 30} ${wingAttachY - 30} ${cx + shoulderW + 60} ${wingAttachY - wingHeightUpper * 0.6} ${cx + shoulderW + wingSpanUpper * 0.7} ${wingAttachY - wingHeightUpper * 0.8}`);
  paths.push(`M ${cx + shoulderW + 5} ${wingAttachY + 3} C ${cx + shoulderW + 25} ${wingAttachY - 15} ${cx + shoulderW + 50} ${wingAttachY - wingHeightUpper * 0.3} ${cx + shoulderW + wingSpanUpper * 0.8} ${wingAttachY - wingHeightUpper * 0.5}`);
  paths.push(`M ${cx + shoulderW + 10} ${wingAttachY + 8} C ${cx + shoulderW + 35} ${wingAttachY} ${cx + shoulderW + 55} ${wingAttachY - 10} ${cx + shoulderW + wingSpanUpper * 0.6} ${wingAttachY - wingHeightUpper * 0.1}`);
  
  // Wing spots/markings
  for (let s = 0; s < 4; s++) {
    const spotX = cx + shoulderW + 25 + s * 18;
    const spotY = wingAttachY - 25 - s * 18;
    const spotR = 5 + r(500 + s) * 4;
    paths.push(`M ${spotX - spotR} ${spotY} C ${spotX - spotR} ${spotY - spotR} ${spotX + spotR} ${spotY - spotR} ${spotX + spotR} ${spotY} C ${spotX + spotR} ${spotY + spotR} ${spotX - spotR} ${spotY + spotR} ${spotX - spotR} ${spotY} Z`);
  }
  
  // Right lower wing
  let rightLowerWing = `M ${cx + shoulderW - 3} ${wingAttachY + 12}`;
  rightLowerWing += ` C ${cx + shoulderW + 10} ${wingAttachY + 25} ${cx + shoulderW + 30} ${wingAttachY + wingHeightLower * 0.4} ${cx + shoulderW + wingSpanLower * 0.6} ${wingAttachY + wingHeightLower * 0.7}`;
  rightLowerWing += ` C ${cx + shoulderW + wingSpanLower * 0.75} ${wingAttachY + wingHeightLower * 0.85} ${cx + shoulderW + wingSpanLower * 0.8} ${wingAttachY + wingHeightLower} ${cx + shoulderW + wingSpanLower * 0.7} ${wingAttachY + wingHeightLower * 0.95}`;
  // Tail curve
  rightLowerWing += ` C ${cx + shoulderW + wingSpanLower * 0.55} ${wingAttachY + wingHeightLower * 0.85} ${cx + shoulderW + wingSpanLower * 0.35} ${wingAttachY + wingHeightLower * 0.6} ${cx + shoulderW + 15} ${wingAttachY + 35}`;
  rightLowerWing += ` C ${cx + shoulderW + 8} ${wingAttachY + 25} ${cx + shoulderW} ${wingAttachY + 18} ${cx + shoulderW - 3} ${wingAttachY + 12} Z`;
  paths.push(rightLowerWing);
  
  // Lower wing veins and spots
  paths.push(`M ${cx + shoulderW} ${wingAttachY + 15} C ${cx + shoulderW + 20} ${wingAttachY + 35} ${cx + shoulderW + 40} ${wingAttachY + wingHeightLower * 0.5} ${cx + shoulderW + wingSpanLower * 0.6} ${wingAttachY + wingHeightLower * 0.75}`);
  paths.push(`M ${cx + shoulderW + 25} ${wingAttachY + 45} C ${cx + shoulderW + 25} ${wingAttachY + 40} ${cx + shoulderW + 35} ${wingAttachY + 40} ${cx + shoulderW + 35} ${wingAttachY + 45} C ${cx + shoulderW + 35} ${wingAttachY + 50} ${cx + shoulderW + 25} ${wingAttachY + 50} ${cx + shoulderW + 25} ${wingAttachY + 45} Z`);

  // Left wings (mirror)
  let leftUpperWing = `M ${cx - shoulderW + 5} ${wingAttachY}`;
  leftUpperWing += ` C ${cx - shoulderW - 15} ${wingAttachY - 25} ${cx - shoulderW - 45} ${wingAttachY - wingHeightUpper * 0.6} ${cx - shoulderW - wingSpanUpper * 0.7} ${wingAttachY - wingHeightUpper * 0.85}`;
  leftUpperWing += ` C ${cx - shoulderW - wingSpanUpper * 0.85} ${wingAttachY - wingHeightUpper} ${cx - shoulderW - wingSpanUpper} ${wingAttachY - wingHeightUpper * 0.9} ${cx - shoulderW - wingSpanUpper * 0.95} ${wingAttachY - wingHeightUpper * 0.75}`;
  leftUpperWing += ` C ${cx - shoulderW - wingSpanUpper * 0.9} ${wingAttachY - wingHeightUpper * 0.55} ${cx - shoulderW - wingSpanUpper * 0.8} ${wingAttachY - wingHeightUpper * 0.35} ${cx - shoulderW - wingSpanUpper * 0.65} ${wingAttachY - wingHeightUpper * 0.15}`;
  leftUpperWing += ` C ${cx - shoulderW - wingSpanUpper * 0.45} ${wingAttachY + 5} ${cx - shoulderW - 20} ${wingAttachY + 15} ${cx - shoulderW} ${wingAttachY + 10}`;
  leftUpperWing += ' Z';
  paths.push(leftUpperWing);
  
  // Left wing veins
  paths.push(`M ${cx - shoulderW} ${wingAttachY + 5} C ${cx - shoulderW - 30} ${wingAttachY - 30} ${cx - shoulderW - 60} ${wingAttachY - wingHeightUpper * 0.6} ${cx - shoulderW - wingSpanUpper * 0.7} ${wingAttachY - wingHeightUpper * 0.8}`);
  paths.push(`M ${cx - shoulderW - 5} ${wingAttachY + 3} C ${cx - shoulderW - 25} ${wingAttachY - 15} ${cx - shoulderW - 50} ${wingAttachY - wingHeightUpper * 0.3} ${cx - shoulderW - wingSpanUpper * 0.8} ${wingAttachY - wingHeightUpper * 0.5}`);
  paths.push(`M ${cx - shoulderW - 10} ${wingAttachY + 8} C ${cx - shoulderW - 35} ${wingAttachY} ${cx - shoulderW - 55} ${wingAttachY - 10} ${cx - shoulderW - wingSpanUpper * 0.6} ${wingAttachY - wingHeightUpper * 0.1}`);
  
  // Left wing spots
  for (let s = 0; s < 4; s++) {
    const spotX = cx - shoulderW - 25 - s * 18;
    const spotY = wingAttachY - 25 - s * 18;
    const spotR = 5 + r(500 + s) * 4;
    paths.push(`M ${spotX + spotR} ${spotY} C ${spotX + spotR} ${spotY - spotR} ${spotX - spotR} ${spotY - spotR} ${spotX - spotR} ${spotY} C ${spotX - spotR} ${spotY + spotR} ${spotX + spotR} ${spotY + spotR} ${spotX + spotR} ${spotY} Z`);
  }
  
  // Left lower wing
  let leftLowerWing = `M ${cx - shoulderW + 3} ${wingAttachY + 12}`;
  leftLowerWing += ` C ${cx - shoulderW - 10} ${wingAttachY + 25} ${cx - shoulderW - 30} ${wingAttachY + wingHeightLower * 0.4} ${cx - shoulderW - wingSpanLower * 0.6} ${wingAttachY + wingHeightLower * 0.7}`;
  leftLowerWing += ` C ${cx - shoulderW - wingSpanLower * 0.75} ${wingAttachY + wingHeightLower * 0.85} ${cx - shoulderW - wingSpanLower * 0.8} ${wingAttachY + wingHeightLower} ${cx - shoulderW - wingSpanLower * 0.7} ${wingAttachY + wingHeightLower * 0.95}`;
  leftLowerWing += ` C ${cx - shoulderW - wingSpanLower * 0.55} ${wingAttachY + wingHeightLower * 0.85} ${cx - shoulderW - wingSpanLower * 0.35} ${wingAttachY + wingHeightLower * 0.6} ${cx - shoulderW - 15} ${wingAttachY + 35}`;
  leftLowerWing += ` C ${cx - shoulderW - 8} ${wingAttachY + 25} ${cx - shoulderW} ${wingAttachY + 18} ${cx - shoulderW + 3} ${wingAttachY + 12} Z`;
  paths.push(leftLowerWing);

  // SLENDER ARMS
  const armStartY = torsoTop + 12;
  const upperArmL = 42;
  const forearmL = 38;
  const armW = gender === 'male' ? 7 : 5;

  // Left arm
  let leftArm = `M ${cx - shoulderW} ${armStartY}`;
  leftArm += ` C ${cx - shoulderW - 6} ${armStartY + 12} ${cx - shoulderW - 9} ${armStartY + upperArmL - 8} ${cx - shoulderW - 7} ${armStartY + upperArmL}`;
  leftArm += ` C ${cx - shoulderW - 10} ${armStartY + upperArmL + 8} ${cx - shoulderW - 7} ${armStartY + upperArmL + forearmL - 8} ${cx - shoulderW - 5} ${armStartY + upperArmL + forearmL}`;
  // Delicate hand
  leftArm += ` C ${cx - shoulderW - 2} ${armStartY + upperArmL + forearmL + 15} ${cx - shoulderW + 8} ${armStartY + upperArmL + forearmL + 18} ${cx - shoulderW + 6} ${armStartY + upperArmL + forearmL + 5}`;
  leftArm += ` C ${cx - shoulderW + armW + 3} ${armStartY + upperArmL + 20} ${cx - shoulderW + armW} ${armStartY + 12} ${cx - shoulderW + 3} ${armStartY} Z`;
  paths.push(leftArm);

  // Right arm
  let rightArm = `M ${cx + shoulderW} ${armStartY}`;
  rightArm += ` C ${cx + shoulderW + 6} ${armStartY + 12} ${cx + shoulderW + 9} ${armStartY + upperArmL - 8} ${cx + shoulderW + 7} ${armStartY + upperArmL}`;
  rightArm += ` C ${cx + shoulderW + 10} ${armStartY + upperArmL + 8} ${cx + shoulderW + 7} ${armStartY + upperArmL + forearmL - 8} ${cx + shoulderW + 5} ${armStartY + upperArmL + forearmL}`;
  rightArm += ` C ${cx + shoulderW + 2} ${armStartY + upperArmL + forearmL + 15} ${cx + shoulderW - 8} ${armStartY + upperArmL + forearmL + 18} ${cx + shoulderW - 6} ${armStartY + upperArmL + forearmL + 5}`;
  rightArm += ` C ${cx + shoulderW - armW - 3} ${armStartY + upperArmL + 20} ${cx + shoulderW - armW} ${armStartY + 12} ${cx + shoulderW - 3} ${armStartY} Z`;
  paths.push(rightArm);

  // Delicate fingers
  const handY = armStartY + upperArmL + forearmL + 5;
  for (let side = -1; side <= 1; side += 2) {
    const handX = cx + side * (shoulderW - 2);
    for (let f = 0; f < 5; f++) {
      const fingerW = 1.5;
      const fingerL = f === 0 ? 10 : 14 + (2 - Math.abs(f - 2)) * 3;
      const fingerX = handX + side * (f * 3 - 5);
      const fingerY = f === 0 ? handY + 6 : handY + 12;
      paths.push(`M ${fingerX - fingerW} ${fingerY} L ${fingerX - fingerW * 0.6} ${fingerY + fingerL} Q ${fingerX} ${fingerY + fingerL + 1.5} ${fingerX + fingerW * 0.6} ${fingerY + fingerL} L ${fingerX + fingerW} ${fingerY} Z`);
    }
  }

  // SLENDER LEGS
  const legTop = torsoTop + torsoH + 4;
  const thighL = 58;
  const calfL = 52;
  const legW = gender === 'male' ? 12 : 10;

  // Left leg
  let leftLeg = `M ${cx - hipW * 0.1} ${legTop}`;
  leftLeg += ` C ${cx - hipW * 0.3} ${legTop + 6} ${cx - hipW * 0.45} ${legTop + 15} ${cx - legW - 5} ${legTop + thighL * 0.5}`;
  leftLeg += ` C ${cx - legW - 7} ${legTop + thighL * 0.8} ${cx - legW - 6} ${legTop + thighL} ${cx - legW - 4} ${legTop + thighL + 5}`;
  leftLeg += ` C ${cx - legW - 5} ${legTop + thighL + 18} ${cx - legW - 2} ${legTop + thighL + calfL - 10} ${cx - legW} ${legTop + thighL + calfL}`;
  // Dainty pointed foot
  leftLeg += ` L ${cx - legW - 5} ${legTop + thighL + calfL + 8}`;
  leftLeg += ` C ${cx - legW - 8} ${legTop + thighL + calfL + 12} ${cx - 25} ${legTop + thighL + calfL + 18} ${cx - 28} ${legTop + thighL + calfL + 22}`;
  leftLeg += ` C ${cx - 30} ${legTop + thighL + calfL + 25} ${cx - 28} ${legTop + thighL + calfL + 28} ${cx - 8} ${legTop + thighL + calfL + 28}`;
  leftLeg += ` L ${cx - 5} ${legTop + thighL + calfL}`;
  leftLeg += ` C ${cx - 4} ${legTop + thighL + 15} ${cx - 8} ${legTop + 15} ${cx - hipW * 0.1} ${legTop} Z`;
  paths.push(leftLeg);

  // Right leg
  let rightLeg = `M ${cx + hipW * 0.1} ${legTop}`;
  rightLeg += ` C ${cx + hipW * 0.3} ${legTop + 6} ${cx + hipW * 0.45} ${legTop + 15} ${cx + legW + 5} ${legTop + thighL * 0.5}`;
  rightLeg += ` C ${cx + legW + 7} ${legTop + thighL * 0.8} ${cx + legW + 6} ${legTop + thighL} ${cx + legW + 4} ${legTop + thighL + 5}`;
  rightLeg += ` C ${cx + legW + 5} ${legTop + thighL + 18} ${cx + legW + 2} ${legTop + thighL + calfL - 10} ${cx + legW} ${legTop + thighL + calfL}`;
  rightLeg += ` L ${cx + legW + 5} ${legTop + thighL + calfL + 8}`;
  rightLeg += ` C ${cx + legW + 8} ${legTop + thighL + calfL + 12} ${cx + 25} ${legTop + thighL + calfL + 18} ${cx + 28} ${legTop + thighL + calfL + 22}`;
  rightLeg += ` C ${cx + 30} ${legTop + thighL + calfL + 25} ${cx + 28} ${legTop + thighL + calfL + 28} ${cx + 8} ${legTop + thighL + calfL + 28}`;
  rightLeg += ` L ${cx + 5} ${legTop + thighL + calfL}`;
  rightLeg += ` C ${cx + 4} ${legTop + thighL + 15} ${cx + 8} ${legTop + 15} ${cx + hipW * 0.1} ${legTop} Z`;
  paths.push(rightLeg);

  // SPARKLES / MAGIC PARTICLES around the figure
  for (let s = 0; s < 20; s++) {
    const sparkX = cx + (r(600 + s) - 0.5) * 180;
    const sparkY = baseY + r(620 + s) * 300;
    const sparkSize = 2 + r(640 + s) * 3;
    // 4-pointed star sparkle
    paths.push(`M ${sparkX} ${sparkY - sparkSize} L ${sparkX + sparkSize * 0.3} ${sparkY} L ${sparkX} ${sparkY + sparkSize} L ${sparkX - sparkSize * 0.3} ${sparkY} Z`);
    paths.push(`M ${sparkX - sparkSize} ${sparkY} L ${sparkX} ${sparkY - sparkSize * 0.3} L ${sparkX + sparkSize} ${sparkY} L ${sparkX} ${sparkY + sparkSize * 0.3} Z`);
  }

  return paths;
};

// ============================================================================
// COMPONENT EXPORTS
// ============================================================================
interface AvatarSilhouetteProps {
  race: 'dragonkin' | 'fae';
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
    dragonkin: generateDragonkinSilhouette,
    fae: generateFaeSilhouette,
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
