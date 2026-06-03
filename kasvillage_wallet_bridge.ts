// ============================================================================
// KasVillage Wallet-SDK Bridge
// One function reads the wallet → initializes the entire game SDK
// This is the link between identity and game engine
// ============================================================================

import * as SecureStore from 'expo-secure-store';
import {
  KasVillageAvatar,
  AvatarData,
  AnimationPose,
  JointSet,
  Race,
  Gender,
} from './kasvillage_avatar_engine';
import { ParticleSystem } from './kasvillage_particles';
import { AudioHooks, AudioCallback, AudioEvent, GameHUD } from './kasvillage_audio_ui';
import {
  prepareAvatar,
  SpriteSheet,
  blitByAngleAndPose,
  ShadingPreset,
} from './kasvillage_canvas_renderer';

// ============================================================================
// SECURESTORE KEY MAP — every key the wallet writes
// ============================================================================

const WALLET_KEYS = {
  // Identity (from wallet_registration_v2)
  PUBLIC_KEY:       'kv_public_key',
  KASPA_ADDRESS:    'kv_kaspa_address',
  APT_NUMBER:       'kv_apt_number',
  USER_STATS:       'kv_user_stats',
  AVATAR:           'kv_avatar',
  REG_STATUS:       'kv_registration_status',

  // Ritual (from Expo_identity_ritual)
  AVATAR_RECIPE:    'kv_avatar_recipe',
  AVATAR_IDENTITY:  'kv_avatar_identity',
  COLOR_MIX_HISTORY:'kv_color_mix_history',
  VERIFIED:         'kv_verified',

  // Inscription (from identity_inscription_v6)
  IDENTITY_INSCRIPTION: 'kv_identity_inscription',
  NETWORK:              'kaspa_network',
};

// ============================================================================
// WALLET PROFILE — everything the SDK needs from the wallet
// ============================================================================

export interface WalletProfile {
  // Identity
  publicKey: string;
  kaspaAddress: string;
  aptNumber: string | null;
  verified: boolean;
  network: string;

  // Avatar
  race: Race;
  gender: Gender;
  paths: string[];
  colors: Record<string, string>;
  name: string;
  playerClass: string;
  occupation: string;
  hairStyle: string;

  // Stats
  xp: number;
  reputation: number;
  traitCount: number;
  level: number;

  // Inscription
  inscribed: boolean;
  kaspaTxId: string | null;
  arweaveTxId: string | null;
}

/**
 * Read the complete wallet profile from SecureStore.
 * Returns null if wallet doesn't exist yet.
 */
