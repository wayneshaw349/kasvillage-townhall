// ============================================================================
// KasVillage Game Juice — The Feel Layer
// Everything that makes the game FEEL good:
// Paint splats, sound effects, haptics, combo popups, death animations,
// screen shake, hit-stop frames, particle bursts
//
// Drop-in module: call juiceTick() after game tick, juiceRender() during draw
// ============================================================================

import {
  PaintCanvas,
  PaintStroke,
  createPaintCanvas,
  paintFootstep,
  paintJump,
  paintLand,
  paintComboHit,
  paintEnemyDeath,
  paintDodge,
  paintBlock,
  paintBeatPulse,
  paintMovementTrail,
  renderPaint,
  updatePaint,
} from './kasvillage_game_input_paint';

import type { GameState, ComboResult, EnemyAI } from './kasvillage_game_v1';
import type { CameraState } from './kasvillage_camera_system';
import { triggerCamera } from './kasvillage_camera_system';
import type { DragPadState } from './kasvillage_touch_input';
import type { BeatSyncState } from './kasvillage_spotify_sync';

// ============================================================================
// HAPTICS — iOS Taptic Engine via expo-haptics
// ============================================================================

let Haptics: any = null;
try {
  Haptics = require('expo-haptics');
} catch { /* not available */ }

function hapticLight(): void   { Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Light); }
function hapticMedium(): void  { Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium); }
function hapticHeavy(): void   { Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Heavy); }
function hapticSuccess(): void { Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Success); }
function hapticError(): void   { Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Error); }
function hapticWarning(): void { Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Warning); }

// ============================================================================
// SOUND ENGINE — Web Audio API synthesis (no audio files needed)
// ============================================================================

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)(); }
    catch { return null; }
  }
  return audioCtx;
}

interface SoundDef {
  freq: number;
  type: OscillatorType;
  duration: number;
  gain: number;
  slide?: number;      // frequency slide (Hz per second)
  filterFreq?: number; // low-pass filter cutoff
  noise?: boolean;     // mix in noise
  delay?: number;      // delay before start
}

function playSound(def: SoundDef): void {
  const ctx = getAudioCtx();
  if (!ctx) return;

  const now = ctx.currentTime + (def.delay || 0);
  const end = now + def.duration;

  // Gain envelope
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(def.gain, now);
  gain.gain.exponentialRampToValueAtTime(0.001, end);
  gain.connect(ctx.destination);

  // Optional filter
  let output: AudioNode = gain;
  if (def.filterFreq) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(def.filterFreq, now);
    filter.frequency.exponentialRampToValueAtTime(100, end);
    filter.connect(gain);
    output = filter;
  }

  // Oscillator
  const osc = ctx.createOscillator();
  osc.type = def.type;
  osc.frequency.setValueAtTime(def.freq, now);
  if (def.slide) {
    osc.frequency.linearRampToValueAtTime(def.freq + def.slide * def.duration, end);
  }
  osc.connect(output);
  osc.start(now);
  osc.stop(end);

  // Noise layer
  if (def.noise) {
    const bufferSize = ctx.sampleRate * def.duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(def.gain * 0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, end);
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(end);
  }
}

