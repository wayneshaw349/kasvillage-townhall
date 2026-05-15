// ============================================================================
// KASVILLAGE PROCEDURAL BACKGROUNDS
// ============================================================================
// Pixelated, themed backgrounds for each app section
// Generated from avatar race + class + occupation selections
//
// Sections:
//   - WORKSPACE: Office/Lab/Forge based on class
//   - MAILBOX: City shops/streets based on occupation  
//   - DASHBOARD: Bedroom/quarters based on race
//   - TRADFI_ED: Bathroom with post-it notes
// ============================================================================

import React, { useMemo, memo } from 'react';
import { View, Dimensions } from 'react-native';
import Svg, { Rect, Path, G, Defs, LinearGradient, Stop, Pattern, Circle, Line } from 'react-native-svg';
import type { JSX } from 'react';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================================
// TYPES
// ============================================================================

interface AvatarConfig {
  race: string;
  class: string;
  occupation: string;
  name: string;
  gender?: string;
}

interface BackgroundProps {
  avatar: AvatarConfig;
  section: 'workspace' | 'mailbox' | 'dashboard' | 'tradfi_ed';
}

// ============================================================================
// SEEDED RANDOM (Deterministic from avatar name)
// ============================================================================

function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  return () => {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return (hash % 1000) / 1000;
  };
}

// ============================================================================
// PIXEL HELPERS
// ============================================================================

const PIXEL_SIZE = 16; // Size of each "pixel" block
const GRID_W = Math.ceil(SCREEN_WIDTH / PIXEL_SIZE);
const GRID_H = Math.ceil(SCREEN_HEIGHT / PIXEL_SIZE);

function PixelBlock({ x, y, color, size = PIXEL_SIZE }: { x: number; y: number; color: string; size?: number }) {
  return <Rect x={x * size} y={y * size} width={size} height={size} fill={color} />;
}

// ============================================================================
// COLOR PALETTES BY RACE
// ============================================================================

const RACE_PALETTES: Record<string, { primary: string; secondary: string; accent: string; dark: string; light: string }> = {
  // Organic Races
  Human: { primary: '#8B7355', secondary: '#D4C4B0', accent: '#C9A86C', dark: '#4A3728', light: '#F5EDE0' },
  Elf: { primary: '#2D5A27', secondary: '#90B088', accent: '#C4D4A0', dark: '#1A3318', light: '#E8F0E0' },
  'Dark Elf': { primary: '#2B1B4E', secondary: '#6B4E9E', accent: '#9B7ED4', dark: '#1A0F2E', light: '#C8B8E8' },
  Dwarf: { primary: '#8B4513', secondary: '#CD853F', accent: '#FFD700', dark: '#4A2508', light: '#F4E4D0' },
  Orc: { primary: '#3D5A3D', secondary: '#6B8E6B', accent: '#8B0000', dark: '#1E2E1E', light: '#A8C8A8' },
  Halfling: { primary: '#7CB342', secondary: '#AED581', accent: '#FFCC80', dark: '#33691E', light: '#F1F8E9' },
  Dragonkin: { primary: '#B22222', secondary: '#FF6347', accent: '#FFD700', dark: '#5C1010', light: '#FFE4E1' },
  Fae: { primary: '#FF69B4', secondary: '#DDA0DD', accent: '#98FB98', dark: '#8B008B', light: '#FFF0F5' },
  Vampire: { primary: '#4A0000', secondary: '#8B0000', accent: '#C0C0C0', dark: '#1A0000', light: '#2D0000' },
  Werewolf: { primary: '#4A4A4A', secondary: '#6B6B6B', accent: '#8B4513', dark: '#1A1A1A', light: '#8B8B8B' },
  Angel: { primary: '#F0E68C', secondary: '#FFFACD', accent: '#87CEEB', dark: '#DAA520', light: '#FFFFF0' },
  Cyborg: { primary: '#2F4F4F', secondary: '#708090', accent: '#00FFFF', dark: '#1A2A2A', light: '#B0C4DE' },
  Alien: { primary: '#00CED1', secondary: '#40E0D0', accent: '#7B68EE', dark: '#006666', light: '#E0FFFF' },
  Golem: { primary: '#696969', secondary: '#808080', accent: '#FF8C00', dark: '#2F2F2F', light: '#A9A9A9' },
  Elemental: { primary: '#FF4500', secondary: '#00BFFF', accent: '#32CD32', dark: '#8B0000', light: '#FFE4B5' },
  Undead: { primary: '#2F4F4F', secondary: '#556B2F', accent: '#9ACD32', dark: '#1C1C1C', light: '#698B69' },
  Giant: { primary: '#8B4513', secondary: '#A0522D', accent: '#D2691E', dark: '#3D1F0D', light: '#DEB887' },
  Merfolk: { primary: '#006994', secondary: '#40E0D0', accent: '#FF7F50', dark: '#003D5C', light: '#B0E0E6' },
  Centaur: { primary: '#8B7355', secondary: '#D2B48C', accent: '#228B22', dark: '#4A3C2A', light: '#F5DEB3' },
  Troll: { primary: '#556B2F', secondary: '#6B8E23', accent: '#8B4513', dark: '#2F3D1F', light: '#9ACD32' },
  Gnome: { primary: '#B8860B', secondary: '#DAA520', accent: '#FF6347', dark: '#5C4306', light: '#FAFAD2' },
  Sprite: { primary: '#98FB98', secondary: '#00FF7F', accent: '#FFD700', dark: '#006400', light: '#F0FFF0' },
  Phoenix: { primary: '#FF4500', secondary: '#FF6347', accent: '#FFD700', dark: '#8B2500', light: '#FFDAB9' },
};

