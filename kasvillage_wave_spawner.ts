// ============================================================================
// KasVillage Wave Spawner — BPM-Timed Enemy Waves
// 4-minute song = full board. Enemies arrive on beat boundaries.
// Replaces position-triggered spawning with rhythm-driven waves.
// ============================================================================

import type { RhythmClock } from './kasvillage_game_v1';
import { spawnEnemy, type EnemyAI, type GameState } from './kasvillage_game_v1';

// ============================================================================
// WAVE DEFINITIONS
// ============================================================================

export type WaveType = 'trickle' | 'pack' | 'ambush' | 'mini_boss' | 'boss' | 'breather';

export interface WaveEntry {
  /** Which enemies to spawn */
  enemyIds: string[];
  /** Beat number this wave triggers on (absolute from song start) */
  triggerBeat: number;
  /** Wave type — affects spawn pattern */
  type: WaveType;
  /** Spawn spread: how many beats between each enemy in the wave */
  staggerBeats: number;
  /** X position offset from player for spawn point */
  spawnAheadX: number;
  /** Optional: spawn from both sides */
  flanking: boolean;
  /** Zone index 0–4 this wave belongs to */
  zone: number;
  /** Label for HUD */
  label: string;
}

/** Internal tracking per wave */
interface WaveState {
  entry: WaveEntry;
  triggered: boolean;
  spawnIndex: number;       // how many enemies from this wave have spawned
  nextSpawnBeat: number;    // beat to spawn next enemy in staggered wave
  complete: boolean;
}

// ============================================================================
// WAVE TABLE — 19 enemies across ~240 seconds (4 min) of music
// Beat numbers calculated at runtime from BPM
// ============================================================================

/**
 * Build the wave table for a given BPM.
 * 4 minutes = 240 seconds. At 120 BPM = 480 beats total.
 * Scales proportionally for other BPMs.
 *
 * Structure:
 *   Zone 0 (0:00–0:48):  NPCs 1–3 trickle in + mini-boss 1
 *   Zone 1 (0:48–1:36):  NPCs 4–6 in packs + mini-boss 2  (first drop)
 *   Zone 2 (1:36–2:24):  NPCs 7–9 ambush + mini-boss 3
 *   Zone 3 (2:24–3:12):  NPCs 10–15 rapid escalation
 *   Zone 4 (3:12–4:00):  Boss entrance + boss fight
 */
