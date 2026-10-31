// ============================================================================
// dkim_verify.rs - real DKIM (RFC 6376) verification for academic identity.
//
// Replaces the old check that passed any base64 blob >= 64 bytes. This module:
//   - canonicalizes headers + body exactly as RFC 6376 s3.4 (simple and relaxed)
//   - selects signed headers bottom-up per s5.4.2, signs the DKIM-Signature header
//     itself with an empty b= value per s3.7
//   - verifies the body hash (bh=) when a body is supplied
//   - verifies RSA-SHA256 (PKCS#1 v1.5) against the key published in DNS
//     (selector._domainkey.domain TXT, fetched over DNS-over-HTTPS)
//
// What a PASS means: the mail server of domain d= signed these exact header values.
// For academic identity the caller also requires From-domain alignment with d=, an
// academic d=, and a challenge tied to the user's pubkey inside the SIGNED Subject, so
// a received newsletter from a university cannot be replayed as someone's credential.
// Conformance is tested against dkimpy (an independent, widely deployed implementation).
// ============================================================================

use rsa::pkcs1v15::Pkcs1v15Sign;
use rsa::{pkcs1::DecodeRsaPublicKey, pkcs8::DecodePublicKey, RsaPublicKey, traits::PublicKeyParts};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct DkimOutcome {
    pub passed: bool,
    pub domain: String,            // d=
    pub selector: String,          // s=
    pub from_address: String,      // address in the signed From header
    pub subject: String,           // signed Subject value (unfolded)
    pub signed_headers: Vec<String>,
    pub body_checked: bool,        // bh= verified against a supplied body
    pub signing_input_hash: String,// sha256 of the exact bytes the RSA signature covers
    pub key_bits: usize,
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
// message parsing
// ---------------------------------------------------------------------------

/// Split a raw message into (headers, body). Each header keeps its full original text,
/// including folding, without the final CRLF. Accepts LF or CRLF input.
pub fn split_message(raw: &str) -> (Vec<String>, Option<String>) {
    let norm = raw.replace("\r\n", "\n");
    let (head, body) = match norm.find("\n\n") {
        Some(i) => (&norm[..i], Some(norm[i + 2..].to_string())),
        None => (norm.as_str(), None),
    };
    let mut headers: Vec<String> = Vec::new();
    for line in head.split('\n') {
        if line.is_empty() { continue; }
        if (line.starts_with(' ') || line.starts_with('\t')) && !headers.is_empty() {
            let last = headers.last_mut().unwrap();
            last.push_str("\r\n");
            last.push_str(line);
        } else {
            headers.push(line.to_string());
        }
    }
    (headers, body.map(|b| b.replace('\n', "\r\n")))
}

fn header_name(h: &str) -> String {
    h.split(':').next().unwrap_or("").trim().to_ascii_lowercase()
}

fn header_value(h: &str) -> &str {
    match h.find(':') { Some(i) => &h[i + 1..], None => "" }
}

fn unfold(v: &str) -> String { v.replace("\r\n", "").replace('\n', "") }

/// Collapse runs of SP/HTAB to a single SP.
fn compress_wsp(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_ws = false;
    for c in s.chars() {
        if c == ' ' || c == '\t' {
            if !in_ws { out.push(' '); }
            in_ws = true;
        } else { out.push(c); in_ws = false; }
    }
    out
}

// ---------------------------------------------------------------------------
// canonicalization (RFC 6376 s3.4)
// ---------------------------------------------------------------------------

fn canon_header(h: &str, relaxed: bool) -> String {
    if !relaxed { return h.to_string(); } // simple: byte-for-byte (CRLF appended by caller)
    let name = header_name(h);
    let value = compress_wsp(&unfold(header_value(h)));
    format!("{}:{}", name, value.trim_matches(|c| c == ' ' || c == '\t'))
}

fn canon_body(body: &str, relaxed: bool) -> String {
    let mut lines: Vec<String> = body.split("\r\n").map(|l| {
        if relaxed { compress_wsp(l).trim_end_matches(|c| c == ' ' || c == '\t').to_string() } else { l.to_string() }
    }).collect();
    // drop trailing empty lines
    while lines.last().map(|l| l.is_empty()).unwrap_or(false) { lines.pop(); }
    if lines.is_empty() {
        return if relaxed { String::new() } else { "\r\n".to_string() };
    }
    let mut out = lines.join("\r\n");
    out.push_str("\r\n");
    out
}

// ---------------------------------------------------------------------------
// DKIM-Signature tag parsing
// ---------------------------------------------------------------------------

fn parse_tags(sig_value: &str) -> Vec<(String, String)> {
    unfold(sig_value).split(';').filter_map(|part| {
        let p = part.trim();
        if p.is_empty() { return None; }
        let i = p.find('=')?;
        let k = p[..i].trim().to_string();
        let v: String = p[i + 1..].chars().filter(|c| !c.is_whitespace()).collect();
        Some((k, v))
    }).collect()
}

fn tag<'a>(tags: &'a [(String, String)], k: &str) -> Option<&'a str> {
    tags.iter().find(|(kk, _)| kk == k).map(|(_, v)| v.as_str())
}

