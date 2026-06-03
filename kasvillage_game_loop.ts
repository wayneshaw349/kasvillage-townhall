// ============================================================================
// KasVillage Game Loop Controller
// Single orchestrator: input → spotify sync → game tick → waves → camera →
// board → player sprite → render → HUD
// ============================================================================

import type { Race } from './avatar_silhouette_generator';
import type { ShadingPreset } from './kasvillage_avatar_engine';

import {
  GameState,
  createGameState,
  tickGame,
} from './kasvillage_game_v1';

import {
  CameraState,
  createCameraState,
  triggerCamera,
  getCameraAngleIndex,
  getCameraTransform,
} from './kasvillage_camera_system';

import {
  BoardState,
  createBoardState,
  updateBoard,
  drawBoardBackground,
  getZoneHUD,
} from './kasvillage_board_renderer';

import {
  PlayerSprite,
  loadPlayerSprite,
  createDemoPlayerSprite,
  updatePlayerSprite,
  drawPlayerSprite,
  drawPlayerHUD,
  triggerPlayerHit,
} from './kasvillage_player_sprite';

import {
  WaveSpawner,
  createWaveSpawner,
  tickWaveSpawner,
  isAllWavesCleared,
  drawWaveLabel,
  drawSongProgress,
} from './kasvillage_wave_spawner';

import {
  BeatSyncState,
  fetchSpotifyAnalysis,
  fetchPlaybackState,
  createBeatSync,
  createBeatSyncFromBpm,
  tickBeatSync,
  patchGameClock,
  syncToPlayback,
  getSectionGameEffect,
} from './kasvillage_spotify_sync';

import {
  DragPadState,
  createDragPad,
  tickDragPad,
} from './kasvillage_touch_input';

import {
  JuiceState,
  createJuice,
  juiceTick,
  juiceRender,
} from './kasvillage_juice';

// ============================================================================
// GAME PHASE
// ============================================================================

export type GamePhase =
  | 'loading'
  | 'countdown'
  | 'playing'
  | 'paused'
  | 'game_over'
  | 'victory'
  | 'error';

// ============================================================================
// CONTROLLER STATE
// ============================================================================

export interface GameController {
  phase: GamePhase;
  gameState: GameState;
  camera: CameraState;
  board: BoardState;
  player: PlayerSprite;
  waves: WaveSpawner;
  sync: BeatSyncState;
  input: DragPadState;
  juice: JuiceState;

  // Timing
  lastFrameTime: number;
  frameCount: number;
  fps: number;
  fpsAccum: number;
  fpsTimer: number;

  // Spotify
  lastSyncPoll: number;
  spotifyToken: string | null;

  // Countdown
  countdownTimer: number;

  // Canvas
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  screenW: number;
  screenH: number;

  // RAF
  rafHandle: number | null;

  // Hit tracking
  prevHp: number;

  // Callbacks
  onPhaseChange?: (phase: GamePhase) => void;
  onVictory?: (trialTime: number, maxChain: number) => void;
  onGameOver?: (trialTime: number, maxChain: number) => void;
}

// ============================================================================
// INIT OPTIONS
// ============================================================================

export interface GameInitOptions {
  spotifyToken?: string | null;
  trackId?: string | null;
  fallbackBpm?: number;
  race?: Race;
  seed?: string;
  shading?: ShadingPreset;
  demo?: boolean;
  canvas: HTMLCanvasElement;
  onPhaseChange?: (phase: GamePhase) => void;
  onVictory?: (trialTime: number, maxChain: number) => void;
  onGameOver?: (trialTime: number, maxChain: number) => void;
}

// ============================================================================
// CREATE
// ============================================================================

