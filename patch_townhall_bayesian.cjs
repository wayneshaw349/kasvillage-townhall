/**
 * patch_townhall_bayesian.cjs
 * Wires TownHall user stats + Bayesian trust gauge into Dashboard.tsx wallet page
 * 
 * Changes:
 * 1. Adds import for lookupCounterpartyCached from counterparty_lookup
 * 2. Adds Path to react-native-svg imports
 * 3. Adds TownHall fields to useDashboardStats state + fetch
 * 4. Adds BayesianGauge component (RN Views + SVG arc)
 * 5. Inserts gauge + TownHall stats into "Your Stats" card
 * 
 * Run: node patch_townhall_bayesian.cjs
 */

const fs = require('fs');
const path = require('path');

const DASHBOARD_PATH = path.resolve(__dirname, 'Dashboard.tsx');

function patch() {
  let src = fs.readFileSync(DASHBOARD_PATH, 'utf8');

  // ── Guard: skip if already patched ──
  if (src.includes('BayesianGauge')) {
    console.log('[Patch] Already applied (BayesianGauge found). Skipping.');
    return;
  }

  // ════════════════════════════════════════════════════════════════════
  // 1. ADD IMPORT for lookupCounterpartyCached
  // ════════════════════════════════════════════════════════════════════
  const importAnchor = "import AsyncStorage from '@react-native-async-storage/async-storage';";
  if (!src.includes(importAnchor)) {
    console.error('[Patch] Cannot find AsyncStorage import anchor. Aborting.');
    process.exit(1);
  }
  src = src.replace(
    importAnchor,
    importAnchor + "\nimport { lookupCounterpartyCached, computeEnhancedPComplete } from './counterparty_lookup';\nimport type { CounterpartyStats } from './counterparty_lookup';"
  );
  console.log('[Patch] 1/5 Added counterparty_lookup import');

  // ════════════════════════════════════════════════════════════════════
  // 2. ADD Path to react-native-svg imports  
  // ════════════════════════════════════════════════════════════════════
  const svgImport = "import Svg, { Rect, Defs, LinearGradient, Stop, Pattern, Line } from 'react-native-svg';";
  if (!src.includes(svgImport)) {
    console.error('[Patch] Cannot find react-native-svg import. Aborting.');
    process.exit(1);
  }
  src = src.replace(
    svgImport,
    "import Svg, { Rect, Defs, LinearGradient, Stop, Pattern, Line, Path as SvgPath, Circle as SvgCircle } from 'react-native-svg';"
  );
  console.log('[Patch] 2/5 Added Path to svg imports');

  // ════════════════════════════════════════════════════════════════════
  // 3. ADD TownHall fields to useDashboardStats state + fetch call
  // ════════════════════════════════════════════════════════════════════

  // 3a. Add state fields
  const stateAnchor = '    isSnailPoison: false,\n    loading: true,\n  });';
  if (!src.includes(stateAnchor)) {
    console.error('[Patch] Cannot find state anchor. Aborting.');
    process.exit(1);
  }
  src = src.replace(
    stateAnchor,
    `    isSnailPoison: false,
    // TownHall Bayesian
    bayesianScore: 0.5,
    bayesianConfidence: 0,
    townhallRiskRating: 'unknown' as string,
    townhallOnline: false,
    townhallVolumeSompi: 0,
    townhallAvgCompletionMs: 0,
    townhallSuccesses: 0,
    townhallDeadlocks: 0,
    enhancedFactors: null as any,
    loading: true,
  });`
  );
  console.log('[Patch] 3a/5 Added TownHall state fields');

  // 3b. Add TownHall fetch after XP fallback
  const fetchAnchor = `      // Use local XP if Arweave didn't provide it
      if (xp === 0 && localXp > 0) xp = localXp;
      if (xp === 0 && xpFallback > 0) xp = xpFallback;`;

  if (!src.includes(fetchAnchor)) {
    console.error('[Patch] Cannot find TownHall fetch anchor. Aborting.');
    process.exit(1);
  }

  src = src.replace(
    fetchAnchor,
    `      // Use local XP if Arweave didn't provide it
      if (xp === 0 && localXp > 0) xp = localXp;
      if (xp === 0 && xpFallback > 0) xp = xpFallback;

      // ── TownHall Bayesian stats (cached, non-blocking) ──
      let bayesianScore = pComplete || 0.5;
      let bayesianConfidence = 0;
      let townhallRiskRating = 'unknown';
      let townhallOnline = false;
      let townhallVolumeSompi = 0;
      let townhallAvgCompletionMs = 0;
      let townhallSuccesses = 0;
      let townhallDeadlocks = 0;
      let enhancedFactors: any = null;
      try {
        if (resolvedPubkey) {
          const result = await lookupCounterpartyCached(resolvedPubkey, { includeHistory: true });
          if (result.found && result.stats) {
            townhallOnline = true;
            const ts = result.stats;
            bayesianScore = ts.pComplete;
            bayesianConfidence = ts.confidence;
            townhallRiskRating = ts.riskRating;
            townhallVolumeSompi = ts.neighborAgreements.totalVolumeSompi;
            townhallAvgCompletionMs = ts.neighborAgreements.avgCompletionTimeMs;
            townhallSuccesses = ts.successes;
            townhallDeadlocks = ts.deadlocks;
            // Prefer TownHall over local Arweave when available
            if (ts.successes > 0 || ts.deadlocks > 0) {
              agreementsCompleted = ts.successes;
              deadlocks = ts.deadlocks;
              pComplete = ts.pComplete;
              if (ts.xp > 0) xp = ts.xp;
              if (ts.neighborAgreements.totalVolumeSompi > 0) {
                totalVolumeSompi = ts.neighborAgreements.totalVolumeSompi;
              }
            }
            // Enhanced Bayesian with recency/pattern/speed factors
            enhancedFactors = computeEnhancedPComplete(ts);
            bayesianScore = enhancedFactors.finalP;
            console.log('[DashStats] TownHall — pComplete:', bayesianScore.toFixed(3),
              'confidence:', bayesianConfidence.toFixed(2), 'risk:', townhallRiskRating);
          } else {
            console.log('[DashStats] TownHall — not found, using Arweave data');
          }
        }
      } catch (e) {
        console.warn('[DashStats] TownHall fetch error (non-fatal):', e);
      }`
  );
  console.log('[Patch] 3b/5 Added TownHall fetch logic');

  // 3c. Add TownHall fields to setStats call
  const setStatsAnchor = `      setStats({
        agreementsCompleted, deadlocks, pComplete, xp, totalVolumeSompi,
        totalBalanceSompi, spendableBalanceSompi, committedSompi, iouAllocatedSompi,
        iousOwedSompi, iousOwedToYouSompi, agreementReturnsSompi,
        totalSentSompi, totalReceivedSompi, sendCount, receiveCount,
        storefronts: 0,
        isSnailPoison: xp < 0,
        loading: false,
      });`;

  if (!src.includes(setStatsAnchor)) {
    console.error('[Patch] Cannot find setStats anchor. Aborting.');
    process.exit(1);
  }

  src = src.replace(
    setStatsAnchor,
    `      setStats({
        agreementsCompleted, deadlocks, pComplete, xp, totalVolumeSompi,
        totalBalanceSompi, spendableBalanceSompi, committedSompi, iouAllocatedSompi,
        iousOwedSompi, iousOwedToYouSompi, agreementReturnsSompi,
        totalSentSompi, totalReceivedSompi, sendCount, receiveCount,
        storefronts: 0,
        isSnailPoison: xp < 0,
        bayesianScore, bayesianConfidence, townhallRiskRating, townhallOnline,
        townhallVolumeSompi, townhallAvgCompletionMs, townhallSuccesses, townhallDeadlocks,
        enhancedFactors,
        loading: false,
      });`
  );
  console.log('[Patch] 3c/5 Added TownHall fields to setStats');

  // ════════════════════════════════════════════════════════════════════
  // 4. ADD BayesianGauge component (before WalletOverview)
  // ════════════════════════════════════════════════════════════════════
  const gaugeAnchor = `// ============================================================================
// WALLET OVERVIEW
// ============================================================================`;

  if (!src.includes(gaugeAnchor)) {
    console.error('[Patch] Cannot find WALLET OVERVIEW anchor. Aborting.');
    process.exit(1);
  }

  const bayesianGauge = `// ============================================================================
// BAYESIAN TRUST GAUGE (SVG semi-arc + RN text overlay)
// ============================================================================
const BayesianGauge: React.FC<{
  score: number;      // 0..1
  confidence: number; // 0..1
  riskRating: string;
  online: boolean;
  loading?: boolean;
}> = ({ score, confidence, riskRating, online, loading }) => {
  const size = rs.s(160);
  const sw = rs.s(14);
  const r = (size - sw) / 2;
  const cx = size / 2;
  const cy = size / 2 + rs.s(8);

  // Semi-arc: 180° (left) to 0° (right)
  const clampedScore = Math.max(0, Math.min(1, score));
  const fillAngle = Math.PI - Math.PI * clampedScore;

  const x1 = cx + r * Math.cos(Math.PI);
  const y1 = cy - r * Math.sin(Math.PI);
  const x2 = cx + r * Math.cos(0);
  const y2 = cy - r * Math.sin(0);
  const fx = cx + r * Math.cos(fillAngle);
  const fy = cy - r * Math.sin(fillAngle);

  const largeArc = clampedScore > 0.5 ? 1 : 0;

  // Color based on score
  const gc = clampedScore >= 0.85 ? '#22c55e'
    : clampedScore >= 0.7 ? '#84cc16'
    : clampedScore >= 0.5 ? '#eab308'
    : clampedScore >= 0.3 ? '#f97316'
    : '#ef4444';

  const riskLabels: Record<string, string> = {
    highly_trusted: '\\u2B50 Highly Trusted',
    reliable: '\\u2713 Reliable',
    medium_risk: '\\u26A0 Medium Risk',
    high_risk: '\\uD83D\\uDEA8 High Risk',
    unknown: '? New User',
  };

  const pctText = loading ? '...' : (clampedScore * 100).toFixed(0) + '%';

  return (
    <View style={{ alignItems: 'center', marginBottom: rs.s(8) }}>
      <View style={{ width: size, height: size / 2 + rs.s(30), position: 'relative' }}>
        <Svg width={size} height={size / 2 + rs.s(20)}>
          {/* Background arc */}
          <SvgPath
            d={\`M \${x1} \${y1} A \${r} \${r} 0 1 1 \${x2} \${y2}\`}
            fill="none"
            stroke="#e7e5e4"
            strokeWidth={sw}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          {clampedScore > 0.01 && (
            <SvgPath
              d={\`M \${x1} \${y1} A \${r} \${r} 0 \${largeArc} 1 \${fx} \${fy}\`}
              fill="none"
              stroke={gc}
              strokeWidth={sw}
              strokeLinecap="round"
            />
          )}
        </Svg>
        {/* Center text overlay (RN Text, not SVG Text — avoids import conflict) */}
        <View style={{ position: 'absolute', top: rs.s(20), left: 0, right: 0, alignItems: 'center' }}>
          <Text style={{ fontSize: rs.font(32), fontWeight: '900', color: gc }}>{pctText}</Text>
          <Text style={{ fontSize: rs.font(9), color: '#78716c', marginTop: rs.s(2) }}>Bayesian Trust</Text>
        </View>
      </View>
      <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: gc, marginTop: -rs.s(4) }}>
        {riskLabels[riskRating] || riskRating}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs.s(8), marginTop: rs.s(4) }}>
        <Text style={{ fontSize: rs.font(9), color: '#a8a29e' }}>
          Confidence: {(confidence * 100).toFixed(0)}%
        </Text>
        <View style={{ width: rs.s(6), height: rs.s(6), borderRadius: rs.s(3), backgroundColor: online ? '#22c55e' : '#ef4444' }} />
        <Text style={{ fontSize: rs.font(9), color: online ? '#22c55e' : '#a8a29e' }}>
          {online ? 'TownHall' : 'Offline'}
        </Text>
      </View>
    </View>
  );
};

`;

  src = src.replace(gaugeAnchor, bayesianGauge + gaugeAnchor);
  console.log('[Patch] 4/5 Added BayesianGauge component');

  // ════════════════════════════════════════════════════════════════════
  // 5. INSERT gauge into "Your Stats" card
  // ════════════════════════════════════════════════════════════════════
  const statsCardAnchor = `    {/* Village Stats — real data from hook */}
    <Card variant="green" style={walletStyles.statsCard}>
      <Text style={walletStyles.statsTitle}>
        {ds.loading ? 'Loading Stats…' : 'Your Stats'}
      </Text>
      <View style={walletStyles.statsRow}>`;

  if (!src.includes(statsCardAnchor)) {
    console.error('[Patch] Cannot find "Your Stats" card anchor. Aborting.');
    process.exit(1);
  }

  src = src.replace(
    statsCardAnchor,
    `    {/* Village Stats — TownHall Bayesian + Arweave data */}
    <Card variant="green" style={walletStyles.statsCard}>
      <Text style={walletStyles.statsTitle}>
        {ds.loading ? 'Loading Stats\\u2026' : 'Your Stats'}
      </Text>
      {/* Bayesian Trust Gauge */}
      <BayesianGauge
        score={ds.bayesianScore}
        confidence={ds.bayesianConfidence}
        riskRating={ds.townhallRiskRating}
        online={ds.townhallOnline}
        loading={ds.loading}
      />
      {/* Enhanced Bayesian factor badges */}
      {ds.enhancedFactors && !ds.loading && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: rs.s(4), marginBottom: rs.s(8) }}>
          {ds.enhancedFactors.recencyFactor > 1 && (
            <Text style={{ fontSize: rs.font(9), color: '#22c55e', backgroundColor: '#f0fdf4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' }}>Active</Text>
          )}
          {ds.enhancedFactors.recencyFactor < 1 && (
            <Text style={{ fontSize: rs.font(9), color: '#f97316', backgroundColor: '#fff7ed', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' }}>Stale</Text>
          )}
          {ds.enhancedFactors.patternPenalty < 1 && (
            <Text style={{ fontSize: rs.font(9), color: '#ef4444', backgroundColor: '#fef2f2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' }}>Pattern</Text>
          )}
          {ds.enhancedFactors.resolutionBonus > 1 && (
            <Text style={{ fontSize: rs.font(9), color: '#3b82f6', backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' }}>Recovered</Text>
          )}
          {ds.enhancedFactors.speedFactor > 1 && (
            <Text style={{ fontSize: rs.font(9), color: '#8b5cf6', backgroundColor: '#f5f3ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' }}>Fast</Text>
          )}
          {ds.enhancedFactors.speedFactor < 1 && (
            <Text style={{ fontSize: rs.font(9), color: '#f97316', backgroundColor: '#fff7ed', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' }}>Slow</Text>
          )}
        </View>
      )}
      <View style={walletStyles.statsRow}>`
  );
  console.log('[Patch] 5/5 Inserted BayesianGauge into Your Stats card');

  // ── Write ──
  fs.writeFileSync(DASHBOARD_PATH, src, 'utf8');
  console.log('\n[Patch] \\u2705 Dashboard.tsx patched successfully');
  console.log('[Patch] Verify: grep "BayesianGauge" Dashboard.tsx');
  console.log('[Patch] Verify: grep "lookupCounterpartyCached" Dashboard.tsx');
  console.log('[Patch] Verify: grep "SvgPath" Dashboard.tsx');
}

patch();
