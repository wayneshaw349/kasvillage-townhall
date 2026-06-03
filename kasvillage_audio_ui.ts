// ============================================================================
// KasVillage Audio Hooks + UI Toolkit
// Audio: Procedural sound events tied to pose transitions + physics
// UI: Game HUD components driven by avatar state
// ============================================================================

import { AnimationPose, KasVillageAvatar, JointSet } from './kasvillage_avatar_engine';

// ============================================================================
// AUDIO HOOKS — pose transitions trigger sound events
// ============================================================================

/**
 * Sound event types the engine emits.
 * Dev maps these to their own audio files / Tone.js / Howler / expo-av.
 */
export type SoundEvent =
  // Footsteps
  | 'footstep_walk'
  | 'footstep_run'
  | 'footstep_sprint'
  | 'footstep_land_light'
  | 'footstep_land_heavy'
  // Combat
  | 'attack_whoosh'
  | 'attack_impact'
  | 'block_clang'
  | 'hit_grunt'
  // Movement
  | 'jump_launch'
  | 'dodge_roll'
  | 'slide_scrape'
  | 'wall_grab'
  | 'crouch_down'
  // Ambient
  | 'idle_breath'
  | 'sprint_breath'
  // Emotes
  | 'wave_greeting'
  | 'sit_down';

/** Spatial audio position relative to camera */
export interface SpatialInfo {
  pan: number;    // -1.0 (left) to 1.0 (right)
  distance: number; // 0.0 (close) to 1.0 (far) — maps to volume
  pitch: number;    // 0.5 (deep/big) to 2.0 (high/small) — race weight
}

/** Sound event with metadata */
export interface AudioEvent {
  sound: SoundEvent;
  spatial: SpatialInfo;
  volume: number;     // 0.0–1.0 base volume before spatial falloff
  /** Dev can use this to pick from variant sounds (footstep_01, footstep_02) */
  variant: number;    // 0–3 random variant index
}

/** Audio callback — dev implements this with their audio library */
export type AudioCallback = (event: AudioEvent) => void;

/**
 * Pose transition → sound event mapping.
 * Key = "fromPose→toPose", value = sound + volume.
 */
const POSE_SOUND_MAP: Record<string, { sound: SoundEvent; volume: number }> = {
  // Walk footsteps (alternating feet)
  'idle→walk1':        { sound: 'footstep_walk', volume: 0.5 },
  'walk2→walk1':       { sound: 'footstep_walk', volume: 0.5 },
  'walk1→walk2':       { sound: 'footstep_walk', volume: 0.5 },
  // Run footsteps
  'walk1→run1':        { sound: 'footstep_run', volume: 0.65 },
  'walk2→run1':        { sound: 'footstep_run', volume: 0.65 },
  'run2→run1':         { sound: 'footstep_run', volume: 0.65 },
  'run1→run2':         { sound: 'footstep_run', volume: 0.65 },
  // Sprint
  'run1→sprint1':      { sound: 'footstep_sprint', volume: 0.8 },
  'run2→sprint1':      { sound: 'footstep_sprint', volume: 0.8 },
  'sprint2→sprint1':   { sound: 'footstep_sprint', volume: 0.8 },
  'sprint1→sprint2':   { sound: 'footstep_sprint', volume: 0.8 },
  // Jump
  'idle→jump_squat':   { sound: 'crouch_down', volume: 0.3 },
  'jump_squat→jump':   { sound: 'jump_launch', volume: 0.7 },
  'run1→jump':         { sound: 'jump_launch', volume: 0.7 },
  'sprint1→jump':      { sound: 'jump_launch', volume: 0.8 },
  // Landing
  'fall→land_light':   { sound: 'footstep_land_light', volume: 0.6 },
  'fall→land_heavy':   { sound: 'footstep_land_heavy', volume: 0.9 },
  'jump→land_light':   { sound: 'footstep_land_light', volume: 0.5 },
  // Combat
  'idle→attack_wind':          { sound: 'attack_whoosh', volume: 0.3 },
  'idle_combat→attack_wind':   { sound: 'attack_whoosh', volume: 0.3 },
  'attack_wind→attack':        { sound: 'attack_whoosh', volume: 0.8 },
  'attack→attack_follow':      { sound: 'attack_impact', volume: 0.7 },
  'idle→block':                { sound: 'block_clang', volume: 0.4 },
  'idle_combat→block':         { sound: 'block_clang', volume: 0.4 },
  '*→hit_stagger':             { sound: 'hit_grunt', volume: 0.8 },
  // Traversal
  'idle→dodge_roll':           { sound: 'dodge_roll', volume: 0.6 },
  'idle_combat→dodge_roll':    { sound: 'dodge_roll', volume: 0.6 },
  'run1→dodge_roll':           { sound: 'dodge_roll', volume: 0.7 },
  '*→wall_climb':              { sound: 'wall_grab', volume: 0.5 },
  '*→slide':                   { sound: 'slide_scrape', volume: 0.6 },
  'idle→crouch':               { sound: 'crouch_down', volume: 0.3 },
  // Emotes
  'idle→wave':                 { sound: 'wave_greeting', volume: 0.4 },
  'idle→sit':                  { sound: 'sit_down', volume: 0.3 },
};

