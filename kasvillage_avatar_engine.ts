// ============================================================================
// KasVillage 2.5D Avatar Engine
// Takes avatar SVG paths + RACE_BODY_PARAMS → 60 angles × 6 poses = 360 sprites
// Puppet hook system with procedural physics + camera modes
// ============================================================================

import { Race, Gender } from './avatar_silhouette_generator';

// ============================================================================
// STEP 1: Joint Derivation from RACE_BODY_PARAMS
// ============================================================================

/** 8 puppet joints in absolute SVG coordinates */
export interface JointSet {
  head: { x: number; y: number };
  shoulder_L: { x: number; y: number };
  shoulder_R: { x: number; y: number };
  hip_L: { x: number; y: number };
  hip_R: { x: number; y: number };
  hand_L: { x: number; y: number };
  hand_R: { x: number; y: number };
  foot_L: { x: number; y: number };
  foot_R: { x: number; y: number };
  center_mass: { x: number; y: number };
}

/** Race body params matching Expo_identity_ritual.tsx RACE_BODY_PARAMS */
interface RaceParams {
  shoulderWidth: number;
  torsoY: number;
  torsoScale: number;
}

// Canonical race body params (mirrored from Expo_identity_ritual.tsx)
const RACE_BODY_PARAMS: Record<string, { male: RaceParams; female: RaceParams }> = {
  human:     { male: { shoulderWidth: 1.15, torsoY: 330, torsoScale: 1.0 },   female: { shoulderWidth: 0.92, torsoY: 330, torsoScale: 0.95 } },
  cyborg:    { male: { shoulderWidth: 1.15, torsoY: 330, torsoScale: 1.0 },   female: { shoulderWidth: 0.92, torsoY: 330, torsoScale: 0.95 } },
  mutant:    { male: { shoulderWidth: 1.2,  torsoY: 330, torsoScale: 1.05 },  female: { shoulderWidth: 1.0,  torsoY: 330, torsoScale: 1.0 } },
  ethereal:  { male: { shoulderWidth: 0.95, torsoY: 330, torsoScale: 0.9 },   female: { shoulderWidth: 0.8,  torsoY: 330, torsoScale: 0.85 } },
  beast:     { male: { shoulderWidth: 1.3,  torsoY: 310, torsoScale: 1.15 },  female: { shoulderWidth: 1.1,  torsoY: 310, torsoScale: 1.1 } },
  elf:       { male: { shoulderWidth: 1.0,  torsoY: 119, torsoScale: 0.95 },  female: { shoulderWidth: 0.85, torsoY: 119, torsoScale: 0.9 } },
  darkelf:   { male: { shoulderWidth: 1.0,  torsoY: 119, torsoScale: 0.95 },  female: { shoulderWidth: 0.85, torsoY: 119, torsoScale: 0.9 } },
  dwarf:     { male: { shoulderWidth: 1.1,  torsoY: 119, torsoScale: 0.85 },  female: { shoulderWidth: 0.95, torsoY: 119, torsoScale: 0.8 } },
  alien:     { male: { shoulderWidth: 0.9,  torsoY: 119, torsoScale: 0.88 },  female: { shoulderWidth: 0.8,  torsoY: 119, torsoScale: 0.85 } },
  orc:       { male: { shoulderWidth: 1.25, torsoY: 122, torsoScale: 1.1 },   female: { shoulderWidth: 1.05, torsoY: 122, torsoScale: 1.05 } },
  halfling:  { male: { shoulderWidth: 0.85, torsoY: 122, torsoScale: 0.75 },  female: { shoulderWidth: 0.75, torsoY: 122, torsoScale: 0.7 } },
  golem:     { male: { shoulderWidth: 1.4,  torsoY: 113, torsoScale: 1.25 },  female: { shoulderWidth: 1.2,  torsoY: 113, torsoScale: 1.2 } },
  elemental: { male: { shoulderWidth: 1.15, torsoY: 113, torsoScale: 1.0 },   female: { shoulderWidth: 0.95, torsoY: 113, torsoScale: 0.95 } },
  undead:    { male: { shoulderWidth: 1.0,  torsoY: 113, torsoScale: 0.92 },  female: { shoulderWidth: 0.85, torsoY: 113, torsoScale: 0.88 } },
  giant:     { male: { shoulderWidth: 1.35, torsoY: 107, torsoScale: 1.2 },   female: { shoulderWidth: 1.15, torsoY: 107, torsoScale: 1.15 } },
  merfolk:   { male: { shoulderWidth: 1.05, torsoY: 107, torsoScale: 0.95 },  female: { shoulderWidth: 0.9,  torsoY: 107, torsoScale: 0.9 } },
  centaur:   { male: { shoulderWidth: 1.2,  torsoY: 107, torsoScale: 1.1 },   female: { shoulderWidth: 1.0,  torsoY: 107, torsoScale: 1.05 } },
  troll:     { male: { shoulderWidth: 1.3,  torsoY: 119, torsoScale: 1.15 },  female: { shoulderWidth: 1.1,  torsoY: 119, torsoScale: 1.1 } },
  gnome:     { male: { shoulderWidth: 0.8,  torsoY: 115, torsoScale: 0.72 },  female: { shoulderWidth: 0.7,  torsoY: 115, torsoScale: 0.68 } },
  phoenix:   { male: { shoulderWidth: 1.0,  torsoY: 115, torsoScale: 0.9 },   female: { shoulderWidth: 0.85, torsoY: 115, torsoScale: 0.85 } },
  sprite:    { male: { shoulderWidth: 0.6,  torsoY: 115, torsoScale: 0.55 },  female: { shoulderWidth: 0.55, torsoY: 115, torsoScale: 0.5 } },
  vampire:   { male: { shoulderWidth: 1.05, torsoY: 117, torsoScale: 0.98 },  female: { shoulderWidth: 0.88, torsoY: 117, torsoScale: 0.93 } },
  werewolf:  { male: { shoulderWidth: 1.25, torsoY: 117, torsoScale: 1.1 },   female: { shoulderWidth: 1.05, torsoY: 117, torsoScale: 1.05 } },
  angel:     { male: { shoulderWidth: 1.1,  torsoY: 117, torsoScale: 1.0 },   female: { shoulderWidth: 0.9,  torsoY: 117, torsoScale: 0.95 } },
  dragonkin: { male: { shoulderWidth: 1.2,  torsoY: 118, torsoScale: 1.05 },  female: { shoulderWidth: 1.0,  torsoY: 118, torsoScale: 1.0 } },
  fae:       { male: { shoulderWidth: 0.75, torsoY: 118, torsoScale: 0.7 },   female: { shoulderWidth: 0.65, torsoY: 118, torsoScale: 0.65 } },
};

/**
 * Derive absolute joint positions from race + gender.
 * All coordinates in the avatar's 400×450 SVG space.
 * Internal generators (human/cyborg/mutant/ethereal/beast) use torsoY ~310-330 range.
 * External generators (elf/orc/etc) use torsoY ~107-122 range.
 */
export function deriveJoints(race: Race, gender: Gender): JointSet {
  const entry = RACE_BODY_PARAMS[race] || RACE_BODY_PARAMS.human;
  const p = entry[gender];
  const cx = 200; // SVG center X

  // Base shoulder width in SVG units (58 is reference for internal generators)
  const baseShoulderPx = 58;
  const shoulderW = baseShoulderPx * p.shoulderWidth;

  // Torso geometry — derived from generator patterns
  const torsoTop = p.torsoY;
  const torsoH = 88 * p.torsoScale;
  const hipW = (36 * (gender === 'male' ? 0.88 : 1.08)) * p.torsoScale;

  // Arm geometry from generators
  const armStartY = torsoTop + 18 * p.torsoScale;
  const upperArmL = 46 * p.torsoScale;
  const forearmL = 42 * p.torsoScale;

  // Leg geometry
  const legTop = torsoTop + torsoH + 5;
  const thighL = 58 * p.torsoScale;
  const calfL = 54 * p.torsoScale;

  // Head position — roughly torsoTop minus neck(25) minus head(46)
  const headY = torsoTop - 25 * p.torsoScale - 46 * 0.5;

  return {
    head:       { x: cx, y: headY },
    shoulder_L: { x: cx - shoulderW, y: armStartY },
    shoulder_R: { x: cx + shoulderW, y: armStartY },
    hip_L:      { x: cx - hipW * 0.5, y: legTop },
    hip_R:      { x: cx + hipW * 0.5, y: legTop },
    hand_L:     { x: cx - shoulderW - 7, y: armStartY + upperArmL + forearmL },
    hand_R:     { x: cx + shoulderW + 7, y: armStartY + upperArmL + forearmL },
    foot_L:     { x: cx - hipW * 0.4, y: legTop + thighL + calfL },
    foot_R:     { x: cx + hipW * 0.4, y: legTop + thighL + calfL },
    center_mass:{ x: cx, y: torsoTop + torsoH * 0.4 },
  };
}

// ============================================================================
// STEP 2: Path-to-Body-Part Depth Mapping
// ============================================================================

export type BodyRegion = 'hair' | 'head' | 'eyes' | 'face' | 'neck' | 'torso' | 'arm_L' | 'arm_R' | 'leg_L' | 'leg_R' | 'hand' | 'foot' | 'accessory';

