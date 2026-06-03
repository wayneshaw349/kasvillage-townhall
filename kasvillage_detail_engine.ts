// ============================================================================
// KasVillage Universal Detail Engine
// Reference image → 20×20 grid fingerprint → constraints check → 
// procedural shapes → 60 camera angle variants
// No image stored. Only math. Passes constraints SDK.
// ============================================================================

import { ShadingPreset } from './kasvillage_avatar_engine';
import { Room, RoomCamera, EnvironmentLayer, LayerElement, CollisionRect, RACE_BIOMES } from './kasvillage_environments';

// ============================================================================
// STEP 1: Grid Analyzer — image → 400-point fingerprint
// ============================================================================

export interface GridPoint {
  /** Grid position */
  gx: number;
  gy: number;
  /** Edge presence 0.0–1.0 */
  edge: number;
  /** Edge angle in radians (0=horizontal, PI/2=vertical) */
  edgeAngle: number;
  /** Color as HSL */
  h: number;
  s: number;
  l: number;
  /** Local density — how many edges nearby */
  density: number;
  /** Color cluster ID (0-7, grouped by similarity) */
  cluster: number;
}

export interface Fingerprint {
  grid: GridPoint[];
  gridW: number;
  gridH: number;
  /** Global stats */
  avgDensity: number;       // 0.0–1.0 how busy the image is
  avgComplexity: number;    // 0.0–1.0 how varied the edges are
  colorCount: number;       // unique color clusters (1-8)
  dominantHue: number;      // 0-360
  contrastRatio: number;    // 0.0–1.0 light vs dark spread
  symmetry: number;         // 0.0–1.0 left-right similarity
  verticalWeight: number;   // 0.0–1.0 more edges vertical vs horizontal
  /** Constraint check result */
  constraintsPassed: boolean;
  violations: string[];
}

const GRID_W = 20;
const GRID_H = 20;

/**
 * Analyze a reference image and extract structural fingerprint.
 * Input: raw pixel data (RGBA flat array) + dimensions.
 * Output: 400-point grid fingerprint with no image data — just math.
 */
export function analyzeReference(
  pixels: Uint8Array | Uint8ClampedArray,
  imgWidth: number,
  imgHeight: number,
): Fingerprint {
  const grid: GridPoint[] = [];
  const cellW = imgWidth / GRID_W;
  const cellH = imgHeight / GRID_H;

  // First pass: sample each grid cell
  for (let gy = 0; gy < GRID_H; gy++) {
    for (let gx = 0; gx < GRID_W; gx++) {
      const cx = Math.floor((gx + 0.5) * cellW);
      const cy = Math.floor((gy + 0.5) * cellH);

      // Sample center pixel color
      const idx = (cy * imgWidth + cx) * 4;
      const r = pixels[idx] || 0;
      const g = pixels[idx + 1] || 0;
      const b = pixels[idx + 2] || 0;
      const [h, s, l] = rgbToHsl(r, g, b);

      // Edge detection: compare with neighbors (Sobel-like)
      let edgeX = 0, edgeY = 0;
      const sampleOffsets = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [ox, oy] of sampleOffsets) {
        const nx = cx + Math.floor(ox * cellW * 0.3);
        const ny = cy + Math.floor(oy * cellH * 0.3);
        if (nx >= 0 && nx < imgWidth && ny >= 0 && ny < imgHeight) {
          const ni = (ny * imgWidth + nx) * 4;
          const nr = pixels[ni] || 0;
          const ng = pixels[ni + 1] || 0;
          const nb = pixels[ni + 2] || 0;
          const diff = Math.abs(r - nr) + Math.abs(g - ng) + Math.abs(b - nb);
          if (ox !== 0) edgeX += diff * ox;
          if (oy !== 0) edgeY += diff * oy;
        }
      }

      const edgeMag = Math.min(1, Math.sqrt(edgeX * edgeX + edgeY * edgeY) / 400);
      const edgeAngle = Math.atan2(edgeY, edgeX);

      grid.push({ gx, gy, edge: edgeMag, edgeAngle, h, s, l, density: 0, cluster: 0 });
    }
  }

  // Second pass: compute local density (3×3 neighborhood edge average)
  for (let i = 0; i < grid.length; i++) {
    const p = grid[i];
    let sum = 0, count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = p.gx + dx, ny = p.gy + dy;
        if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
          sum += grid[ny * GRID_W + nx].edge;
          count++;
        }
      }
    }
    p.density = sum / count;
  }

  // Third pass: color clustering (simple K-means with 8 buckets by hue)
  for (const p of grid) {
    p.cluster = Math.floor(p.h / 45) % 8;
  }

  // Global stats
  const avgDensity = grid.reduce((s, p) => s + p.density, 0) / grid.length;

  const edgeAngles = grid.filter(p => p.edge > 0.1).map(p => p.edgeAngle);
  const angleVariance = edgeAngles.length > 1
    ? edgeAngles.reduce((s, a) => s + Math.abs(a - edgeAngles[0]), 0) / edgeAngles.length / Math.PI
    : 0;
  const avgComplexity = Math.min(1, angleVariance);

  const clusterSet = new Set(grid.map(p => p.cluster));
  const colorCount = clusterSet.size;

  const dominantHue = grid.reduce((s, p) => s + p.h, 0) / grid.length;

  const lValues = grid.map(p => p.l);
  const contrastRatio = Math.max(...lValues) - Math.min(...lValues);

  // Symmetry: compare left half to right half
  let symScore = 0, symCount = 0;
  for (let gy = 0; gy < GRID_H; gy++) {
    for (let gx = 0; gx < GRID_W / 2; gx++) {
      const left = grid[gy * GRID_W + gx];
      const right = grid[gy * GRID_W + (GRID_W - 1 - gx)];
      symScore += 1 - Math.abs(left.edge - right.edge);
      symCount++;
    }
  }
  const symmetry = symCount > 0 ? symScore / symCount : 0;

  // Vertical weight: ratio of vertical edges to horizontal
  const vertEdges = grid.filter(p => p.edge > 0.1 && Math.abs(p.edgeAngle) > Math.PI / 4).length;
  const horizEdges = grid.filter(p => p.edge > 0.1 && Math.abs(p.edgeAngle) <= Math.PI / 4).length;
  const verticalWeight = (vertEdges + horizEdges) > 0 ? vertEdges / (vertEdges + horizEdges) : 0.5;

  // Constraints check
  const { passed, violations } = checkFingerprint(grid, avgDensity);

  return {
    grid, gridW: GRID_W, gridH: GRID_H,
    avgDensity, avgComplexity, colorCount, dominantHue,
    contrastRatio, symmetry, verticalWeight,
    constraintsPassed: passed, violations,
  };
}

