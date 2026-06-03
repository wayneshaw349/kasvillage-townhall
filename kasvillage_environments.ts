// ============================================================================
// KasVillage Procedural Environment Generator
// Fixed-camera rooms like Vagrant Story / RE1 / FF7
// 30 room templates × camera angle variants = 120+ unique rooms
// Race → biome. One build → 30 boards.
// ============================================================================

import { Race, ShadingPreset } from './kasvillage_avatar_engine';

// ============================================================================
// TYPES
// ============================================================================

export interface RoomCamera {
  /** Camera angle in degrees: 0=top-down, 45=isometric, 90=side view */
  pitch: number;
  /** Camera rotation: 0=north, 90=east, 180=south, 270=west */
  yaw: number;
  /** Zoom level: 0.5=far, 1.0=normal, 2.0=close */
  zoom: number;
  /** Label for the angle */
  label: string;
}

export interface CollisionRect {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'walkable' | 'wall' | 'exit' | 'interact';
  exitTo?: string; // room ID to transition to
}

export interface EnvironmentLayer {
  /** Z-depth: 0=far background, 1=mid, 2=floor, 3=foreground objects, 4=ceiling/overlay */
  z: number;
  /** SVG elements for this layer */
  elements: LayerElement[];
  /** Parallax scroll factor: 0=static, 1=moves with camera */
  parallax: number;
}

export interface LayerElement {
  type: 'rect' | 'path' | 'circle' | 'polygon' | 'arch' | 'column' | 'stairs' | 'window';
  props: Record<string, string | number>;
  /** Original unlit color — stored for re-shading at different angles */
  baseColor: string;
  /** Color with lighting applied */
  litColor: string;
  /** Surface normal angle for lighting calc */
  normalAngle: number;
}

export interface Room {
  id: string;
  template: string;
  camera: RoomCamera;
  biome: string;
  layers: EnvironmentLayer[];
  collision: CollisionRect[];
  /** Width/height of the walkable area in game units */
  width: number;
  height: number;
  /** Avatar render angle = camera.yaw (so avatar faces correctly in the room) */
  avatarCameraOffset: number;
  /** Ambient particle effect for this room */
  ambientEffect: string | null;
  /** Shading preset that matches the room mood */
  shading: ShadingPreset;
}

// ============================================================================
// SEEDED RANDOM
// ============================================================================

function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  return () => {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return (hash % 10000) / 10000;
  };
}

// ============================================================================
// RACE → BIOME MAPPING
// ============================================================================

export const RACE_BIOMES: Record<string, string> = {
  human:     'village',
  cyborg:    'tech_lab',
  mutant:    'wasteland',
  ethereal:  'crystal_cave',
  beast:     'jungle',
  elf:       'forest_ruins',
  darkelf:   'underground',
  dwarf:     'mine_forge',
  alien:     'space_station',
  orc:       'war_camp',
  halfling:  'cozy_burrow',
  golem:     'quarry',
  elemental: 'elemental_plane',
  undead:    'crypt',
  giant:     'mountain_hall',
  merfolk:   'coral_reef',
  centaur:   'open_plains',
  troll:     'swamp',
  gnome:     'workshop',
  phoenix:   'volcanic',
  sprite:    'fairy_glen',
  vampire:   'gothic_castle',
  werewolf:  'dark_forest',
  angel:     'sky_temple',
  dragonkin: 'dragon_lair',
  fae:       'enchanted_grove',
};

// ============================================================================
// BIOME COLOR PALETTES
// ============================================================================

