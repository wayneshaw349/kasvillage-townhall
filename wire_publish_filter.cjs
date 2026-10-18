// wire_publish_filter.cjs - the content blocker at PUBLISH time + relay sync.
// 1) content_filter.ts: scanTextStrict(), scanDescriptor -> strict, reason messages for adult/weapons/scam/gambling
// 2) Workspace.tsx: abstract, item, store publish use the strict filter (game descriptors via scanDescriptor)
// 3) VillageMailbox.tsx: dapp/game registry config check uses strict
// 4) src/main.rs: relay rules match the wallet (mnemonic needs context; adult, weapons, scam, drug slang, gambling)
const fs = require('fs');
const R = String.raw;
const jobs = [
  { f: 'content_filter.ts', marker: 'KV_PUBLISH_STRICT', edits: [
    ["export function scanDescriptor(game: any): ScanResult {\n  return scanObject(game);\n}",
     "// KV_PUBLISH_STRICT: publish + launch use the strict layer\nexport function scanDescriptor(game: any): ScanResult {\n  return scanObjectStrict(game);\n}\nexport function scanTextStrict(raw: string): ScanResult {\n  return scanObjectStrict({ text: String(raw || '') });\n}"],
    ["    case 'slur': return 'This content contains prohibited language.';\n",
     "    case 'slur': return 'This content contains prohibited language.';\n    case 'adult': return 'Adult content is not permitted.';\n    case 'weapons': return 'Weapons sales and conversions are not permitted.';\n    case 'scam': return 'This looks like a scam (giveaway, doubling, or key request).';\n    case 'gambling': return 'Gambling content is not permitted.';\n"],
  ]},
  { f: 'Workspace.tsx', marker: 'scanTextStrict', edits: [
    ["const { scanObject, reasonMessage } = require('./content_filter');\n      const _scan = scanObject(newAbstract);",
     "const { scanObjectStrict: scanObject, reasonMessage } = require('./content_filter');\n      const _scan = scanObject(newAbstract);"],
    ["const { scanText, reasonMessage } = require('./content_filter'); const _h = [scanText(itemForm.name)",
     "const { scanTextStrict: scanText, reasonMessage } = require('./content_filter'); const _h = [scanText(itemForm.name)"],
    ["const { scanObject, scanText, reasonMessage } = require('./content_filter');",
     "const { scanObjectStrict: scanObject, scanTextStrict: scanText, reasonMessage } = require('./content_filter');"],
  ]},
  { f: 'VillageMailbox.tsx', marker: 'KV_PUB_STRICT_MB', edits: [
    ["const { scanObject, reasonMessage } = require('./content_filter');\n",
     "const { scanObjectStrict: scanObject, reasonMessage } = require('./content_filter'); // KV_PUB_STRICT_MB\n"],
  ]},
  { f: 'src/main.rs', marker: 'KV_RELAY_STRICT', edits: [
    [R`        (Regex::new(r"(?i)\bmnemonic\b").unwrap(), "mnemonic", Severity::Critical),` + '\n',
     R`        (Regex::new(r"(?i)\bmnemonic\s+(phrase|words?|seed|code|backup)\b").unwrap(), "mnemonic", Severity::Critical),
        (Regex::new(r"(?i)\b(enter|type|paste|submit|share|send)\s+(your\s+|the\s+)?mnemonic\b").unwrap(), "mnemonic_solicit", Severity::Critical),` + '\n'],
    ["    ]\n});\n\n// Real-money gambling",
     R`        // KV_RELAY_STRICT: same categories as content_filter.ts scanObjectStrict
        (Regex::new(r"(?i)\b(porn|porno|nsfw|escort\s+service|escorts|nude\s+pics|sex\s+cam|cam\s+girl|onlyfans\s+leak)\b").unwrap(), "adult", Severity::Critical),
        (Regex::new(r"(?i)\b(ghost\s*guns?|auto\s+sear|glock\s+switch(es)?|unregistered\s+(firearm|gun)s?|untraceable\s+(firearm|gun)s?|explosives\s+for\s+sale|buy\s+explosives|pipe\s+bombs?|full\s+auto\s+conversion)\b").unwrap(), "weapons", Severity::Critical),
        (Regex::new(r"(?i)\b(send\s+\d+(\.\d+)?\s*kas\s+get\s+\d+|double\s+your\s+(kas|crypto|money)|guaranteed\s+(returns?|profit)|giveaway\s+send)\b").unwrap(), "scam", Severity::Critical),
        (Regex::new(r"(?i)\b(cocaine|coke|heroin|meth|crystal\s+meth|fentanyl|mdma|ecstasy|molly|xanax|oxy|oxycodone|percocet|percs|ketamine|lsd|shrooms)\b[^.!?]{0,25}\b(deals?|plug|menu|connect|wholesale|by\s+the\s+(gram|oz|ounce|pound)|grams?|zips?)\b").unwrap(), "illegal_trade", Severity::Critical),
        (Regex::new(r"(?i)\b(casino|sportsbook|roulette|sports\s+betting|bet\s+now|online\s+betting|slot\s+machines?|lottery\s+tickets?)\b").unwrap(), "gambling", Severity::Critical),
    ]
});

// Real-money gambling`],
  ]},
];
let ok = true; const staged = [];
for (const j of jobs) {
  if (!fs.existsSync(j.f)) { console.error(j.f + ': not found'); ok = false; continue; }
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (let i = 0; i < j.edits.length; i++) { const c = s.split(j.edits[i][0]).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) { let s = j.s; for (const [a, b] of j.edits) s = s.split(a).join(b); fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s); console.log(j.f + ': patched'); }
console.log('DONE - strict filter at publish (store, item, abstract, game, dapp) + relay synced. Relay needs cargo build + redeploy.');