/** Z-depth layers for 2.5D rendering */
export const Z_LAYERS = {
  shadow:      0,   // Background shadow/aura
  back_limbs:  1,   // Back arm + back leg (away from camera)
  body:        2,   // Torso, head, neck
  front_limbs: 3,   // Front arm + front leg (toward camera)
  overlay:     4,   // Hair, accessories, weapon, effects
} as const;

/** Region-to-Z mapping for front-facing (S) view */
const REGION_Z_FRONT: Record<string, number> = {
  hair:      Z_LAYERS.overlay,
  eyes:      Z_LAYERS.body,
  eyebrows:  Z_LAYERS.body,
  lips:      Z_LAYERS.body,
  skin:      Z_LAYERS.body,
  primary:   Z_LAYERS.body,      // torso
  secondary: Z_LAYERS.front_limbs, // legs (front by default)
  accent:    Z_LAYERS.front_limbs, // feet
};

export interface DepthPath {
  d: string;
  region: string;
  zLayer: number;
  side: 'left' | 'right' | 'center'; // for per-angle visibility
  pathIndex: number;
}

/**
 * Enhanced region assignment that adds left/right side detection.
 * Uses path X-centroid relative to avatar center (cx=200).
 */
export function classifyPathDepth(
  d: string,
  pathIndex: number,
  totalPaths: number,
  region: string
): DepthPath {
  // Determine left/right by X centroid
  const xVals: number[] = [];
  const mlMatches = d.matchAll(/[ML]\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/g);
  for (const m of mlMatches) {
    const x = parseFloat(m[1]);
    if (!isNaN(x)) xVals.push(x);
  }
  const xCenter = xVals.length > 0
    ? xVals.reduce((a, b) => a + b, 0) / xVals.length
    : 200;

  const side: 'left' | 'right' | 'center' =
    xCenter < 185 ? 'left' : xCenter > 215 ? 'right' : 'center';

  const zLayer = REGION_Z_FRONT[region] ?? Z_LAYERS.body;

  return { d, region, zLayer, side, pathIndex };
}

// ============================================================================
// STEP 3: Angle Projection (0°-359° → joint positions + path visibility)
// ============================================================================

/** Which paths are visible + their Z-order at a given camera angle */
export interface AngleProjection {
  angle: number;
  joints: JointSet;
  /** Per-path visibility: true = draw this path */
  pathVisible: boolean[];
  /** Per-path Z override (some paths swap layers at certain angles) */
  pathZ: number[];
}

/**
 * Project front + side joint sets to any angle.
 * 0° = S (front), 90° = E (right side), 180° = N (back), 270° = W (left side)
 */
export function projectAngle(
  angleDeg: number,
  frontJoints: JointSet,
  sideJoints: JointSet,
  depthPaths: DepthPath[]
): AngleProjection {
  const rad = (angleDeg * Math.PI) / 180;
  const cx = 200;

  // cos determines front/back blend, sin determines side compression
  const cosA = Math.cos(rad);  // 1 at 0° (front), -1 at 180° (back)
  const sinA = Math.sin(rad);  // 0 at 0°, 1 at 90° (right), -1 at 270° (left)

  const absCos = Math.abs(cosA);
  const absSin = Math.abs(sinA);

  // Interpolate joints between front and side positions
  const lerpJoint = (front: { x: number; y: number }, side: { x: number; y: number }) => ({
    x: front.x * absCos + side.x * absSin,
    y: front.y * absCos + side.y * absSin,
  });

  // For side views, compress X spread toward center
  const compressX = (joint: { x: number; y: number }) => ({
    x: cx + (joint.x - cx) * absCos + (joint.x - cx) * absSin * 0.3,
    y: joint.y,
  });

  const joints: JointSet = {
    head:       compressX(lerpJoint(frontJoints.head, sideJoints.head)),
    shoulder_L: compressX(lerpJoint(frontJoints.shoulder_L, sideJoints.shoulder_L)),
    shoulder_R: compressX(lerpJoint(frontJoints.shoulder_R, sideJoints.shoulder_R)),
    hip_L:      compressX(lerpJoint(frontJoints.hip_L, sideJoints.hip_L)),
    hip_R:      compressX(lerpJoint(frontJoints.hip_R, sideJoints.hip_R)),
    hand_L:     compressX(lerpJoint(frontJoints.hand_L, sideJoints.hand_L)),
    hand_R:     compressX(lerpJoint(frontJoints.hand_R, sideJoints.hand_R)),
    foot_L:     compressX(lerpJoint(frontJoints.foot_L, sideJoints.foot_L)),
    foot_R:     compressX(lerpJoint(frontJoints.foot_R, sideJoints.foot_R)),
    center_mass:compressX(lerpJoint(frontJoints.center_mass, sideJoints.center_mass)),
  };

  // Path visibility based on angle
  const pathVisible: boolean[] = [];
  const pathZ: number[] = [];
  const isFacingRight = sinA > 0;   // E hemisphere
  const isFacingBack = cosA < 0;    // N hemisphere

  for (const dp of depthPaths) {
    let visible = true;
    let z = dp.zLayer;

    // Side facing: hide far-side limbs
    if (absSin > 0.3) {
      if (isFacingRight && dp.side === 'left' && (dp.region === 'secondary' || dp.region === 'accent')) {
        z = Z_LAYERS.back_limbs; // left limbs go behind when facing right
      }
      if (!isFacingRight && dp.side === 'right' && (dp.region === 'secondary' || dp.region === 'accent')) {
        z = Z_LAYERS.back_limbs;
      }
    }

    // Back facing: hide face details, show back of head
    if (isFacingBack) {
      if (dp.region === 'eyes' || dp.region === 'eyebrows' || dp.region === 'lips') {
        visible = false;
      }
    }

    // At extreme side angles (>70°), hide far-side paths
    if (absSin > 0.94) {
      if ((isFacingRight && dp.side === 'left') || (!isFacingRight && dp.side === 'right')) {
        visible = false;
      }
    }

    pathVisible.push(visible);
    pathZ.push(z);
  }

  return { angle: angleDeg, joints, pathVisible, pathZ };
}

/**
 * Derive side-view joints from front joints (compress X by 70%)
 */
export function deriveSideJoints(frontJoints: JointSet): JointSet {
  const cx = 200;
  const compress = (j: { x: number; y: number }) => ({
    x: cx + (j.x - cx) * 0.3,
    y: j.y,
  });
  return {
    head:       compress(frontJoints.head),
    shoulder_L: compress(frontJoints.shoulder_L),
    shoulder_R: compress(frontJoints.shoulder_R),
    hip_L:      compress(frontJoints.hip_L),
    hip_R:      compress(frontJoints.hip_R),
    hand_L:     compress(frontJoints.hand_L),
    hand_R:     compress(frontJoints.hand_R),
    foot_L:     compress(frontJoints.foot_L),
    foot_R:     compress(frontJoints.foot_R),
    center_mass:compress(frontJoints.center_mass),
  };
}

// ============================================================================
// STEP 4 + 5: Pre-render Pipeline (SVG paths → Canvas sprites)
// ============================================================================

/** Sprite size in pixels */
export const SPRITE_SIZE = 128;

/** Total angles to pre-render */
export const TOTAL_ANGLES = 60;

/** Degrees per angle step */
export const ANGLE_STEP = 360 / TOTAL_ANGLES; // 6°

export type AnimationPose =
  // Locomotion
  | 'idle' | 'idle_combat'
  | 'walk1' | 'walk2'
  | 'run1' | 'run2'
  | 'sprint1' | 'sprint2'
  // Vertical
  | 'jump_squat' | 'jump' | 'jump_apex' | 'fall' | 'land_light' | 'land_heavy'
  // Combat
  | 'attack' | 'attack_wind' | 'attack_follow'
  | 'block' | 'hit_stagger'
  // Traversal
  | 'crouch' | 'dodge_roll' | 'wall_climb' | 'slide'
  // Emotes
  | 'wave' | 'sit';

type JointOffsets = Partial<Record<keyof JointSet, { x: number; y: number }>>;

