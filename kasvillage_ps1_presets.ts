// ============================================================================
// KasVillage PS1 Visual Presets
// 5 zone environments inspired by PS1 classics.
// Each preset configures both character shading AND environment palette.
// PS1 320×240 on a 460 PPI phone screen = sharp stylized look.
//
// Zone 0: Crash Bandicoot — warm outdoor, sandy earth, green hills, bright
// Zone 1: Tomb Raider (temple) — ornate interior, amber panels, grey stone
// Zone 2: Tomb Raider (cave) — raw rock, dim, muted brown-grey
// Zone 3: Metal Gear Solid — industrial, blue-grey steel, cold fluorescent
// Zone 4: Resident Evil — grand hall, red carpet, dark wood, arched columns
// ============================================================================

import type { ShadingPreset } from './kasvillage_avatar_engine';

// ============================================================================
// CHARACTER SHADING PRESETS
// Drop these into SHADING_PRESETS in kasvillage_avatar_engine.ts
// ============================================================================

export const PS1_CHARACTER_PRESETS = {

  // ── Zone 0: Crash Bandicoot ──
  // Bright outdoor daylight, warm saturated, character pops against environment
  crash_outdoor: {
    primary:   { direction: 300, elevation: 60, color: '#FFF5D0', intensity: 1.1 },
    fill:      { direction: 120, elevation: 30, color: '#88BBDD', intensity: 0.45 },
    rim:       { color: '#FFEECC', intensity: 0.25 },
    ambient:   { color: '#D0C8A0', intensity: 0.4 },
    shadowDarkness: 0.3,
    highlightSharpness: 0.25,
    subsurfaceScatter: 0.3,
    ambientOcclusion: 0.35,
  },

  // ── Zone 1: Tomb Raider (temple) ──
  // Interior with warm wall-mounted torches, amber glow from panels
  tomb_temple: {
    primary:   { direction: 270, elevation: 35, color: '#DDAA55', intensity: 0.9 },
    fill:      { direction: 90,  elevation: 20, color: '#332211', intensity: 0.2 },
    rim:       { color: '#CC8833', intensity: 0.5 },
    ambient:   { color: '#1A1208', intensity: 0.18 },
    shadowDarkness: 0.65,
    highlightSharpness: 0.45,
    subsurfaceScatter: 0.35,
    ambientOcclusion: 0.7,
  },

  // ── Zone 2: Tomb Raider (cave) ──
  // Dark cave, single distant light source, heavy shadows, muted everything
  tomb_cave: {
    primary:   { direction: 200, elevation: 20, color: '#AA9977', intensity: 0.7 },
    fill:      { direction: 20,  elevation: 15, color: '#1A1510', intensity: 0.12 },
    rim:       { color: '#887766', intensity: 0.35 },
    ambient:   { color: '#0E0C08', intensity: 0.1 },
    shadowDarkness: 0.82,
    highlightSharpness: 0.35,
    subsurfaceScatter: 0.2,
    ambientOcclusion: 0.88,
  },

  // ── Zone 3: Metal Gear Solid ──
  // Cold industrial fluorescent, blue-grey, harsh overhead light, green tint
  mgs_industrial: {
    primary:   { direction: 0,   elevation: 75, color: '#CCDDEE', intensity: 0.85 },
    fill:      { direction: 180, elevation: 10, color: '#1A2A3A', intensity: 0.2 },
    rim:       { color: '#88AACC', intensity: 0.4 },
    ambient:   { color: '#0A1520', intensity: 0.15 },
    shadowDarkness: 0.7,
    highlightSharpness: 0.55,
    subsurfaceScatter: 0.1,
    ambientOcclusion: 0.75,
  },

  // ── Zone 4: Resident Evil ──
  // Grand dark interior, warm accent from candelabras, deep shadows
  re_mansion: {
    primary:   { direction: 240, elevation: 30, color: '#FFCC88', intensity: 0.8 },
    fill:      { direction: 60,  elevation: 25, color: '#2A1A1A', intensity: 0.15 },
    rim:       { color: '#FF9944', intensity: 0.55 },
    ambient:   { color: '#120A08', intensity: 0.1 },
    shadowDarkness: 0.8,
    highlightSharpness: 0.5,
    subsurfaceScatter: 0.4,
    ambientOcclusion: 0.85,
  },
};

// ============================================================================
// ENVIRONMENT BIOME PALETTES
// Drop these into BIOME_PALETTES in kasvillage_environments.ts
// ============================================================================