// ============================================================================
// CLASS WORKSPACE THEMES
// ============================================================================

const CLASS_WORKSPACE: Record<string, { type: string; objects: string[] }> = {
  Warrior: { type: 'armory', objects: ['sword_rack', 'armor_stand', 'target_dummy', 'weapon_chest'] },
  Ninja: { type: 'dojo', objects: ['tatami', 'shuriken_rack', 'scroll_shelf', 'meditation_mat'] },
  Mage: { type: 'tower', objects: ['crystal_ball', 'spell_book', 'cauldron', 'rune_circle'] },
  Healer: { type: 'clinic', objects: ['herb_shelf', 'bed', 'potion_rack', 'bandage_roll'] },
  Ranger: { type: 'lodge', objects: ['bow_rack', 'animal_pelts', 'map_table', 'campfire'] },
  Merchant: { type: 'shop', objects: ['counter', 'shelves', 'gold_chest', 'scale'] },
  Scholar: { type: 'library', objects: ['bookshelf', 'desk', 'globe', 'candle'] },
  Bard: { type: 'tavern', objects: ['stage', 'instruments', 'ale_barrel', 'stool'] },
  Paladin: { type: 'chapel', objects: ['altar', 'holy_banner', 'prayer_bench', 'candelabra'] },
  Rogue: { type: 'hideout', objects: ['lockpick_set', 'shadow_cloak', 'trap_chest', 'rope'] },
  Necromancer: { type: 'crypt', objects: ['coffin', 'skull_pile', 'dark_tome', 'bone_altar'] },
  Monk: { type: 'monastery', objects: ['meditation_cushion', 'incense', 'staff_rack', 'bell'] },
  Berserker: { type: 'war_tent', objects: ['war_drums', 'trophy_skulls', 'axe_rack', 'fur_pile'] },
  Samurai: { type: 'dojo', objects: ['katana_stand', 'armor_display', 'zen_garden', 'tea_set'] },
  Druid: { type: 'grove', objects: ['tree_stump', 'herb_garden', 'animal_companion', 'nature_altar'] },
  Alchemist: { type: 'lab', objects: ['beaker_set', 'ingredient_shelf', 'distillery', 'formula_board'] },
  Assassin: { type: 'safehouse', objects: ['poison_vials', 'blade_collection', 'disguise_chest', 'contract_board'] },
  Knight: { type: 'barracks', objects: ['armor_rack', 'training_dummy', 'banner', 'weapon_rack'] },
  Sorcerer: { type: 'sanctum', objects: ['arcane_circle', 'floating_orbs', 'staff_holder', 'mirror'] },
  Shaman: { type: 'spirit_hut', objects: ['totem_pole', 'spirit_mask', 'ritual_drum', 'bone_chimes'] },
  Templar: { type: 'fortress', objects: ['holy_symbol', 'war_table', 'relic_case', 'torch_sconce'] },
  Hunter: { type: 'cabin', objects: ['trophy_wall', 'trap_collection', 'skinning_table', 'bow_rack'] },
  Summoner: { type: 'circle_room', objects: ['summoning_circle', 'binding_chains', 'crystal_array', 'tome_stand'] },
  Warlock: { type: 'dark_study', objects: ['demon_statue', 'blood_altar', 'curse_scroll', 'shadow_portal'] },
};

// ============================================================================
// OCCUPATION CITY THEMES (Mailbox)
// ============================================================================