/** Joint offsets for each pose (relative to base position) */
const POSE_OFFSETS: Record<AnimationPose, (j: JointSet, t: number) => JointOffsets> = {

  // === IDLE — breathing, subtle weight shift ===
  idle: (_j, t) => {
    const breath = Math.sin(t * 2);
    return {
      center_mass: { x: 0, y: breath * 1.5 },
      shoulder_L:  { x: 0, y: breath * 0.5 },
      shoulder_R:  { x: 0, y: breath * 0.5 },
      head:        { x: Math.sin(t * 0.7) * 0.5, y: breath * 0.3 },
      hand_L:      { x: Math.sin(t * 1.1) * 1, y: breath * 0.8 },
      hand_R:      { x: Math.sin(t * 1.3) * -1, y: breath * 0.8 },
    };
  },

  // === IDLE COMBAT — knees bent, hands up, bouncing on balls of feet ===
  idle_combat: (_j, t) => {
    const bounce = Math.sin(t * 4) * 2;
    return {
      center_mass: { x: 0, y: 6 + bounce },
      head:        { x: 0, y: 2 + bounce * 0.3 },
      shoulder_L:  { x: 4, y: -8 + bounce * 0.5 },
      shoulder_R:  { x: -4, y: -8 + bounce * 0.5 },
      hand_L:      { x: 10, y: -18 + bounce },
      hand_R:      { x: -10, y: -16 + bounce },
      hip_L:       { x: -3, y: 4 },
      hip_R:       { x: 3, y: 4 },
      foot_L:      { x: -6, y: 2 },
      foot_R:      { x: 6, y: 2 },
    };
  },

  // === WALK — contact pose, left foot strike ===
  walk1: (_j, _t) => ({
    hip_L:       { x: 2, y: -8 },    // left leg forward, planted
    hip_R:       { x: -2, y: 6 },    // right leg trailing
    foot_L:      { x: 10, y: -4 },   // left foot ahead on ground
    foot_R:      { x: -8, y: 2 },    // right foot behind, toe push
    shoulder_L:  { x: -2, y: 3 },    // counter-swing: left arm back
    shoulder_R:  { x: 2, y: -3 },    // right arm forward
    hand_L:      { x: -8, y: 6 },
    hand_R:      { x: 8, y: -6 },
    center_mass: { x: 1, y: -2 },    // slight forward lean
    head:        { x: 0.5, y: -1 },
  }),

  // === WALK — passing pose, right foot strike ===
  walk2: (_j, _t) => ({
    hip_L:       { x: -2, y: 6 },
    hip_R:       { x: 2, y: -8 },
    foot_L:      { x: -8, y: 2 },
    foot_R:      { x: 10, y: -4 },
    shoulder_L:  { x: 2, y: -3 },
    shoulder_R:  { x: -2, y: 3 },
    hand_L:      { x: 8, y: -6 },
    hand_R:      { x: -8, y: 6 },
    center_mass: { x: -1, y: -2 },
    head:        { x: -0.5, y: -1 },
  }),

  // === RUN — Aloy/AC stride, aggressive forward lean, high knee ===
  run1: (_j, _t) => ({
    hip_L:       { x: 3, y: -14 },   // left knee drives high
    hip_R:       { x: -3, y: 10 },   // right leg pushes back hard
    foot_L:      { x: 16, y: -22 },  // left foot well ahead, off ground
    foot_R:      { x: -16, y: 6 },   // right foot pushing off
    shoulder_L:  { x: -3, y: 5 },    // aggressive counter-swing
    shoulder_R:  { x: 3, y: -6 },
    hand_L:      { x: -14, y: 10 },  // arms pump hard
    hand_R:      { x: 14, y: -12 },
    center_mass: { x: 4, y: -6 },    // strong forward lean
    head:        { x: 3, y: -4 },    // head leads the body
  }),

  // === RUN — opposite stride ===
  run2: (_j, _t) => ({
    hip_L:       { x: -3, y: 10 },
    hip_R:       { x: 3, y: -14 },
    foot_L:      { x: -16, y: 6 },
    foot_R:      { x: 16, y: -22 },
    shoulder_L:  { x: 3, y: -6 },
    shoulder_R:  { x: -3, y: 5 },
    hand_L:      { x: 14, y: -12 },
    hand_R:      { x: -14, y: 10 },
    center_mass: { x: -4, y: -6 },
    head:        { x: -3, y: -4 },
  }),

  // === SPRINT — Spider-Man full tilt, body almost horizontal ===
  sprint1: (_j, _t) => ({
    hip_L:       { x: 5, y: -18 },
    hip_R:       { x: -5, y: 14 },
    foot_L:      { x: 22, y: -30 },  // extreme knee drive
    foot_R:      { x: -20, y: 8 },
    shoulder_L:  { x: -5, y: 8 },
    shoulder_R:  { x: 5, y: -10 },
    hand_L:      { x: -18, y: 14 },
    hand_R:      { x: 18, y: -18 },
    center_mass: { x: 8, y: -10 },   // deep forward lean
    head:        { x: 6, y: -7 },
  }),

  sprint2: (_j, _t) => ({
    hip_L:       { x: -5, y: 14 },
    hip_R:       { x: 5, y: -18 },
    foot_L:      { x: -20, y: 8 },
    foot_R:      { x: 22, y: -30 },
    shoulder_L:  { x: 5, y: -10 },
    shoulder_R:  { x: -5, y: 8 },
    hand_L:      { x: 18, y: -18 },
    hand_R:      { x: -18, y: 14 },
    center_mass: { x: -8, y: -10 },
    head:        { x: -6, y: -7 },
  }),

  // === JUMP SQUAT — anticipation frame, coiled spring ===
  jump_squat: (_j, _t) => ({
    center_mass: { x: 0, y: 12 },    // body drops
    head:        { x: 0, y: 6 },
    shoulder_L:  { x: 2, y: 8 },     // arms pull back
    shoulder_R:  { x: -2, y: 8 },
    hand_L:      { x: 6, y: 14 },
    hand_R:      { x: -6, y: 14 },
    hip_L:       { x: -4, y: 10 },   // knees bend deep
    hip_R:       { x: 4, y: 10 },
    foot_L:      { x: -6, y: 4 },
    foot_R:      { x: 6, y: 4 },
  }),

  // === JUMP — launch, arms swing up, legs tuck ===
  jump: (_j, _t) => ({
    center_mass: { x: 0, y: -22 },
    head:        { x: 0, y: -6 },
    shoulder_L:  { x: -5, y: -10 },  // arms thrust upward
    shoulder_R:  { x: 5, y: -10 },
    hand_L:      { x: -10, y: -20 },
    hand_R:      { x: 10, y: -20 },
    hip_L:       { x: -3, y: -8 },
    hip_R:       { x: 3, y: -8 },
    foot_L:      { x: -5, y: -16 },  // legs tuck
    foot_R:      { x: 5, y: -16 },
  }),

  // === JUMP APEX — hang time, Spider-Man spread ===
  jump_apex: (_j, _t) => ({
    center_mass: { x: 0, y: -28 },
    head:        { x: 0, y: -8 },
    shoulder_L:  { x: -8, y: -6 },   // arms spread wide
    shoulder_R:  { x: 8, y: -6 },
    hand_L:      { x: -16, y: -10 },
    hand_R:      { x: 16, y: -10 },
    hip_L:       { x: -5, y: -4 },   // legs extend slightly
    hip_R:       { x: 5, y: -4 },
    foot_L:      { x: -8, y: -8 },
    foot_R:      { x: 8, y: -8 },
  }),

  // === FALL — limbs trail upward, body drops ===
  fall: (_j, _t) => ({
    center_mass: { x: 0, y: -14 },
    head:        { x: 0, y: -5 },
    shoulder_L:  { x: -4, y: -10 },  // arms float up (drag)
    shoulder_R:  { x: 4, y: -10 },
    hand_L:      { x: -8, y: -18 },  // hands trail behind
    hand_R:      { x: 8, y: -18 },
    hip_L:       { x: -2, y: -3 },
    hip_R:       { x: 2, y: -3 },
    foot_L:      { x: -4, y: -10 },  // legs dangle
    foot_R:      { x: 4, y: -10 },
  }),

  // === LAND LIGHT — soft landing, one knee dips (AC parkour) ===
  land_light: (_j, _t) => ({
    center_mass: { x: 0, y: 8 },
    head:        { x: 0, y: 3 },
    shoulder_L:  { x: 2, y: 4 },
    shoulder_R:  { x: -2, y: 4 },
    hand_L:      { x: 4, y: 6 },
    hand_R:      { x: -4, y: 6 },
    hip_L:       { x: -3, y: 8 },    // left knee absorbs
    hip_R:       { x: 3, y: 4 },
    foot_L:      { x: -4, y: 2 },
    foot_R:      { x: 6, y: 0 },
  }),

  // === LAND HEAVY — Horizon superhero landing, fist down ===
  land_heavy: (_j, _t) => ({
    center_mass: { x: 2, y: 16 },    // deep drop
    head:        { x: 2, y: 8 },     // head ducks
    shoulder_L:  { x: 4, y: 10 },
    shoulder_R:  { x: -6, y: 6 },    // right fist reaches for ground
    hand_L:      { x: 8, y: 16 },
    hand_R:      { x: -10, y: 20 },  // fist on ground
    hip_L:       { x: -6, y: 14 },   // deep knee bend
    hip_R:       { x: 4, y: 12 },
    foot_L:      { x: -10, y: 4 },   // left leg splayed
    foot_R:      { x: 8, y: 2 },
  }),

  // === ATTACK WIND-UP — pull back, coil, anticipation ===
  attack_wind: (_j, _t) => ({
    center_mass: { x: -4, y: 2 },    // body coils back
    head:        { x: -3, y: 0 },    // eyes on target
    shoulder_L:  { x: 4, y: 2 },     // left guards
    shoulder_R:  { x: -10, y: -4 },  // right arm pulls WAY back
    hand_L:      { x: 8, y: 4 },
    hand_R:      { x: -20, y: -8 },  // weapon cocked behind head
    hip_L:       { x: -2, y: 2 },    // slight squat
    hip_R:       { x: 2, y: 2 },
    foot_L:      { x: -4, y: 0 },
    foot_R:      { x: 4, y: 0 },
  }),

  // === ATTACK — strike, full extension ===
  attack: (_j, _t) => ({
    center_mass: { x: 6, y: -2 },    // body snaps forward
    head:        { x: 4, y: -2 },
    shoulder_L:  { x: -2, y: 2 },    // left pulls back for balance
    shoulder_R:  { x: 12, y: -8 },   // right drives through
    hand_L:      { x: -6, y: 6 },
    hand_R:      { x: 24, y: -18 },  // full extension, weapon strikes
    hip_L:       { x: -2, y: 0 },
    hip_R:       { x: 4, y: -2 },    // right hip drives into swing
    foot_L:      { x: -6, y: 0 },    // left plants
    foot_R:      { x: 8, y: -4 },    // right pivots
  }),

  // === ATTACK FOLLOW-THROUGH — momentum carries past target ===
  attack_follow: (_j, _t) => ({
    center_mass: { x: 8, y: 0 },
    head:        { x: 5, y: 0 },
    shoulder_L:  { x: -4, y: 4 },
    shoulder_R:  { x: 8, y: 4 },     // arm sweeps past, dropping
    hand_L:      { x: -8, y: 8 },
    hand_R:      { x: 16, y: 6 },    // weapon past the target, low
    hip_L:       { x: -2, y: 2 },
    hip_R:       { x: 4, y: 0 },
    foot_L:      { x: -6, y: 0 },
    foot_R:      { x: 10, y: -2 },
  }),

  // === BLOCK — shield/arm up, knees bent, braced ===
  block: (_j, _t) => ({
    center_mass: { x: -2, y: 6 },
    head:        { x: -2, y: 4 },    // ducks behind guard
    shoulder_L:  { x: 6, y: -6 },    // left arm raises shield/guard
    shoulder_R:  { x: -2, y: 0 },
    hand_L:      { x: 12, y: -14 },  // shield high
    hand_R:      { x: -4, y: 2 },    // weapon low, ready
    hip_L:       { x: -2, y: 6 },
    hip_R:       { x: 2, y: 4 },
    foot_L:      { x: -4, y: 2 },
    foot_R:      { x: 6, y: 0 },
  }),

  // === HIT STAGGER — recoil, head snaps back ===
  hit_stagger: (_j, _t) => ({
    center_mass: { x: -6, y: 4 },    // body rocks backward
    head:        { x: -8, y: -2 },   // head whips back
    shoulder_L:  { x: -4, y: 2 },    // arms fling
    shoulder_R:  { x: -6, y: 4 },
    hand_L:      { x: -8, y: 6 },
    hand_R:      { x: -10, y: 8 },
    hip_L:       { x: -2, y: 4 },    // weight shifts back
    hip_R:       { x: 0, y: 6 },
    foot_L:      { x: -4, y: 2 },    // stumble
    foot_R:      { x: 2, y: -2 },    // right foot lifts
  }),

  // === CROUCH — stealth, AC/Horizon ===
  crouch: (_j, t) => {
    const sway = Math.sin(t * 1.5) * 0.5;
    return {
      center_mass: { x: sway, y: 18 },     // deep crouch
      head:        { x: sway * 2, y: 10 },  // head forward, scanning
      shoulder_L:  { x: 2, y: 10 },
      shoulder_R:  { x: -2, y: 10 },
      hand_L:      { x: 4, y: 14 },
      hand_R:      { x: -4, y: 14 },
      hip_L:       { x: -6, y: 16 },        // knees wide, deep bend
      hip_R:       { x: 6, y: 16 },
      foot_L:      { x: -8, y: 6 },
      foot_R:      { x: 8, y: 6 },
    };
  },

  // === DODGE ROLL — AC/Spider-Man tuck, full body rotation ===
  dodge_roll: (_j, _t) => ({
    center_mass: { x: 12, y: 10 },   // body shoots sideways + drops
    head:        { x: 10, y: 14 },   // head tucks into chest
    shoulder_L:  { x: 8, y: 12 },    // arms wrap body
    shoulder_R:  { x: 6, y: 14 },
    hand_L:      { x: 4, y: 16 },    // hands near knees
    hand_R:      { x: 8, y: 18 },
    hip_L:       { x: 6, y: 12 },    // legs tuck
    hip_R:       { x: 10, y: 10 },
    foot_L:      { x: 4, y: 14 },    // feet over head
    foot_R:      { x: 8, y: 12 },
  }),

  // === WALL CLIMB — Spider-Man/AC, reaching up ===
  wall_climb: (_j, _t) => ({
    center_mass: { x: 0, y: -8 },
    head:        { x: 0, y: -10 },   // looking up
    shoulder_L:  { x: -4, y: -16 },  // left arm reaches high
    shoulder_R:  { x: 4, y: -4 },    // right arm lower, gripping
    hand_L:      { x: -6, y: -28 },  // left hand at apex
    hand_R:      { x: 6, y: -10 },   // right hand mid-wall
    hip_L:       { x: -2, y: -4 },   // legs stagger
    hip_R:       { x: 2, y: 4 },
    foot_L:      { x: -4, y: -8 },   // left foot high, planted
    foot_R:      { x: 4, y: 4 },     // right foot pushing
  }),

  // === SLIDE — Horizon/Spider-Man ground slide under obstacle ===
  slide: (_j, _t) => ({
    center_mass: { x: 6, y: 20 },    // low to ground
    head:        { x: 8, y: 14 },    // leaned back
    shoulder_L:  { x: 2, y: 16 },    // left arm back for balance
    shoulder_R:  { x: -4, y: 12 },   // right arm trailing
    hand_L:      { x: -4, y: 20 },   // hand touches ground
    hand_R:      { x: -8, y: 16 },
    hip_L:       { x: 4, y: 18 },    // left leg extended forward
    hip_R:       { x: -2, y: 20 },   // right leg tucked
    foot_L:      { x: 14, y: 14 },   // lead foot out front
    foot_R:      { x: -4, y: 18 },   // back foot drags
  }),

  // === WAVE — emote ===
  wave: (_j, t) => ({
    center_mass: { x: 0, y: Math.sin(t * 2) * 1 },
    shoulder_R:  { x: 4, y: -12 },
    hand_R:      { x: 10 + Math.sin(t * 6) * 4, y: -24 },  // hand waves side to side
    head:        { x: Math.sin(t * 3) * 1, y: -1 },
  }),

  // === SIT — emote ===
  sit: (_j, t) => {
    const breath = Math.sin(t * 1.5) * 0.8;
    return {
      center_mass: { x: 0, y: 22 + breath },
      head:        { x: 0, y: 14 + breath },
      shoulder_L:  { x: 2, y: 14 },
      shoulder_R:  { x: -2, y: 14 },
      hand_L:      { x: 6, y: 20 },   // hands on knees
      hand_R:      { x: -6, y: 20 },
      hip_L:       { x: -6, y: 18 },  // legs bent 90°
      hip_R:       { x: 6, y: 18 },
      foot_L:      { x: -8, y: 10 },  // feet forward on ground
      foot_R:      { x: 8, y: 10 },
    };
  },
};

