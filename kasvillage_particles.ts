// ============================================================================
// KasVillage Particle System
// Procedural particles tied to puppet hooks + pose transitions
// No sprite sheets — math-driven shapes rendered to Canvas
// ============================================================================

import { AnimationPose, JointSet } from './kasvillage_avatar_engine';

// ============================================================================
// PARTICLE TYPES
// ============================================================================

export type ParticleShape = 'circle' | 'square' | 'line' | 'triangle' | 'ring' | 'star' | 'splat';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  sizeEnd: number;       // shrink or grow over life
  rotation: number;      // radians
  rotationSpeed: number;
  color: string;
  opacity: number;
  opacityDecay: number;  // per second
  gravity: number;       // 0 = floats, positive = falls
  drag: number;          // 0 = no friction, 1 = instant stop
  life: number;          // seconds remaining
  maxLife: number;       // original lifespan
  shape: ParticleShape;
}

/** Emitter configuration — defines a particle effect */
export interface EmitterConfig {
  /** How many particles per burst */
  count: number;
  /** Spawn spread radius from joint position */
  spread: number;
  /** Base velocity range */
  speedMin: number;
  speedMax: number;
  /** Angle range in degrees (0=up, 90=right, 180=down, 270=left) */
  angleMin: number;
  angleMax: number;
  /** Particle size */
  sizeMin: number;
  sizeMax: number;
  sizeEnd: number;
  /** Lifespan in seconds */
  lifeMin: number;
  lifeMax: number;
  /** Physics */
  gravity: number;
  drag: number;
  /** Appearance */
  shape: ParticleShape;
  colors: string[];        // random pick per particle
  opacityStart: number;
  opacityDecay: number;
  rotationSpeed: number;   // max rotation speed (randomized ±)
}

// ============================================================================
// EFFECT PRESETS — tuned for game feel
// ============================================================================

