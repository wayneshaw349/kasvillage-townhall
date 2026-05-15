// ============================================================================
// KASVILLAGE EXPO - TRADEFI EDUCATION SCREEN
// ============================================================================
// Bathroom Mirror Post-it - Treasury Bills & Bonds DCA Calculator
// Migrated from frontend.jsx BathroomBackground + TradeFiSection
// ============================================================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  TextInput,
  Linking,
  Platform,
} from 'react-native';
import Svg, { Rect, Defs, Pattern, Line, G, Circle, Path } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Responsive scaling
const rs = (size: number) => (SCREEN_WIDTH / 390) * size;

// ============================================================================
// BATHROOM BACKGROUND - Earth tone tiles, mirror, post-its
// ============================================================================

const BathroomBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <View style={styles.backgroundContainer}>
      {/* SVG Background */}
      <Svg
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          {/* Wall tile pattern */}
          <Pattern id="wallTiles" width="60" height="60" patternUnits="userSpaceOnUse">
            <Rect width="60" height="60" fill="#E8DDD0" />
            <Line x1="0" y1="0" x2="60" y2="0" stroke="#C4A77D" strokeWidth="1" />
            <Line x1="0" y1="0" x2="0" y2="60" stroke="#C4A77D" strokeWidth="1" />
          </Pattern>
          
          {/* Floor tile pattern */}
          <Pattern id="floorTiles" width="80" height="80" patternUnits="userSpaceOnUse">
            <Rect width="80" height="80" fill="#D4C4A8" />
            <Line x1="0" y1="0" x2="80" y2="0" stroke="#A89070" strokeWidth="2" />
            <Line x1="0" y1="0" x2="0" y2="80" stroke="#A89070" strokeWidth="2" />
          </Pattern>
          
          {/* Pixel overlay */}
          <Pattern id="pixels" width="20" height="20" patternUnits="userSpaceOnUse">
            <Rect width="20" height="20" fill="transparent" />
            <Line x1="0" y1="0" x2="20" y2="0" stroke="#8B7355" strokeWidth="0.5" opacity="0.06" />
            <Line x1="0" y1="0" x2="0" y2="20" stroke="#8B7355" strokeWidth="0.5" opacity="0.06" />
          </Pattern>
        </Defs>
        
        {/* Wall tiles - top 2/3 */}
        <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT * 0.67} fill="url(#wallTiles)" />
        
        {/* Floor tiles - bottom 1/3 */}
        <Rect x="0" y={SCREEN_HEIGHT * 0.67} width={SCREEN_WIDTH} height={SCREEN_HEIGHT * 0.33} fill="url(#floorTiles)" />
        
        {/* Pixel overlay */}
        <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="url(#pixels)" />
        
        {/* Window with warm outdoor view */}
        <G>
          <Rect x={SCREEN_WIDTH - rs(150)} y={rs(60)} width={rs(120)} height={rs(160)} rx={rs(8)} fill="#D4A574" />
          <Rect x={SCREEN_WIDTH - rs(150)} y={rs(60)} width={rs(120)} height={rs(160)} rx={rs(8)} stroke="#8B7355" strokeWidth="3" fill="transparent" />
          {/* Palm trees emoji placeholder - handled in overlay */}
        </G>
        
        {/* Large mirror */}
        <G>
          <Rect x={SCREEN_WIDTH * 0.25} y={rs(60)} width={rs(140)} height={rs(110)} rx={rs(8)} fill="#D0D0D0" />
          <Rect x={SCREEN_WIDTH * 0.25} y={rs(60)} width={rs(140)} height={rs(110)} rx={rs(8)} stroke="#8B7355" strokeWidth="4" fill="transparent" />
          
          {/* Post-it notes on mirror */}
          <Rect x={SCREEN_WIDTH * 0.25 - rs(8)} y={rs(52)} width={rs(28)} height={rs(28)} fill="#FFEB3B" transform={`rotate(-8 ${SCREEN_WIDTH * 0.25} ${rs(60)})`} />
          <Rect x={SCREEN_WIDTH * 0.25 + rs(120)} y={rs(80)} width={rs(24)} height={rs(24)} fill="#FF8A80" transform={`rotate(12 ${SCREEN_WIDTH * 0.25 + rs(120)} ${rs(80)})`} />
          <Rect x={SCREEN_WIDTH * 0.25 + rs(30)} y={rs(160)} width={rs(28)} height={rs(20)} fill="#80DEEA" transform={`rotate(5 ${SCREEN_WIDTH * 0.25 + rs(30)} ${rs(160)})`} />
          <Rect x={SCREEN_WIDTH * 0.25 + rs(100)} y={rs(130)} width={rs(20)} height={rs(28)} fill="#C5E1A5" transform={`rotate(-5 ${SCREEN_WIDTH * 0.25 + rs(100)} ${rs(130)})`} />
        </G>
        
        {/* Wood shelf with sink */}
        <G>
          <Rect x={SCREEN_WIDTH * 0.25} y={SCREEN_HEIGHT * 0.55} width={rs(160)} height={rs(18)} rx={rs(4)} fill="#A0784B" />
          <Circle cx={SCREEN_WIDTH * 0.25 + rs(80)} cy={SCREEN_HEIGHT * 0.55 - rs(12)} r={rs(28)} fill="#E8E8E8" />
        </G>
        
        {/* Wood shelving unit - left */}
        <G>
          <Rect x={rs(30)} y={rs(80)} width={rs(40)} height={rs(160)} rx={rs(4)} fill="#A0784B" />
          <Line x1={rs(30)} y1={rs(110)} x2={rs(70)} y2={rs(110)} stroke="#6B4423" strokeWidth="2" />
          <Line x1={rs(30)} y1={rs(145)} x2={rs(70)} y2={rs(145)} stroke="#6B4423" strokeWidth="2" />
          <Line x1={rs(30)} y1={rs(180)} x2={rs(70)} y2={rs(180)} stroke="#6B4423" strokeWidth="2" />
          <Line x1={rs(30)} y1={rs(215)} x2={rs(70)} y2={rs(215)} stroke="#6B4423" strokeWidth="2" />
        </G>
        
        {/* Bathtub */}
        <G>
          <Rect x={SCREEN_WIDTH - rs(160)} y={SCREEN_HEIGHT - rs(180)} width={rs(120)} height={rs(60)} rx={rs(30)} fill="#F5F0E6" />
        </G>
        
        {/* Towel rack */}
        <G>
          <Rect x={SCREEN_WIDTH - rs(60)} y={SCREEN_HEIGHT * 0.45} width={rs(12)} height={rs(80)} rx={rs(2)} fill="#5D4E37" />
          <Rect x={SCREEN_WIDTH - rs(72)} y={SCREEN_HEIGHT * 0.45 + rs(70)} width={rs(40)} height={rs(16)} rx={rs(4)} fill="#C4A77D" />
        </G>
      </Svg>
      
      {/* Palm tree emojis */}
      <Text style={[styles.palmTree, { right: rs(35), top: rs(180) }]}>🌴</Text>
      <Text style={[styles.palmTree, { right: rs(100), top: rs(165) }]}>🌴</Text>
      
      {/* Content */}
      <View style={styles.contentContainer}>
        {children}
      </View>
    </View>
  );
};