export async function readWalletProfile(): Promise<WalletProfile | null> {
  try {
    const pubKey = await SecureStore.getItemAsync(WALLET_KEYS.PUBLIC_KEY);
    if (!pubKey) return null;

    const address = await SecureStore.getItemAsync(WALLET_KEYS.KASPA_ADDRESS) || '';
    const aptNumber = await SecureStore.getItemAsync(WALLET_KEYS.APT_NUMBER);
    const verified = (await SecureStore.getItemAsync(WALLET_KEYS.VERIFIED)) === 'true';
    const network = (await SecureStore.getItemAsync(WALLET_KEYS.NETWORK)) || 'testnet-10';

    // Avatar identity (paths + hash)
    let paths: string[] = [];
    let race: Race = 'human';
    let gender: Gender = 'male';
    const identityStr = await SecureStore.getItemAsync(WALLET_KEYS.AVATAR_IDENTITY);
    if (identityStr) {
      const identity = JSON.parse(identityStr);
      paths = identity.paths || [];
      race = (identity.race as Race) || 'human';
      gender = (identity.gender as Gender) || 'male';
    }

    // Avatar recipe (colors, name, class, etc.)
    let colors: Record<string, string> = {};
    let name = 'Villager';
    let playerClass = 'Wanderer';
    let occupation = '';
    let hairStyle = 'short';
    let traitCount = 0;
    const recipeStr = await SecureStore.getItemAsync(WALLET_KEYS.AVATAR_RECIPE);
    if (recipeStr) {
      const recipe = JSON.parse(recipeStr);
      colors = recipe.colors || {};
      name = recipe.name || 'Villager';
      playerClass = recipe.class || 'Wanderer';
      occupation = recipe.occupation || '';
      hairStyle = recipe.hairStyle || 'short';
      // Count non-empty fields as traits
      const traitFields = ['name','race','gender','hairStyle','originStory','formativeMemory',
        'class','occupation','animal','personality','combatStyle','lifePhilosophy',
        'powerSpike','signatureMove','scenarioConflict','scenarioMoral','scenarioFear','scenarioDesire'];
      traitCount = traitFields.filter(f => recipe[f] && recipe[f].length > 0).length;
    }

    // User stats
    let xp = 0;
    let reputation = 0;
    const statsStr = await SecureStore.getItemAsync(WALLET_KEYS.USER_STATS);
    if (statsStr) {
      const stats = JSON.parse(statsStr);
      xp = stats.xp || 0;
      reputation = stats.reputation || 0;
    }

    // Inscription status
    let inscribed = false;
    let kaspaTxId: string | null = null;
    let arweaveTxId: string | null = null;
    const inscriptionStr = await SecureStore.getItemAsync(WALLET_KEYS.IDENTITY_INSCRIPTION);
    if (inscriptionStr) {
      const inscription = JSON.parse(inscriptionStr);
      inscribed = inscription.success === true;
      kaspaTxId = inscription.kaspacTxId || null;
      arweaveTxId = inscription.arweaveTxId || null;
    }

    // Level from XP (simple curve)
    const level = Math.floor(Math.sqrt(xp / 100)) + 1;

    return {
      publicKey: pubKey,
      kaspaAddress: address,
      aptNumber,
      verified,
      network,
      race,
      gender,
      paths,
      colors,
      name,
      playerClass,
      occupation,
      hairStyle,
      xp,
      reputation,
      traitCount,
      level,
      inscribed,
      kaspaTxId,
      arweaveTxId,
    };
  } catch (e) {
    console.error('[KV Bridge] Failed to read wallet:', e);
    return null;
  }
}

// ============================================================================
// GAME SESSION — the single object a game dev works with
// ============================================================================

export interface GameSession {
  // Profile
  profile: WalletProfile;

  // Engine
  avatar: KasVillageAvatar;

  // Renderer
  sheet: SpriteSheet;

  // Systems
  particles: ParticleSystem;
  audio: AudioHooks;
  hud: GameHUD;

  // Convenience methods
  /** Blit the avatar sprite to canvas at position */
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
  /** Update all systems (call every frame) */
  tick: (dt: number) => void;
  /** Draw HUD overlay (call after world render) */
  drawHUD: (ctx: CanvasRenderingContext2D, screenW: number, screenH: number) => void;
}

/**
 * Initialize a complete game session from the wallet.
 * One call — everything is ready.
 *
 * Usage:
 *   const session = await initGameSession('horror');
 *   if (!session) { showCreateAvatarScreen(); return; }
 *
 *   // Game loop
 *   session.avatar.update(dt, input, groundY);
 *   session.tick(dt);
 *   session.draw(ctx, x, y);
 *   session.drawHUD(ctx, screenW, screenH);
 */
