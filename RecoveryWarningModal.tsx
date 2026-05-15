import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { AlertTriangle, CheckCircle2, Smartphone } from 'lucide-react-native';

// Inline COLORS since ./styles module doesn't exist
const COLORS = {
  white: '#ffffff',
  cardBg: '#ffffff',
  stone50: '#fafaf9',
  stone100: '#f5f5f4',
  stone300: '#d6d3d1',
  stone600: '#57534e',
  stone700: '#44403c',
  stone800: '#292524',
  stone900: '#1c1917',
  green50: '#f0fdf4',
  green100: '#dcfce7',
  green300: '#86efac',
  green600: '#16a34a',
  green700: '#15803d',
  green800: '#166534',
  red50: '#fef2f2',
  red300: '#fca5a5',
  red600: '#dc2626',
  red700: '#b91c1c',
  amber50: '#fffbeb',
  amber600: '#d97706',
  amber800: '#92400e',
  amber900: '#78350f',
};

interface RecoveryWarningModalProps {
  visible: boolean;
  currentTraitCount: number;
  onAcknowledge: () => void;
}

export const RecoveryWarningModal: React.FC<RecoveryWarningModalProps> = ({
  visible,
  currentTraitCount,
  onAcknowledge,
}) => {
  const canRecover = currentTraitCount >= 9;
  const traitsRemaining = Math.max(0, 9 - currentTraitCount);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onAcknowledge}
    >
      <View style={styles.overlay}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.card,
              { borderTopColor: canRecover ? COLORS.green600 : COLORS.red600 },
            ]}
          >
            <View style={styles.iconContainer}>
              {canRecover ? (
                <CheckCircle2 size={56} color={COLORS.green600} />
              ) : (
                <AlertTriangle size={56} color={COLORS.red600} />
              )}
            </View>

            <Text style={styles.title}>
              {canRecover ? '✅ Recovery Enabled' : '⚠️ Recovery Not Possible'}
            </Text>

            <Text style={styles.statusText}>
              {canRecover
                ? 'You have enough traits to recover your wallet if you lose your phone.'
                : 'You do NOT have enough traits to recover your wallet. If you lose your phone, your KAS is UNRECOVERABLE.'}
            </Text>

            <View
              style={[
                styles.statusBox,
                {
                  backgroundColor: canRecover ? COLORS.green50 : COLORS.red50,
                  borderColor: canRecover ? COLORS.green300 : COLORS.red300,
                },
              ]}
            >
              <View style={styles.traitRow}>
                <Text style={styles.traitLabel}>Traits completed:</Text>
                <Text
                  style={[
                    styles.traitValue,
                    {
                      color: canRecover ? COLORS.green700 : COLORS.red700,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {currentTraitCount}/9
                </Text>
              </View>

              {!canRecover && (
                <View style={styles.remainingRow}>
                  <Text style={styles.remainingLabel}>Traits needed:</Text>
                  <Text style={styles.remainingValue}>{traitsRemaining} more</Text>
                </View>
              )}

              <View style={styles.recoveryExplanation}>
                <Smartphone
                  size={16}
                  color={canRecover ? COLORS.green700 : COLORS.red700}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.recoveryText,
                    {
                      color: canRecover ? COLORS.green700 : COLORS.red700,
                    },
                  ]}
                >
                  {canRecover
                    ? 'If you lose this phone, reinstall KasVillage and re-answer your traits to recover your wallet.'
                    : 'If you lose this phone WITHOUT 9+ traits, you CANNOT recover your wallet. Your KAS will be permanently lost.'}
                </Text>
              </View>
            </View>

            <View style={styles.traitListBox}>
              <Text style={styles.traitListTitle}>These 9 traits are required for recovery:</Text>
              <View style={styles.traitGrid}>
                {[
                  { num: 1, name: 'Race' },
                  { num: 2, name: 'Class' },
                  { num: 3, name: 'Occupation' },
                  { num: 4, name: 'Mutant Trait' },
                  { num: 5, name: 'Animal' },
                  { num: 6, name: 'Mutation' },
                  { num: 7, name: 'Personality' },
                  { num: 8, name: 'Combat Style' },
                  { num: 9, name: 'Signature Move' },
                ].map((trait, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.traitItem,
                      {
                        backgroundColor:
                          idx < currentTraitCount
                            ? COLORS.green100
                            : COLORS.stone100,
                        borderColor:
                          idx < currentTraitCount
                            ? COLORS.green300
                            : COLORS.stone300,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.traitItemNum,
                        {
                          color:
                            idx < currentTraitCount
                              ? COLORS.green700
                              : COLORS.stone600,
                        },
                      ]}
                    >
                      {trait.num}
                    </Text>
                    <Text
                      style={[
                        styles.traitItemName,
                        {
                          color:
                            idx < currentTraitCount
                              ? COLORS.green800
                              : COLORS.stone700,
                        },
                      ]}
                    >
                      {trait.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {!canRecover && (
              <View style={styles.recommendationBox}>
                <Text style={styles.recommendationTitle}>📝 Our recommendation:</Text>
                <Text style={styles.recommendationText}>
                  Please complete all 9 required traits before proceeding. This ensures you
                  can always recover your wallet and access your KAS, no matter what happens
                  to your phone.
                </Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: canRecover ? COLORS.green600 : COLORS.amber600,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              onPress={onAcknowledge}
            >
              <Text style={styles.buttonText}>
                {canRecover ? 'Got it! Continue' : 'Understood, go back'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    borderTopWidth: 4,
    padding: 24,
    maxWidth: 480,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.stone900,
    textAlign: 'center',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    color: COLORS.stone700,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  statusBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  traitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  traitLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.stone700,
  },
  traitValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  remainingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  remainingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.stone700,
  },
  remainingValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.red600,
  },
  recoveryExplanation: {
    flexDirection: 'row',
    marginTop: 12,
  },
  recoveryText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  traitListBox: {
    backgroundColor: COLORS.stone50,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  traitListTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.stone800,
    marginBottom: 12,
  },
  traitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  traitItem: {
    flex: 1,
    minWidth: '30%',
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
  },
  traitItemNum: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  traitItemName: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  recommendationBox: {
    backgroundColor: COLORS.amber50,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.amber600,
    padding: 14,
    marginBottom: 20,
  },
  recommendationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.amber900,
    marginBottom: 6,
  },
  recommendationText: {
    fontSize: 12,
    color: COLORS.amber800,
    lineHeight: 18,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
});

export default RecoveryWarningModal;