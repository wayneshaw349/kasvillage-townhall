// ============================================================================
// KasVillage Enemy Combo System — Counter-Chain Attacks + Paint Erasure
//
// When player fails to block on enemy beat:
//   1. Enemy launches a procedural combo chain (unique per race/type)
//   2. Each hit in the chain ERASES player paint near the impact
//   3. Chain length scales with enemy type (NPC=2-3, mini-boss=4-6, boss=8-12)
//   4. No enemy paint — blank canvas IS the punishment
//   5. The board literally gets taken back. Emptiness = losing.
//
// Your art is your score. Losing paint = losing progress visually.
// ============================================================================

import type {
  PaintCanvas,
  PaintStroke,
} from './kasvillage_game_input_paint';

import type { EnemyAI } from './kasvillage_game_v1';
import type { EnemyClock } from './kasvillage_difficulty';

// ============================================================================
// ENEMY COMBO PATTERNS — procedural per race
// ============================================================================

export type EnemyComboHit = {
  /** Beat offset from combo start */
  beatOffset: number;
  /** Hit type — determines animation + paint effect */
  type: 'jab' | 'cross' | 'uppercut' | 'sweep' | 'slam' | 'grab' | 'slash' | 'thrust';
  /** Damage */
  damage: number;
  /** X offset from enemy position */
  hitOffsetX: number;
  /** Y offset */
  hitOffsetY: number;
  /** Erase radius — how much paint gets destroyed */
  eraseRadius: number;
  /** Enemy paint radius — how much dark paint gets added */
  paintRadius: number;
};

/** Full enemy combo chain */
export interface EnemyCombo {
  /** All hits in sequence */
  hits: EnemyComboHit[];
  /** Total duration in enemy beats */
  totalBeats: number;
  /** Name for HUD display */
  name: string;
  /** Color of enemy's paint (dark, corrupted) */
  paintColor: string;
  /** Secondary paint color */
  paintColor2: string;
}

// ============================================================================
// COMBO GENERATION — procedural based on enemy type/race
// ============================================================================

/** Seed-based random for deterministic combos */
function eRand(seed: number, n: number): number {
  const x = Math.sin(seed + n * 7.13) * 10000;
  return x - Math.floor(x);
}

/**
 * Generate a combo chain for an enemy.
 * Chain length and pattern vary by type. Each enemy gets a unique combo
 * derived from their ID seed.
 */
export function generateEnemyCombo(enemy: EnemyAI): EnemyCombo {
  const seed = hashId(enemy.id);
  const hitTypes = getHitTypesForEnemy(enemy);

  // Chain length by type
  let chainLength: number;
  switch (enemy.type) {
    case 'boss':      chainLength = 8 + Math.floor(eRand(seed, 0) * 5);  break; // 8–12
    case 'mini_boss': chainLength = 4 + Math.floor(eRand(seed, 1) * 3);  break; // 4–6
    default:          chainLength = 2 + Math.floor(eRand(seed, 2) * 2);  break; // 2–3
  }

  const hits: EnemyComboHit[] = [];
  let beatOffset = 0;

  for (let i = 0; i < chainLength; i++) {
    const typeIdx = Math.floor(eRand(seed, i + 10) * hitTypes.length);
    const hitType = hitTypes[typeIdx];

    // Spacing: faster hits in the middle of the chain, slower at start/end
    const spacing = i === 0 ? 0
      : i < chainLength * 0.3 ? 2  // slow start
      : i < chainLength * 0.7 ? 1  // rapid middle
      : 2;                          // slow finish (windup for finisher)

    beatOffset += spacing;

    // Last hit is always the biggest
    const isFinisher = i === chainLength - 1;
    const dmgMult = isFinisher ? 2.0 : 0.6 + eRand(seed, i + 20) * 0.8;

    const baseDmg = enemy.type === 'boss' ? 12 : enemy.type === 'mini_boss' ? 10 : 7;

    hits.push({
      beatOffset,
      type: isFinisher ? 'slam' : hitType,
      damage: Math.round(baseDmg * dmgMult),
      hitOffsetX: (eRand(seed, i + 30) - 0.5) * 60,
      hitOffsetY: (eRand(seed, i + 40) - 0.5) * 30 - 20,
      eraseRadius: isFinisher ? 80 + enemy.scale * 40 : 30 + enemy.scale * 20,
      paintRadius: isFinisher ? 50 + enemy.scale * 30 : 20 + enemy.scale * 15,
    });
  }

  // Combo name generation
  const names = enemy.type === 'boss'
    ? ['Conductor\'s Crescendo', 'Final Movement', 'Symphonic Devastation', 'Magnum Opus']
    : enemy.type === 'mini_boss'
    ? ['Shadow Barrage', 'Iron Tempest', 'Crimson Flurry', 'Abyssal Chain']
    : ['Quick Combo', 'Double Strike', 'Rush Attack', 'Counter Chain'];
  const name = names[Math.floor(eRand(seed, 99) * names.length)];

  return {
    hits,
    totalBeats: beatOffset + 1,
    name,
    paintColor: darkenColor(enemy.color, 0.3),
    paintColor2: darkenColor(enemy.color, 0.5),
  };
}

