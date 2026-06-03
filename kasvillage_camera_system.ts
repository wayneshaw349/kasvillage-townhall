// ============================================================================
// KasVillage Camera System — Action-Triggered Angle Switching
// Player actions → camera angle changes with smooth lerp transitions
// 30 SDK environment angles, matched to avatar angle rendering
// ============================================================================

import type { ComboState, AIAction, GameState } from './kasvillage_game_v1';

// ============================================================================
// ANGLE DEFINITIONS — 30 angles from SDK procedural backgrounds
// ============================================================================

/** 30 camera angles at 12° increments (0°–348°) */
export const CAMERA_ANGLES = [
  0, 12, 24, 36, 48, 60, 72, 84, 96, 108,
  120, 132, 144, 156, 168, 180, 192, 204, 216, 228,
  240, 252, 264, 276, 288, 300, 312, 324, 336, 348,
] as const;

export type CameraAngle = typeof CAMERA_ANGLES[number];

/** Snap any degree to the nearest of 30 angles */
export function snapToAngle(degrees: number): CameraAngle {
  const normalized = ((degrees % 360) + 360) % 360;
  let closest = CAMERA_ANGLES[0];
  let minDist = 360;
  for (const a of CAMERA_ANGLES) {
    const dist = Math.min(Math.abs(normalized - a), 360 - Math.abs(normalized - a));
    if (dist < minDist) { minDist = dist; closest = a; }
  }
  return closest;
}

// ============================================================================
// CAMERA STATE
// ============================================================================

export interface CameraState {
  /** Current display angle (lerped) */
  currentAngle: number;
  /** Target angle (snapped to 30-angle grid) */
  targetAngle: CameraAngle;
  /** Angle before transition started */
  fromAngle: number;
  /** Lerp progress 0→1 */
  lerpT: number;
  /** Transition duration in seconds */
  lerpDuration: number;
  /** Whether currently transitioning */
  transitioning: boolean;

  /** Camera shake intensity (0→1, decays) */
  shakeIntensity: number;
  /** Shake offset X/Y for rendering */
  shakeX: number;
  shakeY: number;

  /** Freeze timer — holds angle on enemy death */
  freezeTimer: number;

  /** Victory rotation state */
  victoryRotating: boolean;
  victoryAngleIndex: number;
  victoryTimer: number;

  /** Snap-back timer — dodge returns to 0° after delay */
  snapBackTimer: number;
  snapBackTarget: CameraAngle | null;

  /** Last player action that triggered a camera change */
  lastTrigger: CameraTrigger;
  /** Time of last trigger (prevents rapid-fire switches) */
  lastTriggerTime: number;
}

export type CameraTrigger =
  | 'idle'
  | 'dodge_left'
  | 'dodge_right'
  | 'jump'
  | 'land_heavy'
  | 'combo_chain'
  | 'block'
  | 'boss_entrance'
  | 'combo_break'
  | 'enemy_death'
  | 'victory';

/** Action → target angle mapping */
const TRIGGER_ANGLES: Record<CameraTrigger, number> = {
  idle:           0,
  dodge_left:     270,
  dodge_right:    90,
  jump:           315,
  land_heavy:     48,    // ~45° snapped to grid
  combo_chain:    132,   // ~135° dramatic isometric
  block:          -1,    // -1 = hold current
  boss_entrance:  180,
  combo_break:    -2,    // -2 = shake current
  enemy_death:    -3,    // -3 = freeze current
  victory:        -4,    // -4 = slow rotate
};

/** Transition speed per trigger type */
const TRIGGER_LERP_DURATION: Partial<Record<CameraTrigger, number>> = {
  dodge_left:     0.2,
  dodge_right:    0.2,
  jump:           0.25,
  land_heavy:     0.15,
  combo_chain:    0.35,
  boss_entrance:  0.6,
  idle:           0.3,
};

const DEFAULT_LERP_DURATION = 0.3;
const SNAP_BACK_DELAY = 2.0;        // seconds before dodge snaps back to 0°
const SHAKE_DECAY = 4.0;            // shake decays per second
const FREEZE_DURATION = 0.3;        // enemy death freeze
const VICTORY_ANGLE_HOLD = 0.5;     // seconds per angle during victory
const MIN_TRIGGER_INTERVAL = 0.15;  // minimum seconds between triggers

// ============================================================================
// CREATE / RESET
// ============================================================================

export function createCameraState(): CameraState {
  return {
    currentAngle: 0,
    targetAngle: 0,
    fromAngle: 0,
    lerpT: 1,
    lerpDuration: DEFAULT_LERP_DURATION,
    transitioning: false,
    shakeIntensity: 0,
    shakeX: 0,
    shakeY: 0,
    freezeTimer: 0,
    victoryRotating: false,
    victoryAngleIndex: 0,
    victoryTimer: 0,
    snapBackTimer: 0,
    snapBackTarget: null,
    lastTrigger: 'idle',
    lastTriggerTime: 0,
  };
}

// ============================================================================
// TRIGGER CAMERA — called by game logic
// ============================================================================

