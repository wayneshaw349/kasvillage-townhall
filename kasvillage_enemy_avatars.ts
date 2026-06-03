// ============================================================================
// KasVillage Enemy Avatars v2 — Full SDK Detail
// Uses the SAME RACE_GENERATORS as the player wallet avatar.
// Same bezier skulls, irises, fingers, muscle curves, hair strands.
// 21 enemies: 15 NPCs + 3 mini-bosses + 3 bosses (or 1 PvP boss)
// Each enemy = different race from the 26 available generators.
// ============================================================================

import {
  Race,
  Gender,
  RACE_GENERATORS,
  deriveSeed,
} from './avatar_silhouette_generator';

import type { AvatarData, ShadingPreset } from './kasvillage_avatar_engine';
import { KasVillageAvatar } from './kasvillage_avatar_engine';
import { prepareAvatar, SpriteSheet, blitByAngleAndPose } from './kasvillage_canvas_renderer';
import type { EnemyAI } from './kasvillage_game_v1';

// ============================================================================
// ENEMY ROSTER — 21 enemies, each a different race
// ============================================================================

export interface EnemyTemplate {
  id: string;
  name: string;
  race: Race;
  gender: Gender;
  /** Color overrides — hostile palette shift */
  palette: {
    skin: string;
    hair: string;
    primary: string;
    secondary: string;
    accent: string;
    eyes: string;
  };
  scale: number;
  type: 'npc' | 'mini_boss' | 'boss';
}

