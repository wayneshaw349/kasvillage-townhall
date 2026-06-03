// ============================================================================
// KasVillage Tuned Config — From Real Calibration Data
// Source: 4 testers, 38 sessions, 1900 individual taps, 120 BPM, WiFi sim
//
// KEY FINDINGS:
//   - Median tap offset: -23.5ms (players tap slightly EARLY)
//   - Mean absolute offset: 119ms (average distance from perfect)
//   - Perfect hits: 9.6% of taps (within 25ms)
//   - Miss rate: 55.8% at 200ms window — too tight for default
//   - 300ms window → 64% hit rate — comfortable for normal
//   - 350ms window → 73% hit rate — good for easy
//   - Compound latency: 120ms (WiFi + wired audio)
//   - Max drift: 64ms between Spotify polls
//   - Recommended default offset: -8ms (compensate for early tap bias)
//
// DIFFICULTY CALIBRATED FROM PERCENTILES:
//   Easy:   P75 offset (180ms half-window → 360ms total) → 73%+ hit rate
//   Normal: P50 offset (140ms half-window → 280ms total) → 61%+ hit rate
//   Hard:   P25 offset (80ms half-window  → 160ms total) → 33%+ hit rate
//   Expert: P10 offset (50ms half-window  → 100ms total) → 20%+ hit rate
// ============================================================================

