// ============================================================================
// KasVillage Board Renderer — SDK Environments as Game Backgrounds
// Generates 5 board zones from SDK room templates, pre-renders 30 angles each,
// selects view based on camera system, parallax scroll creates rush effect
// ============================================================================

import type { Race } from './avatar_silhouette_generator';
import {
  Room,
  EnvironmentLayer,
  LayerElement,
  generateRoom,
  preRenderAllAngles,
  generateRoomWithViews,
  ROOM_ANGLES,
  ROOM_ANGLE_STEP,
} from './kasvillage_environments';
import type { CameraState } from './kasvillage_camera_system';
import { getCameraAngleIndex, getCameraTransform, getCameraMode } from './kasvillage_camera_system';

// ============================================================================
// BOARD ZONE DEFINITIONS — 5 zones across 4000px board
// ============================================================================

/** Each zone maps to a room template + mood for visual variety */
export interface BoardZone {
  /** Zone index 0–4 */
  index: number;
  /** Start X on the 4000px board */
  startX: number;
  /** End X on the 4000px board */
  endX: number;
  /** Room template index from ROOM_TEMPLATES */
  templateIdx: number;
  /** Label for the zone */
  label: string;
  /** Pre-rendered room at 30 angles */
  views: Room[];
  /** Base room (angle 0) */
  base: Room;
}

/**
 * Zone layout — 5 escalating environments:
 *   0: Open approach (courtyard/corridor) — NPCs 1–3
 *   1: Mid zone (arena/market) — NPCs 4–6, mini-boss 1
 *   2: Dark zone (cave/crypt) — NPCs 7–9, mini-boss 2
 *   3: Gauntlet (trap corridor/stairwell) — NPCs 10–12, mini-boss 3
 *   4: Boss arena — NPCs 13–15 + boss
 */
const ZONE_CONFIGS: Array<{
  startX: number;
  endX: number;
  label: string;
  /** Index into ROOM_TEMPLATES (30 templates, 0-indexed) */
  templateIdx: number;
}> = [
  { startX: 0,    endX: 800,  label: 'Approach',    templateIdx: 1  },  // wide_hallway
  { startX: 800,  endX: 1600, label: 'Battle Arena', templateIdx: 10 }, // arena
  { startX: 1600, endX: 2400, label: 'Dark Depths',  templateIdx: 16 }, // cave_entrance
  { startX: 2400, endX: 3200, label: 'The Gauntlet', templateIdx: 22 }, // trap_corridor
  { startX: 3200, endX: 4000, label: 'Boss Chamber',  templateIdx: 23 }, // boss_chamber
];

// ============================================================================
// BOARD STATE
// ============================================================================

export interface BoardState {
  zones: BoardZone[];
  /** Total board width */
  boardWidth: number;
  /** Viewport width (screen width) */
  viewportWidth: number;
  /** Viewport height (screen height) */
  viewportHeight: number;
  /** Current scroll offset (tracks playerX) */
  scrollX: number;
  /** Parallax layers for rush effect */
  parallaxLayers: ParallaxLayer[];
  /** Speed lines intensity 0–1 (increases with player speed) */
  speedLineIntensity: number;
  /** Current active zone index */
  activeZoneIndex: number;
  /** Zone transition blend 0–1 (fades between zones) */
  zoneBlend: number;
  /** Whether board is fully loaded */
  ready: boolean;
}

/** Parallax scrolling layer for depth effect */
export interface ParallaxLayer {
  /** Layer depth: 0=far bg, 1=mid, 2=near, 3=foreground */
  depth: number;
  /** Scroll speed multiplier relative to camera (0.2=slow bg, 1.5=fast fg) */
  scrollFactor: number;
  /** Current offset */
  offsetX: number;
  /** Opacity (far layers dimmer) */
  opacity: number;
  /** Scale factor (far layers smaller) */
  scale: number;
}

// ============================================================================
// INIT — generate all zones with 30-angle pre-renders
// ============================================================================

/**
 * Generate the full board. Call once at game start.
 * Pre-renders 5 zones × 30 angles = 150 room variants.
 * Takes ~2–3 seconds on phone.
 *
 * @param race       Player's race (determines biome palette)
 * @param seed       Session seed for deterministic generation
 * @param vpWidth    Viewport width in pixels
 * @param vpHeight   Viewport height in pixels
 */
