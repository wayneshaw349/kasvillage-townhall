// ============================================================================
// KasVillage Game v1 — Input + Paint + Spotify
// Drag D-pad: finger controls movement, lift = block
// A/B buttons: combo attacks
// Every action paints the screen. Board = canvas. Player = brush.
// Spotify BPM → rhythm clock sync
// ============================================================================

import { ParticleSystem } from './kasvillage_particles';
import { RhythmClock, ComboState, ComboResult, setBPM } from './kasvillage_game_v1';

// ============================================================================
// DRAG D-PAD INPUT
// ============================================================================

export interface DragInput {
  /** Is finger currently down in D-pad zone? */
  active: boolean;
  /** Initial touch position */
  startX: number;
  startY: number;
  /** Current finger position */
  currentX: number;
  currentY: number;
  /** Normalized direction vector (-1 to 1) */
  dirX: number;
  dirY: number;
  /** Distance from start (0-1, clamped) */
  magnitude: number;
  /** Is player blocking (finger lifted)? */
  blocking: boolean;
  /** Time since finger lifted (for block duration) */
  blockTimer: number;
}

export function createDragInput(): DragInput {
  return {
    active: false,
    startX: 0, startY: 0,
    currentX: 0, currentY: 0,
    dirX: 0, dirY: 0,
    magnitude: 0,
    blocking: false,
    blockTimer: 0,
  };
}

/** Touch down in D-pad zone */
export function onDragStart(drag: DragInput, x: number, y: number): void {
  drag.active = true;
  drag.blocking = false;
  drag.blockTimer = 0;
  drag.startX = x;
  drag.startY = y;
  drag.currentX = x;
  drag.currentY = y;
  drag.dirX = 0;
  drag.dirY = 0;
  drag.magnitude = 0;
}

/** Finger moves in D-pad zone */
export function onDragMove(drag: DragInput, x: number, y: number): void {
  if (!drag.active) return;
  drag.currentX = x;
  drag.currentY = y;

  const dx = x - drag.startX;
  const dy = y - drag.startY;
  const maxRadius = 60; // pixels — D-pad sensitivity radius
  const dist = Math.sqrt(dx * dx + dy * dy);
  drag.magnitude = Math.min(1, dist / maxRadius);

  if (dist > 3) { // dead zone
    drag.dirX = dx / dist;
    drag.dirY = dy / dist;
  } else {
    drag.dirX = 0;
    drag.dirY = 0;
  }
}

/** Finger lifted — enter block state */
export function onDragEnd(drag: DragInput): void {
  drag.active = false;
  drag.blocking = true;
  drag.blockTimer = 0;
  drag.dirX = 0;
  drag.dirY = 0;
  drag.magnitude = 0;
}

/** Convert drag input to physics input flags */
export function dragToPhysicsInput(drag: DragInput, aPressed: boolean, bPressed: boolean): {
  left: boolean; right: boolean; up: boolean; down: boolean;
  jump: boolean; attack: boolean; block: boolean;
  crouch: boolean; dodge: boolean; sprint: boolean;
} {
  const threshold = 0.3;
  const isUp = drag.dirY < -threshold && drag.active;
  const isDown = drag.dirY > threshold && drag.active;
  const isLeft = drag.dirX < -threshold && drag.active;
  const isRight = drag.dirX > threshold && drag.active;
  const isSprint = drag.magnitude > 0.8;

  return {
    left: isLeft,
    right: isRight,
    up: isUp,
    down: isDown,
    jump: isUp && drag.magnitude > 0.5,
    attack: aPressed || bPressed,
    block: drag.blocking,
    crouch: isDown && !isLeft && !isRight,
    dodge: isDown && (isLeft || isRight) && drag.magnitude > 0.6,
    sprint: isSprint,
  };
}

/** Update block timer */
export function updateDragInput(drag: DragInput, dt: number): void {
  if (drag.blocking) {
    drag.blockTimer += dt;
    // Auto-release block after 0.8s
    if (drag.blockTimer > 0.8) {
      drag.blocking = false;
    }
  }
}