const BIOME_PALETTES: Record<string, { floor: string[]; wall: string[]; accent: string[]; sky: string }> = {
  village:         { floor: ['#8B7355','#A0896C','#6B5B45'], wall: ['#C4A882','#D4B896','#E8D5B5'], accent: ['#4A7C4B','#5B8A5C'], sky: '#87CEEB' },
  tech_lab:        { floor: ['#2A2A3E','#333350','#1E1E30'], wall: ['#404060','#4A4A6A','#555580'], accent: ['#00FFCC','#00AAFF'], sky: '#0A0A1A' },
  wasteland:       { floor: ['#8B7D5E','#9A8A6A','#7A6D50'], wall: ['#6B5D45','#5A4E3A','#4A4030'], accent: ['#AA4422','#CC6633'], sky: '#C4A060' },
  crystal_cave:    { floor: ['#2A1A3E','#3A2A50','#1E1030'], wall: ['#4A3A6A','#5A4A7A','#3A2A5A'], accent: ['#CC88FF','#AA66EE','#8844CC'], sky: '#1A0A2E' },
  jungle:          { floor: ['#2D4A1D','#3A5A28','#1E3A12'], wall: ['#1A3010','#254020','#0F2508'], accent: ['#88CC22','#AADD44'], sky: '#4A8A3A' },
  forest_ruins:    { floor: ['#3A5A2A','#4A6A38','#2A4A1A'], wall: ['#6A7A5A','#7A8A6A','#8A9A7A'], accent: ['#C8B878','#D8C888'], sky: '#6A9A5A' },
  underground:     { floor: ['#1A1A2A','#222235','#15152A'], wall: ['#2A2A40','#333350','#3A3A55'], accent: ['#6644AA','#8866CC'], sky: '#0A0A15' },
  mine_forge:      { floor: ['#4A3A2A','#5A4A38','#3A2A1A'], wall: ['#6A5A48','#7A6A58','#5A4A38'], accent: ['#FF8800','#FFAA33','#CC6600'], sky: '#3A2A1A' },
  space_station:   { floor: ['#1A1A2E','#222240','#2A2A4A'], wall: ['#3A3A5A','#4A4A6A','#5A5A7A'], accent: ['#00FFFF','#00CCFF','#0088FF'], sky: '#000010' },
  war_camp:        { floor: ['#5A4A30','#6A5A40','#4A3A20'], wall: ['#7A6A50','#8A7A60','#6A5A40'], accent: ['#AA2200','#CC4400','#882200'], sky: '#8A7A60' },
  cozy_burrow:     { floor: ['#8A7A5A','#9A8A6A','#7A6A4A'], wall: ['#B8A888','#C8B898','#D8C8A8'], accent: ['#DD9944','#EEAA55'], sky: '#C8B898' },
  quarry:          { floor: ['#6A6A6A','#7A7A7A','#5A5A5A'], wall: ['#8A8A8A','#9A9A9A','#AAAAAA'], accent: ['#BB8844','#CC9955'], sky: '#AAAAAA' },
  elemental_plane: { floor: ['#1A2A3A','#2A3A4A','#0A1A2A'], wall: ['#3A4A5A','#4A5A6A','#2A3A4A'], accent: ['#FF4400','#00AAFF','#44DD00','#FFAA00'], sky: '#0A1A2A' },
  crypt:           { floor: ['#2A2A2A','#333333','#1A1A1A'], wall: ['#3A3A3A','#444444','#2A2A2A'], accent: ['#558855','#447744'], sky: '#0A0A0A' },
  mountain_hall:   { floor: ['#5A5A6A','#6A6A7A','#4A4A5A'], wall: ['#7A7A8A','#8A8A9A','#9A9AAA'], accent: ['#CCAA66','#DDBB77'], sky: '#8A8AAA' },
  coral_reef:      { floor: ['#1A4A5A','#2A5A6A','#0A3A4A'], wall: ['#0A3A4A','#1A4A5A','#2A5A6A'], accent: ['#FF6688','#FFAA44','#44DDAA','#FF88CC'], sky: '#0A2A3A' },
  open_plains:     { floor: ['#7A8A4A','#8A9A5A','#6A7A3A'], wall: ['#9AAA6A','#AABB7A','#8A9A5A'], accent: ['#DDCC66','#EEDD88'], sky: '#88BBDD' },
  swamp:           { floor: ['#2A3A1A','#3A4A2A','#1A2A0A'], wall: ['#3A4A2A','#4A5A3A','#2A3A1A'], accent: ['#668844','#779955'], sky: '#4A5A3A' },
  workshop:        { floor: ['#6A5A4A','#7A6A5A','#5A4A3A'], wall: ['#8A7A6A','#9A8A7A','#AA9A8A'], accent: ['#BB88DD','#CC99EE','#AA77CC'], sky: '#AA9A8A' },
  volcanic:        { floor: ['#2A1A0A','#3A2A1A','#1A0A00'], wall: ['#4A2A1A','#5A3A2A','#3A1A0A'], accent: ['#FF4400','#FF6600','#FF8800','#FFAA00'], sky: '#3A1A0A' },
  fairy_glen:      { floor: ['#3A6A3A','#4A7A4A','#2A5A2A'], wall: ['#5A8A5A','#6A9A6A','#7AAA7A'], accent: ['#FFAACC','#FFCCDD','#FF88BB'], sky: '#AADDAA' },
  gothic_castle:   { floor: ['#1A1A2A','#2A2A3A','#0A0A1A'], wall: ['#3A3A4A','#4A4A5A','#2A2A3A'], accent: ['#880022','#AA0033','#CC1144'], sky: '#0A0A1A' },
  dark_forest:     { floor: ['#1A2A1A','#2A3A2A','#0A1A0A'], wall: ['#1A3A1A','#2A4A2A','#0A2A0A'], accent: ['#667744','#778855'], sky: '#0A1A0A' },
  sky_temple:      { floor: ['#CCCCDD','#DDDDEE','#BBBBCC'], wall: ['#EEEEFF','#FFFFFF','#DDDDEE'], accent: ['#FFD700','#FFEE44','#FFFFAA'], sky: '#AACCFF' },
  dragon_lair:     { floor: ['#3A2A1A','#4A3A2A','#2A1A0A'], wall: ['#5A4A3A','#6A5A4A','#4A3A2A'], accent: ['#FF6600','#FFAA00','#FF4400'], sky: '#2A1A0A' },
  enchanted_grove: { floor: ['#2A5A3A','#3A6A4A','#1A4A2A'], wall: ['#4A7A5A','#5A8A6A','#3A6A4A'], accent: ['#AADDFF','#88CCEE','#CCFFEE'], sky: '#88CCAA' },
};

// ============================================================================
// CAMERA ANGLE PRESETS — the "30 different boards from one build"
// ============================================================================

const CAMERA_PRESETS: RoomCamera[] = [
  // Isometric variants
  { pitch: 45, yaw: 135, zoom: 1.0, label: 'iso_SE' },
  { pitch: 45, yaw: 45,  zoom: 1.0, label: 'iso_NE' },
  { pitch: 45, yaw: 225, zoom: 1.0, label: 'iso_SW' },
  { pitch: 45, yaw: 315, zoom: 1.0, label: 'iso_NW' },
  // Overhead variants
  { pitch: 70, yaw: 0,   zoom: 1.0, label: 'overhead_N' },
  { pitch: 70, yaw: 90,  zoom: 1.0, label: 'overhead_E' },
  { pitch: 70, yaw: 180, zoom: 1.0, label: 'overhead_S' },
  // Low angle (dramatic, Vagrant Story)
  { pitch: 20, yaw: 135, zoom: 1.0, label: 'low_SE' },
  { pitch: 20, yaw: 45,  zoom: 1.0, label: 'low_NE' },
  { pitch: 20, yaw: 180, zoom: 1.0, label: 'low_S' },
  { pitch: 15, yaw: 90,  zoom: 1.2, label: 'low_close_E' },
  // Side view (platformer)
  { pitch: 5,  yaw: 90,  zoom: 1.0, label: 'side_E' },
  { pitch: 5,  yaw: 270, zoom: 1.0, label: 'side_W' },
  // Bird's eye
  { pitch: 85, yaw: 0,   zoom: 0.8, label: 'birdseye' },
  { pitch: 85, yaw: 45,  zoom: 0.7, label: 'birdseye_far' },
  // Close dramatic
  { pitch: 30, yaw: 160, zoom: 1.5, label: 'close_dramatic' },
  { pitch: 35, yaw: 200, zoom: 1.3, label: 'close_behind' },
  // Dutch angle (tension)
  { pitch: 40, yaw: 120, zoom: 1.1, label: 'dutch_1' },
  { pitch: 40, yaw: 240, zoom: 1.1, label: 'dutch_2' },
];

// ============================================================================
// 30 ROOM TEMPLATES
// ============================================================================

type RoomTemplate = {
  name: string;
  /** Which camera angles work well for this room layout */
  goodAngles: string[];
  /** Number of exits */
  exits: number;
  /** Room shape */
  shape: 'square' | 'long' | 'wide' | 'L' | 'T' | 'round';
  /** Mood → shading preset */
  mood: ShadingPreset;
  /** Ambient particle */
  ambient: string | null;
  /** Generator function key */
  generator: string;
};