const OCCUPATION_CITY: Record<string, { district: string; buildings: string[] }> = {
  Rapper: { district: 'urban', buildings: ['studio', 'club', 'graffiti_wall', 'record_shop'] },
  'Pop Singer': { district: 'downtown', buildings: ['theater', 'billboard', 'limo', 'fan_crowd'] },
  Superhero: { district: 'skyline', buildings: ['skyscraper', 'rooftop', 'signal_light', 'phone_booth'] },
  Detective: { district: 'noir_city', buildings: ['office', 'bar', 'alley', 'neon_sign'] },
  Chef: { district: 'food_quarter', buildings: ['restaurant', 'market', 'food_cart', 'spice_shop'] },
  Artist: { district: 'arts', buildings: ['gallery', 'studio', 'cafe', 'sculpture'] },
  Pilot: { district: 'airport', buildings: ['hangar', 'control_tower', 'runway', 'plane'] },
  Explorer: { district: 'port', buildings: ['dock', 'ship', 'warehouse', 'map_shop'] },
  Inventor: { district: 'industrial', buildings: ['factory', 'workshop', 'crane', 'smokestack'] },
  Athlete: { district: 'sports', buildings: ['stadium', 'gym', 'track', 'locker_room'] },
  'Bounty Hunter': { district: 'frontier', buildings: ['saloon', 'jail', 'wanted_board', 'stable'] },
  Spy: { district: 'embassy', buildings: ['government', 'safe_house', 'surveillance_van', 'bridge'] },
  Astronaut: { district: 'space_port', buildings: ['launch_pad', 'mission_control', 'dome', 'rocket'] },
  Doctor: { district: 'medical', buildings: ['hospital', 'pharmacy', 'ambulance', 'clinic'] },
  Scientist: { district: 'research', buildings: ['lab_complex', 'observatory', 'reactor', 'data_center'] },
  Pirate: { district: 'harbor', buildings: ['tavern', 'ship', 'lighthouse', 'treasure_cave'] },
  Gladiator: { district: 'colosseum', buildings: ['arena', 'training_pit', 'armory', 'champion_hall'] },
  Thief: { district: 'underground', buildings: ['sewer', 'fence_shop', 'hideout', 'rooftop'] },
  Blacksmith: { district: 'forge', buildings: ['smithy', 'coal_pile', 'anvil_shop', 'weapon_display'] },
  Dancer: { district: 'theater', buildings: ['dance_hall', 'costume_shop', 'stage', 'mirror_room'] },
  Musician: { district: 'music_row', buildings: ['concert_hall', 'instrument_shop', 'recording_studio', 'street_corner'] },
  Actor: { district: 'hollywood', buildings: ['studio_lot', 'premiere', 'trailer', 'walk_of_fame'] },
  Writer: { district: 'literary', buildings: ['bookstore', 'cafe', 'typewriter_shop', 'newspaper'] },
  Archaeologist: { district: 'museum', buildings: ['exhibit_hall', 'dig_site', 'artifact_vault', 'library'] },
  Hacker: { district: 'cyber', buildings: ['server_farm', 'neon_arcade', 'coffee_shop', 'apartment'] },
  Streamer: { district: 'tech_hub', buildings: ['studio', 'gaming_cafe', 'merch_shop', 'fan_meetup'] },
  Rebel: { district: 'resistance', buildings: ['bunker', 'propaganda_wall', 'safe_house', 'tunnel'] },
  Prophet: { district: 'temple', buildings: ['shrine', 'gathering_hall', 'meditation_garden', 'bell_tower'] },
  Gambler: { district: 'casino', buildings: ['casino', 'pawn_shop', 'bar', 'penthouse'] },
  Outlaw: { district: 'wasteland', buildings: ['hideout', 'abandoned_station', 'canyon', 'campfire'] },
};

// ============================================================================
// PROCEDURAL WORKSPACE BACKGROUND (Class-based)
// ============================================================================

function WorkspaceBackground({ avatar, rand }: { avatar: AvatarConfig; rand: () => number }) {
  const palette = { ...(RACE_PALETTES[avatar.race] || RACE_PALETTES.Human) };
  if (avatar.gender === 'female') { palette.light = '#FFE4E8'; palette.secondary = '#F9C4D2'; }
  const workspace = (avatar.class && CLASS_WORKSPACE[avatar.class]) || { type: 'default', objects: [] };
  
  const pixels: JSX.Element[] = [];
  
  // Floor pattern
  for (let y = Math.floor(GRID_H * 0.6); y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const isAlternate = (x + y) % 2 === 0;
      pixels.push(
        <PixelBlock key={`floor-${x}-${y}`} x={x} y={y} color={isAlternate ? palette.dark : palette.primary} />
      );
    }
  }
  
  // Back wall
  for (let y = 0; y < Math.floor(GRID_H * 0.6); y++) {
    for (let x = 0; x < GRID_W; x++) {
      const shade = y % 6 === 0 ? palette.secondary : palette.light;
      pixels.push(
        <PixelBlock key={`wall-${x}-${y}`} x={x} y={y} color={shade} />
      );
    }
  }
  
  // Workspace objects based on class
  const objects = generateWorkspaceObjects(workspace.type, palette, rand);
  
  return (
    <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={{ position: 'absolute', zIndex: -1 }}>
      <G>{pixels}</G>
      <G>{objects}</G>
    </Svg>
  );
}

