// ============================================================================
// KASVILLAGE QUIZ QUESTION BANK - 50+ Questions
// ============================================================================
// Questions derived from avatar creation process:
// - Colors (skin, hair, eyes, primary, secondary, mixed colors)
// - Race, Class, Occupation, Animal
// - Open-ended responses (desire, description, voice line, signature move)
// - Color mixing history
// - Spawned items from keywords
// ============================================================================

export interface QuizQuestion {
  id: string;
  question: string;
  correctAnswer: string;
  options: string[];
  category: 'color' | 'selection' | 'text' | 'mix' | 'item';
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface ColorMixRecord {
  color1: string;
  color2: string;
  result: string;
  region: string;
  timestamp: number;
}

export interface QuizRecipe {
  name: string;
  race: string;
  class: string;
  occupation: string;
  animal: string;
  
  // Colors applied to avatar regions
  colors: {
    skin?: string;
    hair?: string;
    eyes?: string;
    lips?: string;
    primary?: string;
    secondary?: string;
    accent?: string;
    outline?: string;
  };
  
  // Color mixing history from Phase 4
  colorMixHistory: ColorMixRecord[];
  
  // Open-ended text responses
  originStory?: string;
  formativeMemory?: string;
  scenarioDesire?: string;
  characterDescription?: string;
  voiceLine?: string;
  weakness?: string;
  lifePhilosophy?: string;
  powerSpike?: string;
  signatureMove?: string;
  
  // Spawned items from keywords
  parsedKeywords: string[];
  spawnedItemKeywords: string[];
}

// ============================================================================
// FAKE DATA POOLS
// ============================================================================

const FAKE_COLORS = [
  '#FF6347', '#4169E1', '#32CD32', '#DC143C', '#FFD700', '#8B008B',
  '#00CED1', '#FF69B4', '#228B22', '#FF4500', '#9932CC', '#00FF7F',
  '#FF1493', '#1E90FF', '#ADFF2F', '#FF8C00', '#BA55D3', '#7CFC00',
];

const FAKE_COLOR_PAIRS = [
  ['#FF6347', '#4169E1'],
  ['#32CD32', '#DC143C'],
  ['#FFD700', '#8B008B'],
  ['#00CED1', '#FF69B4'],
  ['#228B22', '#FF4500'],
  ['#9932CC', '#00FF7F'],
];

const ALL_RACES = [
  'human', 'elf', 'darkelf', 'dwarf', 'orc', 'halfling', 'troll', 'vampire',
  'werewolf', 'angel', 'giant', 'merfolk', 'centaur', 'gnome', 'phoenix',
  'sprite', 'golem', 'elemental', 'undead', 'dragonkin', 'fae', 'alien',
];

const ALL_CLASSES = [
  'Warrior', 'Mage', 'Rogue', 'Healer', 'Bard', 'Ranger',
  'Paladin', 'Necromancer', 'Monk', 'Berserker', 'Druid', 'Warlock',
];

const ALL_OCCUPATIONS = [
  'Blacksmith', 'Scholar', 'Merchant', 'Hunter', 'Artist', 'Guardian',
  'Alchemist', 'Assassin', 'Explorer', 'Pirate', 'Noble', 'Farmer',
];

const ALL_ANIMALS = [
  'Wolf', 'Eagle', 'Lion', 'Dragon', 'Bear', 'Phoenix',
  'Snake', 'Owl', 'Raven', 'Tiger', 'Stag', 'Shark',
];

const FAKE_NAMES = [
  'Shadow', 'Phoenix', 'Storm', 'Blade', 'Raven', 'Ghost',
  'Viper', 'Ember', 'Frost', 'Ash', 'Nova', 'Zephyr',
];

const FAKE_MOVES = [
  'Thunder Strike', 'Shadow Step', 'Phoenix Blast',
  'Dragon Fury', 'Soul Rend', 'Void Slash',
];

const FAKE_PHILOSOPHIES = [
  'Power is everything',
  'Honor above all',
  'Survival of the fittest',
  'Knowledge is power',
  'Balance in all things',
  'Trust no one',
];

// ============================================================================
// SHUFFLE HELPER
// ============================================================================

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// ============================================================================
// MAIN QUESTION GENERATOR
// ============================================================================

export function generateQuestionBank(recipe: QuizRecipe): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  let questionId = 0;
  
