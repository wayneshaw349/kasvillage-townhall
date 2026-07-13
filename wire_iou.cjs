const fs=require('fs');let q=fs.readFileSync('QRPayNearby.tsx','utf8');
q=q.replace("<Text style={styles.title}>","{showIOUSheet && <IOUBalanceSheetShare visible={true} onClose={() => setShowIOUSheet(false)} />}\n        <Text style={styles.title}>");
fs.writeFileSync('QRPayNearby.tsx',q);console.log('done');
