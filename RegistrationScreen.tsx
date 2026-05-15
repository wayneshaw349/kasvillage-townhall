// ============================================================================
// KASVILLAGE EXPO - REGISTRATION SCREEN
// ============================================================================
// Full registration flow:
// 1. Generate wallet locally
// 2. Device attestation
// 3. Town Hall assigns APT (after avatar complete)
// 4. Post to Arweave
// 5. Begin onboarding
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  PixelRatio,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import {
  Shield,
  Key,
  Home,
  Upload,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Lock,
  Smartphone,
} from 'lucide-react-native';

import {
  createWallet,
  generateDeviceAttestation,
  getRegistrationData,
  RegistrationStatus,
} from './wallet_registration_v2';

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
  background: '#0a0a0a',
  cardBg: '#FFF8F0',
  white: '#FFFFFF',
  black: '#000000',
  
  stone50: '#fafaf9',
  stone100: '#f5f5f4',
  stone200: '#e7e5e4',
  stone300: '#d6d3d1',
  stone400: '#a8a29e',
  stone500: '#78716c',
  stone600: '#57534e',
  stone700: '#44403c',
  stone800: '#292524',
  stone900: '#1c1917',
  
  amber500: '#f59e0b',
  amber600: '#d97706',
  amber700: '#b45309',
  
  green500: '#22c55e',
  green600: '#16a34a',
  
  red500: '#ef4444',
  red600: '#dc2626',
  
  indigo500: '#6366f1',
  indigo600: '#4f46e5',
  
  knicks: {
    orange: '#F58426',
    blue: '#006BB6',
  },
};

// ============================================================================
// TYPES
// ============================================================================
interface RegistrationScreenProps {
  onComplete: () => void;
}

type RegistrationStep = 
  | 'welcome'
  | 'generating'
  | 'wallet_created'
  | 'attesting'
  | 'attested'
  | 'error';

// ============================================================================
// PIXEL BACKGROUND
// ============================================================================
const PixelBackground: React.FC = () => {
  const pixelSize = rs.s(8);
  const cols = Math.ceil(SCREEN_WIDTH / pixelSize);
  const rows = Math.ceil(SCREEN_HEIGHT / pixelSize);
  
  const pixels = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const isDark = (x + y) % 3 === 0;
      pixels.push(
        <Rect
          key={`${x}-${y}`}
          x={x * pixelSize}
          y={y * pixelSize}
          width={pixelSize}
          height={pixelSize}
          fill={isDark ? '#0f0f0f' : '#0a0a0a'}
        />
      );
    }
  }
  
  return (
    <Svg
      width={SCREEN_WIDTH}
      height={SCREEN_HEIGHT}
      style={StyleSheet.absoluteFill}
    >
      {pixels}
      <Defs>
        <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={COLORS.knicks.blue} stopOpacity="0.1" />
          <Stop offset="0.5" stopColor={COLORS.background} stopOpacity="0.8" />
          <Stop offset="1" stopColor={COLORS.knicks.orange} stopOpacity="0.1" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="url(#grad)" />
    </Svg>
  );
};