// ============================================================================
// ANIMATION UTILITIES — lerp, trail, blend
// ============================================================================

/** Smooth interpolation between two joint sets. t=0 → from, t=1 → to */
export function lerpJoints(from: JointSet, to: JointSet, t: number): JointSet {
  // Smooth-step easing for organic feel (not linear)
  const s = t * t * (3 - 2 * t);
  const lerp = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: a.x + (b.x - a.x) * s,
    y: a.y + (b.y - a.y) * s,
  });
  return {
    head:        lerp(from.head, to.head),
    shoulder_L:  lerp(from.shoulder_L, to.shoulder_L),
    shoulder_R:  lerp(from.shoulder_R, to.shoulder_R),
    hip_L:       lerp(from.hip_L, to.hip_L),
    hip_R:       lerp(from.hip_R, to.hip_R),
    hand_L:      lerp(from.hand_L, to.hand_L),
    hand_R:      lerp(from.hand_R, to.hand_R),
    foot_L:      lerp(from.foot_L, to.foot_L),
    foot_R:      lerp(from.foot_R, to.foot_R),
    center_mass: lerp(from.center_mass, to.center_mass),
  };
}

/**
 * Secondary motion — makes a joint trail behind its parent by N frames.
 * Used for hair, cape, tail, dangly accessories.
 * prevPos = where the joint was last frame. Returns new position with drag.
 * drag: 0.0 = instant follow (stiff), 1.0 = maximum trail (floppy)
 */
export function trailJoint(
  targetPos: { x: number; y: number },
  prevPos: { x: number; y: number },
  drag: number = 0.7,
  gravity: number = 0.3,
): { x: number; y: number } {
  return {
    x: prevPos.x + (targetPos.x - prevPos.x) * (1 - drag),
    y: prevPos.y + (targetPos.y - prevPos.y) * (1 - drag) + gravity,
  };
}

/**
 * Blend two poses by weight. Useful for transitions:
 * blendPoses('run1', 'attack_wind', 0.3, joints, t) = 70% run + 30% wind-up
 */
export function blendPoses(
  poseA: AnimationPose,
  poseB: AnimationPose,
  blendWeight: number,
  baseJoints: JointSet,
  time: number,
): JointSet {
  const a = applyPose(baseJoints, poseA, time);
  const b = applyPose(baseJoints, poseB, time);
  return lerpJoints(a, b, blendWeight);
}

/**
 * Apply pose offsets to base joints.
 */
export function applyPose(
  baseJoints: JointSet,
  pose: AnimationPose,
  time: number = 0
): JointSet {
  const offsets = POSE_OFFSETS[pose](baseJoints, time);
  const result = { ...baseJoints };
  for (const [key, offset] of Object.entries(offsets)) {
    const k = key as keyof JointSet;
    if (result[k] && offset) {
      result[k] = {
        x: result[k].x + (offset.x || 0),
        y: result[k].y + (offset.y || 0),
      };
    }
  }
  return result;
}

