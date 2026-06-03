// ============================================================================
// KasVillage Game v1 — Rhythm Chain Combat
// Spotify BPM → rhythm clock → everything syncs
// 15 NPCs, 3 mini-bosses, 1 boss
// Chain combos to the beat. Miss the beat, combo breaks.
// Enemies use SDK physics — gravity, jumps, knockback, weight.
// Procedural seed per restart — different AI behavior every run.
// ============================================================================

import {
  createPhysicsState,
  updatePlatformer,
  AnimationPose,
} from './kasvillage_avatar_engine';

// Re-export the PhysicsState type locally for enemies
interface EnemyPhysics {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  facing: number;
  pose: AnimationPose;
  animTime: number;
  walkFrame: number;
}

/** SDK-compatible physics input — AI sets these flags, physics handles movement */
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

function emptyInput(): PhysicsInput {
  return { left:false, right:false, up:false, down:false, jump:false, attack:false, block:false, crouch:false, dodge:false, sprint:false };
}

function createEnemyPhysics(x: number, y: number): EnemyPhysics {
  return { x, y, vx: 0, vy: 0, grounded: true, facing: 270, pose: 'idle', animTime: 0, walkFrame: 0 };
}

/** Race weight table — bigger enemies move slower with wider arcs */
const ENEMY_WEIGHT: Record<string, { speed: number; jumpForce: number; gravity: number }> = {
  npc:       { speed: 3.0, jumpForce: -12, gravity: 0.6 },
  mini_boss: { speed: 2.5, jumpForce: -10, gravity: 0.7 },
  boss:      { speed: 2.0, jumpForce: -8,  gravity: 0.8 },
};

/** Apply platformer physics to enemy using SDK constants */
function updateEnemyPhysics(
  phys: EnemyPhysics,
  input: PhysicsInput,
  groundY: number,
  dt: number,
  weight: { speed: number; jumpForce: number; gravity: number },
): void {
  // Horizontal
  const speed = input.sprint ? weight.speed * 2.5 : weight.speed;
  if (input.left) { phys.vx = -speed; phys.facing = 270; }
  else if (input.right) { phys.vx = speed; phys.facing = 90; }
  else { phys.vx *= 0.85; }

  // Jump
  if (input.jump && phys.grounded) {
    phys.vy = weight.jumpForce;
    phys.grounded = false;
  }

  // Gravity
  if (!phys.grounded) phys.vy += weight.gravity;

  // Position
  phys.x += phys.vx * dt * 60;
  phys.y += phys.vy * dt * 60;

  // Ground
  if (phys.y >= groundY) {
    phys.y = groundY;
    phys.vy = 0;
    phys.grounded = true;
  }

  phys.animTime += dt;

  // Auto pose from physics state
  if (input.dodge) phys.pose = 'dodge_roll';
  else if (input.block) phys.pose = 'block';
  else if (input.attack) phys.pose = 'attack';
  else if (!phys.grounded) phys.pose = phys.vy < 0 ? 'jump' : 'fall';
  else if (input.sprint && Math.abs(phys.vx) > 1) phys.pose = 'sprint1';
  else if (Math.abs(phys.vx) > 1) {
    phys.walkFrame = (phys.walkFrame + dt * 8) % 2;
    phys.pose = phys.walkFrame < 1 ? 'run1' : 'run2';
  } else phys.pose = 'idle_combat';
}

/** Procedural session seed — different every restart */
let _sessionSeed = Date.now();

// ============================================================================
// RHYTHM CLOCK — one number drives the entire game
// ============================================================================

export interface RhythmClock {
  bpm: number;
  beatInterval: number;    // seconds per beat
  halfBeat: number;        // seconds per half-beat (for off-beat windows)
  timer: number;           // accumulator
  beatCount: number;       // total beats elapsed
  onBeat: boolean;         // true for one frame when beat hits
  beatWindow: number;      // ±tolerance in seconds for "on beat" input
  lastBeatTime: number;    // timestamp of last beat
}

/**
 * Create rhythm clock from BPM (from Spotify API or manual).
 * beatWindow = how forgiving the timing is.
 * 0.15 = tight (expert), 0.25 = forgiving (casual)
 */
export function createRhythmClock(bpm: number, beatWindow: number = 0.2): RhythmClock {
  const beatInterval = 60 / bpm;
  return {
    bpm,
    beatInterval,
    halfBeat: beatInterval / 2,
    timer: 0,
    beatCount: 0,
    onBeat: false,
    beatWindow,
    lastBeatTime: 0,
  };
}

