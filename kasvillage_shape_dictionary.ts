// ============================================================================
// KasVillage Shape Dictionary
// 50 objects stored as 25-number fingerprints (5×5 grid)
// Reference image cluster → nearest match → procedural build at detail level
// All objects store baseColor + normalAngle for 60-angle re-lighting
// ============================================================================

import { ShadingPreset } from './kasvillage_avatar_engine';
import { LayerElement } from './kasvillage_environments';

// ============================================================================
// TYPES
// ============================================================================

export interface ShapeFingerprint {
  /** 5×5 edge pattern — the lookup key */
  pattern: number[];
  /** Object name */
  name: string;
  /** Category for filtering */
  category: 'furniture' | 'structure' | 'light' | 'container' | 'nature' | 'decoration' | 'utility';
  /** Base size in pixels */
  baseW: number;
  baseH: number;
}

export interface PlacedObject {
  name: string;
  x: number;
  y: number;
  scale: number;
  elements: LayerElement[];
  /** Collision rect for physics */
  collision: { x: number; y: number; w: number; h: number } | null;
}

// ============================================================================
// HELPER — create LayerElement with baseColor for re-lighting
// ============================================================================

function el(
  type: LayerElement['type'],
  props: Record<string, string | number>,
  baseColor: string,
  normalAngle: number,
  mood: ShadingPreset,
): LayerElement {
  return { type, props, baseColor, normalAngle, litColor: light(baseColor, normalAngle, mood) };
}

function light(base: string, normal: number, mood: ShadingPreset): string {
  const r = parseInt(base.slice(1,3),16)||0, g = parseInt(base.slice(3,5),16)||0, b = parseInt(base.slice(5,7),16)||0;
  const la: Record<string,number> = { horror:Math.PI, daylight:-Math.PI/4, twilight:-Math.PI/2, neon:0, moonlit:-Math.PI/3, firelit:Math.PI, custom:-Math.PI/4 };
  const sh: Record<string,number> = { horror:0.7, daylight:0.3, twilight:0.5, neon:0.6, moonlit:0.6, firelit:0.6, custom:0.4 };
  const d = Math.max(0.2, Math.cos(normal-(la[mood]||0))*0.5+0.5);
  const m = 1-(1-d)*(sh[mood]||0.4);
  const cl = (v:number)=>Math.max(0,Math.min(255,Math.round(v)));
  return `#${cl(r*m).toString(16).padStart(2,'0')}${cl(g*m).toString(16).padStart(2,'0')}${cl(b*m).toString(16).padStart(2,'0')}`;
}

// ============================================================================
// SHAPE DICTIONARY — 50 objects as 5×5 edge patterns
// ============================================================================
// Pattern: 25 numbers (0.0-1.0) representing edge strength in a 5×5 grid
// Read left-to-right, top-to-bottom
// High values = strong edge at that grid cell