export function createBoardState(
  race: Race,
  seed: string,
  vpWidth: number = 400,
  vpHeight: number = 400,
): BoardState {
  const zones: BoardZone[] = ZONE_CONFIGS.map((cfg, i) => {
    const zoneSeed = `${seed}_zone${i}`;
    const { base, views } = generateRoomWithViews(race, cfg.templateIdx, zoneSeed);
    return {
      index: i,
      startX: cfg.startX,
      endX: cfg.endX,
      templateIdx: cfg.templateIdx,
      label: cfg.label,
      views,
      base,
    };
  });

  const parallaxLayers: ParallaxLayer[] = [
    { depth: 0, scrollFactor: 0.15, offsetX: 0, opacity: 0.4, scale: 0.85 },  // far sky
    { depth: 1, scrollFactor: 0.35, offsetX: 0, opacity: 0.6, scale: 0.92 },  // mid bg
    { depth: 2, scrollFactor: 0.7,  offsetX: 0, opacity: 0.85, scale: 1.0 },  // near bg
    { depth: 3, scrollFactor: 1.0,  offsetX: 0, opacity: 1.0, scale: 1.0 },   // floor/ground
    { depth: 4, scrollFactor: 1.3,  offsetX: 0, opacity: 0.7, scale: 1.05 },  // foreground overlay
  ];

  return {
    zones,
    boardWidth: 4000,
    viewportWidth: vpWidth,
    viewportHeight: vpHeight,
    scrollX: 0,
    parallaxLayers,
    speedLineIntensity: 0,
    activeZoneIndex: 0,
    zoneBlend: 0,
    ready: true,
  };
}

// ============================================================================
// UPDATE — call every frame after game tick
// ============================================================================

/**
 * Update board scroll and parallax. Call every frame.
 *
 * @param board      Board state
 * @param playerX    Player X position on the 4000px board
 * @param playerVX   Player X velocity (for speed lines)
 * @param camera     Camera state (for angle selection)
 * @param dt         Delta time
 */
export function updateBoard(
  board: BoardState,
  playerX: number,
  playerVX: number,
  camera: CameraState,
  dt: number,
): void {
  // --- Scroll to follow player ---
  const targetScroll = Math.max(0, Math.min(
    playerX - board.viewportWidth * 0.35, // player at 35% from left
    board.boardWidth - board.viewportWidth,
  ));
  // Smooth follow
  board.scrollX += (targetScroll - board.scrollX) * 6 * dt;

  // --- Update parallax layers ---
  for (const layer of board.parallaxLayers) {
    layer.offsetX = -board.scrollX * layer.scrollFactor;
  }

  // --- Speed lines from velocity ---
  const absVX = Math.abs(playerVX);
  const targetIntensity = Math.min(1, absVX / 12); // max at vx=12
  board.speedLineIntensity += (targetIntensity - board.speedLineIntensity) * 4 * dt;

  // --- Active zone detection ---
  const prevZone = board.activeZoneIndex;
  for (let i = 0; i < board.zones.length; i++) {
    if (playerX >= board.zones[i].startX && playerX < board.zones[i].endX) {
      board.activeZoneIndex = i;
      break;
    }
  }

  // --- Zone transition blend ---
  if (board.activeZoneIndex !== prevZone) {
    board.zoneBlend = 0; // start blend
  }
  if (board.zoneBlend < 1) {
    board.zoneBlend += dt * 2; // 0.5s blend
    if (board.zoneBlend > 1) board.zoneBlend = 1;
  }
}

// ============================================================================
// RENDER QUERY — what to draw this frame
// ============================================================================

/** Per-frame render data for the board background */
export interface BoardRenderFrame {
  /** Active zone room at current camera angle */
  activeRoom: Room;
  /** Previous zone room (for blending during transitions), null if not blending */
  blendRoom: Room | null;
  /** Blend factor 0–1 (0 = full prev, 1 = full active) */
  blendFactor: number;
  /** Camera angle index 0–29 */
  angleIndex: number;
  /** Parallax offsets per layer depth */
  layerOffsets: Array<{ depth: number; offsetX: number; opacity: number; scale: number }>;
  /** Speed line intensity 0–1 */
  speedLines: number;
  /** Camera shake transform */
  shakeOffset: { offsetX: number; offsetY: number };
  /** Zone label (for HUD) */
  zoneLabel: string;
  /** Zone progress 0–1 within current zone */
  zoneProgress: number;
}

