// ============================================================================
// KASVILLAGE IDENTITY RITUAL - EXPANDED LEXICON & ITEM SYSTEM
// ============================================================================
//
// 1. 1000+ trigger words with combinable modifiers
// 2. Draggable/scaleable/rotatable item components
// 3. Class uniforms and occupation gear
// 4. Animal spirit visual elements
// 5. Full color customization system
// 6. Typing cadence biometric (jitter commitment)
// ============================================================================

import React, { useRef } from 'react';
import { 
  View, 
  PanResponder, 
  Animated, 
  StyleSheet,
  GestureResponderEvent,
  PanResponderGestureState,
  Text,
  TouchableOpacity,
} from 'react-native';
import * as Crypto from 'expo-crypto';

// ============================================================================
// EXPANDED LEXICON (1000+ words)
// ============================================================================

export const LEXICON: Record<string, {
  triggers: string[];
  category: string;
  modifiers?: string[];
  combines?: string[];
  svgGenerator?: string;
}> = {
  
  // ==================== WEAPONS - MELEE ====================
  sword: {
    category: 'weapon_melee',
    triggers: [
      'sword', 'blade', 'saber', 'sabre', 'katana', 'rapier', 'claymore', 'cutlass',
      'scimitar', 'machete', 'gladius', 'broadsword', 'longsword', 'shortsword',
      'greatsword', 'zweihander', 'falchion', 'flamberge', 'estoc', 'épée',
      'foil', 'swordsmanship', 'swordsman', 'blademaster', 'duel', 'duelist',
      'slash', 'parry', 'thrust', 'fencing', 'kendo', 'iaido', 'samurai',
      'knight', 'cavalier', 'swashbuckler', 'musketeer', 'crusader',
    ],
    modifiers: ['golden', 'dark', 'fire', 'ice', 'lightning', 'holy', 'cursed', 'ancient', 'legendary', 'broken', 'rusty', 'enchanted', 'vorpal', 'singing', 'dancing'],
    combines: ['fire', 'ice', 'lightning', 'holy', 'dark', 'dragon', 'demon', 'angel'],
    svgGenerator: 'sword',
  },
  dagger: {
    category: 'weapon_melee',
    triggers: [
      'dagger', 'knife', 'dirk', 'stiletto', 'shiv', 'kris', 'tanto', 'kukri',
      'bowie', 'switchblade', 'throwing knife', 'assassin', 'backstab', 'stab',
      'shank', 'poniard', 'misericorde', 'rondel', 'baselard',
      'main gauche', 'parrying dagger', 'push dagger', 'boot knife',
    ],
    modifiers: ['poison', 'shadow', 'silver', 'obsidian', 'bone', 'glass', 'hidden', 'assassin'],
    combines: ['poison', 'shadow', 'blood', 'soul'],
    svgGenerator: 'dagger',
  },
  axe: {
    category: 'weapon_melee',
    triggers: [
      'axe', 'hatchet', 'cleaver', 'tomahawk', 'battleaxe', 'greataxe', 'waraxe',
      'broadaxe', 'woodcutter', 'lumberjack', 'berserker', 'viking', 'chop',
      'cleave', 'split', 'francisca', 'labrys', 'dane axe', 'bearded axe',
      'throwing axe', 'hand axe', 'felling axe', 'pickaxe', 'mattock',
    ],
    modifiers: ['blood', 'war', 'frost', 'thunder', 'executioner', 'berserker', 'dwarven', 'orcish'],
    combines: ['blood', 'thunder', 'ice', 'fire'],
    svgGenerator: 'axe',
  },
  hammer: {
    category: 'weapon_melee',
    triggers: [
      'hammer', 'mallet', 'maul', 'sledge', 'warhammer', 'mjolnir', 'blacksmith',
      'forge', 'anvil', 'smash', 'crush', 'pound', 'thunder', 'gavel',
      'sledgehammer', 'ball peen', 'claw hammer', 'war mallet', 'great hammer',
      'morning star', 'mace', 'flail', 'bludgeon', 'club', 'cudgel',
    ],
    modifiers: ['storm', 'earth', 'titan', 'divine', 'thunder', 'volcanic', 'dwarven', 'giant'],
    combines: ['thunder', 'lightning', 'earth', 'divine'],
    svgGenerator: 'hammer',
  },
  spear: {
    category: 'weapon_melee',
    triggers: [
      'spear', 'lance', 'javelin', 'trident', 'pike', 'halberd', 'glaive',
      'polearm', 'naginata', 'partisan', 'impale', 'thrust', 'charge',
      'cavalry', 'phalanx', 'pilum', 'sarissa', 'xyston', 'contus',
      'ranseur', 'voulge', 'guisarme', 'bardiche', 'pollaxe', 'bec de corbin',
    ],
    modifiers: ['dragon', 'lightning', 'sea', 'war', 'hunting', 'cavalry', 'ceremonial'],
    combines: ['dragon', 'lightning', 'holy', 'cursed'],
    svgGenerator: 'spear',
  },
  scythe: {
    category: 'weapon_melee',
    triggers: [
      'scythe', 'sickle', 'reaper', 'grim', 'harvest', 'death', 'soul',
      'specter', 'wraith', 'phantom', 'farmer', 'grain', 'wheat', 'mowing',
      'crescent', 'curved blade', 'war scythe', 'kusarigama', 'kama',
    ],
    modifiers: ['death', 'shadow', 'soul', 'cursed', 'harvest', 'blood', 'spectral'],
    combines: ['death', 'shadow', 'soul', 'blood'],
    svgGenerator: 'scythe',
  },
  staff: {
    category: 'weapon_magic',
    triggers: [
      'staff', 'wand', 'rod', 'scepter', 'stave', 'cane', 'walking stick',
      'quarterstaff', 'bo', 'wizard', 'mage', 'sorcerer', 'witch', 'warlock',
      'magic', 'spell', 'cast', 'enchant', 'arcane', 'mystic', 'druid',
      'shaman', 'conjurer', 'enchanter', 'illusionist', 'necromancer',
      'diviner', 'evoker', 'abjurer', 'transmuter', 'battlemage',
    ],
    modifiers: ['crystal', 'ancient', 'elder', 'arcane', 'void', 'nature', 'elemental', 'celestial'],
    combines: ['fire', 'ice', 'lightning', 'void', 'nature', 'holy', 'dark'],
    svgGenerator: 'staff',
  },
  whip: {
    category: 'weapon_melee',
    triggers: [
      'whip', 'lash', 'cat o nine tails', 'bullwhip', 'riding crop',
      'chain whip', 'urumi', 'sjambok', 'knout', 'scourge', 'flagellum',
    ],
    modifiers: ['fire', 'lightning', 'thorned', 'chain', 'spectral'],
    combines: ['fire', 'lightning', 'poison'],
    svgGenerator: 'whip',
  },
  
  // ==================== WEAPONS - RANGED ====================
  bow: {
    category: 'weapon_ranged',
    triggers: [
      'bow', 'arrow', 'crossbow', 'archer', 'longbow', 'shortbow', 'compound bow',
      'recurve', 'quiver', 'bullseye', 'marksman', 'sniper', 'aim', 'shoot',
      'archery', 'ranger', 'hunter', 'huntress', 'fletcher', 'bowyer',
      'yumi', 'daikyu', 'hankyu', 'horse bow', 'composite bow', 'self bow',
      'arbalest', 'ballista', 'repeating crossbow', 'bolt', 'broadhead',
    ],
    modifiers: ['elven', 'shadow', 'storm', 'phoenix', 'hunting', 'war', 'silent'],
    combines: ['fire', 'ice', 'lightning', 'poison', 'shadow'],
    svgGenerator: 'bow',
  },
  gun: {
    category: 'weapon_ranged',
    triggers: [
      'gun', 'pistol', 'rifle', 'blaster', 'cannon', 'firearm', 'revolver',
      'shotgun', 'musket', 'carbine', 'automatic', 'semi-auto',
      'bullet', 'ammo', 'reload', 'trigger', 'holster', 'gunslinger',
      'outlaw', 'sheriff', 'cowboy', 'desperado', 'bounty hunter',
      'derringer', 'flintlock', 'matchlock', 'wheellock', 'percussion',
      'gatling', 'howitzer', 'mortar', 'rocket launcher', 'railgun',
    ],
    modifiers: ['plasma', 'laser', 'energy', 'golden', 'silver', 'chrome', 'rusted'],
    combines: ['plasma', 'lightning', 'fire', 'ice'],
    svgGenerator: 'gun',
  },
  thrown: {
    category: 'weapon_ranged',
    triggers: [
      'shuriken', 'kunai', 'throwing star', 'dart', 'chakram', 'boomerang',
      'throwing axe', 'throwing knife', 'bola', 'sling', 'slingshot',
      'atlatl', 'blowgun', 'needles', 'caltrops', 'grenade', 'bomb',
    ],
    modifiers: ['poison', 'exploding', 'returning', 'guided', 'shadow'],
    combines: ['poison', 'fire', 'ice', 'lightning'],
    svgGenerator: 'thrown',
  },
  
  // ==================== ARMOR & PROTECTION ====================
  shield: {
    category: 'armor',
    triggers: [
      'shield', 'buckler', 'aegis', 'barrier', 'bulwark', 'rampart', 'guardian',
      'defender', 'protect', 'block', 'parry', 'deflect', 'fortify',
      'safeguard', 'sanctuary', 'haven', 'fortress', 'citadel', 'bastion',
      'kite shield', 'tower shield', 'round shield', 'heater shield',
      'pavise', 'scutum', 'hoplon', 'aspis', 'targe', 'rondache',
    ],
    modifiers: ['holy', 'dragon', 'tower', 'mirror', 'flame', 'ice', 'lightning'],
    combines: ['holy', 'dragon', 'lion', 'eagle', 'wolf'],
    svgGenerator: 'shield',
  },
  armor: {
    category: 'armor',
    triggers: [
      'armor', 'plate', 'mail', 'chainmail', 'breastplate', 'cuirass',
      'gauntlet', 'greaves', 'pauldron', 'vambrace', 'helm', 'helmet',
      'visor', 'tank', 'fortified', 'impenetrable',
      'scale mail', 'ring mail', 'splint mail', 'banded mail', 'brigandine',
      'lamellar', 'lorica', 'hauberk', 'gambeson', 'aketon', 'arming doublet',
      'sabatons', 'cuisses', 'faulds', 'tassets', 'gorget', 'bevor',
    ],
    modifiers: ['dragon', 'mithril', 'adamantine', 'divine', 'demonic', 'spectral'],
    combines: ['dragon', 'holy', 'dark', 'ice', 'fire'],
    svgGenerator: 'armor',
  },
  cloak: {
    category: 'armor',
    triggers: [
      'cloak', 'cape', 'mantle', 'robe', 'shroud', 'veil', 'hood', 'cowl',
      'garment', 'vestment', 'wrap', 'drape', 'flowing', 'billowing',
      'mysterious', 'invisible', 'phantom', 'poncho', 'tabard', 'surcoat',
      'cassock', 'habit', 'tunic', 'toga', 'himation', 'chlamys',
    ],
    modifiers: ['shadow', 'starlight', 'royal', 'spectral', 'invisible', 'feathered'],
    combines: ['shadow', 'star', 'moon', 'sun', 'feather'],
    svgGenerator: 'cloak',
  },
  
  // ==================== HEADGEAR ====================
  crown: {
    category: 'headgear',
    triggers: [
      'crown', 'tiara', 'diadem', 'coronet', 'circlet', 'headpiece', 'royal',
      'king', 'queen', 'prince', 'princess', 'monarch', 'emperor', 'empress',
      'ruler', 'sovereign', 'majesty', 'throne', 'reign', 'dynasty',
      'laurel', 'wreath', 'halo', 'nimbus', 'aureole', 'crown of thorns',
    ],
    modifiers: ['golden', 'jeweled', 'iron', 'thorned', 'flame', 'ice', 'shadow'],
    combines: ['golden', 'jewel', 'thorn', 'flame', 'ice'],
    svgGenerator: 'crown',
  },
  mask: {
    category: 'headgear',
    triggers: [
      'mask', 'face', 'visage', 'guise', 'disguise',
      'hidden', 'anonymous', 'mysterious', 'phantom', 'opera', 'carnival',
      'masquerade', 'ninja', 'kabuki', 'noh', 'venetian',
      'death mask', 'war mask', 'tribal mask', 'spirit mask', 'shamanic',
    ],
    modifiers: ['death', 'war', 'comedy', 'tragedy', 'demon', 'oni', 'beast'],
    combines: ['demon', 'beast', 'skull', 'dragon'],
    svgGenerator: 'mask',
  },
  horns: {
    category: 'headgear',
    triggers: [
      'horn', 'horns', 'antler', 'antlers', 'spike', 'spikes', 'demon', 'devil',
      'fiend', 'hellion', 'infernal', 'beast', 'ram', 'bull', 'minotaur',
      'satyr', 'buffalo', 'goat', 'gazelle', 'impala', 'kudu',
      'unicorn', 'bicorn', 'rhino', 'triceratops', 'dragon horn',
    ],
    modifiers: ['demon', 'dragon', 'crystal', 'bone', 'golden', 'obsidian', 'ivory'],
    combines: ['demon', 'dragon', 'fire', 'ice', 'crystal'],
    svgGenerator: 'horns',
  },
  hat: {
    category: 'headgear',
    triggers: [
      'hat', 'cap', 'bonnet', 'beret', 'fedora', 'top hat', 'bowler', 'derby',
      'sombrero', 'fez', 'turban', 'bandana', 'headband', 'wizard hat',
      'witch hat', 'pointed hat', 'tricorn', 'bicorn', 'pith helmet',
      'beanie', 'toque', 'tam', 'balmoral', 'glengarry', 'newsboy',
    ],
    modifiers: ['wizard', 'witch', 'noble', 'pirate', 'cowboy', 'military'],
    combines: ['star', 'feather', 'jewel', 'skull'],
    svgGenerator: 'hat',
  },
  
  // ==================== BODY FEATURES ====================
  wings: {
    category: 'body',
    triggers: [
      'wing', 'wings', 'feather', 'feathers', 'flight', 'fly', 'flying', 'soar',
      'glide', 'aerial', 'airborne', 'avian', 'angel', 'angelic', 'cherub',
      'seraph', 'bat', 'fairy', 'fae', 'sprite',
      'butterfly', 'moth', 'insect', 'dragonfly', 'beetle', 'pegasus',
      'griffin', 'hippogriff', 'harpy', 'siren', 'valkyrie', 'icarus',
    ],
    modifiers: ['angel', 'demon', 'dragon', 'fairy', 'bat', 'feathered', 'mechanical', 'crystal', 'flame', 'ice', 'shadow'],
    combines: ['angel', 'demon', 'dragon', 'fire', 'ice', 'lightning', 'shadow'],
    svgGenerator: 'wings',
  },
  tail: {
    category: 'body',
    triggers: [
      'tail', 'tails', 'appendage', 'fox', 'cat', 'lion',
      'serpent', 'lizard', 'kitsune', 'nine-tails',
      'scorpion', 'monkey', 'raccoon', 'squirrel', 'horse', 'peacock',
      'mermaid', 'fish tail', 'whale', 'dolphin', 'shark',
    ],
    modifiers: ['fox', 'dragon', 'demon', 'scaled', 'fluffy', 'barbed', 'flame'],
    combines: ['fire', 'lightning', 'poison', 'shadow'],
    svgGenerator: 'tail',
  },
  ears: {
    category: 'body',
    triggers: [
      'ear', 'ears', 'pointed ears', 'elf ears', 'elven', 'cat ears', 'neko',
      'fox ears', 'wolf ears', 'rabbit ears', 'bunny ears', 'bat ears',
      'long ears', 'floppy ears', 'perky ears', 'tufted ears',
    ],
    modifiers: ['elven', 'cat', 'fox', 'wolf', 'rabbit', 'bat'],
    combines: ['elf', 'cat', 'fox', 'wolf'],
    svgGenerator: 'ears',
  },
  eyes: {
    category: 'body',
    triggers: [
      'eye', 'eyes', 'gaze', 'stare', 'glare', 'vision', 'sight', 'see',
      'third eye', 'all-seeing', 'blind', 'cyclops', 'multiple eyes',
      'glowing eyes', 'red eyes', 'golden eyes', 'silver eyes', 'cat eyes',
      'snake eyes', 'dragon eyes', 'demon eyes', 'angel eyes',
    ],
    modifiers: ['glowing', 'blind', 'demonic', 'divine', 'dragon', 'serpent'],
    combines: ['fire', 'ice', 'void', 'holy', 'shadow'],
    svgGenerator: 'eyes',
  },
  
  // ==================== NATURE - FLORA ====================
  flower: {
    category: 'nature_flora',
    triggers: [
      'flower', 'floral', 'bloom', 'blossom', 'petal', 'rose', 'lily', 'lotus',
      'orchid', 'daisy', 'tulip', 'sunflower', 'violet', 'lavender', 'jasmine',
      'cherry blossom', 'sakura', 'garden', 'botanical', 'bouquet', 'wreath',
      'garland', 'flora', 'iris', 'peony', 'chrysanthemum', 'carnation',
      'marigold', 'daffodil', 'hyacinth', 'magnolia', 'camellia', 'hibiscus',
      'plumeria', 'frangipani', 'gardenia', 'azalea', 'rhododendron',
      'poppy', 'forget-me-not', 'bluebell', 'snowdrop', 'crocus',
    ],
    modifiers: ['sacred', 'poison', 'crystal', 'midnight', 'blood', 'golden', 'silver', 'ice'],
    combines: ['fire', 'ice', 'shadow', 'light', 'poison'],
    svgGenerator: 'flower',
  },
  tree: {
    category: 'nature_flora',
    triggers: [
      'tree', 'forest', 'woodland', 'grove', 'oak', 'willow', 'pine', 'cedar',
      'birch', 'maple', 'ash', 'yew', 'elder', 'ancient', 'world tree',
      'yggdrasil', 'druid', 'dryad', 'ent', 'treant', 'root', 'branch',
      'leaf', 'leaves', 'bark', 'timber', 'lumber', 'redwood', 'sequoia',
      'baobab', 'banyan', 'bonsai', 'cherry tree', 'palm', 'cypress',
      'juniper', 'spruce', 'fir', 'hemlock', 'mahogany', 'teak', 'ebony',
    ],
    modifiers: ['ancient', 'sacred', 'twisted', 'petrified', 'burning', 'crystal', 'spirit'],
    combines: ['fire', 'ice', 'lightning', 'spirit', 'death'],
    svgGenerator: 'tree',
  },
  vine: {
    category: 'nature_flora',
    triggers: [
      'vine', 'ivy', 'tendril', 'creeper', 'thorn', 'thorns', 'bramble', 'briar',
      'entangle', 'ensnare', 'overgrown', 'jungle', 'rainforest', 'moss',
      'lichen', 'fern', 'frond', 'undergrowth', 'thicket', 'hedge',
      'wisteria', 'bougainvillea', 'morning glory', 'honeysuckle',
    ],
    modifiers: ['poison', 'thorned', 'blessed', 'cursed', 'strangling', 'blood'],
    combines: ['poison', 'thorn', 'blood', 'shadow'],
    svgGenerator: 'vine',
  },
  mushroom: {
    category: 'nature_flora',
    triggers: [
      'mushroom', 'fungus', 'fungi', 'toadstool', 'spore', 'mycelium',
      'truffle', 'shiitake', 'portobello', 'chanterelle', 'morel',
      'amanita', 'death cap', 'fly agaric', 'psilocybin', 'magic mushroom',
    ],
    modifiers: ['poison', 'magic', 'glowing', 'giant', 'tiny'],
    combines: ['poison', 'magic', 'death', 'dream'],
    svgGenerator: 'mushroom',
  },
  
  // ==================== NATURE - ANIMALS ====================
  wolf: {
    category: 'animal',
    triggers: [
      'wolf', 'wolves', 'lupine', 'canine', 'dog', 'hound', 'dire wolf',
      'werewolf', 'lycanthrope', 'pack', 'alpha', 'howl', 'hunt', 'predator',
      'feral', 'wild', 'wilderness', 'coyote', 'jackal', 'dingo', 'hyena',
      'husky', 'malamute', 'german shepherd', 'mastiff', 'wolfhound',
    ],
    modifiers: ['shadow', 'frost', 'dire', 'spectral', 'alpha', 'lone', 'blood'],
    combines: ['shadow', 'frost', 'fire', 'moon', 'blood'],
    svgGenerator: 'wolf',
  },
  eagle: {
    category: 'animal',
    triggers: [
      'eagle', 'hawk', 'falcon', 'raptor', 'bird', 'avian', 'owl', 'raven',
      'crow', 'thunderbird', 'talon', 'beak', 'prey', 'soar',
      'majestic', 'noble', 'osprey', 'kestrel', 'harrier', 'buzzard',
      'vulture', 'condor', 'albatross', 'pelican', 'heron', 'crane',
      'stork', 'flamingo', 'peacock', 'pheasant', 'parrot', 'toucan',
    ],
    modifiers: ['golden', 'storm', 'war', 'divine', 'shadow', 'fire', 'ice'],
    combines: ['thunder', 'storm', 'sun', 'moon', 'star'],
    svgGenerator: 'eagle',
  },
  lion: {
    category: 'animal',
    triggers: [
      'lion', 'feline', 'tiger', 'panther', 'leopard', 'jaguar',
      'cheetah', 'cougar', 'lynx', 'puma', 'mane', 'pride', 'roar',
      'king of beasts', 'ocelot', 'caracal', 'serval',
      'bobcat', 'wildcat', 'sabertooth', 'sphinx', 'chimera', 'manticore',
    ],
    modifiers: ['golden', 'white', 'shadow', 'celestial', 'royal', 'war'],
    combines: ['fire', 'shadow', 'sun', 'gold', 'blood'],
    svgGenerator: 'lion',
  },
  dragon: {
    category: 'animal',
    triggers: [
      'dragon', 'drake', 'wyrm', 'wyvern', 'lindworm', 'hydra',
      'dragonborn', 'scales', 'breath', 'fire-breathing', 'elder',
      'legendary', 'mythical', 'hoard', 'lair', 'draco', 'lung', 'ryu',
      'naga', 'basilisk', 'cockatrice', 'amphisbaena', 'ouroboros',
      'leviathan', 'sea serpent', 'kraken', 'jormungandr', 'tiamat',
    ],
    modifiers: ['fire', 'ice', 'storm', 'shadow', 'elder', 'ancient', 'celestial', 'void'],
    combines: ['fire', 'ice', 'lightning', 'poison', 'shadow', 'void'],
    svgGenerator: 'dragon',
  },
  bear: {
    category: 'animal',
    triggers: [
      'bear', 'ursine', 'grizzly', 'polar', 'black bear', 'brown bear',
      'kodiak', 'panda', 'den', 'hibernate', 'claw', 'maul', 'strength',
      'powerful', 'cave bear', 'short-faced bear', 'sloth bear', 'sun bear',
      'spectacled bear', 'koala', 'wolverine', 'badger', 'honey badger',
    ],
    modifiers: ['dire', 'spirit', 'armored', 'frost', 'cave', 'war'],
    combines: ['frost', 'earth', 'spirit', 'war'],
    svgGenerator: 'bear',
  },
  snake: {
    category: 'animal',
    triggers: [
      'snake', 'serpent', 'viper', 'cobra', 'python', 'asp', 'adder', 'boa',
      'rattlesnake', 'lamia', 'medusa', 'coil', 'slither',
      'venom', 'poison', 'fang', 'anaconda', 'mamba', 'taipan',
      'copperhead', 'cottonmouth', 'coral snake', 'sea snake', 'king cobra',
    ],
    modifiers: ['poison', 'shadow', 'divine', 'cursed', 'fire', 'ice', 'void'],
    combines: ['poison', 'shadow', 'fire', 'void', 'death'],
    svgGenerator: 'snake',
  },
  phoenixbird: {
    category: 'animal',
    triggers: [
      'phoenix', 'firebird', 'rebirth', 'resurrection', 'immortal', 'eternal',
      'ashes', 'risen', 'reborn', 'undying', 'vermillion bird', 'suzaku',
      'bennu', 'simurgh', 'garuda', 'roc', 'fenghuang',
    ],
    modifiers: ['fire', 'golden', 'celestial', 'divine', 'shadow', 'ice'],
    combines: ['fire', 'sun', 'rebirth', 'light'],
    svgGenerator: 'phoenix',
  },
  horse: {
    category: 'animal',
    triggers: [
      'horse', 'stallion', 'mare', 'foal', 'colt', 'filly', 'steed', 'mount',
      'equine', 'mustang', 'thoroughbred', 'arabian', 'clydesdale', 'palomino',
      'pegasus', 'unicorn', 'nightmare', 'kelpie', 'hippocampus', 'centaur',
      'sleipnir', 'bucephalus', 'charger', 'destrier', 'courser', 'palfrey',
    ],
    modifiers: ['war', 'nightmare', 'celestial', 'shadow', 'fire', 'spectral'],
    combines: ['fire', 'shadow', 'lightning', 'death', 'divine'],
    svgGenerator: 'horse',
  },
  spider: {
    category: 'animal',
    triggers: [
      'spider', 'arachnid', 'web', 'silk', 'eight-legged', 'tarantula',
      'black widow', 'brown recluse', 'wolf spider', 'jumping spider',
      'orb weaver', 'trapdoor spider', 'scorpion', 'tick', 'mite',
    ],
    modifiers: ['giant', 'venomous', 'shadow', 'demon', 'crystal'],
    combines: ['poison', 'shadow', 'void', 'death'],
    svgGenerator: 'spider',
  },
  
  // ==================== ELEMENTS ====================
  fire: {
    category: 'element',
    triggers: [
      'fire', 'flame', 'burning', 'inferno', 'blaze', 'ember', 'ash', 'scorch',
      'sear', 'ignite', 'combust', 'conflagration', 'pyre', 'torch', 'bonfire',
      'wildfire', 'hellfire', 'volcanic', 'lava', 'magma', 'molten', 'heat',
      'warm', 'hot', 'kindle', 'smolder', 'spark', 'cinder', 'flicker',
      'cremation', 'immolation', 'pyromania', 'pyroclastic', 'incendiary',
    ],
    modifiers: ['eternal', 'hellish', 'divine', 'wild', 'cold', 'shadow', 'soul'],
    combines: ['shadow', 'ice', 'lightning', 'void', 'holy'],
    svgGenerator: 'fire',
  },
  ice: {
    category: 'element',
    triggers: [
      'ice', 'frost', 'frozen', 'glacial', 'cold', 'freeze', 'frigid', 'arctic',
      'polar', 'winter', 'snow', 'blizzard', 'hail', 'icicle', 'glacier',
      'permafrost', 'tundra', 'chill', 'frostbite', 'hypothermia', 'crystalline',
      'sleet', 'avalanche', 'snowflake', 'hoarfrost', 'rime', 'subzero',
    ],
    modifiers: ['eternal', 'cursed', 'divine', 'ancient', 'black', 'fire'],
    combines: ['fire', 'shadow', 'void', 'death', 'holy'],
    svgGenerator: 'ice',
  },
  lightning: {
    category: 'element',
    triggers: [
      'lightning', 'thunder', 'electric', 'electricity', 'storm', 'spark',
      'bolt', 'shock', 'voltage', 'current', 'static', 'charged', 'conductor',
      'tempest', 'cyclone', 'hurricane', 'tornado', 'weather', 'plasma',
      'arc', 'discharge', 'electrocute', 'galvanic', 'voltaic', 'thunderbolt',
    ],
    modifiers: ['divine', 'war', 'storm', 'chaos', 'blue', 'black'],
    combines: ['fire', 'ice', 'water', 'void', 'holy'],
    svgGenerator: 'lightning',
  },
  water: {
    category: 'element',
    triggers: [
      'water', 'aqua', 'wave', 'ocean', 'sea', 'river', 'stream', 'lake',
      'pond', 'rain', 'flood', 'tide', 'current', 'splash', 'drown',
      'submerge', 'dive', 'swim', 'mermaid', 'merman',
      'tsunami', 'whirlpool', 'maelstrom', 'rapids', 'waterfall', 'geyser',
      'spring', 'well', 'fountain', 'hydro', 'aquatic', 'maritime', 'nautical',
    ],
    modifiers: ['deep', 'sacred', 'cursed', 'primal', 'dark', 'holy'],
    combines: ['fire', 'ice', 'lightning', 'earth', 'void'],
    svgGenerator: 'water',
  },
  earth: {
    category: 'element',
    triggers: [
      'earth', 'stone', 'rock', 'mountain', 'ground', 'soil', 'dirt', 'clay',
      'sand', 'gem', 'jewel', 'mineral', 'ore', 'metal', 'iron',
      'steel', 'copper', 'bronze', 'quake', 'earthquake',
      'tremor', 'golem', 'granite', 'marble', 'obsidian', 'basite', 'slate',
      'limestone', 'sandstone', 'quarry', 'cave', 'cavern', 'stalactite',
    ],
    modifiers: ['primal', 'ancient', 'divine', 'cursed', 'living', 'crystal'],
    combines: ['fire', 'water', 'lightning', 'void', 'life'],
    svgGenerator: 'earth',
  },
  wind: {
    category: 'element',
    triggers: [
      'wind', 'air', 'breeze', 'gust', 'gale', 'zephyr',
      'whisper', 'howl', 'blow',
      'swift', 'fast', 'speed', 'draft', 'squall',
      'mistral', 'sirocco', 'monsoon', 'trade winds', 'jet stream',
    ],
    modifiers: ['divine', 'chaos', 'primal', 'gentle', 'cutting', 'howling'],
    combines: ['fire', 'ice', 'lightning', 'water', 'sand'],
    svgGenerator: 'wind',
  },
  void: {
    category: 'element',
    triggers: [
      'void', 'darkness', 'abyss', 'oblivion', 'null', 'nothing',
      'emptiness', 'vacuum', 'entropy', 'chaos', 'corruption', 'taint',
      'blight', 'decay', 'rot', 'wither', 'nihil', 'negation', 'annihilation',
      'nothingness', 'black hole', 'singularity', 'event horizon', 'dark matter',
    ],
    modifiers: ['eternal', 'consuming', 'eldritch', 'cosmic', 'primal'],
    combines: ['fire', 'ice', 'lightning', 'death', 'shadow'],
    svgGenerator: 'void',
  },
  light: {
    category: 'element',
    triggers: [
      'light', 'radiant', 'glow', 'shine', 'bright', 'luminous', 'beacon',
      'ray', 'beam', 'sun', 'solar', 'dawn', 'daybreak', 'illuminate',
      'brilliant', 'dazzle', 'sacred', 'celestial',
      'heaven', 'aurora', 'rainbow', 'prism', 'spectrum',
      'incandescent', 'fluorescent', 'phosphorescent', 'bioluminescent',
    ],
    modifiers: ['divine', 'celestial', 'pure', 'blinding', 'warm', 'cold'],
    combines: ['shadow', 'fire', 'holy', 'star', 'moon'],
    svgGenerator: 'light',
  },
  shadow: {
    category: 'element',
    triggers: [
      'shadow', 'shade', 'dark', 'umbra', 'penumbra', 'silhouette',
      'gloom', 'murk', 'dusk', 'twilight', 'nightfall', 'nocturnal', 'tenebrous',
      'obscure', 'eclipse', 'dim', 'dusky', 'somber', 'shroud',
    ],
    modifiers: ['living', 'consuming', 'cold', 'warm', 'solid'],
    combines: ['fire', 'ice', 'light', 'void', 'death'],
    svgGenerator: 'shadow',
  },
  
  // ==================== MATERIALS ====================
  golden: {
    category: 'material',
    triggers: [
      'gold', 'golden', 'gilded', 'aureate', 'auric', 'wealthy', 'rich',
      'treasure', 'precious', 'valuable', 'fortune', 'coin', 'bullion',
      'ingot', 'gilt', 'gold leaf', 'gold dust',
    ],
    modifiers: ['pure', 'ancient', 'cursed', 'divine', 'molten', 'fool'],
    combines: ['fire', 'light', 'holy', 'dragon'],
    svgGenerator: 'gold',
  },
  silver: {
    category: 'material',
    triggers: [
      'silver', 'argent', 'sterling', 'platinum', 'chrome', 'metallic',
      'quicksilver', 'mercury', 'lunar', 'moonsilver', 'mithril', 'electrum',
    ],
    modifiers: ['pure', 'cursed', 'blessed', 'lunar', 'living'],
    combines: ['moon', 'light', 'holy', 'wolf'],
    svgGenerator: 'silver',
  },
  crystal: {
    category: 'material',
    triggers: [
      'crystal', 'diamond', 'ruby', 'sapphire', 'emerald',
      'amethyst', 'topaz', 'opal', 'facet', 'sparkle', 'glitter',
      'shimmer', 'transparent', 'clear', 'quartz', 'tourmaline', 'garnet',
      'peridot', 'aquamarine', 'citrine', 'onyx', 'jade', 'turquoise',
      'lapis lazuli', 'moonstone', 'sunstone', 'bloodstone', 'alexandrite',
    ],
    modifiers: ['dark', 'light', 'blood', 'soul', 'dream', 'void'],
    combines: ['fire', 'ice', 'lightning', 'holy', 'shadow'],
    svgGenerator: 'crystal',
  },
  bone: {
    category: 'material',
    triggers: [
      'bone', 'bones', 'skeleton', 'skeletal', 'skull', 'rib', 'spine',
      'vertebrae', 'femur', 'tibia', 'humerus', 'mandible', 'ossified',
      'marrow', 'ivory', 'tusk', 'claw', 'fang',
    ],
    modifiers: ['ancient', 'cursed', 'blessed', 'dragon', 'demon', 'giant'],
    combines: ['death', 'shadow', 'void', 'spirit'],
    svgGenerator: 'bone',
  },
  
  // ==================== CELESTIAL ====================
  star: {
    category: 'celestial',
    triggers: [
      'star', 'stellar', 'astral', 'cosmic', 'constellation', 'galaxy',
      'nebula', 'supernova', 'comet', 'meteor', 'asteroid', 'heavenly', 'space', 'universe', 'cosmos', 'infinity',
      'north star', 'polaris', 'sirius', 'vega', 'rigel', 'betelgeuse',
      'pulsar', 'quasar', 'neutron star', 'white dwarf', 'red giant',
    ],
    modifiers: ['fallen', 'guiding', 'shooting', 'dying', 'newborn', 'ancient'],
    combines: ['fire', 'light', 'void', 'divine'],
    svgGenerator: 'star',
  },
  moon: {
    category: 'celestial',
    triggers: [
      'moon', 'lunar', 'crescent', 'full moon', 'moonlight', 'moonbeam',
      'tide', 'night', 'eclipse',
      'new moon', 'harvest moon', 'blood moon', 'blue moon',
      'supermoon', 'waxing', 'waning', 'gibbous', 'selenite', 'luna',
    ],
    modifiers: ['blood', 'silver', 'dark', 'blessed', 'cursed', 'eclipsed'],
    combines: ['shadow', 'light', 'water', 'wolf', 'madness'],
    svgGenerator: 'moon',
  },
  sun: {
    category: 'celestial',
    triggers: [
      'sun', 'sunlight', 'sunshine', 'sunrise', 'sunset',
      'daylight', 'brilliant', 'warm',
      'summer', 'solstice', 'equinox', 'helios', 'sol', 'ra', 'apollo',
      'corona', 'flare', 'prominence', 'photosphere', 'chromosphere',
    ],
    modifiers: ['eternal', 'dying', 'black', 'divine', 'cursed', 'newborn'],
    combines: ['fire', 'light', 'gold', 'holy', 'phoenix'],
    svgGenerator: 'sun',
  },
  
  // ==================== MUSIC & PERFORMANCE ====================
  mic: {
    category: 'music',
    triggers: [
      'mic', 'microphone', 'sing', 'singer', 'vocal', 'voice', 'choir',
      'chorus', 'harmony', 'melody', 'song', 'anthem', 'ballad', 'serenade',
      'aria', 'opera', 'concert', 'stage', 'perform', 'performer', 'karaoke',
      'rap', 'hip hop', 'spoken word', 'poetry slam', 'beatbox',
    ],
    modifiers: ['golden', 'enchanted', 'cursed', 'divine', 'spectral'],
    combines: ['thunder', 'lightning', 'holy', 'shadow'],
    svgGenerator: 'mic',
  },
  guitar: {
    category: 'music',
    triggers: [
      'guitar', 'bass', 'string', 'chord', 'riff', 'solo', 'acoustic',
      'electric', 'rock', 'metal', 'blues', 'jazz', 'folk', 'country',
      'musician', 'band', 'lute', 'mandolin', 'banjo', 'ukulele',
      'violin', 'fiddle', 'cello', 'harp', 'lyre', 'sitar', 'shamisen',
    ],
    modifiers: ['electric', 'acoustic', 'enchanted', 'legendary', 'cursed'],
    combines: ['fire', 'lightning', 'thunder', 'soul'],
    svgGenerator: 'guitar',
  },
  drums: {
    category: 'music',
    triggers: [
      'drum', 'drums', 'percussion', 'beat', 'rhythm', 'tribal', 'war drum',
      'timpani', 'cymbal', 'snare', 'bass drum', 'drumstick', 'march',
      'parade', 'taiko', 'djembe', 'bongo', 'conga', 'tabla', 'bodhrán',
    ],
    modifiers: ['war', 'tribal', 'thunder', 'ceremonial', 'cursed'],
    combines: ['thunder', 'war', 'spirit', 'fire'],
    svgGenerator: 'drums',
  },
  
  // ==================== TOOLS & TRADE ====================
  wrench: {
    category: 'tool',
    triggers: [
      'wrench', 'tool', 'mechanic', 'engineer', 'tinker', 'inventor', 'gadget',
      'device', 'machine', 'gear', 'cog', 'clockwork', 'steampunk', 'technician',
      'repair', 'fix', 'build', 'construct', 'screwdriver', 'pliers',
      'socket', 'ratchet', 'torque', 'calibrate', 'adjust', 'tune',
    ],
    modifiers: ['golden', 'enchanted', 'cursed', 'ancient', 'alien', 'steampunk'],
    combines: ['lightning', 'fire', 'steam', 'clockwork'],
    svgGenerator: 'wrench',
  },
  book: {
    category: 'tool',
    triggers: [
      'book', 'tome', 'grimoire', 'scroll', 'codex', 'manuscript', 'library',
      'archive', 'knowledge', 'wisdom', 'scholar', 'sage',
      'incantation', 'study', 'learn', 'read', 'write', 'scribe',
      'journal', 'diary', 'ledger', 'encyclopedia', 'dictionary', 'atlas',
      'almanac', 'compendium', 'treatise', 'thesis', 'scripture', 'holy book',
    ],
    modifiers: ['ancient', 'forbidden', 'sacred', 'cursed', 'blank', 'burning'],
    combines: ['fire', 'shadow', 'holy', 'void', 'death'],
    svgGenerator: 'book',
  },
  potion: {
    category: 'tool',
    triggers: [
      'potion', 'vial', 'elixir', 'brew', 'alchemy', 'alchemist', 'concoction',
      'mixture', 'tonic', 'remedy', 'cure', 'antidote', 'serum',
      'flask', 'bottle', 'cauldron', 'bubbling', 'simmer', 'distill',
      'transmute', 'philosopher stone', 'aqua vitae', 'panacea', 'nostrum',
    ],
    modifiers: ['healing', 'poison', 'love', 'strength', 'invisibility', 'transformation'],
    combines: ['fire', 'ice', 'lightning', 'life', 'death'],
    svgGenerator: 'potion',
  },
  
  // ==================== HOLY & DIVINE ====================
  holy: {
    category: 'divine',
    triggers: [
      'holy', 'divine', 'blessed', 'angelic', 'heavenly',
      'saint', 'martyr', 'prophet', 'messiah', 'savior', 'redemption',
      'salvation', 'miracle', 'prayer', 'worship', 'temple', 'church',
      'cathedral', 'monastery', 'pilgrim', 'crusade', 'paladin', 'cleric',
      'priest', 'priestess', 'bishop', 'pope', 'cardinal', 'deacon',
    ],
    modifiers: ['pure', 'eternal', 'radiant', 'ancient', 'corrupted'],
    combines: ['fire', 'light', 'water', 'earth', 'wind'],
    svgGenerator: 'holy',
  },
  angel: {
    category: 'divine',
    triggers: [
      'seraph', 'seraphim', 'cherub', 'cherubim', 'archangel',
      'guardian angel', 'fallen angel', 'nephilim',
      'heavenly host', 'michael', 'gabriel', 'raphael', 'uriel', 'lucifer',
      'halo', 'aureole', 'nimbus', 'wings of light', 'feathered wings',
    ],
    modifiers: ['fallen', 'guardian', 'avenging', 'death', 'mercy'],
    combines: ['light', 'fire', 'holy', 'death', 'war'],
    svgGenerator: 'angel',
  },
  
  // ==================== DARK & CURSED ====================
  cursed: {
    category: 'dark',
    triggers: [
      'curse', 'hex', 'jinx', 'bane', 'doom', 'damned', 'forsaken',
      'accursed', 'blighted', 'tainted', 'corrupted', 'evil', 'malevolent',
      'sinister', 'wicked', 'vile', 'nefarious', 'unholy', 'profane',
      'desecrated', 'malediction', 'anathema', 'execration', 'imprecation',
    ],
    modifiers: ['ancient', 'eternal', 'blood', 'soul', 'unbreakable'],
    combines: ['fire', 'ice', 'shadow', 'death', 'void'],
    svgGenerator: 'curse',
  },
  demon: {
    category: 'dark',
    triggers: [
      'devil', 'fiend', 'daemon', 'imp', 'succubus', 'incubus',
      'hellspawn', 'infernal', 'abyssal', 'pit fiend', 'balor', 'archdemon',
      'beelzebub', 'baal', 'asmodeus', 'mephistopheles', 'satan',
      'hell', 'brimstone', 'perdition', 'damnation', 'torment',
    ],
    modifiers: ['greater', 'lesser', 'ancient', 'bound', 'free', 'prince'],
    combines: ['fire', 'shadow', 'void', 'blood', 'soul'],
    svgGenerator: 'demon',
  },
  skull: {
    category: 'dark',
    triggers: [
      'death', 'dead', 'undead',
      'necromancer', 'necromancy', 'grave', 'graveyard', 'cemetery', 'crypt',
      'tomb', 'coffin', 'funeral', 'corpse', 'zombie', 'lich', 'reaper',
      'grim', 'ossuary', 'catacomb', 'mausoleum', 'mortuary', 'morgue',
    ],
    modifiers: ['flaming', 'crystal', 'golden', 'demon', 'dragon', 'giant'],
    combines: ['fire', 'shadow', 'void', 'death', 'soul'],
    svgGenerator: 'skull',
  },
  
  // ==================== ABSTRACT CONCEPTS ====================
  time: {
    category: 'abstract',
    triggers: [
      'time', 'temporal', 'chrono', 'clock', 'hourglass', 'sundial', 'watch',
      'moment', 'instant', 'eternity', 'forever', 'age', 'era', 'epoch',
      'past', 'present', 'future', 'yesterday', 'tomorrow', 'today',
      'timeless', 'ageless', 'mortal',
    ],
    modifiers: ['frozen', 'flowing', 'broken', 'infinite', 'limited'],
    combines: ['void', 'light', 'shadow', 'death', 'life'],
    svgGenerator: 'time',
  },
  soul: {
    category: 'abstract',
    triggers: [
      'spirit', 'essence', 'anima', 'psyche', 'consciousness', 'mind',
      'heart', 'core', 'being', 'existence', 'life force', 'chi', 'qi', 'ki',
      'prana', 'mana', 'aether', 'ether', 'ethereal', 'spectral',
    ],
    modifiers: ['lost', 'bound', 'free', 'shattered', 'whole', 'ancient'],
    combines: ['fire', 'void', 'light', 'shadow', 'death'],
    svgGenerator: 'soul',
  },
  death: {
    category: 'abstract',
    triggers: [
      'die', 'dying', 'mortality', 'lethal', 'fatal',
      'killing', 'slaughter', 'murder', 'assassination', 'execution',
      'thanatos', 'hades', 'underworld', 'afterlife',
      'beyond', 'burial', 'cremation', 'wake',
    ],
    modifiers: ['instant', 'slow', 'merciful', 'painful', 'eternal'],
    combines: ['shadow', 'void', 'ice', 'fire', 'soul'],
    svgGenerator: 'death',
  },
  life: {
    category: 'abstract',
    triggers: [
      'live', 'living', 'alive', 'vitality', 'vigor', 'health',
      'healing', 'regeneration', 'revival',
      'birth', 'creation', 'genesis', 'origin', 'beginning', 'growth',
      'flourish', 'thrive', 'prosper', 'bloom', 'spring',
    ],
    modifiers: ['eternal', 'fleeting', 'sacred', 'cursed', 'artificial'],
    combines: ['light', 'water', 'earth', 'holy', 'nature'],
    svgGenerator: 'life',
  },

  // ==================== EXPANDED: MYTHICAL CREATURES ====================
  unicorn: {
    category: 'creature_mythical',
    triggers: [
      'unicorn', 'alicorn', 'kirin', 'qilin', 'monoceros', 're\'em',
      'horned horse', 'horn of purity', 'maiden\'s steed', 'sacred mount',
    ],
    modifiers: ['celestial', 'dark', 'corrupted', 'rainbow', 'crystal', 'moonlit'],
    combines: ['light', 'holy', 'moon', 'star', 'rainbow'],
    svgGenerator: 'unicorn',
  },
  griffin: {
    category: 'creature_mythical',
    triggers: [
      'griffin', 'gryphon', 'griffon', 'hippogriff', 'opinicus', 'keythong',
      'lion-eagle', 'guardian beast', 'royal mount', 'treasure guardian',
    ],
    modifiers: ['golden', 'silver', 'war', 'royal', 'storm', 'fire'],
    combines: ['eagle', 'lion', 'gold', 'storm', 'holy'],
    svgGenerator: 'griffin',
  },
  chimera: {
    category: 'creature_mythical',
    triggers: [
      'chimera', 'chimaera', 'hybrid beast', 'three-headed', 'lion-goat-serpent',
      'monstrous hybrid', 'bellerophon\'s foe', 'fire-breather',
    ],
    modifiers: ['fire', 'shadow', 'chaos', 'ancient', 'cursed'],
    combines: ['fire', 'lion', 'snake', 'goat', 'chaos'],
    svgGenerator: 'chimera',
  },
  cerberus: {
    category: 'creature_mythical',
    triggers: [
      'cerberus', 'hellhound', 'three-headed dog', 'hades hound', 'gate guardian',
      'underworld dog', 'death dog', 'infernal hound', 'stygian beast',
    ],
    modifiers: ['fire', 'shadow', 'spectral', 'chained', 'rabid'],
    combines: ['fire', 'shadow', 'death', 'wolf', 'demon'],
    svgGenerator: 'cerberus',
  },
  minotaur: {
    category: 'creature_mythical',
    triggers: [
      'minotaur', 'bull-man', 'labyrinth dweller', 'asterion', 'taurus',
      'bull-headed', 'maze beast', 'cretan monster', 'bullkin',
    ],
    modifiers: ['bronze', 'shadow', 'fire', 'ancient', 'cursed', 'berserker'],
    combines: ['earth', 'war', 'shadow', 'blood', 'maze'],
    svgGenerator: 'minotaur',
  },
  hydra: {
    category: 'creature_mythical',
    triggers: [
      'hydra', 'lernaean', 'many-headed', 'regenerating', 'serpent hydra',
      'nine-headed', 'swamp serpent', 'hercules foe', 'immortal head',
    ],
    modifiers: ['poison', 'fire', 'ice', 'shadow', 'divine', 'chaos'],
    combines: ['poison', 'water', 'regeneration', 'snake', 'death'],
    svgGenerator: 'hydra',
  },
  pegasus: {
    category: 'creature_mythical',
    triggers: [
      'pegasus', 'winged horse', 'divine steed', 'bellerophon mount',
      'hippogryph', 'flying horse', 'celestial stallion', 'thunder steed',
    ],
    modifiers: ['divine', 'storm', 'shadow', 'fire', 'celestial', 'nightmare'],
    combines: ['lightning', 'wind', 'holy', 'star', 'cloud'],
    svgGenerator: 'pegasus',
  },
  kraken: {
    category: 'creature_mythical',
    triggers: [
      'kraken', 'leviathan', 'sea monster', 'giant squid', 'cthulhu',
      'deep one', 'tentacle beast', 'ocean terror', 'ship destroyer',
      'abyssal horror', 'elder thing', 'great old one', 'dagon',
    ],
    modifiers: ['ancient', 'abyssal', 'eldritch', 'colossal', 'spectral'],
    combines: ['water', 'void', 'shadow', 'chaos', 'madness'],
    svgGenerator: 'kraken',
  },
  
  // ==================== EXPANDED: UNDEAD & SPIRITS ====================
  ghost: {
    category: 'undead',
    triggers: [
      'ghost', 'specter', 'spectre', 'phantom', 'poltergeist', 'apparition',
      'haunt', 'haunting', 'haunted', 'ectoplasm', 'ethereal spirit',
      'restless spirit', 'revenant', 'shade', 'spook', 'wraith',
    ],
    modifiers: ['vengeful', 'peaceful', 'ancient', 'chained', 'wailing'],
    combines: ['shadow', 'ice', 'death', 'soul', 'moon'],
    svgGenerator: 'ghost',
  },
  zombie: {
    category: 'undead',
    triggers: [
      'zombie', 'undead', 'walking dead', 'risen', 'shambler', 'infected',
      'reanimated', 'corpse walker', 'flesh eater', 'brain eater',
      'horde', 'outbreak', 'apocalypse', 'plague bearer', 'draugr',
    ],
    modifiers: ['rotting', 'plague', 'frozen', 'burning', 'armored', 'fast'],
    combines: ['death', 'poison', 'shadow', 'plague', 'void'],
    svgGenerator: 'zombie',
  },
  vampire: {
    category: 'undead',
    triggers: [
      'vampire', 'vampyre', 'nosferatu', 'strigoi', 'blood drinker',
      'night stalker', 'immortal', 'undying', 'count', 'dracula',
      'bloodsucker', 'fang', 'fangs', 'coffin', 'thrall', 'dhampir',
    ],
    modifiers: ['ancient', 'noble', 'feral', 'shadow', 'blood', 'daywalker'],
    combines: ['blood', 'shadow', 'moon', 'bat', 'death'],
    svgGenerator: 'vampire',
  },
  lich: {
    category: 'undead',
    triggers: [
      'lich', 'lich king', 'phylactery', 'death mage', 'undead wizard',
      'skeletal mage', 'demilich', 'archlich', 'soul jar', 'eternal sorcerer',
    ],
    modifiers: ['ancient', 'arcane', 'frost', 'shadow', 'void', 'divine'],
    combines: ['death', 'shadow', 'ice', 'soul', 'void'],
    svgGenerator: 'lich',
  },
  banshee: {
    category: 'undead',
    triggers: [
      'banshee', 'wailing woman', 'bean sidhe', 'screamer', 'keening spirit',
      'death herald', 'mourning ghost', 'howling spirit', 'death cry',
    ],
    modifiers: ['vengeful', 'sorrowful', 'cursed', 'ancient', 'bound'],
    combines: ['death', 'shadow', 'ice', 'sound', 'soul'],
    svgGenerator: 'banshee',
  },
  mummy: {
    category: 'undead',
    triggers: [
      'mummy', 'pharaoh', 'embalmed', 'wrapped', 'sarcophagus', 'tomb king',
      'desert undead', 'curse bearer', 'ancient dead', 'egyptian undead',
      'bandaged', 'preserved', 'tomb guardian', 'anubis servant',
    ],
    modifiers: ['cursed', 'royal', 'ancient', 'sand', 'fire', 'plague'],
    combines: ['death', 'sand', 'fire', 'curse', 'gold'],
    svgGenerator: 'mummy',
  },

  // ==================== EXPANDED: PROFESSIONS & ROLES ====================
  assassin: {
    category: 'profession',
    triggers: [
      'assassin', 'hitman', 'killer', 'murderer', 'cutthroat', 'slayer',
      'executioner', 'death dealer', 'shadow blade', 'silent death',
      'contract killer', 'bounty hunter', 'eliminator', 'liquidator',
    ],
    modifiers: ['shadow', 'poison', 'blood', 'silent', 'cursed', 'divine'],
    combines: ['shadow', 'poison', 'death', 'blood', 'dagger'],
    svgGenerator: 'assassin',
  },
  pirate: {
    category: 'profession',
    triggers: [
      'pirate', 'buccaneer', 'corsair', 'privateer', 'freebooter', 'marauder',
      'sea dog', 'plunderer', 'captain', 'first mate', 'jolly roger',
      'swashbuckler', 'sea rover', 'treasure hunter', 'smuggler',
    ],
    modifiers: ['ghost', 'cursed', 'golden', 'storm', 'kraken'],
    combines: ['water', 'gold', 'skull', 'ship', 'storm'],
    svgGenerator: 'pirate',
  },
  ninja: {
    category: 'profession',
    triggers: [
      'ninja', 'shinobi', 'kunoichi', 'shadow warrior', 'silent killer',
      'ninjutsu', 'stealth', 'infiltrator', 'spy', 'saboteur', 'ronin',
      'assassin', 'shinobi-no-mono', 'iga', 'koga', 'hanzo',
    ],
    modifiers: ['shadow', 'fire', 'ice', 'lightning', 'void', 'smoke'],
    combines: ['shadow', 'smoke', 'blade', 'poison', 'wind'],
    svgGenerator: 'ninja',
  },
  monk: {
    category: 'profession',
    triggers: [
      'monk', 'martial artist', 'sensei', 'master', 'disciple', 'shaolin',
      'ki', 'chi', 'meditation', 'discipline', 'enlightened', 'ascetic',
      'hermit', 'pilgrim', 'wanderer', 'fist fighter', 'unarmed',
    ],
    modifiers: ['fire', 'lightning', 'void', 'holy', 'shadow', 'drunken'],
    combines: ['fire', 'lightning', 'holy', 'wind', 'earth'],
    svgGenerator: 'monk',
  },
  alchemist: {
    category: 'profession',
    triggers: [
      'alchemist', 'chemist', 'apothecary', 'herbalist', 'transmuter',
      'philosopher', 'elixir master', 'potion maker', 'experimenter',
      'laboratory', 'beaker', 'retort', 'athanor', 'crucible',
    ],
    modifiers: ['mad', 'genius', 'cursed', 'divine', 'void', 'explosive'],
    combines: ['fire', 'poison', 'gold', 'life', 'death'],
    svgGenerator: 'alchemist',
  },
  bard: {
    category: 'profession',
    triggers: [
      'bard', 'minstrel', 'troubadour', 'skald', 'poet', 'storyteller',
      'herald', 'jester', 'fool', 'entertainer', 'performer', 'musician',
      'singer', 'songwriter', 'tale spinner', 'lorekeeper', 'chronicler',
    ],
    modifiers: ['royal', 'wandering', 'cursed', 'blessed', 'legendary'],
    combines: ['sound', 'soul', 'charm', 'illusion', 'inspiration'],
    svgGenerator: 'bard',
  },
  necromancer: {
    category: 'profession',
    triggers: [
      'necromancer', 'death mage', 'corpse raiser', 'bone lord', 'soul binder',
      'spirit master', 'grave caller', 'dark summoner', 'lich aspirant',
      'death priest', 'carrion lord', 'flesh shaper', 'blood mage',
    ],
    modifiers: ['dark', 'cursed', 'ancient', 'blood', 'void', 'frost'],
    combines: ['death', 'shadow', 'soul', 'blood', 'bone'],
    svgGenerator: 'necromancer',
  },
  
  // ==================== EXPANDED: VEHICLES & MOUNTS ====================
  ship: {
    category: 'vehicle',
    triggers: [
      'ship', 'vessel', 'boat', 'galleon', 'frigate', 'carrack', 'caravel',
      'warship', 'flagship', 'dreadnought', 'man-o-war', 'brigantine',
      'schooner', 'clipper', 'yacht', 'longship', 'trireme', 'junk',
    ],
    modifiers: ['ghost', 'flying', 'cursed', 'golden', 'iron', 'storm'],
    combines: ['water', 'wind', 'storm', 'death', 'gold'],
    svgGenerator: 'ship',
  },
  chariot: {
    category: 'vehicle',
    triggers: [
      'chariot', 'war chariot', 'racing chariot', 'charioteer', 'quadriga',
      'biga', 'solar chariot', 'divine chariot', 'flying chariot',
    ],
    modifiers: ['war', 'divine', 'fire', 'storm', 'golden', 'shadow'],
    combines: ['fire', 'lightning', 'sun', 'war', 'horse'],
    svgGenerator: 'chariot',
  },
  carpet: {
    category: 'vehicle',
    triggers: [
      'carpet', 'flying carpet', 'magic carpet', 'persian rug', 'arabian carpet',
      'woven magic', 'enchanted rug', 'flying rug', 'levitating carpet',
    ],
    modifiers: ['ancient', 'royal', 'enchanted', 'cursed', 'wind'],
    combines: ['wind', 'magic', 'star', 'moon', 'sand'],
    svgGenerator: 'carpet',
  },

  // ==================== EXPANDED: ARCHITECTURE & PLACES ====================
  castle: {
    category: 'place',
    triggers: [
      'castle', 'fortress', 'citadel', 'stronghold', 'keep', 'bastion',
      'palace', 'manor', 'chateau', 'tower', 'rampart', 'battlement',
      'parapet', 'drawbridge', 'moat', 'dungeon', 'throne room',
    ],
    modifiers: ['dark', 'haunted', 'golden', 'ice', 'floating', 'ruined'],
    combines: ['shadow', 'stone', 'iron', 'ghost', 'royalty'],
    svgGenerator: 'castle',
  },
  temple: {
    category: 'place',
    triggers: [
      'temple', 'shrine', 'sanctuary', 'chapel', 'altar', 'tabernacle',
      'mosque', 'pagoda', 'ziggurat', 'pyramid', 'sacred place',
      'holy ground', 'consecrated', 'hallowed', 'blessed ground',
    ],
    modifiers: ['ancient', 'ruined', 'cursed', 'blessed', 'forgotten', 'sunken'],
    combines: ['holy', 'shadow', 'stone', 'gold', 'spirit'],
    svgGenerator: 'temple',
  },
  portal: {
    category: 'place',
    triggers: [
      'portal', 'gateway', 'doorway', 'gate', 'rift', 'tear', 'wormhole',
      'dimensional door', 'planar gate', 'stargate', 'teleporter',
      'warp', 'vortex', 'threshold', 'passage', 'nexus', 'convergence',
    ],
    modifiers: ['void', 'fire', 'ice', 'shadow', 'celestial', 'demonic'],
    combines: ['void', 'star', 'shadow', 'light', 'chaos'],
    svgGenerator: 'portal',
  },
  
  // ==================== EXPANDED: WEATHER & PHENOMENA ====================
  storm: {
    category: 'weather',
    triggers: [
      'storm', 'tempest', 'hurricane', 'cyclone', 'typhoon', 'tornado',
      'twister', 'whirlwind', 'thunderstorm', 'squall', 'monsoon',
      'supercell', 'maelstrom', 'dust devil', 'waterspout', 'derecho',
    ],
    modifiers: ['divine', 'demonic', 'eternal', 'chaotic', 'frozen'],
    combines: ['lightning', 'wind', 'water', 'ice', 'chaos'],
    svgGenerator: 'storm',
  },
  rainbow: {
    category: 'weather',
    triggers: [
      'rainbow', 'prismatic', 'spectrum', 'bifrost', 'arc', 'chromatic',
      'multicolor', 'seven colors', 'iridescent', 'opalescent',
    ],
    modifiers: ['divine', 'dark', 'fire', 'ice', 'celestial'],
    combines: ['light', 'water', 'holy', 'fae', 'dream'],
    svgGenerator: 'rainbow',
  },
  aurora: {
    category: 'weather',
    triggers: [
      'aurora', 'aurora borealis', 'northern lights', 'southern lights',
      'polar lights', 'dancing lights', 'sky curtain', 'celestial veil',
    ],
    modifiers: ['divine', 'spectral', 'eternal', 'prophetic'],
    combines: ['light', 'star', 'ice', 'spirit', 'magic'],
    svgGenerator: 'aurora',
  },

  // ==================== EXPANDED: GEMS & MINERALS ====================
  ruby: {
    category: 'gem',
    triggers: [
      'ruby', 'red gem', 'blood stone', 'crimson jewel', 'pigeon blood',
      'star ruby', 'burmese ruby', 'corundum', 'carbuncle',
    ],
    modifiers: ['fire', 'blood', 'ancient', 'cursed', 'blessed', 'star'],
    combines: ['fire', 'blood', 'passion', 'power', 'dragon'],
    svgGenerator: 'ruby',
  },
  sapphire: {
    category: 'gem',
    triggers: [
      'sapphire', 'blue gem', 'star sapphire', 'cornflower', 'kashmir',
      'padparadscha', 'blue corundum', 'celestial stone',
    ],
    modifiers: ['star', 'divine', 'ancient', 'cursed', 'blessed', 'ocean'],
    combines: ['water', 'sky', 'wisdom', 'royalty', 'moon'],
    svgGenerator: 'sapphire',
  },
  emerald: {
    category: 'gem',
    triggers: [
      'emerald', 'green gem', 'beryl', 'colombian', 'zambian',
      'verdant stone', 'green fire', 'nature\'s gem', 'forest jewel',
    ],
    modifiers: ['nature', 'poison', 'ancient', 'cursed', 'blessed', 'life'],
    combines: ['nature', 'life', 'poison', 'snake', 'forest'],
    svgGenerator: 'emerald',
  },
  diamond: {
    category: 'gem',
    triggers: [
      'diamond', 'brilliant', 'adamant', 'carbonado', 'hope diamond',
      'koh-i-noor', 'unbreakable', 'hardest', 'eternal gem', 'ice gem',
    ],
    modifiers: ['black', 'blue', 'pink', 'cursed', 'blessed', 'void'],
    combines: ['light', 'ice', 'eternity', 'royalty', 'perfection'],
    svgGenerator: 'diamond',
  },
  pearl: {
    category: 'gem',
    triggers: [
      'pearl', 'nacre', 'mother of pearl', 'black pearl', 'pink pearl',
      'baroque pearl', 'cultured pearl', 'south sea', 'akoya', 'tahitian',
    ],
    modifiers: ['black', 'golden', 'cursed', 'blessed', 'moon', 'ocean'],
    combines: ['water', 'moon', 'purity', 'wisdom', 'ocean'],
    svgGenerator: 'pearl',
  },

  // ==================== EXPANDED: FOOD & DRINK ====================
  bread: {
    category: 'food',
    triggers: [
      'bread', 'loaf', 'baguette', 'sourdough', 'wheat', 'rye', 'pumpernickel',
      'focaccia', 'ciabatta', 'brioche', 'challah', 'pita', 'naan',
      'baker', 'bakery', 'oven', 'yeast', 'dough', 'crust',
    ],
    modifiers: ['sacred', 'poisoned', 'enchanted', 'stale', 'fresh', 'golden'],
    combines: ['life', 'holy', 'earth', 'fire', 'sustenance'],
    svgGenerator: 'bread',
  },
  wine: {
    category: 'drink',
    triggers: [
      'wine', 'vino', 'vintage', 'red wine', 'white wine', 'mead', 'champagne',
      'goblet', 'chalice', 'vineyard', 'grapes', 'sommelier', 'vintage',
      'burgundy', 'bordeaux', 'cabernet', 'merlot', 'chardonnay',
    ],
    modifiers: ['blood', 'divine', 'poisoned', 'enchanted', 'aged', 'cursed'],
    combines: ['blood', 'holy', 'poison', 'celebration', 'intoxication'],
    svgGenerator: 'wine',
  },
  apple: {
    category: 'food',
    triggers: [
      'apple', 'fruit', 'forbidden fruit', 'golden apple', 'eden', 'orchard',
      'cider', 'pomme', 'malus', 'discord', 'avalon', 'knowledge',
    ],
    modifiers: ['golden', 'poisoned', 'blessed', 'forbidden', 'silver', 'crystal'],
    combines: ['knowledge', 'poison', 'gold', 'life', 'temptation'],
    svgGenerator: 'apple',
  },

  // ==================== EXPANDED: EMOTIONS & STATES ====================
  rage: {
    category: 'emotion',
    triggers: [
      'rage', 'fury', 'wrath', 'anger', 'berserker', 'rampage', 'frenzy',
      'bloodlust', 'madness', 'hysteria', 'tantrum', 'outburst', 'ire',
    ],
    modifiers: ['blood', 'fire', 'holy', 'cursed', 'primal', 'cold'],
    combines: ['fire', 'blood', 'war', 'beast', 'chaos'],
    svgGenerator: 'rage',
  },
  fear: {
    category: 'emotion',
    triggers: [
      'fear', 'terror', 'dread', 'horror', 'panic', 'fright', 'phobia',
      'nightmare', 'anxiety', 'paranoia', 'cowardice', 'intimidation',
    ],
    modifiers: ['primal', 'supernatural', 'cursed', 'divine', 'frozen'],
    combines: ['shadow', 'death', 'void', 'madness', 'nightmare'],
    svgGenerator: 'fear',
  },
  love: {
    category: 'emotion',
    triggers: [
      'love', 'romance', 'passion', 'desire', 'affection', 'devotion',
      'cupid', 'eros', 'aphrodite', 'venus', 'heart', 'soulmate',
      'beloved', 'sweetheart', 'darling', 'amour', 'amore',
    ],
    modifiers: ['eternal', 'forbidden', 'cursed', 'divine', 'tragic', 'first'],
    combines: ['fire', 'heart', 'soul', 'light', 'rose'],
    svgGenerator: 'love',
  },
  hope: {
    category: 'emotion',
    triggers: [
      'hope', 'optimism', 'faith', 'belief', 'aspiration', 'dream', 'wish',
      'prayer', 'miracle', 'salvation', 'redemption', 'dawn', 'light',
    ],
    modifiers: ['eternal', 'fading', 'divine', 'false', 'renewed'],
    combines: ['light', 'star', 'dawn', 'holy', 'life'],
    svgGenerator: 'hope',
  },
  despair: {
    category: 'emotion',
    triggers: [
      'despair', 'hopelessness', 'anguish', 'misery', 'sorrow', 'grief',
      'melancholy', 'depression', 'gloom', 'desolation', 'emptiness',
    ],
    modifiers: ['eternal', 'crushing', 'void', 'cold', 'silent'],
    combines: ['shadow', 'void', 'death', 'ice', 'silence'],
    svgGenerator: 'despair',
  },

  // ==================== EXPANDED: WARFARE & COMBAT ====================
  siege: {
    category: 'warfare',
    triggers: [
      'siege', 'assault', 'blockade', 'bombardment', 'catapult', 'trebuchet',
      'battering ram', 'siege tower', 'ballista', 'mangonel', 'onager',
      'encirclement', 'fortification', 'defense', 'breach', 'scaling',
    ],
    modifiers: ['fire', 'ice', 'shadow', 'divine', 'demonic', 'endless'],
    combines: ['fire', 'stone', 'war', 'death', 'destruction'],
    svgGenerator: 'siege',
  },
  cavalry: {
    category: 'warfare',
    triggers: [
      'cavalry', 'horseman', 'knight', 'lancer', 'dragoon', 'hussar',
      'charge', 'mounted', 'rider', 'joust', 'tournament', 'destrier',
    ],
    modifiers: ['heavy', 'light', 'divine', 'demonic', 'spectral', 'royal'],
    combines: ['horse', 'lance', 'war', 'thunder', 'honor'],
    svgGenerator: 'cavalry',
  },
  arrow: {
    category: 'warfare',
    triggers: [
      'arrow', 'bolt', 'quarrel', 'shaft', 'fletching', 'broadhead',
      'bodkin', 'barbed', 'whistling arrow', 'fire arrow', 'volley',
    ],
    modifiers: ['fire', 'ice', 'poison', 'lightning', 'holy', 'cursed'],
    combines: ['fire', 'ice', 'poison', 'lightning', 'death'],
    svgGenerator: 'arrow',
  },
  
  // ==================== EXPANDED: FABRICS & TEXTILES ====================
  silk: {
    category: 'material',
    triggers: [
      'silk', 'silken', 'satin', 'velvet', 'brocade', 'damask', 'taffeta',
      'chiffon', 'organza', 'gossamer', 'spider silk', 'moonweave',
    ],
    modifiers: ['spider', 'moon', 'shadow', 'golden', 'enchanted'],
    combines: ['spider', 'moon', 'shadow', 'nobility', 'magic'],
    svgGenerator: 'silk',
  },
  leather: {
    category: 'material',
    triggers: [
      'leather', 'hide', 'pelt', 'skin', 'tanned', 'rawhide', 'suede',
      'studded', 'boiled leather', 'dragonhide', 'snakeskin', 'scale',
    ],
    modifiers: ['dragon', 'demon', 'hardened', 'enchanted', 'cursed'],
    combines: ['beast', 'dragon', 'protection', 'stealth', 'nature'],
    svgGenerator: 'leather',
  },
  
  // ==================== EXPANDED: SYMBOLS & GLYPHS ====================
  rune: {
    category: 'symbol',
    triggers: [
      'rune', 'glyph', 'sigil', 'symbol', 'mark', 'inscription', 'carving',
      'futhark', 'elder futhark', 'younger futhark', 'ogham', 'hieroglyph',
      'cuneiform', 'pictograph', 'ideograph', 'seal', 'brand', 'tattoo',
    ],
    modifiers: ['ancient', 'forbidden', 'protective', 'cursed', 'divine', 'void'],
    combines: ['magic', 'protection', 'curse', 'blessing', 'power'],
    svgGenerator: 'rune',
  },
  pentagram: {
    category: 'symbol',
    triggers: [
      'pentagram', 'pentacle', 'five-pointed star', 'seal of solomon',
      'inverted star', 'wiccan star', 'elemental star', 'protection circle',
    ],
    modifiers: ['inverted', 'protective', 'summoning', 'binding', 'holy', 'demonic'],
    combines: ['demon', 'protection', 'element', 'spirit', 'binding'],
    svgGenerator: 'pentagram',
  },
  ankh: {
    category: 'symbol',
    triggers: [
      'ankh', 'key of life', 'crux ansata', 'egyptian cross', 'life symbol',
      'breath of life', 'eternal life', 'immortality symbol',
    ],
    modifiers: ['golden', 'divine', 'cursed', 'ancient', 'radiant'],
    combines: ['life', 'death', 'sun', 'eternity', 'divine'],
    svgGenerator: 'ankh',
  },
  yin_yang: {
    category: 'symbol',
    triggers: [
      'yin yang', 'taijitu', 'balance', 'duality', 'harmony', 'opposites',
      'light and dark', 'male female', 'hot cold', 'complementary',
    ],
    modifiers: ['corrupted', 'perfect', 'shifting', 'eternal', 'cosmic'],
    combines: ['light', 'shadow', 'balance', 'harmony', 'cosmos'],
    svgGenerator: 'yin_yang',
  },

  // ==================== EXPANDED: SCIENCE & TECHNOLOGY ====================
  atom: {
    category: 'science',
    triggers: [
      'atom', 'atomic', 'nuclear', 'electron', 'proton', 'neutron',
      'particle', 'subatomic', 'quantum', 'quark', 'lepton', 'boson',
      'hadron', 'photon', 'neutrino', 'antimatter', 'fusion', 'fission',
    ],
    modifiers: ['unstable', 'charged', 'radioactive', 'quantum', 'dark'],
    combines: ['energy', 'destruction', 'creation', 'light', 'void'],
    svgGenerator: 'atom',
  },
  dna: {
    category: 'science',
    triggers: [
      'dna', 'helix', 'double helix', 'genetic', 'genome', 'chromosome',
      'gene', 'mutation', 'evolution', 'rna', 'nucleotide', 'amino acid',
    ],
    modifiers: ['mutated', 'enhanced', 'corrupted', 'divine', 'alien'],
    combines: ['life', 'mutation', 'evolution', 'creation', 'chaos'],
    svgGenerator: 'dna',
  },
  robot: {
    category: 'technology',
    triggers: [
      'robot', 'android', 'automaton', 'mech', 'mecha', 'droid', 'bot',
      'cyborg', 'machine', 'ai', 'artificial', 'synthetic', 'mechanical',
      'servo', 'hydraulic', 'pneumatic', 'exoskeleton', 'power armor',
    ],
    modifiers: ['war', 'servant', 'sentient', 'ancient', 'alien', 'divine'],
    combines: ['lightning', 'steel', 'war', 'void', 'ai'],
    svgGenerator: 'robot',
  },
  laser: {
    category: 'technology',
    triggers: [
      'laser', 'beam', 'ray', 'photon beam', 'light beam', 'death ray',
      'particle beam', 'plasma beam', 'energy weapon', 'blaster',
    ],
    modifiers: ['plasma', 'void', 'divine', 'demonic', 'quantum'],
    combines: ['light', 'fire', 'energy', 'destruction', 'precision'],
    svgGenerator: 'laser',
  },
};