// ============================================================================
// STEP 2: Constraints Checker — fingerprint vs banned patterns
// ============================================================================

function checkFingerprint(grid: GridPoint[], avgDensity: number): { passed: boolean; violations: string[] } {
  const violations: string[] = [];

  // Check for face-like proportions in upper-center grid region
  // Eyes = two high-edge symmetric points at ~30% from top, ~30% from center
  const eyeRegion = grid.filter(p =>
    p.gy >= 4 && p.gy <= 7 &&
    p.edge > 0.4 &&
    (p.gx >= 6 && p.gx <= 9 || p.gx >= 11 && p.gx <= 14)
  );

  // Check symmetry of eye-region edges
  if (eyeRegion.length >= 4) {
    const leftEyes = eyeRegion.filter(p => p.gx < 10);
    const rightEyes = eyeRegion.filter(p => p.gx >= 10);
    if (leftEyes.length >= 2 && rightEyes.length >= 2) {
      // Symmetric high-edge points in face region = possible face
      const eyeRatio = Math.abs(leftEyes.length - rightEyes.length);
      if (eyeRatio <= 1) {
        violations.push('possible_face_symmetry');
      }
    }
  }

  // Check for realistic skin tone dominance
  const skinTonePoints = grid.filter(p =>
    p.h >= 15 && p.h <= 45 &&
    p.s >= 20 && p.s <= 60 &&
    p.l >= 40 && p.l <= 85
  );
  if (skinTonePoints.length > grid.length * 0.4) {
    violations.push('excessive_skin_tone_coverage');
  }

  // Check for photo-like density (real photos have very uniform density)
  const densities = grid.map(p => p.density);
  const densityVariance = densities.reduce((s, d) => s + Math.pow(d - avgDensity, 2), 0) / densities.length;
  if (densityVariance < 0.005 && avgDensity > 0.3) {
    violations.push('photo_like_uniform_density');
  }

  // Too many color clusters = possible photo (procedural art uses fewer colors)
  const uniqueHues = new Set(grid.map(p => Math.floor(p.h / 15)));
  if (uniqueHues.size > 20) {
    violations.push('excessive_color_variety');
  }

  return { passed: violations.length === 0, violations };
}

// ============================================================================
// STEP 3: Fingerprint → Procedural Shapes
// ============================================================================

interface ShapeSpec {
  type: 'rect' | 'circle' | 'path' | 'polygon';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  opacity: number;
  z: number;       // 0-4 depth layer
}

/**
 * Convert a fingerprint into procedural SVG shapes.
 * No concept of "what" the shapes represent — just structural matching.
 */
function fingerprintToShapes(
  fp: Fingerprint,
  roomW: number,
  roomH: number,
  biomeColors: { floor: string[]; wall: string[]; accent: string[] },
  mood: ShadingPreset,
): ShapeSpec[] {
  const shapes: ShapeSpec[] = [];
  const cellW = roomW / fp.gridW;
  const cellH = roomH / fp.gridH;

  // Seeded random from fingerprint stats
  let seed = Math.floor(fp.dominantHue * 1000 + fp.avgDensity * 10000);
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 10000) / 10000;
  };

  const pickBiome = (category: 'floor' | 'wall' | 'accent') => {
    const arr = biomeColors[category];
    return arr[Math.floor(rand() * arr.length)];
  };

  for (const point of fp.grid) {
    // Skip low-edge empty areas
    if (point.edge < 0.08 && point.density < 0.1) continue;

    const x = point.gx * cellW;
    const y = point.gy * cellH;

    // Edge points → structural lines and shapes
    if (point.edge > 0.3) {
      // Strong edge → wall/structural element
      const isVertical = Math.abs(point.edgeAngle) > Math.PI / 4;
      const thickness = 4 + point.edge * 20;
      const length = cellW * (0.5 + point.density * 1.5);

      if (isVertical) {
        // Vertical edge → column, wall edge, pillar
        shapes.push({
          type: 'rect',
          x: x + cellW / 2 - thickness / 2,
          y: y,
          width: thickness,
          height: length,
          rotation: 0,
          color: pickBiome(point.l < 40 ? 'floor' : 'wall'),
          opacity: 0.6 + point.edge * 0.4,
          z: point.gy < fp.gridH * 0.3 ? 1 : 3, // upper = back wall, lower = foreground
        });
      } else {
        // Horizontal edge → shelf, beam, floor line
        shapes.push({
          type: 'rect',
          x,
          y: y + cellH / 2 - thickness / 2,
          width: length,
          height: thickness,
          rotation: 0,
          color: pickBiome(point.gy < fp.gridH * 0.3 ? 'wall' : 'floor'),
          opacity: 0.6 + point.edge * 0.4,
          z: 2,
        });
      }

      // High-edge + high-density = detail area → add ornament shapes
      if (point.density > 0.4) {
        const ornamentSize = 3 + point.density * 12;
        shapes.push({
          type: rand() > 0.5 ? 'circle' : 'rect',
          x: x + cellW * 0.2 + rand() * cellW * 0.6,
          y: y + cellH * 0.2 + rand() * cellH * 0.6,
          width: ornamentSize,
          height: ornamentSize,
          rotation: point.edgeAngle,
          color: pickBiome('accent'),
          opacity: 0.4 + rand() * 0.3,
          z: 3,
        });
      }
    }

    // Medium edge → texture fills
    if (point.edge > 0.1 && point.edge <= 0.3) {
      // Subtle texture — small shapes for surface detail
      const texCount = Math.ceil(point.density * 3);
      for (let t = 0; t < texCount; t++) {
        shapes.push({
          type: 'rect',
          x: x + rand() * cellW,
          y: y + rand() * cellH,
          width: 2 + rand() * 6,
          height: 2 + rand() * 4,
          rotation: point.edgeAngle + rand() * 0.3,
          color: pickBiome('floor'),
          opacity: 0.15 + rand() * 0.15,
          z: 2,
        });
      }
    }

    // Low edge but colored → fill areas (walls, floor panels)
    if (point.edge <= 0.1 && point.l > 10) {
      // Flat color region — large panel
      if (rand() > 0.7) {
        shapes.push({
          type: 'rect',
          x,
          y,
          width: cellW * (0.8 + rand() * 0.4),
          height: cellH * (0.8 + rand() * 0.4),
          rotation: 0,
          color: pickBiome(point.gy < fp.gridH * 0.35 ? 'wall' : 'floor'),
          opacity: 0.3 + point.l / 100 * 0.4,
          z: point.gy < fp.gridH * 0.3 ? 1 : 2,
        });
      }
    }

    // Curved edge → arched/organic shapes
    if (point.edge > 0.2 && Math.abs(point.edgeAngle) > Math.PI / 6 && Math.abs(point.edgeAngle) < Math.PI / 3) {
      shapes.push({
        type: 'circle',
        x: x + cellW / 2,
        y: y + cellH / 2,
        width: 5 + point.edge * 15,
        height: 5 + point.edge * 15,
        rotation: 0,
        color: pickBiome('accent'),
        opacity: 0.3 + point.edge * 0.4,
        z: 3,
      });
    }
  }

  // Add symmetry-based mirrored shapes if reference was symmetric
  if (fp.symmetry > 0.7) {
    const origCount = shapes.length;
    for (let i = 0; i < origCount; i++) {
      const s = shapes[i];
      if (s.x < roomW / 2 && rand() > 0.3) {
        shapes.push({
          ...s,
          x: roomW - s.x - s.width,
        });
      }
    }
  }

  return shapes;
}