// ============================================================================
// A/B BUTTON STATE
// ============================================================================

export interface ButtonState {
  aDown: boolean;
  bDown: boolean;
  aJustPressed: boolean;
  bJustPressed: boolean;
  aPrevDown: boolean;
  bPrevDown: boolean;
}

export function createButtonState(): ButtonState {
  return { aDown: false, bDown: false, aJustPressed: false, bJustPressed: false, aPrevDown: false, bPrevDown: false };
}

export function updateButtons(state: ButtonState): void {
  state.aJustPressed = state.aDown && !state.aPrevDown;
  state.bJustPressed = state.bDown && !state.bPrevDown;
  state.aPrevDown = state.aDown;
  state.bPrevDown = state.bDown;
}

// ============================================================================
// MASSIVE PAINT SYSTEM — every action paints the screen
// ============================================================================

export interface PaintStroke {
  x: number;
  y: number;
  radius: number;
  color: string;
  opacity: number;
  rotation: number;
  shape: 'splat' | 'streak' | 'drip' | 'spray' | 'burst';
  /** Permanent — stays on canvas forever (doesn't fade) */
  permanent: boolean;
  /** If not permanent, fade rate */
  fadeRate: number;
  /** Time alive */
  age: number;
}

export interface PaintCanvas {
  strokes: PaintStroke[];
  /** Max strokes before oldest start getting removed */
  maxStrokes: number;
  /** Canvas coverage 0.0-1.0 — how much of the screen is painted */
  coverage: number;
  /** Total strokes placed this session */
  totalStrokes: number;
  /** Color palette from avatar */
  avatarColors: string[];
  /** Splat color override (null = avatar palette) */
  splatColor: string | null;
}

export function createPaintCanvas(avatarColors: string[]): PaintCanvas {
  return {
    strokes: [],
    maxStrokes: 500,
    coverage: 0,
    totalStrokes: 0,
    avatarColors: avatarColors.length > 0 ? avatarColors : ['#FF1493','#FF6600','#FFD700','#00FF88','#00BFFF','#8B00FF'],
    splatColor: null,
  };
}

// Seeded random for paint variation
let _paintSeed = 1;
function pRand() { _paintSeed = (_paintSeed * 1103515245 + 12345) & 0x7fffffff; return (_paintSeed % 10000) / 10000; }
function pPick(arr: string[]) { return arr[Math.floor(pRand() * arr.length)]; }

function getColor(canvas: PaintCanvas): string {
  if (canvas.splatColor) return canvas.splatColor;
  return pPick(canvas.avatarColors);
}

/** Add a paint stroke to the canvas */
function addStroke(canvas: PaintCanvas, stroke: PaintStroke): void {
  canvas.strokes.push(stroke);
  canvas.totalStrokes++;
  if (canvas.strokes.length > canvas.maxStrokes) {
    canvas.strokes.shift(); // remove oldest
  }
  canvas.coverage = Math.min(1, canvas.totalStrokes / 300);
}

// ============================================================================
// PAINT EVENTS — triggered by gameplay actions
// ============================================================================

/** Player walks/runs — small footprint splatters behind feet */
export function paintFootstep(canvas: PaintCanvas, x: number, y: number, speed: number): void {
  if (speed < 0.3) return;
  const count = speed > 0.7 ? 3 : 1;
  for (let i = 0; i < count; i++) {
    addStroke(canvas, {
      x: x + (pRand() - 0.5) * 20,
      y: y + pRand() * 5,
      radius: 2 + speed * 4 + pRand() * 3,
      color: getColor(canvas),
      opacity: 0.15 + speed * 0.15,
      rotation: pRand() * Math.PI * 2,
      shape: 'splat',
      permanent: true,
      fadeRate: 0,
      age: 0,
    });
  }
}