  // ──────────────────────────────────────────────────────────────────────────
  // QUESTION 1: Color Swatch Recognition (ALWAYS FIRST)
  // "The Sentry shows you color swatches. Which colors did YOU choose?"
  // ──────────────────────────────────────────────────────────────────────────
  
  const userColors: string[] = [];
  if (recipe.colors.primary) userColors.push(recipe.colors.primary);
  if (recipe.colors.secondary) userColors.push(recipe.colors.secondary);
  if (recipe.colors.skin) userColors.push(recipe.colors.skin);
  if (recipe.colors.hair) userColors.push(recipe.colors.hair);
  
  const uniqueColors = [...new Set(userColors)].slice(0, 2);
  // PRIMARY crest color (20 options)
  if (uniqueColors.length >= 1) {
    questions.push({
      id: `q_${questionId++}`,
      question: 'The Sentry inspects your coat of arms.\n"What is the PRIMARY color of your crest?"',
      correctAnswer: uniqueColors[0],
      options: shuffle([uniqueColors[0], ...FAKE_COLORS.filter(c => c !== uniqueColors[0]).slice(0, 19)]),
      category: 'color',
      difficulty: 'easy',
    });
  }
  // SECONDARY crest color (20 options)
  if (uniqueColors.length >= 2) {
    questions.push({
      id: `q_${questionId++}`,
      question: 'The Sentry inspects your coat of arms.\n"What is the SECONDARY color of your crest?"',
      correctAnswer: uniqueColors[1],
      options: shuffle([uniqueColors[1], ...FAKE_COLORS.filter(c => c !== uniqueColors[1]).slice(0, 19)]),
      category: 'color',
      difficulty: 'easy',
    });
  }
  // ──────────────────────────────────────────────────────────────────────────
  // QUESTION 2-5: Selection Questions (Race, Class, Occupation, Animal)
  // ──────────────────────────────────────────────────────────────────────────
  
  if (recipe.race) {
    questions.push({
      id: `q_${questionId++}`,
      question: 'What RACE is your character?',
      correctAnswer: recipe.race,
      options: shuffle([recipe.race, ...ALL_RACES.filter(r => r !== recipe.race).slice(0, 19)]),
      category: 'selection',
      difficulty: 'easy',
    });
  }
  
  if (recipe.class) {
    questions.push({
      id: `q_${questionId++}`,
      question: 'What CLASS did you choose?',
      correctAnswer: recipe.class,
      options: shuffle([recipe.class, ...ALL_CLASSES.filter(c => c !== recipe.class).slice(0, 19)]),
      category: 'selection',
      difficulty: 'easy',
    });
  }
  
  if (recipe.occupation) {
    questions.push({
      id: `q_${questionId++}`,
      question: 'What is your character\'s OCCUPATION?',
      correctAnswer: recipe.occupation,
      options: shuffle([recipe.occupation, ...ALL_OCCUPATIONS.filter(o => o !== recipe.occupation).slice(0, 19)]),
      category: 'selection',
      difficulty: 'easy',
    });
  }
  
  if (recipe.animal) {
    questions.push({
      id: `q_${questionId++}`,
      question: 'What SPIRIT ANIMAL did you bond with?',
      correctAnswer: recipe.animal,
      options: shuffle([recipe.animal, ...ALL_ANIMALS.filter(a => a !== recipe.animal).slice(0, 19)]),
      category: 'selection',
      difficulty: 'easy',
    });
  }
  
  // ──────────────────────────────────────────────────────────────────────────
  // QUESTION 6: Name
  // ──────────────────────────────────────────────────────────────────────────
  
  if (recipe.name) {
    questions.push({
      id: `q_${questionId++}`,
      question: 'What NAME did you give your character?',
      correctAnswer: recipe.name,
      options: shuffle([recipe.name, ...FAKE_NAMES.filter(n => n !== recipe.name).slice(0, 19)]),
      category: 'selection',
      difficulty: 'easy',
    });
  }
  
  // ──────────────────────────────────────────────────────────────────────────
  // QUESTION 7-10: Individual Color Questions
  // ──────────────────────────────────────────────────────────────────────────
  
  const colorRegions = [
    { key: 'skin', label: 'SKIN' },
    { key: 'hair', label: 'HAIR' },
    { key: 'eyes', label: 'EYES' },
    { key: 'primary', label: 'PRIMARY clothing' },
    { key: 'secondary', label: 'SECONDARY clothing' },
  ];
  
