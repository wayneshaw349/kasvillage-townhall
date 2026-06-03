// ============================================================================
// KasVillage Multiplayer — Head-to-Head Boss Mode
// P2P via Bluetooth or relay. No server. No wager logic.
//
// FLOW:
//   1. Both players connect (Bluetooth or Akash relay)
//   2. Both select same Spotify track (or host picks)
//   3. Both play their own boards simultaneously
//   4. First to clear Zone 3 becomes the BOSS in opponent's Zone 4
//   5. Loser fights the winner's avatar as the final boss
//   6. Match result recorded to Arweave (optional)
//
// NO WAGER SYSTEM. Players handle P2P agreements themselves on Kaspa L1.
// KasVillage provides the game, not the stakes.
// ============================================================================

import type { Race, Gender } from './avatar_silhouette_generator';
import type { AvatarData, ShadingPreset } from './kasvillage_avatar_engine';
import type { GameState, ComboState } from './kasvillage_game_v1';
import type { WaveSpawner } from './kasvillage_wave_spawner';
import type { BeatSyncState } from './kasvillage_spotify_sync';
import type { SpriteSheet } from './kasvillage_canvas_renderer';
import type { EnemyAvatarCache, EnemyTemplate } from './kasvillage_enemy_avatars';

// ============================================================================
// MATCH STATE
// ============================================================================

export type MatchPhase =
  | 'lobby'          // waiting for opponent
  | 'syncing'        // syncing Spotify track + countdown
  | 'racing'         // both playing zones 0–3
  | 'boss_phase'     // winner is boss, loser fights
  | 'result'         // match complete
  | 'disconnected';  // opponent dropped

export interface PlayerProfile {
  /** Kaspa public key (identity) */
  pubkey: string;
  /** Kaspa address */
  address: string;
  /** Display name */
  name: string;
  /** Avatar data for boss rendering */
  avatarData: AvatarData;
  /** Player class */
  playerClass: string;
  /** Race */
  race: Race;
  /** Gender */
  gender: Gender;
  /** XP level */
  level: number;
}

/** Lightweight state synced between players every ~500ms */
export interface PlayerSyncState {
  /** Current zone (0–4) */
  zone: number;
  /** Zone progress 0–1 */
  zoneProgress: number;
  /** Current combo chain */
  comboChain: number;
  /** Max chain this match */
  maxChain: number;
  /** Player HP */
  hp: number;
  /** Enemies killed */
  killCount: number;
  /** Total score */
  score: number;
  /** Has cleared zone 3 (becomes boss) */
  clearedZone3: boolean;
  /** Is dead */
  dead: boolean;
  /** Song position (for sync verification) */
  songPosition: number;
  /** Timestamp */
  timestamp: number;
}

export interface MatchState {
  /** Match phase */
  phase: MatchPhase;
  /** This player's profile */
  localPlayer: PlayerProfile;
  /** Opponent's profile */
  remotePlayer: PlayerProfile | null;
  /** Local sync state (sent to opponent) */
  localSync: PlayerSyncState;
  /** Remote sync state (received from opponent) */
  remoteSync: PlayerSyncState | null;
  /** Match ID (deterministic from both pubkeys + timestamp) */
  matchId: string;
  /** Spotify track ID both players agreed on */
  trackId: string | null;
  /** Track name */
  trackName: string;
  /** Who won: 'local' | 'remote' | 'draw' | null */
  winner: 'local' | 'remote' | 'draw' | null;
  /** Connection type */
  connectionType: 'bluetooth' | 'relay';
  /** Match start time */
  startTime: number;
  /** Match duration */
  duration: number;
  /** Whether this player is the boss (cleared zone 3 first) */
  iAmBoss: boolean;
  /** Opponent's avatar as boss template (when they become boss) */
  opponentBossTemplate: EnemyTemplate | null;
  /** Opponent's sprite sheet (for boss rendering) */
  opponentSheet: SpriteSheet | null;
}

// ============================================================================
// TRANSPORT INTERFACE — Bluetooth or Relay
// ============================================================================

export interface MatchTransport {
  /** Send data to opponent */
  send(data: Uint8Array): void;
  /** Register receive handler */
  onReceive(handler: (data: Uint8Array) => void): void;
  /** Is connected */
  connected: boolean;
  /** Disconnect */
  disconnect(): void;
  /** Connection type */
  type: 'bluetooth' | 'relay';
}

