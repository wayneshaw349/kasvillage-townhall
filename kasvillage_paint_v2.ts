// ============================================================================
// KasVillage Paint System v2 — MASSIVE VIBRANT PAINT
// Reference: 3D paint explosion with dense layered color blobs,
// radial directional streaks, extreme size variation (3px to 60px),
// overlapping opacity buildup creating rich saturated zones.
//
// Replaces: paintComboHit, paintEnemyDeath, paintParryExplosion
// Every combo paints BIG. Every parry paints HUGE. Board = abstract art.
// ============================================================================

import type {
  PaintCanvas,
  PaintStroke,
  ComboResult,
} from './kasvillage_game_input_paint';

// ============================================================================
// ENHANCED COLOR SYSTEM
// ============================================================================

let _seed = 42;
function R() { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return (_seed % 10000) / 10000; }

const FULL_SPECTRUM = [
  // Warm
  '#FF0044', '#FF2200', '#FF4400', '#FF6600', '#FF8800', '#FFAA00', '#FFCC00', '#FFD700', '#FFFF00',
  // Cool
  '#00FF44', '#00FF88', '#00FFAA', '#00FFCC', '#00FFFF', '#00CCFF', '#0088FF', '#0044FF',
  // Purple/Pink
  '#2200FF', '#4400FF', '#6600FF', '#8800FF', '#AA00FF', '#CC00FF', '#FF00FF', '#FF00CC', '#FF0088',
  // Vivid accent
  '#FF4488', '#44FF88', '#88FF44', '#FF8844', '#4488FF', '#8844FF',
  // White highlight
  '#FFFFFF',
];

function color(): string { return FULL_SPECTRUM[Math.floor(R() * FULL_SPECTRUM.length)]; }
function avatarColor(canvas: PaintCanvas): string {
  return canvas.avatarColors[Math.floor(R() * canvas.avatarColors.length)] || color();
}

/** Blend between avatar colors and full spectrum based on intensity */
function paintColor(canvas: PaintCanvas, spectrumBias: number): string {
  return R() < spectrumBias ? color() : avatarColor(canvas);
}

// ============================================================================
// HELPER — add stroke with max-strokes enforcement
// ============================================================================

function add(canvas: PaintCanvas, stroke: PaintStroke): void {
  canvas.strokes.push(stroke);
  canvas.totalStrokes++;
  if (canvas.strokes.length > canvas.maxStrokes) canvas.strokes.shift();
  canvas.coverage = Math.min(1, canvas.totalStrokes / 300);
}

function s(permanent: boolean = true): Pick<PaintStroke, 'permanent' | 'fadeRate' | 'age'> {
  return { permanent, fadeRate: permanent ? 0 : 0.5, age: 0 };
}

// ============================================================================
// COMBO HIT — v2: dense, layered, radial, scales HARD with chain
// ============================================================================