export async function createGameController(
  opts: GameInitOptions,
): Promise<GameController> {
  const canvas = opts.canvas;
  const ctx = canvas.getContext('2d')!;
  const screenW = canvas.width;
  const screenH = canvas.height;
  const shading = opts.shading || 'twilight';
  const race = opts.race || ('human' as Race);
  const seed = opts.seed || `kv_${Date.now()}`;
  const fallbackBpm = opts.fallbackBpm || 120;

  const controller: GameController = {
    phase: 'loading',
    gameState: createGameState(fallbackBpm),
    camera: createCameraState(),
    board: null as any,
    player: null as any,
    waves: createWaveSpawner(fallbackBpm),
    sync: createBeatSyncFromBpm(fallbackBpm),
    input: createDragPad(),
    juice: createJuice([]),
    lastFrameTime: 0,
    frameCount: 0,
    fps: 0,
    fpsAccum: 0,
    fpsTimer: 0,
    lastSyncPoll: 0,
    spotifyToken: opts.spotifyToken || null,
    countdownTimer: 3,
    canvas,
    ctx,
    screenW,
    screenH,
    rafHandle: null,
    prevHp: 100,
    onPhaseChange: opts.onPhaseChange,
    onVictory: opts.onVictory,
    onGameOver: opts.onGameOver,
  };

  // ── Load player ──
  try {
    const player = opts.demo
      ? await createDemoPlayerSprite(shading)
      : await loadPlayerSprite(shading);
    controller.player = player || await createDemoPlayerSprite(shading);
  } catch {
    controller.player = await createDemoPlayerSprite(shading);
  }

  // ── Spotify analysis ──
  if (opts.spotifyToken) {
    try {
      let trackId = opts.trackId || null;
      if (!trackId) {
        const pb = await fetchPlaybackState(opts.spotifyToken);
        if (pb?.isPlaying) {
          trackId = pb.trackId;
          controller.sync.trackName = pb.trackName;
          controller.sync.artistName = pb.artistName;
        }
      }
      if (trackId) {
        const analysis = await fetchSpotifyAnalysis(trackId, opts.spotifyToken);
        if (analysis) {
          controller.sync = createBeatSync(analysis);
          const bpm = analysis.track.tempo;
          controller.gameState = createGameState(bpm);
          controller.waves = createWaveSpawner(bpm);
        }
      }
    } catch { /* fallback BPM */ }
  }

  // ── Board ──
  const playerRace = controller.player.profile.race || race;
  controller.board = createBoardState(playerRace, seed, screenW, screenH);

  // ── Juice (paint colors from avatar) ──
  const colors = controller.player.avatar?.colors;
  if (colors) {
    controller.juice = createJuice(Object.values(colors));
  }

  // ── Wire camera ──
  controller.gameState.camera = controller.camera;

  setPhase(controller, 'countdown');
  return controller;
}

// ============================================================================
// PHASE
// ============================================================================

function setPhase(c: GameController, phase: GamePhase): void {
  c.phase = phase;
  c.onPhaseChange?.(phase);
}

// ============================================================================
// GAME LOOP
// ============================================================================

export function startGameLoop(c: GameController): void {
  c.lastFrameTime = performance.now();

  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - c.lastFrameTime) / 1000);
    c.lastFrameTime = now;

    // FPS
    c.frameCount++;
    c.fpsAccum += dt;
    c.fpsTimer += dt;
    if (c.fpsTimer >= 1) {
      c.fps = Math.round(c.frameCount / c.fpsAccum);
      c.frameCount = 0;
      c.fpsAccum = 0;
      c.fpsTimer = 0;
    }

    // Update
    switch (c.phase) {
      case 'countdown': updateCountdown(c, dt); break;
      case 'playing':   updatePlaying(c, dt, now); break;
    }

    // Render
    render(c);

    c.rafHandle = requestAnimationFrame(loop);
  };

  c.rafHandle = requestAnimationFrame(loop);
}

export function stopGameLoop(c: GameController): void {
  if (c.rafHandle !== null) {
    cancelAnimationFrame(c.rafHandle);
    c.rafHandle = null;
  }
}

export function pauseGame(c: GameController): void {
  if (c.phase === 'playing') setPhase(c, 'paused');
}

export function resumeGame(c: GameController): void {
  if (c.phase === 'paused') {
    c.lastFrameTime = performance.now();
    setPhase(c, 'playing');
  }
}

// ============================================================================
// COUNTDOWN
// ============================================================================

function updateCountdown(c: GameController, dt: number): void {
  c.countdownTimer -= dt;
  if (c.countdownTimer <= 0) {
    setPhase(c, 'playing');
  }
}

// ============================================================================
// MAIN UPDATE
// ============================================================================

function updatePlaying(c: GameController, dt: number, now: number): void {
  const { gameState, sync, waves, board, player, input, camera } = c;

  // 1. Spotify sync poll (every 2s)
  if (c.spotifyToken && now - c.lastSyncPoll > 2000) {
    c.lastSyncPoll = now;
    fetchPlaybackState(c.spotifyToken).then(pb => {
      if (pb) syncToPlayback(sync, pb.progressMs / 1000);
    }).catch(() => {});
  }

  // 2. Beat sync
  tickBeatSync(sync, dt);
  patchGameClock(gameState, sync);

  // 3. Input → player state
  tickDragPad(input, gameState, dt);

  // 4. Waves
  tickWaveSpawner(waves, gameState, dt);

  // 5. Section energy → difficulty
  const fx = getSectionGameEffect(sync);
  if (fx.dropShake) {
    triggerCamera(camera, 'combo_break', gameState.gameTime);
  }

  // 6. Game tick (enemies, combo, camera)
  tickGame(gameState, dt);

  // 7. Board scroll
  updateBoard(board, gameState.playerX, input.playerVX, camera, dt);

  // 8. Player sprite
  updatePlayerSprite(player, gameState, camera, dt, input.lastComboResult || undefined);

  // 9. JUICE — paint, sound, haptics, popups, death anims, shake
  const effectiveDt = juiceTick(c.juice, gameState, camera, input, sync, dt);

  // 10. Hit feedback
  if (gameState.playerHp < c.prevHp) {
    triggerPlayerHit(player);
  }
  c.prevHp = gameState.playerHp;

  // 10. Victory / game over
  if (gameState.gameOver) {
    if (gameState.victory) {
      setPhase(c, 'victory');
      c.onVictory?.(gameState.trialTime, gameState.combo.maxChain);
    } else {
      setPhase(c, 'game_over');
      c.onGameOver?.(gameState.trialTime, gameState.combo.maxChain);
    }
  }

  // 11. Wave-based victory (all waves cleared)
  if (isAllWavesCleared(waves, gameState.activeEnemies.length)) {
    gameState.victory = true;
    gameState.gameOver = true;
  }
}