const ENEMY_ROSTER: EnemyTemplate[] = [
  // ── Zone 0: Approach (3 NPCs + 1 mini-boss) ──
  { id: 'npc_01', name: 'Prowler',        race: 'halfling',  gender: 'male',   scale: 0.75, type: 'npc',
    palette: { skin: '#9B8B72', hair: '#332211', primary: '#2D2D2D', secondary: '#3A3A3A', accent: '#554433', eyes: '#DD4444' } },
  { id: 'npc_02', name: 'Skulker',         race: 'gnome',     gender: 'male',   scale: 0.7,  type: 'npc',
    palette: { skin: '#8B7B62', hair: '#221100', primary: '#333322', secondary: '#44432A', accent: '#665533', eyes: '#FF6600' } },
  { id: 'npc_03', name: 'Grunt',           race: 'orc',       gender: 'male',   scale: 1.05, type: 'npc',
    palette: { skin: '#5B7744', hair: '#1A2A11', primary: '#443322', secondary: '#554433', accent: '#776644', eyes: '#FF3300' } },
  { id: 'mb_01',  name: 'Crimson Knight',  race: 'human',     gender: 'male',   scale: 1.2,  type: 'mini_boss',
    palette: { skin: '#C4A882', hair: '#1A0A00', primary: '#8B0000', secondary: '#660000', accent: '#CC3333', eyes: '#FF0000' } },

  // ── Zone 1: Battle Arena (3 NPCs + 1 mini-boss) ──
  { id: 'npc_04', name: 'Shade',           race: 'darkelf',   gender: 'female', scale: 0.95, type: 'npc',
    palette: { skin: '#6B5B8A', hair: '#1A1A2E', primary: '#2D1B4E', secondary: '#3A2266', accent: '#7744AA', eyes: '#BB44FF' } },
  { id: 'npc_05', name: 'Ravager',         race: 'werewolf',  gender: 'male',   scale: 1.1,  type: 'npc',
    palette: { skin: '#7A6B55', hair: '#3A2A1A', primary: '#4A3A2A', secondary: '#5A4A3A', accent: '#8B7355', eyes: '#FFAA00' } },
  { id: 'npc_06', name: 'Brute',           race: 'troll',     gender: 'male',   scale: 1.2,  type: 'npc',
    palette: { skin: '#556644', hair: '#2A3A1A', primary: '#3A4A2A', secondary: '#4A5A3A', accent: '#6B7744', eyes: '#FF6600' } },
  { id: 'mb_02',  name: 'Shadow Dancer',   race: 'fae',       gender: 'female', scale: 1.0,  type: 'mini_boss',
    palette: { skin: '#8866AA', hair: '#110022', primary: '#220044', secondary: '#330066', accent: '#9944FF', eyes: '#FF00FF' } },

  // ── Zone 2: Dark Depths (3 NPCs + 1 mini-boss) ──
  { id: 'npc_07', name: 'Venom Fang',      race: 'dragonkin', gender: 'male',   scale: 1.05, type: 'npc',
    palette: { skin: '#447744', hair: '#112211', primary: '#224422', secondary: '#336633', accent: '#44BB44', eyes: '#00FF44' } },
  { id: 'npc_08', name: 'Phantom',         race: 'ethereal',  gender: 'female', scale: 0.95, type: 'npc',
    palette: { skin: '#AABBCC', hair: '#667788', primary: '#445566', secondary: '#556677', accent: '#88AABB', eyes: '#66DDFF' } },
  { id: 'npc_09', name: 'Viper',           race: 'mutant',    gender: 'female', scale: 0.95, type: 'npc',
    palette: { skin: '#88AA55', hair: '#334411', primary: '#445522', secondary: '#556633', accent: '#88BB44', eyes: '#CCFF00' } },
  { id: 'mb_03',  name: 'Iron Golem',      race: 'golem',     gender: 'male',   scale: 1.4,  type: 'mini_boss',
    palette: { skin: '#8899AA', hair: '#445566', primary: '#556677', secondary: '#667788', accent: '#99AABB', eyes: '#FF4400' } },

  // ── Zone 3: The Gauntlet (6 NPCs) ──
  { id: 'npc_10', name: 'Blade Wraith',    race: 'undead',    gender: 'male',   scale: 1.0,  type: 'npc',
    palette: { skin: '#998877', hair: '#443322', primary: '#332211', secondary: '#443322', accent: '#665544', eyes: '#44FF44' } },
  { id: 'npc_11', name: 'Storm Caller',    race: 'elemental', gender: 'female', scale: 1.05, type: 'npc',
    palette: { skin: '#7799CC', hair: '#334466', primary: '#224488', secondary: '#3355AA', accent: '#5577DD', eyes: '#88DDFF' } },
  { id: 'npc_12', name: 'Warden',          race: 'dwarf',     gender: 'male',   scale: 0.85, type: 'npc',
    palette: { skin: '#AA8866', hair: '#553311', primary: '#664422', secondary: '#775533', accent: '#AA7744', eyes: '#FF8800' } },
  { id: 'npc_13', name: 'Night Stalker',   race: 'vampire',   gender: 'male',   scale: 1.0,  type: 'npc',
    palette: { skin: '#CCBBAA', hair: '#111111', primary: '#1A0A1A', secondary: '#2A1A2A', accent: '#880044', eyes: '#FF0044' } },
  { id: 'npc_14', name: 'Wild Fury',       race: 'beast',     gender: 'female', scale: 1.1,  type: 'npc',
    palette: { skin: '#AA7744', hair: '#553311', primary: '#663311', secondary: '#774422', accent: '#BB6633', eyes: '#FFCC00' } },
  { id: 'npc_15', name: 'The Champion',    race: 'angel',     gender: 'male',   scale: 1.15, type: 'npc',
    palette: { skin: '#DDCCBB', hair: '#AABB99', primary: '#889977', secondary: '#99AA88', accent: '#BBCC99', eyes: '#FFFFFF' } },

  // ── Zone 4: Boss Chamber ──
  { id: 'boss_01', name: 'The Conductor',  race: 'phoenix',   gender: 'male',   scale: 1.6,  type: 'boss',
    palette: { skin: '#FF6622', hair: '#FF2200', primary: '#CC1100', secondary: '#AA0000', accent: '#FFD700', eyes: '#FFFFFF' } },

  // ── Alternate bosses (song-dependent or random) ──
  { id: 'boss_02', name: 'The Leviathan',  race: 'giant',     gender: 'male',   scale: 1.7,  type: 'boss',
    palette: { skin: '#667788', hair: '#334455', primary: '#445566', secondary: '#556677', accent: '#8899AA', eyes: '#FF2200' } },
  { id: 'boss_03', name: 'The Siren',      race: 'merfolk',   gender: 'female', scale: 1.5,  type: 'boss',
    palette: { skin: '#66AABB', hair: '#224455', primary: '#336677', secondary: '#447788', accent: '#66CCDD', eyes: '#FF44AA' } },
];