function generateWorkspaceObjects(type: string, palette: any, rand: () => number): JSX.Element[] {
  const elements: JSX.Element[] = [];
  const w = SCREEN_WIDTH;
  const h = SCREEN_HEIGHT;
  const wallY = h * 0.65;
  
  // STATIC: 3 horizontal shelf racks on wall
  const shelfYs = [h * 0.15, h * 0.30, h * 0.45];
  for (let i = 0; i < 3; i++) {
    elements.push(<Rect key={`shelf-${i}`} x={w * 0.08} y={shelfYs[i]} width={w * 0.84} height={4} fill={palette.secondary} />);
    // Shelf brackets
    elements.push(<Rect key={`bracket-l-${i}`} x={w * 0.12} y={shelfYs[i]} width={3} height={h * 0.04} fill={palette.secondary} />);
    elements.push(<Rect key={`bracket-r-${i}`} x={w * 0.84} y={shelfYs[i]} width={3} height={h * 0.04} fill={palette.secondary} />);
  }
  
  // STATIC: Work table at bottom
  elements.push(<Rect key="table" x={w * 0.15} y={wallY - h * 0.06} width={w * 0.7} height={h * 0.06} fill={palette.dark} rx={3} />);
  elements.push(<Rect key="leg-l" x={w * 0.2} y={wallY} width={w * 0.03} height={h * 0.08} fill={palette.dark} />);
  elements.push(<Rect key="leg-r" x={w * 0.77} y={wallY} width={w * 0.03} height={h * 0.08} fill={palette.dark} />);
  
  // PROCEDURAL: Small props on shelves � different per class
  const propColors = [palette.accent, "#C0392B", "#2980B9", "#27AE60", "#8E44AD", "#F39C12"];
  
  switch (type) {
    case 'armory':
      // Swords on shelves
      for (let s = 0; s < 3; s++) {
        const count = 2 + Math.floor(rand() * 3);
        for (let i = 0; i < count; i++) {
          const sx = w * (0.12 + rand() * 0.72);
          const sy = shelfYs[s] - h * 0.06;
          elements.push(<Rect key={`sword-${s}-${i}`} x={sx} y={sy} width={3} height={h * 0.055} fill={propColors[Math.floor(rand() * 3)]} />);
          elements.push(<Rect key={`hilt-${s}-${i}`} x={sx - 2} y={sy + h * 0.04} width={7} height={3} fill={palette.dark} />);
        }
      }
      // Shield on table
      elements.push(<Circle key="shield" cx={w * 0.5} cy={wallY - h * 0.1} r={w * 0.06} fill={palette.accent} stroke={palette.dark} strokeWidth={2} />);
      break;
      
    case 'tower':
      // Spell books on shelves
      for (let s = 0; s < 3; s++) {
        const count = 3 + Math.floor(rand() * 4);
        for (let i = 0; i < count; i++) {
          const bx = w * (0.1 + i * 0.12 + rand() * 0.04);
          elements.push(<Rect key={`book-${s}-${i}`} x={bx} y={shelfYs[s] - h * 0.04} width={w * 0.03} height={h * 0.04} fill={propColors[Math.floor(rand() * 6)]} rx={1} />);
        }
      }
      // Crystal ball on table
      elements.push(<Circle key="crystal" cx={w * 0.5} cy={wallY - h * 0.1} r={w * 0.05} fill="#9B59B6" opacity={0.7} />);
      break;
      
    case 'lab':
      // Beakers/bottles on shelves
      for (let s = 0; s < 3; s++) {
        const count = 3 + Math.floor(rand() * 3);
        for (let i = 0; i < count; i++) {
          const bx = w * (0.1 + i * 0.14 + rand() * 0.05);
          const bh = h * (0.03 + rand() * 0.03);
          elements.push(<Rect key={`bottle-${s}-${i}`} x={bx} y={shelfYs[s] - bh} width={w * 0.025} height={bh} fill={propColors[Math.floor(rand() * 6)]} rx={2} />);
        }
      }
      break;
      
    case 'dojo':
      // Katanas on shelves
      for (let s = 0; s < 3; s++) {
        const count = 1 + Math.floor(rand() * 2);
        for (let i = 0; i < count; i++) {
          const kx = w * (0.15 + rand() * 0.6);
          elements.push(<Rect key={`katana-${s}-${i}`} x={kx} y={shelfYs[s] - 3} width={w * 0.2} height={3} fill={palette.accent} />);
          elements.push(<Rect key={`tsuba-${s}-${i}`} x={kx + w * 0.15} y={shelfYs[s] - 5} width={5} height={7} fill={palette.dark} />);
        }
      }
      break;
      
    case 'crypt':
      // Skulls and candles on shelves
      for (let s = 0; s < 3; s++) {
        const count = 2 + Math.floor(rand() * 3);
        for (let i = 0; i < count; i++) {
          const cx = w * (0.12 + rand() * 0.7);
          if (rand() > 0.5) {
            elements.push(<Circle key={`skull-${s}-${i}`} cx={cx} cy={shelfYs[s] - h * 0.02} r={w * 0.02} fill="#E8E8D0" />);
          } else {
            elements.push(<Rect key={`candle-${s}-${i}`} x={cx} y={shelfYs[s] - h * 0.04} width={3} height={h * 0.04} fill="#FFFACD" />);
            elements.push(<Circle key={`flame-${s}-${i}`} cx={cx + 1.5} cy={shelfYs[s] - h * 0.045} r={3} fill="#FF6B00" />);
          }
        }
      }
      break;
      
    default:
      // Generic items on shelves
      for (let s = 0; s < 3; s++) {
        const count = 2 + Math.floor(rand() * 4);
        for (let i = 0; i < count; i++) {
          const ix = w * (0.1 + i * 0.15 + rand() * 0.05);
          const ih = h * (0.02 + rand() * 0.03);
          elements.push(<Rect key={`item-${s}-${i}`} x={ix} y={shelfYs[s] - ih} width={w * 0.04} height={ih} fill={propColors[Math.floor(rand() * 6)]} rx={2} />);
        }
      }
  }
  
  return elements;
}

