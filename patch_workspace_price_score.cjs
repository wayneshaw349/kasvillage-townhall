const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');
let changes = 0;

// Replace the calcVisibilityScore function with enhanced price scoring
const oldCalc = `  // Visibility score (client-side mirror of TownHall algorithm)
  // Weights: 30% XP, 25% runway, 25% price, 10% pledge, 10% freshness
  const calcVisibilityScore = (xp: number, runwayPct: number, priceFactor: number, pledgeKas: number, ageHours: number) => {
    const xpScore = Math.min(xp / 5000, 1.0);
    const runwayScore = Math.min(runwayPct / 100, 1.0);
    const priceScore = priceFactor; // 0-1, lower price = higher score, free=1.0
    const pledgeScore = Math.min(pledgeKas / 2500, 1.0);
    const freshnessScore = Math.pow(0.5, ageHours / 24); // 24hr half-life
    const total = xpScore * 0.30 + runwayScore * 0.25 + priceScore * 0.25 + pledgeScore * 0.10 + freshnessScore * 0.10;
    return { total: Math.round(total * 100), xpScore: Math.round(xpScore * 100), runwayScore: Math.round(runwayScore * 100), priceScore: Math.round(priceScore * 100), pledgeScore: Math.round(pledgeScore * 100), freshnessScore: Math.round(freshnessScore * 100) };
  };`;

const newCalc = `  // Visibility score (client-side mirror of TownHall algorithm)
  // Weights: 30% XP, 25% runway, 25% price, 10% pledge, 10% freshness
  // Price score: low USD = good, KAS discount from USD = even better
  const calcVisibilityScore = (xp: number, runwayPct: number, avgUsdPrice: number, avgKasPrice: number, kasRateUsd: number, pledgeKas: number, ageHours: number, hasCoupons: boolean) => {
    const xpScore = Math.min(xp / 5000, 1.0);
    const runwayScore = Math.min(runwayPct / 100, 1.0);
    
    // Price score: two components
    // 1) Low USD base (50%) — $0=perfect, $500+=0
    const usdFactor = avgUsdPrice <= 0 ? 1.0 : Math.max(0, 1.0 - avgUsdPrice / 500);
    // 2) KAS discount from USD (50%) — if KAS price * rate < USD price, that's a discount
    let kasDiscountPct = 0;
    if (avgUsdPrice > 0 && avgKasPrice > 0 && kasRateUsd > 0) {
      const kasValueUsd = avgKasPrice * kasRateUsd;
      kasDiscountPct = Math.max(0, (avgUsdPrice - kasValueUsd) / avgUsdPrice); // 0-1
    }
    // Coupon bonus: +10% if store has active coupons
    const couponBonus = hasCoupons ? 0.1 : 0;
    const priceScore = Math.min((usdFactor * 0.5 + kasDiscountPct * 0.5 + couponBonus), 1.0);
    
    const pledgeScore = Math.min(pledgeKas / 2500, 1.0);
    const freshnessScore = Math.pow(0.5, ageHours / 24); // 24hr half-life
    const total = xpScore * 0.30 + runwayScore * 0.25 + priceScore * 0.25 + pledgeScore * 0.10 + freshnessScore * 0.10;
    return { total: Math.round(total * 100), xpScore: Math.round(xpScore * 100), runwayScore: Math.round(runwayScore * 100), priceScore: Math.round(priceScore * 100), pledgeScore: Math.round(pledgeScore * 100), freshnessScore: Math.round(freshnessScore * 100), kasDiscountPct: Math.round(kasDiscountPct * 100), usdFactor: Math.round(usdFactor * 100) };
  };`;

if (s.includes(oldCalc)) {
  s = s.replace(oldCalc, newCalc);
  changes++; console.log('1: Updated calcVisibilityScore with KAS discount');
} else {
  console.log('1: WARN - exact calc not found');
}

// Update the call site to pass real item data
const oldCall = "const vis = calcVisibilityScore(userXp, 80, coupons.length > 0 ? 0.8 : 0.5, 0, 1);";
const newCall = `const avgUsd = stash.length > 0 ? stash.reduce((s, i) => s + (i.dollarPrice || 0), 0) / stash.length : 0;
                const avgKas = stash.length > 0 ? stash.reduce((s, i) => s + (i.kaspaPrice || 0), 0) / stash.length : 0;
                const vis = calcVisibilityScore(userXp, 80, avgUsd, avgKas, 0.08, 0, 1, coupons.length > 0);`;

if (s.includes(oldCall)) {
  s = s.replace(oldCall, newCall);
  changes++; console.log('2: Updated call site with real item prices');
} else {
  console.log('2: WARN - call site not found');
}

// Update the Price row tip to explain the two components
const oldPriceTip = "{ label: 'Price (25%)', score: vis.priceScore, color: '#d97706', tip: 'Lower prices + coupons = higher score' },";
const newPriceTip = "{ label: 'Price (25%)', score: vis.priceScore, color: '#d97706', tip: 'Low USD (' + (vis.usdFactor || 0) + '%) + KAS discount (' + (vis.kasDiscountPct || 0) + '%) + coupons' },";

if (s.includes(oldPriceTip)) {
  s = s.replace(oldPriceTip, newPriceTip);
  changes++; console.log('3: Updated price tip with breakdown');
} else {
  console.log('3: WARN - price tip not found');
}

fs.writeFileSync(f, s);
console.log('\nTotal changes:', changes);

const v = fs.readFileSync(f, 'utf8');
console.log('Verify - kasDiscountPct:', v.includes('kasDiscountPct'));
console.log('Verify - usdFactor:', v.includes('usdFactor'));
console.log('Verify - kasRateUsd:', v.includes('kasRateUsd'));
console.log('Verify - couponBonus:', v.includes('couponBonus'));
console.log('Verify - avgUsd from stash:', v.includes('avgUsd'));
