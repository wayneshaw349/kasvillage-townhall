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
          ...FAKE_COLOR_PAIRS.map(p => `${p[0]}|${p[1]}`).slice(0, 5),
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
      options: shuffle([keyword, ...fakeKeywords.filter(k => k !== keyword).slice(0, 5)]),
      category: 'item',
      difficulty: 'hard',
    });
  }
  

  // ============================================================================

  // ============================================================================
  // PROCEDURAL QUESTION ENGINE
  // Questions: generic scenarios using avatar NAME only (no class/race)
  // Answers: specific actions from class verbs + occupation tools + signature move
  // 19 fakes: equally vivid actions from other class/occupation combos
  // ============================================================================

  if (recipe.class && recipe.name) {
    const name = recipe.name;
    const occ = recipe.occupation || '';
    const sig = recipe.signatureMove || '';
    const power = recipe.powerSpike || '';
    const origin = recipe.originStory || '';
    const desire = recipe.scenarioDesire || '';

    // CLASS ACTION LIBRARY � specific verbs/actions per class, NO class name
    const CLASS_ACTIONS: Record<string, { verb: string; crisis: string; help: string; treasure: string; betrayal: string; darkness: string }> = {
      Warrior:     { verb: 'draw steel',        crisis: 'charge forward with blade raised, cutting through the chaos',                help: 'stand guard over them, sword drawn, daring anyone to come closer',          treasure: 'test the weight in your hands � if it serves battle, claim it',          betrayal: 'slam your fist on the table and demand they face you in combat',         darkness: 'grip your weapon tight, steady your breathing, and march forward' },
      Mage:        { verb: 'weave a spell',     crisis: 'trace arcane symbols in the air and unleash a barrier of shimmering light',  help: 'kneel and channel warm golden energy through your palms into their wounds',  treasure: 'sense the magical resonance first � is it enchanted or cursed?',         betrayal: 'unravel the lies with a truth-seeking divination',                       darkness: 'conjure a floating orb of light and scan for hidden wards' },
      Rogue:       { verb: 'slip away',         crisis: 'vanish into shadow, circle behind the threat, and strike the blind spot',    help: 'check the perimeter for traps before approaching cautiously',                treasure: 'inspect every edge for tripwires, then pocket it silently',              betrayal: 'disappear without a word � revenge is a dish served cold',               darkness: 'become one with the dark, letting your fingers read the walls' },
      Healer:      { verb: 'mend the wound',    crisis: 'rush to the fallen, pressing warm palms to wounds, channeling soothing light', help: 'cradle their head gently, whispering words of comfort as light flows',      treasure: 'set it aside � the real treasure is everyone walking out alive',         betrayal: 'look them in the eyes and ask why, searching for the pain underneath',   darkness: 'hum a soft hymn, letting the melody guide your steps through the black' },
      Ranger:      { verb: 'track the signs',   crisis: 'read the terrain instantly, finding high ground and natural cover',          help: 'whistle for your animal companion to keep watch while you tend them',        treasure: 'leave it � the forest provides everything you need',                     betrayal: 'retreat into the wilderness where the trees are more honest',             darkness: 'close your eyes and listen � the wind tells you what the dark hides' },
      Paladin:     { verb: 'invoke the oath',   crisis: 'raise your shield and call out a prayer that makes the air hum with power',  help: 'lay hands upon them and invoke divine healing with a solemn vow',            treasure: 'kneel and pray for guidance � then donate it to those in need',           betrayal: 'demand a trial by the old laws, letting justice decide their fate',       darkness: 'raise your hand and let holy light burst from your palm like a torch' },
      Necromancer: { verb: 'call the dead',     crisis: 'whisper ancient words and watch skeletal hands claw up from the earth to fight for you', help: 'probe their fading life force � if they die, they can still serve', treasure: 'bind dark enchantments into it, making it pulse with shadow',             betrayal: 'curse them with a hex that will haunt their bloodline',                  darkness: 'smile � darkness is where your power thrives, the shadows obey you' },
      Bard:        { verb: 'spin a tale',       crisis: 'strum a dissonant chord that freezes everyone, then talk your way out',      help: 'sing a gentle ballad that eases their pain and lifts their spirit',          treasure: 'compose an epic ballad about the discovery on the spot',                 betrayal: 'write a scathing song about them that every tavern will sing',           darkness: 'hum a tune from childhood � the melody echoes and maps the space' },
      Monk:        { verb: 'center yourself',   crisis: 'flow through precise strikes, deflecting blows with open palms',            help: 'sit beside them in silence, sharing calm energy through presence alone',     treasure: 'meditate on whether attachment to it would cloud your path',              betrayal: 'breathe deeply, release the anger, and walk away in peace',              darkness: 'sit cross-legged, slow your heart, and feel vibrations in the stone' },
      Berserker:   { verb: 'unleash rage',      crisis: 'let out a bone-shaking roar and smash through everything in your path',     help: 'growl protectively, scooping them up with raw strength',                     treasure: 'rip the chest open with bare hands � no patience for locks',             betrayal: 'flip the table, grab them by the collar, and roar in their face',        darkness: 'roar into the void � if anything is hiding, it should be afraid of YOU' },
      Assassin:    { verb: 'strike unseen',     crisis: 'flick a poisoned needle from the shadows � the threat drops before anyone blinks', help: 'observe from a distance first, checking if this is bait',              treasure: 'take it without a sound, leaving no trace you were ever there',          betrayal: 'vanish � they will find a dagger on their pillow as a warning',          darkness: 'move like smoke, every step silent, every breath measured' },
      Druid:       { verb: 'call on nature',    crisis: 'roots explode from the ground, vines wrap the threat while thorns grow sharp', help: 'press a hand to the earth and coax healing moss to grow over their wounds', treasure: 'return it to the earth � everything belongs to the cycle',               betrayal: 'let the forest handle it � poison ivy has a way of finding traitors',    darkness: 'ask the beetles and bats � they see in the dark better than anyone' },
    };

    // OCCUPATION FLAVOR � tools/props that color the answer
    const OCC_FLAVOR: Record<string, string> = {
      Blacksmith: 'grabbing your hammer and tongs', Teacher: 'pulling out your worn notebook', Merchant: 'weighing the options like a deal',
      Farmer: 'using the same hands that work the soil', Chef: 'with the precision of a knife on a cutting board', Doctor: 'checking for a pulse with practiced fingers',
      Scholar: 'recalling an ancient text about this exact situation', Guard: 'falling into patrol formation instinctively', Sailor: 'reading the situation like wind on open water',
      Musician: 'letting rhythm guide your timing', Hunter: 'tracking every detail like following a blood trail', Architect: 'seeing the structural weakness immediately',
      Alchemist: 'reaching for the vial at your belt', Priest: 'murmuring a quiet prayer under your breath', Spy: 'already three steps ahead of everyone',
      Miner: 'bracing yourself like shoring up a tunnel', Artist: 'seeing the beauty even in the chaos', Thief: 'pocketing something useful while nobody looks',
      Engineer: 'calculating angles and force in your head', Librarian: 'remembering a story exactly like this one', Herbalist: 'spotting the right plant within arm s reach',
    };

    // SIGNATURE MOVE FLAVOR � weave user's actual input into answers
    const sigFlavor = sig.length > 3 ? `, finishing with your signature � ${sig}` : '';
    const occFlavor = OCC_FLAVOR[occ] ? `, ${OCC_FLAVOR[occ]}` : '';

    // SUBJECTS + SITUATIONS + CONTEXTS � mix and match
    const SUBJECTS = ['a wounded stranger', 'a crying child', 'an elderly traveler', 'a cornered merchant', 'a trapped animal', 'a fallen comrade', 'a starving family', 'a suspicious figure', 'a lost pilgrim', 'a chained prisoner'];
    const SITUATIONS = ['collapses at your feet', 'is being robbed in front of you', 'screams for help from a burning building', 'begs you for food', 'is surrounded by thugs', 'lies bleeding on the ground', 'is accused of a crime they didn t commit', 'stumbles out of the dark covered in mud', 'offers you a deal that seems too good', 'blocks your path and won t move'];
    const CONTEXTS = ['on a rain-soaked road at dusk', 'in a crowded marketplace', 'deep in an unfamiliar forest', 'at the gates of a ruined temple', 'during a violent thunderstorm', 'in the dead of night with no moon', 'at the edge of a cliff', 'inside a collapsing mine shaft', 'on the deck of a sinking ship', 'in a narrow alley with no exit'];

    const shuffle2 = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    const userClass = recipe.class;
    const userActions = CLASS_ACTIONS[userClass] || CLASS_ACTIONS['Warrior'];
    const allClassKeys = Object.keys(CLASS_ACTIONS);
    const otherClassKeys = allClassKeys.filter(k => k !== userClass);

    // Generate 4 scenario questions with unique combos
    const scenarioKeys: (keyof typeof userActions)[] = shuffle2(['crisis', 'help', 'treasure', 'betrayal', 'darkness'] as const).slice(0, 4) as any;

    for (const sKey of scenarioKeys) {
      const subject = pick(SUBJECTS);
      const situation = pick(SITUATIONS);
      const context = pick(CONTEXTS);

      const questionText = `${name} encounters ${subject} who ${situation}, ${context}. What does ${name} do?`;
      const correctAnswer = userActions[sKey] + occFlavor + sigFlavor;

      // 19 fakes: same scenario key applied to OTHER classes + occupation flavor from random occupations
      const otherOccs = Object.keys(OCC_FLAVOR).filter(o => o !== occ);
      const fakes: string[] = [];
      for (const otherClass of shuffle2(otherClassKeys)) {
        const otherAct = CLASS_ACTIONS[otherClass];
        if (otherAct && otherAct[sKey]) {
          const fakeOcc = pick(otherOccs);
          const fakeOccFlavor = OCC_FLAVOR[fakeOcc] ? `, ${OCC_FLAVOR[fakeOcc]}` : '';
          fakes.push(otherAct[sKey] + fakeOccFlavor);
        }
        if (fakes.length >= 15) break;
      }
      // Pad with absurd but vivid fakes
      const absurd = shuffle2([
        'freeze completely, then pretend you didn t see anything and walk the other way',
        'pull out a sandwich, sit down, and watch the chaos unfold while eating',
        'start an inspirational TED talk about resilience and hope',
        'challenge everyone present to a dance battle to resolve the conflict',
        'immediately start digging a hole, because maybe the answer is underground',
        'scream into the void and hope the universe provides a solution',
        'begin writing a strongly-worded letter to the local authorities',
        'announce you re on lunch break and this is not your jurisdiction',
      ]);
      while (fakes.length < 19) fakes.push(absurd[fakes.length - 15] || 'do absolutely nothing and hope for the best');

      questions.push({
        id: `q_${questionId++}`,
        question: questionText,
        correctAnswer: correctAnswer,
        options: shuffle2([correctAnswer, ...fakes.slice(0, 19)]),
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