function getHitTypesForEnemy(enemy: EnemyAI): EnemyComboHit['type'][] {
  // Race-flavored hit types
  const raceHits: Record<string, EnemyComboHit['type'][]> = {
    human:     ['jab', 'cross', 'uppercut'],
    orc:       ['slam', 'grab', 'sweep'],
    darkelf:   ['slash', 'thrust', 'sweep'],
    werewolf:  ['slash', 'grab', 'slam'],
    troll:     ['slam', 'slam', 'grab'],
    fae:       ['thrust', 'slash', 'sweep'],
    dragonkin: ['slash', 'sweep', 'slam'],
    ethereal:  ['thrust', 'thrust', 'sweep'],
    golem:     ['slam', 'slam', 'slam'],
    undead:    ['grab', 'slash', 'thrust'],
    vampire:   ['grab', 'thrust', 'slash'],
    beast:     ['slash', 'slam', 'sweep'],
    angel:     ['thrust', 'sweep', 'uppercut'],
    phoenix:   ['slam', 'sweep', 'uppercut', 'slash'],
  };
  return raceHits[enemy.race || 'human'] || ['jab', 'cross', 'sweep'];
}

// ============================================================================
// ENEMY COMBO STATE — tracks active combo execution
// ============================================================================

export interface EnemyComboState {
  /** Is a combo currently executing */
  active: boolean;
  /** The combo being executed */
  combo: EnemyCombo | null;
  /** Current hit index */
  hitIndex: number;
  /** Beat counter within this combo */
  comboBeatCount: number;
  /** Timer for beat tracking */
  comboTimer: number;
  /** Enemy beat interval (from enemy clock) */
  beatInterval: number;
  /** Enemy that's executing the combo */
  enemyId: string;
  /** Total damage dealt this combo */
  totalDamage: number;
  /** Total paint erased this combo */
  totalErased: number;
  /** Combo display timer (for HUD) */
  displayTimer: number;
}

export function createEnemyComboState(): EnemyComboState {
  return {
    active: false,
    combo: null,
    hitIndex: 0,
    comboBeatCount: 0,
    comboTimer: 0,
    beatInterval: 0.5,
    enemyId: '',
    totalDamage: 0,
    totalErased: 0,
    displayTimer: 0,
  };
}

/**
 * Start an enemy combo. Called when player fails to block on enemy beat.
 */
export function startEnemyCombo(
  state: EnemyComboState,
  enemy: EnemyAI,
  enemyClock: EnemyClock,
): void {
  const combo = generateEnemyCombo(enemy);
  state.active = true;
  state.combo = combo;
  state.hitIndex = 0;
  state.comboBeatCount = 0;
  state.comboTimer = 0;
  state.beatInterval = 60 / enemyClock.bpm;
  state.enemyId = enemy.id;
  state.totalDamage = 0;
  state.totalErased = 0;
  state.displayTimer = combo.totalBeats * state.beatInterval + 1.5;
}

// ============================================================================
// TICK ENEMY COMBO — execute hits on enemy beat timing
// ============================================================================

/**
 * Tick the enemy combo. Returns hit data if a hit lands this frame.
 */
export function tickEnemyCombo(
  state: EnemyComboState,
  dt: number,
): EnemyComboHit | null {
  if (!state.active || !state.combo) return null;

  state.comboTimer += dt;
  state.displayTimer -= dt;

  // Check if we've reached the next beat
  const beatsPassed = Math.floor(state.comboTimer / state.beatInterval);
  if (beatsPassed > state.comboBeatCount) {
    state.comboBeatCount = beatsPassed;

    // Check if any hit triggers on this beat
    while (state.hitIndex < state.combo.hits.length) {
      const hit = state.combo.hits[state.hitIndex];
      if (hit.beatOffset <= state.comboBeatCount) {
        state.hitIndex++;
        state.totalDamage += hit.damage;
        return hit;
      }
      break;
    }

    // Combo finished
    if (state.hitIndex >= state.combo.hits.length) {
      state.active = false;
    }
  }

  return null;
}

// ============================================================================
// PAINT ERASURE — enemy combo destroys player art
// ============================================================================

/**
 * Erase player paint near a hit position.
 * Strokes within eraseRadius get destroyed. Returns count erased.
 */
