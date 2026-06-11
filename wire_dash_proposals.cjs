const fs = require("fs");
let s = fs.readFileSync("Dashboard.tsx", "utf8");
let fixes = 0;

// 1. Add proposal state fields to the stats useState
if (!s.includes('pendingProposals')) {
  s = s.replace(
    "loading: true,\n  });",
    "pendingProposals: 0,\n    acceptedProposals: 0,\n    loading: true,\n  });"
  );
  fixes++;
  console.log("  → proposal fields added to stats state");
}

// 2. Add proposal reading after TX history section in the refresh callback
const txHistoryEnd = "} catch (e) { console.warn('[DashStats] TX history error:', e); }";
if (s.includes(txHistoryEnd) && !s.includes('kv_proposals')) {
  s = s.replace(
    txHistoryEnd,
    txHistoryEnd + `

      // 5) Proposals: pending + accepted counts
      let pendingProposals = 0;
      let acceptedProposals = 0;
      try {
        const propJson = await SecureStore.getItemAsync('kv_proposals');
        if (propJson) {
          const proposals = JSON.parse(propJson);
          pendingProposals = proposals.filter((p: any) => p.status === 'proposed').length;
          acceptedProposals = proposals.filter((p: any) => p.status === 'accepted').length;
          console.log('[DashStats] Proposals — pending:', pendingProposals, 'accepted:', acceptedProposals);
        }
      } catch (e) { console.warn('[DashStats] Proposals error:', e); }`
  );
  fixes++;
  console.log("  → proposal reading added to refresh");
}

// 3. Add proposal values to setStats call
if (s.includes("storefronts: 0,") && !s.includes("pendingProposals,")) {
  s = s.replace(
    "storefronts: 0,",
    "storefronts: 0,\n        pendingProposals,\n        acceptedProposals,"
  );
  fixes++;
  console.log("  → proposal values added to setStats");
}

// 4. Add proposal rows to the Financial Summary card in the render
const spendableLine = `<Text style={{ color: "#888", fontSize: 14, fontWeight: "bold" }}>Spendable (free UTXOs)</Text>`;
if (s.includes(spendableLine) && !s.includes('Pending Proposals')) {
  const insertBefore = `<View style={{ height: 1, backgroundColor: "#333", marginVertical: 8 }} />\n        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>\n          <Text style={{ color: "#888", fontSize: 14, fontWeight: "bold" }}>Spendable (free UTXOs)</Text>`;
  
  const proposalRows = `{ds.pendingProposals > 0 && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
          <Text style={{ color: "#888", fontSize: 13 }}>Pending Proposals</Text>
          <Text style={{ color: "#F59E0B", fontSize: 13, fontWeight: "bold" }}>{ds.pendingProposals}</Text>
        </View>
        )}
        {ds.acceptedProposals > 0 && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
          <Text style={{ color: "#888", fontSize: 13 }}>Active Agreements</Text>
          <Text style={{ color: "#10B981", fontSize: 13, fontWeight: "bold" }}>{ds.acceptedProposals}</Text>
        </View>
        )}
        ` + insertBefore;
  
  s = s.replace(insertBefore, proposalRows);
  fixes++;
  console.log("  → proposal rows added to Financial Summary card");
}

fs.writeFileSync("Dashboard.tsx", s, "utf8");
console.log("done:", fixes, "patches applied");
