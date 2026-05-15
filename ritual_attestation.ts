// ============================================================================
// RITUAL ATTESTATION - Local verification before TownHall
// ============================================================================
// Step 1: Jitter entropy (human typing patterns)
// Step 2: Device attestation (not emulator/rooted)
// Step 3: Timing checks (can't speedrun)
// Step 4: Quiz integrity (future: Halo2 proof)
// ============================================================================

import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';

// ============================================================================
// TYPES
// ============================================================================

export interface JitterSample {
  timestamp: number;
  delta: number;
  key?: string;
  pressure?: number;
  hesitation?: number;
  eventType?: 'keystroke' | 'tap' | 'swipe' | 'color' | 'select';
}

export interface JitterAnalysis {
  passed: boolean;
  humanScore: number;        // 0-100
  flags: string[];           // Failure reasons
  metrics: JitterMetrics;    // Raw metrics for TownHall
}

export interface JitterMetrics {
  sampleCount: number;
  meanDelta: number;
  stdDev: number;
  coefficientOfVariation: number;
  burstRatio: number;
  rhythmScore: number;
  maxRepeatRatio: number;
  hesitationMean: number;
  hesitationStdDev: number;
}

export interface TimingAnalysis {
  passed: boolean;
  flags: string[];
  metrics: TimingMetrics;
}

export interface TimingMetrics {
  totalDurationMs: number;
  phase1DurationMs: number;
  phase2DurationMs: number;
  phase3DurationMs: number;
  phase4DurationMs: number;
  phase5DurationMs: number;
  phase6DurationMs: number;
  phase7DurationMs: number;
  keystrokeCount: number;
  tapCount: number;
  colorChangeCount: number;
}

export interface DeviceAttestation {
  passed: boolean;
  flags: string[];
  deviceId: string;
  platform: string;
  isEmulator: boolean;
  isRooted: boolean;
  appIntegrity: boolean;
}

export interface RitualAttestation {
  // Overall pass/fail
  passed: boolean;
  overallScore: number;      // 0-100
  
  // Component results
  jitter: JitterAnalysis;
  timing: TimingAnalysis;
  device: DeviceAttestation;
  quiz: QuizAttestation;
  
  // Commitment for TownHall
  attestationHash: string;   // SHA256 of all metrics
  timestamp: number;
  signature?: string;        // Future: device-signed
}

export interface QuizAttestation {
  passed: boolean;
  score: number;             // e.g. 4/5
  total: number;
  questionHashes: string[];  // SHA256 of each question asked
}

// ============================================================================
// CONSTANTS - Thresholds for human detection
// ============================================================================

const THRESHOLDS = {
  // Jitter
  MIN_SAMPLES: 20,
  MIN_MEAN_DELTA_MS: 50,      // Faster = bot
  MAX_MEAN_DELTA_MS: 800,     // Slower = copy-paste
  MIN_CV: 0.12,               // Too consistent = bot
  MAX_CV: 1.5,                // Too erratic = noise injection
  MAX_REPEAT_RATIO: 0.35,     // Same interval too often = bot
  
  // Timing
  MIN_TOTAL_DURATION_MS: 60_000,      // 1 minute minimum
  MIN_PHASE_DURATION_MS: 5_000,       // 5 seconds per phase
  MIN_KEYSTROKES: 30,                  // Must type something
  MIN_TAPS: 10,                        // Must interact
  
  // Quiz
  MIN_QUIZ_SCORE_RATIO: 0.8,          // 80% to pass
  
  // Overall
  MIN_HUMAN_SCORE: 50,
};

// ============================================================================
// STEP 1: JITTER ANALYSIS
// ============================================================================

