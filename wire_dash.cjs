const fs=require('fs');let s=fs.readFileSync('Dashboard.tsx','utf8');
s=s.replace('onNavigatePOBox?: () => void;','onNavigatePOBox?: () => void;\n  onNavigatePhoneProof?: () => void;');
s=s.replace('onNavigatePOBox,','onNavigatePOBox,\n  onNavigatePhoneProof,');
s=s.replace('onNavigatePOBox={onNavigatePOBox}','onNavigatePOBox={onNavigatePOBox}\n              onNavigatePhoneProof={onNavigatePhoneProof}');
s=s.replace(`      <TouchableOpacity style={walletStyles.actionBtn} onPress={onNavigateNeighbor}>
        <Text style={walletStyles.actionIcon}>{' '}</Text>
        <Text style={walletStyles.actionLabel}>Agreement</Text>
      </TouchableOpacity>`,`      <TouchableOpacity style={walletStyles.actionBtn} onPress={() => onNavigatePhoneProof?.()}>
        <Text style={walletStyles.actionIcon}>{' '}</Text>
        <Text style={walletStyles.actionLabel}>Phone Proof</Text>
      </TouchableOpacity>
      <TouchableOpacity style={walletStyles.actionBtn} onPress={onNavigateNeighbor}>
        <Text style={walletStyles.actionIcon}>{' '}</Text>
        <Text style={walletStyles.actionLabel}>Agreement</Text>
      </TouchableOpacity>`);
fs.writeFileSync('Dashboard.tsx',s);console.log('dash wired');