export function paintComboHitV2(
  canvas: PaintCanvas,
  x: number, y: number,
  result: ComboResult,
  enemyColor: string,
): void {
  const chain = result.chainLength;
  const intense = result.splatIntensity;
  const perfect = result.perfect;

  // Scale everything with chain length — chain 1 = small, chain 20 = massive
  const scale = 0.4 + Math.min(2.5, chain * 0.12);
  const specBias = Math.min(0.8, chain * 0.04); // more spectrum color at higher chains

  // ── LAYER 1: Dense core blob cluster (3-8 overlapping blobs) ──
  const coreCount = 3 + Math.floor(scale * 3);
  for (let i = 0; i < coreCount; i++) {
    const angle = R() * Math.PI * 2;
    const dist = R() * 12 * scale;
    const size = 8 + scale * 18 + R() * 15; // BIG blobs: 8-55px
    add(canvas, {
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist * 0.6,
      radius: size,
      color: paintColor(canvas, specBias),
      opacity: 0.35 + R() * 0.3 + (perfect ? 0.15 : 0),
      rotation: angle,
      shape: 'splat',
      ...s(),
    });
  }

  // ── LAYER 2: Radial directional streaks (shoot outward from center) ──
  const streakCount = 4 + Math.floor(scale * 6);
  for (let i = 0; i < streakCount; i++) {
    const angle = (i / streakCount) * Math.PI * 2 + R() * 0.4;
    const dist = 15 + scale * 35 + R() * 25;
    const len = 10 + scale * 25 + R() * 15;
    add(canvas, {
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist * 0.5,
      radius: len,
      color: paintColor(canvas, specBias),
      opacity: 0.3 + scale * 0.15 + R() * 0.15,
      rotation: angle, // streak AIMS outward from center
      shape: 'streak',
      ...s(),
    });
  }

  // ── LAYER 3: Secondary blobs between streaks (fill gaps) ──
  const fillCount = 2 + Math.floor(scale * 4);
  for (let i = 0; i < fillCount; i++) {
    const angle = R() * Math.PI * 2;
    const dist = 8 + scale * 25 + R() * 20;
    const size = 5 + scale * 12 + R() * 10;
    add(canvas, {
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist * 0.55,
      radius: size,
      color: paintColor(canvas, specBias),
      opacity: 0.25 + R() * 0.25,
      rotation: angle + R(),
      shape: R() > 0.5 ? 'splat' : 'spray',
      ...s(),
    });
  }

  // ── LAYER 4: Tiny scattered dots (atmosphere, depth) ──
  const dotCount = 5 + Math.floor(scale * 8);
  for (let i = 0; i < dotCount; i++) {
    const angle = R() * Math.PI * 2;
    const dist = 5 + scale * 50 + R() * 30;
    add(canvas, {
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist * 0.6,
      radius: 2 + R() * 4, // TINY: 2-6px
      color: paintColor(canvas, specBias),
      opacity: 0.3 + R() * 0.35,
      rotation: R() * Math.PI * 2,
      shape: 'spray',
      ...s(),
    });
  }

  // ── LAYER 5: Drip tails (gravity pulls paint down) ──
  const dripCount = 1 + Math.floor(scale * 3);
  for (let i = 0; i < dripCount; i++) {
    const dripX = x + (R() - 0.5) * scale * 40;
    const dripLen = 15 + scale * 30 + R() * 25;
    add(canvas, {
      x: dripX,
      y: y + 5 + R() * dripLen,
      radius: 2 + R() * 4 + scale * 2,
      color: paintColor(canvas, specBias * 0.5),
      opacity: 0.25 + R() * 0.2,
      rotation: Math.PI / 2 + (R() - 0.5) * 0.3,
      shape: 'drip',
      ...s(),
    });
  }

  // ── PERFECT HIT BONUS: white-hot center flash ──
  if (perfect) {
    add(canvas, {
      x, y, radius: 15 + scale * 25,
      color: '#FFFFFF', opacity: 0.15,
      rotation: 0, shape: 'burst', ...s(),
    });
    // Extra bright blob on top
    add(canvas, {
      x: x + (R() - 0.5) * 8, y: y + (R() - 0.5) * 6,
      radius: 10 + scale * 15,
      color: color(), opacity: 0.5 + R() * 0.3,
      rotation: R() * Math.PI, shape: 'splat', ...s(),
    });
  }

  // ── CHAIN MILESTONE MEGA SPLATS (10, 20, 30) ──
  if (chain === 10 || chain === 20 || chain === 30 || chain === 50) {
    const megaScale = chain / 10;
    for (let i = 0; i < 8 + megaScale * 5; i++) {
      const angle = (i / (8 + megaScale * 5)) * Math.PI * 2;
      const dist = 30 + megaScale * 40 + R() * 30;
      add(canvas, {
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist * 0.5,
        radius: 12 + megaScale * 15 + R() * 12,
        color: color(),
        opacity: 0.4 + R() * 0.3,
        rotation: angle, shape: 'splat', ...s(),
      });
    }
  }
}

// ============================================================================
// ENEMY DEATH — v2: explosion of paint, boss = screen-filling
// ============================================================================