export const PS1_BIOME_PALETTES = {

  // ── Zone 0: Crash Bandicoot ──
  // Sandy ground, green grassy hills, bright warm sky, wooden crates/bridges
  ps1_outdoor: {
    floor: ['#C4A060', '#D4B070', '#B49050'],  // sandy earth
    wall:  ['#6B8A3A', '#7A9A4A', '#5A7A2A'],  // green hillside
    accent:['#8B6B3A', '#A07840', '#6A4A20'],  // wood/crate brown
    sky:   '#88BBDD',                            // bright blue
    // Extended PS1 properties
    floorPattern: 'sand',           // granular texture
    wallPattern: 'grass',           // organic irregularity
    lightingTint: '#FFF5D0',        // warm sunlight
    fogColor: '#CCDDAA',           // green-tinted distance fog
    fogDensity: 0.15,
  },

  // ── Zone 1: Tomb Raider (temple) ──
  // Grey stone walls, ornate amber/orange panel decorations, red border trim
  ps1_temple: {
    floor: ['#7A7A7A', '#8A8A88', '#6A6A68'],  // smooth grey stone
    wall:  ['#8A8A85', '#9A9A92', '#7A7A78'],  // lighter grey stone
    accent:['#CC8822', '#DDAA44', '#BB7711'],   // amber/gold panels
    sky:   '#3A2A1A',                            // dark interior
    floorPattern: 'tile_reflective',
    wallPattern: 'brick_ornate',
    lightingTint: '#DDAA55',
    decorBorder: '#882222',         // red decorative border trim
    fogColor: '#1A1208',
    fogDensity: 0.3,
  },

  // ── Zone 2: Tomb Raider (cave) ──
  // Raw rough rock, grey-brown stone, muted, occasional brick sections
  ps1_cave: {
    floor: ['#5A5248', '#6A6258', '#4A4238'],  // rough dirty stone
    wall:  ['#6A6860', '#7A7870', '#5A5850'],  // grey-brown rock face
    accent:['#7A7268', '#8A8278', '#6A6258'],  // lighter stone blocks
    sky:   '#0A0A08',                            // near black
    floorPattern: 'rock_rough',
    wallPattern: 'rock_layered',      // horizontal rock strata
    lightingTint: '#AA9977',
    fogColor: '#0E0C08',
    fogDensity: 0.5,
  },

  // ── Zone 3: Metal Gear Solid ──
  // Metal floor tiles, grey-blue steel walls, fluorescent light panels
  ps1_industrial: {
    floor: ['#4A5A6A', '#5A6A7A', '#3A4A5A'],  // blue-grey metal tiles
    wall:  ['#5A6A78', '#6A7A88', '#4A5A68'],  // steel panels
    accent:['#88CCDD', '#66AACC', '#AADDEE'],  // fluorescent light blue
    sky:   '#0A1520',                            // dark blue-black
    floorPattern: 'metal_tile',       // grid-line tiles
    wallPattern: 'panel_riveted',     // industrial panels with rivets
    lightingTint: '#CCDDEE',
    lightPanels: true,                // glowing overhead panels
    fogColor: '#1A2A3A',
    fogDensity: 0.2,
  },

  // ── Zone 4: Resident Evil ──
  // Dark wood floor, ornate wallpaper, red carpet, arched stone columns
  ps1_mansion: {
    floor: ['#3A2A1A', '#4A3A28', '#2A1A0A'],  // dark polished wood
    wall:  ['#4A3A2A', '#5A4A38', '#3A2A18'],  // dark wood paneling
    accent:['#882222', '#AA3333', '#CC4444'],   // red carpet/curtain
    sky:   '#0A0808',                            // near black
    floorPattern: 'wood_parquet',
    wallPattern: 'wallpaper_ornate',
    lightingTint: '#FFCC88',
    carpet: '#882222',              // red carpet color
    columnStyle: 'arched',          // arched stone columns
    fogColor: '#120A08',
    fogDensity: 0.4,
  },
};

// ============================================================================
// ENVIRONMENT DETAIL ELEMENTS — PS1-specific room decorations
// ============================================================================