// ============================================================================
// HYBRID RACE BLENDING — mix two races for unique enemy variety
// Takes body structure from primary race, adds features from secondary race
// Every enemy looks distinct even when using the same 26 generators
// ============================================================================

interface HybridDef {
  primary: Race;    // base body structure
  secondary: Race;  // overlay features
  gender: Gender;
  blendRatio: number; // 0 = pure primary, 1 = pure secondary, 0.3–0.7 = hybrid
}

/** Enemy hybrid definitions — each enemy blends two races */
const ENEMY_HYBRIDS: Record<string, HybridDef> = {
  // Zone 0
  npc_01: { primary: 'halfling',  secondary: 'gnome',     gender: 'male',   blendRatio: 0.3 },
  npc_02: { primary: 'gnome',     secondary: 'mutant',    gender: 'male',   blendRatio: 0.4 },
  npc_03: { primary: 'orc',       secondary: 'beast',     gender: 'male',   blendRatio: 0.35 },
  mb_01:  { primary: 'human',     secondary: 'cyborg',    gender: 'male',   blendRatio: 0.4 },
  // Zone 1
  npc_04: { primary: 'darkelf',   secondary: 'vampire',   gender: 'female', blendRatio: 0.35 },
  npc_05: { primary: 'werewolf',  secondary: 'beast',     gender: 'male',   blendRatio: 0.5 },
  npc_06: { primary: 'troll',     secondary: 'orc',       gender: 'male',   blendRatio: 0.3 },
  mb_02:  { primary: 'fae',       secondary: 'ethereal',  gender: 'female', blendRatio: 0.45 },
  // Zone 2
  npc_07: { primary: 'dragonkin', secondary: 'elemental', gender: 'male',   blendRatio: 0.4 },
  npc_08: { primary: 'ethereal',  secondary: 'angel',     gender: 'female', blendRatio: 0.5 },
  npc_09: { primary: 'mutant',    secondary: 'alien',     gender: 'female', blendRatio: 0.45 },
  mb_03:  { primary: 'golem',     secondary: 'giant',     gender: 'male',   blendRatio: 0.35 },
  // Zone 3
  npc_10: { primary: 'undead',    secondary: 'ethereal',  gender: 'male',   blendRatio: 0.4 },
  npc_11: { primary: 'elemental', secondary: 'phoenix',   gender: 'female', blendRatio: 0.45 },
  npc_12: { primary: 'dwarf',     secondary: 'golem',     gender: 'male',   blendRatio: 0.3 },
  npc_13: { primary: 'vampire',   secondary: 'darkelf',   gender: 'male',   blendRatio: 0.4 },
  npc_14: { primary: 'beast',     secondary: 'werewolf',  gender: 'female', blendRatio: 0.5 },
  npc_15: { primary: 'angel',     secondary: 'elf',       gender: 'male',   blendRatio: 0.35 },
  // Zone 4 bosses
  boss_01: { primary: 'phoenix',  secondary: 'dragonkin', gender: 'male',   blendRatio: 0.4 },
  boss_02: { primary: 'giant',    secondary: 'troll',     gender: 'male',   blendRatio: 0.45 },
  boss_03: { primary: 'merfolk',  secondary: 'fae',       gender: 'female', blendRatio: 0.4 },
};

