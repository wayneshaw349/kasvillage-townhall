// ============================================================================
// KasVillage PS1 Style Engine — Procedural Environment Generation
// Feed it parameters, get any PS1-era visual style.
// Not fixed presets — a generator that produces infinite variety.
//
// Covers: Vagrant Story, Crash, Tomb Raider, MGS, Resident Evil,
//         Street Fighter EX, Gran Turismo, GoldenEye, and anything else
//         from that era. Same primitives: flat polygons, tiled textures,
//         perspective floors, strong silhouettes.
// ============================================================================

// ============================================================================
// STYLE PARAMETERS — the DNA of a PS1 environment
// ============================================================================

export interface PS1StyleParams {
  // ── Flooring ──
  floor: {
    type: FloorType;
    colors: string[];           // 2-4 color variants
    tileSize: number;           // tile grid size (8-32)
    gapColor: string;           // grout/gap between tiles
    gapWidth: number;           // 0 = no gaps, 0.5-2
    jitter: number;             // 0-1 per-tile color randomness
    reflective: boolean;        // floor reflection (temple, mansion)
    perspective: boolean;       // perspective-project the tiles
  };

  // ── Walls ──
  walls: {
    type: WallType;
    colors: string[];
    tileSize: number;
    detail: WallDetail[];       // decorative elements on walls
    thickness: number;          // visual wall thickness (depth cue)
    height: number;             // wall height ratio (0.3-0.8 of screen)
  };

  // ── Ceiling ──
  ceiling: {
    visible: boolean;           // outdoor = no ceiling
    color: string;
    type: 'flat' | 'beam' | 'vaulted' | 'open_sky';
    beamColor?: string;
  };

  // ── Lighting ──
  lighting: {
    type: LightingType;
    primary: { color: string; intensity: number; direction: number; elevation: number };
    ambient: { color: string; intensity: number };
    sources: LightSource[];     // point lights (torches, fluorescent, candles)
    fog: { color: string; density: number; startDistance: number };
    shadowStrength: number;     // 0-1
  };

  // ── Objects ──
  objects: PS1Object[];

  // ── Camera ──
  camera: {
    defaultAngle: number;       // which of 30 angles is "home"
    fov: number;                // field of view feeling (narrow=corridor, wide=arena)
    heightOffset: number;       // camera height (-1 low, 0 mid, 1 high)
  };

  // ── Mood ──
  mood: {
    saturation: number;         // 0-1 (GoldenEye=low, Crash=high)
    contrast: number;           // 0-1 (MGS=medium, RE=high)
    warmth: number;             // -1 cold to 1 warm
    grainAmount: number;        // 0-1 PS1 dither/grain
  };
}

export type FloorType =
  | 'stone_tile'      // Vagrant Story, Tomb Raider
  | 'stone_rough'     // cave floors
  | 'metal_grid'      // MGS, GoldenEye
  | 'wood_plank'      // RE mansion
  | 'grass'           // Crash, Street Fighter EX
  | 'asphalt'         // Gran Turismo
  | 'sand'            // Crash beach levels
  | 'carpet'          // RE mansion halls
  | 'marble'          // temple, sky palace
  | 'dirt'            // outdoor paths
  | 'concrete'        // military base
  | 'water_shallow';  // swamp, cave pools

export type WallType =
  | 'stone_brick'     // Vagrant Story, Tomb Raider
  | 'rock_natural'    // caves
  | 'metal_panel'     // MGS, GoldenEye
  | 'wood_panel'      // RE mansion
  | 'concrete'        // military
  | 'tile_ceramic'    // GoldenEye bathroom/lab
  | 'hillside'        // Crash outdoor (terrain as wall)
  | 'fence'           // outdoor perimeter
  | 'none';           // open area

export type WallDetail =
  | 'torch_sconce'    // VS, TR, RE
  | 'light_panel'     // MGS fluorescent
  | 'window'          // RE, GoldenEye
  | 'painting'        // RE mansion
  | 'relief_carving'  // TR temple
  | 'pipe'            // MGS, industrial
  | 'vent_grate'      // MGS, GoldenEye
  | 'arch'            // VS, RE
  | 'pillar'          // VS, TR, RE
  | 'banner'          // medieval
  | 'monitor'         // MGS, sci-fi
  | 'shelf'           // GoldenEye lab
  | 'railing'         // industrial, balcony
  | 'sign'            // Gran Turismo track
  | 'bulletin_board'; // GoldenEye

