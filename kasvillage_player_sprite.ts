// ============================================================================
// KasVillage Player Sprite — Wallet Avatar → Game Character
// Loads avatar from SecureStore, maps game actions to physics input,
// draws sprite at correct camera angle/pose each frame
// ============================================================================

import type { AnimationPose } from './kasvillage_avatar_engine';
import {
  KasVillageAvatar,
  AvatarData,
  ANGLE_STEP,
} from './kasvillage_avatar_engine';
import {
  readWalletProfile,
  initGameSession,
  isWalletReady,
  isAvatarReady,
  WalletProfile,
  GameSession,
} from './kasvillage_wallet_bridge';
import {
  prepareAvatar,
  SpriteSheet,
  blitByAngleAndPose,
} from './kasvillage_canvas_renderer';
import type { ShadingPreset } from './kasvillage_avatar_engine';
import type { CameraState } from './kasvillage_camera_system';
import { getAvatarAngleForCamera, getCameraMode } from './kasvillage_camera_system';
import type { GameState, ComboResult } from './kasvillage_game_v1';

// ============================================================================
// PLAYER STATE
// ============================================================================

export interface PlayerSprite {
  /** Wallet profile (identity, stats, address) */
  profile: WalletProfile;
  /** SDK avatar instance */
  avatar: KasVillageAvatar;
  /** Pre-rendered sprite sheet */
  sheet: SpriteSheet;
  /** Full game session (particles, audio, HUD) */
  session: GameSession;
  /** Current display pose */
  currentPose: AnimationPose;
  /** Current display angle (from camera) */
  currentAngle: number;
  /** Scale factor (base 1.0, boss kill zoom 1.2) */
  scale: number;
  /** Flash timer (hit feedback) */
  flashTimer: number;
  /** Flash color */
  flashColor: string;
  /** Invincibility frames remaining */
  iFrames: number;
  /** Whether sprite is visible (for i-frame blink) */
  visible: boolean;
  /** Trail positions for motion blur */
  trail: Array<{ x: number; y: number; angle: number; pose: AnimationPose; alpha: number }>;
  /** Ready to render */
  ready: boolean;
}

// ============================================================================
// LOADING
// ============================================================================

export type LoadingStage = 'checking' | 'reading' | 'building' | 'caching' | 'ready' | 'no_wallet' | 'no_avatar';

export interface LoadProgress {
  stage: LoadingStage;
  progress: number; // 0–1
  message: string;
}

/**
 * Load the player's avatar from SecureStore and prepare for game rendering.
 * Returns null if wallet/avatar doesn't exist — caller should show onboarding.
 *
 * @param shading     Room shading preset (matches current zone mood)
 * @param onProgress  Progress callback for loading screen
 */
export async function loadPlayerSprite(
  shading: ShadingPreset = 'daylight',
  onProgress?: (p: LoadProgress) => void,
): Promise<PlayerSprite | null> {
  const report = (stage: LoadingStage, progress: number, message: string) => {
    onProgress?.({ stage, progress, message });
  };

  // 1. Check wallet exists
  report('checking', 0, 'Checking wallet...');
  const walletReady = await isWalletReady();
  if (!walletReady) {
    report('no_wallet', 0, 'No wallet found');
    return null;
  }

  // 2. Check avatar exists
  report('checking', 0.1, 'Checking avatar...');
  const avatarReady = await isAvatarReady();
  if (!avatarReady) {
    report('no_avatar', 0.1, 'No avatar found');
    return null;
  }

  // 3. Init full game session (reads wallet, builds avatar, renders sprite sheet)
  report('reading', 0.2, 'Loading identity...');
  const session = await initGameSession(
    shading,
    undefined, // audio callback — wired later
    (p) => {
      const stage: LoadingStage = p < 0.5 ? 'building' : 'caching';
      report(stage, 0.2 + p * 0.7, p < 0.5 ? 'Building avatar...' : 'Caching sprites...');
    },
  );

  if (!session) {
    report('no_avatar', 0, 'Failed to load avatar');
    return null;
  }

  report('ready', 1, 'Ready');

  return {
    profile: session.profile,
    avatar: session.avatar,
    sheet: session.sheet,
    session,
    currentPose: 'idle',
    currentAngle: 0,
    scale: 1.0,
    flashTimer: 0,
    flashColor: '#FFFFFF',
    iFrames: 0,
    visible: true,
    trail: [],
    ready: true,
  };
}