export const SHAPE_DICTIONARY: ShapeFingerprint[] = [
  // === FURNITURE ===
  { name: 'chair', category: 'furniture', baseW: 24, baseH: 36,
    pattern: [0,0.3,0.8,0.3,0, 0,0.2,0.8,0.2,0, 0,0,0.9,0,0, 0,0.8,0.2,0.8,0, 0,0.8,0,0.8,0] },
  { name: 'table', category: 'furniture', baseW: 55, baseH: 28,
    pattern: [0,0,0,0,0, 0.9,0.9,0.9,0.9,0.9, 0,0,0,0,0, 0.8,0,0,0,0.8, 0.8,0,0,0,0.8] },
  { name: 'bed', category: 'furniture', baseW: 50, baseH: 35,
    pattern: [0.7,0.3,0.3,0.3,0.3, 0.9,0.1,0.1,0.1,0.1, 0.9,0.2,0.2,0.2,0.2, 0.9,0.1,0.1,0.1,0.1, 0.5,0.5,0.5,0.5,0.5] },
  { name: 'throne', category: 'furniture', baseW: 38, baseH: 55,
    pattern: [0,0.4,0.9,0.4,0, 0,0.5,0.9,0.5,0, 0,0.3,0.8,0.3,0, 0.6,0.9,0.4,0.9,0.6, 0,0.8,0,0.8,0] },
  { name: 'bench', category: 'furniture', baseW: 60, baseH: 22,
    pattern: [0,0,0,0,0, 0.9,0.9,0.9,0.9,0.9, 0.8,0,0,0,0.8, 0.8,0,0,0,0.8, 0,0,0,0,0] },
  { name: 'desk', category: 'furniture', baseW: 50, baseH: 32,
    pattern: [0,0.3,0.3,0.3,0, 0.9,0.9,0.9,0.9,0.9, 0.8,0,0.5,0,0.8, 0.8,0,0,0,0.8, 0.8,0,0,0,0.8] },
  { name: 'wardrobe', category: 'furniture', baseW: 35, baseH: 50,
    pattern: [0.9,0.9,0.9,0.9,0.9, 0.9,0.1,0.5,0.1,0.9, 0.9,0.1,0.5,0.1,0.9, 0.9,0.1,0.5,0.1,0.9, 0.9,0.9,0.9,0.9,0.9] },
  { name: 'stool', category: 'furniture', baseW: 18, baseH: 24,
    pattern: [0,0,0,0,0, 0,0.9,0.9,0.9,0, 0,0,0.8,0,0, 0,0.7,0.2,0.7,0, 0,0.7,0,0.7,0] },
  { name: 'rug', category: 'furniture', baseW: 60, baseH: 20,
    pattern: [0.3,0.5,0.5,0.5,0.3, 0.5,0.2,0.2,0.2,0.5, 0.5,0.2,0.3,0.2,0.5, 0.5,0.2,0.2,0.2,0.5, 0.3,0.5,0.5,0.5,0.3] },

  // === CONTAINERS ===
  { name: 'chest', category: 'container', baseW: 28, baseH: 20,
    pattern: [0.9,0.9,0.9,0.9,0.9, 0.9,0.3,0.5,0.3,0.9, 0.9,0.9,0.9,0.9,0.9, 0.8,0.1,0.1,0.1,0.8, 0.8,0.8,0.8,0.8,0.8] },
  { name: 'barrel', category: 'container', baseW: 22, baseH: 30,
    pattern: [0,0.5,0.8,0.5,0, 0.3,0.8,0.2,0.8,0.3, 0.4,0.9,0.1,0.9,0.4, 0.3,0.8,0.2,0.8,0.3, 0,0.5,0.8,0.5,0] },
  { name: 'crate', category: 'container', baseW: 24, baseH: 24,
    pattern: [0.9,0.9,0.9,0.9,0.9, 0.9,0.2,0.2,0.2,0.9, 0.9,0.2,0.5,0.2,0.9, 0.9,0.2,0.2,0.2,0.9, 0.9,0.9,0.9,0.9,0.9] },
  { name: 'pot', category: 'container', baseW: 16, baseH: 18,
    pattern: [0,0.6,0.6,0.6,0, 0.3,0.7,0.1,0.7,0.3, 0.5,0.8,0.1,0.8,0.5, 0.3,0.7,0.1,0.7,0.3, 0,0.5,0.5,0.5,0] },
  { name: 'sack', category: 'container', baseW: 18, baseH: 20,
    pattern: [0,0.3,0.5,0.3,0, 0.2,0.5,0.2,0.5,0.2, 0.4,0.6,0.1,0.6,0.4, 0.3,0.5,0.1,0.5,0.3, 0,0.3,0.3,0.3,0] },
  { name: 'basket', category: 'container', baseW: 20, baseH: 16,
    pattern: [0.6,0.3,0.3,0.3,0.6, 0.7,0.4,0.4,0.4,0.7, 0.8,0.3,0.3,0.3,0.8, 0.7,0.3,0.3,0.3,0.7, 0,0.5,0.5,0.5,0] },

  // === STRUCTURE ===
  { name: 'pillar', category: 'structure', baseW: 14, baseH: 70,
    pattern: [0.7,0.9,0.9,0.9,0.7, 0.3,0.9,0.2,0.9,0.3, 0.3,0.9,0.2,0.9,0.3, 0.3,0.9,0.2,0.9,0.3, 0.7,0.9,0.9,0.9,0.7] },
  { name: 'door', category: 'structure', baseW: 30, baseH: 50,
    pattern: [0.9,0.9,0.9,0.9,0.9, 0.9,0.1,0.1,0.1,0.9, 0.9,0.1,0.1,0.1,0.9, 0.9,0.1,0.3,0.1,0.9, 0.9,0.9,0.9,0.9,0.9] },
  { name: 'arch', category: 'structure', baseW: 35, baseH: 50,
    pattern: [0,0.3,0.8,0.3,0, 0.5,0.8,0.1,0.8,0.5, 0.9,0.1,0.1,0.1,0.9, 0.9,0.1,0.1,0.1,0.9, 0.9,0,0,0,0.9] },
  { name: 'window', category: 'structure', baseW: 22, baseH: 28,
    pattern: [0.9,0.9,0.9,0.9,0.9, 0.9,0.2,0.5,0.2,0.9, 0.9,0.5,0.2,0.5,0.9, 0.9,0.2,0.5,0.2,0.9, 0.9,0.9,0.9,0.9,0.9] },
  { name: 'stairs', category: 'structure', baseW: 40, baseH: 45,
    pattern: [0.9,0.9,0,0,0, 0.3,0.9,0.9,0,0, 0,0.3,0.9,0.9,0, 0,0,0.3,0.9,0.9, 0,0,0,0.3,0.9] },
  { name: 'fence', category: 'structure', baseW: 60, baseH: 25,
    pattern: [0.8,0.2,0.8,0.2,0.8, 0.8,0.2,0.8,0.2,0.8, 0.9,0.9,0.9,0.9,0.9, 0,0,0,0,0, 0,0,0,0,0] },
  { name: 'railing', category: 'structure', baseW: 50, baseH: 18,
    pattern: [0.7,0.3,0.7,0.3,0.7, 0.7,0.1,0.7,0.1,0.7, 0.9,0.9,0.9,0.9,0.9, 0,0,0,0,0, 0,0,0,0,0] },

  // === LIGHT ===
  { name: 'torch', category: 'light', baseW: 8, baseH: 22,
    pattern: [0,0,0.6,0,0, 0,0.3,0.8,0.3,0, 0,0,0.9,0,0, 0,0,0.9,0,0, 0,0,0.7,0,0] },
  { name: 'chandelier', category: 'light', baseW: 45, baseH: 30,
    pattern: [0,0,0.5,0,0, 0.3,0.5,0.3,0.5,0.3, 0.6,0.2,0.3,0.2,0.6, 0.8,0.1,0,0.1,0.8, 0.4,0,0,0,0.4] },
  { name: 'candle', category: 'light', baseW: 6, baseH: 14,
    pattern: [0,0,0.5,0,0, 0,0,0.8,0,0, 0,0,0.9,0,0, 0,0,0.9,0,0, 0,0.3,0.6,0.3,0] },
  { name: 'lantern', category: 'light', baseW: 12, baseH: 18,
    pattern: [0,0,0.5,0,0, 0,0.7,0.3,0.7,0, 0.5,0.8,0.2,0.8,0.5, 0,0.7,0.3,0.7,0, 0,0.5,0.5,0.5,0] },
  { name: 'fireplace', category: 'light', baseW: 45, baseH: 40,
    pattern: [0.9,0.9,0.9,0.9,0.9, 0.9,0.3,0.5,0.3,0.9, 0.9,0.2,0.7,0.2,0.9, 0.9,0.4,0.8,0.4,0.9, 0.9,0.9,0.9,0.9,0.9] },

  // === NATURE ===
  { name: 'tree', category: 'nature', baseW: 30, baseH: 55,
    pattern: [0,0.3,0.6,0.3,0, 0.3,0.6,0.5,0.6,0.3, 0.2,0.5,0.4,0.5,0.2, 0,0,0.9,0,0, 0,0,0.8,0,0] },
  { name: 'bush', category: 'nature', baseW: 28, baseH: 20,
    pattern: [0,0.3,0.5,0.3,0, 0.4,0.6,0.5,0.6,0.4, 0.5,0.7,0.4,0.7,0.5, 0.3,0.5,0.3,0.5,0.3, 0,0.2,0.2,0.2,0] },
  { name: 'rock', category: 'nature', baseW: 22, baseH: 16,
    pattern: [0,0.2,0.4,0.3,0, 0.3,0.5,0.3,0.5,0.3, 0.5,0.4,0.2,0.4,0.5, 0.4,0.5,0.3,0.5,0.4, 0,0.3,0.4,0.3,0] },
  { name: 'mushroom', category: 'nature', baseW: 14, baseH: 16,
    pattern: [0,0.4,0.7,0.4,0, 0.5,0.7,0.4,0.7,0.5, 0.3,0.5,0.3,0.5,0.3, 0,0,0.8,0,0, 0,0.3,0.6,0.3,0] },
  { name: 'vine', category: 'nature', baseW: 10, baseH: 45,
    pattern: [0.4,0,0,0,0, 0,0.5,0,0,0, 0,0,0.4,0,0, 0,0,0,0.5,0, 0,0,0,0,0.4] },
  { name: 'flower', category: 'nature', baseW: 10, baseH: 14,
    pattern: [0,0.3,0.5,0.3,0, 0.3,0.5,0.3,0.5,0.3, 0,0.3,0.5,0.3,0, 0,0,0.7,0,0, 0,0,0.6,0,0] },
  { name: 'well', category: 'nature', baseW: 30, baseH: 28,
    pattern: [0,0.3,0.8,0.3,0, 0.5,0.8,0.2,0.8,0.5, 0.7,0.4,0.1,0.4,0.7, 0.5,0.7,0.2,0.7,0.5, 0,0.5,0.7,0.5,0] },
  { name: 'fountain', category: 'nature', baseW: 35, baseH: 35,
    pattern: [0,0,0.5,0,0, 0,0.3,0.7,0.3,0, 0.3,0.6,0.3,0.6,0.3, 0.5,0.7,0.2,0.7,0.5, 0.3,0.5,0.5,0.5,0.3] },

  // === DECORATION ===
  { name: 'painting', category: 'decoration', baseW: 22, baseH: 18,
    pattern: [0.9,0.9,0.9,0.9,0.9, 0.9,0.3,0.3,0.3,0.9, 0.9,0.3,0.4,0.3,0.9, 0.9,0.3,0.3,0.3,0.9, 0.9,0.9,0.9,0.9,0.9] },
  { name: 'banner', category: 'decoration', baseW: 16, baseH: 40,
    pattern: [0.8,0.8,0.8,0.8,0.8, 0.8,0.2,0.2,0.2,0.8, 0.7,0.2,0.3,0.2,0.7, 0.6,0.2,0.2,0.2,0.6, 0,0.3,0.5,0.3,0] },
  { name: 'shield', category: 'decoration', baseW: 18, baseH: 22,
    pattern: [0.3,0.7,0.9,0.7,0.3, 0.7,0.3,0.4,0.3,0.7, 0.8,0.2,0.5,0.2,0.8, 0.6,0.3,0.3,0.3,0.6, 0,0.3,0.7,0.3,0] },
  { name: 'statue', category: 'decoration', baseW: 16, baseH: 45,
    pattern: [0,0,0.6,0,0, 0,0.4,0.5,0.4,0, 0,0.3,0.8,0.3,0, 0.3,0.2,0.8,0.2,0.3, 0,0.5,0.3,0.5,0] },
  { name: 'mirror', category: 'decoration', baseW: 18, baseH: 25,
    pattern: [0,0.5,0.8,0.5,0, 0.5,0.8,0.2,0.8,0.5, 0.7,0.3,0.1,0.3,0.7, 0.5,0.8,0.2,0.8,0.5, 0,0.5,0.8,0.5,0] },
  { name: 'bookshelf', category: 'decoration', baseW: 40, baseH: 50,
    pattern: [0.9,0.9,0.9,0.9,0.9, 0.9,0.5,0.5,0.5,0.9, 0.9,0.9,0.9,0.9,0.9, 0.9,0.5,0.5,0.5,0.9, 0.9,0.9,0.9,0.9,0.9] },
  { name: 'clock', category: 'decoration', baseW: 14, baseH: 14,
    pattern: [0,0.4,0.7,0.4,0, 0.4,0.6,0.2,0.6,0.4, 0.7,0.2,0.5,0.2,0.7, 0.4,0.6,0.2,0.6,0.4, 0,0.4,0.7,0.4,0] },

  // === UTILITY ===
  { name: 'anvil', category: 'utility', baseW: 26, baseH: 22,
    pattern: [0.7,0.9,0.9,0.9,0.7, 0,0.3,0.9,0.3,0, 0,0,0.9,0,0, 0,0.5,0.9,0.5,0, 0.5,0.8,0.8,0.8,0.5] },
  { name: 'cauldron', category: 'utility', baseW: 28, baseH: 24,
    pattern: [0.5,0.3,0.3,0.3,0.5, 0.7,0.5,0.2,0.5,0.7, 0.8,0.3,0.1,0.3,0.8, 0.7,0.5,0.2,0.5,0.7, 0,0.5,0.7,0.5,0] },
  { name: 'cage', category: 'utility', baseW: 24, baseH: 30,
    pattern: [0.9,0.9,0.9,0.9,0.9, 0.8,0.1,0.8,0.1,0.8, 0.8,0.1,0.8,0.1,0.8, 0.8,0.1,0.8,0.1,0.8, 0.9,0.9,0.9,0.9,0.9] },
  { name: 'ladder', category: 'utility', baseW: 16, baseH: 50,
    pattern: [0.8,0,0,0,0.8, 0.9,0.9,0.9,0.9,0.9, 0.8,0,0,0,0.8, 0.9,0.9,0.9,0.9,0.9, 0.8,0,0,0,0.8] },
  { name: 'rope', category: 'utility', baseW: 6, baseH: 40,
    pattern: [0,0,0.6,0,0, 0,0,0.5,0,0, 0,0.3,0.4,0,0, 0,0,0.5,0.3,0, 0,0,0.6,0,0] },
];