// ============================================================================
// RENDER
// ============================================================================

function render(c: GameController): void {
  const { ctx, screenW, screenH } = c;
  if (!ctx) return;

  ctx.clearRect(0, 0, screenW, screenH);

  // ── Screen shake + hit-stop zoom ──
  const scrollX = c.board ? c.board.scrollX : 0;
  const { shakeX, shakeY, zoomScale } = juiceRender(c.ctx!, c.juice, scrollX, screenW, screenH);

  ctx.save();
  ctx.translate(shakeX, shakeY);
  if (zoomScale !== 1) {
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(zoomScale, zoomScale);
    ctx.translate(-screenW / 2, -screenH / 2);
  }

  // ── Background (board + parallax) ──
  if (c.board) {
    drawBoardBackground(ctx, c.board, c.camera, c.gameState.playerX, screenW, screenH);
  }

  // ── Paint layer (rendered inside juiceRender above, before this save) ──

  // ── Enemies ──
  drawEnemies(ctx, c);

  // ── Player sprite ──
  if (c.player?.ready) {
    const playerScreenX = c.gameState.playerX - scrollX;
    drawPlayerSprite(ctx, c.player, playerScreenX, c.gameState.playerY);
  }

  ctx.restore(); // end shake/zoom transform

  // ── HUD (not affected by shake) ──
  if (c.player?.ready) {
    drawPlayerHUD(ctx, c.player, c.gameState, screenW, screenH);
  }

  // ── Wave announcements ──
  drawWaveLabel(ctx, c.waves, screenW, screenH);
  drawSongProgress(ctx, c.waves, screenW);

  // ── Track info ──
  if (c.sync.trackName) {
    ctx.save();
    ctx.font = '10px monospace';
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'right';
    ctx.fillText(`${c.sync.trackName} — ${c.sync.artistName}`, screenW - 10, screenH - 8);
    ctx.restore();
  }

  // ── Beat pulse indicator ──
  if (c.sync.onBeat && c.phase === 'playing') {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, screenW, 2);
    ctx.restore();
  }

  // ── Zone label ──
  if (c.board) {
    const zone = getZoneHUD(c.board, c.gameState.playerX);
    ctx.save();
    ctx.font = '10px monospace';
    ctx.fillStyle = '#555555';
    ctx.textAlign = 'left';
    ctx.fillText(zone.zoneName, 10, 18);
    ctx.restore();
  }

  // ── FPS ──
  ctx.save();
  ctx.font = '9px monospace';
  ctx.fillStyle = '#444444';
  ctx.textAlign = 'right';
  ctx.fillText(`${c.fps} FPS`, screenW - 10, 18);
  ctx.restore();

  // ── PHASE OVERLAYS ──
  switch (c.phase) {
    case 'countdown': renderCountdown(ctx, c, screenW, screenH); break;
    case 'game_over': renderGameOver(ctx, c, screenW, screenH); break;
    case 'victory':   renderVictory(ctx, c, screenW, screenH); break;
    case 'paused':    renderPaused(ctx, screenW, screenH); break;
  }
}

// ============================================================================
// ENEMY RENDERING (placeholder — uses SDK sprite system)
// ============================================================================