// ============================================================================
// MESSAGE PROTOCOL — compact binary messages
// ============================================================================

const MSG = {
  HELLO:       0x01, // profile exchange
  TRACK_PICK:  0x02, // host picks track
  TRACK_ACK:   0x03, // guest confirms track
  COUNTDOWN:   0x04, // sync countdown
  SYNC_STATE:  0x05, // periodic state sync
  ZONE3_CLEAR: 0x06, // player cleared zone 3 (becomes boss)
  BOSS_DATA:   0x07, // send avatar data for boss rendering
  MATCH_END:   0x08, // match result
  PING:        0x09, // keepalive
  DISCONNECT:  0x0A, // clean disconnect
} as const;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encodeMessage(type: number, payload: any): Uint8Array {
  const json = JSON.stringify(payload);
  const jsonBytes = encoder.encode(json);
  const msg = new Uint8Array(1 + jsonBytes.length);
  msg[0] = type;
  msg.set(jsonBytes, 1);
  return msg;
}

function decodeMessage(data: Uint8Array): { type: number; payload: any } {
  const type = data[0];
  const json = decoder.decode(data.slice(1));
  return { type, payload: JSON.parse(json) };
}

// ============================================================================
// CREATE MATCH
// ============================================================================

export function createMatchState(
  localPlayer: PlayerProfile,
  connectionType: 'bluetooth' | 'relay',
): MatchState {
  return {
    phase: 'lobby',
    localPlayer,
    remotePlayer: null,
    localSync: createSyncState(),
    remoteSync: null,
    matchId: '',
    trackId: null,
    trackName: '',
    winner: null,
    connectionType,
    startTime: 0,
    duration: 0,
    iAmBoss: false,
    opponentBossTemplate: null,
    opponentSheet: null,
  };
}

function createSyncState(): PlayerSyncState {
  return {
    zone: 0,
    zoneProgress: 0,
    comboChain: 0,
    maxChain: 0,
    hp: 100,
    killCount: 0,
    score: 0,
    clearedZone3: false,
    dead: false,
    songPosition: 0,
    timestamp: Date.now(),
  };
}

// ============================================================================
// MATCH CONTROLLER
// ============================================================================

export class MatchController {
  match: MatchState;
  transport: MatchTransport;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private lastRemotePing: number = 0;

  /** Callbacks */
  onPhaseChange?: (phase: MatchPhase) => void;
  onOpponentJoined?: (profile: PlayerProfile) => void;
  onOpponentBecameBoss?: (bossTemplate: EnemyTemplate) => void;
  onMatchEnd?: (result: MatchResult) => void;
  onOpponentSync?: (sync: PlayerSyncState) => void;

  constructor(
    localPlayer: PlayerProfile,
    transport: MatchTransport,
  ) {
    this.match = createMatchState(localPlayer, transport.type);
    this.transport = transport;

    // Wire message handler
    transport.onReceive((data) => this.handleMessage(data));
  }

  // ── LIFECYCLE ──

  /** Start lobby — send hello, wait for opponent */
  start(): void {
    this.setPhase('lobby');
    this.sendHello();

    // Ping every 3s
    this.pingInterval = setInterval(() => {
      this.transport.send(encodeMessage(MSG.PING, { t: Date.now() }));
      // Check for disconnect (no ping in 10s)
      if (this.lastRemotePing > 0 && Date.now() - this.lastRemotePing > 10000) {
        this.setPhase('disconnected');
      }
    }, 3000);
  }

  /** Clean shutdown */
  stop(): void {
    this.transport.send(encodeMessage(MSG.DISCONNECT, {}));
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.transport.disconnect();
  }

  // ── HOST: PICK TRACK ──

  /** Host selects which Spotify track to play */
  pickTrack(trackId: string, trackName: string): void {
    this.match.trackId = trackId;
    this.match.trackName = trackName;
    this.transport.send(encodeMessage(MSG.TRACK_PICK, { trackId, trackName }));
  }

  // ── GAME STATE SYNC ──