export function analyzeJitterEntropy(samples: JitterSample[]): JitterAnalysis {
  const flags: string[] = [];
  let score = 50; // Start neutral
  
  // Minimum sample check
  if (samples.length < THRESHOLDS.MIN_SAMPLES) {
    return {
      passed: false,
      humanScore: 0,
      flags: ['insufficient_samples'],
      metrics: emptyJitterMetrics(),
    };
  }
  
  // Filter valid deltas
  const deltas = samples
    .map(s => s.delta)
    .filter(d => d > 0 && d < 5000);
  
  if (deltas.length < 10) {
    return {
      passed: false,
      humanScore: 0,
      flags: ['filtered_too_many'],
      metrics: emptyJitterMetrics(),
    };
  }
  
  // Calculate core statistics
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const variance = deltas.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / deltas.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0;
  
  // ── Check 1: Mean typing speed ──
  if (mean < THRESHOLDS.MIN_MEAN_DELTA_MS) {
    flags.push('superhuman_speed');
    score -= 40;
  } else if (mean > THRESHOLDS.MAX_MEAN_DELTA_MS) {
    flags.push('very_slow');
    score -= 15;
  } else if (mean > 80 && mean < 400) {
    score += 15; // Natural range
  }
  
  // ── Check 2: Coefficient of variation (consistency) ──
  if (cv < THRESHOLDS.MIN_CV) {
    flags.push('too_consistent');
    score -= 35;
  } else if (cv > THRESHOLDS.MAX_CV) {
    flags.push('too_erratic');
    score -= 20;
  } else if (cv > 0.2 && cv < 0.9) {
    score += 20; // Natural variance
  }
  
  // ── Check 3: Repeated intervals (bot signature) ──
  const deltaCounts: Record<number, number> = {};
  for (const d of deltas) {
    const rounded = Math.round(d / 10) * 10;
    deltaCounts[rounded] = (deltaCounts[rounded] || 0) + 1;
  }
  const maxRepeat = Math.max(...Object.values(deltaCounts));
  const repeatRatio = maxRepeat / deltas.length;
  
  if (repeatRatio > THRESHOLDS.MAX_REPEAT_RATIO) {
    flags.push('repeated_intervals');
    score -= 25;
  }
  
  // ── Check 4: Burst pattern (natural pauses between words) ──
  const longPauses = deltas.filter(d => d > 500).length;
  const burstRatio = longPauses / deltas.length;
  
  if (burstRatio > 0.05 && burstRatio < 0.3) {
    score += 15; // Natural word boundaries
  } else if (burstRatio < 0.02) {
    flags.push('no_pauses');
    score -= 10;
  }
  
  // ── Check 5: Typing rhythm (not perfectly metronomic) ──
  const rhythmScore = calculateRhythmScore(deltas);
  if (rhythmScore > 20 && rhythmScore < 200) {
    score += 10;
  }
  
  // ── Check 6: Hesitation analysis (tap response times) ──
  const hesitations = samples
    .filter(s => s.hesitation && s.hesitation > 0)
    .map(s => s.hesitation!);
  
  let hesitationMean = 0;
  let hesitationStdDev = 0;
  
  if (hesitations.length >= 3) {
    hesitationMean = hesitations.reduce((a, b) => a + b, 0) / hesitations.length;
    const hVar = hesitations.reduce((a, b) => a + Math.pow(b - hesitationMean, 2), 0) / hesitations.length;
    hesitationStdDev = Math.sqrt(hVar);
    
    // Bots tap instantly or at exact intervals
    if (hesitationMean > 400 && hesitationMean < 4000) {
      score += 10;
    } else if (hesitationMean < 150) {
      flags.push('instant_taps');
      score -= 20;
    }
    
    // Check hesitation variance
    const hCv = hesitationMean > 0 ? hesitationStdDev / hesitationMean : 0;
    if (hCv < 0.1) {
      flags.push('consistent_hesitation');
      score -= 15;
    } else if (hCv > 0.2 && hCv < 1.0) {
      score += 5;
    }
  }
  
  // ── Check 7: Event type diversity ──
  const eventTypes = new Set(samples.map(s => s.eventType).filter(Boolean));
  if (eventTypes.size >= 3) {
    score += 10; // Used multiple interaction types
  } else if (eventTypes.size < 2) {
    flags.push('low_interaction_diversity');
    score -= 5;
  }
  
  // Clamp score
  const humanScore = Math.max(0, Math.min(100, score));
  const passed = humanScore >= THRESHOLDS.MIN_HUMAN_SCORE && flags.length < 3;
  
  return {
    passed,
    humanScore,
    flags,
    metrics: {
      sampleCount: samples.length,
      meanDelta: Math.round(mean * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      coefficientOfVariation: Math.round(cv * 1000) / 1000,
      burstRatio: Math.round(burstRatio * 1000) / 1000,
      rhythmScore: Math.round(rhythmScore * 100) / 100,
      maxRepeatRatio: Math.round(repeatRatio * 1000) / 1000,
      hesitationMean: Math.round(hesitationMean),
      hesitationStdDev: Math.round(hesitationStdDev),
    },
  };
}

function calculateRhythmScore(deltas: number[]): number {
  if (deltas.length < 2) return 0;
  const diffs = deltas.slice(1).map((d, i) => Math.abs(d - deltas[i]));
  return diffs.reduce((a, b) => a + b, 0) / diffs.length;
}

function emptyJitterMetrics(): JitterMetrics {
  return {
    sampleCount: 0,
    meanDelta: 0,
    stdDev: 0,
    coefficientOfVariation: 0,
    burstRatio: 0,
    rhythmScore: 0,
    maxRepeatRatio: 0,
    hesitationMean: 0,
    hesitationStdDev: 0,
  };
}

// ============================================================================
// STEP 2: TIMING ANALYSIS
// ============================================================================

export interface PhaseTimestamps {
  ritualStart: number;
  phase1Complete?: number;
  phase2Complete?: number;
  phase3Complete?: number;
  phase4Complete?: number;
  phase5Complete?: number;
  phase6Complete?: number;
  phase7Complete?: number;
}

export function analyzeRitualTiming(
  timestamps: PhaseTimestamps,
  keystrokeCount: number,
  tapCount: number,
  colorChangeCount: number
): TimingAnalysis {
  const flags: string[] = [];
  const now = Date.now();
  
  const totalDuration = (timestamps.phase7Complete || now) - timestamps.ritualStart;
  
  // Calculate phase durations
  const phaseDurations = [
    (timestamps.phase1Complete || now) - timestamps.ritualStart,
    (timestamps.phase2Complete || timestamps.phase1Complete || now) - (timestamps.phase1Complete || timestamps.ritualStart),
    (timestamps.phase3Complete || timestamps.phase2Complete || now) - (timestamps.phase2Complete || timestamps.ritualStart),
    (timestamps.phase4Complete || timestamps.phase3Complete || now) - (timestamps.phase3Complete || timestamps.ritualStart),
    (timestamps.phase5Complete || timestamps.phase4Complete || now) - (timestamps.phase4Complete || timestamps.ritualStart),
    (timestamps.phase6Complete || timestamps.phase5Complete || now) - (timestamps.phase5Complete || timestamps.ritualStart),
    (timestamps.phase7Complete || timestamps.phase6Complete || now) - (timestamps.phase6Complete || timestamps.ritualStart),
  ];
  
  // ── Check 1: Total duration ──
  if (totalDuration < THRESHOLDS.MIN_TOTAL_DURATION_MS) {
    flags.push('speedrun_detected');
  }
  
  // ── Check 2: Per-phase duration ──
  phaseDurations.forEach((dur, i) => {
    if (dur > 0 && dur < THRESHOLDS.MIN_PHASE_DURATION_MS) {
      flags.push(`phase${i + 1}_too_fast`);
    }
  });
  
  // ── Check 3: Interaction counts ──
  if (keystrokeCount < THRESHOLDS.MIN_KEYSTROKES) {
    flags.push('insufficient_typing');
  }
  
  if (tapCount < THRESHOLDS.MIN_TAPS) {
    flags.push('insufficient_taps');
  }
  
  const passed = flags.length === 0;
  
  return {
    passed,
    flags,
    metrics: {
      totalDurationMs: totalDuration,
      phase1DurationMs: phaseDurations[0],
      phase2DurationMs: phaseDurations[1],
      phase3DurationMs: phaseDurations[2],
      phase4DurationMs: phaseDurations[3],
      phase5DurationMs: phaseDurations[4],
      phase6DurationMs: phaseDurations[5],
      phase7DurationMs: phaseDurations[6],
      keystrokeCount,
      tapCount,
      colorChangeCount,
    },
  };
}

// ============================================================================
// STEP 3: DEVICE ATTESTATION
// ============================================================================

export async function generateDeviceAttestation(): Promise<DeviceAttestation> {
  const flags: string[] = [];
  
  // Get device info
  const isDevice = Device.isDevice;
  const deviceType = Device.deviceType;
  const brand = Device.brand || 'unknown';
  const modelName = Device.modelName || 'unknown';
  const osName = Device.osName || 'unknown';
  const osVersion = Device.osVersion || 'unknown';
  
  // Check for emulator
  const isEmulator = !isDevice || deviceType === Device.DeviceType.UNKNOWN;
  if (isEmulator) {
    flags.push('emulator_detected');
  }
  
  // Check for rooted/jailbroken (basic heuristics)
  // Note: This is not foolproof, advanced users can bypass
  const isRooted = await checkRootStatus();
  if (isRooted) {
    flags.push('root_detected');
  }
  
  // App integrity check
  const appIntegrity = await checkAppIntegrity();
  if (!appIntegrity) {
    flags.push('app_tampered');
  }
  
  // Generate device ID hash (privacy-preserving)
  const deviceIdRaw = `${brand}:${modelName}:${osName}:${osVersion}:${Application.applicationId}`;
  const deviceId = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    deviceIdRaw
  );
  
  const passed = flags.length === 0;
  
  return {
    passed,
    flags,
    deviceId: deviceId.slice(0, 16), // Truncate for privacy
    platform: `${osName} ${osVersion}`,
    isEmulator,
    isRooted,
    appIntegrity,
  };
}