/**
 * Trigger a camera angle change. Call this from game tick when
 * a player action occurs. Debounced by MIN_TRIGGER_INTERVAL.
 */
export function triggerCamera(cam: CameraState, trigger: CameraTrigger, gameTime: number): void {
  // Debounce rapid triggers (except shake/freeze which always apply)
  if (trigger !== 'combo_break' && trigger !== 'enemy_death') {
    if (gameTime - cam.lastTriggerTime < MIN_TRIGGER_INTERVAL) return;
  }

  // Frozen — skip non-freeze triggers
  if (cam.freezeTimer > 0 && trigger !== 'enemy_death') return;

  cam.lastTrigger = trigger;
  cam.lastTriggerTime = gameTime;

  const rawAngle = TRIGGER_ANGLES[trigger];

  if (rawAngle === -1) {
    // BLOCK: hold current angle — do nothing
    return;
  }

  if (rawAngle === -2) {
    // COMBO BREAK: shake current angle ±5°
    cam.shakeIntensity = 0.7;
    return;
  }

  if (rawAngle === -3) {
    // ENEMY DEATH: freeze current angle briefly
    cam.freezeTimer = FREEZE_DURATION;
    return;
  }

  if (rawAngle === -4) {
    // VICTORY: slow rotate through all 30 angles
    cam.victoryRotating = true;
    cam.victoryAngleIndex = 0;
    cam.victoryTimer = 0;
    startTransition(cam, CAMERA_ANGLES[0], 0.4);
    return;
  }

  // Normal angle transition
  const target = snapToAngle(rawAngle);
  const duration = TRIGGER_LERP_DURATION[trigger] ?? DEFAULT_LERP_DURATION;
  startTransition(cam, target, duration);

  // Set snap-back for dodge
  if (trigger === 'dodge_left' || trigger === 'dodge_right') {
    cam.snapBackTimer = SNAP_BACK_DELAY;
    cam.snapBackTarget = 0;
  } else {
    cam.snapBackTimer = 0;
    cam.snapBackTarget = null;
  }
}

function startTransition(cam: CameraState, target: CameraAngle, duration: number): void {
  if (target === snapToAngle(cam.currentAngle) && !cam.transitioning) return;
  cam.fromAngle = cam.currentAngle;
  cam.targetAngle = target;
  cam.lerpT = 0;
  cam.lerpDuration = duration;
  cam.transitioning = true;
}

// ============================================================================
// UPDATE — call every frame
// ============================================================================

/** Smooth easeInOut for camera transitions */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Shortest angular path (handles 350°→10° wrapping) */
function lerpAngle(from: number, to: number, t: number): number {
  let diff = ((to - from + 540) % 360) - 180;
  return ((from + diff * t) % 360 + 360) % 360;
}

/**
 * Update camera state every frame. Call after game logic.
 */
export function updateCamera(cam: CameraState, dt: number): void {
  // --- Freeze ---
  if (cam.freezeTimer > 0) {
    cam.freezeTimer -= dt;
    return; // no updates while frozen
  }

  // --- Victory rotation ---
  if (cam.victoryRotating) {
    cam.victoryTimer += dt;
    if (cam.victoryTimer >= VICTORY_ANGLE_HOLD) {
      cam.victoryTimer = 0;
      cam.victoryAngleIndex = (cam.victoryAngleIndex + 1) % CAMERA_ANGLES.length;
      startTransition(cam, CAMERA_ANGLES[cam.victoryAngleIndex], 0.4);
    }
  }

  // --- Lerp transition ---
  if (cam.transitioning) {
    cam.lerpT += dt / cam.lerpDuration;
    if (cam.lerpT >= 1) {
      cam.lerpT = 1;
      cam.transitioning = false;
      cam.currentAngle = cam.targetAngle;
    } else {
      const eased = easeInOutCubic(cam.lerpT);
      cam.currentAngle = lerpAngle(cam.fromAngle, cam.targetAngle, eased);
    }
  }

  // --- Snap-back timer (dodge → return to forward) ---
  if (cam.snapBackTarget !== null) {
    cam.snapBackTimer -= dt;
    if (cam.snapBackTimer <= 0) {
      startTransition(cam, cam.snapBackTarget, 0.3);
      cam.snapBackTarget = null;
      cam.snapBackTimer = 0;
    }
  }

  // --- Shake decay ---
  if (cam.shakeIntensity > 0) {
    cam.shakeIntensity -= SHAKE_DECAY * dt;
    if (cam.shakeIntensity < 0.01) {
      cam.shakeIntensity = 0;
      cam.shakeX = 0;
      cam.shakeY = 0;
    } else {
      const maxOffset = cam.shakeIntensity * 5; // max ±5px
      cam.shakeX = (Math.random() * 2 - 1) * maxOffset;
      cam.shakeY = (Math.random() * 2 - 1) * maxOffset;
    }
  }
}

// ============================================================================
// QUERY HELPERS — for rendering
// ============================================================================