// ============================================================================
// STEP INDICATOR
// ============================================================================
const StepIndicator: React.FC<{
  currentStep: number;
  totalSteps: number;
  labels: string[];
}> = ({ currentStep, totalSteps, labels }) => {
  return (
    <View style={styles.stepIndicator}>
      {labels.map((label, index) => (
        <View key={index} style={styles.stepItem}>
          <View
            style={[
              styles.stepDot,
              index < currentStep && styles.stepDotComplete,
              index === currentStep && styles.stepDotActive,
            ]}
          >
            {index < currentStep ? (
              <CheckCircle size={rs.s(14)} color={COLORS.white} />
            ) : (
              <Text style={styles.stepNumber}>{index + 1}</Text>
            )}
          </View>
          <Text
            style={[
              styles.stepLabel,
              index <= currentStep && styles.stepLabelActive,
            ]}
          >
            {label}
          </Text>
          {index < totalSteps - 1 && (
            <View
              style={[
                styles.stepLine,
                index < currentStep && styles.stepLineComplete,
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export const RegistrationScreen: React.FC<RegistrationScreenProps> = ({
  onComplete,
}) => {
  const [step, setStep] = useState<RegistrationStep>('welcome');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kaspaAddress, setKaspaAddress] = useState<string | null>(null);
  const [deviceAttested, setDeviceAttested] = useState(false);
  
  // Check existing registration on mount
  useEffect(() => {
    const checkExisting = async () => {
      const data = await getRegistrationData();
      if (data) {
        setKaspaAddress(data.kaspaAddress);
        
        switch (data.registrationStatus) {
          case 'registered':
          case 'apt_assigned':
            // Already done, go to main app
            onComplete();
            break;
          case 'wallet_created':
          case 'attestation_sent':
            setStep('wallet_created');
            break;
        }
      }
    };
    checkExisting();
  }, []);
  
  // Step 1: Generate wallet locally
  const handleGenerateWallet = async () => {
    setStep('generating');
    setIsLoading(true);
    setError(null);
    
    const result = await createWallet();
    
    setIsLoading(false);
    
    if (result.success && result.kaspaAddress) {
      setKaspaAddress(result.kaspaAddress);
      setStep('wallet_created');
    } else {
      setError(result.error || 'Failed to generate wallet');
      setStep('error');
    }
  };
  
  // Step 2: Device attestation (prepares for later APT assignment)
  const handleAttestation = async () => {
    setStep('attesting');
    setIsLoading(true);
    setError(null);
    
    const result = await generateDeviceAttestation();
    
    setIsLoading(false);
    
    if (result.success) {
      setDeviceAttested(true);
      setStep('attested');
    } else {
      setError(result.error || 'Device attestation failed');
      setStep('error');
    }
  };
  
  // Get current step number for indicator
  const getStepNumber = (): number => {
    switch (step) {
      case 'welcome':
      case 'generating':
        return 0;
      case 'wallet_created':
      case 'attesting':
        return 1;
      case 'attested':
        return 2;
      default:
        return 0;
    }
  };
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <PixelBackground />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>🏘️</Text>
        <Text style={styles.title}>KasVillage</Text>
        <Text style={styles.subtitle}>Decentralized Marketplace</Text>
      </View>
      
      {/* Step Indicator */}
      <StepIndicator
        currentStep={getStepNumber()}
        totalSteps={3}
        labels={['Wallet', 'Verify', 'Avatar']}
      />
      
      {/* Content */}
      <View style={styles.content}>
        {/* Welcome */}
        {step === 'welcome' && (
          <View style={styles.stepContent}>
            <View style={styles.iconCircle}>
              <Key size={rs.s(48)} color={COLORS.amber600} />
            </View>
            <Text style={styles.stepTitle}>Create Your Wallet</Text>
            <Text style={styles.stepDesc}>
              Your private keys are generated on your phone and never leave your device.
              This is a non-custodial wallet — you own your keys.
            </Text>
            
            <View style={styles.infoBox}>
              <Lock size={rs.s(16)} color={COLORS.indigo500} />
              <Text style={styles.infoText}>
                Keys are protected by biometric authentication and your device's secure enclave.
              </Text>
            </View>
            
            <TouchableOpacity style={styles.primaryBtn} onPress={handleGenerateWallet}>
              <Text style={styles.primaryBtnText}>Generate Wallet</Text>
              <ChevronRight size={rs.s(20)} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        )}
        
        {/* Generating */}
        {step === 'generating' && (
          <View style={styles.stepContent}>
            <ActivityIndicator size="large" color={COLORS.amber500} />
            <Text style={styles.loadingText}>Generating secure keys...</Text>
            <Text style={styles.loadingSubtext}>
              Creating secp256k1 keypair locally
            </Text>
          </View>
        )}
        
        {/* Wallet Created */}
        {step === 'wallet_created' && (
          <View style={styles.stepContent}>
            <View style={styles.iconCircle}>
              <Shield size={rs.s(48)} color={COLORS.indigo600} />
            </View>
            <Text style={styles.stepTitle}>Verify Your Device</Text>
            <Text style={styles.stepDesc}>
              We verify your device to ensure one wallet per device.
              Your APT will be assigned after you complete your avatar.
            </Text>
            
            {kaspaAddress && (
              <View style={styles.addressBox}>
                <Text style={styles.addressLabel}>Your Kaspa Address</Text>
                <Text style={styles.addressValue} numberOfLines={2}>
                  {kaspaAddress}
                </Text>
              </View>
            )}
            
            <View style={styles.infoBox}>
              <Smartphone size={rs.s(16)} color={COLORS.indigo500} />
              <Text style={styles.infoText}>
                Device attestation uses Apple App Attest or Google Play Integrity.
              </Text>
            </View>
            
            <TouchableOpacity style={styles.primaryBtn} onPress={handleAttestation}>
              <Text style={styles.primaryBtnText}>Verify Device</Text>
              <ChevronRight size={rs.s(20)} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        )}
        
        {/* Attesting */}
        {step === 'attesting' && (
          <View style={styles.stepContent}>
            <ActivityIndicator size="large" color={COLORS.amber500} />
            <Text style={styles.loadingText}>Verifying device...</Text>
            <Text style={styles.loadingSubtext}>
              Checking device integrity
            </Text>
          </View>
        )}
        
        {/* Attested - Ready for Avatar */}
        {step === 'attested' && (
          <View style={styles.stepContent}>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.green500 + '30' }]}>
              <CheckCircle size={rs.s(48)} color={COLORS.green500} />
            </View>
            <Text style={styles.stepTitle}>Device Verified!</Text>
            <Text style={styles.stepDesc}>
              Your device is verified. Now create your avatar (9 traits minimum)
              to receive your APT number and join the village.
            </Text>
            
            {kaspaAddress && (
              <View style={styles.addressBox}>
                <Text style={styles.addressLabel}>Your Kaspa Address</Text>
                <Text style={styles.addressValue} numberOfLines={2}>
                  {kaspaAddress}
                </Text>
              </View>
            )}
            
            <View style={styles.infoBox}>
              <Home size={rs.s(16)} color={COLORS.green500} />
              <Text style={styles.infoText}>
                Complete 9 traits to buy, 13 traits to sell. Your APT will be assigned on completion.
              </Text>
            </View>
            
            <TouchableOpacity style={styles.primaryBtn} onPress={onComplete}>
              <Text style={styles.primaryBtnText}>Create Avatar</Text>
              <ChevronRight size={rs.s(20)} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        )}
        
        {/* Error */}
        {step === 'error' && (
          <View style={styles.stepContent}>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.red500 + '30' }]}>
              <AlertTriangle size={rs.s(48)} color={COLORS.red500} />
            </View>
            <Text style={styles.errorTitle}>Registration Failed</Text>
            <Text style={styles.errorText}>{error}</Text>
            
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setStep('welcome')}
            >
              <Text style={styles.secondaryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Non-custodial • One APT per device • Verified on Arweave
        </Text>
      </View>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: rs.s(80),
    paddingBottom: rs.s(20),
  },
  logo: {
    fontSize: rs.font(56),
    marginBottom: rs.s(8),
  },
  title: {
    fontSize: rs.font(32),
    fontWeight: '900',
    color: COLORS.white,
  },
  subtitle: {
    fontSize: rs.font(14),
    color: COLORS.stone400,
    marginTop: rs.s(4),
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: rs.s(20),
    marginBottom: rs.s(30),
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: rs.s(28),
    height: rs.s(28),
    borderRadius: rs.s(14),
    backgroundColor: COLORS.stone700,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: rs.s(6),
  },
  stepDotActive: {
    backgroundColor: COLORS.amber600,
  },
  stepDotComplete: {
    backgroundColor: COLORS.green500,
  },
  stepNumber: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.stone400,
  },
  stepLabel: {
    fontSize: rs.font(10),
    color: COLORS.stone500,
  },
  stepLabelActive: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  stepLine: {
    position: 'absolute',
    top: rs.s(14),
    right: -rs.s(30),
    width: rs.s(60),
    height: 2,
    backgroundColor: COLORS.stone700,
  },
  stepLineComplete: {
    backgroundColor: COLORS.green500,
  },
  content: {
    flex: 1,
    paddingHorizontal: rs.s(24),
  },
  stepContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: rs.s(100),
    height: rs.s(100),
    borderRadius: rs.s(50),
    backgroundColor: COLORS.amber600 + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: rs.s(24),
  },
  stepTitle: {
    fontSize: rs.font(24),
    fontWeight: '900',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: rs.s(12),
  },
  stepDesc: {
    fontSize: rs.font(14),
    color: COLORS.stone400,
    textAlign: 'center',
    lineHeight: rs.font(22),
    marginBottom: rs.s(24),
    paddingHorizontal: rs.s(10),
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(10),
    backgroundColor: COLORS.stone800,
    borderRadius: rs.s(12),
    padding: rs.s(14),
    marginBottom: rs.s(24),
    width: '100%',
  },
  infoText: {
    flex: 1,
    fontSize: rs.font(12),
    color: COLORS.stone300,
  },
  addressBox: {
    backgroundColor: COLORS.stone800,
    borderRadius: rs.s(12),
    padding: rs.s(16),
    width: '100%',
    marginBottom: rs.s(16),
  },
  addressLabel: {
    fontSize: rs.font(10),
    color: COLORS.stone500,
    marginBottom: rs.s(6),
  },
  addressValue: {
    fontSize: rs.font(11),
    fontFamily: 'monospace',
    color: COLORS.amber500,
  },
  loadingText: {
    fontSize: rs.font(18),
    fontWeight: 'bold',
    color: COLORS.white,
    marginTop: rs.s(24),
  },
  loadingSubtext: {
    fontSize: rs.font(13),
    color: COLORS.stone500,
    marginTop: rs.s(8),
  },
  errorTitle: {
    fontSize: rs.font(22),
    fontWeight: '900',
    color: COLORS.red500,
    marginBottom: rs.s(12),
  },
  errorText: {
    fontSize: rs.font(14),
    color: COLORS.stone400,
    textAlign: 'center',
    marginBottom: rs.s(24),
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs.s(10),
    backgroundColor: COLORS.amber600,
    borderRadius: rs.s(16),
    paddingVertical: rs.s(18),
    paddingHorizontal: rs.s(32),
    width: '100%',
  },
  primaryBtnText: {
    fontSize: rs.font(16),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.stone700,
    borderRadius: rs.s(16),
    paddingVertical: rs.s(16),
    paddingHorizontal: rs.s(32),
    width: '100%',
  },
  secondaryBtnText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  footer: {
    padding: rs.s(20),
    alignItems: 'center',
  },
  footerText: {
    fontSize: rs.font(10),
    color: COLORS.stone600,
  },
});

export default RegistrationScreen;