/**
 * Get the current frame's render data. Call after updateBoard().
 * Renderer uses this to composite the background.
 */
export function getBoardRenderFrame(
  board: BoardState,
  camera: CameraState,
  playerX: number,
): BoardRenderFrame {
  const angleIndex = getCameraAngleIndex(camera);
  const zone = board.zones[board.activeZoneIndex];

  // Active room at current camera angle
  const activeRoom = zone.views[angleIndex % zone.views.length];

  // Blend room (previous zone) during transitions
  let blendRoom: Room | null = null;
  if (board.zoneBlend < 1 && board.activeZoneIndex > 0) {
    const prevZone = board.zones[board.activeZoneIndex - 1];
    blendRoom = prevZone.views[angleIndex % prevZone.views.length];
  }

  // Layer offsets
  const layerOffsets = board.parallaxLayers.map(l => ({
    depth: l.depth,
    offsetX: l.offsetX,
    opacity: l.opacity,
    scale: l.scale,
  }));

  // Zone progress
  const zoneWidth = zone.endX - zone.startX;
  const zoneProgress = Math.max(0, Math.min(1, (playerX - zone.startX) / zoneWidth));

  return {
    activeRoom,
    blendRoom,
    blendFactor: board.zoneBlend,
    angleIndex,
    layerOffsets,
    speedLines: board.speedLineIntensity,
    shakeOffset: getCameraTransform(camera),
    zoneLabel: zone.label,
    zoneProgress,
  };
}

// ============================================================================
// CANVAS DRAW HELPERS — draw a Room to a 2D canvas
// ============================================================================

/**
 * Draw a room's layers to a canvas context with parallax offsets.
 * Each EnvironmentLayer maps to a parallax depth.
 *
 * Layer z mapping:
 *   z=0 (sky/far bg) → parallax depth 0 (scrollFactor 0.15)
 *   z=1 (mid walls)  → parallax depth 1 (scrollFactor 0.35)
 *   z=2 (floor)      → parallax depth 3 (scrollFactor 1.0)
 *   z=3 (objects)     → parallax depth 2 (scrollFactor 0.7)
 *   z=4 (overlay)     → parallax depth 4 (scrollFactor 1.3)
 */
export function drawRoomToCanvas(
  ctx: CanvasRenderingContext2D,
  room: Room,
  frame: BoardRenderFrame,
  viewportW: number,
  viewportH: number,
): void {
  ctx.save();

  // Apply camera shake
  ctx.translate(frame.shakeOffset.offsetX, frame.shakeOffset.offsetY);

  // Sort layers by z
  const sortedLayers = [...room.layers].sort((a, b) => a.z - b.z);

  for (const layer of sortedLayers) {
    // Map layer z to parallax depth
    const depthMap: Record<number, number> = { 0: 0, 1: 1, 2: 3, 3: 2, 4: 4 };
    const depth = depthMap[layer.z] ?? layer.z;
    const offset = frame.layerOffsets[depth] || frame.layerOffsets[0];

    ctx.save();
    ctx.globalAlpha = offset.opacity;

    // Parallax offset — creates depth
    const parallaxX = offset.offsetX % viewportW;
    ctx.translate(parallaxX, 0);

    // Scale from center for depth perspective
    if (offset.scale !== 1) {
      const cx = viewportW / 2;
      const cy = viewportH / 2;
      ctx.translate(cx, cy);
      ctx.scale(offset.scale, offset.scale);
      ctx.translate(-cx, -cy);
    }

    // Draw elements
    for (const el of layer.elements) {
      drawElement(ctx, el, viewportW, viewportH);
    }

    ctx.restore();
  }

  // --- Speed lines overlay ---
  if (frame.speedLines > 0.1) {
    drawSpeedLines(ctx, frame.speedLines, viewportW, viewportH);
  }

  ctx.restore();
}

