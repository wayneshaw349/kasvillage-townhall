// ============================================================================
// KASVILLAGE - SLOTH POISON METER
// ============================================================================
// Shows upload queue status + poison level. Appears when poison > 0.
// Green → Yellow → Orange → Red (Sloth Mode)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { onSlothStateChange, getSlothState, forceProcessQueue, type SlothPoisonState } from './upload_queue';

// ============================================================================
// SLOTH POISON BAR
// ============================================================================

interface SlothPoisonBarProps {
  /** Show even at 0 poison (for debug) */
  alwaysShow?: boolean;
}

export const SlothPoisonBar: React.FC<SlothPoisonBarProps> = ({ alwaysShow = false }) => {
  const [state, setState] = useState<SlothPoisonState>(getSlothState());
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    const unsub = onSlothStateChange(setState);
    // Poll every 10s for decay updates
    const interval = setInterval(() => setState(getSlothState()), 10_000);
    return () => { unsub(); clearInterval(interval); };
  }, []);

  // Pulse animation when in sloth mode
  useEffect(() => {
    if (state.slothModeActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state.slothModeActive]);

  // Hide when no poison and no queue
  if (!alwaysShow && state.level === 0 && state.queueLength === 0) return null;

  const barColor = state.status === 'sloth' ? '#DC2626'
    : state.status === 'sluggish' ? '#F97316'
    : state.status === 'warming' ? '#EAB308'
    : '#22C55E';

  const bgColor = state.status === 'sloth' ? '#FEF2F2'
    : state.status === 'sluggish' ? '#FFF7ED'
    : state.status === 'warming' ? '#FEFCE8'
    : '#F0FDF4';

  const icon = state.status === 'sloth' ? '🦥'
    : state.status === 'sluggish' ? '🦥'
    : state.status === 'warming' ? '🐢'
    : '✅';

  const label = state.status === 'sloth' ? 'SLOTH MODE'
    : state.status === 'sluggish' ? 'Sluggish'
    : state.status === 'warming' ? 'Warming up'
    : 'Normal';

  return (
    <Animated.View style={[styles.container, { backgroundColor: bgColor, opacity: pulseAnim }]}>
      <View style={styles.row}>
        <Text style={styles.icon}>{icon}</Text>
        <View style={styles.info}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: barColor }]}>{label}</Text>
            {state.queueLength > 0 && (
              <Text style={styles.queueCount}>{state.queueLength} queued</Text>
            )}
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${state.level}%`, backgroundColor: barColor }]} />
          </View>
        </View>
        {state.queueLength > 0 && (
          <TouchableOpacity style={styles.processBtn} onPress={forceProcessQueue}>
            <Text style={styles.processBtnText}>▶</Text>
          </TouchableOpacity>
        )}
      </View>
      {state.slothModeActive && (
        <Text style={styles.slothText}>
          Upload queue building up. Wallet functions slowed until queue clears.
        </Text>
      )}
    </Animated.View>
  );
};

// ============================================================================
// COMPACT VERSION (for inline use in Dashboard)
// ============================================================================

export const SlothPoisonCompact: React.FC = () => {
  const [state, setState] = useState<SlothPoisonState>(getSlothState());

  useEffect(() => {
    const unsub = onSlothStateChange(setState);
    const interval = setInterval(() => setState(getSlothState()), 10_000);
    return () => { unsub(); clearInterval(interval); };
  }, []);

  if (state.level === 0 && state.queueLength === 0) return null;

  const barColor = state.status === 'sloth' ? '#DC2626'
    : state.status === 'sluggish' ? '#F97316'
    : state.status === 'warming' ? '#EAB308'
    : '#22C55E';

  const icon = state.status === 'sloth' ? '🦥' : state.status === 'sluggish' ? '🦥' : '🐢';

  return (
    <View style={compactStyles.container}>
      <Text style={compactStyles.icon}>{icon}</Text>
      <View style={compactStyles.barBg}>
        <View style={[compactStyles.barFill, { width: `${state.level}%`, backgroundColor: barColor }]} />
      </View>
      {state.queueLength > 0 && (
        <Text style={compactStyles.count}>{state.queueLength}</Text>
      )}
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 20,
  },
  info: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  queueCount: {
    fontSize: 10,
    color: '#6B7280',
  },
  barBg: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  processBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processBtnText: {
    fontSize: 12,
    color: '#374151',
  },
  slothText: {
    fontSize: 10,
    color: '#991B1B',
    marginTop: 6,
    lineHeight: 14,
  },
});

const compactStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  icon: {
    fontSize: 14,
  },
  barBg: {
    flex: 1,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  count: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6B7280',
    minWidth: 16,
    textAlign: 'right',
  },
});

export default SlothPoisonBar;