/** Update clock every frame. Returns true on beat. */
export function tickClock(clock: RhythmClock, dt: number, gameTime: number): boolean {
  clock.timer += dt;
  clock.onBeat = false;

  if (clock.timer >= clock.beatInterval) {
    clock.timer -= clock.beatInterval;
    clock.beatCount++;
    clock.onBeat = true;
    clock.lastBeatTime = gameTime;
  }

  return clock.onBeat;
}

/** Check if a player input is "on beat" (within tolerance window) */
export function isOnBeat(clock: RhythmClock, gameTime: number): { onBeat: boolean; accuracy: number } {
  const timeSinceBeat = gameTime - clock.lastBeatTime;
  const timeToNextBeat = clock.beatInterval - timeSinceBeat;
  const closest = Math.min(timeSinceBeat, timeToNextBeat);

  if (closest <= clock.beatWindow) {
    // 1.0 = perfect, 0.0 = edge of window
    const accuracy = 1.0 - (closest / clock.beatWindow);
    return { onBeat: true, accuracy };
  }
  return { onBeat: false, accuracy: 0 };
}

/** Change BPM mid-game (song changes) */
export function setBPM(clock: RhythmClock, newBpm: number): void {
  clock.bpm = newBpm;
  clock.beatInterval = 60 / newBpm;
  clock.halfBeat = clock.beatInterval / 2;
}

// ============================================================================
// COMBO SYSTEM — chain attacks to the beat
// ============================================================================

export type ComboInput = 'A' | 'B';

export interface ComboState {
  chain: ComboInput[];       // current chain sequence
  chainLength: number;
  maxChain: number;          // longest chain this session
  multiplier: number;        // damage/score multiplier
  lastInputTime: number;     // when last input was received
  chainTimeout: number;      // seconds before chain breaks from inactivity
  perfectHits: number;       // consecutive perfect-accuracy hits
  comboActive: boolean;
  // Chain thresholds for enemy types
  readonly npcKillChain: number;
  readonly miniBossKillChain: number;
  readonly bossKillChain: number;
}

export function createComboState(): ComboState {
  return {
    chain: [],
    chainLength: 0,
    maxChain: 0,
    multiplier: 1,
    lastInputTime: 0,
    chainTimeout: 1.5,   // 1.5 seconds of no input = chain breaks
    perfectHits: 0,
    comboActive: false,
    npcKillChain: 5,
    miniBossKillChain: 15,
    bossKillChain: 30,
  };
}

export interface ComboResult {
  accepted: boolean;
  accuracy: number;
  chainLength: number;
  multiplier: number;
  broke: boolean;        // did the chain break?
  perfect: boolean;      // was this a perfect-accuracy hit?
  // Paint splat intensity derived from combo
  splatIntensity: number; // 0.0–1.0
}

/**
 * Process a combo input. Must be called on A or B press.
 * Checks rhythm timing, extends or breaks chain.
 */
export function processComboInput(
  combo: ComboState,
  input: ComboInput,
  clock: RhythmClock,
  gameTime: number,
): ComboResult {
  const beat = isOnBeat(clock, gameTime);

  // Check for chain timeout
  if (combo.comboActive && gameTime - combo.lastInputTime > combo.chainTimeout) {
    // Chain broke from inactivity
    const result = breakCombo(combo);
    return { ...result, accuracy: 0, accepted: false };
  }

  if (beat.onBeat) {
    // On-beat hit — extend chain
    combo.chain.push(input);
    combo.chainLength++;
    combo.lastInputTime = gameTime;
    combo.comboActive = true;

    if (combo.chainLength > combo.maxChain) combo.maxChain = combo.chainLength;

    // Perfect hit (accuracy > 0.85)
    const perfect = beat.accuracy > 0.85;
    if (perfect) {
      combo.perfectHits++;
    } else {
      combo.perfectHits = 0;
    }

    // Multiplier grows with chain
    combo.multiplier = 1 + Math.floor(combo.chainLength / 3) * 0.5;
    // Perfect streak bonus
    if (combo.perfectHits >= 3) combo.multiplier += 0.5;
    if (combo.perfectHits >= 5) combo.multiplier += 0.5;

    const splatIntensity = Math.min(1, combo.chainLength / 15 + beat.accuracy * 0.3);

    return {
      accepted: true,
      accuracy: beat.accuracy,
      chainLength: combo.chainLength,
      multiplier: combo.multiplier,
      broke: false,
      perfect,
      splatIntensity,
    };
  } else {
    // Off-beat — chain breaks
    return breakCombo(combo);
  }
}

