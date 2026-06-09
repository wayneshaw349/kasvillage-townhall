// ============================================================================
// KASVILLAGE IDENTITY RITUAL - INSANELY DETAILED PROCEDURAL AVATAR
// ============================================================================
// 
// 7-Phase ritual generating ~10,000+ point SVG silhouettes from user answers
// Each keystroke spawns procedural elements, colors applied by user
// Jitter collected throughout, hashed and verified on TownHall
//
// Phase 1: Spawn      - Name + Race â†’ Base silhouette
// Phase 2: Origin    - Origin Story â†’ Keywords spawn item outlines
// Phase 3: The Scenario    - Class/Occupation/Animal â†’ Equipment snaps to body
// Phase 4: The Gear-Up      - Personality/Combat â†’ Color + finger paint
// Phase 5: The Craft    - Philosophy/Power/Move â†’ Aura effects
// Phase 6: Special Powers       - Quiz verification â†’ Drag ball to hoop
// Phase 7: Customs Interview     - Hash recipe â†’ TownHall â†’ L1 â†’ Passport
// ============================================================================

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StyleSheet,
  PanResponder,
  Animated,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  Linking,
} from 'react-native';
import Svg, { Path, G, Defs, LinearGradient, Stop, Circle, Ellipse, RadialGradient, Rect, Line, Text as SvgText } from 'react-native-svg';
import * as Crypto from 'expo-crypto';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import { inscribeIdentity } from './identity_inscription_v6';
import { createWallet, getRegistrationData } from './wallet_registration_v2';
import { inscribeIdentityViaRest } from './kaspa_rest_tx';
import { uploadToTurbo } from './arweave_upload';
import { storeAvatarLocally, computeAvatarHash } from './avatar_silhouette_generator';
import type { ArweaveTag } from './arweave_upload';
import { KaspaClient } from './KaspaClient';
import { 
  generateQuestionBank as generateQuestionBankFromFile,
  selectQuizQuestions,
  parseColorPair,
  isColorSwatchQuestion,
  QuizQuestion as BankQuizQuestion,
  QuizRecipe,
} from './Question_bank';

// ============================================================================
// IMPORT EXTERNAL SILHOUETTE GENERATORS
// ============================================================================
import { 
  generateElfSilhouette, 
  generateDarkElfSilhouette, 
  generateDwarfSilhouette, 
  generateAlienSilhouette 
} from './elf_darkelf_dwarf_alien_silhouettes';
import { 
  generateOrcSilhouette, 
  generateHalflingSilhouette 
} from './orc_halfling_silhouettes';
import { generateTrollSilhouette } from './troll_silhouette';
import { 
  generateVampireSilhouette, 
  generateWerewolfSilhouette, 
  generateAngelSilhouette 
} from './vampire_werewolf_angel_silhouettes';
import { 
  generateGiantSilhouette, 
  generateMerfolkSilhouette, 
  generateCentaurSilhouette 
} from './giant_merfolk_centaur_silhouettes';
import { 
  generateGnomeSilhouette, 
  generatePhoenixSilhouette, 
  generateSpriteSilhouette 
} from './gnome_phoenix_sprite_silhouettes';
import { 
  generateGolemSilhouette, 
  generateElementalSilhouette, 
  generateUndeadSilhouette 
} from './golem_elemental_undead_silhouettes';
import { 
  generateDragonkinSilhouette, 
  generateFaeSilhouette 
} from './dragonkin_fae_silhouettes';

// ============================================================================
// IMPORT EXPANDED LEXICON, COLORS, AND UTILITIES
// ============================================================================
import {
  LEXICON,
  buildKeywordPatterns,
  parseTextForItems,
  combineKeywords,
  COLOR_PALETTES,
  AVATAR_COLOR_REGIONS,
  mixColors,
  lightenColor,
  darkenColor,
  saturateColor,
  generateGradient,
  getComplementary,
  getAnalogous,
  CLASS_UNIFORMS,
  OCCUPATION_GEAR,
  ANIMAL_SPIRITS,
  DraggableItem,
  DraggableItemState,
  createJitterCommitment,
  analyzeTypingCadence,
  SVG_GENERATORS,
  getSvgForKeyword,
} from './keyword_dictionary_draggable';
import { registerPushToken, inscribePushToken } from './push_notifications';
import { getDeviceHash, storeSerialHash, getSerialHash } from './device_attestation';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SVG_WIDTH = 400;
const SVG_HEIGHT = 1050;

// ============================================================================
// CANONICAL COORDINATE SYSTEM
// ============================================================================
// All SVG content uses this coordinate system:
// - Center X: 200 (middle of 400 width)
// - Center Y: 300 (middle of 600 height)
// - Body occupies roughly: x(100-300), y(50-550)
// - Items from keyword_dictionary: centered at (200, 250-350)
// - Shield/Coat of Arms: x(40-360), y(30-560)
//
// QUADRANT SYSTEM for Coat of Arms (within shield bounds):
// ┌─────────────────────────────┐
// │  Q1 (100,150)   Q2 (300,150)│  <- Top row
// │         ┌─────────┐         │
// │         │  AVATAR │         │
// │         │ (200,300)│         │
// │         └─────────┘         │
// │  Q3 (100,450)   Q4 (300,450)│  <- Bottom row
// └─────────────────────────────┘

const CANONICAL = {
  center: { x: 200, y: 300 },
  avatar: { x: 200, y: 300, width: 200, height: 400 },
  shield: { x: 200, y: 295, width: 320, height: 530 },
  quadrants: [
    { id: 'Q1', x: 110, y: 160, name: 'top-left' },
    { id: 'Q2', x: 290, y: 160, name: 'top-right' },
    { id: 'Q3', x: 110, y: 440, name: 'bottom-left' },
    { id: 'Q4', x: 290, y: 440, name: 'bottom-right' },
  ],
  // Item center point (where keyword items are drawn around)
  itemCenter: { x: 200, y: 300 },
  // Scale factor to fit items in quadrant (items are ~200px, quadrant is ~60px usable)
  // Reduced from 0.20 to 0.12 to keep items inside shield bounds
  itemToQuadrantScale: 0.12,
  // Field to quadrant mapping:
  // Q1 (top-left): originStory, formativeMemory
  // Q2 (top-right): scenarioDesire, characterDescription
  // Q3 (bottom-left): class (uniform + weapon)
  // Q4 (bottom-right): occupation (gear + tools)
  fieldToQuadrant: {
    'originStory': 0,
    'formativeMemory': 0,
    'scenarioConflict': 0,
    'scenarioMoral': 0,
    'scenarioFear': 0,
    'scenarioDesire': 1,
    'characterDescription': 1,
    'voiceLine': 1,
    'weakness': 1,
    'class': 2,
    'occupation': 3,
    'animal': 3,
  } as Record<string, 0 | 1 | 2 | 3>,
};

// ============================================================================
// TYPES
// ============================================================================

interface JitterSample {
  timestamp: number;
  delta: number;
  key?: string;
  pressure?: number;        // Touch pressure (0-1, if available)
  hesitation?: number;      // Time from display → tap (ms)
  eventType?: 'keystroke' | 'tap' | 'swipe' | 'color' | 'select';
}

interface StrokePath {
  points: { x: number; y: number; pressure: number }[];
  color: string;
  width: number;
}

interface AvatarRecipe {
  // Phase 1
  name: string;
  race: string;
  gender: 'male' | 'female';
  hairStyle: 'bald' | 'afro' | 'mohawk' | 'spikes' | 'flowing' | 'sculptural' | 'wild' | 'braids' | 'ponytail' | 'short';
  bangNickname: string;  // User's custom nickname for groin area (displayed on BANG censor)
  bangNicknameChestL: string;  // Left chest BANG nickname (female only)
  bangNicknameChestR: string;  // Right chest BANG nickname (female only)
  hairBangNickname: string;  // User's custom text displayed on forehead bangs
  
  // Phase 2 - Origin & Memory
  originStory: string;
  formativeMemory: string;
  parsedKeywords: string[];
  
  // Phase 2.5 - Character Scenarios (open-ended, keywords extracted for quiz)
  scenarioConflict: string;      // "How would your character handle a betrayal?"
  scenarioMoral: string;         // "Your character finds stolen gold. What do they do?"
  scenarioFear: string;          // "What does your character fear most?"
  scenarioDesire: string;        // "What drives your character forward?"
  characterDescription: string;  // "Describe your character in your own words"
  weakness: string;              // "What is your character's greatest weakness?"
  voiceLine: string;             // "What is your character's catchphrase?"
  
  // Extracted keywords from ALL text fields (for quiz verification)
  allExtractedKeywords: string[];
  
  // Phase 3
  class: string;
  occupation: string;
  animal: string;
  
  // Phase 4
  personality: string;
  combatStyle: string;
  colors: Record<string, string>;
  strokes: StrokePath[];
  
  // Phase 5
  lifePhilosophy: string;
  powerSpike: string;
  signatureMove: string;
  auraParams: AuraParams;
  
  // Phase 6
  quizPassed: boolean;
  avatarHidden: boolean;  // Hide silhouette body
  uniformHidden: boolean; // Hide class uniform
  gearHidden: boolean;    // Hide occupation gear
  petHidden: boolean;     // Hide spirit animal pet
  auraHidden: boolean;    // Hide aura effects
  
  // Draggable outfit offsets (user can reposition uniform/gear on avatar)
  uniformOffsetX: number;
  uniformOffsetY: number;
  gearOffsetX: number;
  gearOffsetY: number;
  crestOffsetX: number;
  crestOffsetY: number;
  allOffsetX: number;   // Move entire image (avatar + crest + gear) together
  allOffsetY: number;
  
  // Phase 7 - Hashes for verification
  recipeHash: string;
  jitterCommitment: string;
  passportId: string;
  keywordMerkleRoot: string;     // Merkle root of all keywords for TownHall verification
  scenarioHash: string;          // Hash of scenario answers for challenge-response
}

// Keyword commitment for TownHall verification
interface KeywordCommitment {
  keyword: string;
  salt: string;
  hash: string;  // SHA256(keyword + salt)
}

interface AuraParams {
  color1: string;
  color2: string;
  pulseSpeed: number;
  intensity: number;
  pattern: 'radial' | 'flame' | 'electric' | 'divine';
}

interface RitualState {
  phase: number;
  recipe: AvatarRecipe;
  silhouettePaths: string[];
  colorablePaths: ColorablePath[];  // New: paths with region tags for coloring
  spawnedItems: SpawnedItem[];      // New: draggable items from keywords
  jitterSamples: JitterSample[];
  lastKeystroke: number;
  quizQuestions: QuizQuestion[];    // Multiple questions
  currentQuizIndex: number;         // Which question we're on
  quizScore: number;                // Correct answers count
  quizRetries: number;              // Quiz retry counter (1 retry then full restart)
  showQuizResult: 'none' | 'passed' | 'failed' | 'restart';
  livenessScore: number;            // New: 0-100 entropy score
  passedLivenessCheck: boolean;     // New: binary pass/fail for storage
  colorMixHistory: ColorMix[];      // Track color mixes for quiz
  drawingStrokes: DrawingStroke[];  // Finger paint strokes
}

// Color mix for quiz verification
interface ColorMix {
  color1: string;
  color2: string;
  result: string;
  region: string;
  timestamp: number;
}

// Drawing stroke from finger painting
interface DrawingStroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

// Colorable path with region assignment for coloring book
interface ColorablePath {
  d: string;                    // SVG path data
  region: string;               // 'skin' | 'hair' | 'eyes' | 'lips' | 'primary' | 'secondary' | etc
  baseColor?: string;           // Default color before user paints
  zIndex: number;               // Layer order
}

// Spawned item from keyword detection - draggable
interface SpawnedItem {
  id: string;
  keyword: string;
  paths: string[];              // SVG paths for this item
  x: number;                    // Position (draggable)
  y: number;
  scale: number;
  rotation: number;
  flipX: boolean;               // Horizontal flip
  flipY: boolean;               // Vertical flip
  colorRegions: Record<string, string>;  // Item-specific colors
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  locked: boolean;              // Once placed, can lock
  quadrant: 0 | 1 | 2 | 3;      // Which quadrant (Q1-Q4) this item belongs to
  sourceField: string;          // Which field spawned this item
}

interface QuizQuestion {
  question: string;
  correctAnswer: string;
  options: string[];
  trait: string;
  isVisual?: boolean;
}

// ============================================================================
// INSANELY DETAILED BEZIER PRIMITIVES (~10,000 points per full avatar)
// ============================================================================

// Helper: Generate smooth bezier curve with detail
function bezier(points: number[][]): string {
  if (points.length < 2) return '';
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i += 2) {
    if (i + 1 < points.length) {
      d += ` Q${points[i][0]},${points[i][1]} ${points[i + 1][0]},${points[i + 1][1]}`;
    }
  }
  return d;
}

// Helper: Generate detailed curve with many control points
function detailedCurve(
  startX: number, startY: number,
  endX: number, endY: number,
  variance: number,
  segments: number
): string {
  const points: number[][] = [[startX, startY]];
  const dx = (endX - startX) / segments;
  const dy = (endY - startY) / segments;
  
  for (let i = 1; i <= segments; i++) {
    const x = startX + dx * i + (Math.sin(i * 0.7) * variance);
    const y = startY + dy * i + (Math.cos(i * 0.5) * variance);
    points.push([x, y]);
  }
  
  return bezier(points);
}

// Helper: Generate organic texture curves
function organicTexture(
  centerX: number, centerY: number,
  radius: number,
  detail: number
): string[] {
  const paths: string[] = [];
  for (let i = 0; i < detail; i++) {
    const angle = (i / detail) * Math.PI * 2;
    const r = radius * (0.8 + Math.sin(i * 3.7) * 0.2);
    const x = centerX + Math.cos(angle) * r;
    const y = centerY + Math.sin(angle) * r;
    const innerR = r * 0.3;
    paths.push(`M${centerX},${centerY} Q${x - innerR},${y - innerR} ${x},${y}`);
  }
  return paths;
}

// ============================================================================
// RACE SILHOUETTES (Base body ~3000 points each)
// ============================================================================

// Race visual scale - how big each race appears on screen
// Giant = 1.05x, Human = 0.68x (scaled down - internal generator draws larger), Sprite = 0.42x
// All scaled down to fit in viewBox window
const RACE_VISUAL_SCALE: Record<string, number> = {
  // Massive (scaled down to fit)
  giant: 1.05,
  golem: 1.0,
  troll: 0.98,
  beast: 0.98,
  centaur: 0.95,
  // Large
  orc: 0.92,
  werewolf: 0.92,
  dragonkin: 0.9,
  elemental: 0.88,
  // Medium
  vampire: 0.85,
  angel: 0.86,
  undead: 0.83,
  // Human - internal generator draws larger, needs extra scale down
  human: 0.50,
  // Slim/Medium
  elf: 0.82,
  darkelf: 0.82,
  merfolk: 0.8,
  alien: 0.78,
  // Small
  dwarf: 0.72,
  halfling: 0.6,
  gnome: 0.55,
  fae: 0.5,
  phoenix: 0.48,
  sprite: 0.42,
};

// Get visual scale for race (fallback to 1.0)
const getRaceVisualScale = (race: string): number => {
  return RACE_VISUAL_SCALE[race?.toLowerCase()] ?? 1.0;
};

// Race-specific body parameters for uniform/gear scaling
// torsoY = actual torsoTop from each race's generator (where shoulder line begins)
// External generators: torsoTop = baseY + headH * neckFactor + neckH
// Internal generators: human/cyborg/mutant/ethereal = 330, beast = 310
const RACE_BODY_PARAMS: Record<string, { 
  male: { shoulderWidth: number; torsoY: number; torsoScale: number };
  female: { shoulderWidth: number; torsoY: number; torsoScale: number };
}> = {
  // Internal generators (expo_identity_ritual's own generateHumanSilhouette)
  // These draw at Y=330 range, scaled by RACE_VISUAL_SCALE
  human: { 
    male: { shoulderWidth: 1.15, torsoY: 330, torsoScale: 1.0 },
    female: { shoulderWidth: 0.92, torsoY: 330, torsoScale: 0.95 }
  },
  cyborg: { 
    male: { shoulderWidth: 1.15, torsoY: 330, torsoScale: 1.0 },
    female: { shoulderWidth: 0.92, torsoY: 330, torsoScale: 0.95 }
  },
  mutant: { 
    male: { shoulderWidth: 1.2, torsoY: 330, torsoScale: 1.05 },
    female: { shoulderWidth: 1.0, torsoY: 330, torsoScale: 1.0 }
  },
  ethereal: { 
    male: { shoulderWidth: 0.95, torsoY: 330, torsoScale: 0.9 },
    female: { shoulderWidth: 0.8, torsoY: 330, torsoScale: 0.85 }
  },
  beast: { 
    male: { shoulderWidth: 1.3, torsoY: 310, torsoScale: 1.15 },
    female: { shoulderWidth: 1.1, torsoY: 310, torsoScale: 1.1 }
  },
  // External generators — torsoTop calculated from each file's baseY + headH*neckFactor + neckH
  // elf_darkelf_dwarf_alien: baseY=42 headH=48 neckF=1.02 neckH=28 → torsoTop≈119
  elf: { 
    male: { shoulderWidth: 1.0, torsoY: 119, torsoScale: 0.95 },
    female: { shoulderWidth: 0.85, torsoY: 119, torsoScale: 0.9 }
  },
  darkelf: { 
    male: { shoulderWidth: 1.0, torsoY: 119, torsoScale: 0.95 },
    female: { shoulderWidth: 0.85, torsoY: 119, torsoScale: 0.9 }
  },
  dwarf: { 
    male: { shoulderWidth: 1.1, torsoY: 119, torsoScale: 0.85 },
    female: { shoulderWidth: 0.95, torsoY: 119, torsoScale: 0.8 }
  },
  alien: { 
    male: { shoulderWidth: 0.9, torsoY: 119, torsoScale: 0.88 },
    female: { shoulderWidth: 0.8, torsoY: 119, torsoScale: 0.85 }
  },
  // orc_halfling: baseY=48 headH=52 neckF=1.0 neckH=22 → torsoTop≈122
  orc: { 
    male: { shoulderWidth: 1.25, torsoY: 122, torsoScale: 1.1 },
    female: { shoulderWidth: 1.05, torsoY: 122, torsoScale: 1.05 }
  },
  halfling: { 
    male: { shoulderWidth: 0.85, torsoY: 122, torsoScale: 0.75 },
    female: { shoulderWidth: 0.75, torsoY: 122, torsoScale: 0.7 }
  },
  // golem_elemental_undead: baseY=32 headH=55 neckF=1.02 neckH=25 → torsoTop≈113
  golem: { 
    male: { shoulderWidth: 1.4, torsoY: 113, torsoScale: 1.25 },
    female: { shoulderWidth: 1.2, torsoY: 113, torsoScale: 1.2 }
  },
  elemental: { 
    male: { shoulderWidth: 1.15, torsoY: 113, torsoScale: 1.0 },
    female: { shoulderWidth: 0.95, torsoY: 113, torsoScale: 0.95 }
  },
  undead: { 
    male: { shoulderWidth: 1.0, torsoY: 113, torsoScale: 0.92 },
    female: { shoulderWidth: 0.85, torsoY: 113, torsoScale: 0.88 }
  },
  // giant_merfolk_centaur: baseY=25 headH=58 neckF=1.04 neckH=22 → torsoTop≈107
  giant: { 
    male: { shoulderWidth: 1.35, torsoY: 107, torsoScale: 1.2 },
    female: { shoulderWidth: 1.15, torsoY: 107, torsoScale: 1.15 }
  },
  merfolk: { 
    male: { shoulderWidth: 1.05, torsoY: 107, torsoScale: 0.95 },
    female: { shoulderWidth: 0.9, torsoY: 107, torsoScale: 0.9 }
  },
  centaur: { 
    male: { shoulderWidth: 1.2, torsoY: 107, torsoScale: 1.1 },
    female: { shoulderWidth: 1.0, torsoY: 107, torsoScale: 1.05 }
  },
  // troll: baseY=38 headH=55 neckF=1.1 neckH=20 → torsoTop≈119
  troll: { 
    male: { shoulderWidth: 1.3, torsoY: 119, torsoScale: 1.15 },
    female: { shoulderWidth: 1.1, torsoY: 119, torsoScale: 1.1 }
  },
  // gnome_phoenix_sprite: baseY=55 headH=48 neckF=1.0 neckH=12 → torsoTop≈115
  gnome: { 
    male: { shoulderWidth: 0.8, torsoY: 115, torsoScale: 0.72 },
    female: { shoulderWidth: 0.7, torsoY: 115, torsoScale: 0.68 }
  },
  phoenix: { 
    male: { shoulderWidth: 1.0, torsoY: 115, torsoScale: 0.9 },
    female: { shoulderWidth: 0.85, torsoY: 115, torsoScale: 0.85 }
  },
  sprite: { 
    male: { shoulderWidth: 0.6, torsoY: 115, torsoScale: 0.55 },
    female: { shoulderWidth: 0.55, torsoY: 115, torsoScale: 0.5 }
  },
  // vampire_werewolf_angel: baseY=42 headH=48 neckF=1.05 neckH=25 → torsoTop≈117
  vampire: { 
    male: { shoulderWidth: 1.05, torsoY: 117, torsoScale: 0.98 },
    female: { shoulderWidth: 0.88, torsoY: 117, torsoScale: 0.93 }
  },
  werewolf: { 
    male: { shoulderWidth: 1.25, torsoY: 117, torsoScale: 1.1 },
    female: { shoulderWidth: 1.05, torsoY: 117, torsoScale: 1.05 }
  },
  angel: { 
    male: { shoulderWidth: 1.1, torsoY: 117, torsoScale: 1.0 },
    female: { shoulderWidth: 0.9, torsoY: 117, torsoScale: 0.95 }
  },
  // dragonkin_fae: baseY=38 headH=50 neckF=1.04 neckH=28 → torsoTop≈118
  dragonkin: { 
    male: { shoulderWidth: 1.2, torsoY: 118, torsoScale: 1.05 },
    female: { shoulderWidth: 1.0, torsoY: 118, torsoScale: 1.0 }
  },
  fae: { 
    male: { shoulderWidth: 0.75, torsoY: 118, torsoScale: 0.7 },
    female: { shoulderWidth: 0.65, torsoY: 118, torsoScale: 0.65 }
  },
};

// Get body params for a race, fallback to human
const getRaceBodyParams = (race: string, gender: 'male' | 'female') => {
  const raceParams = RACE_BODY_PARAMS[race?.toLowerCase()] || RACE_BODY_PARAMS.human;
  return raceParams[gender];
};

// Helper to convert gender string to type expected by generators
type SilhouetteGender = 'male' | 'female';
const toSilhouetteGender = (g: string): SilhouetteGender => (g === 'female' ? 'female' : 'male');

// Generate unique seed from name for deterministic but unique avatars
const generateSeedFromName = (name: string): number => {
  let seed = 0;
  for (let i = 0; i < name.length; i++) {
    seed = ((seed << 5) - seed) + name.charCodeAt(i);
    seed = seed & seed; // Convert to 32bit integer
  }
  return Math.abs(seed) % 1000;
};

// Hair style seed offsets - each style gets a unique seed modifier
// This ensures selecting a style produces consistent results
const HAIR_STYLE_SEEDS: Record<string, number> = {
  bald: 20000,      // Unique range so generateHumanSilhouette detects it
  spikes: 1000,
  afro: 2000,
  mohawk: 3000,
  tentacles: 4000,
  crown: 5000,
  flowing: 6000,
  sculptural: 7000,
  punk: 8000,
  wild: -1,          // Sentinel: handleTextChange uses Date.now() for wild combo
  braids: 9000,
  ponytail: 10000,
  short: 11000,
  // Feminine styles
  bouffant: 12000,
  pageboy: 13000,
  beehive: 14000,
  pigtails: 15000,
  buns: 16000,
  waves: 17000,
  bangs: 18000,
  updo: 19000,
};

// ============================================================================
// COLORABLE PATH SYSTEM - Coloring book approach
// ============================================================================

// Path region detection based on position and path index
// First paths are typically head/skin, then body, then details
const assignPathRegion = (pathIndex: number, totalPaths: number, d: string): string => {
  // Parse path to find approximate Y center — extract only M/L/Q/C endpoint Y values
  const getPathYCenter = (path: string): number => {
    const yVals: number[] = [];
    // Match Move/Line endpoints: M/L x,y
    const mlMatches = path.matchAll(/[ML]\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/g);
    for (const m of mlMatches) {
      const y = parseFloat(m[2]);
      if (!isNaN(y) && y > 0 && y < 1200) yVals.push(y);
    }
    // Match Q/C final control points (last pair)
    const qMatches = path.matchAll(/Q\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/g);
    for (const m of qMatches) {
      const y = parseFloat(m[4]);
      if (!isNaN(y) && y > 0 && y < 1200) yVals.push(y);
    }
    if (yVals.length === 0) return 300;
    return yVals.reduce((a, b) => a + b, 0) / yVals.length;
  };
  
  const yCenter = getPathYCenter(d);
  const pathLen = d.length;
  
  // HAIR - first few paths or very high Y
  if (pathIndex < 3 && yCenter < 150) return 'hair';
  if (pathIndex < 20 && yCenter < 80) return 'hair';
  
  // HEAD REGION (y < 270)
  if (yCenter < 270) {
    // Eyes — detect arc commands (iris/pupil) or small eye-shaped paths in eye zone
    if (d.includes('A8,8') || d.includes('A3,3') || d.includes('A4,4') || d.includes('A5,5') || d.includes('A5,6') || d.includes('A2,3')) {
      return 'eyes';
    }
    // Eyes — small paths in Y 120-165 zone (eye sockets, lids, lashes)
    if (yCenter > 120 && yCenter < 165 && pathLen < 200) {
      return 'eyes';
    }
    // Eyelashes — very short paths near eye zone
    if (yCenter > 120 && yCenter < 135 && pathLen < 60) {
      return 'eyes';
    }
    // Eyebrows — paths in Y 100-125 zone, short strokes
    if (yCenter > 95 && yCenter < 130 && pathLen < 120) {
      return 'eyebrows';
    }
    // Hair — top of head
    if (yCenter < 100) return 'hair';
    // Lips — paths around y=200-250
    if (yCenter > 195 && yCenter < 255 && pathLen < 400) {
      return 'lips';
    }
    // Nose — narrow zone
    if (yCenter > 160 && yCenter < 200 && pathLen < 300) {
      return 'skin';
    }
    // Default face/skin
    return 'skin';
  }
  
  // NECK REGION (y 260-340)
  if (yCenter < 340) return 'skin';
  
  // TORSO REGION (y 340-600)
  if (yCenter < 600) return 'primary';
  
  // LOWER BODY (y > 600)
  if (yCenter < 750) return 'secondary';
  
  // FEET/DETAILS
  return 'accent';
};

// Convert flat paths array to colorable paths with regions
const pathsToColorable = (paths: string[]): ColorablePath[] => {
  return paths.map((d, i) => ({
    d,
    region: assignPathRegion(i, paths.length, d),
    zIndex: i,
  }));
};

// Calculate liveness score from jitter samples (0-100)
const calculateLivenessScore = (samples: JitterSample[]): number => {
  if (samples.length < 10) return 0;
  
  // Analyze timing variance - real humans have natural variance
  const deltas = samples.map(s => s.delta).filter(d => d > 0 && d < 2000);
  if (deltas.length < 5) return 0;
  
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const variance = deltas.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / deltas.length;
  const stdDev = Math.sqrt(variance);
  
  // Bots have too-consistent timing (low variance) or random noise (too high variance)
  // Humans typically 80-300ms between keystrokes with moderate variance
  
  let score = 0;
  
  // Mean check (50-400ms is human range)
  if (mean > 50 && mean < 400) score += 20;
  else if (mean > 30 && mean < 600) score += 10;
  
  // Variance check (stdDev 30-150 is human range)
  if (stdDev > 30 && stdDev < 150) score += 20;
  else if (stdDev > 15 && stdDev < 250) score += 10;
  
  // Sample count bonus
  if (samples.length > 50) score += 10;
  else if (samples.length > 20) score += 5;
  
  // Burstiness check - humans have natural pauses
  const longPauses = deltas.filter(d => d > 500).length;
  const burstRatio = longPauses / deltas.length;
  if (burstRatio > 0.05 && burstRatio < 0.3) score += 15;
  else if (burstRatio > 0.02) score += 8;
  
  // Rhythm check - humans aren't perfectly rhythmic
  const rhythmVariance = deltas.slice(1).map((d, i) => Math.abs(d - deltas[i]));
  const rhythmScore = rhythmVariance.reduce((a, b) => a + b, 0) / rhythmVariance.length;
  if (rhythmScore > 20 && rhythmScore < 200) score += 10;
  
  // === HESITATION SCORING (new) ===
  const hesitations = samples.filter(s => s.hesitation && s.hesitation > 0).map(s => s.hesitation!);
  if (hesitations.length >= 3) {
    const hesitationMean = hesitations.reduce((a, b) => a + b, 0) / hesitations.length;
    const hesitationVariance = hesitations.reduce((a, b) => a + Math.pow(b - hesitationMean, 2), 0) / hesitations.length;
    const hesitationStdDev = Math.sqrt(hesitationVariance);
    
    // Bots tap instantly (<200ms) or at exact intervals
    // Humans hesitate 400ms-3000ms with variance
    if (hesitationMean > 400 && hesitationMean < 4000) score += 10;
    
    // Human hesitation has natural variance (thinking time varies)
    if (hesitationStdDev > 200 && hesitationStdDev < 2000) score += 10;
    
    // Check for suspiciously consistent hesitation (bot signature)
    const cv = hesitationStdDev / hesitationMean;
    if (cv < 0.1) score -= 15; // Too consistent = bot
    else if (cv > 0.2 && cv < 1.0) score += 5; // Natural variance
  }
  
  return Math.min(100, score);
};

// Body attachment points for items
const BODY_ATTACHMENT_POINTS: Record<string, { x: number; y: number; slot: string }> = {
  // Weapons - hands
  sword: { x: 320, y: 280, slot: 'right_hand' },
  gun: { x: 320, y: 280, slot: 'right_hand' },
  bow: { x: 80, y: 250, slot: 'left_hand' },
  staff: { x: 320, y: 250, slot: 'right_hand' },
  axe: { x: 320, y: 280, slot: 'right_hand' },
  hammer: { x: 320, y: 280, slot: 'right_hand' },
  spear: { x: 320, y: 250, slot: 'right_hand' },
  scythe: { x: 320, y: 250, slot: 'right_hand' },
  
  // Shields - left arm
  shield: { x: 80, y: 280, slot: 'left_arm' },
  
  // Head gear
  crown: { x: 200, y: 30, slot: 'head_top' },
  mask: { x: 200, y: 100, slot: 'face' },
  horns: { x: 200, y: 40, slot: 'head_top' },
  
  // Back attachments
  wings: { x: 200, y: 180, slot: 'back' },
  cloak: { x: 200, y: 150, slot: 'back' },
  
  // Body additions
  tail: { x: 200, y: 450, slot: 'lower_back' },
  
  // Accessories
  flower: { x: 150, y: 60, slot: 'hair' },
  book: { x: 80, y: 320, slot: 'left_hand' },
  potion: { x: 280, y: 380, slot: 'belt' },
  
  // Musical
  mic: { x: 230, y: 200, slot: 'face' },
  guitar: { x: 200, y: 300, slot: 'torso' },
  drums: { x: 200, y: 400, slot: 'ground' },
  
  // Tools
  wrench: { x: 280, y: 380, slot: 'belt' },
  
  // Animals (floating near character)
  wolf: { x: 350, y: 450, slot: 'companion' },
  eagle: { x: 350, y: 80, slot: 'companion' },
  lion: { x: 350, y: 450, slot: 'companion' },
  dragon: { x: 350, y: 100, slot: 'companion' },
  bear: { x: 350, y: 450, slot: 'companion' },
  snake: { x: 280, y: 350, slot: 'arm' },
  phoenix: { x: 200, y: 50, slot: 'above' },
};

// Get attachment point for keyword, with fallback to staging area
const getAttachmentPoint = (keyword: string, existingItems: SpawnedItem[]): { x: number; y: number } => {
  const attachment = BODY_ATTACHMENT_POINTS[keyword];
  
  if (attachment) {
    // Check if slot already occupied
    const slotOccupied = existingItems.some(item => {
      const itemAttachment = BODY_ATTACHMENT_POINTS[item.keyword];
      return itemAttachment?.slot === attachment.slot && item.locked;
    });
    
    if (!slotOccupied) {
      return { x: attachment.x, y: attachment.y };
    }
    // Slot occupied, offset slightly
    return { x: attachment.x + 30, y: attachment.y + 20 };
  }
  
  // No defined attachment - spawn in staging area (bottom right)
  const stagingX = 320 + (existingItems.length % 3) * 30;
  const stagingY = 500 + Math.floor(existingItems.length / 3) * 30;
  return { x: stagingX, y: stagingY };
};

// Spawn an item from keyword - positioned at body attachment point
const spawnItemFromKeyword = (keyword: string, existingItems: SpawnedItem[]): SpawnedItem | null => {
  // Get SVG paths using the comprehensive generator system
  const paths = getSvgForKeyword(keyword);
  if (paths.length === 0) return null;
  
  // Get attachment point for this keyword
  const { x, y } = getAttachmentPoint(keyword, existingItems);
  
  // Determine rarity based on LEXICON category
  const lexEntry = LEXICON[keyword];
  const categoryRarity: Record<string, string> = {
    'weapon_legendary': 'legendary',
    'weapon_magic': 'rare',
    'accessory_magic': 'rare',
    'creature_mythical': 'legendary',
    'divine': 'legendary',
    'dark': 'rare',
    'element': 'uncommon',
    'nature': 'common',
  };
  const rarity = (lexEntry?.category && categoryRarity[lexEntry.category]) || 'common';
  
  return {
    id: `${keyword}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    keyword,
    paths,
    x,
    y,
    scale: 0.5,
    rotation: 0,
    flipX: false,
    flipY: false,
    colorRegions: {},
    rarity: rarity as 'common' | 'uncommon' | 'rare' | 'legendary',
    locked: false,
    quadrant: 0 as 0 | 1 | 2 | 3,
    sourceField: '',
  };
};
 

// All 21 races organized by category
const ALL_RACES: { category: string; races: string[] }[] = [
  { category: 'Common', races: ['human', 'elf', 'dwarf', 'halfling', 'gnome'] },
  { category: 'Exotic', races: ['darkelf', 'orc', 'troll', 'alien'] },
  { category: 'Mystical', races: ['ethereal', 'fae', 'sprite', 'elemental', 'phoenix'] },
  { category: 'Monstrous', races: ['beast', 'mutant', 'dragonkin', 'werewolf', 'vampire'] },
  { category: 'Legendary', races: ['angel', 'golem', 'undead', 'giant', 'merfolk', 'centaur', 'cyborg'] },
];

// Race silhouette generators with correct signatures
// Some take (gender, seed), some take just (gender)
// Wrapper to sanitize paths and catch NaN
const sanitizePaths = (paths: string[]): string[] => {
  return paths.map(p => p.replace(/NaN/g, '0').replace(/undefined/g, '0').replace(/Infinity/g, '999'));
};

// Safe wrapper that catches errors and returns human silhouette as fallback
const safeGenerate = (fn: () => string[], fallback: () => string[]): string[] => {
  try {
    const paths = fn();
    // Check if any path contains invalid values
    const hasInvalid = paths.some(p => p.includes('NaN') || p.includes('undefined') || p.includes('Infinity'));
    if (hasInvalid) {
      console.warn('Invalid path detected, using fallback');
      return sanitizePaths(fallback());
    }
    return sanitizePaths(paths);
  } catch (e) {
    console.warn('Generator error, using fallback:', e);
    return sanitizePaths(fallback());
  }
};

const RACE_SILHOUETTES: Record<string, (gender?: string, seed?: number) => string[]> = {
  // Inline generators with gender support
  human: (g, s) => sanitizePaths(generateHumanSilhouette(toSilhouetteGender(g || 'male'), s || 1)),
  cyborg: () => sanitizePaths(generateCyborgSilhouette()),
  mutant: () => sanitizePaths(generateMutantSilhouette()),
  ethereal: () => sanitizePaths(generateEtherealSilhouette()),
  beast: () => sanitizePaths(generateBeastSilhouette()),
  
  // External generators with (gender, seed) signature - wrapped with fallback
  elf: (g, s) => safeGenerate(
    () => generateElfSilhouette(toSilhouetteGender(g || 'male'), s || 10),
    () => generateHumanSilhouette()
  ),
  darkelf: (g, s) => safeGenerate(
    () => generateDarkElfSilhouette(toSilhouetteGender(g || 'male'), s || 20),
    () => generateHumanSilhouette()
  ),
  dwarf: (g, s) => safeGenerate(
    () => generateDwarfSilhouette(toSilhouetteGender(g || 'male'), s || 11),
    () => generateHumanSilhouette()
  ),
  orc: (g, s) => safeGenerate(
    () => generateOrcSilhouette(toSilhouetteGender(g || 'male'), s || 21),
    () => generateHumanSilhouette()
  ),
  halfling: (g, s) => safeGenerate(
    () => generateHalflingSilhouette(toSilhouetteGender(g || 'male'), s || 12),
    () => generateHumanSilhouette()
  ),
  troll: (g, s) => safeGenerate(
    () => generateTrollSilhouette(toSilhouetteGender(g || 'male'), s || 55),
    () => generateHumanSilhouette()
  ),
  alien: (g, s) => safeGenerate(
    () => generateAlienSilhouette(toSilhouetteGender(g || 'male'), s || 24),
    () => generateHumanSilhouette()
  ),
  vampire: (g, s) => safeGenerate(
    () => generateVampireSilhouette(toSilhouetteGender(g || 'male'), s || 44),
    () => generateHumanSilhouette()
  ),
  werewolf: (g, s) => safeGenerate(
    () => generateWerewolfSilhouette(toSilhouetteGender(g || 'male'), s || 43),
    () => generateHumanSilhouette()
  ),
  angel: (g, s) => safeGenerate(
    () => generateAngelSilhouette(toSilhouetteGender(g || 'male'), s || 50),
    () => generateHumanSilhouette()
  ),
  giant: (g, s) => safeGenerate(
    () => generateGiantSilhouette(toSilhouetteGender(g || 'male'), s || 53),
    () => generateHumanSilhouette()
  ),
  merfolk: (g, s) => safeGenerate(
    () => generateMerfolkSilhouette(toSilhouetteGender(g || 'male'), s || 54),
    () => generateHumanSilhouette()
  ),
  centaur: (g, s) => safeGenerate(
    () => generateCentaurSilhouette(toSilhouetteGender(g || 'male'), s || 55),
    () => generateHumanSilhouette()
  ),
  golem: (g, s) => safeGenerate(
    () => generateGolemSilhouette(toSilhouetteGender(g || 'male'), s || 51),
    () => generateHumanSilhouette()
  ),
  elemental: (g, s) => safeGenerate(
    () => generateElementalSilhouette(toSilhouetteGender(g || 'male'), s || 33),
    () => generateHumanSilhouette()
  ),
  undead: (g, s) => safeGenerate(
    () => generateUndeadSilhouette(toSilhouetteGender(g || 'male'), s || 52),
    () => generateHumanSilhouette()
  ),
  dragonkin: (g, s) => safeGenerate(
    () => generateDragonkinSilhouette(toSilhouetteGender(g || 'male'), s || 42),
    () => generateHumanSilhouette()
  ),
  fae: (g, s) => safeGenerate(
    () => generateFaeSilhouette(toSilhouetteGender(g || 'male'), s || 31),
    () => generateHumanSilhouette()
  ),
  
  // External generators with (gender) only signature - no seed
  gnome: (g) => safeGenerate(
    () => generateGnomeSilhouette(toSilhouetteGender(g || 'male')),
    () => generateHumanSilhouette()
  ),
  phoenix: (g) => safeGenerate(
    () => generatePhoenixSilhouette(toSilhouetteGender(g || 'male')),
    () => generateHumanSilhouette()
  ),
  sprite: (g) => safeGenerate(
    () => generateSpriteSilhouette(toSilhouetteGender(g || 'male')),
    () => generateHumanSilhouette()
  ),
};

function generateHumanSilhouette(gender: 'male' | 'female' = 'male', seed: number = 1): string[] {
  const paths: string[] = [];
  
  // Gender-specific body parameters
  const BODY_PARAMS = {
    male: { 
      shoulderWidth: 1.15, hipWidth: 0.88, waistWidth: 0.95, 
      chestWidth: 1.1, jawWidth: 1.08, browRidge: 1.2,
      neckWidth: 1.1, armWidth: 1.1, legWidth: 1.05
    },
    female: { 
      shoulderWidth: 0.92, hipWidth: 1.12, waistWidth: 0.75, 
      chestWidth: 0.95, jawWidth: 0.92, browRidge: 0.85,
      neckWidth: 0.85, armWidth: 0.88, legWidth: 0.95
    },
  };
  const p = BODY_PARAMS[gender];
  const cx = 200;
  
  // Seeded random for deterministic but unique hair
  const seededRandom = (s: number) => {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };
  let hairSeed = seed;
  const hr = () => seededRandom(hairSeed++);
  
  // =========================================================================
  // WILD PROCEDURAL HAIR GENERATOR
  // Styles: spikes, afro, mohawk, tentacles, crown, flowing, sculptural, punk, bald
  // =========================================================================
  
  // Determine hair style from seed
  // Seeds 0-999 = wild/random (combine TWO styles)
  // Seeds 1000-19999 = explicit style via offset
  // Seeds 20000+ = bald
  const hairStyles = ['spikes', 'afro', 'mohawk', 'tentacles', 'crown', 'flowing', 'sculptural', 'punk'];
  let hairStyle: string;
  let secondHairStyle: string | null = null; // For wild combo
  
  if (seed >= 20000) {
    // Bald - explicitly selected
    hairStyle = 'bald';
  } else if (seed >= 1000) {
    // Explicit style selected via seed offset
    const styleIndex = Math.floor((seed - 1000) / 1000);
    hairStyle = hairStyles[styleIndex % hairStyles.length] || 'spikes';
  } else {
    // Wild/Random: pick TWO different styles and combine them
    const idx1 = Math.floor(hr() * hairStyles.length);
    let idx2 = Math.floor(hr() * (hairStyles.length - 1));
    if (idx2 >= idx1) idx2++; // Ensure different
    hairStyle = hairStyles[idx1];
    secondHairStyle = hairStyles[idx2];
  }
  
  const headTop = 42;
  const headLeft = 135;
  const headRight = 265;
  const headCenter = 200;
  
  // Helper: returns true if either primary or secondary style matches
  // Used by wild/random to render BOTH styles (combo)
  const matchesStyle = (...styles: string[]) => 
    styles.includes(hairStyle) || (secondHairStyle !== null && styles.includes(secondHairStyle));
  
  // Feminine styles - check if explicitly selected via seed OR random for females
  const feminineStyles = ['bouffant', 'pageboy', 'beehive', 'pigtails', 'buns', 'waves', 'bangs', 'updo'];
  
  // Check if a feminine style was explicitly selected (seed >= 12000)
  let femStyle: string | null = null;
  if (seed >= 12000 && seed < 20000) {
    const femIndex = Math.floor((seed - 12000) / 1000);
    femStyle = feminineStyles[femIndex % feminineStyles.length];
  } else if (gender === 'female' && hr() > 0.3) {
    // 70% chance of random feminine style for females
    femStyle = feminineStyles[Math.floor(hr() * feminineStyles.length)];
  }
  
  if (femStyle) {
    // BOUFFANT - Big rounded volume like 60s style
    if (femStyle === 'bouffant') {
      const bouffantHeight = 80 + hr() * 60;
      const bouffantWidth = 90 + hr() * 40;
      paths.push(`
        M${headCenter - bouffantWidth},${headTop + 50}
        C${headCenter - bouffantWidth - 20},${headTop - 10} ${headCenter - bouffantWidth * 0.5},${headTop - bouffantHeight} ${headCenter},${headTop - bouffantHeight - 15}
        C${headCenter + bouffantWidth * 0.5},${headTop - bouffantHeight} ${headCenter + bouffantWidth + 20},${headTop - 10} ${headCenter + bouffantWidth},${headTop + 50}
        Q${headCenter + bouffantWidth * 0.8},${headTop + 80} ${headCenter + bouffantWidth * 0.5},${headTop + 100}
        Q${headCenter},${headTop + 110} ${headCenter - bouffantWidth * 0.5},${headTop + 100}
        Q${headCenter - bouffantWidth * 0.8},${headTop + 80} ${headCenter - bouffantWidth},${headTop + 50}
        Z
      `);
      // Volume texture lines
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI;
        const r = bouffantWidth * 0.8;
        const x1 = headCenter + Math.cos(angle) * r * 0.3;
        const y1 = headTop - bouffantHeight * 0.3 + Math.sin(angle) * 30;
        const x2 = headCenter + Math.cos(angle) * r;
        const y2 = headTop + 20 + Math.sin(angle) * 50;
        paths.push(`M${x1},${y1} Q${x1 + (hr() - 0.5) * 20},${(y1 + y2) / 2} ${x2},${y2}`);
      }
    }
    
    // PAGEBOY - Sleek bob with bangs, face-framing
    if (femStyle === 'pageboy') {
      const bobLength = 60 + hr() * 40;
      paths.push(`
        M${headLeft - 25},${headTop + 30}
        C${headLeft - 30},${headTop - 10} ${headCenter - 30},${headTop - 30} ${headCenter},${headTop - 35}
        C${headCenter + 30},${headTop - 30} ${headRight + 30},${headTop - 10} ${headRight + 25},${headTop + 30}
        L${headRight + 30},${headTop + bobLength}
        Q${headRight + 25},${headTop + bobLength + 20} ${headRight},${headTop + bobLength + 25}
        Q${headCenter},${headTop + bobLength + 35} ${headLeft},${headTop + bobLength + 25}
        Q${headLeft - 25},${headTop + bobLength + 20} ${headLeft - 30},${headTop + bobLength}
        Z
      `);
      // Bangs across forehead
      paths.push(`
        M${headLeft},${headTop + 50}
        Q${headLeft + 20},${headTop + 65} ${headCenter - 20},${headTop + 70}
        Q${headCenter},${headTop + 72} ${headCenter + 20},${headTop + 70}
        Q${headRight - 20},${headTop + 65} ${headRight},${headTop + 50}
        L${headRight - 10},${headTop + 45}
        Q${headCenter},${headTop + 55} ${headLeft + 10},${headTop + 45}
        Z
      `);
      // Sleek texture lines
      for (let i = 0; i < 12; i++) {
        const x = headLeft - 20 + i * 20;
        paths.push(`M${x},${headTop + 10} L${x + 5},${headTop + bobLength + 20}`);
      }
    }
    
    // BEEHIVE - Tall stacked updo
    if (femStyle === 'beehive') {
      const hiveHeight = 120 + hr() * 80;
      const hiveWidth = 60 + hr() * 30;
      paths.push(`
        M${headCenter - hiveWidth},${headTop + 40}
        C${headCenter - hiveWidth - 10},${headTop} ${headCenter - hiveWidth * 0.7},${headTop - hiveHeight * 0.3} ${headCenter - hiveWidth * 0.5},${headTop - hiveHeight * 0.6}
        C${headCenter - hiveWidth * 0.3},${headTop - hiveHeight * 0.8} ${headCenter - 15},${headTop - hiveHeight} ${headCenter},${headTop - hiveHeight - 10}
        C${headCenter + 15},${headTop - hiveHeight} ${headCenter + hiveWidth * 0.3},${headTop - hiveHeight * 0.8} ${headCenter + hiveWidth * 0.5},${headTop - hiveHeight * 0.6}
        C${headCenter + hiveWidth * 0.7},${headTop - hiveHeight * 0.3} ${headCenter + hiveWidth + 10},${headTop} ${headCenter + hiveWidth},${headTop + 40}
        Q${headCenter + hiveWidth * 0.5},${headTop + 60} ${headCenter},${headTop + 50}
        Q${headCenter - hiveWidth * 0.5},${headTop + 60} ${headCenter - hiveWidth},${headTop + 40}
        Z
      `);
      // Horizontal wrap lines for beehive texture
      for (let i = 0; i < 8; i++) {
        const y = headTop - hiveHeight + i * (hiveHeight / 8);
        const w = hiveWidth * (0.5 + (i / 8) * 0.5);
        paths.push(`M${headCenter - w},${y + 20} Q${headCenter},${y + 25 + hr() * 10} ${headCenter + w},${y + 20}`);
      }
    }
    
    // PIGTAILS - Two high bunches
    if (femStyle === 'pigtails') {
      // Base cap
      paths.push(`
        M${headLeft},${headTop + 30}
        C${headLeft - 10},${headTop} ${headCenter - 30},${headTop - 20} ${headCenter},${headTop - 25}
        C${headCenter + 30},${headTop - 20} ${headRight + 10},${headTop} ${headRight},${headTop + 30}
        Q${headCenter},${headTop + 40} ${headLeft},${headTop + 30}
        Z
      `);
      // Left pigtail
      const pigLength = 80 + hr() * 60;
      paths.push(`
        M${headLeft - 20},${headTop + 20}
        Q${headLeft - 50},${headTop + 10} ${headLeft - 60},${headTop + 40}
        Q${headLeft - 70},${headTop + 80} ${headLeft - 55},${headTop + pigLength}
        Q${headLeft - 45},${headTop + pigLength + 20} ${headLeft - 35},${headTop + pigLength}
        Q${headLeft - 20},${headTop + 80} ${headLeft - 15},${headTop + 40}
        Q${headLeft - 10},${headTop + 25} ${headLeft - 20},${headTop + 20}
        Z
      `);
      // Right pigtail
      paths.push(`
        M${headRight + 20},${headTop + 20}
        Q${headRight + 50},${headTop + 10} ${headRight + 60},${headTop + 40}
        Q${headRight + 70},${headTop + 80} ${headRight + 55},${headTop + pigLength}
        Q${headRight + 45},${headTop + pigLength + 20} ${headRight + 35},${headTop + pigLength}
        Q${headRight + 20},${headTop + 80} ${headRight + 15},${headTop + 40}
        Q${headRight + 10},${headTop + 25} ${headRight + 20},${headTop + 20}
        Z
      `);
      // Hair ties/scrunchies
      paths.push(`M${headLeft - 45},${headTop + 35} Q${headLeft - 55},${headTop + 30} ${headLeft - 50},${headTop + 45} Q${headLeft - 40},${headTop + 40} ${headLeft - 45},${headTop + 35} Z`);
      paths.push(`M${headRight + 45},${headTop + 35} Q${headRight + 55},${headTop + 30} ${headRight + 50},${headTop + 45} Q${headRight + 40},${headTop + 40} ${headRight + 45},${headTop + 35} Z`);
    }
    
    // BUNS - Double buns on top (space buns)
    if (femStyle === 'buns') {
      const bunSize = 35 + hr() * 20;
      // Base hair
      paths.push(`
        M${headLeft},${headTop + 40}
        C${headLeft - 10},${headTop + 10} ${headCenter - 40},${headTop - 10} ${headCenter},${headTop - 15}
        C${headCenter + 40},${headTop - 10} ${headRight + 10},${headTop + 10} ${headRight},${headTop + 40}
        Q${headCenter},${headTop + 50} ${headLeft},${headTop + 40}
        Z
      `);
      // Left bun
      paths.push(`
        M${headLeft + 20},${headTop - 10}
        C${headLeft - 10},${headTop - 30} ${headLeft - 10},${headTop - 60 - bunSize} ${headLeft + 30},${headTop - 50 - bunSize}
        C${headLeft + 60},${headTop - 60 - bunSize} ${headLeft + 70},${headTop - 30} ${headLeft + 40},${headTop - 5}
        Q${headLeft + 30},${headTop} ${headLeft + 20},${headTop - 10}
        Z
      `);
      // Right bun
      paths.push(`
        M${headRight - 20},${headTop - 10}
        C${headRight + 10},${headTop - 30} ${headRight + 10},${headTop - 60 - bunSize} ${headRight - 30},${headTop - 50 - bunSize}
        C${headRight - 60},${headTop - 60 - bunSize} ${headRight - 70},${headTop - 30} ${headRight - 40},${headTop - 5}
        Q${headRight - 30},${headTop} ${headRight - 20},${headTop - 10}
        Z
      `);
      // Spiral texture on buns
      for (let b = 0; b < 2; b++) {
        const bx = b === 0 ? headLeft + 30 : headRight - 30;
        const by = headTop - 40 - bunSize * 0.5;
        for (let s = 0; s < 3; s++) {
          const angle = s * 2;
          const r = bunSize * 0.3 * (1 - s * 0.2);
          paths.push(`M${bx + Math.cos(angle) * r},${by + Math.sin(angle) * r * 0.7} Q${bx + Math.cos(angle + 1) * r * 1.2},${by + Math.sin(angle + 1) * r * 0.8} ${bx + Math.cos(angle + 2) * r},${by + Math.sin(angle + 2) * r * 0.7}`);
        }
      }
    }
    
    // WAVES - Big glamorous waves
    if (femStyle === 'waves') {
      const waveLength = 120 + hr() * 80;
      const waveCount = 4 + Math.floor(hr() * 3);
      // Main volume
      paths.push(`
        M${headLeft - 30},${headTop + 30}
        C${headLeft - 35},${headTop - 10} ${headCenter - 40},${headTop - 40} ${headCenter},${headTop - 45}
        C${headCenter + 40},${headTop - 40} ${headRight + 35},${headTop - 10} ${headRight + 30},${headTop + 30}
        L${headRight + 40},${headTop + waveLength}
        Q${headCenter},${headTop + waveLength + 30} ${headLeft - 40},${headTop + waveLength}
        Z
      `);
      // Wave strands
      for (let w = 0; w < 8; w++) {
        const startX = headLeft - 30 + w * 18;
        let path = `M${startX},${headTop + 20}`;
        for (let i = 0; i < waveCount; i++) {
          const y1 = headTop + 40 + i * (waveLength / waveCount);
          const y2 = y1 + waveLength / waveCount / 2;
          const curve = 15 + hr() * 10;
          const dir = (i % 2 === 0) ? 1 : -1;
          path += ` Q${startX + curve * dir},${y1} ${startX},${y2}`;
        }
        paths.push(path);
      }
    }
    
    // BANGS - Face framing with heavy bangs
    if (femStyle === 'bangs') {
      const hairLength = 80 + hr() * 60;
      // Back hair
      paths.push(`
        M${headLeft - 15},${headTop + 30}
        C${headLeft - 20},${headTop - 5} ${headCenter - 35},${headTop - 30} ${headCenter},${headTop - 35}
        C${headCenter + 35},${headTop - 30} ${headRight + 20},${headTop - 5} ${headRight + 15},${headTop + 30}
        L${headRight + 20},${headTop + hairLength}
        Q${headCenter},${headTop + hairLength + 20} ${headLeft - 20},${headTop + hairLength}
        Z
      `);
      // Heavy straight bangs
      paths.push(`
        M${headLeft + 15},${headTop + 30}
        L${headLeft + 10},${headTop + 85}
        Q${headLeft + 20},${headTop + 90} ${headLeft + 30},${headTop + 88}
        L${headLeft + 35},${headTop + 87}
        Q${headCenter - 20},${headTop + 92} ${headCenter},${headTop + 90}
        Q${headCenter + 20},${headTop + 92} ${headRight - 35},${headTop + 87}
        L${headRight - 30},${headTop + 88}
        Q${headRight - 20},${headTop + 90} ${headRight - 10},${headTop + 85}
        L${headRight - 15},${headTop + 30}
        Q${headCenter},${headTop + 25} ${headLeft + 15},${headTop + 30}
        Z
      `);
      // Bang texture lines
      for (let i = 0; i < 10; i++) {
        const x = headLeft + 15 + i * 12;
        paths.push(`M${x},${headTop + 35} L${x + 2},${headTop + 88}`);
      }
    }
    
    // UPDO - Elegant twisted updo
    if (femStyle === 'updo') {
      const updoHeight = 60 + hr() * 50;
      // Slicked back base
      paths.push(`
        M${headLeft + 10},${headTop + 50}
        C${headLeft},${headTop + 20} ${headCenter - 30},${headTop - 10} ${headCenter},${headTop - 15}
        C${headCenter + 30},${headTop - 10} ${headRight},${headTop + 20} ${headRight - 10},${headTop + 50}
        Q${headCenter},${headTop + 60} ${headLeft + 10},${headTop + 50}
        Z
      `);
      // Twisted bun at back/top
      paths.push(`
        M${headCenter - 40},${headTop - 20}
        C${headCenter - 50},${headTop - 50} ${headCenter - 30},${headTop - updoHeight - 20} ${headCenter},${headTop - updoHeight - 25}
        C${headCenter + 30},${headTop - updoHeight - 20} ${headCenter + 50},${headTop - 50} ${headCenter + 40},${headTop - 20}
        Q${headCenter + 20},${headTop - 10} ${headCenter},${headTop - 5}
        Q${headCenter - 20},${headTop - 10} ${headCenter - 40},${headTop - 20}
        Z
      `);
      // Twist texture
      for (let t = 0; t < 5; t++) {
        const y = headTop - 30 - t * (updoHeight / 5);
        const w = 30 - t * 4;
        paths.push(`M${headCenter - w},${y} Q${headCenter},${y - 8} ${headCenter + w},${y}`);
        paths.push(`M${headCenter - w + 5},${y + 5} Q${headCenter},${y - 3} ${headCenter + w - 5},${y + 5}`);
      }
      // Loose tendrils at sides
      paths.push(`M${headLeft + 20},${headTop + 45} Q${headLeft + 5},${headTop + 80} ${headLeft + 15},${headTop + 110}`);
      paths.push(`M${headRight - 20},${headTop + 45} Q${headRight - 5},${headTop + 80} ${headRight - 15},${headTop + 110}`);
    }
  }
  
  if (hairStyle !== 'bald') {
    // Base hair mass (always present unless bald)
    const baseHeight = 30 + hr() * 30;
    paths.push(`
      M${headLeft - 5},${headTop + 40}
      C${headLeft - 10},${headTop} ${headCenter - 40},${headTop - baseHeight} ${headCenter},${headTop - baseHeight - 10}
      C${headCenter + 40},${headTop - baseHeight} ${headRight + 10},${headTop} ${headRight + 5},${headTop + 40}
      C${headRight},${headTop + 20} ${headCenter + 30},${headTop + 5} ${headCenter},${headTop + 5}
      C${headCenter - 30},${headTop + 5} ${headLeft},${headTop + 20} ${headLeft - 5},${headTop + 40}
      Z
    `);
  }
  
  // SPIKES - Aggressive upward spikes
  if (matchesStyle('spikes', 'punk')) {
    const spikeCount = 8 + Math.floor(hr() * 12);
    for (let i = 0; i < spikeCount; i++) {
      const baseX = headLeft + 10 + (i / spikeCount) * (headRight - headLeft - 20);
      const baseY = headTop + hr() * 15;
      const spikeHeight = 40 + hr() * 80;
      const spikeWidth = 8 + hr() * 15;
      const lean = (hr() - 0.5) * 40;
      const curve = (hr() - 0.5) * 30;
      
      paths.push(`
        M${baseX - spikeWidth/2},${baseY}
        Q${baseX + curve},${baseY - spikeHeight/2} ${baseX + lean},${baseY - spikeHeight}
        Q${baseX + curve + 5},${baseY - spikeHeight/2} ${baseX + spikeWidth/2},${baseY}
        Z
      `);
    }
    // Extra chaos spikes going sideways
    if (matchesStyle('punk')) {
      for (let side = -1; side <= 1; side += 2) {
        const sideSpikes = 3 + Math.floor(hr() * 4);
        for (let i = 0; i < sideSpikes; i++) {
          const baseX = side > 0 ? headRight : headLeft;
          const baseY = headTop + 20 + i * 20;
          const spikeLen = 30 + hr() * 50;
          paths.push(`
            M${baseX},${baseY}
            Q${baseX + side * spikeLen * 0.6},${baseY - 10} ${baseX + side * spikeLen},${baseY - 20 + hr() * 40}
            Q${baseX + side * spikeLen * 0.6},${baseY + 5} ${baseX},${baseY + 8}
            Z
          `);
        }
      }
    }
  }
  
  // AFRO - Big spherical volume with texture
  if (matchesStyle('afro')) {
    const afroRadius = 70 + hr() * 50;
    const afroTop = headTop - afroRadius * 0.8;
    
    // Main afro shape
    paths.push(`
      M${headCenter - afroRadius},${headTop + 30}
      C${headCenter - afroRadius - 20},${headTop - 20} ${headCenter - afroRadius * 0.7},${afroTop} ${headCenter},${afroTop - 10}
      C${headCenter + afroRadius * 0.7},${afroTop} ${headCenter + afroRadius + 20},${headTop - 20} ${headCenter + afroRadius},${headTop + 30}
      C${headCenter + afroRadius * 0.9},${headTop + 60} ${headCenter + afroRadius * 0.5},${headTop + 80} ${headCenter},${headTop + 70}
      C${headCenter - afroRadius * 0.5},${headTop + 80} ${headCenter - afroRadius * 0.9},${headTop + 60} ${headCenter - afroRadius},${headTop + 30}
      Z
    `);
    
    // Afro texture - curly puffs
    for (let i = 0; i < 40; i++) {
      const angle = hr() * Math.PI * 2;
      const dist = 20 + hr() * (afroRadius - 30);
      const puffX = headCenter + Math.cos(angle) * dist;
      const puffY = headTop - 10 + Math.sin(angle) * dist * 0.6;
      const puffSize = 8 + hr() * 15;
      
      if (puffY < headTop + 50) {
        paths.push(`
          M${puffX},${puffY}
          C${puffX - puffSize},${puffY - puffSize} ${puffX + puffSize},${puffY - puffSize} ${puffX + puffSize/2},${puffY}
          C${puffX + puffSize},${puffY + puffSize/2} ${puffX - puffSize/2},${puffY + puffSize/2} ${puffX},${puffY}
          Z
        `);
      }
    }
  }
  
  // MOHAWK - Central ridge
  if (matchesStyle('mohawk')) {
    const mohawkHeight = 60 + hr() * 80;
    const mohawkWidth = 30 + hr() * 20;
    
    // Central ridge
    paths.push(`
      M${headCenter - mohawkWidth/2},${headTop + 10}
      L${headCenter - mohawkWidth/3},${headTop - mohawkHeight}
      Q${headCenter},${headTop - mohawkHeight - 20} ${headCenter + mohawkWidth/3},${headTop - mohawkHeight}
      L${headCenter + mohawkWidth/2},${headTop + 10}
      Q${headCenter},${headTop + 5} ${headCenter - mohawkWidth/2},${headTop + 10}
      Z
    `);
    
    // Mohawk spikes/texture
    const ridgeSpikes = 6 + Math.floor(hr() * 8);
    for (let i = 0; i < ridgeSpikes; i++) {
      const t = i / ridgeSpikes;
      const spikeX = headCenter + (hr() - 0.5) * mohawkWidth * 0.5;
      const spikeBaseY = headTop - mohawkHeight * t;
      const spikeH = 15 + hr() * 25;
      paths.push(`
        M${spikeX - 5},${spikeBaseY}
        L${spikeX + (hr() - 0.5) * 10},${spikeBaseY - spikeH}
        L${spikeX + 5},${spikeBaseY}
      `);
    }
    
    // Shaved sides texture
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 8; i++) {
        const y = headTop + 20 + i * 8;
        const x = headCenter + side * (mohawkWidth/2 + 15 + i * 3);
        paths.push(`M${x},${y} L${x + side * 15},${y + 2}`);
      }
    }
  }
  
  // TENTACLES / MEDUSA - Flowing organic tendrils
  if (matchesStyle('tentacles')) {
    const tentacleCount = 12 + Math.floor(hr() * 15);
    for (let i = 0; i < tentacleCount; i++) {
      const angle = (i / tentacleCount) * Math.PI + (hr() - 0.5) * 0.5;
      const startX = headCenter + Math.cos(angle + Math.PI/2) * 50;
      const startY = headTop + 10;
      const length = 80 + hr() * 120;
      const thickness = 6 + hr() * 12;
      
      // Each tentacle curves organically
      const midX = startX + Math.cos(angle) * length * 0.5 + (hr() - 0.5) * 60;
      const midY = startY - length * 0.3 + (hr() - 0.5) * 40;
      const endX = startX + Math.cos(angle) * length + (hr() - 0.5) * 80;
      const endY = startY - length * 0.7 + hr() * 50;
      
      paths.push(`
        M${startX - thickness/2},${startY}
        Q${midX - thickness/3},${midY} ${endX},${endY}
        Q${midX + thickness/3},${midY} ${startX + thickness/2},${startY}
        Z
      `);
      
      // Tentacle curl at end
      const curlSize = 10 + hr() * 15;
      const curlAngle = hr() * Math.PI * 2;
      paths.push(`
        M${endX},${endY}
        Q${endX + Math.cos(curlAngle) * curlSize},${endY + Math.sin(curlAngle) * curlSize}
        ${endX + Math.cos(curlAngle + 1) * curlSize * 0.5},${endY + Math.sin(curlAngle + 1) * curlSize * 0.5}
      `);
    }
  }
  
  // CROWN / SCULPTURAL - Architectural shapes
  if (matchesStyle('crown', 'sculptural')) {
    // Main elevated structure
    const crownHeight = 50 + hr() * 70;
    const crownWidth = 80 + hr() * 40;
    
    paths.push(`
      M${headCenter - crownWidth/2},${headTop + 20}
      C${headCenter - crownWidth/2 - 10},${headTop - 10} ${headCenter - crownWidth/3},${headTop - crownHeight} ${headCenter},${headTop - crownHeight - 15}
      C${headCenter + crownWidth/3},${headTop - crownHeight} ${headCenter + crownWidth/2 + 10},${headTop - 10} ${headCenter + crownWidth/2},${headTop + 20}
      Z
    `);
    
    // Sculptural elements - loops, spheres, shapes
    const elementCount = 4 + Math.floor(hr() * 6);
    for (let i = 0; i < elementCount; i++) {
      const elemX = headCenter + (hr() - 0.5) * crownWidth * 0.8;
      const elemY = headTop - crownHeight * 0.5 - hr() * crownHeight * 0.5;
      const elemType = Math.floor(hr() * 3);
      const elemSize = 15 + hr() * 25;
      
      if (elemType === 0) {
        // Sphere/ball
        paths.push(`
          M${elemX},${elemY - elemSize}
          C${elemX + elemSize},${elemY - elemSize} ${elemX + elemSize},${elemY + elemSize} ${elemX},${elemY + elemSize}
          C${elemX - elemSize},${elemY + elemSize} ${elemX - elemSize},${elemY - elemSize} ${elemX},${elemY - elemSize}
          Z
        `);
      } else if (elemType === 1) {
        // Loop/ring
        paths.push(`
          M${elemX - elemSize},${elemY}
          C${elemX - elemSize},${elemY - elemSize * 1.5} ${elemX + elemSize},${elemY - elemSize * 1.5} ${elemX + elemSize},${elemY}
          C${elemX + elemSize},${elemY + elemSize} ${elemX - elemSize},${elemY + elemSize} ${elemX - elemSize},${elemY}
        `);
      } else {
        // Spike/horn
        paths.push(`
          M${elemX - elemSize/3},${elemY + elemSize}
          L${elemX + (hr() - 0.5) * 10},${elemY - elemSize * 1.5}
          L${elemX + elemSize/3},${elemY + elemSize}
          Z
        `);
      }
    }
  }
  
  // FLOWING - Long dramatic flowing hair
  if (matchesStyle('flowing')) {
    const flowLength = 150 + hr() * 100;
    const strandCount = 15 + Math.floor(hr() * 20);
    
    for (let i = 0; i < strandCount; i++) {
      const startAngle = (i / strandCount) * Math.PI * 0.8 + 0.1 * Math.PI;
      const startX = headCenter + Math.cos(startAngle + Math.PI/2) * 55;
      const startY = headTop + 30;
      
      const endX = startX + (hr() - 0.5) * 150;
      const endY = startY + flowLength * (0.5 + hr() * 0.5);
      
      const cp1x = startX + (hr() - 0.5) * 80;
      const cp1y = startY + flowLength * 0.3;
      const cp2x = endX + (hr() - 0.5) * 40;
      const cp2y = endY - flowLength * 0.2;
      
      const width = 4 + hr() * 10;
      
      paths.push(`
        M${startX - width/2},${startY}
        C${cp1x - width/3},${cp1y} ${cp2x - width/4},${cp2y} ${endX},${endY}
        C${cp2x + width/4},${cp2y} ${cp1x + width/3},${cp1y} ${startX + width/2},${startY}
        Z
      `);
    }
  }
  
  // BALD - Just a smooth scalp highlight
  if (hairStyle === 'bald') {
    // Subtle scalp shine
    paths.push(`
      M${headCenter - 30},${headTop + 20}
      Q${headCenter},${headTop + 5} ${headCenter + 30},${headTop + 20}
      Q${headCenter + 20},${headTop + 35} ${headCenter},${headTop + 40}
      Q${headCenter - 20},${headTop + 35} ${headCenter - 30},${headTop + 20}
      Z
    `);
  }
  
  // =========================================================================
  // HEAD (~1200 points) - Skull, face, features, skin texture
  // =========================================================================
  
  // Skull outline with cranial detail
  paths.push(`
    M200,42
    C208,40 216,40 224,42
    C238,45 252,52 263,63
    C274,74 282,88 286,104
    C290,120 291,137 289,154
    C287,168 283,182 277,195
    C271,208 263,220 253,230
    C243,240 231,248 218,254
    C211,257 204,259 200,260
    C196,259 189,257 182,254
    C169,248 157,240 147,230
    C137,220 129,208 123,195
    C117,182 113,168 111,154
    C109,137 110,120 114,104
    C118,88 126,74 137,63
    C148,52 162,45 176,42
    C184,40 192,40 200,42
    Z
  `);
  
  // Forehead contours
  paths.push(`
    M145,85 Q160,78 175,80 Q188,82 200,80 Q212,82 225,80 Q240,78 255,85
    M150,95 Q175,88 200,90 Q225,88 250,95
  `);
  
  // Temple hollows
  paths.push(`
    M130,110 Q125,125 128,140
    M270,110 Q275,125 272,140
  `);
  
  // Brow ridge with micro-detail
  paths.push(`
    M145,115 Q150,110 160,112 Q170,114 180,112 Q185,111 190,113
    M210,113 Q215,111 220,112 Q230,114 240,112 Q250,110 255,115
  `);
  
  // Left eye - complete with lid folds, lashes, iris detail
  paths.push(`
    M155,128 Q148,125 143,130 Q138,136 140,144 Q142,152 150,157 Q160,161 172,156 Q180,150 182,142 Q183,134 178,128 Q170,123 160,125 Q155,126 155,128 Z
  `);
  // Left upper eyelid crease
  paths.push(`M148,122 Q160,118 175,122`);
  // Left lower lid
  paths.push(`M145,148 Q158,152 172,148`);
  // Left iris
  paths.push(`M158,135 A8,8 0 1,1 158,151 A8,8 0 1,1 158,135`);
  // Left pupil
  paths.push(`M160,140 A3,3 0 1,1 160,146 A3,3 0 1,1 160,140`);
  // Left eyelashes (12 lashes)
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const x = 145 + t * 35;
    const y = 128 - Math.sin(t * Math.PI) * 3;
    paths.push(`M${x},${y} L${x + (t - 0.5) * 2},${y - 4}`);
  }
  // Left eyebrow with hair strokes
  for (let i = 0; i < 20; i++) {
    const x = 142 + i * 2.2;
    const y = 115 - Math.sin(i * 0.3) * 3;
    paths.push(`M${x},${y + 2} Q${x + 1},${y - 2} ${x + 2},${y}`);
  }
  
  // Right eye - complete with lid folds, lashes, iris detail
  paths.push(`
    M245,128 Q252,125 257,130 Q262,136 260,144 Q258,152 250,157 Q240,161 228,156 Q220,150 218,142 Q217,134 222,128 Q230,123 240,125 Q245,126 245,128 Z
  `);
  // Right upper eyelid crease
  paths.push(`M252,122 Q240,118 225,122`);
  // Right lower lid
  paths.push(`M255,148 Q242,152 228,148`);
  // Right iris
  paths.push(`M242,135 A8,8 0 1,1 242,151 A8,8 0 1,1 242,135`);
  // Right pupil
  paths.push(`M240,140 A3,3 0 1,1 240,146 A3,3 0 1,1 240,140`);
  // Right eyelashes
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const x = 255 - t * 35;
    const y = 128 - Math.sin(t * Math.PI) * 3;
    paths.push(`M${x},${y} L${x - (t - 0.5) * 2},${y - 4}`);
  }
  // Right eyebrow with hair strokes
  for (let i = 0; i < 20; i++) {
    const x = 258 - i * 2.2;
    const y = 115 - Math.sin(i * 0.3) * 3;
    paths.push(`M${x},${y + 2} Q${x - 1},${y - 2} ${x - 2},${y}`);
  }
  
  // Nose - bridge, tip, nostrils with cartilage detail
  paths.push(`
    M200,130 
    L199,138 Q198,145 197,152 
    L196,160 Q194,168 192,175 
    Q190,180 188,184 
    Q186,188 188,191 
    Q192,194 196,193 
    L200,192 
    L204,193 
    Q208,194 212,191 
    Q214,188 212,184 
    Q210,180 208,175 
    Q206,168 204,160 
    L203,152 Q202,145 201,138 
    L200,130
  `);
  // Nose bridge highlight
  paths.push(`M199,132 L199,170`);
  // Left nostril with rim
  paths.push(`
    M188,188 Q184,192 186,196 Q190,200 196,198 Q194,194 192,190
  `);
  // Right nostril with rim
  paths.push(`
    M212,188 Q216,192 214,196 Q210,200 204,198 Q206,194 208,190
  `);
  // Nostril openings
  paths.push(`M189,193 A2,3 0 1,1 193,193 A2,3 0 1,1 189,193`);
  paths.push(`M207,193 A2,3 0 1,1 211,193 A2,3 0 1,1 207,193`);
  
  // Cheekbones with highlight
  paths.push(`
    M135,160 Q140,155 148,158 Q155,162 158,170
    M265,160 Q260,155 252,158 Q245,162 242,170
  `);
  
  // Nasolabial folds
  paths.push(`
    M175,185 Q172,195 175,208
    M225,185 Q228,195 225,208
  `);
  
  // Lips - fully detailed with vermillion border, philtrum
  // Philtrum (groove above lip)
  paths.push(`M197,192 L196,204 M203,192 L204,204 M200,194 L200,202`);
  
  // Upper lip outline
  paths.push(`
    M172,210 
    Q178,206 185,207 
    Q192,208 196,205 
    L200,203 
    L204,205 
    Q208,208 215,207 
    Q222,206 228,210
  `);
  // Upper lip body
  paths.push(`
    M172,210 Q185,215 200,214 Q215,215 228,210 Q222,218 200,220 Q178,218 172,210 Z
  `);
  // Lower lip
  paths.push(`
    M175,220 Q188,225 200,226 Q212,225 225,220 Q220,232 200,235 Q180,232 175,220 Z
  `);
  // Lip highlight
  paths.push(`M185,212 Q200,210 215,212`);
  // Lower lip shine
  paths.push(`M190,225 Q200,227 210,225`);
  
  // Chin with cleft suggestion
  paths.push(`
    M185,245 Q190,250 200,252 Q210,250 215,245
    M198,248 L198,255 M202,248 L202,255
  `);
  
  // Jaw line definition
  paths.push(`
    M130,200 Q128,220 135,240 Q145,255 165,262
    M270,200 Q272,220 265,240 Q255,255 235,262
  `);
  
  // Ears with full cartilage detail
  // Left ear
  paths.push(`
    M118,130
    Q108,132 105,145
    Q103,160 108,175
    Q112,188 120,195
    Q128,200 132,195
    Q130,185 128,175
    Q126,165 128,155
    Q130,145 125,138
    Q122,132 118,130
  `);
  // Left ear inner detail (helix, antihelix, tragus, antitragus)
  paths.push(`
    M115,138 Q110,150 115,165 Q118,178 125,188
    M120,145 Q118,155 120,168
    M125,150 Q122,158 124,170
    M128,175 Q132,180 130,188
  `);
  // Right ear
  paths.push(`
    M282,130
    Q292,132 295,145
    Q297,160 292,175
    Q288,188 280,195
    Q272,200 268,195
    Q270,185 272,175
    Q274,165 272,155
    Q270,145 275,138
    Q278,132 282,130
  `);
  // Right ear inner detail
  paths.push(`
    M285,138 Q290,150 285,165 Q282,178 275,188
    M280,145 Q282,155 280,168
    M275,150 Q278,158 276,170
    M272,175 Q268,180 270,188
  `);
  
  // Face skin texture (subtle pore suggestions - 30 points)
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 60;
    const cx = 200 + Math.cos(angle) * dist * 0.6;
    const cy = 170 + Math.sin(angle) * dist * 0.4;
    if (cy > 120 && cy < 240 && cx > 140 && cx < 260) {
      paths.push(`M${cx},${cy} L${cx + 0.5},${cy + 0.5}`);
    }
  }
  
  // =========================================================================
  // NECK (~300 points) - Muscles, tendons, Adam's apple
  // =========================================================================
  
  // Neck outline
  paths.push(`
    M165,260 Q160,275 158,295 Q156,315 155,330
    M235,260 Q240,275 242,295 Q244,315 245,330
  `);
  
  // Sternocleidomastoid muscles (detailed)
  paths.push(`
    M168,262 Q158,280 152,300 Q148,320 145,340
    M172,265 Q165,285 160,310 Q158,330 156,345
    M232,262 Q242,280 248,300 Q252,320 255,340
    M228,265 Q235,285 240,310 Q242,330 244,345
  `);
  
  // Trapezius visible portion
  paths.push(`
    M145,340 Q130,355 120,365
    M255,340 Q270,355 280,365
  `);
  
  // Throat hollow
  paths.push(`M195,270 Q200,275 205,270`);
  
  // Adam's apple
  paths.push(`
    M196,290 Q200,285 204,290 L205,300 Q200,305 195,300 Z
  `);
  
  // Neck tendons
  paths.push(`
    M185,265 L182,295 L180,330
    M215,265 L218,295 L220,330
  `);
  
  // =========================================================================
  // TORSO (~2000 points) - Muscles, ribs, abs, obliques
  // =========================================================================
  
  // Shoulder and hip calculations based on gender
  const shoulderOffset = 55 * p.shoulderWidth;
  const hipOffset = 55 * p.hipWidth;
  const waistOffset = 50 * p.waistWidth;
  const chestOffset = 55 * p.chestWidth;
  
  // Main torso outline - gendered
  paths.push(`
    M${cx - shoulderOffset},330
    C${cx - shoulderOffset - 20},345 ${cx - chestOffset - 40},375 ${cx - chestOffset - 47},415
    C${cx - waistOffset - 53},455 ${cx - waistOffset - 50},495 ${cx - hipOffset - 45},535
    Q${cx - hipOffset - 42},560 ${cx - hipOffset - 37},585
    L${cx + hipOffset + 37},585
    Q${cx + hipOffset + 42},560 ${cx + hipOffset + 45},535
    C${cx + waistOffset + 50},495 ${cx + waistOffset + 53},455 ${cx + chestOffset + 47},415
    C${cx + chestOffset + 40},375 ${cx + shoulderOffset + 20},345 ${cx + shoulderOffset},330
    Q${cx + 30},320 ${cx},318
    Q${cx - 30},320 ${cx - shoulderOffset},330
    Z
  `);
  
  // Clavicles (collarbones)
  paths.push(`
    M${cx - 45},335 Q${cx - 60},338 ${cx - 75},345 Q${cx - 85},350 ${cx - 90},358
    M${cx + 45},335 Q${cx + 60},338 ${cx + 75},345 Q${cx + 85},350 ${cx + 90},358
  `);
  // Clavicle definition
  paths.push(`
    M${cx - 42},340 Q${cx - 58},344 ${cx - 72},352
    M${cx + 42},340 Q${cx + 58},344 ${cx + 72},352
  `);
  
  // Sternum
  paths.push(`M${cx},340 L${cx},420`);
  
  // Pectoral/chest area - gendered
  if (gender === 'female') {
    // Female bust - left
    paths.push(`
      M${cx - 45},345
      Q${cx - 55},355 ${cx - 60},375
      Q${cx - 62},395 ${cx - 55},415
      Q${cx - 45},430 ${cx - 25},435
      Q${cx - 12},432 ${cx},428
      L${cx},360
      Q${cx - 15},350 ${cx - 30},348
      Q${cx - 38},346 ${cx - 45},345
    `);
    // Female bust - right
    paths.push(`
      M${cx + 45},345
      Q${cx + 55},355 ${cx + 60},375
      Q${cx + 62},395 ${cx + 55},415
      Q${cx + 45},430 ${cx + 25},435
      Q${cx + 12},432 ${cx},428
      L${cx},360
      Q${cx + 15},350 ${cx + 30},348
      Q${cx + 38},346 ${cx + 45},345
    `);
    // Bust curves
    paths.push(`M${cx - 58},380 Q${cx - 55},395 ${cx - 48},408`);
    paths.push(`M${cx + 58},380 Q${cx + 55},395 ${cx + 48},408`);
  } else {
    // Male pectoral muscles - left (with striation)
    paths.push(`
      M${cx - 45},345
      Q${cx - 55},350 ${cx - 62},365
      Q${cx - 68},385 ${cx - 60},405
      Q${cx - 50},420 ${cx - 25},430
      Q${cx - 12},432 ${cx},428
      L${cx},360
      Q${cx - 15},350 ${cx - 30},348
      Q${cx - 38},346 ${cx - 45},345
    `);
    // Left pec striations
    for (let i = 0; i < 8; i++) {
      const y = 360 + i * 8;
      paths.push(`M${cx - 55},${y} Q${cx - 35},${y + 5} ${cx - 10},${y - 2}`);
    }
    // Left nipple
    paths.push(`M${cx - 35},395 A4,4 0 1,1 ${cx - 27},395 A4,4 0 1,1 ${cx - 35},395`);
    
    // Male pectoral muscles - right (with striation)
    paths.push(`
      M${cx + 45},345
      Q${cx + 55},350 ${cx + 62},365
      Q${cx + 68},385 ${cx + 60},405
      Q${cx + 50},420 ${cx + 25},430
      Q${cx + 12},432 ${cx},428
      L${cx},360
      Q${cx + 15},350 ${cx + 30},348
      Q${cx + 38},346 ${cx + 45},345
    `);
    // Right pec striations
    for (let i = 0; i < 8; i++) {
      const y = 360 + i * 8;
      paths.push(`M${cx + 55},${y} Q${cx + 35},${y + 5} ${cx + 10},${y - 2}`);
    }
    // Right nipple
    paths.push(`M${cx + 27},395 A4,4 0 1,1 ${cx + 35},395 A4,4 0 1,1 ${cx + 27},395`);
  }
  
  // Rib cage suggestion (serratus anterior)
  for (let i = 0; i < 4; i++) {
    const y = 400 + i * 25;
    paths.push(`M125,${y} Q135,${y + 5} 145,${y}`);
    paths.push(`M275,${y} Q265,${y + 5} 255,${y}`);
  }
  
  // Linea alba (center line)
  paths.push(`M200,420 L200,570`);
  
  // Abdominal muscles (8-pack with full detail)
  // Row 1
  paths.push(`
    M175,430 Q180,425 190,428 Q195,432 195,440 Q193,450 185,455 Q177,458 172,452 Q168,445 172,435 Q174,430 175,430
    M225,430 Q220,425 210,428 Q205,432 205,440 Q207,450 215,455 Q223,458 228,452 Q232,445 228,435 Q226,430 225,430
  `);
  // Row 2
  paths.push(`
    M173,460 Q178,455 188,458 Q194,462 194,472 Q192,482 184,487 Q176,490 171,484 Q167,477 170,467 Q172,460 173,460
    M227,460 Q222,455 212,458 Q206,462 206,472 Q208,482 216,487 Q224,490 229,484 Q233,477 230,467 Q228,460 227,460
  `);
  // Row 3
  paths.push(`
    M172,495 Q177,490 187,493 Q193,497 193,507 Q191,517 183,522 Q175,525 170,519 Q166,512 169,502 Q171,495 172,495
    M228,495 Q223,490 213,493 Q207,497 207,507 Q209,517 217,522 Q225,525 230,519 Q234,512 231,502 Q229,495 228,495
  `);
  // Row 4
  paths.push(`
    M171,530 Q176,525 186,528 Q192,532 192,542 Q190,552 182,557 Q174,560 169,554 Q165,547 168,537 Q170,530 171,530
    M229,530 Q224,525 214,528 Q208,532 208,542 Q210,552 218,557 Q226,560 231,554 Q235,547 232,537 Q230,530 229,530
  `);
  
  // Tendinous inscriptions (horizontal lines between abs)
  paths.push(`M175,455 Q200,458 225,455`);
  paths.push(`M174,490 Q200,493 226,490`);
  paths.push(`M173,525 Q200,528 227,525`);
  
  // External obliques
  paths.push(`
    M145,420 Q140,450 138,480 Q136,510 135,540 Q134,560 132,580
    M142,425 Q138,455 136,485 Q134,515 133,545
    M140,430 Q136,460 134,490 Q132,520 131,550
  `);
  paths.push(`
    M255,420 Q260,450 262,480 Q264,510 265,540 Q266,560 268,580
    M258,425 Q262,455 264,485 Q266,515 267,545
    M260,430 Q264,460 266,490 Q268,520 269,550
  `);
  
  // Iliac crest (hip bones)
  paths.push(`
    M140,555 Q130,560 125,570 Q122,580 125,590
    M145,560 Q135,565 130,575
    M260,555 Q270,560 275,570 Q278,580 275,590
    M255,560 Q265,565 270,575
  `);
  
  // V-lines (inguinal ligaments)
  paths.push(`
    M155,560 Q165,575 175,590
    M160,555 Q170,570 180,585
    M245,560 Q235,575 225,590
    M240,555 Q230,570 220,585
  `);
  
  // =========================================================================
  // ARMS (~800 points each) - Biceps, triceps, forearm muscles, veins
  // =========================================================================
  
  // LEFT ARM
  // Deltoid (shoulder)
  paths.push(`
    M145,330
    Q130,335 118,350
    Q108,368 105,390
    Q103,410 108,428
    Q115,440 125,445
  `);
  // Deltoid striations
  paths.push(`
    M140,338 Q130,350 125,370
    M138,345 Q128,358 122,380
    M135,352 Q125,365 120,388
  `);
  
  // Biceps
  paths.push(`
    M125,445
    Q115,455 108,475
    Q102,500 105,525
    Q108,545 115,558
  `);
  // Bicep peak
  paths.push(`
    M118,460 Q110,480 112,505 Q115,525 120,540
  `);
  // Bicep vein
  paths.push(`
    M120,450 Q115,470 118,495 Q120,520 125,545
  `);
  
  // Triceps
  paths.push(`
    M145,355 Q155,380 152,410 Q148,440 140,465
    M148,365 Q158,390 155,420 Q150,450 142,475
  `);
  
  // Elbow
  paths.push(`
    M115,558 Q108,570 110,585 Q115,598 125,605
    M140,465 Q148,485 145,510 Q140,535 130,555 Q125,570 128,590
  `);
  // Olecranon (elbow point)
  paths.push(`M138,555 Q145,560 142,572 Q138,580 132,575`);
  
  // Forearm extensors
  paths.push(`
    M128,590 Q135,610 140,640 Q143,670 142,700
  `);
  // Forearm flexors
  paths.push(`
    M110,585 Q105,610 102,640 Q100,670 100,700
  `);
  // Forearm muscle definition
  paths.push(`
    M115,600 Q118,630 120,665
    M120,595 Q125,625 127,660
    M132,592 Q135,620 136,655
  `);
  // Forearm veins
  paths.push(`
    M108,590 Q105,620 108,650 Q110,680 112,710
    M122,595 Q120,625 123,655 Q126,685 128,715
  `);
  
  // Wrist
  paths.push(`
    M100,700 Q98,715 100,730
    M142,700 Q145,715 143,730
  `);
  // Wrist tendons
  paths.push(`
    M105,705 L106,725
    M112,705 L113,725
    M120,705 L121,725
    M128,705 L129,725
    M135,705 L136,725
  `);
  
  // RIGHT ARM (mirrored)
  // Deltoid
  paths.push(`
    M255,330
    Q270,335 282,350
    Q292,368 295,390
    Q297,410 292,428
    Q285,440 275,445
  `);
  paths.push(`
    M260,338 Q270,350 275,370
    M262,345 Q272,358 278,380
    M265,352 Q275,365 280,388
  `);
  
  // Biceps
  paths.push(`
    M275,445
    Q285,455 292,475
    Q298,500 295,525
    Q292,545 285,558
  `);
  paths.push(`
    M282,460 Q290,480 288,505 Q285,525 280,540
  `);
  paths.push(`
    M280,450 Q285,470 282,495 Q280,520 275,545
  `);
  
  // Triceps
  paths.push(`
    M255,355 Q245,380 248,410 Q252,440 260,465
    M252,365 Q242,390 245,420 Q250,450 258,475
  `);
  
  // Elbow
  paths.push(`
    M285,558 Q292,570 290,585 Q285,598 275,605
    M260,465 Q252,485 255,510 Q260,535 270,555 Q275,570 272,590
  `);
  paths.push(`M262,555 Q255,560 258,572 Q262,580 268,575`);
  
  // Forearm
  paths.push(`
    M272,590 Q265,610 260,640 Q257,670 258,700
  `);
  paths.push(`
    M290,585 Q295,610 298,640 Q300,670 300,700
  `);
  paths.push(`
    M285,600 Q282,630 280,665
    M280,595 Q275,625 273,660
    M268,592 Q265,620 264,655
  `);
  paths.push(`
    M292,590 Q295,620 292,650 Q290,680 288,710
    M278,595 Q280,625 277,655 Q274,685 272,715
  `);
  
  // Wrist
  paths.push(`
    M300,700 Q302,715 300,730
    M258,700 Q255,715 257,730
  `);
  paths.push(`
    M295,705 L294,725
    M288,705 L287,725
    M280,705 L279,725
    M272,705 L271,725
    M265,705 L264,725
  `);
  
  // =========================================================================
  // HANDS (~600 points total) - All fingers, knuckles, nails, palm lines
  // =========================================================================
  
  paths.push(generateInsaneHand(100, 725, 'left'));
  paths.push(generateInsaneHand(300, 725, 'right'));
  
  // =========================================================================
  // LEGS (~1500 points) - Full legs with BANG censor at groin
  // =========================================================================
  
  const legWidth = gender === 'female' ? 42 : 48;
  const hipY = 590;
  const groinY = 620;
  const thighY = 720;
  const kneeY = 820;
  const calfY = 920;
  const ankleY = 1000;
  const footY = 1020;
  
  // LEFT LEG
  // Upper thigh (from hip)
  paths.push(`
    M${cx - 55},${hipY}
    Q${cx - 65},${hipY + 30} ${cx - 70},${groinY}
    Q${cx - 75},${groinY + 40} ${cx - 72},${thighY}
    Q${cx - 68},${thighY + 30} ${cx - 62},${thighY + 60}
  `);
  // Inner thigh
  paths.push(`
    M${cx - 15},${groinY + 30}
    Q${cx - 25},${groinY + 60} ${cx - 35},${thighY}
    Q${cx - 42},${thighY + 40} ${cx - 45},${thighY + 80}
  `);
  // Quadriceps
  paths.push(`
    M${cx - 60},${thighY - 20}
    Q${cx - 55},${thighY + 20} ${cx - 50},${thighY + 60}
    M${cx - 55},${thighY - 10}
    Q${cx - 50},${thighY + 30} ${cx - 48},${thighY + 70}
  `);
  // Knee
  paths.push(`
    M${cx - 65},${kneeY - 20}
    Q${cx - 60},${kneeY} ${cx - 55},${kneeY + 15}
    Q${cx - 50},${kneeY + 25} ${cx - 48},${kneeY + 35}
    M${cx - 45},${kneeY - 15}
    Q${cx - 42},${kneeY + 5} ${cx - 40},${kneeY + 25}
  `);
  // Kneecap
  paths.push(`
    M${cx - 58},${kneeY - 5}
    C${cx - 65},${kneeY} ${cx - 65},${kneeY + 20} ${cx - 58},${kneeY + 25}
    C${cx - 50},${kneeY + 20} ${cx - 50},${kneeY} ${cx - 58},${kneeY - 5}
    Z
  `);
  // Calf
  paths.push(`
    M${cx - 70},${kneeY + 30}
    Q${cx - 75},${kneeY + 60} ${cx - 72},${calfY - 30}
    Q${cx - 68},${calfY} ${cx - 60},${calfY + 30}
    Q${cx - 55},${calfY + 50} ${cx - 52},${ankleY - 20}
  `);
  // Shin
  paths.push(`
    M${cx - 48},${kneeY + 35}
    Q${cx - 45},${kneeY + 60} ${cx - 42},${calfY - 20}
    Q${cx - 40},${calfY + 20} ${cx - 38},${ankleY - 15}
  `);
  // Ankle
  paths.push(`
    M${cx - 60},${ankleY - 20}
    Q${cx - 55},${ankleY} ${cx - 50},${ankleY + 10}
    M${cx - 45},${ankleY - 10}
    Q${cx - 42},${ankleY + 5} ${cx - 40},${ankleY + 15}
  `);
  // Left foot
  paths.push(`
    M${cx - 58},${ankleY + 8}
    Q${cx - 70},${footY} ${cx - 85},${footY + 10}
    Q${cx - 90},${footY + 15} ${cx - 88},${footY + 22}
    L${cx - 40},${footY + 22}
    Q${cx - 35},${footY + 15} ${cx - 38},${footY + 5}
    Q${cx - 42},${ankleY + 10} ${cx - 50},${ankleY + 8}
  `);
  // Toes (left foot)
  for (let t = 0; t < 5; t++) {
    const tx = cx - 85 + t * 10;
    paths.push(`M${tx},${footY + 22} L${tx + 2},${footY + 28} L${tx + 5},${footY + 22}`);
  }
  
  // RIGHT LEG
  // Upper thigh
  paths.push(`
    M${cx + 55},${hipY}
    Q${cx + 65},${hipY + 30} ${cx + 70},${groinY}
    Q${cx + 75},${groinY + 40} ${cx + 72},${thighY}
    Q${cx + 68},${thighY + 30} ${cx + 62},${thighY + 60}
  `);
  // Inner thigh
  paths.push(`
    M${cx + 15},${groinY + 30}
    Q${cx + 25},${groinY + 60} ${cx + 35},${thighY}
    Q${cx + 42},${thighY + 40} ${cx + 45},${thighY + 80}
  `);
  // Quadriceps
  paths.push(`
    M${cx + 60},${thighY - 20}
    Q${cx + 55},${thighY + 20} ${cx + 50},${thighY + 60}
    M${cx + 55},${thighY - 10}
    Q${cx + 50},${thighY + 30} ${cx + 48},${thighY + 70}
  `);
  // Knee
  paths.push(`
    M${cx + 65},${kneeY - 20}
    Q${cx + 60},${kneeY} ${cx + 55},${kneeY + 15}
    Q${cx + 50},${kneeY + 25} ${cx + 48},${kneeY + 35}
    M${cx + 45},${kneeY - 15}
    Q${cx + 42},${kneeY + 5} ${cx + 40},${kneeY + 25}
  `);
  // Kneecap
  paths.push(`
    M${cx + 58},${kneeY - 5}
    C${cx + 65},${kneeY} ${cx + 65},${kneeY + 20} ${cx + 58},${kneeY + 25}
    C${cx + 50},${kneeY + 20} ${cx + 50},${kneeY} ${cx + 58},${kneeY - 5}
    Z
  `);
  // Calf
  paths.push(`
    M${cx + 70},${kneeY + 30}
    Q${cx + 75},${kneeY + 60} ${cx + 72},${calfY - 30}
    Q${cx + 68},${calfY} ${cx + 60},${calfY + 30}
    Q${cx + 55},${calfY + 50} ${cx + 52},${ankleY - 20}
  `);
  // Shin
  paths.push(`
    M${cx + 48},${kneeY + 35}
    Q${cx + 45},${kneeY + 60} ${cx + 42},${calfY - 20}
    Q${cx + 40},${calfY + 20} ${cx + 38},${ankleY - 15}
  `);
  // Ankle
  paths.push(`
    M${cx + 60},${ankleY - 20}
    Q${cx + 55},${ankleY} ${cx + 50},${ankleY + 10}
    M${cx + 45},${ankleY - 10}
    Q${cx + 42},${ankleY + 5} ${cx + 40},${ankleY + 15}
  `);
  // Right foot
  paths.push(`
    M${cx + 58},${ankleY + 8}
    Q${cx + 70},${footY} ${cx + 85},${footY + 10}
    Q${cx + 90},${footY + 15} ${cx + 88},${footY + 22}
    L${cx + 40},${footY + 22}
    Q${cx + 35},${footY + 15} ${cx + 38},${footY + 5}
    Q${cx + 42},${ankleY + 10} ${cx + 50},${ankleY + 8}
  `);
  // Toes (right foot)
  for (let t = 0; t < 5; t++) {
    const tx = cx + 40 + t * 10;
    paths.push(`M${tx},${footY + 22} L${tx + 2},${footY + 28} L${tx + 5},${footY + 22}`);
  }
  
  return paths;
}

// Generate insanely detailed hand
function generateInsaneHand(x: number, y: number, side: 'left' | 'right'): string {
  const m = side === 'left' ? 1 : -1;
  const paths: string[] = [];
  
  // Palm
  paths.push(`
    M${x - 20 * m},${y}
    Q${x - 25 * m},${y + 20} ${x - 22 * m},${y + 45}
    Q${x - 18 * m},${y + 65} ${x - 10 * m},${y + 75}
    L${x + 25 * m},${y + 75}
    Q${x + 30 * m},${y + 60} ${x + 28 * m},${y + 40}
    Q${x + 25 * m},${y + 15} ${x + 15 * m},${y}
    Z
  `);
  
  // Palm lines
  paths.push(`
    M${x - 18 * m},${y + 20} Q${x},${y + 35} ${x + 20 * m},${y + 25}
    M${x - 15 * m},${y + 35} Q${x},${y + 50} ${x + 15 * m},${y + 40}
    M${x - 12 * m},${y + 55} Q${x},${y + 60} ${x + 10 * m},${y + 55}
  `);
  
  // Thumb
  paths.push(`
    M${x - 20 * m},${y + 10}
    Q${x - 35 * m},${y + 5} ${x - 45 * m},${y + 15}
    Q${x - 55 * m},${y + 30} ${x - 52 * m},${y + 50}
    Q${x - 48 * m},${y + 60} ${x - 40 * m},${y + 55}
    Q${x - 32 * m},${y + 48} ${x - 28 * m},${y + 35}
    Q${x - 24 * m},${y + 22} ${x - 20 * m},${y + 10}
  `);
  // Thumb nail
  paths.push(`
    M${x - 50 * m},${y + 25} Q${x - 52 * m},${y + 20} ${x - 48 * m},${y + 18} Q${x - 44 * m},${y + 22} ${x - 46 * m},${y + 30}
  `);
  // Thumb knuckle
  paths.push(`M${x - 35 * m},${y + 32} Q${x - 38 * m},${y + 38} ${x - 33 * m},${y + 42}`);
  
  // Fingers (index, middle, ring, pinky)
  const fingerData = [
    { baseX: -12, len: 55, width: 8 },  // Index
    { baseX: -2, len: 60, width: 9 },   // Middle
    { baseX: 8, len: 55, width: 8 },    // Ring
    { baseX: 18, len: 45, width: 7 },   // Pinky
  ];
  
  for (const finger of fingerData) {
    const fx = x + finger.baseX * m;
    const fy = y + 75;
    const w = finger.width;
    const len = finger.len;
    
    // Finger outline
    paths.push(`
      M${fx - w / 2 * m},${fy}
      L${fx - w / 2 * m},${fy + len * 0.4}
      Q${fx - w / 2 * m},${fy + len * 0.45} ${fx - w / 2.5 * m},${fy + len * 0.5}
      L${fx - w / 2.5 * m},${fy + len * 0.75}
      Q${fx - w / 2.5 * m},${fy + len * 0.8} ${fx - w / 3 * m},${fy + len * 0.85}
      L${fx - w / 3 * m},${fy + len * 0.95}
      Q${fx},${fy + len + 3} ${fx + w / 3 * m},${fy + len * 0.95}
      L${fx + w / 3 * m},${fy + len * 0.85}
      Q${fx + w / 2.5 * m},${fy + len * 0.8} ${fx + w / 2.5 * m},${fy + len * 0.75}
      L${fx + w / 2.5 * m},${fy + len * 0.5}
      Q${fx + w / 2 * m},${fy + len * 0.45} ${fx + w / 2 * m},${fy + len * 0.4}
      L${fx + w / 2 * m},${fy}
    `);
    
    // Knuckle creases
    paths.push(`M${fx - w / 2 * m},${fy + len * 0.42} Q${fx},${fy + len * 0.45} ${fx + w / 2 * m},${fy + len * 0.42}`);
    paths.push(`M${fx - w / 2.5 * m},${fy + len * 0.72} Q${fx},${fy + len * 0.75} ${fx + w / 2.5 * m},${fy + len * 0.72}`);
    
    // Fingernail
    paths.push(`
      M${fx - w / 3 * m},${fy + len * 0.85}
      Q${fx - w / 3 * m},${fy + len * 0.78} ${fx},${fy + len * 0.76}
      Q${fx + w / 3 * m},${fy + len * 0.78} ${fx + w / 3 * m},${fy + len * 0.85}
      L${fx + w / 3.5 * m},${fy + len * 0.93}
      Q${fx},${fy + len * 0.96} ${fx - w / 3.5 * m},${fy + len * 0.93}
      Z
    `);
    // Nail lunula (half-moon)
    paths.push(`
      M${fx - w / 4 * m},${fy + len * 0.84}
      Q${fx},${fy + len * 0.82} ${fx + w / 4 * m},${fy + len * 0.84}
    `);
  }
  
  // Knuckles on back of hand
  paths.push(`
    M${x - 10 * m},${y + 70} A3,3 0 1,1 ${x - 4 * m},${y + 70} A3,3 0 1,1 ${x - 10 * m},${y + 70}
    M${x},${y + 68} A3,3 0 1,1 ${x + 6 * m},${y + 68} A3,3 0 1,1 ${x},${y + 68}
    M${x + 10 * m},${y + 70} A3,3 0 1,1 ${x + 16 * m},${y + 70} A3,3 0 1,1 ${x + 10 * m},${y + 70}
    M${x + 18 * m},${y + 72} A2.5,2.5 0 1,1 ${x + 23 * m},${y + 72} A2.5,2.5 0 1,1 ${x + 18 * m},${y + 72}
  `);
  
  // Tendons on back of hand
  paths.push(`
    M${x - 8 * m},${y + 10} L${x - 8 * m},${y + 70}
    M${x + 2 * m},${y + 8} L${x + 2 * m},${y + 68}
    M${x + 12 * m},${y + 10} L${x + 12 * m},${y + 70}
    M${x + 20 * m},${y + 12} L${x + 20 * m},${y + 72}
  `);
  
  // Veins
  paths.push(`
    M${x - 15 * m},${y + 5} Q${x - 12 * m},${y + 25} ${x - 8 * m},${y + 50}
    M${x + 5 * m},${y + 2} Q${x + 8 * m},${y + 30} ${x + 5 * m},${y + 55}
  `);
  
  return paths.join(' ');
}

function generateDetailedHand(x: number, y: number, side: 'left' | 'right'): string {
  const mirror = side === 'left' ? 1 : -1;
  return `
    M${x},${y}
    Q${x + 5 * mirror},${y + 15} ${x + 3 * mirror},${y + 30}
    L${x + 8 * mirror},${y + 55}
    Q${x + 10 * mirror},${y + 60} ${x + 8 * mirror},${y + 65}
    L${x + 5 * mirror},${y + 60}
    L${x + 12 * mirror},${y + 70}
    Q${x + 14 * mirror},${y + 75} ${x + 12 * mirror},${y + 78}
    L${x + 8 * mirror},${y + 72}
    L${x + 15 * mirror},${y + 72}
    Q${x + 18 * mirror},${y + 77} ${x + 15 * mirror},${y + 80}
    L${x + 10 * mirror},${y + 75}
    L${x + 16 * mirror},${y + 74}
    Q${x + 19 * mirror},${y + 78} ${x + 16 * mirror},${y + 82}
    L${x + 8 * mirror},${y + 78}
    L${x + 12 * mirror},${y + 75}
    Q${x + 14 * mirror},${y + 80} ${x + 10 * mirror},${y + 82}
    Q${x + 2 * mirror},${y + 80} ${x - 5 * mirror},${y + 70}
    Q${x - 10 * mirror},${y + 50} ${x - 8 * mirror},${y + 30}
    Q${x - 5 * mirror},${y + 10} ${x},${y}
  `;
}

function generateCyborgSilhouette(): string[] {
  const humanBase = generateHumanSilhouette();
  const cyborgPaths: string[] = [...humanBase];
  
  // =========================================================================
  // MECHANICAL HEAD OVERLAY (~1500 points)
  // =========================================================================
  
  // Cranial plating - left hemisphere
  cyborgPaths.push(`
    M175,55
    L170,65 L162,72 L158,85 L155,100
    L154,115 L156,130 L155,145 L158,160
    L162,175 L170,185 L180,190
    Q190,188 200,186
  `);
  // Panel seam details
  cyborgPaths.push(`
    M165,70 L160,80 L158,95 L160,110
    M168,75 L164,85 L162,100
    M158,120 L155,135 L158,150
    M162,165 L168,178
  `);
  // Hex bolts on left plate
  const leftBolts = [[162, 78], [156, 105], [158, 135], [165, 172]];
  for (const [bx, by] of leftBolts) {
    cyborgPaths.push(`M${bx - 3},${by} L${bx},${by - 3} L${bx + 3},${by} L${bx},${by + 3} Z`);
  }
  
  // Cranial plating - right hemisphere
  cyborgPaths.push(`
    M225,55
    L230,65 L238,72 L242,85 L245,100
    L246,115 L244,130 L245,145 L242,160
    L238,175 L230,185 L220,190
    Q210,188 200,186
  `);
  cyborgPaths.push(`
    M235,70 L240,80 L242,95 L240,110
    M232,75 L236,85 L238,100
    M242,120 L245,135 L242,150
    M238,165 L232,178
  `);
  const rightBolts = [[238, 78], [244, 105], [242, 135], [235, 172]];
  for (const [bx, by] of rightBolts) {
    cyborgPaths.push(`M${bx - 3},${by} L${bx},${by - 3} L${bx + 3},${by} L${bx},${by + 3} Z`);
  }
  
  // Cybernetic eye (left - replaced with optics)
  cyborgPaths.push(`
    M155,128
    L150,135 L148,145 L150,155 L158,162
    L170,165 L180,160 L185,150 L183,138 L175,130 L165,127
    Z
  `);
  // Optical sensor rings
  cyborgPaths.push(`M160,140 A10,10 0 1,1 175,145 A10,10 0 1,1 160,140`);
  cyborgPaths.push(`M163,142 A7,7 0 1,1 173,145 A7,7 0 1,1 163,142`);
  cyborgPaths.push(`M166,144 A4,4 0 1,1 171,145 A4,4 0 1,1 166,144`);
  // Optical aperture blades (6)
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const cx = 168, cy = 145;
    cyborgPaths.push(`
      M${cx},${cy}
      L${cx + Math.cos(angle) * 8},${cy + Math.sin(angle) * 8}
      L${cx + Math.cos(angle + 0.2) * 12},${cy + Math.sin(angle + 0.2) * 12}
      L${cx + Math.cos(angle + 0.5) * 6},${cy + Math.sin(angle + 0.5) * 6}
    `);
  }
  // Targeting reticle
  cyborgPaths.push(`M158,145 L163,145 M173,145 L178,145 M168,135 L168,140 M168,150 L168,155`);
  
  // Human eye (right - kept organic for contrast)
  // Already exists from human base
  
  // Neural interface ports (temple)
  cyborgPaths.push(`
    M128,140 L118,138 L115,145 L118,152 L128,150 Z
    M112,140 L108,145 L112,150
  `);
  // Port connection pins
  cyborgPaths.push(`M120,142 A1.5,1.5 0 1,1 123,142 M120,148 A1.5,1.5 0 1,1 123,148`);
  
  // Circuit traces on face (PCB-style)
  // Left side traces
  cyborgPaths.push(`
    M150,100 L145,105 L145,115 L140,120 L140,135 L138,140
    M145,105 L138,108 L135,115
    M140,120 L132,122 L128,128
    M138,140 L130,142 L125,148
  `);
  // Right side traces
  cyborgPaths.push(`
    M250,100 L255,105 L255,115 L260,120 L260,135 L262,140
    M255,105 L262,108 L265,115
    M260,120 L268,122 L272,128
    M262,140 L270,142 L275,148
  `);
  // Trace vias (connection points)
  const vias = [[145, 105], [140, 120], [138, 140], [255, 105], [260, 120], [262, 140]];
  for (const [vx, vy] of vias) {
    cyborgPaths.push(`M${vx - 2},${vy} A2,2 0 1,1 ${vx + 2},${vy} A2,2 0 1,1 ${vx - 2},${vy}`);
  }
  
  // Jaw mechanism
  cyborgPaths.push(`
    M140,230 L135,235 L132,245 L135,255 L145,258
    M260,230 L265,235 L268,245 L265,255 L255,258
  `);
  // Jaw pistons
  cyborgPaths.push(`
    M138,238 L142,248 L138,258
    M262,238 L258,248 L262,258
  `);
  // Jaw vents
  for (let i = 0; i < 4; i++) {
    const y = 240 + i * 5;
    cyborgPaths.push(`M145,${y} L155,${y}`);
    cyborgPaths.push(`M245,${y} L255,${y}`);
  }
  
  // =========================================================================
  // MECHANICAL LEFT ARM (~1000 points)
  // =========================================================================
  
  // Shoulder joint housing
  cyborgPaths.push(`
    M138,335
    L125,340 L115,355 L110,375 L115,395 L125,410
    Q135,420 145,415
  `);
  // Shoulder armor plates
  cyborgPaths.push(`
    M130,345 L120,358 L118,378 L122,395
    M135,350 L128,362 L126,380 L130,398
    M140,355 L135,365 L134,382 L138,400
  `);
  // Shoulder joint rings
  cyborgPaths.push(`M122,370 A12,8 0 1,1 136,370`);
  cyborgPaths.push(`M125,372 A9,6 0 1,1 133,372`);
  
  // Upper arm hydraulic housing
  cyborgPaths.push(`
    M145,415
    L140,435 L135,460 L132,490 L135,520 L140,545
  `);
  // Hydraulic pistons
  cyborgPaths.push(`
    M142,420 L138,445 L142,470 L138,495 L142,520
    M148,418 L152,443 L148,468 L152,493 L148,518
  `);
  // Pressure gauges
  cyborgPaths.push(`M135,450 A5,5 0 1,1 145,450 A5,5 0 1,1 135,450`);
  cyborgPaths.push(`M136,452 L140,455 L144,452`); // Gauge needle
  cyborgPaths.push(`M135,490 A5,5 0 1,1 145,490 A5,5 0 1,1 135,490`);
  cyborgPaths.push(`M136,492 L140,488 L144,492`);
  
  // Elbow joint
  cyborgPaths.push(`
    M130,545
    L122,555 L118,570 L122,585 L130,595
    Q140,605 150,598
  `);
  // Elbow gears (visible)
  cyborgPaths.push(`M125,568 A10,10 0 1,1 140,575 A10,10 0 1,1 125,568`);
  // Gear teeth
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const cx = 132, cy = 572;
    cyborgPaths.push(`M${cx + Math.cos(angle) * 8},${cy + Math.sin(angle) * 8} L${cx + Math.cos(angle) * 12},${cy + Math.sin(angle) * 12}`);
  }
  
  // Forearm plating
  cyborgPaths.push(`
    M150,598
    L148,620 L145,650 L143,680 L142,710
  `);
  // Forearm panel lines
  cyborgPaths.push(`
    M145,610 L155,608
    M143,640 L153,638
    M142,670 L152,668
    M141,700 L151,698
  `);
  // Forearm vents
  for (let i = 0; i < 5; i++) {
    const y = 615 + i * 18;
    cyborgPaths.push(`M120,${y} L130,${y}`);
  }
  // Cable conduits
  cyborgPaths.push(`
    M155,600 Q160,630 158,670 Q156,700 155,720
    M138,600 Q135,630 136,670 Q137,700 138,720
  `);
  
  // Mechanical hand attachment
  cyborgPaths.push(`
    M140,710
    L138,725 L140,740 L145,750
    L155,755 L170,752 L180,745
    L182,735 L180,725 L175,718
  `);
  // Finger servos
  for (let f = 0; f < 4; f++) {
    const fx = 148 + f * 8;
    cyborgPaths.push(`
      M${fx},755 L${fx - 2},770 L${fx},785 L${fx + 2},800 L${fx},815
    `);
    // Finger joints
    cyborgPaths.push(`M${fx - 3},772 L${fx + 3},772`);
    cyborgPaths.push(`M${fx - 2},788 L${fx + 2},788`);
    cyborgPaths.push(`M${fx - 2},802 L${fx + 2},802`);
  }
  
  // =========================================================================
  // TORSO ARMOR (~800 points)
  // =========================================================================
  
  // Central chest reactor core
  cyborgPaths.push(`
    M180,375 L200,360 L220,375 L225,400 L220,425 L200,440 L180,425 L175,400 Z
  `);
  // Reactor rings
  cyborgPaths.push(`M185,380 L200,368 L215,380 L218,400 L215,420 L200,432 L185,420 L182,400 Z`);
  cyborgPaths.push(`M190,385 L200,376 L210,385 L212,400 L210,415 L200,424 L190,415 L188,400 Z`);
  cyborgPaths.push(`M195,390 L200,384 L205,390 L206,400 L205,410 L200,416 L195,410 L194,400 Z`);
  // Reactor glow lines (radial)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    cyborgPaths.push(`M200,400 L${200 + Math.cos(angle) * 25},${400 + Math.sin(angle) * 25}`);
  }
  
  // Chest armor plates (left)
  cyborgPaths.push(`
    M175,375 L155,360 L140,370 L135,400 L140,430 L155,445 L175,435
  `);
  // Plate details
  cyborgPaths.push(`M160,365 L148,375 L145,395 L150,418`);
  cyborgPaths.push(`M165,362 L155,372 L152,392 L158,420`);
  // Ventilation slits
  for (let i = 0; i < 4; i++) {
    cyborgPaths.push(`M142,${378 + i * 12} L150,${378 + i * 12}`);
  }
  
  // Chest armor plates (right)
  cyborgPaths.push(`
    M225,375 L245,360 L260,370 L265,400 L260,430 L245,445 L225,435
  `);
  cyborgPaths.push(`M240,365 L252,375 L255,395 L250,418`);
  cyborgPaths.push(`M235,362 L245,372 L248,392 L242,420`);
  for (let i = 0; i < 4; i++) {
    cyborgPaths.push(`M258,${378 + i * 12} L250,${378 + i * 12}`);
  }
  
  // Abdominal armor segments
  for (let row = 0; row < 4; row++) {
    const y = 445 + row * 35;
    // Left segment
    cyborgPaths.push(`M160,${y} L145,${y + 5} L142,${y + 20} L148,${y + 32} L165,${y + 30}`);
    // Right segment
    cyborgPaths.push(`M240,${y} L255,${y + 5} L258,${y + 20} L252,${y + 32} L235,${y + 30}`);
    // Center segments
    cyborgPaths.push(`M175,${y - 2} L185,${y - 5} L195,${y - 2} L195,${y + 28} L185,${y + 32} L175,${y + 28} Z`);
    cyborgPaths.push(`M205,${y - 2} L215,${y - 5} L225,${y - 2} L225,${y + 28} L215,${y + 32} L205,${y + 28} Z`);
  }
  
  // Spine mechanism (visible)
  cyborgPaths.push(`M198,330 L200,320 L202,330`);
  for (let i = 0; i < 8; i++) {
    const y = 340 + i * 32;
    cyborgPaths.push(`
      M195,${y} L200,${y - 8} L205,${y} L202,${y + 12} L200,${y + 16} L198,${y + 12} Z
    `);
    // Vertebrae connectors
    cyborgPaths.push(`M198,${y + 16} L198,${y + 24}`);
    cyborgPaths.push(`M202,${y + 16} L202,${y + 24}`);
  }
  
  // Cable bundles (neck to torso)
  cyborgPaths.push(`
    M185,268 Q175,300 170,340 Q168,380 172,420
    M215,268 Q225,300 230,340 Q232,380 228,420
  `);
  // Individual cables
  for (let c = 0; c < 3; c++) {
    const offset = c * 4;
    cyborgPaths.push(`M${183 - offset},270 Q${173 - offset},305 ${168 - offset},345`);
    cyborgPaths.push(`M${217 + offset},270 Q${227 + offset},305 ${232 + offset},345`);
  }
  
  // Status LEDs (small circles that could animate)
  const leds = [
    [145, 385], [145, 405], [145, 425],  // Left
    [255, 385], [255, 405], [255, 425],  // Right
    [200, 345], [200, 355],              // Center
  ];
  for (const [lx, ly] of leds) {
    cyborgPaths.push(`M${lx - 2},${ly} A2,2 0 1,1 ${lx + 2},${ly} A2,2 0 1,1 ${lx - 2},${ly}`);
  }
  
  return cyborgPaths;
}

function generateMutantSilhouette(): string[] {
  const paths: string[] = [];
  
  // =========================================================================
  // ASYMMETRIC MUTANT HEAD (~1400 points)
  // =========================================================================
  
  // Misshapen skull - larger right side
  paths.push(`
    M200,38
    C215,35 235,38 255,48
    C275,60 292,82 300,110
    Q308,138 312,160
    C315,178 312,198 305,218
    Q298,235 288,250
    Q275,268 258,278
    Q235,288 210,290
    Q185,288 160,280
    Q138,270 122,252
    Q108,235 100,212
    Q92,188 95,162
    Q98,135 108,112
    Q120,85 142,62
    Q165,42 190,38
    Q195,37 200,38
    Z
  `);
  
  // Cranial deformity bumps
  paths.push(`
    M265,55 Q280,48 290,60 Q298,75 288,88 Q275,95 262,82 Q255,68 265,55
    M145,70 Q130,65 125,80 Q122,98 138,105 Q155,100 152,82 Q150,72 145,70
    M305,145 Q320,140 325,158 Q328,178 315,188 Q300,185 302,165 Q303,150 305,145
  `);
  
  // Mutation pustules (scattered)
  const pustules = [
    [275, 72, 8], [138, 85, 6], [310, 165, 7],
    [118, 145, 5], [285, 195, 6], [125, 200, 5],
    [270, 240, 4], [148, 235, 5], [302, 125, 4],
  ];
  for (const [px, py, pr] of pustules) {
    paths.push(`M${px - pr},${py} A${pr},${pr} 0 1,1 ${px + pr},${py} A${pr},${pr} 0 1,1 ${px - pr},${py}`);
    // Pustule highlight
    paths.push(`M${px - pr * 0.3},${py - pr * 0.3} A${pr * 0.3},${pr * 0.3} 0 1,1 ${px},${py - pr * 0.5}`);
  }
  
  // Left eye - atrophied, scarred shut
  paths.push(`
    M155,125
    Q145,130 142,142
    Q140,155 148,165
    Q158,172 170,168
    Q180,162 182,150
    Q183,138 175,128
    Q165,122 155,125
  `);
  // Scar tissue over left eye
  paths.push(`
    M148,128 Q155,145 150,162
    M152,125 Q162,142 158,165
    M158,122 Q170,140 168,168
    M145,140 Q165,145 175,155
    M142,150 Q162,155 178,158
  `);
  
  // Right eye - enlarged, bulging
  paths.push(`
    M232,115
    Q218,108 205,118
    Q192,130 195,150
    Q198,172 215,185
    Q235,195 258,185
    Q278,172 282,148
    Q285,125 270,112
    Q252,100 232,115
  `);
  // Bulging eye detail - bloodshot veins
  paths.push(`
    M215,125 Q225,135 240,132
    M210,140 Q230,148 255,142
    M212,155 Q235,162 260,155
    M220,170 Q242,175 262,168
  `);
  // Enlarged iris
  paths.push(`M225,140 A18,18 0 1,1 255,150 A18,18 0 1,1 225,140`);
  // Irregular pupil
  paths.push(`
    M235,142 Q240,138 248,142 Q252,148 248,155 Q242,160 235,155 Q230,148 235,142
  `);
  
  // Deformed nose - off-center, broken
  paths.push(`
    M205,155
    L208,165 Q212,175 215,185
    Q218,195 215,205
    Q210,215 205,220
    Q198,225 195,220
    Q188,212 192,198
    Q195,185 198,175
    Q200,165 200,155
  `);
  // Nasal cavity exposed
  paths.push(`
    M195,210 Q192,215 195,222
    M208,212 Q212,218 208,225
  `);
  
  // Mouth - lipless, exposed teeth
  paths.push(`
    M165,248
    Q180,242 200,245
    Q220,242 240,252
    Q232,260 225,265
    Q200,272 175,265
    Q168,260 165,248
  `);
  // Exposed teeth
  for (let t = 0; t < 10; t++) {
    const tx = 172 + t * 7;
    const ty = t < 5 ? 250 : 252;
    paths.push(`M${tx},${ty} L${tx + 2},${ty + 8} L${tx + 5},${ty} Z`);
  }
  // Gum recession
  paths.push(`M168,248 Q185,245 200,246 Q215,245 235,250`);
  
  // Mutated ears
  // Left ear - withered
  paths.push(`
    M95,140
    Q82,145 78,162
    Q75,180 82,195
    Q90,205 100,200
    Q98,185 96,170
    Q95,155 95,140
  `);
  // Right ear - overgrown
  paths.push(`
    M310,125
    Q330,120 345,140
    Q358,165 352,195
    Q345,225 325,240
    Q308,248 295,235
    Q302,215 308,190
    Q315,160 310,125
  `);
  // Ear growths
  paths.push(`
    M340,155 Q355,158 358,175 Q355,192 342,188
    M348,180 Q362,182 360,198 Q352,210 342,205
  `);
  
  // Facial scarring
  paths.push(`
    M155,180 Q175,195 180,220 Q185,245 175,265
    M260,160 Q280,175 295,200 Q305,230 295,260
    M135,215 Q155,225 170,242
  `);
  
  // Forehead veins (visible through thin skin)
  paths.push(`
    M180,55 Q170,75 165,100 Q162,120 168,135
    M220,50 Q240,70 260,95 Q275,115 280,135
    M200,42 L198,65 Q195,85 200,105
  `);
  
  // =========================================================================
  // MUTATED NECK (~300 points) - Growths, exposed muscle
  // =========================================================================
  
  paths.push(`
    M160,280 Q148,300 142,330 Q138,360 140,390
    M290,280 Q308,310 318,350 Q325,390 320,420
  `);
  
  // Neck tumors
  paths.push(`
    M130,310 Q115,315 112,335 Q115,355 135,358 Q150,352 148,330 Q145,312 130,310
    M320,340 Q340,335 348,360 Q352,388 335,400 Q315,398 312,370 Q310,345 320,340
  `);
  
  // Exposed muscle fibers
  for (let i = 0; i < 8; i++) {
    const y = 295 + i * 12;
    paths.push(`M155,${y} Q145,${y + 5} 142,${y + 15}`);
    paths.push(`M295,${y + 5} Q305,${y + 10} 310,${y + 20}`);
  }
  
  // =========================================================================
  // MUTATED TORSO (~2200 points) - Asymmetric, tumors, exposed tissue
  // =========================================================================
  
  // Asymmetric torso outline
  paths.push(`
    M140,390
    C115,420 85,480 78,550
    Q72,620 85,680
    L95,740
    L305,740
    L320,680
    Q335,620 328,550
    C322,480 295,420 265,385
    Q235,375 200,372
    Q165,375 140,390
    Z
  `);
  
  // Massive shoulder tumor (left)
  paths.push(`
    M120,395
    Q85,400 65,435
    Q48,475 58,520
    Q70,560 105,575
    Q135,582 155,560
    Q170,535 162,495
    Q155,455 140,420
    Q130,400 120,395
  `);
  // Tumor surface detail
  paths.push(`
    M90,430 Q75,455 82,490 Q92,525 118,545
    M105,415 Q88,445 95,485 Q108,530 138,555
  `);
  // Tumor veins
  paths.push(`
    M72,450 Q85,470 88,500 Q90,530 100,555
    M60,475 Q78,495 82,525 Q88,555 105,575
  `);
  
  // Chest cavity partially exposed (left)
  paths.push(`
    M155,420
    Q145,445 148,480
    Q152,515 165,545
  `);
  // Rib suggestions
  for (let r = 0; r < 5; r++) {
    const y = 440 + r * 22;
    paths.push(`M150,${y} Q145,${y + 8} 155,${y + 15}`);
  }
  
  // Right side - more human but scarred
  paths.push(`
    M265,385
    Q295,405 310,445
    Q322,495 318,550
    Q315,610 305,665
  `);
  // Scar tissue
  paths.push(`
    M275,400 Q295,430 305,470 Q312,510 308,555
    M270,420 Q288,450 298,490 Q305,535 302,580
    M268,445 Q282,475 290,515 Q296,560 295,605
  `);
  
  // Distorted abs (only partially visible)
  paths.push(`
    M185,480 Q195,475 205,480 Q200,510 195,540 Q190,565 188,590
    M215,475 Q228,472 238,480 Q232,515 225,550 Q220,580 218,610
  `);
  
  // Lower torso growths
  paths.push(`
    M125,620 Q105,628 98,655 Q95,685 112,705 Q135,715 155,700 Q168,680 160,650 Q150,625 125,620
    M280,640 Q302,635 318,660 Q328,695 312,720 Q288,735 265,715 Q252,690 262,658 Q272,635 280,640
  `);
  
  // Spine - visible, deformed
  paths.push(`M200,380 L198,400 L202,420 L196,445 L204,470 L195,500 L205,530 L198,560 L203,590 L197,620 L200,650`);
  // Vertebrae protrusions
  for (let v = 0; v < 8; v++) {
    const vy = 395 + v * 35;
    paths.push(`M200,${vy} L195,${vy + 5} L200,${vy + 12} L205,${vy + 5} Z`);
  }
  
  // =========================================================================
  // MUTATED ARMS (~1200 points)
  // =========================================================================
  
  // Left arm - massive, tentacle-like
  paths.push(`
    M162,495
    Q140,520 115,560
    Q85,610 60,670
    Q42,720 35,780
    Q32,830 45,870
    L55,890
    L125,890
    L130,850
    Q138,790 150,730
    Q165,670 175,615
    Q185,560 180,510
    Q175,480 162,495
  `);
  // Tentacle suckers/growths
  const suckers = [
    [95, 600, 10], [75, 660, 12], [55, 730, 15],
    [45, 800, 12], [60, 850, 10], [105, 620, 8],
    [85, 690, 9], [68, 760, 11], [52, 830, 8],
  ];
  for (const [sx, sy, sr] of suckers) {
    paths.push(`M${sx - sr},${sy} A${sr},${sr} 0 1,1 ${sx + sr},${sy} A${sr},${sr} 0 1,1 ${sx - sr},${sy}`);
    paths.push(`M${sx - sr * 0.5},${sy} A${sr * 0.5},${sr * 0.5} 0 1,1 ${sx + sr * 0.5},${sy}`);
  }
  
  // Left arm tendrils
  for (let td = 0; td < 4; td++) {
    const ty = 600 + td * 65;
    paths.push(`
      M${80 - td * 8},${ty}
      Q${60 - td * 10},${ty + 20} ${50 - td * 12},${ty + 10}
      Q${35 - td * 10},${ty + 30} ${45 - td * 8},${ty + 45}
    `);
  }
  
  // Right arm - withered, atrophied
  paths.push(`
    M265,385
    Q288,400 305,435
    Q318,475 322,520
    Q325,570 320,620
    Q315,670 312,720
    Q310,770 315,810
    L320,840
    L370,840
    L375,800
    Q378,750 372,700
    Q365,650 355,600
    Q342,545 335,490
    Q328,435 310,395
    Q295,375 265,385
  `);
  // Withered muscle definition
  paths.push(`
    M310,420 Q325,455 328,500
    M315,450 Q330,490 332,540
    M318,510 Q328,550 330,600
  `);
  // Visible bones through skin
  paths.push(`
    M322,530 L325,580 L322,630 L328,680 L325,730 L330,780
    M340,550 L338,600 L342,650 L338,700 L345,750 L340,790
  `);
  
  // Clawed mutant hands
  paths.push(generateMutantClaw(55, 880, 'left'));
  paths.push(generateMutantClaw(370, 835, 'right'));
  
  // =========================================================================
  // SKIN TEXTURES (~800 points)
  // =========================================================================
  
  // Lesions
  for (let i = 0; i < 25; i++) {
    const lx = 100 + Math.sin(i * 1.7) * 100;
    const ly = 420 + (i / 25) * 280;
    const ls = 3 + Math.sin(i * 2.3) * 2;
    paths.push(`M${lx},${ly} Q${lx + ls},${ly - ls} ${lx + ls * 2},${ly} Q${lx + ls},${ly + ls} ${lx},${ly}`);
  }
  
  // Vein networks
  paths.push(`
    M150,450 Q135,480 128,520 Q122,565 130,610 Q140,660 155,700
    M250,430 Q275,470 290,520 Q302,575 298,630 Q292,690 280,730
    M170,500 Q155,540 150,590 Q148,640 158,690
    M235,485 Q258,530 272,580 Q282,635 275,695
  `);
  
  // Scale patches
  for (let sp = 0; sp < 12; sp++) {
    const spx = 140 + Math.sin(sp * 1.5) * 60 + sp * 8;
    const spy = 500 + (sp / 12) * 150;
    paths.push(`
      M${spx},${spy}
      L${spx + 8},${spy - 3} L${spx + 12},${spy + 5} L${spx + 6},${spy + 12} L${spx - 2},${spy + 8} Z
    `);
  }
  
  return paths;
}

// Generate mutant claw hand
function generateMutantClaw(x: number, y: number, side: 'left' | 'right'): string {
  const m = side === 'left' ? 1 : -1;
  const paths: string[] = [];
  
  // Deformed palm
  paths.push(`
    M${x - 25 * m},${y}
    Q${x - 30 * m},${y + 25} ${x - 22 * m},${y + 50}
    Q${x - 10 * m},${y + 70} ${x + 10 * m},${y + 65}
    Q${x + 25 * m},${y + 55} ${x + 30 * m},${y + 30}
    Q${x + 28 * m},${y + 10} ${x + 15 * m},${y - 5}
    Q${x},${y - 10} ${x - 15 * m},${y - 5}
    Q${x - 25 * m},${y - 3} ${x - 25 * m},${y}
  `);
  
  // Twisted claws (4 fingers)
  const clawData = [
    { ox: -18, oy: 50, len: 60, curve: 25 },
    { ox: -5, oy: 65, len: 70, curve: 30 },
    { ox: 8, oy: 62, len: 65, curve: 28 },
    { ox: 20, oy: 52, len: 55, curve: 22 },
  ];
  
  for (const claw of clawData) {
    const cx = x + claw.ox * m;
    const cy = y + claw.oy;
    
    paths.push(`
      M${cx - 4 * m},${cy}
      Q${cx - 6 * m},${cy + claw.len * 0.3} ${cx - 3 * m + claw.curve * m},${cy + claw.len * 0.6}
      Q${cx + claw.curve * 1.5 * m},${cy + claw.len * 0.85} ${cx + claw.curve * 1.2 * m},${cy + claw.len}
      L${cx + claw.curve * 1.3 * m},${cy + claw.len + 5}
      Q${cx + claw.curve * 0.8 * m},${cy + claw.len * 0.9} ${cx + 2 * m + claw.curve * 0.5 * m},${cy + claw.len * 0.65}
      Q${cx + 5 * m},${cy + claw.len * 0.35} ${cx + 4 * m},${cy}
    `);
    
    // Claw tip (sharp)
    paths.push(`
      M${cx + claw.curve * 1.2 * m},${cy + claw.len}
      L${cx + claw.curve * 1.5 * m},${cy + claw.len + 12}
      L${cx + claw.curve * 1.3 * m},${cy + claw.len + 5}
    `);
  }
  
  // Thumb claw
  paths.push(`
    M${x - 28 * m},${y + 15}
    Q${x - 45 * m},${y + 25} ${x - 55 * m},${y + 45}
    Q${x - 60 * m},${y + 60} ${x - 55 * m},${y + 75}
    L${x - 58 * m},${y + 85}
    Q${x - 52 * m},${y + 72} ${x - 48 * m},${y + 55}
    Q${x - 42 * m},${y + 35} ${x - 30 * m},${y + 22}
  `);
  
  // Warts and growths on hand
  paths.push(`
    M${x - 10 * m},${y + 20} A4,4 0 1,1 ${x - 2 * m},${y + 20}
    M${x + 5 * m},${y + 35} A3,3 0 1,1 ${x + 11 * m},${y + 35}
    M${x - 20 * m},${y + 40} A5,5 0 1,1 ${x - 10 * m},${y + 40}
  `);
  
  return paths.join(' ');
}

function generateEtherealSilhouette(): string[] {
  const paths: string[] = [];
  
  // =========================================================================
  // ETHEREAL HEAD (~1800 points) - Translucent skull, inner light, wisps
  // =========================================================================
  
  // Primary head form with flowing contours
  paths.push(`
    M200,55
    C215,50 235,52 255,62
    C275,75 288,95 295,120
    C302,145 300,175 292,200
    C285,225 270,248 248,265
    C230,278 212,285 200,286
    C188,285 170,278 152,265
    C130,248 115,225 108,200
    C100,175 98,145 105,120
    C112,95 125,75 145,62
    C165,52 185,50 200,55
    Z
  `);
  
  // Cranial energy lines (skull visible through translucent form)
  paths.push(`
    M145,75 Q165,68 185,72 Q200,75 215,72 Q235,68 255,75
    M140,90 Q170,82 200,85 Q230,82 260,90
    M138,108 Q168,98 200,102 Q232,98 262,108
  `);
  
  // Ethereal eye sockets (deep, glowing voids)
  // Left eye void
  paths.push(`
    M155,130
    Q142,128 135,140
    Q130,155 138,172
    Q148,185 165,182
    Q180,178 185,162
    Q188,145 178,132
    Q168,125 155,130
    Z
  `);
  // Left eye inner glow rings
  paths.push(`M148,145 A12,14 0 1,1 172,150 A12,14 0 1,1 148,145`);
  paths.push(`M152,148 A8,10 0 1,1 168,152 A8,10 0 1,1 152,148`);
  paths.push(`M156,151 A4,5 0 1,1 164,154 A4,5 0 1,1 156,151`);
  // Left eye energy emanation
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI - Math.PI / 2;
    const cx = 160, cy = 152;
    paths.push(`
      M${cx},${cy}
      Q${cx + Math.cos(angle) * 15},${cy + Math.sin(angle) * 18 - 5} ${cx + Math.cos(angle) * 25},${cy + Math.sin(angle) * 30 - 10}
    `);
  }
  
  // Right eye void
  paths.push(`
    M245,130
    Q258,128 265,140
    Q270,155 262,172
    Q252,185 235,182
    Q220,178 215,162
    Q212,145 222,132
    Q232,125 245,130
    Z
  `);
  // Right eye inner glow rings
  paths.push(`M228,145 A12,14 0 1,1 252,150 A12,14 0 1,1 228,145`);
  paths.push(`M232,148 A8,10 0 1,1 248,152 A8,10 0 1,1 232,148`);
  paths.push(`M236,151 A4,5 0 1,1 244,154 A4,5 0 1,1 236,151`);
  // Right eye energy emanation
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI - Math.PI / 2;
    const cx = 240, cy = 152;
    paths.push(`
      M${cx},${cy}
      Q${cx + Math.cos(angle) * 15},${cy + Math.sin(angle) * 18 - 5} ${cx + Math.cos(angle) * 25},${cy + Math.sin(angle) * 30 - 10}
    `);
  }
  
  // Ethereal nose (barely visible ridge)
  paths.push(`
    M198,160 Q196,175 195,190 Q194,205 196,218
    M202,160 Q204,175 205,190 Q206,205 204,218
    M196,218 Q200,225 204,218
  `);
  
  // Spectral mouth (wispy, slightly open)
  paths.push(`
    M170,235
    Q180,232 190,234
    Q200,236 210,234
    Q220,232 230,235
    Q225,242 215,245
    Q200,248 185,245
    Q175,242 170,235
  `);
  // Inner mouth void
  paths.push(`M178,238 Q190,236 200,238 Q210,236 222,238 Q215,242 200,244 Q185,242 178,238`);
  
  // Cheek hollows (translucent skull showing)
  paths.push(`
    M135,165 Q130,180 135,200 Q140,218 152,235
    M265,165 Q270,180 265,200 Q260,218 248,235
  `);
  
  // Crown wisps (energy flowing upward from head)
  for (let i = 0; i < 12; i++) {
    const baseX = 140 + i * 10;
    const waveX = Math.sin(i * 0.7) * 15;
    const height = 30 + Math.sin(i * 0.9) * 20;
    paths.push(`
      M${baseX},${60 - i % 3 * 5}
      Q${baseX + waveX},${40 - height / 2} ${baseX + waveX * 0.5},${30 - height}
      Q${baseX - waveX * 0.3},${20 - height * 1.2} ${baseX + waveX * 0.8},${10 - height * 1.5}
    `);
  }
  
  // Side head wisps (flowing from temples)
  for (let side = 0; side < 2; side++) {
    const dir = side === 0 ? -1 : 1;
    const baseX = side === 0 ? 120 : 280;
    for (let w = 0; w < 6; w++) {
      const y = 100 + w * 25;
      paths.push(`
        M${baseX + dir * 10},${y}
        Q${baseX + dir * 35},${y - 10} ${baseX + dir * 55},${y + 5}
        Q${baseX + dir * 70},${y + 20} ${baseX + dir * 60},${y + 35}
        Q${baseX + dir * 75},${y + 50} ${baseX + dir * 65},${y + 60}
      `);
    }
  }
  
  // =========================================================================
  // ETHEREAL NECK & SHOULDERS (~600 points) - Flowing, incorporeal
  // =========================================================================
  
  // Neck energy streams
  paths.push(`
    M168,280 Q155,300 148,330 Q142,360 145,390
    M185,282 Q175,305 172,335 Q170,365 175,395
    M215,282 Q225,305 228,335 Q230,365 225,395
    M232,280 Q245,300 252,330 Q258,360 255,390
  `);
  
  // Shoulder wisps (flowing outward)
  for (let side = 0; side < 2; side++) {
    const dir = side === 0 ? -1 : 1;
    const baseX = 200 + dir * 55;
    paths.push(`
      M${baseX},390
      Q${baseX + dir * 30},380 ${baseX + dir * 60},385
      Q${baseX + dir * 90},392 ${baseX + dir * 110},380
      Q${baseX + dir * 125},370 ${baseX + dir * 135},385
    `);
  }
  
  // =========================================================================
  // ETHEREAL TORSO (~1500 points) - Translucent, inner light, energy flows
  // =========================================================================
  
  // Main torso form (semi-transparent body)
  paths.push(`
    M145,390
    C115,420 95,470 90,530
    C85,590 88,640 95,680
    Q100,710 95,740
    Q130,755 165,765
    Q185,770 200,772
    Q215,770 235,765
    Q270,755 305,740
    Q300,710 305,680
    C312,640 315,590 310,530
    C305,470 285,420 255,390
    Q230,382 200,380
    Q170,382 145,390
    Z
  `);
  
  // Inner energy core (heart region glowing)
  paths.push(`M180,440 A25,30 0 1,1 220,445 A25,30 0 1,1 180,440`);
  paths.push(`M188,445 A17,22 0 1,1 212,448 A17,22 0 1,1 188,445`);
  paths.push(`M195,450 A8,10 0 1,1 205,452 A8,10 0 1,1 195,450`);
  
  // Energy channels from core
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const cx = 200, cy = 450;
    const len = 60 + Math.sin(i * 2.3) * 20;
    paths.push(`
      M${cx},${cy}
      Q${cx + Math.cos(angle) * len * 0.5},${cy + Math.sin(angle) * len * 0.5} ${cx + Math.cos(angle) * len},${cy + Math.sin(angle) * len}
    `);
  }
  
  // Rib cage suggestion (visible through translucent form)
  for (let r = 0; r < 6; r++) {
    const y = 475 + r * 28;
    const width = 50 - r * 3;
    paths.push(`
      M${200 - width},${y} Q${200 - width - 15},${y + 12} ${200 - width + 5},${y + 20}
      M${200 + width},${y} Q${200 + width + 15},${y + 12} ${200 + width - 5},${y + 20}
    `);
  }
  
  // Spine energy column
  paths.push(`M200,400 L200,420 Q198,440 200,460 Q202,480 200,500 Q198,520 200,540 Q202,560 200,580 L200,620`);
  // Vertebrae light points
  for (let v = 0; v < 8; v++) {
    const vy = 415 + v * 28;
    paths.push(`M196,${vy} A4,4 0 1,1 204,${vy} A4,4 0 1,1 196,${vy}`);
  }
  
  // Energy waves across torso
  for (let w = 0; w < 12; w++) {
    const y = 410 + w * 25;
    const amp = 15 + Math.sin(w * 0.6) * 8;
    paths.push(`
      M${130 + Math.sin(w * 0.4) * 10},${y}
      Q${165},${y - amp} ${200},${y}
      Q${235},${y + amp} ${270 - Math.sin(w * 0.4) * 10},${y}
    `);
  }
  
  // =========================================================================
  // ETHEREAL ARMS (~1200 points) - Flowing tendrils, multiple streams
  // =========================================================================
  
  for (let side = 0; side < 2; side++) {
    const dir = side === 0 ? -1 : 1;
    const baseX = 200 + dir * 55;
    
    // Primary arm tendril
    paths.push(`
      M${baseX},390
      Q${baseX + dir * 40},420 ${baseX + dir * 70},460
      Q${baseX + dir * 95},510 ${baseX + dir * 110},570
      Q${baseX + dir * 120},630 ${baseX + dir * 115},690
      Q${baseX + dir * 108},740 ${baseX + dir * 95},780
    `);
    
    // Secondary arm streams (3 per arm)
    for (let s = 0; s < 3; s++) {
      const offset = (s - 1) * 20;
      const startY = 420 + s * 30;
      paths.push(`
        M${baseX + dir * (50 + s * 10)},${startY}
        Q${baseX + dir * (80 + offset)},${startY + 50} ${baseX + dir * (100 + offset)},${startY + 110}
        Q${baseX + dir * (115 + offset)},${startY + 170} ${baseX + dir * (105 + offset)},${startY + 230}
        Q${baseX + dir * (120 + offset)},${startY + 290} ${baseX + dir * (100 + offset)},${startY + 340}
      `);
    }
    
    // Finger tendrils (5 per hand, dissolving)
    for (let f = 0; f < 5; f++) {
      const fx = baseX + dir * (85 + f * 8);
      const fy = 780 + f * 5;
      paths.push(`
        M${fx},${fy}
        Q${fx + dir * 15},${fy + 25} ${fx + dir * 10},${fy + 50}
        Q${fx + dir * 20},${fy + 75} ${fx + dir * 8},${fy + 95}
        Q${fx + dir * 18},${fy + 115} ${fx + dir * 5},${fy + 130}
      `);
    }
    
    // Energy particles along arms
    for (let p = 0; p < 15; p++) {
      const py = 430 + p * 25;
      const px = baseX + dir * (60 + Math.sin(p * 0.8) * 30);
      const pr = 2 + Math.random() * 3;
      paths.push(`M${px - pr},${py} A${pr},${pr} 0 1,1 ${px + pr},${py} A${pr},${pr} 0 1,1 ${px - pr},${py}`);
    }
  }
  
  // =========================================================================
  // BOTTOM DISSOLUTION (~900 points) - Body fading into wisps
  // =========================================================================
  
  // Main dissolution tendrils
  for (let i = 0; i < 20; i++) {
    const x = 95 + i * 11;
    const variance1 = Math.sin(i * 0.7) * 35;
    const variance2 = Math.cos(i * 0.5) * 25;
    const len = 80 + Math.sin(i * 1.2) * 40;
    
    paths.push(`
      M${x},740
      Q${x + variance1 * 0.3},${760 + Math.abs(variance1) * 0.3} ${x + variance1 * 0.5},${780}
      Q${x + variance1},${800 + Math.abs(variance2) * 0.3} ${x + variance2},${820}
      Q${x + variance1 * 0.8},${840 + len * 0.2} ${x + variance2 * 0.5},${860}
      Q${x + variance1 * 0.3},${880} ${x + variance2 * 0.2},${900}
    `);
  }
  
  // Scattered dissolution particles
  for (let p = 0; p < 40; p++) {
    const px = 100 + Math.random() * 200;
    const py = 760 + Math.random() * 150;
    const pr = 1 + Math.random() * 4;
    paths.push(`M${px - pr},${py} A${pr},${pr} 0 1,1 ${px + pr},${py} A${pr},${pr} 0 1,1 ${px - pr},${py}`);
  }
  
  // Fading energy lines at bottom
  for (let l = 0; l < 15; l++) {
    const lx = 110 + l * 13;
    const ly = 750 + (l % 3) * 20;
    paths.push(`
      M${lx},${ly} Q${lx + 5},${ly + 30} ${lx - 5},${ly + 60}
      Q${lx + 8},${ly + 90} ${lx - 3},${ly + 120}
    `);
  }
  
  return paths;
}

function generateBeastSilhouette(): string[] {
  const paths: string[] = [];
  
  // =========================================================================
  // BEAST HEAD (~2000 points) - Lupine/feline hybrid, highly detailed
  // =========================================================================
  
  // Primary skull structure
  paths.push(`
    M200,35
    C220,30 245,32 270,45
    C295,60 315,85 325,115
    C335,145 332,180 322,210
    C312,240 295,268 270,290
    C250,308 225,318 200,320
    C175,318 150,308 130,290
    C105,268 88,240 78,210
    C68,180 65,145 75,115
    C85,85 105,60 130,45
    C155,32 180,30 200,35
    Z
  `);
  
  // Pronounced brow ridge
  paths.push(`
    M130,95 Q145,85 165,88 Q185,92 200,90 Q215,92 235,88 Q255,85 270,95
    M125,110 Q155,98 200,102 Q245,98 275,110
  `);
  
  // Left beast eye (predatory, slitted pupil)
  paths.push(`
    M145,125
    Q130,122 122,138
    Q115,158 125,178
    Q138,195 160,192
    Q180,188 188,168
    Q195,148 182,128
    Q168,115 145,125
    Z
  `);
  // Left eye detail - iris with texture
  paths.push(`M135,145 A18,22 0 1,1 170,155 A18,22 0 1,1 135,145`);
  // Slitted pupil
  paths.push(`
    M150,140 Q155,155 152,170
    L155,172 Q160,155 157,138 L154,136 Q152,145 150,140
  `);
  // Eye shine
  paths.push(`M140,142 A4,5 0 1,1 148,144`);
  // Lower eyelid
  paths.push(`M128,172 Q145,180 165,175 Q180,170 185,160`);
  // Upper eyelid crease
  paths.push(`M125,130 Q150,118 178,128`);
  
  // Right beast eye
  paths.push(`
    M255,125
    Q270,122 278,138
    Q285,158 275,178
    Q262,195 240,192
    Q220,188 212,168
    Q205,148 218,128
    Q232,115 255,125
    Z
  `);
  paths.push(`M230,145 A18,22 0 1,1 265,155 A18,22 0 1,1 230,145`);
  paths.push(`
    M248,140 Q245,155 248,170
    L245,172 Q240,155 243,138 L246,136 Q248,145 248,140
  `);
  paths.push(`M252,142 A4,5 0 1,1 260,144`);
  paths.push(`M272,172 Q255,180 235,175 Q220,170 215,160`);
  paths.push(`M275,130 Q250,118 222,128`);
  
  // Beast ears (pointed, alert) - LEFT
  paths.push(`
    M125,60
    Q108,35 115,10
    Q125,0 140,5
    Q160,12 165,35
    Q168,55 155,75
    Q142,85 130,80
    Q120,75 125,60
  `);
  // Left ear inner detail
  paths.push(`
    M130,50 Q122,30 128,15 Q138,8 148,18 Q155,35 150,55
    M132,45 Q128,32 132,22
    M140,42 Q138,30 142,20
  `);
  // Left ear fur tufts
  for (let f = 0; f < 8; f++) {
    const angle = -0.3 + (f / 8) * 0.6;
    const x = 140 + Math.cos(angle) * 25;
    const y = 70 + Math.sin(angle) * 20;
    paths.push(`M${x},${y} L${x + Math.cos(angle - 0.5) * 8},${y + Math.sin(angle - 0.5) * 8}`);
  }
  
  // Beast ears - RIGHT
  paths.push(`
    M275,60
    Q292,35 285,10
    Q275,0 260,5
    Q240,12 235,35
    Q232,55 245,75
    Q258,85 270,80
    Q280,75 275,60
  `);
  paths.push(`
    M270,50 Q278,30 272,15 Q262,8 252,18 Q245,35 250,55
    M268,45 Q272,32 268,22
    M260,42 Q262,30 258,20
  `);
  for (let f = 0; f < 8; f++) {
    const angle = Math.PI + 0.3 - (f / 8) * 0.6;
    const x = 260 + Math.cos(angle) * 25;
    const y = 70 + Math.sin(angle) * 20;
    paths.push(`M${x},${y} L${x + Math.cos(angle + 0.5) * 8},${y + Math.sin(angle + 0.5) * 8}`);
  }
  
  // Muzzle/snout (extended, powerful)
  paths.push(`
    M165,200
    Q155,220 150,245
    Q148,270 160,290
    Q180,308 200,310
    Q220,308 240,290
    Q252,270 250,245
    Q245,220 235,200
    Q220,195 200,193
    Q180,195 165,200
  `);
  
  // Snout bridge detail
  paths.push(`
    M195,195 L193,215 Q192,235 195,255 Q198,270 200,280
    M205,195 L207,215 Q208,235 205,255 Q202,270 200,280
  `);
  // Snout muscle definition
  paths.push(`
    M165,210 Q175,205 185,210
    M235,210 Q225,205 215,210
    M160,235 Q175,228 190,235
    M240,235 Q225,228 210,235
  `);
  
  // Nose (large, detailed)
  paths.push(`
    M180,275
    Q175,265 182,258
    Q192,252 200,255
    Q208,252 218,258
    Q225,265 220,275
    Q215,285 200,290
    Q185,285 180,275
    Z
  `);
  // Nostrils
  paths.push(`
    M185,272 Q180,278 185,284 Q192,288 198,282 Q195,275 185,272
    M215,272 Q220,278 215,284 Q208,288 202,282 Q205,275 215,272
  `);
  // Nose texture
  paths.push(`
    M188,265 Q195,262 200,265 Q205,262 212,265
    M190,270 Q200,268 210,270
  `);
  
  // Upper lip/muzzle
  paths.push(`
    M160,290 Q175,295 200,298 Q225,295 240,290
    M165,295 Q180,300 200,302 Q220,300 235,295
  `);
  
  // Mouth with fangs
  paths.push(`
    M160,300
    Q170,308 185,312
    Q200,315 215,312
    Q230,308 240,300
  `);
  // Upper fangs (4)
  paths.push(`
    M170,302 L167,320 Q170,325 175,318 L178,305
    M190,304 L188,318 Q191,322 195,315 L196,306
    M210,306 L212,315 Q215,322 218,318 L220,304
    M230,302 L233,318 Q236,325 240,320 L238,305
  `);
  // Lower jaw hint
  paths.push(`
    M165,312 Q180,320 200,322 Q220,320 235,312
  `);
  
  // Cheek ruffs (fur tufts)
  for (let side = 0; side < 2; side++) {
    const dir = side === 0 ? -1 : 1;
    const baseX = 200 + dir * 80;
    for (let t = 0; t < 10; t++) {
      const angle = (t / 10) * Math.PI * 0.5 + (side === 0 ? Math.PI * 0.75 : -Math.PI * 0.25);
      const y = 180 + t * 12;
      const len = 12 + Math.sin(t * 0.8) * 6;
      paths.push(`
        M${baseX + dir * (t * 2)},${y}
        Q${baseX + dir * (t * 2 + len * 0.5)},${y + len * 0.3} ${baseX + dir * (t * 2 + len)},${y + len * 0.5}
      `);
    }
  }
  
  // Forehead fur texture
  for (let i = 0; i < 25; i++) {
    const x = 140 + (i % 5) * 25;
    const y = 60 + Math.floor(i / 5) * 15;
    const angle = Math.atan2(y - 150, x - 200) + Math.PI;
    const len = 6 + Math.random() * 4;
    paths.push(`M${x},${y} L${x + Math.cos(angle) * len},${y + Math.sin(angle) * len}`);
  }
  
  // =========================================================================
  // BEAST NECK (~500 points) - Thick, muscular, maned
  // =========================================================================
  
  // Neck outline
  paths.push(`
    M135,310 Q115,340 105,380 Q98,420 100,460
    M265,310 Q285,340 295,380 Q302,420 300,460
  `);
  
  // Neck muscles
  paths.push(`
    M145,320 Q132,355 128,395 Q125,435 130,470
    M155,325 Q145,360 142,400 Q140,440 145,475
    M245,325 Q255,360 258,400 Q260,440 255,475
    M255,320 Q268,355 272,395 Q275,435 270,470
  `);
  
  // Mane (flowing down neck)
  for (let m = 0; m < 15; m++) {
    const y = 315 + m * 12;
    const xOffset = Math.sin(m * 0.6) * 10;
    // Left mane
    paths.push(`
      M${120 + xOffset},${y}
      Q${95 + xOffset},${y + 8} ${85 + xOffset},${y + 20}
      Q${75 + xOffset},${y + 35} ${80 + xOffset},${y + 45}
    `);
    // Right mane
    paths.push(`
      M${280 - xOffset},${y}
      Q${305 - xOffset},${y + 8} ${315 - xOffset},${y + 20}
      Q${325 - xOffset},${y + 35} ${320 - xOffset},${y + 45}
    `);
  }
  
  // =========================================================================
  // BEAST TORSO (~1200 points) - Powerful, muscular
  // =========================================================================
  
  // Main torso
  paths.push(`
    M100,460
    C70,500 50,560 45,630
    C42,700 50,760 65,810
    L80,850
    L320,850
    L335,810
    C350,760 358,700 355,630
    C350,560 330,500 300,460
    Q250,445 200,442
    Q150,445 100,460
    Z
  `);
  
  // Pectoral muscles
  paths.push(`
    M130,480 Q110,510 100,550 Q95,590 105,630
    M145,478 Q128,508 120,548 Q118,588 128,628
    M270,480 Q290,510 300,550 Q305,590 295,630
    M255,478 Q272,508 280,548 Q282,588 272,628
  `);
  // Pec separation
  paths.push(`M190,485 Q200,495 210,485`);
  
  // Abdominal muscles (6-pack visible through fur)
  paths.push(`
    M175,540 Q185,535 195,540 Q188,565 182,590 Q178,620 180,650
    M205,540 Q215,535 225,540 Q218,565 225,590 Q228,620 225,650
    M178,660 Q188,655 198,660 Q192,690 188,720
    M202,660 Q212,655 222,660 Q215,690 218,720
  `);
  // Central line
  paths.push(`M200,490 L200,520 Q198,550 200,580 Q202,610 200,640 Q198,680 200,720`);
  
  // Oblique muscles
  paths.push(`
    M120,560 Q135,580 145,620 Q152,660 155,700
    M280,560 Q265,580 255,620 Q248,660 245,700
  `);
  
  // Fur texture across torso
  for (let i = 0; i < 40; i++) {
    const x = 100 + (i % 8) * 25;
    const y = 480 + Math.floor(i / 8) * 50;
    const angle = Math.PI / 2 + (Math.random() - 0.5) * 0.4;
    const len = 4 + Math.random() * 6;
    paths.push(`M${x},${y} L${x + Math.cos(angle) * len},${y + Math.sin(angle) * len}`);
  }
  
  // =========================================================================
  // BEAST SHOULDERS & ARMS (~1000 points)
  // =========================================================================
  
  // Left shoulder mass
  paths.push(`
    M100,460
    Q65,475 45,510
    Q28,550 22,600
    Q18,650 25,700
    L35,750
    L85,765
    Q95,710 100,650
    Q105,590 100,530
    Q98,490 100,460
  `);
  // Left shoulder muscles
  paths.push(`
    M85,480 Q60,505 48,545 Q40,590 45,640
    M95,475 Q72,502 62,542 Q55,588 60,635
  `);
  // Left deltoid
  paths.push(`M75,490 A25,30 0 0,1 55,530`);
  
  // Left arm detail
  paths.push(`
    M45,640 Q35,680 30,720 Q28,755 35,785
    M55,638 Q48,678 45,718 Q44,752 50,782
  `);
  // Left bicep
  paths.push(`M40,655 A15,25 0 0,1 48,700`);
  // Left forearm
  paths.push(`M32,725 Q35,750 40,775`);
  
  // Right shoulder mass
  paths.push(`
    M300,460
    Q335,475 355,510
    Q372,550 378,600
    Q382,650 375,700
    L365,750
    L315,765
    Q305,710 300,650
    Q295,590 300,530
    Q302,490 300,460
  `);
  paths.push(`
    M315,480 Q340,505 352,545 Q360,590 355,640
    M305,475 Q328,502 338,542 Q345,588 340,635
  `);
  paths.push(`M325,490 A25,30 0 0,0 345,530`);
  paths.push(`
    M355,640 Q365,680 370,720 Q372,755 365,785
    M345,638 Q352,678 355,718 Q356,752 350,782
  `);
  paths.push(`M360,655 A15,25 0 0,0 352,700`);
  paths.push(`M368,725 Q365,750 360,775`);
  
  // =========================================================================
  // BEAST HANDS/PAWS (~800 points) - Clawed, powerful
  // =========================================================================
  
  // Left paw
  paths.push(`
    M25,785
    Q15,800 12,825
    Q10,855 18,880
    Q30,900 55,905
    Q80,902 95,885
    Q105,865 100,840
    Q95,815 85,795
    Q70,780 50,782
    Q35,784 25,785
  `);
  // Left paw pads
  paths.push(`M35,850 A12,10 0 1,1 58,855 A12,10 0 1,1 35,850`);
  paths.push(`M28,870 A6,5 0 1,1 40,872`);
  paths.push(`M48,872 A6,5 0 1,1 60,874`);
  paths.push(`M65,868 A5,4 0 1,1 75,870`);
  
  // Left claws (5)
  for (let c = 0; c < 5; c++) {
    const cx = 22 + c * 15;
    const cy = 900 + (c === 0 || c === 4 ? 5 : 0);
    const curve = c < 2 ? -8 : (c > 2 ? 8 : 0);
    paths.push(`
      M${cx},${cy}
      Q${cx + curve * 0.5},${cy + 15} ${cx + curve},${cy + 30}
      L${cx + curve + 3},${cy + 35}
      Q${cx + curve * 0.8 + 2},${cy + 25} ${cx + curve * 0.3 + 3},${cy + 12}
      Q${cx + 4},${cy + 5} ${cx + 5},${cy}
    `);
  }
  
  // Right paw
  paths.push(`
    M375,785
    Q385,800 388,825
    Q390,855 382,880
    Q370,900 345,905
    Q320,902 305,885
    Q295,865 300,840
    Q305,815 315,795
    Q330,780 350,782
    Q365,784 375,785
  `);
  paths.push(`M342,850 A12,10 0 1,1 365,855 A12,10 0 1,1 342,850`);
  paths.push(`M360,870 A6,5 0 1,1 372,872`);
  paths.push(`M340,872 A6,5 0 1,1 352,874`);
  paths.push(`M325,868 A5,4 0 1,1 335,870`);
  
  for (let c = 0; c < 5; c++) {
    const cx = 378 - c * 15;
    const cy = 900 + (c === 0 || c === 4 ? 5 : 0);
    const curve = c < 2 ? 8 : (c > 2 ? -8 : 0);
    paths.push(`
      M${cx},${cy}
      Q${cx + curve * 0.5},${cy + 15} ${cx + curve},${cy + 30}
      L${cx + curve - 3},${cy + 35}
      Q${cx + curve * 0.8 - 2},${cy + 25} ${cx + curve * 0.3 - 3},${cy + 12}
      Q${cx - 4},${cy + 5} ${cx - 5},${cy}
    `);
  }
  
  // =========================================================================
  // BEAST LOWER BODY (~500 points)
  // =========================================================================
  
  // Hip/thigh region
  paths.push(`
    M80,850 Q75,880 78,910 Q82,940 90,970
    M320,850 Q325,880 322,910 Q318,940 310,970
  `);
  
  // Tail base (thick, powerful)
  paths.push(`
    M185,845 Q175,865 170,895 Q168,925 175,955 Q185,985 200,995
    Q215,985 225,955 Q232,925 230,895 Q225,865 215,845
    Q205,840 195,842 Q188,843 185,845
  `);
  
  // Tail fur texture
  for (let t = 0; t < 12; t++) {
    const y = 860 + t * 12;
    const width = 15 + (t / 12) * 10;
    paths.push(`M${185 - width / 2},${y} Q${200},${y - 3} ${215 + width / 2},${y}`);
  }
  
  return paths;
}

// ============================================================================
// KEYWORD PARSER - Extracts spawnable items from typed text
// ============================================================================

// ============================================================================
// KEYWORD PATTERNS - Now using expanded LEXICON from keyword_dictionary_draggable
// ============================================================================

// Build patterns from LEXICON (1000+ trigger words)
const KEYWORD_PATTERNS = buildKeywordPatterns();

function parseKeywords(text: string): string[] {
  const { items, combinations } = parseTextForItems(text);
  // Return both simple keywords and combined item names
  const keywords = items.map((i: { keyword: string }) => i.keyword);
  const combined = combinations.map((c: { combined: string }) => c.combined);
  return [...new Set([...keywords, ...combined])];
}
// ============================================================================
// AURA GENERATORS (Phase 5 effects)
// ============================================================================

function generateAura(params: AuraParams): string[] {
  const paths: string[] = [];
  const cx = 200;
  const cy = 350;
  
  switch (params.pattern) {
    case 'radial':
      // FLAMBOYANT expanding rings — thick inner + thin outer + particle dots
      for (let i = 1; i <= 7; i++) {
        const r = 60 + i * 35;
        // Inner thick ring
        paths.push(`M${cx - r},${cy} A${r},${r} 0 1,1 ${cx + r},${cy} A${r},${r} 0 1,1 ${cx - r},${cy}`);
        // Outer shimmer ring (offset slightly)
        const r2 = r + 8;
        paths.push(`M${cx - r2},${cy - 3} A${r2},${r2} 0 1,1 ${cx + r2},${cy - 3} A${r2},${r2} 0 1,1 ${cx - r2},${cy - 3}`);
      }
      // Burst particles between rings
      for (let p = 0; p < 24; p++) {
        const angle = (p / 24) * Math.PI * 2;
        const dist = 90 + Math.sin(p * 3.7) * 60;
        const px = cx + Math.cos(angle) * dist;
        const py = cy + Math.sin(angle) * dist;
        paths.push(`M${px - 4},${py} L${px},${py - 6} L${px + 4},${py} L${px},${py + 6} Z`);
      }
      break;
      
    case 'flame':
      // FLAMBOYANT flame — thick flickering wisps + inner core + spark trails
      // Inner core heat
      for (let c = 0; c < 3; c++) {
        const coreR = 40 + c * 20;
        paths.push(`M${cx - coreR},${cy} A${coreR},${coreR * 1.2} 0 1,1 ${cx + coreR},${cy} A${coreR},${coreR * 1.2} 0 1,1 ${cx - coreR},${cy}`);
      }
      // Thick flame tongues
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const r = 140 + Math.sin(i * 2.3) * 40;
        const r2 = r + 30 + Math.cos(i * 1.7) * 20;
        const x1 = cx + Math.cos(angle) * 80;
        const y1 = cy + Math.sin(angle) * 80;
        const x2 = cx + Math.cos(angle) * r;
        const y2 = cy + Math.sin(angle) * r;
        const x3 = cx + Math.cos(angle) * r2;
        const y3 = cy + Math.sin(angle) * r2;
        // Wide base flame
        paths.push(`M${x1},${y1} Q${x2 - Math.sin(angle) * 35},${y2 + Math.cos(angle) * 35} ${x3},${y3}`);
        // Thin inner flame
        paths.push(`M${x1},${y1} Q${x2 + Math.sin(angle) * 15},${y2 - Math.cos(angle) * 15} ${cx + Math.cos(angle) * (r + 15)},${cy + Math.sin(angle) * (r + 15)}`);
      }
      // Spark particles
      for (let s = 0; s < 20; s++) {
        const angle = (s / 20) * Math.PI * 2;
        const dist = 160 + Math.sin(s * 5.1) * 40;
        const sx = cx + Math.cos(angle) * dist;
        const sy = cy + Math.sin(angle) * dist;
        paths.push(`M${sx},${sy - 3} L${sx + 2},${sy} L${sx},${sy + 3} L${sx - 2},${sy} Z`);
      }
      break;
      
    case 'electric':
      // FLAMBOYANT lightning — thick jagged bolts + branch forks + static field
      // Central energy field
      for (let f = 0; f < 3; f++) {
        const fieldR = 50 + f * 25;
        let field = `M${cx},${cy - fieldR}`;
        for (let v = 1; v <= 12; v++) {
          const a = (v / 12) * Math.PI * 2 - Math.PI / 2;
          const jit = (Math.sin(v * 7 + f * 3) * 0.3) * fieldR;
          field += ` L${cx + Math.cos(a) * (fieldR + jit)},${cy + Math.sin(a) * (fieldR + jit)}`;
        }
        field += ' Z';
        paths.push(field);
      }
      // Main bolts — thick with branches
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        let bx = cx + Math.cos(angle) * 60;
        let by = cy + Math.sin(angle) * 60;
        let bolt = `M${bx},${by}`;
        for (let seg = 0; seg < 6; seg++) {
          const nextR = 80 + seg * 35;
          const jitter = Math.sin(i * 13 + seg * 7) * 45;
          bx = cx + Math.cos(angle) * nextR + Math.sin(angle) * jitter;
          by = cy + Math.sin(angle) * nextR - Math.cos(angle) * jitter;
          bolt += ` L${bx},${by}`;
          // Branch fork every other segment
          if (seg % 2 === 0 && seg < 5) {
            const branchAngle = angle + (Math.sin(i + seg) > 0 ? 0.5 : -0.5);
            const branchLen = 25 + Math.abs(Math.sin(i * 3)) * 20;
            paths.push(`M${bx},${by} L${bx + Math.cos(branchAngle) * branchLen},${by + Math.sin(branchAngle) * branchLen}`);
          }
        }
        paths.push(bolt);
      }
      break;
      
    case 'divine':
      // FLAMBOYANT divine — double halo + thick rays + angelic feather particles
      // Double halo
      paths.push(`M${cx - 70},90 A70,25 0 1,1 ${cx + 70},90 A70,25 0 1,1 ${cx - 70},90`);
      paths.push(`M${cx - 80},85 A80,30 0 1,1 ${cx + 80},85 A80,30 0 1,1 ${cx - 80},85`);
      // Thick radiating rays
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
        const innerR = 100;
        const outerR = 260 + Math.sin(i * 3.3) * 40;
        const spread = 0.04;
        // Wide ray (triangular beam)
        paths.push(`M${cx + Math.cos(angle - spread) * innerR},${cy + Math.sin(angle - spread) * innerR} L${cx + Math.cos(angle) * outerR},${cy + Math.sin(angle) * outerR} L${cx + Math.cos(angle + spread) * innerR},${cy + Math.sin(angle + spread) * innerR} Z`);
      }
      // Feather particles
      for (let f = 0; f < 16; f++) {
        const fa = (f / 16) * Math.PI * 2;
        const fd = 180 + Math.sin(f * 4.1) * 50;
        const fx = cx + Math.cos(fa) * fd;
        const fy = cy + Math.sin(fa) * fd;
        paths.push(`M${fx},${fy - 8} Q${fx + 5},${fy} ${fx},${fy + 8} Q${fx - 3},${fy} ${fx},${fy - 8} Z`);
      }
      break;
  }
  
  return paths;
}

// ============================================================================
// QUIZ GENERATOR (Phase 6)
// ============================================================================

// ============================================================================
// 50-QUESTION BANK GENERATOR
// Questions based on actual user choices during avatar creation
// Categories: Colors, Color Mixing, Text Answers, Choices, Features
// ============================================================================

interface QuestionBank {
  questions: QuizQuestion[];
  colorMixQuestions: QuizQuestion[];  // Separate for emphasis
}

function generateQuestionBank(recipe: AvatarRecipe, colorMixHistory: ColorMix[]): QuestionBank {
  const questions: QuizQuestion[] = [];
  const colorMixQuestions: QuizQuestion[] = [];
  
  // Shuffle helper
  const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
  
  // ============================================================================
  // COLOR PALETTES FOR FAKE OPTIONS
  // ============================================================================
  
  // Build ALL_COLORS dynamically from ALL palettes (skin, hair, eyes, clothing, etc.)
  // This ensures the quiz fake options include every color the user could have picked
  const ALL_COLORS: string[] = (() => {
    const colorSet = new Set<string>();
    // Add all colors from every palette in COLOR_PALETTES
    for (const key of Object.keys(COLOR_PALETTES)) {
      for (const c of (COLOR_PALETTES as Record<string, string[]>)[key]) {
        colorSet.add(c);
      }
    }
    // Add craft page COLOR_PALETTE (24 tap-to-fill colors)
    const CRAFT_COLORS = [
      '#FFFFFF', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000', '#FF8000',
      '#F5DEB3', '#DEB887', '#D2B48C', '#C4A484', '#8B7355', '#5C4033', '#3D2314', '#1A0F0A',
      '#FFD700', '#C0C0C0', '#CD7F32', '#4A90D9', '#8B0000', '#006400', '#4B0082', '#2F4F4F',
    ];
    for (const c of CRAFT_COLORS) colorSet.add(c);
    // Add the color modal palette (42 colors from the full palette modal)
    const MODAL_COLORS = [
      '#FFDFC4', '#F0C8A0', '#D4A574', '#8D5524', '#5C3A1E', '#3B1F0B',
      '#FFE4B5', '#F5DEB3', '#DEB887', '#CD853F', '#8B4513', '#5D3A1A',
      '#FFD700', '#FFA500', '#FF6347', '#DC143C', '#8B0000', '#4A0000',
      '#98FB98', '#32CD32', '#228B22', '#006400', '#2F4F4F', '#1A1A1A',
      '#87CEEB', '#4169E1', '#0000CD', '#00008B', '#4B0082', '#2E0854',
      '#DDA0DD', '#DA70D6', '#9932CC', '#8B008B', '#FF69B4', '#C71585',
      '#FFFFFF', '#D3D3D3', '#A9A9A9', '#696969', '#404040', '#000000',
    ];
    for (const c of MODAL_COLORS) colorSet.add(c);
    return Array.from(colorSet);
  })();

  
  const COLOR_NAMES: Record<string, string> = {
    '#FFDFC4': 'Pale Peach', '#F0C8A0': 'Light Tan', '#D4A574': 'Medium Tan',
    '#8D5524': 'Brown', '#5C3A1E': 'Dark Brown', '#3B1F0B': 'Deep Brown',
    '#FFD700': 'Gold', '#FFA500': 'Orange', '#FF6347': 'Tomato Red',
    '#DC143C': 'Crimson', '#8B0000': 'Dark Red', '#98FB98': 'Pale Green',
    '#32CD32': 'Lime Green', '#228B22': 'Forest Green', '#006400': 'Dark Green',
    '#87CEEB': 'Sky Blue', '#4169E1': 'Royal Blue', '#0000CD': 'Medium Blue',
    '#00008B': 'Dark Blue', '#4B0082': 'Indigo', '#DDA0DD': 'Plum',
    '#DA70D6': 'Orchid', '#9932CC': 'Dark Orchid', '#8B008B': 'Dark Magenta',
    '#FF69B4': 'Hot Pink', '#FFFFFF': 'White', '#000000': 'Black',
  };
  
  const getColorName = (hex: string): string => {
    return COLOR_NAMES[hex?.toUpperCase()] || hex?.slice(0, 7) || 'Unknown';
  };
  
  // Generate fake color options (excluding correct answer)
  const getFakeColors = (correct: string, count: number): string[] => {
    return shuffle(ALL_COLORS.filter(c => c !== correct)).slice(0, count);
  };
  
  // ============================================================================
  // CATEGORY 1: DIRECT COLOR QUESTIONS (10+ questions)
  // "What color did you choose for X?"
  // ============================================================================
  
  const colorRegions = [
    { key: 'skin', question: 'What color did you choose for your avatar\'s SKIN?' },
    { key: 'hair', question: 'What color did you choose for your avatar\'s HAIR?' },
    { key: 'eyes', question: 'What color did you choose for your avatar\'s EYES?' },
    { key: 'lips', question: 'What color did you choose for your avatar\'s LIPS?' },
    { key: 'primary', question: 'What PRIMARY color did you choose for clothing?' },
    { key: 'secondary', question: 'What SECONDARY color did you choose?' },
    { key: 'accent', question: 'What ACCENT color did you use?' },
    { key: 'boots', question: 'What color are your avatar\'s BOOTS?' },
    { key: 'gloves', question: 'What color are your avatar\'s GLOVES?' },
    { key: 'belt', question: 'What color is your avatar\'s BELT?' },
  ];
  
  colorRegions.forEach(region => {
    const correctColor = recipe.colors[region.key];
    if (correctColor) {
      const fakes = getFakeColors(correctColor, 19);
      questions.push({
        question: region.question,
        correctAnswer: correctColor,
        options: shuffle([correctColor, ...fakes]),
        trait: `color_${region.key}`,
        isVisual: true,
      });
    }
  });
  
  // ============================================================================
  // CATEGORY 2: COLOR MIXING QUESTIONS (10+ questions)
  // "What TWO colors did you mix to create X?"
  // "What color resulted from mixing X and Y?"
  // ============================================================================
  
  if (colorMixHistory && colorMixHistory.length > 0) {
    colorMixHistory.forEach((mix, idx) => {
      // Question type 1: What did you mix to get result?
      const fakeMixes = [
        `${ALL_COLORS[0]} + ${ALL_COLORS[1]}`,
        `${ALL_COLORS[2]} + ${ALL_COLORS[3]}`,
        `${ALL_COLORS[4]} + ${ALL_COLORS[5]}`,
        `${ALL_COLORS[6]} + ${ALL_COLORS[7]}`,
        `${ALL_COLORS[8]} + ${ALL_COLORS[9]}`,
      ];
      
      colorMixQuestions.push({
        question: `You mixed colors for ${mix.region}. What TWO colors did you combine?`,
        correctAnswer: `${mix.color1} + ${mix.color2}`,
        options: shuffle([`${mix.color1} + ${mix.color2}`, ...fakeMixes.slice(0, 19)]),
        trait: `mix_input_${idx}`,
        isVisual: true,
      });
      
      // Question type 2: What was the result?
      colorMixQuestions.push({
        question: `When you mixed ${getColorName(mix.color1)} and ${getColorName(mix.color2)}, what color did you get?`,
        correctAnswer: mix.result,
        options: shuffle([mix.result, ...getFakeColors(mix.result, 19)]),
        trait: `mix_result_${idx}`,
        isVisual: true,
      });
      
      // Question type 3: Which region did you apply the mixed color to?
      const fakeRegions = ['skin', 'hair', 'eyes', 'primary', 'secondary', 'accent', 'boots', 'gloves'];
      colorMixQuestions.push({
        question: `You mixed ${getColorName(mix.color1)} + ${getColorName(mix.color2)}. Which body part did you apply it to?`,
        correctAnswer: mix.region,
        options: shuffle([mix.region, ...fakeRegions.filter(r => r !== mix.region).slice(0, 19)]),
        trait: `mix_region_${idx}`,
      });
    });
  }
  
  // ============================================================================
  // CATEGORY 3: CHOICE QUESTIONS (15+ questions)
  // Race, Class, Occupation, Animal, Name
  // ============================================================================
  
  const ALL_RACES = [
    'human', 'elf', 'darkelf', 'dwarf', 'orc', 'halfling', 'troll', 'vampire', 'werewolf',
    'angel', 'giant', 'merfolk', 'centaur', 'gnome', 'phoenix', 'sprite', 'golem',
    'elemental', 'undead', 'dragonkin', 'fae', 'alien', 'beast', 'mutant', 'cyborg', 'ethereal',
  ];
  
  const ALL_CLASSES = Object.keys(CLASS_UNIFORMS);
  
  const ALL_ANIMALS = [
    'Wolf', 'Eagle', 'Lion', 'Dragon', 'Bear', 'Phoenix', 
    'Snake', 'Owl', 'Raven', 'Tiger', 'Stag', 'Shark',
    'Hawk', 'Fox', 'Panther', 'Dolphin', 'Horse', 'Crow',
  ];
  
  const ALL_OCCUPATIONS = Object.keys(OCCUPATION_GEAR);
  
  // Race question
  if (recipe.race) {
    questions.push({
      question: 'What RACE is your character?',
      correctAnswer: recipe.race,
      options: shuffle([recipe.race, ...ALL_RACES.filter(r => r !== recipe.race).slice(0, 19)]),
      trait: 'race',
    });
  }
  
  // Class question
  if (recipe.class) {
    questions.push({
      question: 'What CLASS did you choose?',
      correctAnswer: recipe.class,
      options: shuffle([recipe.class, ...ALL_CLASSES.filter(c => c !== recipe.class).slice(0, 19)]),
      trait: 'class',
    });
  }
  
  // Occupation question
  if (recipe.occupation) {
    questions.push({
      question: 'What is your character\'s OCCUPATION?',
      correctAnswer: recipe.occupation,
      options: shuffle([recipe.occupation, ...ALL_OCCUPATIONS.filter(o => o !== recipe.occupation).slice(0, 19)]),
      trait: 'occupation',
    });
  }
  
  // Animal spirit question
  if (recipe.animal) {
    questions.push({
      question: 'What SPIRIT ANIMAL did you bond with?',
      correctAnswer: recipe.animal,
      options: shuffle([recipe.animal, ...ALL_ANIMALS.filter(a => a !== recipe.animal).slice(0, 19)]),
      trait: 'animal',
    });
  }
  
  // Name question
  if (recipe.name) {
    const fakeNames = ['Shadow', 'Phoenix', 'Storm', 'Blade', 'Raven', 'Ghost', 'Viper', 'Ember', 
                       'Frost', 'Ash', 'Nova', 'Zephyr', 'Onyx', 'Crimson', 'Titan', 'Spectre'];
    questions.push({
      question: 'What NAME did you give your character?',
      correctAnswer: recipe.name,
      options: shuffle([recipe.name, ...fakeNames.filter(n => n !== recipe.name).slice(0, 19)]),
      trait: 'name',
    });
  }
  
  // ============================================================================
  // CATEGORY 4: TEXT-BASED QUESTIONS (15+ questions)
  // From open-ended fields: desires, fears, voice line, philosophy, moves
  // ============================================================================
  
  // Helper to extract key phrases
  const extractKeyPhrases = (text: string): string[] => {
    if (!text || text.length < 5) return [];
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'i', 'me', 'my', 'we', 'you', 
      'your', 'it', 'they', 'this', 'that', 'have', 'has', 'will', 'would', 'just', 'like']);
    return text.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
  };
  
  const FAKE_PHRASES = [
    'power', 'glory', 'revenge', 'justice', 'peace', 'chaos', 'order', 'freedom',
    'wealth', 'knowledge', 'immortality', 'love', 'honor', 'redemption', 'conquest',
    'shadow', 'flame', 'destiny', 'ancient', 'cursed', 'eternal', 'forgotten', 'divine',
  ];
  
  // Signature move question
  if (recipe.signatureMove && recipe.signatureMove.length > 3) {
    questions.push({
      question: 'What is your character\'s SIGNATURE MOVE?',
      correctAnswer: recipe.signatureMove,
      options: shuffle([recipe.signatureMove, 'Thunder Strike', 'Shadow Step', 'Phoenix Blast', 
                        'Dragon Fury', 'Soul Rend'].filter(m => m !== recipe.signatureMove)),
      trait: 'signature_move',
    });
  }
  
  // Power spike question  
  if (recipe.powerSpike && recipe.powerSpike.length > 3) {
    questions.push({
      question: 'What POWER SPIKE did you describe?',
      correctAnswer: recipe.powerSpike,
      options: shuffle([recipe.powerSpike, 'Rage Mode', 'Divine Form', 'Shadow Fusion',
                        'Elemental Burst', 'Time Stop'].filter(p => p !== recipe.powerSpike)),
      trait: 'power_spike',
    });
  }
  
  // Life philosophy question
  if (recipe.lifePhilosophy && recipe.lifePhilosophy.length > 5) {
    const shortPhilosophy = recipe.lifePhilosophy.slice(0, 50) + (recipe.lifePhilosophy.length > 50 ? '...' : '');
    questions.push({
      question: 'What LIFE PHILOSOPHY did you write?',
      correctAnswer: shortPhilosophy,
      options: shuffle([shortPhilosophy, 
        'Power is everything', 'Honor above all', 'Survival of the fittest',
        'Knowledge is power', 'Balance in all things', 'Trust no one']),
      trait: 'philosophy',
    });
  }
  
  // Voice line question
  if (recipe.voiceLine && recipe.voiceLine.length > 3) {
    questions.push({
      question: 'What VOICE LINE / CATCHPHRASE did you give your character?',
      correctAnswer: recipe.voiceLine,
      options: shuffle([recipe.voiceLine, 'For glory!', 'Death awaits...', 
        'By my blade!', 'Witness me!', 'Fear the shadows']),
      trait: 'voice_line',
    });
  }
  
  // Scenario desire question
  if (recipe.scenarioDesire && recipe.scenarioDesire.length > 5) {
    const words = extractKeyPhrases(recipe.scenarioDesire);
    if (words.length > 0) {
      const keyword = words[0];
      questions.push({
        question: 'You described what DRIVES your character. Which word did you use?',
        correctAnswer: keyword,
        options: shuffle([keyword, ...FAKE_PHRASES.filter(p => p !== keyword).slice(0, 19)]),
        trait: 'desire_keyword',
      });
    }
  }
  
  // Character description question
  if (recipe.characterDescription && recipe.characterDescription.length > 5) {
    const words = extractKeyPhrases(recipe.characterDescription);
    if (words.length > 0) {
      const keyword = words[Math.floor(Math.random() * Math.min(3, words.length))];
      questions.push({
        question: 'In your CHARACTER DESCRIPTION, which word did you write?',
        correctAnswer: keyword,
        options: shuffle([keyword, ...FAKE_PHRASES.filter(p => p !== keyword).slice(0, 19)]),
        trait: 'description_keyword',
      });
    }
  }
  
  // Origin story question
  if (recipe.originStory && recipe.originStory.length > 5) {
    const words = extractKeyPhrases(recipe.originStory);
    if (words.length > 0) {
      const keyword = words[Math.floor(Math.random() * Math.min(3, words.length))];
      questions.push({
        question: 'In your ORIGIN STORY, which word appeared?',
        correctAnswer: keyword,
        options: shuffle([keyword, ...FAKE_PHRASES.filter(p => p !== keyword).slice(0, 19)]),
        trait: 'origin_keyword',
      });
    }
  }
  
  // Formative memory question
  if (recipe.formativeMemory && recipe.formativeMemory.length > 5) {
    const words = extractKeyPhrases(recipe.formativeMemory);
    if (words.length > 0) {
      const keyword = words[Math.floor(Math.random() * Math.min(3, words.length))];
      questions.push({
        question: 'In your FORMATIVE MEMORY, which word did you mention?',
        correctAnswer: keyword,
        options: shuffle([keyword, ...FAKE_PHRASES.filter(p => p !== keyword).slice(0, 19)]),
        trait: 'memory_keyword',
      });
    }
  }
  
  // ============================================================================
  // CATEGORY 5: AURA QUESTIONS
  // ============================================================================
  
  if (recipe.auraParams) {
    // Aura color 1
    questions.push({
      question: 'What is your aura\'s PRIMARY color?',
      correctAnswer: recipe.auraParams.color1,
      options: shuffle([recipe.auraParams.color1, ...getFakeColors(recipe.auraParams.color1, 19)]),
      trait: 'aura_color1',
      isVisual: true,
    });
    
    // Aura color 2
    questions.push({
      question: 'What is your aura\'s SECONDARY color?',
      correctAnswer: recipe.auraParams.color2,
      options: shuffle([recipe.auraParams.color2, ...getFakeColors(recipe.auraParams.color2, 19)]),
      trait: 'aura_color2',
      isVisual: true,
    });
    
    // Aura pattern
    const patterns = ['radial', 'flame', 'electric', 'divine'];
    questions.push({
      question: 'What AURA PATTERN did you choose?',
      correctAnswer: recipe.auraParams.pattern,
      options: shuffle(patterns),
      trait: 'aura_pattern',
    });
  }
  
  // ============================================================================
  // CATEGORY 6: PERSONALITY / SITUATIONAL QUESTIONS
  // "How would your avatar handle X?" — answer derived from class/race/text
  // Harder for bots: requires reasoning about personality, not data lookup
  // ============================================================================
  
  // Class → personality response mapping (24 classes, expanded)
  // ALGORITHM: correct = class synonym behavior, wrong = other classes' responses (antonym)
  const CLASS_RESPONSES: Record<string, { personality: string; synonyms: string[]; responses: Record<string, string> }> = {
    Warrior: { personality: 'brave, direct, fearless',
      synonyms: ['courageous', 'bold', 'valiant', 'gallant', 'heroic', 'daring', 'fierce', 'resolute', 'steadfast', 'unflinching'],
      responses: {
        ambush: 'Draw their weapon and charge head-on into battle',
        stranger: 'Stand guard and protect the group with their blade',
        treasure: 'Claim it as a hard-won battle trophy',
        betrayal: 'Challenge the traitor to single combat',
        darkness: 'March forward without hesitation, weapon drawn',
    }},
    Mage: { personality: 'scholarly, analytical, intellectual',
      synonyms: ['studious', 'wise', 'cerebral', 'learned', 'arcane', 'calculating', 'methodical', 'perceptive', 'observant', 'sagacious'],
      responses: {
        ambush: 'Cast a protective barrier spell around the party',
        stranger: 'Sense their magical aura before approaching',
        treasure: 'Study it for enchantments before touching anything',
        betrayal: 'Unravel the truth using divination magic',
        darkness: 'Conjure arcane light and analyze the surroundings',
    }},
    Rogue: { personality: 'cunning, stealthy, opportunistic',
      synonyms: ['sly', 'crafty', 'devious', 'sneaky', 'shrewd', 'resourceful', 'wily', 'elusive', 'slippery', 'quick-witted'],
      responses: {
        ambush: 'Disappear into the shadows and flank the attackers',
        stranger: 'Pick their pocket to learn who they really are',
        treasure: 'Check it for traps before pocketing the gold',
        betrayal: 'Vanish and plot cunning revenge from the shadows',
        darkness: 'Move silently, using the dark as perfect cover',
    }},
    Healer: { personality: 'compassionate, selfless, nurturing',
      synonyms: ['caring', 'gentle', 'merciful', 'kind', 'empathetic', 'benevolent', 'tender', 'generous', 'warm-hearted', 'devoted'],
      responses: {
        ambush: 'Shield the wounded and heal injured allies first',
        stranger: 'Rush to offer aid and tend to their wounds',
        treasure: 'Share it with those who need it most',
        betrayal: 'Forgive them and try to understand their pain',
        darkness: 'Pray for guidance and radiate soothing inner light',
    }},
    Ranger: { personality: 'resourceful, nature-bound, self-reliant',
      synonyms: ['outdoorsy', 'wild', 'survivalist', 'tracker', 'woodsman', 'observant', 'patient', 'adaptive', 'independent', 'vigilant'],
      responses: {
        ambush: 'Use the terrain and trees for tactical advantage',
        stranger: 'Track their footprints to learn where they came from',
        treasure: 'Leave it — nature provides everything needed',
        betrayal: 'Retreat deep into the wilderness to regroup',
        darkness: 'Listen to the sounds of the wild for guidance',
    }},
    Paladin: { personality: 'righteous, honorable, just',
      synonyms: ['noble', 'virtuous', 'holy', 'devout', 'principled', 'dutiful', 'chivalrous', 'unwavering', 'faithful', 'protective'],
      responses: {
        ambush: 'Raise their holy shield and call for divine aid',
        stranger: 'Offer sworn protection in the name of their oath',
        treasure: 'Donate it to the temple or give it to the poor',
        betrayal: 'Seek justice through a fair and honorable trial',
        darkness: 'Invoke holy light to banish the shadows',
    }},
    Necromancer: { personality: 'dark, calculating, power-hungry',
      synonyms: ['sinister', 'macabre', 'ruthless', 'manipulative', 'morbid', 'cold', 'ambitious', 'forbidden', 'occult', 'merciless'],
      responses: {
        ambush: 'Raise the fallen dead to fight as their army',
        stranger: 'Probe their mind for useful secrets and weakness',
        treasure: 'Bind it with dark enchantments for later use',
        betrayal: 'Curse the traitor with a devastating hex',
        darkness: 'Embrace it — darkness is their natural domain',
    }},
    Bard: { personality: 'charismatic, creative, persuasive',
      synonyms: ['charming', 'witty', 'eloquent', 'artistic', 'entertaining', 'silver-tongued', 'flamboyant', 'theatrical', 'inspiring', 'social'],
      responses: {
        ambush: 'Talk their way out or charm the attackers with song',
        stranger: 'Sing a soothing song to earn their trust',
        treasure: 'Write an epic ballad about the discovery',
        betrayal: 'Compose a scathing song to shame the traitor publicly',
        darkness: 'Play uplifting music to lift everyone\'s spirits',
    }},
    Monk: { personality: 'disciplined, spiritual, centered',
      synonyms: ['serene', 'peaceful', 'balanced', 'contemplative', 'patient', 'mindful', 'ascetic', 'focused', 'harmonious', 'enlightened'],
      responses: {
        ambush: 'Deflect attacks with precise, flowing martial arts',
        stranger: 'Meditate briefly to read their true intentions',
        treasure: 'Reflect on whether material attachment serves them',
        betrayal: 'Seek inner peace and release all anger within',
        darkness: 'Find perfect stillness and trust their training',
    }},
    Berserker: { personality: 'fierce, unstoppable, raging',
      synonyms: ['savage', 'furious', 'wild', 'relentless', 'brutal', 'explosive', 'uncontrollable', 'primal', 'wrathful', 'destructive'],
      responses: {
        ambush: 'Charge in headfirst with a thunderous battle cry',
        stranger: 'Intimidate them into immediate submission',
        treasure: 'Smash it open with raw brute force',
        betrayal: 'Fly into a blind rage and destroy everything nearby',
        darkness: 'Roar into the void and keep charging forward',
    }},
    Assassin: { personality: 'cold, precise, lethal',
      synonyms: ['ruthless', 'silent', 'deadly', 'efficient', 'detached', 'methodical', 'surgical', 'clinical', 'shadowy', 'merciless'],
      responses: {
        ambush: 'Strike first from a completely unseen position',
        stranger: 'Observe from a distance, studying every weakness',
        treasure: 'Take it silently, leaving absolutely no trace',
        betrayal: 'Eliminate the traitor swiftly and without emotion',
        darkness: 'Become perfectly one with the darkness',
    }},
    Druid: { personality: 'wild, nature-connected, primal',
      synonyms: ['earthy', 'organic', 'ancient', 'mystical', 'feral', 'natural', 'shapeshifting', 'rooted', 'cyclical', 'animalistic'],
      responses: {
        ambush: 'Shapeshift into a fierce predator and counter-attack',
        stranger: 'Commune with nearby animals to judge their character',
        treasure: 'Return it to the earth where it truly belongs',
        betrayal: 'Let the vines of the forest bind the traitor tight',
        darkness: 'Call upon moonlight and starlight to guide the way',
    }},
    Ninja: { personality: 'swift, secretive, disciplined',
      synonyms: ['agile', 'silent', 'shadowy', 'precise', 'elusive', 'covert', 'acrobatic', 'vigilant', 'deadly', 'unseen'],
      responses: {
        ambush: 'Vanish in a smoke bomb and strike from above',
        stranger: 'Blend into the crowd and observe their contacts',
        treasure: 'Map the area, take it without triggering alarms',
        betrayal: 'Disappear completely, then strike when least expected',
        darkness: 'Navigate silently using trained spatial awareness',
    }},
    Merchant: { personality: 'shrewd, persuasive, opportunistic',
      synonyms: ['savvy', 'deal-making', 'haggling', 'enterprising', 'diplomatic', 'materialistic', 'well-connected', 'pragmatic', 'transactional', 'negotiating'],
      responses: {
        ambush: 'Negotiate a deal — offer gold for safe passage',
        stranger: 'Assess their value and offer a business proposition',
        treasure: 'Appraise every piece and plan the best resale price',
        betrayal: 'Cut them off from all trade networks permanently',
        darkness: 'Light a costly torch — good equipment is worth it',
    }},
    Scholar: { personality: 'curious, methodical, knowledge-seeking',
      synonyms: ['bookish', 'inquisitive', 'rational', 'academic', 'researching', 'detail-oriented', 'logical', 'investigative', 'pedantic', 'thorough'],
      responses: {
        ambush: 'Recall historical tactics to find the best escape route',
        stranger: 'Ask them questions and document their story carefully',
        treasure: 'Catalog every artifact and research their origins',
        betrayal: 'Analyze the evidence to understand the full conspiracy',
        darkness: 'Pull out a journal and map the dungeon methodically',
    }},
    Samurai: { personality: 'honorable, disciplined, loyal',
      synonyms: ['devoted', 'duty-bound', 'stoic', 'precise', 'traditional', 'dignified', 'respectful', 'code-following', 'masterful', 'unwavering'],
      responses: {
        ambush: 'Draw their katana in one fluid, decisive strike',
        stranger: 'Bow respectfully and offer aid with quiet dignity',
        treasure: 'Present it to their lord as a tribute of honor',
        betrayal: 'Demand the traitor restore their honor or face the blade',
        darkness: 'Walk calmly with perfect posture, trusting their senses',
    }},
    Alchemist: { personality: 'experimental, inventive, volatile',
      synonyms: ['scientific', 'mixing', 'transformative', 'creative', 'unstable', 'curious', 'transmuting', 'brewing', 'explosive', 'innovative'],
      responses: {
        ambush: 'Throw a smoke bomb or explosive potion at the attackers',
        stranger: 'Check their condition and brew a healing elixir',
        treasure: 'Test the gold for purity and transmutation potential',
        betrayal: 'Slip a slow-acting truth serum into their drink',
        darkness: 'Mix phosphorus ingredients to create a glowing solution',
    }},
    Knight: { personality: 'chivalrous, protective, steadfast',
      synonyms: ['gallant', 'armored', 'loyal', 'courageous', 'sworn', 'shielding', 'resolute', 'noble', 'defending', 'unbreakable'],
      responses: {
        ambush: 'Form a defensive line and shield the vulnerable',
        stranger: 'Pledge to escort them safely to the nearest village',
        treasure: 'Guard it until the rightful owner can be found',
        betrayal: 'Strip them of their rank and banish them from the order',
        darkness: 'Lead the group forward, shield raised against the unknown',
    }},
    Sorcerer: { personality: 'powerful, intuitive, elemental',
      synonyms: ['mystical', 'raw', 'channeling', 'innate', 'overwhelming', 'wild-magic', 'instinctive', 'untamed', 'surging', 'volatile'],
      responses: {
        ambush: 'Unleash a raw blast of elemental energy at the threat',
        stranger: 'Feel the magical currents around them for danger',
        treasure: 'Channel its latent energy to amplify their own power',
        betrayal: 'Let raw magical fury surge through them uncontrolled',
        darkness: 'Summon crackling elemental light from pure willpower',
    }},
    Shaman: { personality: 'spiritual, ancestral, connected',
      synonyms: ['tribal', 'ritualistic', 'prophetic', 'otherworldly', 'communing', 'visionary', 'totemic', 'healing', 'ancient', 'spirit-walking'],
      responses: {
        ambush: 'Call upon ancestor spirits to shield and guide them',
        stranger: 'Read their spirit aura to sense if they carry evil',
        treasure: 'Perform a ritual to determine if it is blessed or cursed',
        betrayal: 'Consult the ancestors to reveal the traitor\'s true nature',
        darkness: 'Enter a spirit trance to see beyond the physical dark',
    }},
    Templar: { personality: 'zealous, militant, devout',
      synonyms: ['crusading', 'fanatical', 'purifying', 'armored-faith', 'smiting', 'righteous-fury', 'consecrated', 'sworn', 'relentless', 'cleansing'],
      responses: {
        ambush: 'Charge with holy fervor, smiting the enemy with faith',
        stranger: 'Demand they prove they are not servants of darkness',
        treasure: 'Claim it for the holy order and purify it with prayer',
        betrayal: 'Declare them a heretic and pursue divine punishment',
        darkness: 'March forward chanting prayers that burn away shadow',
    }},
    Hunter: { personality: 'patient, tracking, predatory',
      synonyms: ['stalking', 'waiting', 'alert', 'precise', 'camouflaged', 'targeting', 'keen-eyed', 'persistent', 'trapping', 'focused'],
      responses: {
        ambush: 'Set a counter-trap and pick off attackers one by one',
        stranger: 'Read their tracks and scent to know where they\'ve been',
        treasure: 'Mark the location and return when it\'s safe to claim',
        betrayal: 'Track the traitor relentlessly across any terrain',
        darkness: 'Rely on sharpened senses — hearing, smell, and instinct',
    }},
    Summoner: { personality: 'commanding, bonded, otherworldly',
      synonyms: ['conjuring', 'pact-bound', 'controlling', 'dimensional', 'familiar-linked', 'channeling', 'creature-master', 'ethereal', 'invoking', 'allied'],
      responses: {
        ambush: 'Summon a powerful creature to defend and counter-attack',
        stranger: 'Send a familiar spirit to investigate them safely',
        treasure: 'Summon a guardian entity to protect and transport it',
        betrayal: 'Summon a binding entity to hold the traitor accountable',
        darkness: 'Call forth a luminous spirit familiar to light the path',
    }},
    Warlock: { personality: 'pact-bound, dark-powered, cunning',
      synonyms: ['demonic', 'forbidden', 'cursing', 'bargaining', 'eldritch', 'corrupted', 'powerful', 'tempting', 'shadow-dealing', 'hexing'],
      responses: {
        ambush: 'Unleash eldritch blasts of dark patron energy',
        stranger: 'Sense if they bear any marks of otherworldly pacts',
        treasure: 'Offer it to their patron in exchange for greater power',
        betrayal: 'Invoke their patron\'s wrath to curse the traitor\'s bloodline',
        darkness: 'See perfectly — their patron\'s gift includes darkvision',
    }},
  };

  // Scenario templates (no fakePool — wrong answers come from other classes)
  const SCENARIO_KEYS: { key: string; question: string }[] = [
    { key: 'ambush', question: '{name} the {personality} {class} is ambushed on a forest road. What do they do?' },
    { key: 'stranger', question: 'A wounded stranger collapses at {name}\'s feet. As a {personality} {class}, what\'s their first instinct?' },
    { key: 'treasure', question: '{name} finds an ancient chest of gold in a cave. As a {personality} {class}, how do they react?' },
    { key: 'betrayal', question: 'A trusted ally has betrayed {name}. As a {personality} {class}, how do they respond?' },
    { key: 'darkness', question: '{name} the {personality} {class} enters a pitch-black dungeon. No light. What now?' },
  ];

  if (recipe.class && CLASS_RESPONSES[recipe.class]) {
    const classData = CLASS_RESPONSES[recipe.class];

    SCENARIO_KEYS.forEach(scenario => {
      const correctResponse = classData.responses[scenario.key];
      if (!correctResponse) return;

      // Question includes personality hint so player can reason about it
      const questionText = scenario.question
        .replace('{name}', recipe.name || 'Your character')
        .replace('{race}', recipe.race || 'character')
        .replace('{class}', recipe.class || 'adventurer')
        .replace('{personality}', classData.personality);

      // Wrong answers = other classes' correct responses for SAME scenario
      const otherResponses = Object.entries(CLASS_RESPONSES)
        .filter(([cls]) => cls !== recipe.class)
        .map(([_, data]) => data.responses[scenario.key])
        .filter(Boolean);
      const fakes = shuffle(otherResponses).slice(0, 4);

      questions.push({
        question: questionText,
        correctAnswer: correctResponse,
        options: shuffle([correctResponse, ...fakes]),
        trait: `personality_${scenario.key}`,
      });
    });
  }

  // Race-based personality questions
  const RACE_SITUATIONS: { question: string; responses: Record<string, string>; fakePool: string[] }[] = [
    { question: 'Your avatar\'s homeland is under attack. As a {race}, what\'s their natural response?',
      responses: {
        human: 'Rally the community and organize defense', elf: 'Retreat to the ancient forests for protection',
        dwarf: 'Fortify the mountain stronghold', orc: 'Sound the war drums and charge',
        halfling: 'Hide the valuables and sneak to safety', angel: 'Descend from above with divine judgment',
        vampire: 'Strike from the shadows at nightfall', werewolf: 'Transform and unleash primal fury',
        dragonkin: 'Breathe fire and defend the hoard', golem: 'Stand immovable as the ultimate shield',
        undead: 'Rise an army from the fallen', fae: 'Weave illusions to confuse the invaders',
        sprite: 'Scatter like fireflies and regroup', giant: 'Stomp the ground and crush the threat',
        centaur: 'Gallop to warn neighboring tribes', merfolk: 'Flood the coastline to drown invaders',
        elemental: 'Become the storm itself', phoenix: 'Sacrifice and be reborn from the ashes',
        beast: 'Howl to summon the pack', troll: 'Regenerate wounds and keep smashing',
        darkelf: 'Lure enemies into underground traps', alien: 'Deploy advanced technology',
        gnome: 'Build ingenious defensive contraptions', ethereal: 'Phase through walls and haunt the attackers',
        cyborg: 'Activate combat protocols', mutant: 'Unleash unstable mutation powers',
      },
      fakePool: ['File a complaint', 'Take a vacation', 'Write a strongly worded letter', 'Switch sides', 'Start a bake sale', 'Go fishing instead', 'Pretend to be a tree', 'Start a band', 'Open a shop', 'Host a dinner party', 'Redecorate their home', 'Take a census', 'Organize a parade', 'Start a garden', 'Hold a town meeting', 'Go on a pilgrimage', 'Take up knitting', 'Collect butterflies', 'Build a sandcastle'],
    },
  ];
  
  RACE_SITUATIONS.forEach(situation => {
    const raceKey = recipe.race?.toLowerCase();
    if (raceKey && situation.responses[raceKey]) {
      const questionText = situation.question.replace('{race}', recipe.race || 'character');
      const correct = situation.responses[raceKey];
      const fakes = shuffle(situation.fakePool).slice(0, 19);
      
      questions.push({
        question: questionText,
        correctAnswer: correct,
        options: shuffle([correct, ...fakes]),
        trait: 'personality_race_homeland',
      });
    }
  });
  
  // ============================================================================
  // COMBINE AND ENSURE 50 QUESTIONS
  // ============================================================================
  
  // Add color mix questions to main pool
  const allQuestions = [...questions, ...colorMixQuestions];
  
  // If we don't have 50, pad with variations
  while (allQuestions.length < 50 && questions.length > 0) {
    // Duplicate color questions with different wording
    const colorQ = questions.find(q => q.isVisual && !q.trait.includes('dup'));
    if (colorQ) {
      allQuestions.push({
        ...colorQ,
        question: `Confirm: ${colorQ.question.replace('What', 'Which')}`,
        trait: `${colorQ.trait}_dup`,
      });
    } else {
      break;
    }
  }
  
  return {
    questions: shuffle(allQuestions).slice(0, 50),
    colorMixQuestions: shuffle(colorMixQuestions),
  };
}

// Legacy function for backwards compatibility - picks 5 from the 50
function generateQuiz(recipe: AvatarRecipe, colorMixHistory: ColorMix[] = []): QuizQuestion[] {
  // Delegate to Question_bank.ts for procedural generation
  const quizRecipe: QuizRecipe = {
    name: recipe.name,
    race: recipe.race,
    class: recipe.class,
    occupation: recipe.occupation,
    animal: recipe.animal,
    colors: {
      skin: recipe.colors.skin,
      hair: recipe.colors.hair,
      eyes: recipe.colors.eyes,
      lips: recipe.colors.lips,
      primary: recipe.colors.primary,
      secondary: recipe.colors.secondary,
      accent: recipe.colors.accent,
      outline: recipe.colors.outline,
    },
    colorMixHistory: colorMixHistory.map(m => ({ color1: m.color1, color2: m.color2, result: m.result, region: m.region, timestamp: m.timestamp })),
    originStory: recipe.originStory,
    formativeMemory: recipe.formativeMemory,
    scenarioDesire: recipe.scenarioDesire,
    characterDescription: recipe.characterDescription,
    voiceLine: recipe.voiceLine,
    weakness: recipe.weakness,
    lifePhilosophy: recipe.lifePhilosophy,
    powerSpike: recipe.powerSpike,
    signatureMove: recipe.signatureMove,
    parsedKeywords: recipe.parsedKeywords || [],
    spawnedItemKeywords: (recipe.allExtractedKeywords || []),
  };

  const allQuestions = generateQuestionBankFromFile(quizRecipe);
  const selected = selectQuizQuestions(allQuestions, 5);
  // Map to local QuizQuestion type (add trait field if missing)
  return selected.map(q => ({
    question: q.question,
    correctAnswer: q.correctAnswer,
    options: q.options,
    trait: q.category || "general",
    isVisual: q.category === "color" || q.category === "mix",
  }));
}

// Extract significant words from any text (for quiz verification)
function extractSignificantWordsFromText(text: string): string[] {
  if (!text || text.length < 10) return [];

  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'was', 'were', 'is', 'are', 'been', 'be', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
    'i', 'me', 'my', 'myself', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she',
    'her', 'it', 'its', 'they', 'them', 'their', 'what', 'which', 'who', 'this', 'that',
    'these', 'those', 'am', 'being', 'having', 'doing', 'just', 'also', 'very', 'too',
    'only', 'own', 'same', 'than', 'then', 'when', 'where', 'why', 'how', 'all', 'each',
    'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'so', 'as', 'until', 'while', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'between', 'under', 'again', 'further', 'once', 'character',
    'would', 'like', 'want', 'need', 'make', 'take', 'give', 'find', 'think', 'know',
    'because', 'about', 'there', 'here', 'something', 'nothing', 'everything', 'anything'
  ]);
  
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
}


// ============================================================================
// HASHING (Recipe -> Commitment)
// ============================================================================

// Extract significant keywords from text for hashing
function extractKeywordsForHash(text: string): string[] {
  if (!text || text.length < 5) return [];
  
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'was', 'were', 'is', 'are', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their', 'what', 'which', 'who', 'this', 'that', 'these', 'those', 'just', 'very', 'too', 'only', 'so', 'as', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'some', 'no', 'not']);
  
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
    .slice(0, 20);
}

// Create salted hash for a single keyword
async function hashKeyword(keyword: string, salt: string): Promise<string> {
  const input = `${keyword.toLowerCase().trim()}:${salt}`;
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input
  );
}

// Build Merkle tree of keyword hashes for verification
async function buildKeywordMerkleTree(keywords: string[], masterSalt: string): Promise<{
  root: string;
  commitments: KeywordCommitment[];
}> {
  if (keywords.length === 0) {
    return { root: '0'.repeat(64), commitments: [] };
  }
  
  const commitments: KeywordCommitment[] = [];
  const leaves: string[] = [];
  
  for (const keyword of keywords) {
    const salt = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${masterSalt}:${keyword}:${commitments.length}`
    );
    const hash = await hashKeyword(keyword, salt);
    commitments.push({ keyword, salt: salt.slice(0, 16), hash });
    leaves.push(hash);
  }
  
  let level = leaves;
  while (level.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || left;
      const combined = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        left + right
      );
      nextLevel.push(combined);
    }
    level = nextLevel;
  }
  
  return { root: level[0], commitments };
}

// Hash scenario answers for challenge-response
async function hashScenarioAnswers(recipe: AvatarRecipe): Promise<string> {
  const allText = [
    recipe.scenarioConflict || '',
    recipe.scenarioMoral || '',
    recipe.scenarioFear || '',
    recipe.scenarioDesire || '',
    recipe.characterDescription || '',
  ].join('|');
  
  const keywords = extractKeywordsForHash(allText).sort().join(':');
  
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    keywords
  );
}

// Extract scenario keywords for quiz
function extractScenarioKeywords(recipe: AvatarRecipe): string[] {
  const allText = [
    recipe.scenarioConflict || '',
    recipe.scenarioMoral || '',
    recipe.scenarioFear || '',
    recipe.scenarioDesire || '',
    recipe.characterDescription || '',
  ].join(' ');
  
  return extractKeywordsForHash(allText);
}

// Build keyword merkle root from recipe (wrapper for buildKeywordMerkleTree)
async function buildKeywordMerkleRoot(recipe: AvatarRecipe): Promise<string> {
  const allKeywords = [
    ...(recipe.parsedKeywords || []),
    ...(recipe.allExtractedKeywords || []),
    recipe.race,
    recipe.class,
    recipe.occupation,
    recipe.animal,
  ].filter(Boolean).map(k => k.toLowerCase().trim());
  
  const uniqueKeywords = [...new Set(allKeywords)].sort();
  const masterSalt = `KV_MERKLE_${recipe.name}_${Date.now()}`;
  
  const { root } = await buildKeywordMerkleTree(uniqueKeywords, masterSalt);
  return root;
}

async function hashRecipe(recipe: AvatarRecipe): Promise<string> {
  const canonical = JSON.stringify({
    name: recipe.name.toLowerCase().trim(),
    race: recipe.race,
    animal: recipe.animal,
    originStory: recipe.originStory?.toLowerCase().trim(),
    formativeMemory: recipe.formativeMemory?.toLowerCase().trim(),
    scenarioConflict: recipe.scenarioConflict?.toLowerCase().trim(),
    scenarioMoral: recipe.scenarioMoral?.toLowerCase().trim(),
    scenarioFear: recipe.scenarioFear?.toLowerCase().trim(),
    scenarioDesire: recipe.scenarioDesire?.toLowerCase().trim(),
    characterDescription: recipe.characterDescription?.toLowerCase().trim(),
    personality: recipe.personality,
    combatStyle: recipe.combatStyle,
    lifePhilosophy: recipe.lifePhilosophy,
    powerSpike: recipe.powerSpike,
    signatureMove: recipe.signatureMove,
    keywords: [...(recipe.parsedKeywords || []), ...(recipe.allExtractedKeywords || [])].sort(),
    baseColors: {
      skin: recipe.colors?.skin,
      hair: recipe.colors?.hair,
      eyes: recipe.colors?.eyes,
      outline: recipe.colors?.outline,
    },
    strokeCount: recipe.strokes?.length || 0,
  });
  
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    canonical
  );
}


async function generateJitterCommitment(
  passed: boolean,
  saltHex: string
): Promise<string> {
  // C = SHA256(passed + salt)
  // In production, this would be Poseidon hash
  const input = `${passed ? '1' : '0'}:${saltHex}`;
  const commitment = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input
  );
  return commitment;
}

function generateSalt(): string {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// JITTER ANALYSIS (Behavioral Biometrics)
// ============================================================================

interface JitterAnalysis {
  passed: boolean;
  humanScore: number;
  flags: string[];
}

function analyzeJitter(samples: JitterSample[]): JitterAnalysis {
  if (samples.length < 20) {
    return { passed: false, humanScore: 0, flags: ['insufficient_samples'] };
  }
  
  const deltas = samples.map(s => s.delta).filter(d => d > 0 && d < 2000);
  if (deltas.length < 10) {
    return { passed: false, humanScore: 0, flags: ['filtered_too_many'] };
  }
  
  // Calculate statistics
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const variance = deltas.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / deltas.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean; // Coefficient of variation
  
  const flags: string[] = [];
  let score = 50;
  
  // Human typing has natural variance (CV typically 0.2-0.8)
  if (cv < 0.1) {
    flags.push('too_consistent'); // Bot-like
    score -= 30;
  } else if (cv > 0.15 && cv < 0.9) {
    score += 20; // Natural human variance
  } else if (cv > 1.2) {
    flags.push('erratic'); // Could be copy-paste or bot
    score -= 15;
  }
  
  // Check for repeated exact intervals (bot signature)
  const deltaCounts: Record<number, number> = {};
  for (const d of deltas) {
    const rounded = Math.round(d / 10) * 10;
    deltaCounts[rounded] = (deltaCounts[rounded] || 0) + 1;
  }
  const maxRepeat = Math.max(...Object.values(deltaCounts));
  if (maxRepeat > deltas.length * 0.4) {
    flags.push('repeated_intervals');
    score -= 25;
  }
  
  // Check for natural rhythm patterns
  const hasRhythm = checkForTypingRhythm(deltas);
  if (hasRhythm) {
    score += 15;
  }
  
  // Mean typing speed check (too fast = bot, too slow = copy-paste)
  if (mean < 50) {
    flags.push('superhuman_speed');
    score -= 40;
  } else if (mean > 80 && mean < 400) {
    score += 10; // Natural range
  } else if (mean > 1000) {
    flags.push('very_slow');
    score -= 10;
  }
  
  const passed = score >= 50 && flags.length < 2;
  
  return {
    passed,
    humanScore: Math.max(0, Math.min(100, score)),
    flags,
  };
}

function checkForTypingRhythm(deltas: number[]): boolean {
  // Look for word-boundary patterns (longer gaps every few keystrokes)
  let longGaps = 0;
  let shortRuns = 0;
  let currentRun = 0;
  
  for (const d of deltas) {
    if (d > 300) {
      longGaps++;
      if (currentRun >= 3) shortRuns++;
      currentRun = 0;
    } else {
      currentRun++;
    }
  }
  
  // Natural typing has periodic pauses
  return longGaps >= 3 && shortRuns >= 2;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const initialRecipe: AvatarRecipe = {
  name: '',
  race: 'human',
  gender: 'male',
  hairStyle: 'wild',
  bangNickname: 'BANG!',
  bangNicknameChestL: 'POW!',
  bangNicknameChestR: 'ZAP!',
  hairBangNickname: '',
  originStory: '',
  formativeMemory: '',
  parsedKeywords: [],
  // Scenarios
  scenarioConflict: '',
  scenarioMoral: '',
  scenarioFear: '',
  scenarioDesire: '',
  characterDescription: '',
  weakness: '',
  voiceLine: '',
  allExtractedKeywords: [],
  // Phase 3
  class: '',
  occupation: '',
  animal: '',
  personality: '',
  combatStyle: '',
  colors: {
    skin: '',
    hair: '',
    eyes: '',
    eyebrows: '',
    lips: '',
    primary: '',
    secondary: '',
    accent: '',
    outline: '#333333',
    shieldPrimary: '#C62828',
    shieldSecondary: '#7F0000',
    bangOuter: '#FF4500',
    bangMiddle: '#FFA500',
    bangInner: '#FFD700',
    bangDots: '#FF0000',
  },
  strokes: [],
  lifePhilosophy: '',
  powerSpike: '',
  signatureMove: '',
  auraParams: {
    color1: '#FFD700',
    color2: '#FF6B00',
    pulseSpeed: 1,
    intensity: 0.8,
    pattern: 'radial',
  },
  quizPassed: false,
  avatarHidden: false,
  uniformHidden: false,
  gearHidden: false,
  petHidden: false,
  auraHidden: false,
  uniformOffsetX: 0,
  uniformOffsetY: 0,
  gearOffsetX: 0,
  gearOffsetY: 0,
  crestOffsetX: 0,
  crestOffsetY: 0,
  allOffsetX: 0,
  allOffsetY: 0,
  recipeHash: '',
  jitterCommitment: '',
  passportId: '',
  keywordMerkleRoot: '',
  scenarioHash: '',
};

// Props for recovery integration
interface IdentityRitualProps {
  onRecoveryRequest?: () => void;
  onComplete?: () => void;
}

export default function IdentityRitual({ onRecoveryRequest, onComplete }: IdentityRitualProps = {}) {
  const [state, setState] = useState<RitualState>({
    phase: 1,
    recipe: { ...initialRecipe },
    silhouettePaths: [],
    colorablePaths: [],
    spawnedItems: [],
    jitterSamples: [],
    lastKeystroke: 0,
    quizQuestions: [],
    currentQuizIndex: 0,
    quizScore: 0,
    quizRetries: 0,
    showQuizResult: 'none' as const,
    livenessScore: 0,
    passedLivenessCheck: false,
    colorMixHistory: [],
    drawingStrokes: [],
  });
  
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [currentColor, setCurrentColor] = useState('#4A90D9');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<StrokePath | null>(null);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);  // Track which item being dragged
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [placementMode, setPlacementMode] = useState<'uniform' | 'gear' | 'crest' | 'all' | null>(null); // Tap-to-place outfit
  
  // Color Palette Modal state
  const [showColorPalette, setShowColorPaletteRaw] = useState(false);
  // Block color palette from opening during placement mode
  const setShowColorPalette = useCallback((show: boolean) => {
    if (show && placementMode) return; // Don't open palette during placement
    setShowColorPaletteRaw(show);
  }, [placementMode]);
  
  // Hesitation tracking - time from UI display to user action
  const [lastUIChangeTime, setLastUIChangeTime] = useState<number>(Date.now());
  
  // Record hesitation sample
  const recordHesitation = useCallback((eventType: 'tap' | 'select' | 'color' | 'swipe') => {
    const now = Date.now();
    const hesitation = now - lastUIChangeTime;
    
    // Only record reasonable hesitation times (100ms - 30s)
    if (hesitation > 100 && hesitation < 30000) {
      setState(prev => ({
        ...prev,
        jitterSamples: [...prev.jitterSamples, {
          timestamp: now,
          delta: hesitation,
          hesitation,
          eventType,
        }],
      }));
    }
    setLastUIChangeTime(now);
  }, [lastUIChangeTime]);
  
  // Item Preview Modal state (Step 1)
  const [showItemPreview, setShowItemPreview] = useState(false);
  const [previewItem, setPreviewItem] = useState<SpawnedItem | null>(null);
  const [previewRotation, setPreviewRotation] = useState(0);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewPathColors, setPreviewPathColors] = useState<Record<number, string>>({}); // Step 4: colors for preview item paths
  
  // Tap-to-Fill Coloring Book state (Step 2)
  const [selectedColor, setSelectedColor] = useState('#4A90D9');
  const [pathColors, setPathColors] = useState<Record<number, string>>({});  // pathIndex -> color
  const [itemPathColors, setItemPathColors] = useState<Record<string, Record<number, string>>>({}); // itemId -> {pathIndex -> color};
  
  // Uniform & Occupation coloring state
  const [uniformPathColors, setUniformPathColors] = useState<Record<number, string>>({});
  const [occupationPathColors, setOccupationPathColors] = useState<Record<number, string>>({});
  const [petPathColors, setPetPathColors] = useState<Record<number, string>>({});
  
  // Selected path for tap-region-then-color flow
  const [selectedPath, setSelectedPath] = useState<{
    type: 'body' | 'uniform' | 'occupation' | 'pet' | 'item' | 'preview';
    index: number;
    itemId?: string;
  } | null>(null);
  
  // Color palette for tap-to-fill (matches coloring book app style)
  const COLOR_PALETTE = [
    // Row 1 - Vibrant
    '#FFFFFF', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000', '#FF8000',
    // Row 2 - Muted/skin tones
    '#F5DEB3', '#DEB887', '#D2B48C', '#C4A484', '#8B7355', '#5C4033', '#3D2314', '#1A0F0A',
    // Row 3 - Fantasy colors
    '#FFD700', '#C0C0C0', '#CD7F32', '#4A90D9', '#8B0000', '#006400', '#4B0082', '#2F4F4F',
  ];
  
  // Handle tap on avatar path - SELECT the region (don't fill yet)
  const handlePathTap = useCallback((pathIndex: number) => {
    recordHesitation('color');
    setSelectedPath({ type: 'body', index: pathIndex });
    setShowColorPalette(true); // Auto-open palette
  }, [recordHesitation]);
  
  // Handle tap on item path - SELECT the region
  const handleItemPathTap = useCallback((itemId: string, pathIndex: number) => {
    recordHesitation('color');
    setSelectedPath({ type: 'item', index: pathIndex, itemId });
    setShowColorPalette(true);
  }, [recordHesitation]);
  
  // Handle tap on uniform path - SELECT the region
  const handleUniformPathTap = useCallback((pathIndex: number) => {
    recordHesitation('color');
    setSelectedPath({ type: 'uniform', index: pathIndex });
    setShowColorPalette(true);
  }, [recordHesitation]);
  
  // Handle tap on occupation gear path - SELECT the region
  const handleOccupationPathTap = useCallback((pathIndex: number) => {
    recordHesitation('color');
    setSelectedPath({ type: 'occupation', index: pathIndex });
    setShowColorPalette(true);
  }, [recordHesitation]);
  
  // Handle tap on pet path - SELECT the region
  const handlePetPathTap = useCallback((pathIndex: number) => {
    recordHesitation('color');
    setSelectedPath({ type: 'pet', index: pathIndex });
    setShowColorPalette(true);
  }, [recordHesitation]);
  
  // Aura pulse animation for main avatar canvas
  const [auraPhase, setAuraPhase] = useState(0);
  const auraAnimRef = useRef<number | null>(null);
  const auraStartRef = useRef(Date.now());
  useEffect(() => {
    if (state.recipe.auraHidden || state.phase < 5) {
      if (auraAnimRef.current) cancelAnimationFrame(auraAnimRef.current);
      return;
    }
    auraStartRef.current = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - auraStartRef.current) / 1000;
      setAuraPhase(elapsed);
      auraAnimRef.current = requestAnimationFrame(tick);
    };
    auraAnimRef.current = requestAnimationFrame(tick);
    return () => { if (auraAnimRef.current) cancelAnimationFrame(auraAnimRef.current); };
  }, [state.recipe.auraHidden, state.phase]);

  // PanResponder for dragging items on the avatar
  const itemPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        // Never capture during placement mode — let onPress handle it
        if (placementMode) return false;
        // Only capture if there are unlocked items to drag
        return state.spawnedItems.some(item => !item.locked);
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Never capture during placement mode
        if (placementMode) return false;
        // Only capture horizontal drags (let vertical scroll through)
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5 && Math.abs(gestureState.dx) > 5;
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        // Never capture vertical swipes — let ScrollView handle them
        if (Math.abs(gestureState.dy) > Math.abs(gestureState.dx)) return false;
        return false;
      },
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const svgScale = 0.35;
        const svgX = locationX / svgScale;
        const svgY = locationY / svgScale;
        
        // Tap-to-place: if in placement mode, set outfit offset to tap point
        if (placementMode === 'uniform' || placementMode === 'gear') {
          const raceParams = getRaceBodyParams(state.recipe.race, state.recipe.gender);
          const defaultCenterY = raceParams.torsoY + 60;
          const offX = svgX - 200;
          const offY = svgY - defaultCenterY;
          
          if (placementMode === 'uniform') {
            setState(prev => ({
              ...prev,
              recipe: { ...prev.recipe, uniformOffsetX: offX, uniformOffsetY: offY },
            }));
          } else {
            setState(prev => ({
              ...prev,
              recipe: { ...prev.recipe, gearOffsetX: offX, gearOffsetY: offY },
            }));
          }
          setPlacementMode(null);
          return;
        }
        
        // Find closest unlocked item
        let closestItem: string | null = null;
        let closestDist = Infinity;
        
        state.spawnedItems.forEach(item => {
          if (!item.locked) {
            const dist = Math.sqrt(Math.pow(item.x - svgX, 2) + Math.pow(item.y - svgY, 2));
            if (dist < 50 && dist < closestDist) {
              closestDist = dist;
              closestItem = item.id;
            }
          }
        });
        
        if (closestItem) {
          setDraggedItem(closestItem);
          setSelectedItemId(closestItem);
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (draggedItem) {
          const svgScale = 0.35;
          const dx = gestureState.dx / svgScale;
          const dy = gestureState.dy / svgScale;
          
          setState(prev => ({
            ...prev,
            spawnedItems: prev.spawnedItems.map(item =>
              item.id === draggedItem && !item.locked
                ? { ...item, x: item.x + dx * 0.1, y: item.y + dy * 0.1 }
                : item
            ),
          }));
        }
      },
      onPanResponderRelease: () => {
        // Keep item selected but stop dragging
        setDraggedItem(null);
      },
    })
  ).current;
  
  // ============================================================================
  // ITEM PREVIEW MODAL FUNCTIONS
  // ============================================================================
  
  // Open preview modal with a new item (instead of auto-placing)
  const openItemPreview = useCallback((item: SpawnedItem) => {
    setPreviewItem(item);
    setPreviewRotation(item.rotation);
    setPreviewScale(item.scale);
    setPreviewPathColors({});  // Reset colors for new item
    setShowItemPreview(true);
  }, []);
  
  // Handle tap on preview item path - store which part is selected
  const [previewSelectedPart, setPreviewSelectedPart] = useState<number | null>(null);
  
  const handlePreviewPathTap = useCallback((pathIndex: number) => {
    recordHesitation('color');
    setPreviewSelectedPart(pathIndex);
  }, [recordHesitation]);
  
  // Fill preview part with color
  const fillPreviewPart = useCallback((color: string) => {
    if (previewSelectedPart === null) return;
    setPreviewPathColors(prev => ({ ...prev, [previewSelectedPart]: color }));
    setPreviewSelectedPart(null); // Clear after fill
  }, [previewSelectedPart]);
  
  // FILL the selected path with chosen color
  const fillSelectedPath = useCallback((color: string) => {
    if (!selectedPath) return;
    
    switch (selectedPath.type) {
      case 'body':
        setPathColors(prev => ({ ...prev, [selectedPath.index]: color }));
        break;
      case 'uniform':
        setUniformPathColors(prev => ({ ...prev, [selectedPath.index]: color }));
        break;
      case 'occupation':
        setOccupationPathColors(prev => ({ ...prev, [selectedPath.index]: color }));
        break;
      case 'pet':
        setPetPathColors(prev => ({ ...prev, [selectedPath.index]: color }));
        break;
      case 'item':
        if (selectedPath.itemId) {
          setItemPathColors(prev => ({
            ...prev,
            [selectedPath.itemId!]: {
              ...(prev[selectedPath.itemId!] || {}),
              [selectedPath.index]: color,
            },
          }));
        }
        break;
    }
    setSelectedPath(null); // Clear selection after fill
    setShowColorPalette(false); // Close palette
  }, [selectedPath]);
  
  // Place the previewed item onto the avatar with its colors
  const placePreviewItem = useCallback(() => {
    if (!previewItem) return;
    
    const finalItem: SpawnedItem = {
      ...previewItem,
      rotation: previewRotation,
      scale: previewScale,
      locked: false,
    };
    
    setState(prev => ({
      ...prev,
      spawnedItems: [...prev.spawnedItems, finalItem],
    }));
    
    // Transfer preview colors to itemPathColors
    if (Object.keys(previewPathColors).length > 0) {
      setItemPathColors(prev => ({
        ...prev,
        [finalItem.id]: { ...previewPathColors },
      }));
    }
    
    setShowItemPreview(false);
    setPreviewItem(null);
    setPreviewRotation(0);
    setPreviewScale(1);
    setPreviewPathColors({});
    setPreviewSelectedPart(null);
  }, [previewItem, previewRotation, previewScale, previewPathColors]);
  
  // Cancel preview (discard item)
  const cancelItemPreview = useCallback(() => {
    setShowItemPreview(false);
    setPreviewItem(null);
    setPreviewRotation(0);
    setPreviewScale(1);
    setPreviewPathColors({});
    setPreviewSelectedPart(null);
  }, []);
  
  // Jitter recording
  const recordKeystroke = useCallback((key?: string) => {
    const now = Date.now();
    const delta = state.lastKeystroke > 0 ? now - state.lastKeystroke : 0;
    
    setState(prev => ({
      ...prev,
      jitterSamples: [...prev.jitterSamples, { timestamp: now, delta, key }],
      lastKeystroke: now,
    }));
  }, [state.lastKeystroke]);
  
  // Text change handler with keyword parsing
  const handleTextChange = useCallback((field: string, value: string) => {
    recordKeystroke();
    
    // Handle gender change - regenerate silhouette
    if (field === 'gender') {
      const gender = value as 'male' | 'female';
      const generator = RACE_SILHOUETTES[state.recipe.race] || RACE_SILHOUETTES.human;
      const seed = generateSeedFromName(state.recipe.name || 'default');
      const paths = generator(gender, seed);
      const colorable = pathsToColorable(paths);
      
      setState(prev => ({
        ...prev,
        recipe: { ...prev.recipe, gender },
        silhouettePaths: paths,
        colorablePaths: colorable,
      }));
      return;
    }
    
    // Handle hairStyle change - regenerate silhouette with new style
    if (field === 'hairStyle') {
      const generator = RACE_SILHOUETTES[state.recipe.race] || RACE_SILHOUETTES.human;
      // Use hairStyle value as part of seed to get different hair
      const baseSeed = generateSeedFromName(state.recipe.name || 'default');
      let hairSeed: number;
      if (value === 'wild') {
        // Wild/Random: use timestamp-derived seed in 0-999 range to trigger dual-style combo
        hairSeed = (Date.now() % 1000);
      } else {
        hairSeed = baseSeed + (HAIR_STYLE_SEEDS[value] ?? 0);
      }
      const paths = generator(state.recipe.gender, hairSeed);
      const colorable = pathsToColorable(paths);
      
      setState(prev => ({
        ...prev,
        recipe: { ...prev.recipe, hairStyle: value as AvatarRecipe['hairStyle'] },
        silhouettePaths: paths,
        colorablePaths: colorable,
      }));
      return;
    }
    
    setState(prev => {
      const newRecipe = { ...prev.recipe, [field]: value };
      let newSpawnedItems = [...prev.spawnedItems];
      let itemToPreview: SpawnedItem | null = null;
      
      // Parse keywords on story fields AND scenario fields
      const keywordFields = [
        'originStory', 'formativeMemory', 
        'scenarioConflict', 'scenarioMoral', 'scenarioFear', 
        'scenarioDesire', 'characterDescription', 'weakness', 'voiceLine'
      ];
      
      if (keywordFields.includes(field)) {
        const keywords = parseKeywords(value);
        const newKeywords = keywords.filter(kw => !prev.recipe.parsedKeywords.includes(kw));
        newRecipe.parsedKeywords = [...new Set([...prev.recipe.parsedKeywords, ...keywords])];
        
        // Spawn new items - match class selection flow exactly
        for (const kw of newKeywords) {
          const paths = getSvgForKeyword(kw);
          if (paths && paths.length > 0) {
            const quadrant = CANONICAL.fieldToQuadrant[field] ?? 0;
            const newItem: SpawnedItem = {
              id: `${kw}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              keyword: kw,
              paths: paths,
              x: 200,
              y: 300,
              scale: 1.0,
              rotation: 0,
              colorRegions: {},
              rarity: 'common' as const,
              flipX: false,
              flipY: false,
              locked: false,
              quadrant: quadrant,
              sourceField: field,
            };
            // Route through preview modal - same as class
            if (!itemToPreview && !showItemPreview) {
              itemToPreview = newItem;
            } else {
              newSpawnedItems.push(newItem);
            }
          }
        }
        
        // Trigger preview modal - same as class
        if (itemToPreview) {
          setTimeout(() => openItemPreview(itemToPreview!), 50);
        }
        
        const livenessScore = calculateLivenessScore(prev.jitterSamples);
        const passedLivenessCheck = livenessScore >= 50;
        
        return { 
          ...prev, 
          recipe: newRecipe, 
          spawnedItems: newSpawnedItems,
          livenessScore,
          passedLivenessCheck,
        };
      }
      
      // Spawn gear when class selected - route through preview modal
      if (field === 'class' && value) {
        const uniform = CLASS_UNIFORMS[value];
        if (uniform?.svgPaths && uniform.svgPaths.length > 0) {
          const uniformId = `uniform-${value.toLowerCase()}`;
          if (!newSpawnedItems.find(i => i.id === uniformId)) {
            const uniformItem: SpawnedItem = {
              id: uniformId,
              keyword: `${value.toLowerCase()}_uniform`,
              paths: uniform.svgPaths,
              x: 200,
              y: 200,
              scale: 1.0,
              rotation: 0,
              colorRegions: {},  // Start empty for coloring book
              rarity: 'uncommon' as const,
              flipX: false,
              flipY: false,
              locked: false,
              quadrant: 2,  // Q3 - bottom-left for class
              sourceField: 'class',
            };
            // Route through preview if no modal open
            if (!itemToPreview && !showItemPreview) {
              itemToPreview = uniformItem;
            } else {
              newSpawnedItems.push(uniformItem);
            }
          }
        }
        if (uniform?.weapon) {
          const weaponKey = uniform.weapon.toLowerCase();
          const paths = getSvgForKeyword(weaponKey);
          if (paths && paths.length > 0 && !newSpawnedItems.find(i => i.keyword === weaponKey)) {
            const weaponItem: SpawnedItem = {
              id: `${weaponKey}-${Date.now()}`,
              keyword: weaponKey,
              paths: paths,
              x: 200,
              y: 300,
              scale: 1.0,
              rotation: 0,
              colorRegions: {},
              rarity: 'uncommon' as const,
              flipX: false,
              flipY: false,
              locked: false,
              quadrant: 2,  // Q3 - bottom-left for class weapon
              sourceField: 'class',
            };
            if (!itemToPreview && !showItemPreview) {
              itemToPreview = weaponItem;
            } else {
              newSpawnedItems.push(weaponItem);
            }
          }
        }
        // Trigger preview modal
        if (itemToPreview) {
          setTimeout(() => openItemPreview(itemToPreview!), 50);
        }
      }
      
      // Spawn gear when occupation selected - route through preview modal
      if (field === 'occupation' && value) {
        const gear = OCCUPATION_GEAR[value];
        if (gear?.svgPaths && gear.svgPaths.length > 0) {
          const gearId = `occupation-${value.toLowerCase()}`;
          if (!newSpawnedItems.find(i => i.id === gearId)) {
            const gearItem: SpawnedItem = {
              id: gearId,
              keyword: `${value.toLowerCase()}_gear`,
              paths: gear.svgPaths,
              x: 250,
              y: 250,
              scale: 0.8,
              rotation: 0,
              colorRegions: {},  // Start empty for coloring book
              rarity: 'uncommon' as const,
              flipX: false,
              flipY: false,
              locked: false,
              quadrant: 3,  // Q4 - bottom-right for occupation
              sourceField: 'occupation',
            };
            if (!itemToPreview && !showItemPreview) {
              itemToPreview = gearItem;
            } else {
              newSpawnedItems.push(gearItem);
            }
          }
        }
        if (gear?.tools) {
          for (const tool of gear.tools) {
            const paths = getSvgForKeyword(tool.toLowerCase());
            if (paths && paths.length > 0 && !newSpawnedItems.find(i => i.keyword === tool.toLowerCase())) {
              const toolItem: SpawnedItem = {
                id: `${tool.toLowerCase()}-${Date.now()}`,
                keyword: tool.toLowerCase(),
                paths: paths,
                x: 200,
                y: 300,
                scale: 1.0,
                rotation: 0,
                colorRegions: {},
                rarity: 'common' as const,
                flipX: false,
                flipY: false,
                locked: false,
                quadrant: 3,  // Q4 - bottom-right for occupation tools
                sourceField: 'occupation',
              };
              if (!itemToPreview && !showItemPreview) {
                itemToPreview = toolItem;
              } else {
                newSpawnedItems.push(toolItem);
              }
            }
          }
        }
        // Trigger preview modal
        if (itemToPreview) {
          setTimeout(() => openItemPreview(itemToPreview!), 50);
        }
      }
      
      // Spawn spirit when animal selected - route through preview modal
      if (field === 'animal' && value) {
        const spirit = ANIMAL_SPIRITS[value];
        if (spirit?.svgPaths && spirit.svgPaths.length > 0) {
          const spiritId = `spirit-${value.toLowerCase()}`;
          if (!newSpawnedItems.find(i => i.id === spiritId)) {
            const spiritItem: SpawnedItem = {
              id: spiritId,
              keyword: `${value.toLowerCase()}_spirit`,
              paths: spirit.svgPaths,
              x: 200,
              y: 150,
              scale: 1.2,
              rotation: 0,
              colorRegions: {},  // Start empty for coloring book
              rarity: 'rare' as const,
              flipX: false,
              flipY: false,
              locked: false,
              quadrant: 3,  // Q4 - bottom-right for animal
              sourceField: 'animal',
            };
            if (!itemToPreview && !showItemPreview) {
              itemToPreview = spiritItem;
            } else {
              newSpawnedItems.push(spiritItem);
            }
          }
        }
        const paths = getSvgForKeyword(value.toLowerCase());
        if (paths && paths.length > 0 && !newSpawnedItems.find(i => i.keyword === value.toLowerCase())) {
          const animalItem: SpawnedItem = {
            id: `${value.toLowerCase()}-${Date.now()}`,
            keyword: value.toLowerCase(),
            paths: paths,
            x: 200,
            y: 300,
            scale: 1.0,
            rotation: 0,
            colorRegions: {},
            rarity: 'common' as const,
            flipX: false,
            flipY: false,
            locked: false,
            quadrant: 3,  // Q4 - bottom-right for animal
            sourceField: 'animal',
          };
          if (!itemToPreview && !showItemPreview) {
            itemToPreview = animalItem;
          } else {
            newSpawnedItems.push(animalItem);
          }
        }
        // Trigger preview modal
        if (itemToPreview) {
          setTimeout(() => openItemPreview(itemToPreview!), 50);
        }
      }
      
      // Extract keywords from ALL open-ended text fields for quiz verification
      const textFields = [
        'originStory', 'formativeMemory', 'scenarioConflict', 'scenarioMoral',
        'scenarioFear', 'scenarioDesire', 'characterDescription', 'weakness',
        'voiceLine', 'lifePhilosophy', 'powerSpike', 'signatureMove', 'combatStyle'
      ];
      
      if (textFields.includes(field)) {
        // Combine all text and extract significant words
        const allText = textFields.map(f => newRecipe[f as keyof typeof newRecipe] || '').join(' ');
        const extractedWords = extractSignificantWordsFromText(allText);
        newRecipe.allExtractedKeywords = [...new Set(extractedWords)];
      }
      
      return { ...prev, recipe: newRecipe, spawnedItems: newSpawnedItems };
    });
  }, [recordKeystroke]);
  
  // Race selection - generate base silhouette with unique seed from name
  const handleRaceSelect = useCallback((race: string) => {
    // Record hesitation (time from seeing races to selecting)
    recordHesitation('select');
    
    const generator = RACE_SILHOUETTES[race] || RACE_SILHOUETTES.human;
    // Generate seed from user's name for uniqueness
    const seed = generateSeedFromName(state.recipe.name || 'default');
    // Use selected gender from recipe
    const gender = state.recipe.gender || 'male';
    const paths = generator(gender, seed);
    
    // Convert to colorable paths for coloring book
    const colorable = pathsToColorable(paths);
    
    setState(prev => ({
      ...prev,
      recipe: { ...prev.recipe, race },
      silhouettePaths: paths,
      colorablePaths: colorable,
    }));
  }, [state.recipe.name, state.recipe.gender, recordHesitation]);
  
  // Item drag handlers for spawned items
  const handleItemDragStart = useCallback((itemId: string) => {
    setDraggedItem(itemId);
  }, []);
  
  const handleItemDrag = useCallback((itemId: string, dx: number, dy: number) => {
    setState(prev => ({
      ...prev,
      spawnedItems: prev.spawnedItems.map(item =>
        item.id === itemId && !item.locked
          ? { ...item, x: item.x + dx, y: item.y + dy }
          : item
      ),
    }));
  }, []);
  
  const handleItemDragEnd = useCallback(() => {
    setDraggedItem(null);
  }, []);
  
  const handleItemLock = useCallback((itemId: string) => {
    setState(prev => ({
      ...prev,
      spawnedItems: prev.spawnedItems.map(item =>
        item.id === itemId ? { ...item, locked: !item.locked } : item
      ),
    }));
  }, []);
  
  const handleItemScale = useCallback((itemId: string, scaleDelta: number) => {
    setState(prev => ({
      ...prev,
      spawnedItems: prev.spawnedItems.map(item =>
        item.id === itemId && !item.locked
          ? { ...item, scale: Math.max(0.2, Math.min(2, item.scale + scaleDelta)) }
          : item
      ),
    }));
  }, []);
  
  const handleItemRotate = useCallback((itemId: string, rotateDelta: number) => {
    setState(prev => ({
      ...prev,
      spawnedItems: prev.spawnedItems.map(item =>
        item.id === itemId && !item.locked
          ? { ...item, rotation: item.rotation + rotateDelta }
          : item
      ),
    }));
  }, []);

  const handleItemFlipX = useCallback((itemId: string) => {
    setState(prev => ({
      ...prev,
      spawnedItems: prev.spawnedItems.map(item =>
        item.id === itemId && !item.locked
          ? { ...item, flipX: !item.flipX }
          : item
      ),
    }));
  }, []);

  const handleItemFlipY = useCallback((itemId: string) => {
    setState(prev => ({
      ...prev,
      spawnedItems: prev.spawnedItems.map(item =>
        item.id === itemId && !item.locked
          ? { ...item, flipY: !item.flipY }
          : item
      ),
    }));
  }, []);

  const handleItemSetRotation = useCallback((itemId: string, angle: number) => {
    setState(prev => ({
      ...prev,
      spawnedItems: prev.spawnedItems.map(item =>
        item.id === itemId && !item.locked
          ? { ...item, rotation: angle }
          : item
      ),
    }));
  }, []);

  // Phase navigation
  const nextPhase = useCallback(async () => {
    if (state.phase === 7) {
      // Verify quiz before proceeding to Anchor phase
      if (!state.recipe.quizPassed) {
        alert('Please complete the verification quiz correctly.');
        return;
      }
      
      // Generate hashes for Phase 8 (Anchor)
      const jitterAnalysis = analyzeJitter(state.jitterSamples);
      
      if (!jitterAnalysis.passed) {
        alert(`Verification failed: ${jitterAnalysis.flags.join(', ')}`);
        return;
      }
      
      const salt = generateSalt();
      const [recipeHash, commitment] = await Promise.all([
        hashRecipe(state.recipe),
        generateJitterCommitment(true, salt),
      ]);
      
      // Build keyword merkle root for inscription
      const keywordMerkleRoot = await buildKeywordMerkleRoot(state.recipe);
      
      setState(prev => ({
        ...prev,
        phase: 8,
        recipe: {
          ...prev.recipe,
          recipeHash,
          jitterCommitment: commitment,
          keywordMerkleRoot,
          passportId: `KV-${Date.now().toString(36).toUpperCase()}`,
        },
      }));
      
      // Save recipe for return authentication (do this now, inscription happens in PhaseAnchor)
      try {
        const updatedRecipe = {
          ...state.recipe,
          recipeHash,
          jitterCommitment: commitment,
          keywordMerkleRoot,
        };
        await SecureStore.setItemAsync('kv_avatar_recipe', JSON.stringify(updatedRecipe));
        await SecureStore.setItemAsync('kv_color_mix_history', JSON.stringify(state.colorMixHistory));
        console.log('[Ritual] Saved recipe for return auth');
      } catch (saveErr) {
        console.warn('[Ritual] Failed to save recipe:', saveErr);
      }
      
      return;
    }
    
    // Phase 8 (Anchor) - no next, PhaseAnchor handles completion
    if (state.phase === 8) {
      return;
    }
    
    // Generate quiz for phase 6
    // Generate quiz for phase 7
    if (state.phase === 6) {
      const quizQuestions = generateQuiz(state.recipe, state.colorMixHistory);
      setState(prev => ({ 
        ...prev, 
        phase: prev.phase + 1, 
        quizQuestions,
        currentQuizIndex: 0,
        quizScore: 0,
      }));
      return;
    }
    
    setState(prev => ({ ...prev, phase: prev.phase + 1 }));
    setLastUIChangeTime(Date.now()); // Reset hesitation timer on new phase
  }, [state]);
  
  const prevPhase = useCallback(() => {
    setState(prev => ({ ...prev, phase: Math.max(1, prev.phase - 1) }));
    setLastUIChangeTime(Date.now()); // Reset hesitation timer
  }, []);
  
  // Render phase content
  const renderPhaseContent = () => {
    switch (state.phase) {
      case 1:
        return <PhaseSpawn 
          recipe={state.recipe} 
          onNameChange={(v) => handleTextChange('name', v)}
          onRaceSelect={handleRaceSelect}
          onGenderSelect={(v) => handleTextChange('gender', v)}
          onHairStyleSelect={(v) => handleTextChange('hairStyle', v)}
          onBangNicknameChange={(v) => handleTextChange('bangNickname', v)}
          onBangNicknameChestLChange={(v) => handleTextChange('bangNicknameChestL', v)}
          onBangNicknameChestRChange={(v) => handleTextChange('bangNicknameChestR', v)}
          onHairBangNicknameChange={(v) => handleTextChange('hairBangNickname', v)}
          onRecoveryRequest={onRecoveryRequest}
        />;
      case 2:
        return <PhaseOrigin 
          recipe={state.recipe}
          onStoryChange={(v) => handleTextChange('originStory', v)}
          onMemoryChange={(v) => handleTextChange('formativeMemory', v)}
          parsedKeywords={state.recipe.parsedKeywords}
        />;
      case 3:
        // Character Scenarios - 2 required + 1 optional
        return <PhaseScenarios
          recipe={state.recipe}
          onDesireChange={(v) => handleTextChange('scenarioDesire', v)}
          onDescriptionChange={(v) => handleTextChange('characterDescription', v)}
          onVoiceLineChange={(v) => handleTextChange('voiceLine', v)}
        />;
      case 4:
        return <PhaseGearUp
          recipe={state.recipe}
          onClassChange={(v) => handleTextChange('class', v)}
          onOccupationChange={(v) => handleTextChange('occupation', v)}
          onAnimalChange={(v) => handleTextChange('animal', v)}
        />;
      case 5:
        return <PhaseCraft
          recipe={state.recipe}
          selectedRegion={selectedRegion}
          currentColor={currentColor}
          colorMixHistory={state.colorMixHistory}
          onRegionSelect={setSelectedRegion}
          onColorChange={setCurrentColor}
          onColorApply={(region, color) => {
            // Clear per-path overrides for this region so region color takes effect
            setPathColors(prev => {
              const cleaned = { ...prev };
              state.colorablePaths.forEach((cp, i) => {
                if (cp.region === region && cleaned[i]) {
                  delete cleaned[i];
                }
              });
              return cleaned;
            });
            setState(prev => ({
              ...prev,
              recipe: {
                ...prev.recipe,
                colors: { ...prev.recipe.colors, [region]: color },
              },
            }));
          }}
          onColorMix={(mix) => {
            setState(prev => ({
              ...prev,
              colorMixHistory: [...prev.colorMixHistory, mix],
            }));
          }}
        />;
      case 6:
        return <PhaseProBet
          recipe={state.recipe}
          onPhilosophyChange={(v) => handleTextChange('lifePhilosophy', v)}
          onPowerChange={(v) => handleTextChange('powerSpike', v)}
          onMoveChange={(v) => handleTextChange('signatureMove', v)}
          onAuraChange={(params) => {
            setState(prev => ({
              ...prev,
              recipe: { ...prev.recipe, auraParams: params },
            }));
          }}
        />;
      case 7:
        // QUIZ RESULT SCREEN — shows before continuing or retrying
        if (state.showQuizResult === 'passed') {
          return (
            <View style={styles.phaseContent}>
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 80 }}>✅</Text>
                <Text style={{ color: '#4CAF50', fontSize: 28, fontWeight: 'bold', marginTop: 20, textAlign: 'center' }}>
                  SENTRY APPROVES
                </Text>
                <Text style={{ color: '#8BC34A', fontSize: 16, marginTop: 12, textAlign: 'center' }}>
                  You scored {state.quizScore}/{state.quizQuestions.length}
                </Text>
                <Text style={{ color: '#B8A080', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                  Your identity has been verified. The gate is open.
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: '#4CAF50', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12, marginTop: 32 }}
                  onPress={async () => {
                    // Generate hashes before advancing to Phase 8
                    const salt = generateSalt();
                    const [recipeHash, commitment] = await Promise.all([
                      hashRecipe(state.recipe),
                      generateJitterCommitment(true, salt),
                    ]);
                    const keywordMerkleRoot = await buildKeywordMerkleRoot(state.recipe);
                    
                    setState(prev => ({
                      ...prev,
                      showQuizResult: 'none' as const,
                      phase: 8,
                      recipe: {
                        ...prev.recipe,
                        recipeHash,
                        jitterCommitment: commitment,
                        keywordMerkleRoot,
                        passportId: `KV-${Date.now().toString(36).toUpperCase()}`,
                      },
                    }));
                    
                    // Save recipe for return auth
                    try {
                      await SecureStore.setItemAsync('kv_avatar_recipe', JSON.stringify({
                        ...state.recipe,
                        recipeHash,
                        jitterCommitment: commitment,
                        keywordMerkleRoot,
                      }));
                    } catch {}
                  }}
                >
                  <Text style={{ color: '#000', fontSize: 18, fontWeight: 'bold' }}>Continue to Passport</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }
        
        if (state.showQuizResult === 'failed') {
          return (
            <View style={styles.phaseContent}>
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 80 }}>⚠️</Text>
                <Text style={{ color: '#FF6B35', fontSize: 28, fontWeight: 'bold', marginTop: 20, textAlign: 'center' }}>
                  SENTRY SUSPICIOUS
                </Text>
                <Text style={{ color: '#FFA726', fontSize: 16, marginTop: 12, textAlign: 'center' }}>
                  You scored {state.quizScore}/{state.quizQuestions.length} — not enough
                </Text>
                <Text style={{ color: '#B8A080', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                  You have 1 more attempt. Study your avatar carefully.
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: '#FF6B35', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12, marginTop: 32 }}
                  onPress={() => setState(prev => ({ ...prev, showQuizResult: 'none' as const }))}
                >
                  <Text style={{ color: '#000', fontSize: 18, fontWeight: 'bold' }}>Retry Quiz</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }
        
        if (state.showQuizResult === 'restart') {
          return (
            <View style={styles.phaseContent}>
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 80 }}>?</Text>
                <Text style={{ color: '#FF6B35', fontSize: 28, fontWeight: 'bold', marginTop: 20, textAlign: 'center' }}>SENTRY SUSPICIOUS</Text>
                <Text style={{ color: '#FFA726', fontSize: 16, marginTop: 12, textAlign: 'center' }}>Failed twice. Take a moment and try again.</Text>
                <TouchableOpacity style={{ backgroundColor: '#F59E0B', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12, marginTop: 32 }} onPress={() => { const q = generateQuiz(state.recipe, state.colorMixHistory); setState(prev => ({ ...prev, showQuizResult: 'none', quizQuestions: q, currentQuizIndex: 0, quizScore: 0, quizRetries: 0 })); }}>
                  <Text style={{ color: '#000', fontSize: 18, fontWeight: 'bold' }}>Try Again</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }
        
        // QUIZ QUESTIONS
        const currentQuestion = state.quizQuestions[state.currentQuizIndex];
        const isLastQuestion = state.currentQuizIndex >= state.quizQuestions.length - 1;
        const requiredScore = Math.ceil(state.quizQuestions.length * 0.8); // 80% to pass (4/5)
        
        return <PhaseShot
          question={currentQuestion}
          questionNumber={state.currentQuizIndex + 1}
          totalQuestions={state.quizQuestions.length}
          score={state.quizScore}
          onAnswer={(answer) => {
            const correct = answer === currentQuestion?.correctAnswer;
            const newScore = correct ? state.quizScore + 1 : state.quizScore;
            
            if (isLastQuestion) {
              // Final question - determine pass/fail
              const passed = newScore >= requiredScore;
              if (passed) {
                setState(prev => ({
                  ...prev,
                  quizScore: newScore,
                  recipe: { ...prev.recipe, quizPassed: true },
                  showQuizResult: 'passed' as const,
                }));
              } else if (state.quizRetries >= 1) {
                // Second fail — show rejection screen, phase resets when they tap Restart
                setState(prev => ({
                  ...prev,
                  quizScore: 0,
                  quizRetries: 0,
                  currentQuizIndex: 0,
                  quizQuestions: [],
                  recipe: { ...prev.recipe, quizPassed: false },
                  showQuizResult: 'restart' as const,
                }));
              } else {
                // First fail — allow 1 retry
                setState(prev => ({
                  ...prev,
                  quizScore: 0,
                  quizRetries: prev.quizRetries + 1,
                  currentQuizIndex: 0,
                  quizQuestions: [],
                  recipe: { ...prev.recipe, quizPassed: false },
                  showQuizResult: 'failed' as const,
                }));
              }
            } else {
              // Move to next question
              setState(prev => ({
                ...prev,
                quizScore: newScore,
                currentQuizIndex: prev.currentQuizIndex + 1,
              }));
              if (!correct) {
                alert('Incorrect! The Sentry grows suspicious...');
              }
            }
          }}
        />;
      case 8:
        return <PhaseAnchor recipe={state.recipe} onComplete={onComplete} />;
      default:
        return null;
    }
  };
  
  // Memoize items by quadrant to avoid recalculating on every render
  const itemsByQuadrant = useMemo(() => {
    const result: Record<number, typeof state.spawnedItems> = { 0: [], 1: [], 2: [], 3: [] };
    state.spawnedItems.forEach(item => {
      const q = item.quadrant ?? 0;
      result[q].push(item);
    });
    return result;
  }, [state.spawnedItems]);
  
  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={true}
        scrollEventThrottle={16}
      >
      {/* Phase title only - no dots */}
      <Text style={styles.phaseTitle}>
        {['', 'The Spawn', 'The Origin', 'The Motivation', 'The Gear-Up', 'The Craft', 'Special Powers', 'Customs Interview', 'Passport Stamped/Cookout Invite'][state.phase]}
      </Text>
      
      {/* Placement mode indicator */}
      {placementMode && (
        <View style={{ backgroundColor: '#D4AF37', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'center', marginBottom: 4 }}>
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: 'bold', textAlign: 'center' }}>
            📍 Tap on the avatar to place your {placementMode === 'uniform' ? 'class outfit' : placementMode === 'gear' ? 'occupation gear' : placementMode === 'crest' ? 'coat of arms' : 'entire image'}
          </Text>
        </View>
      )}
      
      {/* Avatar preview - tap to open color palette (or place outfit) */}
      <TouchableOpacity 
        activeOpacity={placementMode ? 0.9 : 0.7}
        onPress={(evt) => {
          if (placementMode) {
            const { locationX, locationY } = evt.nativeEvent;
            const svgScale = 0.35;
            const svgPixelWidth = SVG_WIDTH * svgScale;   // 140
            const svgPixelHeight = SVG_HEIGHT * svgScale;  // 367.5
            
            // Container is centered with padding:10, borderWidth:2
            // locationX/Y is relative to the TouchableOpacity (which wraps the container)
            // The SVG is centered inside the container via alignItems:'center'
            // Calculate SVG's left offset within the container
            const containerPadding = 10;
            const containerBorder = 2;
            const containerInnerWidth = SCREEN_WIDTH - 40 - (containerPadding + containerBorder) * 2; // marginHorizontal:20 each side
            const svgLeftOffset = (containerInnerWidth - svgPixelWidth) / 2 + containerPadding + containerBorder;
            const svgTopOffset = containerPadding + containerBorder;
            
            // Convert touch point to SVG coordinates
            const svgX = (locationX - svgLeftOffset) / svgScale;
            const svgY = (locationY - svgTopOffset) / svgScale;
            
            // Clamp to SVG bounds
            const clampedX = Math.max(0, Math.min(SVG_WIDTH, svgX));
            const clampedY = Math.max(0, Math.min(SVG_HEIGHT, svgY));
            
            const raceParams = getRaceBodyParams(state.recipe.race, state.recipe.gender);
            const defaultCenterY = raceParams.torsoY + 60;
            const offX = clampedX - 200;
            const offY = clampedY - defaultCenterY;
            
            if (placementMode === 'uniform') {
              setState(prev => ({
                ...prev,
                recipe: { ...prev.recipe, uniformOffsetX: offX, uniformOffsetY: offY },
              }));
            } else if (placementMode === 'gear') {
              setState(prev => ({
                ...prev,
                recipe: { ...prev.recipe, gearOffsetX: offX, gearOffsetY: offY },
              }));
            } else if (placementMode === 'crest') {
              const crestOffX = svgX - 200;
              const crestOffY = svgY - 295;
              setState(prev => ({
                ...prev,
                recipe: { ...prev.recipe, crestOffsetX: crestOffX, crestOffsetY: crestOffY },
              }));
            } else if (placementMode === 'all') {
              // Move everything: offset from SVG center (200, SVG_HEIGHT/2)
              const allOffX = svgX - 200;
              const allOffY = svgY - SVG_HEIGHT / 2;
              setState(prev => ({
                ...prev,
                recipe: { ...prev.recipe, allOffsetX: allOffX, allOffsetY: allOffY },
              }));
            }
            setPlacementMode(null);
          } else {
            setShowColorPalette(true);
          }
        }}
      >
        <View style={styles.avatarContainer} {...itemPanResponder.panHandlers}>
          <Svg 
            width={SVG_WIDTH * 0.35} 
            height={SVG_HEIGHT * 0.35} 
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          >
            <Defs>
              {/* Dynamic gradients for each color region */}
              {AVATAR_COLOR_REGIONS.map((region: { id: string; name: string }) => (
                <LinearGradient key={`grad-${region.id}`} id={`${region.id}Gradient`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor={state.recipe.colors[region.id] || '#888'} stopOpacity="1" />
                  <Stop offset="100%" stopColor={adjustColor(state.recipe.colors[region.id] || '#888', -20)} stopOpacity="1" />
                </LinearGradient>
              ))}
            <RadialGradient id="auraGradient" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={state.recipe.auraParams.color1} stopOpacity="0.8" />
              <Stop offset="100%" stopColor={state.recipe.auraParams.color2} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          
          {/* ============================================================ */}
          {/* COAT OF ARMS: Center (big) + 4 Corners (small)               */}
          {/* 5-Shield Layout with Canonical Quadrants                     */}
          {/* ============================================================ */}
          
          {/* Shield gradients - uses recipe.colors.shieldPrimary/shieldSecondary */}
          <Defs>
            <LinearGradient id="shieldRedGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={state.recipe.colors.shieldPrimary || '#E53935'} stopOpacity="0.95" />
              <Stop offset="35%" stopColor={state.recipe.colors.shieldPrimary || '#C62828'} stopOpacity="0.9" />
              <Stop offset="50%" stopColor={state.recipe.colors.shieldSecondary || '#B71C1C'} stopOpacity="0.85" />
              <Stop offset="65%" stopColor={state.recipe.colors.shieldPrimary || '#C62828'} stopOpacity="0.9" />
              <Stop offset="100%" stopColor={state.recipe.colors.shieldSecondary || '#7F0000'} stopOpacity="0.95" />
            </LinearGradient>
            <LinearGradient id="shieldMetalBorder" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#A0A0A0" />
              <Stop offset="25%" stopColor="#707070" />
              <Stop offset="50%" stopColor="#C0C0C0" />
              <Stop offset="75%" stopColor="#707070" />
              <Stop offset="100%" stopColor="#505050" />
            </LinearGradient>
          </Defs>
          
          {/* Master offset: moves entire image (avatar + crest + gear) */}
          <G transform={`translate(${state.recipe.allOffsetX || 0}, ${state.recipe.allOffsetY || 0})`}>
          
          {/* CENTER BIG COAT OF ARMS SHIELD */}
          {state.spawnedItems.length > 0 && (
            <G opacity={0.25} transform={`translate(${state.recipe.crestOffsetX || 0}, ${state.recipe.crestOffsetY || 0})`}>
              {/* Outer metallic border - TAPPABLE for metal color */}
              <Path 
                d="M200,30 L360,80 L360,320 Q360,480 200,560 Q40,480 40,320 L40,80 Z"
                fill="url(#shieldMetalBorder)"
                stroke={selectedRegion === 'shieldSecondary' ? '#FFD700' : '#404040'}
                strokeWidth={selectedRegion === 'shieldSecondary' ? 4 : 2}
                onPress={() => {
                  setSelectedRegion('shieldSecondary');
                  setShowColorPalette(true);
                }}
              />
              {/* Inner shield - TAPPABLE for color */}
              <Path 
                d="M200,45 L345,90 L345,315 Q345,465 200,540 Q55,465 55,315 L55,90 Z"
                fill="url(#shieldRedGradient)"
                stroke={selectedRegion === 'shieldPrimary' ? '#FFD700' : '#606060'}
                strokeWidth={selectedRegion === 'shieldPrimary' ? 3 : 1}
                onPress={() => {
                  setSelectedRegion('shieldPrimary');
                  setShowColorPalette(true);
                }}
              />
              {/* Quadrant divider lines */}
              <Line x1="200" y1="60" x2="200" y2="530" stroke="#8B0000" strokeWidth="2" opacity="0.5" />
              <Line x1="65" y1="295" x2="335" y2="295" stroke="#8B0000" strokeWidth="2" opacity="0.5" />
              {/* Inner gold trim */}
              <Path 
                d="M200,55 L335,97 L335,310 Q335,455 200,525 Q65,455 65,310 L65,97 Z"
                fill="none"
                stroke="#D4AF37"
                strokeWidth="1.5"
                opacity="0.6"
              />
            </G>
          )}
          
          {/* 4 CORNER MINI SHIELDS - same quadrants, same items */}
          {state.spawnedItems.length > 0 && (
            <G opacity={0.12}>
              {/* Corner positions matching reference image layout */}
              {[
                { cx: 55, cy: 75, scale: 0.13 },   // Upper-left (slightly smaller)
                { cx: 345, cy: 75, scale: 0.13 },  // Upper-right
                { cx: 55, cy: 525, scale: 0.13 },  // Lower-left
                { cx: 345, cy: 525, scale: 0.13 }, // Lower-right
              ].map((corner, ci) => (
                <G key={`corner-shield-${ci}`} transform={`translate(${corner.cx}, ${corner.cy}) scale(${corner.scale}) translate(-200, -295)`}>
                  {/* Outer metallic border */}
                  <Path 
                    d="M200,30 L360,80 L360,320 Q360,480 200,560 Q40,480 40,320 L40,80 Z"
                    fill="url(#shieldMetalBorder)"
                    stroke="#404040"
                    strokeWidth="6"
                  />
                  {/* Inner red shield */}
                  <Path 
                    d="M200,45 L345,90 L345,315 Q345,465 200,540 Q55,465 55,315 L55,90 Z"
                    fill="url(#shieldRedGradient)"
                    stroke="#606060"
                    strokeWidth="3"
                  />
                  {/* Quadrant divider lines */}
                  <Line x1="200" y1="60" x2="200" y2="530" stroke="#8B0000" strokeWidth="6" opacity="0.5" />
                  <Line x1="65" y1="295" x2="335" y2="295" stroke="#8B0000" strokeWidth="6" opacity="0.5" />
                  {/* Inner gold trim */}
                  <Path 
                    d="M200,55 L335,97 L335,310 Q335,455 200,525 Q65,455 65,310 L65,97 Z"
                    fill="none"
                    stroke="#D4AF37"
                    strokeWidth="4"
                    opacity="0.6"
                  />
                </G>
              ))}
            </G>
          )}
          
          {/* CENTER COAT OF ARMS ITEMS - canonical 4 quadrant layout */}
          {state.spawnedItems.length > 0 && (
            <G>
              {[0, 1, 2, 3].map(quadrantIndex => {
                const quadrantItems = itemsByQuadrant[quadrantIndex];
                const quadrant = CANONICAL.quadrants[quadrantIndex];
                
                return quadrantItems.map((item, stackIndex) => {
                  const itemColors = itemPathColors[item.id] || {};
                  const baseScale = CANONICAL.itemToQuadrantScale;
                  const scale = quadrantItems.length > 1 ? baseScale * 0.7 : baseScale;
                  const stackOffset = stackIndex * 25;
                  
                  return (
                    <G 
                      key={`coat-${item.id}`}
                      transform={`translate(${quadrant.x + stackOffset}, ${quadrant.y + stackOffset}) scale(${scale}) translate(-${CANONICAL.itemCenter.x}, -${CANONICAL.itemCenter.y})`}
                      opacity={0.45}
                    >
                      {item.paths.map((d, pi) => {
                        const baseColor = itemColors[pi] || '#8B7355';
                        const washedColor = washOutColor(baseColor, 0.5);
                        return (
                          <Path 
                            key={`coat-${item.id}-${pi}`} 
                            d={d}
                            fill={washedColor}
                            stroke={washOutColor('#5C4033', 0.4)}
                            strokeWidth="6"
                            onPress={() => handleItemPathTap(item.id, pi)}
                          />
                        );
                      })}
                    </G>
                  );
                });
              })}
            </G>
          )}
          
          {/* 4 CORNER MINI COAT OF ARMS ITEMS */}
          {state.spawnedItems.length > 0 && (
            <G>
              {[
                { cx: 55, cy: 75, scale: 0.13 },   // Upper-left
                { cx: 345, cy: 75, scale: 0.13 },  // Upper-right  
                { cx: 55, cy: 525, scale: 0.13 },  // Lower-left
                { cx: 345, cy: 525, scale: 0.13 }, // Lower-right
              ].map((corner, ci) => (
                <G key={`corner-items-${ci}`}>
                  {[0, 1, 2, 3].map(quadrantIndex => {
                    const quadrantItems = itemsByQuadrant[quadrantIndex];
                    const quadrant = CANONICAL.quadrants[quadrantIndex];
                    
                    return quadrantItems.map((item, stackIndex) => {
                      const itemColors = itemPathColors[item.id] || {};
                      // Corner scale matches shield scale
                      const cornerScale = CANONICAL.itemToQuadrantScale * corner.scale;
                      const scale = quadrantItems.length > 1 ? cornerScale * 0.7 : cornerScale;
                      const stackOffset = stackIndex * 4; // Smaller offset for corners
                      
                      return (
                        <G 
                          key={`corner-${ci}-coat-${item.id}`}
                          transform={`translate(${corner.cx}, ${corner.cy}) scale(${corner.scale}) translate(${quadrant.x + stackOffset - 200}, ${quadrant.y + stackOffset - 295}) scale(${CANONICAL.itemToQuadrantScale / corner.scale}) translate(-${CANONICAL.itemCenter.x}, -${CANONICAL.itemCenter.y})`}
                          opacity={0.3}
                        >
                          {item.paths.map((d, pi) => {
                            const baseColor = itemColors[pi] || '#8B7355';
                            const washedColor = washOutColor(baseColor, 0.5);
                            return (
                              <Path 
                                key={`corner-${ci}-coat-${item.id}-${pi}`} 
                                d={d}
                                fill={washedColor}
                                stroke={washOutColor('#5C4033', 0.3)}
                                strokeWidth="10"
                                onPress={() => handleItemPathTap(item.id, pi)}
                              />
                            );
                          })}
                        </G>
                      );
                    });
                  })}
                </G>
              ))}
            </G>
          )}
          
          {/* Aura (phase 5+) - animated pulse */}
          {!state.recipe.auraHidden && state.phase >= 5 && (() => {
            const ap = state.recipe.auraParams;
            const speed = ap.pulseSpeed || 1;
            const intensity = ap.intensity || 0.5;
            const aOpacity = 0.3 + Math.abs(Math.sin(auraPhase * speed)) * 0.7 * intensity;
            const aScale = 0.85 + Math.abs(Math.sin(auraPhase * speed * 0.7)) * 0.2 * intensity;
            const auraPaths = generateAura(ap);
            return (
              <G transform={`translate(${200 * (1 - aScale)}, ${400 * (1 - aScale)}) scale(${aScale})`}>
                {/* Outer glow layer — thick, low opacity */}
                {auraPaths.map((d, i) => (
                  <Path
                    key={`aura-glow-${i}`}
                    d={d}
                    stroke={i % 3 === 0 ? ap.color2 : ap.color1}
                    strokeWidth={6 + aOpacity * 4}
                    fill={d.includes('Z') ? (i % 2 === 0 ? ap.color1 : ap.color2) : 'none'}
                    fillOpacity={d.includes('Z') ? aOpacity * 0.08 : 0}
                    opacity={aOpacity * 0.3}
                    strokeLinecap="round"
                  />
                ))}
                {/* Inner core layer — medium, higher opacity */}
                {auraPaths.map((d, i) => (
                  <Path
                    key={`aura-core-${i}`}
                    d={d}
                    stroke={i % 2 === 0 ? ap.color1 : ap.color2}
                    strokeWidth={3 + aOpacity * 2}
                    fill={d.includes('Z') ? (i % 2 === 0 ? ap.color2 : ap.color1) : 'none'}
                    fillOpacity={d.includes('Z') ? aOpacity * 0.15 : 0}
                    opacity={aOpacity * (0.5 + (i % 4) * 0.12)}
                    strokeLinecap="round"
                  />
                ))}
              </G>
            );
          })()}
          
          {/* Colorable silhouette paths - TAP-TO-FILL coloring book style */}
          {/* Hidden when user chose "Skip Avatar" - only crest shows */}
          {/* Scaled by race - giants are bigger, sprites are tiny */}
          {/* Centered in viewBox regardless of size */}
          {!state.recipe.avatarHidden && (() => {
            const raceScale = getRaceVisualScale(state.recipe.race);
            // Center point of the viewBox
            const centerX = 200;
            const centerY = 400;
            // Scale from center so avatar stays centered
            const offsetX = centerX * (1 - raceScale);
            const offsetY = centerY * (1 - raceScale);
            
            return (
              <G transform={`translate(${offsetX}, ${offsetY}) scale(${raceScale})`}>
                {state.colorablePaths.map((cp, i) => {
                  // Priority: 1) per-path override, 2) region color from recipe, 3) white default
                  const regionColor = state.recipe.colors[cp.region];
                  const fillColor = pathColors[i] || regionColor || '#FFFFFF';
                  const strokeColor = state.recipe.colors.outline || '#333333';
                  return (
                    <Path 
                      key={`body-${i}`} 
                      d={cp.d} 
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={1.5 / raceScale}
                      onPress={() => handlePathTap(i)}
                    />
                  );
                })}
              </G>
            );
          })()}
          
          {/* BANG CENSOR - Comic book style explosion covering private area */}
          {/* Only shows for human race, tap to change colors, text is user's nickname */}
          {!state.recipe.avatarHidden && state.recipe.race === 'human' && (() => {
            const raceScale = getRaceVisualScale(state.recipe.race);
            const centerX = 200;
            const centerY = 400;
            const offsetX = centerX * (1 - raceScale);
            const offsetY = centerY * (1 - raceScale);
            
            // Position at groin area (Y ~620-680 in silhouette coords)
            const bangX = 200;
            const bangY = 640;
            const bangScale = 0.8;
            
            return (
              <G transform={`translate(${offsetX}, ${offsetY}) scale(${raceScale})`}>
                <G transform={`translate(${bangX}, ${bangY}) scale(${bangScale})`}>
                  {/* Outer explosion spikes - TAPPABLE for accent color */}
                  <Path
                    d="M0,-70 L15,-45 L40,-55 L35,-30 L60,-25 L40,-10 L55,10 L30,5 L25,30 L10,15 L0,40 L-10,15 L-25,30 L-30,5 L-55,10 L-40,-10 L-60,-25 L-35,-30 L-40,-55 L-15,-45 Z"
                    fill={state.recipe.colors.bangOuter || '#FF4500'}
                    stroke="#000"
                    strokeWidth="3"
                    onPress={() => {
                      setSelectedRegion('bangOuter');
                      setShowColorPalette(true);
                    }}
                  />
                  {/* Middle explosion layer - TAPPABLE for secondary color */}
                  <Path
                    d="M0,-50 L12,-32 L30,-40 L25,-20 L45,-18 L30,-5 L40,8 L22,3 L18,22 L7,10 L0,28 L-7,10 L-18,22 L-22,3 L-40,8 L-30,-5 L-45,-18 L-25,-20 L-30,-40 L-12,-32 Z"
                    fill={state.recipe.colors.bangMiddle || '#FFA500'}
                    stroke="#000"
                    strokeWidth="2"
                    onPress={() => {
                      setSelectedRegion('bangMiddle');
                      setShowColorPalette(true);
                    }}
                  />
                  {/* Inner explosion - TAPPABLE for primary color */}
                  <Path
                    d="M0,-35 L8,-22 L22,-28 L18,-14 L32,-12 L20,-3 L28,6 L15,2 L12,16 L5,7 L0,20 L-5,7 L-12,16 L-15,2 L-28,6 L-20,-3 L-32,-12 L-18,-14 L-22,-28 L-8,-22 Z"
                    fill={state.recipe.colors.bangInner || '#FFD700'}
                    stroke="#000"
                    strokeWidth="1.5"
                    onPress={() => {
                      setSelectedRegion('bangInner');
                      setShowColorPalette(true);
                    }}
                  />
                  {/* Dots around edge for comic effect */}
                  {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(angle => {
                    const rad = angle * Math.PI / 180;
                    const r = 52;
                    return (
                      <Circle
                        key={`dot-${angle}`}
                        cx={Math.cos(rad) * r}
                        cy={Math.sin(rad) * r}
                        r="4"
                        fill={state.recipe.colors.bangDots || '#FF0000'}
                      />
                    );
                  })}
                  {/* Nickname text - comic book style */}
                  <SvgText
                    x="0"
                    y="5"
                    textAnchor="middle"
                    fontSize="18"
                    fontWeight="bold"
                    fill="#000"
                    stroke="#FFF"
                    strokeWidth="0.5"
                  >
                    {state.recipe.bangNickname || 'BANG!'}
                  </SvgText>
                </G>
              </G>
            );
          })()}
          
          {/* FEMALE CHEST BANGs - Two smaller explosions covering bust area */}
          {!state.recipe.avatarHidden && state.recipe.race === 'human' && state.recipe.gender === 'female' && (() => {
            const raceScale = getRaceVisualScale(state.recipe.race);
            const centerX = 200;
            const centerY = 400;
            const offsetX = centerX * (1 - raceScale);
            const offsetY = centerY * (1 - raceScale);
            const chestBangScale = 0.55;
            
            // Left bust BANG at ~(155, 385), Right bust BANG at ~(245, 385)
            return (
              <G transform={`translate(${offsetX}, ${offsetY}) scale(${raceScale})`}>
                {[-1, 1].map(side => {
                  const bangX = 200 + side * 45;
                  const bangY = 385;
                  return (
                    <G key={`chest-bang-${side}`} transform={`translate(${bangX}, ${bangY}) scale(${chestBangScale})`}>
                      <Path
                        d="M0,-70 L15,-45 L40,-55 L35,-30 L60,-25 L40,-10 L55,10 L30,5 L25,30 L10,15 L0,40 L-10,15 L-25,30 L-30,5 L-55,10 L-40,-10 L-60,-25 L-35,-30 L-40,-55 L-15,-45 Z"
                        fill={state.recipe.colors.bangOuter || '#FF4500'}
                        stroke="#000"
                        strokeWidth="3"
                        onPress={() => {
                          setSelectedRegion('bangOuter');
                          setShowColorPalette(true);
                        }}
                      />
                      <Path
                        d="M0,-50 L12,-32 L30,-40 L25,-20 L45,-18 L30,-5 L40,8 L22,3 L18,22 L7,10 L0,28 L-7,10 L-18,22 L-22,3 L-40,8 L-30,-5 L-45,-18 L-25,-20 L-30,-40 L-12,-32 Z"
                        fill={state.recipe.colors.bangMiddle || '#FFA500'}
                        stroke="#000"
                        strokeWidth="2"
                        onPress={() => {
                          setSelectedRegion('bangMiddle');
                          setShowColorPalette(true);
                        }}
                      />
                      <Path
                        d="M0,-35 L8,-22 L22,-28 L18,-14 L32,-12 L20,-3 L28,6 L15,2 L12,16 L5,7 L0,20 L-5,7 L-12,16 L-15,2 L-28,6 L-20,-3 L-32,-12 L-18,-14 L-22,-28 L-8,-22 Z"
                        fill={state.recipe.colors.bangInner || '#FFD700'}
                        stroke="#000"
                        strokeWidth="1.5"
                        onPress={() => {
                          setSelectedRegion('bangInner');
                          setShowColorPalette(true);
                        }}
                      />
                      {[0, 60, 120, 180, 240, 300].map(angle => {
                        const rad = angle * Math.PI / 180;
                        return (
                          <Circle
                            key={`chest-dot-${side}-${angle}`}
                            cx={Math.cos(rad) * 42}
                            cy={Math.sin(rad) * 42}
                            r="3"
                            fill={state.recipe.colors.bangDots || '#FF0000'}
                          />
                        );
                      })}
                      <SvgText
                        x="0"
                        y="5"
                        textAnchor="middle"
                        fontSize="14"
                        fontWeight="bold"
                        fill="#000"
                        stroke="#FFF"
                        strokeWidth="0.5"
                      >
                        {side === -1
                          ? (state.recipe.bangNicknameChestL || 'POW!')
                          : (state.recipe.bangNicknameChestR || 'ZAP!')}
                      </SvgText>
                    </G>
                  );
                })}
              </G>
            );
          })()}
          
          {/* CLASS UNIFORM - renders on top of body when class is selected */}
          {/* Now uses the SAME centering transform as the body so it aligns for all races */}
          {!state.recipe.uniformHidden && state.recipe.class && CLASS_UNIFORMS[state.recipe.class] && (() => {
            const raceParams = getRaceBodyParams(state.recipe.race, state.recipe.gender);
            const humanBaseline = getRaceBodyParams('human', 'male');
            const raceScale = getRaceVisualScale(state.recipe.race);
            
            // Body centering transform (must match body's transform exactly)
            const bodyCenterX = 200;
            const bodyCenterY = 400;
            const bodyOffX = bodyCenterX * (1 - raceScale);
            const bodyOffY = bodyCenterY * (1 - raceScale);
            
            // Uniform paths have shoulders at Y=180
            const uniformShoulderY = 180;
            const avatarShoulderY = raceParams.torsoY;
            const shiftY = avatarShoulderY - uniformShoulderY;
            
            // Scale uniform to match race body proportions (relative to human baseline)
            const uniformScaleX = raceParams.shoulderWidth / humanBaseline.shoulderWidth;
            const uniformScaleY = raceParams.torsoScale;
            
            // Pivot for uniform scaling (in body-local coords, before body centering)
            const pivotX = 200;
            const pivotY = avatarShoulderY + 60;
            
            const uOffX = state.recipe.uniformOffsetX || 0;
            const uOffY = state.recipe.uniformOffsetY || 0;
            return (
              <G transform={`translate(${bodyOffX}, ${bodyOffY}) scale(${raceScale})`}>
                <G transform={`translate(${pivotX * (1 - uniformScaleX) + uOffX}, ${shiftY + pivotY * (1 - uniformScaleY) + uOffY}) scale(${uniformScaleX}, ${uniformScaleY})`}>
                  {CLASS_UNIFORMS[state.recipe.class].svgPaths.map((d, i) => {
                    const uniform = CLASS_UNIFORMS[state.recipe.class];
                    const uniformColor = uniformPathColors[i] ?? (
                      i === 0 ? (state.recipe.colors.primary || uniform.primaryColor) :
                      i === 1 ? (state.recipe.colors.secondary || uniform.secondaryColor) :
                      (state.recipe.colors.accent || uniform.accentColor)
                    );
                    return (
                      <Path
                        key={`uniform-${i}`}
                        d={d}
                        fill={uniformColor}
                        stroke="#222222"
                        strokeWidth={1.5 / raceScale}
                        onPress={() => handleUniformPathTap(i)}
                      />
                    );
                  })}
                </G>
              </G>
            );
          })()}
          
          {/* OCCUPATION GEAR - renders on top of uniform */}
          {/* Uses same body centering transform so gear aligns with body for all races */}
          {!state.recipe.gearHidden && state.recipe.occupation && OCCUPATION_GEAR[state.recipe.occupation] && (() => {
            const raceParams = getRaceBodyParams(state.recipe.race, state.recipe.gender);
            const humanBaseline = getRaceBodyParams('human', 'male');
            const raceScale = getRaceVisualScale(state.recipe.race);
            
            // Body centering transform (must match body's transform exactly)
            const bodyCenterX = 200;
            const bodyCenterY = 400;
            const bodyOffX = bodyCenterX * (1 - raceScale);
            const bodyOffY = bodyCenterY * (1 - raceScale);
            
            const uniformShoulderY = 180;
            const avatarShoulderY = raceParams.torsoY;
            const shiftY = avatarShoulderY - uniformShoulderY;
            
            const gearScaleX = raceParams.shoulderWidth / humanBaseline.shoulderWidth;
            const gearScaleY = raceParams.torsoScale;
            
            const pivotX = 200;
            const pivotY = avatarShoulderY + 60;
            
            const gOffX = state.recipe.gearOffsetX || 0;
            const gOffY = state.recipe.gearOffsetY || 0;
            return (
              <G transform={`translate(${bodyOffX}, ${bodyOffY}) scale(${raceScale})`}>
                <G transform={`translate(${pivotX * (1 - gearScaleX) + gOffX}, ${shiftY + pivotY * (1 - gearScaleY) + gOffY}) scale(${gearScaleX}, ${gearScaleY})`}>
                  {OCCUPATION_GEAR[state.recipe.occupation].svgPaths.map((d, i) => {
                    const gear = OCCUPATION_GEAR[state.recipe.occupation];
                    const gearColor = occupationPathColors[i] ?? (
                      i === 0 ? (state.recipe.colors.primary || '#8B7355') :
                      i === 1 ? (state.recipe.colors.secondary || '#6B5335') :
                      (state.recipe.colors.accent || '#8B7355')
                    );
                    return (
                      <Path
                        key={`occupation-${i}`}
                        d={d}
                        fill={gearColor}
                        stroke="#222222"
                        strokeWidth={1 / raceScale}
                        onPress={() => handleOccupationPathTap(i)}
                      />
                    );
                  })}
                </G>
              </G>
            );
          })()}
          
          {/* User strokes (finger painting) */}
          {state.recipe.strokes.map((stroke, i) => (
            <Path
              key={`stroke-${i}`}
              d={strokeToPath(stroke)}
              stroke={stroke.color}
              strokeWidth={stroke.width}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          </G>{/* end master offset */}
        </Svg>
        
        {/* Liveness indicator */}
        <View style={styles.livenessIndicator}>
          <View style={[
            styles.livenessBar,
            { width: `${state.livenessScore}%` },
            state.passedLivenessCheck ? styles.livenessBarPassed : styles.livenessBarPending,
          ]} />
          <Text style={styles.livenessText}>
            {state.passedLivenessCheck ? '✓ Human Verified' : `Liveness: ${state.livenessScore}%`}
          </Text>
        </View>
        
        {/* CUTE PET - small on avatar's left shoulder */}
        {!state.recipe.petHidden && state.recipe.animal && (
          <View style={styles.petOnShoulder}>
            {ANIMAL_SPIRITS[state.recipe.animal] ? (
              <Svg width={45} height={55} viewBox="50 20 320 500">
                {ANIMAL_SPIRITS[state.recipe.animal].svgPaths.map((d, i) => {
                  const spirit = ANIMAL_SPIRITS[state.recipe.animal];
                  const petColor = petPathColors[i] ?? (
                    i === 0 ? spirit.primaryColor :
                    i === 1 ? spirit.secondaryColor :
                    '#FFFFFF'
                  );
                  return (
                    <Path
                      key={`pet-${i}`}
                      d={d}
                      fill={petColor}
                      stroke="#333333"
                      strokeWidth="3"
                      onPress={() => handlePetPathTap(i)}
                    />
                  );
                })}
              </Svg>
            ) : (
              /* Fallback: cute generic pet silhouette for animals not in ANIMAL_SPIRITS */
              <Svg width={45} height={55} viewBox="0 0 80 90">
                {/* Round body */}
                <Ellipse cx="40" cy="55" rx="28" ry="25" fill={petPathColors[0] || '#DEB887'} stroke="#333" strokeWidth="1.5" onPress={() => handlePetPathTap(0)} />
                {/* Round head */}
                <Circle cx="40" cy="28" r="20" fill={petPathColors[1] || '#F5DEB3'} stroke="#333" strokeWidth="1.5" onPress={() => handlePetPathTap(1)} />
                {/* Left ear */}
                <Path d="M25,15 Q20,2 28,8 Q32,12 28,18 Z" fill={petPathColors[2] || '#DEB887'} stroke="#333" strokeWidth="1" />
                {/* Right ear */}
                <Path d="M55,15 Q60,2 52,8 Q48,12 52,18 Z" fill={petPathColors[2] || '#DEB887'} stroke="#333" strokeWidth="1" />
                {/* Eyes */}
                <Circle cx="33" cy="25" r="4" fill="#333" />
                <Circle cx="47" cy="25" r="4" fill="#333" />
                <Circle cx="34" cy="24" r="1.5" fill="#FFF" />
                <Circle cx="48" cy="24" r="1.5" fill="#FFF" />
                {/* Nose */}
                <Ellipse cx="40" cy="32" rx="3" ry="2" fill="#FF69B4" />
                {/* Mouth */}
                <Path d="M37,35 Q40,38 43,35" fill="none" stroke="#333" strokeWidth="1" />
                {/* Tiny paws */}
                <Circle cx="22" cy="75" r="5" fill={petPathColors[0] || '#DEB887'} stroke="#333" strokeWidth="1" />
                <Circle cx="58" cy="75" r="5" fill={petPathColors[0] || '#DEB887'} stroke="#333" strokeWidth="1" />
                {/* Tail */}
                <Path d="M65,55 Q75,45 70,35" fill="none" stroke={petPathColors[0] || '#DEB887'} strokeWidth="3" strokeLinecap="round" />
              </Svg>
            )}
            <Text style={{ fontSize: 8, color: '#4A3728', textAlign: 'center', marginTop: 2 }}>{state.recipe.animal}</Text>
          </View>
        )}
      </View>
      </TouchableOpacity>
      
      {/* Color Palette Button - reliable way to open palette */}
      <TouchableOpacity 
        style={styles.colorPaletteButton}
        onPress={() => setShowColorPalette(true)}
      >
        <Text style={styles.colorPaletteButtonText}>🎨 Colors</Text>
      </TouchableOpacity>
      {/* Crest hint - only show when shield is visible and no region selected yet */}
      {state.spawnedItems.length > 0 && !selectedRegion && (
        <Text style={{ fontSize: 11, color: '#8B7355', textAlign: 'center', marginTop: 2, marginBottom: 4, fontStyle: 'italic' }}>
          💡 Tap the metal border or inner shield on the crest to color it
        </Text>
      )}
      
      {/* Spawned Items List - tap to select, controls to manipulate */}
      {state.spawnedItems.length > 0 && (
        <View style={styles.itemListContainer}>
          {state.spawnedItems.map(item => (
            <View key={item.id} style={styles.itemChipWrapper}>
              <TouchableOpacity
                style={[
                  styles.itemChip,
                  item.rarity === 'legendary' ? styles.itemChipLegendary :
                  item.rarity === 'rare' ? styles.itemChipRare :
                  item.rarity === 'uncommon' ? styles.itemChipUncommon :
                  styles.itemChipCommon,
                  item.locked ? styles.itemChipLocked : styles.itemChipUnlocked,
                ]}
                onPress={() => setSelectedItemId(item.id)}
              >
                <Text style={styles.itemChipText}>
                  {item.locked ? '🔒 ' : ''}
                  {item.keyword}
                  {item.rarity !== 'common' && ` ✨`}
                </Text>
              </TouchableOpacity>
              {/* Delete button */}
              <TouchableOpacity
                style={styles.itemDeleteBtn}
                onPress={() => {
                  setState(prev => ({
                    ...prev,
                    spawnedItems: prev.spawnedItems.filter(i => i.id !== item.id),
                  }));
                  if (selectedItemId === item.id) setSelectedItemId(null);
                }}
              >
                <Text style={styles.itemDeleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      
      {/* Item controls - show when item selected */}
      {selectedItemId && (
        <View style={styles.itemControlsContainer}>
          {/* Scale controls */}
          <View style={styles.itemControlRow}>
            <Text style={styles.itemControlLabel}>Size</Text>
            <TouchableOpacity
              style={styles.itemControlButton}
              onPress={() => handleItemScale(selectedItemId, -0.1)}
            >
              <Text style={styles.itemControlText}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.itemControlButton}
              onPress={() => handleItemScale(selectedItemId, 0.1)}
            >
              <Text style={styles.itemControlText}>+</Text>
            </TouchableOpacity>
          </View>
          
          {/* Rotation controls */}
          <View style={styles.itemControlRow}>
            <Text style={styles.itemControlLabel}>Rotate</Text>
            <TouchableOpacity
              style={styles.itemControlButton}
              onPress={() => handleItemRotate(selectedItemId, -15)}
            >
              <Text style={styles.itemControlText}>↺</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.itemControlButton}
              onPress={() => handleItemRotate(selectedItemId, 15)}
            >
              <Text style={styles.itemControlText}>↻</Text>
            </TouchableOpacity>
          </View>
          
          {/* Angle presets */}
          <View style={styles.itemControlRow}>
            <Text style={styles.itemControlLabel}>Angle</Text>
            {[0, 45, 90, 180, 270].map(angle => (
              <TouchableOpacity
                key={angle}
                style={styles.itemAngleButton}
                onPress={() => handleItemSetRotation(selectedItemId, angle)}
              >
                <Text style={styles.itemAngleText}>{angle}°</Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Flip controls */}
          <View style={styles.itemControlRow}>
            <Text style={styles.itemControlLabel}>Flip</Text>
            <TouchableOpacity
              style={styles.itemControlButton}
              onPress={() => handleItemFlipX(selectedItemId)}
            >
              <Text style={styles.itemControlText}>⇆</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.itemControlButton}
              onPress={() => handleItemFlipY(selectedItemId)}
            >
              <Text style={styles.itemControlText}>⇅</Text>
            </TouchableOpacity>
          </View>
          
          {/* Done button */}
          <TouchableOpacity
            style={[styles.itemControlButton, styles.itemControlButtonDone]}
            onPress={() => {
              handleItemLock(selectedItemId);
              setSelectedItemId(null);
            }}
          >
            <Text style={styles.itemControlTextDone}>✓ Done</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Phase content */}
      <View 
        style={styles.content} 
      >
        {renderPhaseContent()}
      </View>
      </ScrollView>
      
      {/* Navigation */}
      <View style={styles.navigation}>
        {state.phase > 1 && (
          <TouchableOpacity style={styles.navButton} onPress={prevPhase}>
            <Text style={styles.navButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        
        {/* Hide/Show toggles for avatar elements */}
        {state.phase >= 2 && state.phase <= 6 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexShrink: 1, maxWidth: SCREEN_WIDTH * 0.55 }}>
          <View style={styles.hideToggleRow}>
            {/* Crest Only Mode - hides body, keeps uniform + gear + pet + crest */}
            <TouchableOpacity 
              style={[styles.hideToggle, styles.hideToggleCrest, state.recipe.avatarHidden && styles.hideToggleActive]} 
              onPress={() => setState(prev => ({
                ...prev,
                recipe: { ...prev.recipe, avatarHidden: !prev.recipe.avatarHidden },
              }))}
            >
              <Text style={[styles.hideToggleText, state.recipe.avatarHidden && styles.hideToggleTextActive]}>
                {state.recipe.avatarHidden ? '🛡️' : '👤'}
              </Text>
              <Text style={styles.hideToggleLabel}>
                {state.recipe.avatarHidden ? 'Crest' : 'Body'}
              </Text>
            </TouchableOpacity>
            
            {/* Tap-to-place crest */}
            {state.spawnedItems.length > 0 && (
              <TouchableOpacity 
                style={[styles.hideToggle, placementMode === 'crest' && { backgroundColor: '#D4AF37' }]} 
                onPress={() => setPlacementMode(placementMode === 'crest' ? null : 'crest')}
              >
                <Text style={[styles.hideToggleText, placementMode === 'crest' && { color: '#FFF' }]}>
                  {placementMode === 'crest' ? '📍 Tap' : '🛡️📍'}
                </Text>
              </TouchableOpacity>
            )}
            
            {/* Move entire image */}
            <TouchableOpacity 
              style={[styles.hideToggle, placementMode === 'all' && { backgroundColor: '#D4AF37' }]} 
              onPress={() => {
                if (placementMode === 'all') {
                  setPlacementMode(null);
                } else {
                  setPlacementMode('all');
                }
              }}
            >
              <Text style={[styles.hideToggleText, placementMode === 'all' && { color: '#FFF' }]}>
                {placementMode === 'all' ? '📍 Tap to center' : '↔️ Move'}
              </Text>
            </TouchableOpacity>
            
            {/* GPS Center - reset all positions neatly */}
            <TouchableOpacity 
              style={[styles.hideToggle, { minWidth: 44, backgroundColor: '#2E7D32' }]} 
              onPress={() => setState(prev => ({
                ...prev,
                recipe: { 
                  ...prev.recipe, 
                  allOffsetX: 0, allOffsetY: 0, 
                  uniformOffsetX: 0, uniformOffsetY: 0, 
                  gearOffsetX: 0, gearOffsetY: 0, 
                  crestOffsetX: 0, crestOffsetY: 0,
                },
              }))}
            >
              <Text style={[styles.hideToggleText, { color: '#FFF' }]}>📌</Text>
              <Text style={{ fontSize: 7, color: '#FFF' }}>Center</Text>
            </TouchableOpacity>
            
            {state.recipe.class && (
              <TouchableOpacity 
                style={[styles.hideToggle, state.recipe.uniformHidden && styles.hideToggleActive]} 
                onPress={() => setState(prev => ({
                  ...prev,
                  recipe: { ...prev.recipe, uniformHidden: !prev.recipe.uniformHidden },
                }))}
              >
                <Text style={[styles.hideToggleText, state.recipe.uniformHidden && styles.hideToggleTextActive]}>
                  {state.recipe.uniformHidden ? '👕 ✗' : '👕'}
                </Text>
              </TouchableOpacity>
            )}
            
            {/* Tap-to-place uniform */}
            {state.recipe.class && !state.recipe.uniformHidden && (
              <TouchableOpacity 
                style={[styles.hideToggle, placementMode === 'uniform' && { backgroundColor: '#D4AF37' }]} 
                onPress={() => setPlacementMode(placementMode === 'uniform' ? null : 'uniform')}
              >
                <Text style={[styles.hideToggleText, placementMode === 'uniform' && { color: '#FFF' }]}>
                  {placementMode === 'uniform' ? '📍 Tap avatar' : '📍 Place'}
                </Text>
              </TouchableOpacity>
            )}
            
            {state.recipe.occupation && (
              <TouchableOpacity 
                style={[styles.hideToggle, state.recipe.gearHidden && styles.hideToggleActive]} 
                onPress={() => setState(prev => ({
                  ...prev,
                  recipe: { ...prev.recipe, gearHidden: !prev.recipe.gearHidden },
                }))}
              >
                <Text style={[styles.hideToggleText, state.recipe.gearHidden && styles.hideToggleTextActive]}>
                  {state.recipe.gearHidden ? '🛠️ ✗' : '🛠️'}
                </Text>
              </TouchableOpacity>
            )}
            
            {/* Tap-to-place gear */}
            {state.recipe.occupation && !state.recipe.gearHidden && (
              <TouchableOpacity 
                style={[styles.hideToggle, placementMode === 'gear' && { backgroundColor: '#D4AF37' }]} 
                onPress={() => setPlacementMode(placementMode === 'gear' ? null : 'gear')}
              >
                <Text style={[styles.hideToggleText, placementMode === 'gear' && { color: '#FFF' }]}>
                  {placementMode === 'gear' ? '📍 Tap avatar' : '📍 Place'}
                </Text>
              </TouchableOpacity>
            )}
            
            {state.recipe.animal && (
              <TouchableOpacity 
                style={[styles.hideToggle, state.recipe.petHidden && styles.hideToggleActive]} 
                onPress={() => setState(prev => ({
                  ...prev,
                  recipe: { ...prev.recipe, petHidden: !prev.recipe.petHidden },
                }))}
              >
                <Text style={[styles.hideToggleText, state.recipe.petHidden && styles.hideToggleTextActive]}>
                  {state.recipe.petHidden ? '🐾 ✗' : '🐾'}
                </Text>
              </TouchableOpacity>
            )}
            
            {state.phase >= 5 && (
              <TouchableOpacity 
                style={[styles.hideToggle, state.recipe.auraHidden && styles.hideToggleActive]} 
                onPress={() => setState(prev => ({
                  ...prev,
                  recipe: { ...prev.recipe, auraHidden: !prev.recipe.auraHidden },
                }))}
              >
                <Text style={[styles.hideToggleText, state.recipe.auraHidden && styles.hideToggleTextActive]}>
                  {state.recipe.auraHidden ? '✨ ✗' : '✨'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          </ScrollView>
        )}
        
        {state.phase < 8 && (
        <TouchableOpacity 
          style={[styles.navButton, styles.navButtonPrimary]} 
          onPress={nextPhase}
        >
          <Text style={[styles.navButtonText, styles.navButtonTextPrimary]}>
            Continue
          </Text>
        </TouchableOpacity>
        )}
      </View>
      
      {/* Jitter indicator (debug) */}
      <View style={styles.jitterIndicator}>
        <Text style={styles.jitterText}>
          Samples: {state.jitterSamples.length}
        </Text>
      </View>
      
      {/* Item Preview Modal */}
      {showItemPreview && previewItem && (
        <Modal visible={true} transparent={true} animationType="fade" onRequestClose={cancelItemPreview}>
          <Pressable style={styles.previewModalOverlay} onPress={cancelItemPreview}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <ScrollView 
                style={{ maxHeight: SCREEN_HEIGHT * 0.8 }}
                contentContainerStyle={{ alignItems: 'center' }}
                showsVerticalScrollIndicator={true}
                bounces={false}
              >
                <View style={styles.previewModalContent}>
            <Text style={styles.previewModalTitle}>New Item: {previewItem.keyword}</Text>
            
            {/* Preview SVG - white background, centered item using canonical coords */}
            <View style={styles.previewSvgContainer}>
              <Svg width={140} height={160} viewBox="50 50 300 500">
                {/* White background rect */}
                <Rect x="50" y="50" width="300" height="500" fill="#FFFFFF" />
                <G transform={`translate(${CANONICAL.itemCenter.x},${CANONICAL.itemCenter.y}) rotate(${previewRotation}) scale(${previewScale * 0.35}) translate(-${CANONICAL.itemCenter.x},-${CANONICAL.itemCenter.y})`}>
                  {previewItem.paths.map((d, i) => (
                    <Path 
                      key={`preview-${i}`} 
                      d={d} 
                      fill={previewPathColors[i] || '#E8E8E8'}
                      stroke={previewSelectedPart === i ? '#FFD700' : '#333333'}
                      strokeWidth={previewSelectedPart === i ? 5 : 3}
                      onPress={() => handlePreviewPathTap(i)}
                    />
                  ))}
                </G>
              </Svg>
            </View>
            
            {/* Color hint */}
            <Text style={styles.previewColorHint}>Tap item parts to color</Text>
            
            {/* Current color indicator */}
            <View style={styles.currentColorRow}>
              <Text style={styles.currentColorLabel}>Selected:</Text>
              <View style={[styles.currentColorSwatch, { backgroundColor: selectedColor }]} />
            </View>
            
            {/* Selected part indicator */}
            {previewSelectedPart !== null && (
              <View style={[styles.currentColorRow, { backgroundColor: '#4A90D9', borderRadius: 8, padding: 6 }]}>
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Part #{previewSelectedPart + 1} selected - tap a color</Text>
              </View>
            )}
            
            {/* Mini color palette for preview */}
            <View style={styles.previewPaletteRow}>
              {COLOR_PALETTE.map((color, i) => (
                <TouchableOpacity
                  key={`preview-color-${i}`}
                  style={[
                    styles.previewColorSwatch,
                    { backgroundColor: color },
                    selectedColor === color && styles.previewColorSwatchSelected,
                  ]}
                  onPress={() => {
                    setSelectedColor(color);
                    // Fill preview path if one is selected
                    if (previewSelectedPart !== null) {
                      fillPreviewPart(color);
                    }
                  }}
                />
              ))}
            </View>
            
            {/* Rotation controls */}
            <View style={styles.previewControlRow}>
              <Text style={styles.previewControlLabel}>Rotate</Text>
              <TouchableOpacity style={styles.previewControlBtn} onPress={() => setPreviewRotation(r => r - 15)}>
                <Text style={styles.previewControlBtnText}>↺</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.previewControlBtn} onPress={() => setPreviewRotation(r => r + 15)}>
                <Text style={styles.previewControlBtnText}>↻</Text>
              </TouchableOpacity>
            </View>
            
            {/* Angle presets */}
            <View style={styles.previewControlRow}>
              {[0, 45, 90, 180, 270].map(angle => (
                <TouchableOpacity 
                  key={angle} 
                  style={[styles.previewAngleBtn, previewRotation === angle && styles.previewAngleBtnActive]}
                  onPress={() => setPreviewRotation(angle)}
                >
                  <Text style={styles.previewAngleBtnText}>{angle}°</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Scale controls */}
            <View style={styles.previewControlRow}>
              <Text style={styles.previewControlLabel}>Size</Text>
              <TouchableOpacity style={styles.previewControlBtn} onPress={() => setPreviewScale(s => Math.max(0.3, s - 0.1))}>
                <Text style={styles.previewControlBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.previewScaleText}>{(previewScale * 100).toFixed(0)}%</Text>
              <TouchableOpacity style={styles.previewControlBtn} onPress={() => setPreviewScale(s => Math.min(2.0, s + 0.1))}>
                <Text style={styles.previewControlBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            
            {/* Action buttons */}
            <View style={styles.previewActionRow}>
              <TouchableOpacity style={styles.previewCancelBtn} onPress={cancelItemPreview}>
                <Text style={styles.previewCancelBtnText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.previewPlaceBtn} onPress={placePreviewItem}>
                <Text style={styles.previewPlaceBtnText}>Add to Coat</Text>
              </TouchableOpacity>
            </View>
          </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}
      
      {/* Color Palette Modal - tap avatar to open */}
      <Modal
        visible={showColorPalette}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowColorPalette(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowColorPalette(false)}>
          <View style={styles.colorModalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.colorModalContent}>
                <View style={styles.colorModalHeader}>
                  <Text style={styles.colorModalTitle}>🎨 Color Your Avatar</Text>
                  <TouchableOpacity onPress={() => setShowColorPalette(false)}>
                    <Text style={styles.colorModalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Selected region indicator */}
                {selectedRegion && (
                  <View style={styles.colorModalSelectedBanner}>
                    <Text style={styles.colorModalSelectedText}>
                      Coloring: {AVATAR_COLOR_REGIONS.find((r: { id: string }) => r.id === selectedRegion)?.name || selectedRegion}
                    </Text>
                  </View>
                )}
                
                {/* Selected path indicator (for body/uniform/item) */}
                {selectedPath && (
                  <View style={[styles.colorModalSelectedBanner, { backgroundColor: '#4A90D9' }]}>
                    <Text style={styles.colorModalSelectedText}>
                      Tap a color to fill {selectedPath.type} part #{selectedPath.index + 1}
                    </Text>
                  </View>
                )}
                
                {/* Region selector */}
                <Text style={styles.colorModalLabel}>Tap a region:</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  style={styles.colorRegionScroll}
                  contentContainerStyle={{ paddingRight: 20 }}
                >
                  {AVATAR_COLOR_REGIONS.map((region: { id: string; name: string }) => (
                    <TouchableOpacity
                      key={region.id}
                      style={[
                        styles.colorRegionChip,
                        selectedRegion === region.id && styles.colorRegionChipSelected,
                      ]}
                      onPress={() => setSelectedRegion(region.id)}
                    >
                      <View style={[
                        styles.colorRegionPreviewDot, 
                        { backgroundColor: state.recipe.colors[region.id] || '#DDD' }
                      ]} />
                      <Text style={[
                        styles.colorRegionChipText,
                        selectedRegion === region.id && styles.colorRegionChipTextSelected,
                      ]}>{region.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                
                {/* Color grid */}
                <Text style={styles.colorModalLabel}>Pick a color:</Text>
                <ScrollView style={{ maxHeight: 280 }}>
                  <View style={styles.colorModalGrid}>
                    {[
                      // Skin tones
                      '#FFDFC4', '#F0C8A0', '#D4A574', '#8D5524', '#5C3A1E', '#3B1F0B',
                      // Warm browns
                      '#FFE4B5', '#F5DEB3', '#DEB887', '#CD853F', '#8B4513', '#5D3A1A',
                      // Reds/oranges
                      '#FFD700', '#FFA500', '#FF6347', '#DC143C', '#8B0000', '#4A0000',
                      // Greens
                      '#98FB98', '#32CD32', '#228B22', '#006400', '#2F4F4F', '#1A1A1A',
                      // Blues
                      '#87CEEB', '#4169E1', '#0000CD', '#00008B', '#4B0082', '#2E0854',
                      // Purples/pinks
                      '#DDA0DD', '#DA70D6', '#9932CC', '#8B008B', '#FF69B4', '#C71585',
                      // Grays
                      '#FFFFFF', '#D3D3D3', '#A9A9A9', '#696969', '#404040', '#000000',
                    ].map((color, idx) => (
                      <TouchableOpacity
                        key={`modal-color-${idx}`}
                        style={[
                          styles.colorModalSwatch,
                          { backgroundColor: color },
                          state.recipe.colors[selectedRegion || ''] === color && styles.colorModalSwatchSelected,
                        ]}
                        onPress={() => {
                          setCurrentColor(color);
                          // Fill semantic region (skin, hair, etc.)
                          if (selectedRegion) {
                            // Clear per-path overrides for this region
                            setPathColors(prev => {
                              const cleaned = { ...prev };
                              state.colorablePaths.forEach((cp, i) => {
                                if (cp.region === selectedRegion && cleaned[i]) {
                                  delete cleaned[i];
                                }
                              });
                              return cleaned;
                            });
                            setState(prev => ({
                              ...prev,
                              recipe: {
                                ...prev.recipe,
                                colors: { ...prev.recipe.colors, [selectedRegion]: color },
                              },
                            }));
                          }
                          // Fill SVG path (body, uniform, item, etc.)
                          if (selectedPath) {
                            fillSelectedPath(color);
                          }
                        }}
                      />
                    ))}
                  </View>
                </ScrollView>
                
                <TouchableOpacity 
                  style={styles.colorModalDoneBtn}
                  onPress={() => setShowColorPalette(false)}
                >
                  <Text style={styles.colorModalDoneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
    </KeyboardAvoidingView>
  );
}

// ============================================================================
// PHASE COMPONENTS
// ============================================================================

function PhaseSpawn({ recipe, onNameChange, onRaceSelect, onGenderSelect, onHairStyleSelect, onBangNicknameChange, onBangNicknameChestLChange, onBangNicknameChestRChange, onRecoveryRequest }: {
  recipe: AvatarRecipe;
  onNameChange: (v: string) => void;
  onRaceSelect: (v: string) => void;
  onGenderSelect: (v: 'male' | 'female') => void;
  onHairStyleSelect: (v: string) => void;
  onBangNicknameChange: (v: string) => void;
  onBangNicknameChestLChange: (v: string) => void;
  onBangNicknameChestRChange: (v: string) => void;
  onHairBangNicknameChange: (v: string) => void;
  onRecoveryRequest?: () => void;
}) {
  return (
    <View style={styles.phaseContent}>
      {/* Name input */}
      <Text style={styles.label}>Your name, traveler?</Text>
      <TextInput
        style={styles.input}
        value={recipe.name}
        onChangeText={onNameChange}
        placeholder="Enter your name..."
        placeholderTextColor="#8B7355"
        returnKeyType="done"
        blurOnSubmit={true}
        onSubmitEditing={Keyboard.dismiss}
      />
      
      {/* BANG nickname - only for human */}
      {recipe.race === 'human' && (
        <>
          <Text style={[styles.label, { marginTop: 15 }]}>💥 What's the nickname of your unmentionables?</Text>
          <TextInput
            style={[styles.input, { textAlign: 'center', fontWeight: 'bold' }]}
            value={recipe.bangNickname}
            onChangeText={onBangNicknameChange}
            placeholder="BANG!"
            placeholderTextColor="#8B7355"
            returnKeyType="done"
            blurOnSubmit={true}
            maxLength={12}
          />
          <Text style={styles.hint}>This text appears on the censor graphic</Text>
          
          {/* Chest BANGs - female only */}
          {recipe.gender === 'female' && (
            <>
              <Text style={[styles.hint, { marginTop: 10, marginBottom: 2, fontWeight: 'bold' }]}>⬅️ Left chest</Text>
              <TextInput
                style={[styles.input, { textAlign: 'center', fontWeight: 'bold' }]}
                value={recipe.bangNicknameChestL}
                onChangeText={onBangNicknameChestLChange}
                placeholder="POW!"
                placeholderTextColor="#8B7355"
                returnKeyType="done"
                blurOnSubmit={true}
                maxLength={12}
              />
              <Text style={[styles.hint, { marginTop: 10, marginBottom: 2, fontWeight: 'bold' }]}>➡️ Right chest</Text>
              <TextInput
                style={[styles.input, { textAlign: 'center', fontWeight: 'bold' }]}
                value={recipe.bangNicknameChestR}
                onChangeText={onBangNicknameChestRChange}
                placeholder="ZAP!"
                placeholderTextColor="#8B7355"
                returnKeyType="done"
                blurOnSubmit={true}
                maxLength={12}
              />
            </>
          )}
        </>
      )}
      
      {/* Race Selection - horizontal swipe per category */}
      <Text style={[styles.label, { marginTop: 20 }]}>Choose your form:</Text>
      
      {/* Gender Toggle */}
      <View style={styles.genderToggleRow}>
        <TouchableOpacity 
          style={[styles.genderBtn, recipe.gender === 'male' && styles.genderBtnActive]}
          onPress={() => onGenderSelect('male')}
        >
          <Text style={[styles.genderBtnText, recipe.gender === 'male' && styles.genderBtnTextActive]}>♂ Male</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.genderBtn, recipe.gender === 'female' && styles.genderBtnActive]}
          onPress={() => onGenderSelect('female')}
        >
          <Text style={[styles.genderBtnText, recipe.gender === 'female' && styles.genderBtnTextActive]}>♀ Female</Text>
        </TouchableOpacity>
      </View>
      
      {/* Hair Style Selector */}
      <Text style={[styles.label, { marginTop: 15, marginBottom: 8 }]}>💇 Hairstyle:</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 10, gap: 8 }}
      >
        {[
          // Unisex/Wild
          { id: 'spikes', emoji: '⚡', label: 'Spikes' },
          { id: 'afro', emoji: '☁️', label: 'Afro' },
          { id: 'mohawk', emoji: '🦅', label: 'Mohawk' },
          { id: 'flowing', emoji: '🌊', label: 'Flowing' },
          { id: 'tentacles', emoji: '🐙', label: 'Tentacles' },
          { id: 'sculptural', emoji: '🗿', label: 'Sculptural' },
          { id: 'punk', emoji: '🎸', label: 'Punk' },
          { id: 'crown', emoji: '👑', label: 'Crown' },
          // Feminine
          { id: 'bouffant', emoji: '💁', label: 'Bouffant' },
          { id: 'pageboy', emoji: '💇‍♀️', label: 'Pageboy' },
          { id: 'beehive', emoji: '🐝', label: 'Beehive' },
          { id: 'pigtails', emoji: '🎀', label: 'Pigtails' },
          { id: 'buns', emoji: '🍡', label: 'SpaceBuns' },
          { id: 'waves', emoji: '〰️', label: 'Waves' },
          { id: 'bangs', emoji: '✂️', label: 'Bangs' },
          { id: 'updo', emoji: '💃', label: 'Updo' },
          // Special
          { id: 'wild', emoji: '🌀', label: 'Random' },
          { id: 'bald', emoji: '🥚', label: 'Bald' },
        ].map(style => (
          <TouchableOpacity
            key={style.id}
            style={[
              styles.hairStyleBtn,
              recipe.hairStyle === style.id && styles.hairStyleBtnActive
            ]}
            onPress={() => onHairStyleSelect(style.id)}
          >
            <Text style={styles.hairStyleEmoji}>{style.emoji}</Text>
            <Text style={[
              styles.hairStyleLabel,
              recipe.hairStyle === style.id && styles.hairStyleLabelActive
            ]}>{style.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      <Text style={styles.hint}>← Swipe each row to see more races →</Text>
      
      {ALL_RACES.map(category => (
        <View key={category.category} style={styles.raceCategoryContainer}>
          <Text style={styles.raceCategoryLabel}>{category.category}</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.raceScrollContent}
          >
            {category.races.map(race => (
              <TouchableOpacity
                key={race}
                style={[styles.raceCardSmall, recipe.race === race && styles.raceCardSmallSelected]}
                onPress={() => onRaceSelect(race)}
              >
                <Text style={styles.raceEmoji}>{getRaceEmoji(race)}</Text>
                <Text style={[styles.raceLabelSmall, recipe.race === race && styles.raceLabelSelected]}>{race}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ))}
      
      {/* Recovery Option */}
      {onRecoveryRequest && (
        <TouchableOpacity style={styles.recoveryLink} onPress={onRecoveryRequest}>
          <Text style={styles.recoveryLinkText}>Recover existing wallet →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Get emoji for race
function getRaceEmoji(race: string): string {
  const emojiMap: Record<string, string> = {
    // Common
    'human': '👤', 'elf': '🧝', 'dwarf': '⛏️', 'halfling': '🦶', 'gnome': '🎩',
    // Exotic  
    'darkelf': '🌑', 'orc': '👹', 'troll': '🧌', 'alien': '👽',
    // Mystical
    'ethereal': '👻', 'fae': '🧚', 'sprite': '✨', 'elemental': '🌊', 'phoenix': '🔥',
    // Monstrous
    'beast': '🐺', 'mutant': '☢️', 'dragonkin': '🐉', 'werewolf': '🐺', 'vampire': '🧛',
    // Legendary
    'angel': '👼', 'golem': '🗿', 'undead': '💀', 'giant': '🦣', 'merfolk': '🧜', 'centaur': '🐴', 'cyborg': '🤖',
  };
  return emojiMap[race] || '👤';
}

function PhaseOrigin({ recipe, onStoryChange, onMemoryChange, parsedKeywords }: {
  recipe: AvatarRecipe;
  onStoryChange: (v: string) => void;
  onMemoryChange: (v: string) => void;
  parsedKeywords: string[];
}) {
  const [showKeywordPicker, setShowKeywordPicker] = useState(false);
  
  // Common keywords that spawn items
  const keywordCategories = [
    { name: '⚔️ Weapons', items: ['sword', 'axe', 'bow', 'staff', 'dagger', 'spear', 'hammer', 'scythe'] },
    { name: '🛡️ Armor', items: ['shield', 'helmet', 'armor', 'gauntlet', 'cloak', 'boots'] },
    { name: '💎 Magic', items: ['crystal', 'gem', 'amulet', 'ring', 'crown', 'orb'] },
    { name: '🌿 Nature', items: ['flower', 'tree', 'vine', 'leaf', 'mushroom'] },
    { name: '🐺 Creatures', items: ['wolf', 'dragon', 'phoenix', 'eagle', 'lion', 'snake'] },
    { name: '✨ Effects', items: ['fire', 'ice', 'lightning', 'shadow', 'holy', 'poison'] },
  ];
  
  const insertKeyword = (keyword: string) => {
    const currentStory = recipe.originStory || '';
    const newStory = currentStory + (currentStory ? ' ' : '') + keyword;
    onStoryChange(newStory);
    setShowKeywordPicker(false);
  };
  
  return (
    <View style={styles.phaseContent}>
      <Text style={styles.label}>Tell your origin story...</Text>
      <Text style={styles.hint}>Type your story or tap + to add items</Text>
      
      <View style={styles.storyInputRow}>
        <TextInput
          style={[styles.input, styles.textArea, { flex: 1 }]}
          value={recipe.originStory}
          onChangeText={onStoryChange}
          placeholder="I was forged in the flames of..."
          placeholderTextColor="#8B7355"
          multiline
          numberOfLines={4}
          blurOnSubmit={false}
          returnKeyType="default"
        />
        <TouchableOpacity 
          style={styles.keywordPickerBtn}
          onPress={() => setShowKeywordPicker(!showKeywordPicker)}
        >
          <Text style={styles.keywordPickerBtnText}>{showKeywordPicker ? '✕' : '+'}</Text>
        </TouchableOpacity>
      </View>
      
      {/* Keyword picker dropdown */}
      {showKeywordPicker && (
        <View style={styles.keywordPickerDropdown}>
          <Text style={styles.keywordPickerTitle}>Tap to add item:</Text>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {keywordCategories.map(cat => (
              <View key={cat.name} style={styles.keywordCategoryRow}>
                <Text style={styles.keywordCategoryName}>{cat.name}</Text>
                <View style={styles.keywordCategoryItems}>
                  {cat.items.map(item => (
                    <TouchableOpacity 
                      key={item}
                      style={styles.keywordPickerItem}
                      onPress={() => insertKeyword(item)}
                    >
                      <Text style={styles.keywordPickerItemText}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
      
      <Text style={styles.label}>Your formative memory:</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={recipe.formativeMemory}
        onChangeText={onMemoryChange}
        placeholder="The day I found my golden sword..."
        placeholderTextColor="#8B7355"
        multiline
        numberOfLines={4}
        blurOnSubmit={false}
        returnKeyType="default"
      />
      
      {parsedKeywords.length > 0 && (
        <View style={styles.keywordContainer}>
          <Text style={styles.keywordLabel}>Detected items:</Text>
          <View style={styles.keywordList}>
            {parsedKeywords.map(kw => (
              <View key={kw} style={styles.keywordChip}>
                <Text style={styles.keywordText}>{kw}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// PHASE 3: SCENARIOS - Simplified: 2 required + 1 optional
// ============================================================================
function PhaseScenarios({ 
  recipe, 
  onDesireChange, 
  onDescriptionChange,
  onVoiceLineChange,
}: {
  recipe: AvatarRecipe;
  onDesireChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onVoiceLineChange: (v: string) => void;
}) {
  return (
    <ScrollView style={styles.phaseContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Text style={styles.scenarioIntro}>
        Tell us about your character. You'll be asked to recognize your answers later.
      </Text>
      
      <Text style={styles.label}>🔥 What drives your character forward?</Text>
      <Text style={styles.hint}>Their core motivation - revenge, love, justice, freedom...</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={recipe.scenarioDesire}
        onChangeText={onDesireChange}
        placeholder="I fight for..."
        placeholderTextColor="#8B7355"
        multiline
        numberOfLines={2}
        blurOnSubmit={false}
      />
      
      <Text style={styles.label}>📝 Describe your character</Text>
      <Text style={styles.hint}>Appearance, personality, vibe - a few words is fine</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={recipe.characterDescription}
        onChangeText={onDescriptionChange}
        placeholder="A scarred warrior with a gentle heart..."
        placeholderTextColor="#8B7355"
        multiline
        numberOfLines={3}
        blurOnSubmit={false}
      />
      
      <View style={styles.optionalDivider}>
        <Text style={styles.optionalLabel}>✨ OPTIONAL - Bonus XP</Text>
      </View>
      
      <Text style={styles.label}>🗣️ Your catchphrase</Text>
      <Text style={styles.hint}>What do they say in battle or triumph?</Text>
      <TextInput
        style={styles.input}
        value={recipe.voiceLine}
        onChangeText={onVoiceLineChange}
        placeholder='"Victory belongs to the bold!"'
        placeholderTextColor="#8B7355"
        returnKeyType="done"
        blurOnSubmit={true}
        onSubmitEditing={Keyboard.dismiss}
      />
    </ScrollView>
  );
}

function PhaseGearUp({ recipe, onClassChange, onOccupationChange, onAnimalChange }: {
  recipe: AvatarRecipe;
  onClassChange: (v: string) => void;
  onOccupationChange: (v: string) => void;
  onAnimalChange: (v: string) => void;
}) {
  // Expanded classes matching CLASS_UNIFORMS from keyword_dictionary_draggable
  const classes = Object.keys(CLASS_UNIFORMS);
  
  // Expanded occupations matching OCCUPATION_GEAR
  const occupations = Object.keys(OCCUPATION_GEAR);
  
  // All 36 cute baby pet spirit animals - organized by category
  const animalCategories = [
    { name: '🐾 Classic Pets', animals: ['Wolf', 'Cat', 'Dog', 'Bunny', 'Hamster'] },
    { name: '🦅 Birds', animals: ['Eagle', 'Owl', 'Raven', 'Parrot', 'Penguin'] },
    { name: '✨ Mythical', animals: ['Dragon', 'Phoenix', 'Unicorn', 'Fairy'] },
    { name: '🌲 Forest', animals: ['Fox', 'Deer', 'Bear', 'Squirrel', 'Raccoon'] },
    { name: '🐠 Aquatic', animals: ['Fish', 'Turtle', 'Dolphin', 'Octopus', 'Seahorse'] },
    { name: '🦁 Exotic', animals: ['Lion', 'Tiger', 'Panda', 'Monkey', 'Elephant'] },
    { name: '🦋 Small Critters', animals: ['Snake', 'Frog', 'Butterfly', 'Bee', 'Ladybug'] },
    { name: '🐨 Special', animals: ['Koala', 'Sloth', 'Hedgehog'] },
  ];
  
  // Get uniform/gear preview for selected options
  const selectedClassUniform = CLASS_UNIFORMS[recipe.class];
  const selectedOccupationGear = OCCUPATION_GEAR[recipe.occupation];
  const selectedAnimalSpirit = ANIMAL_SPIRITS[recipe.animal];
  
  return (
    <ScrollView style={styles.phaseContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Text style={styles.label}>Choose your class:</Text>
      <Text style={styles.hint}>Your class defines your combat stance and uniform</Text>
      <View style={styles.optionGrid}>
        {classes.map(c => (
          <TouchableOpacity
            key={c}
            style={[styles.optionCard, recipe.class === c && styles.optionCardSelected]}
            onPress={() => onClassChange(c)}
          >
            <Text style={styles.optionText}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {selectedClassUniform && (
        <View style={styles.gearPreview}>
          <Text style={styles.gearPreviewLabel}>Weapon: {selectedClassUniform.weapon} | Armor: {selectedClassUniform.torso}</Text>
        </View>
      )}
      
      <Text style={styles.label}>Your occupation:</Text>
      <Text style={styles.hint}>Your trade provides tools and props</Text>
      <View style={styles.optionGrid}>
        {occupations.map(o => (
          <TouchableOpacity
            key={o}
            style={[styles.optionCard, recipe.occupation === o && styles.optionCardSelected]}
            onPress={() => onOccupationChange(o)}
          >
            <Text style={styles.optionText}>{o}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {selectedOccupationGear && (
        <View style={styles.gearPreview}>
          <Text style={styles.gearPreviewLabel}>Tools: {selectedOccupationGear.tools?.join(', ')}</Text>
        </View>
      )}
      
      <Text style={styles.label}>🐾 Your Spirit Companion:</Text>
      <Text style={styles.hint}>Pick a cute baby pet! You can color it in the preview window. Optional — tap again to deselect.</Text>
      
      {recipe.animal ? (
        <TouchableOpacity
          style={[styles.optionCard, { backgroundColor: '#5C1A1A', borderColor: '#FF6B6B', marginBottom: 8 }]}
          onPress={() => onAnimalChange('')}
        >
          <Text style={{ color: '#FF6B6B', fontWeight: 'bold', textAlign: 'center' }}>✗ Remove Spirit Animal</Text>
        </TouchableOpacity>
      ) : null}
      
      {animalCategories.map(category => (
        <View key={category.name} style={styles.animalCategoryContainer}>
          <Text style={styles.animalCategoryLabel}>{category.name}</Text>
          <View style={styles.petGrid}>
            {category.animals.map(a => (
              <TouchableOpacity
                key={a}
                style={[styles.petCard, recipe.animal === a && styles.petCardSelected]}
                onPress={() => onAnimalChange(recipe.animal === a ? '' : a)}
              >
                <Text style={styles.petEmoji}>{getPetEmoji(a)}</Text>
                <Text style={styles.petName}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
      {recipe.animal && (
        <View style={styles.petPreview}>
          <Text style={styles.petPreviewEmoji}>{getPetEmoji(recipe.animal)}</Text>
          <Text style={styles.petPreviewName}>{recipe.animal} will be your loyal companion!</Text>
        </View>
      )}
    </ScrollView>
  );
}

// Get emoji for pet
function getPetEmoji(pet: string): string {
  const emojiMap: Record<string, string> = {
    // Classic pets
    'Wolf': '🐺', 'Cat': '🐱', 'Dog': '🐶', 'Bunny': '🐰', 'Hamster': '🐹',
    // Birds
    'Eagle': '🦅', 'Owl': '🦉', 'Raven': '🐦‍⬛', 'Parrot': '🦜', 'Penguin': '🐧',
    // Mythical
    'Dragon': '🐲', 'Phoenix': '🔥', 'Unicorn': '🦄', 'Fairy': '🧚',
    // Forest
    'Fox': '🦊', 'Deer': '🦌', 'Bear': '🐻', 'Squirrel': '🐿️', 'Raccoon': '🦝',
    // Aquatic
    'Fish': '🐠', 'Turtle': '🐢', 'Dolphin': '🐬', 'Octopus': '🐙', 'Seahorse': '🐴',
    // Exotic
    'Lion': '🦁', 'Tiger': '🐯', 'Panda': '🐼', 'Monkey': '🐵', 'Elephant': '🐘',
    // Small critters
    'Snake': '🐍', 'Frog': '🐸', 'Butterfly': '🦋', 'Bee': '🐝', 'Ladybug': '🐞',
    // Special
    'Koala': '🐨', 'Sloth': '🦥', 'Hedgehog': '🦔',
  };
  return emojiMap[pet] || '🐾';
}

function PhaseCraft({ recipe, selectedRegion, currentColor, colorMixHistory, onRegionSelect, onColorChange, onColorApply, onColorMix }: {
  recipe: AvatarRecipe;
  selectedRegion: string | null;
  currentColor: string;
  colorMixHistory: ColorMix[];
  onRegionSelect: (r: string | null) => void;
  onColorChange: (c: string) => void;
  onColorApply: (region: string, color: string) => void;
  onColorMix: (mix: ColorMix) => void;
}) {
  // Color palette state
  const [activePalette, setActivePalette] = useState<keyof typeof COLOR_PALETTES>('skin');
  const [mixColor1, setMixColor1] = useState<string | null>(null);
  const [mixColor2, setMixColor2] = useState<string | null>(null);
  
  // Avatar colorable regions - simplified for tap-to-fill (MEMOIZED)
  const colorableRegions = useMemo(() => [
    { id: 'skin', name: '👤 Skin Region', emoji: '👤' },
    { id: 'hair', name: '💇 Hair Region', emoji: '💇' },
    { id: 'eyes', name: '👁️ Eye Region', emoji: '👁️' },
    { id: 'eyebrows', name: '🤨 Brow Region', emoji: '🤨' },
    { id: 'lips', name: '👄 Lip Region', emoji: '👄' },
    { id: 'primary', name: '👕 Main Outfit', emoji: '👕' },
    { id: 'secondary', name: '👖 Secondary', emoji: '👖' },
    { id: 'accent', name: '✨ Accent', emoji: '✨' },
    { id: 'armor', name: '🛡️ Armor', emoji: '🛡️' },
    { id: 'weapon', name: '⚔️ Weapon', emoji: '⚔️' },
    { id: 'magic', name: '🔮 Magic Aura', emoji: '🔮' },
    { id: 'accessory', name: '💎 Accessory', emoji: '💎' },
    { id: 'outline', name: '✏️ Outline', emoji: '✏️' },
    { id: 'shieldPrimary', name: '🛡️ Shield Primary', emoji: '🛡️' },
    { id: 'shieldSecondary', name: '🛡️ Shield Dark', emoji: '🛡️' },
    { id: 'bangOuter', name: '💥 Bang Outer', emoji: '💥' },
    { id: 'bangMiddle', name: '💥 Bang Middle', emoji: '💥' },
    { id: 'bangInner', name: '💥 Bang Inner', emoji: '💥' },
  ], []);
  
  // Get palette for selected region
  const getPaletteForRegion = (regionId: string): keyof typeof COLOR_PALETTES => {
    const paletteMap: Record<string, keyof typeof COLOR_PALETTES> = {
      skin: 'skin', hair: 'hair', eyes: 'eyes', eyebrows: 'hair',
      lips: 'skin', primary: 'clothing', secondary: 'secondary',
      accent: 'accent', armor: 'metallic', weapon: 'metallic',
      magic: 'magic', accessory: 'accent', outline: 'outline',
      bangOuter: 'accent', bangMiddle: 'accent', bangInner: 'accent',
    };
    return paletteMap[regionId] || 'clothing';
  };
  
  // Update active palette when region changes
  useEffect(() => {
    if (selectedRegion) {
      setActivePalette(getPaletteForRegion(selectedRegion));
    }
  }, [selectedRegion]);
  
  const currentPaletteColors = COLOR_PALETTES[activePalette] || COLOR_PALETTES.clothing;
  
  // Handle color mixing
  const handleMixColors = () => {
    if (mixColor1 && mixColor2) {
      const result = mixColors(mixColor1, mixColor2, 0.5);
      onColorChange(result);
      if (selectedRegion) {
        onColorApply(selectedRegion, result);
        onColorMix({
          color1: mixColor1,
          color2: mixColor2,
          result,
          region: selectedRegion,
          timestamp: Date.now(),
        });
      }
      setMixColor1(null);
      setMixColor2(null);
    }
  };
  
  // Get color name for display
  const getColorName = (hex: string): string => {
    const colorNames: Record<string, string> = {
      '#000000': 'Black', '#FFFFFF': 'White', '#FF0000': 'Red', '#00FF00': 'Green',
      '#0000FF': 'Blue', '#FFFF00': 'Yellow', '#FF00FF': 'Magenta', '#00FFFF': 'Cyan',
      '#FFD700': 'Gold', '#8B4513': 'Brown', '#800080': 'Purple', '#FFA500': 'Orange',
    };
    return colorNames[hex.toUpperCase()] || hex;
  };
  
  return (
      <ScrollView 
        style={styles.phaseContentWarm} 
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.label}>🎨 Tap a region, then tap a color to fill:</Text>
        
        {/* Region selector - tap to select which part to color */}
        <View style={styles.regionGrid}>
          {colorableRegions.map(region => (
            <TouchableOpacity
              key={region.id}
              style={[
                styles.regionButton,
                selectedRegion === region.id && styles.regionButtonSelected,
              ]}
              onPress={() => onRegionSelect(region.id)}
            >
              <View style={[styles.regionColorPreview, { backgroundColor: recipe.colors[region.id] || '#DDD' }]} />
              <Text style={styles.regionText}>{region.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Currently selected region */}
        {selectedRegion && (
          <View style={styles.selectedRegionBanner}>
            <Text style={styles.selectedRegionText}>
              Coloring: {colorableRegions.find(r => r.id === selectedRegion)?.name || selectedRegion}
            </Text>
          </View>
        )}
        
        {/* Palette tabs */}
        <Text style={styles.label}>🎨 Color Palettes:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled={true}>
          <View style={styles.paletteTabs}>
            {(Object.keys(COLOR_PALETTES) as string[]).map((paletteName: string) => (
              <TouchableOpacity
                key={paletteName}
                style={[
                  styles.paletteTab,
                  activePalette === paletteName && styles.paletteTabActive,
                ]}
                onPress={() => setActivePalette(paletteName as keyof typeof COLOR_PALETTES)}
              >
                <Text style={[
                  styles.paletteTabText,
                  activePalette === paletteName && styles.paletteTabTextActive,
                ]}>
                  {paletteName.charAt(0).toUpperCase() + paletteName.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        
        {/* Color swatches - tap to fill selected region */}
        <Text style={styles.label}>
          {String(activePalette).charAt(0).toUpperCase() + String(activePalette).slice(1)} ({currentPaletteColors.length} colors):
        </Text>
        <View style={styles.colorGrid}>
          {currentPaletteColors.map((c: string, idx: number) => (
            <TouchableOpacity
              key={`${c}-${idx}`}
              style={[
                styles.colorSwatch,
                { backgroundColor: c },
                currentColor === c && styles.colorSwatchSelected,
              ]}
              onPress={() => {
                onColorChange(c);
                if (selectedRegion) {
                  onColorApply(selectedRegion, c);
                }
              }}
              onLongPress={() => {
                // Long press to select for mixing
                if (!mixColor1) {
                  setMixColor1(c);
                } else if (!mixColor2) {
                  setMixColor2(c);
                }
              }}
            />
          ))}
        </View>
        
        {/* Color Mixer */}
        <Text style={styles.label}>🧪 Color Mixer (long-press colors to select):</Text>
        <View style={styles.colorMixerRow}>
          <View style={[styles.mixerSwatch, { backgroundColor: mixColor1 || '#CCC' }]}>
            <Text style={styles.mixerSwatchText}>{mixColor1 ? '✓' : '1'}</Text>
          </View>
          <Text style={styles.mixerPlus}>+</Text>
          <View style={[styles.mixerSwatch, { backgroundColor: mixColor2 || '#CCC' }]}>
            <Text style={styles.mixerSwatchText}>{mixColor2 ? '✓' : '2'}</Text>
          </View>
          <Text style={styles.mixerEquals}>=</Text>
          <TouchableOpacity 
            style={[
              styles.mixerResultSwatch, 
              { backgroundColor: mixColor1 && mixColor2 ? mixColors(mixColor1, mixColor2, 0.5) : '#EEE' }
            ]}
            onPress={handleMixColors}
            disabled={!mixColor1 || !mixColor2}
          >
            <Text style={styles.mixerSwatchText}>
              {mixColor1 && mixColor2 ? 'Fill!' : '?'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.mixerResetButton}
            onPress={() => { setMixColor1(null); setMixColor2(null); }}
          >
            <Text style={styles.mixerResetText}>Clear</Text>
          </TouchableOpacity>
        </View>
        
        {/* Recent mixes for quiz */}
        {colorMixHistory.length > 0 && (
          <View style={styles.mixHistoryRow}>
            <Text style={styles.mixHistoryLabel}>Recent mixes:</Text>
            {colorMixHistory.slice(-3).map((mix, idx) => (
              <View key={idx} style={styles.mixHistoryItem}>
                <View style={[styles.miniSwatch, { backgroundColor: mix.color1 }]} />
                <Text style={styles.mixHistoryPlus}>+</Text>
                <View style={[styles.miniSwatch, { backgroundColor: mix.color2 }]} />
                <Text style={styles.mixHistoryEquals}>→</Text>
                <View style={[styles.miniSwatch, { backgroundColor: mix.result }]} />
              </View>
            ))}
          </View>
        )}
        
        {/* Quick color tools */}
        <Text style={styles.label}>🔧 Color Tools:</Text>
        <View style={styles.colorToolsRow}>
          <TouchableOpacity
            style={styles.colorToolButton}
            onPress={() => {
              const lighter = lightenColor(currentColor, 0.15);
              onColorChange(lighter);
              if (selectedRegion) onColorApply(selectedRegion, lighter);
            }}
          >
            <Text style={styles.colorToolText}>☀️ Lighter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.colorToolButton}
            onPress={() => {
              const darker = darkenColor(currentColor, 0.15);
              onColorChange(darker);
              if (selectedRegion) onColorApply(selectedRegion, darker);
            }}
          >
            <Text style={styles.colorToolText}>🌙 Darker</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.colorToolButton}
            onPress={() => {
              const saturated = saturateColor(currentColor, 0.3);
              onColorChange(saturated);
              if (selectedRegion) onColorApply(selectedRegion, saturated);
            }}
          >
            <Text style={styles.colorToolText}>🎨 Vivid</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.colorToolButton}
            onPress={() => {
              const complement = getComplementary(currentColor);
              onColorChange(complement);
              if (selectedRegion) onColorApply(selectedRegion, complement);
            }}
          >
            <Text style={styles.colorToolText}>🔄 Flip</Text>
          </TouchableOpacity>
        </View>
        
        {/* Current color preview */}
        <View style={styles.colorPreviewRow}>
          <Text style={styles.label}>Current:</Text>
          <View style={[styles.colorPreviewSwatch, { backgroundColor: currentColor }]} />
          <Text style={styles.colorPreviewText}>{currentColor}</Text>
        </View>
      </ScrollView>
  );
}

function PhaseProBet({ recipe, onPhilosophyChange, onPowerChange, onMoveChange, onAuraChange }: {
  recipe: AvatarRecipe;
  onPhilosophyChange: (v: string) => void;
  onPowerChange: (v: string) => void;
  onMoveChange: (v: string) => void;
  onAuraChange: (params: AuraParams) => void;
}) {
  const auraPatterns: AuraParams['pattern'][] = ['radial', 'flame', 'electric', 'divine'];
  
  // Pulse animation using requestAnimationFrame (no Animated API needed)
  const [pulsePhase, setPulsePhase] = useState(0);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef(Date.now());
  
  useEffect(() => {
    startTimeRef.current = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setPulsePhase(elapsed);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);
  
  // Derive animated values from pulsePhase
  const pulseOpacity = 0.2 + Math.abs(Math.sin(pulsePhase * recipe.auraParams.pulseSpeed)) * 0.6 * recipe.auraParams.intensity;
  const pulseScale = 0.85 + Math.abs(Math.sin(pulsePhase * recipe.auraParams.pulseSpeed * 0.7)) * 0.3 * recipe.auraParams.intensity;
  const glowRadius = 25 + Math.sin(pulsePhase * recipe.auraParams.pulseSpeed * 1.3) * 15 * recipe.auraParams.intensity;

  // FLAMBOYANT color theme presets
  const colorPresets: { name: string; emoji: string; color1: string; color2: string }[] = [
    { name: 'Fire', emoji: '🔥', color1: '#FF4500', color2: '#FFD700' },
    { name: 'Ice', emoji: '❄️', color1: '#00BFFF', color2: '#E0FFFF' },
    { name: 'Shadow', emoji: '🌑', color1: '#4B0082', color2: '#2F0047' },
    { name: 'Nature', emoji: '🌿', color1: '#228B22', color2: '#98FB98' },
    { name: 'Storm', emoji: '⚡', color1: '#4169E1', color2: '#87CEEB' },
    { name: 'Blood', emoji: '🩸', color1: '#8B0000', color2: '#DC143C' },
    { name: 'Solar', emoji: '☀️', color1: '#FFD700', color2: '#FFF8DC' },
    { name: 'Ocean', emoji: '🌊', color1: '#006994', color2: '#00CED1' },
    { name: 'Necrotic', emoji: '💀', color1: '#2F4F2F', color2: '#9ACD32' },
    { name: 'Sakura', emoji: '🌸', color1: '#FF69B4', color2: '#FFB7C5' },
  ];
  
  // Individual color dots for primary/secondary
  const auraDotColors = [
    '#FF0000', '#FF4500', '#FF8C00', '#FFD700', '#FFFF00',
    '#00FF00', '#228B22', '#00CED1', '#00BFFF', '#4169E1',
    '#0000FF', '#4B0082', '#8B008B', '#FF69B4', '#FF1493',
    '#FFFFFF', '#C0C0C0', '#808080', '#000000', '#8B4513',
  ];
  
  // Intensity labels
  const intensityLevels = [
    { label: 'Dim', value: 0.3, emoji: '🕯️' },
    { label: 'Glow', value: 0.6, emoji: '💡' },
    { label: 'Blaze', value: 0.85, emoji: '🔆' },
    { label: 'MAX', value: 1.0, emoji: '💥' },
  ];
  
  // Pulse speed labels
  const pulseSpeeds = [
    { label: 'Slow', value: 0.5, emoji: '🐢' },
    { label: 'Mid', value: 1.0, emoji: '🚶' },
    { label: 'Fast', value: 2.0, emoji: '🏃' },
    { label: 'WILD', value: 4.0, emoji: '⚡' },
  ];
  
  // Pattern info for thumbnails
  const patternInfo: Record<string, { emoji: string; desc: string }> = {
    radial: { emoji: '🎯', desc: 'Expanding rings' },
    flame: { emoji: '🔥', desc: 'Fire wisps' },
    electric: { emoji: '⚡', desc: 'Lightning bolts' },
    divine: { emoji: '😇', desc: 'Halo & rays' },
  };
  
  // Generate mini aura SVG preview paths
  const generateMiniAura = (pattern: AuraParams['pattern'], cx: number, cy: number, scale: number): string[] => {
    const paths: string[] = [];
    switch (pattern) {
      case 'radial':
        for (let i = 1; i <= 3; i++) {
          const r = 10 + i * 8;
          paths.push(`M${cx - r * scale},${cy} A${r * scale},${r * scale} 0 1,1 ${cx + r * scale},${cy} A${r * scale},${r * scale} 0 1,1 ${cx - r * scale},${cy}`);
        }
        break;
      case 'flame':
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const r = 20 * scale;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          paths.push(`M${cx + Math.cos(angle) * r * 0.4},${cy + Math.sin(angle) * r * 0.4} Q${x - Math.sin(angle) * 5},${y + Math.cos(angle) * 5} ${x},${y}`);
        }
        break;
      case 'electric':
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          let path = `M${cx + Math.cos(angle) * 8 * scale},${cy + Math.sin(angle) * 8 * scale}`;
          for (let s = 0; s < 3; s++) {
            const r2 = (12 + s * 8) * scale;
            const jitter = ((s % 2 === 0 ? 1 : -1) * 6) * scale;
            path += ` L${cx + Math.cos(angle) * r2 + jitter},${cy + Math.sin(angle) * r2}`;
          }
          paths.push(path);
        }
        break;
      case 'divine':
        paths.push(`M${cx - 15 * scale},${cy - 20 * scale} A${15 * scale},${5 * scale} 0 1,1 ${cx + 15 * scale},${cy - 20 * scale} A${15 * scale},${5 * scale} 0 1,1 ${cx - 15 * scale},${cy - 20 * scale}`);
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          paths.push(`M${cx + Math.cos(angle) * 12 * scale},${cy + Math.sin(angle) * 12 * scale} L${cx + Math.cos(angle) * 22 * scale},${cy + Math.sin(angle) * 22 * scale}`);
        }
        break;
    }
    return paths;
  };
  
  // Track which color dot picker is active
  const [editingColor, setEditingColor] = React.useState<'color1' | 'color2' | null>(null);
  
  return (
    <ScrollView style={styles.phaseContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={true}>
      
      {/* SIGNATURE MOVE - prominent at top with gold border */}
      <View style={{ backgroundColor: '#2A1F14', borderWidth: 2, borderColor: '#D4AF37', borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <Text style={{ color: '#D4AF37', fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 }}>⚔️ SIGNATURE MOVE ⚔️</Text>
        <TextInput
          style={[styles.input, { textAlign: 'center', fontSize: 18, fontWeight: 'bold', backgroundColor: '#1A1210', color: '#FFD700', borderColor: '#D4AF37' }]}
          value={recipe.signatureMove}
          onChangeText={onMoveChange}
          placeholder="The Thousand Petal Strike..."
          placeholderTextColor="#8B7355"
          returnKeyType="done"
          blurOnSubmit={true}
          onSubmitEditing={Keyboard.dismiss}
        />
      </View>
      
      {/* Philosophy + Power Spike */}
      <Text style={styles.label}>Your life philosophy:</Text>
      <TextInput
        style={styles.input}
        value={recipe.lifePhilosophy}
        onChangeText={onPhilosophyChange}
        placeholder="Honor above all..."
        placeholderTextColor="#8B7355"
        returnKeyType="next"
        blurOnSubmit={true}
      />
      
      <Text style={styles.label}>Your power spike:</Text>
      <TextInput
        style={styles.input}
        value={recipe.powerSpike}
        onChangeText={onPowerChange}
        placeholder="When I channel the storm..."
        placeholderTextColor="#8B7355"
        returnKeyType="next"
        blurOnSubmit={true}
      />
      
      {/* AURA PATTERN - with live SVG thumbnails */}
      <Text style={[styles.label, { marginTop: 16 }]}>✨ Aura Pattern:</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {auraPatterns.map(p => {
          const info = patternInfo[p];
          const isSelected = recipe.auraParams.pattern === p;
          return (
            <TouchableOpacity
              key={p}
              style={{
                flex: 1, minWidth: 75, backgroundColor: isSelected ? '#D4AF37' : '#2A2A2A',
                borderRadius: 10, padding: 8, alignItems: 'center', borderWidth: 2,
                borderColor: isSelected ? '#FFD700' : '#444',
              }}
              onPress={() => onAuraChange({ ...recipe.auraParams, pattern: p })}
            >
              {/* Mini SVG preview */}
              <Svg width={50} height={50} viewBox="0 0 60 60">
                {generateMiniAura(p, 30, 30, 1).map((d, i) => (
                  <Path key={`mini-${p}-${i}`} d={d} stroke={recipe.auraParams.color1} strokeWidth="1.5" fill="none" opacity="0.8" />
                ))}
                <Circle cx="30" cy="30" r="6" fill={recipe.auraParams.color2} opacity="0.4" />
              </Svg>
              <Text style={{ color: isSelected ? '#000' : '#FFF', fontSize: 10, fontWeight: 'bold', marginTop: 2 }}>{info.emoji} {p.charAt(0).toUpperCase() + p.slice(1)}</Text>
              <Text style={{ color: isSelected ? '#333' : '#888', fontSize: 8 }}>{info.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      
      {/* COLOR THEME PRESETS */}
      <Text style={styles.label}>🎨 Color Themes:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8, paddingRight: 20 }}>
          {colorPresets.map(preset => {
            const isActive = recipe.auraParams.color1 === preset.color1 && recipe.auraParams.color2 === preset.color2;
            return (
              <TouchableOpacity
                key={preset.name}
                style={{
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: isActive ? '#D4AF37' : '#2A2A2A',
                  borderWidth: 1, borderColor: isActive ? '#FFD700' : '#444',
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                }}
                onPress={() => onAuraChange({ ...recipe.auraParams, color1: preset.color1, color2: preset.color2 })}
              >
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: preset.color1, borderWidth: 1, borderColor: '#FFF' }} />
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: preset.color2, borderWidth: 1, borderColor: '#FFF' }} />
                <Text style={{ color: isActive ? '#000' : '#FFF', fontSize: 11, fontWeight: '600' }}>{preset.emoji} {preset.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      
      {/* INDIVIDUAL COLOR PICKERS - primary & secondary dots */}
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 12 }}>
        {/* Primary color */}
        <View style={{ flex: 1 }}>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}
            onPress={() => setEditingColor(editingColor === 'color1' ? null : 'color1')}
          >
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: recipe.auraParams.color1, borderWidth: 2, borderColor: editingColor === 'color1' ? '#FFD700' : '#FFF' }} />
            <Text style={{ color: '#CCC', fontSize: 12, fontWeight: '600' }}>Primary</Text>
          </TouchableOpacity>
          {editingColor === 'color1' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {auraDotColors.map((c, i) => (
                <TouchableOpacity key={`c1-${i}`} onPress={() => { onAuraChange({ ...recipe.auraParams, color1: c }); setEditingColor(null); }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c, borderWidth: recipe.auraParams.color1 === c ? 2 : 1, borderColor: recipe.auraParams.color1 === c ? '#FFD700' : '#555' }} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        {/* Secondary color */}
        <View style={{ flex: 1 }}>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}
            onPress={() => setEditingColor(editingColor === 'color2' ? null : 'color2')}
          >
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: recipe.auraParams.color2, borderWidth: 2, borderColor: editingColor === 'color2' ? '#FFD700' : '#FFF' }} />
            <Text style={{ color: '#CCC', fontSize: 12, fontWeight: '600' }}>Secondary</Text>
          </TouchableOpacity>
          {editingColor === 'color2' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {auraDotColors.map((c, i) => (
                <TouchableOpacity key={`c2-${i}`} onPress={() => { onAuraChange({ ...recipe.auraParams, color2: c }); setEditingColor(null); }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c, borderWidth: recipe.auraParams.color2 === c ? 2 : 1, borderColor: recipe.auraParams.color2 === c ? '#FFD700' : '#555' }} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
      
      {/* INTENSITY CONTROL */}
      <Text style={styles.label}>💡 Intensity:</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {intensityLevels.map(level => {
          const isActive = Math.abs(recipe.auraParams.intensity - level.value) < 0.1;
          return (
            <TouchableOpacity
              key={level.label}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
                backgroundColor: isActive ? '#D4AF37' : '#2A2A2A',
                borderWidth: 1, borderColor: isActive ? '#FFD700' : '#444',
              }}
              onPress={() => onAuraChange({ ...recipe.auraParams, intensity: level.value })}
            >
              <Text style={{ fontSize: 16 }}>{level.emoji}</Text>
              <Text style={{ color: isActive ? '#000' : '#FFF', fontSize: 10, fontWeight: 'bold' }}>{level.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      
      {/* PULSE SPEED CONTROL */}
      <Text style={styles.label}>💨 Pulse Speed:</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {pulseSpeeds.map(speed => {
          const isActive = Math.abs(recipe.auraParams.pulseSpeed - speed.value) < 0.1;
          return (
            <TouchableOpacity
              key={speed.label}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
                backgroundColor: isActive ? '#D4AF37' : '#2A2A2A',
                borderWidth: 1, borderColor: isActive ? '#FFD700' : '#444',
              }}
              onPress={() => onAuraChange({ ...recipe.auraParams, pulseSpeed: speed.value })}
            >
              <Text style={{ fontSize: 16 }}>{speed.emoji}</Text>
              <Text style={{ color: isActive ? '#000' : '#FFF', fontSize: 10, fontWeight: 'bold' }}>{speed.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      
      {/* LIVE PREVIEW PANEL - dark background, aura around silhouette */}
      <View style={{ backgroundColor: '#0A0A0A', borderRadius: 16, padding: 16, borderWidth: 2, borderColor: '#D4AF37', alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ color: '#D4AF37', fontSize: 12, fontWeight: 'bold', marginBottom: 8 }}>⚡ AURA PREVIEW ⚡</Text>
        <Svg width={240} height={240} viewBox="0 0 200 200">
          {/* Outer glow pulse — thick rings */}
          <Circle cx="100" cy="100" r={75 * pulseScale} fill="none" stroke={recipe.auraParams.color2} strokeWidth={4} opacity={pulseOpacity * 0.2} />
          <Circle cx="100" cy="100" r={60 * pulseScale} fill={recipe.auraParams.color2} opacity={pulseOpacity * 0.1} />
          <Circle cx="100" cy="100" r={45 * pulseScale} fill={recipe.auraParams.color1} opacity={pulseOpacity * 0.15} />
          {/* Aura paths — outer glow layer */}
          {generateMiniAura(recipe.auraParams.pattern, 100, 100, 3.5).map((d, i) => (
            <Path 
              key={`preview-glow-${i}`} 
              d={d} 
              stroke={i % 2 === 0 ? recipe.auraParams.color2 : recipe.auraParams.color1} 
              strokeWidth={5 + pulseOpacity * 3} 
              fill="none" 
              opacity={pulseOpacity * 0.25} 
              strokeLinecap="round"
            />
          ))}
          {/* Aura paths — inner core layer */}
          {generateMiniAura(recipe.auraParams.pattern, 100, 100, 3.5).map((d, i) => (
            <Path 
              key={`preview-core-${i}`} 
              d={d} 
              stroke={recipe.auraParams.color1} 
              strokeWidth={2.5 + pulseOpacity * 2} 
              fill="none" 
              opacity={pulseOpacity * (0.6 + (i % 3) * 0.15)} 
              strokeLinecap="round"
            />
          ))}
          {/* Inner glow — breathes */}
          <Circle cx="100" cy="100" r={glowRadius} fill={recipe.auraParams.color2} opacity={pulseOpacity * 0.25} />
          <Circle cx="100" cy="100" r={glowRadius * 0.6} fill={recipe.auraParams.color1} opacity={pulseOpacity * 0.2} />
          {/* Spark particles that pulse */}
          {[0,1,2,3,4,5,6,7].map(i => {
            const angle = (i / 8) * Math.PI * 2 + pulsePhase * 0.5;
            const dist = 55 + Math.sin(pulsePhase * 2 + i) * 20;
            const px = 100 + Math.cos(angle) * dist;
            const py = 100 + Math.sin(angle) * dist;
            return <Circle key={`spark-${i}`} cx={px} cy={py} r={2 + pulseOpacity * 2} fill={i % 2 === 0 ? recipe.auraParams.color1 : recipe.auraParams.color2} opacity={pulseOpacity * 0.7} />;
          })}
          {/* Simple silhouette placeholder */}
          <Path d="M100,40 C115,40 125,55 125,75 C125,90 115,100 100,100 C85,100 75,90 75,75 C75,55 85,40 100,40 Z" fill="#333" stroke="#555" strokeWidth="1" />
          <Path d="M75,100 L65,160 L135,160 L125,100 Z" fill="#333" stroke="#555" strokeWidth="1" />
        </Svg>
        {/* Signature move name display */}
        {recipe.signatureMove ? (
          <Text style={{ color: recipe.auraParams.color1, fontSize: 14, fontWeight: 'bold', marginTop: 8, textAlign: 'center', textShadowColor: recipe.auraParams.color2, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }}>
            ⚔️ {recipe.signatureMove} ⚔️
          </Text>
        ) : null}
        <Text style={{ color: '#666', fontSize: 9, marginTop: 4 }}>
          {patternInfo[recipe.auraParams.pattern]?.emoji} {recipe.auraParams.pattern.toUpperCase()} • Intensity: {(recipe.auraParams.intensity * 100).toFixed(0)}% • Speed: {recipe.auraParams.pulseSpeed}x
        </Text>
      </View>
      
    </ScrollView>
  );
}

function PhaseShot({ question, questionNumber, totalQuestions, score, onAnswer }: {
  question: QuizQuestion | null;
  questionNumber: number;
  totalQuestions: number;
  score: number;
  onAnswer: (answer: string) => void;
}) {
  if (!question) return null;
  
  const progressPercent = ((questionNumber - 1) / totalQuestions) * 100;
  const requiredToPass = Math.ceil(totalQuestions * 0.6);
  
  // Check if this is a color swatch question (uses pipe separator: "#color1|#color2")
  const isColorSwatchQ = question.trait === 'color_swatch_first' || 
    (question.isVisual && question.correctAnswer.includes('|'));
  
  // Parse colors from pipe-separated format: "#87ceeb|#e8c4a0"
  const parseColors = (opt: string): [string, string] | null => {
    const parts = opt.split('|');
    if (parts.length === 2 && parts[0].startsWith('#') && parts[1].startsWith('#')) {
      return [parts[0], parts[1]];
    }
    return null;
  };
  
  return (
    <View style={styles.phaseContent}>
      <Text style={styles.quizTitle}>🛡️ The Sentry Interview</Text>
      
      {/* Progress bar */}
      <View style={styles.quizProgressContainer}>
        <View style={styles.quizProgressBar}>
          <View style={[styles.quizProgressFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.quizProgressText}>
          Question {questionNumber} of {totalQuestions} | Score: {score}/{questionNumber - 1}
        </Text>
      </View>
      
      {/* Question - black text for visibility */}
      <Text style={styles.quizQuestion}>{question.question}</Text>
      
      {/* Options - 20 choices in grid layout */}
      <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', paddingVertical: 8 }}>
          {question.options.map((opt, i) => {
            const colorPair = parseColors(opt);
            const isSingleColor = !colorPair && /^#[0-9A-Fa-f]{6}$/.test(opt.trim());
            
            if (colorPair) {
              return (
                <TouchableOpacity key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1A1A1A', borderRadius: 10, padding: 6, borderWidth: 1, borderColor: '#444' }} onPress={() => onAnswer(opt)}>
                  <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: colorPair[0], borderWidth: 1, borderColor: '#FFF' }} />
                  <Text style={{ color: '#888', fontSize: 10 }}>+</Text>
                  <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: colorPair[1], borderWidth: 1, borderColor: '#FFF' }} />
                </TouchableOpacity>
              );
            }
            if (isSingleColor) {
              return (
                <TouchableOpacity key={i} style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: opt, borderWidth: 2, borderColor: '#555' }} onPress={() => onAnswer(opt)} />
              );
            }
            return (
              <TouchableOpacity key={i} style={{ backgroundColor: '#1A1A1A', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#444' }} onPress={() => onAnswer(opt)}>
                <Text style={{ color: '#FFF', fontSize: 13 }}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      
      <Text style={styles.hint}>
        {questionNumber === totalQuestions 
          ? `Final question! Need ${requiredToPass} correct to pass.`
          : `Prove you created this avatar. The Sentry remembers everything you wrote.`
        }
      </Text>
    </View>
  );
}


function PhaseAnchor({ recipe, onComplete }: { recipe: AvatarRecipe; onComplete?: () => void }) {
  const [step, setStep] = useState<'network_select' | 'init' | 'creating' | 'funding' | 'inscribing' | 'complete' | 'error'>('network_select');
  const [selectedNetwork, setSelectedNetwork] = useState<'testnet-10' | 'mainnet'>('testnet-10');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [serialInput, setSerialInput] = useState(String.fromCharCode(39)+String.fromCharCode(39));
  const [serialHashed, setSerialHashed] = useState(false);
  const balancePollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const INSCRIPTION_COST = 0.001; // KAS needed for inscription (dust + fee)
  
  // Don't auto-initialize — wait for network selection
  useEffect(() => {
    return () => {
      if (balancePollerRef.current) clearInterval(balancePollerRef.current);
      if (clientRef.current) {
        clientRef.current.disconnect().catch(() => {});
        clientRef.current = null;
      }
    };
  }, []);
  
  const handleNetworkSelect = (network: 'testnet-10' | 'mainnet') => {
    setSelectedNetwork(network);
    setStep('init');
    initializeWallet(network);
  };
  
  const initializeWallet = async (network: 'testnet-10' | 'mainnet' = selectedNetwork) => {
    try {
      setStep('creating');
      
      // Check if wallet already exists
      const existing = await getRegistrationData();
      if (existing?.kaspaAddress) {
        const expectedPrefix = network === 'mainnet' ? 'kaspa:' : 'kaspatest:';
        const addr = existing.kaspaAddress;
        const dataAfterPrefix = addr.slice(expectedPrefix.length);
        
        // Validate: correct prefix + correct length (61-63 chars after prefix)
        const isValidPrefix = addr.startsWith(expectedPrefix);
        const isValidLength = dataAfterPrefix.length >= 61 && dataAfterPrefix.length <= 63;
        
        if (!isValidPrefix || !isValidLength) {
          // Bad address — wrong network or old encoding. Clear and regenerate.
          console.log(`[PhaseAnchor] Invalid address detected: ${addr} (prefix:${isValidPrefix} len:${isValidLength}). Regenerating...`);
          await SecureStore.deleteItemAsync('kv_kaspa_address');
          await SecureStore.deleteItemAsync('kv_private_key');
          await SecureStore.deleteItemAsync('kv_mnemonic');
        } else {
          // Valid address — check if encrypted key exists (migration)
          const encKey = await SecureStore.getItemAsync('kv_l1_privkey_enc');
          if (!encKey) {
            console.log('[PhaseAnchor] Migrating: creating encrypted key for existing wallet...');
            // Read plain private key and encrypt it
            const plainKey = await SecureStore.getItemAsync('kv_private_key');
            if (plainKey) {
              // Save address under inscription's key name FIRST
              await SecureStore.setItemAsync('kaspa_address', existing.kaspaAddress);
              await SecureStore.setItemAsync('kaspa_network', network);
              
              const Crypto = await import('expo-crypto');
              let deviceEncKey = await SecureStore.getItemAsync('device_encryption_key');
              if (!deviceEncKey) {
                const randomBytes = await Crypto.getRandomBytesAsync(32);
                deviceEncKey = Array.from(new Uint8Array(randomBytes), b => b.toString(16).padStart(2, '0')).join('');
                await SecureStore.setItemAsync('device_encryption_key', deviceEncKey, {
                  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
                });
              }
              const combined = deviceEncKey + plainKey;
              const keyStream = await Crypto.digestStringAsync(
                Crypto.CryptoDigestAlgorithm.SHA256,
                combined,
              );
              const encChars: string[] = [];
              for (let i = 0; i < 64; i += 2) {
                const privByte = parseInt(plainKey.slice(i, i + 2), 16);
                const ksByte = parseInt(keyStream.slice(i % keyStream.length, (i % keyStream.length) + 2), 16);
                encChars.push((privByte ^ ksByte).toString(16).padStart(2, '0'));
              }
              await SecureStore.setItemAsync('kv_l1_privkey_enc', JSON.stringify({ privateKeyEnc: encChars.join('') }), {
                keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
              });
              console.log('[PhaseAnchor] Migration complete — encrypted key saved');
              console.log('[PhaseAnchor] kaspa_address saved as:', existing.kaspaAddress);
              // Verify the save
              const verify = await SecureStore.getItemAsync('kv_l1_privkey_enc');
              const verifyAddr = await SecureStore.getItemAsync('kaspa_address');
              console.log('[PhaseAnchor] Verify kv_l1_privkey_enc exists:', !!verify);
              console.log('[PhaseAnchor] Verify kaspa_address exists:', !!verifyAddr);
            }
          }
          
          setWalletAddress(existing.kaspaAddress);
          setStep('funding');
          startBalancePoller(existing.kaspaAddress, network);
          return;
        }
      }
      
      // Create new wallet from identity hash
      const result = await createWallet({ identityHashHex: recipe.recipeHash, network });
      
      if (!result.success || !result.kaspaAddress) {
        throw new Error(result.error || 'Wallet creation failed');
      }
      
      setWalletAddress(result.kaspaAddress);
      setMnemonic(result.mnemonic || null);
      setStep('funding');
      startBalancePoller(result.kaspaAddress, network);
      
    } catch (err: any) {
      console.error('[PhaseAnchor] Wallet init failed:', err);
      setError(err.message || 'Failed to create wallet');
      setStep('error');
    }
  };
  
  const clientRef = useRef<InstanceType<typeof KaspaClient> | null>(null);
  
  const startBalancePoller = async (address: string, network: 'testnet-10' | 'mainnet' = selectedNetwork) => {
    if (balancePollerRef.current) clearInterval(balancePollerRef.current);
    
    // Connect KaspaClient once
    try {
      if (!clientRef.current || !clientRef.current.isConnected()) {
        clientRef.current = new KaspaClient(network);
        await clientRef.current.connect();
        console.log('[BalancePoller] KaspaClient connected');
      }
    } catch (err) {
      console.warn('[BalancePoller] KaspaClient connect failed, falling back to REST API:', err);
      clientRef.current = null;
    }
    
    const checkBalance = async () => {
      try {
        let bal: bigint;
        if (clientRef.current?.isConnected()) {
          bal = await clientRef.current.getBalance(address);
        } else {
          // REST API fallback
          const apiBase = network === 'mainnet' ? 'https://api.kaspa.org' : 'https://api-tn10.kaspa.org';
          const resp = await fetch(`${apiBase}/addresses/${address}/balance`);
          if (!resp.ok) throw new Error(`API ${resp.status}`);
          const data = await resp.json();
          bal = BigInt(data.balance);
        }
        const kasBalance = Number(bal) / 1e8;
        setBalance(kasBalance);
        
        if (kasBalance >= INSCRIPTION_COST) {
          if (balancePollerRef.current) clearInterval(balancePollerRef.current);
        }
      } catch (err) {
        console.warn('[BalancePoller] Error:', err);
      }
    };
    
    checkBalance();
    balancePollerRef.current = setInterval(checkBalance, 5000);
  };
  
  const performInscription = async (address: string) => {
    try {
      setStep('inscribing');
      console.log("[PhaseAnchor] =======================================");
      console.log("[PhaseAnchor] INSCRIPTION FLOW STARTED");
      
      // Quick REST API connectivity test
      try {
        const testResp = await fetch("https://api-tn10.kaspa.org/info/virtual-chain-blue-score");
        const testData = await testResp.json();
        console.log("[PhaseAnchor] REST API ALIVE - blue score:", JSON.stringify(testData));
      } catch (testErr: any) {
        console.error("[PhaseAnchor] REST API UNREACHABLE from phone:", testErr.message);
      }
      console.log("[PhaseAnchor] address:", address);
      console.log("[PhaseAnchor] network:", selectedNetwork);
      console.log("[PhaseAnchor] recipeHash:", recipe.recipeHash);
      console.log("[PhaseAnchor] keywordMerkleRoot:", recipe.keywordMerkleRoot?.slice(0, 24));
      console.log("[PhaseAnchor] =======================================");
      
      // Primary: REST API transaction submission (reliable)
      let result: any = null;
      try {
        console.log("[PhaseAnchor] === INSCRIPTION START ===");
        console.log("[PhaseAnchor] address:", address);
        console.log("[PhaseAnchor] network:", selectedNetwork);
        console.log("[PhaseAnchor] recipeHash:", recipe.recipeHash?.slice(0, 16));
        console.log("[PhaseAnchor] Using REST API for inscription...");
        const privKeyHex = await SecureStore.getItemAsync("kv_private_key");
        console.log("[PhaseAnchor] Private key found:", !!privKeyHex, "length:", privKeyHex?.length || 0);
        if (!privKeyHex) throw new Error("No private key available");
        
        result = await inscribeIdentityViaRest({
          identityHash: recipe.recipeHash,
          address,
          privateKeyHex: privKeyHex,
          network: selectedNetwork,
        });
        
        if (result.success) {
          result.kaspacTxId = result.txId;
        }
              console.log("[PhaseAnchor] REST result:", JSON.stringify(result));
      } catch (restErr: any) {
        console.error("[PhaseAnchor] REST API FAILED:", restErr.message);
        console.error("[PhaseAnchor] REST error stack:", restErr.stack?.slice(0, 300));
        console.log("[PhaseAnchor] Falling back to wRPC...");
      }
      
      // Fallback: wRPC via identity_inscription_v6
      if (!result?.success) {
        console.log("[PhaseAnchor] REST failed or no result, trying wRPC...");
        console.log("[PhaseAnchor] result so far:", JSON.stringify(result));
        try {
          result = await inscribeIdentity({
            identityHash: recipe.recipeHash,
            traitCount: Object.keys(recipe.colors).filter(k => recipe.colors[k as keyof typeof recipe.colors]).length + 4,
            avatarJson: JSON.stringify(recipe),
            network: selectedNetwork,
          });
                  console.log("[PhaseAnchor] wRPC result:", JSON.stringify(result));
        } catch (wRpcErr: any) {
          console.error("[PhaseAnchor] wRPC ALSO FAILED:", wRpcErr.message);
          console.error("[PhaseAnchor] wRPC error stack:", wRpcErr.stack?.slice(0, 300));
        }
      }
      
      console.log("[PhaseAnchor] FINAL result:", JSON.stringify(result));
      console.log("[PhaseAnchor] success:", result?.success, "txId:", result?.kaspacTxId);
      if (!result.success || !result.kaspacTxId) {
        throw new Error(result.error || 'Inscription failed');
      }
      
      console.log("[PhaseAnchor] INSCRIPTION SUCCESS! txId:", result.kaspacTxId);
      setTxId(result.kaspacTxId);

      // Save avatar SVG paths to device for profile display
      try {
        const recipeData = typeof recipe === 'string' ? JSON.parse(recipe) : recipe;
        const paths = recipeData.silhouettePaths || [];
        if (paths.length > 0) {
          const hash = computeAvatarHash(paths);
          await storeAvatarLocally({ race: recipeData.race || 'human', gender: recipeData.gender || 'male', paths, hash, createdAt: Date.now() } as any);
          console.log('[PhaseAnchor] Avatar SVG saved to device:', paths.length, 'paths, hash:', hash.slice(0, 16));
        } else {
          console.warn('[PhaseAnchor] No silhouette paths in recipe to save');
        }
      } catch (svgErr: any) {
        console.warn('[PhaseAnchor] Avatar SVG save failed (non-fatal):', svgErr.message);
      }

      // Arweave upload � permanent avatar backup (non-blocking)
      try {
        console.log("[PhaseAnchor] Starting Arweave upload...");
        const arTags: ArweaveTag[] = [
          { name: "App-Name", value: "KasVillage" },
          { name: "Content-Type", value: "application/json" },
          { name: "KV-Type", value: "identity" },
          { name: "KV-IdentityHash", value: recipe.recipeHash || "" },
          { name: "KV-KaspaTxId", value: result.kaspacTxId || "" },
          { name: "KV-Network", value: selectedNetwork },
          { name: "KV-Address", value: address },
          { name: "KV-Version", value: "2" },
          { name: "Unix-Time", value: String(Math.floor(Date.now() / 1000)) },
        ];
        // Add device attestation tags (non-blocking)
        try {
          const deviceHash = await getDeviceHash();
          if (deviceHash) arTags.push({ name: "KV-DeviceHash", value: deviceHash });
          const serialHash = await getSerialHash();
          if (serialHash) arTags.push({ name: "KV-SerialHash", value: serialHash });
        } catch (attErr) {
          console.warn("[PhaseAnchor] Attestation tags failed (non-fatal):", attErr);
        }
        const arResult = await uploadToTurbo(JSON.stringify(recipe), arTags);
        if (arResult.success) {
          console.log("[PhaseAnchor] Arweave SUCCESS! txId:", arResult.txId);
          console.log("[PhaseAnchor] Arweave URL:", arResult.arweaveUrl);
          await SecureStore.setItemAsync("kv_arweave_txid", arResult.txId || "");
        } else {
          console.warn("[PhaseAnchor] Arweave upload failed (non-fatal):", arResult.error);
        }
      } catch (arErr: any) {
        console.warn("[PhaseAnchor] Arweave error (non-fatal):", arErr.message);
      }

      // Mark as verified for return authentication
      await SecureStore.setItemAsync('kv_verified', 'true');
      // === Push notification registration ===
      try {
        const pushToken = await registerPushToken();
        if (pushToken) {
          const pubkey = await SecureStore.getItemAsync('kv_public_key') || '';
          if (pubkey) {
            await inscribePushToken(pubkey);
            console.log('[PhaseAnchor] Push token inscribed to Arweave');
          }
        }
      } catch (pushErr) {
        console.warn('[PhaseAnchor] Push registration failed (non-fatal):', pushErr);
      }
      
      setStep('complete');
      
    } catch (err: any) {
      console.error("[PhaseAnchor] ? INSCRIPTION FAILED:", err.message);
      console.error("[PhaseAnchor] Full error:", err);
      console.error("[PhaseAnchor] Stack:", err.stack?.slice(0, 500));
      setError(err.message || 'Inscription failed');
      setStep('error');
    }
  };
  
  const copyAddress = async () => {
    if (walletAddress) {
      await Clipboard.setStringAsync(walletAddress);
    }
  };
  
  const copyMnemonic = async () => {
    if (mnemonic) {
      await Clipboard.setStringAsync(mnemonic);
    }
  };
  
  // NETWORK SELECTION STATE
  if (step === 'network_select') {
    return (
      <View style={styles.phaseContent}>
        <Text style={styles.passportTitle}>CHOOSE NETWORK</Text>
        <Text style={{ color: '#B8A080', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
          Select where to anchor your identity
        </Text>
        
        {/* Testnet card */}
        <TouchableOpacity
          style={{
            backgroundColor: '#1A2A1A', borderWidth: 2, borderColor: '#4CAF50',
            borderRadius: 16, padding: 20, marginBottom: 16,
          }}
          onPress={() => handleNetworkSelect('testnet-10')}
        >
          <Text style={{ color: '#4CAF50', fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>
            🧪 Testnet (Tutorial)
          </Text>
          <Text style={{ color: '#8BC34A', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
            Free tKAS from faucet • Practice mode • No real value
          </Text>
          <Text style={{ color: '#666', fontSize: 11, textAlign: 'center', marginTop: 4 }}>
            Address prefix: kaspatest:
          </Text>
        </TouchableOpacity>
        
        {/* Mainnet card */}
        <TouchableOpacity
          style={{
            backgroundColor: '#2A1A1A', borderWidth: 2, borderColor: '#D4AF37',
            borderRadius: 16, padding: 20, marginBottom: 16,
          }}
          onPress={() => handleNetworkSelect('mainnet')}
        >
          <Text style={{ color: '#D4AF37', fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>
            🌐 Mainnet (Live)
          </Text>
          <Text style={{ color: '#FFD700', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
            Real KAS • Real transactions • Real value
          </Text>
          <Text style={{ color: '#666', fontSize: 11, textAlign: 'center', marginTop: 4 }}>
            Address prefix: kaspa:
          </Text>
        </TouchableOpacity>
        
        <Text style={{ color: '#666', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
          Recommended: Start with Testnet to learn the system
        </Text>
      </View>
    );
  }
  
  // CREATING STATE
  if (step === 'creating') {
    return (
      <View style={styles.phaseContent}>
        <Text style={styles.passportTitle}>CREATING WALLET</Text>
        <View style={styles.anchorStatusCard}>
          <Text style={styles.anchorStatusText}>Deriving keys from your identity...</Text>
          <Text style={styles.anchorStatusSubtext}>This uses your avatar's unique hash</Text>
        </View>
      </View>
    );
  }
  
  // ERROR STATE
  if (step === 'error') {
    return (
      <View style={styles.phaseContent}>
        <Text style={styles.passportTitle}>ERROR</Text>
        <View style={[styles.anchorStatusCard, { borderColor: '#FF4444' }]}>
          <Text style={[styles.anchorStatusText, { color: '#FF4444' }]}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => initializeWallet(selectedNetwork)}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  // FUNDING STATE
  if (step === 'funding') {
    return (
      <View style={styles.phaseContent}>
        {/* Tutorial/Live mode banner */}
        <View style={{
          backgroundColor: selectedNetwork === 'mainnet' ? '#2A1A1A' : '#1A2A1A',
          borderWidth: 2,
          borderColor: selectedNetwork === 'mainnet' ? '#D4AF37' : '#4CAF50',
          borderRadius: 10, padding: 10, marginBottom: 12, alignItems: 'center',
          flexDirection: 'row', justifyContent: 'space-between',
        }}>
          <Text style={{
            color: selectedNetwork === 'mainnet' ? '#D4AF37' : '#4CAF50',
            fontSize: 16, fontWeight: 'bold',
          }}>
            {selectedNetwork === 'mainnet' ? '🌐 MAINNET — LIVE' : '🧪 TESTNET — TUTORIAL MODE'}
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (balancePollerRef.current) clearInterval(balancePollerRef.current);
              setStep('network_select');
              setWalletAddress(null);
              setMnemonic(null);
              setBalance(0);
            }}
            style={{
              backgroundColor: '#333', paddingVertical: 4, paddingHorizontal: 10,
              borderRadius: 6, borderWidth: 1, borderColor: '#555',
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600' }}>Switch</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.passportTitle}>FUND YOUR WALLET</Text>
        
        <View style={styles.anchorStatusCard}>
          <Text style={styles.anchorStatusText}>Send at least {INSCRIPTION_COST} KAS to:</Text>
          
          <TouchableOpacity style={styles.addressBox} onPress={copyAddress}>
            <Text style={styles.addressText} numberOfLines={2}>{walletAddress}</Text>
            <Text style={styles.copyHint}>Tap to copy</Text>
          </TouchableOpacity>
          
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Current Balance:</Text>
            <Text style={[
              styles.balanceValue,
              balance >= INSCRIPTION_COST && { color: '#4CAF50' }
            ]}>
              {balance.toFixed(8)} KAS
            </Text>
          </View>
          
          {balance < INSCRIPTION_COST && selectedNetwork === 'testnet-10' && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: '#B8A080', fontSize: 12, textAlign: 'center', marginBottom: 6 }}>
                Get free testnet KAS from faucet:
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://faucet-tn10.kaspanet.io/')}
                style={{ backgroundColor: '#4CAF50', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center' }}
              >
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: 'bold' }}>
                  🚰 Open Faucet — faucet-tn10.kaspanet.io
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {balance < INSCRIPTION_COST && selectedNetwork === 'mainnet' && (
            <Text style={[styles.fundingHint, { color: '#D4AF37' }]}>
              Send at least 0.001 KAS to this address from any wallet or exchange
            </Text>
          )}
          
          {balance >= INSCRIPTION_COST && (
            <View style={styles.readyBanner}>
              <Text style={styles.readyText}>Funded! Ready to inscribe.</Text>
              <TouchableOpacity
                style={{ backgroundColor: '#4CAF50', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 10, marginTop: 12 }}
                onPress={() => performInscription(walletAddress!)}
              >
                <Text style={{ color: '#000', fontSize: 16, fontWeight: 'bold' }}>⚓ Anchor to L1</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* Serial Number Attestation — hardware binding */}
        <View style={{ backgroundColor: '#1A2A3A', borderRadius: 16, padding: 16, marginTop: 16, borderWidth: 2, borderColor: '#4A90D9' }}>
          <Text style={{ color: '#4A90D9', fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>🔒 HARDWARE ATTESTATION</Text>
          <Text style={{ color: '#CCC', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 12 }}>
            Paste your device serial number to bind this wallet to your physical device.{'\n'}
            Go to Settings → About → Serial Number → Copy
          </Text>
          <TextInput
            style={{ backgroundColor: '#0A0A0A', borderRadius: 10, padding: 14, color: '#FFF', fontSize: 16, fontWeight: 'bold', textAlign: 'center', borderWidth: 1, borderColor: '#4A90D9', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
            placeholder="Paste serial number..."
            placeholderTextColor="#555"
            value={serialInput}
            onChangeText={setSerialInput}
            autoCapitalize="characters"
            returnKeyType="done"
            blurOnSubmit={true}
          />
          {serialInput.length >= 5 && (
            <TouchableOpacity
              style={{ backgroundColor: '#4A90D9', paddingVertical: 12, borderRadius: 10, marginTop: 10, alignItems: 'center' }}
              onPress={async () => {
                try {
                  const hash = await storeSerialHash(serialInput);
                  setSerialHashed(true);
                  Alert.alert('✅ Hardware Bound', 'Serial hash stored securely. Raw serial was NOT saved — only the one-way hash.');
                } catch (e) {
                  Alert.alert('Error', 'Failed to hash serial');
                }
              }}
            >
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: 'bold' }}>
                {serialHashed ? '✓ Serial Hashed' : '🔐 Hash & Store'}
              </Text>
            </TouchableOpacity>
          )}
          {serialHashed && (
            <Text style={{ color: '#4CAF50', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
              ✓ Device hardware-bound. This hash will be inscribed to Arweave.
            </Text>
          )}
        </View>

        {mnemonic && (
          <View style={styles.mnemonicCard}>
            <Text style={styles.mnemonicWarning}>BACKUP YOUR RECOVERY PHRASE</Text>
            <Text style={styles.mnemonicSubtext}>
              Write these 12 words down and store them safely. This is the ONLY way to recover your wallet.
            </Text>
            
            <TouchableOpacity 
              style={styles.mnemonicToggle}
              onPress={() => setShowMnemonic(!showMnemonic)}
            >
              <Text style={styles.mnemonicToggleText}>
                {showMnemonic ? 'Hide' : 'Reveal'} Recovery Phrase
              </Text>
            </TouchableOpacity>
            
            {showMnemonic && (
              <View style={styles.mnemonicBox}>
                <Text style={styles.mnemonicWords}>{mnemonic}</Text>
                <TouchableOpacity style={styles.copyMnemonicBtn} onPress={copyMnemonic}>
                  <Text style={styles.copyMnemonicText}>Copy to Clipboard</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    );
  }
  
  // INSCRIBING STATE
  if (step === 'inscribing') {
    return (
      <View style={styles.phaseContent}>
        <Text style={styles.passportTitle}>INSCRIBING ON-CHAIN</Text>
        <View style={styles.anchorStatusCard}>
          <Text style={styles.anchorStatusText}>Broadcasting to Kaspa L1...</Text>
          <Text style={styles.anchorStatusSubtext}>
            Merkle Root: {recipe.keywordMerkleRoot?.slice(0, 16)}...
          </Text>
          <Text style={styles.anchorStatusSubtext}>
            Recipe Hash: {recipe.recipeHash?.slice(0, 16)}...
          </Text>
        </View>
      </View>
    );
  }
  
  // COMPLETE STATE
  return (
    <View style={styles.phaseContent}>
      <Text style={styles.passportTitle}>KASVILLAGE CITADEL PASSPORT</Text>
      
      <View style={styles.passportCard}>
        <View style={styles.passportHeader}>
          <Text style={styles.passportName}>{recipe.name || 'Unknown'}</Text>
          <Text style={styles.passportRace}>{recipe.race?.toUpperCase()}</Text>
        </View>
        
        <View style={styles.passportDetails}>
          <Text style={styles.passportDetail}>Class: {recipe.class}</Text>
          <Text style={styles.passportDetail}>Spirit: {recipe.animal}</Text>
          <Text style={styles.passportDetail}>Tier: PASSPORT</Text>
        </View>
        
        <View style={styles.passportHashes}>
          <Text style={styles.hashLabel}>Recipe Hash:</Text>
          <Text style={styles.hashValue}>{recipe.recipeHash?.slice(0, 16)}...</Text>
          
          <Text style={styles.hashLabel}>Jitter Proof:</Text>
          <Text style={styles.hashValue}>Verified Human</Text>
          
          {txId && (
            <>
              <Text style={styles.hashLabel}>L1 Transaction:</Text>
              <Text style={styles.hashValue}>{txId.slice(0, 16)}...</Text>
            </>
          )}
          
          {walletAddress && (
            <>
              <Text style={styles.hashLabel}>Wallet Address:</Text>
              <Text style={styles.hashValue}>{walletAddress.slice(0, 24)}...</Text>
            </>
          )}
        </View>
      </View>
      
      <View style={styles.successBanner}>
        <Text style={styles.successText}>Identity anchored to Kaspa L1!</Text>
        <Text style={styles.successSubtext}>
          Your avatar is now permanently inscribed on-chain.
        </Text>
      </View>
      
      {onComplete && (
        <TouchableOpacity 
          style={{ backgroundColor: '#D4AF37', paddingVertical: 16, borderRadius: 12, marginTop: 16, alignItems: 'center' }}
          onPress={onComplete}
        >
          <Text style={{ color: '#FFF', fontSize: 18, fontWeight: 'bold' }}>🏘️ Enter the Village</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Wash out color to pastel (blend toward parchment #F5E6D3)
function washOutColor(hex: string, amount: number = 0.6): string {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xFF;
  const g = (num >> 8) & 0xFF;
  const b = num & 0xFF;
  // Blend toward parchment color
  const targetR = 245, targetG = 230, targetB = 211;
  const newR = Math.round(r + (targetR - r) * amount);
  const newG = Math.round(g + (targetG - g) * amount);
  const newB = Math.round(b + (targetB - b) * amount);
  return `#${((newR << 16) | (newG << 8) | newB).toString(16).padStart(6, '0')}`;
}

function strokeToPath(stroke: StrokePath): string {
  if (stroke.points.length < 2) return '';
  let d = `M${stroke.points[0].x},${stroke.points[0].y}`;
  for (let i = 1; i < stroke.points.length; i++) {
    d += ` L${stroke.points[i].x},${stroke.points[i].y}`;
  }
  return d;
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDF6E3',  // Warm parchment
  },
  phaseIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 50,
    paddingBottom: 10,
    gap: 8,
    backgroundColor: '#F5E6D3',
  },
  phaseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D4C4B0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  phaseCircleActive: {
    backgroundColor: '#D4AF37',
  },
  phaseCircleComplete: {
    backgroundColor: '#8B7355',
  },
  phaseNumber: {
    color: '#4A3728',
    fontWeight: 'bold',
  },
  phaseTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4A3728',
    textAlign: 'center',
    marginBottom: 6,
    backgroundColor: '#F5E6D3',
    paddingVertical: 5,
  },
  // Split screen container
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  // Left panel - options/silhouettes
  leftPanel: {
    flex: 1,
    backgroundColor: '#E8DCC8',
    padding: 12,
    borderRightWidth: 2,
    borderRightColor: '#D4AF37',
  },
  // Right panel - avatar preview
  rightPanel: {
    flex: 1,
    backgroundColor: '#FDF6E3',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F5E6D3',
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D4AF37',
  },
  colorPaletteButton: {
    backgroundColor: '#D4AF37',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  colorPaletteButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold' as const,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  phaseContent: {
    paddingVertical: 12,
    flex: 1,
  },
  phaseContentWarm: {
    paddingVertical: 12,
    flex: 1,
    backgroundColor: '#FDF6E3',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A3728',
    marginBottom: 8,
    marginTop: 12,
  },
  hint: {
    fontSize: 12,
    color: '#8B7355',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    color: '#4A3728',
    fontSize: 16,
    borderWidth: 2,
    borderColor: '#D4C4B0',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // Race category styles
  raceScrollView: {
    flex: 1,
  },
  raceCategoryContainer: {
    marginBottom: 16,
  },
  raceCategoryLabel: {
    color: '#8B7355',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  raceGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  genderToggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 12,
  },
  genderBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#FFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E8DCC8',
  },
  genderBtnActive: {
    backgroundColor: '#D4AF37',
    borderColor: '#B8960F',
  },
  genderBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5C4033',
  },
  genderBtnTextActive: {
    color: '#FFF',
  },
  hairStyleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFF',
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: '#E8DCC8',
    minWidth: 70,
  },
  hairStyleBtnActive: {
    backgroundColor: '#D4AF37',
    borderColor: '#B8960F',
  },
  hairStyleEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  hairStyleLabel: {
    fontSize: 10,
    color: '#4A3728',
    fontWeight: '500' as const,
  },
  hairStyleLabelActive: {
    color: '#FFF',
    fontWeight: 'bold' as const,
  },
  raceScrollContent: {
    paddingRight: 20,
    gap: 10,
  },
  raceCardSmall: {
    width: 72,
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: '#FFF',
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: '#E8DCC8',
  },
  raceCardSmallSelected: {
    backgroundColor: '#D4AF37',
    borderColor: '#B8960F',
  },
  raceEmoji: {
    fontSize: 24,
    marginBottom: 2,
  },
  raceLabelSmall: {
    fontSize: 9,
    color: '#4A3728',
    textAlign: 'center' as const,
    textTransform: 'capitalize' as const,
  },
  raceLabelSelected: {
    color: '#FFF',
    fontWeight: 'bold' as const,
  },
  // Race silhouette card - white icon on warm bg
  raceCard: {
    width: 70,
    height: 80,
    backgroundColor: '#D4C4B0',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  raceCardSelected: {
    backgroundColor: '#D4AF37',
  },
  raceSilhouette: {
    width: 40,
    height: 50,
  },
  raceLabel: {
    fontSize: 10,
    color: '#4A3728',
    marginTop: 4,
    textAlign: 'center',
  },
  // Selected race preview (right panel)
  selectedRacePreview: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5E6D3',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D4AF37',
    marginTop: 20,
  },
  selectedRaceLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A3728',
    marginBottom: 12,
  },
  bigSilhouetteContainer: {
    backgroundColor: '#E8DCC8',
    borderRadius: 12,
    padding: 16,
  },
  // Gear preview styles
  gearPreview: {
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F5E6D3',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#D4AF37',
  },
  gearPreviewLabel: {
    color: '#8B7355',
    fontSize: 12,
    fontStyle: 'italic',
  },
  optionCard: {
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  optionCardSelected: {
    backgroundColor: '#D4AF37',
  },
  optionText: {
    color: '#4A3728',
    fontSize: 14,
  },
  // Scenario phase styles
  scenarioIntro: {
    color: '#8B7355',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
    lineHeight: 20,
  },
  keywordContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#1A2A1A',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#32CD32',
  },
  keywordLabel: {
    color: '#8AC',
    marginBottom: 8,
    fontSize: 12,
  },
  keywordList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  keywordChip: {
    backgroundColor: '#4A90D9',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  keywordText: {
    color: '#FFF',
    fontSize: 12,
  },
  storyInputRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    marginBottom: 12,
  },
  keywordPickerBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#D4AF37',
    borderRadius: 22,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  keywordPickerBtnText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold' as const,
  },
  keywordPickerDropdown: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#D4AF37',
  },
  keywordPickerTitle: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: 'bold' as const,
    marginBottom: 8,
  },
  keywordCategoryRow: {
    marginBottom: 10,
  },
  keywordCategoryName: {
    color: '#AAA',
    fontSize: 12,
    marginBottom: 4,
  },
  keywordCategoryItems: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  keywordPickerItem: {
    backgroundColor: '#4A4A4A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#666',
  },
  keywordPickerItemText: {
    color: '#FFF',
    fontSize: 13,
  },
  regionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 6,
  },
  regionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  regionButtonSelected: {
    borderColor: '#FFF',
  },
  regionText: {
    color: '#4A3728',
    fontSize: 12,
    fontWeight: '600',
  },
  regionColorPreview: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#AAA',
  },
  selectedRegionBanner: {
    backgroundColor: '#D4AF37',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedRegionText: {
    color: '#FFF',
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
  },
  paletteTabs: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    paddingVertical: 8,
  },
  paletteTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E8DCC8',
    borderRadius: 16,
  },
  paletteTabActive: {
    backgroundColor: '#D4AF37',
  },
  paletteTabText: {
    color: '#4A3728',
    fontSize: 12,
  },
  paletteTabTextActive: {
    color: '#FFF',
    fontWeight: 'bold' as const,
  },
  colorGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
    marginBottom: 16,
  },
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D4C4B0',
  },
  colorSwatchSelected: {
    borderColor: '#D4AF37',
    borderWidth: 3,
  },
  // New color palette styles
  colorScrollView: {
    maxHeight: 120,
    marginBottom: 12,
  },
  paletteSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  paletteSelectorButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
  },
  paletteSelectorButtonActive: {
    backgroundColor: '#4A90D9',
    borderColor: '#4A90D9',
  },
  paletteSelectorText: {
    color: '#888',
    fontSize: 11,
  },
  paletteSelectorTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  colorToolsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  colorToolButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#444',
  },
  colorToolText: {
    color: '#FFF',
    fontSize: 12,
  },
  colorPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  colorPreviewSwatch: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  colorPreviewText: {
    color: '#888',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  // Liveness indicator styles
  livenessIndicator: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    height: 24,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  livenessBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 12,
  },
  livenessBarPending: {
    backgroundColor: '#4A90D9',
  },
  livenessBarPassed: {
    backgroundColor: '#32CD32',
  },
  livenessText: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 11,
    color: '#FFF',
    fontWeight: '600',
  },
  // Spawned item controls
  itemControlsContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    padding: 8,
    gap: 6,
  },
  itemControlRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 4,
  },
  itemControlLabel: {
    color: '#AAA',
    fontSize: 10,
    width: 40,
  },
  itemControlButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#444',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  itemControlButtonActive: {
    backgroundColor: '#4A90D9',
  },
  itemControlButtonDone: {
    width: 'auto' as any,
    paddingHorizontal: 16,
    backgroundColor: '#2E7D32',
    marginTop: 6,
  },
  itemControlText: {
    color: '#FFF',
    fontSize: 16,
  },
  itemControlTextDone: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold' as const,
  },
  itemAngleButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: '#333',
    borderRadius: 4,
  },
  itemAngleText: {
    color: '#FFF',
    fontSize: 10,
  },
  // Item list below avatar
  itemListContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  itemChipWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  itemChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  itemDeleteBtn: {
    backgroundColor: '#8B0000',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  itemDeleteText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold' as const,
  },
  itemChipCommon: {
    backgroundColor: '#2A2A2A',
    borderColor: '#444',
  },
  itemChipUncommon: {
    backgroundColor: '#1A3A4A',
    borderColor: '#4169E1',
  },
  itemChipRare: {
    backgroundColor: '#2A1A3A',
    borderColor: '#9932CC',
  },
  itemChipLegendary: {
    backgroundColor: '#3A2A1A',
    borderColor: '#FFD700',
  },
  itemChipLocked: {
    opacity: 1,
  },
  itemChipUnlocked: {
    opacity: 0.7,
  },
  itemChipText: {
    color: '#FFF',
    fontSize: 11,
  },
  quizTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D4AF37',
    textAlign: 'center',
    marginBottom: 12,
  },
  quizProgressContainer: {
    marginBottom: 20,
  },
  quizProgressBar: {
    height: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  quizProgressFill: {
    height: '100%',
    backgroundColor: '#4A90D9',
    borderRadius: 4,
  },
  quizProgressText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },
  quizQuestion: {
    fontSize: 18,
    color: '#000',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 26,
  },
  quizOptions: {
    gap: 12,
  },
  quizOption: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  quizOptionWithSwatch: {
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#444',
  },
  quizOptionText: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
  },
  colorSwatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  quizColorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  swatchPlus: {
    color: '#888',
    fontSize: 20,
    fontWeight: 'bold',
  },
  passportTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#D4AF37',
    textAlign: 'center',
    marginBottom: 20,
  },
  passportCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#D4AF37',
  },
  passportHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 12,
    marginBottom: 12,
  },
  passportName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  passportRace: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  passportDetails: {
    marginBottom: 16,
  },
  passportDetail: {
    fontSize: 14,
    color: '#CCC',
    marginBottom: 4,
  },
  passportHashes: {
    backgroundColor: '#1A1210',
    padding: 12,
    borderRadius: 8,
  },
  hashLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
  },
  hashValue: {
    fontSize: 14,
    color: '#4A90D9',
    fontFamily: 'monospace',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    paddingBottom: 20,
    gap: 12,
    backgroundColor: '#FDF6E3',
    borderTopWidth: 1,
    borderTopColor: '#D4C4B0',
  },
  navButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
  },
  navButtonPrimary: {
    backgroundColor: '#4A90D9',
    borderColor: '#4A90D9',
  },
  navButtonSkip: {
    backgroundColor: 'transparent',
    borderColor: '#888',
    borderStyle: 'dashed',
  },
  navButtonSkipText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  hideToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginRight: 8,
  },
  hideToggle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hideToggleActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#666',
    opacity: 0.6,
  },
  hideToggleText: {
    fontSize: 16,
  },
  hideToggleTextActive: {
    opacity: 0.5,
  },
  hideToggleLabel: {
    fontSize: 8,
    color: '#888',
    marginTop: 2,
  },
  hideToggleCrest: {
    minWidth: 44,
  },
  navButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  navButtonTextPrimary: {
    color: '#FFF',
  },
  jitterIndicator: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 8,
  },
  jitterText: {
    color: '#888',
    fontSize: 10,
  },
  optionalDivider: {
    marginTop: 24,
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 12,
  },
  optionalLabel: {
    color: '#D4AF37',
    fontSize: 12,
    textAlign: 'center' as const,
  },
  colorMixerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 12,
    flexWrap: 'wrap',
  },
  mixerSwatch: {
    width: 50,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D4AF37',
  },
  mixerSwatchText: {
    color: '#FFF',
    fontSize: 10,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  mixerPlus: {
    color: '#D4AF37',
    fontSize: 24,
    fontWeight: 'bold',
  },
  mixerEquals: {
    color: '#D4AF37',
    fontSize: 24,
    fontWeight: 'bold',
  },
  mixerResultSwatch: {
    width: 60,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  mixerResetButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#8B0000',
    borderRadius: 6,
  },
  mixerResetText: {
    color: '#FFF',
    fontSize: 12,
  },
  mixHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  mixHistoryLabel: {
    color: '#888',
    fontSize: 11,
  },
  mixHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniSwatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#555',
  },
  mixHistoryPlus: {
    color: '#666',
    fontSize: 10,
  },
  mixHistoryEquals: {
    color: '#666',
    fontSize: 10,
  },
  brushSizeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 8,
  },
  brushSizeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  brushSizeButtonActive: {
    borderColor: '#D4AF37',
  },
  brushSizePreview: {
    borderRadius: 20,
  },
  drawingControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 8,
    backgroundColor: '#1A1210',
  },
  drawingControlButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#333',
    borderRadius: 6,
  },
  drawingControlText: {
    color: '#FFF',
    fontSize: 12,
  },
  drawingCanvasContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#D4AF37',
  },
  drawingCanvas: {
    width: '100%',
    height: 200,
    backgroundColor: '#FFF8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawingPlaceholder: {
    position: 'absolute',
    color: '#999',
    fontSize: 16,
    fontStyle: 'italic',
  },
  animalCategoryContainer: {
    marginBottom: 16,
  },
  animalCategoryLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#4A3728',
    marginBottom: 8,
    marginLeft: 4,
  },
  petGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    paddingVertical: 8,
  },
  petCard: {
    width: 70,
    alignItems: 'center' as const,
    padding: 8,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#EEE',
  },
  petCardSelected: {
    borderColor: '#D4AF37',
    backgroundColor: '#FFFACD',
  },
  petEmoji: {
    fontSize: 32,
  },
  petName: {
    fontSize: 10,
    color: '#4A3728',
    textAlign: 'center' as const,
    marginTop: 4,
  },
  petPreview: {
    alignItems: 'center' as const,
    padding: 16,
    backgroundColor: '#FFFACD',
    borderRadius: 12,
    marginTop: 12,
  },
  petPreviewEmoji: {
    fontSize: 48,
  },
  petPreviewName: {
    fontSize: 14,
    color: '#4A3728',
    marginTop: 8,
  },
  petContainer: {
    position: 'absolute' as const,
    bottom: 30,
    right: -10,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(255,250,205,0.9)',
    borderRadius: 12,
    padding: 8,
    borderWidth: 2,
    borderColor: '#D4AF37',
  },
  petOnShoulder: {
    position: 'absolute' as const,
    top: 45,
    left: 5,
    backgroundColor: 'rgba(255,250,205,0.85)',
    borderRadius: 25,
    padding: 4,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  petLabel: {
    fontSize: 10,
    color: '#4A3728',
    fontWeight: 'bold' as const,
    marginTop: 4,
  },
  
  // Item Preview Modal styles
  previewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingVertical: 40,
  },
  previewModalContent: {
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 320,
    alignItems: 'center' as const,
    borderWidth: 2,
    borderColor: '#D4AF37',
  },
  previewModalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold' as const,
    marginBottom: 16,
    textTransform: 'capitalize' as const,
  },
  previewSvgContainer: {
    width: 150,
    height: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#D4AF37',
    overflow: 'hidden' as const,
  },
  previewControlRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    marginBottom: 12,
  },
  previewControlLabel: {
    color: '#AAA',
    fontSize: 12,
    width: 50,
  },
  previewControlBtn: {
    width: 36,
    height: 36,
    backgroundColor: '#444',
    borderRadius: 8,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  previewControlBtnText: {
    color: '#FFF',
    fontSize: 18,
  },
  previewScaleText: {
    color: '#FFF',
    fontSize: 14,
    width: 50,
    textAlign: 'center' as const,
  },
  previewAngleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#333',
    borderRadius: 6,
  },
  previewAngleBtnActive: {
    backgroundColor: '#D4AF37',
  },
  previewAngleBtnText: {
    color: '#FFF',
    fontSize: 11,
  },
  previewActionRow: {
    flexDirection: 'row' as const,
    gap: 16,
    marginTop: 8,
  },
  previewCancelBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#555',
    borderRadius: 8,
  },
  previewCancelBtnText: {
    color: '#FFF',
    fontSize: 14,
  },
  previewPlaceBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#4A90D9',
    borderRadius: 8,
  },
  previewPlaceBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold' as const,
  },
  previewColorHint: {
    color: '#888',
    fontSize: 10,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  currentColorRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    marginBottom: 8,
  },
  currentColorLabel: {
    color: '#CCC',
    fontSize: 12,
  },
  currentColorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  previewPaletteRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'center' as const,
    gap: 4,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  previewColorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  previewColorSwatchSelected: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
  },
  
  // Color Palette styles (Step 2 - Tap-to-Fill)
  colorPaletteContainer: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  colorPaletteRow: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: 6,
    marginVertical: 3,
  },
  colorSwatchWhite: {
    borderWidth: 1,
    borderColor: '#666',
  },
  
  // Recovery link styles
  recoveryLink: {
    marginTop: 24,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  recoveryLinkText: {
    fontSize: 15,
    color: '#f59e0b',
    textDecorationLine: 'underline' as const,
  },
  
  // Color Palette Modal styles
  colorModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  colorModalContent: {
    backgroundColor: '#FDF6E3',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  colorModalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  colorModalTitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#4A3728',
  },
  colorModalClose: {
    fontSize: 24,
    color: '#8B7355',
    padding: 8,
  },
  colorModalLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#4A3728',
    marginBottom: 8,
    marginTop: 12,
  },
  colorRegionScroll: {
    maxHeight: 50,
    marginBottom: 8,
  },
  colorRegionChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFF',
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  colorRegionChipSelected: {
    backgroundColor: '#D4AF37',
  },
  colorRegionPreviewDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D4C4B0',
  },
  colorRegionChipText: {
    fontSize: 12,
    color: '#4A3728',
  },
  colorRegionChipTextSelected: {
    color: '#FFF',
    fontWeight: 'bold' as const,
  },
  colorModalSelectedBanner: {
    backgroundColor: '#D4AF37',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  colorModalSelectedText: {
    color: '#FFF',
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
  },
  colorModalGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginVertical: 12,
  },
  colorModalSwatch: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  colorModalSwatchSelected: {
    borderWidth: 3,
    borderColor: '#D4AF37',
  },
  colorModalDoneBtn: {
    backgroundColor: '#D4AF37',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center' as const,
    marginTop: 16,
  },
  colorModalDoneBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold' as const,
  },
  // Anchor phase styles
  anchorStatusCard: {
    backgroundColor: '#2A2520',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#D4AF37',
    marginVertical: 12,
  },
  anchorStatusText: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  anchorStatusSubtext: {
    color: '#A89070',
    fontSize: 12,
    textAlign: 'center' as const,
    marginTop: 4,
  },
  addressBox: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  addressText: {
    color: '#4A90D9',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center' as const,
  },
  copyHint: {
    color: '#888',
    fontSize: 11,
    textAlign: 'center' as const,
    marginTop: 8,
  },
  balanceRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginTop: 12,
  },
  balanceLabel: {
    color: '#A89070',
    fontSize: 14,
  },
  balanceValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold' as const,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fundingHint: {
    color: '#D4AF37',
    fontSize: 12,
    textAlign: 'center' as const,
    marginTop: 12,
    lineHeight: 18,
  },
  readyBanner: {
    backgroundColor: '#1B4332',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  readyText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
  },
  mnemonicCard: {
    backgroundColor: '#3D2914',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#FF6B00',
  },
  mnemonicWarning: {
    color: '#FF6B00',
    fontSize: 14,
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  mnemonicSubtext: {
    color: '#CCC',
    fontSize: 12,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  mnemonicToggle: {
    backgroundColor: '#FF6B00',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  mnemonicToggleText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
  },
  mnemonicBox: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
  },
  mnemonicWords: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 24,
    textAlign: 'center' as const,
  },
  copyMnemonicBtn: {
    backgroundColor: '#333',
    borderRadius: 6,
    padding: 10,
    marginTop: 12,
  },
  copyMnemonicText: {
    color: '#FFF',
    fontSize: 12,
    textAlign: 'center' as const,
  },
  retryButton: {
    backgroundColor: '#D4AF37',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
  },
  successBanner: {
    backgroundColor: '#1B4332',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  successText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
  },
  successSubtext: {
    color: '#A5D6A7',
    fontSize: 12,
    textAlign: 'center' as const,
    marginTop: 8,
  },
});

// ============================================================================
// RETURN AUTHENTICATION UTILITIES
// For use in Dashboard/OnboardingScreen when user returns
// Flow: Biometric → 1 random question from 50-question bank
// ============================================================================

/**
 * Get a single random question from the stored question bank
 * Call this after biometric auth succeeds
 */
export function getReturnAuthQuestion(recipe: AvatarRecipe, colorMixHistory: ColorMix[] = []): QuizQuestion | null {
  const quizRecipe: QuizRecipe = {
    name: recipe.name, race: recipe.race, class: recipe.class,
    occupation: recipe.occupation, animal: recipe.animal,
    colors: { skin: recipe.colors.skin, hair: recipe.colors.hair, eyes: recipe.colors.eyes,
      lips: recipe.colors.lips, primary: recipe.colors.primary, secondary: recipe.colors.secondary,
      accent: recipe.colors.accent, outline: recipe.colors.outline },
    colorMixHistory: colorMixHistory.map(m => ({ color1: m.color1, color2: m.color2, result: m.result, region: m.region, timestamp: m.timestamp })),
    originStory: recipe.originStory, formativeMemory: recipe.formativeMemory,
    scenarioDesire: recipe.scenarioDesire, characterDescription: recipe.characterDescription,
    voiceLine: recipe.voiceLine, weakness: recipe.weakness,
    lifePhilosophy: recipe.lifePhilosophy, powerSpike: recipe.powerSpike, signatureMove: recipe.signatureMove,
    parsedKeywords: recipe.parsedKeywords || [], spawnedItemKeywords: recipe.allExtractedKeywords || [],
  };
  const allQuestions = generateQuestionBankFromFile(quizRecipe);
  if (allQuestions.length === 0) return null;
  const selected = selectQuizQuestions(allQuestions, 1);
  if (selected.length === 0) return null;
  const q = selected[0];
  return { question: q.question, correctAnswer: q.correctAnswer, options: q.options, trait: q.category || "general", isVisual: q.category === "color" || q.category === "mix" };
}

/**
 * Verify answer for return authentication
 */
export function verifyReturnAuth(question: QuizQuestion, answer: string): boolean {
  return question.correctAnswer === answer;
}

/**
 * Get the full 50-question bank for storage/export
 */
export function getFullQuestionBank(recipe: AvatarRecipe, colorMixHistory: ColorMix[] = []): QuizQuestion[] {
  const quizRecipe: QuizRecipe = {
    name: recipe.name, race: recipe.race, class: recipe.class,
    occupation: recipe.occupation, animal: recipe.animal,
    colors: { skin: recipe.colors.skin, hair: recipe.colors.hair, eyes: recipe.colors.eyes,
      lips: recipe.colors.lips, primary: recipe.colors.primary, secondary: recipe.colors.secondary,
      accent: recipe.colors.accent, outline: recipe.colors.outline },
    colorMixHistory: colorMixHistory.map(m => ({ color1: m.color1, color2: m.color2, result: m.result, region: m.region, timestamp: m.timestamp })),
    originStory: recipe.originStory, formativeMemory: recipe.formativeMemory,
    scenarioDesire: recipe.scenarioDesire, characterDescription: recipe.characterDescription,
    voiceLine: recipe.voiceLine, weakness: recipe.weakness,
    lifePhilosophy: recipe.lifePhilosophy, powerSpike: recipe.powerSpike, signatureMove: recipe.signatureMove,
    parsedKeywords: recipe.parsedKeywords || [], spawnedItemKeywords: recipe.allExtractedKeywords || [],
  };
  const allQuestions = generateQuestionBankFromFile(quizRecipe);
  return allQuestions.map(q => ({ question: q.question, correctAnswer: q.correctAnswer, options: q.options, trait: q.category || "general", isVisual: q.category === "color" || q.category === "mix" }));
}

export { IdentityRitual, generateQuestionBank };
export type { AvatarRecipe, JitterSample, QuizQuestion, ColorMix, QuestionBank };