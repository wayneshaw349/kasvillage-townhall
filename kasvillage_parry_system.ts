// ============================================================================
// KasVillage Parry System — Vibrant Paint Explosion + Enemy Song Selection
//
// PARRY PAINT: Most vivid, largest, brightest paint in the game.
// Regular combo = good paint. Perfect hit = great paint. PARRY = masterpiece.
// Full spectrum, high opacity, maximum radius, rainbow streaks.
//
// ENEMY SONG: Random Spotify track for enemy rhythm.
// Player fights to their song. Enemies fight to a randomly selected song
// the player never picked. True clash of rhythms.
// ============================================================================

import type {
  PaintCanvas,
  PaintStroke,
} from './kasvillage_game_input_paint';

import type { EnemyAI } from './kasvillage_game_v1';

// ============================================================================
// PARRY PAINT — the most vibrant paint in the game
// ============================================================================

// Seeded random
let _pSeed = 42;
function pR() { _pSeed = (_pSeed * 1103515245 + 12345) & 0x7fffffff; return (_pSeed % 10000) / 10000; }

/** Full vibrant spectrum — not avatar colors, ALL colors */
const PARRY_SPECTRUM = [
  '#FF0044', '#FF2200', '#FF6600', '#FFAA00', '#FFD700', '#FFFF00',
  '#88FF00', '#00FF44', '#00FF88', '#00FFCC', '#00FFFF', '#00CCFF',
  '#0088FF', '#0044FF', '#2200FF', '#6600FF', '#AA00FF', '#FF00FF',
  '#FF0088', '#FF00CC', '#FFFFFF',
];

function parryColor(): string {
  return PARRY_SPECTRUM[Math.floor(pR() * PARRY_SPECTRUM.length)];
}

/**
 * PARRY PAINT EXPLOSION.
 * Biggest, brightest, most vibrant paint in the game.
 * Called when player successfully parries an enemy combo.
 *
 * This is the reward. This is why you risk the parry.
 */
