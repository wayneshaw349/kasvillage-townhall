// KasVillage Identity Ritual - Gnome, Phoenix, Sprite Silhouettes
// NO SEED - Pure runtime randomness - Hash inscribed, paths stored locally

import React from 'react';
import Svg, { Path, G } from 'react-native-svg';

type Gender = 'male' | 'female';

const r = () => Math.random();

const BODY_PARAMS = {
  male: { shoulderWidth: 1.15, hipWidth: 0.88, waistWidth: 0.95, neckWidth: 1.1, jawWidth: 1.08 },
  female: { shoulderWidth: 0.92, hipWidth: 1.08, waistWidth: 0.8, neckWidth: 0.88, jawWidth: 0.94 },
};

// ============================================================================
// GNOME - Small stature, big head, large nose, pointy hat, bushy beard/hair
// ============================================================================
export const generateGnomeSilhouette = (gender: Gender): string[] => {
  const p = BODY_PARAMS[gender];
  const paths: string[] = [];
  
  const cx = 200, baseY = 55;
  const headW = 42 * p.jawWidth;
  const headH = 48;
  
  // LARGE ROUND HEAD
  let skull = `M ${cx} ${baseY}`;
  for (let i = 0; i <= 35; i++) {
    const angle = (i / 35) * Math.PI;
    const wobble = (r() - 0.5) * 2;
    const rx = headW * (0.92 + r() * 0.05);
    const ry = headH * 0.5;
    const x = cx + Math.sin(angle) * rx + wobble;
    const y = baseY + 6 - Math.cos(angle) * ry;
    skull += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  skull += ` C ${cx + headW * 0.95} ${baseY + headH * 0.35} ${cx + headW} ${baseY + headH * 0.5} ${cx + headW * 0.95} ${baseY + headH * 0.6}`;
  skull += ` C ${cx + headW * 0.92} ${baseY + headH * 0.75} ${cx + headW * 0.8} ${baseY + headH * 0.88} ${cx + headW * 0.6} ${baseY + headH * 0.95}`;
  skull += ` C ${cx + headW * 0.3} ${baseY + headH} ${cx} ${baseY + headH * 1.02} ${cx - headW * 0.3} ${baseY + headH}`;
  skull += ` C ${cx - headW * 0.6} ${baseY + headH * 0.95} ${cx - headW * 0.8} ${baseY + headH * 0.88} ${cx - headW * 0.92} ${baseY + headH * 0.75}`;
  skull += ` C ${cx - headW} ${baseY + headH * 0.5} ${cx - headW * 0.95} ${baseY + headH * 0.35} ${cx - headW * 0.9} ${baseY + headH * 0.2}`;
  skull += ' Z';
  paths.push(skull);

  // TALL POINTY HAT
  const hatBase = baseY - 8;
  const hatH = 75 + r() * 20;
  const hatW = headW * 1.15;
  let hat = `M ${cx - hatW} ${hatBase + 15}`;
  hat += ` C ${cx - hatW * 0.9} ${hatBase + 5} ${cx - hatW * 0.6} ${hatBase - 5} ${cx - hatW * 0.3} ${hatBase - hatH * 0.4}`;
  hat += ` C ${cx - hatW * 0.15} ${hatBase - hatH * 0.65} ${cx - 5} ${hatBase - hatH * 0.9} ${cx + 3} ${hatBase - hatH}`;
  // Hat tip curves over
  const tipCurve = 25 + r() * 15;
  hat += ` C ${cx + 8} ${hatBase - hatH + 5} ${cx + tipCurve} ${hatBase - hatH + 15} ${cx + tipCurve + 10} ${hatBase - hatH + 30}`;
  hat += ` C ${cx + tipCurve + 5} ${hatBase - hatH + 35} ${cx + tipCurve - 5} ${hatBase - hatH + 32} ${cx + tipCurve - 10} ${hatBase - hatH + 25}`;
  // Back down
  hat += ` C ${cx + hatW * 0.15} ${hatBase - hatH * 0.65} ${cx + hatW * 0.3} ${hatBase - hatH * 0.4} ${cx + hatW * 0.6} ${hatBase - 5}`;
  hat += ` C ${cx + hatW * 0.9} ${hatBase + 5} ${cx + hatW} ${hatBase + 15} ${cx + hatW} ${hatBase + 20}`;
  // Hat brim
  hat += ` C ${cx + hatW + 8} ${hatBase + 22} ${cx + hatW + 10} ${hatBase + 28} ${cx + hatW + 5} ${hatBase + 32}`;
  hat += ` C ${cx + hatW * 0.5} ${hatBase + 38} ${cx} ${hatBase + 40} ${cx - hatW * 0.5} ${hatBase + 38}`;
  hat += ` C ${cx - hatW - 5} ${hatBase + 32} ${cx - hatW - 10} ${hatBase + 28} ${cx - hatW - 8} ${hatBase + 22}`;
  hat += ` C ${cx - hatW} ${hatBase + 18} ${cx - hatW} ${hatBase + 15} ${cx - hatW} ${hatBase + 15} Z`;
  paths.push(hat);

  // Hat band
  paths.push(`M ${cx - hatW - 5} ${hatBase + 25} C ${cx} ${hatBase + 32} ${cx + hatW + 5} ${hatBase + 25} ${cx + hatW + 5} ${hatBase + 25}`);
  
  // Hat decorations - small buckle or gem
  paths.push(`M ${cx - 8} ${hatBase + 26} L ${cx + 8} ${hatBase + 26} L ${cx + 8} ${hatBase + 34} L ${cx - 8} ${hatBase + 34} Z`);
  paths.push(`M ${cx - 4} ${hatBase + 28} L ${cx + 4} ${hatBase + 28} L ${cx + 4} ${hatBase + 32} L ${cx - 4} ${hatBase + 32} Z`);

  // LARGE TWINKLING EYES
  const eyeY = baseY + headH * 0.42;
  const eyeSpacing = headW * 0.32;
  const eyeW = 10, eyeH = 8;
  for (let side = -1; side <= 1; side += 2) {
    const eyeX = cx + side * eyeSpacing;
    paths.push(`M ${eyeX - eyeW} ${eyeY} C ${eyeX - eyeW} ${eyeY - eyeH} ${eyeX + eyeW} ${eyeY - eyeH} ${eyeX + eyeW} ${eyeY} C ${eyeX + eyeW} ${eyeY + eyeH * 0.5} ${eyeX - eyeW} ${eyeY + eyeH * 0.5} ${eyeX - eyeW} ${eyeY} Z`);
    // Large iris
    paths.push(`M ${eyeX - 5} ${eyeY - 1} C ${eyeX - 5} ${eyeY - 6} ${eyeX + 5} ${eyeY - 6} ${eyeX + 5} ${eyeY - 1} C ${eyeX + 5} ${eyeY + 4} ${eyeX - 5} ${eyeY + 4} ${eyeX - 5} ${eyeY - 1} Z`);
    paths.push(`M ${eyeX - 2.5} ${eyeY - 1} C ${eyeX - 2.5} ${eyeY - 3.5} ${eyeX + 2.5} ${eyeY - 3.5} ${eyeX + 2.5} ${eyeY - 1} C ${eyeX + 2.5} ${eyeY + 1.5} ${eyeX - 2.5} ${eyeY + 1.5} ${eyeX - 2.5} ${eyeY - 1} Z`);
    // Twinkle
    paths.push(`M ${eyeX + 3} ${eyeY - 4} L ${eyeX + 5} ${eyeY - 5.5} L ${eyeX + 4} ${eyeY - 3} Z`);
  }

  // Bushy eyebrows
  for (let side = -1; side <= 1; side += 2) {
    const browX = cx + side * eyeSpacing;
    const browY = eyeY - eyeH - 3;
    let brow = `M ${browX - side * 12} ${browY + 4}`;
    for (let b = 0; b < 6; b++) {
      brow += ` Q ${browX - side * (10 - b * 4) + (r() - 0.5) * 4} ${browY - 5 - r() * 5} ${browX - side * (8 - b * 4)} ${browY + 2}`;
    }
    paths.push(brow);
  }

  // LARGE BULBOUS NOSE
  const noseY = baseY + headH * 0.6;
  const noseW = 12 + r() * 4;
  const noseH = 20 + r() * 6;
  paths.push(`M ${cx - 3} ${eyeY + 8} C ${cx - 6} ${noseY - 8} ${cx - noseW} ${noseY} ${cx - noseW - 2} ${noseY + noseH * 0.4} C ${cx - noseW - 3} ${noseY + noseH * 0.7} ${cx - noseW + 2} ${noseY + noseH} ${cx - 5} ${noseY + noseH + 3} C ${cx} ${noseY + noseH + 5} ${cx + 5} ${noseY + noseH + 3} ${cx + noseW - 2} ${noseY + noseH} C ${cx + noseW + 3} ${noseY + noseH * 0.7} ${cx + noseW + 2} ${noseY + noseH * 0.4} ${cx + noseW} ${noseY} C ${cx + 6} ${noseY - 8} ${cx + 3} ${eyeY + 8} ${cx - 3} ${eyeY + 8} Z`);
  // Nostrils
  paths.push(`M ${cx - 6} ${noseY + noseH - 2} C ${cx - 9} ${noseY + noseH - 5} ${cx - 9} ${noseY + noseH + 2} ${cx - 5} ${noseY + noseH} Z`);
  paths.push(`M ${cx + 6} ${noseY + noseH - 2} C ${cx + 9} ${noseY + noseH - 5} ${cx + 9} ${noseY + noseH + 2} ${cx + 5} ${noseY + noseH} Z`);

  // ROSY CHEEKS
  for (let side = -1; side <= 1; side += 2) {
    const cheekX = cx + side * (headW * 0.55);
    const cheekY = noseY + 5;
    paths.push(`M ${cheekX - 8} ${cheekY} C ${cheekX - 8} ${cheekY - 6} ${cheekX + 8} ${cheekY - 6} ${cheekX + 8} ${cheekY} C ${cheekX + 8} ${cheekY + 6} ${cheekX - 8} ${cheekY + 6} ${cheekX - 8} ${cheekY} Z`);
  }

  // MOUTH - small friendly smile
  const mouthY = noseY + noseH + 8;
  paths.push(`M ${cx - 10} ${mouthY} Q ${cx} ${mouthY + 8} ${cx + 10} ${mouthY}`);

  // BUSHY BEARD (male) or CURLY HAIR PEEKING (female)
  if (gender === 'male') {
    const beardLen = 50 + r() * 25;
    let beard = `M ${cx - headW * 0.7} ${baseY + headH * 0.75}`;
    for (let b = 0; b < 15; b++) {
      const bx = cx - headW * 0.7 + b * (headW * 1.4 / 14);
      const by = baseY + headH + beardLen * (0.8 + Math.sin(b * 0.5) * 0.2) + r() * 10;
      beard += ` Q ${bx + (r() - 0.5) * 8} ${by - 10} ${bx} ${by}`;
    }
    beard += ` L ${cx + headW * 0.7} ${baseY + headH * 0.75}`;
    // Return along face
    beard += ` C ${cx + headW * 0.5} ${baseY + headH * 0.9} ${cx} ${baseY + headH} ${cx - headW * 0.5} ${baseY + headH * 0.9}`;
    beard += ' Z';
    paths.push(beard);
    
    // Beard texture curls
    for (let curl = 0; curl < 20; curl++) {
      const curlX = cx + (r() - 0.5) * headW * 1.2;
      const curlY = baseY + headH + r() * beardLen * 0.7;
      const curlR = 4 + r() * 4;
      paths.push(`M ${curlX} ${curlY} C ${curlX + curlR} ${curlY - curlR} ${curlX + curlR * 2} ${curlY} ${curlX + curlR} ${curlY + curlR} C ${curlX} ${curlY + curlR * 1.5} ${curlX - curlR} ${curlY + curlR} ${curlX} ${curlY}`);
    }
  } else {
    // Curly hair peeking from under hat
    for (let curl = 0; curl < 12; curl++) {
      const curlX = cx + (r() - 0.5) * headW * 2;
      const curlY = hatBase + 35 + r() * 20;
      const curlR = 6 + r() * 6;
      for (let ring = 0; ring < 2; ring++) {
        paths.push(`M ${curlX - curlR + ring * 3} ${curlY} C ${curlX - curlR + ring * 3} ${curlY - curlR} ${curlX + curlR - ring * 3} ${curlY - curlR} ${curlX + curlR - ring * 3} ${curlY} C ${curlX + curlR - ring * 3} ${curlY + curlR} ${curlX - curlR + ring * 3} ${curlY + curlR} ${curlX - curlR + ring * 3} ${curlY} Z`);
      }
    }
  }

  // SMALL POINTED EARS
  const earY = baseY + headH * 0.4;
  for (let side = -1; side <= 1; side += 2) {
    paths.push(`M ${cx + side * headW * 0.92} ${earY} C ${cx + side * (headW + 8)} ${earY - 5} ${cx + side * (headW + 15)} ${earY - 12} ${cx + side * (headW + 18)} ${earY - 18} C ${cx + side * (headW + 14)} ${earY - 10} ${cx + side * (headW + 10)} ${earY + 5} ${cx + side * (headW + 5)} ${earY + 15} C ${cx + side * (headW + 2)} ${earY + 20} ${cx + side * headW * 0.94} ${earY + 18} ${cx + side * headW * 0.92} ${earY + 12} Z`);
  }

  // SHORT THICK NECK
  const neckTop = baseY + headH;
  const neckW = 18 * p.neckWidth;
  const neckH = 12;
  paths.push(`M ${cx - headW * 0.25} ${neckTop} L ${cx - neckW} ${neckTop + neckH} L ${cx + neckW} ${neckTop + neckH} L ${cx + headW * 0.25} ${neckTop} Z`);

  // STOUT TORSO - short and sturdy
  const torsoTop = neckTop + neckH;
  const shoulderW = 48 * p.shoulderWidth;
  const waistW = 38 * p.waistWidth;
  const hipW = 35 * p.hipWidth;
  const torsoH = 55;

  let torso = `M ${cx - neckW} ${torsoTop}`;
  torso += ` C ${cx - shoulderW * 0.6} ${torsoTop - 2} ${cx - shoulderW * 0.85} ${torsoTop + 8} ${cx - shoulderW} ${torsoTop + 15}`;
  torso += ` C ${cx - shoulderW - 5} ${torsoTop + 25} ${cx - shoulderW - 3} ${torsoTop + 38} ${cx - waistW - 5} ${torsoTop + torsoH * 0.7}`;
  torso += ` L ${cx - hipW} ${torsoTop + torsoH}`;
  torso += ` L ${cx + hipW} ${torsoTop + torsoH}`;
  torso += ` C ${cx + shoulderW + 3} ${torsoTop + 38} ${cx + shoulderW + 5} ${torsoTop + 25} ${cx + shoulderW} ${torsoTop + 15}`;
  torso += ` C ${cx + shoulderW * 0.85} ${torsoTop + 8} ${cx + shoulderW * 0.6} ${torsoTop - 2} ${cx + neckW} ${torsoTop} Z`;
  paths.push(torso);

  // Vest/tunic details
  paths.push(`M ${cx} ${torsoTop + 5} L ${cx} ${torsoTop + torsoH - 5}`);
  for (let btn = 0; btn < 3; btn++) {
    const btnY = torsoTop + 15 + btn * 14;
    paths.push(`M ${cx - 3} ${btnY} C ${cx - 3} ${btnY - 3} ${cx + 3} ${btnY - 3} ${cx + 3} ${btnY} C ${cx + 3} ${btnY + 3} ${cx - 3} ${btnY + 3} ${cx - 3} ${btnY} Z`);
  }

  // Belt
  const beltY = torsoTop + torsoH - 10;
  paths.push(`M ${cx - waistW - 3} ${beltY - 4} L ${cx + waistW + 3} ${beltY - 4} L ${cx + waistW + 3} ${beltY + 4} L ${cx - waistW - 3} ${beltY + 4} Z`);
  // Belt buckle
  paths.push(`M ${cx - 8} ${beltY - 6} L ${cx + 8} ${beltY - 6} L ${cx + 8} ${beltY + 6} L ${cx - 8} ${beltY + 6} Z`);
  paths.push(`M ${cx - 4} ${beltY - 3} L ${cx + 4} ${beltY - 3} L ${cx + 4} ${beltY + 3} L ${cx - 4} ${beltY + 3} Z`);

  // SHORT STURDY ARMS
  const armStartY = torsoTop + 15;
  const upperArmL = 28;
  const forearmL = 26;

  for (let side = -1; side <= 1; side += 2) {
    let arm = `M ${cx + side * shoulderW} ${armStartY}`;
    arm += ` C ${cx + side * (shoulderW + 6)} ${armStartY + 10} ${cx + side * (shoulderW + 9)} ${armStartY + upperArmL - 6} ${cx + side * (shoulderW + 7)} ${armStartY + upperArmL}`;
    arm += ` C ${cx + side * (shoulderW + 10)} ${armStartY + upperArmL + 8} ${cx + side * (shoulderW + 7)} ${armStartY + upperArmL + forearmL - 6} ${cx + side * (shoulderW + 5)} ${armStartY + upperArmL + forearmL}`;
    arm += ` C ${cx + side * (shoulderW + 3)} ${armStartY + upperArmL + forearmL + 12} ${cx + side * (shoulderW - 8)} ${armStartY + upperArmL + forearmL + 15} ${cx + side * (shoulderW - 6)} ${armStartY + upperArmL + forearmL + 4}`;
    arm += ` C ${cx + side * (shoulderW - 10)} ${armStartY + upperArmL + 15} ${cx + side * (shoulderW - 8)} ${armStartY + 10} ${cx + side * (shoulderW - 5)} ${armStartY} Z`;
    paths.push(arm);

    // Small chubby hands with fingers
    const handY = armStartY + upperArmL + forearmL + 4;
    const handX = cx + side * (shoulderW - 2);
    for (let f = 0; f < 5; f++) {
      const fingerW = 2;
      const fingerL = f === 0 ? 8 : 11 + (2 - Math.abs(f - 2)) * 2;
      const fingerX = handX + side * (f * 3.5 - 5);
      const fingerY = f === 0 ? handY + 4 : handY + 10;
      paths.push(`M ${fingerX - fingerW} ${fingerY} L ${fingerX - fingerW * 0.6} ${fingerY + fingerL} Q ${fingerX} ${fingerY + fingerL + 1.5} ${fingerX + fingerW * 0.6} ${fingerY + fingerL} L ${fingerX + fingerW} ${fingerY} Z`);
    }
  }

  // SHORT STURDY LEGS
  const legTop = torsoTop + torsoH;
  const thighL = 32;
  const calfL = 28;
  const legW = 12;

  for (let side = -1; side <= 1; side += 2) {
    let leg = `M ${cx + side * hipW * 0.15} ${legTop}`;
    leg += ` C ${cx + side * hipW * 0.4} ${legTop + 8} ${cx + side * hipW * 0.55} ${legTop + 18} ${cx + side * (legW + 5)} ${legTop + thighL * 0.6}`;
    leg += ` C ${cx + side * (legW + 8)} ${legTop + thighL * 0.85} ${cx + side * (legW + 6)} ${legTop + thighL} ${cx + side * (legW + 4)} ${legTop + thighL + 5}`;
    leg += ` C ${cx + side * (legW + 6)} ${legTop + thighL + 15} ${cx + side * (legW + 4)} ${legTop + thighL + calfL - 8} ${cx + side * (legW + 3)} ${legTop + thighL + calfL}`;
    // Curled toe boots
    leg += ` L ${cx + side * (legW + 6)} ${legTop + thighL + calfL + 8}`;
    leg += ` C ${cx + side * 35} ${legTop + thighL + calfL + 12} ${cx + side * 40} ${legTop + thighL + calfL + 8} ${cx + side * 42} ${legTop + thighL + calfL + 5}`;
    leg += ` C ${cx + side * 38} ${legTop + thighL + calfL + 3} ${cx + side * 35} ${legTop + thighL + calfL + 6} ${cx + side * 32} ${legTop + thighL + calfL + 12}`;
    leg += ` L ${cx + side * 6} ${legTop + thighL + calfL + 12}`;
    leg += ` L ${cx + side * 5} ${legTop + thighL + calfL + 3}`;
    leg += ` C ${cx + side * 6} ${legTop + thighL + 12} ${cx + side * 10} ${legTop + 18} ${cx + side * hipW * 0.15} ${legTop} Z`;
    paths.push(leg);
  }

  return paths;
};

// ============================================================================
// PHOENIX - Bird humanoid, fire feathers, flame wings, glowing eyes
// ============================================================================
export const generatePhoenixSilhouette = (gender: Gender): string[] => {
  const p = BODY_PARAMS[gender];
  const paths: string[] = [];
  
  const cx = 200, baseY = 45;
  const headW = 32 * p.jawWidth;
  const headH = 40;
  
  // ELEGANT BIRD-LIKE HEAD
  let skull = `M ${cx} ${baseY}`;
  for (let i = 0; i <= 30; i++) {
    const angle = (i / 30) * Math.PI;
    const flame = Math.sin(i * 0.8) * 2;
    const rx = headW * (0.9 + r() * 0.05);
    const ry = headH * 0.48;
    skull += ` L ${(cx + Math.sin(angle) * rx + flame).toFixed(2)} ${(baseY + 5 - Math.cos(angle) * ry).toFixed(2)}`;
  }
  skull += ` C ${cx + headW * 0.9} ${baseY + headH * 0.35} ${cx + headW * 0.95} ${baseY + headH * 0.5} ${cx + headW * 0.9} ${baseY + headH * 0.62}`;
  skull += ` C ${cx + headW * 0.85} ${baseY + headH * 0.78} ${cx + headW * 0.7} ${baseY + headH * 0.9} ${cx + headW * 0.45} ${baseY + headH * 0.96}`;
  skull += ` C ${cx + headW * 0.2} ${baseY + headH} ${cx} ${baseY + headH * 1.02} ${cx - headW * 0.2} ${baseY + headH}`;
  skull += ` C ${cx - headW * 0.45} ${baseY + headH * 0.96} ${cx - headW * 0.7} ${baseY + headH * 0.9} ${cx - headW * 0.85} ${baseY + headH * 0.78}`;
  skull += ` C ${cx - headW * 0.95} ${baseY + headH * 0.5} ${cx - headW * 0.9} ${baseY + headH * 0.35} ${cx - headW * 0.85} ${baseY + headH * 0.18}`;
  skull += ' Z';
  paths.push(skull);

  // FLAME CREST - Fire plumage on head
  for (let flame = 0; flame < 8 + Math.floor(r() * 4); flame++) {
    const flameX = cx + (r() - 0.5) * headW * 1.2;
    const flameBaseY = baseY - 5 + r() * 10;
    const flameH = 30 + r() * 35;
    const flameW = 8 + r() * 8;
    let f = `M ${flameX} ${flameBaseY}`;
    f += ` C ${flameX - flameW / 2} ${flameBaseY - flameH * 0.3} ${flameX - flameW / 3} ${flameBaseY - flameH * 0.6} ${flameX + (r() - 0.5) * 6} ${flameBaseY - flameH}`;
    f += ` C ${flameX + flameW / 3} ${flameBaseY - flameH * 0.6} ${flameX + flameW / 2} ${flameBaseY - flameH * 0.3} ${flameX} ${flameBaseY}`;
    f += ' Z';
    paths.push(f);
  }

  // GLOWING ALMOND EYES
  const eyeY = baseY + headH * 0.42;
  const eyeSpacing = headW * 0.32;
  for (let side = -1; side <= 1; side += 2) {
    const eyeX = cx + side * eyeSpacing;
    // Eye shape
    paths.push(`M ${eyeX - 9} ${eyeY} C ${eyeX - 9} ${eyeY - 6} ${eyeX + 9} ${eyeY - 6} ${eyeX + 9} ${eyeY} C ${eyeX + 9} ${eyeY + 5} ${eyeX - 9} ${eyeY + 5} ${eyeX - 9} ${eyeY} Z`);
    // Glowing iris (larger)
    paths.push(`M ${eyeX - 5} ${eyeY - 1} C ${eyeX - 5} ${eyeY - 5} ${eyeX + 5} ${eyeY - 5} ${eyeX + 5} ${eyeY - 1} C ${eyeX + 5} ${eyeY + 3} ${eyeX - 5} ${eyeY + 3} ${eyeX - 5} ${eyeY - 1} Z`);
    // Flame reflection
    paths.push(`M ${eyeX} ${eyeY - 3} L ${eyeX - 2} ${eyeY + 1} L ${eyeX + 2} ${eyeY + 1} Z`);
    // Glow rays
    for (let ray = 0; ray < 6; ray++) {
      const angle = (ray / 6) * Math.PI * 2;
      const rayLen = 4 + r() * 3;
      paths.push(`M ${eyeX + Math.cos(angle) * 7} ${eyeY + Math.sin(angle) * 5} L ${eyeX + Math.cos(angle) * (7 + rayLen)} ${eyeY + Math.sin(angle) * (5 + rayLen)}`);
    }
  }

  // Elegant brows
  paths.push(`M ${cx + eyeSpacing - 10} ${eyeY - 10} Q ${cx + eyeSpacing} ${eyeY - 15} ${cx + eyeSpacing + 10} ${eyeY - 8}`);
  paths.push(`M ${cx - eyeSpacing + 10} ${eyeY - 10} Q ${cx - eyeSpacing} ${eyeY - 15} ${cx - eyeSpacing - 10} ${eyeY - 8}`);

  // SHARP BEAK
  const beakY = baseY + headH * 0.6;
  paths.push(`M ${cx - 6} ${beakY - 10} C ${cx - 8} ${beakY - 5} ${cx - 10} ${beakY} ${cx - 8} ${beakY + 8} L ${cx} ${beakY + 18} L ${cx + 8} ${beakY + 8} C ${cx + 10} ${beakY} ${cx + 8} ${beakY - 5} ${cx + 6} ${beakY - 10} Z`);
  // Beak line
  paths.push(`M ${cx - 7} ${beakY + 2} L ${cx} ${beakY + 10} L ${cx + 7} ${beakY + 2}`);

  // ELEGANT NECK with flame feathers
  const neckTop = baseY + headH * 1.02;
  const neckW = 14 * p.neckWidth;
  const neckH = 28;
  paths.push(`M ${cx - headW * 0.25} ${neckTop} C ${cx - neckW * 0.9} ${neckTop + 5} ${cx - neckW} ${neckTop + neckH * 0.6} ${cx - neckW * 1.1} ${neckTop + neckH} L ${cx + neckW * 1.1} ${neckTop + neckH} C ${cx + neckW} ${neckTop + neckH * 0.6} ${cx + neckW * 0.9} ${neckTop + 5} ${cx + headW * 0.25} ${neckTop} Z`);

  // Neck feathers
  for (let nf = 0; nf < 8; nf++) {
    const nfX = cx + (r() - 0.5) * neckW * 2;
    const nfY = neckTop + 5 + r() * neckH * 0.8;
    const nfH = 8 + r() * 6;
    paths.push(`M ${nfX} ${nfY} C ${nfX - 3} ${nfY - nfH * 0.4} ${nfX - 2} ${nfY - nfH} ${nfX} ${nfY - nfH - 3} C ${nfX + 2} ${nfY - nfH} ${nfX + 3} ${nfY - nfH * 0.4} ${nfX} ${nfY} Z`);
  }

  // HUMANOID TORSO with feathered texture
  const torsoTop = neckTop + neckH;
  const shoulderW = 52 * p.shoulderWidth;
  const waistW = 28 * p.waistWidth;
  const hipW = 32 * p.hipWidth;
  const torsoH = 75;

  let torso = `M ${cx - neckW * 1.1} ${torsoTop}`;
  torso += ` C ${cx - shoulderW * 0.5} ${torsoTop - 3} ${cx - shoulderW * 0.8} ${torsoTop + 10} ${cx - shoulderW} ${torsoTop + 18}`;
  torso += ` C ${cx - shoulderW - 5} ${torsoTop + 28} ${cx - shoulderW - 2} ${torsoTop + 42} ${cx - shoulderW + 5} ${torsoTop + 50}`;
  torso += ` C ${cx - waistW - 10} ${torsoTop + torsoH * 0.6} ${cx - waistW - 5} ${torsoTop + torsoH * 0.82} ${cx - waistW} ${torsoTop + torsoH * 0.92}`;
  torso += ` L ${cx - hipW} ${torsoTop + torsoH}`;
  torso += ` L ${cx + hipW} ${torsoTop + torsoH}`;
  torso += ` C ${cx + waistW + 5} ${torsoTop + torsoH * 0.82} ${cx + waistW + 10} ${torsoTop + torsoH * 0.6} ${cx + shoulderW - 5} ${torsoTop + 50}`;
  torso += ` C ${cx + shoulderW + 2} ${torsoTop + 42} ${cx + shoulderW + 5} ${torsoTop + 28} ${cx + shoulderW} ${torsoTop + 18}`;
  torso += ` C ${cx + shoulderW * 0.8} ${torsoTop + 10} ${cx + shoulderW * 0.5} ${torsoTop - 3} ${cx + neckW * 1.1} ${torsoTop} Z`;
  paths.push(torso);

  // Chest feathers
  for (let row = 0; row < 5; row++) {
    const rowY = torsoTop + 20 + row * 12;
    for (let col = -2; col <= 2; col++) {
      const fX = cx + col * 12;
      const fH = 10 + r() * 4;
      paths.push(`M ${fX} ${rowY + fH} C ${fX - 5} ${rowY + fH * 0.6} ${fX - 4} ${rowY} ${fX} ${rowY - 3} C ${fX + 4} ${rowY} ${fX + 5} ${rowY + fH * 0.6} ${fX} ${rowY + fH} Z`);
    }
  }

  // MASSIVE FLAME WINGS
  const wingStartY = torsoTop + 15;
  const wingSpan = 140;
  const wingHeight = 160;

  for (let side = -1; side <= 1; side += 2) {
    // Wing base
    let wing = `M ${cx + side * shoulderW} ${wingStartY}`;
    wing += ` C ${cx + side * (shoulderW + 20)} ${wingStartY - 15} ${cx + side * (shoulderW + 50)} ${wingStartY - 40} ${cx + side * (shoulderW + wingSpan * 0.6)} ${wingStartY - 60}`;
    wing += ` C ${cx + side * (shoulderW + wingSpan * 0.8)} ${wingStartY - 80} ${cx + side * (shoulderW + wingSpan)} ${wingStartY - 70} ${cx + side * (shoulderW + wingSpan + 15)} ${wingStartY - 50}`;
    
    // Flame feather tips along wing edge
    for (let tip = 0; tip < 8; tip++) {
      const tipX = cx + side * (shoulderW + wingSpan + 15 - tip * 18);
      const tipY = wingStartY - 50 + tip * 22;
      const flameLen = 25 + r() * 20;
      wing += ` C ${tipX + side * 10} ${tipY + 5} ${tipX + side * 15} ${tipY + flameLen * 0.5} ${tipX + side * 8} ${tipY + flameLen}`;
      wing += ` C ${tipX + side * 3} ${tipY + flameLen * 0.7} ${tipX - side * 5} ${tipY + flameLen * 0.4} ${tipX - side * 8} ${tipY + 18}`;
    }
    
    wing += ` C ${cx + side * (shoulderW + 30)} ${wingStartY + wingHeight - 30} ${cx + side * (shoulderW + 15)} ${wingStartY + wingHeight - 50} ${cx + side * shoulderW} ${wingStartY + 60}`;
    wing += ' Z';
    paths.push(wing);

    // Wing bone structure
    for (let bone = 0; bone < 5; bone++) {
      const boneStartX = cx + side * shoulderW;
      const boneEndX = cx + side * (shoulderW + wingSpan * (0.5 + bone * 0.1));
      const boneEndY = wingStartY - 30 + bone * 25;
      paths.push(`M ${boneStartX} ${wingStartY + 10} C ${(boneStartX + boneEndX) / 2} ${(wingStartY + boneEndY) / 2 - 10} ${boneEndX - side * 20} ${boneEndY - 5} ${boneEndX} ${boneEndY}`);
    }
  }

  // ARMS with flame feathers
  const armStartY = torsoTop + 18;
  const upperArmL = 40;
  const forearmL = 38;

  for (let side = -1; side <= 1; side += 2) {
    let arm = `M ${cx + side * shoulderW} ${armStartY}`;
    arm += ` C ${cx + side * (shoulderW + 8)} ${armStartY + 12} ${cx + side * (shoulderW + 10)} ${armStartY + upperArmL - 8} ${cx + side * (shoulderW + 8)} ${armStartY + upperArmL}`;
    arm += ` C ${cx + side * (shoulderW + 11)} ${armStartY + upperArmL + 10} ${cx + side * (shoulderW + 8)} ${armStartY + upperArmL + forearmL - 10} ${cx + side * (shoulderW + 6)} ${armStartY + upperArmL + forearmL}`;
    arm += ` C ${cx + side * (shoulderW + 4)} ${armStartY + upperArmL + forearmL + 16} ${cx + side * (shoulderW - 10)} ${armStartY + upperArmL + forearmL + 20} ${cx + side * (shoulderW - 8)} ${armStartY + upperArmL + forearmL + 5}`;
    arm += ` C ${cx + side * (shoulderW - 12)} ${armStartY + upperArmL + 20} ${cx + side * (shoulderW - 10)} ${armStartY + 12} ${cx + side * (shoulderW - 5)} ${armStartY} Z`;
    paths.push(arm);

    // Talon fingers
    const handY = armStartY + upperArmL + forearmL + 5;
    const handX = cx + side * (shoulderW - 4);
    for (let f = 0; f < 4; f++) {
      const talonL = 18 + (2 - Math.abs(f - 1.5)) * 5;
      const talonX = handX + side * (f * 5 - 6);
      const talonY = handY + 14;
      paths.push(`M ${talonX - 2} ${talonY} C ${talonX - 3} ${talonY + talonL * 0.5} ${talonX - 1} ${talonY + talonL - 3} ${talonX} ${talonY + talonL} C ${talonX + 1} ${talonY + talonL - 3} ${talonX + 3} ${talonY + talonL * 0.5} ${talonX + 2} ${talonY} Z`);
    }
  }

  // LEGS with talons
  const legTop = torsoTop + torsoH;
  const thighL = 50;
  const calfL = 45;

  for (let side = -1; side <= 1; side += 2) {
    let leg = `M ${cx + side * hipW * 0.15} ${legTop}`;
    leg += ` C ${cx + side * hipW * 0.4} ${legTop + 10} ${cx + side * hipW * 0.55} ${legTop + 22} ${cx + side * 14} ${legTop + thighL * 0.6}`;
    leg += ` C ${cx + side * 18} ${legTop + thighL * 0.85} ${cx + side * 16} ${legTop + thighL} ${cx + side * 14} ${legTop + thighL + 6}`;
    leg += ` C ${cx + side * 16} ${legTop + thighL + 20} ${cx + side * 13} ${legTop + thighL + calfL - 10} ${cx + side * 12} ${legTop + thighL + calfL}`;
    // Bird foot
    leg += ` L ${cx + side * 15} ${legTop + thighL + calfL + 8}`;
    leg += ` L ${cx + side * 5} ${legTop + thighL + calfL + 5}`;
    leg += ` C ${cx + side * 6} ${legTop + thighL + 18} ${cx + side * 10} ${legTop + 22} ${cx + side * hipW * 0.15} ${legTop} Z`;
    paths.push(leg);

    // Talon toes
    for (let toe = 0; toe < 3; toe++) {
      const toeX = cx + side * (5 + toe * 8);
      const toeY = legTop + thighL + calfL + 8;
      const toeL = 20 + r() * 5;
      const toeAngle = (toe - 1) * 0.4 * side;
      paths.push(`M ${toeX - 2} ${toeY} L ${toeX + Math.sin(toeAngle) * toeL} ${toeY + Math.cos(toeAngle) * toeL} L ${toeX + 2} ${toeY} Z`);
    }
  }

  // TAIL FEATHERS - Flame plumes
  for (let tail = 0; tail < 7; tail++) {
    const tailX = cx + (tail - 3) * 12;
    const tailY = legTop + 5;
    const tailLen = 80 + r() * 40;
    let t = `M ${tailX} ${tailY}`;
    t += ` C ${tailX - 8} ${tailY + tailLen * 0.3} ${tailX - 10} ${tailY + tailLen * 0.6} ${tailX - 5 + (r() - 0.5) * 8} ${tailY + tailLen}`;
    t += ` C ${tailX + 5 + (r() - 0.5) * 8} ${tailY + tailLen * 0.6} ${tailX + 8} ${tailY + tailLen * 0.3} ${tailX} ${tailY}`;
    t += ' Z';
    paths.push(t);
  }

  // Ambient flame particles
  for (let spark = 0; spark < 25; spark++) {
    const sparkX = cx + (r() - 0.5) * 180;
    const sparkY = baseY - 40 + r() * 280;
    const sparkR = 2 + r() * 3;
    paths.push(`M ${sparkX} ${sparkY - sparkR} L ${sparkX + sparkR * 0.7} ${sparkY} L ${sparkX} ${sparkY + sparkR} L ${sparkX - sparkR * 0.7} ${sparkY} Z`);
  }

  return paths;
};

// ============================================================================
// SPRITE - Tiny, delicate, insect wings, antennae, luminous
// ============================================================================
export const generateSpriteSilhouette = (gender: Gender): string[] => {
  const p = BODY_PARAMS[gender];
  const paths: string[] = [];
  
  const cx = 200, baseY = 75;
  const headW = 30 * p.jawWidth;
  const headH = 36;
  
  // DELICATE ROUND HEAD
  let skull = `M ${cx} ${baseY}`;
  for (let i = 0; i <= 30; i++) {
    const angle = (i / 30) * Math.PI;
    const glow = Math.sin(i * 0.6) * 1;
    const rx = headW * (0.92 + r() * 0.04);
    const ry = headH * 0.5;
    skull += ` L ${(cx + Math.sin(angle) * rx + glow).toFixed(2)} ${(baseY + 4 - Math.cos(angle) * ry).toFixed(2)}`;
  }
  skull += ` C ${cx + headW * 0.92} ${baseY + headH * 0.32} ${cx + headW * 0.96} ${baseY + headH * 0.48} ${cx + headW * 0.92} ${baseY + headH * 0.58}`;
  skull += ` C ${cx + headW * 0.88} ${baseY + headH * 0.72} ${cx + headW * 0.72} ${baseY + headH * 0.88} ${cx + headW * 0.5} ${baseY + headH * 0.95}`;
  skull += ` C ${cx + headW * 0.2} ${baseY + headH} ${cx} ${baseY + headH * 1.02} ${cx - headW * 0.2} ${baseY + headH}`;
  skull += ` C ${cx - headW * 0.5} ${baseY + headH * 0.95} ${cx - headW * 0.72} ${baseY + headH * 0.88} ${cx - headW * 0.88} ${baseY + headH * 0.72}`;
  skull += ` C ${cx - headW * 0.96} ${baseY + headH * 0.48} ${cx - headW * 0.92} ${baseY + headH * 0.32} ${cx - headW * 0.88} ${baseY + headH * 0.15}`;
  skull += ' Z';
  paths.push(skull);

  // ANTENNAE - Delicate curling
  for (let side = -1; side <= 1; side += 2) {
    const antennaX = cx + side * headW * 0.4;
    const antennaBaseY = baseY - headH * 0.35;
    const antennaH = 35 + r() * 15;
    let antenna = `M ${antennaX} ${antennaBaseY}`;
    // Curling antenna
    antenna += ` C ${antennaX + side * 5} ${antennaBaseY - antennaH * 0.3} ${antennaX + side * 12} ${antennaBaseY - antennaH * 0.6} ${antennaX + side * 8} ${antennaBaseY - antennaH * 0.8}`;
    antenna += ` C ${antennaX + side * 5} ${antennaBaseY - antennaH * 0.95} ${antennaX + side * 15} ${antennaBaseY - antennaH} ${antennaX + side * 18} ${antennaBaseY - antennaH + 5}`;
    paths.push(antenna);
    // Antenna tip glow
    const tipX = antennaX + side * 18;
    const tipY = antennaBaseY - antennaH + 5;
    paths.push(`M ${tipX - 4} ${tipY} C ${tipX - 4} ${tipY - 4} ${tipX + 4} ${tipY - 4} ${tipX + 4} ${tipY} C ${tipX + 4} ${tipY + 4} ${tipX - 4} ${tipY + 4} ${tipX - 4} ${tipY} Z`);
  }

  // VERY LARGE LUMINOUS EYES
  const eyeY = baseY + headH * 0.38;
  const eyeSpacing = headW * 0.35;
  const eyeW = 12, eyeH = 11;
  for (let side = -1; side <= 1; side += 2) {
    const eyeX = cx + side * eyeSpacing;
    // Large eye
    paths.push(`M ${eyeX - eyeW} ${eyeY} C ${eyeX - eyeW} ${eyeY - eyeH} ${eyeX + eyeW} ${eyeY - eyeH} ${eyeX + eyeW} ${eyeY} C ${eyeX + eyeW} ${eyeY + eyeH * 0.5} ${eyeX - eyeW} ${eyeY + eyeH * 0.5} ${eyeX - eyeW} ${eyeY} Z`);
    // Large iris
    paths.push(`M ${eyeX - 7} ${eyeY - 1} C ${eyeX - 7} ${eyeY - 8} ${eyeX + 7} ${eyeY - 8} ${eyeX + 7} ${eyeY - 1} C ${eyeX + 7} ${eyeY + 6} ${eyeX - 7} ${eyeY + 6} ${eyeX - 7} ${eyeY - 1} Z`);
    // Pupil
    paths.push(`M ${eyeX - 3} ${eyeY - 1} C ${eyeX - 3} ${eyeY - 4} ${eyeX + 3} ${eyeY - 4} ${eyeX + 3} ${eyeY - 1} C ${eyeX + 3} ${eyeY + 2} ${eyeX - 3} ${eyeY + 2} ${eyeX - 3} ${eyeY - 1} Z`);
    // Multiple sparkle highlights
    paths.push(`M ${eyeX + 4} ${eyeY - 5} L ${eyeX + 6} ${eyeY - 7} L ${eyeX + 5} ${eyeY - 4} Z`);
    paths.push(`M ${eyeX - 3} ${eyeY - 4} L ${eyeX - 4} ${eyeY - 6} L ${eyeX - 2} ${eyeY - 5} Z`);
  }

  // Delicate arched brows
  paths.push(`M ${cx + eyeSpacing - eyeW - 2} ${eyeY - eyeH - 3} Q ${cx + eyeSpacing} ${eyeY - eyeH - 10} ${cx + eyeSpacing + eyeW + 2} ${eyeY - eyeH - 2}`);
  paths.push(`M ${cx - eyeSpacing + eyeW + 2} ${eyeY - eyeH - 3} Q ${cx - eyeSpacing} ${eyeY - eyeH - 10} ${cx - eyeSpacing - eyeW - 2} ${eyeY - eyeH - 2}`);

  // TINY BUTTON NOSE
  const noseY = baseY + headH * 0.65;
  paths.push(`M ${cx - 3} ${noseY - 4} C ${cx - 4} ${noseY} ${cx - 4} ${noseY + 3} ${cx} ${noseY + 4} C ${cx + 4} ${noseY + 3} ${cx + 4} ${noseY} ${cx + 3} ${noseY - 4} Z`);

  // SMALL ROSEBUD LIPS
  const lipY = baseY + headH * 0.82;
  paths.push(`M ${cx - 6} ${lipY} C ${cx - 3} ${lipY - 2} ${cx} ${lipY - 2.5} ${cx + 3} ${lipY - 2} L ${cx + 6} ${lipY} C ${cx + 3} ${lipY + 1} ${cx} ${lipY + 0.5} ${cx - 3} ${lipY + 1} Z`);
  paths.push(`M ${cx - 5} ${lipY + 1.5} C ${cx} ${lipY + 1} ${cx + 5} ${lipY + 1.5} ${cx + 4} ${lipY + 4} C ${cx} ${lipY + 5} ${cx - 4} ${lipY + 4} ${cx - 5} ${lipY + 1.5} Z`);

  // TINY POINTED EARS
  const earY = baseY + headH * 0.38;
  for (let side = -1; side <= 1; side += 2) {
    paths.push(`M ${cx + side * headW * 0.9} ${earY + 3} C ${cx + side * (headW + 4)} ${earY} ${cx + side * (headW + 10)} ${earY - 8} ${cx + side * (headW + 12)} ${earY - 14} C ${cx + side * (headW + 8)} ${earY - 8} ${cx + side * (headW + 5)} ${earY + 2} ${cx + side * (headW + 3)} ${earY + 10} C ${cx + side * (headW + 1)} ${earY + 14} ${cx + side * headW * 0.92} ${earY + 12} ${cx + side * headW * 0.9} ${earY + 8} Z`);
  }

  // WISPY ETHEREAL HAIR
  let hair = `M ${cx} ${baseY - headH * 0.4}`;
  for (let strand = 0; strand < 20; strand++) {
    const strandX = cx + (strand / 19 - 0.5) * headW * 2;
    const strandLen = 15 + r() * 25;
    const wave = Math.sin(strand * 0.5) * 8;
    hair += ` M ${strandX} ${baseY - 5 + r() * 10}`;
    hair += ` C ${strandX + wave} ${baseY - 5 - strandLen * 0.4} ${strandX - wave} ${baseY - 5 - strandLen * 0.8} ${strandX + wave * 0.5} ${baseY - 5 - strandLen}`;
  }
  paths.push(hair);

  // SLENDER NECK
  const neckTop = baseY + headH * 1.02;
  const neckW = 10 * p.neckWidth;
  const neckH = 18;
  paths.push(`M ${cx - headW * 0.2} ${neckTop} C ${cx - neckW * 0.9} ${neckTop + 3} ${cx - neckW} ${neckTop + neckH * 0.6} ${cx - neckW * 1.05} ${neckTop + neckH} L ${cx + neckW * 1.05} ${neckTop + neckH} C ${cx + neckW} ${neckTop + neckH * 0.6} ${cx + neckW * 0.9} ${neckTop + 3} ${cx + headW * 0.2} ${neckTop} Z`);

  // TINY DELICATE TORSO
  const torsoTop = neckTop + neckH;
  const shoulderW = 32 * p.shoulderWidth;
  const waistW = 16 * p.waistWidth;
  const hipW = 20 * p.hipWidth;
  const torsoH = 45;

  let torso = `M ${cx - neckW * 1.05} ${torsoTop}`;
  torso += ` C ${cx - shoulderW * 0.5} ${torsoTop - 2} ${cx - shoulderW * 0.8} ${torsoTop + 6} ${cx - shoulderW} ${torsoTop + 12}`;
  torso += ` C ${cx - shoulderW - 3} ${torsoTop + 18} ${cx - shoulderW - 2} ${torsoTop + 28} ${cx - shoulderW + 3} ${torsoTop + 33}`;
  torso += ` C ${cx - waistW - 6} ${torsoTop + torsoH * 0.6} ${cx - waistW - 2} ${torsoTop + torsoH * 0.82} ${cx - waistW} ${torsoTop + torsoH * 0.92}`;
  torso += ` L ${cx - hipW} ${torsoTop + torsoH}`;
  torso += ` L ${cx + hipW} ${torsoTop + torsoH}`;
  torso += ` C ${cx + waistW + 2} ${torsoTop + torsoH * 0.82} ${cx + waistW + 6} ${torsoTop + torsoH * 0.6} ${cx + shoulderW - 3} ${torsoTop + 33}`;
  torso += ` C ${cx + shoulderW + 2} ${torsoTop + 28} ${cx + shoulderW + 3} ${torsoTop + 18} ${cx + shoulderW} ${torsoTop + 12}`;
  torso += ` C ${cx + shoulderW * 0.8} ${torsoTop + 6} ${cx + shoulderW * 0.5} ${torsoTop - 2} ${cx + neckW * 1.05} ${torsoTop} Z`;
  paths.push(torso);

  // LARGE DRAGONFLY/BUTTERFLY WINGS - 4 wings
  const wingStartY = torsoTop + 10;
  
  // Upper wings
  const upperWingSpan = 110;
  const upperWingH = 90;
  for (let side = -1; side <= 1; side += 2) {
    let upperWing = `M ${cx + side * shoulderW * 0.8} ${wingStartY}`;
    upperWing += ` C ${cx + side * (shoulderW + 25)} ${wingStartY - 30} ${cx + side * (shoulderW + 60)} ${wingStartY - 55} ${cx + side * (shoulderW + upperWingSpan * 0.7)} ${wingStartY - 65}`;
    upperWing += ` C ${cx + side * (shoulderW + upperWingSpan * 0.9)} ${wingStartY - 70} ${cx + side * (shoulderW + upperWingSpan)} ${wingStartY - 55} ${cx + side * (shoulderW + upperWingSpan + 5)} ${wingStartY - 35}`;
    upperWing += ` C ${cx + side * (shoulderW + upperWingSpan)} ${wingStartY - 10} ${cx + side * (shoulderW + upperWingSpan * 0.8)} ${wingStartY + 15} ${cx + side * (shoulderW + upperWingSpan * 0.5)} ${wingStartY + 25}`;
    upperWing += ` C ${cx + side * (shoulderW + 30)} ${wingStartY + 30} ${cx + side * (shoulderW + 15)} ${wingStartY + 20} ${cx + side * shoulderW * 0.8} ${wingStartY + 10}`;
    upperWing += ' Z';
    paths.push(upperWing);

    // Wing veins
    for (let vein = 0; vein < 5; vein++) {
      const veinEndX = cx + side * (shoulderW + 30 + vein * 18);
      const veinEndY = wingStartY - 20 - vein * 8 + Math.abs(vein - 2) * 5;
      paths.push(`M ${cx + side * shoulderW * 0.8} ${wingStartY + 5} Q ${(cx + side * shoulderW * 0.8 + veinEndX) / 2} ${(wingStartY + veinEndY) / 2 - 10} ${veinEndX} ${veinEndY}`);
    }

    // Wing spots
    for (let spot = 0; spot < 3; spot++) {
      const spotX = cx + side * (shoulderW + 40 + spot * 25);
      const spotY = wingStartY - 25 - spot * 10;
      const spotR = 6 + r() * 4;
      paths.push(`M ${spotX - spotR} ${spotY} C ${spotX - spotR} ${spotY - spotR} ${spotX + spotR} ${spotY - spotR} ${spotX + spotR} ${spotY} C ${spotX + spotR} ${spotY + spotR} ${spotX - spotR} ${spotY + spotR} ${spotX - spotR} ${spotY} Z`);
    }
  }

  // Lower wings (smaller)
  const lowerWingSpan = 75;
  const lowerWingH = 70;
  for (let side = -1; side <= 1; side += 2) {
    let lowerWing = `M ${cx + side * shoulderW * 0.7} ${wingStartY + 15}`;
    lowerWing += ` C ${cx + side * (shoulderW + 20)} ${wingStartY + 30} ${cx + side * (shoulderW + 45)} ${wingStartY + 50} ${cx + side * (shoulderW + lowerWingSpan * 0.7)} ${wingStartY + 65}`;
    lowerWing += ` C ${cx + side * (shoulderW + lowerWingSpan * 0.9)} ${wingStartY + 75} ${cx + side * (shoulderW + lowerWingSpan)} ${wingStartY + 80} ${cx + side * (shoulderW + lowerWingSpan - 5)} ${wingStartY + 90}`;
    lowerWing += ` C ${cx + side * (shoulderW + lowerWingSpan * 0.7)} ${wingStartY + 95} ${cx + side * (shoulderW + lowerWingSpan * 0.4)} ${wingStartY + 85} ${cx + side * (shoulderW + 20)} ${wingStartY + 70}`;
    lowerWing += ` C ${cx + side * (shoulderW + 10)} ${wingStartY + 55} ${cx + side * shoulderW * 0.75} ${wingStartY + 35} ${cx + side * shoulderW * 0.7} ${wingStartY + 20}`;
    lowerWing += ' Z';
    paths.push(lowerWing);

    // Lower wing veins
    for (let vein = 0; vein < 4; vein++) {
      const veinEndX = cx + side * (shoulderW + 25 + vein * 15);
      const veinEndY = wingStartY + 45 + vein * 10;
      paths.push(`M ${cx + side * shoulderW * 0.7} ${wingStartY + 18} Q ${(cx + side * shoulderW * 0.7 + veinEndX) / 2} ${(wingStartY + 18 + veinEndY) / 2 + 5} ${veinEndX} ${veinEndY}`);
    }
  }

  // DELICATE ARMS
  const armStartY = torsoTop + 12;
  const upperArmL = 25;
  const forearmL = 22;

  for (let side = -1; side <= 1; side += 2) {
    let arm = `M ${cx + side * shoulderW} ${armStartY}`;
    arm += ` C ${cx + side * (shoulderW + 4)} ${armStartY + 8} ${cx + side * (shoulderW + 6)} ${armStartY + upperArmL - 5} ${cx + side * (shoulderW + 5)} ${armStartY + upperArmL}`;
    arm += ` C ${cx + side * (shoulderW + 7)} ${armStartY + upperArmL + 6} ${cx + side * (shoulderW + 5)} ${armStartY + upperArmL + forearmL - 5} ${cx + side * (shoulderW + 4)} ${armStartY + upperArmL + forearmL}`;
    arm += ` C ${cx + side * (shoulderW + 2)} ${armStartY + upperArmL + forearmL + 10} ${cx + side * (shoulderW - 6)} ${armStartY + upperArmL + forearmL + 12} ${cx + side * (shoulderW - 5)} ${armStartY + upperArmL + forearmL + 3}`;
    arm += ` C ${cx + side * (shoulderW - 7)} ${armStartY + upperArmL + 12} ${cx + side * (shoulderW - 5)} ${armStartY + 8} ${cx + side * (shoulderW - 3)} ${armStartY} Z`;
    paths.push(arm);

    // Tiny delicate fingers
    const handY = armStartY + upperArmL + forearmL + 3;
    const handX = cx + side * (shoulderW - 2);
    for (let f = 0; f < 5; f++) {
      const fingerL = f === 0 ? 7 : 10 + (2 - Math.abs(f - 2)) * 1.5;
      const fingerX = handX + side * (f * 2.5 - 4);
      const fingerY = f === 0 ? handY + 3 : handY + 8;
      paths.push(`M ${fingerX - 1} ${fingerY} L ${fingerX - 0.5} ${fingerY + fingerL} Q ${fingerX} ${fingerY + fingerL + 1} ${fingerX + 0.5} ${fingerY + fingerL} L ${fingerX + 1} ${fingerY} Z`);
    }
  }

  // TINY LEGS
  const legTop = torsoTop + torsoH;
  const thighL = 28;
  const calfL = 25;

  for (let side = -1; side <= 1; side += 2) {
    let leg = `M ${cx + side * hipW * 0.12} ${legTop}`;
    leg += ` C ${cx + side * hipW * 0.35} ${legTop + 6} ${cx + side * hipW * 0.5} ${legTop + 14} ${cx + side * 8} ${legTop + thighL * 0.6}`;
    leg += ` C ${cx + side * 10} ${legTop + thighL * 0.85} ${cx + side * 9} ${legTop + thighL} ${cx + side * 8} ${legTop + thighL + 4}`;
    leg += ` C ${cx + side * 9} ${legTop + thighL + 12} ${cx + side * 7} ${legTop + thighL + calfL - 6} ${cx + side * 6} ${legTop + thighL + calfL}`;
    // Tiny pointed feet
    leg += ` L ${cx + side * 8} ${legTop + thighL + calfL + 5}`;
    leg += ` L ${cx + side * 18} ${legTop + thighL + calfL + 10}`;
    leg += ` L ${cx + side * 5} ${legTop + thighL + calfL + 8}`;
    leg += ` L ${cx + side * 4} ${legTop + thighL + calfL + 3}`;
    leg += ` C ${cx + side * 4} ${legTop + thighL + 10} ${cx + side * 6} ${legTop + 14} ${cx + side * hipW * 0.12} ${legTop} Z`;
    paths.push(leg);
  }

  // GLOWING AURA - Luminous particles around figure
  for (let glow = 0; glow < 30; glow++) {
    const glowX = cx + (r() - 0.5) * 200;
    const glowY = baseY - 50 + r() * 250;
    const glowR = 1.5 + r() * 2.5;
    // 4-pointed star
    paths.push(`M ${glowX} ${glowY - glowR * 1.5} L ${glowX + glowR * 0.5} ${glowY} L ${glowX} ${glowY + glowR * 1.5} L ${glowX - glowR * 0.5} ${glowY} Z`);
    paths.push(`M ${glowX - glowR * 1.2} ${glowY} L ${glowX} ${glowY + glowR * 0.4} L ${glowX + glowR * 1.2} ${glowY} L ${glowX} ${glowY - glowR * 0.4} Z`);
  }

  return paths;
};

// ============================================================================
// COMPONENT EXPORTS
// ============================================================================
interface AvatarSilhouetteProps {
  race: 'gnome' | 'phoenix' | 'sprite';
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
    gnome: generateGnomeSilhouette,
    phoenix: generatePhoenixSilhouette,
    sprite: generateSpriteSilhouette,
  };
  
  const [paths] = React.useState<string[]>(() => {
    const generator = generators[race] || generateGnomeSilhouette;
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
// ============================================================================