export const PS1_ROOM_ELEMENTS = {

  // ── Zone 0: Crash ──
  ps1_outdoor: {
    objects: [
      { type: 'crate', material: 'wood', destructible: true },
      { type: 'barrel', material: 'wood', destructible: true },
      { type: 'bridge', material: 'wood', destructible: false },
      { type: 'flower_pot', material: 'clay', destructible: true },
      { type: 'fence', material: 'wood', destructible: false },
    ],
    terrain: [
      { type: 'hill', shape: 'rolling', color: '#6B8A3A' },
      { type: 'cliff_edge', shape: 'sharp', color: '#8B7355' },
      { type: 'path', shape: 'winding', color: '#C4A060' },
    ],
  },

  // ── Zone 1: Temple ──
  ps1_temple: {
    objects: [
      { type: 'pillar', material: 'stone', destructible: false },
      { type: 'wall_panel', material: 'painted_stone', destructible: false },
      { type: 'border_trim', material: 'carved_stone', color: '#882222' },
      { type: 'torch_sconce', material: 'bronze', light: true },
      { type: 'relief_carving', material: 'stone', decorative: true },
    ],
    terrain: [
      { type: 'ledge', shape: 'rectangular', color: '#8A8A85' },
      { type: 'step', shape: 'wide', color: '#7A7A7A' },
    ],
  },

  // ── Zone 2: Cave ──
  ps1_cave: {
    objects: [
      { type: 'stalactite', material: 'rock', hanging: true },
      { type: 'stalagmite', material: 'rock', ground: true },
      { type: 'rock_pile', material: 'loose_stone', destructible: true },
      { type: 'brick_section', material: 'ancient_brick', decorative: true },
      { type: 'pool', material: 'water', reflective: true },
    ],
    terrain: [
      { type: 'rock_wall', shape: 'jagged', color: '#6A6860' },
      { type: 'overhang', shape: 'curved', color: '#5A5850' },
      { type: 'crevice', shape: 'narrow', color: '#2A2820' },
    ],
  },

  // ── Zone 3: Industrial ──
  ps1_industrial: {
    objects: [
      { type: 'cargo_crate', material: 'metal', destructible: false },
      { type: 'pipe', material: 'steel', horizontal: true },
      { type: 'vent', material: 'metal_grate', wall_mounted: true },
      { type: 'light_panel', material: 'fluorescent', light: true, color: '#88CCDD' },
      { type: 'railing', material: 'steel', waist_height: true },
      { type: 'staircase', material: 'metal_grate', climbable: true },
    ],
    terrain: [
      { type: 'floor_marking', shape: 'painted_line', color: '#FFCC00' },
      { type: 'drain_grate', shape: 'grid', color: '#3A3A3A' },
    ],
  },

  // ── Zone 4: Mansion ──
  ps1_mansion: {
    objects: [
      { type: 'column', material: 'marble', style: 'arched' },
      { type: 'chandelier', material: 'brass', hanging: true, light: true },
      { type: 'bookshelf', material: 'dark_wood', tall: true },
      { type: 'painting', material: 'framed_canvas', wall_mounted: true },
      { type: 'carpet_runner', material: 'fabric', color: '#882222' },
      { type: 'staircase', material: 'dark_wood', ornate: true },
      { type: 'candelabra', material: 'silver', light: true },
    ],
    terrain: [
      { type: 'balcony', shape: 'upper_floor', railing: 'ornate_wood' },
      { type: 'alcove', shape: 'arched', color: '#3A2A18' },
    ],
  },
};

// ============================================================================
// FLOOR PATTERN GENERATORS — for canvas createPattern()
// ============================================================================

/**
 * Generate a floor pattern for canvas rendering.
 * Returns a function that draws the pattern tile to an offscreen canvas.
 *
 * @param type     Pattern type from biome config
 * @param colors   Floor color array from biome palette
 * @param tileSize Tile size in pixels
 */
