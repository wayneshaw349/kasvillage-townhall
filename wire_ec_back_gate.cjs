// wire_ec_back_gate.cjs
//  1 Entertainment Center gets a clear "< Back" on the left of its header; it returns to where you came
//    from (Profile when opened from Profile, Dashboard otherwise). The small X on the right was hidden
//    under the floating dev-tools gear.
//  2 Publishing a game from a shelf book (built on the PC with make_chain) now runs the same content
//    blocker as NEW GAME before anything is sent - every publish path is checked on the phone.
const fs = require('fs');
const jobs = [
  { f: 'AppNaviagator.tsx', marker: 'KV_EC_FROM', edits: [
    ["\n          onNavigateEntertainment={() => setScreen('entertainment')}\n", "\n          onNavigateEntertainment={() => { (globalThis as any).__kvEcFrom = 'dashboard'; setScreen('entertainment'); }} /* KV_EC_FROM */\n"],
    ["\n        onNavigateEntertainment={() => setScreen('entertainment')}\n", "\n        onNavigateEntertainment={() => { (globalThis as any).__kvEcFrom = 'profile'; setScreen('entertainment'); }}\n"],
    ["        onNavigateBookshelf={() => setScreen('entertainment')}\n", "        onNavigateBookshelf={() => { (globalThis as any).__kvEcFrom = 'profile'; setScreen('entertainment'); }}\n"],
    ["      return <EntertainmentCenter\n        onClose={() => setScreen('dashboard')}", "      return <EntertainmentCenter\n        onClose={() => setScreen((((globalThis as any).__kvEcFrom) || 'dashboard') as any)}"],
  ]},
  { f: 'EntertainmentCenter.tsx', marker: 'KV_EC_BACK', edits: [
    ["        <View>\n          <Text style={styles.headerTitle}>\u{1F3AE} Entertainment Center</Text>",
     "        {onClose ? ( /* KV_EC_BACK */\n          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ paddingVertical: 6, paddingHorizontal: 12, marginRight: 10, borderRadius: 16, borderWidth: 1, borderColor: '#d6a54a', backgroundColor: '#2a2118' }}>\n            <Text style={{ color: '#f0c860', fontWeight: '800', fontSize: 14 }}>{'\\u2039 Back'}</Text>\n          </TouchableOpacity>\n        ) : null}\n        <View style={{ flex: 1 }}>\n          <Text style={styles.headerTitle}>\u{1F3AE} Entertainment Center</Text>"],
  ]},
  { f: 'Workspace.tsx', marker: 'KV_PUBLISH_CONTENT_GATE', edits: [
    ["      if (TRUSTED_GAMES[gameId] !== entry.head || entry.bundle.manifest.head !== entry.head) {",
     "      { // KV_PUBLISH_CONTENT_GATE: shelf books built on the PC get the same content blocker as NEW GAME\n        const _fr: any[] = (entry && entry.bundle && entry.bundle.frags) || [];\n        if (_fr.length) {\n          gadd('content check (text, images, code)…');\n          const _cb: any = require('./kv_build_chain').buildChainBundle(_fr.map((x: any) => x.text).join(''), gameId);\n          if (!_cb.ok) { (_cb.issues || []).forEach((x: string) => gadd('BLOCKED: ' + x)); gadd('nothing was sent'); setGbusy(''); return; }\n          gadd('content check passed');\n        }\n      }\n      if (TRUSTED_GAMES[gameId] !== entry.head || entry.bundle.manifest.head !== entry.head) {"],
  ]},
];
let ok = true; const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (let i = 0; i < j.edits.length; i++) { const c = s.split(j.edits[i][0]).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) { let s = j.s; for (const [a, b] of j.edits) s = s.split(a).join(b); fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s); console.log(j.f + ': patched'); }
console.log('DONE - Entertainment Center has < Back; shelf publishes run the content blocker first.');
