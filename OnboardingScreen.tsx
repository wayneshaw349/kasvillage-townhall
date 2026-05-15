// ============================================================================
// KASVILLAGE EXPO - ONBOARDING / AVATAR CREATION COMPONENT
// ============================================================================
// Migrated from frontend.jsx with identical UI/UX
// Knicks-themed welcome, avatar builder, memory quiz for returning users
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  PixelRatio,
  Animated,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { AlertTriangle, Check, ChevronRight, Clock } from 'lucide-react-native';

// ============================================================================
// RESPONSIVE SCALER
// ============================================================================
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_WIDTH = 393;
const scale = Math.min(SCREEN_WIDTH / BASE_WIDTH, 1.2);

const rs = {
  s: (size: number) => Math.round(size * scale),
  font: (size: number) => Math.round(size * scale * (PixelRatio.getFontScale() > 1 ? 0.9 : 1)),
};

// ============================================================================
// COLORS
// ============================================================================
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
  red900: '#7f1d1d',
  green500: '#22c55e',
  blue50: '#eff6ff',
  blue200: '#bfdbfe',
  blue600: '#2563eb',
  blue700: '#1d4ed8',
  blue800: '#1e40af',
  cardBg: '#FFF8F0',
};

// ============================================================================
// AVATAR CONSTANTS (Must match canonical schema)
// ============================================================================
const AVATAR_CLASSES = [
  'Warrior', 'Mage', 'Rogue', 'Healer', 'Tank', 'Archer', 'Necromancer',
  'Paladin', 'Druid', 'Bard', 'Monk', 'Berserker', 'Assassin', 'Summoner',
];

const AVATAR_RACES = [
  'Human', 'Elf', 'Dwarf', 'Orc', 'Goblin', 'Undead', 'Demon', 'Angel',
  'Dragon-kin', 'Fae', 'Merfolk', 'Centaur', 'Giant', 'Automaton',
];

const AVATAR_OCCUPATIONS = [
  'Blacksmith', 'Merchant', 'Farmer', 'Scholar', 'Soldier', 'Thief',
  'Alchemist', 'Hunter', 'Cook', 'Bard', 'Healer', 'Miner', 'Sailor',
  'Scribe', 'Guard', 'Noble', 'Beggar', 'Priest', 'Artisan', 'Explorer',
];

const AVATAR_PERSONALITIES = [
  'Brave', 'Cunning', 'Wise', 'Foolish', 'Kind', 'Cruel', 'Mysterious',
  'Cheerful', 'Melancholic', 'Stoic', 'Hot-headed', 'Calm', 'Playful',
  'Serious', 'Loyal', 'Treacherous', 'Ambitious', 'Humble',
];

const AVATAR_ANIMALS = [
  'Wolf', 'Eagle', 'Bear', 'Snake', 'Fox', 'Lion', 'Dragon', 'Phoenix',
  'Raven', 'Owl', 'Tiger', 'Shark', 'Spider', 'Scorpion', 'Butterfly',
];

const AVATAR_MUTANTS = [
  'Telepathy', 'Fire Control', 'Ice Manipulation', 'Super Strength',
  'Invisibility', 'Flight', 'Teleportation', 'Time Freeze', 'Shapeshifting',
  'Energy Absorption', 'Mind Control', 'Regeneration', 'Shadow Walk',
];

// ============================================================================
// ONBOARDING CONSTANTS
// ============================================================================
const ONBOARDING_MAX_ATTEMPTS = 3;
const ONBOARDING_LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes
const QUIZ_TIME_LIMIT = 60; // seconds
const AVATAR_DATA_VERSION = 3;

// ============================================================================
// IDENTITY HASH GENERATION (Must match canonical schema)
// ============================================================================
const CANONICAL_FIELDS = [
  'animal', 'class', 'combatStyle', 'definingMoment', 'formativeMemory',
  'lifePhilosophy', 'loreOrigin', 'mutant', 'mutate', 'name', 'occupation',
  'originStory', 'personality', 'powerSpike', 'race', 'signatureMove',
  'voiceLine', 'weakness',
];

async function generateIdentityHash(avatar: any): Promise<string> {
  // Build canonical JSON (alphabetical, trimmed, lowercase values)
  const canonical: any = {};
  for (const field of CANONICAL_FIELDS) {
    const val = avatar[field];
    canonical[field] = typeof val === 'string' ? val.trim().toLowerCase() : '';
  }
  
  const jsonStr = JSON.stringify(canonical);
  const prefixed = 'KV_AVATAR_V3:' + jsonStr;
  
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    prefixed
  );
  
  return hash;
}