function buildWaveTable(bpm: number): WaveEntry[] {
  const bps = bpm / 60;
  /** Convert seconds to beat number */
  const sec = (s: number) => Math.round(s * bps);
  /** Convert song percentage (0–1) to beat number */
  const pct = (p: number) => Math.round(p * 240 * bps);

  return [
    // ── Zone 0: Approach (0:00–0:48) ──────────────────────────
    // Trickle — one enemy every few beats, learn the rhythm
    { enemyIds: ['npc_01'],  triggerBeat: sec(4),   type: 'trickle',   staggerBeats: 0, spawnAheadX: 300, flanking: false, zone: 0, label: 'Prowler approaches' },
    { enemyIds: ['npc_02'],  triggerBeat: sec(12),  type: 'trickle',   staggerBeats: 0, spawnAheadX: 300, flanking: false, zone: 0, label: 'Skulker in the shadows' },
    { enemyIds: ['npc_03'],  triggerBeat: sec(20),  type: 'trickle',   staggerBeats: 0, spawnAheadX: 280, flanking: false, zone: 0, label: 'Grunt charges' },
    // Breather before mini-boss
    { enemyIds: [],          triggerBeat: sec(30),  type: 'breather',  staggerBeats: 0, spawnAheadX: 0,   flanking: false, zone: 0, label: '' },
    // Mini-boss 1 — gate to zone 1
    { enemyIds: ['mb_01'],   triggerBeat: sec(36),  type: 'mini_boss', staggerBeats: 0, spawnAheadX: 250, flanking: false, zone: 0, label: 'Crimson Knight blocks the path' },

    // ── Zone 1: Battle Arena (0:48–1:36) ─────────────────────
    // Pack — two enemies at once, first real challenge
    { enemyIds: ['npc_04','npc_05'], triggerBeat: sec(52),  type: 'pack',    staggerBeats: 2, spawnAheadX: 300, flanking: false, zone: 1, label: 'Fighters emerge' },
    { enemyIds: ['npc_06'],          triggerBeat: sec(64),  type: 'trickle', staggerBeats: 0, spawnAheadX: 280, flanking: false, zone: 1, label: 'Brute smashes in' },
    // Breather
    { enemyIds: [],          triggerBeat: sec(74),  type: 'breather',  staggerBeats: 0, spawnAheadX: 0,   flanking: false, zone: 1, label: '' },
    // Mini-boss 2
    { enemyIds: ['mb_02'],   triggerBeat: sec(82),  type: 'mini_boss', staggerBeats: 0, spawnAheadX: 250, flanking: false, zone: 1, label: 'Shadow Dancer appears' },

    // ── Zone 2: Dark Depths (1:36–2:24) ──────────────────────
    // Ambush — enemies from both sides
    { enemyIds: ['npc_07','npc_08'], triggerBeat: sec(100), type: 'ambush',  staggerBeats: 1, spawnAheadX: 250, flanking: true,  zone: 2, label: 'Ambush!' },
    { enemyIds: ['npc_09'],          triggerBeat: sec(112), type: 'trickle', staggerBeats: 0, spawnAheadX: 300, flanking: false, zone: 2, label: 'Viper strikes' },
    // Breather
    { enemyIds: [],          triggerBeat: sec(120), type: 'breather',  staggerBeats: 0, spawnAheadX: 0,   flanking: false, zone: 2, label: '' },
    // Mini-boss 3
    { enemyIds: ['mb_03'],   triggerBeat: sec(128), type: 'mini_boss', staggerBeats: 0, spawnAheadX: 220, flanking: false, zone: 2, label: 'Iron Golem rises' },

    // ── Zone 3: The Gauntlet (2:24–3:12) ─────────────────────
    // Rapid escalation — packs and ambushes, no breathers
    { enemyIds: ['npc_10','npc_11'], triggerBeat: sec(148), type: 'pack',    staggerBeats: 2, spawnAheadX: 280, flanking: false, zone: 3, label: 'Smart fighters engage' },
    { enemyIds: ['npc_12'],          triggerBeat: sec(158), type: 'trickle', staggerBeats: 0, spawnAheadX: 260, flanking: false, zone: 3, label: 'Warden blocks' },
    { enemyIds: ['npc_13','npc_14'], triggerBeat: sec(168), type: 'ambush',  staggerBeats: 1, spawnAheadX: 250, flanking: true,  zone: 3, label: 'Elite ambush!' },
    { enemyIds: ['npc_15'],          triggerBeat: sec(180), type: 'trickle', staggerBeats: 0, spawnAheadX: 300, flanking: false, zone: 3, label: 'The Champion arrives' },

    // ── Zone 4: Boss Chamber (3:12–4:00) ─────────────────────
    // Breather before boss (calm before the storm)
    { enemyIds: [],          triggerBeat: sec(196), type: 'breather',  staggerBeats: 0, spawnAheadX: 0,   flanking: false, zone: 4, label: '' },
    // Boss
    { enemyIds: ['boss_01'], triggerBeat: sec(204), type: 'boss',      staggerBeats: 0, spawnAheadX: 200, flanking: false, zone: 4, label: 'The Conductor takes the stage' },
  ];
}

// ============================================================================
// WAVE SPAWNER STATE
// ============================================================================