export function paintEnemyDeathV2(
  canvas: PaintCanvas,
  x: number, y: number,
  enemyColor: string,
  enemyScale: number,
  isBoss: boolean,
): void {
  const scale = enemyScale * (isBoss ? 2.5 : 1);

  // ── Dense center mass (overlapping creates rich saturation) ──
  const coreCount = 8 + Math.floor(scale * 12);
  for (let i = 0; i < coreCount; i++) {
    const angle = R() * Math.PI * 2;
    const dist = R() * 20 * scale;
    const size = 10 + scale * 20 + R() * 15;
    add(canvas, {
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist * 0.5,
      radius: size,
      color: R() > 0.3 ? color() : enemyColor,
      opacity: 0.4 + R() * 0.35,
      rotation: angle, shape: 'splat', ...s(),
    });
  }

  // ── Radial explosion arms (8-16 directions) ──
  const armCount = 8 + Math.floor(scale * 8);
  for (let i = 0; i < armCount; i++) {
    const angle = (i / armCount) * Math.PI * 2 + R() * 0.3;
    // Multiple blobs per arm (3-5), getting smaller with distance
    const blobsPerArm = 3 + Math.floor(R() * 3);
    for (let b = 0; b < blobsPerArm; b++) {
      const dist = 15 + b * (20 + scale * 12) + R() * 15;
      const size = (15 + scale * 10 - b * 4) * (0.8 + R() * 0.4);
      add(canvas, {
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist * 0.5,
        radius: Math.max(3, size),
        color: R() > 0.4 ? color() : enemyColor,
        opacity: 0.35 + R() * 0.3 - b * 0.05,
        rotation: angle, shape: b === 0 ? 'splat' : 'streak', ...s(),
      });
    }
  }

  // ── Connecting streaks between arms (fills gaps, creates density) ──
  for (let i = 0; i < armCount * 2; i++) {
    const angle = R() * Math.PI * 2;
    const dist = 10 + scale * 40 + R() * 30;
    add(canvas, {
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist * 0.5,
      radius: 6 + scale * 8 + R() * 8,
      color: color(),
      opacity: 0.2 + R() * 0.25,
      rotation: angle, shape: 'spray', ...s(),
    });
  }

  // ── Scatter dots (debris flying outward) ──
  const scatterCount = 15 + Math.floor(scale * 20);
  for (let i = 0; i < scatterCount; i++) {
    const angle = R() * Math.PI * 2;
    const dist = 20 + scale * 80 + R() * 60;
    add(canvas, {
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist * 0.5,
      radius: 2 + R() * 5,
      color: color(),
      opacity: 0.3 + R() * 0.3,
      rotation: R() * Math.PI * 2, shape: 'spray', ...s(),
    });
  }

  // ── Drip cascade (paint runs down from explosion) ──
  const dripCount = 4 + Math.floor(scale * 6);
  for (let i = 0; i < dripCount; i++) {
    const dripX = x + (R() - 0.5) * scale * 80;
    for (let d = 0; d < 3 + Math.floor(R() * 4); d++) {
      add(canvas, {
        x: dripX + (R() - 0.5) * 4,
        y: y + 10 + d * (12 + R() * 15),
        radius: 3 + R() * 4 - d * 0.5,
        color: color(),
        opacity: 0.3 + R() * 0.2 - d * 0.04,
        rotation: Math.PI / 2 + (R() - 0.5) * 0.2,
        shape: 'drip', ...s(),
      });
    }
  }

  // ── BOSS DEATH: Fill the ENTIRE screen ──
  if (isBoss) {
    // Massive blobs everywhere
    for (let i = 0; i < 50; i++) {
      add(canvas, {
        x: R() * 680, y: R() * 540,
        radius: 8 + R() * 40, // 8-48px blobs across entire screen
        color: color(),
        opacity: 0.15 + R() * 0.25,
        rotation: R() * Math.PI * 2, shape: 'splat', ...s(),
      });
    }
    // Wall splatter
    for (let i = 0; i < 20; i++) {
      const onLeft = R() > 0.5;
      add(canvas, {
        x: onLeft ? R() * 60 : 620 + R() * 60,
        y: 50 + R() * 300,
        radius: 10 + R() * 25,
        color: color(),
        opacity: 0.2 + R() * 0.2,
        rotation: onLeft ? Math.PI * 0.5 : -Math.PI * 0.5,
        shape: 'streak', ...s(),
      });
    }
  }
}

// ============================================================================
// PARRY EXPLOSION — v2: THE REFERENCE IMAGE
// Layered opacity buildup. Radial directional arms. 3px to 60px size range.
// Dense center core. Multiple overlapping color zones. This is the art.
// ============================================================================