  colorRegions.forEach(region => {
    const color = recipe.colors[region.key as keyof typeof recipe.colors];
    if (color) {
      questions.push({
        id: `q_${questionId++}`,
        question: `What color did you choose for your avatar's ${region.label}?`,
        correctAnswer: color,
        options: shuffle([color, ...FAKE_COLORS.filter(c => c !== color).slice(0, 19)]),
        category: 'color',
        difficulty: 'medium',
      });
    }
  });
  
  // ──────────────────────────────────────────────────────────────────────────
  // QUESTION 11-15: Text-based Questions
  // ──────────────────────────────────────────────────────────────────────────
  
  if (recipe.signatureMove && recipe.signatureMove.length > 3) {
    questions.push({
      id: `q_${questionId++}`,
      question: 'What is your character\'s SIGNATURE MOVE?',
      correctAnswer: recipe.signatureMove,
      options: shuffle([recipe.signatureMove, ...FAKE_MOVES.filter(m => m !== recipe.signatureMove)]),
      category: 'text',
      difficulty: 'medium',
    });
  }
  
  if (recipe.lifePhilosophy && recipe.lifePhilosophy.length > 5) {
    const shortPhilosophy = recipe.lifePhilosophy.slice(0, 50) + (recipe.lifePhilosophy.length > 50 ? '...' : '');
    questions.push({
      id: `q_${questionId++}`,
      question: 'What LIFE PHILOSOPHY did you write?',
      correctAnswer: shortPhilosophy,
      options: shuffle([shortPhilosophy, ...FAKE_PHILOSOPHIES]),
      category: 'text',
      difficulty: 'hard',
    });
  }
  
  if (recipe.voiceLine && recipe.voiceLine.length > 3) {
    questions.push({
      id: `q_${questionId++}`,
      question: 'What VOICE LINE / CATCHPHRASE did you give your character?',
      correctAnswer: recipe.voiceLine,
      options: shuffle([recipe.voiceLine, 'For glory!', 'Death awaits...', 'By my blade!', 'Witness me!', 'Fear the shadows']),
      category: 'text',
      difficulty: 'medium',
    });
  }
  
  // ──────────────────────────────────────────────────────────────────────────
  // QUESTION 16+: Color Mix Questions (if any mixes were done)
  // ──────────────────────────────────────────────────────────────────────────
  
  if (recipe.colorMixHistory && recipe.colorMixHistory.length > 0) {
    recipe.colorMixHistory.slice(0, 3).forEach((mix, idx) => {
      questions.push({
        id: `q_${questionId++}`,
        question: `You mixed colors for ${mix.region}. What TWO colors did you combine?`,
        correctAnswer: `${mix.color1}|${mix.color2}`,
        options: shuffle([
          `${mix.color1}|${mix.color2}`,
          ...FAKE_COLOR_PAIRS.map(p => `${p[0]}|${p[1]}`).slice(0, 19),
        ]),
        category: 'mix',
        difficulty: 'hard',
      });
    });
  }
  
  // ──────────────────────────────────────────────────────────────────────────
  // QUESTION 17+: Spawned Item Questions
  // ──────────────────────────────────────────────────────────────────────────
  
  if (recipe.spawnedItemKeywords && recipe.spawnedItemKeywords.length > 0) {
    const keyword = recipe.spawnedItemKeywords[0];
    const fakeKeywords = ['sword', 'shield', 'book', 'potion', 'crown', 'staff', 'ring', 'amulet'];
    
    questions.push({
      id: `q_${questionId++}`,
      question: 'Which keyword spawned an ITEM on your coat of arms?',
      correctAnswer: keyword,
      options: shuffle([keyword, ...fakeKeywords.filter(k => k !== keyword).slice(0, 19)]),
      category: 'item',
      difficulty: 'hard',
    });
  }
  

  // ============================================================================

  // ============================================================================
  // PROCEDURAL QUESTION ENGINE v2
  // Simpler scenarios: "[Name] encounters [situation]. What does [Name] do?"
  // 6 options: 1 correct (user's class), 5 fakes (other classes)
  // Correct answer uses class verbs + occupation flavor + signature move
  // ============================================================================