/**
 * Blend color palettes between two sources.
 */
function blendColor(hex1: string, hex2: string, ratio: number): string {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
  const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
  const b = Math.round(b1 * (1 - ratio) + b2 * ratio);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Build AvatarData by blending two race generators.
 * Primary race provides the body structure.
 * Secondary race provides overlay features (extra paths blended in).
 * Colors are mixed between the two palettes.
 */
function buildEnemyAvatarData(template: EnemyTemplate): AvatarData {
  const hybrid = ENEMY_HYBRIDS[template.id];

  if (!hybrid) {
    // Fallback: pure race, no blend
    const generator = RACE_GENERATORS[template.race];
    const seed = deriveSeed(template.id + template.race + template.name);
    return {
      paths: generator(template.gender, seed),
      colors: template.palette,
      race: template.race,
      gender: template.gender,
    };
  }

  const seed = deriveSeed(template.id + hybrid.primary + hybrid.secondary + template.name);
  const primaryGen = RACE_GENERATORS[hybrid.primary];
  const secondaryGen = RACE_GENERATORS[hybrid.secondary];

  // Generate both sets of paths
  const primaryPaths = primaryGen(hybrid.gender, seed);
  const secondaryPaths = secondaryGen(hybrid.gender, seed + 5000);

  // Blend: take all primary paths, then add a portion of secondary paths
  // The blendRatio determines how many secondary paths get added
  const secondaryCount = Math.floor(secondaryPaths.length * hybrid.blendRatio);
  // Pick secondary paths from the END of the array (race-specific features, not base body)
  const overlayPaths = secondaryPaths.slice(secondaryPaths.length - secondaryCount);

  const blendedPaths = [...primaryPaths, ...overlayPaths];

  // Blend the palette colors
  const defaultPrimary = getDefaultRaceColors(hybrid.primary);
  const defaultSecondary = getDefaultRaceColors(hybrid.secondary);
  const blendedPalette = {
    skin:      blendColor(template.palette.skin, defaultSecondary.skin, hybrid.blendRatio * 0.5),
    hair:      blendColor(template.palette.hair, defaultSecondary.hair, hybrid.blendRatio * 0.4),
    primary:   template.palette.primary,
    secondary: blendColor(template.palette.secondary, defaultSecondary.primary, hybrid.blendRatio * 0.3),
    accent:    blendColor(template.palette.accent, defaultSecondary.accent, hybrid.blendRatio * 0.6),
    eyes:      template.palette.eyes, // keep enemy eye color distinct
  };

  return {
    paths: blendedPaths,
    colors: blendedPalette,
    race: hybrid.primary,
    gender: hybrid.gender,
  };
}

/** Default colors per race for blending reference */
function getDefaultRaceColors(race: Race): Record<string, string> {
  const defaults: Record<string, Record<string, string>> = {
    human:     { skin: '#C8A47A', hair: '#4A3728', primary: '#3A352E', accent: '#8B5E14' },
    cyborg:    { skin: '#A0A0B0', hair: '#333344', primary: '#4A4A5A', accent: '#44AAFF' },
    mutant:    { skin: '#88AA55', hair: '#334411', primary: '#445522', accent: '#AACC44' },
    ethereal:  { skin: '#AABBCC', hair: '#667788', primary: '#445566', accent: '#88CCDD' },
    beast:     { skin: '#AA7744', hair: '#553311', primary: '#664422', accent: '#CC8833' },
    elf:       { skin: '#D4B896', hair: '#8B7355', primary: '#446644', accent: '#88AA66' },
    darkelf:   { skin: '#6B5B8A', hair: '#1A1A2E', primary: '#2D1B4E', accent: '#7744AA' },
    dwarf:     { skin: '#AA8866', hair: '#553311', primary: '#664422', accent: '#AA7744' },
    alien:     { skin: '#88AA88', hair: '#334444', primary: '#336644', accent: '#44CC88' },
    orc:       { skin: '#5B7744', hair: '#1A2A11', primary: '#443322', accent: '#776644' },
    halfling:  { skin: '#9B8B72', hair: '#332211', primary: '#4A4438', accent: '#8B7B62' },
    golem:     { skin: '#8899AA', hair: '#445566', primary: '#556677', accent: '#99AABB' },
    elemental: { skin: '#7799CC', hair: '#334466', primary: '#224488', accent: '#5577DD' },
    undead:    { skin: '#998877', hair: '#443322', primary: '#332211', accent: '#665544' },
    giant:     { skin: '#667788', hair: '#334455', primary: '#445566', accent: '#8899AA' },
    merfolk:   { skin: '#66AABB', hair: '#224455', primary: '#336677', accent: '#66CCDD' },
    centaur:   { skin: '#AA8866', hair: '#664422', primary: '#553311', accent: '#CC9944' },
    troll:     { skin: '#556644', hair: '#2A3A1A', primary: '#3A4A2A', accent: '#6B7744' },
    gnome:     { skin: '#8B7B62', hair: '#442211', primary: '#554433', accent: '#AA8855' },
    phoenix:   { skin: '#FF6622', hair: '#FF2200', primary: '#CC1100', accent: '#FFD700' },
    sprite:    { skin: '#AADDAA', hair: '#448844', primary: '#336633', accent: '#66EE66' },
    vampire:   { skin: '#CCBBAA', hair: '#111111', primary: '#1A0A1A', accent: '#880044' },
    werewolf:  { skin: '#7A6B55', hair: '#3A2A1A', primary: '#4A3A2A', accent: '#8B7355' },
    angel:     { skin: '#DDCCBB', hair: '#AABB99', primary: '#889977', accent: '#BBCC99' },
    dragonkin: { skin: '#447744', hair: '#112211', primary: '#224422', accent: '#44BB44' },
    fae:       { skin: '#8866AA', hair: '#332244', primary: '#442266', accent: '#AA66CC' },
  };
  return defaults[race] || defaults.human;
}

// ============================================================================
// AVATAR CACHE
// ============================================================================

export interface EnemyAvatarCache {
  sprites: Map<string, { avatar: KasVillageAvatar; sheet: SpriteSheet }>;
  ready: boolean;
  progress: number;
}

// ============================================================================
// GENERATE ALL — pre-render at game start
// ============================================================================

/**
 * Generate sprite sheets for all enemies.
 * Uses real SDK pipeline: RACE_GENERATORS → AvatarData → KasVillageAvatar → SpriteSheet
 */
export async function generateEnemyAvatars(
  shading: ShadingPreset = 'twilight',
  onProgress?: (progress: number) => void,
): Promise<EnemyAvatarCache> {
  const cache: EnemyAvatarCache = {
    sprites: new Map(),
    ready: false,
    progress: 0,
  };

  for (let i = 0; i < ENEMY_ROSTER.length; i++) {
    const template = ENEMY_ROSTER[i];
    const avatarData = buildEnemyAvatarData(template);

    try {
      const { avatar, sheet } = await prepareAvatar(avatarData, shading);
      avatar.setScale(template.scale);
      cache.sprites.set(template.id, { avatar, sheet });
    } catch (e) {
      console.warn(`[EnemyGen] Failed ${template.id}:`, e);
    }

    cache.progress = (i + 1) / ENEMY_ROSTER.length;
    onProgress?.(cache.progress);
  }

  cache.ready = true;
  return cache;
}

// ============================================================================
// GENERATE PER ZONE — lazy loading
// ============================================================================

const ZONE_ENEMIES: Record<number, string[]> = {
  0: ['npc_01', 'npc_02', 'npc_03', 'mb_01'],
  1: ['npc_04', 'npc_05', 'npc_06', 'mb_02'],
  2: ['npc_07', 'npc_08', 'npc_09', 'mb_03'],
  3: ['npc_10', 'npc_11', 'npc_12', 'npc_13', 'npc_14', 'npc_15'],
  4: ['boss_01'],
};

export async function generateZoneEnemies(
  zone: number,
  shading: ShadingPreset = 'twilight',
  onProgress?: (progress: number) => void,
): Promise<EnemyAvatarCache> {
  const ids = ZONE_ENEMIES[zone] || [];
  const templates = ENEMY_ROSTER.filter(t => ids.includes(t.id));
  const cache: EnemyAvatarCache = { sprites: new Map(), ready: false, progress: 0 };

  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    const avatarData = buildEnemyAvatarData(template);

    try {
      const { avatar, sheet } = await prepareAvatar(avatarData, shading);
      avatar.setScale(template.scale);
      cache.sprites.set(template.id, { avatar, sheet });
    } catch { /* skip */ }

    cache.progress = (i + 1) / templates.length;
    onProgress?.(cache.progress);
  }

  cache.ready = true;
  return cache;
}