export function paintParryExplosionV2(
  canvas: PaintCanvas,
  playerX: number,
  playerY: number,
  enemyX: number,
  enemyY: number,
  cancelledHits: number,
): void {
  const cx = (playerX + enemyX) / 2;
  const cy = (playerY + enemyY) / 2;
  const power = Math.min(4, 1 + cancelledHits * 0.4);

  // ═══ CORE: Dense overlapping mass (the bright center of the explosion) ═══
  // Multiple layers of big blobs on top of each other = rich saturated color
  for (let layer = 0; layer < 4; layer++) {
    const layerCount = 5 + Math.floor(power * 3);
    for (let i = 0; i < layerCount; i++) {
      const angle = R() * Math.PI * 2;
      const dist = R() * 15 * (layer + 1) * power * 0.5;
      const size = 12 + power * 14 + R() * 12 - layer * 3;
      add(canvas, {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist * 0.5,
        radius: Math.max(6, size),
        color: color(),
        opacity: 0.3 + R() * 0.35 + (layer === 0 ? 0.15 : 0), // inner layers brighter
        rotation: angle, shape: 'splat', ...s(),
      });
    }
  }

  // ═══ ARMS: 12-20 radial explosion arms, each with 4-6 blobs ═══
  // THIS is what makes it look like the reference image
  const armCount = 12 + Math.floor(power * 4);
  for (let i = 0; i < armCount; i++) {
    const angle = (i / armCount) * Math.PI * 2 + (R() - 0.5) * 0.3;
    const armLength = 4 + Math.floor(power * 2 + R() * 2);

    for (let b = 0; b < armLength; b++) {
      const dist = 10 + b * (18 + power * 8) + R() * 10;
      // Size decreases along arm (big at center, small at tip)
      const size = (20 + power * 15 - b * 5) * (0.7 + R() * 0.6);
      // Opacity decreases along arm
      const opacity = (0.45 + R() * 0.3) - b * 0.06;

      add(canvas, {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist * 0.45,
        radius: Math.max(3, size),
        color: color(),
        opacity: Math.max(0.1, opacity),
        rotation: angle,
        shape: b < 2 ? 'splat' : 'streak',
        ...s(),
      });

      // Sub-blobs branching off main arm (organic, messy)
      if (R() > 0.4) {
        const branchAngle = angle + (R() - 0.5) * 1.2;
        const branchDist = dist * (0.5 + R() * 0.5);
        add(canvas, {
          x: cx + Math.cos(branchAngle) * branchDist,
          y: cy + Math.sin(branchAngle) * branchDist * 0.5,
          radius: Math.max(3, size * 0.6),
          color: color(),
          opacity: Math.max(0.1, opacity * 0.7),
          rotation: branchAngle, shape: 'splat', ...s(),
        });
      }
    }
  }

  // ═══ FILL: Connecting blobs between arms (no gaps) ═══
  const fillCount = 15 + Math.floor(power * 12);
  for (let i = 0; i < fillCount; i++) {
    const angle = R() * Math.PI * 2;
    const dist = 10 + R() * power * 50;
    const size = 6 + R() * power * 12;
    add(canvas, {
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist * 0.5,
      radius: size,
      color: color(),
      opacity: 0.2 + R() * 0.25,
      rotation: angle + R(), shape: 'spray', ...s(),
    });
  }

  // ═══ SCATTER: Tiny dots flying outward (debris field) ═══
  const scatterCount = 25 + Math.floor(power * 20);
  for (let i = 0; i < scatterCount; i++) {
    const angle = R() * Math.PI * 2;
    const dist = 20 + R() * power * 100;
    add(canvas, {
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist * 0.5,
      radius: 2 + R() * 4, // 2-6px tiny dots
      color: color(),
      opacity: 0.3 + R() * 0.4,
      rotation: R() * Math.PI * 2, shape: 'spray', ...s(),
    });
  }

  // ═══ DRIP TRAILS: Heavy paint runs downward ═══
  const dripCount = 6 + Math.floor(power * 4);
  for (let i = 0; i < dripCount; i++) {
    const dripX = cx + (R() - 0.5) * power * 70;
    const segments = 3 + Math.floor(R() * 5);
    for (let d = 0; d < segments; d++) {
      add(canvas, {
        x: dripX + (R() - 0.5) * 3,
        y: cy + 8 + d * (10 + R() * 12),
        radius: 3 + R() * 4 + power - d * 0.3,
        color: color(),
        opacity: 0.3 + R() * 0.2 - d * 0.03,
        rotation: Math.PI / 2 + (R() - 0.5) * 0.15,
        shape: 'drip', ...s(),
      });
    }
  }

  // ═══ WALL SPLASH: Paint hits surrounding walls ═══
  for (let i = 0; i < Math.floor(power * 4); i++) {
    const wallSide = R() > 0.5;
    add(canvas, {
      x: wallSide ? cx - 120 - R() * 80 : cx + 120 + R() * 80,
      y: cy - 100 + R() * 150,
      radius: 8 + R() * power * 12,
      color: color(),
      opacity: 0.15 + R() * 0.15,
      rotation: wallSide ? Math.PI * 0.4 : -Math.PI * 0.4,
      shape: 'streak', ...s(),
    });
  }

  // ═══ GLOW RINGS: Expanding circles (shockwave) ═══
  for (let i = 0; i < 3; i++) {
    add(canvas, {
      x: cx, y: cy,
      radius: 30 + i * 25 + power * 15,
      color: color(),
      opacity: 0.08 - i * 0.02,
      rotation: 0, shape: 'burst', ...s(),
    });
  }

  // ═══ WHITE HOT CENTER: Final bright punch ═══
  add(canvas, {
    x: cx, y: cy, radius: 10 + power * 8,
    color: '#FFFFFF', opacity: 0.2,
    rotation: 0, shape: 'burst', ...s(),
  });
  add(canvas, {
    x: cx + (R() - 0.5) * 6, y: cy + (R() - 0.5) * 4,
    radius: 8 + power * 6,
    color: '#FFFF00', opacity: 0.25,
    rotation: 0, shape: 'splat', ...s(),
  });
}