  if (recipe.class && recipe.name) {
    const name = recipe.name;
    const occ = recipe.occupation || '';
    const sig = recipe.signatureMove || '';
    const animal = recipe.animal || '';

    // CLASS ACTIONS: short, clear, recognizable
    const ACTIONS: Record<string, string[]> = {
      Warrior:     ['draw your sword and charge', 'raise your shield and stand firm', 'slam your fist and demand order', 'cut through the chaos with steel', 'roar a battle cry and push forward', 'grip your blade and guard the way', 'smash through the obstacle with brute strength', 'throw a punch and settle it fast', 'stand between danger and the helpless', 'draw steel and dare them to come closer'],
      Mage:        ['cast a protective spell', 'trace symbols in the air and unleash light', 'weave magic to freeze the moment', 'conjure a barrier of shimmering energy', 'send a bolt of arcane fire', 'read the magical aura first', 'summon a shield of pure light', 'channel energy through your hands', 'whisper ancient words of power', 'levitate above the danger'],
      Rogue:       ['slip into the shadows', 'vanish and strike from behind', 'pick the lock and sneak through', 'check for traps before moving', 'steal the key without anyone noticing', 'disappear into the crowd', 'circle around to the blind spot', 'use misdirection to escape', 'pocket something useful while nobody looks', 'move like smoke through the dark'],
      Healer:      ['rush to help and heal the wounds', 'press warm hands to the injury', 'whisper calming words as light flows', 'check their pulse with gentle fingers', 'channel soothing energy into them', 'wrap the wound with careful hands', 'pray for their recovery', 'cradle them and ease the pain', 'use herbs from your pouch', 'sing a soft melody of mending'],
      Ranger:      ['read the tracks on the ground', 'whistle for your animal companion', 'find high ground and scout ahead', 'listen to what nature is telling you', 'track the source of the trouble', 'set a snare and wait', 'blend into the trees and observe', 'follow the trail through the brush', 'use the terrain to your advantage', 'send your hawk to survey from above'],
      Paladin:     ['raise your shield and say a prayer', 'invoke holy light to protect everyone', 'demand justice in the name of the oath', 'lay hands and channel divine healing', 'stand tall and let your armor shine', 'call upon sacred power', 'kneel and pray for guidance', 'shine your shield like a beacon', 'recite the code and hold the line', 'bless the ground with holy words'],
      Necromancer: ['call upon the dead for help', 'raise skeletal hands from the earth', 'whisper to the spirits nearby', 'drain life force from the threat', 'curse them with ancient dark words', 'summon a shade to do your bidding', 'touch the ground and feel the dead below', 'bind shadows to serve you', 'let the darkness answer for you', 'commune with ghosts for information'],
      Bard:        ['play a tune to calm everyone', 'sing a song that lifts their spirits', 'strum a chord that freezes the room', 'tell a story to buy time', 'use your voice to charm the threat', 'compose a verse about this moment', 'whistle a melody that soothes pain', 'crack a joke to defuse the tension', 'perform a ballad of courage', 'recite a poem that echoes through the hall'],
      Monk:        ['center yourself and breathe', 'flow through strikes with open palms', 'sit in silence and share calm energy', 'deflect the blow with precise movement', 'meditate on the right action', 'catch their fist mid-swing', 'walk calmly through the chaos', 'place a steady hand on their shoulder', 'move like water around the obstacle', 'exhale slowly and find the path'],
      Berserker:   ['let out a roar and smash through', 'grab them with raw strength', 'flip the table and charge', 'rip the door off its hinges', 'scream into the void fearlessly', 'headbutt the problem away', 'crush the obstacle with bare hands', 'howl with fury and leap forward', 'pound the ground until it cracks', 'pick them up and throw them aside'],
      Druid:       ['call the roots to rise from the ground', 'ask the animals for help', 'grow healing moss over the wounds', 'let the vines handle the threat', 'shape-shift into something useful', 'listen to the wind for answers', 'plant a seed and watch it grow fast', 'command the trees to block the path', 'speak to the birds for a report', 'return it to the natural cycle'],
      Warlock:     ['make a dark bargain for power', 'channel eldritch energy from your pact', 'summon your patron for aid', 'unleash forbidden magic', 'mark them with a hex', 'tap into otherworldly power', 'invoke the pact and let chaos decide', 'send a wave of dread through the crowd', 'bind their will with dark words', 'open a rift to another plane'],
    };

    // OCCUPATION TOOLS: short phrases
    const OCC_TOOLS: Record<string, string> = {
      Blacksmith: 'using your hammer', Scholar: 'recalling what you read', Merchant: 'thinking like a deal',
      Hunter: 'tracking every detail', Artist: 'seeing beauty in the chaos', Guardian: 'guarding with instinct',
      Alchemist: 'reaching for a vial', Assassin: 'moving without a sound', Explorer: 'reading the map in your head',
      Pirate: 'sailing through trouble', Noble: 'commanding with authority', Farmer: 'with soil-worn hands',
    };

    // SCENARIOS: simple, vivid, name-first
    const SCENARIOS = [
      (n: string) => n + ' finds a wounded stranger collapsed in a rainy alley. What does ' + n + ' do?',
      (n: string) => n + ' sees a child being chased by thugs in the market. What does ' + n + ' do?',
      (n: string) => n + ' discovers a locked chest glowing with strange light. What does ' + n + ' do?',
      (n: string) => n + ' is betrayed by a trusted friend at a tavern meeting. What does ' + n + ' do?',
      (n: string) => n + ' wakes up in total darkness with no memory of how they got there. What does ' + n + ' do?',
      (n: string) => n + ' finds a bridge collapsing with people still on it. What does ' + n + ' do?',
      (n: string) => n + ' encounters a wild beast blocking the only path forward. What does ' + n + ' do?',
      (n: string) => n + ' catches someone stealing food from a starving family. What does ' + n + ' do?',
      (n: string) => n + ' hears a cry for help coming from inside a burning building. What does ' + n + ' do?',
      (n: string) => n + ' finds an ancient weapon stuck in stone. What does ' + n + ' do?',
    ];

    const userClass = recipe.class;
    const userActions = ACTIONS[userClass] || ACTIONS['Warrior'];
    const allClassKeys = Object.keys(ACTIONS);
    const otherClassKeys = allClassKeys.filter(k => k !== userClass);
    const occTool = OCC_TOOLS[occ] || '';
    const sigSuffix = sig.length > 3 ? ', finishing with ' + sig : '';

    // Pick 4 random scenarios
    const shuffledScenarios = shuffle(SCENARIOS).slice(0, 4);

    for (let i = 0; i < shuffledScenarios.length; i++) {
      const questionText = shuffledScenarios[i](name);
      
      // Pick a random correct action and add occupation + signature flavor
      const baseAction = userActions[Math.floor(Math.random() * userActions.length)];
      const correctAnswer = baseAction + (occTool ? ', ' + occTool : '') + sigSuffix;

      // Pick 5 fake answers from other classes (1 per class, no duplicates)
      const fakes: string[] = [];
      const shuffledOthers = shuffle(otherClassKeys);
      for (const otherClass of shuffledOthers) {
        if (fakes.length >= 5) break;
        const otherActions = ACTIONS[otherClass];
        if (otherActions) {
          fakes.push(otherActions[Math.floor(Math.random() * otherActions.length)]);
        }
      }

      questions.push({
        id: 'q_' + questionId++,
        question: questionText,
        correctAnswer: correctAnswer,
        options: shuffle([correctAnswer, ...fakes]),
        category: 'text',
        difficulty: 'medium',
      });
    }
  }