// ============================================================================
// FAKE ANSWER GENERATOR (For memory quiz)
// ============================================================================
function generateFakeAnswers(correct: string, type: string, count = 19): string[] {
  const pools: Record<string, string[]> = {
    class: AVATAR_CLASSES,
    race: AVATAR_RACES,
    occupation: AVATAR_OCCUPATIONS,
    personality: AVATAR_PERSONALITIES,
    animal: AVATAR_ANIMALS,
    mutant: AVATAR_MUTANTS,
  };
  
  const pool = pools[type] || [];
  const filtered = pool.filter(x => x.toLowerCase() !== correct.toLowerCase());
  
  if (filtered.length >= count) {
    return filtered.sort(() => Math.random() - 0.5).slice(0, count);
  }
  
  // Generate generic fakes
  const generics = [
    'Shadow Strike', 'Lightning Bolt', 'Fire Breath', 'Ice Shield',
    'Dark Vision', 'Wind Walker', 'Earth Shaker', 'Water Dancer',
    'Soul Stealer', 'Mind Bender', 'Time Shifter', 'Void Walker',
    'Star Caller', 'Moon Singer', 'Sun Warrior', 'Storm Bringer',
    'Death Touch', 'Life Giver', 'Dream Weaver', 'Fate Spinner',
  ].filter(x => x.toLowerCase() !== correct.toLowerCase());
  
  return [...filtered, ...generics].slice(0, count);
}

// ============================================================================
// BUTTON GRID COMPONENT
// ============================================================================
interface ButtonGridProps {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  columns?: number;
}

const ButtonGrid: React.FC<ButtonGridProps> = ({ 
  options, 
  selected, 
  onSelect, 
  columns = 2 
}) => (
  <View style={[gridStyles.container, { flexWrap: 'wrap' }]}>
    {options.map((option) => (
      <TouchableOpacity
        key={option}
        style={[
          gridStyles.button,
          { width: `${100 / columns - 2}%` },
          selected === option && gridStyles.buttonSelected,
        ]}
        onPress={() => onSelect(option)}
        activeOpacity={0.7}
      >
        <Text style={[
          gridStyles.buttonText,
          selected === option && gridStyles.buttonTextSelected,
        ]}>
          {option}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

const gridStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: rs.s(8),
  },
  button: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 2,
    borderColor: COLORS.stone400,
    borderRadius: rs.s(12),
    padding: rs.s(12),
    marginBottom: rs.s(8),
    alignItems: 'center',
  },
  buttonSelected: {
    backgroundColor: COLORS.amber100,
    borderColor: COLORS.amber600,
  },
  buttonText: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.stone600,
  },
  buttonTextSelected: {
    color: COLORS.amber800,
  },
});

// ============================================================================
// QUIZ OPTION COMPONENT (20 options grid)
// ============================================================================
interface QuizOptionProps {
  options: string[];
  onSelect: (index: number) => void;
  disabled?: boolean;
}