/** Draw a single LayerElement to canvas */
function drawElement(
  ctx: CanvasRenderingContext2D,
  el: LayerElement,
  _vw: number,
  _vh: number,
): void {
  ctx.fillStyle = el.litColor;
  ctx.strokeStyle = el.litColor;

  switch (el.type) {
    case 'rect': {
      const { x, y, width, height } = el.props as any;
      ctx.fillRect(x, y, width, height);
      break;
    }
    case 'circle': {
      const { cx, cy, r } = el.props as any;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'polygon': {
      const points = el.props.points as string;
      if (!points) break;
      const pairs = points.split(/\s+/).map(p => p.split(',').map(Number));
      if (pairs.length < 3) break;
      ctx.beginPath();
      ctx.moveTo(pairs[0][0], pairs[0][1]);
      for (let i = 1; i < pairs.length; i++) {
        ctx.lineTo(pairs[i][0], pairs[i][1]);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'path': {
      const d = el.props.d as string;
      if (!d) break;
      const p = new Path2D(d);
      ctx.fill(p);
      break;
    }
    case 'arch':
    case 'column':
    case 'stairs':
    case 'window': {
      // Complex types → fallback rect
      const { x, y, width, height } = el.props as any;
      if (x !== undefined) ctx.fillRect(x || 0, y || 0, width || 20, height || 40);
      break;
    }
  }
}

/** Draw speed lines for the rushing-toward-you effect */
function drawSpeedLines(
  ctx: CanvasRenderingContext2D,
  intensity: number,
  vw: number,
  vh: number,
): void {
  const lineCount = Math.floor(intensity * 20);
  const cx = vw / 2;
  const cy = vh * 0.45;

  ctx.save();
  ctx.globalAlpha = intensity * 0.3;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  for (let i = 0; i < lineCount; i++) {
    // Radial lines from center vanishing point
    const angle = (i / lineCount) * Math.PI * 2;
    const innerR = 30 + Math.random() * 40;
    const outerR = innerR + 80 + intensity * 200;

    ctx.beginPath();
    ctx.moveTo(
      cx + Math.cos(angle) * innerR,
      cy + Math.sin(angle) * innerR * 0.6,
    );
    ctx.lineTo(
      cx + Math.cos(angle) * outerR,
      cy + Math.sin(angle) * outerR * 0.6,
    );
    ctx.stroke();
  }
  ctx.restore();
}

// ============================================================================
// ZONE TRANSITION BLEND — crossfade between zone backgrounds
// ============================================================================

/**
 * Draw the board background with zone blending.
 * Call this instead of drawRoomToCanvas for smooth zone transitions.
 */
export function drawBoardBackground(
  ctx: CanvasRenderingContext2D,
  board: BoardState,
  camera: CameraState,
  playerX: number,
  viewportW: number,
  viewportH: number,
): void {
  const frame = getBoardRenderFrame(board, camera, playerX);

  // If blending between zones
  if (frame.blendRoom && frame.blendFactor < 1) {
    // Draw previous zone at fading opacity
    ctx.save();
    ctx.globalAlpha = 1 - frame.blendFactor;
    drawRoomToCanvas(ctx, frame.blendRoom, frame, viewportW, viewportH);
    ctx.restore();

    // Draw active zone at increasing opacity
    ctx.save();
    ctx.globalAlpha = frame.blendFactor;
    drawRoomToCanvas(ctx, frame.activeRoom, frame, viewportW, viewportH);
    ctx.restore();
  } else {
    // Single zone — full draw
    drawRoomToCanvas(ctx, frame.activeRoom, frame, viewportW, viewportH);
  }
}

// ============================================================================
// HUD HELPERS
// ============================================================================

/** Get zone info for HUD display */
export function getZoneHUD(board: BoardState, playerX: number): {
  zoneName: string;
  zoneIndex: number;
  totalZones: number;
  progress: number; // 0–1 through current zone
  overallProgress: number; // 0–1 through entire board
} {
  const zone = board.zones[board.activeZoneIndex];
  const zoneWidth = zone.endX - zone.startX;
  return {
    zoneName: zone.label,
    zoneIndex: board.activeZoneIndex,
    totalZones: board.zones.length,
    progress: Math.max(0, Math.min(1, (playerX - zone.startX) / zoneWidth)),
    overallProgress: Math.max(0, Math.min(1, playerX / board.boardWidth)),
  };
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================
// createBoardState(race, seed, vpW, vpH)  — init (generates 5×30=150 rooms)
// updateBoard(board, playerX, vx, cam, dt) — tick every frame
// getBoardRenderFrame(board, cam, playerX)  — query current frame render data
// drawRoomToCanvas(ctx, room, frame, w, h)  — draw one room to canvas
// drawBoardBackground(ctx, board, cam, pX, w, h) — full draw with zone blending
// getZoneHUD(board, playerX)                — zone info for HUD
// ============================================================================