/**
 * Continuous sounds triggered by staying in a pose.
 * Returns sound event + interval in seconds.
 */
const POSE_AMBIENT: Partial<Record<AnimationPose, { sound: SoundEvent; interval: number; volume: number }>> = {
  idle:    { sound: 'idle_breath', interval: 3.0, volume: 0.15 },
  sprint1: { sound: 'sprint_breath', interval: 0.8, volume: 0.4 },
  sprint2: { sound: 'sprint_breath', interval: 0.8, volume: 0.4 },
  slide:   { sound: 'slide_scrape', interval: 0.3, volume: 0.3 },
};

/**
 * AudioHooks — attach to avatar, get sound events on pose changes.
 */
export class AudioHooks {
  private callback: AudioCallback;
  private prevPose: AnimationPose = 'idle';
  private ambientTimer: number = 0;
  private rng: number = 0;

  constructor(callback: AudioCallback) {
    this.callback = callback;
  }

  /**
   * Call this every frame with the avatar's current state.
   * Emits AudioEvents when pose transitions or ambient timers fire.
   */
  update(
    currentPose: AnimationPose,
    avatarX: number,
    cameraX: number,
    avatarDistance: number,
    raceAmp: number,
    dt: number,
  ): void {
    // Pose transition sounds
    if (currentPose !== this.prevPose) {
      const key = `${this.prevPose}→${currentPose}`;
      const wildcardKey = `*→${currentPose}`;
      const mapping = POSE_SOUND_MAP[key] || POSE_SOUND_MAP[wildcardKey];

      if (mapping) {
        this.rng = (this.rng * 1103515245 + 12345) & 0x7fffffff;
        const variant = this.rng % 4;

        // Pitch based on race weight — bigger = deeper
        const pitch = 1.0 / Math.sqrt(raceAmp);

        const spatial = this.computeSpatial(avatarX, cameraX, avatarDistance);

        this.callback({
          sound: mapping.sound,
          spatial,
          volume: mapping.volume * (1 - spatial.distance * 0.7),
          variant,
        });
      }

      this.prevPose = currentPose;
      this.ambientTimer = 0;
    }

    // Ambient / continuous sounds
    const ambient = POSE_AMBIENT[currentPose];
    if (ambient) {
      this.ambientTimer += dt;
      if (this.ambientTimer >= ambient.interval) {
        this.ambientTimer -= ambient.interval;
        const spatial = this.computeSpatial(avatarX, cameraX, avatarDistance);
        this.callback({
          sound: ambient.sound,
          spatial,
          volume: ambient.volume * (1 - spatial.distance * 0.5),
          variant: 0,
        });
      }
    }
  }

  private computeSpatial(avatarX: number, cameraX: number, distance: number): SpatialInfo {
    const screenW = 400; // reference width
    const pan = Math.max(-1, Math.min(1, (avatarX - cameraX) / (screenW * 0.5)));
    const dist = Math.max(0, Math.min(1, distance / 1000));
    return { pan, distance: dist, pitch: 1.0 };
  }

  /** Reset state (e.g. on scene change) */
  reset(): void {
    this.prevPose = 'idle';
    this.ambientTimer = 0;
  }
}

/**
 * Default sound file mapping — dev can use this as a starting point.
 * Maps SoundEvent → suggested file names.
 */
