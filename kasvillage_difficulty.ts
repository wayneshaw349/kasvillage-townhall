// ============================================================================
// KasVillage Difficulty System — Dual Clock Combat
//
// CORE CONCEPT:
//   Player attacks on the SONG'S beat (rock, EDM, whatever they're listening to)
//   Enemies attack on a COUNTER-RHYTHM (hip-hop BPM against rock, etc.)
//   Block must be timed to the ENEMY beat, not the player beat
//   You're reading TWO rhythms simultaneously
//
// This is what separates button mashers from players.
// ============================================================================

import type { RhythmClock } from './kasvillage_game_v1';
import type { BeatSyncState } from './kasvillage_spotify_sync';
import type { GameState, EnemyAI, ComboState } from './kasvillage_game_v1';

// ============================================================================
// COUNTER-RHYTHM GENRES — enemy BPM derived from song BPM
// ============================================================================

/**
 * Enemy rhythm genre. Each has a BPM relationship to the song.
 * The player's song genre is auto-detected from Spotify audio_features.
 */
export type EnemyRhythm =
  | 'hiphop'      // 80–100 BPM — slow, heavy, off-beat swings
  | 'rnb'         // 60–80 BPM  — smooth, delayed, syncopated
  | 'trap'        // 140–160 BPM — double-time hi-hats, half-time kicks
  | 'reggaeton'   // 90–100 BPM — dembow pattern, predictable but shifted
  | 'dnb'         // 170–180 BPM — breakneck, relentless
  | 'jazz'        // varies — swing feel, intentionally off-grid
  | 'metal'       // 130–180 BPM — blast beats, overwhelming
  | 'ambient'     // 60–70 BPM  — rare attacks, massive damage
  | 'dance'       // same BPM — synced but phase-shifted, four-on-the-floor
  | 'rock'        // 0.88x — driving eighth notes, slight swing
  | 'reggae';     // 0.5x — offbeat skank, everything lands on the "and"

/**
 * Pick enemy rhythm based on song's detected genre/BPM.
 * Maximizes the rhythmic clash — enemies always feel "wrong" against the song.
 */
export function pickEnemyRhythm(
  songBpm: number,
  songEnergy: number,    // 0–1 from Spotify audio_features
  songValence: number,   // 0–1 (happy vs dark)
  songDanceability: number,
): EnemyRhythm {
  // High energy song → slow heavy enemies (contrast)
  if (songBpm > 140 && songEnergy > 0.7) return 'rnb';
  // Slow song → fast relentless enemies (pressure)
  if (songBpm < 90 && songEnergy < 0.5) return 'dnb';
  // Mid-tempo danceable → syncopated enemies (off-beat confusion)
  if (songDanceability > 0.7 && songBpm > 95 && songBpm < 130) return 'reggaeton';
  // Dark/low valence → jazz (unpredictable)
  if (songValence < 0.3) return 'jazz';
  // Dance/EDM songs → reggae enemies (offbeat skank against four-on-the-floor)
  if (songDanceability > 0.8 && songEnergy > 0.7) return 'reggae';
  // Rock energy range → dance enemies (same BPM but phase-shifted)
  if (songBpm > 110 && songBpm < 145 && songEnergy > 0.5 && songEnergy < 0.8) return 'dance';
  // High tempo rock/metal → hip-hop (half-time feel)
  if (songBpm > 120 && songEnergy > 0.6) return 'hiphop';
  // Mid-energy with groove → rock enemies (driving but slightly off)
  if (songEnergy > 0.4 && songEnergy < 0.7 && songDanceability > 0.4) return 'rock';
  // Moderate energy → trap (double-time pressure)
  if (songEnergy > 0.5) return 'trap';
  // Calm song → ambient enemies (rare but deadly)
  if (songEnergy < 0.3) return 'ambient';
  // Default
  return 'hiphop';
}

// ============================================================================
// ENEMY CLOCK — the counter-rhythm
// ============================================================================