function breakCombo(combo: ComboState): ComboResult {
  const wasLength = combo.chainLength;
  combo.chain = [];
  combo.chainLength = 0;
  combo.multiplier = 1;
  combo.perfectHits = 0;
  combo.comboActive = false;

  return {
    accepted: false,
    accuracy: 0,
    chainLength: 0,
    multiplier: 1,
    broke: true,
    perfect: false,
    splatIntensity: 0.1,
  };
}

/** Force break (enemy hit the player) */
export function forceBreakCombo(combo: ComboState): void {
  combo.chain = [];
  combo.chainLength = 0;
  combo.multiplier = 1;
  combo.perfectHits = 0;
  combo.comboActive = false;
}

// ============================================================================
// ENEMY AI — reactive, rhythm-aware, punishes mistakes
// ============================================================================

export type EnemyType = 'npc' | 'mini_boss' | 'boss';

export type AIState =
  | 'idle'           // waiting, not engaged
  | 'approach'       // moving toward player
  | 'circle'         // strafing around player
  | 'attack_wind'    // winding up attack
  | 'attack'         // attacking
  | 'attack_recover' // recovery frames after attack
  | 'block'          // blocking player combo
  | 'dodge'          // evading player attack
  | 'stagger'        // hit by player, stunned
  | 'combo_punish'   // player missed beat, enemy rushes in
  | 'retreat'        // backing off after combo exchange
  | 'dead';

export interface EnemyAI {
  id: string;
  type: EnemyType;
  name: string;

  // Position
  x: number;
  y: number;
  facingRight: boolean;

  // State
  state: AIState;
  stateTimer: number;     // time in current state
  hp: number;
  maxHp: number;
  chainToKill: number;    // combo chain length needed to kill

  // AI behavior params — tuned per enemy
  aggressiveness: number; // 0.0–1.0 how often it attacks
  reactionSpeed: number;  // 0.0–1.0 how fast it reacts to player mistakes
  blockChance: number;    // 0.0–1.0 chance to block during player combo
  dodgeChance: number;    // 0.0–1.0 chance to dodge
  counterWindow: number;  // seconds — how fast it punishes broken combos
  rhythmAware: boolean;   // attacks sync to beat?
  comboBreaker: boolean;  // can interrupt player mid-combo?

  // Attack pattern
  attackPattern: ComboInput[];  // e.g. ['A','B','A'] — player must dodge this
  attackPatternIndex: number;
  attackSpeed: number;    // multiplier on beat interval for attack cadence
  attackDamage: number;

  // Visual
  color: string;
  scale: number;

  // SDK physics — gravity, velocity, grounded state, auto-pose
  physics: EnemyPhysics;
}

// ============================================================================
// 15 NPC DEFINITIONS
// ============================================================================

function npc(id: string, name: string, overrides: Partial<EnemyAI>): EnemyAI {
  return {
    id, type: 'npc', name,
    x: 300, y: 350, facingRight: false,
    state: 'idle', stateTimer: 0,
    hp: 3, maxHp: 3, chainToKill: 5,
    aggressiveness: 0.3, reactionSpeed: 0.3, blockChance: 0.1,
    dodgeChance: 0.05, counterWindow: 0.8, rhythmAware: false,
    comboBreaker: false,
    attackPattern: ['A'], attackPatternIndex: 0,
    attackSpeed: 1.0, attackDamage: 5,
    color: '#AA4444', scale: 1.0,
    physics: createEnemyPhysics(300, 350),
    ...overrides,
  };
}

function miniBoss(id: string, name: string, overrides: Partial<EnemyAI>): EnemyAI {
  return {
    id, type: 'mini_boss', name,
    x: 300, y: 350, facingRight: false,
    state: 'idle', stateTimer: 0,
    hp: 10, maxHp: 10, chainToKill: 15,
    aggressiveness: 0.6, reactionSpeed: 0.6, blockChance: 0.3,
    dodgeChance: 0.2, counterWindow: 0.5, rhythmAware: true,
    comboBreaker: true,
    attackPattern: ['A','B','A'], attackPatternIndex: 0,
    attackSpeed: 1.2, attackDamage: 12,
    color: '#AA6622', scale: 1.3,
    physics: createEnemyPhysics(300, 350),
    ...overrides,
  };
}