// ============================================================================
// TREASURY BOND YIELDS DATA
// ============================================================================

interface YieldInfo {
  name: string;
  yield: number;
  term: string;
  payoutMonths: number;
}

const YIELDS: Record<string, YieldInfo> = {
  tbill_4week: { name: '4-Week T-Bill', yield: 5.25, term: '4 weeks', payoutMonths: 1 },
  tbill_13week: { name: '13-Week T-Bill', yield: 5.20, term: '13 weeks', payoutMonths: 3 },
  tbill_26week: { name: '26-Week T-Bill', yield: 5.05, term: '26 weeks', payoutMonths: 6 },
  tbill_52week: { name: '52-Week T-Bill', yield: 4.75, term: '1 year', payoutMonths: 12 },
  tnote_2year: { name: '2-Year T-Note', yield: 4.45, term: '2 years', payoutMonths: 6 },
  tnote_5year: { name: '5-Year T-Note', yield: 4.25, term: '5 years', payoutMonths: 6 },
  tnote_10year: { name: '10-Year T-Note', yield: 4.40, term: '10 years', payoutMonths: 6 },
  tbond_30year: { name: '30-Year T-Bond', yield: 4.55, term: '30 years', payoutMonths: 6 },
  ibond: { name: 'I-Bond (Inflation)', yield: 5.27, term: '1+ year', payoutMonths: 12 },
  eebond: { name: 'EE-Bond', yield: 2.70, term: '20 years', payoutMonths: 240 },
};

