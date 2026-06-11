const fs = require("fs");
let s = fs.readFileSync("Dashboard.tsx", "utf8");
let fixes = 0;

// 1. Add import for getFinancialSummary
if (!s.includes('getFinancialSummary')) {
  s = s.replace(
    "import AsyncStorage from '@react-native-async-storage/async-storage';",
    "import AsyncStorage from '@react-native-async-storage/async-storage';\nimport { getFinancialSummary } from './proposal_share';"
  );
  fixes++;
  console.log("  → getFinancialSummary import added");
}

// 2. Add financial state after existing useState declarations
// Find the last useState in Dashboard component
const stateAnchor = s.indexOf("const [showIOUModal, setShowIOUModal]");
if (stateAnchor === -1) {
  // Try alternative anchor - find any useState near the top of the component
  const altAnchor = s.indexOf("// ============================================================================\n// RENDER");
  if (altAnchor > -1 && !s.includes('financialSummary')) {
    // Add state before render section
    s = s.slice(0, altAnchor) +
      `// Financial Summary state
  const [financialSummary, setFinancialSummary] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const addr = await SecureStore.getItemAsync('kaspa_address');
        if (addr) {
          const summary = await getFinancialSummary(addr);
          setFinancialSummary(summary);
        }
      } catch (e) { console.warn('[DashFinance]', e); }
    })();
  }, []);

  ` + s.slice(altAnchor);
    fixes++;
    console.log("  → financial state + useEffect added (alt anchor)");
  }
} else if (!s.includes('financialSummary')) {
  const lineEnd = s.indexOf('\n', stateAnchor);
  s = s.slice(0, lineEnd + 1) +
    `  const [financialSummary, setFinancialSummary] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const addr = await SecureStore.getItemAsync('kaspa_address');
        if (addr) {
          const summary = await getFinancialSummary(addr);
          setFinancialSummary(summary);
        }
      } catch (e) { console.warn('[DashFinance]', e); }
    })();
  }, []);

` + s.slice(lineEnd + 1);
  fixes++;
  console.log("  → financial state + useEffect added");
}

// 3. Add financial summary card to the render
// Find a good anchor point in the JSX - look for PayNearby or a navigation button
const payNearbyBtn = s.indexOf("PayNearby");
const navAnchor = s.indexOf("onNavigateProfile");

if (navAnchor > -1 && !s.includes('Financial Summary')) {
  // Find the closing tag area near navigation buttons and insert before it
  // Look for a View closing tag after the nav section
  const insertPoint = s.lastIndexOf("{/* Center text overlay", navAnchor);
  
  if (insertPoint > -1) {
    // Insert before the center text overlay
    s = s.slice(0, insertPoint) +
      `{/* Financial Summary Card */}
              {financialSummary && (financialSummary.pendingProposals > 0 || financialSummary.acceptedProposals > 0 || financialSummary.committedKAS > 0) && (
                <View style={{ backgroundColor: '#1A1A2E', borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: '#333' }}>
                  <Text style={{ color: '#D4AF37', fontSize: 14, fontWeight: '700', marginBottom: 8 }}>Financial Summary</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: '#888', fontSize: 12 }}>Spendable</Text>
                    <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '600' }}>{financialSummary.spendableKAS.toFixed(2)} KAS</Text>
                  </View>
                  {financialSummary.committedKAS > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: '#888', fontSize: 12 }}>Collateral</Text>
                      <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '600' }}>{financialSummary.committedKAS.toFixed(2)} KAS</Text>
                    </View>
                  )}
                  {financialSummary.iouAllocatedKAS > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: '#888', fontSize: 12 }}>IOU Allocated</Text>
                      <Text style={{ color: '#3B82F6', fontSize: 12, fontWeight: '600' }}>{financialSummary.iouAllocatedKAS.toFixed(2)} KAS</Text>
                    </View>
                  )}
                  {financialSummary.pendingProposals > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: '#888', fontSize: 12 }}>Pending Proposals</Text>
                      <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '600' }}>{financialSummary.pendingProposals}</Text>
                    </View>
                  )}
                  {financialSummary.acceptedProposals > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#888', fontSize: 12 }}>Active Agreements</Text>
                      <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '600' }}>{financialSummary.acceptedProposals}</Text>
                    </View>
                  )}
                </View>
              )}
              ` + s.slice(insertPoint);
    fixes++;
    console.log("  → Financial Summary card added to Dashboard");
  } else {
    console.log("  ⚠️ Could not find insert point for summary card");
  }
}

fs.writeFileSync("Dashboard.tsx", s, "utf8");
console.log("done:", fixes, "patches applied");