// ============================================================================
// FINGERPRINT MATCHING — nearest neighbor on 25 numbers
// ============================================================================

/**
 * Compare a cluster's mini-fingerprint against the dictionary.
 * Returns top 3 matches with confidence scores.
 */
export function matchShape(clusterPattern: number[]): Array<{ shape: ShapeFingerprint; confidence: number }> {
  if (clusterPattern.length !== 25) return [];

  const results = SHAPE_DICTIONARY.map(shape => {
    let distance = 0;
    for (let i = 0; i < 25; i++) {
      const diff = (clusterPattern[i] || 0) - shape.pattern[i];
      distance += diff * diff;
    }
    // Normalize to 0-1 confidence (lower distance = higher confidence)
    const confidence = Math.max(0, 1 - Math.sqrt(distance / 25));
    return { shape, confidence };
  });

  return results.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

/**
 * Extract a 5×5 mini-fingerprint from a cluster of grid points.
 * Takes points belonging to one object cluster → normalizes to 5×5.
 */
export function extractClusterFingerprint(
  points: Array<{ gx: number; gy: number; edge: number }>,
): number[] {
  if (points.length === 0) return new Array(25).fill(0);

  // Find bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.gx < minX) minX = p.gx;
    if (p.gx > maxX) maxX = p.gx;
    if (p.gy < minY) minY = p.gy;
    if (p.gy > maxY) maxY = p.gy;
  }

  const rangeX = Math.max(1, maxX - minX + 1);
  const rangeY = Math.max(1, maxY - minY + 1);

  // Map to 5×5
  const mini = new Array(25).fill(0);
  for (const p of points) {
    const mx = Math.floor(((p.gx - minX) / rangeX) * 4.99);
    const my = Math.floor(((p.gy - minY) / rangeY) * 4.99);
    const idx = my * 5 + mx;
    mini[idx] = Math.max(mini[idx], p.edge);
  }

  return mini;
}

