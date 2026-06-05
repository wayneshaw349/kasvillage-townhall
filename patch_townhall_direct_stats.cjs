/**
 * patch_townhall_direct_stats.cjs
 * Replaces lookupCounterpartyCached with direct /user-stats POST call
 * (matches the actual Flux endpoint that exists)
 * Run: node patch_townhall_direct_stats.cjs
 */
const fs = require('fs');
const path = require('path');
const FILE = path.resolve(__dirname, 'Dashboard.tsx');
let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('TOWNHALL_STATS_URL')) {
  console.log('[Patch] Already applied. Skipping.');
  process.exit(0);
}

// 1. Replace the lookupCounterpartyCached call with direct /user-stats POST
const oldFetch = `      // ── TownHall Bayesian stats (cached, non-blocking) ──
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
      }`;

if (!src.includes(oldFetch)) {
  console.error('[Patch] Cannot find TownHall fetch block. Aborting.');
  process.exit(1);
}

const newFetch = `      // ── TownHall Bayesian stats via /user-stats POST (direct Flux endpoint) ──
      const TOWNHALL_STATS_URL = 'https://kasvillage.app.runonflux.io/user-stats';
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
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          const resp = await fetch(TOWNHALL_STATS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ pubkey: resolvedPubkey }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (resp.ok) {
            const ts = await resp.json();
            townhallOnline = true;
            const s = ts.successes || 0;
            const d = ts.deadlocks || 0;
            const n = s + d;
            const thXp = ts.xp || 0;
            const thPComplete = n > 0 ? (1 + s) / (2 + n) : 0.5;
            const thConfidence = Math.min(n / 10, 1);
            bayesianScore = thPComplete;
            bayesianConfidence = thConfidence;
            townhallSuccesses = s;
            townhallDeadlocks = d;
            // Risk rating
            if (thPComplete > 0.9 && thConfidence > 0.5) townhallRiskRating = 'highly_trusted';
            else if (thPComplete > 0.75) townhallRiskRating = 'reliable';
            else if (thPComplete < 0.4) townhallRiskRating = 'high_risk';
            else townhallRiskRating = 'medium_risk';
            // Prefer TownHall over local Arweave
            if (s > 0 || d > 0) {
              agreementsCompleted = s;
              deadlocks = d;
              pComplete = thPComplete;
              if (thXp > 0) xp = thXp;
            }
            console.log('[DashStats] TownHall — pComplete:', bayesianScore.toFixed(3),
              'confidence:', bayesianConfidence.toFixed(2), 'risk:', townhallRiskRating, 'xp:', thXp);
          } else {
            console.log('[DashStats] TownHall — HTTP', resp.status, 'using Arweave data');
          }
        }
      } catch (e: any) {
        console.warn('[DashStats] TownHall fetch error (non-fatal):', e?.message || e);
      }`;

src = src.replace(oldFetch, newFetch);
console.log('[Patch] 1/2 Replaced TownHall fetch with direct /user-stats POST');

// 2. Remove the now-unused import (lookupCounterpartyCached, computeEnhancedPComplete)
const oldImport = "import { lookupCounterpartyCached, computeEnhancedPComplete } from './counterparty_lookup';\nimport type { CounterpartyStats } from './counterparty_lookup';";
if (src.includes(oldImport)) {
  src = src.replace(oldImport, '// TownHall stats fetched directly via /user-stats POST (no counterparty_lookup needed)');
  console.log('[Patch] 2/2 Removed unused counterparty_lookup import');
} else {
  console.log('[Patch] 2/2 counterparty_lookup import not found (already removed or different format)');
}

fs.writeFileSync(FILE, src, 'utf8');
console.log('[Patch] \u2705 Dashboard now calls /user-stats POST directly');