export function createFloorPattern(
  type: string,
  colors: string[],
  tileSize: number = 16,
): (ctx: CanvasRenderingContext2D) => CanvasPattern | null {
  return (ctx: CanvasRenderingContext2D) => {
    const tile = document.createElement('canvas');
    tile.width = tileSize;
    tile.height = tileSize;
    const tc = tile.getContext('2d')!;

    switch (type) {
      case 'sand':
        // Granular sand texture — random dots
        tc.fillStyle = colors[0];
        tc.fillRect(0, 0, tileSize, tileSize);
        for (let i = 0; i < 8; i++) {
          tc.fillStyle = colors[Math.floor(Math.random() * colors.length)];
          tc.fillRect(
            Math.random() * tileSize, Math.random() * tileSize,
            1 + Math.random() * 2, 1 + Math.random() * 2,
          );
        }
        break;

      case 'tile_reflective':
        // Smooth stone tiles with subtle grid lines
        tc.fillStyle = colors[0];
        tc.fillRect(0, 0, tileSize, tileSize);
        tc.strokeStyle = colors[2];
        tc.lineWidth = 0.5;
        tc.strokeRect(0.5, 0.5, tileSize - 1, tileSize - 1);
        // Slight highlight on top edge (reflection)
        tc.strokeStyle = colors[1];
        tc.lineWidth = 0.3;
        tc.beginPath();
        tc.moveTo(1, 1);
        tc.lineTo(tileSize - 1, 1);
        tc.stroke();
        break;

      case 'rock_rough':
        // Irregular rough stone
        tc.fillStyle = colors[0];
        tc.fillRect(0, 0, tileSize, tileSize);
        for (let i = 0; i < 5; i++) {
          tc.fillStyle = colors[Math.floor(Math.random() * colors.length)];
          const x = Math.random() * tileSize;
          const y = Math.random() * tileSize;
          tc.beginPath();
          tc.arc(x, y, 1 + Math.random() * 3, 0, Math.PI * 2);
          tc.fill();
        }
        // Crack lines
        tc.strokeStyle = '#00000020';
        tc.lineWidth = 0.3;
        tc.beginPath();
        tc.moveTo(Math.random() * tileSize, 0);
        tc.lineTo(Math.random() * tileSize, tileSize);
        tc.stroke();
        break;

      case 'metal_tile':
        // Grid-pattern metal floor tiles
        tc.fillStyle = colors[0];
        tc.fillRect(0, 0, tileSize, tileSize);
        tc.strokeStyle = colors[2];
        tc.lineWidth = 0.5;
        tc.strokeRect(0.5, 0.5, tileSize - 1, tileSize - 1);
        // Inner grid lines (MGS style)
        tc.strokeStyle = colors[1];
        tc.lineWidth = 0.3;
        tc.beginPath();
        tc.moveTo(tileSize / 2, 0);
        tc.lineTo(tileSize / 2, tileSize);
        tc.moveTo(0, tileSize / 2);
        tc.lineTo(tileSize, tileSize / 2);
        tc.stroke();
        // Corner rivets
        tc.fillStyle = colors[1];
        tc.fillRect(1, 1, 1.5, 1.5);
        tc.fillRect(tileSize - 2.5, 1, 1.5, 1.5);
        tc.fillRect(1, tileSize - 2.5, 1.5, 1.5);
        tc.fillRect(tileSize - 2.5, tileSize - 2.5, 1.5, 1.5);
        break;

      case 'wood_parquet':
        // Dark polished wood planks
        tc.fillStyle = colors[0];
        tc.fillRect(0, 0, tileSize, tileSize);
        // Wood grain lines
        tc.strokeStyle = colors[1];
        tc.lineWidth = 0.3;
        for (let i = 0; i < 4; i++) {
          const y = (i / 4) * tileSize + Math.random() * 2;
          tc.beginPath();
          tc.moveTo(0, y);
          tc.lineTo(tileSize, y + (Math.random() - 0.5) * 2);
          tc.stroke();
        }
        // Plank divider
        tc.strokeStyle = colors[2];
        tc.lineWidth = 0.5;
        tc.beginPath();
        tc.moveTo(0, tileSize - 0.5);
        tc.lineTo(tileSize, tileSize - 0.5);
        tc.stroke();
        break;

      default:
        // Fallback checkerboard
        tc.fillStyle = colors[0];
        tc.fillRect(0, 0, tileSize, tileSize);
        tc.fillStyle = colors[1] || colors[0];
        tc.fillRect(0, 0, tileSize / 2, tileSize / 2);
        tc.fillRect(tileSize / 2, tileSize / 2, tileSize / 2, tileSize / 2);
        break;
    }

    return ctx.createPattern(tile, 'repeat');
  };
}

// ============================================================================
// WALL PATTERN GENERATORS
// ============================================================================