// ============================================================================
// STEP 6: Procedural Physics Packages
// ============================================================================

export type PhysicsPackage = 'platformer' | 'topdown' | 'fighter';

interface PhysicsState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  facing: number; // angle in degrees
  pose: AnimationPose;
  animTime: number;
  walkFrame: number;
}

export function createPhysicsState(x: number, y: number): PhysicsState {
  return { x, y, vx: 0, vy: 0, grounded: true, facing: 0, pose: 'idle', animTime: 0, walkFrame: 0 };
}

interface PhysicsInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  attack: boolean;
  block: boolean;
  crouch: boolean;
  dodge: boolean;
  sprint: boolean;
}

const GRAVITY = 0.6;
const WALK_SPEED = 3;
const RUN_SPEED = 5;
const SPRINT_SPEED = 8;
const JUMP_FORCE = -12;
const LAND_RECOVERY_TIME = 0.15; // seconds in landing pose

export function updatePlatformer(state: PhysicsState, input: PhysicsInput, groundY: number, dt: number): PhysicsState {
  const s = { ...state };
  s.animTime += dt;

  // Track previous grounded state for landing detection
  const wasAirborne = !s.grounded;

  // Horizontal movement
  const speed = input.sprint ? SPRINT_SPEED : input.crouch ? WALK_SPEED * 0.4 : WALK_SPEED;
  if (input.left) { s.vx = -speed; s.facing = 270; }
  else if (input.right) { s.vx = speed; s.facing = 90; }
  else { s.vx *= 0.8; }

  // Jump — squat anticipation built into pose selection
  if (input.jump && s.grounded) {
    s.vy = JUMP_FORCE;
    s.grounded = false;
  }

  // Gravity
  if (!s.grounded) {
    s.vy += GRAVITY;
  }

  // Position update
  s.x += s.vx * dt;
  s.y += s.vy * dt;

  // Ground collision
  if (s.y >= groundY) {
    s.y = groundY;
    const landingForce = s.vy;
    s.vy = 0;
    s.grounded = true;

    // Landing detection — heavy vs light based on fall speed
    if (wasAirborne && landingForce > 8) {
      s.pose = 'land_heavy';
      s.walkFrame = -LAND_RECOVERY_TIME; // use walkFrame as recovery timer
    } else if (wasAirborne && landingForce > 3) {
      s.pose = 'land_light';
      s.walkFrame = -LAND_RECOVERY_TIME * 0.6;
    }
  }

  // Recovery timer (reuse walkFrame as timer when negative)
  if (s.walkFrame < 0) {
    s.walkFrame += dt;
    if (s.walkFrame < 0) return s; // still in recovery, keep current pose
    s.walkFrame = 0; // recovery done
  }

  // Pose selection — priority order
  if (input.dodge && s.grounded) {
    s.pose = 'dodge_roll';
  } else if (input.block) {
    s.pose = 'block';
  } else if (input.attack) {
    // 3-frame attack sequence based on animTime
    const attackPhase = (s.animTime * 8) % 3;
    if (attackPhase < 1) s.pose = 'attack_wind';
    else if (attackPhase < 2) s.pose = 'attack';
    else s.pose = 'attack_follow';
  } else if (!s.grounded) {
    // Airborne poses based on vertical velocity
    if (s.vy < -6) s.pose = 'jump';          // ascending fast
    else if (s.vy < 0) s.pose = 'jump_apex';  // near peak
    else s.pose = 'fall';                      // descending
  } else if (input.crouch) {
    s.pose = 'crouch';
  } else if (Math.abs(s.vx) > SPRINT_SPEED * 0.8) {
    // Sprinting — fast alternation
    s.walkFrame = (s.walkFrame + dt * 12) % 2;
    s.pose = s.walkFrame < 1 ? 'sprint1' : 'sprint2';
  } else if (Math.abs(s.vx) > RUN_SPEED * 0.6) {
    // Running
    s.walkFrame = (s.walkFrame + dt * 10) % 2;
    s.pose = s.walkFrame < 1 ? 'run1' : 'run2';
  } else if (Math.abs(s.vx) > 1) {
    // Walking
    s.walkFrame = (s.walkFrame + dt * 8) % 2;
    s.pose = s.walkFrame < 1 ? 'walk1' : 'walk2';
  } else {
    s.pose = 'idle';
  }

  return s;
}

export function updateTopdown(state: PhysicsState, input: PhysicsInput, dt: number): PhysicsState {
  const s = { ...state };
  s.animTime += dt;

  let dx = 0, dy = 0;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;

  const speed = input.sprint ? SPRINT_SPEED : input.crouch ? WALK_SPEED * 0.4 : WALK_SPEED;

  // Normalize diagonal
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 0) {
    dx /= len;
    dy /= len;
    s.facing = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    s.vx = dx * speed;
    s.vy = dy * speed;
    
    if (input.sprint) {
      s.walkFrame = (s.walkFrame + dt * 12) % 2;
      s.pose = s.walkFrame < 1 ? 'sprint1' : 'sprint2';
    } else if (speed > RUN_SPEED * 0.6) {
      s.walkFrame = (s.walkFrame + dt * 10) % 2;
      s.pose = s.walkFrame < 1 ? 'run1' : 'run2';
    } else {
      s.walkFrame = (s.walkFrame + dt * 8) % 2;
      s.pose = s.walkFrame < 1 ? 'walk1' : 'walk2';
    }
  } else {
    s.vx *= 0.8;
    s.vy *= 0.8;
    s.pose = input.crouch ? 'crouch' : 'idle';
  }

  if (input.dodge) s.pose = 'dodge_roll';
  if (input.block) s.pose = 'block';
  if (input.attack) {
    const attackPhase = (s.animTime * 8) % 3;
    if (attackPhase < 1) s.pose = 'attack_wind';
    else if (attackPhase < 2) s.pose = 'attack';
    else s.pose = 'attack_follow';
  }

  s.x += s.vx * dt;
  s.y += s.vy * dt;

  return s;
}

// ============================================================================
// STEP 7: Sprite Sheet API + Camera System
// ============================================================================

export type CameraMode = 'sideScroll' | 'isometric' | 'topDown' | 'orbit';

/** Camera configuration per mode */
const CAMERA_CONFIGS: Record<CameraMode, { defaultFacing: number; lockAngle: boolean }> = {
  sideScroll: { defaultFacing: 90, lockAngle: true },   // E/W only
  isometric:  { defaultFacing: 135, lockAngle: false },  // SE default, free rotation
  topDown:    { defaultFacing: 0, lockAngle: false },    // any direction
  orbit:      { defaultFacing: 0, lockAngle: false },    // player-controlled camera
};

/**
 * Snap an arbitrary angle to the nearest pre-rendered angle.
 */
export function snapToAngle(angleDeg: number): number {
  const normalized = ((angleDeg % 360) + 360) % 360;
  return Math.round(normalized / ANGLE_STEP) * ANGLE_STEP % 360;
}

/**
 * Get frame index in the sprite sheet: angle_index * 6 + pose_index
 */
/** Canonical ordered list of all poses for sprite sheet indexing */
export const ALL_POSES: AnimationPose[] = [
  'idle', 'idle_combat',
  'walk1', 'walk2',
  'run1', 'run2',
  'sprint1', 'sprint2',
  'jump_squat', 'jump', 'jump_apex', 'fall', 'land_light', 'land_heavy',
  'attack_wind', 'attack', 'attack_follow',
  'block', 'hit_stagger',
  'crouch', 'dodge_roll', 'wall_climb', 'slide',
  'wave', 'sit',
];

export const POSES_PER_ANGLE = ALL_POSES.length; // 25

export function getFrameIndex(angleDeg: number, pose: AnimationPose): number {
  const angleIdx = Math.round(snapToAngle(angleDeg) / ANGLE_STEP) % TOTAL_ANGLES;
  const poseIdx = ALL_POSES.indexOf(pose);
  return angleIdx * POSES_PER_ANGLE + Math.max(0, poseIdx);
}

/**
 * Total frames in a complete sprite sheet: 60 angles × 25 poses = 1500
 */
export const TOTAL_FRAMES = TOTAL_ANGLES * POSES_PER_ANGLE;

// ============================================================================
// MAIN SDK CLASS — the 10-line developer API
// ============================================================================

export interface AvatarData {
  paths: string[];
  colors: Record<string, string>;
  race: Race;
  gender: Gender;
}

export class KasVillageAvatar {
  readonly data: AvatarData;
  readonly frontJoints: JointSet;
  readonly sideJoints: JointSet;
  readonly depthPaths: DepthPath[];

  private physics: PhysicsState;
  private camera: CameraMode = 'sideScroll';
  private physicsPackage: PhysicsPackage = 'platformer';
  private _scale: number = 1.0;
  private _flipX: boolean = false;

  constructor(data: AvatarData) {
    this.data = data;
    this.frontJoints = deriveJoints(data.race, data.gender);
    this.sideJoints = deriveSideJoints(this.frontJoints);

    // Classify all paths with depth info
    // Uses the same assignPathRegion logic from Expo_identity_ritual
    this.depthPaths = data.paths.map((d, i) => {
      const region = this._assignRegion(d, i, data.paths.length);
      return classifyPathDepth(d, i, data.paths.length, region);
    });

    this.physics = createPhysicsState(200, 400);
  }