// ============================================================================
// GAME ACTION → AVATAR POSE MAPPING
// ============================================================================

/** Map game state to the correct avatar pose */
function resolvePlayerPose(state: GameState): AnimationPose {
  if (state.gameOver && state.victory) return 'idle'; // victory pose handled by camera
  if (state.gameOver) return 'fall'; // death

  if (state.playerBlocking) return 'block';
  if (state.playerDodging) return 'dodge_roll';

  if (!state.playerGrounded) {
    return state.playerJumping ? 'jump' : 'fall';
  }

  if (state.combo.comboActive) {
    // Alternate attack poses based on chain parity
    if (state.combo.chainLength % 2 === 0) return 'attack';
    return 'attack'; // same pose, paint system differentiates
  }

  // Moving
  const moving = Math.abs(state.playerX - 50) > 5; // rough check
  if (moving) return 'run1';

  return 'idle_combat';
}

/** Map combo result to hit feedback */
function comboToFlash(result: ComboResult): { color: string; duration: number } | null {
  if (!result.accepted) return null;
  if (result.perfect) return { color: '#FFD700', duration: 0.15 }; // gold flash
  if (result.accuracy > 0.7) return { color: '#FFFFFF', duration: 0.1 }; // white flash
  return null;
}

// ============================================================================
// UPDATE — call every frame after game tick
// ============================================================================

/**
 * Update player sprite state from game state + camera.
 * Call after tickGame() and updateCamera().
 */
export function updatePlayerSprite(
  player: PlayerSprite,
  state: GameState,
  camera: CameraState,
  dt: number,
  lastComboResult?: ComboResult,
): void {
  // --- Pose ---
  player.currentPose = resolvePlayerPose(state);

  // --- Angle from camera ---
  player.currentAngle = getAvatarAngleForCamera(camera);

  // --- Scale effects ---
  let targetScale = 1.0;
  if (state.combo.chainLength >= 20) targetScale = 1.1; // big combo = slight zoom
  if (state.victory) targetScale = 1.2; // victory zoom
  player.scale += (targetScale - player.scale) * 5 * dt;

  // --- Flash from combo hit ---
  if (lastComboResult) {
    const flash = comboToFlash(lastComboResult);
    if (flash) {
      player.flashTimer = flash.duration;
      player.flashColor = flash.color;
    }
  }
  if (player.flashTimer > 0) {
    player.flashTimer -= dt;
  }

  // --- I-frames (player got hit) ---
  if (player.iFrames > 0) {
    player.iFrames -= dt;
    // Blink every 0.1s
    player.visible = Math.floor(player.iFrames * 10) % 2 === 0;
    if (player.iFrames <= 0) {
      player.iFrames = 0;
      player.visible = true;
    }
  }

  // --- Motion trail ---
  if (state.combo.comboActive && state.combo.chainLength >= 5) {
    // Add trail point during combos
    player.trail.push({
      x: state.playerX,
      y: state.playerY,
      angle: player.currentAngle,
      pose: player.currentPose,
      alpha: 0.4,
    });
    // Max 5 trail points
    if (player.trail.length > 5) player.trail.shift();
  } else {
    player.trail = [];
  }
  // Decay trail alpha
  for (const t of player.trail) {
    t.alpha -= dt * 2;
  }
  player.trail = player.trail.filter(t => t.alpha > 0.05);

  // --- Update SDK avatar physics (position sync) ---
  player.avatar.setPosition(state.playerX, state.playerY);

  // --- Update session systems (particles, audio) ---
  player.session.tick(dt);
}

/**
 * Trigger i-frames when player takes damage.
 * Call from game logic when player HP decreases.
 */
export function triggerPlayerHit(player: PlayerSprite): void {
  player.iFrames = 1.0; // 1 second of invincibility
  player.flashTimer = 0.2;
  player.flashColor = '#FF4444';
}