/// The DKIM-Signature header with the b= VALUE removed (s3.7), preserving everything else.
fn strip_b_value(h: &str) -> String {
    // find "b=" as a tag (preceded by start, ';' or whitespace) - not "bh="
    let bytes = h.as_bytes();
    let mut i = 0;
    while i + 1 < bytes.len() {
        if bytes[i] == b'b' && bytes[i + 1] == b'=' {
            let prev_ok = h[..i].trim_end_matches(|c: char| c == ' ' || c == '\t' || c == '\r' || c == '\n')
                .chars().last().map(|c| c == ';' || c == ':').unwrap_or(true);
            if prev_ok {
                let start = i + 2;
                let end = h[start..].find(';').map(|j| start + j).unwrap_or(h.len());
                return format!("{}{}", &h[..start], &h[end..]);
            }
        }
        i += 1;
    }
    h.to_string()
}

fn b64(s: &str) -> Option<Vec<u8>> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.decode(s.as_bytes()).ok()
}

/// Parse the p= of a DKIM key record: SubjectPublicKeyInfo DER, or bare PKCS#1 RSAPublicKey.
pub fn parse_dkim_key(p_b64: &str) -> Result<RsaPublicKey, String> {
    let der = b64(p_b64).ok_or("key p= is not base64")?;
    RsaPublicKey::from_public_key_der(&der)
        .or_else(|_| RsaPublicKey::from_pkcs1_der(&der))
        .map_err(|e| format!("unparseable RSA key: {}", e))
}

/// Extract p= from a DKIM DNS TXT record (k must be rsa or absent; empty p = revoked).
pub fn key_from_txt(txt: &str) -> Result<String, String> {
    let tags = parse_tags(txt);
    if let Some(k) = tag(&tags, "k") { if !k.eq_ignore_ascii_case("rsa") { return Err(format!("unsupported key type k={}", k)); } }
    match tag(&tags, "p") {
        Some(p) if !p.is_empty() => Ok(p.to_string()),
        Some(_) => Err("key revoked (empty p=)".into()),
        None => Err("no p= in key record".into()),
    }
}

/// Address inside a From header value: the <...> part, else the bare token.
pub fn from_address(v: &str) -> String {
    let v = unfold(v);
    if let (Some(a), Some(b)) = (v.rfind('<'), v.rfind('>')) {
        if a < b { return v[a + 1..b].trim().to_ascii_lowercase(); }
    }
    v.trim().to_ascii_lowercase()
}

// ---------------------------------------------------------------------------
// verification
// ---------------------------------------------------------------------------

/// Verify every DKIM-Signature in `raw` against keys returned by `key_for(domain, selector)`.
/// Returns the first signature that verifies (preferring ones that satisfy `accept`), or the
/// last failure. `accept` lets the caller demand alignment/policy on a passing signature.
pub fn verify_message<F, A>(raw: &str, key_for: F, accept: A) -> DkimOutcome
where
    F: Fn(&str, &str) -> Result<String, String>,
    A: Fn(&DkimOutcome) -> Result<(), String>,
{
    let (headers, body) = split_message(raw);
    let sig_idx: Vec<usize> = headers.iter().enumerate()
        .filter(|(_, h)| header_name(h) == "dkim-signature").map(|(i, _)| i).collect();
    if sig_idx.is_empty() {
        return DkimOutcome { error: Some("no DKIM-Signature header".into()), ..Default::default() };
    }
    let mut last = DkimOutcome { error: Some("no signature verified".into()), ..Default::default() };
    for &si in &sig_idx {
        let out = verify_one(&headers, si, body.as_deref(), &key_for);
        if out.passed {
            match accept(&out) {
                Ok(()) => return out,
                Err(e) => { last = DkimOutcome { passed: false, error: Some(e), ..out }; }
            }
        } else if !last.passed { last = out; }
    }
    last
}