// ============================================================================
// PROCEDURAL MAILBOX/CITY BACKGROUND (Occupation-based)
// ============================================================================

function MailboxBackground({ avatar, rand }: { avatar: AvatarConfig; rand: () => number }) {
  const palette = RACE_PALETTES[avatar.race] || RACE_PALETTES.Human;
  const city = OCCUPATION_CITY[avatar.occupation] || OCCUPATION_CITY.Explorer;
  
  const pixels: JSX.Element[] = [];
  
  // Sky gradient (top)
  for (let y = 0; y < Math.floor(GRID_H * 0.3); y++) {
    for (let x = 0; x < GRID_W; x++) {
      const skyShade = y < 5 ? '#1A1A3A' : y < 10 ? '#2A2A5A' : '#4A4A7A';
      pixels.push(<PixelBlock key={`sky-${x}-${y}`} x={x} y={y} color={skyShade} />);
    }
  }
  
  // Buildings silhouette
  const buildings = generateCityBuildings(city.district, palette, rand);
  
  // Street
  for (let y = Math.floor(GRID_H * 0.75); y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const streetColor = y === Math.floor(GRID_H * 0.8) ? '#FFFF00' : '#3A3A3A';
      pixels.push(<PixelBlock key={`street-${x}-${y}`} x={x} y={y} color={streetColor} />);
    }
  }
  
  return (
    <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={{ position: 'absolute', zIndex: -1 }}>
      <G>{pixels}</G>
      <G>{buildings}</G>
    </Svg>
  );
}

function generateCityBuildings(district: string, palette: any, rand: () => number): JSX.Element[] {
  const elements: JSX.Element[] = [];
  const ps = PIXEL_SIZE;
  
  // Generate 5-8 buildings
  const numBuildings = 5 + Math.floor(rand() * 4);
  let currentX = 0;
  
  for (let i = 0; i < numBuildings; i++) {
    const buildingWidth = Math.floor(3 + rand() * 5);
    const buildingHeight = Math.floor(8 + rand() * 15);
    const buildingY = Math.floor(GRID_H * 0.75) - buildingHeight;
    
    // Building body
    const buildingColor = i % 2 === 0 ? palette.dark : palette.primary;
    elements.push(
      <Rect 
        key={`building-${i}`} 
        x={currentX * ps} 
        y={buildingY * ps} 
        width={buildingWidth * ps} 
        height={buildingHeight * ps} 
        fill={buildingColor} 
      />
    );
    
    // Windows
    for (let wy = buildingY + 1; wy < buildingY + buildingHeight - 1; wy += 2) {
      for (let wx = currentX + 1; wx < currentX + buildingWidth - 1; wx++) {
        const windowLit = rand() > 0.4;
        elements.push(
          <Rect 
            key={`window-${i}-${wx}-${wy}`} 
            x={wx * ps} 
            y={wy * ps} 
            width={ps * 0.8} 
            height={ps * 0.8} 
            fill={windowLit ? '#FFFF88' : '#222222'} 
          />
        );
      }
    }
    
    currentX += buildingWidth + 1;
    if (currentX >= GRID_W) break;
  }
  
  // District-specific elements
  switch (district) {
    case 'cyber':
      // Neon signs
      for (let i = 0; i < 3; i++) {
        const nx = Math.floor(rand() * (GRID_W - 4)) * ps;
        const ny = Math.floor(rand() * 5 + 15) * ps;
        elements.push(<Rect key={`neon-${i}`} x={nx} y={ny} width={ps * 4} height={ps} fill={['#FF00FF', '#00FFFF', '#FF0088'][i]} />);
      }
      break;
      
    case 'urban':
      // Graffiti blocks
      for (let i = 0; i < 5; i++) {
        const gx = Math.floor(rand() * (GRID_W - 2)) * ps;
        const gy = Math.floor(rand() * 10 + 20) * ps;
        elements.push(<Rect key={`graffiti-${i}`} x={gx} y={gy} width={ps * 2} height={ps * 3} fill={['#FF4444', '#44FF44', '#4444FF', '#FFFF44', '#FF44FF'][i]} />);
      }
      break;
      
    case 'skyline':
      // Bat signal / spotlight
      elements.push(<Rect key="spotlight-1" x={ps * 10} y={ps * 2} width={ps * 8} height={ps * 2} fill="#FFFF88" opacity={0.3} />);
      elements.push(<Rect key="spotlight-2" x={ps * 12} y={ps * 4} width={ps * 4} height={ps * 4} fill="#FFFF88" opacity={0.2} />);
      break;
  }
  
  return elements;
}