export const DEFAULT_SOUND_FILES: Record<SoundEvent, string[]> = {
  footstep_walk:       ['step_stone_01.mp3','step_stone_02.mp3','step_stone_03.mp3','step_stone_04.mp3'],
  footstep_run:        ['run_stone_01.mp3','run_stone_02.mp3','run_stone_03.mp3','run_stone_04.mp3'],
  footstep_sprint:     ['sprint_01.mp3','sprint_02.mp3','sprint_03.mp3','sprint_04.mp3'],
  footstep_land_light: ['land_soft_01.mp3','land_soft_02.mp3'],
  footstep_land_heavy: ['land_heavy_01.mp3','land_heavy_02.mp3'],
  attack_whoosh:       ['whoosh_01.mp3','whoosh_02.mp3','whoosh_03.mp3'],
  attack_impact:       ['impact_01.mp3','impact_02.mp3'],
  block_clang:         ['block_01.mp3','block_02.mp3'],
  hit_grunt:           ['grunt_01.mp3','grunt_02.mp3','grunt_03.mp3'],
  jump_launch:         ['jump_01.mp3','jump_02.mp3'],
  dodge_roll:          ['roll_01.mp3','roll_02.mp3'],
  slide_scrape:        ['slide_01.mp3'],
  wall_grab:           ['grab_01.mp3','grab_02.mp3'],
  crouch_down:         ['crouch_01.mp3'],
  idle_breath:         ['breath_idle_01.mp3'],
  sprint_breath:       ['breath_heavy_01.mp3','breath_heavy_02.mp3'],
  wave_greeting:       ['wave_01.mp3'],
  sit_down:            ['sit_01.mp3'],
};

// ============================================================================
// UI TOOLKIT — Game HUD components driven by avatar state
// ============================================================================

/** Color scheme derived from avatar's chosen colors */
export interface UITheme {
  primary: string;      // From avatar primary outfit color
  secondary: string;    // From avatar secondary color
  accent: string;       // From avatar accent color
  skin: string;         // Avatar skin tone
  hair: string;         // Avatar hair color
  background: string;   // Derived dark bg
  text: string;         // Contrast text
  danger: string;       // HP low
  success: string;      // HP full / positive
  warning: string;      // Mid-range
}

/**
 * Derive a full UI theme from avatar colors.
 * Every game using KasVillage avatars gets a unique color scheme
 * that matches the player's character.
 */
export function deriveUITheme(avatarColors: Record<string, string>): UITheme {
  const primary   = avatarColors['primary']   || '#4A6741';
  const secondary = avatarColors['secondary'] || '#2F3136';
  const accent    = avatarColors['accent']    || '#FFD700';
  const skin      = avatarColors['skin']      || '#D4A574';
  const hair      = avatarColors['hair']      || '#2C1810';

  // Derive background: darken primary heavily
  const bg = darkenHex(primary, 0.8);
  // Text: if bg is dark, white; if light, black
  const bgLum = hexLuminance(bg);
  const text = bgLum < 0.4 ? '#E8E4E0' : '#1A1A1A';

  return {
    primary,
    secondary,
    accent,
    skin,
    hair,
    background: bg,
    text,
    danger: '#CC2222',
    success: '#22AA44',
    warning: '#DDAA22',
  };
}

function darkenHex(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  const nr = Math.round(r * (1 - amount)), ng = Math.round(g * (1 - amount)), nb = Math.round(b * (1 - amount));
  return `#${nr.toString(16).padStart(2,'0')}${ng.toString(16).padStart(2,'0')}${nb.toString(16).padStart(2,'0')}`;
}