// ============================================================================
// LAZY ZONE LOADER
// ============================================================================

export class EnemyAvatarLoader {
  private cache: EnemyAvatarCache;
  private loadedZones: Set<number> = new Set();
  private loading: boolean = false;
  private shading: ShadingPreset;

  constructor(shading: ShadingPreset = 'twilight') {
    this.shading = shading;
    this.cache = { sprites: new Map(), ready: false, progress: 0 };
  }

  getCache(): EnemyAvatarCache { return this.cache; }

  async ensureZone(zone: number): Promise<void> {
    if (this.loadedZones.has(zone) || this.loading) return;
    this.loading = true;

    const zoneCache = await generateZoneEnemies(zone, this.shading);
    for (const [id, sprite] of zoneCache.sprites) {
      this.cache.sprites.set(id, sprite);
    }
    this.loadedZones.add(zone);

    // Pre-load next zone
    const next = zone + 1;
    if (next <= 4 && !this.loadedZones.has(next)) {
      generateZoneEnemies(next, this.shading).then(nc => {
        for (const [id, sprite] of nc.sprites) {
          this.cache.sprites.set(id, sprite);
        }
        this.loadedZones.add(next);
      }).catch(() => {});
    }

    this.loading = false;
    this.cache.ready = this.loadedZones.size > 0;
  }