export function erasePaintAtPosition(
  canvas: PaintCanvas,
  hitX: number,
  hitY: number,
  eraseRadius: number,
): number {
  let erased = 0;
  const rSq = eraseRadius * eraseRadius;

  for (let i = canvas.strokes.length - 1; i >= 0; i--) {
    const s = canvas.strokes[i];
    const dx = s.x - hitX;
    const dy = s.y - hitY;
    if (dx * dx + dy * dy <= rSq) {
      canvas.strokes.splice(i, 1);
      erased++;
    }
  }

  // Update coverage
  canvas.coverage = Math.min(1, canvas.strokes.length / 300);
  return erased;
}

/**
 * Erase paint in a directional sweep (for sweep/slash attacks).
 * Erases along a line from startX to endX.
 */
export function erasePaintSweep(
  canvas: PaintCanvas,
  startX: number,
  endX: number,
  y: number,
  sweepWidth: number,
): number {
  let erased = 0;
  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);

  for (let i = canvas.strokes.length - 1; i >= 0; i--) {
    const s = canvas.strokes[i];
    if (s.x >= minX && s.x <= maxX && Math.abs(s.y - y) <= sweepWidth) {
      canvas.strokes.splice(i, 1);
      erased++;
    }
  }

  canvas.coverage = Math.min(1, canvas.strokes.length / 300);
  return erased;
}

/**
 * Erase paint in expanding ring (for slam attacks).
 */
export function erasePaintRing(
  canvas: PaintCanvas,
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
): number {
  let erased = 0;
  const innerSq = innerRadius * innerRadius;
  const outerSq = outerRadius * outerRadius;

  for (let i = canvas.strokes.length - 1; i >= 0; i--) {
    const s = canvas.strokes[i];
    const dx = s.x - centerX;
    const dy = s.y - centerY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= innerSq && distSq <= outerSq) {
      canvas.strokes.splice(i, 1);
      erased++;
    }
  }

  canvas.coverage = Math.min(1, canvas.strokes.length / 300);
  return erased;
}

// ============================================================================
// ENEMY PAINT — dark, corrupted strokes that replace player art
// ============================================================================

let _eSeed = 777;
function eR() { _eSeed = (_eSeed * 1103515245 + 12345) & 0x7fffffff; return (_eSeed % 10000) / 10000; }

/**
 * Add enemy paint at hit position — dark, corrupted, hostile marks.
 * These visually "stain" the board where player art was erased.
 */
export function addEnemyPaint(
  canvas: PaintCanvas,
  hit: EnemyComboHit,
  hitX: number,
  hitY: number,
  comboColors: { paintColor: string; paintColor2: string },
): void {
  const count = Math.floor(hit.paintRadius / 5) + 3;

  for (let i = 0; i < count; i++) {
    const angle = eR() * Math.PI * 2;
    const dist = eR() * hit.paintRadius;

    const shape = getEnemyPaintShape(hit.type);

    canvas.strokes.push({
      x: hitX + Math.cos(angle) * dist + hit.hitOffsetX,
      y: hitY + Math.sin(angle) * dist * 0.6 + hit.hitOffsetY,
      radius: 3 + eR() * (hit.paintRadius * 0.4),
      color: eR() > 0.4 ? comboColors.paintColor : comboColors.paintColor2,
      opacity: 0.3 + eR() * 0.4,
      rotation: angle,
      shape,
      permanent: true,
      fadeRate: 0,
      age: 0,
    });
  }

  // Drip marks (enemy paint oozes)
  const dripCount = Math.floor(hit.eraseRadius / 20);
  for (let i = 0; i < dripCount; i++) {
    canvas.strokes.push({
      x: hitX + (eR() - 0.5) * hit.eraseRadius,
      y: hitY + 10 + eR() * 60,
      radius: 2 + eR() * 4,
      color: comboColors.paintColor,
      opacity: 0.2 + eR() * 0.2,
      rotation: Math.PI / 2,
      shape: 'drip',
      permanent: true,
      fadeRate: 0,
      age: 0,
    });
  }
}

/** Map enemy hit type to paint shape */
function getEnemyPaintShape(hitType: EnemyComboHit['type']): PaintStroke['shape'] {
  switch (hitType) {
    case 'jab':
    case 'cross':
    case 'thrust':   return 'streak';
    case 'uppercut': return 'spray';
    case 'sweep':    return 'streak';
    case 'slam':     return 'splat';
    case 'grab':     return 'burst';
    case 'slash':    return 'streak';
    default:         return 'splat';
  }
}

// ============================================================================
// PROCESS ENEMY COMBO HIT — erase + repaint + damage
// ============================================================================

export interface EnemyHitResult {
  /** Damage dealt */
  damage: number;
  /** Paint strokes erased */
  paintErased: number;
  /** Hit position (world coords) */
  hitX: number;
  hitY: number;
  /** Hit type for animation */
  hitType: EnemyComboHit['type'];
  /** Combo hit index */
  hitNumber: number;
  /** Total hits in combo */
  totalHits: number;
  /** Is this the finisher */
  isFinisher: boolean;
  /** Combo name */
  comboName: string;
}