fn verify_one<F>(headers: &[String], si: usize, body: Option<&str>, key_for: &F) -> DkimOutcome
where F: Fn(&str, &str) -> Result<String, String> {
    let sig_h = &headers[si];
    let tags = parse_tags(header_value(sig_h));
    let mut out = DkimOutcome::default();
    let fail = |mut o: DkimOutcome, e: String| { o.passed = false; o.error = Some(e); o };

    if tag(&tags, "v") != Some("1") { return fail(out, "v= must be 1".into()); }
    match tag(&tags, "a") { Some("rsa-sha256") => {}, a => return fail(out, format!("unsupported a={:?} (rsa-sha256 only)", a)) }
    out.domain = tag(&tags, "d").unwrap_or("").to_ascii_lowercase();
    out.selector = tag(&tags, "s").unwrap_or("").to_string();
    if out.domain.is_empty() || out.selector.is_empty() { return fail(out, "missing d= or s=".into()); }
    let h_list: Vec<String> = tag(&tags, "h").unwrap_or("").split(':').map(|x| x.trim().to_ascii_lowercase()).filter(|x| !x.is_empty()).collect();
    if !h_list.iter().any(|x| x == "from") { return fail(out, "From is not signed".into()); }
    out.signed_headers = h_list.clone();
    let canon = tag(&tags, "c").unwrap_or("simple/simple");
    let mut cp = canon.split('/');
    let hdr_relaxed = cp.next() == Some("relaxed");
    let body_relaxed = cp.next() == Some("relaxed");
    let sig_bytes = match tag(&tags, "b").and_then(b64) { Some(b) if !b.is_empty() => b, _ => return fail(out, "bad b=".into()) };
    if let Some(x) = tag(&tags, "x").and_then(|x| x.parse::<u64>().ok()) {
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
        if now > x { return fail(out, "signature expired (x=)".into()); }
    }

    // body hash
    if let Some(b) = body {
        let mut cb = canon_body(b, body_relaxed);
        if let Some(l) = tag(&tags, "l").and_then(|l| l.parse::<usize>().ok()) { cb.truncate(l.min(cb.len())); }
        let bh_calc = { use base64::Engine; base64::engine::general_purpose::STANDARD.encode(Sha256::digest(cb.as_bytes())) };
        if Some(bh_calc.as_str()) != tag(&tags, "bh") { return fail(out, "body hash mismatch (message body was altered)".into()); }
        out.body_checked = true;
    }

    // header selection: each listed name takes the LAST not-yet-used instance (s5.4.2)
    let mut used = vec![false; headers.len()];
    used[si] = true;
    let mut input = String::new();
    for name in &h_list {
        let pick = (0..headers.len()).rev().find(|&i| !used[i] && header_name(&headers[i]) == *name);
        if let Some(i) = pick {
            used[i] = true;
            input.push_str(&canon_header(&headers[i], hdr_relaxed));
            input.push_str("\r\n");
            match name.as_str() {
                "from" => out.from_address = from_address(header_value(&headers[i])),
                "subject" => out.subject = compress_wsp(&unfold(header_value(&headers[i]))).trim().to_string(),
                _ => {}
            }
        }
    }
    input.push_str(&canon_header(&strip_b_value(sig_h), hdr_relaxed)); // no trailing CRLF
    out.signing_input_hash = hex::encode(Sha256::digest(input.as_bytes()));

    let p = match key_for(&out.domain, &out.selector) { Ok(p) => p, Err(e) => return fail(out, format!("key lookup: {}", e)) };
    let key = match parse_dkim_key(&p) { Ok(k) => k, Err(e) => return fail(out, e) };
    out.key_bits = key.n().bits();
    if out.key_bits < 1024 { let bits = out.key_bits; return fail(out, format!("RSA key too small ({} bits)", bits)); }
    let digest = Sha256::digest(input.as_bytes());
    match key.verify(Pkcs1v15Sign::new::<Sha256>(), &digest, &sig_bytes) {
        Ok(()) => { out.passed = true; out.error = None; out }
        Err(_) => fail(out, "RSA signature does not verify".into()),
    }
}