export async function initGameSession(
  shading: ShadingPreset = 'daylight',
  audioCallback?: AudioCallback,
  onProgress?: (progress: number) => void,
): Promise<GameSession | null> {
  // 1. Read wallet
  const profile = await readWalletProfile();
  if (!profile || profile.paths.length === 0) return null;

  // 2. Build avatar data
  const avatarData: AvatarData = {
    paths: profile.paths,
    colors: profile.colors,
    race: profile.race,
    gender: profile.gender,
  };

  // 3. Prepare avatar + sprite sheet (cached if available)
  const { avatar, sheet } = await prepareAvatar(avatarData, shading, onProgress);

  // 4. Init particles with avatar colors
  const particles = new ParticleSystem(profile.race, profile.colors);

  // 5. Init audio hooks
  const audio = new AudioHooks(audioCallback || (() => {}));

  // 6. Init HUD with avatar theme
  const hud = new GameHUD(
    profile.colors,
    profile.name,
    `${profile.playerClass} Lv.${profile.level}`,
  );

  // 7. Build convenience functions
  const draw = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const state = avatar.getRenderState();
    blitByAngleAndPose(ctx, sheet, state.angle, state.pose, x, y, state.scale, state.flipX);
    particles.draw(ctx);
  };

  const tick = (dt: number) => {
    const state = avatar.getRenderState();

    // Race weight for audio pitch
    const raceWeights: Record<string, number> = {
      human:1, cyborg:1, mutant:1.05, ethereal:0.9, beast:1.15,
      elf:0.95, darkelf:0.95, dwarf:0.85, alien:0.88, orc:1.1,
      halfling:0.75, golem:1.25, elemental:1, undead:0.92,
      giant:1.2, merfolk:0.95, centaur:1.1, troll:1.15,
      gnome:0.72, phoenix:0.9, sprite:0.55, vampire:0.98,
      werewolf:1.1, angel:1, dragonkin:1.05, fae:0.7,
    };
    const raceAmp = raceWeights[profile.race] || 1;

    // Update all systems
    particles.update(dt, state.pose, state.projection.joints, state.angle < 180);
    audio.update(state.pose, state.x, 0, 0, raceAmp, dt);
    hud.update(dt);
  };

  const drawHUD = (ctx: CanvasRenderingContext2D, screenW: number, screenH: number) => {
    const state = avatar.getRenderState();
    hud.drawAll(ctx, state.x, state.y, screenW, screenH);
  };

  return {
    profile,
    avatar,
    sheet,
    particles,
    audio,
    hud,
    draw,
    tick,
    drawHUD,
  };
}

// ============================================================================
// QUICK CHECKS — does the wallet have what we need?
// ============================================================================

/** Check if wallet exists and has completed registration */
export async function isWalletReady(): Promise<boolean> {
  const pubKey = await SecureStore.getItemAsync(WALLET_KEYS.PUBLIC_KEY);
  return pubKey !== null && pubKey.length > 0;
}

/** Check if avatar ritual is complete */
export async function isAvatarReady(): Promise<boolean> {
  const identity = await SecureStore.getItemAsync(WALLET_KEYS.AVATAR_IDENTITY);
  return identity !== null;
}

/** Check if identity is inscribed on-chain */
export async function isInscribed(): Promise<boolean> {
  const inscription = await SecureStore.getItemAsync(WALLET_KEYS.IDENTITY_INSCRIPTION);
  if (!inscription) return false;
  const data = JSON.parse(inscription);
  return data.success === true;
}

/** Get trait count (determines buy/sell permissions: 9=buy, 13=sell) */
export async function getTraitCount(): Promise<number> {
  const recipeStr = await SecureStore.getItemAsync(WALLET_KEYS.AVATAR_RECIPE);
  if (!recipeStr) return 0;
  const recipe = JSON.parse(recipeStr);
  const fields = ['name','race','gender','hairStyle','originStory','formativeMemory',
    'class','occupation','animal','personality','combatStyle','lifePhilosophy',
    'powerSpike','signatureMove','scenarioConflict','scenarioMoral','scenarioFear','scenarioDesire'];
  return fields.filter(f => recipe[f] && recipe[f].length > 0).length;
}

/** Get wallet address for display */
export async function getWalletAddress(): Promise<string | null> {
  return SecureStore.getItemAsync(WALLET_KEYS.KASPA_ADDRESS);
}

/** Get public key hex */
export async function getPublicKey(): Promise<string | null> {
  return SecureStore.getItemAsync(WALLET_KEYS.PUBLIC_KEY);
}