  /** Update local sync state from GameState. Call every frame. */
  updateLocalSync(
    gameState: GameState,
    waves: WaveSpawner,
    sync: BeatSyncState,
  ): void {
    const s = this.match.localSync;
    s.zone = gameState.board?.zoneIndex || 0;
    s.comboChain = gameState.combo.chainLength;
    s.maxChain = gameState.combo.maxChain;
    s.hp = gameState.playerHp;
    s.killCount = waves.totalKilled;
    s.score = calculateScore(gameState, waves);
    s.dead = gameState.gameOver && !gameState.victory;
    s.songPosition = sync.songPosition;
    s.timestamp = Date.now();

    // Zone 3 clear detection
    if (!s.clearedZone3 && s.zone >= 4) {
      s.clearedZone3 = true;
      this.onZone3Cleared();
    }
  }

  /** Start periodic sync (every 500ms). Call when racing begins. */
  startSync(): void {
    this.syncInterval = setInterval(() => {
      this.transport.send(encodeMessage(MSG.SYNC_STATE, this.match.localSync));
    }, 500);
  }

  // ── ZONE 3 CLEARED → BECOME BOSS ──

  private onZone3Cleared(): void {
    // Tell opponent we're the boss now
    this.transport.send(encodeMessage(MSG.ZONE3_CLEAR, {
      pubkey: this.match.localPlayer.pubkey,
    }));

    // Send avatar data so opponent can render us as boss
    this.transport.send(encodeMessage(MSG.BOSS_DATA, {
      avatarData: this.match.localPlayer.avatarData,
      name: this.match.localPlayer.name,
      race: this.match.localPlayer.race,
      gender: this.match.localPlayer.gender,
      level: this.match.localPlayer.level,
      playerClass: this.match.localPlayer.playerClass,
    }));

    this.match.iAmBoss = true;
  }

  // ── MESSAGE HANDLER ──

  private handleMessage(data: Uint8Array): void {
    const { type, payload } = decodeMessage(data);

    switch (type) {
      case MSG.HELLO:
        this.match.remotePlayer = payload as PlayerProfile;
        // Generate match ID from both pubkeys
        this.match.matchId = generateMatchId(
          this.match.localPlayer.pubkey,
          this.match.remotePlayer.pubkey,
        );
        this.onOpponentJoined?.(this.match.remotePlayer);
        break;

      case MSG.TRACK_PICK:
        this.match.trackId = payload.trackId;
        this.match.trackName = payload.trackName;
        // Auto-acknowledge
        this.transport.send(encodeMessage(MSG.TRACK_ACK, { trackId: payload.trackId }));
        break;

      case MSG.TRACK_ACK:
        // Both agreed on track — start countdown
        this.setPhase('syncing');
        setTimeout(() => {
          this.setPhase('racing');
          this.match.startTime = Date.now();
          this.startSync();
        }, 3000);
        break;

      case MSG.SYNC_STATE:
        this.match.remoteSync = payload as PlayerSyncState;
        this.onOpponentSync?.(this.match.remoteSync);
        break;

      case MSG.ZONE3_CLEAR:
        // Opponent cleared zone 3 first — they're the boss in MY game
        // (if I haven't cleared zone 3 yet)
        if (!this.match.localSync.clearedZone3) {
          // I'm not the boss — opponent is
          this.match.iAmBoss = false;
        }
        break;

      case MSG.BOSS_DATA:
        // Opponent sent their avatar for boss rendering
        const bossTemplate = opponentToBossTemplate(payload);
        this.match.opponentBossTemplate = bossTemplate;
        this.onOpponentBecameBoss?.(bossTemplate);
        this.setPhase('boss_phase');
        break;

      case MSG.MATCH_END:
        this.match.winner = payload.winner;
        this.match.duration = Date.now() - this.match.startTime;
        this.setPhase('result');
        this.onMatchEnd?.({
          matchId: this.match.matchId,
          winner: this.match.winner!,
          localScore: this.match.localSync.score,
          remoteScore: this.match.remoteSync?.score || 0,
          localMaxChain: this.match.localSync.maxChain,
          remoteMaxChain: this.match.remoteSync?.maxChain || 0,
          duration: this.match.duration,
          trackId: this.match.trackId || '',
          trackName: this.match.trackName,
        });
        break;

      case MSG.PING:
        this.lastRemotePing = Date.now();
        break;

      case MSG.DISCONNECT:
        this.setPhase('disconnected');
        break;
    }
  }