const ROOM_TEMPLATES: RoomTemplate[] = [
  // --- Corridor / Passage ---
  { name: 'narrow_corridor',    goodAngles: ['low_SE','low_NE','side_E'],         exits: 2, shape: 'long',   mood: 'horror',   ambient: null, generator: 'corridor' },
  { name: 'wide_hallway',       goodAngles: ['iso_SE','iso_NE','overhead_N'],     exits: 3, shape: 'long',   mood: 'daylight', ambient: null, generator: 'corridor' },
  { name: 'bridge_crossing',    goodAngles: ['low_S','side_E','dutch_1'],         exits: 2, shape: 'long',   mood: 'twilight', ambient: null, generator: 'bridge' },

  // --- Rooms ---
  { name: 'throne_room',        goodAngles: ['iso_SE','low_SE','close_dramatic'], exits: 2, shape: 'wide',   mood: 'firelit',  ambient: 'embers', generator: 'grand_room' },
  { name: 'prison_cell',        goodAngles: ['low_close_E','dutch_1','side_W'],   exits: 1, shape: 'square', mood: 'horror',   ambient: null, generator: 'small_room' },
  { name: 'library',            goodAngles: ['iso_SE','iso_NW','overhead_N'],     exits: 2, shape: 'wide',   mood: 'moonlit',  ambient: null, generator: 'grand_room' },
  { name: 'bedroom',            goodAngles: ['iso_SE','close_behind','low_NE'],   exits: 1, shape: 'square', mood: 'daylight', ambient: null, generator: 'small_room' },
  { name: 'workshop_room',      goodAngles: ['iso_SE','overhead_E','birdseye'],   exits: 2, shape: 'square', mood: 'firelit',  ambient: 'embers', generator: 'small_room' },

  // --- Open areas ---
  { name: 'courtyard',          goodAngles: ['birdseye','overhead_N','iso_SW'],   exits: 4, shape: 'square', mood: 'daylight', ambient: null, generator: 'open_area' },
  { name: 'arena',              goodAngles: ['birdseye_far','overhead_S','iso_SE'],exits: 2, shape: 'round', mood: 'twilight', ambient: null, generator: 'arena' },
  { name: 'market_square',      goodAngles: ['iso_SE','iso_NE','overhead_N'],     exits: 4, shape: 'wide',   mood: 'daylight', ambient: null, generator: 'open_area' },
  { name: 'garden',             goodAngles: ['iso_SE','birdseye','low_SE'],       exits: 3, shape: 'wide',   mood: 'daylight', ambient: 'magic_sparkle', generator: 'open_area' },

  // --- Vertical ---
  { name: 'stairwell',          goodAngles: ['low_SE','low_NE','dutch_2'],        exits: 2, shape: 'square', mood: 'horror',   ambient: null, generator: 'stairs' },
  { name: 'tower_interior',     goodAngles: ['low_S','low_close_E','dutch_1'],    exits: 2, shape: 'round',  mood: 'moonlit',  ambient: null, generator: 'tower' },
  { name: 'pit_chamber',        goodAngles: ['overhead_N','birdseye','iso_SE'],   exits: 1, shape: 'round',  mood: 'horror',   ambient: 'shadow_wisps', generator: 'pit' },

  // --- Natural ---
  { name: 'cave_entrance',      goodAngles: ['low_SE','side_E','iso_SE'],         exits: 2, shape: 'wide',   mood: 'twilight', ambient: null, generator: 'cave' },
  { name: 'underground_lake',   goodAngles: ['iso_SE','low_S','close_dramatic'],  exits: 1, shape: 'wide',   mood: 'moonlit',  ambient: 'ice_crystals', generator: 'water_room' },
  { name: 'forest_clearing',    goodAngles: ['birdseye','iso_SE','overhead_E'],   exits: 3, shape: 'round',  mood: 'daylight', ambient: null, generator: 'open_area' },
  { name: 'cliff_edge',         goodAngles: ['low_SE','side_E','dutch_1'],        exits: 1, shape: 'long',   mood: 'twilight', ambient: null, generator: 'cliff' },

  // --- Special ---
  { name: 'treasure_vault',     goodAngles: ['close_dramatic','iso_SE','low_SE'], exits: 1, shape: 'square', mood: 'firelit',  ambient: 'embers', generator: 'small_room' },
  { name: 'altar_room',         goodAngles: ['iso_SE','low_S','close_dramatic'],  exits: 1, shape: 'round',  mood: 'neon',     ambient: 'magic_sparkle', generator: 'altar' },
  { name: 'trap_corridor',      goodAngles: ['side_E','low_SE','dutch_2'],        exits: 2, shape: 'long',   mood: 'horror',   ambient: null, generator: 'corridor' },
  { name: 'boss_chamber',       goodAngles: ['birdseye_far','iso_SE','low_S'],    exits: 1, shape: 'wide',   mood: 'horror',   ambient: 'embers', generator: 'grand_room' },

  // --- Transition ---
  { name: 'intersection',       goodAngles: ['birdseye','overhead_N','iso_SE'],   exits: 4, shape: 'T',      mood: 'daylight', ambient: null, generator: 'intersection' },
  { name: 'corner_turn',        goodAngles: ['overhead_E','iso_NE','birdseye'],   exits: 2, shape: 'L',      mood: 'daylight', ambient: null, generator: 'corner' },
  { name: 'dead_end',           goodAngles: ['low_close_E','dutch_1','side_W'],   exits: 1, shape: 'square', mood: 'horror',   ambient: 'shadow_wisps', generator: 'dead_end' },
  { name: 'balcony',            goodAngles: ['low_SE','side_E','close_dramatic'], exits: 1, shape: 'wide',   mood: 'moonlit',  ambient: null, generator: 'balcony' },

  // --- Race-themed ---
  { name: 'ritual_chamber',     goodAngles: ['iso_SE','low_S','birdseye'],        exits: 2, shape: 'round',  mood: 'neon',     ambient: 'holy_motes', generator: 'altar' },
  { name: 'forge_room',         goodAngles: ['iso_SE','low_SE','close_dramatic'], exits: 2, shape: 'square', mood: 'firelit',  ambient: 'embers', generator: 'small_room' },
  { name: 'observation_deck',   goodAngles: ['low_SE','side_E','dutch_2'],        exits: 1, shape: 'wide',   mood: 'moonlit',  ambient: null, generator: 'balcony' },
];

// ============================================================================
// ROOM GEOMETRY GENERATORS
// ============================================================================

interface GeneratorContext {
  rand: () => number;
  palette: typeof BIOME_PALETTES['village'];
  camera: RoomCamera;
  width: number;
  height: number;
}

function projectX(x: number, z: number, ctx: GeneratorContext): number {
  const yawRad = (ctx.camera.yaw * Math.PI) / 180;
  const pitchFactor = Math.cos((ctx.camera.pitch * Math.PI) / 180);
  return (x * Math.cos(yawRad) - z * Math.sin(yawRad)) * ctx.camera.zoom * pitchFactor + ctx.width / 2;
}

function projectY(y: number, z: number, ctx: GeneratorContext): number {
  const yawRad = (ctx.camera.yaw * Math.PI) / 180;
  const pitchRad = (ctx.camera.pitch * Math.PI) / 180;
  const zProjected = z * Math.cos(yawRad) + y * Math.sin(yawRad);
  return (y * Math.cos(pitchRad) + zProjected * Math.sin(pitchRad)) * ctx.camera.zoom + ctx.height / 2;
}