// ============================================================================
// PARRY COUNTER-HIT — v2: each hit in the free chain is vivid
// ============================================================================

export function paintParryCounterHitV2(
  canvas: PaintCanvas,
  hitX: number,
  hitY: number,
  chainIndex: number,
): void {
  const scale = 1.5 + chainIndex * 0.5;

  // Dense cluster per hit
  const count = 6 + chainIndex * 4;
  for (let i = 0; i < count; i++) {
    const angle = R() * Math.PI * 2;
    const dist = 5 + scale * 18 + R() * 12;
    const size = 6 + scale * 12 + R() * 8;
    add(canvas, {
      x: hitX + Math.cos(angle) * dist,
      y: hitY + Math.sin(angle) * dist * 0.5,
      radius: size,
      color: color(),
      opacity: 0.4 + R() * 0.3,
      rotation: angle,
      shape: R() > 0.3 ? 'splat' : 'streak',
      ...s(),
    });
  }

  // Radial streaks
  for (let i = 0; i < 4 + chainIndex * 2; i++) {
    const angle = (i / (4 + chainIndex * 2)) * Math.PI * 2;
    const dist = 15 + scale * 20 + R() * 15;
    add(canvas, {
      x: hitX + Math.cos(angle) * dist,
      y: hitY + Math.sin(angle) * dist * 0.4,
      radius: 8 + scale * 10,
      color: color(),
      opacity: 0.3 + R() * 0.25,
      rotation: angle, shape: 'streak', ...s(),
    });
  }

  // Tiny scatter
  for (let i = 0; i < 8 + chainIndex * 3; i++) {
    const angle = R() * Math.PI * 2;
    const dist = 10 + R() * scale * 35;
    add(canvas, {
      x: hitX + Math.cos(angle) * dist,
      y: hitY + Math.sin(angle) * dist * 0.5,
      radius: 2 + R() * 3,
      color: color(),
      opacity: 0.3 + R() * 0.35,
      rotation: R() * Math.PI * 2, shape: 'spray', ...s(),
    });
  }

  // Burst ring
  add(canvas, {
    x: hitX, y: hitY,
    radius: 18 + scale * 14,
    color: color(), opacity: 0.12,
    rotation: 0, shape: 'burst', ...s(),
  });
}

// ============================================================================
// STROKE COUNT COMPARISON — old vs new
// ============================================================================
//
// paintComboHit (chain 10):
//   Old: ~18 strokes    New: ~55 strokes (3x denser)
//
// paintEnemyDeath (NPC):
//   Old: ~25 strokes    New: ~80 strokes
//
// paintEnemyDeath (boss):
//   Old: ~55 strokes    New: ~200 strokes (screen-filling)
//
// paintParryExplosion:
//   Old: ~55 strokes    New: ~180 strokes (reference image density)
//
// Total strokes after 4-minute song:
//   Old: ~400-500       New: ~1500-2000 (PAINTING, not dots)
//
// maxStrokes in PaintCanvas should be raised to 2000 for v2.
//
// ============================================================================

// ============================================================================
// EXPORTS
// ============================================================================
// paintComboHitV2(canvas, x, y, result, enemyColor) — replaces paintComboHit
// paintEnemyDeathV2(canvas, x, y, color, scale, isBoss) — replaces paintEnemyDeath
// paintParryExplosionV2(canvas, x, y, ex, ey, cancelled) — replaces paintParryExplosion
// paintParryCounterHitV2(canvas, x, y, chainIndex) — replaces paintParryCounterHit
// ============================================================================