// ============================================================================
// PROCEDURAL DASHBOARD/BEDROOM BACKGROUND (Race-based)
// ============================================================================

function DashboardBackground({ avatar, rand }: { avatar: AvatarConfig; rand: () => number }) {
  const palette = { ...(RACE_PALETTES[avatar.race] || RACE_PALETTES.Human) };
  if (avatar.gender === 'female') { palette.light = '#FFE4E8'; palette.secondary = '#F9C4D2'; }
  
  const pixels: JSX.Element[] = [];
  
  // Walls based on race
  for (let y = 0; y < Math.floor(GRID_H * 0.65); y++) {
    for (let x = 0; x < GRID_W; x++) {
      let wallColor = palette.light;
      // Add texture based on race
      if (['Cyborg', 'Alien'].includes(avatar.race)) {
        wallColor = (x + y) % 4 === 0 ? palette.accent : palette.secondary;
      } else if (['Vampire', 'Undead', 'Werewolf'].includes(avatar.race)) {
        wallColor = y % 2 === 0 ? palette.dark : palette.primary;
      } else if (['Fae', 'Sprite', 'Angel'].includes(avatar.race)) {
        wallColor = (x * y) % 5 === 0 ? palette.accent : palette.light;
      }
      pixels.push(<PixelBlock key={`wall-${x}-${y}`} x={x} y={y} color={wallColor} />);
    }
  }
  
  // Floor
  for (let y = Math.floor(GRID_H * 0.65); y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      pixels.push(<PixelBlock key={`floor-${x}-${y}`} x={x} y={y} color={palette.dark} />);
    }
  }
  
  // Bedroom furniture based on race
  const furniture = generateBedroomFurniture(avatar.race, palette, rand);
  
  return (
    <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={{ position: 'absolute', zIndex: -1 }}>
      <G>{pixels}</G>
      <G>{furniture}</G>
    </Svg>
  );
}