export const TUNED_CONFIG = {

  // ═══════════════════════════════════════════════════════════════
  // BEAT WINDOWS — calibrated from real human timing data
  // ═══════════════════════════════════════════════════════════════

  DIFFICULTY: {
    easy: {
      /** Total beat window in ms */
      beatWindow: 360,
      /** Half-window for ±tolerance */
      halfWindow: 180,
      /** Perfect threshold (% of half-window) */
      perfectThreshold: 0.15,   // within 27ms = perfect
      /** Good threshold */
      goodThreshold: 0.45,      // within 81ms = good
      /** Enemy block window (slightly wider than attack) */
      enemyBlockWindow: 400,
      /** Parry window */
      parryWindow: 220,
      /** Guard meter: blocks before break */
      guardBlockCost: 18,       // ~5.5 blocks
      /** Guard regen per second */
      guardRegen: 28,
      /** Guard stun duration */
      guardStunDuration: 0.7,
      /** Passivity threshold (seconds before punishment) */
      passivityThreshold: 5.0,
      /** Combo decay: minimum chain to punish */
      comboDecayMinChain: 8,
    },
    normal: {
      beatWindow: 280,
      halfWindow: 140,
      perfectThreshold: 0.18,   // within 25ms = perfect
      goodThreshold: 0.45,      // within 63ms = good
      enemyBlockWindow: 310,
      parryWindow: 170,
      guardBlockCost: 26,       // ~3.8 blocks
      guardRegen: 18,
      guardStunDuration: 1.0,
      passivityThreshold: 3.5,
      comboDecayMinChain: 6,
    },
    hard: {
      beatWindow: 160,
      halfWindow: 80,
      perfectThreshold: 0.25,   // within 20ms = perfect
      goodThreshold: 0.50,      // within 40ms = good
      enemyBlockWindow: 190,
      parryWindow: 120,
      guardBlockCost: 33,       // ~3 blocks
      guardRegen: 12,
      guardStunDuration: 1.3,
      passivityThreshold: 2.5,
      comboDecayMinChain: 4,
    },
    expert: {
      beatWindow: 100,
      halfWindow: 50,
      perfectThreshold: 0.30,   // within 15ms = perfect
      goodThreshold: 0.55,      // within 27ms = good
      enemyBlockWindow: 130,
      parryWindow: 80,
      guardBlockCost: 38,       // ~2.6 blocks
      guardRegen: 8,
      guardStunDuration: 1.5,
      passivityThreshold: 2.0,
      comboDecayMinChain: 3,
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // LATENCY COMPENSATION — from calibration data
  // ═══════════════════════════════════════════════════════════════

  LATENCY: {
    /** Default offset applied to all tap timing (ms)
     *  Negative = players tap early on average (-8ms from data) */
    defaultOffset: -8,

    /** Spotify API poll interval (ms) — 2s default, 1s if drift > 50ms */
    pollInterval: 2000,
    pollIntervalFast: 1000,

    /** Drift threshold for fast polling (ms) */
    driftFastThreshold: 50,

    /** Hard sync correction threshold (ms)
     *  If game clock drifts more than this from Spotify, hard snap */
    syncCorrectionThreshold: 96,   // 1.5x max observed drift (64ms)

    /** Soft sync correction rate
     *  For drift < threshold, lerp toward correct position */
    softCorrectionRate: 0.3,

    /** Audio output compensation presets (ms) */
    audioCompensation: {
      wired: 15,
      speaker: 25,
      bluetooth_earbuds: 150,
      bluetooth_speaker: 200,
    },

    /** Maximum tolerated compound latency before warning (ms) */
    maxTolerableLatency: 300,
  },

  // ═══════════════════════════════════════════════════════════════
  // TIMING ACCURACY → DAMAGE MULTIPLIERS — from hit distribution
  // ═══════════════════════════════════════════════════════════════

  DAMAGE_MULTIPLIERS: {
    /** Perfect (within ~25ms): massive reward for precise timing */
    perfect: 3.0,
    /** Good (within ~63ms): solid hit */
    good: 2.0,
    /** OK (within ~140ms): acceptable */
    ok: 1.2,
    /** Late/sloppy (within window but poor timing) */
    weak: 0.8,
  },

  // ═══════════════════════════════════════════════════════════════
  // COMBO SYSTEM — tuned to observed streak patterns
  // ═══════════════════════════════════════════════════════════════

  COMBO: {
    /** Timeout between inputs before combo breaks (seconds)
     *  At 120 BPM = 500ms per beat. 3 beats = 1.5s grace period */
    chainTimeout: 1.5,

    /** Multiplier increment per chain hit */
    multiplierStep: 0.15,

    /** Max multiplier */
    maxMultiplier: 5.0,

    /** Chain milestones for popups/effects
     *  Observed max streak: 12. Set milestones at 5, 10, 15, 20, 30, 50 */
    milestones: [5, 10, 15, 20, 30, 50],

    /** Combo decay punishment — tighter window + enemy heal
     *  Scaled from observed data: players average 5.7 streak,
     *  so punishing at chain 5+ makes them feel the loss */
    decay: {
      /** Chain 5-9: mild punishment */
      mild:   { windowMultiplier: 0.88, enemyHealPct: 4, duration: 4 },
      /** Chain 10-19: moderate */
      medium: { windowMultiplier: 0.78, enemyHealPct: 8, duration: 5 },
      /** Chain 20+: severe */
      severe: { windowMultiplier: 0.65, enemyHealPct: 14, duration: 6 },
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // INPUT — from observed tap patterns
  // ═══════════════════════════════════════════════════════════════

  INPUT: {
    /** Minimum time between registered attacks (ms)
     *  At 120 BPM, beats are 500ms apart. Players shouldn't spam
     *  faster than every 100ms */
    attackCooldown: 100,

    /** Drag distance for pump attack trigger (px) */
    attackPumpDistance: 28,

    /** Dodge speed threshold (px/s) */
    dodgeSpeedThreshold: 280,

    /** Dodge duration (seconds) */
    dodgeDuration: 0.35,

    /** Hard press minimum hold (ms) for jump */
    hardPressMinMs: 80,

    /** Block window after finger lift (seconds)
     *  Wider than attack window — blocking is defensive, should be forgiving */
    blockWindowSeconds: 0.40,

    /** Parry forward dash duration (seconds) */
    parryDashDuration: 0.2,

    /** Parry damage multiplier */
    parryDamageMult: 2.5,

    /** Parry guard regen amount */
    parryGuardRegen: 40,

    /** Free chain beats after successful parry */
    parryFreeChain: 3,

    /** Auto-advance speed when not touching (px/s) */
    autoAdvanceSpeed: 45,

    /** Max move speed (px/s) */
    maxMoveSpeed: 160,
  },

  // ═══════════════════════════════════════════════════════════════
  // ENEMY RHYTHM — counter-clock tuning
  // ═══════════════════════════════════════════════════════════════

  ENEMY_RHYTHM: {
    /** Enemy block window multiplier vs player attack window
     *  Enemy window is wider — blocking is a different skill than attacking */
    blockWindowMultiplier: 1.3,

    /** Perfect block threshold (% of enemy beat window) */
    perfectBlockThreshold: 0.20,

    /** Off-beat block stamina cost multiplier */
    offBeatBlockPenalty: 1.6,

    /** Rhythm presets — tuned ratios */
    presets: {
      hiphop:    { ratio: 0.66, swing: 0.15, offset: 0.25 },
      rnb:       { ratio: 0.50, swing: 0.20, offset: 0.33 },
      trap:      { ratio: 1.33, swing: 0.00, offset: 0.50 },
      dnb:       { ratio: 1.50, swing: 0.00, offset: 0.10 },
      reggaeton: { ratio: 0.75, swing: 0.00, offset: 0.125 },
      jazz:      { ratio: 0.85, swing: 0.33, offset: 0.42 },
      dance:     { ratio: 1.00, swing: 0.00, offset: 0.50 },
      rock:      { ratio: 0.88, swing: 0.08, offset: 0.18 },
      reggae:    { ratio: 0.50, swing: 0.25, offset: 0.50 },
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BOSS PHASES — tuned for observed player skill level
  // ═══════════════════════════════════════════════════════════════

  BOSS: {
    /** Phase transition HP thresholds */
    phaseThresholds: [0.66, 0.33],

    /** Phase 1: learnable, forgiving */
    phase1: {
      speedMult: 1.0,
      attacksPerCycle: 3,
      restBeats: 4,
      telegraphTime: 1.2,
    },

    /** Phase 2: faster, adds unblockables
     *  Tighter than average player can handle — forces dodge/parry */
    phase2: {
      speedMult: 1.3,
      attacksPerCycle: 4,
      restBeats: 2,
      telegraphTime: 0.9,
      hasUnblockable: true,
      unblockableTelegraph: 1.1,
    },

    /** Phase 3: relentless
     *  Only players with >25% perfect rate can survive this
     *  (observed: 9.6% average, 18% best → this is hard) */
    phase3: {
      speedMult: 1.6,
      attacksPerCycle: 5,
      restBeats: 1,
      telegraphTime: 0.6,
      hasUnblockable: true,
      unblockableTelegraph: 0.8,
      requiresPerfectBlock: true,
      hasGrab: true,
      grabTelegraph: 1.0,
      grabDamage: 40,
    },
  },
};

// ═══════════════════════════════════════════════════════════════
// DATA SUMMARY — for reference
// ═══════════════════════════════════════════════════════════════
//
// Source: 4 testers, 38 calibration exports, 1900 taps
// All at 120 BPM, Spotify WiFi simulation (150ms API, 15ms audio, ±30ms drift)
//
// Tap offset distribution:
//   P10: 26ms   (top 10% of taps — the best they can do)
//   P25: 59ms   (hard mode threshold)
//   P50: 113ms  (median — where most taps land)
//   P75: 180ms  (easy mode threshold)
//   P90: 224ms  (worst 10% — accommodated by easy mode)
//
// Player tendency: tap 23.5ms EARLY on average
// Default latency offset: -8ms (partial compensation)
//
// At 200ms window: 44.2% hit rate → too punishing for default
// At 280ms window: 61.5% hit rate → good for normal
// At 360ms window: 73.4% hit rate → good for easy
// At 100ms window: 20.5% hit rate → expert only
//
// Average max streak: 5.7 (best: 12)
// This means chain milestones at 5, 10, 15 feel achievable
// Chains of 20+ are rare — should feel epic
//
// ═══════════════════════════════════════════════════════════════

export default TUNED_CONFIG;