export interface WaveSpawner {
  /** All waves with tracking state */
  waves: WaveState[];
  /** Current beat count (synced from RhythmClock) */
  currentBeat: number;
  /** BPM the waves were built for */
  bpm: number;
  /** Total beats in the song (4 minutes) */
  totalBeats: number;
  /** Active wave index (for HUD) */
  activeWaveIndex: number;
  /** Current wave label (for HUD announcement) */
  currentLabel: string;
  /** Label display timer */
  labelTimer: number;
  /** Number of enemies spawned so far */
  totalSpawned: number;
  /** Number of enemies killed so far */
  totalKilled: number;
  /** Whether all waves have been triggered */
  allWavesTriggered: boolean;
  /** Whether spawner is in a breather (no enemies, recovery time) */
  inBreather: boolean;
  /** Breather timer */
  breatherTimer: number;
}

// ============================================================================
// CREATE
// ============================================================================

export function createWaveSpawner(bpm: number): WaveSpawner {
  const table = buildWaveTable(bpm);
  const bps = bpm / 60;
  return {
    waves: table.map(entry => ({
      entry,
      triggered: false,
      spawnIndex: 0,
      nextSpawnBeat: entry.triggerBeat,
      complete: entry.enemyIds.length === 0, // breathers are pre-complete
    })),
    currentBeat: 0,
    bpm,
    totalBeats: Math.round(240 * bps),
    activeWaveIndex: -1,
    currentLabel: '',
    labelTimer: 0,
    totalSpawned: 0,
    totalKilled: 0,
    allWavesTriggered: false,
    inBreather: false,
    breatherTimer: 0,
  };
}

// ============================================================================
// TICK — call every frame, spawns enemies into GameState
// ============================================================================

/**
 * Update wave spawner. Call every frame after tickClock().
 * Spawns enemies directly into GameState.activeEnemies.
 *
 * @param spawner    Wave spawner state
 * @param state      Game state (enemies get pushed here)
 * @param dt         Delta time
 */
export function tickWaveSpawner(
  spawner: WaveSpawner,
  state: GameState,
  dt: number,
): void {
  // Sync beat count from rhythm clock
  spawner.currentBeat = state.clock.beatCount;

  // Label decay
  if (spawner.labelTimer > 0) {
    spawner.labelTimer -= dt;
    if (spawner.labelTimer <= 0) {
      spawner.currentLabel = '';
    }
  }

  // Breather timer
  if (spawner.inBreather) {
    spawner.breatherTimer -= dt;
    if (spawner.breatherTimer <= 0) {
      spawner.inBreather = false;
    }
  }

  // Track kills
  spawner.totalKilled = spawner.totalSpawned - state.activeEnemies.filter(e => e.state !== 'dead').length;

  // Process waves
  let allTriggered = true;
  for (let i = 0; i < spawner.waves.length; i++) {
    const wave = spawner.waves[i];

    if (wave.complete) continue;
    allTriggered = false;

    // Check trigger beat
    if (!wave.triggered && spawner.currentBeat >= wave.entry.triggerBeat) {
      wave.triggered = true;
      spawner.activeWaveIndex = i;

      // Set label
      if (wave.entry.label) {
        spawner.currentLabel = wave.entry.label;
        spawner.labelTimer = getLabelDuration(wave.entry.type);
      }

      // Breather — no enemies, just a pause
      if (wave.entry.type === 'breather') {
        spawner.inBreather = true;
        spawner.breatherTimer = 4.0; // 4 seconds of peace
        wave.complete = true;
        continue;
      }

      // Set first spawn beat
      wave.nextSpawnBeat = wave.entry.triggerBeat;
    }

    // Staggered spawning within a wave
    if (wave.triggered && !wave.complete) {
      if (spawner.currentBeat >= wave.nextSpawnBeat && wave.spawnIndex < wave.entry.enemyIds.length) {
        const enemyId = wave.entry.enemyIds[wave.spawnIndex];
        const spawnPos = calculateSpawnPosition(
          wave.entry,
          wave.spawnIndex,
          state.playerX,
          state.board.groundY,
          state.board.boardWidth,
        );

        // Check not already spawned (dedup by ID)
        if (!state.spawnedIds.has(enemyId)) {
          const enemy = spawnEnemy(enemyId, spawnPos.x, spawnPos.y);
          if (enemy) {
            // Flanking: alternate sides
            if (wave.entry.flanking && wave.spawnIndex % 2 === 1) {
              enemy.x = state.playerX - wave.entry.spawnAheadX;
              enemy.physics.x = enemy.x;
              enemy.facingRight = true;
            }

            state.activeEnemies.push(enemy);
            state.spawnedIds.add(enemyId);
            spawner.totalSpawned++;
          }
        }

        wave.spawnIndex++;
        wave.nextSpawnBeat = spawner.currentBeat + wave.entry.staggerBeats;

        // Wave complete when all enemies spawned
        if (wave.spawnIndex >= wave.entry.enemyIds.length) {
          wave.complete = true;
        }
      }
    }
  }

  spawner.allWavesTriggered = allTriggered;
}