  /** Region assignment matching expo_identity_ritual assignPathRegion */
  private _assignRegion(d: string, idx: number, total: number): string {
    const yVals: number[] = [];
    const mlMatches = d.matchAll(/[ML]\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/g);
    for (const m of mlMatches) {
      const y = parseFloat(m[2]);
      if (!isNaN(y) && y > 0 && y < 1200) yVals.push(y);
    }
    const qMatches = d.matchAll(/Q\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/g);
    for (const m of qMatches) {
      const y = parseFloat(m[4]);
      if (!isNaN(y) && y > 0 && y < 1200) yVals.push(y);
    }
    const yCenter = yVals.length > 0
      ? yVals.reduce((a, b) => a + b, 0) / yVals.length
      : 300;

    if (idx < 3 && yCenter < 150) return 'hair';
    if (idx < 20 && yCenter < 80) return 'hair';
    if (yCenter < 270) {
      if (d.includes('A8,8') || d.includes('A3,3') || d.includes('A4,4') || d.includes('A5,5')) return 'eyes';
      if (yCenter > 120 && yCenter < 165 && d.length < 200) return 'eyes';
      if (yCenter > 95 && yCenter < 130 && d.length < 120) return 'eyebrows';
      if (yCenter < 100) return 'hair';
      if (yCenter > 195 && yCenter < 255 && d.length < 400) return 'lips';
      return 'skin';
    }
    if (yCenter < 340) return 'skin';
    if (yCenter < 600) return 'primary';
    if (yCenter < 750) return 'secondary';
    return 'accent';
  }

  // === Developer API ===

  static fromAvatarData(data: AvatarData): KasVillageAvatar {
    return new KasVillageAvatar(data);
  }

  setCamera(mode: CameraMode): void {
    this.camera = mode;
  }

  attachPhysics(pkg: PhysicsPackage): void {
    this.physicsPackage = pkg;
  }

  setPosition(x: number, y: number): void {
    this.physics.x = x;
    this.physics.y = y;
  }

  face(direction: 'north' | 'south' | 'east' | 'west'): void {
    const angles = { south: 0, east: 90, north: 180, west: 270 };
    this.physics.facing = angles[direction];
  }

  /** Scale the character (0.1 to 5.0). Default 1.0 = native SVG size (400×450). */
  setScale(scale: number): void {
    this._scale = Math.max(0.1, Math.min(5.0, scale));
  }

  /** Get current scale */
  getScale(): number {
    return this._scale;
  }

  /** Mirror character horizontally */
  setFlipX(flip: boolean): void {
    this._flipX = flip;
  }

  getFlipX(): boolean {
    return this._flipX;
  }

  update(dt: number, input: PhysicsInput, groundY: number = 400): void {
    if (this.physicsPackage === 'platformer') {
      this.physics = updatePlatformer(this.physics, input, groundY, dt);
    } else if (this.physicsPackage === 'topdown') {
      this.physics = updateTopdown(this.physics, input, dt);
    }
    // fighter = topdown + attack combos (extension point)
  }

  /** Get current render state for drawing */
  getRenderState(): {
    x: number;
    y: number;
    angle: number;
    pose: AnimationPose;
    frameIndex: number;
    scale: number;
    flipX: boolean;
    projection: AngleProjection;
  } {
    const angle = this.physics.facing;
    const pose = this.physics.pose;
    const frameIndex = getFrameIndex(angle, pose);
    const posedJoints = applyPose(
      projectAngle(angle, this.frontJoints, this.sideJoints, this.depthPaths).joints,
      pose,
      this.physics.animTime
    );

    return {
      x: this.physics.x,
      y: this.physics.y,
      angle,
      pose,
      frameIndex,
      scale: this._scale,
      flipX: this._flipX,
      projection: {
        angle,
        joints: posedJoints,
        pathVisible: projectAngle(angle, this.frontJoints, this.sideJoints, this.depthPaths).pathVisible,
        pathZ: projectAngle(angle, this.frontJoints, this.sideJoints, this.depthPaths).pathZ,
      },
    };
  }

  /** Get all depth paths sorted by Z for rendering */
  getDrawOrder(angle: number): DepthPath[] {
    const proj = projectAngle(angle, this.frontJoints, this.sideJoints, this.depthPaths);
    return this.depthPaths
      .map((dp, i) => ({ ...dp, zLayer: proj.pathZ[i], _visible: proj.pathVisible[i] }))
      .filter(dp => dp._visible)
      .sort((a, b) => a.zLayer - b.zLayer);
  }

  /** Pre-render all 60 angles × 6 poses = 360 frame indices */
  generateSpriteMap(): Array<{ angle: number; pose: AnimationPose; frameIndex: number; projection: AngleProjection }> {
    const poses = ALL_POSES;
    const frames: Array<{ angle: number; pose: AnimationPose; frameIndex: number; projection: AngleProjection }> = [];

    for (let a = 0; a < TOTAL_ANGLES; a++) {
      const angleDeg = a * ANGLE_STEP;
      for (const pose of poses) {
        const baseProj = projectAngle(angleDeg, this.frontJoints, this.sideJoints, this.depthPaths);
        const posedJoints = applyPose(baseProj.joints, pose, 0);
        frames.push({
          angle: angleDeg,
          pose,
          frameIndex: getFrameIndex(angleDeg, pose),
          projection: { ...baseProj, joints: posedJoints },
        });
      }
    }
    return frames;
  }

  /** Export puppet hook data for external game engines */
  exportHooks(): {
    joints: { front: JointSet; side: JointSet };
    angles: number;
    poses: AnimationPose[];
    race: Race;
    gender: Gender;
  } {
    return {
      joints: { front: this.frontJoints, side: this.sideJoints },
      angles: TOTAL_ANGLES,
      poses: ALL_POSES,
      race: this.data.race,
      gender: this.data.gender,
    };
  }
}

// ============================================================================
// PROCEDURAL LIGHTING & SHADING ENGINE
// Turns flat COLOR_PALETTES colors into Photoshop-quality painted look
// with highlights, shadows, ambient occlusion, rim light, subsurface scatter
// ============================================================================

/** Light source configuration */
export interface LightSource {
  /** Direction in degrees: 0=top, 90=right, 180=bottom, 270=left */
  direction: number;
  /** Elevation angle: 0=horizontal, 90=directly above */
  elevation: number;
  /** Light color as hex */
  color: string;
  /** Intensity 0.0–2.0 (1.0 = normal) */
  intensity: number;
}

/** Shading preset for different game moods */
export type ShadingPreset = 'horror' | 'daylight' | 'twilight' | 'neon' | 'moonlit' | 'firelit' | 'custom';

const SHADING_PRESETS: Record<ShadingPreset, {
  primary: LightSource;
  fill: LightSource;
  rim: { color: string; intensity: number };
  ambient: { color: string; intensity: number };
  shadowDarkness: number;     // 0.0–1.0 how dark shadows get
  highlightSharpness: number; // 0.0–1.0 how crisp specular highlights are
  subsurfaceScatter: number;  // 0.0–1.0 skin translucency (warm glow through thin areas)
  ambientOcclusion: number;   // 0.0–1.0 darkening in crevices (neck, armpits, between legs)
}> = {
  horror: {
    primary:   { direction: 180, elevation: 15, color: '#FF4400', intensity: 1.4 },
    fill:      { direction: 340, elevation: 30, color: '#1A0A2E', intensity: 0.3 },
    rim:       { color: '#FF2200', intensity: 0.8 },
    ambient:   { color: '#0A0510', intensity: 0.15 },
    shadowDarkness: 0.85,
    highlightSharpness: 0.7,
    subsurfaceScatter: 0.4,
    ambientOcclusion: 0.9,
  },
  daylight: {
    primary:   { direction: 315, elevation: 55, color: '#FFF8E7', intensity: 1.0 },
    fill:      { direction: 135, elevation: 25, color: '#8EC8F0', intensity: 0.4 },
    rim:       { color: '#FFFAF0', intensity: 0.3 },
    ambient:   { color: '#C8D8E8', intensity: 0.35 },
    shadowDarkness: 0.35,
    highlightSharpness: 0.3,
    subsurfaceScatter: 0.25,
    ambientOcclusion: 0.4,
  },
  twilight: {
    primary:   { direction: 270, elevation: 10, color: '#FF8C42', intensity: 0.9 },
    fill:      { direction: 90, elevation: 40, color: '#2E1A47', intensity: 0.3 },
    rim:       { color: '#FF6B2B', intensity: 0.5 },
    ambient:   { color: '#1A0F2E', intensity: 0.2 },
    shadowDarkness: 0.65,
    highlightSharpness: 0.5,
    subsurfaceScatter: 0.35,
    ambientOcclusion: 0.7,
  },
  neon: {
    primary:   { direction: 0, elevation: 45, color: '#00FFFF', intensity: 1.2 },
    fill:      { direction: 180, elevation: 30, color: '#FF00FF', intensity: 0.6 },
    rim:       { color: '#00FF88', intensity: 0.9 },
    ambient:   { color: '#0A0A1A', intensity: 0.1 },
    shadowDarkness: 0.75,
    highlightSharpness: 0.8,
    subsurfaceScatter: 0.1,
    ambientOcclusion: 0.6,
  },
  moonlit: {
    primary:   { direction: 330, elevation: 65, color: '#D4E5FF', intensity: 0.7 },
    fill:      { direction: 150, elevation: 20, color: '#0A0F1A', intensity: 0.15 },
    rim:       { color: '#A0C0FF', intensity: 0.6 },
    ambient:   { color: '#0D1117', intensity: 0.12 },
    shadowDarkness: 0.8,
    highlightSharpness: 0.4,
    subsurfaceScatter: 0.15,
    ambientOcclusion: 0.85,
  },
  firelit: {
    primary:   { direction: 180, elevation: 25, color: '#FF9933', intensity: 1.3 },
    fill:      { direction: 0, elevation: 10, color: '#331100', intensity: 0.2 },
    rim:       { color: '#FF6600', intensity: 0.7 },
    ambient:   { color: '#1A0800', intensity: 0.1 },
    shadowDarkness: 0.75,
    highlightSharpness: 0.6,
    subsurfaceScatter: 0.5,
    ambientOcclusion: 0.8,
  },
  custom: {
    primary:   { direction: 315, elevation: 45, color: '#FFFFFF', intensity: 1.0 },
    fill:      { direction: 135, elevation: 30, color: '#4466AA', intensity: 0.3 },
    rim:       { color: '#FFFFFF', intensity: 0.4 },
    ambient:   { color: '#222233', intensity: 0.2 },
    shadowDarkness: 0.5,
    highlightSharpness: 0.5,
    subsurfaceScatter: 0.25,
    ambientOcclusion: 0.6,
  },
};

