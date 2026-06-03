// ============================================================================
// KasVillage Touch Input — Trackpad Drag Pad
// One finger, one touch surface. No buttons, no swipes.
//
// CONTROLS:
//   Finger down + drag        → move in drag direction
//   Finger down + hard press  → jump in current drag direction
//   Finger lifts              → block (brief guard window)
//   Drag toward enemy         → attack (auto-targets nearest)
//   Drag away from enemy      → dodge/retreat
//   Stationary hold           → idle combat stance
//
// Think: trackpad not mouse. Your finger IS the joystick.
// ============================================================================

import type { GameState, ComboInput, ComboResult } from './kasvillage_game_v1';
import { processComboInput, hitEnemy } from './kasvillage_game_v1';
import { triggerPlayerHit } from './kasvillage_player_sprite';
import type { PlayerSprite } from './kasvillage_player_sprite';

// ============================================================================
// CONFIG — all tuning in one place
// ============================================================================

export const INPUT_CONFIG = {
  // Movement
  /** Drag pixels to reach full speed */
  DRAG_FULL_RANGE: 80,
  /** Max player move speed (px/s) */
  MAX_SPEED: 160,
  /** Base auto-advance speed when not touching (px/s) */
  AUTO_ADVANCE: 40,
  /** Dead zone — drag distance below this = stationary (px) */
  DEAD_ZONE: 8,

  // Jump
  /** Force threshold — how hard you press to jump (0–1 force touch scale) */
  HARD_PRESS_FORCE: 0.4,
  /** Minimum touch duration before hard press registers (ms) */
  HARD_PRESS_MIN_MS: 80,
  /** Jump velocity */
  JUMP_VY: -14,
  /** Gravity (applied per frame * 60) */
  GRAVITY: 0.7,
  /** Ground Y */
  GROUND_Y: 380,

  // Block
  /** Block window after finger lifts (seconds) */
  BLOCK_WINDOW: 0.35,

  // Attack
  /** Drag velocity threshold to trigger attack (px/s) */
  ATTACK_DRAG_SPEED: 200,
  /** Minimum time between attacks (ms) */
  ATTACK_COOLDOWN_MS: 120,
  /** Range to auto-target nearest enemy (px) */
  ATTACK_RANGE: 90,
  /** Drag distance per attack trigger (px) — rhythmic drag pumps */
  ATTACK_PUMP_DISTANCE: 30,

  // Dodge
  /** Drag speed threshold for dodge (px/s, backward direction) */
  DODGE_SPEED_THRESHOLD: 300,
  /** Dodge duration (seconds) */
  DODGE_DURATION: 0.35,
  /** Dodge movement speed (px/s) */
  DODGE_MOVE_SPEED: 250,

  // Parry
  /** Parry window — must dodge INTO enemy attack within this window (seconds) */
  PARRY_WINDOW: 0.15,
  /** Parry forward dash duration */
  PARRY_DASH_DURATION: 0.2,
  /** Parry damage multiplier on counter-attack */
  PARRY_DAMAGE_MULT: 2.5,
  /** Parry guard stamina recovery */
  PARRY_GUARD_REGEN: 40,
  /** Parry auto-starts a combo chain with this many free beats */
  PARRY_FREE_CHAIN: 3,
};

// ============================================================================
// INPUT STATE
// ============================================================================

export interface DragPadState {
  // Touch tracking
  fingerDown: boolean;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  prevX: number;
  prevY: number;
  dragDX: number;
  dragDY: number;
  dragVX: number;
  dragVY: number;
  touchStartMs: number;
  /** Touch force (0–1, from Force Touch / 3D Touch if available) */
  touchForce: number;

  // Derived movement
  /** Normalized move direction (-1 to 1) */
  moveX: number;
  moveY: number;
  /** Move magnitude (0 to 1) */
  moveMagnitude: number;

  // Player physics
  playerVY: number;
  playerVX: number;