export interface EnemyClock {
  /** Enemy base BPM */
  bpm: number;
  /** Beat interval */
  beatInterval: number;
  /** Current beat timer */
  timer: number;
  /** Beat count */
  beatCount: number;
  /** On beat this frame */
  onBeat: boolean;
  /** Beat window for block timing */
  beatWindow: number;
  /** Last beat time */
  lastBeatTime: number;
  /** Swing amount (0 = straight, 0.3 = heavy swing) */
  swing: number;
  /** Whether next beat is swung */
  swungBeat: boolean;
  /** Rhythm type */
  rhythm: EnemyRhythm;
  /** Phase offset from song beat (0–1, creates the "wrong" feeling) */
  phaseOffset: number;
}

/**
 * Derive enemy BPM from song BPM based on rhythm genre.
 * The key: enemy BPM is RELATED but NOT ALIGNED to song BPM.
 */
function deriveEnemyBpm(songBpm: number, rhythm: EnemyRhythm): { bpm: number; swing: number; offset: number } {
  switch (rhythm) {
    case 'hiphop':
      // Half-time feel against uptempo songs
      return { bpm: songBpm * 0.66, swing: 0.15, offset: 0.25 };
    case 'rnb':
      // Slow and behind the beat
      return { bpm: songBpm * 0.5, swing: 0.2, offset: 0.33 };
    case 'trap':
      // Double-time hi-hats but attacks on half-time
      return { bpm: songBpm * 1.33, swing: 0.0, offset: 0.5 };
    case 'reggaeton':
      // Dembow — slightly offset, predictable pattern
      return { bpm: songBpm * 0.75, swing: 0.0, offset: 0.125 };
    case 'dnb':
      // Relentless — faster than song
      return { bpm: Math.max(170, songBpm * 1.5), swing: 0.0, offset: 0.1 };
    case 'jazz':
      // Swing feel, unpredictable offset
      return { bpm: songBpm * 0.85, swing: 0.33, offset: 0.42 };
    case 'metal':
      // Blast beat — overwhelming
      return { bpm: Math.max(160, songBpm * 1.4), swing: 0.0, offset: 0.15 };
    case 'ambient':
      // Very slow — but each hit is devastating
      return { bpm: songBpm * 0.33, swing: 0.0, offset: 0.5 };
    case 'dance':
      // Same BPM but phase-shifted — four-on-the-floor offset
      // Feels synced but attacks land between your beats
      return { bpm: songBpm, swing: 0.0, offset: 0.5 };
    case 'rock':
      // Driving eighth notes, slightly behind the beat
      return { bpm: songBpm * 0.88, swing: 0.08, offset: 0.18 };
    case 'reggae':
      // Offbeat skank — everything on the "and"
      // Half-time with heavy swing, max phase offset
      return { bpm: songBpm * 0.5, swing: 0.25, offset: 0.5 };
  }
}

export function createEnemyClock(songBpm: number, rhythm: EnemyRhythm): EnemyClock {
  const { bpm, swing, offset } = deriveEnemyBpm(songBpm, rhythm);
  const interval = 60 / bpm;

  return {
    bpm,
    beatInterval: interval,
    timer: interval * offset, // start offset from song
    beatCount: 0,
    onBeat: false,
    beatWindow: 0.2, // block window
    lastBeatTime: 0,
    swing,
    swungBeat: false,
    rhythm,
    phaseOffset: offset,
  };
}

/** Tick the enemy clock. Call every frame. */
export function tickEnemyClock(clock: EnemyClock, dt: number, gameTime: number): void {
  clock.onBeat = false;
  clock.timer += dt;

  // Swing: alternate beats are delayed
  const currentInterval = clock.swungBeat
    ? clock.beatInterval * (1 + clock.swing)
    : clock.beatInterval * (1 - clock.swing * 0.5);

  if (clock.timer >= currentInterval) {
    clock.timer -= currentInterval;
    clock.beatCount++;
    clock.onBeat = true;
    clock.lastBeatTime = gameTime;
    clock.swungBeat = !clock.swungBeat;
  }
}