async function checkRootStatus(): Promise<boolean> {
  // Basic checks - not comprehensive
  try {
    // On iOS: check for Cydia
    // On Android: check for su binary, Magisk, etc.
    // This is a simplified version - real implementation would be more thorough
    
    // Check for suspicious environment variables
    if (typeof process !== 'undefined' && process.env) {
      const suspiciousVars = ['ANDROID_ROOT', 'MAGISK'];
      for (const v of suspiciousVars) {
        if (process.env[v]) return true;
      }
    }
    
    return false;
  } catch {
    return false; // Assume not rooted if check fails
  }
}

async function checkAppIntegrity(): Promise<boolean> {
  try {
    // Check if app signature matches expected (placeholder)
    // In production, compare against known good hash
    const appId = Application.applicationId;
    const expectedIds = [
      'com.kasvillage.app',
      'host.exp.exponent', // Expo Go for development
    ];
    
    return expectedIds.includes(appId || '');
  } catch {
    return true; // Assume good if check fails
  }
}

// ============================================================================
// STEP 4: QUIZ ATTESTATION
// ============================================================================

export async function generateQuizAttestation(
  questionsAsked: { question: string; correctAnswer: string }[],
  userScore: number
): Promise<QuizAttestation> {
  // Hash each question for commitment (proves which questions were asked)
  const questionHashes = await Promise.all(
    questionsAsked.map(async q => {
      const data = `${q.question}:${q.correctAnswer}`;
      return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
    })
  );
  
  const total = questionsAsked.length;
  const passed = total > 0 && (userScore / total) >= THRESHOLDS.MIN_QUIZ_SCORE_RATIO;
  
  return {
    passed,
    score: userScore,
    total,
    questionHashes,
  };
}