  // Action states
  jumpTriggered: boolean;
  jumping: boolean;
  blockTimer: number;
  blocking: boolean;
  dodgeTimer: number;
  dodgeDir: 'left' | 'right' | null;
  dodging: boolean;

  // Attack tracking
  nextAttack: ComboInput;
  lastAttackMs: number;
  attackPumpAccum: number;
  lastComboResult: ComboResult | null;
  comboResultConsumed: boolean;

  // Hit tracking
  prevHp: number;

  // Hard press detection
  hardPressDetected: boolean;
  /** Accumulated Y push (simulated force from downward drag) */
  yPushAccum: number;

  // Parry system
  /** Parry triggered this frame */
  parryTriggered: boolean;
  /** Parry window active (dodge into enemy attack) */
  parryWindowActive: boolean;
  /** Parry window timer */
  parryWindowTimer: number;
  /** Direction of parry dodge */
  parryDir: 'left' | 'right' | null;
  /** Parry initiated a player combo (counter-attack) */
  parryComboStarted: boolean;
}

export function createDragPad(): DragPadState {
  return {
    fingerDown: false,
    originX: 0, originY: 0,
    currentX: 0, currentY: 0,
    prevX: 0, prevY: 0,
    dragDX: 0, dragDY: 0,
    dragVX: 0, dragVY: 0,
    touchStartMs: 0,
    touchForce: 0,

    moveX: 0, moveY: 0,
    moveMagnitude: 0,

    playerVY: 0,
    playerVX: INPUT_CONFIG.AUTO_ADVANCE,

    jumpTriggered: false,
    jumping: false,
    blockTimer: 0,
    blocking: false,
    dodgeTimer: 0,
    dodgeDir: null,
    dodging: false,

    nextAttack: 'A',
    lastAttackMs: 0,
    attackPumpAccum: 0,
    lastComboResult: null,
    comboResultConsumed: true,

    prevHp: 100,

    hardPressDetected: false,
    yPushAccum: 0,

    parryTriggered: false,
    parryWindowActive: false,
    parryWindowTimer: 0,
    parryDir: null,
    parryComboStarted: false,
  };
}

// ============================================================================
// TOUCH EVENTS
// ============================================================================

export function padTouchStart(
  pad: DragPadState,
  x: number,
  y: number,
  force?: number,
): void {
  pad.fingerDown = true;
  pad.originX = x;
  pad.originY = y;
  pad.currentX = x;
  pad.currentY = y;
  pad.prevX = x;
  pad.prevY = y;
  pad.dragDX = 0;
  pad.dragDY = 0;
  pad.dragVX = 0;
  pad.dragVY = 0;
  pad.touchStartMs = Date.now();
  pad.touchForce = force || 0;
  pad.hardPressDetected = false;
  pad.yPushAccum = 0;
  pad.attackPumpAccum = 0;

  // Cancel block from previous lift
  pad.blockTimer = 0;
  pad.blocking = false;
}

export function padTouchMove(
  pad: DragPadState,
  x: number,
  y: number,
  force?: number,
): void {
  if (!pad.fingerDown) return;

  pad.prevX = pad.currentX;
  pad.prevY = pad.currentY;
  pad.currentX = x;
  pad.currentY = y;
  pad.dragDX = x - pad.originX;
  pad.dragDY = y - pad.originY;

  if (force !== undefined) {
    pad.touchForce = force;
  }

  // Accumulate downward push for hard press fallback
  const dyFrame = y - pad.prevY;
  if (dyFrame > 0) {
    pad.yPushAccum += dyFrame;
  }
}

/** Finger lifts → BLOCK */
export function padTouchEnd(pad: DragPadState): void {
  if (!pad.fingerDown) return;
  pad.fingerDown = false;

  pad.blockTimer = INPUT_CONFIG.BLOCK_WINDOW;
  pad.blocking = true;

  pad.dragDX = 0;
  pad.dragDY = 0;
  pad.dragVX = 0;
  pad.dragVY = 0;
  pad.moveX = 0;
  pad.moveY = 0;
  pad.moveMagnitude = 0;
}