function boss(id: string, name: string, overrides: Partial<EnemyAI>): EnemyAI {
  return {
    id, type: 'boss', name,
    x: 300, y: 350, facingRight: false,
    state: 'idle', stateTimer: 0,
    hp: 25, maxHp: 25, chainToKill: 30,
    aggressiveness: 0.8, reactionSpeed: 0.85, blockChance: 0.5,
    dodgeChance: 0.35, counterWindow: 0.3, rhythmAware: true,
    comboBreaker: true,
    attackPattern: ['B','A','B','B','A'], attackPatternIndex: 0,
    attackSpeed: 1.5, attackDamage: 20,
    color: '#880044', scale: 1.6,
    physics: createEnemyPhysics(300, 350),
    ...overrides,
  };
}

export const ENEMY_ROSTER: EnemyAI[] = [
  // === 15 NPCs — escalating difficulty ===
  // Tier 1: Fodder (approach + single attack)
  npc('npc_01', 'Prowler',      { aggressiveness: 0.2, reactionSpeed: 0.2, hp: 2, chainToKill: 3, color: '#885544' }),
  npc('npc_02', 'Skulker',      { aggressiveness: 0.25, reactionSpeed: 0.25, hp: 2, chainToKill: 3, color: '#886655' }),
  npc('npc_03', 'Grunt',        { aggressiveness: 0.3, reactionSpeed: 0.3, hp: 3, chainToKill: 4, color: '#996655' }),

  // Tier 2: Fighters (block sometimes, faster reaction)
  npc('npc_04', 'Brawler',      { aggressiveness: 0.35, reactionSpeed: 0.4, blockChance: 0.15, hp: 3, chainToKill: 5, color: '#AA5544', attackPattern: ['A','A'] }),
  npc('npc_05', 'Slasher',      { aggressiveness: 0.4, reactionSpeed: 0.4, hp: 4, chainToKill: 5, attackSpeed: 1.1, color: '#AA6644', attackPattern: ['A','B'] }),
  npc('npc_06', 'Brute',        { aggressiveness: 0.4, reactionSpeed: 0.35, blockChance: 0.2, hp: 5, chainToKill: 6, attackDamage: 8, scale: 1.15, color: '#BB5533' }),

  // Tier 3: Agile (dodge, punish mistakes)
  npc('npc_07', 'Dancer',       { aggressiveness: 0.35, reactionSpeed: 0.5, dodgeChance: 0.25, hp: 3, chainToKill: 5, counterWindow: 0.6, color: '#886688' }),
  npc('npc_08', 'Phantom',      { aggressiveness: 0.3, reactionSpeed: 0.55, dodgeChance: 0.35, hp: 3, chainToKill: 6, counterWindow: 0.5, color: '#665588' }),
  npc('npc_09', 'Viper',        { aggressiveness: 0.5, reactionSpeed: 0.5, dodgeChance: 0.2, hp: 4, chainToKill: 6, attackSpeed: 1.3, attackPattern: ['A','A','B'], color: '#448866' }),

  // Tier 4: Smart (rhythm-aware, combo breakers)
  npc('npc_10', 'Sentinel',     { aggressiveness: 0.45, reactionSpeed: 0.55, blockChance: 0.3, rhythmAware: true, hp: 5, chainToKill: 7, color: '#5566AA' }),
  npc('npc_11', 'Stalker',      { aggressiveness: 0.5, reactionSpeed: 0.6, dodgeChance: 0.2, comboBreaker: true, hp: 4, chainToKill: 7, counterWindow: 0.45, color: '#445588' }),
  npc('npc_12', 'Warden',       { aggressiveness: 0.5, reactionSpeed: 0.6, blockChance: 0.35, rhythmAware: true, comboBreaker: true, hp: 6, chainToKill: 8, attackPattern: ['B','A','B'], attackDamage: 10, scale: 1.1, color: '#556688' }),

  // Tier 5: Elite (mini-boss level stats but NPC role)
  npc('npc_13', 'Executioner',  { aggressiveness: 0.55, reactionSpeed: 0.65, blockChance: 0.3, dodgeChance: 0.15, comboBreaker: true, hp: 7, chainToKill: 8, attackDamage: 10, attackPattern: ['A','B','A'], color: '#AA3355' }),
  npc('npc_14', 'Revenant',     { aggressiveness: 0.6, reactionSpeed: 0.7, blockChance: 0.25, dodgeChance: 0.25, rhythmAware: true, comboBreaker: true, hp: 6, chainToKill: 9, counterWindow: 0.4, attackSpeed: 1.2, color: '#663366' }),
  npc('npc_15', 'Champion',     { aggressiveness: 0.6, reactionSpeed: 0.7, blockChance: 0.35, dodgeChance: 0.2, rhythmAware: true, comboBreaker: true, hp: 8, chainToKill: 10, counterWindow: 0.35, attackPattern: ['B','A','A','B'], attackDamage: 12, scale: 1.2, color: '#994433' }),

  // === 3 MINI-BOSSES ===
  miniBoss('mb_01', 'Crimson Knight', {
    hp: 12, chainToKill: 15,
    aggressiveness: 0.65, reactionSpeed: 0.7,
    blockChance: 0.4, dodgeChance: 0.2,
    counterWindow: 0.4, attackPattern: ['A','B','B','A'],
    attackDamage: 15, color: '#CC2222',
  }),
  miniBoss('mb_02', 'Shadow Dancer', {
    hp: 10, chainToKill: 15,
    aggressiveness: 0.55, reactionSpeed: 0.8,
    blockChance: 0.2, dodgeChance: 0.45,
    counterWindow: 0.3, attackPattern: ['A','A','B','A','B'],
    attackSpeed: 1.4, attackDamage: 12, color: '#6622AA',
  }),
  miniBoss('mb_03', 'Iron Golem', {
    hp: 18, chainToKill: 18,
    aggressiveness: 0.7, reactionSpeed: 0.5,
    blockChance: 0.6, dodgeChance: 0.05,
    counterWindow: 0.6, attackPattern: ['B','B','B'],
    attackSpeed: 0.8, attackDamage: 22, scale: 1.5, color: '#888888',
  }),

  // === 1 BOSS ===
  boss('boss_01', 'The Conductor', {
    hp: 30, chainToKill: 30,
    aggressiveness: 0.85, reactionSpeed: 0.9,
    blockChance: 0.5, dodgeChance: 0.35,
    counterWindow: 0.25,
    attackPattern: ['B','A','B','B','A','A','B'],
    attackSpeed: 1.5, attackDamage: 25,
    scale: 1.8, color: '#FFD700',
  }),
];