// ============================================================================
// SPAWN POSITION CALCULATION
// ============================================================================

function calculateSpawnPosition(
  entry: WaveEntry,
  index: number,
  playerX: number,
  groundY: number,
  boardWidth: number,
): { x: number; y: number } {
  let x = playerX + entry.spawnAheadX;

  // Spread multiple enemies in a pack
  if (entry.enemyIds.length > 1) {
    const spread = 80;
    x += (index - (entry.enemyIds.length - 1) / 2) * spread;
  }

  // Clamp to board
  x = Math.max(50, Math.min(boardWidth - 50, x));

  // Boss spawns center-stage
  if (entry.type === 'boss') {
    x = Math.min(playerX + entry.spawnAheadX, boardWidth - 150);
  }

  return { x, y: groundY };
}

/** How long to show the wave label */
function getLabelDuration(type: WaveType): number {
  switch (type) {
    case 'boss':      return 3.0;
    case 'mini_boss': return 2.5;
    case 'ambush':    return 2.0;
    case 'pack':      return 1.5;
    case 'trickle':   return 1.5;
    default:          return 0;
  }
}

// ============================================================================
// BPM CHANGE — re-scale wave timings mid-song
// ============================================================================

/**
 * Re-scale wave table when BPM changes (song switch).
 * Preserves progress — already-triggered waves stay triggered.
 */
export function rescaleWaves(spawner: WaveSpawner, newBpm: number): void {
  const ratio = newBpm / spawner.bpm;
  spawner.bpm = newBpm;
  spawner.totalBeats = Math.round(240 * newBpm / 60);

  for (const wave of spawner.waves) {
    if (!wave.triggered) {
      // Scale future trigger beats
      wave.entry.triggerBeat = Math.round(wave.entry.triggerBeat * ratio);
      wave.nextSpawnBeat = Math.round(wave.nextSpawnBeat * ratio);
    }
  }
}

// ============================================================================
// QUERY HELPERS — for HUD and game logic
// ============================================================================

/** Get current wave info for HUD */
export function getWaveHUD(spawner: WaveSpawner): {
  label: string;
  labelAlpha: number;
  waveIndex: number;
  totalWaves: number;
  spawned: number;
  killed: number;
  songProgress: number;
  inBreather: boolean;
  isMiniBoss: boolean;
  isBoss: boolean;
} {
  const activeWave = spawner.activeWaveIndex >= 0
    ? spawner.waves[spawner.activeWaveIndex]
    : null;

  return {
    label: spawner.currentLabel,
    labelAlpha: Math.min(1, spawner.labelTimer * 2), // fade out
    waveIndex: spawner.activeWaveIndex,
    totalWaves: spawner.waves.length,
    spawned: spawner.totalSpawned,
    killed: spawner.totalKilled,
    songProgress: Math.min(1, spawner.currentBeat / spawner.totalBeats),
    inBreather: spawner.inBreather,
    isMiniBoss: activeWave?.entry.type === 'mini_boss',
    isBoss: activeWave?.entry.type === 'boss',
  };
}

