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
  /\bmnemonic\b/i,
  /\bprivate\s*key\b/i,
  /\bsecret\s*key\b/i,
  /\bwallet\s*(password|pin|passphrase)\b/i,
  /\b(12|24)\s*words?\b/i,
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

/** Scan a single string. Runs against both the raw and folded forms. */
export function scanText(raw: string): ScanResult {
  if (typeof raw !== 'string' || !raw) return { ok: true };
  if (hasMixedScriptWord(raw)) return { ok: false, reason: 'mixed_script' };
  const forms = [raw, fold(raw)];
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
export function scanObject(obj: any, maxDepth = 24): ScanResult {
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
export function scanDescriptor(game: any): ScanResult {
  return scanObject(game);
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
    default: return 'This content did not pass review.';
  }
}