  has(enemyId: string): boolean {
    return this.cache.sprites.has(enemyId);
  }
}

// ============================================================================
// DRAW ENEMY — full avatar sprite from cache
// ============================================================================

export function drawEnemyAvatar(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyAI,
  cache: EnemyAvatarCache,
  cameraAngle: number,
  screenX: number,
  screenY: number,
): void {
  const sprite = cache.sprites.get(enemy.id);

  if (!sprite) {
    drawFallback(ctx, enemy, screenX, screenY);
    return;
  }

  ctx.save();
  if (enemy.state === 'stagger') ctx.globalAlpha = 0.6;
  if (enemy.state === 'dodge') ctx.globalAlpha = 0.4;

  const pose = enemyStateToPose(enemy);
  const flipX = !enemy.facingRight;

  blitByAngleAndPose(ctx, sprite.sheet, cameraAngle, pose, screenX, screenY, enemy.scale, flipX);
  ctx.restore();
}

function enemyStateToPose(enemy: EnemyAI): string {
  switch (enemy.state) {
    case 'idle':      return 'idle_combat';
    case 'approach':  return 'run1';
    case 'attack':    return 'attack';
    case 'stagger':   return 'hit_stagger';
    case 'dodge':     return 'dodge_roll';
    case 'retreat':   return 'run2';
    case 'dead':      return 'fall';
    default:          return 'idle';
  }
}