// ============================================================================
// KEYWORD COMBINATION SYSTEM
// ============================================================================

export interface CombinedItem {
  primary: string;
  modifier: string;
  combined: string;
  category: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

const COMBINATION_RESULTS: Record<string, Record<string, { name: string; rarity: CombinedItem['rarity'] }>> = {
  sword: {
    fire: { name: 'Flaming Sword', rarity: 'uncommon' },
    ice: { name: 'Frostbrand', rarity: 'uncommon' },
    lightning: { name: 'Thunderblade', rarity: 'rare' },
    holy: { name: 'Holy Avenger', rarity: 'epic' },
    dark: { name: 'Shadowbane', rarity: 'rare' },
    dragon: { name: 'Dragonslayer', rarity: 'epic' },
    demon: { name: 'Demonbane', rarity: 'epic' },
    angel: { name: 'Seraphim Blade', rarity: 'legendary' },
    void: { name: 'Voidcutter', rarity: 'legendary' },
    soul: { name: 'Soul Reaver', rarity: 'legendary' },
  },
  shield: {
    holy: { name: 'Aegis of Light', rarity: 'epic' },
    dragon: { name: 'Dragonscale Shield', rarity: 'rare' },
    lion: { name: 'Lion\'s Courage', rarity: 'uncommon' },
    eagle: { name: 'Eagle\'s Guard', rarity: 'uncommon' },
    wolf: { name: 'Wolfpack Defender', rarity: 'rare' },
    fire: { name: 'Embershield', rarity: 'uncommon' },
    ice: { name: 'Frostguard', rarity: 'uncommon' },
    void: { name: 'Nullifier', rarity: 'legendary' },
  },
  crown: {
    fire: { name: 'Crown of Flames', rarity: 'rare' },
    ice: { name: 'Frozen Crown', rarity: 'rare' },
    shadow: { name: 'Shadow Crown', rarity: 'epic' },
    holy: { name: 'Halo Crown', rarity: 'epic' },
    void: { name: 'Crown of Oblivion', rarity: 'legendary' },
    dragon: { name: 'Dragon Crown', rarity: 'epic' },
    demon: { name: 'Infernal Crown', rarity: 'epic' },
    golden: { name: 'Golden Diadem', rarity: 'uncommon' },
  },
  wings: {
    angel: { name: 'Seraphim Wings', rarity: 'epic' },
    demon: { name: 'Hellwings', rarity: 'epic' },
    dragon: { name: 'Dragon Wings', rarity: 'rare' },
    fire: { name: 'Phoenix Wings', rarity: 'rare' },
    ice: { name: 'Frostwings', rarity: 'uncommon' },
    shadow: { name: 'Shadow Wings', rarity: 'rare' },
    lightning: { name: 'Storm Wings', rarity: 'rare' },
    void: { name: 'Void Wings', rarity: 'legendary' },
  },
  staff: {
    fire: { name: 'Staff of Flames', rarity: 'uncommon' },
    ice: { name: 'Staff of Frost', rarity: 'uncommon' },
    lightning: { name: 'Thunderstaff', rarity: 'rare' },
    void: { name: 'Staff of the Void', rarity: 'legendary' },
    nature: { name: 'Druidic Staff', rarity: 'rare' },
    holy: { name: 'Holy Scepter', rarity: 'epic' },
    dark: { name: 'Staff of Shadows', rarity: 'rare' },
    death: { name: 'Lich Staff', rarity: 'epic' },
  },
  axe: {
    blood: { name: 'Bloodaxe', rarity: 'rare' },
    thunder: { name: 'Thunderaxe', rarity: 'rare' },
    ice: { name: 'Frostaxe', rarity: 'uncommon' },
    fire: { name: 'Blazeaxe', rarity: 'uncommon' },
  },
  bow: {
    fire: { name: 'Phoenix Bow', rarity: 'rare' },
    ice: { name: 'Frostshot', rarity: 'uncommon' },
    lightning: { name: 'Thunderbow', rarity: 'rare' },
    poison: { name: 'Venomstrike', rarity: 'rare' },
    shadow: { name: 'Shadowshot', rarity: 'epic' },
  },
  dagger: {
    poison: { name: 'Venomblade', rarity: 'rare' },
    shadow: { name: 'Shadowfang', rarity: 'epic' },
    blood: { name: 'Bloodletter', rarity: 'rare' },
    soul: { name: 'Soul Siphon', rarity: 'legendary' },
  },
};

export function combineKeywords(primary: string, modifier: string): CombinedItem | null {
  const primaryData = LEXICON[primary];
  const modifierData = LEXICON[modifier];
  
  if (!primaryData || !modifierData) return null;
  if (!primaryData.combines?.includes(modifier)) return null;
  
  const combination = COMBINATION_RESULTS[primary]?.[modifier];
  
  if (combination) {
    return {
      primary,
      modifier,
      combined: combination.name,
      category: primaryData.category,
      rarity: combination.rarity,
    };
  }
  
  // Default combination if not explicitly defined
  return {
    primary,
    modifier,
    combined: `${modifier.charAt(0).toUpperCase() + modifier.slice(1)} ${primary.charAt(0).toUpperCase() + primary.slice(1)}`,
    category: primaryData.category,
    rarity: 'common',
  };
}

// Build regex patterns from lexicon
export function buildKeywordPatterns(): Record<string, RegExp> {
  const patterns: Record<string, RegExp> = {};
  
  for (const [keyword, data] of Object.entries(LEXICON)) {
    const escapedTriggers = data.triggers.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    patterns[keyword] = new RegExp(`\\b(${escapedTriggers.join('|')})\\b`, 'i');
  }
  
  return patterns;
}

// Parse text for keywords with modifiers and combinations
export function parseTextForItems(text: string): {
  items: { keyword: string; modifier?: string; category: string }[];
  combinations: CombinedItem[];
} {
  const patterns = buildKeywordPatterns();
  const foundKeywords: string[] = [];
  const items: { keyword: string; modifier?: string; category: string }[] = [];
  
  for (const [keyword, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) {
      foundKeywords.push(keyword);
      const data = LEXICON[keyword];
      
      let modifier: string | undefined;
      if (data.modifiers) {
        for (const mod of data.modifiers) {
          if (new RegExp(`\\b${mod}\\b`, 'i').test(text)) {
            modifier = mod;
            break;
          }
        }
      }
      
      items.push({ keyword, modifier, category: data.category });
    }
  }
  
  const combinations: CombinedItem[] = [];
  for (let i = 0; i < foundKeywords.length; i++) {
    for (let j = i + 1; j < foundKeywords.length; j++) {
      const combo1 = combineKeywords(foundKeywords[i], foundKeywords[j]);
      const combo2 = combineKeywords(foundKeywords[j], foundKeywords[i]);
      if (combo1) combinations.push(combo1);
      if (combo2) combinations.push(combo2);
    }
  }
  
  return { items, combinations };
}

// ============================================================================
// CLASS UNIFORMS & OCCUPATION GEAR
// ============================================================================

export interface ClassUniform {
  class: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headgear?: string;
  torso: string;
  accessories: string[];
  weapon?: string;
  svgPaths: string[];
}

export const CLASS_UNIFORMS: Record<string, ClassUniform> = {
  Warrior: {
    class: 'Warrior',
    primaryColor: '#8B4513',
    secondaryColor: '#CD853F',
    accentColor: '#FFD700',
    headgear: 'helm',
    torso: 'breastplate',
    accessories: ['pauldrons', 'gauntlets', 'belt'],
    weapon: 'sword',
    svgPaths: [
      `M160,180 Q200,170 240,180 L250,280 Q200,300 150,280 Z`,
      `M140,180 Q130,160 140,140 L170,150 Q165,170 160,180 Z`,
      `M260,180 Q270,160 260,140 L230,150 Q235,170 240,180 Z`,
      `M150,275 L250,275 L255,290 L145,290 Z`,
      `M190,275 L210,275 L210,290 L190,290 Z`,
    ],
  },
  Mage: {
    class: 'Mage',
    primaryColor: '#4B0082',
    secondaryColor: '#8A2BE2',
    accentColor: '#00CED1',
    headgear: 'wizard_hat',
    torso: 'robe',
    accessories: ['sash', 'amulet', 'bracers'],
    weapon: 'staff',
    svgPaths: [
      `M150,180 Q200,160 250,180 L270,400 Q200,420 130,400 Z`,
      `M160,180 Q200,170 240,180 L235,200 Q200,190 165,200 Z`,
      `M170,250 L230,250 L240,400 L160,400 Z`,
      `M190,210 L210,210 L205,230 L195,230 Z`,
      `M180,300 L183,308 L175,304 L185,304 L177,308 Z`,
      `M220,280 L223,288 L215,284 L225,284 L217,288 Z`,
    ],
  },
  Rogue: {
    class: 'Rogue',
    primaryColor: '#2F4F4F',
    secondaryColor: '#696969',
    accentColor: '#C0C0C0',
    headgear: 'hood',
    torso: 'leather_vest',
    accessories: ['belt', 'pouches', 'bracers'],
    weapon: 'dagger',
    svgPaths: [
      `M160,100 Q200,80 240,100 Q250,130 240,150 L200,140 L160,150 Q150,130 160,100 Z`,
      `M155,180 Q200,170 245,180 L250,280 Q200,290 150,280 Z`,
      `M160,180 L240,280 M240,180 L160,280`,
      `M150,275 L250,275 L255,290 L145,290 Z`,
      `M165,275 L175,275 L175,300 L165,300 Z`,
      `M225,275 L235,275 L235,300 L225,300 Z`,
    ],
  },
  Healer: {
    class: 'Healer',
    primaryColor: '#F5F5DC',
    secondaryColor: '#FFFACD',
    accentColor: '#FFD700',
    headgear: 'circlet',
    torso: 'vestment',
    accessories: ['holy_symbol', 'sash'],
    weapon: 'staff',
    svgPaths: [
      `M150,180 Q200,170 250,180 L260,400 Q200,420 140,400 Z`,
      `M195,200 L205,200 L205,230 L215,230 L215,240 L205,240 L205,260 L195,260 L195,240 L185,240 L185,230 L195,230 Z`,
      `M180,260 L220,260 L230,400 L170,400 Z`,
      `M160,110 Q200,100 240,110 L235,120 Q200,112 165,120 Z`,
    ],
  },
  Ranger: {
    class: 'Ranger',
    primaryColor: '#228B22',
    secondaryColor: '#8B4513',
    accentColor: '#DAA520',
    headgear: 'hood',
    torso: 'tunic',
    accessories: ['cloak', 'quiver', 'belt'],
    weapon: 'bow',
    svgPaths: [
      `M140,120 Q200,100 260,120 L280,400 Q200,420 120,400 Z`,
      `M160,180 Q200,170 240,180 L245,320 Q200,330 155,320 Z`,
      `M250,160 L270,160 L275,280 L245,280 Z`,
      `M255,165 L260,155 L265,165`,
      `M155,310 L245,310 L250,325 L150,325 Z`,
    ],
  },
  Paladin: {
    class: 'Paladin',
    primaryColor: '#C0C0C0',
    secondaryColor: '#FFD700',
    accentColor: '#4169E1',
    headgear: 'helm',
    torso: 'plate_armor',
    accessories: ['cape', 'holy_symbol', 'gauntlets'],
    weapon: 'sword',
    svgPaths: [
      `M155,180 Q200,165 245,180 L255,300 Q200,320 145,300 Z`,
      `M150,180 L130,400 Q200,380 270,400 L250,180`,
      `M190,200 L210,200 L210,210 L220,210 L220,220 L210,220 L210,240 L190,240 L190,220 L180,220 L180,210 L190,210 Z`,
      `M135,180 Q125,155 140,135 L175,150 Q165,175 155,180 Z`,
      `M265,180 Q275,155 260,135 L225,150 Q235,175 245,180 Z`,
    ],
  },
};

export const OCCUPATION_GEAR: Record<string, {
  occupation: string;
  tools: string[];
  clothing: string;
  accessories: string[];
  svgPaths: string[];
}> = {
  Blacksmith: {
    occupation: 'Blacksmith',
    tools: ['hammer', 'tongs', 'anvil'],
    clothing: 'leather_apron',
    accessories: ['gloves', 'goggles'],
    svgPaths: [
      `M160,200 L240,200 L250,400 L150,400 Z`,
      `M170,180 L180,200 M220,200 L230,180`,
      `M180,300 L220,300 L220,350 L180,350 Z`,
      `M240,280 L260,280 L260,320 L255,330 L245,330 L240,320 Z`,
    ],
  },
  Scholar: {
    occupation: 'Scholar',
    tools: ['book', 'quill', 'scroll'],
    clothing: 'academic_robe',
    accessories: ['glasses', 'pendant'],
    svgPaths: [
      `M145,180 Q200,165 255,180 L270,400 Q200,420 130,400 Z`,
      `M230,250 L280,250 L280,310 L230,310 Z`,
      `M235,255 L275,255 L275,305 L235,305`,
      `M175,115 L190,115 L190,125 L175,125 Z M210,115 L225,115 L225,125 L210,125 Z M190,118 L210,118`,
    ],
  },
  Merchant: {
    occupation: 'Merchant',
    tools: ['scales', 'coins', 'ledger'],
    clothing: 'fine_clothes',
    accessories: ['coin_purse', 'rings'],
    svgPaths: [
      `M150,180 Q200,170 250,180 L255,350 Q200,360 145,350 Z`,
      `M170,185 Q200,180 230,185 L235,280 Q200,290 165,280 Z`,
      `M230,275 Q250,275 250,300 Q250,320 230,320 Q210,320 210,300 Q210,275 230,275 Z`,
      `M225,290 L235,290 M225,300 L235,300`,
    ],
  },
  Hunter: {
    occupation: 'Hunter',
    tools: ['bow', 'traps', 'skinning_knife'],
    clothing: 'furs',
    accessories: ['pelt', 'tooth_necklace'],
    svgPaths: [
      `M145,180 Q200,165 255,180 L265,400 Q200,420 135,400 Z`,
      `M150,180 Q200,170 250,180 Q245,195 200,190 Q155,195 150,180 Z`,
      `M180,190 L185,200 L180,200 Z M195,192 L200,202 L195,202 Z M210,192 L215,202 L210,202 Z M220,190 L225,200 L220,200 Z`,
      `M140,200 Q130,250 140,300 L150,290 Q145,250 150,210 Z`,
    ],
  },
  Artist: {
    occupation: 'Artist',
    tools: ['brush', 'palette', 'canvas'],
    clothing: 'smock',
    accessories: ['beret', 'paint_stains'],
    svgPaths: [
      `M150,180 Q200,170 250,180 L260,380 Q200,400 140,380 Z`,
      `M180,220 Q190,210 200,220 Q190,230 180,220 Z`,
      `M220,250 Q225,245 230,250 Q225,255 220,250 Z`,
      `M170,300 Q180,290 190,300 Q180,310 170,300 Z`,
      `M155,95 Q200,80 245,95 Q250,110 240,115 L160,115 Q150,110 155,95 Z`,
      `M235,350 L240,300 L245,300 L250,350`,
    ],
  },
  Guard: {
    occupation: 'Guard',
    tools: ['spear', 'shield'],
    clothing: 'uniform',
    accessories: ['badge', 'helm'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L250,320 Q200,330 150,320 Z`,
      `M190,200 L210,200 L215,220 L200,230 L185,220 Z`,
      `M150,310 L250,310 L255,325 L145,325 Z`,
      `M160,90 Q200,75 240,90 L245,120 Q200,130 155,120 Z`,
      `M195,70 L200,90 L205,70 Q200,60 195,70 Z`,
    ],
  },
  Alchemist: {
    occupation: 'Alchemist',
    tools: ['potion', 'mortar', 'flask'],
    clothing: 'lab_coat',
    accessories: ['goggles', 'belt_vials'],
    svgPaths: [
      `M150,180 Q200,170 250,180 L260,400 Q200,420 140,400 Z`,
      `M240,250 L260,240 L270,260 L265,290 L255,300 L240,290 Z`,
      `M245,255 L260,248 L265,265 L260,285 L250,292 L245,280 Z`,
      `M170,300 L190,300 L195,280 L185,280 L185,260 L175,260 L175,280 L165,280 Z`,
    ],
  },
  Farmer: {
    occupation: 'Farmer',
    tools: ['pitchfork', 'hoe', 'basket'],
    clothing: 'overalls',
    accessories: ['straw_hat', 'gloves'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L250,400 Q200,410 150,400 Z`,
      `M155,95 Q200,75 245,95 Q255,105 250,115 L150,115 Q145,105 155,95 Z`,
      `M260,180 L265,180 L268,350 L262,360 L255,350 Z`,
      `M262,185 L268,180 M262,210 L268,205 M262,235 L268,230`,
    ],
  },
  Sailor: {
    occupation: 'Sailor',
    tools: ['rope', 'compass', 'telescope'],
    clothing: 'naval_jacket',
    accessories: ['bandana', 'earring'],
    svgPaths: [
      `M155,180 Q200,165 245,180 L250,350 Q200,360 150,350 Z`,
      `M170,190 L230,190 L225,210 L175,210 Z`,
      `M185,340 L215,340 L218,360 L182,360 Z`,
      `M190,345 L200,330 L210,345 Z`,
    ],
  },
  Miner: {
    occupation: 'Miner',
    tools: ['pickaxe', 'lantern', 'cart'],
    clothing: 'coveralls',
    accessories: ['helmet_lamp', 'gloves'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L248,400 Q200,410 152,400 Z`,
      `M160,90 Q200,70 240,90 L245,110 Q200,120 155,110 Z`,
      `M195,75 L200,60 L205,75 L210,65 L215,80`,
      `M260,200 L270,200 L272,340 L258,340 Z`,
    ],
  },
  Tailor: {
    occupation: 'Tailor',
    tools: ['needle', 'scissors', 'thread'],
    clothing: 'vest',
    accessories: ['measuring_tape', 'thimble'],
    svgPaths: [
      `M160,180 Q200,170 240,180 L245,380 Q200,395 155,380 Z`,
      `M170,190 Q200,185 230,190 L228,250 Q200,255 172,250 Z`,
      `M240,280 L260,275 L258,310 L262,312 L258,320 L240,315 Z`,
      `M180,350 Q200,345 220,350 Q215,365 200,368 Q185,365 180,350 Z`,
    ],
  },
  Cook: {
    occupation: 'Cook',
    tools: ['ladle', 'pot', 'knife'],
    clothing: 'chef_coat',
    accessories: ['chef_hat', 'apron'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L248,400 Q200,415 152,400 Z`,
      `M165,80 Q200,60 235,80 L240,100 Q200,90 160,100 Z`,
      `M170,100 Q200,92 230,100 L228,110 Q200,105 172,110 Z`,
      `M250,260 L270,255 L275,265 L270,300 L250,305 Z`,
    ],
  },
  Carpenter: {
    occupation: 'Carpenter',
    tools: ['saw', 'hammer', 'plane'],
    clothing: 'work_shirt',
    accessories: ['tool_belt', 'apron'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L250,400 Q200,410 150,400 Z`,
      `M150,310 L250,310 L255,325 L145,325 Z`,
      `M255,200 L275,200 L278,210 L275,340 L255,340 Z`,
      `M258,210 L272,210 M258,240 L272,240 M258,270 L272,270 M258,300 L272,300`,
    ],
  },
  Herbalist: {
    occupation: 'Herbalist',
    tools: ['mortar', 'herbs', 'basket'],
    clothing: 'apron_dress',
    accessories: ['herb_pouch', 'gloves'],
    svgPaths: [
      `M148,180 Q200,165 252,180 L260,400 Q200,420 140,400 Z`,
      `M230,250 L250,240 L260,260 L250,290 L230,285 Z`,
      `M235,255 Q245,250 252,260 Q248,280 238,278`,
      `M170,320 Q180,310 190,320 Q180,330 170,320 Z M200,315 Q210,305 220,315 Q210,325 200,315 Z`,
    ],
  },
  Jeweler: {
    occupation: 'Jeweler',
    tools: ['loupe', 'pliers', 'gems'],
    clothing: 'fine_vest',
    accessories: ['eyepiece', 'rings'],
    svgPaths: [
      `M160,180 Q200,170 240,180 L245,370 Q200,385 155,370 Z`,
      `M170,190 Q200,185 230,190 L228,240 Q200,245 172,240 Z`,
      `M190,280 L200,270 L210,280 L205,295 L195,295 Z`,
      `M195,280 A8,8 0 1,1 205,280 A8,8 0 1,1 195,280`,
    ],
  },
  Brewer: {
    occupation: 'Brewer',
    tools: ['barrel', 'mug', 'hops'],
    clothing: 'apron',
    accessories: ['tasting_cup', 'gloves'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L250,400 Q200,410 150,400 Z`,
      `M240,280 L280,280 L282,340 L238,340 Z`,
      `M242,285 A18,20 0 1,1 278,285 A18,20 0 1,1 242,285`,
      `M255,340 L265,340 L265,355 L255,355 Z`,
    ],
  },
  Scribe: {
    occupation: 'Scribe',
    tools: ['quill', 'ink', 'parchment'],
    clothing: 'robe',
    accessories: ['spectacles', 'seal'],
    svgPaths: [
      `M148,180 Q200,165 252,180 L265,400 Q200,420 135,400 Z`,
      `M240,250 L260,245 L258,310 L238,315 Z`,
      `M242,255 L256,252 L254,305 L240,308`,
      `M175,115 L188,115 L188,125 L175,125 Z M212,115 L225,115 L225,125 L212,125 Z M188,118 L212,118`,
    ],
  },
  Innkeeper: {
    occupation: 'Innkeeper',
    tools: ['keys', 'mug', 'ledger'],
    clothing: 'tavern_clothes',
    accessories: ['key_ring', 'apron'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L250,390 Q200,405 150,390 Z`,
      `M160,310 L240,310 L245,325 L155,325 Z`,
      `M165,315 L175,315 L175,325 L165,325 Z M195,315 L205,315 L205,325 L195,325 Z M225,315 L235,315 L235,325 L225,325 Z`,
      `M250,260 L270,260 L268,295 L248,295 Z`,
    ],
  },
  Fletcher: {
    occupation: 'Fletcher',
    tools: ['bow', 'arrows', 'feathers'],
    clothing: 'leather_vest',
    accessories: ['quiver', 'knife'],
    svgPaths: [
      `M158,180 Q200,170 242,180 L248,380 Q200,395 152,380 Z`,
      `M250,160 L270,160 L275,280 L245,280 Z`,
      `M255,165 L260,155 L265,165 M255,200 L260,190 L265,200 M255,235 L260,225 L265,235`,
      `M252,278 L268,278 L260,295 Z`,
    ],
  },
  Tanner: {
    occupation: 'Tanner',
    tools: ['scraper', 'frame', 'dye'],
    clothing: 'heavy_apron',
    accessories: ['gloves', 'mask'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L250,400 Q200,415 150,400 Z`,
      `M160,200 L240,200 L245,210 L155,210 Z`,
      `M170,350 L230,350 L235,380 Q200,395 165,380 Z`,
      `M240,230 L270,225 L275,240 L270,310 L240,315 Z`,
    ],
  },
  Potter: {
    occupation: 'Potter',
    tools: ['wheel', 'clay', 'kiln'],
    clothing: 'work_clothes',
    accessories: ['apron', 'towel'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L248,400 Q200,410 152,400 Z`,
      `M180,350 Q180,320 200,310 Q220,320 220,350 Q210,365 200,368 Q190,365 180,350 Z`,
      `M185,330 Q200,318 215,330`,
      `M175,365 L225,365 L228,375 L172,375 Z`,
    ],
  },
  Weaver: {
    occupation: 'Weaver',
    tools: ['loom', 'shuttle', 'thread'],
    clothing: 'dress',
    accessories: ['spindle', 'basket'],
    svgPaths: [
      `M150,180 Q200,165 250,180 L258,400 Q200,420 142,400 Z`,
      `M160,250 L240,250 M160,265 L240,265 M160,280 L240,280 M160,295 L240,295`,
      `M155,245 L155,300 M245,245 L245,300`,
      `M180,350 L220,350 L225,370 L175,370 Z`,
    ],
  },
  Mason: {
    occupation: 'Mason',
    tools: ['chisel', 'mallet', 'trowel'],
    clothing: 'work_tunic',
    accessories: ['tool_belt', 'gloves'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L250,400 Q200,410 150,400 Z`,
      `M240,240 L260,235 L265,250 L260,260 L240,255 Z`,
      `M160,340 L180,340 L180,370 L160,370 Z`,
      `M165,345 L175,345 L175,365 L165,365 Z M168,350 L172,350 L172,360 L168,360 Z`,
    ],
  },
  Enchanter: {
    occupation: 'Enchanter',
    tools: ['crystal', 'rune_stone', 'wand'],
    clothing: 'mystic_robe',
    accessories: ['amulet', 'ring'],
    svgPaths: [
      `M145,180 Q200,160 255,180 L268,400 Q200,425 132,400 Z`,
      `M190,210 L210,210 L205,230 L195,230 Z`,
      `M195,215 A8,8 0 1,1 205,215 A8,8 0 1,1 195,215`,
      `M260,200 L270,200 L272,340 L258,340 Z`,
    ],
  },
  Cartographer: {
    occupation: 'Cartographer',
    tools: ['compass', 'quill', 'map'],
    clothing: 'explorer_coat',
    accessories: ['sextant', 'spyglass'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L248,380 Q200,395 152,380 Z`,
      `M230,250 L270,250 L275,260 L275,330 L270,340 L230,340 L225,330 L225,260 Z`,
      `M235,260 L265,260 L265,330 L235,330 Z`,
      `M240,280 Q250,275 260,285 Q255,300 245,295`,
    ],
  },
  Diplomat: {
    occupation: 'Diplomat',
    tools: ['scroll', 'seal', 'quill'],
    clothing: 'formal_robes',
    accessories: ['signet_ring', 'sash'],
    svgPaths: [
      `M148,180 Q200,165 252,180 L260,400 Q200,420 140,400 Z`,
      `M165,190 Q200,182 235,190 L232,220 Q200,215 168,220 Z`,
      `M188,340 L212,340 L215,360 L185,360 Z`,
      `M195,345 L205,345 L205,355 L195,355 Z`,
    ],
  },
  Spy: {
    occupation: 'Spy',
    tools: ['lockpick', 'poison', 'cipher'],
    clothing: 'dark_cloak',
    accessories: ['mask', 'hidden_blade'],
    svgPaths: [
      `M150,150 Q200,140 250,150 L260,400 Q200,415 140,400 Z`,
      `M155,155 Q200,145 245,155 Q240,170 200,165 Q160,170 155,155 Z`,
      `M165,350 L175,350 L175,380 L165,380 Z M225,350 L235,350 L235,380 L225,380 Z`,
      `M245,280 L260,278 L262,298 L245,300 Z`,
    ],
  },
  Pirate: {
    occupation: 'Pirate',
    tools: ['cutlass', 'compass', 'spyglass'],
    clothing: 'pirate_coat',
    accessories: ['eyepatch', 'bandana'],
    svgPaths: [
      `M150,180 Q200,165 250,180 L258,400 Q200,415 142,400 Z`,
      `M155,180 Q200,170 245,180 Q240,200 200,195 Q160,200 155,180 Z`,
      `M150,310 L250,310 L255,330 L145,330 Z`,
      `M188,310 L200,290 L212,310 Z`,
    ],
  },
  Noble: {
    occupation: 'Noble',
    tools: ['scepter', 'seal', 'decree'],
    clothing: 'royal_attire',
    accessories: ['crown', 'cape', 'rings'],
    svgPaths: [
      `M148,180 Q200,165 252,180 L258,400 Q200,420 142,400 Z`,
      `M165,185 Q200,178 235,185 L232,250 Q200,258 168,250 Z`,
      `M140,180 Q130,250 120,400 L140,400 Z M260,180 Q270,250 280,400 L260,400 Z`,
      `M185,110 L190,95 L200,105 L210,95 L215,110 L210,120 L190,120 Z`,
    ],
  },
  Explorer: {
    occupation: 'Explorer',
    tools: ['compass', 'rope', 'map'],
    clothing: 'expedition_gear',
    accessories: ['hat', 'backpack'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L248,400 Q200,410 152,400 Z`,
      `M160,90 Q200,75 240,90 L245,105 Q200,115 155,105 Z`,
      `M130,200 L155,195 L160,220 L155,350 L130,350 Z`,
      `M135,210 L150,210 M135,240 L150,240 M135,270 L150,270`,
    ],
  },
  Bard_Occ: {
    occupation: 'Bard_Occ',
    tools: ['lute', 'songbook', 'flute'],
    clothing: 'colorful_tunic',
    accessories: ['feathered_hat', 'cape'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L250,400 Q200,415 150,400 Z`,
      `M165,185 Q200,178 235,185 L232,220 Q200,228 168,220 Z`,
      `M250,250 L265,250 L268,320 Q260,340 250,330 L248,280 Z`,
      `M255,260 Q262,265 265,275 M255,290 Q262,295 265,305`,
    ],
  },
  Fisherman: {
    occupation: 'Fisherman',
    tools: ['rod', 'net', 'tackle'],
    clothing: 'waders',
    accessories: ['hat', 'creel'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L250,400 Q200,410 150,400 Z`,
      `M260,150 L265,150 L268,350 Q265,360 260,350 Z`,
      `M265,155 Q280,180 275,200`,
      `M268,350 L280,360 Q275,368 265,362`,
    ],
  },
  Shepherd: {
    occupation: 'Shepherd',
    tools: ['crook', 'flute', 'sling'],
    clothing: 'wool_cloak',
    accessories: ['pouch', 'hat'],
    svgPaths: [
      `M148,180 Q200,165 252,180 L260,400 Q200,420 140,400 Z`,
      `M260,130 L265,130 L268,350 L262,350 Z`,
      `M258,130 Q250,115 260,105 Q272,108 268,125`,
      `M155,95 Q200,80 245,95 Q250,110 240,112 L160,112 Q150,110 155,95 Z`,
    ],
  },
  Stable_Hand: {
    occupation: 'Stable_Hand',
    tools: ['brush', 'pitchfork', 'bucket'],
    clothing: 'work_shirt',
    accessories: ['gloves', 'boots'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L250,400 Q200,410 150,400 Z`,
      `M150,310 L250,310 L255,325 L145,325 Z`,
      `M260,200 L275,200 L278,210 L275,350 L260,350 Z`,
      `M263,215 L272,210 M263,250 L272,245 M263,285 L272,280 M263,320 L272,315`,
    ],
  },
  Grave_Digger: {
    occupation: 'Grave_Digger',
    tools: ['shovel', 'lantern', 'coffin'],
    clothing: 'dark_coat',
    accessories: ['hat', 'gloves'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L250,400 Q200,410 150,400 Z`,
      `M258,180 L268,180 L270,350 L256,350 Z`,
      `M260,175 L266,175 L266,185 L260,185 Z`,
      `M170,350 L230,350 L230,400 L170,400 Z M195,355 L205,355 L205,380 L195,380 Z`,
    ],
  },
  Bounty_Hunter: {
    occupation: 'Bounty_Hunter',
    tools: ['crossbow', 'rope', 'wanted_poster'],
    clothing: 'reinforced_leather',
    accessories: ['cloak', 'belt'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L250,380 Q200,395 150,380 Z`,
      `M140,180 Q130,250 135,350 L150,345 Q148,260 152,190 Z`,
      `M150,310 L250,310 L255,325 L145,325 Z`,
      `M165,315 L175,315 L178,325 L162,325 Z M225,315 L235,315 L238,325 L222,325 Z`,
    ],
  },
  Trapper: {
    occupation: 'Trapper',
    tools: ['traps', 'knife', 'pelts'],
    clothing: 'fur_coat',
    accessories: ['belt', 'pouch'],
    svgPaths: [
      `M148,180 Q200,165 252,180 L260,400 Q200,420 140,400 Z`,
      `M150,180 Q200,170 250,180 Q248,198 200,192 Q152,198 150,180 Z`,
      `M155,192 L160,200 L155,200 Z M165,194 L170,204 L165,204 Z M235,194 L240,204 L235,204 Z M245,192 L250,200 L245,200 Z`,
      `M240,300 L270,295 L275,310 L270,330 L240,335 Z`,
    ],
  },
  Gladiator: {
    occupation: 'Gladiator',
    tools: ['net', 'trident', 'shield'],
    clothing: 'arena_armor',
    accessories: ['helmet', 'arm_guard'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L250,350 Q200,365 150,350 Z`,
      `M135,180 Q125,155 140,135 L170,148 Q160,170 155,180 Z`,
      `M265,180 Q275,155 260,135 L230,148 Q240,170 245,180 Z`,
      `M160,90 Q200,72 240,90 L245,115 Q200,125 155,115 Z`,
      `M190,85 L200,72 L210,85`,
    ],
  },
  Acrobat: {
    occupation: 'Acrobat',
    tools: ['ribbon', 'rope', 'ring'],
    clothing: 'leotard',
    accessories: ['slippers', 'sash'],
    svgPaths: [
      `M165,180 Q200,172 235,180 L238,380 Q200,395 162,380 Z`,
      `M170,185 Q200,178 230,185 L228,250 Q200,258 172,250 Z`,
      `M175,340 L180,340 L182,380 L173,380 Z M220,340 L225,340 L227,380 L218,380 Z`,
      `M188,260 L212,260 L215,275 L185,275 Z`,
    ],
  },
  Engineer: {
    occupation: 'Engineer',
    tools: ['wrench', 'blueprint', 'gear'],
    clothing: 'work_coat',
    accessories: ['goggles', 'tool_belt'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L250,400 Q200,415 150,400 Z`,
      `M230,250 L270,245 L275,255 L275,320 L270,330 L230,325 Z`,
      `M240,260 L260,258 L262,315 L238,318`,
      `M245,280 A10,10 0 1,1 255,280 A10,10 0 1,1 245,280`,
    ],
  },
  Architect: {
    occupation: 'Architect',
    tools: ['compass', 'ruler', 'blueprint'],
    clothing: 'formal_coat',
    accessories: ['pen', 'spectacles'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L248,390 Q200,405 152,390 Z`,
      `M165,185 Q200,178 235,185 L232,230 Q200,238 168,230 Z`,
      `M235,260 L275,255 L278,265 L278,330 L275,340 L235,335 Z`,
      `M240,268 L270,265 M240,290 L270,288 M240,312 L270,310`,
    ],
  },
  Musician: {
    occupation: 'Musician',
    tools: ['lute', 'drum', 'flute'],
    clothing: 'performer_outfit',
    accessories: ['hat', 'cape'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L250,400 Q200,415 150,400 Z`,
      `M250,220 L265,220 L268,300 Q262,320 250,310 L248,260 Z`,
      `M252,230 Q260,235 264,250 M252,270 Q260,275 264,290`,
      `M260,310 Q270,320 268,340 Q260,350 250,340 Q248,328 255,318`,
    ],
  },
  Dancer: {
    occupation: 'Dancer',
    tools: ['fan', 'ribbon', 'bells'],
    clothing: 'flowing_dress',
    accessories: ['anklets', 'headpiece'],
    svgPaths: [
      `M155,180 Q200,165 245,180 L270,400 Q200,430 130,400 Z`,
      `M160,185 Q200,175 240,185 L238,220 Q200,230 162,220 Z`,
      `M130,390 Q150,400 170,395 M230,395 Q250,400 270,390`,
      `M188,350 L192,350 L195,400 L185,400 Z M208,350 L212,350 L215,400 L205,400 Z`,
    ],
  },
  Apothecary: {
    occupation: 'Apothecary',
    tools: ['mortar', 'herbs', 'scale'],
    clothing: 'shop_coat',
    accessories: ['spectacles', 'pouch'],
    svgPaths: [
      `M150,180 Q200,170 250,180 L255,400 Q200,415 145,400 Z`,
      `M230,270 Q240,260 252,270 Q252,300 240,310 Q228,300 230,270 Z`,
      `M235,275 Q242,268 248,275 Q248,295 240,302`,
      `M170,115 L185,115 L185,125 L170,125 Z M215,115 L230,115 L230,125 L215,125 Z M185,118 L215,118`,
    ],
  },
  Jester: {
    occupation: 'Jester',
    tools: ['scepter', 'juggling_balls', 'horn'],
    clothing: 'motley',
    accessories: ['bells', 'mask'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L250,400 Q200,415 150,400 Z`,
      `M160,80 Q175,55 190,75 Q200,55 210,75 Q225,55 240,80 L235,100 Q200,110 165,100 Z`,
      `M175,60 A5,5 0 1,1 175,61 M200,50 A5,5 0 1,1 200,51 M225,60 A5,5 0 1,1 225,61`,
      `M200,200 L175,200 L180,220 L195,210 L205,220 L220,210 L225,200 Z`,
    ],
  },
  Oracle: {
    occupation: 'Oracle',
    tools: ['crystal_ball', 'tarot', 'incense'],
    clothing: 'mystic_robes',
    accessories: ['veil', 'amulet'],
    svgPaths: [
      `M142,180 Q200,160 258,180 L270,400 Q200,425 130,400 Z`,
      `M185,300 A20,20 0 1,1 215,300 A20,20 0 1,1 185,300`,
      `M190,300 A12,12 0 1,1 210,300 A12,12 0 1,1 190,300`,
      `M155,95 Q200,80 245,95 L240,100 Q200,92 160,100 Z`,
    ],
  },
  Undertaker: {
    occupation: 'Undertaker',
    tools: ['shovel', 'coffin', 'candle'],
    clothing: 'black_suit',
    accessories: ['top_hat', 'gloves'],
    svgPaths: [
      `M160,180 Q200,172 240,180 L245,400 Q200,412 155,400 Z`,
      `M165,85 Q200,72 235,85 L240,100 L160,100 Z`,
      `M168,100 L232,100 L230,110 L170,110 Z`,
      `M175,350 L225,350 L228,380 L230,400 L170,400 L172,380 Z`,
    ],
  },
  Beekeeper: {
    occupation: 'Beekeeper',
    tools: ['smoker', 'hive_tool', 'frames'],
    clothing: 'bee_suit',
    accessories: ['veil', 'gloves'],
    svgPaths: [
      `M148,180 Q200,165 252,180 L258,400 Q200,418 142,400 Z`,
      `M155,90 Q200,70 245,90 L248,130 Q200,145 152,130 Z`,
      `M158,130 Q200,142 242,130 L240,145 Q200,155 160,145 Z`,
      `M230,280 L260,275 L262,310 L260,340 L230,335 Z`,
    ],
  },
  Winemaker: {
    occupation: 'Winemaker',
    tools: ['barrel', 'press', 'goblet'],
    clothing: 'vineyard_clothes',
    accessories: ['apron', 'tasting_cup'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L250,400 Q200,410 150,400 Z`,
      `M238,280 Q258,280 258,310 Q258,340 238,340 Q218,340 218,310 Q218,280 238,280 Z`,
      `M225,295 L250,295 M225,315 L250,315`,
      `M170,350 L190,340 L195,350 L200,340 L205,350 L210,340 L230,350 L215,360 L185,360 Z`,
    ],
  },
  Tinker: {
    occupation: 'Tinker',
    tools: ['wrench', 'gears', 'springs'],
    clothing: 'work_vest',
    accessories: ['goggles', 'pouches'],
    svgPaths: [
      `M155,180 Q200,170 245,180 L250,400 Q200,410 150,400 Z`,
      `M150,300 L250,300 L255,318 L145,318 Z`,
      `M160,305 L170,305 L170,315 L160,315 Z M190,305 L200,305 L200,315 L190,315 Z M220,305 L230,305 L230,315 L220,315 Z`,
      `M240,240 A12,12 0 1,1 260,250 A12,12 0 1,1 240,240`,
    ],
  },
  Barber: {
    occupation: 'Barber',
    tools: ['scissors', 'razor', 'mirror'],
    clothing: 'striped_vest',
    accessories: ['towel', 'comb'],
    svgPaths: [
      `M160,180 Q200,170 240,180 L245,390 Q200,405 155,390 Z`,
      `M165,190 Q200,183 235,190 L232,250 Q200,258 168,250 Z`,
      `M248,250 L268,248 L270,265 L265,268 L250,265 Z`,
      `M252,255 Q260,252 265,258 L262,265 L255,262`,
    ],
  },
};

// ============================================================================
// ANIMAL SPIRIT VISUALS
// ============================================================================

export interface AnimalSpirit {
  animal: string;
  primaryColor: string;
  secondaryColor: string;
  auraColor: string;
  patterns: string[];
  traits: string[];
  svgPaths: string[];
}

export const ANIMAL_SPIRITS: Record<string, AnimalSpirit> = {
  Wolf: {
    animal: 'Wolf',
    primaryColor: '#696969',
    secondaryColor: '#A9A9A9',
    auraColor: '#C0C0C0',
    patterns: ['fur_texture', 'pack_marks'],
    traits: ['loyalty', 'pack', 'hunter'],
    svgPaths: [
      `M155,80 L145,50 L165,70 Z`,
      `M245,80 L255,50 L235,70 Z`,
      `M150,180 Q155,165 170,170 Q185,175 200,170 Q215,175 230,170 Q245,165 250,180 Q240,190 220,185 Q200,180 180,185 Q160,190 150,180 Z`,
      `M200,400 Q180,420 160,450 Q140,480 130,470 Q140,450 155,430 Q170,410 190,400`,
      `M180,300 Q175,295 180,290 Q185,295 180,300 Z M175,305 L178,310 M182,310 L185,305`,
    ],
  },
  Eagle: {
    animal: 'Eagle',
    primaryColor: '#8B4513',
    secondaryColor: '#FFD700',
    auraColor: '#87CEEB',
    patterns: ['feather_cape', 'talon_marks'],
    traits: ['vision', 'freedom', 'nobility'],
    svgPaths: [
      `M140,180 Q120,200 100,280 Q90,350 110,400 Q150,380 170,350 Q180,300 175,250 Q170,200 160,180 Z`,
      `M260,180 Q280,200 300,280 Q310,350 290,400 Q250,380 230,350 Q220,300 225,250 Q230,200 240,180 Z`,
      `M120,250 L140,260 M110,290 L130,295 M105,330 L125,330`,
      `M280,250 L260,260 M290,290 L270,295 M295,330 L275,330`,
      `M155,190 L160,200 L165,190 L170,200`,
      `M190,115 Q200,110 210,115 L210,125 Q200,130 190,125 Z`,
    ],
  },
  Lion: {
    animal: 'Lion',
    primaryColor: '#DAA520',
    secondaryColor: '#CD853F',
    auraColor: '#FFD700',
    patterns: ['mane', 'royal_marks'],
    traits: ['courage', 'leadership', 'pride'],
    svgPaths: [
      // Round chubby body
      `M148,260 Q132,320 148,400 Q175,445 200,450 Q225,445 252,400 Q268,320 252,260 Q235,242 200,238 Q165,242 148,260 Z`,
      // Big fluffy mane (circle around head)
      `M120,80 Q108,105 105,140 Q102,175 112,205 Q128,230 155,240 Q175,245 200,248 Q225,245 245,240 Q272,230 288,205 Q298,175 295,140 Q292,105 280,80 Q258,58 200,50 Q142,58 120,80 Z`,
      // Round face inside mane
      `M155,105 Q150,138 158,172 Q175,198 200,202 Q225,198 242,172 Q250,138 245,105 Q235,85 200,80 Q165,85 155,105 Z`,
      // Ears poking through mane
      `M158,90 Q148,75 155,65 Q165,62 170,75 Q172,85 165,95 Z M242,90 Q252,75 245,65 Q235,62 230,75 Q228,85 235,95 Z`,
      // Eyes + nose + cute mouth
      `M182,130 A7,7 0 1,1 182,131 M218,130 A7,7 0 1,1 218,131 M192,158 Q195,152 200,150 Q205,152 208,158 Q205,162 200,164 Q195,162 192,158 Z M190,172 Q195,178 200,180 Q205,178 210,172`,
      // Mane texture tufts
      `M125,100 Q118,110 122,125 M130,85 Q122,95 125,112 M275,100 Q282,110 278,125 M270,85 Q278,95 275,112 M140,200 Q132,210 138,222 M260,200 Q268,210 262,222`,
      // Tail with tuft
      `M252,380 Q278,365 292,340 Q300,320 292,312 Q284,318 285,335 Q278,355 262,370 M290,315 Q298,308 295,300 Q288,305 290,315 Z`,
    ],
  },
  Dragon: {
    animal: 'Dragon',
    primaryColor: '#8B0000',
    secondaryColor: '#FF4500',
    auraColor: '#FF6347',
    patterns: ['scales', 'fire_marks'],
    traits: ['power', 'wisdom', 'treasure'],
    svgPaths: [
      `M150,80 Q140,50 155,30 Q165,40 160,70 Z`,
      `M250,80 Q260,50 245,30 Q235,40 240,70 Z`,
      `M180,200 Q185,195 190,200 Q185,205 180,200 Z`,
      `M200,210 Q205,205 210,210 Q205,215 200,210 Z`,
      `M220,200 Q225,195 230,200 Q225,205 220,200 Z`,
      `M200,400 Q230,420 260,400 Q290,380 310,390 Q320,400 315,410 Q305,405 295,410 Q280,420 260,410 Q240,400 220,410`,
      `M140,180 Q100,220 90,300 Q100,280 120,250 Q130,220 150,200`,
    ],
  },
  Bear: {
    animal: 'Bear',
    primaryColor: '#8B4513',
    secondaryColor: '#D2691E',
    auraColor: '#DEB887',
    patterns: ['fur_bulk', 'claw_marks'],
    traits: ['strength', 'protection', 'endurance'],
    svgPaths: [
      // Big round chubby body
      `M140,250 Q120,310 140,400 Q170,450 200,455 Q230,450 260,400 Q280,310 260,250 Q240,232 200,228 Q160,232 140,250 Z`,
      // Round head
      `M155,115 Q148,152 158,192 Q178,218 200,222 Q222,218 242,192 Q252,152 245,115 Q232,90 200,84 Q168,90 155,115 Z`,
      // Round left ear
      `M160,100 Q145,82 148,68 Q158,60 168,72 Q175,88 168,102 Z`,
      // Round right ear
      `M240,100 Q255,82 252,68 Q242,60 232,72 Q225,88 232,102 Z`,
      // Inner ears
      `M155,90 Q150,80 155,72 Q162,68 165,78 Q165,88 160,95 Z M245,90 Q250,80 245,72 Q238,68 235,78 Q235,88 240,95 Z`,
      // Snout muzzle (lighter oval)
      `M178,170 Q175,185 182,200 Q192,210 200,212 Q208,210 218,200 Q225,185 222,170 Q215,162 200,160 Q185,162 178,170 Z`,
      // Nose + eyes + mouth
      `M192,180 Q195,175 200,173 Q205,175 208,180 Q205,185 200,187 Q195,185 192,180 Z M180,145 A6,6 0 1,1 180,146 M220,145 A6,6 0 1,1 220,146 M195,195 Q200,200 205,195`,
    ],
  },
  Phoenix: {
    animal: 'Phoenix',
    primaryColor: '#FF4500',
    secondaryColor: '#FFD700',
    auraColor: '#FF6347',
    patterns: ['flame_feathers', 'rebirth_marks'],
    traits: ['rebirth', 'immortality', 'transformation'],
    svgPaths: [
      `M180,70 Q185,50 195,60 Q200,40 205,60 Q215,50 220,70 Q210,80 200,75 Q190,80 180,70 Z`,
      `M130,180 Q90,200 70,280 Q60,340 80,400 Q120,380 150,340 Q170,290 165,240 Q160,200 150,180 Z`,
      `M270,180 Q310,200 330,280 Q340,340 320,400 Q280,380 250,340 Q230,290 235,240 Q240,200 250,180 Z`,
      `M100,300 Q110,280 115,300 Q120,280 130,300`,
      `M270,300 Q280,280 285,300 Q290,280 300,300`,
      `M200,400 Q180,430 170,460 Q160,490 175,500 Q185,490 190,470 Q195,500 200,520 Q205,500 210,470 Q215,490 225,500 Q240,490 230,460 Q220,430 200,400 Z`,
    ],
  },
  Cat: {
    animal: 'Cat',
    primaryColor: '#F4A460',
    secondaryColor: '#FFDAB9',
    auraColor: '#FFE4C4',
    patterns: ['whiskers', 'stripes'],
    traits: ['agility', 'independence', 'mystery'],
    svgPaths: [
      `M150,250 Q140,300 150,370 Q170,420 200,430 Q230,420 250,370 Q260,300 250,250 Q230,230 200,225 Q170,230 150,250 Z`,
      `M160,130 Q155,160 165,190 Q180,210 200,215 Q220,210 235,190 Q245,160 240,130 Q225,105 200,100 Q175,105 160,130 Z`,
      `M165,130 L150,80 L180,115 Z`,
      `M235,130 L250,80 L220,115 Z`,
      `M250,350 Q280,330 290,300 Q295,280 285,270 Q275,275 280,290 Q275,310 260,330`,
      `M185,170 L160,165 M185,175 L158,178 M215,170 L240,165 M215,175 L242,178 M195,180 Q200,185 205,180 M190,160 A5,5 0 1,1 190,161 M210,160 A5,5 0 1,1 210,161`,
    ],
  },
  Dog: {
    animal: 'Dog',
    primaryColor: '#D2691E',
    secondaryColor: '#F5DEB3',
    auraColor: '#DEB887',
    patterns: ['spots', 'collar'],
    traits: ['loyalty', 'friendship', 'joy'],
    svgPaths: [
      `M145,260 Q135,310 145,380 Q165,430 200,440 Q235,430 255,380 Q265,310 255,260 Q235,240 200,235 Q165,240 145,260 Z`,
      `M160,120 Q155,155 165,190 Q180,210 200,215 Q220,210 235,190 Q245,155 240,120 Q225,100 200,95 Q175,100 160,120 Z`,
      `M160,130 Q140,125 125,150 Q115,180 125,200 Q140,195 155,175 Q165,155 165,140`,
      `M240,130 Q260,125 275,150 Q285,180 275,200 Q260,195 245,175 Q235,155 235,140`,
      `M255,340 Q275,310 280,280 Q285,260 275,255 Q270,265 272,285 Q268,305 255,325`,
      `M185,150 A6,6 0 1,1 185,151 M215,150 A6,6 0 1,1 215,151 M195,175 Q200,180 205,175 Q200,172 195,175 Z M198,185 Q200,200 202,185`,
    ],
  },
  Bunny: {
    animal: 'Bunny',
    primaryColor: '#F5F5DC',
    secondaryColor: '#FFB6C1',
    auraColor: '#FFF0F5',
    patterns: ['fluffy', 'cotton_tail'],
    traits: ['speed', 'luck', 'gentleness'],
    svgPaths: [
      `M155,270 Q140,320 155,390 Q175,430 200,435 Q225,430 245,390 Q260,320 245,270 Q230,250 200,245 Q170,250 155,270 Z`,
      `M165,150 Q160,180 170,205 Q185,220 200,225 Q215,220 230,205 Q240,180 235,150 Q225,130 200,125 Q175,130 165,150 Z`,
      `M175,140 Q170,100 165,50 Q160,20 170,15 Q180,20 178,50 Q180,100 185,135`,
      `M225,140 Q230,100 235,50 Q240,20 230,15 Q220,20 222,50 Q220,100 215,135`,
      `M200,430 Q190,445 195,455 Q200,460 205,455 Q210,445 200,430 Z`,
      `M182,165 A8,8 0 1,1 182,166 M218,165 A8,8 0 1,1 218,166 M197,185 Q200,188 203,185 M196,195 L196,205 M204,195 L204,205`,
    ],
  },
  Hamster: {
    animal: 'Hamster',
    primaryColor: '#F4A460',
    secondaryColor: '#FAEBD7',
    auraColor: '#FFE4B5',
    patterns: ['cheeks', 'tiny_paws'],
    traits: ['curiosity', 'hoarding', 'cuteness'],
    svgPaths: [
      `M145,250 Q125,310 145,380 Q175,430 200,435 Q225,430 255,380 Q275,310 255,250 Q235,235 200,230 Q165,235 145,250 Z`,
      `M150,130 Q145,165 155,200 Q175,225 200,230 Q225,225 245,200 Q255,165 250,130 Q235,105 200,100 Q165,105 150,130 Z`,
      `M150,170 Q135,180 138,200 Q145,215 160,210 Q165,195 160,175 Q155,165 150,170 Z`,
      `M250,170 Q265,180 262,200 Q255,215 240,210 Q235,195 240,175 Q245,165 250,170 Z`,
      `M165,115 Q155,95 160,85 Q170,82 175,95 Q178,108 170,118 Z M235,115 Q245,95 240,85 Q230,82 225,95 Q222,108 230,118 Z`,
      `M188,155 A4,4 0 1,1 188,156 M212,155 A4,4 0 1,1 212,156 M197,170 Q200,173 203,170 Z`,
    ],
  },
  Owl: {
    animal: 'Owl',
    primaryColor: '#8B7355',
    secondaryColor: '#DEB887',
    auraColor: '#D2B48C',
    patterns: ['feather_tufts', 'wise_eyes'],
    traits: ['wisdom', 'night_vision', 'knowledge'],
    svgPaths: [
      `M155,250 Q140,310 155,380 Q175,420 200,425 Q225,420 245,380 Q260,310 245,250 Q230,235 200,230 Q170,235 155,250 Z`,
      `M155,120 Q150,155 160,190 Q180,215 200,220 Q220,215 240,190 Q250,155 245,120 Q230,95 200,90 Q170,95 155,120 Z`,
      `M160,110 L145,70 L170,100 Z`,
      `M240,110 L255,70 L230,100 Z`,
      `M170,140 A18,18 0 1,1 170,141 M230,140 A18,18 0 1,1 230,141 M175,140 A8,8 0 1,1 175,141 M235,140 A8,8 0 1,1 235,141`,
      `M195,170 L200,185 L205,170 Z M175,260 Q180,270 185,260 M190,265 Q195,275 200,265 M205,265 Q210,275 215,265 M220,260 Q225,270 230,260`,
    ],
  },
  Raven: {
    animal: 'Raven',
    primaryColor: '#2F2F4F',
    secondaryColor: '#4B0082',
    auraColor: '#483D8B',
    patterns: ['dark_feathers', 'shadow'],
    traits: ['intelligence', 'mystery', 'trickery'],
    svgPaths: [
      `M160,250 Q145,310 155,380 Q175,420 200,425 Q225,420 245,380 Q255,310 240,250 Q225,240 200,235 Q175,240 160,250 Z`,
      `M165,130 Q160,160 170,190 Q185,210 200,215 Q215,210 230,190 Q240,160 235,130 Q225,110 200,105 Q175,110 165,130 Z`,
      `M145,260 Q120,280 110,330 Q105,370 120,390 Q140,380 150,350 Q155,310 150,270`,
      `M255,260 Q280,280 290,330 Q295,370 280,390 Q260,380 250,350 Q245,310 250,270`,
      `M190,155 L200,175 L210,155 Q205,150 200,148 Q195,150 190,155 Z`,
      `M180,140 A5,5 0 1,1 180,141 M220,140 A5,5 0 1,1 220,141`,
    ],
  },
  Parrot: {
    animal: 'Parrot',
    primaryColor: '#00CC00',
    secondaryColor: '#FF4500',
    auraColor: '#FFD700',
    patterns: ['tropical_feathers', 'bright'],
    traits: ['speech', 'color', 'intelligence'],
    svgPaths: [
      `M160,250 Q145,310 155,380 Q175,415 200,420 Q225,415 245,380 Q255,310 240,250 Q225,235 200,230 Q175,235 160,250 Z`,
      `M165,130 Q160,160 170,190 Q185,210 200,215 Q215,210 230,190 Q240,160 235,130 Q225,110 200,105 Q175,110 165,130 Z`,
      `M195,165 Q192,175 198,185 Q200,190 202,185 Q208,175 205,165 Q200,158 195,165 Z`,
      `M190,105 Q185,80 195,70 Q200,75 198,95 M200,100 Q200,75 205,65 Q210,72 205,95 M210,105 Q215,82 210,72 Q218,78 212,100`,
      `M190,420 Q185,460 180,500 Q178,520 185,515 Q190,500 195,460 M200,420 Q200,465 200,510 Q200,530 205,520 Q205,500 202,460 M210,420 Q215,460 220,500 Q222,520 215,515 Q210,500 205,460`,
      `M185,140 A6,6 0 1,1 185,141 M215,140 A6,6 0 1,1 215,141`,
    ],
  },
  Penguin: {
    animal: 'Penguin',
    primaryColor: '#1C1C1C',
    secondaryColor: '#FFFFFF',
    auraColor: '#87CEEB',
    patterns: ['tuxedo', 'waddle'],
    traits: ['endurance', 'community', 'resilience'],
    svgPaths: [
      `M155,200 Q140,270 150,360 Q170,420 200,430 Q230,420 250,360 Q260,270 245,200 Q230,180 200,175 Q170,180 155,200 Z`,
      `M170,220 Q165,280 172,360 Q185,400 200,405 Q215,400 228,360 Q235,280 230,220 Q220,210 200,205 Q180,210 170,220 Z`,
      `M165,110 Q160,140 168,170 Q182,190 200,195 Q218,190 232,170 Q240,140 235,110 Q225,90 200,85 Q175,90 165,110 Z`,
      `M175,120 Q173,145 180,165 Q190,180 200,182 Q210,180 220,165 Q227,145 225,120 Q218,108 200,105 Q182,108 175,120 Z`,
      `M152,220 Q130,250 125,300 Q128,320 140,310 Q150,290 155,260 M248,220 Q270,250 275,300 Q272,320 260,310 Q250,290 245,260`,
      `M188,130 A4,4 0 1,1 188,131 M212,130 A4,4 0 1,1 212,131 M195,148 L200,160 L205,148 Z`,
    ],
  },
  Unicorn: {
    animal: 'Unicorn',
    primaryColor: '#FFFFFF',
    secondaryColor: '#FFB6C1',
    auraColor: '#E6E6FA',
    patterns: ['sparkle', 'rainbow_mane'],
    traits: ['purity', 'magic', 'grace'],
    svgPaths: [
      `M145,270 Q130,330 145,400 Q170,440 200,445 Q230,440 255,400 Q270,330 255,270 Q235,250 200,245 Q165,250 145,270 Z`,
      `M165,140 Q160,170 170,200 Q185,220 200,225 Q215,220 230,200 Q240,170 235,140 Q225,115 200,110 Q175,115 165,140 Z`,
      `M197,110 L195,70 L200,50 L205,70 L203,110 M197,90 L203,85 M196,75 L204,70`,
      `M160,140 Q140,150 130,180 Q120,210 130,240 Q140,230 145,200 Q150,170 160,155 M155,160 Q135,175 125,210 Q118,240 128,260 Q138,250 140,220 Q145,190 155,175`,
      `M255,380 Q280,370 295,340 Q305,320 295,310 Q285,320 280,340 Q270,360 260,370 M255,390 Q275,385 288,360 Q296,340 288,335 Q282,345 275,365 Q268,380 258,388`,
      `M182,155 A6,6 0 1,1 182,156 M218,155 A6,6 0 1,1 218,156 M192,185 A2,2 0 1,1 192,186 M208,185 A2,2 0 1,1 208,186`,
    ],
  },
  Fairy: {
    animal: 'Fairy',
    primaryColor: '#DA70D6',
    secondaryColor: '#FFD700',
    auraColor: '#EE82EE',
    patterns: ['sparkle_dust', 'glow'],
    traits: ['magic', 'mischief', 'wonder'],
    svgPaths: [
      `M180,250 Q175,290 182,330 Q190,360 200,365 Q210,360 218,330 Q225,290 220,250 Q215,240 200,238 Q185,240 180,250 Z`,
      `M178,170 Q175,195 183,215 Q192,230 200,232 Q208,230 217,215 Q225,195 222,170 Q215,155 200,152 Q185,155 178,170 Z`,
      `M175,230 Q140,210 120,180 Q110,150 125,140 Q140,145 155,170 Q165,195 175,220 Z`,
      `M175,260 Q140,280 120,310 Q110,340 125,345 Q140,338 155,315 Q165,290 175,270 Z`,
      `M225,230 Q260,210 280,180 Q290,150 275,140 Q260,145 245,170 Q235,195 225,220 Z`,
      `M225,260 Q260,280 280,310 Q290,340 275,345 Q260,338 245,315 Q235,290 225,270 Z`,
      `M190,180 A4,4 0 1,1 190,181 M210,180 A4,4 0 1,1 210,181 M197,195 Q200,198 203,195 M150,150 L153,145 L156,150 M250,150 L253,145 L256,150 M200,130 L203,125 L206,130`,
    ],
  },
  Fox: {
    animal: 'Fox',
    primaryColor: '#FF6600',
    secondaryColor: '#FFFFFF',
    auraColor: '#FF8C00',
    patterns: ['bushy_tail', 'white_tip'],
    traits: ['cunning', 'adaptability', 'charm'],
    svgPaths: [
      `M150,260 Q138,315 150,385 Q172,425 200,430 Q228,425 250,385 Q262,315 250,260 Q232,242 200,238 Q168,242 150,260 Z`,
      `M160,130 Q155,160 165,190 Q180,210 200,218 Q220,210 235,190 Q245,160 240,130 Q228,108 200,102 Q172,108 160,130 Z`,
      `M165,125 L148,68 L182,112 Z`,
      `M235,125 L252,68 L218,112 Z`,
      `M250,360 Q285,340 305,300 Q315,270 305,250 Q290,260 280,290 Q270,320 255,345 M252,365 Q290,350 312,310 Q322,280 312,260 Q298,270 288,300 Q278,330 258,355`,
      `M182,148 A5,5 0 1,1 182,149 M218,148 A5,5 0 1,1 218,149 M195,170 Q200,178 205,170 Z M175,280 Q180,310 190,340 Q200,350 210,340 Q220,310 225,280 Q210,270 200,268 Q190,270 175,280 Z`,
    ],
  },
  Deer: {
    animal: 'Deer',
    primaryColor: '#D2691E',
    secondaryColor: '#FAEBD7',
    auraColor: '#DEB887',
    patterns: ['spots', 'antler_buds'],
    traits: ['grace', 'gentleness', 'alertness'],
    svgPaths: [
      `M160,260 Q148,320 158,390 Q178,430 200,435 Q222,430 242,390 Q252,320 240,260 Q228,248 200,244 Q172,248 160,260 Z`,
      `M168,130 Q164,162 172,192 Q186,212 200,216 Q214,212 228,192 Q236,162 232,130 Q224,112 200,106 Q176,112 168,130 Z`,
      `M172,118 Q168,95 160,78 Q155,65 162,62 Q168,68 172,85 M168,90 Q158,78 155,65`,
      `M228,118 Q232,95 240,78 Q245,65 238,62 Q232,68 228,85 M232,90 Q242,78 245,65`,
      `M180,290 A4,4 0 1,1 180,291 M210,280 A4,4 0 1,1 210,281 M195,310 A4,4 0 1,1 195,311 M220,320 A4,4 0 1,1 220,321 M175,330 A4,4 0 1,1 175,331`,
      `M184,145 A7,7 0 1,1 184,146 M216,145 A7,7 0 1,1 216,146 M196,175 Q200,180 204,175 Z M188,195 Q195,200 200,202 Q205,200 212,195`,
    ],
  },
  Squirrel: {
    animal: 'Squirrel',
    primaryColor: '#CD853F',
    secondaryColor: '#FAEBD7',
    auraColor: '#DEB887',
    patterns: ['bushy_tail', 'acorn'],
    traits: ['resourcefulness', 'energy', 'planning'],
    svgPaths: [
      `M165,270 Q155,315 165,370 Q180,405 200,410 Q220,405 235,370 Q245,315 235,270 Q225,258 200,254 Q175,258 165,270 Z`,
      `M170,150 Q166,178 175,205 Q188,222 200,225 Q212,222 225,205 Q234,178 230,150 Q222,132 200,128 Q178,132 170,150 Z`,
      `M172,140 Q162,128 165,118 Q172,112 178,122 Q180,132 175,142 Z M228,140 Q238,128 235,118 Q228,112 222,122 Q220,132 225,142 Z`,
      `M235,350 Q260,320 275,280 Q285,240 275,210 Q262,200 250,215 Q245,240 248,270 Q250,300 240,330 M238,345 Q268,315 282,272 Q290,235 278,208 Q265,198 255,212 Q250,238 252,265 Q254,295 245,325`,
      `M188,260 L185,270 L192,268 M212,260 L215,270 L208,268 M195,268 Q200,272 205,268 Q200,265 195,268 Z`,
      `M186,160 A5,5 0 1,1 186,161 M214,160 A5,5 0 1,1 214,161 M196,175 Q200,178 204,175 Z`,
    ],
  },
  Raccoon: {
    animal: 'Raccoon',
    primaryColor: '#808080',
    secondaryColor: '#2F2F2F',
    auraColor: '#A9A9A9',
    patterns: ['mask', 'ringed_tail'],
    traits: ['cleverness', 'dexterity', 'mischief'],
    svgPaths: [
      `M150,260 Q138,318 150,390 Q172,430 200,435 Q228,430 250,390 Q262,318 250,260 Q232,244 200,240 Q168,244 150,260 Z`,
      `M162,130 Q158,162 168,195 Q184,215 200,218 Q216,215 232,195 Q242,162 238,130 Q228,110 200,105 Q172,110 162,130 Z`,
      `M170,140 Q172,155 182,162 Q192,158 198,148 Q192,138 182,135 Q172,135 170,140 Z M230,140 Q228,155 218,162 Q208,158 202,148 Q208,138 218,135 Q228,135 230,140 Z`,
      `M168,120 Q158,102 162,92 Q170,88 176,100 Q178,112 172,122 Z M232,120 Q242,102 238,92 Q230,88 224,100 Q222,112 228,122 Z`,
      `M250,380 Q275,365 288,340 Q295,318 285,305 Q275,312 278,332 Q272,352 258,370 M260,350 L280,345 M265,335 L282,332 M268,320 L284,318`,
      `M185,148 A4,4 0 1,1 185,149 M215,148 A4,4 0 1,1 215,149 M196,168 Q200,172 204,168 Z`,
    ],
  },
  Dolphin: {
    animal: 'Dolphin',
    primaryColor: '#4682B4',
    secondaryColor: '#B0E0E6',
    auraColor: '#87CEEB',
    patterns: ['sleek', 'splash'],
    traits: ['intelligence', 'playfulness', 'harmony'],
    svgPaths: [
      `M130,250 Q120,290 140,340 Q165,390 200,400 Q235,390 260,340 Q280,290 270,250 Q255,220 200,210 Q145,220 130,250 Z`,
      `M170,160 Q165,190 175,215 Q188,235 200,238 Q212,235 225,215 Q235,190 230,160 Q225,140 200,130 Q175,140 170,160 Z`,
      `M190,165 Q188,145 192,128 Q200,118 208,128 Q212,145 210,165`,
      `M200,220 Q205,190 215,175 Q220,170 218,180 Q212,200 208,225`,
      `M145,280 Q120,295 110,320 Q115,325 130,310 Q148,295 152,280`,
      `M255,280 Q280,295 290,320 Q285,325 270,310 Q252,295 248,280 M200,400 Q180,420 165,445 Q158,455 168,452 Q180,445 195,425 M200,400 Q220,420 235,445 Q242,455 232,452 Q220,445 205,425`,
      `M182,168 A4,4 0 1,1 182,169 M218,168 A4,4 0 1,1 218,169 M185,185 Q200,195 215,185`,
    ],
  },
  Octopus: {
    animal: 'Octopus',
    primaryColor: '#9370DB',
    secondaryColor: '#DDA0DD',
    auraColor: '#E6E6FA',
    patterns: ['suckers', 'color_shift'],
    traits: ['intelligence', 'flexibility', 'camouflage'],
    svgPaths: [
      `M150,120 Q135,165 145,210 Q165,245 200,250 Q235,245 255,210 Q265,165 250,120 Q235,90 200,82 Q165,90 150,120 Z`,
      `M155,230 Q135,270 125,320 Q118,360 130,380 Q140,370 138,340 Q142,300 158,260`,
      `M162,240 Q148,280 142,330 Q138,370 150,385 Q158,375 155,345 Q158,305 168,265`,
      `M182,248 Q175,290 170,340 Q168,380 180,390 Q188,378 185,345 Q185,300 188,260`,
      `M218,248 Q225,290 230,340 Q232,380 220,390 Q212,378 215,345 Q215,300 212,260`,
      `M238,240 Q252,280 258,330 Q262,370 250,385 Q242,375 245,345 Q242,305 232,265`,
      `M245,230 Q265,270 275,320 Q282,360 270,380 Q260,370 262,340 Q258,300 242,260`,
      `M178,150 A10,10 0 1,1 178,151 M222,150 A10,10 0 1,1 222,151 M182,150 A4,4 0 1,1 182,151 M226,150 A4,4 0 1,1 226,151`,
    ],
  },
  Seahorse: {
    animal: 'Seahorse',
    primaryColor: '#FF7F50',
    secondaryColor: '#FFD700',
    auraColor: '#FFA07A',
    patterns: ['ridges', 'spiral_tail'],
    traits: ['patience', 'uniqueness', 'devotion'],
    svgPaths: [
      `M185,80 Q175,95 178,115 Q182,135 195,145 Q205,148 218,138 Q228,122 225,100 Q220,82 208,75 Q195,72 185,80 Z`,
      `M182,110 Q170,115 160,112 Q155,108 162,105 Q172,108 182,105`,
      `M195,145 Q190,170 185,200 Q178,235 180,270 Q185,300 195,330 Q200,350 210,340 Q218,310 215,280 Q210,250 215,220 Q220,190 218,160 Q215,148 205,145`,
      `M195,330 Q188,355 185,380 Q182,400 190,410 Q200,415 210,405 Q215,390 208,375 Q198,368 192,375 Q188,385 195,392`,
      `M215,180 Q228,190 232,210 Q235,230 228,250 Q222,240 225,220 Q225,200 218,185`,
      `M185,200 Q170,208 165,218 Q168,222 178,215 Q188,208 190,200 M198,92 A4,4 0 1,1 198,93 M195,75 Q192,65 198,60 Q204,65 200,75 M202,72 Q205,62 210,60 Q212,66 206,74`,
    ],
  },
  Turtle: {
    animal: 'Turtle',
    primaryColor: '#228B22',
    secondaryColor: '#8FBC8F',
    auraColor: '#90EE90',
    patterns: ['shell_pattern', 'slow_steady'],
    traits: ['wisdom', 'patience', 'longevity'],
    svgPaths: [
      `M135,230 Q125,190 145,160 Q175,135 200,130 Q225,135 255,160 Q275,190 265,230 Q255,270 225,290 Q200,300 175,290 Q145,270 135,230 Z`,
      `M180,170 L195,165 L210,170 L215,185 L205,195 L190,195 L180,185 Z M165,200 L178,195 L185,205 L180,218 L168,220 L160,210 Z M215,200 L228,195 L235,205 L230,218 L218,220 L212,210 Z M190,220 L205,218 L212,228 L205,240 L192,240 L186,230 Z`,
      `M175,295 Q170,310 175,325 Q185,340 200,342 Q215,340 225,325 Q230,310 225,295`,
      `M188,315 A4,4 0 1,1 188,316 M212,315 A4,4 0 1,1 212,316 M195,328 Q200,332 205,328`,
      `M148,260 Q132,275 128,295 Q130,300 140,290 Q150,275 152,262 M252,260 Q268,275 272,295 Q270,300 260,290 Q250,275 248,262`,
      `M158,280 Q145,295 142,310 Q145,315 152,305 Q158,292 160,282 M242,280 Q255,295 258,310 Q255,315 248,305 Q242,292 240,282 M200,298 Q200,310 205,315 Q208,312 204,302`,
    ],
  },
  Fish: {
    animal: 'Fish',
    primaryColor: '#FF6347',
    secondaryColor: '#FFD700',
    auraColor: '#FFA07A',
    patterns: ['scales', 'fins'],
    traits: ['freedom', 'flow', 'abundance'],
    svgPaths: [
      `M130,220 Q120,260 140,310 Q170,350 200,355 Q230,350 260,310 Q280,260 270,220 Q250,190 200,180 Q150,190 130,220 Z`,
      `M270,260 Q300,230 310,200 Q315,195 305,210 Q290,240 275,255 M270,260 Q300,290 310,320 Q315,325 305,310 Q290,280 275,265`,
      `M185,185 Q190,155 200,145 Q210,155 215,185`,
      `M155,250 Q135,265 130,285 Q135,288 145,275 Q155,260 158,252 M245,250 Q265,265 270,285 Q265,288 255,275 Q245,260 242,252`,
      `M170,230 A8,8 0 1,1 170,231 M195,225 A8,8 0 1,1 195,226 M220,230 A8,8 0 1,1 220,231 M180,260 A8,8 0 1,1 180,261 M205,258 A8,8 0 1,1 205,259 M230,260 A8,8 0 1,1 230,261`,
      `M162,235 A8,8 0 1,1 162,236 M165,235 A3,3 0 1,1 165,236 M140,255 Q145,260 140,265`,
    ],
  },
  Tiger: {
    animal: 'Tiger',
    primaryColor: '#FF8C00',
    secondaryColor: '#1C1C1C',
    auraColor: '#FFD700',
    patterns: ['stripes', 'fierce'],
    traits: ['power', 'courage', 'passion'],
    svgPaths: [
      `M148,255 Q135,315 148,390 Q172,435 200,440 Q228,435 252,390 Q265,315 252,255 Q235,238 200,232 Q165,238 148,255 Z`,
      `M158,125 Q152,160 162,195 Q180,218 200,222 Q220,218 238,195 Q248,160 242,125 Q230,102 200,96 Q170,102 158,125 Z`,
      `M165,118 L155,85 L180,108 Z M235,118 L245,85 L220,108 Z`,
      `M165,280 Q175,275 185,282 M170,310 Q182,305 192,312 M168,340 Q180,335 190,342 M235,280 Q225,275 215,282 M230,310 Q218,305 208,312 M232,340 Q220,335 210,342`,
      `M168,135 Q175,130 180,138 M232,135 Q225,130 220,138 M172,155 Q178,150 182,158 M228,155 Q222,150 218,158`,
      `M182,148 A6,6 0 1,1 182,149 M218,148 A6,6 0 1,1 218,149 M195,172 Q200,178 205,172 Z M192,185 Q200,192 208,185`,
    ],
  },
  Panda: {
    animal: 'Panda',
    primaryColor: '#FFFFFF',
    secondaryColor: '#1C1C1C',
    auraColor: '#C0C0C0',
    patterns: ['patches', 'bamboo'],
    traits: ['peace', 'balance', 'gentleness'],
    svgPaths: [
      // Big round chubby white body
      `M140,255 Q122,325 140,410 Q168,455 200,460 Q232,455 260,410 Q278,325 260,255 Q240,235 200,230 Q160,235 140,255 Z`,
      // Dark arm patches (left + right)
      `M140,275 Q115,292 108,325 Q112,342 128,332 Q142,312 145,288 Z M260,275 Q285,292 292,325 Q288,342 272,332 Q258,312 255,288 Z`,
      // Round white head
      `M155,110 Q148,148 158,190 Q178,218 200,222 Q222,218 242,190 Q252,148 245,110 Q232,85 200,78 Q168,85 155,110 Z`,
      // Black round ears
      `M158,98 Q142,78 148,62 Q158,55 170,68 Q178,85 168,102 Z M242,98 Q258,78 252,62 Q242,55 230,68 Q222,85 232,102 Z`,
      // Iconic black eye patches
      `M168,125 Q165,142 172,158 Q184,168 196,160 Q202,148 198,132 Q190,122 178,120 Q168,122 168,125 Z M232,125 Q235,142 228,158 Q216,168 204,160 Q198,148 202,132 Q210,122 222,120 Q232,122 232,125 Z`,
      // White eyes inside patches + big nose + smile
      `M180,138 A6,6 0 1,1 180,139 M220,138 A6,6 0 1,1 220,139 M183,140 A2,2 0 1,1 183,141 M223,140 A2,2 0 1,1 223,141 M192,172 Q196,166 200,164 Q204,166 208,172 Q204,178 200,180 Q196,178 192,172 Z M192,186 Q196,192 200,194 Q204,192 208,186`,
      // Dark legs at bottom
      `M160,410 Q152,430 158,445 Q168,450 175,440 Q178,425 172,412 Z M240,410 Q248,430 242,445 Q232,450 225,440 Q222,425 228,412 Z`,
    ],
  },
  Monkey: {
    animal: 'Monkey',
    primaryColor: '#CD853F',
    secondaryColor: '#FAEBD7',
    auraColor: '#D2B48C',
    patterns: ['playful', 'tail_grip'],
    traits: ['intelligence', 'playfulness', 'curiosity'],
    svgPaths: [
      `M158,260 Q148,315 158,380 Q178,418 200,422 Q222,418 242,380 Q252,315 242,260 Q228,245 200,240 Q172,245 158,260 Z`,
      `M162,125 Q158,158 168,192 Q184,215 200,218 Q216,215 232,192 Q242,158 238,125 Q228,105 200,100 Q172,105 162,125 Z`,
      `M172,140 Q170,165 178,188 Q190,205 200,208 Q210,205 222,188 Q230,165 228,140 Q222,125 200,120 Q178,125 172,140 Z`,
      `M155,130 Q138,125 132,138 Q130,152 142,158 Q155,155 160,142 Z M245,130 Q262,125 268,138 Q270,152 258,158 Q245,155 240,142 Z`,
      `M242,370 Q268,355 280,330 Q288,308 278,298 Q268,305 272,325 Q268,345 255,360 Q260,340 265,318 Q268,302 260,295 Q252,300 255,320 Q252,342 245,358`,
      `M185,155 A5,5 0 1,1 185,156 M215,155 A5,5 0 1,1 215,156 M196,172 Q200,176 204,172 Z M188,185 Q195,192 200,194 Q205,192 212,185`,
    ],
  },
  Elephant: {
    animal: 'Elephant',
    primaryColor: '#A9A9A9',
    secondaryColor: '#D3D3D3',
    auraColor: '#C0C0C0',
    patterns: ['wrinkles', 'big_ears'],
    traits: ['wisdom', 'memory', 'strength'],
    svgPaths: [
      `M135,260 Q118,330 135,410 Q165,455 200,460 Q235,455 265,410 Q282,330 265,260 Q245,238 200,232 Q155,238 135,260 Z`,
      `M158,120 Q152,158 162,198 Q182,225 200,228 Q218,225 238,198 Q248,158 242,120 Q230,95 200,88 Q170,95 158,120 Z`,
      `M155,140 Q125,130 108,160 Q95,200 108,235 Q125,250 145,240 Q155,220 158,195 Q160,170 158,150`,
      `M245,140 Q275,130 292,160 Q305,200 292,235 Q275,250 255,240 Q245,220 242,195 Q240,170 242,150`,
      `M192,200 Q188,230 185,260 Q180,290 175,310 Q172,330 178,340 Q185,335 182,315 Q186,295 190,270 Q195,245 198,220 M208,200 Q212,230 215,260 Q220,290 225,310 Q228,330 222,340 Q215,335 218,315 Q214,295 210,270 Q205,245 202,220`,
      `M178,148 A5,5 0 1,1 178,149 M222,148 A5,5 0 1,1 222,149 M185,215 Q182,235 180,245 M215,215 Q218,235 220,245`,
    ],
  },
  Snake: {
    animal: 'Snake',
    primaryColor: '#228B22',
    secondaryColor: '#32CD32',
    auraColor: '#00FF7F',
    patterns: ['scales', 'diamond_back'],
    traits: ['transformation', 'healing', 'stealth'],
    svgPaths: [
      `M160,150 Q140,180 150,220 Q165,260 200,270 Q240,265 260,230 Q275,195 260,160 Q242,135 215,140 Q195,150 190,175 Q188,205 200,225 Q215,240 235,235 Q250,225 252,205 Q252,185 238,175 Q222,170 212,182 Q208,198 218,208 Q228,212 235,205`,
      `M155,145 Q148,135 152,122 Q160,112 172,118 Q178,128 170,140 Q165,148 158,148`,
      `M150,130 Q140,125 132,128 Q138,132 145,130 Q140,135 132,138`,
      `M162,128 A3,3 0 1,1 162,129`,
      `M175,195 L180,188 L185,195 L180,202 Z M215,225 L220,218 L225,225 L220,232 Z M245,195 L250,188 L255,195 L250,202 Z`,
      `M218,208 Q225,215 230,208 Q232,202 228,198`,
    ],
  },
  Frog: {
    animal: 'Frog',
    primaryColor: '#32CD32',
    secondaryColor: '#ADFF2F',
    auraColor: '#7FFF00',
    patterns: ['spots', 'webbed_feet'],
    traits: ['transformation', 'luck', 'adaptability'],
    svgPaths: [
      `M140,250 Q125,300 145,360 Q175,400 200,405 Q225,400 255,360 Q275,300 260,250 Q240,235 200,230 Q160,235 140,250 Z`,
      `M145,170 Q140,200 155,228 Q178,248 200,250 Q222,248 245,228 Q260,200 255,170 Q242,148 200,140 Q158,148 145,170 Z`,
      `M158,155 Q148,138 155,125 Q168,118 178,130 Q182,145 172,158 Z`,
      `M242,155 Q252,138 245,125 Q232,118 222,130 Q218,145 228,158 Z`,
      `M165,138 A5,5 0 1,1 165,139 M235,138 A5,5 0 1,1 235,139`,
      `M172,200 Q185,215 200,218 Q215,215 228,200 M165,280 A6,6 0 1,1 165,281 M200,270 A6,6 0 1,1 200,271 M235,280 A6,6 0 1,1 235,281 M180,320 A5,5 0 1,1 180,321 M220,320 A5,5 0 1,1 220,321`,
    ],
  },
  Butterfly: {
    animal: 'Butterfly',
    primaryColor: '#FF69B4',
    secondaryColor: '#9370DB',
    auraColor: '#FFB6C1',
    patterns: ['wing_pattern', 'symmetry'],
    traits: ['transformation', 'beauty', 'freedom'],
    svgPaths: [
      `M195,200 Q155,170 130,140 Q110,110 120,90 Q140,80 160,100 Q180,130 190,170 Z`,
      `M195,220 Q155,250 130,280 Q115,310 128,325 Q148,322 165,300 Q182,270 192,240 Z`,
      `M205,200 Q245,170 270,140 Q290,110 280,90 Q260,80 240,100 Q220,130 210,170 Z`,
      `M205,220 Q245,250 270,280 Q285,310 272,325 Q252,322 235,300 Q218,270 208,240 Z`,
      `M196,160 Q194,200 196,250 Q198,290 200,310 Q202,290 204,250 Q206,200 204,160 Z`,
      `M155,135 A8,8 0 1,1 155,136 M245,135 A8,8 0 1,1 245,136 M150,280 A6,6 0 1,1 150,281 M250,280 A6,6 0 1,1 250,281 M196,160 Q185,135 180,118 M204,160 Q215,135 220,118 M178,115 A4,4 0 1,1 178,116 M222,115 A4,4 0 1,1 222,116 M196,168 A6,6 0 1,1 196,169`,
    ],
  },
  Bee: {
    animal: 'Bee',
    primaryColor: '#FFD700',
    secondaryColor: '#1C1C1C',
    auraColor: '#FFA500',
    patterns: ['stripes', 'hexagon'],
    traits: ['industry', 'community', 'sweetness'],
    svgPaths: [
      `M155,230 Q138,280 155,340 Q178,380 200,385 Q222,380 245,340 Q262,280 245,230 Q228,215 200,210 Q172,215 155,230 Z`,
      `M160,255 Q180,248 200,246 Q220,248 240,255 Q238,265 220,260 Q200,258 180,260 Q162,265 160,255 Z M158,290 Q180,282 200,280 Q220,282 242,290 Q240,300 220,295 Q200,292 180,295 Q160,300 158,290 Z M162,325 Q180,318 200,316 Q220,318 238,325 Q236,335 220,330 Q200,328 180,330 Q164,335 162,325 Z`,
      `M170,155 Q165,180 175,205 Q188,218 200,220 Q212,218 225,205 Q235,180 230,155 Q222,138 200,132 Q178,138 170,155 Z`,
      `M148,235 Q118,215 105,195 Q98,178 112,175 Q128,182 142,205 Q150,220 152,232 M252,235 Q282,215 295,195 Q302,178 288,175 Q272,182 258,205 Q250,220 248,232`,
      `M190,138 Q182,118 178,105 Q176,98 182,100 Q186,108 188,125 M210,138 Q218,118 222,105 Q224,98 218,100 Q214,108 212,125`,
      `M185,165 A5,5 0 1,1 185,166 M215,165 A5,5 0 1,1 215,166 M200,385 L200,405 Q198,410 200,415`,
    ],
  },
  Ladybug: {
    animal: 'Ladybug',
    primaryColor: '#DC143C',
    secondaryColor: '#1C1C1C',
    auraColor: '#FF6347',
    patterns: ['spots', 'shell'],
    traits: ['luck', 'protection', 'joy'],
    svgPaths: [
      `M135,200 Q120,260 140,330 Q170,370 200,375 Q230,370 260,330 Q280,260 265,200 Q248,175 200,168 Q152,175 135,200 Z`,
      `M200,175 L200,375`,
      `M160,220 A12,12 0 1,1 160,221 M240,220 A12,12 0 1,1 240,221 M175,270 A10,10 0 1,1 175,271 M225,270 A10,10 0 1,1 225,271 M160,320 A10,10 0 1,1 160,321 M240,320 A10,10 0 1,1 240,321 M200,290 A8,8 0 1,1 200,291`,
      `M170,175 Q168,155 178,140 Q190,130 200,128 Q210,130 222,140 Q232,155 230,175 Q222,185 200,188 Q178,185 170,175 Z`,
      `M185,140 Q175,118 170,105 Q168,98 175,102 Q180,112 188,132 M215,140 Q225,118 230,105 Q232,98 225,102 Q220,112 212,132`,
      `M188,155 A4,4 0 1,1 188,156 M212,155 A4,4 0 1,1 212,156`,
    ],
  },
  Koala: {
    animal: 'Koala',
    primaryColor: '#808080',
    secondaryColor: '#D3D3D3',
    auraColor: '#C0C0C0',
    patterns: ['fluffy_ears', 'sleepy'],
    traits: ['calm', 'contentment', 'dreams'],
    svgPaths: [
      `M148,260 Q132,325 148,400 Q175,445 200,448 Q225,445 252,400 Q268,325 252,260 Q235,242 200,238 Q165,242 148,260 Z`,
      `M162,125 Q155,162 165,200 Q182,225 200,228 Q218,225 235,200 Q245,162 238,125 Q228,102 200,96 Q172,102 162,125 Z`,
      `M152,120 Q128,105 118,118 Q110,138 122,155 Q138,162 155,152 Q162,140 158,128`,
      `M248,120 Q272,105 282,118 Q290,138 278,155 Q262,162 245,152 Q238,140 242,128`,
      `M190,175 Q192,168 200,165 Q208,168 210,175 Q208,182 200,185 Q192,182 190,175 Z`,
      `M178,148 Q182,142 188,148 M212,148 Q218,142 222,148 M195,190 Q200,194 205,190`,
    ],
  },
  Sloth: {
    animal: 'Sloth',
    primaryColor: '#C4A882',
    secondaryColor: '#8B7355',
    auraColor: '#D2B48C',
    patterns: ['moss', 'sleepy'],
    traits: ['patience', 'peace', 'mindfulness'],
    svgPaths: [
      `M152,260 Q138,320 152,395 Q178,435 200,440 Q222,435 248,395 Q262,320 248,260 Q232,245 200,240 Q168,245 152,260 Z`,
      `M162,130 Q158,165 168,200 Q184,222 200,225 Q216,222 232,200 Q242,165 238,130 Q228,108 200,102 Q172,108 162,130 Z`,
      `M172,138 Q170,150 178,160 Q188,165 195,158 Q198,148 192,138 Q185,132 178,132 Q172,135 172,138 Z M228,138 Q230,150 222,160 Q212,165 205,158 Q202,148 208,138 Q215,132 222,132 Q228,135 228,138 Z`,
      `M148,275 Q120,280 100,300 Q85,325 90,345 Q98,348 100,335 Q108,315 125,298 Q142,285 150,278 M252,275 Q280,280 300,300 Q315,325 310,345 Q302,348 300,335 Q292,315 275,298 Q258,285 250,278`,
      `M88,342 L82,355 M92,345 L88,358 M96,346 L94,360 M312,342 L318,355 M308,345 L312,358 M304,346 L306,360`,
      `M182,148 Q186,143 190,148 M210,148 Q214,143 218,148 M196,168 Q200,172 204,168 Z M192,178 Q200,185 208,178`,
    ],
  },
  Hedgehog: {
    animal: 'Hedgehog',
    primaryColor: '#8B7355',
    secondaryColor: '#FAEBD7',
    auraColor: '#D2B48C',
    patterns: ['spines', 'curl'],
    traits: ['protection', 'determination', 'heart'],
    svgPaths: [
      `M148,260 Q135,315 148,385 Q172,425 200,428 Q228,425 252,385 Q265,315 252,260 Q235,245 200,240 Q165,245 148,260 Z`,
      `M148,260 L138,240 L152,250 L142,228 L158,242 L148,218 L165,238 L158,212 L175,232 L170,208 L188,228 L185,205 L200,225 L215,205 L212,228 L230,208 L225,232 L242,212 L235,238 L252,218 L242,242 L258,228 L248,250 L262,240 L252,260`,
      `M168,290 Q162,310 170,335 Q185,352 200,355 Q215,352 230,335 Q238,310 232,290 Q222,278 200,275 Q178,278 168,290 Z`,
      `M178,282 Q172,272 176,265 Q182,262 186,270 Q186,278 180,285 Z M222,282 Q228,272 224,265 Q218,262 214,270 Q214,278 220,285 Z`,
      `M188,310 A4,4 0 1,1 188,311 M212,310 A4,4 0 1,1 212,311 M196,325 Q200,330 204,325 Z M194,338 Q200,342 206,338`,
      `M172,380 Q165,392 168,400 Q175,398 175,388 M228,380 Q235,392 232,400 Q225,398 225,388`,
    ],
  },
};

// ============================================================================
// DRAGGABLE/ROTATABLE ITEM COMPONENT
// ============================================================================

export interface DraggableItemState {
  id: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
}

export interface DraggableItemProps {
  id: string;
  initialX: number;
  initialY: number;
  initialScale?: number;
  initialRotation?: number;
  children: React.ReactNode;
  onStateChange?: (state: DraggableItemState) => void;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
  minScale?: number;
  maxScale?: number;
}

export function DraggableItem({
  id,
  initialX,
  initialY,
  initialScale = 1,
  initialRotation = 0,
  children,
  onStateChange,
  onSelect,
  isSelected = false,
  minScale = 0.3,
  maxScale = 3,
}: DraggableItemProps) {
  const pan = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;
  const scale = useRef(new Animated.Value(initialScale)).current;
  const rotation = useRef(new Animated.Value(initialRotation)).current;
  
  const lastScale = useRef(initialScale);
  const lastRotation = useRef(initialRotation);
  const lastDistance = useRef(0);
  const lastAngle = useRef(0);
  const isMultiTouch = useRef(false);
  
  const reportState = () => {
    onStateChange?.({
      id,
      x: (pan.x as any)._value,
      y: (pan.y as any)._value,
      scale: (scale as any)._value,
      rotation: (rotation as any)._value,
      zIndex: isSelected ? 100 : 10,
    });
  };
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      
      onPanResponderGrant: (evt) => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
        onSelect?.(id);
        isMultiTouch.current = evt.nativeEvent.touches.length > 1;
      },
      
      onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const touches = evt.nativeEvent.touches;
        
        if (touches.length >= 2) {
          isMultiTouch.current = true;
          const touch1 = touches[0];
          const touch2 = touches[1];
          
          const dx = touch2.pageX - touch1.pageX;
          const dy = touch2.pageY - touch1.pageY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          
          if (lastDistance.current > 0) {
            const scaleDelta = distance / lastDistance.current;
            const newScale = Math.max(minScale, Math.min(maxScale, lastScale.current * scaleDelta));
            scale.setValue(newScale);
          }
          
          if (lastAngle.current !== 0) {
            const angleDelta = angle - lastAngle.current;
            const newRotation = lastRotation.current + angleDelta;
            rotation.setValue(newRotation);
          }
          
          lastDistance.current = distance;
          lastAngle.current = angle;
        } else if (!isMultiTouch.current) {
          Animated.event([null, { dx: pan.x, dy: pan.y }], {
            useNativeDriver: false,
          })(evt, gestureState);
        }
      },
      
      onPanResponderRelease: () => {
        pan.flattenOffset();
        lastScale.current = (scale as any)._value;
        lastRotation.current = (rotation as any)._value;
        lastDistance.current = 0;
        lastAngle.current = 0;
        isMultiTouch.current = false;
        reportState();
      },
    })
  ).current;
  
  const animatedStyle = {
    transform: [
      { translateX: pan.x },
      { translateY: pan.y },
      { scale: scale },
      {
        rotate: rotation.interpolate({
          inputRange: [-360, 360],
          outputRange: ['-360deg', '360deg'],
        }),
      },
    ],
    zIndex: isSelected ? 100 : 10,
  };
  
  return (
    <Animated.View
      style={[styles.draggableItem, animatedStyle, isSelected && styles.draggableItemSelected]}
      {...panResponder.panHandlers}
    >
      {children}
      {isSelected && (
        <View style={styles.selectionIndicator}>
          <View style={styles.rotateHandle} />
          <View style={styles.scaleHandle} />
        </View>
      )}
    </Animated.View>
  );
}

// ============================================================================
// COLOR CUSTOMIZATION SYSTEM
// ============================================================================

export interface ColorRegion {
  id: string;
  name: string;
  defaultColor: string;
  currentColor: string;
}

export const DEFAULT_COLOR_REGIONS: ColorRegion[] = [
  { id: 'skin', name: 'Skin', defaultColor: '#E8C4A0', currentColor: '#E8C4A0' },
  { id: 'hair', name: 'Hair', defaultColor: '#2C1810', currentColor: '#2C1810' },
  { id: 'eyes', name: 'Eyes', defaultColor: '#4A90D9', currentColor: '#4A90D9' },
  { id: 'primary', name: 'Primary', defaultColor: '#4A90D9', currentColor: '#4A90D9' },
  { id: 'secondary', name: 'Secondary', defaultColor: '#333333', currentColor: '#333333' },
  { id: 'accent', name: 'Accent', defaultColor: '#D4AF37', currentColor: '#D4AF37' },
  { id: 'outline', name: 'Outline', defaultColor: '#000000', currentColor: '#000000' },
];

export const COLOR_PALETTES = {
  // ==================== SKIN TONES (40 colors) ====================
  skin: [
    // Light
    '#FFF5EB', '#FFEFDB', '#FFE7CC', '#FFDFC4', '#FFD7B5',
    '#F5DEB3', '#F0D5BE', '#EECEB3', '#E8C4A0', '#E5C298',
    // Medium
    '#E1B899', '#DEB087', '#D4A574', '#CFA267', '#C89B5D',
    '#C68642', '#BB7744', '#B06B3A', '#A66032', '#9B5629',
    // Tan
    '#8D5524', '#845023', '#7A4A22', '#6F4420', '#694022',
    '#5C3A1E', '#4F321A', '#4A3728', '#3F2D1F', '#3B2219',
    // Deep
    '#2C1810', '#241510', '#1C120D', '#18100B', '#140E09',
    // Fantasy
    '#E8BEAC', '#D4A190', '#C4E8C4', '#A8D8A8', '#E8D4F0',
    '#D0B8E0', '#B8E8E8', '#98D8D8', '#F0E8A8', '#E8E0A0',
  ],
  
  // ==================== HAIR COLORS (50 colors) ====================
  hair: [
    // Natural Blonde
    '#FFFEF0', '#FFF8DC', '#FAEBD7', '#FFE4B5', '#F5DEB3',
    '#EED9B6', '#DEB887', '#D2B48C', '#C9A86C', '#BFA05A',
    // Natural Brown
    '#A0522D', '#8B5A2B', '#8B4513', '#7B3F00', '#704214',
    '#5C4033', '#4A3728', '#3D2B1F', '#2C1810', '#1C1008',
    // Natural Black
    '#1A1110', '#0F0D0C', '#0A0908', '#050404', '#000000',
    // Natural Red
    '#FF6347', '#E55B3C', '#CD5C5C', '#B8473D', '#A0522D',
    '#8B3A3A', '#7C2D2D', '#6B1F1F', '#5A1A1A', '#4A1515',
    // Gray/Silver
    '#FFFFFF', '#F5F5F5', '#E8E8E8', '#D3D3D3', '#C0C0C0',
    '#A9A9A9', '#808080', '#696969', '#505050', '#383838',
    // Fantasy
    '#FF1493', '#FF69B4', '#DA70D6', '#BA55D3', '#9932CC',
    '#8B008B', '#4B0082', '#483D8B', '#191970', '#00CED1',
    '#20B2AA', '#00FA9A', '#32CD32', '#7FFF00', '#ADFF2F',
  ],
  
  // ==================== EYE COLORS (45 colors) ====================
  eyes: [
    // Brown
    '#8B4513', '#A0522D', '#8B5A2B', '#7B3F00', '#6B4423',
    '#5C4033', '#4A3728', '#3D2B1F', '#2C1810', '#1C1008',
    // Blue
    '#87CEEB', '#87CEFA', '#00BFFF', '#1E90FF', '#6495ED',
    '#4169E1', '#4682B4', '#0000CD', '#00008B', '#000080',
    // Green
    '#98FB98', '#90EE90', '#32CD32', '#228B22', '#008000',
    '#006400', '#2E8B57', '#3CB371', '#66CDAA', '#00FA9A',
    // Gray
    '#D3D3D3', '#C0C0C0', '#A9A9A9', '#808080', '#696969',
    // Hazel/Amber
    '#FFD700', '#FFA500', '#DAA520', '#B8860B', '#CD853F',
    // Fantasy
    '#FF0000', '#DC143C', '#FF1493', '#FF00FF', '#8B008B',
    '#4B0082', '#9400D3', '#00FFFF', '#E6E6FA', '#FFFFFF',
  ],
  
  // ==================== PRIMARY CLOTHING (60 colors) ====================
  clothing: [
    // Whites & Creams
    '#FFFFFF', '#FFFAFA', '#F5F5F5', '#FFFAF0', '#FDF5E6',
    '#FAF0E6', '#FAEBD7', '#FFEBCD', '#FFE4C4', '#FFDAB9',
    // Grays
    '#DCDCDC', '#D3D3D3', '#C0C0C0', '#A9A9A9', '#808080',
    '#696969', '#5A5A5A', '#4A4A4A', '#3A3A3A', '#2F2F2F',
    '#1A1A1A', '#0F0F0F', '#000000',
    // Reds
    '#FFC0CB', '#FFB6C1', '#FF69B4', '#FF1493', '#DB7093',
    '#FF6B6B', '#FF4500', '#FF0000', '#DC143C', '#B22222',
    '#8B0000', '#800000', '#660000', '#4D0000', '#330000',
    // Oranges
    '#FFEFD5', '#FFE4B5', '#FFDAB9', '#FFA07A', '#FF8C00',
    '#FF7F50', '#FF6347', '#E9967A', '#FA8072', '#F08080',
    // Yellows
    '#FFFACD', '#FAFAD2', '#FFFFE0', '#FFEFD5', '#FFE4B5',
    '#FFD700', '#FFC125', '#FFB90F', '#EEAD0E', '#CD950C',
    // Greens
    '#F0FFF0', '#98FB98', '#90EE90', '#00FF7F', '#00FA9A',
    '#7CFC00', '#7FFF00', '#ADFF2F', '#32CD32', '#9ACD32',
    '#228B22', '#008000', '#006400', '#2E8B57', '#3CB371',
  ],
  
  // ==================== SECONDARY CLOTHING (50 colors) ====================
  secondary: [
    // Blues
    '#F0F8FF', '#E6E6FA', '#B0E0E6', '#ADD8E6', '#87CEEB',
    '#87CEFA', '#00BFFF', '#1E90FF', '#6495ED', '#4169E1',
    '#4682B4', '#5F9EA0', '#00CED1', '#20B2AA', '#008B8B',
    '#0000FF', '#0000CD', '#00008B', '#000080', '#191970',
    // Purples
    '#E6E6FA', '#D8BFD8', '#DDA0DD', '#EE82EE', '#DA70D6',
    '#FF00FF', '#BA55D3', '#9370DB', '#8A2BE2', '#9400D3',
    '#9932CC', '#8B008B', '#800080', '#4B0082', '#483D8B',
    // Teals & Cyans
    '#E0FFFF', '#AFEEEE', '#7FFFD4', '#40E0D0', '#48D1CC',
    '#00FFFF', '#00CED1', '#5F9EA0', '#008B8B', '#008080',
    '#006666', '#004D4D', '#003333', '#001A1A', '#000F0F',
  ],
  
  // ==================== ACCENT COLORS (40 colors) ====================
  accent: [
    // Golds
    '#FFF8DC', '#FFFACD', '#FFD700', '#FFC125', '#FFB90F',
    '#EEAD0E', '#DAA520', '#CD950C', '#B8860B', '#8B6914',
    // Silvers
    '#FFFFFF', '#F8F8FF', '#DCDCDC', '#C0C0C0', '#A9A9A9',
    '#989898', '#888888', '#787878', '#696969', '#585858',
    // Bronze/Copper
    '#FFD39B', '#EECFA1', '#CDAA7D', '#C9A86C', '#B8860B',
    '#CD7F32', '#B87333', '#A66D2B', '#8B5A2B', '#704214',
    // Jewel Tones
    '#E0115F', '#FF0038', '#E62020', '#CC0000', '#960018',
    '#00FF00', '#00CC00', '#009900', '#006600', '#003300',
    '#0000FF', '#0000CC', '#000099', '#000066', '#000033',
  ],
  
  // ==================== METALLIC (30 colors) ====================
  metallic: [
    // Gold
    '#FFD700', '#FFC125', '#FFB90F', '#EEAD0E', '#DAA520',
    '#CD950C', '#B8860B', '#D4AF37', '#CFB53B', '#C9AE5D',
    // Silver
    '#E8E8E8', '#E5E4E2', '#D8D8D8', '#C0C0C0', '#B8B8B8',
    '#A8A8A8', '#989898', '#888888', '#787878', '#696969',
    // Bronze/Copper
    '#CD7F32', '#B87333', '#AA6C39', '#A66D2B', '#8B5A2B',
    '#7A4A2A', '#704214', '#5C3317', '#4A2511', '#3D1C0A',
    // Steel/Iron
    '#71797E', '#676767', '#5A5A5A', '#4E4E4E', '#434343',
    // Platinum
    '#E5E4E2', '#E0DFDB', '#D9D9D6', '#D3D3CF', '#CECECA',
  ],
  
  // ==================== MAGIC/GLOW (35 colors) ====================
  magic: [
    // Fire
    '#FF4500', '#FF6B00', '#FF8C00', '#FFA500', '#FFBF00',
    '#FFD700', '#FFEA00', '#FFFF00',
    // Ice
    '#E0FFFF', '#B0E0E6', '#ADD8E6', '#87CEEB', '#87CEFA',
    '#00BFFF', '#1E90FF', '#6495ED',
    // Lightning
    '#FFFACD', '#FFFF00', '#FFD700', '#FFA500', '#87CEFA',
    '#00BFFF', '#E6E6FA', '#FFFFFF',
    // Holy
    '#FFFFF0', '#FFFACD', '#FFD700', '#FFEFD5', '#FFFFFF',
    // Shadow
    '#4B0082', '#483D8B', '#2F2F4F', '#1C1C2C', '#0D0D15',
    '#0A0A0F', '#050508', '#020203', '#000000',
    // Void
    '#1A0033', '#0D001A', '#05000D', '#020005', '#000000',
  ],
  
  // ==================== NATURE (30 colors) ====================
  nature: [
    // Forest
    '#228B22', '#2E8B57', '#3CB371', '#66CDAA', '#8FBC8F',
    '#90EE90', '#98FB98', '#00FF7F', '#00FA9A', '#7CFC00',
    // Earth
    '#DEB887', '#D2B48C', '#C4A777', '#BC8F8F', '#A0522D',
    '#8B7355', '#8B4513', '#7B3F00', '#654321', '#3D2314',
    // Sky
    '#87CEEB', '#87CEFA', '#00BFFF', '#1E90FF', '#6495ED',
    // Water
    '#00CED1', '#20B2AA', '#5F9EA0', '#4682B4', '#008B8B',
    // Sand
    '#F5DEB3', '#DEB887', '#D2B48C', '#C4A777', '#B8A060',
  ],
  
  // ==================== OUTLINE (15 colors) ====================
  outline: [
    '#000000', '#1A1A1A', '#2F2F2F', '#3A3A3A', '#4A4A4A',
    '#5A5A5A', '#696969', '#808080', '#2C1810', '#4A3728',
    '#191970', '#4B0082', '#800000', '#006400', '#8B4513',
  ],
};

// ==================== COLOR REGIONS FOR AVATAR ====================
export const AVATAR_COLOR_REGIONS = [
  { id: 'skin', name: 'Skin', palette: 'skin' },
  { id: 'hair', name: 'Hair', palette: 'hair' },
  { id: 'eyes', name: 'Eyes', palette: 'eyes' },
  { id: 'eyebrows', name: 'Eyebrows', palette: 'hair' },
  { id: 'lips', name: 'Lips', palette: 'skin' },
  { id: 'primary', name: 'Primary Outfit', palette: 'clothing' },
  { id: 'secondary', name: 'Secondary Outfit', palette: 'secondary' },
  { id: 'accent', name: 'Accent', palette: 'accent' },
  { id: 'armor', name: 'Armor', palette: 'metallic' },
  { id: 'weapon', name: 'Weapon', palette: 'metallic' },
  { id: 'magic', name: 'Magic/Aura', palette: 'magic' },
  { id: 'nature', name: 'Nature Elements', palette: 'nature' },
  { id: 'outline', name: 'Outline', palette: 'outline' },
];

// ==================== COLOR MIXER ====================
export function mixColors(color1: string, color2: string, ratio: number = 0.5): string {
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');
  
  const r1 = parseInt(hex1.slice(0, 2), 16);
  const g1 = parseInt(hex1.slice(2, 4), 16);
  const b1 = parseInt(hex1.slice(4, 6), 16);
  
  const r2 = parseInt(hex2.slice(0, 2), 16);
  const g2 = parseInt(hex2.slice(2, 4), 16);
  const b2 = parseInt(hex2.slice(4, 6), 16);
  
  const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
  const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
  const b = Math.round(b1 * (1 - ratio) + b2 * ratio);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function lightenColor(color: string, amount: number = 0.2): string {
  return mixColors(color, '#FFFFFF', amount);
}

export function darkenColor(color: string, amount: number = 0.2): string {
  return mixColors(color, '#000000', amount);
}

export function saturateColor(color: string, amount: number = 0.2): string {
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  
  const gray = (r + g + b) / 3;
  
  const newR = Math.round(Math.min(255, Math.max(0, r + (r - gray) * amount)));
  const newG = Math.round(Math.min(255, Math.max(0, g + (g - gray) * amount)));
  const newB = Math.round(Math.min(255, Math.max(0, b + (b - gray) * amount)));
  
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

// Generate color gradient between two colors
export function generateGradient(color1: string, color2: string, steps: number = 5): string[] {
  const gradient: string[] = [];
  for (let i = 0; i <= steps; i++) {
    gradient.push(mixColors(color1, color2, i / steps));
  }
  return gradient;
}

// Get complementary color
export function getComplementary(color: string): string {
  const hex = color.replace('#', '');
  const r = 255 - parseInt(hex.slice(0, 2), 16);
  const g = 255 - parseInt(hex.slice(2, 4), 16);
  const b = 255 - parseInt(hex.slice(4, 6), 16);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Get analogous colors (adjacent on color wheel)
export function getAnalogous(color: string, angle: number = 30): [string, string] {
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  
  // Convert to HSL, rotate, convert back (simplified)
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2 / 255;
  const s = max === min ? 0 : (l > 0.5 ? (max - min) / (2 * 255 - max - min) : (max - min) / (max + min));
  
  if (max !== min) {
    if (max === r) h = ((g - b) / (max - min)) * 60;
    else if (max === g) h = (2 + (b - r) / (max - min)) * 60;
    else h = (4 + (r - g) / (max - min)) * 60;
  }
  if (h < 0) h += 360;
  
  const hslToHex = (h: number, s: number, l: number): string => {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return `#${Math.round((r + m) * 255).toString(16).padStart(2, '0')}${Math.round((g + m) * 255).toString(16).padStart(2, '0')}${Math.round((b + m) * 255).toString(16).padStart(2, '0')}`;
  };
  
  return [
    hslToHex((h + angle) % 360, s, l),
    hslToHex((h - angle + 360) % 360, s, l),
  ];
}

export interface ColorPickerProps {
  region: ColorRegion;
  palette: string[];
  onColorSelect: (regionId: string, color: string) => void;
}

export function ColorPicker({ region, palette, onColorSelect }: ColorPickerProps) {
  return (
    <View style={styles.colorPickerContainer}>
      <Text style={styles.colorPickerLabel}>{region.name}</Text>
      <View style={styles.colorPickerPalette}>
        {palette.map((color, index) => (
          <TouchableOpacity
            key={`${color}-${index}`}
            style={[
              styles.colorSwatch,
              { backgroundColor: color },
              region.currentColor === color && styles.colorSwatchSelected,
            ]}
            onPress={() => onColorSelect(region.id, color)}
          />
        ))}
      </View>
    </View>
  );
}

// ============================================================================
// TYPING CADENCE BIOMETRIC
// ============================================================================

export interface JitterSample {
  timestamp: number;
  delta: number;
  key?: string;
}

export interface JitterAnalysis {
  passed: boolean;
  humanScore: number;
  flags: string[];
  entropy: number;
  rhythmScore: number;
}

export interface JitterCommitment {
  commitment: string;
  salt: string;
  humanScore: number;
  passed: boolean;
  sampleCount: number;
  timestamp: number;
}

export function analyzeTypingCadence(samples: JitterSample[]): JitterAnalysis {
  if (samples.length < 20) {
    return { passed: false, humanScore: 0, flags: ['insufficient_samples'], entropy: 0, rhythmScore: 0 };
  }
  
  const deltas = samples.map(s => s.delta).filter(d => d > 0 && d < 2000);
  if (deltas.length < 10) {
    return { passed: false, humanScore: 0, flags: ['filtered_too_many'], entropy: 0, rhythmScore: 0 };
  }
  
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const variance = deltas.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / deltas.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;
  
  const bins = new Array(20).fill(0);
  for (const d of deltas) {
    const bin = Math.min(19, Math.floor(d / 100));
    bins[bin]++;
  }
  let entropy = 0;
  for (const count of bins) {
    if (count > 0) {
      const p = count / deltas.length;
      entropy -= p * Math.log2(p);
    }
  }
  entropy = entropy / Math.log2(20);
  
  const flags: string[] = [];
  let score = 50;
  
  if (cv < 0.1) { flags.push('too_consistent'); score -= 30; }
  else if (cv > 0.15 && cv < 0.9) { score += 20; }
  else if (cv > 1.2) { flags.push('erratic'); score -= 15; }
  
  const deltaCounts: Record<number, number> = {};
  for (const d of deltas) {
    const rounded = Math.round(d / 10) * 10;
    deltaCounts[rounded] = (deltaCounts[rounded] || 0) + 1;
  }
  const maxRepeat = Math.max(...Object.values(deltaCounts));
  if (maxRepeat > deltas.length * 0.4) { flags.push('repeated_intervals'); score -= 25; }
  
  let longGaps = 0, shortRuns = 0, currentRun = 0;
  for (const d of deltas) {
    if (d > 300) { longGaps++; if (currentRun >= 3) shortRuns++; currentRun = 0; }
    else { currentRun++; }
  }
  const expectedGaps = deltas.length / 6;
  const gapRatio = longGaps / expectedGaps;
  const rhythmScore = (gapRatio > 0.5 && gapRatio < 2.0 && shortRuns > 2) ? 1.0 : (gapRatio > 0.3 && gapRatio < 3.0) ? 0.5 : 0;
  if (rhythmScore > 0.5) score += 15;
  
  if (entropy > 0.7) score += 10;
  else if (entropy < 0.3) { flags.push('low_entropy'); score -= 10; }
  
  if (mean < 50) { flags.push('superhuman_speed'); score -= 40; }
  else if (mean > 80 && mean < 400) score += 10;
  else if (mean > 1000) { flags.push('very_slow'); score -= 10; }
  
  return { passed: score >= 50 && flags.length < 2, humanScore: Math.max(0, Math.min(100, score)), flags, entropy, rhythmScore };
}

export async function createJitterCommitment(samples: JitterSample[]): Promise<JitterCommitment> {
  const analysis = analyzeTypingCadence(samples);
  const saltBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) saltBytes[i] = Math.floor(Math.random() * 256);
  const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const commitData = JSON.stringify({
    passed: analysis.passed,
    humanScore: analysis.humanScore,
    entropy: analysis.entropy,
    rhythmScore: analysis.rhythmScore,
    flagCount: analysis.flags.length,
    sampleCount: samples.length,
    salt,
  });
  
  const commitment = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, commitData);
  