// Sound presets
const SOUNDS = {
  hitLight: () => playSound({ freq: 800, type: 'square', duration: 0.06, gain: 0.15, slide: -2000, noise: true }),
  hitMedium: () => playSound({ freq: 600, type: 'square', duration: 0.08, gain: 0.2, slide: -1500, noise: true }),
  hitHeavy: () => playSound({ freq: 400, type: 'sawtooth', duration: 0.12, gain: 0.25, slide: -1000, noise: true, filterFreq: 2000 }),
  hitPerfect: () => {
    playSound({ freq: 1200, type: 'sine', duration: 0.15, gain: 0.2, slide: 400 });
    playSound({ freq: 1800, type: 'sine', duration: 0.1, gain: 0.1, delay: 0.05 });
  },
  comboBreak: () => playSound({ freq: 200, type: 'sawtooth', duration: 0.25, gain: 0.2, slide: -300, filterFreq: 800, noise: true }),
  block: () => playSound({ freq: 300, type: 'triangle', duration: 0.1, gain: 0.15, noise: true }),
  dodge: () => playSound({ freq: 500, type: 'sine', duration: 0.08, gain: 0.1, slide: 800 }),
  jump: () => playSound({ freq: 400, type: 'sine', duration: 0.12, gain: 0.12, slide: 600 }),
  land: () => playSound({ freq: 150, type: 'square', duration: 0.1, gain: 0.15, noise: true }),
  enemyDeath: () => {
    playSound({ freq: 300, type: 'sawtooth', duration: 0.3, gain: 0.2, slide: -500, filterFreq: 1500, noise: true });
    playSound({ freq: 100, type: 'square', duration: 0.15, gain: 0.15, delay: 0.1 });
  },
  bossDeath: () => {
    playSound({ freq: 200, type: 'sawtooth', duration: 0.5, gain: 0.3, slide: -400, filterFreq: 2000, noise: true });
    playSound({ freq: 80, type: 'square', duration: 0.3, gain: 0.2, delay: 0.15 });
    playSound({ freq: 1600, type: 'sine', duration: 0.4, gain: 0.15, delay: 0.2, slide: 800 });
  },
  bossEntrance: () => {
    playSound({ freq: 80, type: 'sawtooth', duration: 0.6, gain: 0.2, slide: 50, filterFreq: 400 });
    playSound({ freq: 120, type: 'square', duration: 0.4, gain: 0.15, delay: 0.3 });
  },
  beatTick: () => playSound({ freq: 1000, type: 'sine', duration: 0.02, gain: 0.03 }),
  victory: () => {
    playSound({ freq: 523, type: 'sine', duration: 0.2, gain: 0.2 }); // C5
    playSound({ freq: 659, type: 'sine', duration: 0.2, gain: 0.2, delay: 0.15 }); // E5
    playSound({ freq: 784, type: 'sine', duration: 0.3, gain: 0.25, delay: 0.3 }); // G5
    playSound({ freq: 1047, type: 'sine', duration: 0.5, gain: 0.2, delay: 0.5 }); // C6
  },
  gameOver: () => {
    playSound({ freq: 400, type: 'sawtooth', duration: 0.3, gain: 0.2, slide: -200 });
    playSound({ freq: 200, type: 'sawtooth', duration: 0.5, gain: 0.15, delay: 0.2, slide: -150, filterFreq: 500 });
  },
};

// ============================================================================
// COMBO TEXT POPUPS
// ============================================================================

interface ComboPopup {
  text: string;
  x: number;
  y: number;
  vy: number;       // float upward
  scale: number;    // starts big, settles
  targetScale: number;
  opacity: number;
  color: string;
  age: number;
  maxAge: number;
  /** Pulse multiplier — throbs on creation */
  pulse: number;
}

// ============================================================================
// DEATH ANIMATION
// ============================================================================

interface DeathAnim {
  x: number;
  y: number;
  color: string;
  type: 'npc' | 'mini_boss' | 'boss';
  age: number;
  maxAge: number;
  /** Exploding fragments */
  fragments: Array<{
    x: number; y: number;
    vx: number; vy: number;
    size: number;
    color: string;
    rotation: number;
    rotSpeed: number;
  }>;
  /** Flash radius (expands then fades) */
  flashRadius: number;
  /** Screen-wide flash alpha */
  screenFlash: number;
}

// ============================================================================
// HIT-STOP
// ============================================================================

interface HitStop {
  active: boolean;
  remaining: number; // seconds
  /** Zoom in slightly during hit-stop */
  zoomScale: number;
}

// ============================================================================
// SCREEN SHAKE (stacks with camera shake)
// ============================================================================

interface ScreenShake {
  intensity: number;
  duration: number;
  timer: number;
  offsetX: number;
  offsetY: number;
  /** Trauma-based: higher = more violent (0–1) */
  trauma: number;
}

// ============================================================================
// JUICE STATE
// ============================================================================

export interface JuiceState {
  paint: PaintCanvas;
  popups: ComboPopup[];
  deaths: DeathAnim[];
  hitStop: HitStop;
  shake: ScreenShake;

  // Edge detection — previous frame state
  _prevComboChain: number;
  _prevComboActive: boolean;
  _prevPlayerHp: number;
  _prevPlayerGrounded: boolean;
  _prevPlayerBlocking: boolean;
  _prevPlayerDodging: boolean;
  _prevPlayerJumping: boolean;
  _prevEnemyIds: Set<string>;
  _prevGameOver: boolean;
  _prevVictory: boolean;
  _prevBossEntered: boolean;

  /** Sound enabled */
  soundEnabled: boolean;
  /** Haptics enabled */
  hapticsEnabled: boolean;
}

// ============================================================================
// CREATE
// ============================================================================

