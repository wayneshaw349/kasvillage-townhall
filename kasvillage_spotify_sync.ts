// ============================================================================
// KasVillage Spotify Beat Sync
// Spotify audio_analysis → real beat timestamps → RhythmClock
// No audio content — only numerical beat/section/bar data (no copyright)
// ============================================================================

// ============================================================================
// SPOTIFY ANALYSIS TYPES (from /v1/audio-analysis/{id})
// ============================================================================

/** Single beat from audio_analysis.beats[] */
export interface SpotifyBeat {
  start: number;      // seconds from track start
  duration: number;   // beat duration in seconds
  confidence: number; // 0.0–1.0
}

/** Single bar (measure) from audio_analysis.bars[] */
export interface SpotifyBar {
  start: number;
  duration: number;
  confidence: number;
}

/** Section = song structure (verse, chorus, bridge, drop) */
export interface SpotifySection {
  start: number;
  duration: number;
  confidence: number;
  loudness: number;      // dB (typically -60 to 0)
  tempo: number;         // BPM for this section
  tempo_confidence: number;
  key: number;           // pitch class (0=C, 1=C#, ... 11=B)
  key_confidence: number;
  mode: number;          // 0=minor, 1=major
  mode_confidence: number;
  time_signature: number; // beats per bar (3, 4, 5, 6, 7)
  time_signature_confidence: number;
}

/** Simplified track-level features */
export interface SpotifyTrackMeta {
  tempo: number;       // overall BPM
  duration: number;    // track length in seconds
  time_signature: number;
  energy: number;      // 0.0–1.0 (from audio_features)
  valence: number;     // 0.0–1.0 musical positivity
  danceability: number;
}

/** Full analysis payload we consume */
export interface SpotifyAnalysis {
  beats: SpotifyBeat[];
  bars: SpotifyBar[];
  sections: SpotifySection[];
  track: SpotifyTrackMeta;
}

// ============================================================================
// FETCH ANALYSIS — Spotify Web API
// ============================================================================

/**
 * Fetch audio analysis for a track.
 * Requires a valid Spotify access token with `user-read-playback-state` scope.
 *
 * Returns numerical beat/section data only — no audio content.
 */