function generateBedroomFurniture(race: string, palette: any, rand: () => number): JSX.Element[] {
  const elements: JSX.Element[] = [];
  const ps = PIXEL_SIZE;
  
  // Bed (varies by race)
  const bedY = Math.floor(GRID_H * 0.55);
  
  if (['Vampire', 'Undead'].includes(race)) {
    // Coffin bed
    elements.push(<Rect key="coffin" x={ps * 3} y={bedY * ps} width={ps * 10} height={ps * 4} fill="#2D1F1F" />);
    elements.push(<Rect key="coffin-rim" x={ps * 4} y={(bedY - 1) * ps} width={ps * 8} height={ps} fill="#3D2F2F" />);
  } else if (['Cyborg', 'Alien'].includes(race)) {
    // Pod bed
    elements.push(<Rect key="pod-base" x={ps * 3} y={bedY * ps} width={ps * 10} height={ps * 5} fill={palette.secondary} />);
    elements.push(<Rect key="pod-glass" x={ps * 4} y={(bedY - 2) * ps} width={ps * 8} height={ps * 3} fill={palette.accent} opacity={0.5} />);
  } else if (['Fae', 'Sprite'].includes(race)) {
    // Flower bed
    elements.push(<Rect key="petal-1" x={ps * 3} y={bedY * ps} width={ps * 12} height={ps * 4} fill="#FF88CC" />);
    elements.push(<Rect key="petal-2" x={ps * 5} y={(bedY - 1) * ps} width={ps * 8} height={ps} fill="#FFAADD" />);
  } else if (['Dwarf', 'Golem'].includes(race)) {
    // Stone slab
    elements.push(<Rect key="slab" x={ps * 3} y={bedY * ps} width={ps * 10} height={ps * 3} fill="#808080" />);
    elements.push(<Rect key="pillow" x={ps * 4} y={(bedY - 1) * ps} width={ps * 3} height={ps * 2} fill="#606060" />);
  } else {
    // Normal bed
    elements.push(<Rect key="bed-frame" x={ps * 3} y={bedY * ps} width={ps * 10} height={ps * 5} fill={palette.primary} />);
    elements.push(<Rect key="mattress" x={ps * 4} y={(bedY - 1) * ps} width={ps * 8} height={ps * 4} fill={palette.light} />);
    elements.push(<Rect key="pillow" x={ps * 4} y={(bedY - 1) * ps} width={ps * 3} height={ps * 2} fill="#FFFFFF" />);
    elements.push(<Rect key="blanket" x={ps * 4} y={(bedY + 1) * ps} width={ps * 8} height={ps * 2} fill={palette.accent} />);
  }
  
  // Dresser/Storage (right side)
  elements.push(<Rect key="dresser" x={ps * 22} y={ps * 18} width={ps * 6} height={ps * 10} fill={palette.primary} />);
  elements.push(<Rect key="drawer-1" x={ps * 23} y={ps * 19} width={ps * 4} height={ps * 2} fill={palette.secondary} />);
  elements.push(<Rect key="drawer-2" x={ps * 23} y={ps * 22} width={ps * 4} height={ps * 2} fill={palette.secondary} />);
  elements.push(<Rect key="drawer-3" x={ps * 23} y={ps * 25} width={ps * 4} height={ps * 2} fill={palette.secondary} />);
  
  // Window
  elements.push(<Rect key="window-frame" x={ps * 12} y={ps * 3} width={ps * 8} height={ps * 10} fill={palette.dark} />);
  elements.push(<Rect key="window-glass" x={ps * 13} y={ps * 4} width={ps * 6} height={ps * 8} fill="#4A6FA5" />);
  elements.push(<Rect key="window-cross-h" x={ps * 13} y={ps * 7.5} width={ps * 6} height={ps * 0.5} fill={palette.dark} />);
  elements.push(<Rect key="window-cross-v" x={ps * 15.75} y={ps * 4} width={ps * 0.5} height={ps * 8} fill={palette.dark} />);
  
  // Race-specific decorations
  if (['Dragonkin', 'Phoenix'].includes(race)) {
    // Torches
    elements.push(<Rect key="torch-1" x={ps * 2} y={ps * 8} width={ps} height={ps * 4} fill="#8B4513" />);
    elements.push(<Rect key="flame-1" x={ps * 2} y={ps * 6} width={ps} height={ps * 2} fill="#FF6B00" />);
    elements.push(<Rect key="torch-2" x={ps * 28} y={ps * 8} width={ps} height={ps * 4} fill="#8B4513" />);
    elements.push(<Rect key="flame-2" x={ps * 28} y={ps * 6} width={ps} height={ps * 2} fill="#FF6B00" />);
  }
  
  return elements;
}

// ============================================================================
// PROCEDURAL TRADFI_ED/BATHROOM BACKGROUND (Post-it notes)
// ============================================================================

function TradfiedBackground({ avatar, rand }: { avatar: AvatarConfig; rand: () => number }) {
  const palette = RACE_PALETTES[avatar.race] || RACE_PALETTES.Human;
  
  const pixels: JSX.Element[] = [];
  
  // Tile wall
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const isTileEdge = y % 3 === 0 || x % 3 === 0;
      const tileColor = isTileEdge ? '#888888' : '#E8E8E8';
      pixels.push(<PixelBlock key={`tile-${x}-${y}`} x={x} y={y} color={tileColor} />);
    }
  }
  
  // Post-it notes scattered
  const postits = generatePostItNotes(avatar, palette, rand);
  
  // Mirror
  const mirror = generateBathroomMirror(palette);
  
  return (
    <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={{ position: 'absolute', zIndex: -1 }}>
      <G>{pixels}</G>
      <G>{mirror}</G>
      <G>{postits}</G>
    </Svg>
  );
}

function generatePostItNotes(avatar: AvatarConfig, palette: any, rand: () => number): JSX.Element[] {
  const elements: JSX.Element[] = [];
  const ps = PIXEL_SIZE;
  
  const postItColors = ['#FFFF88', '#FF88FF', '#88FFFF', '#88FF88', '#FFAA88', '#AAFFAA'];
  
  // Generate 8-12 post-its
  const numPostIts = 8 + Math.floor(rand() * 5);
  
  for (let i = 0; i < numPostIts; i++) {
    const px = Math.floor(rand() * (GRID_W - 5));
    const py = Math.floor(rand() * (GRID_H - 5));
    const color = postItColors[Math.floor(rand() * postItColors.length)];
    const rotation = (rand() - 0.5) * 20;
    
    // Post-it body
    elements.push(
      <G key={`postit-${i}`} transform={`rotate(${rotation}, ${(px + 2) * ps}, ${(py + 2) * ps})`}>
        <Rect x={px * ps} y={py * ps} width={ps * 4} height={ps * 4} fill={color} />
        {/* "Text" lines */}
        <Rect x={(px + 0.5) * ps} y={(py + 1) * ps} width={ps * 3} height={ps * 0.3} fill="#666666" />
        <Rect x={(px + 0.5) * ps} y={(py + 1.8) * ps} width={ps * 2.5} height={ps * 0.3} fill="#666666" />
        <Rect x={(px + 0.5) * ps} y={(py + 2.6) * ps} width={ps * 2.8} height={ps * 0.3} fill="#666666" />
      </G>
    );
  }
  
  // Add themed content hints based on class
  const classHints: Record<string, string> = {
    Merchant: '💰 📈 💵',
    Scholar: '📚 🎓 ✏️',
    Alchemist: '⚗️ 🧪 📝',
    Hacker: '💻 🔐 📊',
  };
  
  return elements;
}