/** Check if a block attempt is on the enemy beat */
export function isBlockOnBeat(clock: EnemyClock, gameTime: number): { onBeat: boolean; accuracy: number } {
  const timeSinceBeat = gameTime - clock.lastBeatTime;
  const timeToNext = clock.beatInterval - clock.timer;
  const closest = Math.min(Math.abs(timeSinceBeat), Math.abs(timeToNext));

  if (closest <= clock.beatWindow) {
    return { onBeat: true, accuracy: 1.0 - (closest / clock.beatWindow) };
  }
  return { onBeat: false, accuracy: 0 };
}

// ============================================================================
// GUARD METER — block costs stamina
// ============================================================================

export interface GuardMeter {
  /** Current guard stamina (0–100) */
  stamina: number;
  /** Max stamina */
  maxStamina: number;
  /** Regen rate per second (only when not blocking) */
  regenRate: number;
  /** Cost per block */
  blockCost: number;
  /** Is guard broken */
  broken: boolean;
  /** Stun timer when broken (seconds) */
  stunTimer: number;
  /** Stun duration */
  stunDuration: number;
  /** Perfect block bonus (regens stamina on perfect timing) */
  perfectBlockRegen: number;
}

export function createGuardMeter(): GuardMeter {
  return {
    stamina: 100,
    maxStamina: 100,
    regenRate: 15,  // 15/s — full regen in ~6.5s
    blockCost: 28,  // ~3.5 blocks before break
    broken: false,
    stunTimer: 0,
    stunDuration: 1.2,
    perfectBlockRegen: 20, // perfect block gives back stamina
  };
}

/** Attempt to block. Returns whether block succeeded. */
export function attemptBlock(
  guard: GuardMeter,
  enemyClock: EnemyClock,
  gameTime: number,
): { blocked: boolean; perfect: boolean; guardBroke: boolean } {
  if (guard.broken) {
    return { blocked: false, perfect: false, guardBroke: false };
  }

  // Check if block is on enemy beat
  const { onBeat, accuracy } = isBlockOnBeat(enemyClock, gameTime);

  if (!onBeat) {
    // Off-beat block — costs MORE stamina, weaker block
    guard.stamina -= guard.blockCost * 1.5;
  } else if (accuracy > 0.8) {
    // Perfect block — GAIN stamina
    guard.stamina = Math.min(guard.maxStamina, guard.stamina + guard.perfectBlockRegen);
    return { blocked: true, perfect: true, guardBroke: false };
  } else {
    // On-beat block — normal cost
    guard.stamina -= guard.blockCost;
  }

  // Check break
  if (guard.stamina <= 0) {
    guard.stamina = 0;
    guard.broken = true;
    guard.stunTimer = guard.stunDuration;
    return { blocked: false, perfect: false, guardBroke: true };
  }

  return { blocked: onBeat, perfect: false, guardBroke: false };
}

/** Update guard meter. Call every frame. */
export function updateGuard(guard: GuardMeter, isBlocking: boolean, dt: number): void {
  // Stun recovery
  if (guard.broken) {
    guard.stunTimer -= dt;
    if (guard.stunTimer <= 0) {
      guard.broken = false;
      guard.stamina = guard.maxStamina * 0.3; // partial recovery
    }
    return;
  }

  // Regen when not blocking
  if (!isBlocking && guard.stamina < guard.maxStamina) {
    guard.stamina = Math.min(guard.maxStamina, guard.stamina + guard.regenRate * dt);
  }
}

// ============================================================================
// PASSIVITY PUNISHMENT — idle too long = enemies power up
// ============================================================================

export interface PassivityTracker {
  /** Seconds since last player attack */
  timeSinceAttack: number;
  /** Threshold before punishment kicks in (seconds) */
  threshold: number;
  /** Current aggression buff multiplier (1.0 = normal) */
  aggressionBuff: number;
  /** Whether passivity punishment is active */
  active: boolean;
  /** Escalation level (1, 2, 3) */
  level: number;
}

export function createPassivityTracker(): PassivityTracker {
  return {
    timeSinceAttack: 0,
    threshold: 3.0, // 3 seconds
    aggressionBuff: 1.0,
    active: false,
    level: 0,
  };
}