// ============================================================================
// FULL ATTESTATION GENERATION
// ============================================================================

export async function generateRitualAttestation(
  jitterSamples: JitterSample[],
  timestamps: PhaseTimestamps,
  keystrokeCount: number,
  tapCount: number,
  colorChangeCount: number,
  questionsAsked: { question: string; correctAnswer: string }[],
  quizScore: number
): Promise<RitualAttestation> {
  // Run all checks
  const jitter = analyzeJitterEntropy(jitterSamples);
  const timing = analyzeRitualTiming(timestamps, keystrokeCount, tapCount, colorChangeCount);
  const device = await generateDeviceAttestation();
  const quiz = await generateQuizAttestation(questionsAsked, quizScore);
  
  // Calculate overall score
  let overallScore = 0;
  if (jitter.passed) overallScore += 30;
  else overallScore += Math.floor(jitter.humanScore * 0.3);
  
  if (timing.passed) overallScore += 25;
  else overallScore += Math.max(0, 25 - timing.flags.length * 5);
  
  if (device.passed) overallScore += 20;
  else overallScore += Math.max(0, 20 - device.flags.length * 10);
  
  if (quiz.passed) overallScore += 25;
  else overallScore += Math.floor((quiz.score / Math.max(1, quiz.total)) * 25);
  
  const passed = jitter.passed && timing.passed && device.passed && quiz.passed;
  
  // Generate attestation hash
  const attestationData = JSON.stringify({
    jitterMetrics: jitter.metrics,
    timingMetrics: timing.metrics,
    deviceId: device.deviceId,
    quizHashes: quiz.questionHashes,
    timestamp: Date.now(),
  });
  
  const attestationHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    attestationData
  );
  
  return {
    passed,
    overallScore,
    jitter,
    timing,
    device,
    quiz,
    attestationHash,
    timestamp: Date.now(),
  };
}