export const EFFECTS: Record<string, EmitterConfig> = {

  // === COMBAT ===

  spark_hit: {
    count: 12, spread: 4,
    speedMin: 80, speedMax: 200,
    angleMin: 0, angleMax: 360,
    sizeMin: 1.5, sizeMax: 3, sizeEnd: 0,
    lifeMin: 0.15, lifeMax: 0.4,
    gravity: 120, drag: 0.02,
    shape: 'line',
    colors: ['#FFD700', '#FFA500', '#FF6600', '#FFFFFF'],
    opacityStart: 1, opacityDecay: 2.5,
    rotationSpeed: 15,
  },

  slash_trail: {
    count: 6, spread: 2,
    speedMin: 20, speedMax: 60,
    angleMin: 250, angleMax: 310,
    sizeMin: 3, sizeMax: 8, sizeEnd: 0,
    lifeMin: 0.1, lifeMax: 0.25,
    gravity: 0, drag: 0.1,
    shape: 'line',
    colors: ['#FFFFFF', '#CCDDFF', '#AACCFF'],
    opacityStart: 0.8, opacityDecay: 4,
    rotationSpeed: 0,
  },

  // Paint splash — uses avatar colors, multi-color splatter on hit
  // Big central burst + trailing droplets + splat blobs
  paint_splash_burst: {
    count: 14, spread: 5,
    speedMin: 60, speedMax: 220,
    angleMin: 0, angleMax: 360,       // explodes in all directions
    sizeMin: 3, sizeMax: 10, sizeEnd: 2,
    lifeMin: 0.4, lifeMax: 1.0,
    gravity: 140, drag: 0.015,
    shape: 'splat',
    colors: ['AVATAR'],               // replaced at runtime with avatar palette
    opacityStart: 0.95, opacityDecay: 1.0,
    rotationSpeed: 6,
  },

  paint_splash_drops: {
    count: 10, spread: 8,
    speedMin: 30, speedMax: 120,
    angleMin: 0, angleMax: 360,
    sizeMin: 1.5, sizeMax: 4, sizeEnd: 0.5,
    lifeMin: 0.3, lifeMax: 0.7,
    gravity: 180, drag: 0.01,
    shape: 'circle',
    colors: ['AVATAR'],
    opacityStart: 0.9, opacityDecay: 1.3,
    rotationSpeed: 0,
  },

  paint_splash_streaks: {
    count: 6, spread: 3,
    speedMin: 100, speedMax: 280,
    angleMin: 0, angleMax: 360,
    sizeMin: 6, sizeMax: 18, sizeEnd: 0,
    lifeMin: 0.12, lifeMax: 0.3,
    gravity: 60, drag: 0.005,
    shape: 'line',
    colors: ['AVATAR'],
    opacityStart: 0.8, opacityDecay: 3,
    rotationSpeed: 0,
  },

  block_sparks: {
    count: 6, spread: 6,
    speedMin: 60, speedMax: 150,
    angleMin: 220, angleMax: 320,
    sizeMin: 1, sizeMax: 2.5, sizeEnd: 0,
    lifeMin: 0.1, lifeMax: 0.3,
    gravity: 80, drag: 0.02,
    shape: 'circle',
    colors: ['#FFFFFF', '#CCCCCC', '#FFD700'],
    opacityStart: 1, opacityDecay: 3,
    rotationSpeed: 0,
  },

  // === MOVEMENT ===

  dust_land: {
    count: 10, spread: 12,
    speedMin: 20, speedMax: 80,
    angleMin: 160, angleMax: 380,  // mostly sideways + up
    sizeMin: 3, sizeMax: 8, sizeEnd: 12,
    lifeMin: 0.3, lifeMax: 0.7,
    gravity: -10, drag: 0.04,      // floats up slightly
    shape: 'circle',
    colors: ['#A08060', '#C0A080', '#D0B090', '#806040'],
    opacityStart: 0.5, opacityDecay: 1,
    rotationSpeed: 0,
  },

  dust_run: {
    count: 3, spread: 6,
    speedMin: 10, speedMax: 40,
    angleMin: 160, angleMax: 200,
    sizeMin: 2, sizeMax: 5, sizeEnd: 8,
    lifeMin: 0.2, lifeMax: 0.5,
    gravity: -8, drag: 0.05,
    shape: 'circle',
    colors: ['#A08060', '#C0A080'],
    opacityStart: 0.3, opacityDecay: 1,
    rotationSpeed: 0,
  },

  speed_lines: {
    count: 4, spread: 20,
    speedMin: 100, speedMax: 200,
    angleMin: 170, angleMax: 190,   // horizontal behind character
    sizeMin: 8, sizeMax: 20, sizeEnd: 0,
    lifeMin: 0.08, lifeMax: 0.15,
    gravity: 0, drag: 0,
    shape: 'line',
    colors: ['#FFFFFF', '#CCDDFF'],
    opacityStart: 0.4, opacityDecay: 5,
    rotationSpeed: 0,
  },

  jump_burst: {
    count: 6, spread: 8,
    speedMin: 30, speedMax: 60,
    angleMin: 120, angleMax: 240,   // downward + sideways
    sizeMin: 2, sizeMax: 5, sizeEnd: 0,
    lifeMin: 0.2, lifeMax: 0.4,
    gravity: 60, drag: 0.03,
    shape: 'circle',
    colors: ['#C0C0C0', '#A0A0A0', '#E0E0E0'],
    opacityStart: 0.6, opacityDecay: 2,
    rotationSpeed: 0,
  },

  dodge_puff: {
    count: 8, spread: 10,
    speedMin: 40, speedMax: 100,
    angleMin: 0, angleMax: 360,
    sizeMin: 4, sizeMax: 10, sizeEnd: 14,
    lifeMin: 0.2, lifeMax: 0.5,
    gravity: -5, drag: 0.06,
    shape: 'circle',
    colors: ['#808080', '#A0A0A0', '#606060'],
    opacityStart: 0.4, opacityDecay: 1.5,
    rotationSpeed: 0,
  },

  slide_sparks: {
    count: 3, spread: 4,
    speedMin: 20, speedMax: 60,
    angleMin: 250, angleMax: 290,
    sizeMin: 1, sizeMax: 2, sizeEnd: 0,
    lifeMin: 0.1, lifeMax: 0.25,
    gravity: 60, drag: 0.02,
    shape: 'circle',
    colors: ['#FFD700', '#FFA500'],
    opacityStart: 0.8, opacityDecay: 3,
    rotationSpeed: 0,
  },

  wall_debris: {
    count: 5, spread: 6,
    speedMin: 20, speedMax: 80,
    angleMin: 90, angleMax: 270,
    sizeMin: 1.5, sizeMax: 4, sizeEnd: 1,
    lifeMin: 0.3, lifeMax: 0.6,
    gravity: 160, drag: 0.01,
    shape: 'square',
    colors: ['#888', '#666', '#AAA', '#555'],
    opacityStart: 0.8, opacityDecay: 1.5,
    rotationSpeed: 8,
  },

  // === IMPACT ===

  impact_ring: {
    count: 1, spread: 0,
    speedMin: 0, speedMax: 0,
    angleMin: 0, angleMax: 0,
    sizeMin: 4, sizeMax: 4, sizeEnd: 40,
    lifeMin: 0.3, lifeMax: 0.3,
    gravity: 0, drag: 0,
    shape: 'ring',
    colors: ['#FFFFFF'],
    opacityStart: 0.6, opacityDecay: 2,
    rotationSpeed: 0,
  },

  // === AMBIENT / RACIAL ===

  embers: {
    count: 2, spread: 20,
    speedMin: 10, speedMax: 30,
    angleMin: 340, angleMax: 380,   // upward drift
    sizeMin: 1, sizeMax: 3, sizeEnd: 0,
    lifeMin: 0.5, lifeMax: 1.5,
    gravity: -20, drag: 0.02,
    shape: 'circle',
    colors: ['#FF4400', '#FF6600', '#FF8800', '#FFAA00'],
    opacityStart: 0.8, opacityDecay: 0.8,
    rotationSpeed: 0,
  },

  magic_sparkle: {
    count: 3, spread: 25,
    speedMin: 5, speedMax: 20,
    angleMin: 0, angleMax: 360,
    sizeMin: 1, sizeMax: 2.5, sizeEnd: 0,
    lifeMin: 0.3, lifeMax: 0.8,
    gravity: -15, drag: 0.03,
    shape: 'star',
    colors: ['#00FFFF', '#FF00FF', '#FFFF00', '#FFFFFF'],
    opacityStart: 0.9, opacityDecay: 1.5,
    rotationSpeed: 6,
  },

  ice_crystals: {
    count: 2, spread: 18,
    speedMin: 8, speedMax: 25,
    angleMin: 330, angleMax: 390,
    sizeMin: 2, sizeMax: 4, sizeEnd: 0,
    lifeMin: 0.4, lifeMax: 1.0,
    gravity: -10, drag: 0.03,
    shape: 'triangle',
    colors: ['#B0E0E6', '#ADD8E6', '#87CEEB', '#E0FFFF'],
    opacityStart: 0.7, opacityDecay: 1,
    rotationSpeed: 4,
  },

  shadow_wisps: {
    count: 2, spread: 22,
    speedMin: 5, speedMax: 15,
    angleMin: 0, angleMax: 360,
    sizeMin: 3, sizeMax: 6, sizeEnd: 10,
    lifeMin: 0.5, lifeMax: 1.2,
    gravity: -8, drag: 0.04,
    shape: 'circle',
    colors: ['#1A0033', '#2A004D', '#0D001A', '#330066'],
    opacityStart: 0.4, opacityDecay: 0.5,
    rotationSpeed: 1,
  },

  holy_motes: {
    count: 2, spread: 24,
    speedMin: 8, speedMax: 20,
    angleMin: 340, angleMax: 380,
    sizeMin: 1.5, sizeMax: 3, sizeEnd: 0,
    lifeMin: 0.6, lifeMax: 1.4,
    gravity: -25, drag: 0.02,
    shape: 'star',
    colors: ['#FFFFF0', '#FFD700', '#FFFACD', '#FFFFFF'],
    opacityStart: 0.7, opacityDecay: 0.7,
    rotationSpeed: 3,
  },

  lightning_crackle: {
    count: 4, spread: 15,
    speedMin: 80, speedMax: 200,
    angleMin: 0, angleMax: 360,
    sizeMin: 1, sizeMax: 2, sizeEnd: 0,
    lifeMin: 0.03, lifeMax: 0.08,
    gravity: 0, drag: 0,
    shape: 'line',
    colors: ['#FFFFFF', '#FFFF00', '#87CEFA'],
    opacityStart: 1, opacityDecay: 15,
    rotationSpeed: 20,
  },
};

