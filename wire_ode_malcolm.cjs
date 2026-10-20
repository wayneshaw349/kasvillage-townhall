// wire_ode_malcolm.cjs - Bathroom/TradeFi page: Wayne Shaw's ode to Malcolm X in Kiswahili + English
//   node wire_ode_malcolm.cjs     (project folder; safe to run twice; backups *.bak_ode)
// Generated from a verified scratch tree. Each change is an exact, unique text replacement;
// a file is only written if ALL of its changes match, otherwise it is left untouched and reported.
const fs = require('fs');
const PLAN = [{"file":"TradeFiScreen.tsx","hunks":[["          \n          <Text style={styles.bantuText}>\n            \"Ingabe ukuthenga nokuthengisa izibopho kungcono kunokuvota?\"\n          </Text>\n          <Text style={[styles.bantuTranslation, { display: \"none\" }]}>\n            Kungenzeka ukuthi ukuthenga nokuthengisa amabhondi kungcono kunokuvota? (isiZulu)\n          </Text>\n          <Text style={styles.bantuAuthor}>— othile ofuna ukuba ngumuntu obalulekile</Text>\n        </View>\n\n        {/* Multi-Bond DCA Calculator */}\n        <View style={styles.calculatorBox}>\n          <Text style={styles.calculatorTitle}>📊 Multi-Bond DCA Calculator</Text>\n\n          <View style={styles.inputGroup}>\n            <Text style={styles.inputLabel}>TOTAL MONTHLY INVESTMENT ($)</Text>","          \n          <Text style={styles.bantuText}>\n            \"Ingabe ukuthenga nokuthengisa izibopho kungcono kunokuvota?\"\n          </Text>\n          <Text style={[styles.bantuTranslation, { display: \"none\" }]}>\n            Kungenzeka ukuthi ukuthenga nokuthengisa amabhondi kungcono kunokuvota? (isiZulu)\n          </Text>\n          <Text style={styles.bantuAuthor}>— othile ofuna ukuba ngumuntu obalulekile</Text>\n\n          <View style={styles.bantuDivider} />\n\n          {/* KV_ODE_MALCOLM_X */}\n          <Text style={styles.bantuText}>\n            \"Kura, au hati fungani kati ya nchi na raia wake.\"\n          </Text>\n          <Text style={styles.bantuTranslation}>\n            \"A ballot, or a bond between a country and its citizens.\" (Kiswahili)\n          </Text>\n          <Text style={styles.bantuAuthor}>— Wayne Shaw, heshima kwa Malcolm X</Text>\n        </View>\n\n        {/* Multi-Bond DCA Calculator */}\n        <View style={styles.calculatorBox}>\n          <Text style={styles.calculatorTitle}>📊 Multi-Bond DCA Calculator</Text>\n\n          <View style={styles.inputGroup}>\n            <Text style={styles.inputLabel}>TOTAL MONTHLY INVESTMENT ($)</Text>"]]}];
const ADDS = [];
let okF = 0, skipF = 0, badF = 0;
for (const p of PLAN) {
  if (!fs.existsSync(p.file)) { console.log('  MISSING ' + p.file); badF++; continue; }
  const raw = fs.readFileSync(p.file, 'utf8'); const CRLF = raw.includes('\r\n'); let s = raw.replace(/\r\n/g, '\n');
  if (p.hunks.every(([o, n]) => s.split(n).length - 1 >= 1 && (o === n || !s.includes(o)))) { console.log('  skip  ' + p.file + ' (already done)'); skipF++; continue; }
  let fail = '';
  for (const [o, n] of p.hunks) { const c = s.split(o).length - 1; if (c !== 1) { fail = 'change ' + (p.hunks.indexOf(p.hunks.find((h) => h[0] === o)) + 1) + ' matched ' + c + 'x'; break; } s = s.replace(o, () => n); }
  if (fail) { console.log('  FAIL  ' + p.file + ' - ' + fail + ' (file left unchanged)'); badF++; continue; }
  fs.copyFileSync(p.file, p.file + '.bak_ode'); fs.writeFileSync(p.file, CRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('  ok    ' + p.file + ' (' + p.hunks.length + ' changes)'); okF++;
}
for (const a of ADDS) { if (fs.existsSync(a.file)) { console.log('  skip  ' + a.file + ' (exists)'); continue; } fs.mkdirSync(require('path').dirname(a.file), { recursive: true }); fs.writeFileSync(a.file, a.body, 'utf8'); console.log('  new   ' + a.file); }
console.log('\n' + okF + ' files patched, ' + skipF + ' already done, ' + badF + ' failed' + (badF ? '  <- send me this output' : ''));