export async function fetchSpotifyAnalysis(
  trackId: string,
  accessToken: string,
): Promise<SpotifyAnalysis | null> {
  try {
    // audio_analysis — beat timestamps, sections, bars
    const analysisRes = await fetch(
      `https://api.spotify.com/v1/audio-analysis/${trackId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!analysisRes.ok) return null;
    const analysis = await analysisRes.json();

    // audio_features — energy, valence, danceability
    const featuresRes = await fetch(
      `https://api.spotify.com/v1/audio-features/${trackId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const features = featuresRes.ok ? await featuresRes.json() : null;

    return {
      beats: (analysis.beats || []).map((b: any) => ({
        start: b.start,
        duration: b.duration,
        confidence: b.confidence,
      })),
      bars: (analysis.bars || []).map((b: any) => ({
        start: b.start,
        duration: b.duration,
        confidence: b.confidence,
      })),
      sections: (analysis.sections || []).map((s: any) => ({
        start: s.start,
        duration: s.duration,
        confidence: s.confidence,
        loudness: s.loudness,
        tempo: s.tempo,
        tempo_confidence: s.tempo_confidence,
        key: s.key,
        key_confidence: s.key_confidence,
        mode: s.mode,
        mode_confidence: s.mode_confidence,
        time_signature: s.time_signature,
        time_signature_confidence: s.time_signature_confidence,
      })),
      track: {
        tempo: analysis.track?.tempo || features?.tempo || 120,
        duration: analysis.track?.duration || 0,
        time_signature: analysis.track?.time_signature || 4,
        energy: features?.energy || 0.5,
        valence: features?.valence || 0.5,
        danceability: features?.danceability || 0.5,
      },
    };
  } catch (e) {
    console.error('[SpotifySync] Failed to fetch analysis:', e);
    return null;
  }
}

// ============================================================================
// FETCH CURRENT PLAYBACK — what's playing right now
// ============================================================================

export interface SpotifyPlaybackState {
  trackId: string;
  trackName: string;
  artistName: string;
  progressMs: number;   // current position in track
  isPlaying: boolean;
  durationMs: number;
}

/**
 * Get current playback state from Spotify.
 * Used to sync game clock to actual song position.
 */
export async function fetchPlaybackState(
  accessToken: string,
): Promise<SpotifyPlaybackState | null> {
  try {
    const res = await fetch(
      'https://api.spotify.com/v1/me/player/currently-playing',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok || res.status === 204) return null;
    const data = await res.json();
    if (!data.item) return null;

    return {
      trackId: data.item.id,
      trackName: data.item.name,
      artistName: data.item.artists?.[0]?.name || 'Unknown',
      progressMs: data.progress_ms || 0,
      isPlaying: data.is_playing || false,
      durationMs: data.item.duration_ms || 0,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// BEAT SYNC STATE — replaces fixed-interval RhythmClock
// ============================================================================

export interface BeatSyncState {
  /** Spotify analysis data */
  analysis: SpotifyAnalysis;
  /** All beat timestamps in seconds */
  beatTimestamps: number[];
  /** Current beat index into beatTimestamps[] */
  beatIndex: number;
  /** Song position in seconds (synced to Spotify progress) */
  songPosition: number;
  /** True for one frame when a beat hits */
  onBeat: boolean;
  /** Total beats in the track */
  totalBeats: number;
  /** Current section index */
  sectionIndex: number;
  /** Current section data */
  currentSection: SpotifySection | null;
  /** Current section's BPM (changes per section) */
  currentBpm: number;
  /** Current beat interval (derived from actual beat gaps) */
  currentBeatInterval: number;
  /** Time of last beat hit (song time) */
  lastBeatTime: number;
  /** Beat window for input tolerance */
  beatWindow: number;
  /** Playback offset — compensates for API latency */
  latencyOffset: number;
  /** Whether sync is active */
  synced: boolean;
  /** Track metadata for display */
  trackName: string;
  artistName: string;
  /** Section energy 0–1 (for wave intensity scaling) */
  sectionEnergy: number;
  /** Whether we're in a "drop" (high-energy section after low-energy) */
  inDrop: boolean;
  /** Section loudness normalized 0–1 */
  sectionLoudness: number;
}

// ============================================================================
// CREATE
// ============================================================================

/**
 * Create beat sync from Spotify analysis.
 *
 * @param analysis     Spotify audio_analysis data
 * @param beatWindow   Input tolerance (0.15=tight, 0.25=forgiving)
 * @param latencyMs    Spotify API latency compensation in ms
 */
export function createBeatSync(
  analysis: SpotifyAnalysis,
  beatWindow: number = 0.2,
  latencyMs: number = 50,
): BeatSyncState {
  // Filter low-confidence beats (< 0.3) — they're likely misdetections
  const beats = analysis.beats.filter(b => b.confidence >= 0.3);
  const timestamps = beats.map(b => b.start);

  // Initial BPM from first section or track
  const initialBpm = analysis.sections[0]?.tempo || analysis.track.tempo;
  const initialInterval = timestamps.length >= 2
    ? timestamps[1] - timestamps[0]
    : 60 / initialBpm;

  return {
    analysis,
    beatTimestamps: timestamps,
    beatIndex: 0,
    songPosition: 0,
    onBeat: false,
    totalBeats: timestamps.length,
    sectionIndex: 0,
    currentSection: analysis.sections[0] || null,
    currentBpm: initialBpm,
    currentBeatInterval: initialInterval,
    lastBeatTime: 0,
    beatWindow,
    latencyOffset: latencyMs / 1000,
    synced: true,
    trackName: '',
    artistName: '',
    sectionEnergy: 0.5,
    inDrop: false,
    sectionLoudness: 0.5,
  };
}

/**
 * Fallback: create beat sync from just BPM (no Spotify analysis).
 * Generates synthetic beat timestamps at fixed intervals.
 * Used when Spotify API is unavailable.
 */
export function createBeatSyncFromBpm(
  bpm: number,
  durationSeconds: number = 240,
  beatWindow: number = 0.2,
): BeatSyncState {
  const interval = 60 / bpm;
  const timestamps: number[] = [];
  for (let t = 0; t < durationSeconds; t += interval) {
    timestamps.push(t);
  }

  const syntheticAnalysis: SpotifyAnalysis = {
    beats: timestamps.map(t => ({ start: t, duration: interval, confidence: 1 })),
    bars: [],
    sections: [{ start: 0, duration: durationSeconds, confidence: 1, loudness: -8, tempo: bpm, tempo_confidence: 1, key: 0, key_confidence: 0, mode: 1, mode_confidence: 0, time_signature: 4, time_signature_confidence: 1 }],
    track: { tempo: bpm, duration: durationSeconds, time_signature: 4, energy: 0.5, valence: 0.5, danceability: 0.5 },
  };

  return createBeatSync(syntheticAnalysis, beatWindow, 0);
}

// ============================================================================
// SYNC TO SPOTIFY PLAYBACK — call periodically (every 1–2 seconds)
// ============================================================================

/**
 * Sync song position to Spotify's reported progress.
 * Corrects drift between game clock and actual playback.
 * Call every 1–2 seconds (not every frame — API rate limits).
 */
export function syncToPlayback(sync: BeatSyncState, progressSeconds: number): void {
  const corrected = progressSeconds + sync.latencyOffset;
  const drift = Math.abs(sync.songPosition - corrected);

  if (drift > 0.1) {
    // Large drift — hard snap
    sync.songPosition = corrected;
    // Find nearest beat index
    sync.beatIndex = findNearestBeatIndex(sync.beatTimestamps, corrected);
  } else if (drift > 0.02) {
    // Small drift — soft correct (lerp toward correct position)
    sync.songPosition += (corrected - sync.songPosition) * 0.3;
  }
  // < 20ms drift — ignore, game clock is close enough
}

function findNearestBeatIndex(timestamps: number[], time: number): number {
  // Binary search for closest beat
  let lo = 0;
  let hi = timestamps.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (timestamps[mid] < time) lo = mid + 1;
    else hi = mid;
  }
  // Check if previous beat is closer
  if (lo > 0 && time - timestamps[lo - 1] < timestamps[lo] - time) {
    return lo - 1;
  }
  return lo;
}

// ============================================================================
// TICK — call every frame, replaces tickClock()
// ============================================================================

/**
 * Update beat sync every frame.
 * Advances song position, fires beats from real timestamps.
 * Drop-in replacement for tickClock().
 */
export function tickBeatSync(sync: BeatSyncState, dt: number): boolean {
  sync.songPosition += dt;
  sync.onBeat = false;

  // Check if we've crossed the next beat timestamp
  if (sync.beatIndex < sync.beatTimestamps.length) {
    const nextBeatTime = sync.beatTimestamps[sync.beatIndex];
    if (sync.songPosition >= nextBeatTime) {
      sync.onBeat = true;
      sync.lastBeatTime = nextBeatTime;

      // Calculate actual interval from real beats
      if (sync.beatIndex > 0) {
        sync.currentBeatInterval = nextBeatTime - sync.beatTimestamps[sync.beatIndex - 1];
        sync.currentBpm = 60 / sync.currentBeatInterval;
      }

      sync.beatIndex++;
    }
  }

  // Update current section
  updateSection(sync);

  return sync.onBeat;
}

/** Update section tracking (verse/chorus/drop detection) */
function updateSection(sync: BeatSyncState): void {
  const sections = sync.analysis.sections;
  if (sections.length === 0) return;

  // Find current section
  let newIdx = sync.sectionIndex;
  for (let i = sync.sectionIndex; i < sections.length; i++) {
    if (sync.songPosition >= sections[i].start) {
      newIdx = i;
    } else break;
  }

  if (newIdx !== sync.sectionIndex) {
    const prevSection = sections[sync.sectionIndex];
    sync.sectionIndex = newIdx;
    sync.currentSection = sections[newIdx];

    // Update section BPM
    if (sync.currentSection.tempo_confidence > 0.5) {
      sync.currentBpm = sync.currentSection.tempo;
    }

    // Detect drop: current section significantly louder than previous
    if (prevSection) {
      const loudnessJump = sync.currentSection.loudness - prevSection.loudness;
      sync.inDrop = loudnessJump > 4; // >4dB jump = likely a drop
    }

    // Normalize loudness (typical range: -60 to 0 dB)
    sync.sectionLoudness = Math.max(0, Math.min(1, (sync.currentSection.loudness + 30) / 30));

    // Section energy = combination of loudness + tempo
    const tempoFactor = Math.min(1, sync.currentSection.tempo / 180); // normalize to 180 BPM
    sync.sectionEnergy = sync.sectionLoudness * 0.6 + tempoFactor * 0.4;
  }
}

// ============================================================================
// isOnBeat — uses real beat timestamps instead of fixed intervals
// ============================================================================

/**
 * Check if player input is on beat using real timestamps.
 * Replaces the fixed-interval isOnBeat() from RhythmClock.
 */
export function isOnBeatSync(
  sync: BeatSyncState,
): { onBeat: boolean; accuracy: number } {
  const pos = sync.songPosition;

  // Find closest beat (previous or next)
  const prevIdx = Math.max(0, sync.beatIndex - 1);
  const nextIdx = Math.min(sync.beatTimestamps.length - 1, sync.beatIndex);

  const timeSincePrev = pos - sync.beatTimestamps[prevIdx];
  const timeToNext = sync.beatTimestamps[nextIdx] - pos;
  const closest = Math.min(Math.abs(timeSincePrev), Math.abs(timeToNext));

  if (closest <= sync.beatWindow) {
    const accuracy = 1.0 - (closest / sync.beatWindow);
    return { onBeat: true, accuracy };
  }
  return { onBeat: false, accuracy: 0 };
}

// ============================================================================
// BRIDGE — adapt BeatSyncState to RhythmClock interface
// ============================================================================

import type { RhythmClock } from './kasvillage_game_v1';

/**
 * Convert BeatSyncState to RhythmClock-compatible object.
 * Allows all existing game code (combo system, enemy AI, wave spawner)
 * to work without changes.
 */
export function beatSyncAsRhythmClock(sync: BeatSyncState): RhythmClock {
  return {
    bpm: sync.currentBpm,
    beatInterval: sync.currentBeatInterval,
    halfBeat: sync.currentBeatInterval / 2,
    timer: 0, // not used in sync mode
    beatCount: sync.beatIndex,
    onBeat: sync.onBeat,
    beatWindow: sync.beatWindow,
    lastBeatTime: sync.lastBeatTime,
  };
}

/**
 * Patch GameState.clock with live beat sync data.
 * Call every frame before tickGame().
 *
 * Usage:
 *   tickBeatSync(sync, dt);
 *   patchGameClock(state, sync);
 *   tickGame(state, dt);
 */
export function patchGameClock(state: { clock: RhythmClock }, sync: BeatSyncState): void {
  state.clock.bpm = sync.currentBpm;
  state.clock.beatInterval = sync.currentBeatInterval;
  state.clock.halfBeat = sync.currentBeatInterval / 2;
  state.clock.beatCount = sync.beatIndex;
  state.clock.onBeat = sync.onBeat;
  state.clock.lastBeatTime = sync.lastBeatTime;
}

// ============================================================================
// WAVE INTENSITY — section energy drives spawn aggression
// ============================================================================

export interface SectionGameEffect {
  /** Enemy aggression multiplier (quiet section = 0.5, drop = 1.5) */
  aggressionMod: number;
  /** Enemy speed multiplier */
  speedMod: number;
  /** Whether to trigger a wave spawn acceleration */
  triggerRush: boolean;
  /** Beat window adjustment (louder = tighter timing) */
  windowMod: number;
  /** Camera shake on drop */
  dropShake: boolean;
  /** Section mood for board renderer shading */
  mood: 'calm' | 'building' | 'intense' | 'drop' | 'outro';
}

/**
 * Get game effects from current section analysis.
 * Use to dynamically adjust difficulty based on song energy.
 */
export function getSectionGameEffect(sync: BeatSyncState): SectionGameEffect {
  const e = sync.sectionEnergy;
  const loud = sync.sectionLoudness;

  // Mood classification
  let mood: SectionGameEffect['mood'] = 'calm';
  if (sync.inDrop) mood = 'drop';
  else if (e > 0.75) mood = 'intense';
  else if (e > 0.5) mood = 'building';
  else if (sync.songPosition > sync.analysis.track.duration * 0.85) mood = 'outro';

  return {
    aggressionMod: 0.5 + e,                    // 0.5 (quiet) → 1.5 (loud)
    speedMod: 0.8 + e * 0.4,                   // 0.8 → 1.2
    triggerRush: sync.inDrop,                   // rush enemies on drops
    windowMod: 1.0 - loud * 0.3,               // tighter window when loud
    dropShake: sync.inDrop,
    mood,
  };
}

// ============================================================================
// GAME LOOP INTEGRATION EXAMPLE
// ============================================================================
//
//   // Init
//   const playback = await fetchPlaybackState(token);
//   const analysis = await fetchSpotifyAnalysis(playback.trackId, token);
//   const sync = createBeatSync(analysis);
//   sync.trackName = playback.trackName;
//   sync.artistName = playback.artistName;
//   syncToPlayback(sync, playback.progressMs / 1000);
//
//   // Every frame
//   tickBeatSync(sync, dt);
//   patchGameClock(gameState, sync);
//   tickGame(gameState, dt);
//
//   // Every 2 seconds
//   const pb = await fetchPlaybackState(token);
//   if (pb) syncToPlayback(sync, pb.progressMs / 1000);
//
//   // Section effects
//   const fx = getSectionGameEffect(sync);
//   if (fx.dropShake) triggerCamera(camera, 'combo_break', gameTime);
//   if (fx.triggerRush) accelerateWaves(spawner);
//
// ============================================================================

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================
// fetchSpotifyAnalysis(trackId, token)  — get beat/section data
// fetchPlaybackState(token)             — get current song position
// createBeatSync(analysis, window, lat) — init from analysis
// createBeatSyncFromBpm(bpm, dur, win)  — fallback (no Spotify)
// syncToPlayback(sync, progressSec)     — correct drift (call every 1-2s)
// tickBeatSync(sync, dt)                — tick every frame (replaces tickClock)
// isOnBeatSync(sync)                    — check input timing (replaces isOnBeat)
// beatSyncAsRhythmClock(sync)           — convert to RhythmClock interface
// patchGameClock(state, sync)           — patch GameState.clock in-place
// getSectionGameEffect(sync)            — section energy → game difficulty
// ============================================================================