/// (d=, s=) of every DKIM-Signature in the message, for key prefetch.
pub fn signature_keys(raw: &str) -> Vec<(String, String)> {
    let (headers, _) = split_message(raw);
    let mut out: Vec<(String, String)> = Vec::new();
    for h in headers.iter().filter(|h| header_name(h) == "dkim-signature") {
        let t = parse_tags(header_value(h));
        if let (Some(d), Some(sel)) = (tag(&t, "d"), tag(&t, "s")) {
            let k = (d.to_ascii_lowercase(), sel.to_string());
            if !out.contains(&k) { out.push(k); }
        }
    }
    out
}

// ---------------------------------------------------------------------------
// DNS (DNS-over-HTTPS) key lookup
// ---------------------------------------------------------------------------

/// Fetch the TXT record for `selector._domainkey.domain` and return its p= value.
pub async fn fetch_dkim_key(domain: &str, selector: &str) -> Result<String, String> {
    let ok = |s: &str| !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.' || c == '_');
    if !ok(domain) || !ok(selector) { return Err("invalid domain/selector".into()); }
    let name = format!("{}._domainkey.{}", selector, domain);
    let client = reqwest::Client::new();
    let mut last = String::from("no DoH resolver answered");
    for url in [
        format!("https://dns.google/resolve?name={}&type=TXT", name),
        format!("https://cloudflare-dns.com/dns-query?name={}&type=TXT", name),
    ] {
        let resp = client.get(&url).header("accept", "application/dns-json")
            .timeout(std::time::Duration::from_secs(8)).send().await;
        let j: serde_json::Value = match resp { Ok(r) => match r.json().await { Ok(j) => j, Err(e) => { last = e.to_string(); continue; } }, Err(e) => { last = e.to_string(); continue; } };
        if let Some(ans) = j.get("Answer").and_then(|a| a.as_array()) {
            for a in ans {
                if a.get("type").and_then(|t| t.as_u64()) != Some(16) { continue; }
                let data = a.get("data").and_then(|d| d.as_str()).unwrap_or("");
                // TXT data arrives as one or more quoted strings: concatenate them
                let txt: String = if data.contains('"') {
                    data.split('"').enumerate().filter(|(i, _)| i % 2 == 1).map(|(_, s)| s).collect()
                } else { data.to_string() };
                if txt.contains("p=") { return key_from_txt(&txt); }
            }
            last = format!("no DKIM key at {}", name);
        } else { last = format!("NXDOMAIN or empty answer for {}", name); }
    }
    Err(last)
}

// ---------------------------------------------------------------------------
// academic policy
// ---------------------------------------------------------------------------

/// Challenge the user must put in the Subject: derived from their pubkey, so a signed email
/// proves THIS key's owner controls the address. Format: KV-XXXXXXXXXX (10 hex, uppercase).
pub fn academic_challenge(pubkey: &str) -> String {
    let h = Sha256::digest(format!("KV_ACADEMIC_V2:{}", pubkey.trim().to_ascii_lowercase()).as_bytes());
    format!("KV-{}", hex::encode(&h[..5]).to_ascii_uppercase())
}

/// Academic d=: US .edu, or an academic second-level under a country code (ac.uk, edu.au, ac.jp, ...).
pub fn is_academic_domain(d: &str) -> bool {
    let d = d.trim_end_matches('.').to_ascii_lowercase();
    if d.ends_with(".edu") { return true; }
    let parts: Vec<&str> = d.split('.').collect();
    parts.len() >= 3 && {
        let sld = parts[parts.len() - 2];
        let cc = parts[parts.len() - 1];
        cc.len() == 2 && (sld == "ac" || sld == "edu")
    }
}

