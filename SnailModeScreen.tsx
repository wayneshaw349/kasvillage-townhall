import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { Clock, AlertTriangle, TrendingUp } from 'lucide-react-native';
// Local color palette (SnailModeScreen uses extended Tailwind colors)
const COLORS = {
  cardBg: '#FFF8F0',
  stone50: '#fafaf9', stone100: '#f5f5f4', stone200: '#e7e5e4', stone300: '#d6d3d1',
  stone400: '#a8a29e', stone500: '#78716c', stone600: '#57534e', stone700: '#44403c',
  stone800: '#292524', stone900: '#1c1917',
  amber50: '#fffbeb', amber100: '#fef3c7', amber200: '#fde68a', amber300: '#fcd34d',
  amber400: '#fbbf24', amber500: '#f59e0b', amber600: '#d97706', amber700: '#b45309',
  amber800: '#92400e', amber900: '#78350f',
  green50: '#f0fdf4', green100: '#dcfce7', green200: '#bbf7d0', green400: '#4ade80',
  green500: '#22c55e', green600: '#16a34a', green700: '#15803d', green800: '#166534',
  green900: '#14532d',
  red400: '#f87171', red500: '#ef4444', red600: '#dc2626',
};

interface SnailModeScreenProps {
  reason: string;  // e.g., "Low completion rate (33% < 50%)"
  delayMs: number;  // e.g., 180_000 (3 min)
  xp: number;
  pComplete: number;
  deadlocks: number;
  onDelayComplete?: () => void;
  inAgreementsSompi?: bigint;
  iousOwedSompi?: bigint;
  iousOwedToYouSompi?: bigint;
  agreementReturnsSompi?: bigint;
}

export const SnailModeScreen: React.FC<SnailModeScreenProps> = ({
  reason,
  delayMs,
  xp,
  pComplete,
  deadlocks,
  onDelayComplete,
}) => {
  const [remainingMs, setRemainingMs] = useState(delayMs);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingMs((prev) => {
        if (prev <= 1000) {
          clearInterval(timer);
          onDelayComplete?.();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [delayMs, onDelayComplete]);

  const minutes = Math.ceil(remainingMs / 60_000);
  const seconds = ((remainingMs % 60_000) / 1000).toFixed(0);
  const percentComplete = ((delayMs - remainingMs) / delayMs) * 100;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header: Reputation Cooldown */}
      <View style={styles.header}>
        <Clock size={48} color={COLORS.amber600} />
        <Text style={styles.title}>Reputation Cooldown</Text>
        <Text style={styles.subtitle}>
          Building trust takes time. Complete agreements reliably to regain full access.
        </Text>
      </View>

      {/* Main Countdown: MM:SS */}
      <View style={styles.countdownBox}>
        <Text style={styles.countdownText}>
          {minutes}:{(parseInt(seconds) % 60).toString().padStart(2, '0')}
        </Text>
        <Text style={styles.countdownLabel}>Until next agreement</Text>
        
        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressBar,
              { width: `${Math.min(percentComplete, 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>
          {Math.round(percentComplete)}% complete
        </Text>
      </View>

      {/* Why Section */}
      <View style={styles.whyBox}>
        <AlertTriangle size={24} color={COLORS.amber800} style={{ marginRight: 8 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.whyLabel}>Why the wait?</Text>
          <Text style={styles.whyReason}>{reason}</Text>
        </View>
      </View>

      {/* Stats Snapshot */}
      <View style={styles.statsContainer}>
        <StatCard
          label="XP"
          value={xp.toString()}
          icon="â­"
          color={COLORS.amber400}
        />
        <StatCard
          label="Completion Rate"
          value={`${(pComplete * 100).toFixed(0)}%`}
          icon="âœ“"
          color={pComplete > 0.7 ? COLORS.green400 : COLORS.red400}
        />
        <StatCard
          label="Deadlocks"
          value={deadlocks.toString()}
          icon="âš ï¸"
          color={deadlocks > 2 ? COLORS.red500 : COLORS.amber400}
        />
      </View>

      {/* Action: How to Build Trust */}
      <View style={styles.actionBox}>
        <TrendingUp size={20} color={COLORS.green600} style={{ marginRight: 8 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>How to rebuild trust</Text>
          <Text style={styles.actionText}>
            â€¢ Complete agreements within posted timeframes{'\n'}
            â€¢ Communicate clearly if delays occur{'\n'}
            â€¢ Accept agreements with balanced pricing{'\n'}
            â€¢ Follow through on your commitments
          </Text>
        </View>
      </View>

      {/* Waiting indicator */}
      <View style={styles.waitingBox}>
        <ActivityIndicator size="large" color={COLORS.stone500} />
        <Text style={styles.waitingText}>Waiting for cooldownâ€¦</Text>
        <Text style={styles.waitingSubtext}>
          This helps us maintain a healthy marketplace where neighbors trust each other.
        </Text>
      </View>
    </ScrollView>
  );
};

interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color }) => (
  <View style={styles.statCard}>
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.stone50,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.stone900,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.stone600,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  countdownBox: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.amber300,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 56,
    fontWeight: '700',
    color: COLORS.amber600,
    fontFamily: 'monospace',
  },
  countdownLabel: {
    fontSize: 13,
    color: COLORS.stone600,
    marginTop: 8,
    fontWeight: '500',
  },
  progressContainer: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.stone200,
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.amber500,
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    color: COLORS.stone500,
    marginTop: 8,
  },
  whyBox: {
    backgroundColor: COLORS.amber50,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.amber600,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
  },
  whyLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.amber900,
  },
  whyReason: {
    fontSize: 12,
    color: COLORS.amber700,
    marginTop: 4,
    lineHeight: 18,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.stone200,
    padding: 12,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.stone600,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  actionBox: {
    backgroundColor: COLORS.green50,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.green600,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.green900,
  },
  actionText: {
    fontSize: 12,
    color: COLORS.green700,
    marginTop: 6,
    lineHeight: 18,
  },
  waitingBox: {
    backgroundColor: COLORS.stone100,
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  waitingText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.stone700,
    marginTop: 12,
  },
  waitingSubtext: {
    fontSize: 12,
    color: COLORS.stone600,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default SnailModeScreen;