function drawEnemies(ctx: CanvasRenderingContext2D, c: GameController): void {
  const scrollX = c.board ? c.board.scrollX : 0;

  for (const enemy of c.gameState.activeEnemies) {
    if (enemy.state === 'dead') continue;

    const ex = enemy.x - scrollX;
    const ey = enemy.y;

    // Skip if off-screen
    if (ex < -50 || ex > c.screenW + 50) continue;

    ctx.save();

    // Enemy body (colored rect — replaced by SDK avatar later)
    const halfW = 15 * enemy.scale;
    const fullH = 40 * enemy.scale;

    // State-based alpha
    if (enemy.state === 'stagger') ctx.globalAlpha = 0.6;
    if (enemy.state === 'dodge') ctx.globalAlpha = 0.4;

    ctx.fillStyle = enemy.color;
    ctx.fillRect(ex - halfW, ey - fullH, halfW * 2, fullH);

    // Health bar above enemy
    if (enemy.hp < enemy.maxHp) {
      const barW = halfW * 2;
      const barH = 3;
      const barY = ey - fullH - 8;
      const hpRatio = enemy.hp / enemy.maxHp;

      ctx.fillStyle = '#333333';
      ctx.fillRect(ex - halfW, barY, barW, barH);
      ctx.fillStyle = enemy.type === 'boss' ? '#FFD700' : enemy.type === 'mini_boss' ? '#FF4444' : '#CC4444';
      ctx.fillRect(ex - halfW, barY, barW * hpRatio, barH);
    }

    // Name label for bosses/mini-bosses
    if (enemy.type !== 'npc') {
      ctx.font = '9px monospace';
      ctx.fillStyle = enemy.type === 'boss' ? '#FFD700' : '#FF6644';
      ctx.textAlign = 'center';
      ctx.fillText(enemy.name, ex, ey - fullH - 14);
    }

    ctx.restore();
  }
}

// ============================================================================
// PHASE OVERLAYS
// ============================================================================

function renderCountdown(ctx: CanvasRenderingContext2D, c: GameController, w: number, h: number): void {
  const num = Math.ceil(c.countdownTimer);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, w, h);
  ctx.font = 'bold 64px monospace';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(num > 0 ? String(num) : 'GO', w / 2, h / 2);

  if (c.sync.trackName) {
    ctx.font = '16px monospace';
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText(c.sync.trackName, w / 2, h / 2 + 50);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#888888';
    ctx.fillText(c.sync.artistName, w / 2, h / 2 + 70);
  }
  ctx.restore();
}

function renderGameOver(ctx: CanvasRenderingContext2D, c: GameController, w: number, h: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(80,0,0,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.font = 'bold 32px monospace';
  ctx.fillStyle = '#FF4444';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GAME OVER', w / 2, h / 2 - 20);
  ctx.font = '14px monospace';
  ctx.fillStyle = '#CCCCCC';
  ctx.fillText(`Time: ${c.gameState.trialTime.toFixed(1)}s  |  Max Chain: ${c.gameState.combo.maxChain}`, w / 2, h / 2 + 20);
  ctx.font = '12px monospace';
  ctx.fillStyle = '#888888';
  ctx.fillText('Tap to restart', w / 2, h / 2 + 50);
  ctx.restore();
}

function renderVictory(ctx: CanvasRenderingContext2D, c: GameController, w: number, h: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,40,80,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.font = 'bold 32px monospace';
  ctx.fillStyle = '#FFD700';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VICTORY', w / 2, h / 2 - 20);
  ctx.font = '14px monospace';
  ctx.fillStyle = '#CCCCCC';
  ctx.fillText(`Time: ${c.gameState.trialTime.toFixed(1)}s  |  Max Chain: ${c.gameState.combo.maxChain}`, w / 2, h / 2 + 20);
  ctx.font = '12px monospace';
  ctx.fillStyle = '#888888';
  ctx.fillText('Tap to play again', w / 2, h / 2 + 50);
  ctx.restore();
}

function renderPaused(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, w, h);
  ctx.font = 'bold 24px monospace';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PAUSED', w / 2, h / 2);
  ctx.restore();
}

// ============================================================================
// RESTART
// ============================================================================

export function restartGame(c: GameController): void {
  const bpm = c.sync.currentBpm;
  c.gameState = createGameState(bpm);
  c.camera = createCameraState();
  c.gameState.camera = c.camera;
  c.waves = createWaveSpawner(bpm);
  c.input = createDragPad();
  c.juice = createJuice(c.juice.paint.avatarColors);
  c.prevHp = 100;
  c.countdownTimer = 3;

  // Re-sync Spotify from current position
  if (c.spotifyToken) {
    fetchPlaybackState(c.spotifyToken).then(pb => {
      if (pb) {
        c.sync.songPosition = pb.progressMs / 1000;
        c.sync.beatIndex = 0;
        syncToPlayback(c.sync, pb.progressMs / 1000);
      }
    }).catch(() => {});
  } else {
    c.sync = createBeatSyncFromBpm(bpm);
  }

  setPhase(c, 'countdown');
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================
// createGameController(opts)   — async init everything
// startGameLoop(c)             — begin RAF loop
// stopGameLoop(c)              — cancel RAF
// pauseGame(c)                 — pause
// resumeGame(c)                — resume
// restartGame(c)               — restart from scratch
// GameController               — full state object
// GamePhase                    — phase type
// ============================================================================