function applyLighting(baseColor: string, normalAngle: number, mood: ShadingPreset): string {
  const r = parseInt(baseColor.slice(1,3),16);
  const g = parseInt(baseColor.slice(3,5),16);
  const b = parseInt(baseColor.slice(5,7),16);

  const lightAngles: Record<ShadingPreset, number> = {
    horror: Math.PI, daylight: -Math.PI/4, twilight: -Math.PI/2,
    neon: 0, moonlit: -Math.PI/3, firelit: Math.PI, custom: -Math.PI/4
  };

  const lightAngle = lightAngles[mood] || 0;
  const diffuse = Math.max(0.2, Math.cos(normalAngle - lightAngle) * 0.5 + 0.5);
  const shadows: Record<ShadingPreset, number> = {
    horror: 0.7, daylight: 0.3, twilight: 0.5,
    neon: 0.6, moonlit: 0.6, firelit: 0.6, custom: 0.4
  };
  const shadowMul = 1 - (1 - diffuse) * (shadows[mood] || 0.4);

  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r*shadowMul).toString(16).padStart(2,'0')}${clamp(g*shadowMul).toString(16).padStart(2,'0')}${clamp(b*shadowMul).toString(16).padStart(2,'0')}`;
}

function pickColor(colors: string[], rand: () => number): string {
  return colors[Math.floor(rand() * colors.length)];
}

/** Create element with baseColor stored for re-shading */
function el(
  type: LayerElement['type'],
  props: Record<string, string | number>,
  baseColor: string,
  normalAngle: number,
  mood: ShadingPreset,
): LayerElement {
  return { type, props, baseColor, normalAngle, litColor: applyLighting(baseColor, normalAngle, mood) };
}

// ============================================================================
// PERSPECTIVE FLOOR — tiles warp based on camera pitch
// ============================================================================

function generateFloor(ctx: GeneratorContext, mood: ShadingPreset): EnvironmentLayer {
  const elements: LayerElement[] = [];
  const tileSize = 40 + ctx.rand() * 20;
  const tilesX = Math.ceil(ctx.width / tileSize) + 2;
  const tilesY = Math.ceil(ctx.height / tileSize) + 2;

  const pitchRad = (ctx.camera.pitch * Math.PI) / 180;
  const perspectiveStrength = Math.cos(pitchRad); // 1.0 at top-down, 0 at side

  for (let tx = -1; tx < tilesX; tx++) {
    for (let ty = -1; ty < tilesY; ty++) {
      const color = pickColor(ctx.palette.floor, ctx.rand);

      // Perspective: tiles farther from camera are narrower (trapezoid)
      const yProgress = (ty + 1) / (tilesY + 1); // 0=top, 1=bottom
      const perspectiveScale = 1.0 - (1.0 - yProgress) * perspectiveStrength * 0.4;
      const xOffset = (1.0 - perspectiveScale) * ctx.width * 0.5;

      const tileW = (tileSize - 1) * perspectiveScale;
      const tileH = (tileSize - 1) * (0.6 + perspectiveStrength * 0.4); // compress Y at low angles
      const tileX = xOffset + tx * tileSize * perspectiveScale + ctx.rand() * 2;
      const tileY = ctx.height * 0.3 + ty * tileH + ctx.rand() * 2;

      // Checkerboard variation
      const darken = (tx + ty) % 2 === 0 ? 0 : 0.08;
      const normal = Math.PI / 2 + ctx.rand() * 0.1; // floor faces up

      const e = el('rect', {
        x: tileX, y: tileY, width: tileW, height: tileH, opacity: 0.85 - darken,
      }, color, normal, mood);
      elements.push(e);

      // Tile grout lines (dark thin lines between tiles)
      if (ctx.rand() > 0.3) {
        elements.push(el('rect', {
          x: tileX + tileW, y: tileY, width: 1, height: tileH, opacity: 0.3,
        }, '#000000', normal, mood));
      }
    }
  }
  return { z: 2, elements, parallax: 1.0 };
}

// ============================================================================
// WALLS with arches, columns, windows
// ============================================================================

function generateWalls(ctx: GeneratorContext, shape: string, mood: ShadingPreset): EnvironmentLayer {
  const elements: LayerElement[] = [];
  const wallH = 80 + ctx.rand() * 40;
  const w = ctx.width, h = ctx.height;

  // Back wall — main surface
  elements.push(el('rect', { x: 0, y: 0, width: w, height: wallH }, pickColor(ctx.palette.wall, ctx.rand), -Math.PI/4, mood));

  // Back wall texture — stone blocks / panels
  const blockW = 30 + ctx.rand() * 20;
  const blockH = 15 + ctx.rand() * 10;
  for (let bx = 0; bx < w; bx += blockW) {
    for (let by = 5; by < wallH - 5; by += blockH) {
      const offset = (Math.floor(by / blockH) % 2) * blockW * 0.5; // brick offset
      elements.push(el('rect', {
        x: bx + offset, y: by, width: blockW - 2, height: blockH - 2, opacity: 0.15 + ctx.rand() * 0.1, rx: 1,
      }, pickColor(ctx.palette.wall, ctx.rand), -Math.PI/4 + ctx.rand() * 0.2, mood));
    }
  }

  // Arched doorways on back wall
  const archCount = shape === 'wide' ? 2 : shape === 'long' ? 1 : ctx.rand() > 0.5 ? 1 : 0;
  for (let i = 0; i < archCount; i++) {
    const ax = w * (0.3 + i * 0.4) + ctx.rand() * 20;
    const aw = 35 + ctx.rand() * 15;
    const ah = wallH * 0.7;
    // Arch shape: rectangle with semicircle top
    elements.push(el('rect', {
      x: ax - aw/2, y: wallH - ah, width: aw, height: ah, opacity: 0.9,
    }, '#0A0A0A', -Math.PI/4, mood)); // dark opening

    // Arch curve (semicircle on top)
    const archRadius = aw / 2;
    elements.push(el('path', {
      d: `M ${ax - aw/2} ${wallH - ah} A ${archRadius} ${archRadius} 0 0 1 ${ax + aw/2} ${wallH - ah}`,
      strokeWidth: 4, fill: 'none',
    }, pickColor(ctx.palette.accent, ctx.rand), -Math.PI/3, mood));

    // Keystone
    elements.push(el('rect', {
      x: ax - 4, y: wallH - ah - archRadius - 2, width: 8, height: 8, rx: 1,
    }, pickColor(ctx.palette.accent, ctx.rand), -Math.PI/3, mood));
  }

  // Windows (on back wall, above arches)
  if (mood === 'daylight' || mood === 'moonlit' || mood === 'twilight') {
    const windowCount = 1 + Math.floor(ctx.rand() * 3);
    for (let i = 0; i < windowCount; i++) {
      const wx = w * 0.15 + (w * 0.7) * ctx.rand();
      const ww = 20 + ctx.rand() * 12;
      const wh = 25 + ctx.rand() * 15;
      const wy = 10 + ctx.rand() * (wallH * 0.3);

      // Window frame
      elements.push(el('rect', {
        x: wx, y: wy, width: ww, height: wh, rx: 2,
      }, '#1A2A4A', 0, mood)); // dark glass

      // Window glow
      const glowColor = mood === 'moonlit' ? '#6688AA' : mood === 'twilight' ? '#FF8844' : '#FFFFCC';
      elements.push(el('rect', {
        x: wx + 2, y: wy + 2, width: ww - 4, height: wh - 4, opacity: 0.4, rx: 1,
      }, glowColor, 0, mood));

      // Cross bars
      elements.push(el('rect', { x: wx + ww/2 - 1, y: wy, width: 2, height: wh }, pickColor(ctx.palette.wall, ctx.rand), 0, mood));
      elements.push(el('rect', { x: wx, y: wy + wh/2 - 1, width: ww, height: 2 }, pickColor(ctx.palette.wall, ctx.rand), 0, mood));
    }
  }

  // Side walls (perspective depth)
  if (shape !== 'long') {
    // Left wall with depth shading
    elements.push(el('polygon', {
      points: `0,0 0,${h} ${wallH*0.3},${h-wallH*0.4} ${wallH*0.3},${wallH}`,
    }, pickColor(ctx.palette.wall, ctx.rand), -Math.PI/2, mood));

    // Right wall
    elements.push(el('polygon', {
      points: `${w},0 ${w},${h} ${w-wallH*0.3},${h-wallH*0.4} ${w-wallH*0.3},${wallH}`,
    }, pickColor(ctx.palette.wall, ctx.rand), Math.PI/2, mood));
  }

  // Columns/pillars with detail
  if (shape === 'wide' || shape === 'round') {
    const pillarCount = 2 + Math.floor(ctx.rand() * 3);
    for (let i = 0; i < pillarCount; i++) {
      const px = w * 0.15 + (w * 0.7) * (i / Math.max(1, pillarCount - 1));
      const pw = 14 + ctx.rand() * 8;
      const pillarTop = wallH * 0.2;

      // Column shaft
      elements.push(el('rect', {
        x: px - pw/2, y: pillarTop, width: pw, height: h - pillarTop - 10,
      }, pickColor(ctx.palette.wall, ctx.rand), 0, mood));

      // Column capital (wider top)
      elements.push(el('rect', {
        x: px - pw/2 - 4, y: pillarTop - 8, width: pw + 8, height: 10, rx: 2,
      }, pickColor(ctx.palette.accent, ctx.rand), -Math.PI/4, mood));

      // Column base (wider bottom)
      elements.push(el('rect', {
        x: px - pw/2 - 3, y: h - 12, width: pw + 6, height: 8, rx: 1,
      }, pickColor(ctx.palette.wall, ctx.rand), Math.PI/4, mood));

      // Fluting lines on column
      for (let f = 0; f < 3; f++) {
        const fx = px - pw/4 + f * pw/3;
        elements.push(el('rect', {
          x: fx, y: pillarTop + 5, width: 1, height: h - pillarTop - 25, opacity: 0.15,
        }, '#000000', 0, mood));
      }
    }
  }

  return { z: 1, elements, parallax: 0.8 };
}

// ============================================================================
// PER-TEMPLATE OBJECT GENERATORS
// ============================================================================

const TEMPLATE_OBJECTS: Record<string, (ctx: GeneratorContext, mood: ShadingPreset) => LayerElement[]> = {

  // THRONE ROOM — throne, carpet, banners
  grand_room: (ctx, mood) => {
    const els: LayerElement[] = [];
    const cx = ctx.width / 2;

    // Red carpet runner
    els.push(el('rect', { x: cx - 25, y: ctx.height * 0.3, width: 50, height: ctx.height * 0.65, rx: 3 }, '#8B0000', Math.PI/2, mood));
    els.push(el('rect', { x: cx - 22, y: ctx.height * 0.32, width: 44, height: ctx.height * 0.6, rx: 2, opacity: 0.3 }, '#FFD700', Math.PI/2, mood));

    // Throne / main furniture
    const throneW = 40 + ctx.rand() * 15;
    const throneH = 50 + ctx.rand() * 20;
    const ty = ctx.height * 0.32;
    // Seat
    els.push(el('rect', { x: cx - throneW/2, y: ty, width: throneW, height: throneH * 0.5, rx: 3 }, pickColor(ctx.palette.accent, ctx.rand), -Math.PI/4, mood));
    // Back (tall)
    els.push(el('rect', { x: cx - throneW/2 + 5, y: ty - throneH * 0.6, width: throneW - 10, height: throneH * 0.6, rx: 2 }, pickColor(ctx.palette.accent, ctx.rand), -Math.PI/3, mood));
    // Armrests
    els.push(el('rect', { x: cx - throneW/2 - 5, y: ty, width: 8, height: throneH * 0.3, rx: 2 }, pickColor(ctx.palette.wall, ctx.rand), -Math.PI/2, mood));
    els.push(el('rect', { x: cx + throneW/2 - 3, y: ty, width: 8, height: throneH * 0.3, rx: 2 }, pickColor(ctx.palette.wall, ctx.rand), Math.PI/2, mood));

    // Wall banners
    for (const side of [-1, 1]) {
      const bx = cx + side * ctx.width * 0.3;
      els.push(el('rect', { x: bx - 10, y: 15, width: 20, height: 55, rx: 1 }, pickColor(ctx.palette.accent, ctx.rand), 0, mood));
      // Banner point
      els.push(el('polygon', { points: `${bx-10},70 ${bx+10},70 ${bx},82` }, pickColor(ctx.palette.accent, ctx.rand), 0, mood));
    }

    return els;
  },

  // SMALL ROOM — table, chair, shelf, chest
  small_room: (ctx, mood) => {
    const els: LayerElement[] = [];

    // Table
    const tx = ctx.width * 0.3 + ctx.rand() * ctx.width * 0.2;
    const ty = ctx.height * 0.5 + ctx.rand() * ctx.height * 0.1;
    els.push(el('rect', { x: tx, y: ty, width: 50 + ctx.rand() * 20, height: 30 + ctx.rand() * 10, rx: 2 }, pickColor(ctx.palette.wall, ctx.rand), -Math.PI/6, mood));
    // Table legs
    els.push(el('rect', { x: tx + 3, y: ty + 25, width: 4, height: 15 }, pickColor(ctx.palette.floor, ctx.rand), Math.PI/2, mood));
    els.push(el('rect', { x: tx + 50, y: ty + 25, width: 4, height: 15 }, pickColor(ctx.palette.floor, ctx.rand), Math.PI/2, mood));

    // Chair
    els.push(el('rect', { x: tx - 20, y: ty + 5, width: 16, height: 16, rx: 1 }, pickColor(ctx.palette.wall, ctx.rand), 0, mood));
    els.push(el('rect', { x: tx - 19, y: ty - 15, width: 14, height: 20, rx: 1, opacity: 0.8 }, pickColor(ctx.palette.wall, ctx.rand), -Math.PI/4, mood));

    // Shelf on wall
    const sx = ctx.width * 0.65 + ctx.rand() * ctx.width * 0.15;
    els.push(el('rect', { x: sx, y: 40, width: 45, height: 6 }, pickColor(ctx.palette.wall, ctx.rand), 0, mood));
    els.push(el('rect', { x: sx, y: 60, width: 45, height: 6 }, pickColor(ctx.palette.wall, ctx.rand), 0, mood));
    // Books on shelf
    for (let b = 0; b < 4; b++) {
      els.push(el('rect', { x: sx + 3 + b * 10, y: 28, width: 7, height: 12, rx: 1 }, pickColor(ctx.palette.accent, ctx.rand), -Math.PI/4, mood));
    }

    // Chest
    if (ctx.rand() > 0.4) {
      const chx = ctx.width * 0.1 + ctx.rand() * 30;
      const chy = ctx.height * 0.7;
      els.push(el('rect', { x: chx, y: chy, width: 28, height: 18, rx: 2 }, pickColor(ctx.palette.accent, ctx.rand), Math.PI/4, mood));
      // Chest lid (slightly open)
      els.push(el('rect', { x: chx - 1, y: chy - 3, width: 30, height: 5, rx: 2 }, pickColor(ctx.palette.wall, ctx.rand), -Math.PI/4, mood));
      // Lock
      els.push(el('circle', { cx: chx + 14, cy: chy + 9, r: 3 }, '#FFD700', 0, mood));
    }

    return els;
  },

  // CORRIDOR — torches, debris, cracks
  corridor: (ctx, mood) => {
    const els: LayerElement[] = [];

    // Wall torches
    const torchCount = 2 + Math.floor(ctx.rand() * 3);
    for (let i = 0; i < torchCount; i++) {
      const tx = ctx.width * 0.15 + (ctx.width * 0.7) * (i / Math.max(1, torchCount - 1));
      const side = i % 2 === 0 ? 1 : -1;
      // Bracket
      els.push(el('rect', { x: tx - 2, y: 50 + ctx.rand() * 15, width: 4, height: 12 }, '#555', 0, mood));
      // Flame glow
      els.push(el('circle', { cx: tx, cy: 45, r: 8, opacity: 0.3 }, '#FF8800', 0, mood));
      els.push(el('circle', { cx: tx, cy: 44, r: 4, opacity: 0.5 }, '#FFCC00', 0, mood));
    }

    // Floor cracks
    for (let c = 0; c < 3; c++) {
      const cx = ctx.rand() * ctx.width;
      const cy = ctx.height * 0.5 + ctx.rand() * ctx.height * 0.3;
      els.push(el('path', {
        d: `M ${cx} ${cy} l ${10 + ctx.rand()*15} ${5 + ctx.rand()*8} l ${-5 + ctx.rand()*10} ${3 + ctx.rand()*6}`,
        strokeWidth: 1, fill: 'none', opacity: 0.3,
      }, '#000000', Math.PI/2, mood));
    }

    // Debris
    for (let d = 0; d < 2 + Math.floor(ctx.rand() * 3); d++) {
      els.push(el('circle', {
        cx: ctx.rand() * ctx.width, cy: ctx.height * 0.6 + ctx.rand() * ctx.height * 0.3, r: 2 + ctx.rand() * 4, opacity: 0.5,
      }, pickColor(ctx.palette.floor, ctx.rand), Math.PI/2, mood));
    }

    return els;
  },

  // ALTAR — central altar, candles, magic circle
  altar: (ctx, mood) => {
    const els: LayerElement[] = [];
    const cx = ctx.width / 2;
    const cy = ctx.height * 0.55;

    // Magic circle on floor
    els.push(el('circle', { cx, cy, r: 50, opacity: 0.2, strokeWidth: 2 }, pickColor(ctx.palette.accent, ctx.rand), Math.PI/2, mood));
    els.push(el('circle', { cx, cy, r: 40, opacity: 0.15, strokeWidth: 1 }, pickColor(ctx.palette.accent, ctx.rand), Math.PI/2, mood));
    // Inner star
    const starPts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI * 2) / 10 - Math.PI / 2;
      const r = i % 2 === 0 ? 35 : 15;
      starPts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r * 0.6}`);
    }
    els.push(el('polygon', { points: starPts.join(' '), opacity: 0.2 }, pickColor(ctx.palette.accent, ctx.rand), Math.PI/2, mood));

    // Central altar block
    els.push(el('rect', { x: cx - 18, y: cy - 12, width: 36, height: 24, rx: 3 }, pickColor(ctx.palette.wall, ctx.rand), -Math.PI/4, mood));
    // Offering on altar
    els.push(el('circle', { cx, cy: cy - 4, r: 6, opacity: 0.8 }, pickColor(ctx.palette.accent, ctx.rand), -Math.PI/3, mood));

    // Candles around circle
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI * 2) / 6;
      const candleX = cx + Math.cos(a) * 48;
      const candleY = cy + Math.sin(a) * 30;
      els.push(el('rect', { x: candleX - 2, y: candleY - 8, width: 4, height: 8, rx: 1 }, '#FFFFF0', 0, mood));
      els.push(el('circle', { cx: candleX, cy: candleY - 10, r: 3, opacity: 0.5 }, '#FFAA00', 0, mood));
    }

    return els;
  },

  // Fallback for templates not yet detailed
  arena: (ctx, mood) => TEMPLATE_OBJECTS.grand_room(ctx, mood),
  bridge: (ctx, mood) => TEMPLATE_OBJECTS.corridor(ctx, mood),
  open_area: (ctx, mood) => {
    const els: LayerElement[] = [];
    // Trees / rocks / bushes scattered
    for (let i = 0; i < 4 + Math.floor(ctx.rand() * 5); i++) {
      const ox = ctx.rand() * ctx.width;
      const oy = ctx.height * 0.35 + ctx.rand() * ctx.height * 0.5;
      if (ctx.rand() > 0.5) {
        // Tree trunk + canopy
        els.push(el('rect', { x: ox - 4, y: oy, width: 8, height: 25 }, '#5A3A1A', Math.PI/2, mood));
        els.push(el('circle', { cx: ox, cy: oy - 10, r: 16 + ctx.rand() * 8 }, pickColor(ctx.palette.accent, ctx.rand), -Math.PI/4, mood));
      } else {
        // Rock
        els.push(el('circle', { cx: ox, cy: oy, r: 8 + ctx.rand() * 10, opacity: 0.8 }, pickColor(ctx.palette.floor, ctx.rand), ctx.rand() * Math.PI, mood));
      }
    }
    return els;
  },
  stairs: (ctx, mood) => {
    const els: LayerElement[] = [];
    const stepCount = 6 + Math.floor(ctx.rand() * 4);
    const stepW = ctx.width * 0.5;
    const stepH = 12;
    const startX = ctx.width * 0.25;
    for (let i = 0; i < stepCount; i++) {
      const sy = ctx.height * 0.3 + i * stepH;
      const shrink = i * 3; // perspective narrowing
      els.push(el('rect', {
        x: startX + shrink, y: sy, width: stepW - shrink * 2, height: stepH - 1, rx: 1,
      }, pickColor(ctx.palette.wall, ctx.rand), -Math.PI/4 + i * 0.05, mood));
    }
    return els;
  },
  tower: (ctx, mood) => TEMPLATE_OBJECTS.stairs(ctx, mood),
  pit: (ctx, mood) => {
    const els: LayerElement[] = [];
    const cx = ctx.width / 2, cy = ctx.height * 0.6;
    // Dark pit
    els.push(el('circle', { cx, cy, r: 40, opacity: 0.9 }, '#050505', Math.PI/2, mood));
    els.push(el('circle', { cx, cy, r: 35, opacity: 0.5 }, '#0A0A0A', Math.PI/2, mood));
    // Crumbling edge
    for (let i = 0; i < 8; i++) {
      const a = ctx.rand() * Math.PI * 2;
      els.push(el('circle', { cx: cx + Math.cos(a) * 42, cy: cy + Math.sin(a) * 25, r: 3 + ctx.rand() * 4 }, pickColor(ctx.palette.floor, ctx.rand), Math.PI/2, mood));
    }
    return els;
  },
  cave: (ctx, mood) => TEMPLATE_OBJECTS.corridor(ctx, mood),
  water_room: (ctx, mood) => {
    const els: LayerElement[] = [];
    // Water surface
    els.push(el('rect', { x: 20, y: ctx.height * 0.5, width: ctx.width - 40, height: ctx.height * 0.4, rx: 5, opacity: 0.5 }, '#1A4A6A', Math.PI/2, mood));
    // Ripples
    for (let r = 0; r < 4; r++) {
      const rx = 50 + ctx.rand() * (ctx.width - 100);
      const ry = ctx.height * 0.55 + ctx.rand() * ctx.height * 0.25;
      els.push(el('circle', { cx: rx, cy: ry, r: 10 + ctx.rand() * 15, opacity: 0.1, strokeWidth: 1 }, '#88CCFF', Math.PI/2, mood));
    }
    return els;
  },
  cliff: (ctx, mood) => TEMPLATE_OBJECTS.open_area(ctx, mood),
  intersection: (ctx, mood) => TEMPLATE_OBJECTS.corridor(ctx, mood),
  corner: (ctx, mood) => TEMPLATE_OBJECTS.corridor(ctx, mood),
  dead_end: (ctx, mood) => TEMPLATE_OBJECTS.small_room(ctx, mood),
  balcony: (ctx, mood) => {
    const els: LayerElement[] = [];
    // Railing
    els.push(el('rect', { x: 10, y: ctx.height * 0.65, width: ctx.width - 20, height: 6, rx: 2 }, pickColor(ctx.palette.wall, ctx.rand), 0, mood));
    // Railing posts
    for (let i = 0; i < 6; i++) {
      const px = 20 + i * (ctx.width - 40) / 5;
      els.push(el('rect', { x: px - 2, y: ctx.height * 0.65, width: 4, height: 20 }, pickColor(ctx.palette.wall, ctx.rand), 0, mood));
    }
    // Distant view through railing
    els.push(el('rect', { x: 0, y: ctx.height * 0.7, width: ctx.width, height: ctx.height * 0.3, opacity: 0.3 }, pickColor(ctx.palette.floor, ctx.rand), Math.PI/2, mood));
    return els;
  },
};