export function createWallPattern(
  type: string,
  colors: string[],
  tileSize: number = 20,
): (ctx: CanvasRenderingContext2D) => CanvasPattern | null {
  return (ctx: CanvasRenderingContext2D) => {
    const tile = document.createElement('canvas');
    tile.width = tileSize;
    tile.height = tileSize;
    const tc = tile.getContext('2d')!;

    switch (type) {
      case 'grass':
        tc.fillStyle = colors[0];
        tc.fillRect(0, 0, tileSize, tileSize);
        // Grass blade marks
        for (let i = 0; i < 6; i++) {
          tc.strokeStyle = colors[Math.floor(Math.random() * colors.length)];
          tc.lineWidth = 0.5;
          const x = Math.random() * tileSize;
          tc.beginPath();
          tc.moveTo(x, tileSize);
          tc.lineTo(x + (Math.random() - 0.5) * 4, tileSize - 4 - Math.random() * 6);
          tc.stroke();
        }
        break;

      case 'brick_ornate':
        tc.fillStyle = colors[0];
        tc.fillRect(0, 0, tileSize, tileSize);
        tc.strokeStyle = colors[2];
        tc.lineWidth = 0.4;
        // Brick rows with offset
        tc.strokeRect(0, 0, tileSize, tileSize / 2);
        tc.strokeRect(tileSize / 3, tileSize / 2, tileSize, tileSize / 2);
        break;

      case 'rock_layered':
        tc.fillStyle = colors[0];
        tc.fillRect(0, 0, tileSize, tileSize);
        // Horizontal strata
        for (let i = 0; i < 3; i++) {
          tc.strokeStyle = colors[Math.floor(Math.random() * colors.length)];
          tc.lineWidth = 0.5;
          const y = (i / 3) * tileSize + Math.random() * 4;
          tc.beginPath();
          tc.moveTo(0, y);
          tc.lineTo(tileSize, y + (Math.random() - 0.5) * 3);
          tc.stroke();
        }
        break;

      case 'panel_riveted':
        tc.fillStyle = colors[0];
        tc.fillRect(0, 0, tileSize, tileSize);
        tc.strokeStyle = colors[2];
        tc.lineWidth = 0.5;
        tc.strokeRect(1, 1, tileSize - 2, tileSize - 2);
        // Rivets
        tc.fillStyle = colors[1];
        tc.beginPath();
        tc.arc(3, 3, 1, 0, Math.PI * 2);
        tc.arc(tileSize - 3, 3, 1, 0, Math.PI * 2);
        tc.arc(3, tileSize - 3, 1, 0, Math.PI * 2);
        tc.arc(tileSize - 3, tileSize - 3, 1, 0, Math.PI * 2);
        tc.fill();
        break;

      case 'wallpaper_ornate':
        tc.fillStyle = colors[0];
        tc.fillRect(0, 0, tileSize, tileSize);
        // Subtle wallpaper pattern (diamond grid)
        tc.strokeStyle = colors[1];
        tc.lineWidth = 0.3;
        tc.beginPath();
        tc.moveTo(tileSize / 2, 0);
        tc.lineTo(tileSize, tileSize / 2);
        tc.lineTo(tileSize / 2, tileSize);
        tc.lineTo(0, tileSize / 2);
        tc.closePath();
        tc.stroke();
        break;

      default:
        tc.fillStyle = colors[0];
        tc.fillRect(0, 0, tileSize, tileSize);
        tc.strokeStyle = colors[2] || colors[0];
        tc.lineWidth = 0.3;
        tc.strokeRect(0, 0, tileSize, tileSize / 2);
        break;
    }

    return ctx.createPattern(tile, 'repeat');
  };
}

// ============================================================================
// ZONE PRESET MAPPING — which preset for which game zone
// ============================================================================

export const ZONE_PRESETS: Record<number, {
  character: keyof typeof PS1_CHARACTER_PRESETS;
  biome: keyof typeof PS1_BIOME_PALETTES;
  elements: keyof typeof PS1_ROOM_ELEMENTS;
  musicMood: string;
}> = {
  0: { character: 'crash_outdoor',   biome: 'ps1_outdoor',    elements: 'ps1_outdoor',    musicMood: 'bright' },
  1: { character: 'tomb_temple',     biome: 'ps1_temple',     elements: 'ps1_temple',     musicMood: 'mysterious' },
  2: { character: 'tomb_cave',       biome: 'ps1_cave',       elements: 'ps1_cave',       musicMood: 'tense' },
  3: { character: 'mgs_industrial',  biome: 'ps1_industrial', elements: 'ps1_industrial', musicMood: 'cold' },
  4: { character: 're_mansion',      biome: 'ps1_mansion',    elements: 'ps1_mansion',    musicMood: 'dread' },
};

/**
 * Get the full visual config for a game zone.
 */
export function getZoneVisualConfig(zone: number) {
  const preset = ZONE_PRESETS[zone] || ZONE_PRESETS[0];
  return {
    characterShading: PS1_CHARACTER_PRESETS[preset.character],
    biomePalette: PS1_BIOME_PALETTES[preset.biome],
    roomElements: PS1_ROOM_ELEMENTS[preset.elements],
    musicMood: preset.musicMood,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================
// PS1_CHARACTER_PRESETS   — 5 shading configs for SHADING_PRESETS
// PS1_BIOME_PALETTES     — 5 biome palettes for BIOME_PALETTES
// PS1_ROOM_ELEMENTS      — 5 sets of room decoration objects
// ZONE_PRESETS           — zone → preset mapping
// getZoneVisualConfig()  — get full config for a zone
// createFloorPattern()   — generate canvas floor patterns
// createWallPattern()    — generate canvas wall patterns
// ============================================================================
