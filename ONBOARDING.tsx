// ============================================================================
// KASVILLAGE EXPO - ONBOARDING / AVATAR CREATION COMPONENT
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  PixelRatio,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { AlertTriangle, Check, ChevronRight, Clock, Key } from 'lucide-react-native';
import { createWallet } from './wallet_registration_v2.js';
import { registerDevice } from './device_attestation';

const DEVICE_ANCHOR_KEY = 'kv_device_anchor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASE_WIDTH = 393;
const scale = Math.min(SCREEN_WIDTH / BASE_WIDTH, 1.2);
const rs = {
  s: (size: number) => Math.round(size * scale),
  font: (size: number) => Math.round(size * scale * (PixelRatio.getFontScale() > 1 ? 0.9 : 1)),
};

const COLORS = {
  knickBlue: '#006BB6',
  knickOrange: '#F58426',
  white: '#FFFFFF',
  black: '#000000',
  stone50: '#fafaf9',
  stone100: '#f5f5f4',
  stone200: '#e7e5e4',
  stone400: '#a8a29e',
  stone500: '#78716c',
  stone600: '#57534e',
  stone800: '#292524',
  stone900: '#1c1917',
  amber100: '#fef3c7',
  amber600: '#d97706',
  amber800: '#92400e',
  red600: '#dc2626',
  green500: '#22c55e',
  blue50: '#eff6ff',
  blue200: '#bfdbfe',
  blue600: '#2563eb',
  blue700: '#1d4ed8',
  blue800: '#1e40af',
  cardBg: '#FFF8F0',
};

const AVATAR_CLASSES = ['Warrior', 'Mage', 'Rogue', 'Healer', 'Tank', 'Archer', 'Necromancer', 'Paladin', 'Druid', 'Bard', 'Monk', 'Berserker', 'Assassin', 'Summoner'];
const AVATAR_RACES = ['Human', 'Elf', 'Dwarf', 'Orc', 'Goblin', 'Undead', 'Demon', 'Angel', 'Dragon-kin', 'Fae', 'Merfolk', 'Centaur', 'Giant', 'Automaton'];
const AVATAR_OCCUPATIONS = ['Blacksmith', 'Merchant', 'Farmer', 'Scholar', 'Soldier', 'Thief', 'Alchemist', 'Hunter', 'Cook', 'Bard', 'Healer', 'Miner', 'Sailor', 'Scribe', 'Guard', 'Noble', 'Beggar', 'Priest', 'Artisan', 'Explorer'];
const AVATAR_PERSONALITIES = ['Brave', 'Cunning', 'Wise', 'Foolish', 'Kind', 'Cruel', 'Mysterious', 'Cheerful', 'Melancholic', 'Stoic', 'Hot-headed', 'Calm', 'Playful', 'Serious', 'Loyal', 'Treacherous', 'Ambitious', 'Humble'];
const AVATAR_ANIMALS = ['Wolf', 'Eagle', 'Bear', 'Snake', 'Fox', 'Lion', 'Dragon', 'Phoenix', 'Raven', 'Owl', 'Tiger', 'Shark', 'Spider', 'Scorpion', 'Butterfly'];
const AVATAR_MUTANTS = ['Telepathy', 'Fire Control', 'Ice Manipulation', 'Super Strength', 'Invisibility', 'Flight', 'Teleportation', 'Time Freeze', 'Shapeshifting', 'Energy Absorption', 'Mind Control', 'Regeneration', 'Shadow Walk'];

const ONBOARDING_MAX_ATTEMPTS = 3;
const ONBOARDING_LOCKOUT_DURATION = 5 * 60 * 1000;
const QUIZ_TIME_LIMIT = 60;
const AVATAR_DATA_VERSION = 3;
const TRAITS_TO_BUY = 9;
const TRAITS_TO_SELL = 13;

const BUYER_TRAITS = ['class', 'race', 'occupation', 'mutant', 'animal', 'mutate', 'personality', 'combatStyle', 'signatureMove'];
const SELLER_EXTRA_TRAITS = ['weakness', 'powerSpike', 'voiceLine', 'loreOrigin'];
const BACKSTORY_TRAITS = ['originStory', 'formativeMemory', 'lifePhilosophy', 'definingMoment', 'name'];

const CANONICAL_FIELDS = [
  'animal', 'class', 'combatStyle', 'definingMoment', 'formativeMemory',
  'lifePhilosophy', 'loreOrigin', 'mutant', 'mutate', 'name', 'occupation',
  'originStory', 'personality', 'powerSpike', 'race', 'signatureMove',
  'voiceLine', 'weakness',
];

function countFilledTraits(avatar: any, fields: string[]): number {
  return fields.filter(f => (avatar[f] ?? '').trim().length >= 2).length;
}

function getAvatarTier(avatar: any): 'guest' | 'buyer' | 'seller' {
  const buyerCount = countFilledTraits(avatar, BUYER_TRAITS);
  const sellerCount = buyerCount + countFilledTraits(avatar, SELLER_EXTRA_TRAITS);
  if (sellerCount >= TRAITS_TO_SELL) return 'seller';
  if (buyerCount >= TRAITS_TO_BUY) return 'buyer';
  return 'guest';
}