// ============================================================================
// AI STATE MACHINE — drives enemy behavior every frame
// ============================================================================

interface AIContext {
  playerX: number;
  playerY: number;
  playerComboActive: boolean;
  playerChainLength: number;
  playerMissedBeat: boolean;    // true for one frame when player breaks combo
  playerBlocking: boolean;
  clock: RhythmClock;
  gameTime: number;
  dt: number;
}

/** Session-seeded random — different behavior every restart */
let _aiSeed = _sessionSeed;
function aiRand(): number {
  _aiSeed = (_aiSeed * 1103515245 + 12345) & 0x7fffffff;
  return (_aiSeed % 10000) / 10000;
}

/** Reset AI seed for new session */
export function newSession(): void {
  _sessionSeed = Date.now();
  _aiSeed = _sessionSeed;
}

/**
 * Update one enemy's AI state. Call every frame.
 * Returns actions the game should execute (move, attack, etc.)
 */
export interface AIAction {
  type: 'none' | 'move' | 'attack' | 'block' | 'dodge' | 'stagger' | 'die';
  direction?: number;   // -1 left, 1 right
  attackInput?: ComboInput; // which attack the enemy throws
  damage?: number;
}

export function updateEnemyAI(enemy: EnemyAI, ctx: AIContext): AIAction {
  enemy.stateTimer += ctx.dt;
  const distToPlayer = Math.abs(enemy.physics.x - ctx.playerX);
  const beatTime = ctx.clock.beatInterval / enemy.attackSpeed;
  const action: AIAction = { type: 'none' };
  const input = emptyInput();
  const weight = ENEMY_WEIGHT[enemy.type] || ENEMY_WEIGHT.npc;

  // Face player
  enemy.facingRight = ctx.playerX > enemy.physics.x;

  switch (enemy.state) {

    case 'idle': {
      if (enemy.stateTimer > 1.0 + aiRand() * 2.0) {
        enemy.state = 'approach';
        enemy.stateTimer = 0;
      }
      break;
    }

    case 'approach': {
      // Move toward player via physics input
      if (enemy.facingRight) input.right = true;
      else input.left = true;
      action.type = 'move';
      action.direction = enemy.facingRight ? 1 : -1;

      if (distToPlayer < 60) {
        if (ctx.playerMissedBeat && enemy.reactionSpeed > aiRand()) {
          enemy.state = 'combo_punish';
          enemy.stateTimer = 0;
        } else if (ctx.playerComboActive && enemy.comboBreaker && enemy.reactionSpeed > aiRand() * 1.5) {
          if (enemy.blockChance > aiRand()) {
            enemy.state = 'block';
            enemy.stateTimer = 0;
          } else {
            enemy.state = 'attack_wind';
            enemy.stateTimer = 0;
          }
        } else if (enemy.aggressiveness > aiRand()) {
          enemy.state = 'attack_wind';
          enemy.stateTimer = 0;
        } else {
          enemy.state = 'circle';
          enemy.stateTimer = 0;
        }
      }
      break;
    }

    case 'circle': {
      const strafeDir = aiRand() > 0.5 ? 1 : -1;
      if (strafeDir > 0) input.right = true; else input.left = true;
      action.type = 'move';
      action.direction = strafeDir;

      // Randomly jump while circling (agile enemies)
      if (enemy.dodgeChance > 0.2 && aiRand() > 0.95) input.jump = true;

      if (ctx.playerMissedBeat && enemy.reactionSpeed > aiRand()) {
        enemy.state = 'combo_punish';
        enemy.stateTimer = 0;
      } else if (enemy.stateTimer > 0.8 + aiRand() * 1.5) {
        if (enemy.aggressiveness > aiRand()) {
          enemy.state = 'attack_wind';
        } else {
          enemy.state = 'approach';
        }
        enemy.stateTimer = 0;
      }
      break;
    }

    case 'attack_wind': {
      const windUpTime = enemy.rhythmAware ? beatTime * 0.8 : 0.3 + (1 - enemy.attackSpeed) * 0.3;
      input.attack = true; // triggers attack_wind pose via physics
      if (enemy.stateTimer >= windUpTime) {
        enemy.state = 'attack';
        enemy.stateTimer = 0;
        enemy.attackPatternIndex = 0;
      }
      break;
    }

    case 'attack': {
      const attackBeatTime = enemy.rhythmAware ? beatTime : 0.25;
      input.attack = true;
      // Lunge forward during attack
      if (enemy.facingRight) input.right = true; else input.left = true;

      if (enemy.stateTimer >= attackBeatTime) {
        enemy.stateTimer = 0;
        const atk = enemy.attackPattern[enemy.attackPatternIndex];
        action.type = 'attack';
        action.attackInput = atk;
        action.damage = enemy.attackDamage;

        enemy.attackPatternIndex++;
        if (enemy.attackPatternIndex >= enemy.attackPattern.length) {
          enemy.state = 'attack_recover';
          enemy.stateTimer = 0;
        }
      }
      break;
    }

    case 'attack_recover': {
      const recoveryTime = 0.4 + (1 - enemy.reactionSpeed) * 0.4;
      if (enemy.stateTimer >= recoveryTime) {
        enemy.state = enemy.aggressiveness > 0.5 ? 'approach' : 'circle';
        enemy.stateTimer = 0;
      }
      break;
    }

    case 'combo_punish': {
      if (enemy.stateTimer < enemy.counterWindow) {
        // Sprint toward player
        if (enemy.facingRight) input.right = true; else input.left = true;
        input.sprint = true;
        action.type = 'move';
      } else if (enemy.stateTimer < enemy.counterWindow + 0.15) {
        input.attack = true;
        action.type = 'attack';
        action.attackInput = 'B';
        action.damage = enemy.attackDamage * 1.5;
      } else {
        enemy.state = 'retreat';
        enemy.stateTimer = 0;
      }
      break;
    }

    case 'block': {
      input.block = true;
      if (enemy.stateTimer > 0.5 + aiRand() * 0.5) {
        enemy.state = 'attack_wind';
        enemy.stateTimer = 0;
      }
      action.type = 'block';
      break;
    }

    case 'dodge': {
      input.dodge = true;
      // Dodge away from player
      if (enemy.facingRight) input.left = true; else input.right = true;
      // Jump dodge for agile enemies
      if (enemy.dodgeChance > 0.3 && enemy.physics.grounded) input.jump = true;
      action.type = 'dodge';
      action.direction = enemy.facingRight ? -1 : 1;

      if (enemy.stateTimer > 0.3) {
        enemy.state = 'circle';
        enemy.stateTimer = 0;
      }
      break;
    }

    case 'stagger': {
      // Knockback via physics — vx gets set by hitEnemy, gravity handles the rest
      const staggerTime = enemy.type === 'boss' ? 0.2 : enemy.type === 'mini_boss' ? 0.3 : 0.4;
      if (enemy.stateTimer >= staggerTime) {
        if (enemy.hp <= 0) {
          enemy.state = 'dead';
        } else {
          if (enemy.dodgeChance > aiRand()) {
            enemy.state = 'dodge';
          } else if (enemy.blockChance > aiRand() * 1.5) {
            enemy.state = 'block';
          } else {
            enemy.state = 'retreat';
          }
          enemy.stateTimer = 0;
        }
      }
      action.type = 'stagger';
      break;
    }

    case 'retreat': {
      // Back away from player
      if (enemy.facingRight) input.left = true; else input.right = true;
      action.type = 'move';
      action.direction = enemy.facingRight ? -1 : 1;

      if (enemy.stateTimer > 0.6 + aiRand() * 0.8) {
        enemy.state = distToPlayer > 120 ? 'approach' : 'circle';
        enemy.stateTimer = 0;
      }
      break;
    }

    case 'dead': {
      action.type = 'die';
      break;
    }
  }

  // Apply SDK physics — this replaces all direct position manipulation
  if (enemy.state !== 'dead') {
    updateEnemyPhysics(enemy.physics, input, ctx.clock.beatInterval > 0 ? 380 : 380, ctx.dt, weight);
    enemy.x = enemy.physics.x;
    enemy.y = enemy.physics.y;
  }

  return action;
}