// ============================================================================
// DRAW — render player sprite to canvas
// ============================================================================

/**
 * Draw the player sprite to canvas. Call during render phase.
 *
 * @param ctx        Canvas 2D context
 * @param player     Player sprite state
 * @param screenX    Screen X position (after camera scroll)
 * @param screenY    Screen Y position
 */
export function drawPlayerSprite(
  ctx: CanvasRenderingContext2D,
  player: PlayerSprite,
  screenX: number,
  screenY: number,
): void {
  if (!player.ready) return;

  // --- Draw motion trail ---
  for (const t of player.trail) {
    ctx.save();
    ctx.globalAlpha = t.alpha * 0.5;
    blitByAngleAndPose(
      ctx, player.sheet,
      t.angle, t.pose,
      t.x, t.y,
      player.scale * 0.95,
      false,
    );
    ctx.restore();
  }

  // --- Draw main sprite ---
  if (!player.visible) return; // i-frame blink

  ctx.save();

  // Flash overlay
  if (player.flashTimer > 0) {
    ctx.globalCompositeOperation = 'source-atop';
  }

  // Flip based on camera angle (face right when angle < 180)
  const flipX = player.currentAngle >= 180;

  blitByAngleAndPose(
    ctx, player.sheet,
    player.currentAngle, player.currentPose,
    screenX, screenY,
    player.scale,
    flipX,
  );

  // Flash color overlay
  if (player.flashTimer > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = player.flashColor;
    ctx.globalAlpha = player.flashTimer * 3; // fade out
    ctx.fillRect(
      screenX - 64 * player.scale,
      screenY - 128 * player.scale,
      128 * player.scale,
      128 * player.scale,
    );
  }

  ctx.restore();
}

/**
 * Draw player HUD (health bar, combo counter, name plate).
 * Call after world render.
 */