export function updatePassivity(tracker: PassivityTracker, attacked: boolean, dt: number): void {
  if (attacked) {
    tracker.timeSinceAttack = 0;
    tracker.active = false;
    tracker.level = 0;
    tracker.aggressionBuff = 1.0;
    return;
  }

  tracker.timeSinceAttack += dt;

  if (tracker.timeSinceAttack >= tracker.threshold) {
    tracker.active = true;
    // Escalating levels
    const overtime = tracker.timeSinceAttack - tracker.threshold;
    if (overtime > 6) {
      tracker.level = 3;      // 9+ seconds idle
      tracker.aggressionBuff = 2.5; // enemies nearly unstoppable
    } else if (overtime > 3) {
      tracker.level = 2;      // 6+ seconds idle
      tracker.aggressionBuff = 1.8; // enemies flanking, unblockable grabs
    } else {
      tracker.level = 1;      // 3+ seconds idle
      tracker.aggressionBuff = 1.3; // enemies faster, more aggressive
    }
  }
}

// ============================================================================
// COMBO DECAY PUNISHMENT — dropping a chain has consequences
// ============================================================================

export interface ComboDecay {
  /** Is decay active (chain was dropped) */
  active: boolean;
  /** Timer remaining */
  timer: number;
  /** Duration of punishment */
  duration: number;
  /** Chain length that was dropped */
  droppedChain: number;
  /** Beat window tightening during decay (multiplier, < 1.0) */
  windowMultiplier: number;
  /** Enemy heal amount when chain drops */
  enemyHealPercent: number;
  /** Screen dim amount */
  dimAmount: number;
}

export function createComboDecay(): ComboDecay {
  return {
    active: false,
    timer: 0,
    duration: 5.0,
    droppedChain: 0,
    windowMultiplier: 1.0,
    enemyHealPercent: 0,
    dimAmount: 0,
  };
}

/** Trigger decay when a combo chain breaks */
export function triggerComboDecay(decay: ComboDecay, droppedChain: number): void {
  if (droppedChain < 5) return; // don't punish small chains

  decay.active = true;
  decay.droppedChain = droppedChain;
  decay.timer = decay.duration;

  // Scaling punishment based on how big the dropped chain was
  if (droppedChain >= 20) {
    decay.windowMultiplier = 0.6;  // 40% tighter window
    decay.enemyHealPercent = 15;
    decay.dimAmount = 0.3;
  } else if (droppedChain >= 10) {
    decay.windowMultiplier = 0.75;
    decay.enemyHealPercent = 10;
    decay.dimAmount = 0.2;
  } else {
    decay.windowMultiplier = 0.85;
    decay.enemyHealPercent = 5;
    decay.dimAmount = 0.1;
  }
}

export function updateComboDecay(decay: ComboDecay, dt: number): void {
  if (!decay.active) return;
  decay.timer -= dt;
  if (decay.timer <= 0) {
    decay.active = false;
    decay.windowMultiplier = 1.0;
    decay.dimAmount = 0;
  } else {
    // Gradually ease back to normal
    const progress = 1 - (decay.timer / decay.duration);
    decay.windowMultiplier = decay.windowMultiplier + (1 - decay.windowMultiplier) * progress;
    decay.dimAmount *= (1 - progress);
  }
}

// ============================================================================
// BOSS PHASES — 3-phase boss fight synced to song structure
// ============================================================================

export type BossPhase = 1 | 2 | 3;

export interface BossState {
  /** Current phase */
  phase: BossPhase;
  /** HP thresholds for phase transitions (% of max) */
  phaseThresholds: [number, number]; // [phase2at, phase3at] e.g. [0.66, 0.33]
  /** Current pattern in this phase */
  patternIndex: number;
  /** Phase transition animation timer */
  transitionTimer: number;
  /** Is in transition (invulnerable) */
  inTransition: boolean;
  /** Phase-specific attack speed multiplier */
  speedMultiplier: number;
  /** Phase-specific block requirement */
  requiresPerfectBlock: boolean;
  /** Has unblockable attack in rotation */
  hasUnblockable: boolean;
  /** Unblockable telegraph time (seconds) */
  unblockableTelegraph: number;
}