/** Player jumps — burst of paint at feet */
export function paintJump(canvas: PaintCanvas, x: number, y: number): void {
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI + pRand() * 0.5;
    addStroke(canvas, {
      x: x + Math.cos(angle) * (10 + pRand() * 15),
      y: y + Math.sin(angle) * 5 + pRand() * 8,
      radius: 4 + pRand() * 6,
      color: getColor(canvas),
      opacity: 0.3 + pRand() * 0.2,
      rotation: angle,
      shape: 'spray',
      permanent: true,
      fadeRate: 0,
      age: 0,
    });
  }
}

/** Player lands — impact splatter */
export function paintLand(canvas: PaintCanvas, x: number, y: number, force: number): void {
  const count = force > 0.7 ? 12 : 6;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dist = 8 + force * 25 + pRand() * 15;
    addStroke(canvas, {
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist * 0.4,
      radius: 3 + force * 8 + pRand() * 5,
      color: getColor(canvas),
      opacity: 0.3 + force * 0.3,
      rotation: angle,
      shape: i % 3 === 0 ? 'splat' : 'streak',
      permanent: true,
      fadeRate: 0,
      age: 0,
    });
  }
  // Impact ring
  addStroke(canvas, {
    x, y, radius: 15 + force * 30,
    color: getColor(canvas), opacity: 0.15,
    rotation: 0, shape: 'burst',
    permanent: true, fadeRate: 0, age: 0,
  });
}

/** Combo hit — paint scales with chain length + accuracy */
export function paintComboHit(
  canvas: PaintCanvas,
  x: number, y: number,
  result: ComboResult,
  enemyColor: string,
): void {
  const intensity = result.splatIntensity;
  const count = 3 + Math.floor(intensity * 12);

  // Main splat cluster at hit position
  for (let i = 0; i < count; i++) {
    const angle = pRand() * Math.PI * 2;
    const dist = 5 + intensity * 40 + pRand() * 20;
    const size = 4 + intensity * 15 + pRand() * 8;
    addStroke(canvas, {
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist * 0.6,
      radius: size,
      color: pRand() > 0.3 ? getColor(canvas) : enemyColor,
      opacity: 0.3 + intensity * 0.4 + (result.perfect ? 0.2 : 0),
      rotation: angle,
      shape: pRand() > 0.5 ? 'splat' : 'streak',
      permanent: true,
      fadeRate: 0,
      age: 0,
    });
  }

  // Streaks radiating outward for big combos
  if (result.chainLength > 5) {
    const streakCount = Math.floor(result.chainLength / 3);
    for (let i = 0; i < streakCount; i++) {
      const angle = (i / streakCount) * Math.PI * 2 + pRand() * 0.5;
      addStroke(canvas, {
        x: x + Math.cos(angle) * (20 + intensity * 50),
        y: y + Math.sin(angle) * (12 + intensity * 30),
        radius: 8 + intensity * 20,
        color: getColor(canvas),
        opacity: 0.2 + intensity * 0.3,
        rotation: angle,
        shape: 'streak',
        permanent: true,
        fadeRate: 0,
        age: 0,
      });
    }
  }

  // Perfect hit glow burst
  if (result.perfect) {
    addStroke(canvas, {
      x, y, radius: 20 + intensity * 40,
      color: '#FFFFFF', opacity: 0.12,
      rotation: 0, shape: 'burst',
      permanent: true, fadeRate: 0, age: 0,
    });
  }

  // Drips falling from splat position
  const dripCount = Math.floor(intensity * 4);
  for (let i = 0; i < dripCount; i++) {
    addStroke(canvas, {
      x: x + (pRand() - 0.5) * 30,
      y: y + 10 + pRand() * 40,
      radius: 2 + pRand() * 3,
      color: getColor(canvas),
      opacity: 0.25 + pRand() * 0.15,
      rotation: Math.PI / 2,
      shape: 'drip',
      permanent: true,
      fadeRate: 0,
      age: 0,
    });
  }
}

