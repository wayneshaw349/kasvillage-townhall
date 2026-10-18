// fix_trafficking.cjs - human + child trafficking coverage, wallet AND relay.
// Wallet (content_filter.ts strict layer) gets the relay's child-exploitation rules plus new ones;
// relay (src/main.rs) gets the new ones. Same rules both sides.
const fs = require('fs');
const R = String.raw;
const TS_RULE = R`  ['trafficking', /\b((child|children|kid|kids|minor|minors|human|people|baby|babies|organ)\s+(trafficking|smuggling|trade)|human\s+smuggling|people\s+smuggling|forced\s+(labor|labour|prostitution|marriage)|debt\s+bondage|slaves?\s+(for\s+sale|trade|market|auction)|(buy|buying|purchase)\s+(a\s+)?(slave|slaves|bride|wife)\b|(child|children|kid|kids|baby|babies|girl|girls|boy|boys|woman|women|wife|wives|bride|brides|person|people|human|humans|slave|slaves|worker|workers|maid|maids)\s+(for\s+sale|for\s+sell|available\s+for\s+purchase)|(sex|slave|traffic)\s*(child|minor|girl|boy|teen|kid)s?\b|(child|minor|teen|kid)\s*(sex|slave|traffic|bride|groom)s?\b)/],` + '\n';
const RS_RULE = R`        (Regex::new(r"(?i)\b((child|children|kid|kids|minor|minors|human|people|baby|babies|organ)\s+(trafficking|smuggling|trade)|human\s+smuggling|people\s+smuggling|forced\s+(labor|labour|prostitution|marriage)|debt\s+bondage|slaves?\s+(for\s+sale|trade|market|auction)|(buy|buying|purchase)\s+(a\s+)?(slave|slaves|bride|wife)\b|(child|children|kid|kids|baby|babies|girl|girls|boy|boys|woman|women|wife|wives|bride|brides|person|people|human|humans|slave|slaves|worker|workers|maid|maids)\s+(for\s+sale|for\s+sell|available\s+for\s+purchase))").unwrap(), "trafficking_kv", Severity::Critical),` + '\n';
const jobs = [
  { f: 'content_filter.ts', marker: 'KV_TRAFFICKING', edits: [
    ["  ['gambling', /\\b(casino|", "  // KV_TRAFFICKING\n" + TS_RULE + "  ['gambling', /\\b(casino|"],
    ["    case 'gambling': return 'Gambling content is not permitted.';\n", "    case 'gambling': return 'Gambling content is not permitted.';\n    case 'trafficking': return 'This content cannot be published or displayed.';\n"],
  ]},
  { f: 'src/main.rs', marker: 'trafficking_kv', edits: [
    ["        // KV_RELAY_STRICT: same categories as content_filter.ts scanObjectStrict\n", "        // KV_RELAY_STRICT: same categories as content_filter.ts scanObjectStrict\n" + RS_RULE],
  ]},
];
let ok = true; const staged = [];
for (const j of jobs) {
  if (!fs.existsSync(j.f)) { console.error(j.f + ': not found'); ok = false; continue; }
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (let i = 0; i < j.edits.length; i++) { const c = s.split(j.edits[i][0]).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1 (run wire_publish_filter.cjs first).'); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) { let s = j.s; for (const [a, b] of j.edits) s = s.split(a).join(b); fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s); console.log(j.f + ': patched'); }
const tf = 'test_content_filter.cjs';
if (fs.existsSync(tf)) {
  let t = fs.readFileSync(tf, 'utf8'); const tC = t.includes('\r\n'); if (tC) t = t.replace(/\r\n/g, '\n');
  const a = "  ['ok', 'board game shop', { n: 'KasCity board game' }, A],\n";
  if (!t.includes('KV_TRAFFIC_CASES') && t.split(a).length - 1 === 1) {
    t = t.replace(a, a + "  // KV_TRAFFIC_CASES\n" +
      "  ['trafficking', 'human trafficking', { d: 'human trafficking network' }, B],\n" +
      "  ['trafficking', 'child trafficking', { d: 'child trafficking ring' }, B],\n" +
      "  ['trafficking', 'people for sale', { n: 'girls for sale' }, B],\n" +
      "  ['trafficking', 'child bride', { d: 'child bride arranged' }, B],\n" +
      "  ['trafficking', 'forced labor', { d: 'forced labor workers cheap' }, B],\n" +
      "  ['trafficking', 'human smuggling', { d: 'human smuggling across border' }, B],\n" +
      "  ['trafficking', 'buy a slave', { d: 'buy a slave today' }, B],\n" +
      "  ['trafficking', 'organ trade', { d: 'kidney organ trade' }, B],\n" +
      "  ['trafficking', 'leet traffick', { d: 'ch1ld tr4ff1ck1ng' }, B],\n" +
      "  ['ok', 'kids clothes', { n: 'Kids clothes for sale' }, A],\n" +
      "  ['ok', 'baby stroller', { n: 'Baby stroller for sale' }, A],\n" +
      "  ['ok', 'anti-trafficking charity', { d: 'Donate to fight trafficking' }, A],\n" +
      "  ['ok', 'bridal shop', { n: 'Bride dresses and bridal veils' }, A],\n" +
      "  ['ok', 'workers co-op', { n: 'Workers co-op bakery' }, A],\n");
    fs.writeFileSync(tf, tC ? t.replace(/\n/g, '\r\n') : t); console.log(tf + ': 14 cases added');
  }
}
console.log('DONE - run: node test_content_filter.cjs   (relay: cargo build + redeploy)');