// ============================================================================
// TICK — process every frame, update GameState
// ============================================================================

export function tickDragPad(
  pad: DragPadState,
  state: GameState,
  dt: number,
): void {
  const cfg = INPUT_CONFIG;

  // Reset per-frame flags
  pad.jumpTriggered = false;
  pad.parryTriggered = false;
  pad.parryComboStarted = false;
  if (pad.comboResultConsumed) {
    pad.lastComboResult = null;
  }
  pad.comboResultConsumed = true;

  // ── PARRY WINDOW DECAY ──
  if (pad.parryWindowActive) {
    pad.parryWindowTimer -= dt;
    if (pad.parryWindowTimer <= 0) {
      pad.parryWindowActive = false;
      pad.parryDir = null;
    }
  }

  // ── DRAG VELOCITY ──
  if (pad.fingerDown) {
    const frameDX = pad.currentX - pad.prevX;
    const frameDY = pad.currentY - pad.prevY;
    const alpha = 0.3;
    pad.dragVX = pad.dragVX * (1 - alpha) + (frameDX / Math.max(dt, 0.001)) * alpha;
    pad.dragVY = pad.dragVY * (1 - alpha) + (frameDY / Math.max(dt, 0.001)) * alpha;
  }

  // ── MOVEMENT FROM DRAG ──
  if (pad.fingerDown && !pad.dodging) {
    const dist = Math.sqrt(pad.dragDX * pad.dragDX + pad.dragDY * pad.dragDY);

    if (dist > cfg.DEAD_ZONE) {
      const effective = Math.min(1, (dist - cfg.DEAD_ZONE) / (cfg.DRAG_FULL_RANGE - cfg.DEAD_ZONE));
      pad.moveX = pad.dragDX / dist;
      pad.moveY = pad.dragDY / dist;
      pad.moveMagnitude = effective;
    } else {
      pad.moveX = 0;
      pad.moveY = 0;
      pad.moveMagnitude = 0;
    }
  }

  // ── HARD PRESS → JUMP ──
  if (pad.fingerDown && !pad.hardPressDetected && state.playerGrounded) {
    const elapsed = Date.now() - pad.touchStartMs;
    if (elapsed >= cfg.HARD_PRESS_MIN_MS) {
      const forceTriggered = pad.touchForce >= cfg.HARD_PRESS_FORCE;
      const pushTriggered = pad.yPushAccum > 15;

      if (forceTriggered || pushTriggered) {
        pad.hardPressDetected = true;
        pad.jumpTriggered = true;
        pad.jumping = true;
        pad.playerVY = cfg.JUMP_VY;

        // Horizontal boost in drag direction
        if (Math.abs(pad.moveX) > 0.3) {
          pad.playerVX = pad.moveX * cfg.MAX_SPEED * 1.3;
        }

        state.playerJumping = true;
        state.playerGrounded = false;
      }
    }
  }

  // ── DODGE / PARRY ──
  // Backward drag = dodge (escape). Forward drag into enemy combo = PARRY.
  if (pad.fingerDown && !pad.dodging && state.playerGrounded) {
    // Fast backward drag = dodge
    if (pad.dragVX < -cfg.DODGE_SPEED_THRESHOLD) {
      pad.dodging = true;
      pad.dodgeDir = 'left';
      pad.dodgeTimer = cfg.DODGE_DURATION;
    }
    // Fast FORWARD drag during enemy combo = PARRY
    // (drag toward the enemy who is attacking you)
    else if (pad.dragVX > cfg.DODGE_SPEED_THRESHOLD && !pad.parryWindowActive) {
      // Check if any enemy is currently in a combo (attacking)
      const attackingEnemy = findAttackingEnemy(state);
      if (attackingEnemy) {
        // Parry! Dodge toward them
        pad.parryTriggered = true;
        pad.parryWindowActive = true;
        pad.parryWindowTimer = 0.15; // tight 150ms parry window
        pad.parryDir = 'right';
        pad.parryComboStarted = true;

        // Small forward dash (into the enemy)
        pad.dodging = true;
        pad.dodgeDir = 'right';
        pad.dodgeTimer = 0.2; // shorter than normal dodge
      }
    }
  }

  // ── ATTACK (forward drag pumps) ──
  if (pad.fingerDown && !pad.dodging && state.playerGrounded) {
    if (pad.dragVX > 0) {
      pad.attackPumpAccum += Math.abs(pad.dragVX) * dt;
    }

    const now = Date.now();
    if (pad.attackPumpAccum >= cfg.ATTACK_PUMP_DISTANCE &&
        now - pad.lastAttackMs >= cfg.ATTACK_COOLDOWN_MS) {
      const result = processComboInput(
        state.combo,
        pad.nextAttack,
        state.clock,
        state.gameTime,
      );
      pad.lastComboResult = result;
      pad.comboResultConsumed = false;
      pad.nextAttack = pad.nextAttack === 'A' ? 'B' : 'A';
      pad.lastAttackMs = now;
      pad.attackPumpAccum = 0;

      if (result.accepted) {
        const nearest = findNearestEnemy(state);
        if (nearest && Math.abs(nearest.x - state.playerX) < cfg.ATTACK_RANGE) {
          hitEnemy(nearest, result);
        }
      }
    }
  }

  // ── APPLY MOVEMENT ──
  if (pad.dodging) {
    pad.dodgeTimer -= dt;
    const dodgeVX = pad.dodgeDir === 'left' ? -cfg.DODGE_MOVE_SPEED : cfg.DODGE_MOVE_SPEED;
    state.playerX += dodgeVX * dt;
    pad.playerVX = dodgeVX;
    state.playerDodging = true;
    state.playerDodgeDir = pad.dodgeDir;

    if (pad.dodgeTimer <= 0) {
      pad.dodging = false;
      pad.dodgeDir = null;
      pad.dodgeTimer = 0;
      state.playerDodging = false;
      state.playerDodgeDir = null;
    }
  } else if (pad.fingerDown) {
    const speed = pad.moveMagnitude * cfg.MAX_SPEED;
    const vx = pad.moveX * speed;
    state.playerX += vx * dt;
    pad.playerVX = vx;
  } else if (!state.gameOver) {
    state.playerX += cfg.AUTO_ADVANCE * dt;
    pad.playerVX = cfg.AUTO_ADVANCE;
  }

  // ── BLOCK ──
  if (pad.blocking) {
    state.playerBlocking = true;
    pad.blockTimer -= dt;
    if (pad.blockTimer <= 0) {
      pad.blocking = false;
      state.playerBlocking = false;
    }
  } else {
    state.playerBlocking = false;
  }

  // ── JUMP PHYSICS ──
  if (!state.playerGrounded) {
    pad.playerVY += cfg.GRAVITY * dt * 60;
    state.playerY += pad.playerVY * dt * 60;

    if (state.playerY >= cfg.GROUND_Y) {
      state.playerY = cfg.GROUND_Y;
      pad.playerVY = 0;
      state.playerGrounded = true;
      state.playerJumping = false;
      pad.jumping = false;
    }
  }

  // ── CLAMP ──
  state.playerX = Math.max(0, Math.min(state.board.boardWidth, state.playerX));

  // ── HIT DETECTION ──
  if (state.playerHp < pad.prevHp) {
    // damage taken this frame
  }
  pad.prevHp = state.playerHp;

  // Re-center origin while dragging (prevents drift)
  if (pad.fingerDown) {
    const recenterRate = 0.02;
    pad.originX += (pad.currentX - pad.originX) * recenterRate;
    pad.originY += (pad.currentY - pad.originY) * recenterRate;
    pad.dragDX = pad.currentX - pad.originX;
    pad.dragDY = pad.currentY - pad.originY;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function findNearestEnemy(state: GameState): GameState['activeEnemies'][0] | null {
  let nearest: GameState['activeEnemies'][0] | null = null;
  let minDist = Infinity;
  for (const e of state.activeEnemies) {
    if (e.state === 'dead') continue;
    const dist = Math.abs(e.x - state.playerX);
    if (dist < minDist) {
      minDist = dist;
      nearest = e;
    }
  }
  return nearest;
}

/** Find an enemy currently in attack state (for parry detection) */
function findAttackingEnemy(state: GameState): GameState['activeEnemies'][0] | null {
  for (const e of state.activeEnemies) {
    if (e.state === 'attack' && Math.abs(e.x - state.playerX) < 120) {
      return e;
    }
  }
  return null;
}

// ============================================================================
// REACT NATIVE INTEGRATION
// ============================================================================

/** GestureHandler callbacks */
export function getDragPadCallbacks(pad: DragPadState) {
  return {
    onStart: (e: { x: number; y: number; force?: number }) => {
      padTouchStart(pad, e.x, e.y, e.force);
    },
    onMove: (e: { x: number; y: number; force?: number }) => {
      padTouchMove(pad, e.x, e.y, e.force);
    },
    onEnd: () => {
      padTouchEnd(pad);
    },
  };
}

/** PanResponder handlers */
export function getDragPadPanResponderHandlers(pad: DragPadState) {
  return {
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt: any) => {
      const touch = evt.nativeEvent;
      padTouchStart(pad, touch.pageX, touch.pageY, touch.force);
    },
    onPanResponderMove: (evt: any) => {
      const touch = evt.nativeEvent;
      padTouchMove(pad, touch.pageX, touch.pageY, touch.force);
    },
    onPanResponderRelease: () => {
      padTouchEnd(pad);
    },
    onPanResponderTerminate: () => {
      padTouchEnd(pad);
    },
  };
}

// ============================================================================
// DEBUG
// ============================================================================

export function getDragPadDebug(pad: DragPadState): {
  fingerDown: boolean;
  moveX: number;
  moveY: number;
  magnitude: number;
  dragSpeed: number;
  action: string;
  nextAttack: ComboInput;
  force: number;
} {
  let action = 'idle';
  if (pad.fingerDown) {
    if (pad.moveMagnitude > 0.1) action = `drag_${pad.moveX > 0 ? 'R' : 'L'}`;
    else action = 'hold';
  }
  if (pad.blocking) action = 'block';
  if (pad.dodging) action = `dodge_${pad.dodgeDir}`;
  if (pad.jumping) action = 'jump';
  if (pad.parryTriggered) action = 'PARRY';
  if (pad.parryWindowActive) action = 'parry_window';

  return {
    fingerDown: pad.fingerDown,
    moveX: Math.round(pad.moveX * 100) / 100,
    moveY: Math.round(pad.moveY * 100) / 100,
    magnitude: Math.round(pad.moveMagnitude * 100) / 100,
    dragSpeed: Math.round(Math.sqrt(pad.dragVX ** 2 + pad.dragVY ** 2)),
    action,
    nextAttack: pad.nextAttack,
    force: Math.round(pad.touchForce * 100) / 100,
  };
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================
// createDragPad()                          — init
// padTouchStart(pad, x, y, force?)        — finger down
// padTouchMove(pad, x, y, force?)         — finger moves
// padTouchEnd(pad)                        — finger lifts → block
// tickDragPad(pad, state, dt)             — tick every frame
// getDragPadCallbacks(pad)                — GestureHandler callbacks
// getDragPadPanResponderHandlers(pad)     — PanResponder handlers
// getDragPadDebug(pad)                    — debug display
// INPUT_CONFIG                            — tuning constants
// ============================================================================