/** Enemy dies — massive explosion of paint */
export function paintEnemyDeath(canvas: PaintCanvas, x: number, y: number, enemyColor: string, enemyScale: number): void {
  const count = 15 + Math.floor(enemyScale * 15);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + pRand() * 0.8;
    const dist = 15 + enemyScale * 40 + pRand() * 30;
    addStroke(canvas, {
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist * 0.5,
      radius: 6 + enemyScale * 12 + pRand() * 10,
      color: pRand() > 0.4 ? getColor(canvas) : enemyColor,
      opacity: 0.4 + pRand() * 0.3,
      rotation: angle + pRand(),
      shape: ['splat','splat','streak','spray','burst'][Math.floor(pRand() * 5)] as PaintStroke['shape'],
      permanent: true,
      fadeRate: 0,
      age: 0,
    });
  }

  // Boss death = screen-wide splatter
  if (enemyScale > 1.5) {
    for (let i = 0; i < 30; i++) {
      addStroke(canvas, {
        x: pRand() * 400,
        y: pRand() * 500,
        radius: 10 + pRand() * 25,
        color: getColor(canvas),
        opacity: 0.15 + pRand() * 0.2,
        rotation: pRand() * Math.PI * 2,
        shape: 'splat',
        permanent: true,
        fadeRate: 0,
        age: 0,
      });
    }
  }
}

/** Dodge — quick streak in dodge direction */
export function paintDodge(canvas: PaintCanvas, x: number, y: number, dirX: number): void {
  for (let i = 0; i < 4; i++) {
    addStroke(canvas, {
      x: x - dirX * (10 + i * 12),
      y: y + (pRand() - 0.5) * 15,
      radius: 3 + pRand() * 5,
      color: getColor(canvas),
      opacity: 0.2 - i * 0.04,
      rotation: dirX > 0 ? 0 : Math.PI,
      shape: 'streak',
      permanent: true,
      fadeRate: 0,
      age: 0,
    });
  }
}

/** Block — shield splat */
export function paintBlock(canvas: PaintCanvas, x: number, y: number): void {
  addStroke(canvas, {
    x, y, radius: 12 + pRand() * 8,
    color: '#AAAACC', opacity: 0.2,
    rotation: 0, shape: 'burst',
    permanent: false, fadeRate: 0.5, age: 0,
  });
}

/** Beat pulse — subtle color wash on every beat */
export function paintBeatPulse(canvas: PaintCanvas, screenW: number, screenH: number): void {
  if (pRand() > 0.3) return; // not every beat, ~70% chance
  addStroke(canvas, {
    x: pRand() * screenW,
    y: pRand() * screenH,
    radius: 3 + pRand() * 6,
    color: getColor(canvas),
    opacity: 0.05 + pRand() * 0.05,
    rotation: pRand() * Math.PI * 2,
    shape: 'spray',
    permanent: true,
    fadeRate: 0,
    age: 0,
  });
}

/** Movement trail — thin streaks behind the player while moving */
export function paintMovementTrail(canvas: PaintCanvas, x: number, y: number, vx: number, vy: number): void {
  if (Math.abs(vx) < 1 && Math.abs(vy) < 1) return;
  if (pRand() > 0.4) return; // 60% of frames leave a mark

  addStroke(canvas, {
    x: x - vx * 0.5 + (pRand() - 0.5) * 8,
    y: y + (pRand() - 0.5) * 6,
    radius: 1.5 + Math.abs(vx) * 0.5 + pRand() * 2,
    color: getColor(canvas),
    opacity: 0.08 + Math.min(0.12, Math.abs(vx) * 0.02),
    rotation: Math.atan2(vy, vx),
    shape: 'streak',
    permanent: true,
    fadeRate: 0,
    age: 0,
  });
}

// ============================================================================
// PAINT RENDERER — draws all strokes to canvas
// ============================================================================

