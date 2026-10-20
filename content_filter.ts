// content_filter.ts
// ============================================================================
// One ruleset, three call sites:
//   publish-side  - Workspace, before the pledge tx is built
//   display-side  - Mailbox / EntertainmentCenter, after fetchStoreConfig
//   server-side   - TownHall mirrors these lists in Rust
//
// Display-side is the one that matters. Anyone can write to a registry address
// without going through this app, so publish-side is a courtesy to our own
// users, not a defense.
//
// Scope: TEXT ONLY. Code-shaped attacks are already handled by the engine's
// validate() (forbidden keys, closed vocabulary). This covers what validate()
// cannot see: strings rendered straight to a player.
// ============================================================================

export interface ScanResult {
  ok: boolean;
  reason?: string;
  /** Where the offending string lives, e.g. "nodes[12].bt...args[1]". */
  path?: string;
}

// ---------------------------------------------------------------------------
// Credential phishing. The highest-value category: a scene that renders
// "Enter your seed phrase to claim 500 KAS" costs a real person real money,
// and nothing else in the stack looks at prompt text.
// ---------------------------------------------------------------------------
const PHISH: RegExp[] = [
  /\bseed\s*phrase\b/i,
  /\brecovery\s*phrase\b/i,
  /\bmnemonic\s+(phrase|words?|seed|code|backup)\b/i, // KV_PHISH_FP: was any mnemonic
  /\b(enter|type|paste|submit|share|send)\s+(your\s+|the\s+)?mnemonic\b/i,
  /\bprivate\s*key\b/i,
  /\bsecret\s*key\b/i,
  /\bwallet\s*(password|pin|passphrase)\b/i,
  /\b(12|24)[\s-]*words?\b[^.!?]{0,30}\b(phrase|seed|recovery|backup|wallet)\b/i, // KV_PHISH_FP: was any 12/24 words
  /\b(enter|type|paste|submit|share|send)\s+(your\s+|the\s+)?(12|24)[\s-]*words?\b/i,
  /\benter\s+your\s+(key|phrase|password|pin)\b/i,
  /\bverify\s+your\s+wallet\b/i,
  /\bconnect\s+your\s+wallet\s+to\s+claim\b/i,
  /\bvalidate\s+your\s+(wallet|account)\b/i,
  /\bimport\s+your\s+wallet\b/i,
  /\bsync\s+your\s+wallet\b/i,
  /\bclaim\s+your\s+airdrop\b/i,
  /\bdouble\s+your\s+(kas|balance|funds)\b/i,
  /\bsend\s+\d+\s*kas\s+to\s+receive\b/i,
];

// ---------------------------------------------------------------------------
// Threats and harassment directed at a person.
// ---------------------------------------------------------------------------
const THREAT: RegExp[] = [
  /\bkill\s+your\s*self\b/i,
  /\bkys\b/i,
  /\bi\s+will\s+(kill|hurt|find|rape)\s+you\b/i,
  /\byou\s+should\s+die\b/i,
];

// ---------------------------------------------------------------------------
// Sexual content involving minors. Zero tolerance, no context exemption.
// Deliberately broad: a false positive costs an author one word, a false
// negative is permanent and unremovable once inscribed.
// ---------------------------------------------------------------------------
const CSAM: RegExp[] = [
  /\b(child|kid|minor|underage|preteen|teen|toddler|infant|schoolgirl|schoolboy|loli|shota)\b[^.!?]{0,40}\b(sex|sexual|nude|naked|porn|erotic|fuck|rape|molest|strip)\b/i,
  /\b(sex|sexual|nude|naked|porn|erotic|fuck|rape|molest|strip)\b[^.!?]{0,40}\b(child|kid|minor|underage|preteen|teen|toddler|infant|schoolgirl|schoolboy|loli|shota)\b/i,
  /\bcp\s*(trade|swap|link|drop)\b/i,
];