/**
 * Call when player hits an enemy.
 * Checks if enemy blocks/dodges, applies damage, triggers stagger.
 */
export function hitEnemy(
  enemy: EnemyAI,
  comboResult: ComboResult,
): { hit: boolean; blocked: boolean; dodged: boolean; killed: boolean } {
  if (enemy.state === 'dead') return { hit: false, blocked: false, dodged: false, killed: false };

  // Block check
  if (enemy.state === 'block') {
    return { hit: false, blocked: true, dodged: false, killed: false };
  }

  // Dodge check (only if enemy has high enough dodge chance and not staggered)
  if (enemy.state !== 'stagger' && enemy.state !== 'attack' && enemy.dodgeChance > aiRand()) {
    enemy.state = 'dodge';
    enemy.stateTimer = 0;
    return { hit: false, blocked: false, dodged: true, killed: false };
  }

  // Hit lands — apply knockback via physics
  const knockback = comboResult.multiplier * (comboResult.perfect ? 4 : 2);
  const knockDir = enemy.facingRight ? -1 : 1; // knocked away from player
  enemy.physics.vx = knockDir * knockback;
  enemy.physics.vy = -2; // slight upward pop

  const damage = comboResult.multiplier * (comboResult.perfect ? 1.5 : 1.0);
  enemy.hp -= damage;
  enemy.state = 'stagger';
  enemy.stateTimer = 0;

  // Check kill via chain length
  const killed = enemy.hp <= 0 || comboResult.chainLength >= enemy.chainToKill;
  if (killed) {
    enemy.hp = 0;
    enemy.state = 'dead';
  }

  return { hit: true, blocked: false, dodged: false, killed };
}