export function renderPaint(ctx: CanvasRenderingContext2D, canvas: PaintCanvas): void {
  for (const stroke of canvas.strokes) {
    ctx.save();
    ctx.translate(stroke.x, stroke.y);
    ctx.rotate(stroke.rotation);
    ctx.globalAlpha = Math.max(0, stroke.opacity);
    ctx.fillStyle = stroke.color;

    switch (stroke.shape) {
      case 'splat': {
        // Irregular blob — 7 lobes
        ctx.beginPath();
        for (let i = 0; i <= 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const r = stroke.radius * (0.6 + Math.sin(i * 3.7 + stroke.rotation) * 0.4);
          const px = Math.cos(a) * r, py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.quadraticCurveTo(
            Math.cos(a - 0.3) * (r * 1.2),
            Math.sin(a - 0.3) * (r * 1.2),
            px, py
          );
        }
        ctx.closePath();
        ctx.fill();
        // Satellite droplet
        ctx.beginPath();
        ctx.arc(stroke.radius * 0.7, -stroke.radius * 0.5, stroke.radius * 0.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'streak': {
        ctx.beginPath();
        ctx.ellipse(0, 0, stroke.radius, stroke.radius * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'drip': {
        ctx.beginPath();
        ctx.moveTo(0, -stroke.radius * 0.5);
        ctx.quadraticCurveTo(stroke.radius * 0.3, 0, 0, stroke.radius);
        ctx.quadraticCurveTo(-stroke.radius * 0.3, 0, 0, -stroke.radius * 0.5);
        ctx.fill();
        break;
      }
      case 'spray': {
        for (let i = 0; i < 5; i++) {
          const sx = (pRand() - 0.5) * stroke.radius * 2;
          const sy = (pRand() - 0.5) * stroke.radius * 2;
          ctx.beginPath();
          ctx.arc(sx, sy, 1 + pRand() * 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'burst': {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, stroke.radius, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
    }

    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** Fade non-permanent strokes */
export function updatePaint(canvas: PaintCanvas, dt: number): void {
  for (let i = canvas.strokes.length - 1; i >= 0; i--) {
    const s = canvas.strokes[i];
    s.age += dt;
    if (!s.permanent) {
      s.opacity -= s.fadeRate * dt;
      if (s.opacity <= 0) canvas.strokes.splice(i, 1);
    }
  }
}

// ============================================================================
// SPOTIFY BPM HOOK
// ============================================================================

/**
 * Fetch current track's BPM from Spotify Web API.
 * Requires user auth token (from Spotify OAuth).
 * Returns BPM number or null.
 *
 * Flow:
 * 1. User connects Spotify in settings
 * 2. Game calls getCurrentBPM() every ~5 seconds
 * 3. If BPM changed (new song) → setBPM(clock, newBpm)
 * 4. Entire game tempo adjusts
 */
export async function getCurrentBPM(accessToken: string): Promise<number | null> {
  try {
    // Get currently playing track
    const playerResp = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!playerResp.ok) return null;
    const playerData = await playerResp.json();
    const trackId = playerData?.item?.id;
    if (!trackId) return null;

    // Get audio features (contains BPM)
    const featuresResp = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!featuresResp.ok) return null;
    const features = await featuresResp.json();

    return features?.tempo || null; // tempo = BPM
  } catch {
    return null;
  }
}

/**
 * Poll Spotify for BPM changes. Call in game loop every 5 seconds.
 */
export function createSpotifyPoller(
  accessToken: string,
  clock: RhythmClock,
  onBpmChange?: (newBpm: number) => void,
): { start: () => void; stop: () => void } {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let lastBpm = clock.bpm;

  const poll = async () => {
    const bpm = await getCurrentBPM(accessToken);
    if (bpm && Math.abs(bpm - lastBpm) > 2) {
      lastBpm = bpm;
      setBPM(clock, bpm);
      if (onBpmChange) onBpmChange(bpm);
    }
  };

  return {
    start: () => { intervalId = setInterval(poll, 5000); poll(); },
    stop: () => { if (intervalId) clearInterval(intervalId); },
  };
}

/**
 * Manual BPM entry (if no Spotify).
 * Common BPM ranges:
 *  60-80  = slow (chill, atmospheric)
 *  80-100 = moderate (hip-hop, R&B)
 *  100-120 = upbeat (pop, dance)
 *  120-140 = fast (EDM, rock)
 *  140-180 = intense (drum & bass, metal)
 */
export function manualBPM(clock: RhythmClock, bpm: number): void {
  setBPM(clock, Math.max(40, Math.min(220, bpm)));
}