// ---------------------------------------------------------------------------
// Real-money gambling. Mirrors TownHall's GAME_PROHIBITED_PATTERNS: the ban is
// gambling WITH REAL MONEY, never the vocabulary of card games -- a poker
// descriptor or a "wager" mechanic in a board game is legitimate content.
// ---------------------------------------------------------------------------
// Illegal trade — act-based (verb + item), mirrors TownHall PROHIBITED merge.
// Plain "gun"/"knife" must pass; solicitation to buy/sell must not.
const ILLEGAL_TRADE: RegExp[] = [
  /\b(buy|sell|order|purchase)\s+(a\s+|an\s+|some\s+)?(gun|guns|firearm|firearms|rifle|rifles|pistol|pistols|shotgun|shotguns|ammo|ammunition)\b/i,
  /\b(buy|sell|order|purchase|ship|deliver|source|supply|score)\s+(a\s+|an\s+|some\s+)?(cocaine|crack|heroin|meth|methamphetamine|fentanyl|carfentanil|mdma|ecstasy|molly|lsd|ketamine|pcp|dmt|oxycontin|oxycodone|percocet|percs|xanax|xannies|adderall|vicodin|hydrocodone|codeine|opioids?|opiates?|shrooms|psilocybin|ghb|rohypnol|roofies)\b/i,
  /\b(cocaine|crack|heroin|meth|methamphetamine|fentanyl|carfentanil|mdma|ecstasy|molly|lsd|ketamine|pcp|dmt|oxycontin|oxycodone|percocet|percs|xanax|xannies|adderall|vicodin|hydrocodone|codeine|opioids?|opiates?|shrooms|psilocybin|ghb|rohypnol|roofies)\s+(for\s+sale|available|in\s+stock|shipped|delivered)\b/i,
  /\b(sex\s+trafficking|labor\s+trafficking|organ\s+(sale|trade|harvest))\b/i,
  /\b(illegal\s+weapon|ghost\s*gun|unregistered\s+(gun|firearm))\b/i,
  /\b(drug\s+dealer|narcotics\s+for\s+sale|controlled\s+substance)\b/i,
  /\b(human\s+trafficking|sex\s+trade|flesh\s+trade)\b/i,
];
const GAMBLING: RegExp[] = [
  /real[\s_-]*money[\s_-]*(bet|wager|gambl)/i,
  /(deposit|withdraw)[^.!?]{0,30}(usd|eur|gbp|cad|aud|fiat)\b/i,
  /cash[\s_-]*out[\s_-]*winnings/i,
  /loot[\s_-]*box[^.!?]{0,20}(\$|pay|buy|purchase)/i,
  /gacha[^.!?]{0,20}(pay|\$|purchase)/i,
  /(buy|purchase)[\s_-]*(gems|coins|crystals)[\s_-]*\$/i,
  /guaranteed[\s_-]*(win|payout|return)/i,
  /(rigged|fixed)[\s_-]*(odds|game|outcome)/i,
];

// ---------------------------------------------------------------------------
// Slurs. Kept as an external list so it can be updated without touching logic.
// Populate from a maintained source; the matcher below is what matters.
// Entries are matched whole-word, case-insensitive, after homoglyph folding.
// ---------------------------------------------------------------------------
const SLURS: string[] = [
  // intentionally left for you to populate from a maintained list
];

// ---------------------------------------------------------------------------
// Evasion hardening. "s33d phr4se" and "ѕeed" (Cyrillic s) must not slip past.
// ---------------------------------------------------------------------------
const HOMOGLYPH: Record<string, string> = {
  '\u0430': 'a', '\u0435': 'e', '\u043e': 'o', '\u0440': 'p', '\u0441': 'c',
  '\u0445': 'x', '\u0443': 'y', '\u0456': 'i', '\u0455': 's', '\u04bb': 'h',
  '\u03bf': 'o', '\u03b1': 'a', '\u03c1': 'p', '\u0261': 'g',
};
const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i',
};

function fold(s: string): string {
  let out = '';
  // NFKD splits accented forms so combining marks can be dropped.
  const n = s.normalize ? s.normalize('NFKD') : s;
  for (const ch of n) {
    if (ch >= '\u0300' && ch <= '\u036f') continue;       // combining marks
    if (ch === '\u200b' || ch === '\u200c' || ch === '\u200d' || ch === '\ufeff') continue; // zero-width
    const lower = ch.toLowerCase();
    out += HOMOGLYPH[lower] || LEET[lower] || lower;
  }
  // collapse repeats and separators used to break up words: s-e-e-d, s.e.e.d
  return out.replace(/[\s._\-*]+/g, ' ').replace(/(.)\1{2,}/g, '$1$1');
}