// ============================================================================
// RACE → AMBIENT EFFECT MAPPING
// ============================================================================

export const RACE_AMBIENT_EFFECT: Record<string, string | null> = {
  human: null,
  cyborg: 'lightning_crackle',
  mutant: null,
  ethereal: 'magic_sparkle',
  beast: null,
  elf: null,
  darkelf: 'shadow_wisps',
  dwarf: null,
  alien: 'magic_sparkle',
  orc: null,
  halfling: null,
  golem: null,
  elemental: 'embers',
  undead: 'shadow_wisps',
  giant: null,
  merfolk: 'ice_crystals',
  centaur: null,
  troll: null,
  gnome: null,
  phoenix: 'embers',
  sprite: 'magic_sparkle',
  vampire: 'shadow_wisps',
  werewolf: null,
  angel: 'holy_motes',
  dragonkin: 'embers',
  fae: 'magic_sparkle',
};

// ============================================================================
// POSE TRANSITION → PARTICLE EFFECT MAPPING
// ============================================================================

interface PoseEffect {
  effect: string;
  joint: keyof JointSet;  // spawn position
}

const POSE_PARTICLE_MAP: Record<string, PoseEffect> = {
  // Landing
  'fall→land_light':          { effect: 'dust_land', joint: 'foot_L' },
  'fall→land_heavy':          { effect: 'dust_land', joint: 'center_mass' },
  'jump→land_light':          { effect: 'jump_burst', joint: 'foot_R' },
  // Jump
  'idle→jump_squat':          { effect: 'jump_burst', joint: 'foot_L' },
  'jump_squat→jump':          { effect: 'jump_burst', joint: 'foot_R' },
  // Combat
  'attack_wind→attack':       { effect: 'slash_trail', joint: 'hand_R' },
  'attack→attack_follow':     { effect: 'spark_hit', joint: 'hand_R' },
  '*→hit_stagger':            { effect: 'paint_splash_burst', joint: 'center_mass' },
  '*→block':                  { effect: 'block_sparks', joint: 'hand_L' },
  // Traversal
  '*→dodge_roll':             { effect: 'dodge_puff', joint: 'center_mass' },
  '*→wall_climb':             { effect: 'wall_debris', joint: 'hand_L' },
};