// ============================================================================
// TRADEFI SECTION COMPONENT
// ============================================================================

interface TradeFiSectionProps {
  onClose?: () => void;
}

const TradeFiSection: React.FC<TradeFiSectionProps> = ({ onClose }) => {
  // Multi-bond allocation state
  const [allocations, setAllocations] = useState<Record<string, number>>({
    tbill_4week: 0,
    tbill_13week: 0,
    tbill_26week: 0,
    tbill_52week: 0,
    tnote_2year: 0,
    tnote_5year: 0,
    tnote_10year: 0,
    tbond_30year: 0,
    ibond: 0,
    eebond: 0,
  });
  const [totalMonthly, setTotalMonthly] = useState(500);

  const updateAllocation = useCallback((key: string, pct: number) => {
    setAllocations(prev => ({
      ...prev,
      [key]: Math.max(0, Math.min(100, pct)),
    }));
  }, []);

  const totalAllocation = Object.values(allocations).reduce((a, b) => a + b, 0);

  // Calculate earnings for each payout period
  const calculatePayouts = useCallback(() => {
    const payouts = { month1: 0, month3: 0, month6: 0, month12: 0, total: 0 };
    let totalInvested = 0;

    Object.entries(allocations).forEach(([key, pct]) => {
      if (pct > 0) {
        const amount = (pct / 100) * totalMonthly * 12; // Annual investment
        const yieldRate = YIELDS[key].yield / 100;
        const earnings = amount * yieldRate;
        totalInvested += amount;

        // Distribute earnings based on payout schedule
        const payoutMonths = YIELDS[key].payoutMonths;
        if (payoutMonths <= 1) payouts.month1 += earnings / 12;
        else if (payoutMonths <= 3) payouts.month3 += earnings / 4;
        else if (payoutMonths <= 6) payouts.month6 += earnings / 2;
        else payouts.month12 += earnings;

        payouts.total += earnings;
      }
    });

    return { ...payouts, invested: totalInvested };
  }, [allocations, totalMonthly]);

  const payouts = calculatePayouts();

  const openTreasuryDirect = () => {
    Linking.openURL('https://www.treasurydirect.gov');
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.card}>
        {/* Header - Sticky Note Style */}
        <View style={styles.stickyHeader}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>🪞 Bathroom Mirror Post-it</Text>
            <Text style={styles.headerSubtitle}>TradeFi Education</Text>
            <Text style={styles.headerDate}>{currentDate}</Text>
            <Text style={styles.headerQuote}>"Reminders of what you're building toward"</Text>
          </View>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Context Quote */}
        <View style={styles.quoteBox}>
          <Text style={styles.quoteText}>
            "However, most of U.S. Treasury debt is held not by individuals but by institutions:
            mutual funds, banks, pensions, other government entities, and foreign investors."
          </Text>
          <Text style={styles.quoteSubtext}>
            Historically, household direct holdings of Treasuries have been a small fraction of total public debt —
            only a slice of the overall bond market.
          </Text>
        </View>

        {/* Bantu Wisdom */}
        <View style={styles.bantuBox}>
          <Text style={styles.bantuText}>
            "Umkhumbi omkhulu uqondiswa ucingo oluncane."
          </Text>
          <Text style={[styles.bantuTranslation, { display: "none" }]}>
            Umkhumbi omkhulu ulawulwa ngesikwele esincane (isiZulu)
          </Text>
          <Text style={styles.bantuAuthor}>— othile obalulekile</Text>
          
          <View style={styles.bantuDivider} />
          
          <Text style={styles.bantuText}>
            "Ingabe ukuthenga nokuthengisa izibopho kungcono kunokuvota?"
          </Text>
          <Text style={[styles.bantuTranslation, { display: "none" }]}>
            Kungenzeka ukuthi ukuthenga nokuthengisa amabhondi kungcono kunokuvota? (isiZulu)
          </Text>
          <Text style={styles.bantuAuthor}>— othile ofuna ukuba ngumuntu obalulekile</Text>
        </View>

        {/* Multi-Bond DCA Calculator */}
        <View style={styles.calculatorBox}>
          <Text style={styles.calculatorTitle}>📊 Multi-Bond DCA Calculator</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>TOTAL MONTHLY INVESTMENT ($)</Text>
            <TextInput
              style={styles.input}
              value={totalMonthly.toString()}
              onChangeText={(text) => setTotalMonthly(Number(text) || 0)}
              keyboardType="numeric"
              placeholder="500"
            />
          </View>

          <View style={styles.allocationHeader}>
            <Text style={styles.inputLabel}>ALLOCATION % (Total: {totalAllocation}%)</Text>
            {totalAllocation !== 100 && (
              <Text style={styles.warningText}>⚠️ Allocations should total 100%</Text>
            )}
          </View>

          <View style={styles.allocationGrid}>
            {Object.entries(YIELDS).map(([key, val]) => (
              <View key={key} style={styles.allocationItem}>
                <TextInput
                  style={styles.allocationInput}
                  value={allocations[key].toString()}
                  onChangeText={(text) => updateAllocation(key, Number(text) || 0)}
                  keyboardType="numeric"
                />
                <Text style={styles.allocationLabel} numberOfLines={1}>
                  {val.name} ({val.yield}%)
                </Text>
              </View>
            ))}
          </View>

          {/* Payout Schedule Results */}
          <View style={styles.payoutBox}>
            <Text style={styles.payoutTitle}>ESTIMATED ANNUAL PAYOUTS</Text>
            <View style={styles.payoutGrid}>
              <View style={styles.payoutItem}>
                <Text style={styles.payoutPeriod}>Monthly</Text>
                <Text style={styles.payoutAmount}>${payouts.month1.toFixed(0)}</Text>
              </View>
              <View style={styles.payoutItem}>
                <Text style={styles.payoutPeriod}>Quarterly</Text>
                <Text style={styles.payoutAmount}>${payouts.month3.toFixed(0)}</Text>
              </View>
              <View style={styles.payoutItem}>
                <Text style={styles.payoutPeriod}>6-Month</Text>
                <Text style={styles.payoutAmount}>${payouts.month6.toFixed(0)}</Text>
              </View>
              <View style={styles.payoutItem}>
                <Text style={styles.payoutPeriod}>Annual</Text>
                <Text style={styles.payoutAmount}>${payouts.month12.toFixed(0)}</Text>
              </View>
            </View>
            <View style={styles.payoutTotals}>
              <View style={styles.payoutTotalItem}>
                <Text style={styles.payoutTotalLabel}>Total Invested/Year</Text>
                <Text style={styles.payoutTotalValue}>${payouts.invested.toLocaleString()}</Text>
              </View>
              <View style={styles.payoutTotalItem}>
                <Text style={styles.payoutTotalLabel}>Total Est. Earnings/Year</Text>
                <Text style={styles.payoutTotalValueGreen}>+${payouts.total.toFixed(0)}</Text>
              </View>
            </View>
          </View>
          
          <Text style={styles.disclaimer}>
            *Estimates based on current yields. Actual returns will vary. Not financial advice.
          </Text>
        </View>

        {/* Pros & Cons Comparison */}
        <View style={styles.comparisonBox}>
          <Text style={styles.comparisonTitle}>T-Bills/Bonds vs Savings Account</Text>

          <View style={styles.comparisonGrid}>
            {/* T-Bills/Bonds */}
            <View style={styles.comparisonColumn}>
              <Text style={styles.comparisonColumnTitle}>Treasury Bills & Bonds</Text>
              
              <View style={styles.prosBox}>
                <Text style={styles.prosTitle}>✓ Pros</Text>
                <Text style={styles.prosItem}>• Higher yields (4-5%+)</Text>
                <Text style={styles.prosItem}>• Backed by U.S. government</Text>
                <Text style={styles.prosItem}>• State tax exempt</Text>
                <Text style={styles.prosItem}>• Predictable returns</Text>
                <Text style={styles.prosItem}>• No market volatility (if held)</Text>
              </View>
              
              <View style={styles.consBox}>
                <Text style={styles.consTitle}>✗ Cons</Text>
                <Text style={styles.consItem}>• Less liquid (lock-up periods)</Text>
                <Text style={styles.consItem}>• Minimum purchase amounts</Text>
                <Text style={styles.consItem}>• Interest rate risk if sold early</Text>
                <Text style={styles.consItem}>• I-Bonds: 12mo minimum hold</Text>
                <Text style={styles.consItem}>• More complex to manage</Text>
              </View>
            </View>

            {/* Savings Account */}
            <View style={styles.comparisonColumn}>
              <Text style={styles.comparisonColumnTitleAlt}>High-Yield Savings</Text>
              
              <View style={styles.prosBox}>
                <Text style={styles.prosTitle}>✓ Pros</Text>
                <Text style={styles.prosItem}>• Fully liquid (instant access)</Text>
                <Text style={styles.prosItem}>• FDIC insured ($250k)</Text>
                <Text style={styles.prosItem}>• No minimum hold time</Text>
                <Text style={styles.prosItem}>• Simple to manage</Text>
                <Text style={styles.prosItem}>• Competitive rates (4-5%)</Text>
              </View>
              
              <View style={styles.consBox}>
                <Text style={styles.consTitle}>✗ Cons</Text>
                <Text style={styles.consItem}>• Rates can drop anytime</Text>
                <Text style={styles.consItem}>• Subject to state taxes</Text>
                <Text style={styles.consItem}>• May have withdrawal limits</Text>
                <Text style={styles.consItem}>• Inflation can erode value</Text>
                <Text style={styles.consItem}>• Teaser rates may expire</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Can You Sell? */}
        <View style={styles.sellInfoBox}>
          <Text style={styles.sellInfoTitle}>❓ Can You Sell Treasury Bonds?</Text>
          
          <View style={styles.sellInfoItem}>
            <View style={[styles.sellInfoBorder, { borderLeftColor: '#3B82F6' }]}>
              <Text style={styles.sellInfoItemTitle}>T-Bills, T-Notes, T-Bonds</Text>
              <Text style={styles.sellInfoItemText}>
                ✓ Yes, but not inside TreasuryDirect. Transfer to a brokerage (Fidelity, Schwab, etc.) then sell on market.
              </Text>
            </View>
          </View>
          
          <View style={styles.sellInfoItem}>
            <View style={[styles.sellInfoBorder, { borderLeftColor: '#F59E0B' }]}>
              <Text style={styles.sellInfoItemTitle}>I-Bonds & EE-Bonds</Text>
              <Text style={styles.sellInfoItemText}>
                ✗ Cannot sell on market. Redeem (exit) through TreasuryDirect only.
              </Text>
              <Text style={styles.sellInfoSubtext}>• Must hold at least 12 months</Text>
              <Text style={styles.sellInfoSubtext}>• If redeemed before 5 years → lose last 3 months of interest</Text>
            </View>
          </View>
        </View>

        {/* Final Disclaimer */}
        <View style={styles.finalDisclaimer}>
          <Text style={styles.finalDisclaimerText}>
            <Text style={styles.finalDisclaimerBold}>
              This tool is experimental and for informational purposes only. It is not financial advice.
            </Text>
            {'\n'}Consult a licensed financial professional before acting on any information presented here.
          </Text>
        </View>

        {/* BIG BUY BUTTON */}
        <TouchableOpacity style={styles.buyButton} onPress={openTreasuryDirect}>
          <Text style={styles.buyButtonText}>⚖️ TreasuryDirect.gov — BUY ↗</Text>
          <Text style={styles.buyButtonSubtext}>Official U.S. Treasury Bond Marketplace</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// ============================================================================