export function createBossState(): BossState {
  return {
    phase: 1,
    phaseThresholds: [0.66, 0.33],
    patternIndex: 0,
    transitionTimer: 0,
    inTransition: false,
    speedMultiplier: 1.0,
    requiresPerfectBlock: false,
    hasUnblockable: false,
    unblockableTelegraph: 1.5,
  };
}

/**
 * Update boss phase based on HP.
 *
 * Phase 1 (100%–66%): Standard attacks, learnable pattern, attacks on enemy beat
 * Phase 2 (66%–33%): Faster, adds unblockable sweeps (must dodge), tighter windows
 * Phase 3 (<33%): Relentless, requires perfect blocks, one-shot grab if passive
 */
export function updateBossPhase(boss: BossState, hpPercent: number): boolean {
  let phaseChanged = false;

  if (boss.phase === 1 && hpPercent <= boss.phaseThresholds[0]) {
    boss.phase = 2;
    boss.inTransition = true;
    boss.transitionTimer = 2.0;
    boss.speedMultiplier = 1.4;
    boss.hasUnblockable = true;
    boss.unblockableTelegraph = 1.2;
    boss.patternIndex = 0;
    phaseChanged = true;
  }

  if (boss.phase === 2 && hpPercent <= boss.phaseThresholds[1]) {
    boss.phase = 3;
    boss.inTransition = true;
    boss.transitionTimer = 2.5;
    boss.speedMultiplier = 1.8;
    boss.requiresPerfectBlock = true;
    boss.hasUnblockable = true;
    boss.unblockableTelegraph = 0.8;
    boss.patternIndex = 0;
    phaseChanged = true;
  }

  // Transition timer
  if (boss.inTransition) {
    boss.transitionTimer -= 1 / 60; // approximate
    if (boss.transitionTimer <= 0) {
      boss.inTransition = false;
    }
  }

  return phaseChanged;
}

/**
 * Get boss attack pattern for current phase.
 * Returns sequence of attack types tied to enemy beat count.
 */
export function getBossPattern(boss: BossState): Array<{
  beatOffset: number;
  type: 'strike' | 'combo' | 'unblockable' | 'grab';
  damage: number;
  telegraph: number; // seconds warning before attack
}> {
  switch (boss.phase) {
    case 1:
      return [
        { beatOffset: 0, type: 'strike',  damage: 12, telegraph: 1.0 },
        { beatOffset: 2, type: 'strike',  damage: 12, telegraph: 1.0 },
        { beatOffset: 4, type: 'combo',   damage: 18, telegraph: 0.8 },
        // 4 beats rest
      ];
    case 2:
      return [
        { beatOffset: 0, type: 'strike',      damage: 15, telegraph: 0.8 },
        { beatOffset: 1, type: 'strike',      damage: 15, telegraph: 0.8 },
        { beatOffset: 3, type: 'unblockable', damage: 25, telegraph: 1.2 },
        { beatOffset: 5, type: 'combo',       damage: 20, telegraph: 0.6 },
        // 2 beats rest
      ];
    case 3:
      return [
        { beatOffset: 0, type: 'strike',      damage: 18, telegraph: 0.6 },
        { beatOffset: 1, type: 'combo',       damage: 22, telegraph: 0.5 },
        { beatOffset: 2, type: 'strike',      damage: 18, telegraph: 0.6 },
        { beatOffset: 3, type: 'unblockable', damage: 30, telegraph: 0.8 },
        { beatOffset: 5, type: 'grab',        damage: 40, telegraph: 1.0 }, // one-shot if passive
        // 1 beat rest
      ];
  }
}

// ============================================================================
// PERFECT TIMING DAMAGE MULTIPLIER
// ============================================================================

/**
 * Calculate damage multiplier based on timing accuracy.
 * Perfect timing = 3x damage. Makes skill ceiling visible.
 */
export function getTimingDamageMultiplier(accuracy: number, perfect: boolean): number {
  if (perfect) return 3.0;
  if (accuracy > 0.8) return 2.0;
  if (accuracy > 0.5) return 1.5;
  return 1.0;
}