// ============================================================================
// STEP 4: Universal Room Generator + 60 Angles
// ============================================================================

const BIOME_PALETTES_MINIMAL: Record<string, { floor: string[]; wall: string[]; accent: string[]; sky: string }> = {
  village:       { floor: ['#8B7355','#A0896C'], wall: ['#C4A882','#D4B896'], accent: ['#4A7C4B'], sky: '#87CEEB' },
  tech_lab:      { floor: ['#2A2A3E','#333350'], wall: ['#404060','#4A4A6A'], accent: ['#00FFCC'], sky: '#0A0A1A' },
  forest_ruins:  { floor: ['#3A5A2A','#4A6A38'], wall: ['#6A7A5A','#7A8A6A'], accent: ['#C8B878'], sky: '#6A9A5A' },
  gothic_castle: { floor: ['#1A1A2A','#2A2A3A'], wall: ['#3A3A4A','#4A4A5A'], accent: ['#880022'], sky: '#0A0A1A' },
  crystal_cave:  { floor: ['#2A1A3E','#3A2A50'], wall: ['#4A3A6A','#5A4A7A'], accent: ['#CC88FF'], sky: '#1A0A2E' },
  volcanic:      { floor: ['#2A1A0A','#3A2A1A'], wall: ['#4A2A1A','#5A3A2A'], accent: ['#FF4400'], sky: '#3A1A0A' },
  crypt:         { floor: ['#2A2A2A','#333333'], wall: ['#3A3A3A','#444444'], accent: ['#558855'], sky: '#0A0A0A' },
  sky_temple:    { floor: ['#CCCCDD','#DDDDEE'], wall: ['#EEEEFF','#FFFFFF'], accent: ['#FFD700'], sky: '#AACCFF' },
};

function getBiomeColors(race: string) {
  const biome = RACE_BIOMES[race] || 'village';
  return BIOME_PALETTES_MINIMAL[biome] || BIOME_PALETTES_MINIMAL.village;
}