export type LightingType =
  | 'sunlight'        // Crash, SFEX outdoor
  | 'torchlight'      // VS, TR, RE
  | 'fluorescent'     // MGS, GoldenEye
  | 'candlelight'     // RE mansion
  | 'moonlight'       // outdoor night
  | 'overcast'        // muted daylight
  | 'spotlight'       // arena, boss fight
  | 'emergency';      // red alert, MGS alarm

export interface LightSource {
  x: number;          // 0-1 normalized position
  y: number;
  color: string;
  radius: number;     // light falloff radius
  flicker: boolean;   // torches flicker
}

export interface PS1Object {
  type: string;
  material: string;
  colors: string[];
  width: number;      // relative size
  height: number;
  destructible: boolean;
  collidable: boolean;
  frequency: number;  // 0-1 how often this appears
}

// ============================================================================
// PRESET LIBRARY — named parameter sets for known PS1 styles
// ============================================================================

export const PS1_STYLES: Record<string, PS1StyleParams> = {

  // ── Vagrant Story — dark stone dungeon ──
  vagrant_story: {
    floor: {
      type: 'stone_tile', colors: ['#2A2520', '#22201A', '#1E1B16', '#2E2924'],
      tileSize: 16, gapColor: '#151210', gapWidth: 0.5, jitter: 0.15,
      reflective: false, perspective: true,
    },
    walls: {
      type: 'stone_brick', colors: ['#2E2924', '#3A352E', '#252119'],
      tileSize: 20, detail: ['torch_sconce', 'arch', 'pillar'],
      thickness: 30, height: 0.65,
    },
    ceiling: { visible: true, color: '#0E0C09', type: 'vaulted' },
    lighting: {
      type: 'torchlight',
      primary: { color: '#C8841A', intensity: 0.9, direction: 180, elevation: 25 },
      ambient: { color: '#0A0806', intensity: 0.08 },
      sources: [
        { x: 0.2, y: 0.3, color: '#C8841A', radius: 0.35, flicker: true },
        { x: 0.8, y: 0.3, color: '#C8841A', radius: 0.3, flicker: true },
      ],
      fog: { color: '#0A0907', density: 0.4, startDistance: 0.5 },
      shadowStrength: 0.85,
    },
    objects: [
      { type: 'pillar', material: 'stone', colors: ['#2E2924', '#3A352E'], width: 24, height: 270, destructible: false, collidable: true, frequency: 0.3 },
      { type: 'crate', material: 'wood', colors: ['#5A4A30', '#6A5A40'], width: 20, height: 20, destructible: true, collidable: true, frequency: 0.15 },
      { type: 'chest', material: 'metal', colors: ['#4A3A2A', '#6B4410'], width: 18, height: 14, destructible: false, collidable: true, frequency: 0.08 },
    ],
    camera: { defaultAngle: 132, fov: 0.7, heightOffset: 0.2 },
    mood: { saturation: 0.3, contrast: 0.75, warmth: 0.4, grainAmount: 0.15 },
  },

  // ── Crash Bandicoot — bright outdoor ──
  crash_bandicoot: {
    floor: {
      type: 'sand', colors: ['#C4A060', '#D4B070', '#B49050', '#CCAA68'],
      tileSize: 12, gapColor: '#A08848', gapWidth: 0, jitter: 0.3,
      reflective: false, perspective: true,
    },
    walls: {
      type: 'hillside', colors: ['#6B8A3A', '#7A9A4A', '#5A7A2A', '#88AA55'],
      tileSize: 24, detail: ['fence'],
      thickness: 0, height: 0.5,
    },
    ceiling: { visible: false, color: '#88BBDD', type: 'open_sky' },
    lighting: {
      type: 'sunlight',
      primary: { color: '#FFF5D0', intensity: 1.2, direction: 300, elevation: 60 },
      ambient: { color: '#88AACC', intensity: 0.45 },
      sources: [],
      fog: { color: '#CCDDAA', density: 0.1, startDistance: 0.7 },
      shadowStrength: 0.3,
    },
    objects: [
      { type: 'crate', material: 'wood', colors: ['#8B6B3A', '#A07840', '#6A4A20'], width: 22, height: 22, destructible: true, collidable: true, frequency: 0.35 },
      { type: 'barrel', material: 'wood', colors: ['#7A5A2A', '#8B6B3A'], width: 16, height: 20, destructible: true, collidable: true, frequency: 0.2 },
      { type: 'flower_pot', material: 'clay', colors: ['#AA7744', '#CC9966', '#44AA44'], width: 10, height: 16, destructible: true, collidable: false, frequency: 0.15 },
      { type: 'bridge', material: 'wood', colors: ['#6A4A20', '#8B6B3A'], width: 60, height: 8, destructible: false, collidable: true, frequency: 0.05 },
    ],
    camera: { defaultAngle: 0, fov: 0.85, heightOffset: 0.3 },
    mood: { saturation: 0.85, contrast: 0.5, warmth: 0.6, grainAmount: 0.05 },
  },

  // ── Tomb Raider — cave ──
  tomb_raider_cave: {
    floor: {
      type: 'stone_rough', colors: ['#5A5248', '#6A6258', '#4A4238', '#5E5A50'],
      tileSize: 18, gapColor: '#3A3830', gapWidth: 0.3, jitter: 0.25,
      reflective: false, perspective: true,
    },
    walls: {
      type: 'rock_natural', colors: ['#6A6860', '#7A7870', '#5A5850', '#6E6C64'],
      tileSize: 28, detail: ['torch_sconce'],
      thickness: 40, height: 0.7,
    },
    ceiling: { visible: true, color: '#2A2820', type: 'vaulted' },
    lighting: {
      type: 'torchlight',
      primary: { color: '#AA9977', intensity: 0.65, direction: 200, elevation: 20 },
      ambient: { color: '#0E0C08', intensity: 0.08 },
      sources: [
        { x: 0.3, y: 0.4, color: '#CC9955', radius: 0.25, flicker: true },
      ],
      fog: { color: '#0E0C08', density: 0.55, startDistance: 0.35 },
      shadowStrength: 0.82,
    },
    objects: [
      { type: 'stalactite', material: 'rock', colors: ['#5A5850', '#6A6860'], width: 8, height: 40, destructible: false, collidable: false, frequency: 0.3 },
      { type: 'stalagmite', material: 'rock', colors: ['#5A5850', '#4A4838'], width: 10, height: 30, destructible: false, collidable: true, frequency: 0.25 },
      { type: 'rock_pile', material: 'stone', colors: ['#5A5248', '#6A6258'], width: 24, height: 12, destructible: true, collidable: true, frequency: 0.2 },
      { type: 'pool', material: 'water', colors: ['#2A3A4A', '#1A2A3A'], width: 40, height: 6, destructible: false, collidable: false, frequency: 0.08 },
    ],
    camera: { defaultAngle: 0, fov: 0.75, heightOffset: 0 },
    mood: { saturation: 0.2, contrast: 0.7, warmth: 0.1, grainAmount: 0.2 },
  },

  // ── Tomb Raider — temple ──
  tomb_raider_temple: {
    floor: {
      type: 'marble', colors: ['#7A7A7A', '#8A8A88', '#6A6A68', '#848482'],
      tileSize: 20, gapColor: '#555555', gapWidth: 0.5, jitter: 0.1,
      reflective: true, perspective: true,
    },
    walls: {
      type: 'stone_brick', colors: ['#8A8A85', '#9A9A92', '#7A7A78'],
      tileSize: 22, detail: ['relief_carving', 'pillar', 'torch_sconce'],
      thickness: 25, height: 0.6,
    },
    ceiling: { visible: true, color: '#882222', type: 'flat' },
    lighting: {
      type: 'torchlight',
      primary: { color: '#DDAA55', intensity: 0.85, direction: 270, elevation: 35 },
      ambient: { color: '#1A1208', intensity: 0.15 },
      sources: [
        { x: 0.15, y: 0.35, color: '#DDAA55', radius: 0.3, flicker: true },
        { x: 0.85, y: 0.35, color: '#DDAA55', radius: 0.3, flicker: true },
      ],
      fog: { color: '#1A1208', density: 0.3, startDistance: 0.5 },
      shadowStrength: 0.65,
    },
    objects: [
      { type: 'pillar', material: 'stone', colors: ['#9A9A92', '#AAAAAA'], width: 18, height: 200, destructible: false, collidable: true, frequency: 0.35 },
      { type: 'wall_panel', material: 'painted', colors: ['#CC8822', '#DDAA44', '#BB7711'], width: 40, height: 30, destructible: false, collidable: false, frequency: 0.4 },
      { type: 'border_trim', material: 'carved', colors: ['#882222', '#AA3333'], width: 200, height: 6, destructible: false, collidable: false, frequency: 0.6 },
    ],
    camera: { defaultAngle: 0, fov: 0.7, heightOffset: 0 },
    mood: { saturation: 0.45, contrast: 0.65, warmth: 0.5, grainAmount: 0.1 },
  },

  // ── Metal Gear Solid — military base ──
  metal_gear_solid: {
    floor: {
      type: 'metal_grid', colors: ['#4A5A6A', '#5A6A7A', '#3A4A5A', '#4E5E6E'],
      tileSize: 16, gapColor: '#2A3A4A', gapWidth: 0.5, jitter: 0.05,
      reflective: false, perspective: true,
    },
    walls: {
      type: 'metal_panel', colors: ['#5A6A78', '#6A7A88', '#4A5A68'],
      tileSize: 24, detail: ['pipe', 'vent_grate', 'light_panel', 'monitor'],
      thickness: 20, height: 0.6,
    },
    ceiling: { visible: true, color: '#1A2A3A', type: 'beam', beamColor: '#3A4A5A' },
    lighting: {
      type: 'fluorescent',
      primary: { color: '#CCDDEE', intensity: 0.8, direction: 0, elevation: 75 },
      ambient: { color: '#0A1520', intensity: 0.12 },
      sources: [
        { x: 0.3, y: 0.1, color: '#88CCDD', radius: 0.4, flicker: false },
        { x: 0.7, y: 0.1, color: '#88CCDD', radius: 0.4, flicker: false },
      ],
      fog: { color: '#1A2A3A', density: 0.2, startDistance: 0.6 },
      shadowStrength: 0.7,
    },
    objects: [
      { type: 'cargo_crate', material: 'metal', colors: ['#6A7A5A', '#7A8A6A', '#5A6A4A'], width: 28, height: 28, destructible: false, collidable: true, frequency: 0.3 },
      { type: 'locker', material: 'steel', colors: ['#5A6A78', '#6A7A88'], width: 14, height: 50, destructible: false, collidable: true, frequency: 0.15 },
      { type: 'barrel', material: 'metal', colors: ['#4A5A3A', '#5A6A4A'], width: 14, height: 18, destructible: true, collidable: true, frequency: 0.2 },
      { type: 'railing', material: 'steel', colors: ['#6A7A88', '#8A9AA8'], width: 60, height: 30, destructible: false, collidable: false, frequency: 0.25 },
    ],
    camera: { defaultAngle: 0, fov: 0.75, heightOffset: 0.1 },
    mood: { saturation: 0.25, contrast: 0.6, warmth: -0.5, grainAmount: 0.12 },
  },

  // ── Resident Evil — mansion ──
  resident_evil: {
    floor: {
      type: 'wood_plank', colors: ['#3A2A1A', '#4A3A28', '#2A1A0A', '#3E2E1E'],
      tileSize: 14, gapColor: '#1A0A00', gapWidth: 0.3, jitter: 0.12,
      reflective: false, perspective: true,
    },
    walls: {
      type: 'wood_panel', colors: ['#4A3A2A', '#5A4A38', '#3A2A18'],
      tileSize: 26, detail: ['painting', 'window', 'arch', 'pillar'],
      thickness: 25, height: 0.65,
    },
    ceiling: { visible: true, color: '#1A1210', type: 'beam', beamColor: '#3A2A1A' },
    lighting: {
      type: 'candlelight',
      primary: { color: '#FFCC88', intensity: 0.75, direction: 240, elevation: 30 },
      ambient: { color: '#120A08', intensity: 0.08 },
      sources: [
        { x: 0.5, y: 0.2, color: '#FFCC88', radius: 0.4, flicker: true },
        { x: 0.15, y: 0.5, color: '#FF9944', radius: 0.2, flicker: true },
        { x: 0.85, y: 0.5, color: '#FF9944', radius: 0.2, flicker: true },
      ],
      fog: { color: '#120A08', density: 0.4, startDistance: 0.4 },
      shadowStrength: 0.8,
    },
    objects: [
      { type: 'column', material: 'marble', colors: ['#AAAAAA', '#CCCCCC', '#888888'], width: 20, height: 220, destructible: false, collidable: true, frequency: 0.3 },
      { type: 'carpet_runner', material: 'fabric', colors: ['#882222', '#AA3333', '#661111'], width: 80, height: 4, destructible: false, collidable: false, frequency: 0.5 },
      { type: 'bookshelf', material: 'wood', colors: ['#3A2A1A', '#4A3A28', '#882244'], width: 30, height: 60, destructible: false, collidable: true, frequency: 0.2 },
      { type: 'chandelier', material: 'brass', colors: ['#AA8844', '#CCAA66', '#FFCC88'], width: 30, height: 20, destructible: false, collidable: false, frequency: 0.08 },
      { type: 'staircase', material: 'wood', colors: ['#3A2A1A', '#5A4A38'], width: 50, height: 80, destructible: false, collidable: true, frequency: 0.05 },
    ],
    camera: { defaultAngle: 132, fov: 0.7, heightOffset: 0.15 },
    mood: { saturation: 0.35, contrast: 0.8, warmth: 0.3, grainAmount: 0.15 },
  },

  // ── Street Fighter EX — outdoor arena ──
  street_fighter_ex: {
    floor: {
      type: 'grass', colors: ['#4A8A2A', '#5A9A3A', '#3A7A1A', '#55953A'],
      tileSize: 10, gapColor: '#3A7A1A', gapWidth: 0, jitter: 0.2,
      reflective: false, perspective: true,
    },
    walls: {
      type: 'fence', colors: ['#AAAAAA', '#CCCCCC', '#888888'],
      tileSize: 30, detail: ['sign'],
      thickness: 0, height: 0.35,
    },
    ceiling: { visible: false, color: '#4488CC', type: 'open_sky' },
    lighting: {
      type: 'sunlight',
      primary: { color: '#FFFFFF', intensity: 1.3, direction: 315, elevation: 55 },
      ambient: { color: '#88AADD', intensity: 0.5 },
      sources: [],
      fog: { color: '#AACCEE', density: 0.05, startDistance: 0.8 },
      shadowStrength: 0.35,
    },
    objects: [
      { type: 'statue', material: 'bronze', colors: ['#668877', '#77AA88', '#557766'], width: 30, height: 60, destructible: false, collidable: false, frequency: 0.05 },
      { type: 'bench', material: 'stone', colors: ['#999999', '#AAAAAA'], width: 30, height: 12, destructible: false, collidable: true, frequency: 0.1 },
      { type: 'tree', material: 'organic', colors: ['#5A4A30', '#3A8A2A', '#4A9A3A'], width: 20, height: 50, destructible: false, collidable: false, frequency: 0.15 },
    ],
    camera: { defaultAngle: 90, fov: 0.9, heightOffset: -0.1 },
    mood: { saturation: 0.8, contrast: 0.55, warmth: 0.3, grainAmount: 0.05 },
  },

  // ── Gran Turismo — race track ──
  gran_turismo: {
    floor: {
      type: 'asphalt', colors: ['#4A4A4A', '#555555', '#3A3A3A', '#484848'],
      tileSize: 20, gapColor: '#333333', gapWidth: 0, jitter: 0.08,
      reflective: false, perspective: true,
    },
    walls: {
      type: 'fence', colors: ['#CCCCCC', '#EEEEEE', '#999999'],
      tileSize: 40, detail: ['sign', 'railing'],
      thickness: 0, height: 0.25,
    },
    ceiling: { visible: false, color: '#5588AA', type: 'open_sky' },
    lighting: {
      type: 'overcast',
      primary: { color: '#DDEEFF', intensity: 0.9, direction: 0, elevation: 50 },
      ambient: { color: '#667788', intensity: 0.4 },
      sources: [],
      fog: { color: '#889AAA', density: 0.15, startDistance: 0.5 },
      shadowStrength: 0.2,
    },
    objects: [
      { type: 'barrier', material: 'metal', colors: ['#DD2222', '#FFFFFF'], width: 60, height: 8, destructible: false, collidable: true, frequency: 0.4 },
      { type: 'tire_wall', material: 'rubber', colors: ['#222222', '#333333'], width: 30, height: 10, destructible: false, collidable: true, frequency: 0.2 },
      { type: 'grandstand', material: 'concrete', colors: ['#888888', '#AAAAAA', '#666666'], width: 80, height: 40, destructible: false, collidable: false, frequency: 0.05 },
      { type: 'road_marking', material: 'paint', colors: ['#FFFFFF', '#FFCC00'], width: 40, height: 1, destructible: false, collidable: false, frequency: 0.5 },
    ],
    camera: { defaultAngle: 180, fov: 0.85, heightOffset: 0.2 },
    mood: { saturation: 0.4, contrast: 0.5, warmth: -0.2, grainAmount: 0.08 },
  },

  // ── GoldenEye — military facility ──
  goldeneye: {
    floor: {
      type: 'concrete', colors: ['#5A6A5A', '#6A7A6A', '#4A5A4A', '#5E6E5E'],
      tileSize: 18, gapColor: '#3A4A3A', gapWidth: 0.5, jitter: 0.1,
      reflective: false, perspective: true,
    },
    walls: {
      type: 'tile_ceramic', colors: ['#AAAAAA', '#BBBBBB', '#999999', '#B0B0B0'],
      tileSize: 14, detail: ['vent_grate', 'light_panel', 'bulletin_board', 'shelf'],
      thickness: 22, height: 0.6,
    },
    ceiling: { visible: true, color: '#6A7A6A', type: 'flat' },
    lighting: {
      type: 'fluorescent',
      primary: { color: '#CCDDCC', intensity: 0.75, direction: 0, elevation: 80 },
      ambient: { color: '#1A2A1A', intensity: 0.15 },
      sources: [
        { x: 0.25, y: 0.1, color: '#AACCAA', radius: 0.35, flicker: false },
        { x: 0.75, y: 0.1, color: '#AACCAA', radius: 0.35, flicker: false },
      ],
      fog: { color: '#3A4A3A', density: 0.25, startDistance: 0.5 },
      shadowStrength: 0.55,
    },
    objects: [
      { type: 'crate', material: 'wood', colors: ['#8A7A5A', '#9A8A6A', '#7A6A4A'], width: 24, height: 24, destructible: true, collidable: true, frequency: 0.25 },
      { type: 'desk', material: 'metal', colors: ['#7A7A7A', '#8A8A8A'], width: 30, height: 22, destructible: false, collidable: true, frequency: 0.1 },
      { type: 'partition', material: 'concrete', colors: ['#AAAAAA', '#BBBBBB'], width: 16, height: 40, destructible: false, collidable: true, frequency: 0.2 },
      { type: 'door', material: 'metal', colors: ['#4A6A4A', '#5A7A5A', '#3A5A3A'], width: 22, height: 50, destructible: false, collidable: true, frequency: 0.08 },
    ],
    camera: { defaultAngle: 0, fov: 0.8, heightOffset: 0 },
    mood: { saturation: 0.2, contrast: 0.55, warmth: -0.3, grainAmount: 0.18 },
  },
};