/// From's domain must be d= or a subdomain of it (relaxed alignment).
pub fn aligned(from_addr: &str, d: &str) -> bool {
    let fd = from_addr.rsplit('@').next().unwrap_or("").to_ascii_lowercase();
    !fd.is_empty() && (fd == d || fd.ends_with(&format!(".{}", d)))
}

pub fn academic_policy(pubkey: &str) -> impl Fn(&DkimOutcome) -> Result<(), String> {
    let challenge = academic_challenge(pubkey);
    move |o: &DkimOutcome| {
        if !o.signed_headers.iter().any(|h| h == "subject") { return Err("Subject is not covered by the signature".into()); }
        if !aligned(&o.from_address, &o.domain) { return Err(format!("From {} is not aligned with signing domain {}", o.from_address, o.domain)); }
        if !is_academic_domain(&o.domain) { return Err(format!("{} is not an academic domain", o.domain)); }
        if !o.subject.to_ascii_uppercase().contains(&challenge) { return Err(format!("signed Subject must contain your challenge {}", challenge)); }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Generated by dkimpy (independent reference implementation) with a throwaway key; only
    // the PUBLIC key is in the fixture. Regenerate: tools/mk_dkim_fixtures.py.
    const FIXTURES: &str = include_str!("../tests/fixtures/dkim_cases.json");

    #[test]
    fn conforms_to_dkimpy_and_enforces_academic_policy() {
        let f: serde_json::Value = serde_json::from_str(FIXTURES).unwrap();
        let spki = f["key_spki_b64"].as_str().unwrap().to_string();
        let pubkey = f["pubkey"].as_str().unwrap();
        assert_eq!(academic_challenge(pubkey), f["challenge"].as_str().unwrap(), "challenge derivation must match");
        let key_for = |_d: &str, _s: &str| -> Result<String, String> { Ok(spki.clone()) };
        let mut failures = Vec::new();
        for c in f["cases"].as_array().unwrap() {
            let name = c["name"].as_str().unwrap();
            let raw = c["raw"].as_str().unwrap();
            let want_dkim = c["expect_dkim"].as_bool().unwrap();
            let dk = verify_message(raw, &key_for, |_| Ok(()));
            if dk.passed != want_dkim { failures.push(format!("{}: dkim passed={} want {} ({:?})", name, dk.passed, want_dkim, dk.error)); }
            if let Some(want_ac) = c["expect_academic"].as_bool() {
                let ac = verify_message(raw, &key_for, academic_policy(pubkey));
                if ac.passed != want_ac { failures.push(format!("{}: academic passed={} want {} ({:?})", name, ac.passed, want_ac, ac.error)); }
            }
        }
        assert!(failures.is_empty(), "DKIM conformance failures:\n{}", failures.join("\n"));
    }

    #[test]
    fn pkcs1_key_form_also_accepted() {
        let f: serde_json::Value = serde_json::from_str(FIXTURES).unwrap();
        assert!(parse_dkim_key(f["key_pkcs1_b64"].as_str().unwrap()).is_ok());
        assert!(parse_dkim_key(f["key_spki_b64"].as_str().unwrap()).is_ok());
    }

    #[test]
    fn academic_domains() {
        for d in ["mit.edu", "cs.stanford.edu", "ox.ac.uk", "unimelb.edu.au", "u-tokyo.ac.jp"] { assert!(is_academic_domain(d), "{}", d); }
        for d in ["gmail.com", "edu.com", "fake-edu.org", "ac.uk", "notedu"] { assert!(!is_academic_domain(d), "{}", d); }
    }

    #[test]
    fn key_record_parsing() {
        assert_eq!(key_from_txt("v=DKIM1; k=rsa; p=ABC").unwrap(), "ABC");
        assert!(key_from_txt("v=DKIM1; k=rsa; p=").is_err());          // revoked
        assert!(key_from_txt("v=DKIM1; k=ed25519; p=AAAA").is_err());  // not rsa
    }
}

#[cfg(test)]
mod prefetch_tests {
    #[test]
    fn signature_keys_found_in_fixture() {
        let f: serde_json::Value = serde_json::from_str(include_str!("../tests/fixtures/dkim_cases.json")).unwrap();
        let raw = f["cases"][0]["raw"].as_str().unwrap();
        assert_eq!(super::signature_keys(raw), vec![("mit.edu".to_string(), "sel2026".to_string())]);
    }
}
