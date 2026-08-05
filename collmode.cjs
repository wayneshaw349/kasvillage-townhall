const fs = require('fs');
const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');
if (s.includes('COLLATERAL-AUTODETECT')) throw new Error('already patched - abort');

function guard(anchor, want) {
  const n = s.split(anchor).length - 1;
  if (n !== want) throw new Error('anchor found ' + n + 'x (expected ' + want + '): ' + anchor.slice(0, 90));
}

// 1. paste-resume: dual-commitment => collateral, regardless of toggle
const R1 = "setAgreementType(collateralRef.current ? 'simple' : 'trade');";
guard(R1, 1);
const R2 = "if (collateralRef.current) { setReleaseMode('cancel'); console.log('[Resume] Collateral mode: cancel (2 outputs)'); }";
guard(R2, 1);

// 2. mode-selector banner (make the banner a 3-way toggle)
const BANNER = "{/* Release mode banner */}";
guard(BANNER, 1);
const BANNER_END = "</View>\n                      <View style={{ marginBottom: 10 }}>\n                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#1e40af', marginBottom: 2 }}>Confirmation / Receipt # (optional)</Text>";
let BE = BANNER_END;
if (s.split(BE).length - 1 !== 1) {
  BE = BANNER_END.replace(/\n/g, '\r\n');
  if (s.split(BE).length - 1 !== 1) throw new Error('banner-end anchor not found - abort');
}

fs.writeFileSync(F + '.bak_collmode', s);

s = s.replace(R1,
  "const _dualCommit = (_bAmt > 0 && _sAmt > 0); /* COLLATERAL-AUTODETECT: both parties committed => symmetric deposit */\n" +
  "                        const _isColl = collateralRef.current || _dualCommit;\n" +
  "                        setAgreementType(_isColl ? 'simple' : 'trade');");
s = s.replace(R2,
  "if (_isColl) { setReleaseMode('cancel'); console.log('[Resume] Collateral detected (' + (collateralRef.current ? 'toggle' : 'dual-commitment') + ') - mode: cancel (2 outputs)'); }");

// insert selector row after the banner view
const SELECTOR =
"</View>\n" +
"                      {/* MODE-SELECTOR: release/cancel/split always switchable before building */}\n" +
"                      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>\n" +
"                        {(['release','cancel','split'] as const).map((m) => (\n" +
"                          <TouchableOpacity key={m} disabled={templateBuilt} onPress={() => setReleaseMode(m)} style={{ flex: 1, padding: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: releaseMode === m ? '#059669' : '#d6d3d1', backgroundColor: releaseMode === m ? '#d1fae5' : '#fafaf9', opacity: templateBuilt ? 0.5 : 1 }}>\n" +
"                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: releaseMode === m ? '#065f46' : '#78716c' }}>{m === 'release' ? 'Release' : m === 'cancel' ? 'Return Both' : 'Split'}</Text>\n" +
"                          </TouchableOpacity>\n" +
"                        ))}\n" +
"                      </View>\n" +
"                      <View style={{ marginBottom: 10 }}>\n" +
"                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#1e40af', marginBottom: 2 }}>Confirmation / Receipt # (optional)</Text>";
s = s.replace(BE, SELECTOR);

fs.writeFileSync(F, s);
const v = fs.readFileSync(F, 'utf8');
if (!v.includes('COLLATERAL-AUTODETECT')) throw new Error('POST: autodetect missing');
if (!v.includes('MODE-SELECTOR')) throw new Error('POST: selector missing');
if (!v.includes("_isColl ? 'simple' : 'trade'")) throw new Error('POST: type wiring missing');
console.log('OK - collateral auto-detect on resume + 3-way mode selector at step 5 (.bak_collmode)');