// ============================================================================
// DIFFICULTY STATE — combines all systems
// ============================================================================

export interface DifficultyState {
  enemyClock: EnemyClock;
  guard: GuardMeter;
  passivity: PassivityTracker;
  comboDecay: ComboDecay;
  bossState: BossState;
  /** Effective beat window (player clock × decay modifier) */
  effectiveBeatWindow: number;
  /** Base beat window from settings */
  baseBeatWindow: number;
  /** Difficulty preset name */
  preset: 'easy' | 'normal' | 'hard';
}

export function createDifficulty(
  songBpm: number,
  songEnergy: number,
  songValence: number,
  songDanceability: number,
  preset: 'easy' | 'normal' | 'hard' = 'normal',
): DifficultyState {
  const rhythm = pickEnemyRhythm(songBpm, songEnergy, songValence, songDanceability);
  const enemyClock = createEnemyClock(songBpm, rhythm);

  // Preset adjustments
  const windows: Record<string, number> = { easy: 0.25, normal: 0.2, hard: 0.12 };
  const baseWindow = windows[preset];
  enemyClock.beatWindow = baseWindow + 0.05; // block window slightly wider than attack

  const guard = createGuardMeter();
  if (preset === 'easy') {
    guard.blockCost = 20;     // more blocks before break
    guard.regenRate = 25;     // faster regen
    guard.stunDuration = 0.8; // shorter stun
  } else if (preset === 'hard') {
    guard.blockCost = 35;     // fewer blocks
    guard.regenRate = 10;     // slower regen
    guard.stunDuration = 1.5; // longer stun
  }

  return {
    enemyClock,
    guard,
    passivity: createPassivityTracker(),
    comboDecay: createComboDecay(),
    bossState: createBossState(),
    effectiveBeatWindow: baseWindow,
    baseBeatWindow: baseWindow,
    preset,
  };
}

// ============================================================================
// TICK — call every frame
// ============================================================================

export function tickDifficulty(
  diff: DifficultyState,
  state: GameState,
  playerAttackedThisFrame: boolean,
  playerBlockingThisFrame: boolean,
  comboBroke: boolean,
  droppedChainLength: number,
  dt: number,
): void {
  // Enemy clock
  tickEnemyClock(diff.enemyClock, dt, state.gameTime);

  // Guard meter
  updateGuard(diff.guard, playerBlockingThisFrame, dt);

  // Passivity
  updatePassivity(diff.passivity, playerAttackedThisFrame, dt);

  // Combo decay
  if (comboBroke && droppedChainLength >= 5) {
    triggerComboDecay(diff.comboDecay, droppedChainLength);

    // Heal enemies on chain drop
    for (const enemy of state.activeEnemies) {
      if (enemy.state !== 'dead') {
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * (diff.comboDecay.enemyHealPercent / 100));
      }
    }
  }
  updateComboDecay(diff.comboDecay, dt);

  // Effective beat window (combo decay tightens it)
  diff.effectiveBeatWindow = diff.baseBeatWindow * diff.comboDecay.windowMultiplier;

  // Boss phase check
  for (const enemy of state.activeEnemies) {
    if (enemy.type === 'boss' && enemy.state !== 'dead') {
      const hpPercent = enemy.hp / enemy.maxHp;
      updateBossPhase(diff.bossState, hpPercent);
    }
  }
}

// ============================================================================
// RENDER — HUD elements for difficulty systems
// ============================================================================

/** Draw guard meter (below player health bar) */
export function drawGuardMeter(
  ctx: CanvasRenderingContext2D,
  guard: GuardMeter,
  x: number,
  y: number,
  width: number,
): void {
  const barH = 6;
  const ratio = guard.stamina / guard.maxStamina;

  ctx.save();

  // BG
  ctx.fillStyle = '#1A1A2E';
  ctx.fillRect(x, y, width, barH);

  // Stamina
  ctx.fillStyle = guard.broken ? '#FF2222'
    : ratio > 0.5 ? '#4488FF'
    : ratio > 0.25 ? '#FF8800'
    : '#FF4444';
  ctx.fillRect(x, y, width * ratio, barH);

  // BROKEN text
  if (guard.broken) {
    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = '#FF0000';
    ctx.textAlign = 'center';
    ctx.fillText('GUARD BROKEN', x + width / 2, y - 2);
  }

  ctx.restore();
}