async function generateIdentityHash(avatar: any): Promise<string> {
  const canonical: any = {};
  for (const field of CANONICAL_FIELDS) {
    const val = avatar[field];
    canonical[field] = typeof val === 'string' ? val.trim().toLowerCase() : '';
  }
  const jsonStr = JSON.stringify(canonical);

  let deviceAnchor = await SecureStore.getItemAsync(DEVICE_ANCHOR_KEY);
  if (!deviceAnchor) {
    const bytes = await Crypto.getRandomBytesAsync(16);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    deviceAnchor = [hex.slice(0, 8), hex.slice(8, 12), '4' + hex.slice(13, 16),
      ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20), hex.slice(20, 32)].join('-');
    await SecureStore.setItemAsync(DEVICE_ANCHOR_KEY, deviceAnchor, { keychainAccessible: SecureStore.ALWAYS });
  }

  const prefixed = 'KV_AVATAR_V3:' + jsonStr + '|' + deviceAnchor;
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, prefixed);
}

function generateFakeAnswers(correct: string, type: string, count = 19): string[] {
  const pools: Record<string, string[]> = {
    class: AVATAR_CLASSES, race: AVATAR_RACES, occupation: AVATAR_OCCUPATIONS,
    personality: AVATAR_PERSONALITIES, animal: AVATAR_ANIMALS, mutant: AVATAR_MUTANTS,
  };
  const pool = pools[type] || [];
  const filtered = pool.filter(x => x.toLowerCase() !== correct.toLowerCase());
  if (filtered.length >= count) return filtered.sort(() => Math.random() - 0.5).slice(0, count);
  const generics = ['Shadow Strike', 'Lightning Bolt', 'Fire Breath', 'Ice Shield', 'Dark Vision', 'Wind Walker',
    'Earth Shaker', 'Water Dancer', 'Soul Stealer', 'Mind Bender', 'Time Shifter', 'Void Walker',
    'Star Caller', 'Moon Singer', 'Sun Warrior', 'Storm Bringer', 'Death Touch', 'Life Giver', 'Dream Weaver', 'Fate Spinner',
  ].filter(x => x.toLowerCase() !== correct.toLowerCase());
  return [...filtered, ...generics].slice(0, count);
}

interface ButtonGridProps { options: string[]; selected: string; onSelect: (v: string) => void; columns?: number; }