function drawFallback(ctx: CanvasRenderingContext2D, enemy: EnemyAI, x: number, y: number): void {
  const hw = 15 * enemy.scale;
  const fh = 40 * enemy.scale;
  ctx.fillStyle = enemy.color;
  ctx.fillRect(x - hw, y - fh, hw * 2, fh);
}

// ============================================================================
// FULL ENEMY RENDER — avatar + health bar + name + telegraph
// ============================================================================

export function drawEnemyFull(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyAI,
  cache: EnemyAvatarCache,
  cameraAngle: number,
  screenX: number,
  screenY: number,
): void {
  if (enemy.state === 'dead') return;

  drawEnemyAvatar(ctx, enemy, cache, cameraAngle, screenX, screenY);

  // Health bar
  if (enemy.hp < enemy.maxHp) {
    const barW = 30 * enemy.scale;
    const barH = 3;
    const barY = screenY - 50 * enemy.scale;
    const hpRatio = enemy.hp / enemy.maxHp;
    ctx.fillStyle = '#1A1714';
    ctx.fillRect(screenX - barW / 2, barY, barW, barH);
    ctx.fillStyle = enemy.type === 'boss' ? '#C8841A' : enemy.type === 'mini_boss' ? '#8B2020' : '#6B4410';
    ctx.fillRect(screenX - barW / 2, barY, barW * hpRatio, barH);
  }

  // Name (bosses + mini-bosses)
  if (enemy.type !== 'npc') {
    ctx.save();
    ctx.font = `italic ${enemy.type === 'boss' ? 11 : 9}px serif`;
    ctx.fillStyle = enemy.type === 'boss' ? '#C8841A' : '#8B5E14';
    ctx.textAlign = 'center';
    ctx.fillText(enemy.name, screenX, screenY - 55 * enemy.scale);
    ctx.restore();
  }
}

// ============================================================================
// ATTACK TELEGRAPH
// ============================================================================

export function drawAttackTelegraph(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyAI,
  screenX: number,
  screenY: number,
  windupProgress: number,
): void {
  if (windupProgress <= 0) return;

  ctx.save();
  const y = screenY - 60 * enemy.scale;
  ctx.globalAlpha = 0.5 + windupProgress * 0.5;

  ctx.strokeStyle = '#CC4400';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(screenX, y, 8 + windupProgress * 12, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = 'bold 10px serif';
  ctx.fillStyle = '#CC4400';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', screenX, y);

  if (windupProgress > 0.5) {
    const targetX = enemy.facingRight ? screenX + 50 : screenX - 50;
    ctx.globalAlpha = (windupProgress - 0.5) * 0.2;
    ctx.fillStyle = '#CC4400';
    ctx.beginPath();
    ctx.ellipse(targetX, screenY, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ============================================================================
// LOOKUPS
// ============================================================================

export function getEnemyTemplate(id: string): EnemyTemplate | undefined {
  return ENEMY_ROSTER.find(t => t.id === id);
}

export function getEnemyColor(id: string): string {
  return getEnemyTemplate(id)?.palette.primary || '#6B4410';
}

export function getAllTemplates(): EnemyTemplate[] {
  return [...ENEMY_ROSTER];
}

export { ENEMY_ROSTER };

// ============================================================================
// EXPORTS
// ============================================================================
// buildEnemyAvatarData(template)              — AvatarData from real SDK generators
// generateEnemyAvatars(shading, onProgress)   — all 21 enemies
// generateZoneEnemies(zone, shading)          — per zone
// EnemyAvatarLoader                           — lazy zone-by-zone
// drawEnemyAvatar(ctx, enemy, cache, angle, x, y) — render full-detail sprite
// drawEnemyFull(ctx, enemy, cache, angle, x, y)   — sprite + HP + name
// drawAttackTelegraph(ctx, enemy, x, y, progress) — attack warning
// getEnemyTemplate(id)                        — lookup
// ENEMY_ROSTER                                — all 21 templates
// ============================================================================