function generateBathroomMirror(palette: any): JSX.Element[] {
  const elements: JSX.Element[] = [];
  const ps = PIXEL_SIZE;
  
  // Mirror frame
  elements.push(<Rect key="mirror-frame" x={ps * 8} y={ps * 5} width={ps * 14} height={ps * 18} fill={palette.dark} />);
  // Mirror surface
  elements.push(<Rect key="mirror-surface" x={ps * 9} y={ps * 6} width={ps * 12} height={ps * 16} fill="#B8D4E8" />);
  // Mirror shine
  elements.push(<Rect key="mirror-shine" x={ps * 10} y={ps * 7} width={ps * 2} height={ps * 8} fill="#FFFFFF" opacity={0.3} />);
  
  // Sink below
  elements.push(<Rect key="sink-counter" x={ps * 6} y={ps * 24} width={ps * 18} height={ps * 3} fill="#DDDDDD" />);
  elements.push(<Rect key="sink-basin" x={ps * 11} y={ps * 25} width={ps * 8} height={ps * 2} fill="#AAAAAA" />);
  elements.push(<Rect key="faucet" x={ps * 14} y={ps * 23} width={ps * 2} height={ps * 2} fill="#C0C0C0" />);
  
  return elements;
}

// ============================================================================
// MAIN BACKGROUND COMPONENT
// ============================================================================

export function ProceduralBackground({ avatar, section }: BackgroundProps) {
  const rand = useMemo(() => seededRandom(avatar.name + avatar.race + avatar.class), [avatar]);
  
  switch (section) {
    case 'workspace':
      return <WorkspaceBackground avatar={avatar} rand={rand} />;
    case 'mailbox':
      return <MailboxBackground avatar={avatar} rand={rand} />;
    case 'dashboard':
      return <DashboardBackground avatar={avatar} rand={rand} />;
    case 'tradfi_ed':
      return <TradfiedBackground avatar={avatar} rand={rand} />;
    default:
      return <DashboardBackground avatar={avatar} rand={rand} />;
  }
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================
/*
import { ProceduralBackground } from './expo_procedural_backgrounds';

function WorkspaceScreen() {
  const avatar = {
    name: 'ShadowBlade',
    race: 'Dark Elf',
    class: 'Assassin',
    occupation: 'Spy',
  };

  return (
    <View style={{ flex: 1 }}>
      <ProceduralBackground avatar={avatar} section="workspace" />
      {/* Your actual workspace UI here *\/}
      <WorkspaceContent />
    </View>
  );
}
*/

// ============================================================================
// CATEGORY CONSTANTS (For reference/validation)
// ============================================================================

export const CLASSES = [
  'Warrior', 'Ninja', 'Mage', 'Healer', 'Ranger', 'Merchant', 'Scholar', 'Bard',
  'Paladin', 'Rogue', 'Necromancer', 'Monk', 'Berserker', 'Samurai', 'Druid',
  'Alchemist', 'Assassin', 'Knight', 'Sorcerer', 'Shaman', 'Templar', 'Hunter',
  'Summoner', 'Warlock'
];

export const RACES = [
  'Human', 'Elf', 'Dark Elf', 'Dwarf', 'Orc', 'Halfling', 'Dragonkin', 'Fae',
  'Vampire', 'Werewolf', 'Angel', 'Cyborg', 'Alien', 'Golem', 'Elemental',
  'Undead', 'Giant', 'Merfolk', 'Centaur', 'Troll', 'Gnome', 'Sprite', 'Phoenix'
];

export const OCCUPATIONS = [
  'Rapper', 'Pop Singer', 'Superhero', 'Detective', 'Chef', 'Artist', 'Pilot',
  'Explorer', 'Inventor', 'Athlete', 'Bounty Hunter', 'Spy', 'Astronaut', 'Doctor',
  'Scientist', 'Pirate', 'Gladiator', 'Thief', 'Blacksmith', 'Dancer', 'Musician',
  'Actor', 'Writer', 'Archaeologist', 'Hacker', 'Streamer', 'Rebel', 'Prophet',
  'Gambler', 'Outlaw'
];

export default ProceduralBackground;