/** Generate foreground objects based on room template */
function generateObjects(ctx: GeneratorContext, template: string, mood: ShadingPreset): EnvironmentLayer {
  const generator = TEMPLATE_OBJECTS[template] || TEMPLATE_OBJECTS.small_room;
  const elements = generator(ctx, mood);
  return { z: 3, elements, parallax: 1.0 };
}

/** Generate sky/ceiling layer */
function generateSky(ctx: GeneratorContext, mood: ShadingPreset): EnvironmentLayer {
  return {
    z: 0,
    elements: [el('rect', { x: 0, y: 0, width: ctx.width, height: ctx.height }, ctx.palette.sky, 0, mood)],
    parallax: 0,
  };
}

/** Generate collision map based on room shape */
function generateCollision(shape: string, w: number, h: number, exits: number, rand: () => number): CollisionRect[] {
  const collision: CollisionRect[] = [];
  const margin = 30;

  // Walkable center
  collision.push({ x: margin, y: h * 0.3, width: w - margin * 2, height: h * 0.6, type: 'walkable' });

  // Walls
  collision.push({ x: 0, y: 0, width: w, height: h * 0.25, type: 'wall' });
  if (shape !== 'long') {
    collision.push({ x: 0, y: 0, width: margin, height: h, type: 'wall' });
    collision.push({ x: w - margin, y: 0, width: margin, height: h, type: 'wall' });
  }

  // Exits
  const exitPositions = [
    { x: w / 2 - 20, y: h * 0.25, width: 40, height: 10 },  // north
    { x: w / 2 - 20, y: h - 10, width: 40, height: 10 },     // south
    { x: 0, y: h / 2 - 20, width: 10, height: 40 },          // west
    { x: w - 10, y: h / 2 - 20, width: 10, height: 40 },     // east
  ];

  for (let i = 0; i < Math.min(exits, 4); i++) {
    const ep = exitPositions[i];
    collision.push({ ...ep, type: 'exit', exitTo: `room_${Math.floor(rand() * 1000)}` });
  }

  return collision;
}