export function drawPlayerHUD(
  ctx: CanvasRenderingContext2D,
  player: PlayerSprite,
  state: GameState,
  screenW: number,
  screenH: number,
): void {
  player.session.drawHUD(ctx, screenW, screenH);

  // --- Additional game-specific HUD ---

  // Combo counter (top-right)
  if (state.combo.comboActive) {
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = 'bold 24px monospace';

    // Color based on chain length
    if (state.combo.chainLength >= 20) ctx.fillStyle = '#FFD700';
    else if (state.combo.chainLength >= 10) ctx.fillStyle = '#FF8800';
    else ctx.fillStyle = '#FFFFFF';

    ctx.fillText(`${state.combo.chainLength} CHAIN`, screenW - 20, 40);

    // Multiplier
    ctx.font = '16px monospace';
    ctx.fillStyle = '#CCCCCC';
    ctx.fillText(`×${state.combo.multiplier.toFixed(1)}`, screenW - 20, 60);
    ctx.restore();
  }

  // Player health bar (bottom-left)
  const barW = 120;
  const barH = 10;
  const barX = 20;
  const barY = screenH - 30;
  const hpRatio = state.playerHp / state.playerMaxHp;

  ctx.save();
  // BG
  ctx.fillStyle = '#333333';
  ctx.fillRect(barX, barY, barW, barH);
  // HP
  ctx.fillStyle = hpRatio > 0.5 ? '#44CC44' : hpRatio > 0.25 ? '#CCAA22' : '#CC2222';
  ctx.fillRect(barX, barY, barW * hpRatio, barH);
  // Border
  ctx.strokeStyle = '#888888';
  ctx.strokeRect(barX, barY, barW, barH);
  // Label
  ctx.font = '10px monospace';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.ceil(state.playerHp)}/${state.playerMaxHp}`, barX, barY - 4);
  ctx.restore();

  // Player name plate (bottom-left, above HP)
  ctx.save();
  ctx.font = '12px monospace';
  ctx.fillStyle = '#AAAAAA';
  ctx.textAlign = 'left';
  ctx.fillText(
    `${player.profile.name} — ${player.profile.playerClass} Lv.${player.profile.level}`,
    barX, barY - 18,
  );
  ctx.restore();
}

// ============================================================================
// FALLBACK — for users without a wallet (demo/preview mode)
// ============================================================================

/** Default avatar data for demo mode */
const DEMO_AVATAR: AvatarData = {
  paths: [
    // Minimal head circle
    'M180,80 Q200,60 220,80 Q240,100 220,130 Q200,140 180,130 Q160,100 180,80 Z',
    // Body
    'M175,130 L225,130 L230,260 L170,260 Z',
    // Left arm
    'M170,140 L150,200 L160,210 L175,155 Z',
    // Right arm
    'M230,140 L250,200 L240,210 L225,155 Z',
    // Left leg
    'M175,260 L165,340 L180,345 L190,265 Z',
    // Right leg
    'M210,260 L220,340 L235,345 L225,265 Z',
  ],
  colors: {
    skin: '#D4A574',
    hair: '#4A3728',
    primary: '#2255AA',
    secondary: '#334466',
    accent: '#CC8833',
    eyes: '#445566',
  },
  race: 'human' as any,
  gender: 'male' as any,
};

/**
 * Create a demo player sprite without wallet.
 * Uses a generic avatar for preview/testing.
 */
export async function createDemoPlayerSprite(
  shading: ShadingPreset = 'daylight',
): Promise<PlayerSprite> {
  const { avatar, sheet } = await prepareAvatar(DEMO_AVATAR, shading);

  const demoProfile: WalletProfile = {
    publicKey: '0000000000000000000000000000000000000000000000000000000000000000',
    kaspaAddress: 'kaspatest:qr0000000000000000000000000000000000000000000000000demo',
    aptNumber: null,
    verified: false,
    network: 'testnet-10',
    race: 'human' as any,
    gender: 'male' as any,
    paths: DEMO_AVATAR.paths,
    colors: DEMO_AVATAR.colors,
    name: 'Demo Player',
    playerClass: 'Wanderer',
    occupation: '',
    hairStyle: 'short',
    xp: 0,
    reputation: 0,
    traitCount: 0,
    level: 1,
    inscribed: false,
    kaspaTxId: null,
    arweaveTxId: null,
  };

  // Build a minimal GameSession for demo
  const { ParticleSystem } = await import('./kasvillage_particles');
  const { AudioHooks, GameHUD } = await import('./kasvillage_audio_ui');

  const particles = new ParticleSystem('human' as any, DEMO_AVATAR.colors);
  const audio = new AudioHooks(() => {});
  const hud = new GameHUD(DEMO_AVATAR.colors, 'Demo Player', 'Wanderer Lv.1');

  const session: GameSession = {
    profile: demoProfile,
    avatar,
    sheet,
    particles,
    audio,
    hud,
    draw: (ctx, x, y) => {
      const s = avatar.getRenderState();
      blitByAngleAndPose(ctx, sheet, s.angle, s.pose, x, y, s.scale, s.flipX);
      particles.draw(ctx);
    },
    tick: (dt) => {
      const s = avatar.getRenderState();
      particles.update(dt, s.pose, s.projection.joints, s.angle < 180);
      hud.update(dt);
    },
    drawHUD: (ctx, w, h) => {
      const s = avatar.getRenderState();
      hud.drawAll(ctx, s.x, s.y, w, h);
    },
  };

  return {
    profile: demoProfile,
    avatar,
    sheet,
    session,
    currentPose: 'idle',
    currentAngle: 0,
    scale: 1.0,
    flashTimer: 0,
    flashColor: '#FFFFFF',
    iFrames: 0,
    visible: true,
    trail: [],
    ready: true,
  };
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================
// loadPlayerSprite(shading, onProgress)    — load from wallet (async)
// createDemoPlayerSprite(shading)          — demo mode (no wallet)
// updatePlayerSprite(player, state, cam, dt, combo?) — tick every frame
// triggerPlayerHit(player)                 — start i-frames
// drawPlayerSprite(ctx, player, x, y)     — render sprite
// drawPlayerHUD(ctx, player, state, w, h) — render HUD
// ============================================================================