// ============================================================================
// PROCEDURAL OBJECT GENERATOR — creates PS1-style objects from parameters
// ============================================================================

/**
 * Generate canvas draw commands for a PS1-style object.
 * Flat-shaded polygons, no textures, strong silhouettes.
 */
export function drawPS1Object(
  ctx: CanvasRenderingContext2D,
  obj: PS1Object,
  x: number,
  y: number,
  scale: number,
  lightDir: number,
): void {
  const w = obj.width * scale;
  const h = obj.height * scale;
  const c = obj.colors;

  // Shadow on ground
  ctx.fillStyle = '#00000030';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, w * 0.6, h * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  switch (obj.type) {
    case 'crate':
    case 'cargo_crate':
      // Front face
      ctx.fillStyle = c[0];
      ctx.fillRect(x - w / 2, y - h, w, h);
      // Top face (lighter)
      ctx.fillStyle = c[1] || c[0];
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y - h);
      ctx.lineTo(x - w / 2 + w * 0.2, y - h - h * 0.25);
      ctx.lineTo(x + w / 2 + w * 0.2, y - h - h * 0.25);
      ctx.lineTo(x + w / 2, y - h);
      ctx.closePath();
      ctx.fill();
      // Side face (darker)
      ctx.fillStyle = c[2] || c[0];
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y - h);
      ctx.lineTo(x + w / 2 + w * 0.2, y - h - h * 0.25);
      ctx.lineTo(x + w / 2 + w * 0.2, y - h * 0.25);
      ctx.lineTo(x + w / 2, y);
      ctx.closePath();
      ctx.fill();
      // Cross detail
      ctx.strokeStyle = c[2] || '#00000020';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y - h);
      ctx.lineTo(x + w / 2, y);
      ctx.moveTo(x + w / 2, y - h);
      ctx.lineTo(x - w / 2, y);
      ctx.stroke();
      break;

    case 'pillar':
    case 'column':
      // Shaft
      ctx.fillStyle = c[0];
      ctx.fillRect(x - w / 2, y - h, w, h);
      // Capital (top)
      ctx.fillStyle = c[1] || c[0];
      ctx.fillRect(x - w * 0.65, y - h - 8, w * 1.3, 8);
      // Base
      ctx.fillStyle = c[1] || c[0];
      ctx.fillRect(x - w * 0.65, y - 8, w * 1.3, 8);
      // Shadow side
      ctx.fillStyle = '#00000020';
      ctx.fillRect(x, y - h, w / 2, h);
      break;

    case 'barrel':
      // Cylinder approximation
      ctx.fillStyle = c[0];
      ctx.beginPath();
      ctx.ellipse(x, y, w / 2, w / 4, 0, 0, Math.PI);
      ctx.lineTo(x - w / 2, y - h);
      ctx.ellipse(x, y - h, w / 2, w / 4, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      // Top ellipse
      ctx.fillStyle = c[1] || c[0];
      ctx.beginPath();
      ctx.ellipse(x, y - h, w / 2, w / 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Metal bands
      ctx.strokeStyle = c[1] || '#00000040';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, y - h * 0.25, w / 2, w / 5, 0, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y - h * 0.75, w / 2, w / 5, 0, 0, Math.PI);
      ctx.stroke();
      break;

    case 'stalactite':
      ctx.fillStyle = c[0];
      ctx.beginPath();
      ctx.moveTo(x - w / 2, 0);
      ctx.lineTo(x + w / 2, 0);
      ctx.lineTo(x + w * 0.1, h);
      ctx.lineTo(x - w * 0.1, h);
      ctx.closePath();
      ctx.fill();
      break;

    case 'stalagmite':
      ctx.fillStyle = c[0];
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y);
      ctx.lineTo(x + w / 2, y);
      ctx.lineTo(x + w * 0.15, y - h);
      ctx.lineTo(x - w * 0.15, y - h);
      ctx.closePath();
      ctx.fill();
      break;

    case 'carpet_runner':
      ctx.fillStyle = c[0];
      ctx.fillRect(x - w / 2, y - 1, w, h + 2);
      // Pattern
      ctx.fillStyle = c[1] || c[0];
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.15, h * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'road_marking':
      ctx.fillStyle = c[0];
      ctx.fillRect(x - w / 2, y - 0.5, w, h);
      break;

    default:
      // Generic box fallback
      ctx.fillStyle = c[0];
      ctx.fillRect(x - w / 2, y - h, w, h);
      break;
  }
}