  return { commitment, salt, humanScore: analysis.humanScore, passed: analysis.passed, sampleCount: samples.length, timestamp: Date.now() };
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  draggableItem: {
    position: 'absolute',
  },
  draggableItemSelected: {
    borderWidth: 2,
    borderColor: '#4A90D9',
    borderStyle: 'dashed',
    borderRadius: 4,
  },
  selectionIndicator: {
    position: 'absolute',
    top: -20,
    right: -20,
    flexDirection: 'row',
    gap: 4,
  },
  rotateHandle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4A90D9',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  scaleHandle: {
    width: 16,
    height: 16,
    backgroundColor: '#D4AF37',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  colorPickerContainer: {
    marginVertical: 8,
  },
  colorPickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  colorPickerPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  colorSwatchSelected: {
    borderColor: '#1A1A1A',
    borderWidth: 3,
  },
});

// ============================================================================
// SVG GENERATOR REGISTRY - Maps svgGenerator names to functions
// Covers all 122+ LEXICON entries with unique procedural SVG
// ============================================================================

export const SVG_GENERATORS: Record<string, (modifier?: string) => string[]> = {
  // ==================== MELEE WEAPONS ====================
  sword: (mod) => generateSword(mod),
  dagger: (mod) => generateDagger(mod),
  axe: (mod) => generateAxe(mod),
  hammer: (mod) => generateHammer(mod),
  spear: (mod) => generateSpear(mod),
  scythe: (mod) => generateScythe(mod),
  staff: (mod) => generateStaff(mod),
  whip: (mod) => generateWhip(mod),
  
  // ==================== RANGED WEAPONS ====================
  bow: (mod) => generateBow(mod),
  gun: (mod) => generateGun(mod),
  thrown: (mod) => generateThrown(mod),
  crossbow: (mod) => generateCrossbow(mod),
  
  // ==================== ARMOR & DEFENSE ====================
  shield: (mod) => generateShield(mod),
  armor: (mod) => generateArmor(mod),
  helmet: (mod) => generateHelmet(mod),
  gauntlet: (mod) => generateGauntlet(mod),
  
  // ==================== ACCESSORIES ====================
  crown: (mod) => generateCrown(mod),
  mask: (mod) => generateMask(mod),
  horns: (mod) => generateHorns(mod),
  hat: (mod) => generateHat(mod),
  cloak: (mod) => generateCloak(mod),
  ring: (mod) => generateRing(mod),
  amulet: (mod) => generateAmulet(mod),
  belt: (mod) => generateBelt(mod),
  boots: (mod) => generateBoots(mod),
  gloves: (mod) => generateGloves(mod),
  
  // ==================== BODY FEATURES ====================
  wings: (mod) => generateWings(mod),
  tail: (mod) => generateTail(mod),
  ears: (mod) => generateEars(mod),
  eyes: (mod) => generateEyeFeatures(mod),
  fangs: (mod) => generateFangs(mod),
  claws: (mod) => generateClaws(mod),
  scales: (mod) => generateScales(mod),
  fur: (mod) => generateFur(mod),
  
  // ==================== NATURE ====================
  flower: () => generateFlower(),
  tree: () => generateTree(),
  vine: () => generateVine(),
  mushroom: () => generateMushroom(),
  leaf: () => generateLeaf(),
  crystal: (mod) => generateCrystal(mod),
  gem: (mod) => generateGem(mod),
  
  // ==================== ANIMALS ====================
  wolf: () => generateWolfFeatures(),
  eagle: () => generateEagleFeatures(),
  lion: () => generateLionFeatures(),
  dragon: () => generateDragonFeatures(),
  phoenix: () => generatePhoenixFeatures(),
  snake: () => generateSnakeFeatures(),
  bear: () => generateBearFeatures(),
  owl: () => generateOwlFeatures(),
  raven: () => generateRavenFeatures(),
  tiger: () => generateTigerFeatures(),
  fox: () => generateFoxFeatures(),
  cat: () => generateCatFeatures(),
  horse: () => generateHorseFeatures(),
  
  // ==================== MAGICAL ====================
  wand: (mod) => generateWand(mod),
  orb: (mod) => generateOrb(mod),
  book: (mod) => generateBook(mod),
  scroll: (mod) => generateScroll(mod),
  potion: (mod) => generatePotion(mod),
  rune: (mod) => generateRune(mod),
  pentagram: (mod) => generatePentagram(mod),
  sigil: (mod) => generateSigil(mod),
  
  // ==================== TOOLS ====================
  torch: () => generateTorch(),
  lantern: () => generateLantern(),
  key: () => generateKey(),
  chain: () => generateChain(),
  rope: () => generateRope(),
  compass: () => generateCompass(),
  map: () => generateMap(),
  bag: () => generateBag(),
  
  // ==================== INSTRUMENTS ====================
  mic: (mod) => generateMicrophone(mod),
  guitar: () => generateGuitar(),
  drum: () => generateDrum(),
  flute: () => generateFlute(),
  harp: () => generateHarp(),
  horn: () => generateHornInstrument(),
  
  // ==================== SYMBOLS ====================
  skull: () => generateSkull(),
  heart: () => generateHeart(),
  star: () => generateStar(),
  moon: () => generateMoon(),
  sun: () => generateSun(),
  cross: () => generateCross(),
  anchor: () => generateAnchor(),
  
  // ==================== MISC ====================
  banner: (mod) => generateBanner(mod),
  flag: (mod) => generateFlag(mod),
  coin: () => generateCoin(),
  treasure: () => generateTreasure(),
  goblet: () => generateGoblet(),
  candle: () => generateCandle(),
};