const QuizOptions: React.FC<QuizOptionProps> = ({ options, onSelect, disabled }) => (
  <ScrollView style={quizStyles.optionsScroll} contentContainerStyle={quizStyles.optionsContainer}>
    {options.map((option, idx) => (
      <TouchableOpacity
        key={idx}
        style={quizStyles.optionButton}
        onPress={() => !disabled && onSelect(idx)}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Text style={quizStyles.optionText}>{option}</Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

const quizStyles = StyleSheet.create({
  optionsScroll: {
    maxHeight: rs.s(300),
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs.s(8),
    padding: rs.s(8),
  },
  optionButton: {
    width: '48%',
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.stone400,
    borderRadius: rs.s(8),
    padding: rs.s(10),
    alignItems: 'center',
  },
  optionText: {
    fontSize: rs.font(11),
    color: COLORS.stone800,
    textAlign: 'center',
  },
});

// ============================================================================
// MAIN ONBOARDING COMPONENT
// ============================================================================
interface OnboardingProps {
  onComplete: (data: { identityHash: string; avatar: any; score: number }) => void;
  onFail: (data: { reason: string; score: number }) => void;
  isReturningUser?: boolean;
  storedAvatarName?: string;
}

export const OnboardingScreen: React.FC<OnboardingProps> = ({
  onComplete,
  onFail,
  isReturningUser = false,
  storedAvatarName = '',
}) => {
  // Flow state
  const [step, setStep] = useState<'welcome' | 'avatar' | 'questions' | 'complete' | 'failed' | 'locked_out'>(
    isReturningUser ? 'questions' : 'welcome'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [avatarPage, setAvatarPage] = useState(1);
  
  // Quiz state
  const [session, setSession] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [timeLeft, setTimeLeft] = useState(QUIZ_TIME_LIMIT);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  
  // Lockout state
  const [failAttempts, setFailAttempts] = useState(0);
  const [lockoutEnd, setLockoutEnd] = useState(0);
  
  // Avatar state
  const [avatar, setAvatar] = useState({
    name: '',
    class: '',
    race: '',
    occupation: '',
    mutant: '',
    animal: '',
    mutate: '',
    personality: '',
    originStory: '',
    combatStyle: '',
    signatureMove: '',
    weakness: '',
    powerSpike: '',
    voiceLine: '',
    loreOrigin: '',
    formativeMemory: '',
    lifePhilosophy: '',
    definingMoment: '',
  });
  
  // Bot detection
  const [avatarStartTime] = useState(Date.now());
  const passThreshold = isReturningUser ? 1 : 4;
  const totalQuestions = isReturningUser ? 2 : 8;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  useEffect(() => {
    const init = async () => {
      // Load lockout state
      const storedFails = await SecureStore.getItemAsync('kv_onboard_fails');
      const storedLockout = await SecureStore.getItemAsync('kv_onboard_lockout');
      
      if (storedFails) setFailAttempts(parseInt(storedFails));
      if (storedLockout) setLockoutEnd(parseInt(storedLockout));
      
      if (isReturningUser) {
        // Load stored avatar for memory quiz
        const storedAvatarStr = await SecureStore.getItemAsync('kv_avatar_data');
        if (storedAvatarStr) {
          const storedAvatar = JSON.parse(storedAvatarStr);
          await generateMemoryQuiz(storedAvatar);
        } else {
          // No stored avatar, force new user flow
          setStep('welcome');
        }
      }
      
      setIsLoading(false);
    };
    
    init();
  }, [isReturningUser]);

  // ============================================================================
  // MEMORY QUIZ GENERATION
  // ============================================================================
  const generateMemoryQuiz = async (storedAvatar: any) => {
    const questions: any[] = [];
    
    // Q1: Name
    if (storedAvatar.name) {
      const fakeNames = ['Shadow', 'Phoenix', 'Storm', 'Blade', 'Luna', 'Raven', 'Nova', 'Frost']
        .filter(n => n.toLowerCase() !== storedAvatar.name.toLowerCase());
      const options = [storedAvatar.name, ...fakeNames.slice(0, 19)].sort(() => Math.random() - 0.5);
      questions.push({
        id: 'mem_name',
        question: "What is your avatar's name?",
        options,
        correct_index: options.indexOf(storedAvatar.name),
      });
    }
    
    // Q2: Class/Race/Occupation
    const secondaryFields = [
      { key: 'class', q: 'What class is your avatar?', pool: AVATAR_CLASSES },
      { key: 'race', q: 'What race is your avatar?', pool: AVATAR_RACES },
      { key: 'occupation', q: "What is your avatar's occupation?", pool: AVATAR_OCCUPATIONS },
    ];
    
    for (const field of secondaryFields) {
      if (questions.length >= 2) break;
      const value = storedAvatar[field.key];
      if (!value) continue;
      
      const fakes = field.pool.filter(x => x !== value).slice(0, 19);
      const options = [value, ...fakes].sort(() => Math.random() - 0.5);
      questions.push({
        id: `mem_${field.key}`,
        question: field.q,
        options,
        correct_index: options.indexOf(value),
      });
    }
    
    if (questions.length < 1) {
      setStep('welcome');
      return;
    }
    
    setSession({
      session_id: `return_${Date.now()}`,
      questions,
      started_at: Date.now(),
      time_limit_seconds: QUIZ_TIME_LIMIT,
    });
  };

  // ============================================================================
  // QUIZ TIMER
  // ============================================================================
  useEffect(() => {
    if (step !== 'questions' || !session) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleQuizTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [step, session]);

  const handleQuizTimeout = () => {
    setStep('failed');
  };

  // ============================================================================
  // QUIZ ANSWER HANDLER
  // ============================================================================
  const handleAnswer = (selectedIndex: number) => {
    if (!session || currentIndex >= session.questions.length) return;
    
    const question = session.questions[currentIndex];
    const isCorrect = selectedIndex === question.correct_index;
    
    if (isCorrect) {
      const newScore = score + 1;
      setScore(newScore);
      scoreRef.current = newScore;
      setFeedback('correct');
    } else {
      setFeedback('wrong');
    }
    
    setTimeout(() => {
      setFeedback(null);
      if (currentIndex + 1 < session.questions.length) {
        setCurrentIndex(currentIndex + 1);
      } else {
        finishOnboarding();
      }
    }, 500);
  };

  // ============================================================================
  // AVATAR UPDATE
  // ============================================================================
  const updateAvatar = (field: string, value: string) => {
    setAvatar(prev => ({ ...prev, [field]: value }));
  };

  // ============================================================================
  // FINISH ONBOARDING
  // ============================================================================
  const finishOnboarding = async () => {
    const quizPassed = scoreRef.current >= passThreshold;
    const totalAvatarTime = Date.now() - avatarStartTime;
    const notABot = totalAvatarTime > 500;
    
    const didPass = quizPassed && notABot;
    
    if (didPass) {
      // Success
      await SecureStore.deleteItemAsync('kv_onboard_fails');
      await SecureStore.deleteItemAsync('kv_onboard_lockout');
      
      const identityHash = await generateIdentityHash(avatar);
      
      await SecureStore.setItemAsync('kv_identity_hash', identityHash);
      await SecureStore.setItemAsync('kv_verified', 'true');
      await SecureStore.setItemAsync('kv_verified_at', Date.now().toString());
      await SecureStore.setItemAsync('kv_avatar_name', avatar.name || 'Villager');
      await SecureStore.setItemAsync('kv_avatar_data', JSON.stringify({
        ...avatar,
        _version: AVATAR_DATA_VERSION,
      }));
      
      setStep('complete');
      
      setTimeout(() => {
        onComplete({ identityHash, avatar, score: scoreRef.current });
      }, 1500);
    } else {
      // Failure
      const newFails = failAttempts + 1;
      setFailAttempts(newFails);
      await SecureStore.setItemAsync('kv_onboard_fails', newFails.toString());
      
      if (newFails >= ONBOARDING_MAX_ATTEMPTS) {
        const lockTime = Date.now() + ONBOARDING_LOCKOUT_DURATION;
        await SecureStore.setItemAsync('kv_onboard_lockout', lockTime.toString());
        setLockoutEnd(lockTime);
        setStep('locked_out');
        
        setTimeout(() => {
          onFail({ reason: 'locked_out', score: scoreRef.current });
        }, 2000);
      } else {
        setStep('failed');
      }
    }
  };

  // ============================================================================
  // TRY AGAIN HANDLER
  // ============================================================================
  const handleTryAgain = () => {
    setScore(0);
    scoreRef.current = 0;
    setAvatarPage(1);
    setCurrentIndex(0);
    setSession(null);
    setFeedback(null);
    setTimeLeft(QUIZ_TIME_LIMIT);
    setAvatar({
      name: '', class: '', race: '', occupation: '', mutant: '', animal: '',
      mutate: '', personality: '', originStory: '', combatStyle: '',
      signatureMove: '', weakness: '', powerSpike: '', voiceLine: '',
      loreOrigin: '', formativeMemory: '', lifePhilosophy: '', definingMoment: '',
    });
    setStep('welcome');
  };

  // ============================================================================
  // LOADING SCREEN
  // ============================================================================
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.amber600} />
        <Text style={styles.loadingTitle}>
          {isReturningUser ? 'Welcome Back!' : 'Entering the Village...'}
        </Text>
        <Text style={styles.loadingSubtitle}>
          {isReturningUser ? 'Quick verification' : 'Preparing your apartment application'}
        </Text>
      </View>
    );
  }

  // ============================================================================
  // LOCKOUT SCREEN
  // ============================================================================
  if (step === 'locked_out') {
    const remainingMs = Math.max(0, lockoutEnd - Date.now());
    const remainingMin = Math.ceil(remainingMs / 60000);
    
    return (
      <View style={styles.lockoutContainer}>
        <View style={styles.lockoutCard}>
          <Clock size={rs.s(64)} color={COLORS.red600} />
          <Text style={styles.lockoutTitle}>Account Locked</Text>
          <Text style={styles.lockoutText}>
            Too many failed attempts. Please wait {remainingMin} minutes.
          </Text>
        </View>
      </View>
    );
  }

  // ============================================================================
  // FAILED SCREEN
  // ============================================================================
  if (step === 'failed') {
    return (
      <View style={styles.failedContainer}>
        <View style={styles.failedCard}>
          <AlertTriangle size={rs.s(64)} color={COLORS.red600} />
          <Text style={styles.failedTitle}>Verification Failed</Text>
          <Text style={styles.failedText}>Your identity check did not pass.</Text>
          
          <View style={styles.tipsBox}>
            <Text style={styles.tipsTitle}>💡 Tips for next attempt:</Text>
            <Text style={styles.tipText}>• Answer based on YOUR avatar choices</Text>
            <Text style={styles.tipText}>• Read each question carefully</Text>
            <Text style={styles.tipText}>• Find your answer among the 20 options</Text>
          </View>
          
          <View style={styles.attemptsBox}>
            <Text style={styles.attemptsText}>
              {ONBOARDING_MAX_ATTEMPTS - failAttempts} attempt(s) remaining
            </Text>
          </View>
          
          <TouchableOpacity style={styles.retryButton} onPress={handleTryAgain}>
            <Text style={styles.retryButtonText}>🔄 Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ============================================================================
  // COMPLETE SCREEN
  // ============================================================================
  if (step === 'complete') {
    return (
      <View style={styles.completeContainer}>
        <View style={styles.completeCard}>
          <Check size={rs.s(80)} color={COLORS.green500} />
          <Text style={styles.completeTitle}>Welcome to the Village!</Text>
          <Text style={styles.completeText}>
            {avatar.name || 'Villager'}, your apartment is ready.
          </Text>
          <ActivityIndicator color={COLORS.amber600} style={{ marginTop: rs.s(16) }} />
        </View>
      </View>
    );
  }

  // ============================================================================
  // WELCOME SCREEN (Knicks Theme)
  // ============================================================================
  if (step === 'welcome') {
    return (
      <View style={styles.welcomeContainer}>
        {/* Decorative circles */}
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
        
        <View style={styles.welcomeContent}>
          {/* Title */}
          <Text style={styles.welcomeTitle}>KasVillage</Text>
          <Text style={styles.welcomeSubtitle}>AKA "THE VILL"</Text>
          
          <Text style={styles.welcomeDesc}>
            Create your avatar to join the decentralized marketplace
          </Text>
          
          {/* Features */}
          <View style={styles.featuresBox}>
            <Text style={styles.featureText}>🏠 Your own apartment</Text>
            <Text style={styles.featureText}>🛍️ Build your storefront</Text>
            <Text style={styles.featureText}>💸 Zero-fee P2P payments</Text>
            <Text style={styles.featureText}>🔐 Non-custodial wallet</Text>
          </View>
          
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => setStep('avatar')}
            activeOpacity={0.8}
          >
            <Text style={styles.startButtonText}>Enter The Vill</Text>
            <ChevronRight size={rs.s(24)} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ============================================================================
  // AVATAR CREATION SCREENS
  // ============================================================================
  if (step === 'avatar') {
    return (
      <ScrollView style={styles.avatarContainer} contentContainerStyle={styles.avatarContent}>
        <View style={styles.avatarHeader}>
          <Text style={styles.avatarTitle}>Create Your Avatar</Text>
          <Text style={styles.avatarSubtitle}>Page {avatarPage} of 4</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(avatarPage / 4) * 100}%` }]} />
          </View>
        </View>
        
        {/* PAGE 1: Basic Identity */}
        {avatarPage === 1 && (
          <View style={styles.avatarSection}>
            <Text style={styles.sectionTitle}>👤 Basic Identity</Text>
            
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.textInput}
              value={avatar.name}
              onChangeText={(v) => updateAvatar('name', v)}
              placeholder="Enter your avatar's name..."
              placeholderTextColor={COLORS.stone400}
              maxLength={30}
            />
            
            <Text style={styles.fieldLabel}>Class</Text>
            <ButtonGrid
              options={AVATAR_CLASSES.slice(0, 8)}
              selected={avatar.class}
              onSelect={(v) => updateAvatar('class', v)}
              columns={4}
            />
            
            <Text style={styles.fieldLabel}>Race</Text>
            <ButtonGrid
              options={AVATAR_RACES.slice(0, 8)}
              selected={avatar.race}
              onSelect={(v) => updateAvatar('race', v)}
              columns={4}
            />
          </View>
        )}
        
        {/* PAGE 2: Background */}
        {avatarPage === 2 && (
          <View style={styles.avatarSection}>
            <Text style={styles.sectionTitle}>📜 Background</Text>
            
            <Text style={styles.fieldLabel}>Occupation</Text>
            <ButtonGrid
              options={AVATAR_OCCUPATIONS.slice(0, 8)}
              selected={avatar.occupation}
              onSelect={(v) => updateAvatar('occupation', v)}
              columns={4}
            />
            
            <Text style={styles.fieldLabel}>Personality</Text>
            <ButtonGrid
              options={AVATAR_PERSONALITIES.slice(0, 8)}
              selected={avatar.personality}
              onSelect={(v) => updateAvatar('personality', v)}
              columns={4}
            />
            
            <Text style={styles.fieldLabel}>Spirit Animal</Text>
            <ButtonGrid
              options={AVATAR_ANIMALS.slice(0, 8)}
              selected={avatar.animal}
              onSelect={(v) => updateAvatar('animal', v)}
              columns={4}
            />
          </View>
        )}
        
        {/* PAGE 3: Powers */}
        {avatarPage === 3 && (
          <View style={styles.avatarSection}>
            <Text style={styles.sectionTitle}>⚡ Powers & Abilities</Text>
            
            <Text style={styles.fieldLabel}>Mutant Power</Text>
            <ButtonGrid
              options={AVATAR_MUTANTS.slice(0, 8)}
              selected={avatar.mutant}
              onSelect={(v) => updateAvatar('mutant', v)}
              columns={2}
            />
            
            <Text style={styles.fieldLabel}>Combat Style</Text>
            <TextInput
              style={styles.textInput}
              value={avatar.combatStyle}
              onChangeText={(v) => updateAvatar('combatStyle', v)}
              placeholder="Describe your fighting style..."
              placeholderTextColor={COLORS.stone400}
              maxLength={50}
            />
            
            <Text style={styles.fieldLabel}>Signature Move</Text>
            <TextInput
              style={styles.textInput}
              value={avatar.signatureMove}
              onChangeText={(v) => updateAvatar('signatureMove', v)}
              placeholder="Your ultimate technique..."
              placeholderTextColor={COLORS.stone400}
              maxLength={50}
            />
          </View>
        )}
        
        {/* PAGE 4: Story */}
        {avatarPage === 4 && (
          <View style={styles.avatarSection}>
            <Text style={styles.sectionTitle}>📖 Your Story</Text>
            
            <Text style={styles.fieldLabel}>Weakness</Text>
            <TextInput
              style={styles.textInput}
              value={avatar.weakness}
              onChangeText={(v) => updateAvatar('weakness', v)}
              placeholder="Everyone has a weakness..."
              placeholderTextColor={COLORS.stone400}
              maxLength={50}
            />
            
            <Text style={styles.fieldLabel}>Voice Line</Text>
            <TextInput
              style={styles.textInput}
              value={avatar.voiceLine}
              onChangeText={(v) => updateAvatar('voiceLine', v)}
              placeholder="Your catchphrase..."
              placeholderTextColor={COLORS.stone400}
              maxLength={100}
            />
            
            <Text style={styles.fieldLabel}>Origin Story</Text>
            <TextInput
              style={[styles.textInput, { height: rs.s(80) }]}
              value={avatar.originStory}
              onChangeText={(v) => updateAvatar('originStory', v)}
              placeholder="How did you become who you are?"
              placeholderTextColor={COLORS.stone400}
              multiline
              maxLength={200}
            />
          </View>
        )}
        
        {/* Navigation */}
        <View style={styles.avatarNav}>
          {avatarPage > 1 && (
            <TouchableOpacity
              style={styles.navButtonSecondary}
              onPress={() => setAvatarPage(avatarPage - 1)}
            >
              <Text style={styles.navButtonSecondaryText}>← Back</Text>
            </TouchableOpacity>
          )}
          
          {avatarPage < 4 ? (
            <TouchableOpacity
              style={styles.navButtonPrimary}
              onPress={() => setAvatarPage(avatarPage + 1)}
            >
              <Text style={styles.navButtonPrimaryText}>Next →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navButtonPrimary, { backgroundColor: COLORS.green500 }]}
              onPress={() => {
                // Generate quiz and proceed
                const questions = generateNewUserQuiz();
                setSession({
                  session_id: `new_${Date.now()}`,
                  questions,
                  started_at: Date.now(),
                  time_limit_seconds: QUIZ_TIME_LIMIT,
                });
                setStep('questions');
              }}
            >
              <Text style={styles.navButtonPrimaryText}>Complete Avatar ✓</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    );
  }

  // Generate quiz for new users based on their avatar
  const generateNewUserQuiz = () => {
    const questions: any[] = [];
    
    // Create questions from avatar fields
    const fields = [
      { key: 'name', q: "What name did you give your avatar?", type: 'name' },
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
      if (field.pool) {
        fakes = field.pool.filter(x => x !== value).slice(0, 19);
      } else {
        fakes = generateFakeAnswers(value, field.type || field.key, 19);
      }
      
      const options = [value, ...fakes].sort(() => Math.random() - 0.5);
      questions.push({
        id: `quiz_${field.key}`,
        question: field.q,
        options,
        correct_index: options.indexOf(value),
      });
    }
    
    return questions.slice(0, 8);
  };

  // ============================================================================
  // QUIZ SCREEN
  // ============================================================================
  if (step === 'questions' && session) {
    const currentQuestion = session.questions[currentIndex];
    
    return (
      <View style={styles.quizContainer}>
        {/* Timer */}
        <View style={styles.timerBar}>
          <Clock size={rs.s(16)} color={timeLeft < 10 ? COLORS.red600 : COLORS.amber600} />
          <Text style={[
            styles.timerText,
            timeLeft < 10 && { color: COLORS.red600 }
          ]}>
            {timeLeft}s
          </Text>
        </View>
        
        {/* Progress */}
        <View style={styles.quizProgress}>
          <Text style={styles.quizProgressText}>
            Question {currentIndex + 1} of {session.questions.length}
          </Text>
          <Text style={styles.quizScore}>Score: {score}</Text>
        </View>
        
        {/* Question */}
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>
        </View>
        
        {/* Feedback */}
        {feedback && (
          <View style={[
            styles.feedbackBanner,
            feedback === 'correct' ? styles.feedbackCorrect : styles.feedbackWrong
          ]}>
            <Text style={styles.feedbackText}>
              {feedback === 'correct' ? '✓ Correct!' : '✗ Wrong'}
            </Text>
          </View>
        )}
        
        {/* Options */}
        <QuizOptions
          options={currentQuestion.options}
          onSelect={handleAnswer}
          disabled={!!feedback}
        />
      </View>
    );
  }

  return null;
};

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  // Loading
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.stone900,
    justifyContent: 'center',
    alignItems: 'center',
    padding: rs.s(24),
  },
  loadingTitle: {
    fontSize: rs.font(20),
    fontWeight: 'bold',
    color: COLORS.white,
    marginTop: rs.s(16),
  },
  loadingSubtitle: {
    fontSize: rs.font(14),
    color: COLORS.stone400,
    marginTop: rs.s(8),
  },
  
  // Lockout
  lockoutContainer: {
    flex: 1,
    backgroundColor: 'rgba(127, 29, 29, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: rs.s(24),
  },
  lockoutCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: rs.s(16),
    padding: rs.s(32),
    alignItems: 'center',
    maxWidth: rs.s(320),
  },
  lockoutTitle: {
    fontSize: rs.font(24),
    fontWeight: '900',
    color: COLORS.red600,
    marginTop: rs.s(16),
  },
  lockoutText: {
    fontSize: rs.font(14),
    color: COLORS.stone600,
    textAlign: 'center',
    marginTop: rs.s(8),
  },
  
  // Failed
  failedContainer: {
    flex: 1,
    backgroundColor: 'rgba(127, 29, 29, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: rs.s(24),
  },
  failedCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: rs.s(16),
    padding: rs.s(24),
    alignItems: 'center',
    maxWidth: rs.s(340),
  },
  failedTitle: {
    fontSize: rs.font(24),
    fontWeight: '900',
    color: COLORS.stone800,
    marginTop: rs.s(16),
  },
  failedText: {
    fontSize: rs.font(14),
    color: COLORS.stone600,
    marginTop: rs.s(8),
  },
  tipsBox: {
    backgroundColor: COLORS.blue50,
    borderWidth: 1,
    borderColor: COLORS.blue200,
    borderRadius: rs.s(12),
    padding: rs.s(12),
    marginTop: rs.s(16),
    width: '100%',
  },
  tipsTitle: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.blue800,
    marginBottom: rs.s(4),
  },
  tipText: {
    fontSize: rs.font(11),
    color: COLORS.blue700,
    marginTop: rs.s(2),
  },
  attemptsBox: {
    backgroundColor: COLORS.amber100,
    borderRadius: rs.s(12),
    padding: rs.s(12),
    marginTop: rs.s(12),
    width: '100%',
    alignItems: 'center',
  },
  attemptsText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.amber800,
  },
  retryButton: {
    backgroundColor: COLORS.blue600,
    borderRadius: rs.s(12),
    padding: rs.s(16),
    marginTop: rs.s(16),
    width: '100%',
    alignItems: 'center',
  },
  retryButtonText: {
    fontSize: rs.font(16),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  
  // Complete
  completeContainer: {
    flex: 1,
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: rs.s(24),
  },
  completeCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: rs.s(16),
    padding: rs.s(32),
    alignItems: 'center',
    maxWidth: rs.s(320),
  },
  completeTitle: {
    fontSize: rs.font(24),
    fontWeight: '900',
    color: COLORS.stone800,
    marginTop: rs.s(16),
  },
  completeText: {
    fontSize: rs.font(14),
    color: COLORS.stone600,
    textAlign: 'center',
    marginTop: rs.s(8),
  },
  
  // Welcome
  welcomeContainer: {
    flex: 1,
    backgroundColor: COLORS.knickBlue,
    justifyContent: 'center',
    alignItems: 'center',
    padding: rs.s(24),
  },
  decorCircle1: {
    position: 'absolute',
    top: rs.s(40),
    left: rs.s(40),
    width: rs.s(80),
    height: rs.s(80),
    borderRadius: rs.s(40),
    borderWidth: 8,
    borderColor: COLORS.knickOrange,
    opacity: 0.2,
  },
  decorCircle2: {
    position: 'absolute',
    bottom: rs.s(80),
    right: rs.s(40),
    width: rs.s(120),
    height: rs.s(120),
    borderRadius: rs.s(60),
    backgroundColor: COLORS.knickOrange,
    opacity: 0.1,
  },
  welcomeContent: {
    alignItems: 'center',
    zIndex: 10,
  },
  welcomeTitle: {
    fontSize: rs.font(56),
    fontWeight: '900',
    color: COLORS.knickOrange,
    textShadowColor: COLORS.white,
    textShadowOffset: { width: 4, height: 4 },
    textShadowRadius: 0,
    transform: [{ rotate: '-2deg' }],
  },
  welcomeSubtitle: {
    fontSize: rs.font(24),
    fontWeight: '900',
    color: COLORS.white,
    marginTop: rs.s(8),
    transform: [{ rotate: '1deg' }],
  },
  welcomeDesc: {
    fontSize: rs.font(14),
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: rs.s(24),
    maxWidth: rs.s(280),
  },
  featuresBox: {
    marginTop: rs.s(32),
    gap: rs.s(8),
  },
  featureText: {
    fontSize: rs.font(14),
    color: COLORS.white,
    fontWeight: 'bold',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.knickOrange,
    paddingVertical: rs.s(16),
    paddingHorizontal: rs.s(32),
    borderRadius: rs.s(16),
    marginTop: rs.s(40),
    gap: rs.s(8),
  },
  startButtonText: {
    fontSize: rs.font(18),
    fontWeight: '900',
    color: COLORS.white,
  },
  
  // Avatar
  avatarContainer: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
  },
  avatarContent: {
    padding: rs.s(24),
    paddingBottom: rs.s(100),
  },
  avatarHeader: {
    marginBottom: rs.s(24),
  },
  avatarTitle: {
    fontSize: rs.font(24),
    fontWeight: '900',
    color: COLORS.stone800,
  },
  avatarSubtitle: {
    fontSize: rs.font(14),
    color: COLORS.stone500,
    marginTop: rs.s(4),
  },
  progressBar: {
    height: rs.s(4),
    backgroundColor: COLORS.stone200,
    borderRadius: rs.s(2),
    marginTop: rs.s(12),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.amber600,
  },
  avatarSection: {
    marginBottom: rs.s(24),
  },
  sectionTitle: {
    fontSize: rs.font(18),
    fontWeight: 'bold',
    color: COLORS.amber800,
    marginBottom: rs.s(16),
  },
  fieldLabel: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.stone600,
    textTransform: 'uppercase',
    marginBottom: rs.s(8),
    marginTop: rs.s(16),
  },
  textInput: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.stone200,
    borderRadius: rs.s(12),
    padding: rs.s(12),
    fontSize: rs.font(14),
    color: COLORS.stone800,
  },
  avatarNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: rs.s(24),
    gap: rs.s(12),
  },
  navButtonSecondary: {
    flex: 1,
    backgroundColor: COLORS.stone200,
    padding: rs.s(16),
    borderRadius: rs.s(12),
    alignItems: 'center',
  },
  navButtonSecondaryText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.stone600,
  },
  navButtonPrimary: {
    flex: 2,
    backgroundColor: COLORS.amber600,
    padding: rs.s(16),
    borderRadius: rs.s(12),
    alignItems: 'center',
  },
  navButtonPrimaryText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  
  // Quiz
  quizContainer: {
    flex: 1,
    backgroundColor: COLORS.stone900,
    padding: rs.s(16),
  },
  timerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs.s(8),
    padding: rs.s(12),
    backgroundColor: COLORS.stone800,
    borderRadius: rs.s(12),
  },
  timerText: {
    fontSize: rs.font(18),
    fontWeight: 'bold',
    color: COLORS.amber600,
  },
  quizProgress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: rs.s(16),
  },
  quizProgressText: {
    fontSize: rs.font(14),
    color: COLORS.stone400,
  },
  quizScore: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.green500,
  },
  questionCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: rs.s(16),
    padding: rs.s(20),
    marginTop: rs.s(16),
  },
  questionText: {
    fontSize: rs.font(18),
    fontWeight: 'bold',
    color: COLORS.stone800,
    textAlign: 'center',
  },
  feedbackBanner: {
    padding: rs.s(12),
    borderRadius: rs.s(8),
    marginTop: rs.s(12),
    alignItems: 'center',
  },
  feedbackCorrect: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  feedbackWrong: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
  },
  feedbackText: {
    fontSize: rs.font(16),
    fontWeight: 'bold',
    color: COLORS.white,
  },
});

export default OnboardingScreen;