// ============================================================================
// MAIN GENERATOR — one function, one room
// ============================================================================

/**
 * Generate a complete room.
 *
 * @param race        Player's race → determines biome
 * @param templateIdx Which of the 30 templates (0-29), or random if omitted
 * @param cameraIdx   Which camera angle variant, or random if omitted
 * @param seed        Deterministic seed
 */
export function generateRoom(
  race: Race,
  templateIdx?: number,
  cameraIdx?: number,
  seed?: string,
): Room {
  const actualSeed = seed || `${race}-${Date.now()}`;
  const rand = seededRandom(actualSeed);

  // Pick template
  const tIdx = templateIdx !== undefined ? templateIdx % ROOM_TEMPLATES.length : Math.floor(rand() * ROOM_TEMPLATES.length);
  const template = ROOM_TEMPLATES[tIdx];

  // Pick camera from template's good angles
  let camera: RoomCamera;
  if (cameraIdx !== undefined) {
    camera = CAMERA_PRESETS[cameraIdx % CAMERA_PRESETS.length];
  } else {
    const angleName = template.goodAngles[Math.floor(rand() * template.goodAngles.length)];
    camera = CAMERA_PRESETS.find(c => c.label === angleName) || CAMERA_PRESETS[0];
  }

  // Get biome
  const biome = RACE_BIOMES[race] || 'village';
  const palette = BIOME_PALETTES[biome] || BIOME_PALETTES.village;

  // Room dimensions
  const baseW = 400, baseH = 360;
  const width = template.shape === 'long' ? baseW * 1.5 : template.shape === 'wide' ? baseW * 1.3 : baseW;
  const height = template.shape === 'long' ? baseH * 0.7 : baseH;

  const ctx: GeneratorContext = { rand, palette, camera, width, height };

  // Generate layers
  const layers: EnvironmentLayer[] = [
    generateSky(ctx, template.mood),
    generateWalls(ctx, template.shape, template.mood),
    generateFloor(ctx, template.mood),
    generateObjects(ctx, template.generator, template.mood),
  ];

  // Generate collision
  const collision = generateCollision(template.shape, width, height, template.exits, rand);

  return {
    id: `${biome}_${template.name}_${camera.label}`,
    template: template.name,
    camera,
    biome,
    layers,
    collision,
    width,
    height,
    avatarCameraOffset: camera.yaw,
    ambientEffect: template.ambient,
    shading: template.mood,
  };
}