const ButtonGrid: React.FC<ButtonGridProps> = ({ options, selected, onSelect, columns = 2 }) => (
  <View style={gridStyles.container}>
    {options.map((option) => (
      <TouchableOpacity
        key={option}
        style={[gridStyles.button, { width: `${100 / columns - 2}%` as any }, selected === option && gridStyles.buttonSelected]}
        onPress={() => onSelect(option)}
      >
        <Text style={[gridStyles.buttonText, selected === option && gridStyles.buttonTextSelected]}>{option}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const gridStyles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: rs.s(8) },
  button: { backgroundColor: COLORS.cardBg, borderWidth: 2, borderColor: COLORS.stone400, borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(8), alignItems: 'center' },
  buttonSelected: { backgroundColor: COLORS.amber100, borderColor: COLORS.amber600 },
  buttonText: { fontSize: rs.font(12), fontWeight: 'bold', color: COLORS.stone600 },
  buttonTextSelected: { color: COLORS.amber800 },
});

interface QuizOptionProps { options: string[]; onSelect: (i: number) => void; disabled?: boolean; }

const QuizOptions: React.FC<QuizOptionProps> = ({ options, onSelect, disabled }) => (
  <ScrollView style={quizStyles.scroll} contentContainerStyle={quizStyles.container}>
    {options.map((option, idx) => (
      <TouchableOpacity key={idx} style={quizStyles.btn} onPress={() => !disabled && onSelect(idx)} disabled={disabled}>
        <Text style={quizStyles.text}>{option}</Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

const quizStyles = StyleSheet.create({
  scroll: { maxHeight: rs.s(300) },
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: rs.s(8), padding: rs.s(8) },
  btn: { width: '48%', backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.stone400, borderRadius: rs.s(8), padding: rs.s(10), alignItems: 'center' },
  text: { fontSize: rs.font(11), color: COLORS.stone800, textAlign: 'center' },
});

interface OnboardingProps {
  onComplete: (data: { identityHash: string; avatar: any; score: number }) => void;
  onFail: (data: { reason: string; score: number }) => void;
  isReturningUser?: boolean;
}

export const OnboardingScreen: React.FC<OnboardingProps> = ({ onComplete, onFail, isReturningUser = false }) => {
  const [step, setStep] = useState<'welcome' | 'backup_seed' | 'avatar' | 'questions' | 'complete' | 'failed' | 'locked_out'>(isReturningUser ? 'questions' : 'welcome');
  const [isLoading, setIsLoading] = useState(true);
  const [avatarPage, setAvatarPage] = useState(1);

  const [session, setSession] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [timeLeft, setTimeLeft] = useState(QUIZ_TIME_LIMIT);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [textAnswer, setTextAnswer] = useState('');

  const [failAttempts, setFailAttempts] = useState(0);
  const [lockoutEnd, setLockoutEnd] = useState(0);

  const [walletCreating, setWalletCreating] = useState(false);
  const [walletPublicKey, setWalletPublicKey] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletError, setWalletError] = useState('');
  const [walletMnemonic, setWalletMnemonic] = useState('');

  const [avatar, setAvatar] = useState({
    name: '', class: '', race: '', occupation: '', mutant: '', animal: '',
    mutate: '', personality: '', originStory: '', combatStyle: '',
    signatureMove: '', weakness: '', powerSpike: '', voiceLine: '',
    loreOrigin: '', formativeMemory: '', lifePhilosophy: '', definingMoment: '',
  });

  const avatarStartTime = useRef(Date.now());
  const passThreshold = isReturningUser ? (session?.required_passing ?? TRAITS_TO_BUY) : 4;

  useEffect(() => {
    const init = async () => {
      const storedFails = await SecureStore.getItemAsync('kv_onboard_fails');
      const storedLockout = await SecureStore.getItemAsync('kv_onboard_lockout');
      if (storedFails) setFailAttempts(parseInt(storedFails));
      if (storedLockout) setLockoutEnd(parseInt(storedLockout));

      if (isReturningUser) {
        const storedAvatarStr = await SecureStore.getItemAsync('kv_avatar_data');
        if (storedAvatarStr) {
          const storedAvatar = JSON.parse(storedAvatarStr);
          setAvatar(storedAvatar);
          generateMemoryQuiz(storedAvatar);
        } else {
          setStep('welcome');
        }
      }
      setIsLoading(false);
    };
    init();
  }, [isReturningUser]);

  const generateMemoryQuiz = (storedAvatar: any) => {
    const questions: any[] = [];
    const tier = getAvatarTier(storedAvatar);
    const tierFields = tier === 'seller' ? [...BUYER_TRAITS, ...SELLER_EXTRA_TRAITS] : BUYER_TRAITS;

    const fieldDefs: Array<{ key: string; q: string; pool?: string[]; type: 'choice' | 'text' }> = [
      { key: 'name', q: "What is your avatar's name?", pool: ['Shadow','Phoenix','Storm','Blade','Luna','Raven','Nova','Frost','Echo','Vex','Nyx','Cipher','Ash','Drake','Ember','Kira','Zane','Sable'], type: 'choice' },
      { key: 'class', q: 'What class is your avatar?', pool: AVATAR_CLASSES, type: 'choice' },
      { key: 'race', q: 'What race is your avatar?', pool: AVATAR_RACES, type: 'choice' },
      { key: 'occupation', q: "What is your avatar's occupation?", pool: AVATAR_OCCUPATIONS, type: 'choice' },
      { key: 'mutant', q: 'What mutant power does your avatar have?', pool: AVATAR_MUTANTS, type: 'choice' },
      { key: 'animal', q: "What is your avatar's spirit animal?", pool: AVATAR_ANIMALS, type: 'choice' },
      { key: 'mutate', q: 'What does your avatar mutate into?', pool: AVATAR_MUTANTS, type: 'choice' },
      { key: 'personality', q: "What is your avatar's personality?", pool: AVATAR_PERSONALITIES, type: 'choice' },
      { key: 'combatStyle', q: "What is your avatar's combat style?", pool: ['Aggressive','Defensive','Tactical','Berserker','Stealth','Support','Counter','Hybrid','Ranged','Melee','Magic','Trapper'], type: 'choice' },
      { key: 'signatureMove', q: "What is your avatar's signature move?", type: 'text' },
      { key: 'weakness', q: "What is your avatar's greatest weakness?", type: 'text' },
      { key: 'powerSpike', q: 'When does your avatar reach their power spike?', type: 'text' },
      { key: 'voiceLine', q: "What is your avatar's signature voice line?", type: 'text' },
      { key: 'loreOrigin', q: "Where does your avatar's lore originate?", type: 'text' },
    ];

    for (const def of fieldDefs) {
      if (!tierFields.includes(def.key)) continue;
      const value = (storedAvatar[def.key] ?? '').trim();
      if (value.length < 2) continue;

      if (def.type === 'choice' && def.pool) {
        const fakes = def.pool.filter(x => x.toLowerCase() !== value.toLowerCase()).slice(0, 19);
        const options = [value, ...fakes].sort(() => Math.random() - 0.5);
        questions.push({ id: `mem_${def.key}`, type: 'choice', question: def.q, options, correct_index: options.indexOf(value) });
      } else {
        const correct = value.toLowerCase();
        questions.push({ id: `mem_text_${def.key}`, type: 'text', question: def.q, correct, minMatchChars: Math.min(6, Math.floor(correct.length * 0.4)) });
      }
    }

    const backstoryDef = fieldDefs.find(d => BACKSTORY_TRAITS.includes(d.key) && !tierFields.includes(d.key) && (storedAvatar[d.key] ?? '').trim().length > 3);
    if (backstoryDef) {
      const correct = storedAvatar[backstoryDef.key].trim().toLowerCase();
      questions.push({ id: `mem_text_${backstoryDef.key}`, type: 'text', question: backstoryDef.q, correct, minMatchChars: Math.min(6, Math.floor(correct.length * 0.4)) });
    }

    if (questions.length < 3) { setStep('welcome'); return; }

    const tierRequired = tier === 'seller' ? TRAITS_TO_SELL : TRAITS_TO_BUY;
    const requiredPassing = Math.min(questions.length, tierRequired);

    setSession({
      session_id: `recovery_${Date.now()}`,
      questions,
      started_at: Date.now(),
      time_limit_seconds: Math.max(QUIZ_TIME_LIMIT, questions.length * 12),
      required_passing: requiredPassing,
      tier,
    });
  };

  useEffect(() => {
    if (step !== 'questions' || !session) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timer); setStep('failed'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step, session]);

  const handleAnswer = (selectedIndex: number) => {
    if (!session || currentIndex >= session.questions.length) return;
    const question = session.questions[currentIndex];
    if (question.type === 'text') return;
    const isCorrect = selectedIndex === question.correct_index;
    if (isCorrect) { const n = score + 1; setScore(n); scoreRef.current = n; setFeedback('correct'); }
    else setFeedback('wrong');
    setTimeout(() => {
      setFeedback(null);
      if (currentIndex + 1 < session.questions.length) setCurrentIndex(currentIndex + 1);
      else finishOnboarding();
    }, 500);
  };

  const handleTextAnswer = () => {
    if (!session || currentIndex >= session.questions.length) return;
    const question = session.questions[currentIndex];
    if (question.type !== 'text') return;
    const input = textAnswer.trim().toLowerCase();
    const correct = question.correct as string;
    const minChars = question.minMatchChars as number;
    const isCorrect = input.length >= minChars && (correct.startsWith(input.slice(0, minChars)) || input.startsWith(correct.slice(0, minChars)));
    if (isCorrect) { const n = score + 1; setScore(n); scoreRef.current = n; setFeedback('correct'); }
    else setFeedback('wrong');
    setTextAnswer('');
    setTimeout(() => {
      setFeedback(null);
      if (currentIndex + 1 < session.questions.length) setCurrentIndex(currentIndex + 1);
      else finishOnboarding();
    }, 600);
  };

  const updateAvatar = (field: string, value: string) => setAvatar(prev => ({ ...prev, [field]: value }));

  const finishOnboarding = async () => {
    const quizPassed = scoreRef.current >= passThreshold;
    const totalAvatarTime = Date.now() - avatarStartTime.current;
    const notABot = totalAvatarTime > 500;
    const didPass = quizPassed && notABot;

    if (didPass) {
      await SecureStore.deleteItemAsync('kv_onboard_fails');
      await SecureStore.deleteItemAsync('kv_onboard_lockout');

      if (isReturningUser) {
        const storedAvatarStr = await SecureStore.getItemAsync('kv_avatar_data') ?? '{}';
        const storedAvatar = JSON.parse(storedAvatarStr);
        const identityHash = await generateIdentityHash(storedAvatar);
        setWalletCreating(true);
        const walletResult = await createWallet({ identityHashHex: identityHash });
        setWalletCreating(false);
        if (!walletResult.success) { setWalletError(walletResult.error ?? 'Recovery failed'); setStep('failed'); return; }
        setWalletPublicKey(walletResult.publicKey ?? '');
        setWalletAddress(walletResult.kaspaAddress ?? '');
        const storedHash = await SecureStore.getItemAsync('kv_identity_hash') ?? identityHash;
        setStep('complete');
        setTimeout(() => { onComplete({ identityHash: storedHash, avatar: storedAvatar, score: scoreRef.current }); }, 800);
      } else {
        const identityHash = await generateIdentityHash(avatar);
        await SecureStore.setItemAsync('kv_identity_hash', identityHash);
        await SecureStore.setItemAsync('kv_verified', 'true');
        await SecureStore.setItemAsync('kv_verified_at', Date.now().toString());
        await SecureStore.setItemAsync('kv_avatar_name', avatar.name || 'Villager');
        await SecureStore.setItemAsync('kv_avatar_data', JSON.stringify({ ...avatar, _version: AVATAR_DATA_VERSION }));
        setWalletCreating(true);
        const walletResult = await createWallet({ identityHashHex: identityHash });
        setWalletCreating(false);
        if (!walletResult.success) { setWalletError(walletResult.error ?? 'Wallet creation failed'); setStep('failed'); return; }
        setWalletPublicKey(walletResult.publicKey ?? '');
        setWalletAddress(walletResult.kaspaAddress ?? '');
        setWalletMnemonic(walletResult.mnemonic ?? '');
        if (walletResult.publicKey) { registerDevice(walletResult.publicKey).catch(() => {}); }
        setStep('backup_seed');
      }
    } else {
      const newFails = failAttempts + 1;
      setFailAttempts(newFails);
      await SecureStore.setItemAsync('kv_onboard_fails', newFails.toString());
      if (newFails >= ONBOARDING_MAX_ATTEMPTS) {
        const lockTime = Date.now() + ONBOARDING_LOCKOUT_DURATION;
        await SecureStore.setItemAsync('kv_onboard_lockout', lockTime.toString());
        setLockoutEnd(lockTime);
        setStep('locked_out');
        setTimeout(() => { onFail({ reason: 'locked_out', score: scoreRef.current }); }, 2000);
      } else setStep('failed');
    }
  };

  const handleTryAgain = () => {
    setScore(0); scoreRef.current = 0; setAvatarPage(1); setCurrentIndex(0);
    setSession(null); setFeedback(null); setTimeLeft(QUIZ_TIME_LIMIT);
    setAvatar({ name: '', class: '', race: '', occupation: '', mutant: '', animal: '', mutate: '', personality: '', originStory: '', combatStyle: '', signatureMove: '', weakness: '', powerSpike: '', voiceLine: '', loreOrigin: '', formativeMemory: '', lifePhilosophy: '', definingMoment: '' });
    setStep('welcome');
  };

  const generateNewUserQuiz = () => {
    const questions: any[] = [];
    const fields = [
      { key: 'name', q: 'What name did you give your avatar?', type: 'name' },
      { key: 'class', q: 'What class did you choose?', pool: AVATAR_CLASSES },
      { key: 'race', q: 'What race did you pick?', pool: AVATAR_RACES },
      { key: 'occupation', q: 'What occupation did you select?', pool: AVATAR_OCCUPATIONS },
      { key: 'personality', q: 'What personality trait?', pool: AVATAR_PERSONALITIES },
      { key: 'animal', q: 'What spirit animal?', pool: AVATAR_ANIMALS },
      { key: 'mutant', q: 'What mutant power?', pool: AVATAR_MUTANTS },
      { key: 'combatStyle', q: 'What combat style did you write?', type: 'combatStyle' },
    ];
    for (const field of fields) {
      const value = avatar[field.key as keyof typeof avatar];
      if (!value || value.length < 2) continue;
      let fakes: string[];
      if (field.pool) fakes = field.pool.filter(x => x !== value).slice(0, 19);
      else fakes = generateFakeAnswers(value, field.type || field.key, 19);
      const options = [value, ...fakes].sort(() => Math.random() - 0.5);
      questions.push({ id: `quiz_${field.key}`, question: field.q, options, correct_index: options.indexOf(value) });
    }
    return questions.slice(0, 8);
  };

  if (isLoading || walletCreating) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.amber600} />
        <Text style={styles.loadingTitle}>{walletCreating ? 'Securing Your Wallet...' : isReturningUser ? 'Welcome Back!' : 'Entering the Village...'}</Text>
        <Text style={styles.loadingSubtitle}>{walletCreating ? 'Deriving keys from your avatar' : isReturningUser ? 'Quick verification' : 'Preparing your apartment application'}</Text>
      </View>
    );
  }

  if (step === 'locked_out') {
    const remainingMin = Math.ceil(Math.max(0, lockoutEnd - Date.now()) / 60000);
    return <View style={styles.lockoutContainer}><View style={styles.lockoutCard}><Clock size={rs.s(64)} color={COLORS.red600} /><Text style={styles.lockoutTitle}>Account Locked</Text><Text style={styles.lockoutText}>Wait {remainingMin} minutes.</Text></View></View>;
  }

  if (step === 'failed') return (
    <View style={styles.failedContainer}><View style={styles.failedCard}>
      <AlertTriangle size={rs.s(64)} color={COLORS.red600} />
      <Text style={styles.failedTitle}>Verification Failed</Text>
      <Text style={styles.failedText}>{walletError || `${ONBOARDING_MAX_ATTEMPTS - failAttempts} attempt(s) remaining`}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={handleTryAgain}><Text style={styles.retryButtonText}>Try Again</Text></TouchableOpacity>
    </View></View>
  );

  if (step === 'complete') return (
    <View style={styles.completeContainer}><View style={styles.completeCard}>
      <Check size={rs.s(80)} color={COLORS.green500} />
      <Text style={styles.completeTitle}>Welcome to the Village!</Text>
      <Text style={styles.completeText}>{avatar.name || 'Villager'}, your apartment is ready.</Text>
      <ActivityIndicator color={COLORS.amber600} style={{ marginTop: rs.s(16) }} />
    </View></View>
  );

  if (step === 'welcome') return (
    <View style={styles.welcomeContainer}>
      <View style={styles.welcomeContent}>
        <Text style={styles.welcomeTitle}>KasVillage</Text>
        <Text style={styles.welcomeSubtitle}>AKA "THE VILL"</Text>
        <Text style={styles.welcomeDesc}>Create your avatar to join the decentralized marketplace</Text>
        <View style={styles.featuresBox}>
          <Text style={styles.featureText}>🏠 Your own apartment</Text>
          <Text style={styles.featureText}>🛍️ Build your storefront</Text>
          <Text style={styles.featureText}>💸 Zero-fee P2P payments</Text>
          <Text style={styles.featureText}>🔐 Non-custodial wallet</Text>
        </View>
        <TouchableOpacity style={styles.startButton} onPress={() => setStep('avatar')}>
          <Text style={styles.startButtonText}>Enter The Vill</Text>
          <ChevronRight size={rs.s(24)} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (step === 'backup_seed') {
    const words = walletMnemonic ? walletMnemonic.split(' ') : [];
    const handleContinue = async () => {
      const identityHash = await SecureStore.getItemAsync('kv_identity_hash') ?? '';
      setStep('complete');
      setTimeout(() => { onComplete({ identityHash, avatar, score: scoreRef.current }); }, 800);
    };
    return (
      <ScrollView style={styles.avatarContainer} contentContainerStyle={[styles.avatarContent, { paddingBottom: rs.s(40) }]}>
        <View style={styles.avatarHeader}>
          <Key size={rs.s(48)} color={COLORS.amber600} style={{ marginBottom: rs.s(12) }} />
          <Text style={styles.avatarTitle}>Your Wallet is Ready</Text>
          <Text style={[styles.welcomeDesc, { textAlign: 'center', marginTop: rs.s(8) }]}>
            Your address: {walletAddress ? walletAddress.slice(0, 14) + '...' + walletAddress.slice(-6) : '—'}
          </Text>
        </View>
        <View style={[styles.featuresBox, { marginBottom: rs.s(16) }]}>
          <Text style={{ fontWeight: '700', color: COLORS.stone800, marginBottom: rs.s(6), fontSize: rs.font(13) }}>🔁 How to recover your wallet</Text>
          <Text style={{ color: COLORS.stone600, fontSize: rs.font(12), lineHeight: rs.s(18) }}>Your wallet is tied to your avatar answers. If you ever lose your phone, just re-install KasVillage and answer the same questions — your wallet comes back automatically.</Text>
        </View>
        <View style={{ backgroundColor: COLORS.blue50, borderRadius: rs.s(12), padding: rs.s(16), marginBottom: rs.s(16), borderWidth: 1, borderColor: COLORS.blue200 }}>
          <Text style={{ fontWeight: '700', color: COLORS.blue800, fontSize: rs.font(13), marginBottom: rs.s(8) }}>🔒 Export to Hardware Wallet (Optional)</Text>
          <Text style={{ color: COLORS.blue700, fontSize: rs.font(12), lineHeight: rs.s(18), marginBottom: rs.s(12) }}>Want to use a Ledger or Tangem? These 12 words let you import your wallet into any BIP39-compatible device. <Text style={{ fontWeight: '700' }}>Never share them. Never screenshot them.</Text></Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: rs.s(6), marginBottom: rs.s(12) }}>
            {words.map((word, i) => (
              <View key={i} style={{ backgroundColor: COLORS.cardBg, borderRadius: rs.s(6), paddingHorizontal: rs.s(8), paddingVertical: rs.s(4), borderWidth: 1, borderColor: COLORS.blue200, minWidth: rs.s(80) }}>
                <Text style={{ color: COLORS.stone500, fontSize: rs.font(9) }}>{i + 1}.</Text>
                <Text style={{ color: COLORS.stone800, fontSize: rs.font(12), fontWeight: '600' }}>{word}</Text>
              </View>
            ))}
          </View>
          <View style={{ backgroundColor: COLORS.amber100, borderRadius: rs.s(8), padding: rs.s(10), flexDirection: 'row' }}>
            <AlertTriangle size={rs.s(14)} color={COLORS.amber800} style={{ marginRight: rs.s(6), marginTop: rs.s(2) }} />
            <Text style={{ flex: 1, color: COLORS.amber800, fontSize: rs.font(11), lineHeight: rs.s(16) }}>You do NOT need to write these down to use KasVillage. Your avatar is your backup.</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.startButton} onPress={handleContinue}>
          <Check size={rs.s(20)} color="#fff" style={{ marginRight: rs.s(8) }} />
          <Text style={styles.startButtonText}>Enter The Village</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (step === 'avatar') return (
    <ScrollView style={styles.avatarContainer} contentContainerStyle={styles.avatarContent}>
      <View style={styles.avatarHeader}>
        <Text style={styles.avatarTitle}>Create Your Avatar</Text>
        <Text style={styles.avatarSubtitle}>Page {avatarPage} of 4</Text>
        <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${(avatarPage / 4) * 100}%` }]} /></View>
      </View>

      {avatarPage === 1 && <View style={styles.avatarSection}>
        <Text style={styles.sectionTitle}>👤 Basic Identity</Text>
        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput style={styles.textInput} value={avatar.name} onChangeText={(v) => updateAvatar('name', v)} placeholder="Enter name..." placeholderTextColor={COLORS.stone400} maxLength={30} />
        <Text style={styles.fieldLabel}>Class</Text>
        <ButtonGrid options={AVATAR_CLASSES.slice(0, 8)} selected={avatar.class} onSelect={(v) => updateAvatar('class', v)} columns={4} />
        <Text style={styles.fieldLabel}>Race</Text>
        <ButtonGrid options={AVATAR_RACES.slice(0, 8)} selected={avatar.race} onSelect={(v) => updateAvatar('race', v)} columns={4} />
      </View>}

      {avatarPage === 2 && <View style={styles.avatarSection}>
        <Text style={styles.sectionTitle}>📜 Background</Text>
        <Text style={styles.fieldLabel}>Occupation</Text>
        <ButtonGrid options={AVATAR_OCCUPATIONS.slice(0, 8)} selected={avatar.occupation} onSelect={(v) => updateAvatar('occupation', v)} columns={4} />
        <Text style={styles.fieldLabel}>Personality</Text>
        <ButtonGrid options={AVATAR_PERSONALITIES.slice(0, 8)} selected={avatar.personality} onSelect={(v) => updateAvatar('personality', v)} columns={4} />
        <Text style={styles.fieldLabel}>Spirit Animal</Text>
        <ButtonGrid options={AVATAR_ANIMALS.slice(0, 8)} selected={avatar.animal} onSelect={(v) => updateAvatar('animal', v)} columns={4} />
      </View>}

      {avatarPage === 3 && <View style={styles.avatarSection}>
        <Text style={styles.sectionTitle}>⚡ Powers</Text>
        <Text style={styles.fieldLabel}>Mutant Power</Text>
        <ButtonGrid options={AVATAR_MUTANTS.slice(0, 8)} selected={avatar.mutant} onSelect={(v) => updateAvatar('mutant', v)} columns={2} />
        <Text style={styles.fieldLabel}>Combat Style</Text>
        <TextInput style={styles.textInput} value={avatar.combatStyle} onChangeText={(v) => updateAvatar('combatStyle', v)} placeholder="Describe style..." placeholderTextColor={COLORS.stone400} maxLength={50} />
        <Text style={styles.fieldLabel}>Signature Move</Text>
        <TextInput style={styles.textInput} value={avatar.signatureMove} onChangeText={(v) => updateAvatar('signatureMove', v)} placeholder="Your technique..." placeholderTextColor={COLORS.stone400} maxLength={50} />
      </View>}

      {avatarPage === 4 && <View style={styles.avatarSection}>
        <Text style={styles.sectionTitle}>📖 Your Story</Text>
        <Text style={styles.fieldLabel}>Weakness</Text>
        <TextInput style={styles.textInput} value={avatar.weakness} onChangeText={(v) => updateAvatar('weakness', v)} placeholder="Everyone has one..." placeholderTextColor={COLORS.stone400} maxLength={50} />
        <Text style={styles.fieldLabel}>Voice Line</Text>
        <TextInput style={styles.textInput} value={avatar.voiceLine} onChangeText={(v) => updateAvatar('voiceLine', v)} placeholder="Your catchphrase..." placeholderTextColor={COLORS.stone400} maxLength={100} />
        <Text style={styles.fieldLabel}>Origin Story</Text>
        <TextInput style={[styles.textInput, { height: rs.s(80) }]} value={avatar.originStory} onChangeText={(v) => updateAvatar('originStory', v)} placeholder="How did you become who you are?" placeholderTextColor={COLORS.stone400} multiline maxLength={200} />
      </View>}

      <View style={styles.avatarNav}>
        {avatarPage > 1 && <TouchableOpacity style={styles.navButtonSecondary} onPress={() => setAvatarPage(avatarPage - 1)}><Text style={styles.navButtonSecondaryText}>← Back</Text></TouchableOpacity>}
        {avatarPage < 4 ? (
          <TouchableOpacity style={styles.navButtonPrimary} onPress={() => setAvatarPage(avatarPage + 1)}><Text style={styles.navButtonPrimaryText}>Next →</Text></TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.navButtonPrimary, { backgroundColor: COLORS.green500 }]} onPress={() => {
            const questions = generateNewUserQuiz();
            setSession({ session_id: `new_${Date.now()}`, questions, started_at: Date.now(), time_limit_seconds: QUIZ_TIME_LIMIT });
            setStep('questions');
          }}><Text style={styles.navButtonPrimaryText}>Complete ✓</Text></TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );

  if (step === 'questions' && session) {
    const currentQuestion = session.questions[currentIndex];
    return (
      <View style={styles.quizContainer}>
        <View style={styles.timerBar}><Clock size={rs.s(16)} color={timeLeft < 10 ? COLORS.red600 : COLORS.amber600} /><Text style={[styles.timerText, timeLeft < 10 && { color: COLORS.red600 }]}>{timeLeft}s</Text></View>
        <View style={styles.quizProgress}><Text style={styles.quizProgressText}>Q {currentIndex + 1}/{session.questions.length}</Text><Text style={styles.quizScore}>Score: {score}</Text></View>
        <View style={styles.questionCard}><Text style={styles.questionText}>{currentQuestion.question}</Text></View>
        {feedback && <View style={[styles.feedbackBanner, feedback === 'correct' ? styles.feedbackCorrect : styles.feedbackWrong]}><Text style={styles.feedbackText}>{feedback === 'correct' ? '✓ Correct!' : '✗ Wrong'}</Text></View>}
        {currentQuestion.type === 'text' ? (
          <View style={{ marginTop: rs.s(16) }}>
            <TextInput style={styles.textInput} value={textAnswer} onChangeText={setTextAnswer} placeholder="Type your answer..." placeholderTextColor={COLORS.stone400} onSubmitEditing={handleTextAnswer} />
            <TouchableOpacity style={[styles.navButtonPrimary, { marginTop: rs.s(12) }]} onPress={handleTextAnswer}><Text style={styles.navButtonPrimaryText}>Submit</Text></TouchableOpacity>
          </View>
        ) : (
          <QuizOptions options={currentQuestion.options} onSelect={handleAnswer} disabled={!!feedback} />
        )}
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: COLORS.stone900, justifyContent: 'center', alignItems: 'center', padding: rs.s(24) },
  loadingTitle: { fontSize: rs.font(20), fontWeight: 'bold', color: COLORS.white, marginTop: rs.s(16) },
  loadingSubtitle: { fontSize: rs.font(14), color: COLORS.stone400, marginTop: rs.s(8) },
  lockoutContainer: { flex: 1, backgroundColor: 'rgba(127, 29, 29, 0.9)', justifyContent: 'center', alignItems: 'center', padding: rs.s(24) },
  lockoutCard: { backgroundColor: COLORS.cardBg, borderRadius: rs.s(16), padding: rs.s(32), alignItems: 'center', maxWidth: rs.s(320) },
  lockoutTitle: { fontSize: rs.font(24), fontWeight: '900', color: COLORS.red600, marginTop: rs.s(16) },
  lockoutText: { fontSize: rs.font(14), color: COLORS.stone600, textAlign: 'center', marginTop: rs.s(8) },
  failedContainer: { flex: 1, backgroundColor: 'rgba(127, 29, 29, 0.9)', justifyContent: 'center', alignItems: 'center', padding: rs.s(24) },
  failedCard: { backgroundColor: COLORS.cardBg, borderRadius: rs.s(16), padding: rs.s(24), alignItems: 'center', maxWidth: rs.s(340) },
  failedTitle: { fontSize: rs.font(24), fontWeight: '900', color: COLORS.stone800, marginTop: rs.s(16) },
  failedText: { fontSize: rs.font(14), color: COLORS.stone600, marginTop: rs.s(8) },
  retryButton: { backgroundColor: COLORS.blue600, borderRadius: rs.s(12), padding: rs.s(16), marginTop: rs.s(16), width: '100%', alignItems: 'center' },
  retryButtonText: { fontSize: rs.font(16), fontWeight: 'bold', color: COLORS.white },
  completeContainer: { flex: 1, backgroundColor: 'rgba(34, 197, 94, 0.9)', justifyContent: 'center', alignItems: 'center', padding: rs.s(24) },
  completeCard: { backgroundColor: COLORS.cardBg, borderRadius: rs.s(16), padding: rs.s(32), alignItems: 'center', maxWidth: rs.s(320) },
  completeTitle: { fontSize: rs.font(24), fontWeight: '900', color: COLORS.stone800, marginTop: rs.s(16) },
  completeText: { fontSize: rs.font(14), color: COLORS.stone600, textAlign: 'center', marginTop: rs.s(8) },
  welcomeContainer: { flex: 1, backgroundColor: COLORS.knickBlue, justifyContent: 'center', alignItems: 'center', padding: rs.s(24) },
  welcomeContent: { alignItems: 'center', zIndex: 10 },
  welcomeTitle: { fontSize: rs.font(56), fontWeight: '900', color: COLORS.knickOrange, textShadowColor: COLORS.white, textShadowOffset: { width: 4, height: 4 }, textShadowRadius: 0 },
  welcomeSubtitle: { fontSize: rs.font(24), fontWeight: '900', color: COLORS.white, marginTop: rs.s(8) },
  welcomeDesc: { fontSize: rs.font(14), color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: rs.s(24), maxWidth: rs.s(280) },
  featuresBox: { marginTop: rs.s(32), gap: rs.s(8) },
  featureText: { fontSize: rs.font(14), color: COLORS.white, fontWeight: 'bold' },
  startButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.knickOrange, paddingVertical: rs.s(16), paddingHorizontal: rs.s(32), borderRadius: rs.s(16), marginTop: rs.s(40), gap: rs.s(8) },
  startButtonText: { fontSize: rs.font(18), fontWeight: '900', color: COLORS.white },
  avatarContainer: { flex: 1, backgroundColor: COLORS.cardBg },
  avatarContent: { padding: rs.s(24), paddingBottom: rs.s(100) },
  avatarHeader: { marginBottom: rs.s(24) },
  avatarTitle: { fontSize: rs.font(24), fontWeight: '900', color: COLORS.stone800 },
  avatarSubtitle: { fontSize: rs.font(14), color: COLORS.stone500, marginTop: rs.s(4) },
  progressBar: { height: rs.s(4), backgroundColor: COLORS.stone200, borderRadius: rs.s(2), marginTop: rs.s(12), overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.amber600 },
  avatarSection: { marginBottom: rs.s(24) },
  sectionTitle: { fontSize: rs.font(18), fontWeight: 'bold', color: COLORS.amber800, marginBottom: rs.s(16) },
  fieldLabel: { fontSize: rs.font(12), fontWeight: 'bold', color: COLORS.stone600, textTransform: 'uppercase', marginBottom: rs.s(8), marginTop: rs.s(16) },
  textInput: { backgroundColor: COLORS.white, borderWidth: 2, borderColor: COLORS.stone200, borderRadius: rs.s(12), padding: rs.s(12), fontSize: rs.font(14), color: COLORS.stone800 },
  avatarNav: { flexDirection: 'row', justifyContent: 'space-between', marginTop: rs.s(24), gap: rs.s(12) },
  navButtonSecondary: { flex: 1, backgroundColor: COLORS.stone200, padding: rs.s(16), borderRadius: rs.s(12), alignItems: 'center' },
  navButtonSecondaryText: { fontSize: rs.font(14), fontWeight: 'bold', color: COLORS.stone600 },
  navButtonPrimary: { flex: 2, backgroundColor: COLORS.amber600, padding: rs.s(16), borderRadius: rs.s(12), alignItems: 'center' },
  navButtonPrimaryText: { fontSize: rs.font(14), fontWeight: 'bold', color: COLORS.white },
  quizContainer: { flex: 1, backgroundColor: COLORS.stone900, padding: rs.s(16) },
  timerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs.s(8), padding: rs.s(12), backgroundColor: COLORS.stone800, borderRadius: rs.s(12) },
  timerText: { fontSize: rs.font(18), fontWeight: 'bold', color: COLORS.amber600 },
  quizProgress: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: rs.s(16) },
  quizProgressText: { fontSize: rs.font(14), color: COLORS.stone400 },
  quizScore: { fontSize: rs.font(14), fontWeight: 'bold', color: COLORS.green500 },
  questionCard: { backgroundColor: COLORS.cardBg, borderRadius: rs.s(16), padding: rs.s(20), marginTop: rs.s(16) },
  questionText: { fontSize: rs.font(18), fontWeight: 'bold', color: COLORS.stone800, textAlign: 'center' },
  feedbackBanner: { padding: rs.s(12), borderRadius: rs.s(8), marginTop: rs.s(12), alignItems: 'center' },
  feedbackCorrect: { backgroundColor: 'rgba(34, 197, 94, 0.2)' },
  feedbackWrong: { backgroundColor: 'rgba(220, 38, 38, 0.2)' },
  feedbackText: { fontSize: rs.font(16), fontWeight: 'bold', color: COLORS.white },
});

export default OnboardingScreen;