  // Text-derived: recognize your own motivation
  if (recipe.scenarioDesire && recipe.scenarioDesire.length > 5) {
    const name = recipe.name || 'Your character';
    const desire = recipe.scenarioDesire.slice(0, 50);
    const desireFakes = shuffle([
      'Power and domination over all who oppose me', 'Wealth beyond what any vault can hold',
      'A quiet life far from the chaos of the world', 'Revenge on those who destroyed everything',
      'Ancient forbidden knowledge locked in lost temples', 'The safety of my family above all else',
      'To never feel the sting of death or loss again', 'Glory that echoes through the ages',
      'Breaking every chain and living truly free', 'Building something that outlasts empires',
      'Standing between the weak and those who prey on them', 'Outrunning a past that refuses to stay buried',
      'Perfect inner stillness no matter what storms come', 'Tasting every flavor the world has to offer',
      'Leaving a mark so deep the stars remember your name', 'Crafting the one masterpiece that defines a lifetime',
      'Understanding the machine that runs the universe', 'Hearing the applause of ten thousand strangers',
      'Finding the one recipe that makes the gods weep with joy',
    ].filter(o => o !== desire)).slice(0, 19);
    questions.push({
      id: `q_${questionId++}`,
      question: `What drives ${name} forward? Recognize YOUR words:`,
      correctAnswer: desire,
      options: shuffle([desire, ...desireFakes]),
      category: 'text',
      difficulty: 'hard',
    });
  }