// Fallback generic generator for any svgGenerator not in registry
function generateGenericItem(generatorName: string): string[] {
  const cx = 200, cy = 300, size = 40;
  const hash = generatorName.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const sides = 3 + (hash % 5);
  const paths: string[] = [];
  
  let d = `M${cx + size},${cy}`;
  for (let i = 1; i <= sides; i++) {
    const angle = (i * 2 * Math.PI) / sides;
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
  }
  d += ' Z';
  paths.push(d);
  
  const innerSize = size * 0.5;
  let inner = `M${cx + innerSize},${cy}`;
  for (let i = 1; i <= sides; i++) {
    const angle = (i * 2 * Math.PI) / sides + Math.PI / sides;
    const x = cx + innerSize * Math.cos(angle);
    const y = cy + innerSize * Math.sin(angle);
    inner += ` L${x.toFixed(1)},${y.toFixed(1)}`;
  }
  inner += ' Z';
  paths.push(inner);
  
  return paths;
}

// Master function to get SVG paths for any keyword
export function getSvgForKeyword(keyword: string, modifier?: string): string[] {
  if (SVG_GENERATORS[keyword]) {
    return SVG_GENERATORS[keyword](modifier);
  }
  
  const lexEntry = LEXICON[keyword];
  if (lexEntry?.svgGenerator && SVG_GENERATORS[lexEntry.svgGenerator]) {
    return SVG_GENERATORS[lexEntry.svgGenerator](modifier);
  }
  
  for (const [baseKey, entry] of Object.entries(LEXICON)) {
    if (entry.triggers?.includes(keyword)) {
      if (entry.svgGenerator && SVG_GENERATORS[entry.svgGenerator]) {
        return SVG_GENERATORS[entry.svgGenerator](modifier);
      }
    }
  }
  
  return generateGenericItem(keyword);
}