// ============================================================================
// BOARD LAYOUT — enemy placement for one board
// ============================================================================

export interface BoardLayout {
  enemies: Array<{
    enemyId: string;
    spawnX: number;
    spawnY: number;
    triggerX: number;  // player X position that triggers this enemy
  }>;
  boardWidth: number;
  groundY: number;
}

/**
 * Generate the v1 board layout.
 * 15 NPCs in escalating difficulty, 3 mini-bosses at checkpoints, boss at end.
 */
export function generateV1Board(): BoardLayout {
  const boardWidth = 4000;
  const groundY = 380;
  const enemies: BoardLayout['enemies'] = [];

  // 15 NPCs spread across the board
  for (let i = 0; i < 15; i++) {
    enemies.push({
      enemyId: `npc_${String(i + 1).padStart(2, '0')}`,
      spawnX: 200 + i * 220,
      spawnY: groundY,
      triggerX: 100 + i * 220,
    });
  }

  // 3 mini-bosses at quarter, half, three-quarter marks
  enemies.push({ enemyId: 'mb_01', spawnX: 1000, spawnY: groundY, triggerX: 900 });
  enemies.push({ enemyId: 'mb_02', spawnX: 2000, spawnY: groundY, triggerX: 1900 });
  enemies.push({ enemyId: 'mb_03', spawnX: 3000, spawnY: groundY, triggerX: 2900 });

  // Boss at end
  enemies.push({ enemyId: 'boss_01', spawnX: 3700, spawnY: groundY, triggerX: 3500 });

  return { enemies, boardWidth, groundY };
}