export function paintParryExplosion(
  canvas: PaintCanvas,
  playerX: number,
  playerY: number,
  enemyX: number,
  enemyY: number,
  parryChainLength: number, // how many hits were cancelled by the parry
): void {
  const hitX = (playerX + enemyX) / 2; // explosion between player and enemy
  const hitY = (playerY + enemyY) / 2;
  const intensity = Math.min(3, 1 + parryChainLength * 0.3); // scales with cancelled hits

  // ── 1. CENTRAL BURST — massive vibrant splat ──
  const burstCount = 12 + Math.floor(intensity * 8);
  for (let i = 0; i < burstCount; i++) {
    const angle = (i / burstCount) * Math.PI * 2 + pR() * 0.5;
    const dist = 10 + intensity * 30 + pR() * 40;
    const size = 8 + intensity * 12 + pR() * 10;

    addStroke(canvas, {
      x: hitX + Math.cos(angle) * dist,
      y: hitY + Math.sin(angle) * dist * 0.5,
      radius: size,
      color: parryColor(),
      opacity: 0.5 + pR() * 0.4, // HIGH opacity — this paint POPS
      rotation: angle,
      shape: pR() > 0.4 ? 'splat' : 'spray',
      permanent: true,
      fadeRate: 0,
      age: 0,
    });
  }

  // ── 2. RAINBOW STREAKS — radiate outward from impact ──
  const streakCount = 8 + Math.floor(intensity * 6);
  for (let i = 0; i < streakCount; i++) {
    const angle = (i / streakCount) * Math.PI * 2;
    const len = 40 + intensity * 60 + pR() * 30;

    addStroke(canvas, {
      x: hitX + Math.cos(angle) * len,
      y: hitY + Math.sin(angle) * len * 0.4,
      radius: 12 + intensity * 15,
      color: parryColor(),
      opacity: 0.4 + intensity * 0.2,
      rotation: angle,
      shape: 'streak',
      permanent: true,
      fadeRate: 0,
      age: 0,
    });
  }

  // ── 3. SPRAY CLOUD — mist of fine dots around impact ──
  const sprayCount = 20 + Math.floor(intensity * 15);
  for (let i = 0; i < sprayCount; i++) {
    const angle = pR() * Math.PI * 2;
    const dist = pR() * (60 + intensity * 50);

    addStroke(canvas, {
      x: hitX + Math.cos(angle) * dist,
      y: hitY + Math.sin(angle) * dist * 0.6,
      radius: 2 + pR() * 5,
      color: parryColor(),
      opacity: 0.3 + pR() * 0.4,
      rotation: pR() * Math.PI * 2,
      shape: 'spray',
      permanent: true,
      fadeRate: 0,
      age: 0,
    });
  }

  // ── 4. DRIP CASCADE — paint dripping from the explosion ──
  const dripCount = 6 + Math.floor(intensity * 4);
  for (let i = 0; i < dripCount; i++) {
    const dripX = hitX + (pR() - 0.5) * 80;
    const dripLen = 30 + pR() * 60;

    addStroke(canvas, {
      x: dripX,
      y: hitY + 15 + pR() * dripLen,
      radius: 3 + pR() * 4,
      color: parryColor(),
      opacity: 0.35 + pR() * 0.25,
      rotation: Math.PI / 2,
      shape: 'drip',
      permanent: true,
      fadeRate: 0,
      age: 0,
    });
  }

  // ── 5. GLOW RINGS — expanding circles of color ──
  const ringCount = 2 + Math.floor(intensity);
  for (let i = 0; i < ringCount; i++) {
    addStroke(canvas, {
      x: hitX,
      y: hitY,
      radius: 25 + i * 20 + intensity * 15,
      color: parryColor(),
      opacity: 0.15 - i * 0.03,
      rotation: 0,
      shape: 'burst',
      permanent: true,
      fadeRate: 0,
      age: 0,
    });
  }

  // ── 6. SATELLITE SPLATS — distant splatters from the force ──
  const satCount = 4 + Math.floor(intensity * 3);
  for (let i = 0; i < satCount; i++) {
    const angle = pR() * Math.PI * 2;
    const dist = 80 + pR() * 120;

    addStroke(canvas, {
      x: hitX + Math.cos(angle) * dist,
      y: hitY + Math.sin(angle) * dist * 0.5,
      radius: 5 + pR() * 8,
      color: parryColor(),
      opacity: 0.25 + pR() * 0.2,
      rotation: angle,
      shape: 'splat',
      permanent: true,
      fadeRate: 0,
      age: 0,
    });
  }
}

/** Helper — same interface as game_input_paint's internal addStroke */
function addStroke(canvas: PaintCanvas, stroke: PaintStroke): void {
  canvas.strokes.push(stroke);
  canvas.totalStrokes++;
  if (canvas.strokes.length > canvas.maxStrokes) {
    canvas.strokes.shift();
  }
  canvas.coverage = Math.min(1, canvas.totalStrokes / 300);
}

// ============================================================================
// PARRY COUNTER-ATTACK PAINT — each hit during parry chain is extra vivid
// ============================================================================

/**
 * Paint from a parry counter-attack hit.
 * Brighter and wider than normal combo paint.
 * Called for each hit during the free 3-beat parry chain.
 */
export function paintParryCounterHit(
  canvas: PaintCanvas,
  hitX: number,
  hitY: number,
  chainIndex: number, // 0, 1, 2 for the 3 free hits
): void {
  const scale = 1.5 + chainIndex * 0.3; // gets bigger with each hit

  const count = 6 + chainIndex * 3;
  for (let i = 0; i < count; i++) {
    const angle = pR() * Math.PI * 2;
    const dist = 8 + scale * 20 + pR() * 15;

    addStroke(canvas, {
      x: hitX + Math.cos(angle) * dist,
      y: hitY + Math.sin(angle) * dist * 0.5,
      radius: 5 + scale * 8 + pR() * 6,
      color: parryColor(),
      opacity: 0.45 + pR() * 0.3,
      rotation: angle,
      shape: pR() > 0.3 ? 'splat' : 'streak',
      permanent: true,
      fadeRate: 0,
      age: 0,
    });
  }

  // Burst ring on each counter hit
  addStroke(canvas, {
    x: hitX, y: hitY,
    radius: 15 + scale * 12,
    color: parryColor(),
    opacity: 0.2,
    rotation: 0,
    shape: 'burst',
    permanent: true,
    fadeRate: 0,
    age: 0,
  });
}