/** Continuous effects while in a pose (per-frame chance to spawn) */
const POSE_CONTINUOUS: Partial<Record<AnimationPose, { effect: string; joint: keyof JointSet; interval: number }>> = {
  sprint1:  { effect: 'dust_run', joint: 'foot_R', interval: 0.12 },
  sprint2:  { effect: 'dust_run', joint: 'foot_L', interval: 0.12 },
  run1:     { effect: 'dust_run', joint: 'foot_R', interval: 0.2 },
  run2:     { effect: 'dust_run', joint: 'foot_L', interval: 0.2 },
  slide:    { effect: 'slide_sparks', joint: 'foot_L', interval: 0.08 },
};

// ============================================================================
// PARTICLE SYSTEM
// ============================================================================

/** Seeded random for deterministic particle variation */
let _seed = 1;
function pRng(): number {
  _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
  return (_seed / 0x7fffffff);
}
function pRange(min: number, max: number): number {
  return min + pRng() * (max - min);
}
function pPick<T>(arr: T[]): T {
  return arr[Math.floor(pRng() * arr.length)];
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private prevPose: AnimationPose = 'idle';
  private continuousTimers: Record<string, number> = {};
  private ambientTimer: number = 0;
  private race: string = 'human';
  private avatarColors: string[] = [];
  private _splashColor: string | null = null;

  /** Max particles alive at once (performance cap) */
  maxParticles: number = 200;

  constructor(race: string = 'human', avatarColors?: Record<string, string>) {
    this.race = race;
    if (avatarColors) {
      const colorSet = new Set<string>();
      for (const c of Object.values(avatarColors)) {
        if (c && c.startsWith('#')) colorSet.add(c);
      }
      this.avatarColors = colorSet.size > 0 ? Array.from(colorSet) : this.defaultPaintColors();
    } else {
      this.avatarColors = this.defaultPaintColors();
    }
  }

  private defaultPaintColors(): string[] {
    return ['#FF1493','#FF6600','#FFD700','#00FF88','#00BFFF','#8B00FF','#FF0044','#00FFCC','#FF8800','#44FF00'];
  }

  /**
   * Set paint splash color mode.
   * null = use avatar's full color palette (default)
   * '#FF0000' = single color for all splashes
   */
  setSplashColor(color: string | null): void {
    this._splashColor = color;
  }

  getSplashColor(): string | null {
    return this._splashColor;
  }

  /** Resolve colors — single override > avatar palette > config default */
  private resolveColors(colors: string[]): string[] {
    if (colors.length === 1 && colors[0] === 'AVATAR') {
      if (this._splashColor) return [this._splashColor];
      return this.avatarColors;
    }
    return colors;
  }

  /** Spawn a burst of particles at a position */
  emit(configName: string, x: number, y: number, facingRight: boolean = true): void {
    const config = EFFECTS[configName];
    if (!config) return;

    const flipMul = facingRight ? 1 : -1;
    const resolvedColors = this.resolveColors(config.colors);

    for (let i = 0; i < config.count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const angleDeg = pRange(config.angleMin, config.angleMax);
      const angleRad = (angleDeg * Math.PI) / 180;
      const speed = pRange(config.speedMin, config.speedMax);

      const px = x + pRange(-config.spread, config.spread);
      const py = y + pRange(-config.spread, config.spread);

      this.particles.push({
        x: px,
        y: py,
        vx: Math.sin(angleRad) * speed * flipMul,
        vy: -Math.cos(angleRad) * speed,
        size: pRange(config.sizeMin, config.sizeMax),
        sizeEnd: config.sizeEnd,
        rotation: pRng() * Math.PI * 2,
        rotationSpeed: pRange(-config.rotationSpeed, config.rotationSpeed),
        color: pPick(resolvedColors),
        opacity: config.opacityStart,
        opacityDecay: config.opacityDecay,
        gravity: config.gravity,
        drag: config.drag,
        life: pRange(config.lifeMin, config.lifeMax),
        maxLife: pRange(config.lifeMin, config.lifeMax),
        shape: config.shape,
      });
    }
  }

  /** Emit at a specific joint position */
  emitAtJoint(configName: string, joints: JointSet, joint: keyof JointSet, facingRight: boolean = true): void {
    const pos = joints[joint];
    if (pos) this.emit(configName, pos.x, pos.y, facingRight);
  }

  /**
   * Call every frame. Handles:
   * - Pose transition particle bursts
   * - Continuous pose effects (dust while running)
   * - Race ambient effects (embers for elemental)
   * - Particle physics update
   */
  update(
    dt: number,
    currentPose: AnimationPose,
    joints: JointSet,
    facingRight: boolean = true,
  ): void {
    // --- Pose transition effects ---
    if (currentPose !== this.prevPose) {
      const key = `${this.prevPose}→${currentPose}`;
      const wildcardKey = `*→${currentPose}`;
      const mapping = POSE_PARTICLE_MAP[key] || POSE_PARTICLE_MAP[wildcardKey];
      if (mapping) {
        this.emitAtJoint(mapping.effect, joints, mapping.joint, facingRight);
      }

      // Heavy landing gets impact ring too
      if (currentPose === 'land_heavy') {
        this.emit('impact_ring', joints.center_mass.x, joints.foot_L.y, facingRight);
      }

      // Paint splash on hit — compound effect (burst + drops + streaks)
      if (currentPose === 'hit_stagger') {
        this.emitAtJoint('paint_splash_drops', joints, 'center_mass', facingRight);
        this.emitAtJoint('paint_splash_streaks', joints, 'center_mass', facingRight);
        this.emit('impact_ring', joints.center_mass.x, joints.center_mass.y, facingRight);
      }

      this.prevPose = currentPose;
      this.continuousTimers = {};
    }

    // --- Continuous pose effects ---
    const continuous = POSE_CONTINUOUS[currentPose];
    if (continuous) {
      const timerKey = continuous.effect;
      this.continuousTimers[timerKey] = (this.continuousTimers[timerKey] || 0) + dt;
      if (this.continuousTimers[timerKey] >= continuous.interval) {
        this.continuousTimers[timerKey] -= continuous.interval;
        this.emitAtJoint(continuous.effect, joints, continuous.joint, facingRight);
      }
    }

    // --- Race ambient effect ---
    const ambientEffect = RACE_AMBIENT_EFFECT[this.race];
    if (ambientEffect) {
      this.ambientTimer += dt;
      if (this.ambientTimer >= 0.3) {
        this.ambientTimer -= 0.3;
        this.emitAtJoint(ambientEffect, joints, 'center_mass', facingRight);
      }
    }

    // --- Update all particles ---
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Physics
      p.vy += p.gravity * dt;
      p.vx *= (1 - p.drag);
      p.vy *= (1 - p.drag);
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Rotation
      p.rotation += p.rotationSpeed * dt;

      // Size interpolation
      const lifeProgress = 1 - (p.life / p.maxLife);
      p.size = p.size + (p.sizeEnd - p.size) * lifeProgress * dt * 3;

      // Fade
      p.opacity -= p.opacityDecay * dt;

      // Life
      p.life -= dt;

      // Remove dead particles
      if (p.life <= 0 || p.opacity <= 0 || p.size <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /** Draw all particles to canvas */
  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;

      switch (p.shape) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(0.5, p.size), 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'square':
          ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
          break;

        case 'line':
          ctx.lineWidth = Math.max(0.5, p.size * 0.3);
          ctx.beginPath();
          ctx.moveTo(-p.size, 0);
          ctx.lineTo(p.size, 0);
          ctx.stroke();
          break;

        case 'triangle':
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(-p.size * 0.7, p.size * 0.5);
          ctx.lineTo(p.size * 0.7, p.size * 0.5);
          ctx.closePath();
          ctx.fill();
          break;

        case 'ring':
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(1, p.size), 0, Math.PI * 2);
          ctx.stroke();
          break;

        case 'star':
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
            const r = i % 2 === 0 ? p.size : p.size * 0.4;
            const sx = Math.cos(a) * r;
            const sy = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.closePath();
          ctx.fill();
          break;

        case 'splat': {
          // Irregular paint blob — 7-9 lobes with random radii
          const lobes = 7 + Math.floor(p.rotation * 2) % 3; // 7-9 from rotation seed
          ctx.beginPath();
          for (let i = 0; i <= lobes; i++) {
            const a = (i / lobes) * Math.PI * 2;
            // Alternate between large and small radii for blobby splat shape
            const lobeMul = i % 2 === 0 ? 1.0 : 0.5 + (Math.sin(i * 3.7 + p.rotation) * 0.3);
            const r = p.size * lobeMul;
            const bx = Math.cos(a) * r;
            const by = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(bx, by);
            else {
              // Bezier for smooth blobby edges
              const cp = p.size * 0.4;
              ctx.quadraticCurveTo(
                Math.cos(a - 0.3) * (r + cp),
                Math.sin(a - 0.3) * (r + cp),
                bx, by
              );
            }
          }
          ctx.closePath();
          ctx.fill();

          // Drip tendril — short tail hanging down from blob
          const dripLen = p.size * 1.2;
          ctx.beginPath();
          ctx.moveTo(0, p.size * 0.3);
          ctx.quadraticCurveTo(p.size * 0.15, p.size * 0.5 + dripLen * 0.5, 0, p.size * 0.3 + dripLen);
          ctx.lineWidth = Math.max(0.5, p.size * 0.2);
          ctx.stroke();

          // Small satellite droplet
          ctx.beginPath();
          ctx.arc(p.size * 0.8, -p.size * 0.6, p.size * 0.25, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }

      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /** Get active particle count (for perf monitoring) */
  get count(): number {
    return this.particles.length;
  }

  /** Kill all particles */
  clear(): void {
    this.particles = [];
  }

  /** Manual emit by effect name + world position (for dev custom effects) */
  burst(effectName: string, x: number, y: number): void {
    this.emit(effectName, x, y, true);
  }

  /** List all available effect names */
  static getEffectNames(): string[] {
    return Object.keys(EFFECTS);
  }
}