// ============================================================================
// SVG GENERATOR IMPLEMENTATIONS
// ============================================================================

function generateSword(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M200,100 L205,105 L208,150 L210,200 L212,250 L213,300 L212,350 L210,380 L208,390 L205,395 L200,398 L195,395 L192,390 L190,380 L188,350 L187,300 L188,250 L190,200 L192,150 L195,105 Z`);
  paths.push(`M200,105 L202,150 L203,250 L202,350 L200,395`);
  paths.push(`M198,130 L198,370 M202,130 L202,370`);
  paths.push(`M170,395 Q165,390 160,395 L155,400 L150,398 L148,405 L155,410 L165,408 L175,412 L200,415 L225,412 L235,408 L245,410 L252,405 L250,398 L245,400 L240,395 Q235,390 230,395 L200,398 Z`);
  for (let i = 0; i < 12; i++) {
    const y = 420 + i * 8;
    paths.push(`M192,${y} Q200,${y - 3} 208,${y} M192,${y + 4} Q200,${y + 7} 208,${y + 4}`);
  }
  paths.push(`M190,515 Q185,520 185,530 Q185,545 200,550 Q215,545 215,530 Q215,520 210,515 L200,512 Z`);
  if (modifier === 'fire') {
    for (let i = 0; i < 6; i++) {
      const y = 120 + i * 40;
      paths.push(`M210,${y} Q220,${y - 15} 225,${y - 30} Q222,${y - 20} 215,${y - 10}`);
    }
  }
  return paths;
}

function generateDagger(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M200,150 L208,160 L210,250 L205,280 L200,285 L195,280 L190,250 L192,160 Z`);
  paths.push(`M200,155 L202,200 L200,250`);
  paths.push(`M185,280 L200,290 L215,280 L212,310 L188,310 Z`);
  paths.push(`M195,310 L205,310 L203,350 L197,350 Z`);
  if (modifier === 'poison') {
    paths.push(`M202,170 Q210,180 208,190 Q215,200 212,210`);
  }
  return paths;
}