// ============================================================================
// PROCEDURAL OBJECT BUILDERS — one per dictionary entry
// ============================================================================

type ObjectBuilder = (x: number, y: number, scale: number, colors: string[], mood: ShadingPreset) => LayerElement[];

/** Color picker helper */
function pc(colors: string[], seed: number): string {
  return colors[Math.abs(seed) % colors.length];
}

const OBJECT_BUILDERS: Record<string, ObjectBuilder> = {
  chair: (x, y, s, c, m) => [
    el('rect',{x:x-4*s,y:y-20*s,width:8*s,height:20*s,rx:1},pc(c,0),-Math.PI/4,m),
    el('rect',{x:x-10*s,y:y,width:20*s,height:4*s,rx:1},pc(c,1),0,m),
    el('rect',{x:x-8*s,y:y+4*s,width:3*s,height:14*s},pc(c,0),Math.PI/2,m),
    el('rect',{x:x+5*s,y:y+4*s,width:3*s,height:14*s},pc(c,0),Math.PI/2,m),
  ],
  table: (x, y, s, c, m) => [
    el('rect',{x,y,width:50*s,height:6*s,rx:2},pc(c,0),-Math.PI/6,m),
    el('rect',{x:x+3*s,y:y+6*s,width:4*s,height:18*s},pc(c,1),Math.PI/2,m),
    el('rect',{x:x+43*s,y:y+6*s,width:4*s,height:18*s},pc(c,1),Math.PI/2,m),
  ],
  barrel: (x, y, s, c, m) => [
    el('circle',{cx:x+11*s,cy:y+15*s,r:11*s,opacity:0.9},pc(c,0),0,m),
    el('rect',{x:x+2*s,y:y+5*s,width:18*s,height:2*s,opacity:0.6},pc(c,1),0,m),
    el('rect',{x:x+2*s,y:y+22*s,width:18*s,height:2*s,opacity:0.6},pc(c,1),0,m),
  ],
  chest: (x, y, s, c, m) => [
    el('rect',{x,y:y+4*s,width:28*s,height:14*s,rx:2},pc(c,0),Math.PI/4,m),
    el('rect',{x:x-1*s,y,width:30*s,height:5*s,rx:2},pc(c,1),-Math.PI/4,m),
    el('circle',{cx:x+14*s,cy:y+11*s,r:3*s},pc(c,2)||'#FFD700',0,m),
  ],
  torch: (x, y, s, c, m) => [
    el('rect',{x:x-2*s,y:y+6*s,width:4*s,height:14*s},pc(c,0),0,m),
    el('circle',{cx:x,cy:y+4*s,r:5*s,opacity:0.4},'#FF8800',0,m),
    el('circle',{cx:x,cy:y+3*s,r:3*s,opacity:0.6},'#FFCC00',0,m),
  ],
  pillar: (x, y, s, c, m) => [
    el('rect',{x:x-3*s,y:y-5*s,width:20*s,height:8*s,rx:2},pc(c,1),-Math.PI/4,m),
    el('rect',{x,y:y+3*s,width:14*s,height:60*s},pc(c,0),0,m),
    el('rect',{x:x-2*s,y:y+60*s,width:18*s,height:6*s,rx:1},pc(c,0),Math.PI/4,m),
  ],
  bookshelf: (x, y, s, c, m) => {
    const els: LayerElement[] = [];
    els.push(el('rect',{x,y,width:40*s,height:50*s,rx:1},pc(c,0),0,m));
    for (let shelf = 0; shelf < 4; shelf++) {
      els.push(el('rect',{x:x+2*s,y:y+shelf*12*s+10*s,width:36*s,height:2*s},pc(c,1),0,m));
      for (let b = 0; b < 4; b++) {
        els.push(el('rect',{x:x+4*s+b*9*s,y:y+shelf*12*s+1*s,width:7*s,height:9*s,rx:1},pc(c,b%3),-Math.PI/4,m));
      }
    }
    return els;
  },
  tree: (x, y, s, c, m) => [
    el('rect',{x:x+11*s,y:y+25*s,width:8*s,height:25*s},'#5A3A1A',Math.PI/2,m),
    el('circle',{cx:x+15*s,cy:y+15*s,r:18*s},pc(c,0),-Math.PI/4,m),
    el('circle',{cx:x+8*s,cy:y+20*s,r:12*s,opacity:0.7},pc(c,1),-Math.PI/3,m),
  ],
  rock: (x, y, s, c, m) => [
    el('circle',{cx:x+11*s,cy:y+8*s,r:11*s,opacity:0.9},pc(c,0),Math.PI/6,m),
    el('circle',{cx:x+6*s,cy:y+5*s,r:5*s,opacity:0.4},pc(c,1),-Math.PI/4,m),
  ],
  door: (x, y, s, c, m) => [
    el('rect',{x,y,width:30*s,height:50*s,rx:1},'#0A0A0A',0,m),
    el('rect',{x:x-2*s,y:y-2*s,width:34*s,height:4*s},pc(c,0),-Math.PI/4,m),
    el('rect',{x:x-2*s,y:y,width:4*s,height:50*s},pc(c,0),-Math.PI/2,m),
    el('rect',{x:x+28*s,y:y,width:4*s,height:50*s},pc(c,0),Math.PI/2,m),
    el('circle',{cx:x+24*s,cy:y+28*s,r:2*s},pc(c,1)||'#FFD700',0,m),
  ],
  candle: (x, y, s, c, m) => [
    el('rect',{x:x-2*s,y:y+4*s,width:4*s,height:8*s,rx:1},'#FFFFF0',0,m),
    el('circle',{cx:x,cy:y+2*s,r:3*s,opacity:0.5},'#FFAA00',0,m),
  ],
  banner: (x, y, s, c, m) => [
    el('rect',{x,y,width:16*s,height:35*s,rx:1},pc(c,0),0,m),
    el('polygon',{points:`${x},${y+35*s} ${x+16*s},${y+35*s} ${x+8*s},${y+45*s}`},pc(c,0),0,m),
    el('rect',{x:x+3*s,y:y+5*s,width:10*s,height:25*s,opacity:0.3},pc(c,1),0,m),
  ],
  cauldron: (x, y, s, c, m) => [
    el('circle',{cx:x+14*s,cy:y+12*s,r:14*s,opacity:0.9},pc(c,0),Math.PI/4,m),
    el('circle',{cx:x+14*s,cy:y+8*s,r:10*s,opacity:0.5},'#44AA44',Math.PI/2,m),
  ],
  statue: (x, y, s, c, m) => [
    el('rect',{x:x+4*s,y:y+35*s,width:8*s,height:10*s,rx:1},pc(c,0),Math.PI/4,m),
    el('rect',{x:x+5*s,y:y+12*s,width:6*s,height:23*s},pc(c,0),0,m),
    el('circle',{cx:x+8*s,cy:y+8*s,r:6*s},pc(c,0),-Math.PI/4,m),
  ],
  fireplace: (x, y, s, c, m) => [
    el('rect',{x,y,width:45*s,height:40*s,rx:2},pc(c,0),0,m),
    el('rect',{x:x+6*s,y:y+10*s,width:33*s,height:28*s},'#0A0A0A',0,m),
    el('circle',{cx:x+22*s,cy:y+28*s,r:8*s,opacity:0.5},'#FF6600',0,m),
    el('circle',{cx:x+22*s,cy:y+25*s,r:5*s,opacity:0.6},'#FFAA00',0,m),
  ],
};

