// patch_scenario_questions.cjs — cross-class wrong answers + all 24 classes
// Run: node patch_scenario_questions.cjs
const fs = require('fs');
const f = 'Expo_identity_ritual.tsx';
let s = fs.readFileSync(f, 'utf8');
const NL = s.includes('\r\n') ? '\r\n' : '\n';
const n = (str) => str.replace(/\n/g, NL);

// ═══════════════════════════════════════════════════════════════
// REPLACE: CLASS_RESPONSES (12 → 24 classes, expanded personality)
// ═══════════════════════════════════════════════════════════════

const OLD_START = '  // Class → personality response mapping';
const OLD_END = '  // Scenario templates';

const startIdx = s.indexOf(OLD_START);
const endIdx = s.indexOf(OLD_END);
if (startIdx < 0 || endIdx < 0) { console.log('ANCHOR NOT FOUND'); process.exit(1); }

const NEW_CLASS_BLOCK = n(`  // Class → personality response mapping (24 classes, expanded)
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
        darkness: 'Play uplifting music to lift everyone\\'s spirits',
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
        betrayal: 'Consult the ancestors to reveal the traitor\\'s true nature',
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
        stranger: 'Read their tracks and scent to know where they\\'ve been',
        treasure: 'Mark the location and return when it\\'s safe to claim',
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
        betrayal: 'Invoke their patron\\'s wrath to curse the traitor\\'s bloodline',
        darkness: 'See perfectly — their patron\\'s gift includes darkvision',
    }},
  };

`);

// ═══════════════════════════════════════════════════════════════
// REPLACE: SCENARIOS (remove fakePool) + question generation
// (use cross-class answers, 5 options, personality hint)
// ═══════════════════════════════════════════════════════════════

const OLD_SCENARIOS_AND_GEN_START = '  // Scenario templates';
const OLD_SCENARIOS_AND_GEN_END = '  // Race-based personality questions';

const scenGenStart = s.indexOf(OLD_SCENARIOS_AND_GEN_START);
const scenGenEnd = s.indexOf(OLD_SCENARIOS_AND_GEN_END);
if (scenGenStart < 0 || scenGenEnd < 0) { console.log('SCENARIO ANCHOR NOT FOUND'); process.exit(1); }

const NEW_SCENARIOS_AND_GEN = n(`  // Scenario templates (no fakePool — wrong answers come from other classes)
  const SCENARIO_KEYS: { key: string; question: string }[] = [
    { key: 'ambush', question: '{name} the {personality} {class} is ambushed on a forest road. What do they do?' },
    { key: 'stranger', question: 'A wounded stranger collapses at {name}\\'s feet. As a {personality} {class}, what\\'s their first instinct?' },
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
        trait: \`personality_\${scenario.key}\`,
      });
    });
  }

`);

// ═══════════════════════════════════════════════════════════════
// APPLY REPLACEMENTS
// ═══════════════════════════════════════════════════════════════

// Replace CLASS_RESPONSES block (from start anchor to scenario anchor)
const before = s.slice(0, startIdx);
const after = s.slice(endIdx);
s = before + NEW_CLASS_BLOCK + after;

// Now replace SCENARIOS + generation block
const scenStart2 = s.indexOf(OLD_SCENARIOS_AND_GEN_START);
const scenEnd2 = s.indexOf(OLD_SCENARIOS_AND_GEN_END);
if (scenStart2 >= 0 && scenEnd2 >= 0) {
  s = s.slice(0, scenStart2) + NEW_SCENARIOS_AND_GEN + s.slice(scenEnd2);
  console.log('FIX 2: Scenarios + cross-class generation ✓');
} else {
  console.log('FIX 2: SCENARIO ANCHOR NOT FOUND AFTER CLASS REPLACE');
}

fs.writeFileSync(f, s);

// ═══════════════════════════════════════════════════════════════
// VERIFY
// ═══════════════════════════════════════════════════════════════
const v = fs.readFileSync(f, 'utf8');
const checks = [
  ['24 classes', v.includes("Warlock: { personality:")],
  ['Synonyms array', v.includes("synonyms: ['courageous'")],
  ['No fakePool', !v.includes("fakePool: ['Run away")],
  ['Cross-class wrongs', v.includes("otherResponses.slice(0, 4)")],
  ['Personality in question', v.includes("{personality}")],
  ['5 options (1+4)', v.includes(".slice(0, 4)")],
  ['Ninja class', v.includes("Ninja: { personality:")],
  ['Merchant class', v.includes("Merchant: { personality:")],
  ['Samurai class', v.includes("Samurai: { personality:")],
];
console.log('\nVerification:');
checks.forEach(([name, ok]) => console.log(ok ? '  ✓' : '  ✗', name));
console.log(checks.every(c => c[1]) ? '\n✅ ALL PASSED' : '\n❌ SOME FAILED');