// ============================================================================
// DUNGEON GENERATOR — chain rooms into a connected map
// ============================================================================

export interface Dungeon {
  rooms: Room[];
  connections: Array<{ from: string; to: string; fromExit: number; toExit: number }>;
  startRoom: string;
}

/**
 * Generate a connected dungeon of N rooms.
 * Each room gets a unique camera angle — walking through feels cinematic.
 */
export function generateDungeon(
  race: Race,
  roomCount: number = 8,
  seed?: string,
): Dungeon {
  const actualSeed = seed || `dungeon-${race}-${Date.now()}`;
  const rand = seededRandom(actualSeed);
  const rooms: Room[] = [];
  const connections: Dungeon['connections'] = [];
  const usedAngles = new Set<string>();

  for (let i = 0; i < roomCount; i++) {
    // Pick template — avoid repeats if possible
    const tIdx = Math.floor(rand() * ROOM_TEMPLATES.length);

    // Pick camera — avoid reusing angles for variety
    let camera: RoomCamera | undefined;
    const template = ROOM_TEMPLATES[tIdx];
    for (const angleName of template.goodAngles) {
      if (!usedAngles.has(angleName)) {
        camera = CAMERA_PRESETS.find(c => c.label === angleName);
        if (camera) { usedAngles.add(angleName); break; }
      }
    }
    if (!camera) {
      // All good angles used — pick random
      const cIdx = Math.floor(rand() * CAMERA_PRESETS.length);
      camera = CAMERA_PRESETS[cIdx];
    }

    const room = generateRoom(race, tIdx, CAMERA_PRESETS.indexOf(camera), `${actualSeed}-room-${i}`);
    rooms.push(room);

    // Connect to previous room
    if (i > 0) {
      connections.push({
        from: rooms[i - 1].id,
        to: room.id,
        fromExit: Math.min(1, rooms[i-1].collision.filter(c => c.type === 'exit').length - 1),
        toExit: 0,
      });

      // Update exit targets
      const prevExits = rooms[i-1].collision.filter(c => c.type === 'exit');
      if (prevExits.length > 0) prevExits[prevExits.length - 1].exitTo = room.id;
      const curExits = room.collision.filter(c => c.type === 'exit');
      if (curExits.length > 0) curExits[0].exitTo = rooms[i-1].id;
    }
  }

  return { rooms, connections, startRoom: rooms[0].id };
}