export function createJuice(avatarColors: string[]): JuiceState {
  return {
    paint: createPaintCanvas(avatarColors),
    popups: [],
    deaths: [],
    hitStop: { active: false, remaining: 0, zoomScale: 1 },
    shake: { intensity: 0, duration: 0, timer: 0, offsetX: 0, offsetY: 0, trauma: 0 },

    _prevComboChain: 0,
    _prevComboActive: false,
    _prevPlayerHp: 100,
    _prevPlayerGrounded: true,
    _prevPlayerBlocking: false,
    _prevPlayerDodging: false,
    _prevPlayerJumping: false,
    _prevEnemyIds: new Set(),
    _prevGameOver: false,
    _prevVictory: false,
    _prevBossEntered: false,

    soundEnabled: true,
    hapticsEnabled: true,
  };
}

// ============================================================================
// TRIGGER HELPERS
// ============================================================================

function addPopup(juice: JuiceState, text: string, x: number, y: number, color: string, scale: number): void {
  juice.popups.push({
    text, x, y: y - 20,
    vy: -80, scale: scale * 1.8, targetScale: scale,
    opacity: 1, color, age: 0, maxAge: 1.2, pulse: 1,
  });
}

function addShake(juice: JuiceState, trauma: number): void {
  juice.shake.trauma = Math.min(1, juice.shake.trauma + trauma);
}

function addHitStop(juice: JuiceState, duration: number): void {
  juice.hitStop.active = true;
  juice.hitStop.remaining = duration;
  juice.hitStop.zoomScale = 1.02;
}

function spawnDeathAnim(juice: JuiceState, enemy: EnemyAI): void {
  const fragCount = enemy.type === 'boss' ? 30 : enemy.type === 'mini_boss' ? 20 : 12;
  const fragments: DeathAnim['fragments'] = [];

  for (let i = 0; i < fragCount; i++) {
    const angle = (i / fragCount) * Math.PI * 2 + Math.random() * 0.5;
    const speed = 80 + Math.random() * 200;
    fragments.push({
      x: enemy.x, y: enemy.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 100, // upward bias
      size: 3 + Math.random() * (enemy.type === 'boss' ? 12 : 6),
      color: Math.random() > 0.5 ? enemy.color : '#FFFFFF',
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 15,
    });
  }

  juice.deaths.push({
    x: enemy.x, y: enemy.y,
    color: enemy.color,
    type: enemy.type,
    age: 0,
    maxAge: enemy.type === 'boss' ? 2.0 : enemy.type === 'mini_boss' ? 1.5 : 0.8,
    fragments,
    flashRadius: 0,
    screenFlash: enemy.type === 'boss' ? 0.6 : enemy.type === 'mini_boss' ? 0.3 : 0.15,
  });
}

// ============================================================================
// TICK — call every frame after game tick, detects events and triggers juice
// ============================================================================