function generateAxe(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M200,100 L205,120 L205,350 L195,350 L195,120 Z`);
  paths.push(`M205,130 Q250,140 260,180 Q265,220 250,260 Q230,280 205,270 Z`);
  paths.push(`M210,150 Q240,160 245,190 Q248,220 235,250`);
  return paths;
}

function generateHammer(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M195,150 L205,150 L205,380 L195,380 Z`);
  paths.push(`M160,100 L240,100 L250,120 L250,180 L240,200 L160,200 L150,180 L150,120 Z`);
  paths.push(`M165,110 L235,110 L235,190 L165,190 Z`);
  paths.push(`M200,105 L200,195`);
  return paths;
}

function generateSpear(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M197,400 L203,400 L203,150 L197,150 Z`);
  paths.push(`M200,80 L215,150 L200,145 L185,150 Z`);
  paths.push(`M200,85 L205,120 L200,140 L195,120 Z`);
  paths.push(`M192,145 L208,145 L206,160 L194,160 Z`);
  return paths;
}

function generateScythe(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M180,400 L200,400 L220,150 L200,150 Z`);
  paths.push(`M220,150 Q280,100 320,130 Q350,160 340,200 Q320,250 280,260 L220,180 Z`);
  paths.push(`M230,155 Q270,120 300,140 Q320,170 310,200`);
  return paths;
}

