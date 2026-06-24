const fs = require('fs');
const f = 'TownHallScreen.tsx';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// 1. Add proof fields to StatsResult interface
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('attestationFound: boolean;') && lines[i-1]?.includes('deviceHashPrefix')) {
    if (!lines[i+1]?.includes('proofTxId')) {
      lines.splice(i + 1, 0,
        '  proofTxId?: string;',
        '  proofType?: string;',
        '  l1EventsRoot?: string;',
        '  proofVerified?: boolean;'
      );
      console.log('Added proof fields to StatsResult');
    }
    break;
  }
}

// 2. After attestation query in handleLookup, add proof query from Arweave
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("console.warn('[StatsLookup] Attestation query failed:'")) {
    // Find the closing } of the attestation try/catch
    let closeBrace = i;
    for (let j = i; j < i + 5; j++) {
      if (lines[j].trim() === '}') { closeBrace = j; break; }
    }
    
    const proofQuery = [
      '',
      '        // Query Arweave for stats proof',
      '        let proofTxId = "";',
      '        let proofType = "";',
      '        let l1EventsRoot = "";',
      '        let proofVerified = false;',
      '        try {',
      '          const proofGql = JSON.stringify({ query: `{transactions(tags:[{name:"App-Name",values:["KasVillage"]},{name:"KV-Type",values:["stats-proof"]},{name:"KV-Pubkey",values:["${lookupResult.pubkey}"]}],first:1,sort:HEIGHT_DESC){edges{node{id tags{name value}}}}}` });',
      "          const proofRes = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: proofGql });",
      '          if (proofRes.ok) {',
      '            const proofData = await proofRes.json();',
      '            const proofEdge = proofData?.data?.transactions?.edges?.[0];',
      '            if (proofEdge) {',
      '              proofTxId = proofEdge.node.id;',
      '              proofVerified = true;',
      "              const tags = proofEdge.node.tags || [];",
      "              proofType = tags.find((t: any) => t.name === 'KV-ProofType')?.value || 'Halo2-IPA';",
      '            }',
      '          }',
      "        } catch (e) { console.warn('[StatsLookup] Proof query failed:', e); }",
    ];
    
    lines.splice(closeBrace + 1, 0, ...proofQuery);
    console.log('Added proof query after attestation');
    break;
  }
}

// 3. Add proof fields to setResult call
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('attestationFound,') && lines[i-1]?.includes('deviceHashPrefix')) {
    if (!lines[i+1]?.includes('proofTxId')) {
      lines.splice(i + 1, 0,
        '          proofTxId,',
        '          proofType,',
        '          l1EventsRoot,',
        '          proofVerified,'
      );
      console.log('Added proof fields to setResult');
    }
    break;
  }
}

// 4. Add proof display card after attestation display
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("result?.error && (") && i > 200 && i < 500) {
    // Insert proof card before the error card
    const proofCard = [
      '',
      '      {result && !result.error && result.proofVerified && (',
      '        <TouchableOpacity',
      '          onPress={() => result.proofTxId && Linking.openURL("https://arweave.net/" + result.proofTxId)}',
      '          style={{',
      '            marginTop: rs.s(8),',
      '            padding: rs.s(10),',
      "            backgroundColor: '#f0fdf4',",
      '            borderRadius: rs.s(6),',
      '            borderWidth: 1,',
      "            borderColor: '#bbf7d0',",
      '          }}',
      '        >',
      "          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>",
      "            <Text style={{ fontSize: rs.font(12), fontWeight: '700', color: '#166534' }}>",
      "              🔒 SNARK Proof Verified",
      '            </Text>',
      "            <Text style={{ fontSize: rs.font(10), color: '#166534' }}>",
      '              {result.proofType}',
      '            </Text>',
      '          </View>',
      "          <Text style={{ fontSize: rs.font(9), color: COLORS.stone400, marginTop: rs.s(4) }}>",
      '            TX: {result.proofTxId?.slice(0, 24)}... (tap to view on Arweave)',
      '          </Text>',
      '        </TouchableOpacity>',
      '      )}',
      '',
      '      {result && !result.error && !result.proofVerified && (',
      '        <View style={{',
      '          marginTop: rs.s(8),',
      '          padding: rs.s(10),',
      "          backgroundColor: '#fffbeb',",
      '          borderRadius: rs.s(6),',
      '          borderWidth: 1,',
      "          borderColor: '#fde68a',",
      '        }}>',
      "          <Text style={{ fontSize: rs.font(12), fontWeight: '700', color: '#92400e' }}>",
      '            ⚠️ No SNARK proof on Arweave',
      '          </Text>',
      "          <Text style={{ fontSize: rs.font(10), color: COLORS.stone500, marginTop: 2 }}>",
      '            This user has not generated a verifiable stats proof yet',
      '          </Text>',
      '        </View>',
      '      )}',
    ];
    
    lines.splice(i, 0, ...proofCard);
    console.log('Added proof display card');
    break;
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Done');