// Fallback builder — generic rect for unimplemented shapes
function fallbackBuilder(x: number, y: number, s: number, c: string[], m: ShadingPreset, shape: ShapeFingerprint): LayerElement[] {
  return [el('rect',{x,y,width:shape.baseW*s,height:shape.baseH*s,rx:2},pc(c,0),0,m)];
}

// ============================================================================
// BUILD OBJECT — match name to builder, apply detail level
// ============================================================================

/**
 * Build a single object at position with scale.
 * Detail level controls: 0.0 = simple rect, 0.5 = basic shape, 1.0 = full detail.
 */
export function buildObject(
  shapeName: string,
  x: number,
  y: number,
  scale: number,
  biomeColors: string[],
  mood: ShadingPreset,
  detailLevel: number = 1.0,
): PlacedObject {
  const builder = OBJECT_BUILDERS[shapeName];
  const shape = SHAPE_DICTIONARY.find(s => s.name === shapeName);

  let elements: LayerElement[];

  if (detailLevel < 0.3 || !builder) {
    // Low detail or no builder → simple rect
    elements = fallbackBuilder(x, y, scale, biomeColors, mood, shape || { baseW: 20, baseH: 20 } as ShapeFingerprint);
  } else if (detailLevel < 0.6) {
    // Medium detail → builder but remove small elements
    elements = (builder || fallbackBuilder)(x, y, scale, biomeColors, mood);
    // Keep only the largest elements (first 3)
    elements = elements.slice(0, Math.max(2, Math.ceil(elements.length * 0.5)));
  } else {
    // Full detail
    elements = (builder || fallbackBuilder)(x, y, scale, biomeColors, mood);
  }

  const baseW = shape?.baseW || 20;
  const baseH = shape?.baseH || 20;

  return {
    name: shapeName,
    x, y, scale,
    elements,
    collision: { x, y, w: baseW * scale, h: baseH * scale },
  };
}

// ============================================================================
// CLUSTER → OBJECT PIPELINE — used by detail_engine during reference matching
// ============================================================================

/**
 * Take a cluster of grid points from the fingerprint analyzer,
 * identify the best matching object, and build it.
 *
 * This is the function called by kasvillage_detail_engine.ts
 */
export function identifyAndBuild(
  clusterPoints: Array<{ gx: number; gy: number; edge: number }>,
  worldX: number,
  worldY: number,
  scale: number,
  biomeColors: string[],
  mood: ShadingPreset,
  detailLevel: number,
): PlacedObject | null {
  const miniFingerprint = extractClusterFingerprint(clusterPoints);
  const matches = matchShape(miniFingerprint);

  if (matches.length === 0 || matches[0].confidence < 0.3) return null;

  const best = matches[0];
  return buildObject(best.shape.name, worldX, worldY, scale, biomeColors, mood, detailLevel);
}

/**
 * Get all available object names for a category.
 */
export function getObjectsByCategory(category: ShapeFingerprint['category']): string[] {
  return SHAPE_DICTIONARY.filter(s => s.category === category).map(s => s.name);
}

/**
 * Get total object count in dictionary.
 */
export function getDictionarySize(): number {
  return SHAPE_DICTIONARY.length;
}
