// patch_cv.cjs — upgrade content_validator_sync.rs: Option->Result, normalization, CSS injection
// Run from the folder containing content_validator_sync.rs
// Or place next to it. Usage: node patch_cv.cjs
const fs = require('fs');
const FILE = 'content_validator_sync.rs';
if (!fs.existsSync(FILE)) { console.error('Run from the directory containing ' + FILE); process.exit(1); }
let s = fs.readFileSync(FILE, 'utf8');
const orig = s;

function rep1(name, oldStr, newStr) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) throw new Error('[' + name + '] expected 1 match, got ' + count);
  s = s.replace(oldStr, newStr);
  console.log('[' + name + '] OK');
}

if (/validate_css_injection/.test(s)) { console.log('Already patched.'); process.exit(0); }

// 1. Signature: Option -> Result, plug in CSS check + normalization
rep1('signature',
  "pub fn validate_content_text(text: &str) -> Option<&'static str> {\n    let lower = text.to_lowercase();",
  "pub fn validate_content_text(text: &str) -> Result<(), &'static str> {\n    validate_css_injection(text)?;\n    let lower = normalize_text(text);");

// 2. Some -> Err
rep1('err',
  'return Some("Content rejected: prohibited phrase detected");',
  'return Err("Content rejected: prohibited phrase detected");');

// 3. Trailing None -> Ok(())
rep1('ok',
  '        }\n    }\n    None\n}',
  '        }\n    }\n    Ok(())\n}');

// 4. Append normalization + CSS + URL validators
var RUST_APPEND = [
'',
'// ============================================================================',
'// NORMALIZATION - defeats zero-width, confusable, fullwidth, leet bypasses',
'// ============================================================================',
"pub fn normalize_text(text: &str) -> String {",
'    let mut out = String::with_capacity(text.len());',
'    for ch in text.chars() {',
"        if matches!(ch, '\\u{200B}' | '\\u{200C}' | '\\u{200D}' | '\\u{2060}' | '\\u{FEFF}' | '\\u{00AD}' | '\\u{034F}' | '\\u{180E}' | '*') { continue; }",
"        if ('\\u{0300}'..='\\u{036F}').contains(&ch) || ('\\u{20D0}'..='\\u{20FF}').contains(&ch) || ('\\u{FE20}'..='\\u{FE2F}').contains(&ch) { continue; }",
'        let c = ch as u32;',
'        if (0xFF01..=0xFF5E).contains(&c) {',
'            out.push(char::from_u32(c - 0xFEE0).unwrap_or(ch));',
'            continue;',
'        }',
'        let mapped = match ch {',
"            '\\u{0430}' | '\\u{0410}' | '\\u{03B1}' | '\\u{0391}' => 'a',",
"            '\\u{0435}' | '\\u{0415}' | '\\u{03B5}' | '\\u{0395}' => 'e',",
"            '\\u{043E}' | '\\u{041E}' | '\\u{03BF}' | '\\u{039F}' => 'o',",
"            '\\u{0440}' | '\\u{0420}' | '\\u{03C1}' | '\\u{03A1}' => 'p',",
"            '\\u{0441}' | '\\u{0421}' => 'c',",
"            '\\u{0443}' | '\\u{0423}' => 'y',",
"            '\\u{0445}' | '\\u{0425}' => 'x',",
"            '\\u{0456}' => 'i',",
"            '\\u{043A}' | '\\u{041A}' | '\\u{03BA}' | '\\u{039A}' => 'k',",
"            '\\u{043C}' | '\\u{041C}' => 'm',",
"            '\\u{043D}' | '\\u{041D}' => 'h',",
"            '\\u{0442}' | '\\u{0422}' | '\\u{03A4}' => 't',",
"            '\\u{0432}' | '\\u{0412}' | '\\u{0392}' => 'b',",
'            other => other,',
'        };',
'        let leeted = match mapped {',
"            '0' => 'o', '1' => 'i', '3' => 'e', '4' => 'a',",
"            '5' => 's', '7' => 't', '@' => 'a', '$' => 's', '!' => 'i',",
'            other => other,',
'        };',
'        out.push(leeted);',
'    }',
'    let mut collapsed = String::with_capacity(out.len());',
'    let mut prev_space = false;',
'    for ch in out.chars() {',
"        if ch.is_whitespace() || matches!(ch, '_' | '-' | '.') {",
"            if !prev_space { collapsed.push(' '); prev_space = true; }",
'        } else {',
'            collapsed.push(ch); prev_space = false;',
'        }',
'    }',
'    collapsed.trim().to_lowercase()',
'}',
'',
'// ============================================================================',
'// CSS / MARKUP INJECTION - blocks background-image url() exfil + script',
'// ============================================================================',
"pub fn validate_css_injection(text: &str) -> Result<(), &'static str> {",
"    let compact: String = text.chars().filter(|c| !c.is_whitespace()).collect::<String>().to_lowercase();",
'    let needles: &[&str] = &[',
'        "url(", "@import", "expression(", "-moz-binding", "behavior:",',
'        "<style", "<link", "<script", "javascript:", "vbscript:",',
'        "onerror=", "onload=", "onclick=", "onmouseover=", "srcdoc=",',
'        "background-image", "list-style-image",',
'    ];',
'    for n in needles {',
'        if compact.contains(n) {',
'            return Err("Content rejected: CSS or markup injection detected");',
'        }',
'    }',
'    Ok(())',
'}',
'',
'// ============================================================================',
'// URL FIELD VALIDATION - for social links / image refs',
'// ============================================================================',
"pub fn validate_url_field(url: &str) -> Result<(), &'static str> {",
'    let t = url.trim().to_lowercase();',
'    if t.is_empty() { return Ok(()); }',
'    if t.starts_with("javascript:") || t.starts_with("vbscript:") || t.starts_with("data:") {',
'        return Err("URL rejected: disallowed scheme");',
'    }',
'    if t.contains(\':\') && !t.starts_with("http://") && !t.starts_with("https://") && !t.starts_with("ar://") {',
'        return Err("URL rejected: only http(s) and ar:// allowed");',
'    }',
'    Ok(())',
'}',
].join('\n');

s += RUST_APPEND;

// Post-conditions
if (!/normalize_text/.test(s)) throw new Error('POST: normalize_text missing');
if (!/validate_css_injection/.test(s)) throw new Error('POST: validate_css_injection missing');
if (!/validate_url_field/.test(s)) throw new Error('POST: validate_url_field missing');
if (s === orig) throw new Error('POST: no changes made');

fs.writeFileSync(FILE, s, 'utf8');
console.log('PATCHED — run: cargo check');