/**
 * Get the avatar render angle for a given room.
 * Avatar sprite sheet angle = room camera yaw + player facing direction.
 */
export function getAvatarAngleForRoom(room: Room, playerFacingDeg: number): number {
  return (room.avatarCameraOffset + playerFacingDeg) % 360;
}

// ============================================================================
// ROOM RE-PROJECTION — one room, any angle
// ============================================================================

/**
 * Re-project an existing room at a different camera angle.
 * Room geometry (walls, floor, objects, collision) stays the same.
 * Only the visual projection + lighting changes.
 * 
 * Dev creates one room → gets 60 different views.
 */
export function renderRoomAtAngle(room: Room, angleDeg: number): Room {
  const yaw = ((angleDeg % 360) + 360) % 360;

  const newCamera: RoomCamera = {
    pitch: room.camera.pitch,
    yaw,
    zoom: room.camera.zoom,
    label: `custom_${angleDeg}`,
  };

  // Re-light all layers using stored baseColor — no guessing
  const newLayers = room.layers.map(layer => ({
    ...layer,
    elements: layer.elements.map(item => ({
      ...item,
      litColor: applyLighting(item.baseColor, item.normalAngle + (yaw * Math.PI) / 180, room.shading),
    })),
  }));

  return {
    ...room,
    id: `${room.id}_angle${angleDeg}`,
    camera: newCamera,
    layers: newLayers,
    avatarCameraOffset: yaw,
  };
}

/**
 * Pre-render a room at 30 angles (every 12°).
 * 30 angles = half the renders, same visual quality on phone screens.
 * Avatar keeps 60 angles (cached separately) — snaps to nearest room angle.
 */
export const ROOM_ANGLES = 30;
export const ROOM_ANGLE_STEP = 12;

export function preRenderAllAngles(room: Room, angleStep: number = ROOM_ANGLE_STEP): Room[] {
  const views: Room[] = [];
  for (let angle = 0; angle < 360; angle += angleStep) {
    views.push(renderRoomAtAngle(room, angle));
  }
  return views;
}

/**
 * Get the best camera angle for a room template.
 * Returns the template's recommended angles sorted by dramatic impact.
 */
export function getRecommendedAngles(templateIdx: number): RoomCamera[] {
  const template = ROOM_TEMPLATES[templateIdx % ROOM_TEMPLATES.length];
  return template.goodAngles
    .map(name => CAMERA_PRESETS.find(c => c.label === name))
    .filter((c): c is RoomCamera => c !== undefined);
}

/**
 * Generate a room with all 30 angle variants in one call.
 * Returns the base room + 30 projected views.
 * 30 angles × 12° = full rotation. 1.5-2 sec render on phone.
 */
export function generateRoomWithViews(
  race: Race,
  templateIdx?: number,
  seed?: string,
): { base: Room; views: Room[] } {
  const base = generateRoom(race, templateIdx, undefined, seed);
  const views = preRenderAllAngles(base);
  return { base, views };
}