function applyLighting(baseColor: string, normalAngle: number, mood: ShadingPreset): string {
  const r = parseInt(baseColor.slice(1,3),16) || 0;
  const g = parseInt(baseColor.slice(3,5),16) || 0;
  const b = parseInt(baseColor.slice(5,7),16) || 0;
  const lightAngles: Record<string, number> = {
    horror: Math.PI, daylight: -Math.PI/4, twilight: -Math.PI/2,
    neon: 0, moonlit: -Math.PI/3, firelit: Math.PI, custom: -Math.PI/4,
  };
  const lightAngle = lightAngles[mood] || 0;
  const diffuse = Math.max(0.2, Math.cos(normalAngle - lightAngle) * 0.5 + 0.5);
  const shadows: Record<string, number> = {
    horror: 0.7, daylight: 0.3, twilight: 0.5, neon: 0.6, moonlit: 0.6, firelit: 0.6, custom: 0.4,
  };
  const mul = 1 - (1 - diffuse) * (shadows[mood] || 0.4);
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${cl(r*mul).toString(16).padStart(2,'0')}${cl(g*mul).toString(16).padStart(2,'0')}${cl(b*mul).toString(16).padStart(2,'0')}`;
}

/**
 * Generate a room from a fingerprint.
 * No templates — pure structural matching from reference art ratios.
 *
 * @param fp          Fingerprint from analyzeReference()
 * @param race        Player race → biome colors
 * @param mood        Lighting preset
 * @param roomW       Room width in pixels
 * @param roomH       Room height in pixels
 */
export function generateFromFingerprint(
  fp: Fingerprint,
  race: string = 'human',
  mood: ShadingPreset = 'daylight',
  roomW: number = 400,
  roomH: number = 360,
): Room {
  if (!fp.constraintsPassed) {
    console.warn('[KV DetailEngine] Reference failed constraints:', fp.violations);
  }

  const biomeColors = getBiomeColors(race);
  const shapes = fingerprintToShapes(fp, roomW, roomH, biomeColors, mood);

  // Group shapes by Z layer
  const layerMap: Record<number, LayerElement[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };

  // Sky/background
  layerMap[0].push({
    type: 'rect',
    props: { x: 0, y: 0, width: roomW, height: roomH },
    baseColor: biomeColors.sky,
    litColor: applyLighting(biomeColors.sky, 0, mood),
    normalAngle: 0,
  });

  // Convert ShapeSpecs to LayerElements
  for (const s of shapes) {
    const z = Math.max(0, Math.min(4, s.z));
    const normalAngle = s.rotation || 0;

    if (s.type === 'circle') {
      layerMap[z].push({
        type: 'circle',
        props: { cx: s.x, cy: s.y, r: s.width / 2, opacity: s.opacity },
        baseColor: s.color,
        litColor: applyLighting(s.color, normalAngle, mood),
        normalAngle,
      });
    } else {
      layerMap[z].push({
        type: 'rect',
        props: { x: s.x, y: s.y, width: s.width, height: s.height, opacity: s.opacity, rx: s.type === 'circle' ? s.width : 1 },
        baseColor: s.color,
        litColor: applyLighting(s.color, normalAngle, mood),
        normalAngle,
      });
    }
  }

  const layers: EnvironmentLayer[] = [
    { z: 0, elements: layerMap[0], parallax: 0 },
    { z: 1, elements: layerMap[1], parallax: 0.8 },
    { z: 2, elements: layerMap[2], parallax: 1.0 },
    { z: 3, elements: layerMap[3], parallax: 1.0 },
    { z: 4, elements: layerMap[4], parallax: 1.2 },
  ];

  // Auto-generate collision from density map
  const collision: CollisionRect[] = [];
  // Walkable = low density areas in lower half
  collision.push({ x: 20, y: roomH * 0.35, width: roomW - 40, height: roomH * 0.55, type: 'walkable' });
  // Walls = high density areas
  for (const p of fp.grid) {
    if (p.density > 0.5 && p.gy > fp.gridH * 0.3) {
      const cellW = roomW / fp.gridW;
      const cellH = roomH / fp.gridH;
      collision.push({
        x: p.gx * cellW, y: p.gy * cellH,
        width: cellW, height: cellH,
        type: 'wall',
      });
    }
  }
  // Exits
  collision.push({ x: roomW / 2 - 20, y: roomH - 5, width: 40, height: 5, type: 'exit', exitTo: 'next' });

  const camera: RoomCamera = { pitch: 45, yaw: 135, zoom: 1.0, label: 'iso_SE' };

  return {
    id: `fp_${race}_${Math.floor(fp.dominantHue)}`,
    template: 'fingerprint',
    camera,
    biome: RACE_BIOMES[race] || 'village',
    layers,
    collision,
    width: roomW,
    height: roomH,
    avatarCameraOffset: camera.yaw,
    ambientEffect: null,
    shading: mood,
  };
}

/**
 * Generate a room from fingerprint + 30 camera angle variants.
 * One reference image → 30 playable boards. 12° steps.
 */
export function generateWithViews(
  fp: Fingerprint,
  race: string = 'human',
  mood: ShadingPreset = 'daylight',
): { base: Room; views: Room[] } {
  const base = generateFromFingerprint(fp, race, mood);

  const views: Room[] = [];
  for (let angle = 0; angle < 360; angle += 12) {
    const yaw = angle;
    const newCamera: RoomCamera = { pitch: base.camera.pitch, yaw, zoom: base.camera.zoom, label: `fp_${angle}` };

    const newLayers = base.layers.map(layer => ({
      ...layer,
      elements: layer.elements.map(el => ({
        ...el,
        litColor: applyLighting(el.baseColor, el.normalAngle + (yaw * Math.PI) / 180, mood),
      })),
    }));

    views.push({
      ...base,
      id: `${base.id}_${angle}`,
      camera: newCamera,
      layers: newLayers,
      avatarCameraOffset: yaw,
    });
  }

  return { base, views };
}

// ============================================================================
// DETAIL SCORE — rate a fingerprint's complexity (for UI sliders)
// ============================================================================

/**
 * Rate a fingerprint on a 0.0–1.0 detail scale.
 * Devs can use this to show "detail level" in a UI slider.
 */
export function getDetailScore(fp: Fingerprint): number {
  return Math.min(1, (
    fp.avgDensity * 0.3 +
    fp.avgComplexity * 0.25 +
    (fp.colorCount / 8) * 0.15 +
    fp.contrastRatio * 0.15 +
    (1 - fp.symmetry) * 0.05 + // asymmetry = more organic detail
    fp.verticalWeight * 0.1
  ));
}

/**
 * Generate a room from a detail score alone (no reference image needed).
 * Score 0.0 = empty room. Score 1.0 = maximum procedural detail.
 */
export function generateFromDetailScore(
  detailScore: number,
  race: string = 'human',
  mood: ShadingPreset = 'daylight',
): { base: Room; views: Room[] } {
  // Synthesize a fingerprint from the score
  const grid: GridPoint[] = [];
  let seed = Math.floor(detailScore * 99999);
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 10000) / 10000; };

  for (let gy = 0; gy < GRID_H; gy++) {
    for (let gx = 0; gx < GRID_W; gx++) {
      const isWallZone = gy < GRID_H * 0.3;
      const isFloorZone = gy > GRID_H * 0.35;
      const edgeChance = isWallZone ? 0.4 : isFloorZone ? 0.2 : 0.6;

      const edge = rand() < edgeChance ? detailScore * (0.3 + rand() * 0.7) : 0;
      const edgeAngle = rand() * Math.PI - Math.PI / 2;

      grid.push({
        gx, gy,
        edge,
        edgeAngle,
        h: rand() * 360,
        s: 20 + rand() * 40,
        l: 20 + rand() * 60,
        density: edge * (0.5 + rand() * 0.5),
        cluster: Math.floor(rand() * 8),
      });
    }
  }

  const fp: Fingerprint = {
    grid, gridW: GRID_W, gridH: GRID_H,
    avgDensity: detailScore * 0.6,
    avgComplexity: detailScore * 0.5,
    colorCount: 2 + Math.floor(detailScore * 6),
    dominantHue: rand() * 360,
    contrastRatio: 0.3 + detailScore * 0.5,
    symmetry: 0.3 + rand() * 0.4,
    verticalWeight: 0.3 + rand() * 0.4,
    constraintsPassed: true,
    violations: [],
  };

  return generateWithViews(fp, race, mood);
}

// ============================================================================
// COLOR UTILITY
// ============================================================================

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

// ============================================================================
// SHAPE DICTIONARY — object fingerprints stored on phone (~4KB)
// Each = name + 5×5 edge pattern + procedural builder
// ============================================================================

interface ShapeDef {
  name: string;
  category: string;
  pattern: number[];  // 25 numbers = 5×5 edge grid
  aspect: number;
  build: (x:number,y:number,w:number,h:number,d:number,r:()=>number) => ShapeSpec[];
}

// Barrel builder — chain of rects forming a curve
function buildBarrel(x:number,y:number,w:number,h:number,d:number,r:()=>number): ShapeSpec[] {
  const els: ShapeSpec[] = [];
  for (let s=0;s<6;s++) {
    const t=s/5, bulge=Math.sin(t*Math.PI)*w*0.15;
    els.push({type:'rect',x:x-bulge/2,y:y+s*h/6,width:w+bulge,height:h/6,rotation:0,color:'C2',opacity:0.85,z:3});
  }
  els.push({type:'rect',x:x-w*0.05,y:y+h*0.2,width:w*1.1,height:h*0.04,rotation:0,color:'C1',opacity:0.7,z:3});
  els.push({type:'rect',x:x-w*0.05,y:y+h*0.75,width:w*1.1,height:h*0.04,rotation:0,color:'C1',opacity:0.7,z:3});
  return els;
}

const SHAPE_DICT: ShapeDef[] = [
  // CHAIR — vertical edges (legs/back) + horizontal (seat)
  { name:'chair', category:'furniture', aspect:0.6,
    pattern:[0,0.8,0.8,0.8,0, 0,0.8,0.2,0.8,0, 0,0.8,0.8,0.8,0, 0,0.7,0,0.7,0, 0,0.7,0,0.7,0],
    build:(x,y,w,h,d,r)=>{
      const e:ShapeSpec[]=[];
      e.push({type:'rect',x:x+w*0.1,y,width:w*0.8,height:h*0.42,rotation:0,color:'C1',opacity:0.85,z:3});
      e.push({type:'rect',x,y:y+h*0.4,width:w,height:h*0.08,rotation:0,color:'C1',opacity:0.9,z:3});
      e.push({type:'rect',x:x+w*0.1,y:y+h*0.48,width:w*0.08,height:h*0.52,rotation:0,color:'C2',opacity:0.8,z:3});
      e.push({type:'rect',x:x+w*0.82,y:y+h*0.48,width:w*0.08,height:h*0.52,rotation:0,color:'C2',opacity:0.8,z:3});
      if(d>0.5)for(let s=0;s<3;s++)e.push({type:'rect',x:x+w*0.2+s*w*0.2,y:y+h*0.05,width:w*0.06,height:h*0.32,rotation:0,color:'C2',opacity:0.3,z:3});
      return e;
    }},
  // TABLE — strong horizontal top + vertical legs at edges
  { name:'table', category:'furniture', aspect:1.5,
    pattern:[0.8,0.8,0.8,0.8,0.8, 0,0,0,0,0, 0.6,0,0,0,0.6, 0.6,0,0,0,0.6, 0.6,0,0,0,0.6],
    build:(x,y,w,h,d,r)=>{
      const e:ShapeSpec[]=[];
      e.push({type:'rect',x,y,width:w,height:h*0.12,rotation:0,color:'C1',opacity:0.9,z:3});
      e.push({type:'rect',x:x+w*0.05,y:y+h*0.12,width:w*0.06,height:h*0.88,rotation:0,color:'C2',opacity:0.8,z:3});
      e.push({type:'rect',x:x+w*0.89,y:y+h*0.12,width:w*0.06,height:h*0.88,rotation:0,color:'C2',opacity:0.8,z:3});
      if(d>0.4){e.push({type:'circle',x:x+w*0.3,y:y-h*0.05,width:w*0.1,height:w*0.1,rotation:0,color:'C3',opacity:0.6,z:3});}
      return e;
    }},
  // THRONE — wide top + armrests + legs
  { name:'throne', category:'furniture', aspect:0.7,
    pattern:[0,0.9,0.9,0.9,0, 0.5,0.9,0.3,0.9,0.5, 0.5,0.9,0.3,0.9,0.5, 0.8,0.8,0.8,0.8,0.8, 0,0.7,0,0.7,0],
    build:(x,y,w,h,d,r)=>{
      const e:ShapeSpec[]=[];
      e.push({type:'rect',x:x+w*0.1,y,width:w*0.8,height:h*0.65,rotation:0,color:'C3',opacity:0.9,z:3});
      e.push({type:'rect',x,y:y+h*0.5,width:w,height:h*0.15,rotation:0,color:'C3',opacity:0.85,z:3});
      e.push({type:'rect',x:x-w*0.08,y:y+h*0.35,width:w*0.15,height:h*0.3,rotation:0,color:'C1',opacity:0.8,z:3});
      e.push({type:'rect',x:x+w*0.93,y:y+h*0.35,width:w*0.15,height:h*0.3,rotation:0,color:'C1',opacity:0.8,z:3});
      return e;
    }},
  // BOOKSHELF — repeating horizontal bands
  { name:'bookshelf', category:'furniture', aspect:0.8,
    pattern:[0.8,0.8,0.8,0.8,0.8, 0.6,0.6,0.6,0.6,0.6, 0.8,0.8,0.8,0.8,0.8, 0.6,0.6,0.6,0.6,0.6, 0.8,0.8,0.8,0.8,0.8],
    build:(x,y,w,h,d,r)=>{
      const e:ShapeSpec[]=[];
      e.push({type:'rect',x,y,width:w,height:h,rotation:0,color:'C2',opacity:0.85,z:3});
      for(let s=0;s<4;s++){
        const sy=y+(s+1)*h/5;
        e.push({type:'rect',x,y:sy,width:w,height:h*0.03,rotation:0,color:'C1',opacity:0.9,z:3});
        if(d>0.3)for(let b=0;b<4;b++)e.push({type:'rect',x:x+w*0.05+b*w*0.22,y:sy-h*0.12,width:w*0.08,height:h*0.12,rotation:0,color:'C3',opacity:0.5+r()*0.3,z:3});
      }
      return e;
    }},
  // BARREL — curved sides + horizontal bands
  { name:'barrel', category:'container', aspect:0.7,
    pattern:[0,0.6,0.6,0.6,0, 0.7,0.4,0.4,0.4,0.7, 0.8,0.3,0.3,0.3,0.8, 0.7,0.4,0.4,0.4,0.7, 0,0.6,0.6,0.6,0],
    build:buildBarrel },
  // CHEST — lid + body + lock
  { name:'chest', category:'container', aspect:1.4,
    pattern:[0,0.7,0.7,0.7,0, 0.8,0.8,0.8,0.8,0.8, 0.8,0.5,0.5,0.5,0.8, 0.8,0.5,0.5,0.5,0.8, 0.8,0.8,0.8,0.8,0.8],
    build:(x,y,w,h,d,r)=>{
      const e:ShapeSpec[]=[];
      e.push({type:'rect',x,y:y+h*0.15,width:w,height:h*0.85,rotation:0,color:'C2',opacity:0.9,z:3});
      e.push({type:'rect',x:x-w*0.02,y,width:w*1.04,height:h*0.2,rotation:0,color:'C1',opacity:0.85,z:3});
      e.push({type:'circle',x:x+w*0.5,y:y+h*0.5,width:w*0.08,height:w*0.08,rotation:0,color:'C3',opacity:0.9,z:3});
      return e;
    }},
  // DOOR — frame + dark opening
  { name:'door', category:'structure', aspect:0.5,
    pattern:[0,0.9,0.9,0.9,0, 0,0.9,0.2,0.9,0, 0,0.9,0.2,0.9,0, 0,0.9,0.2,0.9,0, 0,0.9,0.9,0.9,0],
    build:(x,y,w,h,d,r)=>{
      const e:ShapeSpec[]=[];
      e.push({type:'rect',x:x+w*0.1,y,width:w*0.8,height:h,rotation:0,color:'C0',opacity:0.95,z:1});
      e.push({type:'rect',x,y,width:w*0.1,height:h,rotation:0,color:'C1',opacity:0.9,z:1});
      e.push({type:'rect',x:x+w*0.9,y,width:w*0.1,height:h,rotation:0,color:'C1',opacity:0.9,z:1});
      if(d>0.4)e.push({type:'circle',x:x+w*0.7,y:y+h*0.5,width:w*0.06,height:w*0.06,rotation:0,color:'C3',opacity:0.8,z:1});
      return e;
    }},
  // PILLAR — tall narrow + capital/base
  { name:'pillar', category:'structure', aspect:0.25,
    pattern:[0,0.8,0.8,0.8,0, 0,0.7,0.7,0.7,0, 0,0.7,0.7,0.7,0, 0,0.7,0.7,0.7,0, 0,0.8,0.8,0.8,0],
    build:(x,y,w,h,d,r)=>{
      const e:ShapeSpec[]=[];
      e.push({type:'rect',x:x+w*0.15,y:y+h*0.08,width:w*0.7,height:h*0.84,rotation:0,color:'C1',opacity:0.9,z:3});
      e.push({type:'rect',x,y,width:w,height:h*0.08,rotation:0,color:'C1',opacity:0.95,z:3});
      e.push({type:'rect',x:x+w*0.05,y:y+h*0.92,width:w*0.9,height:h*0.08,rotation:0,color:'C1',opacity:0.95,z:3});
      return e;
    }},
  // TORCH — narrow vertical + glow circle
  { name:'torch', category:'light', aspect:0.2,
    pattern:[0,0,0.5,0,0, 0,0,0.8,0,0, 0,0,0.7,0,0, 0,0,0.6,0,0, 0,0,0.4,0,0],
    build:(x,y,w,h,d,r)=>{
      const e:ShapeSpec[]=[];
      e.push({type:'rect',x:x+w*0.35,y:y+h*0.3,width:w*0.3,height:h*0.7,rotation:0,color:'C2',opacity:0.9,z:3});
      e.push({type:'circle',x:x+w*0.5,y:y+h*0.2,width:w*0.5,height:w*0.5,rotation:0,color:'GLOW',opacity:0.4,z:4});
      e.push({type:'circle',x:x+w*0.5,y:y+h*0.15,width:w*0.25,height:w*0.25,rotation:0,color:'FLAME',opacity:0.7,z:4});
      return e;
    }},
  // TREE — trunk + round canopy
  { name:'tree', category:'nature', aspect:0.5,
    pattern:[0,0.5,0.7,0.5,0, 0.4,0.7,0.8,0.7,0.4, 0.3,0.6,0.7,0.6,0.3, 0,0,0.8,0,0, 0,0,0.7,0,0],
    build:(x,y,w,h,d,r)=>{
      const e:ShapeSpec[]=[];
      e.push({type:'rect',x:x+w*0.4,y:y+h*0.5,width:w*0.2,height:h*0.5,rotation:0,color:'C2',opacity:0.9,z:3});
      e.push({type:'circle',x:x+w*0.5,y:y+h*0.3,width:w*0.8,height:h*0.5,rotation:0,color:'C3',opacity:0.8,z:3});
      return e;
    }},
  // ROCK — irregular overlapping rects
  { name:'rock', category:'nature', aspect:1.2,
    pattern:[0,0.3,0.4,0.3,0, 0.4,0.6,0.7,0.6,0.4, 0.5,0.7,0.8,0.7,0.5, 0.3,0.5,0.6,0.5,0.3, 0,0.2,0.3,0.2,0],
    build:(x,y,w,h,d,r)=>{
      const e:ShapeSpec[]=[];
      e.push({type:'rect',x:x+w*0.1,y:y+h*0.2,width:w*0.8,height:h*0.7,rotation:r()*0.15,color:'C1',opacity:0.85,z:3});
      e.push({type:'rect',x:x+w*0.2,y:y+h*0.1,width:w*0.6,height:h*0.5,rotation:-r()*0.1,color:'C1',opacity:0.5,z:3});
      return e;
    }},
  // ARCH — curved top from rotated rect chain
  { name:'arch', category:'structure', aspect:0.7,
    pattern:[0,0.5,0.9,0.5,0, 0.7,0.3,0,0.3,0.7, 0.8,0,0,0,0.8, 0.8,0,0,0,0.8, 0.8,0,0,0,0.8],
    build:(x,y,w,h,d,r)=>{
      const e:ShapeSpec[]=[];
      e.push({type:'rect',x,y:y+h*0.3,width:w*0.12,height:h*0.7,rotation:0,color:'C1',opacity:0.9,z:1});
      e.push({type:'rect',x:x+w*0.88,y:y+h*0.3,width:w*0.12,height:h*0.7,rotation:0,color:'C1',opacity:0.9,z:1});
      for(let s=0;s<=8;s++){const a=Math.PI*s/8;
        e.push({type:'rect',x:x+w/2+Math.cos(a)*w*0.44-w*0.04,y:y+h*0.3-Math.sin(a)*h*0.3-h*0.03,width:w*0.08,height:h*0.06,rotation:-a+Math.PI/2,color:'C1',opacity:0.9,z:1});}
      e.push({type:'rect',x:x+w*0.12,y:y+h*0.3,width:w*0.76,height:h*0.7,rotation:0,color:'C0',opacity:0.9,z:0});
      return e;
    }},
  // CRATE — box with cross planks
  { name:'crate', category:'container', aspect:1.0,
    pattern:[0.8,0.8,0.8,0.8,0.8, 0.8,0.3,0.3,0.3,0.8, 0.8,0.3,0.3,0.3,0.8, 0.8,0.3,0.3,0.3,0.8, 0.8,0.8,0.8,0.8,0.8],
    build:(x,y,w,h,d,r)=>{
      const e:ShapeSpec[]=[];
      e.push({type:'rect',x,y,width:w,height:h,rotation:0,color:'C2',opacity:0.85,z:3});
      if(d>0.3){e.push({type:'rect',x,y:y+h*0.48,width:w,height:h*0.04,rotation:0,color:'C1',opacity:0.4,z:3});
      e.push({type:'rect',x:x+w*0.48,y,width:w*0.04,height:h,rotation:0,color:'C1',opacity:0.4,z:3});}
      return e;
    }},
  // BED — headboard + mattress
  { name:'bed', category:'furniture', aspect:1.8,
    pattern:[0.7,0.7,0.5,0.3,0.3, 0.8,0.8,0.8,0.8,0.8, 0.8,0.6,0.6,0.6,0.8, 0.8,0.6,0.6,0.6,0.8, 0.6,0,0,0,0.6],
    build:(x,y,w,h,d,r)=>{
      const e:ShapeSpec[]=[];
      e.push({type:'rect',x,y:y+h*0.2,width:w,height:h*0.65,rotation:0,color:'C1',opacity:0.85,z:3});
      e.push({type:'rect',x,y,width:w*0.3,height:h*0.25,rotation:0,color:'C2',opacity:0.9,z:3});
      if(d>0.5)e.push({type:'rect',x:x+w*0.05,y:y+h*0.25,width:w*0.9,height:h*0.15,rotation:0,color:'C3',opacity:0.5,z:3});
      return e;
    }},
  // CAULDRON — bulging body
  { name:'cauldron', category:'container', aspect:1.0,
    pattern:[0,0.5,0.5,0.5,0, 0.7,0.4,0.4,0.4,0.7, 0.8,0.6,0.6,0.6,0.8, 0.7,0.7,0.7,0.7,0.7, 0,0.5,0.5,0.5,0],
    build:(x,y,w,h,d,r)=>{
      const e:ShapeSpec[]=[];
      for(let s=0;s<5;s++){const t=s/4,bulge=Math.sin(t*Math.PI)*w*0.2;
        e.push({type:'rect',x:x-bulge/2,y:y+h*0.2+s*h*0.14,width:w+bulge,height:h*0.14,rotation:0,color:'C1',opacity:0.9,z:3});}
      e.push({type:'rect',x:x-w*0.05,y:y+h*0.15,width:w*1.1,height:h*0.08,rotation:0,color:'C1',opacity:0.95,z:3});
      if(d>0.3)e.push({type:'circle',x:x+w*0.5,y:y+h*0.1,width:w*0.6,height:h*0.15,rotation:0,color:'GLOW',opacity:0.3,z:4});
      return e;
    }},
  // FOUNTAIN
  { name:'fountain', category:'nature', aspect:1.0,
    pattern:[0,0,0.5,0,0, 0,0.4,0.6,0.4,0, 0.6,0.7,0.8,0.7,0.6, 0.7,0.8,0.8,0.8,0.7, 0.5,0.6,0.6,0.6,0.5],
    build:(x,y,w,h,d,r)=>{
      const e:ShapeSpec[]=[];
      e.push({type:'circle',x:x+w*0.5,y:y+h*0.6,width:w*0.9,height:h*0.4,rotation:0,color:'C1',opacity:0.85,z:3});
      e.push({type:'circle',x:x+w*0.5,y:y+h*0.55,width:w*0.6,height:h*0.25,rotation:0,color:'C0',opacity:0.5,z:3});
      e.push({type:'rect',x:x+w*0.45,y:y+h*0.2,width:w*0.1,height:h*0.4,rotation:0,color:'C1',opacity:0.9,z:3});
      return e;
    }},
  // RUG — flat with border
  { name:'rug', category:'decoration', aspect:2.0,
    pattern:[0.5,0.5,0.5,0.5,0.5, 0.5,0.3,0.3,0.3,0.5, 0.5,0.3,0.3,0.3,0.5, 0.5,0.3,0.3,0.3,0.5, 0.5,0.5,0.5,0.5,0.5],
    build:(x,y,w,h,d,r)=>{
      const e:ShapeSpec[]=[];
      e.push({type:'rect',x,y,width:w,height:h,rotation:0,color:'C3',opacity:0.7,z:2});
      e.push({type:'rect',x:x+w*0.05,y:y+h*0.1,width:w*0.9,height:h*0.8,rotation:0,color:'C3',opacity:0.3,z:2});
      return e;
    }},
  // BANNER — hanging from top
  { name:'banner', category:'decoration', aspect:0.4,
    pattern:[0.8,0.8,0.8,0.8,0.8, 0,0.7,0.7,0.7,0, 0,0.6,0.6,0.6,0, 0,0.5,0.5,0.5,0, 0,0,0.4,0,0],
    build:(x,y,w,h,d,r)=>{
      const e:ShapeSpec[]=[];
      e.push({type:'rect',x,y,width:w,height:h*0.06,rotation:0,color:'C2',opacity:0.9,z:3});
      e.push({type:'rect',x:x+w*0.1,y:y+h*0.06,width:w*0.8,height:h*0.8,rotation:0,color:'C3',opacity:0.85,z:3});
      return e;
    }},
  // CHANDELIER
  { name:'chandelier', category:'light', aspect:1.5,
    pattern:[0,0,0.5,0,0, 0.3,0.5,0.7,0.5,0.3, 0.7,0.8,0.3,0.8,0.7, 0.3,0.5,0,0.5,0.3, 0,0,0,0,0],
    build:(x,y,w,h,d,r)=>{
      const e:ShapeSpec[]=[];
      e.push({type:'rect',x:x+w*0.48,y,width:w*0.04,height:h*0.3,rotation:0,color:'C2',opacity:0.8,z:4});
      e.push({type:'rect',x:x+w*0.1,y:y+h*0.3,width:w*0.8,height:h*0.05,rotation:0,color:'C2',opacity:0.9,z:4});
      for(let c=0;c<4;c++){const cx=x+w*0.15+c*w*0.23;
        e.push({type:'circle',x:cx,y:y+h*0.2,width:w*0.06,height:w*0.06,rotation:0,color:'GLOW',opacity:0.5,z:4});}
      return e;
    }},
  // WINDOW
  { name:'window', category:'structure', aspect:0.6,
    pattern:[0.8,0.8,0.8,0.8,0.8, 0.8,0.2,0.8,0.2,0.8, 0.8,0.2,0.8,0.2,0.8, 0.8,0.2,0.8,0.2,0.8, 0.8,0.8,0.8,0.8,0.8],
    build:(x,y,w,h,d,r)=>{
      const e:ShapeSpec[]=[];
      e.push({type:'rect',x,y,width:w,height:h,rotation:0,color:'C1',opacity:0.9,z:1});
      e.push({type:'rect',x:x+w*0.1,y:y+h*0.1,width:w*0.8,height:h*0.8,rotation:0,color:'C0',opacity:0.5,z:1});
      e.push({type:'rect',x:x+w*0.48,y:y+h*0.1,width:w*0.04,height:h*0.8,rotation:0,color:'C1',opacity:0.9,z:1});
      e.push({type:'rect',x:x+w*0.1,y:y+h*0.48,width:w*0.8,height:h*0.04,rotation:0,color:'C1',opacity:0.9,z:1});
      return e;
    }},
  // STAIRS
  { name:'stairs', category:'structure', aspect:1.2,
    pattern:[0,0,0,0.8,0.8, 0,0,0.8,0.8,0, 0,0.8,0.8,0,0, 0.8,0.8,0,0,0, 0.8,0,0,0,0],
    build:(x,y,w,h,d,r)=>{
      const e:ShapeSpec[]=[];
      const steps=5+Math.floor(d*4);
      for(let s=0;s<steps;s++){const sw=w*(1-s*0.05);
        e.push({type:'rect',x:x+(w-sw)/2,y:y+s*h/steps,width:sw,height:h/steps-1,rotation:0,color:'C1',opacity:0.85,z:2});}
      return e;
    }},
];

// ============================================================================
// MATCHING ENGINE — cluster → mini-fingerprint → dictionary lookup
// ============================================================================

function extractMini(points: GridPoint[], gw: number, gh: number): number[] {
  const mini = new Array(25).fill(0);
  if (!points.length) return mini;
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  for(const p of points){x0=Math.min(x0,p.gx);x1=Math.max(x1,p.gx);y0=Math.min(y0,p.gy);y1=Math.max(y1,p.gy);}
  const bw=x1-x0+1, bh=y1-y0+1;
  for(const p of points){
    const mx=Math.floor(((p.gx-x0)/Math.max(1,bw))*5);
    const my=Math.floor(((p.gy-y0)/Math.max(1,bh))*5);
    mini[Math.min(4,my)*5+Math.min(4,mx)]=Math.max(mini[Math.min(4,my)*5+Math.min(4,mx)],p.edge);
  }
  return mini;
}

function comparePat(a: number[], b: number[]): number {
  let d=0; for(let i=0;i<25;i++)d+=Math.abs(a[i]-b[i]); return 1-d/25;
}

function findClusters(fp: Fingerprint, thresh: number = 0.15): GridPoint[][] {
  const vis=new Set<number>(), clusters: GridPoint[][]=[];
  for(const p of fp.grid){
    if(p.edge<thresh)continue;
    const k=p.gy*fp.gridW+p.gx;
    if(vis.has(k))continue;
    const cluster:GridPoint[]=[], queue=[p];
    while(queue.length){
      const c=queue.pop()!; const ck=c.gy*fp.gridW+c.gx;
      if(vis.has(ck))continue; vis.add(ck); cluster.push(c);
      for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=c.gx+dx,ny=c.gy+dy;
        if(nx>=0&&nx<fp.gridW&&ny>=0&&ny<fp.gridH){
          const nb=fp.grid[ny*fp.gridW+nx];
          if(nb.edge>=thresh&&!vis.has(ny*fp.gridW+nx))queue.push(nb);
        }
      }
    }
    if(cluster.length>=3)clusters.push(cluster);
  }
  return clusters;
}

function matchShape(cluster: GridPoint[], gw: number, gh: number): {shape:ShapeDef,sim:number}|null {
  const mini=extractMini(cluster,gw,gh);
  let best:ShapeDef|null=null, bestSim=0;
  for(const s of SHAPE_DICT){const sim=comparePat(mini,s.pattern);if(sim>bestSim&&sim>0.45){bestSim=sim;best=s;}}
  return best?{shape:best,sim:bestSim}:null;
}

// ============================================================================
// generateSmartRoom — reference → clusters → match → build → 60 angles
// ============================================================================

export function generateSmartRoom(
  fp: Fingerprint,
  race: string = 'human',
  mood: ShadingPreset = 'daylight',
  roomW: number = 400,
  roomH: number = 360,
): { base: Room; views: Room[]; matched: {name:string,sim:number,x:number,y:number}[] } {

  const biomeColors = getBiomeColors(race);
  const detail = getDetailScore(fp);
  const clusters = findClusters(fp);
  const matched: {name:string,sim:number,x:number,y:number}[] = [];
  const allShapes: ShapeSpec[] = [];

  let seed = Math.floor(fp.dominantHue * 1000);
  const rand = () => { seed=(seed*1103515245+12345)&0x7fffffff; return(seed%10000)/10000; };

  const cMap: Record<string,string> = {
    C0:'#0A0A0A', C1:biomeColors.wall[0], C2:biomeColors.wall[1]||biomeColors.wall[0],
    C3:biomeColors.accent[0], GLOW:'#FFCC44', FLAME:'#FF8800',
  };
  const rc = (c:string) => cMap[c]||c;

  const cellW = roomW / fp.gridW, cellH = roomH / fp.gridH;

  for (const cluster of clusters) {
    const m = matchShape(cluster, fp.gridW, fp.gridH);
    if (!m) continue;
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
    for(const p of cluster){x0=Math.min(x0,p.gx*cellW);x1=Math.max(x1,(p.gx+1)*cellW);y0=Math.min(y0,p.gy*cellH);y1=Math.max(y1,(p.gy+1)*cellH);}
    matched.push({name:m.shape.name,sim:m.sim,x:x0,y:y0});
    const built = m.shape.build(x0,y0,x1-x0,y1-y0,detail,rand);
    for(const s of built)allShapes.push({...s,color:rc(s.color)});
  }

  // Fill remaining areas with fingerprint-based texture
  const bgShapes = fingerprintToShapes(fp, roomW, roomH, biomeColors, mood);
  for(const s of bgShapes){
    const overlaps=matched.some(o=>s.x>o.x-20&&s.x<o.x+60&&s.y>o.y-20&&s.y<o.y+60);
    if(!overlaps)allShapes.push(s);
  }

  // Build layers
  const layerMap:Record<number,LayerElement[]>={0:[],1:[],2:[],3:[],4:[]};
  layerMap[0].push({type:'rect',props:{x:0,y:0,width:roomW,height:roomH},baseColor:biomeColors.sky,litColor:applyLighting(biomeColors.sky,0,mood),normalAngle:0});

  for(const s of allShapes){
    const z=Math.max(0,Math.min(4,s.z)), na=s.rotation||0;
    if(s.type==='circle')
      layerMap[z].push({type:'circle',props:{cx:s.x,cy:s.y,r:s.width/2,opacity:s.opacity},baseColor:s.color,litColor:applyLighting(s.color,na,mood),normalAngle:na});
    else
      layerMap[z].push({type:'rect',props:{x:s.x,y:s.y,width:s.width,height:s.height,opacity:s.opacity,rx:1},baseColor:s.color,litColor:applyLighting(s.color,na,mood),normalAngle:na});
  }

  const layers:EnvironmentLayer[]=[
    {z:0,elements:layerMap[0],parallax:0},{z:1,elements:layerMap[1],parallax:0.8},
    {z:2,elements:layerMap[2],parallax:1},{z:3,elements:layerMap[3],parallax:1},{z:4,elements:layerMap[4],parallax:1.2},
  ];

  const collision:CollisionRect[]=[
    {x:20,y:roomH*0.35,width:roomW-40,height:roomH*0.55,type:'walkable'},
    {x:roomW/2-20,y:roomH-5,width:40,height:5,type:'exit',exitTo:'next'},
  ];
  for(const o of matched)if(['pillar','rock','fountain','barrel','crate','chest'].includes(o.name))
    collision.push({x:o.x,y:o.y,width:30,height:30,type:'wall'});

  const cam:RoomCamera={pitch:45,yaw:135,zoom:1,label:'iso_SE'};
  const base:Room={id:`smart_${race}_${matched.length}`,template:'smart',camera:cam,biome:RACE_BIOMES[race]||'village',layers,collision,width:roomW,height:roomH,avatarCameraOffset:cam.yaw,ambientEffect:null,shading:mood};

  // 60 angle variants
  const views:Room[]=[];
  for(let a=0;a<360;a+=6){
    const nc:RoomCamera={pitch:cam.pitch,yaw:a,zoom:cam.zoom,label:`s${a}`};
    const nl=base.layers.map(l=>({...l,elements:l.elements.map(e=>({...e,litColor:applyLighting(e.baseColor,e.normalAngle+(a*Math.PI)/180,mood)}))}));
    views.push({...base,id:`${base.id}_${a}`,camera:nc,layers:nl,avatarCameraOffset:a});
  }

  return { base, views, matched };
}