export function juiceTick(
  juice: JuiceState,
  state: GameState,
  camera: CameraState,
  input: DragPadState,
  sync: BeatSyncState,
  dt: number,
): number {
  // Hit-stop: freeze game time
  if (juice.hitStop.active) {
    juice.hitStop.remaining -= dt;
    if (juice.hitStop.remaining <= 0) {
      juice.hitStop.active = false;
      juice.hitStop.zoomScale = 1;
    }
    // Return 0 dt to freeze game
    // (caller should use this return value as effective dt)
    return 0;
  }

  const { combo } = state;

  // ── COMBO HIT ──
  if (input.lastComboResult && !input.comboResultConsumed) {
    const r = input.lastComboResult;
    if (r.accepted) {
      // Find nearest enemy for paint position
      let hitX = state.playerX + 40;
      let hitY = state.playerY - 20;
      const nearest = findNearest(state);
      if (nearest) { hitX = nearest.x; hitY = nearest.y - 20; }

      // Paint splat
      paintComboHit(juice.paint, hitX, hitY, r, nearest?.color || '#FF4444');

      // Sound — escalates with chain
      if (r.perfect) {
        SOUNDS.hitPerfect();
        addPopup(juice, 'PERFECT', hitX, hitY, '#FFD700', 1.4);
        addHitStop(juice, 0.06);
        addShake(juice, 0.3);
        if (juice.hapticsEnabled) hapticHeavy();
      } else if (r.accuracy > 0.7) {
        SOUNDS.hitMedium();
        addPopup(juice, 'GOOD', hitX, hitY, '#44FF88', 1.0);
        addHitStop(juice, 0.03);
        addShake(juice, 0.15);
        if (juice.hapticsEnabled) hapticMedium();
      } else {
        SOUNDS.hitLight();
        addShake(juice, 0.08);
        if (juice.hapticsEnabled) hapticLight();
      }

      // Chain milestone popups
      if (combo.chainLength === 10) addPopup(juice, '10 CHAIN!', hitX, hitY - 30, '#FF8800', 1.6);
      if (combo.chainLength === 20) addPopup(juice, '20 CHAIN!!', hitX, hitY - 30, '#FFD700', 2.0);
      if (combo.chainLength === 30) addPopup(juice, '30 CHAIN!!!', hitX, hitY - 30, '#FF00FF', 2.4);
      if (combo.chainLength === 50) addPopup(juice, 'UNSTOPPABLE', hitX, hitY - 30, '#FFFFFF', 3.0);

      // Multiplier popup
      if (r.multiplier >= 2) {
        addPopup(juice, `×${r.multiplier.toFixed(1)}`, hitX + 30, hitY, '#CCCCCC', 0.8);
      }
    }
  }

  // ── COMBO BREAK ──
  if (juice._prevComboActive && !combo.comboActive && juice._prevComboChain > 3) {
    SOUNDS.comboBreak();
    addPopup(juice, 'BREAK', state.playerX, state.playerY - 40, '#FF4444', 1.2);
    addShake(juice, 0.25);
    if (juice.hapticsEnabled) hapticError();

    // Dark splat on break
    paintBlock(juice.paint, state.playerX, state.playerY);
  }

  // ── BLOCK ──
  if (state.playerBlocking && !juice._prevPlayerBlocking) {
    SOUNDS.block();
    paintBlock(juice.paint, state.playerX, state.playerY);
    if (juice.hapticsEnabled) hapticLight();
  }

  // ── DODGE ──
  if (state.playerDodging && !juice._prevPlayerDodging) {
    SOUNDS.dodge();
    paintDodge(juice.paint, state.playerX, state.playerY, state.playerDodgeDir === 'left' ? -1 : 1);
    if (juice.hapticsEnabled) hapticLight();
  }

  // ── JUMP ──
  if (state.playerJumping && !juice._prevPlayerJumping) {
    SOUNDS.jump();
    paintJump(juice.paint, state.playerX, state.playerY);
    if (juice.hapticsEnabled) hapticMedium();
  }

  // ── LAND ──
  if (state.playerGrounded && !juice._prevPlayerGrounded) {
    SOUNDS.land();
    const force = Math.abs(input.playerVY) / 14; // normalize
    paintLand(juice.paint, state.playerX, state.playerY, Math.min(1, force));
    addShake(juice, 0.1 * force);
    if (juice.hapticsEnabled) hapticMedium();
  }

  // ── PLAYER HIT (took damage) ──
  if (state.playerHp < juice._prevPlayerHp) {
    const dmg = juice._prevPlayerHp - state.playerHp;
    addPopup(juice, `-${dmg}`, state.playerX, state.playerY - 30, '#FF2222', 1.0);
    addShake(juice, 0.4);
    addHitStop(juice, 0.08);
    if (juice.hapticsEnabled) hapticHeavy();
  }

  // ── ENEMY DEATH ──
  const currentEnemyIds = new Set(state.activeEnemies.filter(e => e.state !== 'dead').map(e => e.id));
  for (const prevId of juice._prevEnemyIds) {
    if (!currentEnemyIds.has(prevId)) {
      // Find the dead enemy data (might still be in the array as 'dead')
      const deadEnemy = state.activeEnemies.find(e => e.id === prevId) ||
        { x: state.playerX + 40, y: state.playerY, color: '#FF4444', type: 'npc' as const, scale: 1, name: '' };

      // Death animation
      spawnDeathAnim(juice, deadEnemy as EnemyAI);

      // Paint explosion
      paintEnemyDeath(juice.paint, deadEnemy.x, deadEnemy.y, deadEnemy.color, (deadEnemy as any).scale || 1);

      // Sound + haptics
      if ((deadEnemy as any).type === 'boss') {
        SOUNDS.bossDeath();
        addShake(juice, 0.8);
        addHitStop(juice, 0.2);
        addPopup(juice, 'ELIMINATED', deadEnemy.x, deadEnemy.y - 40, '#FFD700', 2.5);
        if (juice.hapticsEnabled) { hapticHeavy(); setTimeout(hapticHeavy, 100); setTimeout(hapticHeavy, 200); }
      } else if ((deadEnemy as any).type === 'mini_boss') {
        SOUNDS.enemyDeath();
        addShake(juice, 0.5);
        addHitStop(juice, 0.12);
        addPopup(juice, 'DEFEATED', deadEnemy.x, deadEnemy.y - 30, '#FF4444', 1.8);
        if (juice.hapticsEnabled) { hapticHeavy(); setTimeout(hapticMedium, 100); }
      } else {
        SOUNDS.enemyDeath();
        addShake(juice, 0.2);
        addHitStop(juice, 0.05);
        if (juice.hapticsEnabled) hapticMedium();
      }
    }
  }

  // ── BOSS ENTRANCE ──
  if (state._bossEnteredThisFrame && !juice._prevBossEntered) {
    SOUNDS.bossEntrance();
    addShake(juice, 0.6);
    if (juice.hapticsEnabled) { hapticHeavy(); setTimeout(hapticHeavy, 200); setTimeout(hapticHeavy, 400); }
  }

  // ── BEAT PULSE ──
  if (sync.onBeat) {
    paintBeatPulse(juice.paint, 400, 500);
    if (juice.soundEnabled) SOUNDS.beatTick();
  }

  // ── FOOTSTEPS + TRAIL ──
  if (state.playerGrounded && Math.abs(input.playerVX) > 20) {
    paintFootstep(juice.paint, state.playerX, state.playerY, Math.abs(input.playerVX) / 160);
    paintMovementTrail(juice.paint, state.playerX, state.playerY, input.playerVX * 0.01, 0);
  }

  // ── VICTORY ──
  if (state.victory && !juice._prevVictory) {
    SOUNDS.victory();
    if (juice.hapticsEnabled) hapticSuccess();
    addPopup(juice, 'VICTORY!', 200, 150, '#FFD700', 3.0);
  }

  // ── GAME OVER ──
  if (state.gameOver && !state.victory && !juice._prevGameOver) {
    SOUNDS.gameOver();
    if (juice.hapticsEnabled) hapticError();
    addShake(juice, 0.6);
  }

  // ── UPDATE SYSTEMS ──

  // Paint fade
  updatePaint(juice.paint, dt);

  // Popups
  for (let i = juice.popups.length - 1; i >= 0; i--) {
    const p = juice.popups[i];
    p.age += dt;
    p.y += p.vy * dt;
    p.vy *= 0.95; // decelerate
    p.scale += (p.targetScale - p.scale) * 8 * dt; // settle to target
    p.pulse = Math.max(1, p.pulse - dt * 4);
    if (p.age > p.maxAge * 0.6) {
      p.opacity -= dt * 3;
    }
    if (p.opacity <= 0 || p.age > p.maxAge) {
      juice.popups.splice(i, 1);
    }
  }

  // Death animations
  for (let i = juice.deaths.length - 1; i >= 0; i--) {
    const d = juice.deaths[i];
    d.age += dt;
    d.flashRadius += dt * 400;
    d.screenFlash = Math.max(0, d.screenFlash - dt * 2);

    for (const f of d.fragments) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 300 * dt; // gravity
      f.rotation += f.rotSpeed * dt;
      f.vx *= 0.98;
    }

    if (d.age > d.maxAge) {
      juice.deaths.splice(i, 1);
    }
  }

  // Screen shake (trauma-based)
  if (juice.shake.trauma > 0) {
    juice.shake.trauma = Math.max(0, juice.shake.trauma - dt * 2);
    const t = juice.shake.trauma;
    const maxOffset = t * t * 12; // quadratic falloff
    juice.shake.offsetX = (Math.random() * 2 - 1) * maxOffset;
    juice.shake.offsetY = (Math.random() * 2 - 1) * maxOffset;
  } else {
    juice.shake.offsetX = 0;
    juice.shake.offsetY = 0;
  }

  // ── SAVE PREV STATE ──
  juice._prevComboChain = combo.chainLength;
  juice._prevComboActive = combo.comboActive;
  juice._prevPlayerHp = state.playerHp;
  juice._prevPlayerGrounded = state.playerGrounded;
  juice._prevPlayerBlocking = state.playerBlocking;
  juice._prevPlayerDodging = state.playerDodging;
  juice._prevPlayerJumping = state.playerJumping;
  juice._prevEnemyIds = currentEnemyIds;
  juice._prevGameOver = state.gameOver;
  juice._prevVictory = state.victory;
  juice._prevBossEntered = state._bossEnteredThisFrame;

  return dt; // full dt (no hit-stop)
}