  // ── MATCH END ──

  /** Call when local player wins (defeated opponent boss) or dies */
  endMatch(localWon: boolean): void {
    const winner = localWon ? 'local' : 'remote';
    this.match.winner = winner;
    this.match.duration = Date.now() - this.match.startTime;

    this.transport.send(encodeMessage(MSG.MATCH_END, {
      winner: localWon ? 'remote' : 'local', // flipped for opponent's perspective
      score: this.match.localSync.score,
      maxChain: this.match.localSync.maxChain,
    }));

    this.setPhase('result');
    this.onMatchEnd?.({
      matchId: this.match.matchId,
      winner,
      localScore: this.match.localSync.score,
      remoteScore: this.match.remoteSync?.score || 0,
      localMaxChain: this.match.localSync.maxChain,
      remoteMaxChain: this.match.remoteSync?.maxChain || 0,
      duration: this.match.duration,
      trackId: this.match.trackId || '',
      trackName: this.match.trackName,
    });
  }

  // ── HELPERS ──

  private setPhase(phase: MatchPhase): void {
    this.match.phase = phase;
    this.onPhaseChange?.(phase);
  }

  private sendHello(): void {
    this.transport.send(encodeMessage(MSG.HELLO, this.match.localPlayer));
  }
}

// ============================================================================
// OPPONENT → BOSS TEMPLATE
// ============================================================================

/** Convert opponent's avatar data into an EnemyTemplate for the boss fight */
function opponentToBossTemplate(payload: any): EnemyTemplate {
  const colors = payload.avatarData?.colors || {};
  return {
    id: 'pvp_boss',
    name: payload.name || 'Challenger',
    race: payload.race || 'human',
    gender: payload.gender || 'male',
    scale: 1.5, // bosses are big
    type: 'boss',
    palette: {
      skin: colors.skin || '#CC8866',
      hair: colors.hair || '#332211',
      primary: colors.primary || '#224488',
      secondary: colors.secondary || '#334466',
      accent: colors.accent || '#CC8833',
      eyes: colors.eyes || '#FF0000', // red eyes for boss version
    },
  };
}

// ============================================================================
// MATCH RESULT
// ============================================================================

export interface MatchResult {
  matchId: string;
  winner: 'local' | 'remote' | 'draw';
  localScore: number;
  remoteScore: number;
  localMaxChain: number;
  remoteMaxChain: number;
  duration: number;
  trackId: string;
  trackName: string;
}

// ============================================================================
// SCORE CALCULATION
// ============================================================================

function calculateScore(state: GameState, waves: WaveSpawner): number {
  let score = 0;
  score += waves.totalKilled * 100;
  score += state.combo.maxChain * 50;
  score += Math.floor(state.playerHp) * 10; // HP bonus
  // Time bonus — faster = more points
  if (state.trialTime > 0) {
    score += Math.max(0, Math.floor((240 - state.trialTime) * 5));
  }
  return score;
}

// ============================================================================
// MATCH ID
// ============================================================================