  // Text-derived: recognize your character description
  if (recipe.characterDescription && recipe.characterDescription.length > 5) {
    const name = recipe.name || 'Your character';
    const desc = recipe.characterDescription.slice(0, 50);
    const descFakes = shuffle([
      'A brooding figure wrapped in silence and old scars', 'A laughing wanderer who collects stories like coins',
      'A shadow that moves between deals and daggers', 'Gentle hands that have mended a thousand wounds',
      'A weathered chief whose roar shakes the mountains', 'A hooded mystery trailing the scent of ancient smoke',
      'A veteran whose eyes have seen too many battlefields', 'An eager apprentice with ink-stained fingers and big dreams',
      'A merchant prince draped in silk and ambition', 'A haunted soul who hears whispers from the other side',
      'A cosmic wanderer who speaks in riddles and starlight', 'A retired legend trying to forget the taste of dragon fire',
      'A cursed being counting the centuries until release', 'A jolly keeper of secrets and strong ale',
      'A stern enforcer of laws written in stone and blood', 'A wild spirit who dances with wolves under the moon',
      'A cold strategist who sees people as pieces on a board', 'A rebel with a cause that burns brighter than reason',
      'A diplomat whose smile hides a steel spine',
    ].filter(o => o !== desc)).slice(0, 19);
    questions.push({
      id: `q_${questionId++}`,
      question: `How did you describe ${name}? Recognize YOUR words:`,
      correctAnswer: desc,
      options: shuffle([desc, ...descFakes]),
      category: 'text',
      difficulty: 'hard',
    });
  }
  return questions;
}

// ============================================================================
// SELECT QUIZ QUESTIONS (5 questions, balanced categories)
// ============================================================================

export function selectQuizQuestions(allQuestions: QuizQuestion[], count: number = 5): QuizQuestion[] {
  if (allQuestions.length === 0) return [];
  
  // For single question (return auth), pick fully random � no priority bias
  if (count === 1) {
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
    return [shuffled[0]];
  }
  
  const selected: QuizQuestion[] = [];
  
  // For 5-question onboarding: include color swatch first
  const colorSwatchQ = allQuestions.find(q => q.category === 'color' && q.question.includes('coat of arms'));
  if (colorSwatchQ) {
    selected.push(colorSwatchQ);
  }
  
  // Add 1 selection question
  const selectionQs = allQuestions.filter(q => q.category === 'selection' && !selected.includes(q));
  if (selectionQs.length > 0) {
    selected.push(selectionQs[Math.floor(Math.random() * selectionQs.length)]);
  }
  
  // Add 1 text question
  const textQs = allQuestions.filter(q => q.category === 'text' && !selected.includes(q));
  if (textQs.length > 0) {
    selected.push(textQs[Math.floor(Math.random() * textQs.length)]);
  }
  
  // Add 1 color question (not the swatch one)
  const colorQs = allQuestions.filter(q => q.category === 'color' && !selected.includes(q));
  if (colorQs.length > 0) {
    selected.push(colorQs[Math.floor(Math.random() * colorQs.length)]);
  }
  
  // Fill remaining from any category
  const remaining = allQuestions.filter(q => !selected.includes(q));
  while (selected.length < count && remaining.length > 0) {
    const idx = Math.floor(Math.random() * remaining.length);
    selected.push(remaining.splice(idx, 1)[0]);
  }
  
  return selected.slice(0, count);
}

// ============================================================================
// PARSE COLOR PAIR FROM OPTION STRING
// ============================================================================

export function parseColorPair(optionStr: string): [string, string] | null {
  const parts = optionStr.split('|');
  if (parts.length === 2 && parts[0].startsWith('#') && parts[1].startsWith('#')) {
    return [parts[0], parts[1]];
  }
  return null;
}

// ============================================================================
// CHECK IF QUESTION IS COLOR SWATCH TYPE
// ============================================================================

export function isColorSwatchQuestion(question: QuizQuestion): boolean {
  return question.category === 'color' && question.correctAnswer.includes('|');
}