// ============================================================================
// RENDER — call during draw phase
// ============================================================================

/**
 * Render all juice effects. Call between board draw and HUD draw.
 * Returns the screen shake offset for the caller to apply to all rendering.
 */
export function juiceRender(
  ctx: CanvasRenderingContext2D,
  juice: JuiceState,
  scrollX: number,
  screenW: number,
  screenH: number,
): { shakeX: number; shakeY: number; zoomScale: number } {

  ctx.save();

  // ── PAINT LAYER (behind everything, scrolls with board) ──
  ctx.save();
  ctx.translate(-scrollX, 0);
  renderPaint(ctx, juice.paint);
  ctx.restore();

  // ── DEATH ANIMATIONS ──
  for (const d of juice.deaths) {
    const progress = d.age / d.maxAge;

    // Screen flash
    if (d.screenFlash > 0) {
      ctx.save();
      ctx.globalAlpha = d.screenFlash;
      ctx.fillStyle = d.color;
      ctx.fillRect(0, 0, screenW, screenH);
      ctx.restore();
    }

    // Flash circle at death point
    if (progress < 0.3) {
      ctx.save();
      const dx = d.x - scrollX;
      ctx.globalAlpha = (1 - progress / 0.3) * 0.5;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(dx, d.y, d.flashRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Fragments
    for (const f of d.fragments) {
      const fx = f.x - scrollX;
      if (fx < -20 || fx > screenW + 20) continue;
      ctx.save();
      ctx.translate(fx, f.y);
      ctx.rotate(f.rotation);
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.fillStyle = f.color;

      // Irregular fragment shape
      ctx.beginPath();
      ctx.moveTo(-f.size, -f.size * 0.6);
      ctx.lineTo(f.size * 0.8, -f.size * 0.3);
      ctx.lineTo(f.size * 0.5, f.size * 0.7);
      ctx.lineTo(-f.size * 0.6, f.size * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Shockwave ring (boss/mini-boss only)
    if (d.type !== 'npc' && progress < 0.5) {
      ctx.save();
      const dx = d.x - scrollX;
      const ringR = d.flashRadius * 1.5;
      ctx.globalAlpha = (1 - progress * 2) * 0.3;
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(dx, d.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── COMBO POPUPS ──
  for (const p of juice.popups) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.opacity);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const displayScale = p.scale * p.pulse;
    ctx.font = `bold ${Math.round(16 * displayScale)}px monospace`;

    // Shadow
    ctx.fillStyle = '#000000';
    ctx.fillText(p.text, p.x - scrollX + 1, p.y + 1);

    // Main text
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x - scrollX, p.y);

    // Glow for big popups
    if (displayScale > 1.5) {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 15;
      ctx.fillText(p.text, p.x - scrollX, p.y);
    }

    ctx.restore();
  }

  ctx.restore();

  // Return shake for caller
  return {
    shakeX: juice.shake.offsetX,
    shakeY: juice.shake.offsetY,
    zoomScale: juice.hitStop.zoomScale,
  };
}

// ============================================================================
// HELPER
// ============================================================================

function findNearest(state: GameState): EnemyAI | null {
  let best: EnemyAI | null = null;
  let dist = Infinity;
  for (const e of state.activeEnemies) {
    if (e.state === 'dead') continue;
    const d = Math.abs(e.x - state.playerX);
    if (d < dist) { dist = d; best = e; }
  }
  return best;
}

// ============================================================================
// GAME LOOP INTEGRATION PATCH
// ============================================================================

/**
 * Patch into kasvillage_game_loop.ts updatePlaying():
 *
 *   // After step 8 (player sprite), before step 9:
 *   const effectiveDt = juiceTick(juice, gameState, camera, input, sync, dt);
 *   // Use effectiveDt for hit-stop (0 during freeze)
 *
 *   // In render(), between board and HUD:
 *   const { shakeX, shakeY, zoomScale } = juiceRender(ctx, juice, board.scrollX, screenW, screenH);
 *   // Apply shakeX/shakeY to ctx.translate before rendering everything
 */

// ============================================================================
// EXPORTS
// ============================================================================
// createJuice(avatarColors)                — init
// juiceTick(juice, state, cam, input, sync, dt) — tick (returns effective dt)
// juiceRender(ctx, juice, scrollX, w, h)   — render (returns shake offset)
// ============================================================================