const slurRe = SLURS.length
  ? new RegExp('\\b(' + SLURS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'i')
  : null;

// ---------------------------------------------------------------------------
// Mixed-script detection. A single word mixing Latin with Cyrillic/Greek is
// the signature of confusable spoofing ("p\u0430ypal", "\u0455eed") and kills the
// entire evasion class rather than the lookalikes enumerated in HOMOGLYPH.
// Whole-word foreign text passes; accents are stripped by NFKD first, so
// "caf\u00e9" never trips this.
// ---------------------------------------------------------------------------
function scriptOf(ch: string): number {
  const c = ch.codePointAt(0)!;
  if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) return 1; // Latin
  if (c >= 0x0370 && c <= 0x03ff) return 2; // Greek
  if (c >= 0x0400 && c <= 0x04ff) return 3; // Cyrillic
  return 0; // digits, punctuation, CJK, everything else: neutral
}

function hasMixedScriptWord(raw: string): boolean {
  const n = raw.normalize ? raw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '') : raw;
  for (const word of n.split(/[^\p{L}]+/u)) {
    let seen = 0;
    for (const ch of word) {
      const sc = scriptOf(ch);
      if (!sc) continue;
      if (seen && sc !== seen) return true;
      seen = sc;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// KV_ENTITY_DECODE: markup evasion. "s<b></b>eed phrase", "seed&nbsp;phrase"
// and "&#115;eed phrase" render as the blocked words. Decode entities and
// strip tags WITHOUT inserting spaces as an extra scan pass.
// ---------------------------------------------------------------------------
const KV_NAMED_ENT: Record<string, string> = {
  nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  shy: '', zwj: '', zwnj: '', lrm: '', rlm: '', period: '.', comma: ',', colon: ':', sol: '/', hyphen: '-', dash: '-',
};
export function decodeHtmlEntities(s: string): string {
  let out = String(s || '');
  // up to 3 rounds so &amp;#115; style double-encoding is caught; bounded
  for (let round = 0; round < 3; round++) {
    const next = out.replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z][a-z0-9]{1,15});?/gi, (m, e: string) => {
      if (e[0] === '#') {
        const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        if (!isFinite(cp) || cp < 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return '';
        if (cp === 0xa0) return ' ';
        try { return String.fromCodePoint(cp); } catch { return ''; }
      }
      const v = KV_NAMED_ENT[e.toLowerCase()];
      return v !== undefined ? v : m;
    });
    if (next === out) break;
    out = next;
  }
  return out.replace(/\u00a0/g, ' ');
}
// KV_TIGHT_ALL: the tight form removes EVERY tag with no space. An allow-list of
// "inline" tags was always incomplete (label, nobr, img, custom elements, CSS
// display:inline on anything). The spaced form (tags -> ' ') is scanned too, so
// words split across block tags are still read both ways.
export function stripTagsTight(s: string): string {
  return String(s || '').replace(/<!--[\s\S]*?(-->|$)/g, '').replace(/<[^>]*>/g, '');
}
/** Tags -> one space (the "spaced" form). */
export function stripTagsSpaced(s: string): string {
  return String(s || '').replace(/<!--[\s\S]*?(-->|$)/g, ' ').replace(/<[^>]*>/g, ' ');
}
/** Tag-stripped, entity-decoded forms of markup text: [spaced, tight]. */
export function htmlTextForms(html: string): string[] {
  const body = String(html || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const spaced = decodeHtmlEntities(stripTagsSpaced(body)).replace(/\s+/g, ' ');
  const tight = decodeHtmlEntities(stripTagsTight(body)).replace(/\s+/g, ' ');
  return spaced === tight ? [spaced] : [spaced, tight];
}

/** Scan a single string. Runs against both the raw and folded forms. */
export function scanText(raw: string): ScanResult {
  if (typeof raw !== 'string' || !raw) return { ok: true };
  if (hasMixedScriptWord(raw)) return { ok: false, reason: 'mixed_script' };
  const forms = [raw, fold(raw)];
  if (/[<&]/.test(raw)) { // KV_ENTITY_DECODE
    for (const dec of [decodeHtmlEntities(stripTagsTight(raw)), decodeHtmlEntities(stripTagsSpaced(raw))]) {
      if (dec === raw || forms.indexOf(dec) >= 0) continue;
      if (hasMixedScriptWord(dec)) return { ok: false, reason: 'mixed_script' };
      forms.push(dec, fold(dec));
    }
  }
  for (const s of forms) {
    for (const re of CSAM) if (re.test(s)) return { ok: false, reason: 'child_safety' };
    for (const re of PHISH) if (re.test(s)) return { ok: false, reason: 'credential_phishing' };
    for (const re of THREAT) if (re.test(s)) return { ok: false, reason: 'threat' };
    for (const re of GAMBLING) if (re.test(s)) return { ok: false, reason: 'real_money_gambling' };
    for (const re of ILLEGAL_TRADE) if (re.test(s)) return { ok: false, reason: 'illegal_trade' };
    if (slurRe && slurRe.test(s)) return { ok: false, reason: 'slur' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Walk any object and scan every string value AND every key. Keys matter:
// a material named after a slur renders nowhere but ships forever.
// ---------------------------------------------------------------------------
export function scanObject(obj: any, maxDepth = 64): ScanResult { // KV_DEPTH_64: was 24
  const seen = new Set<any>();
  let hit: ScanResult | null = null;

  (function walk(o: any, path: string, depth: number) {
    if (hit || o == null || depth > maxDepth) return;
    if (typeof o === 'string') {
      const r = scanText(o);
      if (!r.ok) hit = { ok: false, reason: r.reason, path };
      return;
    }
    if (typeof o !== 'object') return;
    if (seen.has(o)) return;
    seen.add(o);
    if (Array.isArray(o)) {
      for (let i = 0; i < o.length && !hit; i++) walk(o[i], path + '[' + i + ']', depth + 1);
      return;
    }
    for (const k of Object.keys(o)) {
      if (hit) return;
      const kr = scanText(k);
      if (!kr.ok) { hit = { ok: false, reason: kr.reason, path: path + '.' + k + ' (key)' }; return; }
      walk(o[k], path + '.' + k, depth + 1);
    }
  })(obj, '', 0);

  return hit || { ok: true };
}

/** Convenience wrapper for game descriptors. Same walk, clearer call site. */
// KV_PUBLISH_STRICT: publish + launch use the strict layer
export function scanDescriptor(game: any): ScanResult {
  return scanObjectStrict(game);
}
export function scanTextStrict(raw: string): ScanResult {
  return scanObjectStrict({ text: String(raw || '') });
}

/** Human-facing message. Deliberately vague on child_safety: never echo the match. */
export function reasonMessage(reason?: string): string {
  if (reason === 'illegal_trade') return 'This text solicits an illegal sale and cannot be published.';
  switch (reason) {
    case 'child_safety': return 'This content cannot be published or displayed.';
    case 'credential_phishing': return 'This content asks for wallet credentials. No legitimate game or store does this.';
    case 'threat': return 'This content contains threatening language.';
    case 'real_money_gambling': return 'Real-money gambling content is not permitted.';
    case 'mixed_script': return 'This content mixes character sets within a word, a signature of spoofed text.';
    case 'slur': return 'This content contains prohibited language.';
    case 'adult': return 'Adult content is not permitted.';
    case 'weapons': return 'Weapons sales and conversions are not permitted.';
    case 'scam': return 'This looks like a scam (giveaway, doubling, or key request).';
    case 'gambling': return 'Gambling content is not permitted.';
    case 'trafficking': return 'This content cannot be published or displayed.';
    default: return 'This content did not pass review.';
  }
}

// KV_FILTER_STRICT: extra reader-side rules on top of scanObject (word-boundary, leet-normalized)
const KV_LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };
function kvNormalize(t: string): string {
  return String(t || '').toLowerCase().replace(/[013457@$!]/g, (c) => KV_LEET[c] || c).replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}
const KV_STRICT_RULES: Array<[string, RegExp]> = [
  ['adult', /\b(porn|porno|xxx|nsfw|escort service|escorts|hookup|nude pics|sex cam|cam girl|onlyfans leak)\b/],
  ['weapons', /\b(ghost guns?|auto sears?|glock switch(es)?|unregistered (firearm|gun)s?|untraceable (firearm|gun)s?|explosives for sale|buy explosives|pipe bombs?|grenades?|full auto conversion)\b/],
  ['scam', /\b(send \d+(\.\d+)? ?kas get \d+|double your (kas|crypto|money)|guaranteed (returns?|profit)|seed phrase|recovery phrase|private key|airdrop claim|giveaway send)\b/],
  ['illegal_trade', /\b(cocaine|coke|heroin|meth|crystal meth|fentanyl|mdma|ecstasy|molly|xanax|oxy|oxycodone|percocet|percs|ketamine|lsd|shrooms)\b[^.!?]{0,25}\b(deals?|plug|menu|connect|wholesale|by the (gram|oz|ounce|pound)|grams?|zips?)\b/],
  // KV_TRAFFICKING
  ['trafficking', /\b((child|children|kid|kids|minor|minors|human|people|baby|babies|organ)\s+(trafficking|smuggling|trade)|human\s+smuggling|people\s+smuggling|forced\s+(labor|labour|prostitution|marriage)|debt\s+bondage|slaves?\s+(for\s+sale|trade|market|auction)|(buy|buying|purchase)\s+(a\s+)?(slave|slaves|bride|wife)\b|(child|children|kid|kids|baby|babies|girl|girls|boy|boys|woman|women|wife|wives|bride|brides|person|people|human|humans|slave|slaves|worker|workers|maid|maids)\s+(for\s+sale|for\s+sell|available\s+for\s+purchase)|(sex|slave|traffic)\s*(child|minor|girl|boy|teen|kid)s?\b|(child|minor|teen|kid)\s*(sex|slave|traffic|bride|groom)s?\b)/],
  ['gambling', /\b(casino|sportsbook|roulette|sports betting|bet now|online betting|slot machines?|lottery tickets?)\b/],
];
function kvSquash(n: string): string {
  // join runs of single-character tokens: 's e e d p h r a s e' -> 'seedphrase'
  const t = n.split(' '); const o: string[] = []; let run = '';
  for (const w of t) { if (w.length === 1) run += w; else { if (run) { o.push(run); run = ''; } o.push(w); } }
  if (run) o.push(run);
  return o.join(' ');
}
function kvWalkStrings(o: any, path: string, out: Array<[string, string]>, depth: number = 0) {
  if (depth > 64 || o == null || out.length > 200000) return; // KV_DEPTH_64: was 8 - nested strings went unscanned
  if (typeof o === 'string') { out.push([path, o]); return; }
  if (Array.isArray(o)) { o.forEach((v, i) => kvWalkStrings(v, path + '[' + i + ']', out, depth + 1)); return; }
  if (typeof o === 'object') for (const k of Object.keys(o)) kvWalkStrings(o[k], path + '.' + k, out, depth + 1);
}
// KV_SLUR_HASH: one-way hashes of slurs (+ plurals, letter-collapsed forms). Matches whole words only.
const KV_SLUR_H = new Set<string>(["290fedowzxm","2b2kccjuv0w","11ss8oogt2v","2emij7gma9o","185u4j9ttf4","l4mgaol78h","h87zqcsx1w","rw3cx7reim","mlt0jihr27","289s4sk5k0h","eh7iobl40h","2fvyjgluvdp","ty98s3d25n","2der11syiqa","zjk6ililhr","6voycgqet3","21ty6l0rgna","1yb4v3xe0cz","28v6b0u8vkz","zhni53yb3d","gu49stghk1","28ck4tiqn7e","1wplasgwpff","1przrfzaals","1zrd2j8vsmf","srk67wdl5t","129l8tpj8sg","vi8tdv2zez","1rtyqgyzuky","jrh5q4ow5d","1juwujy5mr5","26jmnd3spaf","2gmmzy29cdy","1wbotkru6hq","186sumx36d3","1jrd0dw7849","18w145ebwdo","20wzofpb3ao","5kjxfze1q3","o5l7pnqrfm","m4rohoj1yj","dx9hawcpgx","471lgat23n","kxmcwsksfu","19msgyli5ey","2fzka2ng7xn","f53l6ch7n1","qxjy0vr59n","wockg5ryhp","22a9k8ri4yi","1iyn1b0tqxo","1pni8ch55wm","1hbtct98zrl","1icxm6zkn","1yxfvenhtrx","1ba93vnmyqm","5np8sxr9we","1netqdgpxa9","w369h45do7","7nbwxbj29k","ztfi243qvw","121jd5w8af9","1i0zpzy6o3w","10z468hffnn","19d6p5z6z7m","hg2ii883ky","1j1qwvwsnk2","glomqjppta","1z8rhwlkuza","1rmj2mn2gu7","e0ppld9ejv","f0apautbt5","1mwa1fmybwg","2g70xqs5o1i","1ule6bwm0ux","1qx68k1acht","chxuc2i3b5","191xtx07s2c","c03r97eg7d","lz91vv8on","1nssmemqqct","ew90rmzw1z","8y650lk4e5","2d8yhtbxomi","1xaam8gv69d","2f6myylzo94","88t7180tpj","15vgabghx1s","185deefbthm","7576pqtkwb","14gec39qhk0","269j0qdck6x","s3mp5e218z","19fjyv8x5st","2ba044ixyyx","qg9xfcr3s6","1tb1392lnwt","8ofug523qf","tgmzh81du8","vh5o3duqds","1nkyewz3xk9","27w7bwz0k04","1gifzmbsn16","vdqr5xpu1e","3d2p17eek1","21125toalw0","gdsgpjilru","dv9hebmx2h","18s29hvomaw","smy3hkryx8","1131w074luk","1li72xsgara","hksbblglss","1cw4gn0fzlb","ulfuhtectn","1lpah2z6yrp","gifgzbh3r9","biti05edfn","d94tdns41v","22cg91q04kq","1aub70skg2u","2c8foey9xgq","sfb0p0vwqn"]);
function kvH53(str: string): string { let h1 = 0xdeadbeef ^ 0x6b76, h2 = 0x41c6ce57 ^ 0x6b76;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); }
function kvSlurHit(t: string): boolean {
  for (const w of String(t || '').toLowerCase().split(/[^a-z]+/)) {
    if (w.length < 4 || w.length > 24) continue;
    if (KV_SLUR_H.has(kvH53(w)) || KV_SLUR_H.has(kvH53(w.replace(/(.)\1+/g, '$1')))) return true;
  }
  return false;
}
export function scanObjectStrict(obj: any): any {
  const base: any = scanObject(obj);
  if (!base || base.ok === false) return base;
  const strs: Array<[string, string]> = [];
  kvWalkStrings(obj, '', strs);
  for (const [p, s0] of strs) for (const s of (/[<&]/.test(s0) ? [s0, decodeHtmlEntities(stripTagsTight(s0)), decodeHtmlEntities(stripTagsSpaced(s0))] : [s0])) { // KV_ENTITY_DECODE
    const n = kvNormalize(s);
    if (n !== String(s).toLowerCase()) {
      try { const r2: any = (scanText as any)(n); if (r2 && r2.ok === false) return { ...r2, path: p, leet: true }; } catch {}
    }
    const raw = String(s).toLowerCase().replace(/\s+/g, ' '); // keeps digits (leet map would turn 100 into ioo)
    const nL = kvNormalize(String(s).replace(/1/g, 'l')); // '1' can stand for l as well as i
    const sq = kvSquash(n); // s e e d / f.e.n.t.a.n.y.l -> joined
    if (sq !== n) { try { const r3: any = (scanText as any)(sq); if (r3 && r3.ok === false) return { ...r3, path: p, spaced: true }; } catch {} }
    if (kvSlurHit(n) || kvSlurHit(nL) || kvSlurHit(sq) || kvSlurHit(raw)) return { ok: false, reason: 'slur', path: p };
    for (const [reason, re] of KV_STRICT_RULES) if (re.test(n) || re.test(nL) || re.test(raw) || re.test(sq)) return { ok: false, reason, path: p };
  }
  return base;
}