function hexLuminance(hex: string): number {
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// ============================================================================
// HUD COMPONENTS — data models for common game UI elements
// ============================================================================

/** Health / mana / stamina bar state */
export interface BarState {
  current: number;
  max: number;
  color: string;
  label: string;
}

/** Name plate floating above avatar */
export interface NamePlate {
  name: string;
  title: string;        // e.g. "Warrior Lv.5" — from class + XP
  nameColor: string;    // From theme accent
  bgColor: string;      // Semi-transparent theme bg
  barBelow: BarState | null; // Optional HP bar under name
}

/** Action button (attack, dodge, jump, etc.) */
export interface ActionButton {
  id: string;
  label: string;
  icon: string;         // Emoji or icon name
  color: string;        // From theme
  cooldown: number;     // 0.0 = ready, 0.0–1.0 = on cooldown
  enabled: boolean;
  inputKey: keyof PhysicsInputMap;
}

type PhysicsInputMap = {
  left: boolean; right: boolean; up: boolean; down: boolean;
  jump: boolean; attack: boolean; block: boolean;
  crouch: boolean; dodge: boolean; sprint: boolean;
};

/** Inventory slot */
export interface InventorySlot {
  id: string;
  itemName: string | null;
  itemIcon: string | null;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  equipped: boolean;
  /** Color tint based on rarity */
  borderColor: string;
}

const RARITY_COLORS: Record<string, string> = {
  common: '#888888',
  uncommon: '#44AA44',
  rare: '#4488DD',
  epic: '#AA44CC',
  legendary: '#FFAA00',
};

/** Chat bubble above avatar */
export interface ChatBubble {
  text: string;
  duration: number;     // seconds to display
  elapsed: number;      // time elapsed
  bgColor: string;
  textColor: string;
}

/** Damage/heal number popup */
export interface FloatingNumber {
  value: number;
  x: number;
  y: number;
  vy: number;           // float upward
  color: string;        // red for damage, green for heal
  opacity: number;      // fades out
  scale: number;        // starts big, shrinks
  elapsed: number;
}

// ============================================================================
// HUD MANAGER — creates and updates all UI elements
// ============================================================================

export class GameHUD {
  theme: UITheme;
  nameplate: NamePlate;
  bars: BarState[];
  actions: ActionButton[];
  inventory: InventorySlot[];
  chatBubble: ChatBubble | null = null;
  floatingNumbers: FloatingNumber[] = [];

  constructor(
    avatarColors: Record<string, string>,
    playerName: string,
    playerClass: string,
  ) {
    this.theme = deriveUITheme(avatarColors);

    this.nameplate = {
      name: playerName,
      title: playerClass,
      nameColor: this.theme.accent,
      bgColor: this.theme.background + 'CC',
      barBelow: { current: 100, max: 100, color: this.theme.success, label: 'HP' },
    };

    this.bars = [
      { current: 100, max: 100, color: this.theme.success, label: 'HP' },
      { current: 100, max: 100, color: '#4488DD', label: 'MP' },
      { current: 100, max: 100, color: '#DDAA22', label: 'SP' },
    ];

    this.actions = [
      { id: 'attack', label: 'Attack', icon: '⚔️', color: this.theme.danger, cooldown: 0, enabled: true, inputKey: 'attack' },
      { id: 'block',  label: 'Block',  icon: '🛡️', color: this.theme.secondary, cooldown: 0, enabled: true, inputKey: 'block' },
      { id: 'dodge',  label: 'Dodge',  icon: '💨', color: this.theme.primary, cooldown: 0, enabled: true, inputKey: 'dodge' },
      { id: 'jump',   label: 'Jump',   icon: '🦘', color: this.theme.accent, cooldown: 0, enabled: true, inputKey: 'jump' },
    ];

    this.inventory = Array.from({ length: 8 }, (_, i) => ({
      id: `slot_${i}`,
      itemName: null,
      itemIcon: null,
      rarity: 'common' as const,
      equipped: false,
      borderColor: RARITY_COLORS.common,
    }));
  }

  /** Update bar value with auto-color (green→yellow→red) */
  setBar(index: number, current: number): void {
    if (!this.bars[index]) return;
    this.bars[index].current = Math.max(0, Math.min(this.bars[index].max, current));
    // Auto-color HP bar
    if (index === 0) {
      const pct = this.bars[0].current / this.bars[0].max;
      this.bars[0].color = pct > 0.6 ? this.theme.success : pct > 0.25 ? this.theme.warning : this.theme.danger;
      // Sync nameplate bar
      if (this.nameplate.barBelow) {
        this.nameplate.barBelow.current = this.bars[0].current;
        this.nameplate.barBelow.color = this.bars[0].color;
      }
    }
  }

  /** Set cooldown on action (0.0 = ready, 1.0 = full cooldown) */
  setCooldown(actionId: string, cooldown: number): void {
    const action = this.actions.find(a => a.id === actionId);
    if (action) action.cooldown = Math.max(0, Math.min(1, cooldown));
  }

  /** Tick cooldowns down */
  updateCooldowns(dt: number, cooldownRate: number = 1.0): void {
    for (const a of this.actions) {
      if (a.cooldown > 0) a.cooldown = Math.max(0, a.cooldown - dt * cooldownRate);
    }
  }

  /** Put item in inventory slot */
  setItem(slotIndex: number, name: string, icon: string, rarity: InventorySlot['rarity'] = 'common'): void {
    if (!this.inventory[slotIndex]) return;
    this.inventory[slotIndex].itemName = name;
    this.inventory[slotIndex].itemIcon = icon;
    this.inventory[slotIndex].rarity = rarity;
    this.inventory[slotIndex].borderColor = RARITY_COLORS[rarity];
  }

  /** Clear inventory slot */
  clearSlot(slotIndex: number): void {
    if (!this.inventory[slotIndex]) return;
    this.inventory[slotIndex].itemName = null;
    this.inventory[slotIndex].itemIcon = null;
    this.inventory[slotIndex].rarity = 'common';
    this.inventory[slotIndex].equipped = false;
    this.inventory[slotIndex].borderColor = RARITY_COLORS.common;
  }

  /** Show chat bubble above avatar */
  say(text: string, duration: number = 3): void {
    this.chatBubble = {
      text,
      duration,
      elapsed: 0,
      bgColor: this.theme.background + 'DD',
      textColor: this.theme.text,
    };
  }

  /** Spawn floating damage/heal number */
  spawnNumber(value: number, x: number, y: number, isHeal: boolean = false): void {
    this.floatingNumbers.push({
      value,
      x,
      y,
      vy: -2,
      color: isHeal ? this.theme.success : this.theme.danger,
      opacity: 1,
      scale: 1.5,
      elapsed: 0,
    });
  }

  /** Update all animated UI elements */
  update(dt: number): void {
    // Cooldowns
    this.updateCooldowns(dt);

    // Chat bubble timer
    if (this.chatBubble) {
      this.chatBubble.elapsed += dt;
      if (this.chatBubble.elapsed >= this.chatBubble.duration) {
        this.chatBubble = null;
      }
    }

    // Floating numbers
    for (const fn of this.floatingNumbers) {
      fn.elapsed += dt;
      fn.y += fn.vy;
      fn.vy -= 0.05; // decelerate
      fn.opacity = Math.max(0, 1 - fn.elapsed / 1.5);
      fn.scale = 1.5 - fn.elapsed * 0.5;
    }
    this.floatingNumbers = this.floatingNumbers.filter(fn => fn.opacity > 0);
  }

  // ========================================================================
  // CANVAS DRAW METHODS — render HUD directly to game canvas
  // ========================================================================

  /** Draw HP/MP/SP bars at screen position */
  drawBars(ctx: CanvasRenderingContext2D, x: number, y: number, width: number = 120): void {
    const barH = 10, gap = 3;
    for (let i = 0; i < this.bars.length; i++) {
      const bar = this.bars[i];
      const by = y + i * (barH + gap);
      const pct = bar.current / bar.max;

      // Background
      ctx.fillStyle = '#1A1A1A';
      ctx.fillRect(x, by, width, barH);
      // Fill
      ctx.fillStyle = bar.color;
      ctx.fillRect(x, by, width * pct, barH);
      // Border
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, by, width, barH);
      // Label
      ctx.fillStyle = '#FFF';
      ctx.font = '8px monospace';
      ctx.fillText(`${bar.label} ${Math.ceil(bar.current)}/${bar.max}`, x + 3, by + 8);
    }
  }

  /** Draw name plate above avatar position */
  drawNamePlate(ctx: CanvasRenderingContext2D, avatarX: number, avatarY: number): void {
    const np = this.nameplate;
    const textW = ctx.measureText(np.name).width;
    const plateW = Math.max(textW + 20, 60);
    const plateH = np.barBelow ? 28 : 18;
    const px = avatarX - plateW / 2;
    const py = avatarY - 20;

    // Background
    ctx.fillStyle = np.bgColor;
    ctx.beginPath();
    ctx.roundRect(px, py, plateW, plateH, 4);
    ctx.fill();

    // Name
    ctx.fillStyle = np.nameColor;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(np.name, avatarX, py + 12);

    // HP bar below name
    if (np.barBelow) {
      const barW = plateW - 8;
      const barH = 4;
      const bx = px + 4;
      const by = py + 16;
      ctx.fillStyle = '#1A1A1A';
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = np.barBelow.color;
      ctx.fillRect(bx, by, barW * (np.barBelow.current / np.barBelow.max), barH);
    }

    ctx.textAlign = 'start'; // reset
  }

  /** Draw action buttons at screen position */
  drawActions(ctx: CanvasRenderingContext2D, x: number, y: number, btnSize: number = 40): void {
    const gap = 6;
    for (let i = 0; i < this.actions.length; i++) {
      const a = this.actions[i];
      const bx = x + i * (btnSize + gap);

      // Button background
      ctx.fillStyle = a.cooldown > 0 ? '#333' : a.color + '88';
      ctx.beginPath();
      ctx.roundRect(bx, y, btnSize, btnSize, 6);
      ctx.fill();
      ctx.strokeStyle = a.cooldown > 0 ? '#555' : a.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Cooldown overlay
      if (a.cooldown > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(bx, y, btnSize, btnSize * a.cooldown);
      }

      // Icon
      ctx.font = '18px serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = a.cooldown > 0 ? '#666' : '#FFF';
      ctx.fillText(a.icon, bx + btnSize/2, y + btnSize/2 + 6);

      // Label
      ctx.font = '7px monospace';
      ctx.fillStyle = '#AAA';
      ctx.fillText(a.label, bx + btnSize/2, y + btnSize - 3);
      ctx.textAlign = 'start';
    }
  }

  /** Draw inventory bar at screen position */
  drawInventory(ctx: CanvasRenderingContext2D, x: number, y: number, slotSize: number = 32): void {
    const gap = 3;
    for (let i = 0; i < this.inventory.length; i++) {
      const slot = this.inventory[i];
      const sx = x + i * (slotSize + gap);

      // Slot background
      ctx.fillStyle = slot.equipped ? '#2A2A1A' : '#1A1A1A';
      ctx.fillRect(sx, y, slotSize, slotSize);
      ctx.strokeStyle = slot.borderColor;
      ctx.lineWidth = slot.itemName ? 1.5 : 0.5;
      ctx.strokeRect(sx, y, slotSize, slotSize);

      // Item icon
      if (slot.itemIcon) {
        ctx.font = '18px serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFF';
        ctx.fillText(slot.itemIcon, sx + slotSize/2, y + slotSize/2 + 6);
        ctx.textAlign = 'start';
      }
    }
  }

  /** Draw chat bubble above avatar */
  drawChatBubble(ctx: CanvasRenderingContext2D, avatarX: number, avatarY: number): void {
    if (!this.chatBubble) return;
    const cb = this.chatBubble;
    const fadeIn = Math.min(1, cb.elapsed / 0.2);
    const fadeOut = Math.min(1, (cb.duration - cb.elapsed) / 0.3);
    const alpha = Math.min(fadeIn, fadeOut);

    ctx.globalAlpha = alpha;
    const textW = ctx.measureText(cb.text).width;
    const bubbleW = textW + 16;
    const bubbleH = 22;
    const bx = avatarX - bubbleW / 2;
    const by = avatarY - 45;

    // Bubble
    ctx.fillStyle = cb.bgColor;
    ctx.beginPath();
    ctx.roundRect(bx, by, bubbleW, bubbleH, 6);
    ctx.fill();
    // Tail
    ctx.beginPath();
    ctx.moveTo(avatarX - 4, by + bubbleH);
    ctx.lineTo(avatarX, by + bubbleH + 6);
    ctx.lineTo(avatarX + 4, by + bubbleH);
    ctx.fill();

    // Text
    ctx.fillStyle = cb.textColor;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(cb.text, avatarX, by + 15);
    ctx.textAlign = 'start';
    ctx.globalAlpha = 1;
  }

  /** Draw floating damage/heal numbers */
  drawFloatingNumbers(ctx: CanvasRenderingContext2D): void {
    for (const fn of this.floatingNumbers) {
      ctx.globalAlpha = fn.opacity;
      ctx.fillStyle = fn.color;
      ctx.font = `bold ${Math.max(8, Math.round(14 * fn.scale))}px monospace`;
      ctx.textAlign = 'center';
      const prefix = fn.value > 0 ? '+' : '';
      ctx.fillText(`${prefix}${fn.value}`, fn.x, fn.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
  }

  /** Draw complete HUD (call once per frame after drawing game world) */
  drawAll(
    ctx: CanvasRenderingContext2D,
    avatarX: number,
    avatarY: number,
    screenW: number,
    screenH: number,
  ): void {
    this.drawNamePlate(ctx, avatarX, avatarY);
    this.drawChatBubble(ctx, avatarX, avatarY);
    this.drawFloatingNumbers(ctx);
    this.drawBars(ctx, 8, 8);
    this.drawActions(ctx, screenW / 2 - 95, screenH - 52);
    this.drawInventory(ctx, screenW / 2 - 140, screenH - 100);
  }
}
