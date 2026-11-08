// fix_scanner_wholeword.cjs — content scanner: whole-word phrase matching.
// Was: substring match, so "therapeutic" hit "rape" and "violation" hit "viol".
// Now: a phrase must start at a word boundary and end at one, allowing only
// plain inflections after it (s, es, d, ed, ing, er, ers, ist, ists, ism),
// so "rape"/"raped"/"rapist" still block but "grape"/"therapeutic" pass.
// Patches whichever of these exist in the current folder (or pass paths):
//   content_validator.ts   src/content_validator_sync.rs
// Count-guarded: aborts before writing anything if an anchor isn't found exactly once.
const fs = require("fs");
const targets = process.argv.slice(2).length ? process.argv.slice(2)
  : ["content_validator.ts", "src/content_validator_sync.rs"].filter(f => fs.existsSync(f));
if (!targets.length) { console.error("ABORT: no scanner files found here"); process.exit(1); }

const TS_OLD = "  for (const phrase of blocked) { if (lower.includes(phrase)) return 'Content rejected: prohibited phrase detected'; }\n  return null;\n}";
const TS_NEW = "  for (const phrase of blocked) { if (kvPhraseHit(lower, phrase)) return 'Content rejected: prohibited phrase detected'; }\n  return null;\n}\n\n" +
"// KV_WHOLEWORD: phrase must sit on word boundaries; only plain inflections may follow.\n" +
"const KV_SUFFIX = /^(s|es|d|ed|ing|er|ers|ist|ists|ism)?$/;\n" +
"function kvIsWordChar(ch: string): boolean { return /[\\p{L}\\p{N}]/u.test(ch); }\n" +
"export function kvPhraseHit(text: string, phrase: string): boolean {\n" +
"  let from = 0;\n" +
"  for (;;) {\n" +
"    const i = text.indexOf(phrase, from);\n" +
"    if (i < 0) return false;\n" +
"    if (i === 0 || !kvIsWordChar(text[i - 1])) {\n" +
"      const j = i + phrase.length; let k = j;\n" +
"      while (k < text.length && kvIsWordChar(text[k])) k++;\n" +
"      if (KV_SUFFIX.test(text.slice(j, k))) return true;\n" +
"    }\n" +
"    from = i + 1;\n" +
"  }\n" +
"}";

const RS_OLD = "    for phrase in blocked {\n        if lower.contains(phrase) {\n            return Err(\"Content rejected: prohibited phrase detected\");\n        }\n    }\n    Ok(())\n}";
const RS_NEW = "    let plain = text.to_lowercase(); // also match un-leeted text, so \"rape!\" is not read as \"rapei\"\n    for phrase in blocked {\n        if kv_phrase_hit(&lower, phrase) || kv_phrase_hit(&plain, phrase) {\n            return Err(\"Content rejected: prohibited phrase detected\");\n        }\n    }\n    Ok(())\n}\n\n" +
"// KV_WHOLEWORD: phrase must sit on word boundaries; only plain inflections may follow.\n" +
"pub fn kv_phrase_hit(text: &str, phrase: &str) -> bool {\n" +
"    const SUFFIXES: [&str; 11] = [\"\", \"s\", \"es\", \"d\", \"ed\", \"ing\", \"er\", \"ers\", \"ist\", \"ists\", \"ism\"];\n" +
"    let mut from = 0usize;\n" +
"    while let Some(rel) = text[from..].find(phrase) {\n" +
"        let i = from + rel;\n" +
"        let before_ok = text[..i].chars().next_back().map_or(true, |c| !c.is_alphanumeric());\n" +
"        if before_ok {\n" +
"            let j = i + phrase.len();\n" +
"            let tail: String = text[j..].chars().take_while(|c| c.is_alphanumeric()).collect();\n" +
"            if SUFFIXES.contains(&tail.as_str()) { return true; }\n" +
"        }\n" +
"        from = i + text[i..].chars().next().map_or(1, |c| c.len_utf8());\n" +
"    }\n" +
"    false\n" +
"}";

const plan = [];
for (const f of targets) {
  const raw = fs.readFileSync(f, "utf8"), src = raw.replace(/\r\n/g, "\n");
  if (src.includes("KV_WHOLEWORD")) { console.log("SKIP (already patched):", f); continue; }
  const isRs = f.endsWith(".rs"), OLD = isRs ? RS_OLD : TS_OLD, NEW = isRs ? RS_NEW : TS_NEW;
  const n = src.split(OLD).length - 1;
  if (n !== 1) { console.error("ABORT: anchor count = " + n + " (expected 1) in " + f + " — nothing written."); process.exit(1); }
  plan.push([f, src.replace(OLD, NEW), raw.includes("\r\n")]);
}
for (const [f, out, crlf] of plan) { fs.writeFileSync(f, crlf ? out.replace(/\n/g, "\r\n") : out); console.log("PATCHED:", f); }
console.log("done — " + plan.length + " file(s). TS: npx tsc --noEmit · Rust: cargo check");