function generateStaff(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M195,100 L205,100 L208,400 L192,400 Z`);
  paths.push(`M180,90 Q200,50 220,90 Q230,110 200,130 Q170,110 180,90 Z`);
  paths.push(`M190,70 A15,15 0 1,1 210,70 A15,15 0 1,1 190,70`);
  if (modifier === 'fire') {
    paths.push(`M195,55 Q200,40 205,55 Q210,45 215,60`);
  }
  return paths;
}

function generateWhip(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M200,350 Q180,300 200,250 Q230,200 200,150 Q170,100 200,80`);
  paths.push(`M195,350 L205,350 L210,380 L190,380 Z`);
  return paths;
}

function generateBow(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M150,150 Q130,250 150,350 Q170,370 180,350 Q160,250 180,150 Q170,130 150,150 Z`);
  paths.push(`M165,155 L165,345`);
  paths.push(`M200,250 L165,250`);
  paths.push(`M200,245 L230,250 L200,255 Z`);
  return paths;
}

function generateGun(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M200,100 L220,100 L225,105 L228,110 L230,150 L230,200 L228,250 L225,280 L220,285 L200,285 L180,285 L175,280 L172,250 L170,200 L170,150 L172,110 L175,105 L180,100 Z`);
  for (let i = 0; i < 6; i++) {
    const y = 110 + i * 25;
    paths.push(`M175,${y} Q200,${y + 5} 225,${y}`);
  }
  paths.push(`M185,100 L185,95 L190,92 L200,90 L210,92 L215,95 L215,100`);
  paths.push(`M180,285 L180,350 Q185,380 200,385 Q215,380 220,350 L220,285`);
  return paths;
}

function generateCrossbow(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M180,250 L220,250 L225,350 L175,350 Z`);
  paths.push(`M130,240 Q200,200 270,240 L265,250 Q200,215 135,250 Z`);
  paths.push(`M200,220 L200,260`);
  paths.push(`M195,220 L200,200 L205,220 Z`);
  return paths;
}

function generateThrown(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M200,200 L220,180 L240,200 L220,220 Z`);
  paths.push(`M200,200 L180,180 L160,200 L180,220 Z`);
  paths.push(`M200,200 L220,220 L200,240 L180,220 Z`);
  paths.push(`M200,200 L180,180 L200,160 L220,180 Z`);
  paths.push(`M190,190 A15,15 0 1,1 210,210 A15,15 0 1,1 190,190`);
  return paths;
}