/** Get the snapped angle index (0–29) for background/avatar lookup */
export function getCameraAngleIndex(cam: CameraState): number {
  const snapped = snapToAngle(cam.currentAngle);
  return CAMERA_ANGLES.indexOf(snapped);
}

/** Get the current angle for avatar sprite selection */
export function getAvatarAngleForCamera(cam: CameraState): number {
  return snapToAngle(cam.currentAngle);
}

/** Get render transform offset (includes shake) */
export function getCameraTransform(cam: CameraState): { offsetX: number; offsetY: number } {
  return { offsetX: cam.shakeX, offsetY: cam.shakeY };
}

/** Is the camera currently in a special state? */
export function getCameraMode(cam: CameraState): 'normal' | 'frozen' | 'victory' | 'shaking' {
  if (cam.freezeTimer > 0) return 'frozen';
  if (cam.victoryRotating) return 'victory';
  if (cam.shakeIntensity > 0.1) return 'shaking';
  return 'normal';
}

// ============================================================================
// GAME INTEGRATION — auto-detect triggers from GameState changes
// ============================================================================

interface PlayerActionSnapshot {
  isJumping: boolean;
  isGrounded: boolean;
  isDodging: boolean;
  dodgeDirection: 'left' | 'right' | null;
  isBlocking: boolean;
  comboChain: number;
  comboActive: boolean;
  comboBroke: boolean;
  enemyJustDied: boolean;
  bossEntered: boolean;
  victory: boolean;
}

/** Previous frame snapshot for edge detection */
let _prevSnapshot: PlayerActionSnapshot = {
  isJumping: false, isGrounded: true, isDodging: false,
  dodgeDirection: null, isBlocking: false, comboChain: 0,
  comboActive: false, comboBroke: false, enemyJustDied: false,
  bossEntered: false, victory: false,
};

/**
 * Auto-detect camera triggers from game state.
 * Call once per frame after tickGame().
 *
 * @param cam         Camera state to update
 * @param snapshot    Current frame's player action data
 * @param gameTime    Current game time
 */
export function autoCameraTrigger(
  cam: CameraState,
  snapshot: PlayerActionSnapshot,
  gameTime: number,
): void {
  const prev = _prevSnapshot;

  // Priority order (highest first):

  // 1. Victory
  if (snapshot.victory && !prev.victory) {
    triggerCamera(cam, 'victory', gameTime);
  }
  // 2. Boss entrance
  else if (snapshot.bossEntered && !prev.bossEntered) {
    triggerCamera(cam, 'boss_entrance', gameTime);
  }
  // 3. Enemy death (can layer on top of other triggers)
  if (snapshot.enemyJustDied && !prev.enemyJustDied) {
    triggerCamera(cam, 'enemy_death', gameTime);
  }
  // 4. Combo break
  else if (snapshot.comboBroke && !prev.comboBroke) {
    triggerCamera(cam, 'combo_break', gameTime);
  }
  // 5. High combo chain (>10)
  else if (snapshot.comboChain >= 10 && prev.comboChain < 10) {
    triggerCamera(cam, 'combo_chain', gameTime);
  }
  // 6. Dodge
  else if (snapshot.isDodging && !prev.isDodging) {
    triggerCamera(cam, snapshot.dodgeDirection === 'left' ? 'dodge_left' : 'dodge_right', gameTime);
  }
  // 7. Jump (just left ground)
  else if (snapshot.isJumping && !prev.isJumping) {
    triggerCamera(cam, 'jump', gameTime);
  }
  // 8. Land heavy (was airborne, now grounded, combo was active)
  else if (snapshot.isGrounded && !prev.isGrounded && snapshot.comboActive) {
    triggerCamera(cam, 'land_heavy', gameTime);
  }
  // 9. Block
  else if (snapshot.isBlocking && !prev.isBlocking) {
    triggerCamera(cam, 'block', gameTime);
  }
  // 10. Return to idle (no action, camera not at 0°)
  else if (
    !snapshot.isDodging && !snapshot.isJumping && !snapshot.isBlocking &&
    !snapshot.comboActive && snapshot.isGrounded &&
    snapToAngle(cam.currentAngle) !== 0 && !cam.transitioning &&
    cam.snapBackTarget === null && !cam.victoryRotating
  ) {
    triggerCamera(cam, 'idle', gameTime);
  }

  // Store snapshot for next frame edge detection
  _prevSnapshot = { ...snapshot };
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================
// createCameraState()        — init
// triggerCamera(cam, t, gt)  — manual trigger
// autoCameraTrigger(cam,s,t) — auto-detect from game state
// updateCamera(cam, dt)      — tick every frame
// getCameraAngleIndex(cam)   — 0–29 index for bg/avatar lookup
// getAvatarAngleForCamera()  — angle for avatar sprite
// getCameraTransform(cam)    — shake offsets for rendering
// getCameraMode(cam)         — 'normal'|'frozen'|'victory'|'shaking'
// snapToAngle(deg)           — snap any degree to 30-angle grid
// ============================================================================