/** Draw enemy beat indicator (so player can learn the enemy rhythm) */
export function drawEnemyBeatIndicator(
  ctx: CanvasRenderingContext2D,
  clock: EnemyClock,
  screenW: number,
): void {
  const y = 12;
  const pulseAlpha = clock.onBeat ? 0.8 : 0.15;

  ctx.save();
  ctx.globalAlpha = pulseAlpha;

  // Red pulse bar (enemy rhythm)
  ctx.fillStyle = '#FF2222';
  ctx.fillRect(0, y, screenW, 2);

  // Beat progress dot
  const progress = clock.timer / clock.beatInterval;
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#FF4444';
  ctx.beginPath();
  ctx.arc(screenW * progress, y + 1, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Draw combo decay overlay (screen dims when chain drops) */
export function drawComboDecayOverlay(
  ctx: CanvasRenderingContext2D,
  decay: ComboDecay,
  screenW: number,
  screenH: number,
): void {
  if (!decay.active || decay.dimAmount <= 0) return;

  ctx.save();
  ctx.globalAlpha = decay.dimAmount;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, screenW, screenH);

  // "CHAIN LOST" text
  if (decay.timer > decay.duration - 1) {
    ctx.globalAlpha = Math.min(1, (decay.duration - decay.timer + 1) * 2);
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#FF2222';
    ctx.textAlign = 'center';
    ctx.fillText(`-${decay.droppedChain} CHAIN`, screenW / 2, screenH * 0.4);
  }

  ctx.restore();
}

/** Draw passivity warning */
export function drawPassivityWarning(
  ctx: CanvasRenderingContext2D,
  tracker: PassivityTracker,
  screenW: number,
  screenH: number,
): void {
  if (!tracker.active) return;

  ctx.save();

  // Pulsing red border — intensity scales with level
  const pulse = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
  const alpha = 0.1 + tracker.level * 0.1 + pulse * 0.1;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#FF0000';
  ctx.lineWidth = tracker.level * 2;
  ctx.strokeRect(0, 0, screenW, screenH);

  // Warning text at level 2+
  if (tracker.level >= 2) {
    ctx.globalAlpha = 0.6;
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#FF4444';
    ctx.textAlign = 'center';
    ctx.fillText('FIGHT BACK!', screenW / 2, screenH * 0.25);
  }

  ctx.restore();
}

/** Draw boss phase indicator */
export function drawBossPhaseHUD(
  ctx: CanvasRenderingContext2D,
  boss: BossState,
  screenW: number,
): void {
  ctx.save();
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';

  const phaseColors = { 1: '#FFFFFF', 2: '#FF8800', 3: '#FF0000' };
  ctx.fillStyle = phaseColors[boss.phase];
  ctx.fillText(`PHASE ${boss.phase}`, screenW / 2, 50);

  // Transition flash
  if (boss.inTransition) {
    ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.02) * 0.2;
    ctx.fillStyle = phaseColors[boss.phase];
    ctx.font = 'bold 20px monospace';
    ctx.fillText('PHASE SHIFT', screenW / 2, 75);
  }

  ctx.restore();
}

// ============================================================================
// EXPORTS
// ============================================================================
// createDifficulty(bpm, energy, valence, dance, preset) — init all systems
// tickDifficulty(diff, state, ..., dt)                  — tick every frame
// attemptBlock(guard, enemyClock, gameTime)             — timed block check
// pickEnemyRhythm(bpm, energy, valence, dance)         — auto-pick counter-rhythm
// createEnemyClock(bpm, rhythm)                         — enemy beat clock
// getTimingDamageMultiplier(accuracy, perfect)          — 1x–3x damage
// getBossPattern(boss)                                  — phase attack patterns
// drawGuardMeter, drawEnemyBeatIndicator, drawComboDecayOverlay,
// drawPassivityWarning, drawBossPhaseHUD               — HUD rendering
// ============================================================================