// TRADEFI SCREEN (Full Page with Background)
// ============================================================================

interface TradeFiScreenProps {
  onBack?: () => void;
}

export const TradeFiScreen: React.FC<TradeFiScreenProps> = ({ onBack }) => {
  return (
    <BathroomBackground>
      <TradeFiSection onClose={onBack} />
    </BathroomBackground>
  );
};

// ============================================================================
// DASHBOARD TOOLBAR BUTTON
// ============================================================================

interface TradeFiButtonProps {
  onPress: () => void;
  active?: boolean;
}

export const TradeFiToolbarButton: React.FC<TradeFiButtonProps> = ({ onPress, active }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.toolbarButton, active && styles.toolbarButtonActive]}
    >
      <Text style={styles.toolbarIcon}>⚖️</Text>
      <Text style={[styles.toolbarLabel, active && styles.toolbarLabelActive]}>TradeFi</Text>
    </TouchableOpacity>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Background
  backgroundContainer: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  palmTree: {
    position: 'absolute',
    fontSize: rs(24),
  },
  
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: rs(16),
    paddingBottom: rs(100),
  },
  
  // Card
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: rs(24),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  
  // Header
  stickyHeader: {
    backgroundColor: '#FEF3C7',
    padding: rs(20),
    borderBottomWidth: 4,
    borderBottomColor: '#FCD34D',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: rs(22),
    fontWeight: '900',
    color: '#78350F',
  },
  headerSubtitle: {
    fontSize: rs(11),
    fontWeight: '700',
    color: '#92400E',
    marginTop: rs(6),
  },
  headerDate: {
    fontSize: rs(10),
    fontStyle: 'italic',
    color: '#A16207',
    marginTop: rs(4),
  },
  headerQuote: {
    fontSize: rs(12),
    fontWeight: '600',
    fontStyle: 'italic',
    color: '#78350F',
    marginTop: rs(12),
  },
  closeButton: {
    padding: rs(8),
  },
  closeButtonText: {
    fontSize: rs(20),
    color: '#92400E',
  },
  
  // Quote Box
  quoteBox: {
    margin: rs(16),
    padding: rs(14),
    backgroundColor: '#EFF6FF',
    borderRadius: rs(12),
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  quoteText: {
    fontSize: rs(12),
    fontStyle: 'italic',
    color: '#1E40AF',
    lineHeight: rs(18),
  },
  quoteSubtext: {
    fontSize: rs(11),
    color: '#2563EB',
    marginTop: rs(8),
    lineHeight: rs(16),
  },
  
  // Bantu Box
  bantuBox: {
    marginHorizontal: rs(16),
    marginBottom: rs(16),
    padding: rs(14),
    backgroundColor: '#FFFBEB',
    borderRadius: rs(12),
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  bantuText: {
    fontSize: rs(12),
    fontStyle: 'italic',
    color: '#78350F',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  bantuTranslation: {
    fontSize: rs(10),
    color: '#92400E',
    marginTop: rs(4),
  },
  bantuAuthor: {
    fontSize: rs(10),
    color: '#A16207',
    fontStyle: 'italic',
    marginTop: rs(4),
  },
  bantuDivider: {
    height: 1,
    backgroundColor: '#FDE68A',
    marginVertical: rs(12),
  },
  
  // Calculator
  calculatorBox: {
    marginHorizontal: rs(16),
    marginBottom: rs(16),
    padding: rs(16),
    backgroundColor: '#FFF8F0',
    borderRadius: rs(16),
    borderWidth: 1,
    borderColor: '#E7E5E4',
  },
  calculatorTitle: {
    fontSize: rs(16),
    fontWeight: '900',
    color: '#1C1917',
    marginBottom: rs(16),
  },
  inputGroup: {
    marginBottom: rs(16),
  },
  inputLabel: {
    fontSize: rs(10),
    fontWeight: '700',
    color: '#78716C',
    textTransform: 'uppercase',
    marginBottom: rs(6),
  },
  input: {
    backgroundColor: '#FAFAF9',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderRadius: rs(12),
    padding: rs(12),
    fontSize: rs(16),
    fontWeight: '700',
  },
  allocationHeader: {
    marginBottom: rs(8),
  },
  warningText: {
    fontSize: rs(10),
    color: '#DC2626',
    marginTop: rs(4),
  },
  allocationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs(8),
    marginBottom: rs(16),
  },
  allocationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAF9',
    borderRadius: rs(8),
    padding: rs(8),
    width: '48%',
  },
  allocationInput: {
    width: rs(44),
    padding: rs(4),
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderRadius: rs(4),
    fontSize: rs(12),
    marginRight: rs(8),
  },
  allocationLabel: {
    flex: 1,
    fontSize: rs(9),
    color: '#57534E',
  },
  
  // Payouts
  payoutBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: rs(12),
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: rs(14),
  },
  payoutTitle: {
    fontSize: rs(10),
    fontWeight: '700',
    color: '#047857',
    textTransform: 'uppercase',
    marginBottom: rs(12),
  },
  payoutGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  payoutItem: {
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    borderRadius: rs(8),
    padding: rs(8),
    width: '23%',
  },
  payoutPeriod: {
    fontSize: rs(9),
    color: '#059669',
  },
  payoutAmount: {
    fontSize: rs(16),
    fontWeight: '900',
    color: '#065F46',
  },
  payoutTotals: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: rs(12),
    paddingTop: rs(12),
    borderTopWidth: 1,
    borderTopColor: '#A7F3D0',
  },
  payoutTotalItem: {
    alignItems: 'center',
  },
  payoutTotalLabel: {
    fontSize: rs(10),
    color: '#059669',
  },
  payoutTotalValue: {
    fontSize: rs(18),
    fontWeight: '900',
    color: '#065F46',
  },
  payoutTotalValueGreen: {
    fontSize: rs(18),
    fontWeight: '900',
    color: '#047857',
  },
  disclaimer: {
    fontSize: rs(9),
    color: '#A8A29E',
    textAlign: 'center',
    marginTop: rs(8),
  },
  
  // Comparison
  comparisonBox: {
    marginHorizontal: rs(16),
    marginBottom: rs(16),
    padding: rs(16),
    backgroundColor: '#FFF8F0',
    borderRadius: rs(16),
    borderWidth: 1,
    borderColor: '#E7E5E4',
  },
  comparisonTitle: {
    fontSize: rs(15),
    fontWeight: '900',
    color: '#1C1917',
    marginBottom: rs(12),
  },
  comparisonGrid: {
    flexDirection: 'row',
    gap: rs(12),
  },
  comparisonColumn: {
    flex: 1,
  },
  comparisonColumnTitle: {
    fontSize: rs(11),
    fontWeight: '700',
    color: '#1E40AF',
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
    paddingBottom: rs(4),
    marginBottom: rs(8),
  },
  comparisonColumnTitleAlt: {
    fontSize: rs(11),
    fontWeight: '700',
    color: '#92400E',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingBottom: rs(4),
    marginBottom: rs(8),
  },
  prosBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: rs(8),
    padding: rs(10),
    marginBottom: rs(8),
  },
  prosTitle: {
    fontSize: rs(10),
    fontWeight: '700',
    color: '#047857',
    marginBottom: rs(4),
  },
  prosItem: {
    fontSize: rs(9),
    color: '#059669',
    lineHeight: rs(14),
  },
  consBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: rs(8),
    padding: rs(10),
  },
  consTitle: {
    fontSize: rs(10),
    fontWeight: '700',
    color: '#B91C1C',
    marginBottom: rs(4),
  },
  consItem: {
    fontSize: rs(9),
    color: '#DC2626',
    lineHeight: rs(14),
  },
  
  // Sell Info
  sellInfoBox: {
    marginHorizontal: rs(16),
    marginBottom: rs(16),
    padding: rs(16),
    backgroundColor: '#FAFAF9',
    borderRadius: rs(16),
    borderWidth: 1,
    borderColor: '#E7E5E4',
  },
  sellInfoTitle: {
    fontSize: rs(15),
    fontWeight: '900',
    color: '#1C1917',
    marginBottom: rs(12),
  },
  sellInfoItem: {
    marginBottom: rs(12),
  },
  sellInfoBorder: {
    borderLeftWidth: 4,
    paddingLeft: rs(12),
    backgroundColor: '#FFF8F0',
    borderRadius: rs(8),
    padding: rs(12),
  },
  sellInfoItemTitle: {
    fontSize: rs(12),
    fontWeight: '700',
    color: '#1C1917',
  },
  sellInfoItemText: {
    fontSize: rs(11),
    color: '#57534E',
    marginTop: rs(4),
  },
  sellInfoSubtext: {
    fontSize: rs(10),
    color: '#78716C',
    marginTop: rs(2),
  },
  
  // Final Disclaimer
  finalDisclaimer: {
    marginHorizontal: rs(16),
    marginBottom: rs(16),
    padding: rs(14),
    backgroundColor: '#FEF2F2',
    borderRadius: rs(12),
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  finalDisclaimerText: {
    fontSize: rs(11),
    color: '#991B1B',
    textAlign: 'center',
    lineHeight: rs(16),
  },
  finalDisclaimerBold: {
    fontWeight: '700',
  },
  
  // Buy Button
  buyButton: {
    margin: rs(16),
    marginTop: 0,
    backgroundColor: '#2563EB',
    borderRadius: rs(16),
    padding: rs(20),
    alignItems: 'center',
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buyButtonText: {
    fontSize: rs(18),
    fontWeight: '900',
    color: '#FFFFFF',
  },
  buyButtonSubtext: {
    fontSize: rs(12),
    color: '#BFDBFE',
    marginTop: rs(4),
  },
  
  // Toolbar Button
  toolbarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: rs(8),
    paddingHorizontal: rs(12),
  },
  toolbarButtonActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderRadius: rs(12),
  },
  toolbarIcon: {
    fontSize: rs(24),
  },
  toolbarLabel: {
    fontSize: rs(10),
    color: '#78716C',
    marginTop: rs(2),
  },
  toolbarLabelActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
});

export default TradeFiScreen;