function generateShield(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M150,150 L250,150 L260,200 L255,280 L200,350 L145,280 L140,200 Z`);
  paths.push(`M160,160 L240,160 L248,200 L244,270 L200,330 L156,270 L152,200 Z`);
  paths.push(`M200,180 L200,300`);
  paths.push(`M165,220 L235,220`);
  return paths;
}

function generateArmor(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M160,150 L240,150 L250,180 L250,300 L230,350 L170,350 L150,300 L150,180 Z`);
  paths.push(`M165,160 L235,160 L240,180 L240,290 L225,340 L175,340 L160,290 L160,180 Z`);
  paths.push(`M180,200 L220,200 L220,250 L180,250 Z`);
  paths.push(`M200,170 L200,240`);
  return paths;
}

function generateHelmet(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M160,200 Q160,120 200,100 Q240,120 240,200 L235,220 L165,220 Z`);
  paths.push(`M170,180 L180,180 L180,210 L170,210 Z`);
  paths.push(`M220,180 L230,180 L230,210 L220,210 Z`);
  paths.push(`M190,195 L210,195 L205,215 L195,215 Z`);
  return paths;
}

function generateGauntlet(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M180,200 L220,200 L225,250 L230,300 L215,310 L185,310 L170,300 L175,250 Z`);
  paths.push(`M225,300 L235,330 L230,335 L220,310`);
  paths.push(`M210,300 L215,340 L205,340 L205,310`);
  paths.push(`M195,310 L195,345 L185,345 L190,310`);
  return paths;
}

function generateCrown(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M150,220 L160,180 L175,210 L190,170 L200,200 L210,170 L225,210 L240,180 L250,220 L245,240 L155,240 Z`);
  paths.push(`M200,175 A8,8 0 1,1 200,190 A8,8 0 1,1 200,175`);
  paths.push(`M165,185 A5,5 0 1,1 165,195 A5,5 0 1,1 165,185`);
  paths.push(`M235,185 A5,5 0 1,1 235,195 A5,5 0 1,1 235,185`);
  return paths;
}

function generateMask(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M160,180 Q160,130 200,120 Q240,130 240,180 L240,240 Q220,260 200,260 Q180,260 160,240 Z`);
  paths.push(`M175,170 A12,8 0 1,1 190,170 A12,8 0 1,1 175,170`);
  paths.push(`M210,170 A12,8 0 1,1 225,170 A12,8 0 1,1 210,170`);
  paths.push(`M195,200 L200,220 L205,200`);
  return paths;
}

function generateHorns(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M170,200 Q150,150 140,100 Q135,80 145,70 Q155,80 160,100 Q165,150 175,190 Z`);
  paths.push(`M230,200 Q250,150 260,100 Q265,80 255,70 Q245,80 240,100 Q235,150 225,190 Z`);
  return paths;
}

function generateHat(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M140,200 L260,200 L250,210 L150,210 Z`);
  paths.push(`M165,200 Q165,140 200,120 Q235,140 235,200 Z`);
  paths.push(`M180,140 Q200,130 220,140`);
  return paths;
}

function generateCloak(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M150,150 Q140,250 130,400 L270,400 Q260,250 250,150 Q220,140 200,145 Q180,140 150,150 Z`);
  paths.push(`M160,160 Q150,260 145,380`);
  paths.push(`M240,160 Q250,260 255,380`);
  paths.push(`M180,150 Q200,155 220,150`);
  return paths;
}

function generateRing(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M180,240 A25,25 0 1,1 220,240 A25,25 0 1,1 180,240`);
  paths.push(`M190,240 A15,15 0 1,1 210,240 A15,15 0 1,1 190,240`);
  paths.push(`M195,220 L200,210 L205,220`);
  paths.push(`M195,215 A8,8 0 1,1 205,215 A8,8 0 1,1 195,215`);
  return paths;
}

function generateAmulet(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M200,180 L180,250 L200,280 L220,250 Z`);
  paths.push(`M200,200 A15,15 0 1,1 200,230 A15,15 0 1,1 200,200`);
  paths.push(`M200,150 L200,180`);
  paths.push(`M185,150 Q200,140 215,150`);
  return paths;
}

function generateBelt(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M140,240 L260,240 L260,260 L140,260 Z`);
  paths.push(`M190,235 L210,235 L215,245 L215,255 L185,255 L185,245 Z`);
  paths.push(`M195,242 L205,242 L205,252 L195,252 Z`);
  return paths;
}

function generateBoots(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M175,300 L195,300 L200,380 L180,400 L160,390 L165,320 Z`);
  paths.push(`M205,300 L225,300 L235,320 L240,390 L220,400 L200,380 Z`);
  return paths;
}

function generateGloves(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M170,280 L195,280 L200,310 L205,340 L190,350 L175,340 L165,310 Z`);
  paths.push(`M205,280 L230,280 L235,310 L225,340 L210,350 L195,340 L200,310 Z`);
  return paths;
}

function generateWings(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M200,200 Q150,180 120,150 Q100,130 110,100 Q130,120 150,140 Q180,160 200,180 Z`);
  paths.push(`M200,200 Q250,180 280,150 Q300,130 290,100 Q270,120 250,140 Q220,160 200,180 Z`);
  paths.push(`M200,200 Q140,200 100,180 Q80,170 90,140 Q110,160 140,170 Q170,180 200,190 Z`);
  paths.push(`M200,200 Q260,200 300,180 Q320,170 310,140 Q290,160 260,170 Q230,180 200,190 Z`);
  return paths;
}

function generateTail(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M200,400 Q180,420 170,450 Q160,480 180,500 Q200,510 220,500 Q240,480 230,450 Q220,420 200,400 Z`);
  paths.push(`M200,405 Q185,425 180,450 Q175,475 190,490`);
  return paths;
}

function generateEars(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M160,180 Q140,140 145,100 Q150,120 160,150 Q165,170 165,180 Z`);
  paths.push(`M240,180 Q260,140 255,100 Q250,120 240,150 Q235,170 235,180 Z`);
  return paths;
}

function generateEyeFeatures(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M170,190 A15,10 0 1,1 195,190 A15,10 0 1,1 170,190`);
  paths.push(`M205,190 A15,10 0 1,1 230,190 A15,10 0 1,1 205,190`);
  paths.push(`M178,188 A5,5 0 1,1 187,188 A5,5 0 1,1 178,188`);
  paths.push(`M213,188 A5,5 0 1,1 222,188 A5,5 0 1,1 213,188`);
  return paths;
}

function generateFangs(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M185,230 L180,255 L190,250 Z`);
  paths.push(`M215,230 L220,255 L210,250 Z`);
  return paths;
}

function generateClaws(modifier?: string): string[] {
  const paths: string[] = [];
  for (let i = 0; i < 4; i++) {
    const x = 160 + i * 25;
    paths.push(`M${x},300 L${x - 5},330 L${x + 5},330 Z`);
  }
  return paths;
}

function generateScales(modifier?: string): string[] {
  const paths: string[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 4; col++) {
      const x = 165 + col * 20 + (row % 2) * 10;
      const y = 200 + row * 15;
      paths.push(`M${x},${y} Q${x + 10},${y - 8} ${x + 20},${y} Q${x + 10},${y + 8} ${x},${y} Z`);
    }
  }
  return paths;
}

function generateFur(modifier?: string): string[] {
  const paths: string[] = [];
  for (let i = 0; i < 20; i++) {
    const x = 160 + (i * 17) % 80;
    const y = 180 + (i * 23) % 120;
    paths.push(`M${x},${y} Q${x + 3},${y - 10} ${x + 6},${y}`);
  }
  return paths;
}

function generateFlower(): string[] {
  const paths: string[] = [];
  const cx = 200, cy = 250;
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const px = cx + 30 * Math.cos(angle);
    const py = cy + 30 * Math.sin(angle);
    paths.push(`M${cx},${cy} Q${px + 15},${py} ${px},${py} Q${px - 15},${py} ${cx},${cy} Z`);
  }
  paths.push(`M${cx - 10},${cy - 10} A15,15 0 1,1 ${cx + 10},${cy + 10} A15,15 0 1,1 ${cx - 10},${cy - 10}`);
  paths.push(`M${cx},${cy + 30} L${cx},${cy + 100}`);
  paths.push(`M${cx},${cy + 60} Q${cx - 20},${cy + 50} ${cx - 30},${cy + 60}`);
  return paths;
}

function generateTree(): string[] {
  const paths: string[] = [];
  paths.push(`M190,400 L210,400 L215,300 L185,300 Z`);
  paths.push(`M200,150 Q150,200 160,250 Q130,260 150,300 Q180,310 200,300 Q220,310 250,300 Q270,260 240,250 Q250,200 200,150 Z`);
  return paths;
}

function generateVine(): string[] {
  const paths: string[] = [];
  paths.push(`M180,150 Q160,200 180,250 Q200,300 180,350 Q160,400 180,450`);
  paths.push(`M175,180 L165,175 L175,185`);
  paths.push(`M175,280 L160,275 L175,290`);
  return paths;
}

function generateMushroom(): string[] {
  const paths: string[] = [];
  paths.push(`M190,350 L210,350 L215,300 L185,300 Z`);
  paths.push(`M150,300 Q150,250 200,230 Q250,250 250,300 Q220,310 200,310 Q180,310 150,300 Z`);
  paths.push(`M170,280 A8,8 0 1,1 180,280 A8,8 0 1,1 170,280`);
  paths.push(`M210,270 A6,6 0 1,1 220,270 A6,6 0 1,1 210,270`);
  return paths;
}

function generateLeaf(): string[] {
  const paths: string[] = [];
  paths.push(`M200,300 Q150,250 200,150 Q250,250 200,300 Z`);
  paths.push(`M200,160 L200,290`);
  paths.push(`M200,200 L175,185`);
  paths.push(`M200,200 L225,185`);
  paths.push(`M200,240 L180,225`);
  paths.push(`M200,240 L220,225`);
  return paths;
}

function generateCrystal(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M200,150 L220,250 L210,350 L190,350 L180,250 Z`);
  paths.push(`M185,180 L175,260 L180,300`);
  paths.push(`M215,180 L225,260 L220,300`);
  return paths;
}

function generateGem(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M200,200 L230,230 L220,270 L180,270 L170,230 Z`);
  paths.push(`M200,210 L220,235 L210,260 L190,260 L180,235 Z`);
  paths.push(`M200,220 L200,250`);
  return paths;
}

function generateWolfFeatures(): string[] {
  const paths: string[] = [];
  paths.push(`M160,190 Q140,150 150,120 Q165,140 170,170 Z`);
  paths.push(`M240,190 Q260,150 250,120 Q235,140 230,170 Z`);
  paths.push(`M180,220 L200,250 L220,220`);
  paths.push(`M175,200 A8,8 0 1,1 185,200 A8,8 0 1,1 175,200`);
  paths.push(`M215,200 A8,8 0 1,1 225,200 A8,8 0 1,1 215,200`);
  return paths;
}

function generateEagleFeatures(): string[] {
  const paths: string[] = [];
  paths.push(`M190,200 L200,240 L210,200 L200,195 Z`);
  paths.push(`M175,195 A10,8 0 1,1 190,195 A10,8 0 1,1 175,195`);
  paths.push(`M210,195 A10,8 0 1,1 225,195 A10,8 0 1,1 210,195`);
  paths.push(`M140,180 Q170,150 200,160 Q230,150 260,180`);
  return paths;
}

function generateLionFeatures(): string[] {
  const paths: string[] = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const r = 80;
    const x1 = 200 + Math.cos(angle) * 50;
    const y1 = 200 + Math.sin(angle) * 50;
    const x2 = 200 + Math.cos(angle) * r;
    const y2 = 200 + Math.sin(angle) * r;
    paths.push(`M${x1.toFixed(1)},${y1.toFixed(1)} Q${(x2 + 10).toFixed(1)},${(y2 + 10).toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`);
  }
  return paths;
}

function generateDragonFeatures(): string[] {
  const paths: string[] = [];
  paths.push(`M150,150 Q120,100 130,60 Q150,80 160,120 Z`);
  paths.push(`M250,150 Q280,100 270,60 Q250,80 240,120 Z`);
  paths.push(`M170,220 L180,200 L175,220 L185,205 L180,225 Z`);
  return paths;
}

function generatePhoenixFeatures(): string[] {
  const paths: string[] = [];
  for (let i = 0; i < 8; i++) {
    const x = 160 + i * 10;
    paths.push(`M${x},180 Q${x + 5},150 ${x + 10},160 Q${x + 8},175 ${x + 12},180`);
  }
  return paths;
}

function generateSnakeFeatures(): string[] {
  const paths: string[] = [];
  paths.push(`M200,200 Q180,230 200,260 Q220,290 200,320 Q180,350 200,380`);
  paths.push(`M195,200 L190,185 L200,195 L210,185 L205,200`);
  return paths;
}

function generateBearFeatures(): string[] {
  const paths: string[] = [];
  paths.push(`M165,170 A15,15 0 1,1 185,170 A15,15 0 1,1 165,170`);
  paths.push(`M215,170 A15,15 0 1,1 235,170 A15,15 0 1,1 215,170`);
  paths.push(`M185,220 L190,235 L200,240 L210,235 L215,220`);
  return paths;
}

function generateOwlFeatures(): string[] {
  const paths: string[] = [];
  paths.push(`M170,190 A20,20 0 1,1 195,190 A20,20 0 1,1 170,190`);
  paths.push(`M205,190 A20,20 0 1,1 230,190 A20,20 0 1,1 205,190`);
  paths.push(`M195,215 L200,230 L205,215`);
  paths.push(`M160,170 L175,160 L180,175`);
  paths.push(`M240,170 L225,160 L220,175`);
  return paths;
}

function generateRavenFeatures(): string[] {
  const paths: string[] = [];
  paths.push(`M190,200 L180,230 L200,220 Z`);
  paths.push(`M175,195 A8,8 0 1,1 185,195 A8,8 0 1,1 175,195`);
  return paths;
}

function generateTigerFeatures(): string[] {
  const paths: string[] = [];
  for (let i = 0; i < 5; i++) {
    const y = 180 + i * 25;
    paths.push(`M175,${y} Q185,${y + 5} 185,${y + 15}`);
    paths.push(`M225,${y} Q215,${y + 5} 215,${y + 15}`);
  }
  return paths;
}

function generateFoxFeatures(): string[] {
  const paths: string[] = [];
  paths.push(`M160,190 Q140,150 155,130 Q170,150 175,180 Z`);
  paths.push(`M240,190 Q260,150 245,130 Q230,150 225,180 Z`);
  paths.push(`M185,220 L200,240 L215,220`);
  return paths;
}

function generateCatFeatures(): string[] {
  const paths: string[] = [];
  paths.push(`M165,185 Q155,150 165,140 Q180,160 180,180 Z`);
  paths.push(`M235,185 Q245,150 235,140 Q220,160 220,180 Z`);
  paths.push(`M175,200 A5,5 0 1,1 185,200 A5,5 0 1,1 175,200`);
  paths.push(`M215,200 A5,5 0 1,1 225,200 A5,5 0 1,1 215,200`);
  return paths;
}

function generateHorseFeatures(): string[] {
  const paths: string[] = [];
  paths.push(`M200,180 Q180,200 180,240 Q185,260 200,270 Q215,260 220,240 Q220,200 200,180 Z`);
  paths.push(`M180,180 Q160,150 170,130 L185,165`);
  paths.push(`M220,180 Q240,150 230,130 L215,165`);
  return paths;
}

function generateWand(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M195,380 L205,380 L208,180 L192,180 Z`);
  paths.push(`M200,170 L215,150 L200,130 L185,150 Z`);
  paths.push(`M200,140 A8,8 0 1,1 200,155 A8,8 0 1,1 200,140`);
  return paths;
}

function generateOrb(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M160,250 A50,50 0 1,1 240,250 A50,50 0 1,1 160,250`);
  paths.push(`M175,245 A12,12 0 1,1 195,245 A12,12 0 1,1 175,245`);
  paths.push(`M180,310 L200,330 L220,310`);
  return paths;
}

function generateBook(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M160,180 L240,180 L245,320 L155,320 Z`);
  paths.push(`M165,185 L235,185 L238,315 L162,315 Z`);
  paths.push(`M200,185 L200,315`);
  paths.push(`M175,220 L225,220`);
  paths.push(`M175,250 L225,250`);
  return paths;
}

function generateScroll(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M170,180 L230,180 L230,320 L170,320 Z`);
  paths.push(`M165,175 A10,10 0 1,1 165,185 L235,185 A10,10 0 1,1 235,175 L165,175 Z`);
  paths.push(`M165,315 A10,10 0 1,1 165,325 L235,325 A10,10 0 1,1 235,315 L165,315 Z`);
  return paths;
}

function generatePotion(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M190,200 L210,200 L215,180 L205,180 L205,160 L195,160 L195,180 L185,180 Z`);
  paths.push(`M170,280 Q165,240 185,200 L215,200 Q235,240 230,280 Q220,320 200,320 Q180,320 170,280 Z`);
  paths.push(`M180,250 Q200,230 220,250`);
  return paths;
}

function generateRune(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M200,180 L180,250 L200,250 L180,320`);
  paths.push(`M200,180 L220,250 L200,250 L220,320`);
  paths.push(`M175,215 L225,215`);
  return paths;
}

function generatePentagram(modifier?: string): string[] {
  const paths: string[] = [];
  const cx = 200, cy = 250, r = 60;
  let d = '';
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI / 5) - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    d += (i === 0 ? 'M' : 'L') + `${x.toFixed(1)},${y.toFixed(1)} `;
  }
  d += 'Z';
  paths.push(d);
  paths.push(`M${cx - r - 10},${cy} A${r + 10},${r + 10} 0 1,1 ${cx + r + 10},${cy} A${r + 10},${r + 10} 0 1,1 ${cx - r - 10},${cy}`);
  return paths;
}

function generateSigil(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M200,180 L200,320`);
  paths.push(`M160,250 L240,250`);
  paths.push(`M170,200 L230,300`);
  paths.push(`M230,200 L170,300`);
  paths.push(`M180,250 A25,25 0 1,1 220,250 A25,25 0 1,1 180,250`);
  return paths;
}

function generateTorch(): string[] {
  const paths: string[] = [];
  paths.push(`M195,250 L205,250 L208,400 L192,400 Z`);
  paths.push(`M180,250 L220,250 L215,230 L185,230 Z`);
  paths.push(`M190,230 Q180,200 200,180 Q220,200 210,230 Z`);
  paths.push(`M195,210 Q200,195 205,210`);
  return paths;
}

function generateLantern(): string[] {
  const paths: string[] = [];
  paths.push(`M185,200 L215,200 L220,180 L200,170 L180,180 Z`);
  paths.push(`M180,200 L180,280 L220,280 L220,200 Z`);
  paths.push(`M180,280 L185,300 L215,300 L220,280 Z`);
  paths.push(`M195,220 A10,15 0 1,1 205,220 A10,15 0 1,1 195,220`);
  return paths;
}

function generateKey(): string[] {
  const paths: string[] = [];
  paths.push(`M200,180 A20,20 0 1,1 200,220 A20,20 0 1,1 200,180`);
  paths.push(`M200,220 L200,320`);
  paths.push(`M200,280 L220,280 L220,290 L200,290`);
  paths.push(`M200,300 L215,300 L215,310 L200,310`);
  return paths;
}

function generateChain(): string[] {
  const paths: string[] = [];
  for (let i = 0; i < 5; i++) {
    const y = 180 + i * 30;
    const offset = (i % 2) * 5;
    paths.push(`M${190 + offset},${y} A10,15 0 1,1 ${210 + offset},${y} A10,15 0 1,1 ${190 + offset},${y}`);
  }
  return paths;
}

function generateRope(): string[] {
  const paths: string[] = [];
  paths.push(`M180,180 Q200,200 180,220 Q200,240 180,260 Q200,280 180,300`);
  paths.push(`M220,180 Q200,200 220,220 Q200,240 220,260 Q200,280 220,300`);
  return paths;
}

function generateCompass(): string[] {
  const paths: string[] = [];
  paths.push(`M160,250 A50,50 0 1,1 240,250 A50,50 0 1,1 160,250`);
  paths.push(`M200,210 L205,250 L200,290 L195,250 Z`);
  paths.push(`M160,250 L195,245 L200,250 L195,255 Z`);
  paths.push(`M240,250 L205,245 L200,250 L205,255 Z`);
  return paths;
}

function generateMap(): string[] {
  const paths: string[] = [];
  paths.push(`M160,180 L240,180 L245,185 L245,315 L240,320 L160,320 L155,315 L155,185 Z`);
  paths.push(`M170,200 Q190,220 180,250 Q200,260 220,240`);
  paths.push(`M180,280 L175,290 L185,290 Z`);
  paths.push(`M215,200 L215,210 L210,205`);
  return paths;
}

function generateBag(): string[] {
  const paths: string[] = [];
  paths.push(`M170,220 Q160,280 170,320 Q200,340 230,320 Q240,280 230,220 Z`);
  paths.push(`M175,220 Q200,200 225,220`);
  paths.push(`M180,200 L180,220`);
  paths.push(`M220,200 L220,220`);
  return paths;
}

function generateMicrophone(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M180,200 A25,35 0 1,1 220,200 A25,35 0 1,1 180,200`);
  paths.push(`M200,235 L200,320`);
  paths.push(`M170,320 L230,320`);
  for (let i = 0; i < 5; i++) {
    const y = 175 + i * 12;
    paths.push(`M185,${y} L215,${y}`);
  }
  return paths;
}

function generateGuitar(): string[] {
  const paths: string[] = [];
  paths.push(`M190,150 L210,150 L210,200 L190,200 Z`);
  paths.push(`M195,200 L205,200 L205,280 L195,280 Z`);
  paths.push(`M170,280 Q150,320 160,370 Q180,400 200,400 Q220,400 240,370 Q250,320 230,280 Z`);
  paths.push(`M185,330 A20,25 0 1,1 215,330 A20,25 0 1,1 185,330`);
  return paths;
}

function generateDrum(): string[] {
  const paths: string[] = [];
  paths.push(`M160,220 L240,220 L250,240 L250,320 L240,340 L160,340 L150,320 L150,240 Z`);
  paths.push(`M160,220 A45,15 0 1,1 240,220 A45,15 0 1,1 160,220`);
  paths.push(`M165,280 L235,280`);
  return paths;
}

function generateFlute(): string[] {
  const paths: string[] = [];
  paths.push(`M150,245 L250,245 L252,250 L252,256 L250,260 L150,260 L148,256 L148,250 Z`);
  for (let i = 0; i < 6; i++) {
    paths.push(`M${165 + i * 12},248 A3,3 0 1,1 ${171 + i * 12},248 A3,3 0 1,1 ${165 + i * 12},248`);
  }
  return paths;
}

function generateHarp(): string[] {
  const paths: string[] = [];
  paths.push(`M180,150 Q140,200 150,350 L160,350 Q155,210 190,160 Z`);
  paths.push(`M180,155 Q220,160 240,200 Q250,250 240,350 L230,350 Q235,260 225,210 Q210,170 180,165 Z`);
  for (let i = 0; i < 8; i++) {
    paths.push(`M${160 + i * 8},${180 + i * 5} L${160 + i * 8},340`);
  }
  return paths;
}

function generateHornInstrument(): string[] {
  const paths: string[] = [];
  paths.push(`M150,250 Q130,230 140,200 Q160,180 200,190 Q240,200 260,230 Q280,270 270,300 Q250,320 220,310`);
  paths.push(`M145,260 A15,20 0 1,1 165,260 A15,20 0 1,1 145,260`);
  return paths;
}

function generateSkull(): string[] {
  const paths: string[] = [];
  paths.push(`M160,220 Q150,180 200,160 Q250,180 240,220 L240,260 Q230,290 200,300 Q170,290 160,260 Z`);
  paths.push(`M175,210 A12,15 0 1,1 195,210 A12,15 0 1,1 175,210`);
  paths.push(`M205,210 A12,15 0 1,1 225,210 A12,15 0 1,1 205,210`);
  paths.push(`M195,245 L200,260 L205,245`);
  paths.push(`M180,275 L185,285 L195,275 L205,285 L215,275 L220,285`);
  return paths;
}

function generateHeart(): string[] {
  const paths: string[] = [];
  paths.push(`M200,320 Q140,270 140,220 Q140,180 175,180 Q200,180 200,210 Q200,180 225,180 Q260,180 260,220 Q260,270 200,320 Z`);
  paths.push(`M180,200 Q190,195 195,205`);
  return paths;
}

function generateStar(): string[] {
  const paths: string[] = [];
  const cx = 200, cy = 250, outer = 50, inner = 20;
  let d = '';
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (i * Math.PI / 5) - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    d += (i === 0 ? 'M' : 'L') + `${x.toFixed(1)},${y.toFixed(1)} `;
  }
  d += 'Z';
  paths.push(d);
  return paths;
}

function generateMoon(): string[] {
  const paths: string[] = [];
  paths.push(`M180,180 A60,60 0 1,1 180,320 A40,40 0 1,0 180,180 Z`);
  return paths;
}

function generateSun(): string[] {
  const paths: string[] = [];
  paths.push(`M170,250 A35,35 0 1,1 230,250 A35,35 0 1,1 170,250`);
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI / 6);
    const x1 = 200 + 45 * Math.cos(angle);
    const y1 = 250 + 45 * Math.sin(angle);
    const x2 = 200 + 65 * Math.cos(angle);
    const y2 = 250 + 65 * Math.sin(angle);
    paths.push(`M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`);
  }
  return paths;
}

function generateCross(): string[] {
  const paths: string[] = [];
  paths.push(`M190,180 L210,180 L210,230 L250,230 L250,270 L210,270 L210,350 L190,350 L190,270 L150,270 L150,230 L190,230 Z`);
  return paths;
}

function generateAnchor(): string[] {
  const paths: string[] = [];
  paths.push(`M190,180 L210,180 L210,200 L220,200 L220,210 L210,210 L210,280`);
  paths.push(`M190,210 L180,210 L180,200 L190,200 L190,280`);
  paths.push(`M150,320 Q180,280 200,280 Q220,280 250,320`);
  paths.push(`M195,180 A15,10 0 1,1 205,180 A15,10 0 1,1 195,180`);
  return paths;
}

function generateBanner(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M195,150 L205,150 L205,400 L195,400 Z`);
  paths.push(`M205,160 L280,170 L270,220 L280,270 L205,260 Z`);
  paths.push(`M215,190 L260,195`);
  paths.push(`M215,230 L255,235`);
  return paths;
}

function generateFlag(modifier?: string): string[] {
  const paths: string[] = [];
  paths.push(`M180,180 L180,320`);
  paths.push(`M180,180 Q220,190 240,180 Q230,220 240,260 Q210,250 180,260 Z`);
  return paths;
}

function generateCoin(): string[] {
  const paths: string[] = [];
  paths.push(`M165,250 A40,40 0 1,1 235,250 A40,40 0 1,1 165,250`);
  paths.push(`M175,250 A30,30 0 1,1 225,250 A30,30 0 1,1 175,250`);
  paths.push(`M195,235 L195,265 L205,265 L205,240 L200,235 Z`);
  return paths;
}

function generateTreasure(): string[] {
  const paths: string[] = [];
  paths.push(`M150,260 L250,260 L260,280 L260,340 L140,340 L140,280 Z`);
  paths.push(`M150,260 Q200,230 250,260`);
  paths.push(`M190,285 L210,285 L210,310 L190,310 Z`);
  return paths;
}

function generateGoblet(): string[] {
  const paths: string[] = [];
  paths.push(`M175,200 L180,280 L170,280 L165,320 L175,330 L225,330 L235,320 L230,280 L220,280 L225,200 Z`);
  paths.push(`M180,210 Q200,190 220,210`);
  paths.push(`M185,260 L215,260`);
  return paths;
}

function generateCandle(): string[] {
  const paths: string[] = [];
  paths.push(`M190,220 L210,220 L212,350 L188,350 Z`);
  paths.push(`M198,220 L202,220 L202,200 L198,200 Z`);
  paths.push(`M195,200 Q190,180 200,165 Q210,180 205,200 Z`);
  paths.push(`M197,185 Q200,175 203,185`);
  return paths;
}

export default LEXICON