/**
 * Process a single enemy combo hit.
 * Erases player paint and deals damage. No enemy paint —
 * blank canvas IS the punishment.
 */
export function processEnemyHit(
  hit: EnemyComboHit,
  enemy: EnemyAI,
  playerX: number,
  playerY: number,
  canvas: PaintCanvas,
  comboState: EnemyComboState,
): EnemyHitResult {
  const hitX = playerX + hit.hitOffsetX;
  const hitY = playerY + hit.hitOffsetY;

  // ERASE player paint — that's it. No replacement.
  let erased = 0;
  switch (hit.type) {
    case 'sweep':
    case 'slash':
      erased = erasePaintSweep(canvas, hitX - hit.eraseRadius, hitX + hit.eraseRadius, hitY, hit.eraseRadius * 0.4);
      break;
    case 'slam':
      erased = erasePaintRing(canvas, hitX, hitY, 0, hit.eraseRadius);
      break;
    case 'grab':
      erased = erasePaintAtPosition(canvas, playerX, playerY, hit.eraseRadius * 0.8);
      break;
    default:
      erased = erasePaintAtPosition(canvas, hitX, hitY, hit.eraseRadius);
      break;
  }

  comboState.totalErased += erased;

  return {
    damage: hit.damage,
    paintErased: erased,
    hitX,
    hitY,
    hitType: hit.type,
    hitNumber: comboState.hitIndex,
    totalHits: comboState.combo?.hits.length || 0,
    isFinisher: comboState.hitIndex >= (comboState.combo?.hits.length || 0),
    comboName: comboState.combo?.name || '',
  };
}

// ============================================================================
// RENDER — enemy combo visual feedback
// ============================================================================

/**
 * Draw enemy combo HUD — shows combo name, hit counter, and erase count.
 */
export function drawEnemyComboHUD(
  ctx: CanvasRenderingContext2D,
  state: EnemyComboState,
  screenW: number,
  screenH: number,
): void {
  if (!state.combo || state.displayTimer <= 0) return;

  const alpha = Math.min(1, state.displayTimer);
  ctx.save();
  ctx.globalAlpha = alpha;

  // Combo name (enemy's attack name)
  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = '#FF2222';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#FF0000';
  ctx.shadowBlur = 10;
  ctx.fillText(state.combo.name, screenW / 2, screenH * 0.65);

  // Hit counter
  if (state.active) {
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#FF4444';
    ctx.fillText(
      `${state.hitIndex} / ${state.combo.hits.length}`,
      screenW / 2,
      screenH * 0.65 + 25,
    );
  }

  // Paint erased counter
  if (state.totalErased > 0) {
    ctx.font = '12px monospace';
    ctx.fillStyle = '#FF6644';
    ctx.shadowBlur = 0;
    ctx.fillText(
      `-${state.totalErased} paint`,
      screenW / 2,
      screenH * 0.65 + 45,
    );
  }

  ctx.restore();
}

/**
 * Draw erase shockwave animation at hit position.
 * Call on each enemy combo hit for visual feedback.
 */
export function drawEraseShockwave(
  ctx: CanvasRenderingContext2D,
  hitX: number,
  hitY: number,
  radius: number,
  progress: number, // 0–1
  color: string,
): void {
  if (progress >= 1) return;

  ctx.save();
  ctx.globalAlpha = (1 - progress) * 0.4;

  // Expanding ring
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(hitX, hitY, radius * progress, 0, Math.PI * 2);
  ctx.stroke();

  // Inner dark fill (paint being erased)
  ctx.globalAlpha = (1 - progress) * 0.15;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(hitX, hitY, radius * progress * 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// HELPERS
// ============================================================================

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

function darkenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.floor(r * factor);
  const dg = Math.floor(g * factor);
  const db = Math.floor(b * factor);
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}

// ============================================================================
// EXPORTS
// ============================================================================
// generateEnemyCombo(enemy)                         — build combo chain
// createEnemyComboState()                           — init state
// startEnemyCombo(state, enemy, clock)             — trigger combo
// tickEnemyCombo(state, dt)                         — tick (returns hit or null)
// processEnemyHit(hit, enemy, pX, pY, canvas, st) — erase + repaint + damage
// erasePaintAtPosition(canvas, x, y, r)            — circular erase
// erasePaintSweep(canvas, x1, x2, y, w)            — directional erase
// erasePaintRing(canvas, x, y, r1, r2)             — ring erase
// addEnemyPaint(canvas, hit, x, y, colors)         — dark paint
// drawEnemyComboHUD(ctx, state, w, h)              — render combo overlay
// drawEraseShockwave(ctx, x, y, r, progress, col)  — erase animation
// ============================================================================
