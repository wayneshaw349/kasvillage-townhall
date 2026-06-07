// patch_question_bank.cjs
// Rewrites scenario questions: simpler language, 6 options, name-based
// Keeps: color, race, class, occupation, animal, name questions unchanged
// Scenarios: "[Name] finds [situation]. What does [Name] do?" → class-based answer
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "Question_bank.ts");
let src = fs.readFileSync(file, "utf8");

// Replace the entire PROCEDURAL QUESTION ENGINE section
const startMarker = "// PROCEDURAL QUESTION ENGINE";
const endMarker = "// Text-derived: recognize your own motivation";

const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error("Could not find PROCEDURAL QUESTION ENGINE markers");
  process.exit(1);
}

const newEngine = `// PROCEDURAL QUESTION ENGINE v2
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

  `;

src = src.slice(0, startIdx) + newEngine + src.slice(endIdx);

// Also reduce options from 20 to 6 for basic questions (race, class, etc.)
src = src.replace(/\.slice\(0, 19\)/g, '.slice(0, 5)');

fs.writeFileSync(file, src, "utf8");
console.log("✅ Question_bank.ts rewritten:");
console.log("   - Scenarios: simple, name-first, 6 options");
console.log("   - Actions: 10 variations per class");
console.log("   - Basic questions: 6 options (was 20)");
console.log("   - Color/race/class/occupation/animal: unchanged");