// ============================================================================
// ROOM GENERATOR — builds a complete room from PS1StyleParams
// ============================================================================

/**
 * Generate draw commands for a complete PS1-style room.
 * Returns a function that draws the room to a canvas.
 *
 * @param style   PS1 style parameters
 * @param seed    Deterministic seed for object placement
 * @param width   Room width
 * @param height  Room height
 */
export function generatePS1Room(
  style: PS1StyleParams,
  seed: number,
  width: number = 400,
  height: number = 400,
): (ctx: CanvasRenderingContext2D) => void {
  // Seeded random
  let s = seed;
  const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s % 10000) / 10000; };

  // Pre-calculate object placements
  const placedObjects: Array<{ obj: PS1Object; x: number; y: number; scale: number }> = [];
  for (const obj of style.objects) {
    const count = Math.floor(obj.frequency * 8) + (r() < obj.frequency ? 1 : 0);
    for (let i = 0; i < count; i++) {
      placedObjects.push({
        obj,
        x: 40 + r() * (width - 80),
        y: height * (0.55 + r() * 0.35),
        scale: 0.7 + r() * 0.6,
      });
    }
  }
  // Sort by Y for depth ordering
  placedObjects.sort((a, b) => a.y - b.y);

  return (ctx: CanvasRenderingContext2D) => {
    const fl = style.floor;
    const wl = style.walls;
    const lt = style.lighting;
    const cl = style.ceiling;
    const md = style.mood;

    // ── Sky / ceiling ──
    if (cl.type === 'open_sky') {
      ctx.fillStyle = cl.color;
      ctx.fillRect(0, 0, width, height * (1 - wl.height));
    } else if (cl.visible) {
      ctx.fillStyle = cl.color;
      ctx.fillRect(0, 0, width, height * 0.15);
      if (cl.type === 'beam' && cl.beamColor) {
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = cl.beamColor;
          ctx.fillRect(width * (0.2 + i * 0.3), 0, 8, height * 0.15);
        }
      }
    }

    // ── Walls ──
    const wallTop = cl.visible ? height * 0.15 : 0;
    const wallBot = height * (1 - wl.height * 0.6);
    if (wl.type !== 'none') {
      // Left wall
      ctx.fillStyle = wl.colors[0];
      ctx.beginPath();
      ctx.moveTo(0, wallTop);
      ctx.lineTo(wl.thickness, wallBot * 0.7);
      ctx.lineTo(wl.thickness, wallBot);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();
      // Back wall
      ctx.fillStyle = wl.colors[1] || wl.colors[0];
      ctx.fillRect(wl.thickness, wallTop, width - wl.thickness * 2, wallBot - wallTop);
      // Right wall
      ctx.fillStyle = wl.colors[2] || wl.colors[0];
      ctx.beginPath();
      ctx.moveTo(width, wallTop);
      ctx.lineTo(width - wl.thickness, wallBot * 0.7);
      ctx.lineTo(width - wl.thickness, wallBot);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();
    }

    // ── Floor ──
    ctx.fillStyle = fl.colors[0];
    if (fl.perspective) {
      // Perspective floor
      ctx.beginPath();
      ctx.moveTo(wl.thickness, wallBot);
      ctx.lineTo(width - wl.thickness, wallBot);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(0, wallBot, width, height - wallBot);
    }

    // Floor tile grid
    if (fl.gapWidth > 0) {
      ctx.strokeStyle = fl.gapColor;
      ctx.lineWidth = fl.gapWidth;
      const rows = Math.ceil((height - wallBot) / fl.tileSize);
      const cols = Math.ceil(width / fl.tileSize);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const ty = wallBot + row * fl.tileSize;
          const tx = col * fl.tileSize;
          // Per-tile color jitter
          if (fl.jitter > 0) {
            const ci = Math.floor(r() * fl.colors.length);
            ctx.fillStyle = fl.colors[ci];
            ctx.fillRect(tx, ty, fl.tileSize, fl.tileSize);
          }
          ctx.strokeRect(tx + 0.5, ty + 0.5, fl.tileSize - 1, fl.tileSize - 1);
        }
      }
    }

    // Floor reflection
    if (fl.reflective) {
      ctx.fillStyle = '#FFFFFF06';
      ctx.fillRect(wl.thickness, wallBot, width - wl.thickness * 2, (height - wallBot) * 0.3);
    }

    // ── Light sources (radial glow) ──
    for (const src of lt.sources) {
      const lx = src.x * width;
      const ly = src.y * height;
      ctx.fillStyle = src.color + '12'; // low opacity glow
      ctx.beginPath();
      ctx.arc(lx, ly, src.radius * width, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = src.color + '08';
      ctx.beginPath();
      ctx.arc(lx, ly, src.radius * width * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Flame for flickering sources
      if (src.flicker) {
        ctx.fillStyle = src.color;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.ellipse(lx, ly - 4, 3, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#FFD060';
        ctx.beginPath();
        ctx.ellipse(lx, ly - 6, 2, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // ── Objects ──
    for (const po of placedObjects) {
      drawPS1Object(ctx, po.obj, po.x, po.y, po.scale, lt.primary.direction);
    }

    // ── Fog ──
    if (lt.fog.density > 0) {
      ctx.fillStyle = lt.fog.color;
      ctx.globalAlpha = lt.fog.density * 0.3;
      ctx.fillRect(0, 0, width, height * lt.fog.startDistance);
      ctx.globalAlpha = 1;
    }

    // ── PS1 grain/dither ──
    if (md.grainAmount > 0) {
      ctx.fillStyle = '#00000008';
      for (let i = 0; i < md.grainAmount * 200; i++) {
        ctx.fillRect(r() * width, r() * height, 1, 1);
      }
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================
// PS1_STYLES              — 8 named style parameter sets
// PS1StyleParams          — full style interface
// generatePS1Room()       — procedural room from any style params
// drawPS1Object()         — draw a single PS1-style object
// All types exported for custom style creation
// ============================================================================