// ============================================================================
// STORAGE HELPERS
// ============================================================================

const STORE_KEYS = {
  ATTESTATION: 'kv_ritual_attestation',
  QUESTION_BANK: 'kv_question_bank',
  PHASE_TIMESTAMPS: 'kv_phase_timestamps',
};

export async function saveAttestation(attestation: RitualAttestation): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEYS.ATTESTATION, JSON.stringify(attestation));
}

export async function loadAttestation(): Promise<RitualAttestation | null> {
  try {
    const data = await SecureStore.getItemAsync(STORE_KEYS.ATTESTATION);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function saveQuestionBank(questions: { question: string; correctAnswer: string; trait: string }[]): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEYS.QUESTION_BANK, JSON.stringify(questions));
}

export async function loadQuestionBank(): Promise<{ question: string; correctAnswer: string; trait: string }[] | null> {
  try {
    const data = await SecureStore.getItemAsync(STORE_KEYS.QUESTION_BANK);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function savePhaseTimestamps(timestamps: PhaseTimestamps): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEYS.PHASE_TIMESTAMPS, JSON.stringify(timestamps));
}

export async function loadPhaseTimestamps(): Promise<PhaseTimestamps | null> {
  try {
    const data = await SecureStore.getItemAsync(STORE_KEYS.PHASE_TIMESTAMPS);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

// ============================================================================
// TOWNHALL PAYLOAD (for future integration)
// ============================================================================

export interface TownHallAttestationPayload {
  attestationHash: string;
  jitterMetrics: JitterMetrics;
  timingMetrics: TimingMetrics;
  deviceId: string;
  platform: string;
  quizScore: number;
  quizTotal: number;
  questionHashes: string[];
  timestamp: number;
  // Future: signature from device keychain
}

export function buildTownHallPayload(attestation: RitualAttestation): TownHallAttestationPayload {
  return {
    attestationHash: attestation.attestationHash,
    jitterMetrics: attestation.jitter.metrics,
    timingMetrics: attestation.timing.metrics,
    deviceId: attestation.device.deviceId,
    platform: attestation.device.platform,
    quizScore: attestation.quiz.score,
    quizTotal: attestation.quiz.total,
    questionHashes: attestation.quiz.questionHashes,
    timestamp: attestation.timestamp,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  THRESHOLDS,
  STORE_KEYS,
};