// --- Color math utilities ---

function hexToRGB(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

function blendColors(base: string, overlay: string, amount: number): string {
  const [r1, g1, b1] = hexToRGB(base);
  const [r2, g2, b2] = hexToRGB(overlay);
  return rgbToHex(
    r1 + (r2 - r1) * amount,
    g1 + (g2 - g1) * amount,
    b1 + (b2 - b1) * amount,
  );
}

/** Convert RGB to HSL for advanced manipulation */
function rgbToHSL(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRGB(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1/3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1/3) * 255),
  ];
}

/** Surface normal derived from path region + position relative to body center */
function getRegionNormal(region: string, side: 'left' | 'right' | 'center', pathYCenter: number): [number, number, number] {
  // x: left/right curvature, y: up/down facing, z: how much faces camera
  const sideX = side === 'left' ? -0.3 : side === 'right' ? 0.3 : 0.0;

  switch (region) {
    case 'hair':     return [sideX, -0.5, 0.7];    // top of head, mostly forward
    case 'eyes':     return [sideX * 0.5, 0.0, 1.0]; // flat, facing camera
    case 'eyebrows': return [sideX * 0.5, -0.2, 0.9];
    case 'lips':     return [0.0, 0.15, 0.95];
    case 'skin':     return [sideX * 0.6, pathYCenter < 200 ? -0.1 : 0.1, 0.85]; // face curvature
    case 'primary':  return [sideX * 0.4, 0.0, 0.8];  // torso — cylindrical
    case 'secondary': return [sideX * 0.5, 0.2, 0.7]; // legs
    case 'accent':   return [sideX * 0.3, 0.4, 0.6];  // feet/details
    default:         return [sideX * 0.3, 0.0, 0.85];
  }
}

/** Per-path shading result — everything the renderer needs */
export interface ShadedColor {
  base: string;        // Original flat color
  lit: string;         // Final composited color with all lighting
  highlight: string;   // Specular highlight color (for glossy pass)
  shadow: string;      // Deep shadow color (for AO crevices)
  rim: string;         // Rim light color (edge glow)
  highlightOpacity: number; // 0.0–1.0 specular intensity at this point
  shadowOpacity: number;    // 0.0–1.0 shadow intensity at this point
  rimOpacity: number;       // 0.0–1.0 rim light intensity at this point
}

/**
 * Compute full shading for a single path given its base color, region, and lighting.
 * This is the core Photoshop-quality color math.
 */
export function computePathShading(
  baseColor: string,
  region: string,
  side: 'left' | 'right' | 'center',
  pathYCenter: number,
  preset: ShadingPreset = 'horror',
  customPreset?: typeof SHADING_PRESETS['custom'],
): ShadedColor {
  const config = preset === 'custom' && customPreset ? customPreset : SHADING_PRESETS[preset];
  const normal = getRegionNormal(region, side, pathYCenter);
  const [nx, ny, nz] = normal;

  // Convert light direction to vector
  const lRad = (config.primary.direction * Math.PI) / 180;
  const lElev = (config.primary.elevation * Math.PI) / 180;
  const lx = Math.sin(lRad) * Math.cos(lElev);
  const ly = -Math.cos(lRad) * Math.cos(lElev); // negative because Y down in SVG
  const lz = Math.sin(lElev);

  // Diffuse: dot(normal, light)
  const diffuse = Math.max(0, nx * lx + ny * ly + nz * lz) * config.primary.intensity;

  // Fill light (softer, from opposite side)
  const fRad = (config.fill.direction * Math.PI) / 180;
  const fElev = (config.fill.elevation * Math.PI) / 180;
  const fx = Math.sin(fRad) * Math.cos(fElev);
  const fy = -Math.cos(fRad) * Math.cos(fElev);
  const fz = Math.sin(fElev);
  const fillDiffuse = Math.max(0, nx * fx + ny * fy + nz * fz) * config.fill.intensity;

  // Specular highlight (Blinn-Phong approximation)
  // Half-vector between light and view (view = [0,0,1] for front-facing)
  const hx = lx, hy = ly, hz = lz + 1;
  const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz);
  const specDot = Math.max(0, (nx * hx + ny * hy + nz * hz) / hLen);
  const specular = Math.pow(specDot, 8 + config.highlightSharpness * 40) * config.primary.intensity;

  // Rim light — strongest when normal is perpendicular to view
  const rimFactor = 1.0 - Math.abs(nz);
  const rimIntensity = Math.pow(rimFactor, 2) * config.rim.intensity;

  // Ambient occlusion — stronger in crevice regions
  let aoFactor = 0;
  if (region === 'skin' && pathYCenter > 250 && pathYCenter < 350) aoFactor = 0.6; // neck
  if (region === 'secondary' && side !== 'center') aoFactor = 0.3; // inner leg
  if (region === 'primary' && side !== 'center') aoFactor = 0.2; // underarm
  aoFactor *= config.ambientOcclusion;

  // Subsurface scattering — warm glow through thin areas (ears, nose, fingers)
  let sssAmount = 0;
  if (region === 'skin' || region === 'lips') {
    // Skin gets SSS — light passing through from behind
    const backlight = Math.max(0, -(nx * lx + ny * ly + nz * lz));
    sssAmount = backlight * config.subsurfaceScatter * 0.5;
  }

  // --- Compose final color ---
  const [br, bg, bb] = hexToRGB(baseColor);
  const [lr, lg, lb] = hexToRGB(config.primary.color);
  const [fr, fg, fb] = hexToRGB(config.fill.color);
  const [ar, ag, ab] = hexToRGB(config.ambient.color);

  // Base illumination = ambient + diffuse + fill
  const ambientContrib = config.ambient.intensity;
  let finalR = br * (ambientContrib * ar/255 + diffuse * lr/255 + fillDiffuse * fr/255);
  let finalG = bg * (ambientContrib * ag/255 + diffuse * lg/255 + fillDiffuse * fg/255);
  let finalB = bb * (ambientContrib * ab/255 + diffuse * lb/255 + fillDiffuse * fb/255);

  // Shadow darkening
  const shadowAmount = (1.0 - diffuse - fillDiffuse * 0.5) * config.shadowDarkness;
  const clampedShadow = Math.max(0, Math.min(1, shadowAmount));
  finalR *= (1.0 - clampedShadow * 0.7);
  finalG *= (1.0 - clampedShadow * 0.75);
  finalB *= (1.0 - clampedShadow * 0.65); // shadows go slightly warm

  // AO darkening
  finalR *= (1.0 - aoFactor);
  finalG *= (1.0 - aoFactor);
  finalB *= (1.0 - aoFactor);

  // SSS warm glow (add reddish tint for skin)
  if (sssAmount > 0) {
    finalR += sssAmount * 60;  // red channel boost
    finalG += sssAmount * 15;  // slight green
    finalB += sssAmount * 5;   // minimal blue
  }

  // Clamp
  const lit = rgbToHex(finalR, finalG, finalB);

  // Highlight color (specular)
  const highlightColor = blendColors(baseColor, config.primary.color, 0.6);
  const [hlR, hlG, hlB] = hexToRGB(highlightColor);
  const highlight = rgbToHex(
    hlR + (255 - hlR) * specular * 0.5,
    hlG + (255 - hlG) * specular * 0.5,
    hlB + (255 - hlB) * specular * 0.5,
  );

  // Shadow color (deep)
  const [bh, bs, bl] = rgbToHSL(br, bg, bb);
  const shadowHSL = hslToRGB(
    (bh + 0.6) % 1.0, // shift hue toward blue/purple in shadows (color theory)
    Math.min(1, bs * 1.2),
    Math.max(0.02, bl * (1 - config.shadowDarkness * 0.8)),
  );
  const shadow = rgbToHex(shadowHSL[0], shadowHSL[1], shadowHSL[2]);

  // Rim color
  const rim = config.rim.color;

  return {
    base: baseColor,
    lit,
    highlight,
    shadow,
    rim,
    highlightOpacity: Math.min(1, specular),
    shadowOpacity: clampedShadow + aoFactor,
    rimOpacity: Math.min(1, rimIntensity),
  };
}