/** Get the current zone index based on active wave */
export function getWaveZone(spawner: WaveSpawner): number {
  if (spawner.activeWaveIndex < 0) return 0;
  return spawner.waves[spawner.activeWaveIndex].entry.zone;
}

/** Check if all enemies have been spawned AND killed */
export function isAllWavesCleared(spawner: WaveSpawner, activeEnemyCount: number): boolean {
  return spawner.allWavesTriggered && activeEnemyCount === 0;
}

/** Get time remaining in seconds (approximate) */
export function getTimeRemaining(spawner: WaveSpawner): number {
  const beatsLeft = spawner.totalBeats - spawner.currentBeat;
  return Math.max(0, (beatsLeft / spawner.bpm) * 60);
}

/** Get enemies per minute rate (for difficulty display) */
export function getSpawnRate(spawner: WaveSpawner): number {
  if (spawner.currentBeat === 0) return 0;
  const elapsedMinutes = (spawner.currentBeat / spawner.bpm);
  return spawner.totalSpawned / Math.max(0.1, elapsedMinutes);
}

// ============================================================================
// DRAW WAVE HUD — call during render phase
// ============================================================================

/**
 * Draw wave announcement label (center screen, fades out).
 */
export function drawWaveLabel(
  ctx: CanvasRenderingContext2D,
  spawner: WaveSpawner,
  screenW: number,
  screenH: number,
): void {
  const hud = getWaveHUD(spawner);
  if (!hud.label || hud.labelAlpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = hud.labelAlpha;
  ctx.textAlign = 'center';

  // Boss/mini-boss gets bigger text
  if (hud.isBoss) {
    ctx.font = 'bold 32px monospace';
    ctx.fillStyle = '#FFD700';
    // Glow effect
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 20;
  } else if (hud.isMiniBoss) {
    ctx.font = 'bold 26px monospace';
    ctx.fillStyle = '#FF4444';
    ctx.shadowColor = '#FF4444';
    ctx.shadowBlur = 12;
  } else {
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#FFFFFF';
  }

  ctx.fillText(hud.label, screenW / 2, screenH * 0.3);
  ctx.restore();
}

/**
 * Draw song progress bar (top of screen).
 */
export function drawSongProgress(
  ctx: CanvasRenderingContext2D,
  spawner: WaveSpawner,
  screenW: number,
): void {
  const hud = getWaveHUD(spawner);
  const barH = 3;
  const y = 4;

  ctx.save();

  // Background
  ctx.fillStyle = '#222222';
  ctx.fillRect(0, y, screenW, barH);

  // Progress
  ctx.fillStyle = hud.isBoss ? '#FFD700' : hud.isMiniBoss ? '#FF4444' : '#4488CC';
  ctx.fillRect(0, y, screenW * hud.songProgress, barH);

  // Wave markers
  ctx.fillStyle = '#666666';
  for (const wave of spawner.waves) {
    if (wave.entry.type === 'breather') continue;
    const markerX = (wave.entry.triggerBeat / spawner.totalBeats) * screenW;
    const markerH = wave.entry.type === 'boss' ? 6 : wave.entry.type === 'mini_boss' ? 5 : 3;
    ctx.fillRect(markerX - 1, y, 2, markerH);
  }

  ctx.restore();
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================
// createWaveSpawner(bpm)                  — init
// tickWaveSpawner(spawner, state, dt)     — tick every frame (spawns enemies)
// rescaleWaves(spawner, newBpm)           — BPM change mid-song
// getWaveHUD(spawner)                     — HUD data
// getWaveZone(spawner)                    — current zone index
// isAllWavesCleared(spawner, count)       — victory check
// getTimeRemaining(spawner)               — seconds left
// getSpawnRate(spawner)                   — enemies/min
// drawWaveLabel(ctx, spawner, w, h)       — render wave announcement
// drawSongProgress(ctx, spawner, w)       — render song progress bar
// ============================================================================