/**
 * Spawn an enemy instance from the roster by ID.
 */
export function spawnEnemy(enemyId: string, x: number, y: number): EnemyAI | null {
  const template = ENEMY_ROSTER.find(e => e.id === enemyId);
  if (!template) return null;
  return {
    ...template,
    x, y,
    state: 'idle', stateTimer: 0,
    hp: template.maxHp,
    attackPatternIndex: 0,
    physics: createEnemyPhysics(x, y),
  };
}

// ============================================================================
// GAME SESSION INTEGRATION — ties clock + combo + enemies together
// ============================================================================

export interface GameState {
  clock: RhythmClock;
  combo: ComboState;
  board: BoardLayout;
  activeEnemies: EnemyAI[];
  spawnedIds: Set<string>;
  playerX: number;
  playerY: number;
  playerHp: number;
  playerMaxHp: number;
  playerBlocking: boolean;
  gameTime: number;
  gameOver: boolean;
  victory: boolean;
  trialTime: number;     // seconds elapsed for time trial
}

export function createGameState(bpm: number): GameState {
  // New session seed — different AI behavior every restart
  newSession();
  return {
    clock: createRhythmClock(bpm),
    combo: createComboState(),
    board: generateV1Board(),
    activeEnemies: [],
    spawnedIds: new Set(),
    playerX: 50,
    playerY: 380,
    playerHp: 100,
    playerMaxHp: 100,
    playerBlocking: false,
    gameTime: 0,
    gameOver: false,
    victory: false,
    trialTime: 0,
  };
}

/**
 * Main game tick. Call every frame.
 */
export function tickGame(state: GameState, dt: number): void {
  if (state.gameOver) return;

  state.gameTime += dt;
  state.trialTime += dt;

  // Tick rhythm clock
  tickClock(state.clock, dt, state.gameTime);

  // Spawn enemies when player reaches trigger points
  for (const spawn of state.board.enemies) {
    if (!state.spawnedIds.has(spawn.enemyId) && state.playerX >= spawn.triggerX) {
      const enemy = spawnEnemy(spawn.enemyId, spawn.spawnX, spawn.spawnY);
      if (enemy) {
        state.activeEnemies.push(enemy);
        state.spawnedIds.add(spawn.enemyId);
      }
    }
  }

  // Check combo timeout
  if (state.combo.comboActive &&
      state.gameTime - state.combo.lastInputTime > state.combo.chainTimeout) {
    forceBreakCombo(state.combo);
  }

  // Update all active enemies
  const playerMissedBeat = !state.combo.comboActive && state.combo.maxChain > 0;
  const ctx: AIContext = {
    playerX: state.playerX,
    playerY: state.playerY,
    playerComboActive: state.combo.comboActive,
    playerChainLength: state.combo.chainLength,
    playerMissedBeat,
    playerBlocking: state.playerBlocking,
    clock: state.clock,
    gameTime: state.gameTime,
    dt,
  };

  for (const enemy of state.activeEnemies) {
    if (enemy.state === 'dead') continue;

    const action = updateEnemyAI(enemy, ctx);

    // Handle enemy attacks hitting player
    if (action.type === 'attack' && Math.abs(enemy.x - state.playerX) < 60) {
      if (state.playerBlocking) {
        // Player blocked — no damage but combo breaks
        forceBreakCombo(state.combo);
      } else {
        // Player hit
        state.playerHp -= action.damage || 10;
        forceBreakCombo(state.combo);
        if (state.playerHp <= 0) {
          state.playerHp = 0;
          state.gameOver = true;
        }
      }
    }
  }

  // Remove dead enemies
  state.activeEnemies = state.activeEnemies.filter(e => e.state !== 'dead');

  // Victory check — all enemies spawned and dead
  if (state.spawnedIds.size === state.board.enemies.length && state.activeEnemies.length === 0) {
    state.victory = true;
    state.gameOver = true;
  }
}