/**
 * Compute shading for ALL paths in one call.
 * Returns a ShadedColor[] parallel to the avatar's paths array.
 */
export function computeAvatarShading(
  avatar: KasVillageAvatar,
  preset: ShadingPreset = 'daylight',
): ShadedColor[] {
  return avatar.depthPaths.map(dp => {
    // Get base color for this region from avatar colors
    const baseColor = avatar.data.colors[dp.region] || '#888888';

    // Get Y center for AO/SSS calculation
    const yVals: number[] = [];
    const mlMatches = dp.d.matchAll(/[ML]\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/g);
    for (const m of mlMatches) {
      const y = parseFloat(m[2]);
      if (!isNaN(y)) yVals.push(y);
    }
    const yCenter = yVals.length > 0
      ? yVals.reduce((a, b) => a + b, 0) / yVals.length
      : 300;

    return computePathShading(baseColor, dp.region, dp.side, yCenter, preset);
  });
}

/**
 * Get available shading presets.
 */
export function getShadingPresets(): ShadingPreset[] {
  return Object.keys(SHADING_PRESETS) as ShadingPreset[];
}

/**
 * Create a custom lighting setup.
 */
export function createCustomLighting(overrides: Partial<typeof SHADING_PRESETS['custom']>): typeof SHADING_PRESETS['custom'] {
  return { ...SHADING_PRESETS.custom, ...overrides };
}

// ============================================================================
// WALLET BRIDGE — loads avatar from SecureStore into the engine
// ============================================================================
//
// SecureStore keys written by Expo_identity_ritual.tsx:
//   kv_avatar_recipe   → JSON of AvatarRecipe (has race, gender, colors)
//   kv_avatar_identity  → JSON of AvatarIdentity (has paths[], hash, race, gender)
//
// The bridge reads both, merges them into AvatarData, and returns a ready engine.

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Load the avatar from the wallet (SecureStore) and return a ready-to-use engine.
 * This is the entry point for any game — one call, avatar is playable.
 *
 * @returns KasVillageAvatar or null if no avatar exists yet
 */
export async function loadAvatarFromWallet(): Promise<KasVillageAvatar | null> {
  try {
    // Read identity (paths + hash)
    const identityJSON = await SecureStore.getItemAsync('kv_avatar_identity');
    if (!identityJSON) return null;
    const identity = JSON.parse(identityJSON) as {
      paths: string[];
      hash: string;
      race: Race;
      gender: Gender;
    };

    // Read recipe (colors + metadata)
    const recipeJSON = await SecureStore.getItemAsync('kv_avatar_recipe');
    const colors: Record<string, string> = {};
    if (recipeJSON) {
      const recipe = JSON.parse(recipeJSON);
      // recipe.colors is Record<string, string> mapping region → hex color
      if (recipe.colors) Object.assign(colors, recipe.colors);
    }

    const data: AvatarData = {
      paths: identity.paths,
      colors,
      race: identity.race as Race,
      gender: identity.gender as Gender,
    };

    return new KasVillageAvatar(data);
  } catch (e) {
    console.error('[KV Engine] Failed to load avatar from wallet:', e);
    return null;
  }
}

/**
 * Check if an avatar exists in the wallet without loading it.
 */
export async function hasWalletAvatar(): Promise<boolean> {
  const identity = await SecureStore.getItemAsync('kv_avatar_identity');
  return identity !== null;
}


// ============================================================================
// SPRITE CACHE — AsyncStorage persistence for instant game loads
// ============================================================================

const CACHE_KEY = 'kv_avatar_sprite_cache';
const CACHE_VERSION = '2';

interface CachedProjection {
  pathVisible: boolean[];
  pathZ: number[];
}

interface SpriteCache {
  version: string;
  race: string;
  gender: string;
  pathCount: number;
  projections: CachedProjection[];
}

/**
 * Build cache from a loaded avatar — pre-computes all 60 angle projections.
 */
export function buildSpriteCache(avatar: KasVillageAvatar): SpriteCache {
  const projections: CachedProjection[] = [];
  for (let a = 0; a < TOTAL_ANGLES; a++) {
    const deg = a * ANGLE_STEP;
    const proj = projectAngle(deg, avatar.frontJoints, avatar.sideJoints, avatar.depthPaths);
    projections.push({ pathVisible: proj.pathVisible, pathZ: proj.pathZ });
  }
  return {
    version: CACHE_VERSION,
    race: avatar.data.race,
    gender: avatar.data.gender,
    pathCount: avatar.data.paths.length,
    projections,
  };
}

export async function saveSpriteCache(cache: SpriteCache): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export async function loadSpriteCache(): Promise<SpriteCache | null> {
  try {
    const json = await AsyncStorage.getItem(CACHE_KEY);
    if (!json) return null;
    const cache: SpriteCache = JSON.parse(json);
    if (cache.version !== CACHE_VERSION) return null;
    return cache;
  } catch {
    return null;
  }
}

export async function clearSpriteCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
}

export function getCachedProjection(
  cache: SpriteCache | null,
  angleIndex: number,
  avatar: KasVillageAvatar
): { pathVisible: boolean[]; pathZ: number[] } {
  if (cache && cache.projections[angleIndex]) {
    return cache.projections[angleIndex];
  }
  const deg = angleIndex * ANGLE_STEP;
  const proj = projectAngle(deg, avatar.frontJoints, avatar.sideJoints, avatar.depthPaths);
  return { pathVisible: proj.pathVisible, pathZ: proj.pathZ };
}

// ============================================================================
// CHESS PIECE HELPERS
// ============================================================================

/**
 * Get SVG string for a chess piece at a given facing direction.
 */
export function getChessPieceSVG(
  avatar: KasVillageAvatar,
  facingDeg: number,
  pose: AnimationPose = 'idle',
  size: number = 48,
): string {
  const proj = projectAngle(facingDeg, avatar.frontJoints, avatar.sideJoints, avatar.depthPaths);
  const drawOrder = avatar.depthPaths
    .map((dp, i) => ({ ...dp, z: proj.pathZ[i], visible: proj.pathVisible[i] }))
    .filter(dp => dp.visible)
    .sort((a, b) => a.z - b.z);

  const pathEls = drawOrder.map(dp => {
    const fill = avatar.data.colors[dp.region] || '#1a1a2e';
    return '<path d="' + dp.d + '" fill="' + fill + '" stroke="#333" stroke-width="0.5" opacity="0.95"/>';
  }).join('\n');

  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 400 450" xmlns="http://www.w3.org/2000/svg">\n<g>\n' + pathEls + '\n</g>\n</svg>';
}

/**
 * Get renderable path data for React Native SVG chess pieces.
 *
 * Usage in GameScreen.tsx:
 *   const paths = getSpritePaths(avatar, 90, 'idle');
 *   <Svg width={48} height={48} viewBox="0 0 400 450">
 *     {paths.map((p, i) => (
 *       <Path key={i} d={p.d} fill={p.fill} stroke={p.stroke} />
 *     ))}
 *   </Svg>
 */
export function getSpritePaths(
  avatar: KasVillageAvatar,
  facingDeg: number,
  pose: AnimationPose = 'idle',
  strokeColor: string = '#333',
): Array<{ d: string; fill: string; stroke: string; z: number }> {
  const proj = projectAngle(facingDeg, avatar.frontJoints, avatar.sideJoints, avatar.depthPaths);

  return avatar.depthPaths
    .map((dp, i) => ({
      d: dp.d,
      fill: avatar.data.colors[dp.region] || '#1a1a2e',
      stroke: strokeColor,
      z: proj.pathZ[i],
      _visible: proj.pathVisible[i],
    }))
    .filter(p => p._visible)
    .sort((a, b) => a.z - b.z)
    .map(({ d, fill, stroke, z }) => ({ d, fill, stroke, z }));
}

/**
 * Initialize avatar engine with caching. One-call setup for games.
 */
export async function initGameAvatar(): Promise<KasVillageAvatar | null> {
  const avatar = await loadAvatarFromWallet();
  if (!avatar) return null;

  const cached = await loadSpriteCache();
  if (!cached || cached.race !== avatar.data.race || cached.gender !== avatar.data.gender || cached.pathCount !== avatar.data.paths.length) {
    const freshCache = buildSpriteCache(avatar);
    await saveSpriteCache(freshCache);
  }

  return avatar;
}


// ============================================================================
// USAGE (the 10-line developer promise)
// ============================================================================
//
// import { loadAvatarFromWallet } from 'kasvillage-procedural-sdk';
//
// const avatar = await loadAvatarFromWallet();
// if (!avatar) { showCreateAvatarScreen(); return; }
//
// avatar.attachPhysics('platformer');
// avatar.setCamera('sideScroll');
// avatar.setPosition(200, groundY);
// avatar.face('east');
//
// // Game loop
// onFrame((dt) => {
//   avatar.update(dt, input, groundY);
//   const state = avatar.getRenderState();
//   const drawOrder = avatar.getDrawOrder(state.angle);
//   drawOrder.forEach(path => ctx.fill(new Path2D(path.d)));
// });