function generateMatchId(pubkey1: string, pubkey2: string): string {
  // Sort for determinism
  const sorted = [pubkey1, pubkey2].sort();
  const combined = sorted.join('_') + '_' + Date.now();
  // Simple hash
  let h = 0;
  for (let i = 0; i < combined.length; i++) {
    h = (Math.imul(31, h) + combined.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ============================================================================
// ARWEAVE MATCH RECORD (optional, permanent)
// ============================================================================

export interface MatchRecord {
  matchId: string;
  player1: string; // kaspa address
  player2: string;
  winner: string;  // kaspa address of winner
  score1: number;
  score2: number;
  maxChain1: number;
  maxChain2: number;
  trackId: string;
  trackName: string;
  duration: number;
  timestamp: number;
}

/**
 * Build Arweave tags for permanent match record.
 * Caller uploads to Arweave via existing arweave_upload.ts
 */
export function buildMatchArweaveTags(result: MatchResult, match: MatchState): Array<{ name: string; value: string }> {
  return [
    { name: 'App-Name', value: 'KasVillage' },
    { name: 'Content-Type', value: 'application/json' },
    { name: 'Type', value: 'PvP-Match' },
    { name: 'Match-Id', value: result.matchId },
    { name: 'Player-1', value: match.localPlayer.address },
    { name: 'Player-2', value: match.remotePlayer?.address || '' },
    { name: 'Winner', value: result.winner === 'local' ? match.localPlayer.address : (match.remotePlayer?.address || '') },
    { name: 'Track-Id', value: result.trackId },
    { name: 'Track-Name', value: result.trackName },
    { name: 'Duration', value: String(result.duration) },
    { name: 'Score-1', value: String(result.localScore) },
    { name: 'Score-2', value: String(result.remoteScore) },
  ];
}

// ============================================================================
// HUD — opponent progress bar (shows during racing phase)
// ============================================================================

export function drawOpponentHUD(
  ctx: CanvasRenderingContext2D,
  match: MatchState,
  screenW: number,
): void {
  if (!match.remoteSync || match.phase === 'lobby') return;

  const y = 28;
  const barW = screenW * 0.4;
  const barH = 4;
  const barX = screenW / 2 - barW / 2;

  ctx.save();

  // Opponent name
  ctx.font = '9px monospace';
  ctx.fillStyle = '#FF6644';
  ctx.textAlign = 'center';
  ctx.fillText(
    `${match.remotePlayer?.name || 'Opponent'} — Zone ${match.remoteSync.zone + 1}`,
    screenW / 2, y - 6,
  );

  // Progress bar
  ctx.fillStyle = '#222222';
  ctx.fillRect(barX, y, barW, barH);

  const progress = (match.remoteSync.zone + match.remoteSync.zoneProgress) / 5;
  ctx.fillStyle = match.remoteSync.clearedZone3 ? '#FFD700' : '#FF4444';
  ctx.fillRect(barX, y, barW * progress, barH);

  // Chain count
  if (match.remoteSync.comboChain > 0) {
    ctx.font = '8px monospace';
    ctx.fillStyle = '#FF8844';
    ctx.textAlign = 'right';
    ctx.fillText(`${match.remoteSync.comboChain} chain`, barX + barW, y - 6);
  }

  ctx.restore();
}

// ============================================================================
// BLUETOOTH TRANSPORT ADAPTER
// ============================================================================

/**
 * Create a MatchTransport from bluetooth_p2p.ts connection.
 * Wraps the existing Bluetooth module.
 */
export function createBluetoothTransport(
  btConnection: { send: (data: string) => void; onData: (handler: (data: string) => void) => void; disconnect: () => void },
): MatchTransport {
  let receiveHandler: ((data: Uint8Array) => void) | null = null;

  btConnection.onData((base64: string) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    receiveHandler?.(bytes);
  });

  return {
    send: (data: Uint8Array) => {
      const base64 = btoa(String.fromCharCode(...data));
      btConnection.send(base64);
    },
    onReceive: (handler) => { receiveHandler = handler; },
    connected: true,
    disconnect: () => btConnection.disconnect(),
    type: 'bluetooth',
  };
}

/**
 * Create a MatchTransport from Akash relay WebSocket.
 */
export function createRelayTransport(
  ws: WebSocket,
): MatchTransport {
  let receiveHandler: ((data: Uint8Array) => void) | null = null;

  ws.onmessage = (event) => {
    const bytes = new Uint8Array(event.data);
    receiveHandler?.(bytes);
  };

  return {
    send: (data: Uint8Array) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    },
    onReceive: (handler) => { receiveHandler = handler; },
    connected: ws.readyState === WebSocket.OPEN,
    disconnect: () => ws.close(),
    type: 'relay',
  };
}

// ============================================================================
// EXPORTS
// ============================================================================
// MatchController                          — main controller class
// createMatchState(player, connType)      — init
// createBluetoothTransport(bt)            — wrap Bluetooth connection
// createRelayTransport(ws)                — wrap WebSocket relay
// drawOpponentHUD(ctx, match, screenW)    — render opponent progress
// buildMatchArweaveTags(result, match)    — permanent record tags
// opponentToBossTemplate(payload)         — convert opponent to boss
// MatchResult, MatchState, MatchPhase     — types
// ============================================================================