// ============================================================================
// SPOTIFY RANDOM ENEMY SONG — enemy rhythm from a random track
// ============================================================================

/**
 * Fetch a random Spotify track to use as the enemy's rhythm source.
 * Uses Spotify's Recommendations API with random seed parameters.
 *
 * The player fights to their song. The enemy fights to THIS song.
 * Maximum rhythmic clash — two songs at once.
 *
 * @param accessToken  Spotify access token
 * @param playerTrackId  Player's current track (excluded from results)
 * @returns Track ID, BPM, and metadata for enemy rhythm derivation
 */
export async function fetchRandomEnemySong(
  accessToken: string,
  playerTrackId?: string,
): Promise<EnemySong | null> {
  try {
    // Random seed genres — pick 2 that clash with typical player music
    const genres = [
      'hip-hop', 'r-n-b', 'reggaeton', 'jazz', 'drum-and-bass',
      'metal', 'ambient', 'trap', 'latin', 'classical', 'funk',
      'soul', 'house', 'techno', 'punk', 'blues', 'gospel',
    ];
    const g1 = genres[Math.floor(Math.random() * genres.length)];
    const g2 = genres[Math.floor(Math.random() * genres.length)];

    // Random target parameters for variety
    const targetBpm = 60 + Math.floor(Math.random() * 140); // 60–200
    const targetEnergy = Math.random();
    const targetDanceability = Math.random();

    const params = new URLSearchParams({
      seed_genres: `${g1},${g2}`,
      target_tempo: String(targetBpm),
      target_energy: String(targetEnergy.toFixed(2)),
      target_danceability: String(targetDanceability.toFixed(2)),
      limit: '5',
    });

    const res = await fetch(
      `https://api.spotify.com/v1/recommendations?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!res.ok) return null;
    const data = await res.json();
    const tracks = data.tracks || [];

    // Filter out player's current track
    const candidates = tracks.filter((t: any) => t.id !== playerTrackId);
    if (candidates.length === 0) return null;

    // Pick random from candidates
    const track = candidates[Math.floor(Math.random() * candidates.length)];

    // Get audio features for BPM
    const featRes = await fetch(
      `https://api.spotify.com/v1/audio-features/${track.id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    let bpm = targetBpm;
    let energy = targetEnergy;
    let valence = 0.5;
    let danceability = targetDanceability;

    if (featRes.ok) {
      const feat = await featRes.json();
      bpm = feat.tempo || targetBpm;
      energy = feat.energy || targetEnergy;
      valence = feat.valence || 0.5;
      danceability = feat.danceability || targetDanceability;
    }

    return {
      trackId: track.id,
      trackName: track.name,
      artistName: track.artists?.[0]?.name || 'Unknown',
      bpm,
      energy,
      valence,
      danceability,
      genres: [g1, g2],
    };
  } catch {
    return null;
  }
}

export interface EnemySong {
  trackId: string;
  trackName: string;
  artistName: string;
  bpm: number;
  energy: number;
  valence: number;
  danceability: number;
  genres: string[];
}

/**
 * Fallback: generate a random enemy BPM without Spotify.
 * Picks a BPM that clashes with the player's song.
 */
export function generateRandomEnemyBpm(playerBpm: number): EnemySong {
  // Pick a BPM that's rhythmically awkward against the player
  const ratios = [0.5, 0.66, 0.75, 1.33, 1.5, 1.66];
  const ratio = ratios[Math.floor(Math.random() * ratios.length)];
  const enemyBpm = Math.round(playerBpm * ratio);

  // Clamp to playable range
  const clampedBpm = Math.max(50, Math.min(200, enemyBpm));

  const genres = ['synthetic', 'procedural'];

  return {
    trackId: 'fallback',
    trackName: `${clampedBpm} BPM`,
    artistName: 'Procedural',
    bpm: clampedBpm,
    energy: 0.3 + Math.random() * 0.4,
    valence: Math.random(),
    danceability: Math.random(),
    genres,
  };
}

// ============================================================================
// BOARD CONTROL PERCENTAGE
// ============================================================================

/**
 * Calculate board control as player paint vs total possible.
 * Shows as percentage on HUD.
 */
export function getBoardControl(canvas: PaintCanvas): {
  /** Player paint coverage 0–1 */
  control: number;
  /** Total strokes alive */
  strokes: number;
  /** Total strokes placed this session */
  totalPlaced: number;
  /** Total strokes erased (placed - alive) */
  totalErased: number;
  /** Rating based on control */
  rating: 'masterpiece' | 'dominant' | 'contested' | 'struggling' | 'blank';
} {
  const control = canvas.coverage;
  const strokes = canvas.strokes.length;
  const totalErased = canvas.totalStrokes - strokes;

  let rating: 'masterpiece' | 'dominant' | 'contested' | 'struggling' | 'blank';
  if (control > 0.85) rating = 'masterpiece';
  else if (control > 0.6) rating = 'dominant';
  else if (control > 0.35) rating = 'contested';
  else if (control > 0.1) rating = 'struggling';
  else rating = 'blank';

  return { control, strokes, totalPlaced: canvas.totalStrokes, totalErased, rating };
}

/** Draw board control HUD */
export function drawBoardControl(
  ctx: CanvasRenderingContext2D,
  canvas: PaintCanvas,
  screenW: number,
  screenH: number,
): void {
  const { control, rating } = getBoardControl(canvas);
  const pct = Math.round(control * 100);

  ctx.save();
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';

  // Color based on rating
  const colors: Record<string, string> = {
    masterpiece: '#FFD700',
    dominant: '#44FF88',
    contested: '#FFAA00',
    struggling: '#FF4444',
    blank: '#666666',
  };

  ctx.fillStyle = colors[rating] || '#888888';
  ctx.fillText(`${pct}% BOARD`, screenW - 10, screenH - 45);

  ctx.restore();
}

// ============================================================================
// END-OF-SONG STATS
// ============================================================================

export interface SongStats {
  /** Time to complete (seconds) */
  clearTime: number;
  /** Max combo chain */
  maxChain: number;
  /** Total combos landed */
  totalHits: number;
  /** Perfect timing percentage */
  perfectPercent: number;
  /** Board control at end */
  boardControl: number;
  /** Board rating */
  boardRating: string;
  /** Paint strokes placed */
  strokesPlaced: number;
  /** Paint strokes erased by enemies */
  strokesErased: number;
  /** Parries landed */
  parriesLanded: number;
  /** Blocks (on-beat) */
  perfectBlocks: number;
  /** HP remaining */
  hpRemaining: number;
  /** Enemy rhythm genre */
  enemyRhythm: string;
  /** Enemy song (if Spotify) */
  enemySong: string;
  /** Player song */
  playerSong: string;
  /** Overall grade */
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
}

export function calculateGrade(stats: SongStats): 'S' | 'A' | 'B' | 'C' | 'D' | 'F' {
  let score = 0;

  score += stats.boardControl * 30;           // max 30
  score += Math.min(20, stats.maxChain);       // max 20
  score += stats.perfectPercent * 20;          // max 20
  score += stats.parriesLanded * 3;            // up to 15
  score += (stats.hpRemaining / 100) * 15;    // max 15

  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

// ============================================================================
// EXPORTS
// ============================================================================
// paintParryExplosion(canvas, pX, pY, eX, eY, chainLen) — massive vibrant paint
// paintParryCounterHit(canvas, x, y, chainIndex)        — vivid counter-attack paint
// fetchRandomEnemySong(token, playerTrackId)             — random Spotify enemy song
// generateRandomEnemyBpm(playerBpm)                      — fallback enemy BPM
// getBoardControl(canvas)                                — board control stats
// drawBoardControl(ctx, canvas, w, h)                    — HUD percentage
// calculateGrade(stats)                                  — S/A/B/C/D/F
// SongStats, EnemySong                                   — types
// ============================================================================
