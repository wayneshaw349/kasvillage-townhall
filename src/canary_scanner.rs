// canary_scanner.rs - TownHall Canary URL Scanner + signed attestation
// POST /api/canary/scan  { "url": "https://..." }
// GET  /api/canary/pubkey
// Env: TOWNHALL_ATTEST_SK = 64-char hex secp256k1 secret key

use actix_web::{web, HttpResponse, Responder};
use regex::Regex;
use secp256k1::{Keypair, Message, Secp256k1, SecretKey};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_BODY_BYTES: usize = 512 * 1024;

// ---------------------------------------------------------------------------
// Blocklist: MetaMask eth-phishing-detect (~114k domains, refreshed every 6h, held in
// memory - the relay is ephemeral) + KasVillage's own list compiled into the binary.
// A hit is "dangerous" WITHOUT fetching the page, so cloaking can't hide a known scam.
// ---------------------------------------------------------------------------
const MM_LIST_URL: &str = "https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/config.json";
const KV_LIST: &str = include_str!("phishing_kaspa.txt");
const BLOCKLIST_REFRESH_SECS: u64 = 6 * 3600;

struct BlockList { black: std::collections::HashSet<String>, white: std::collections::HashSet<String>, kv: std::collections::HashSet<String>, at: u64 }
static BLOCK: once_cell::sync::Lazy<std::sync::RwLock<BlockList>> = once_cell::sync::Lazy::new(|| {
    let kv = KV_LIST.lines().map(|l| l.trim().to_ascii_lowercase()).filter(|l| !l.is_empty() && !l.starts_with('#')).collect();
    std::sync::RwLock::new(BlockList { black: Default::default(), white: Default::default(), kv, at: 0 })
});

fn now_s() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0) }

async fn refresh_blocklist() -> Result<usize, String> {
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(40)).build().map_err(|e| e.to_string())?;
    let mut r = client.get(MM_LIST_URL).send().await.map_err(|e| e.to_string())?;
    if !r.status().is_success() { return Err(format!("http {}", r.status())); }
    let mut buf: Vec<u8> = Vec::new();
    while let Some(c) = r.chunk().await.map_err(|e| e.to_string())? {
        buf.extend_from_slice(&c);
        if buf.len() > 20 * 1024 * 1024 { return Err("list too large".into()); }
    }
    let v: serde_json::Value = serde_json::from_slice(&buf).map_err(|e| e.to_string())?;
    let set = |k: &str| -> std::collections::HashSet<String> {
        v.get(k).and_then(|a| a.as_array()).map(|a| a.iter().filter_map(|x| x.as_str()).map(|x| x.trim().to_ascii_lowercase()).filter(|x| !x.is_empty()).collect()).unwrap_or_default()
    };
    let black = set("blacklist");
    let white = set("whitelist");
    if black.len() < 1000 { return Err(format!("list looks wrong ({} entries)", black.len())); }
    let n = black.len();
    if let Ok(mut w) = BLOCK.write() { w.black = black; w.white = white; w.at = now_s(); }
    Ok(n)
}

/// Load at startup, then every 6h. A failed refresh keeps the previous list.
/// AUDIT 2026-11-01: until the FIRST load succeeds, retry after 1, 2, then every 5 min
/// (was: a failed first load left the MetaMask list empty for 6h).
pub fn spawn_blocklist_refresh() {
    tokio::spawn(async {
        let mut loaded = false;
        let mut fails: usize = 0;
        loop {
            match refresh_blocklist().await {
                Ok(n) => { loaded = true; fails = 0; println!("[Canary] phishing blocklist loaded: {} domains", n) }
                Err(e) => { fails += 1; eprintln!("[Canary] blocklist refresh failed (keeping previous): {}", e) }
            }
            let wait = if loaded { BLOCKLIST_REFRESH_SECS } else { [60u64, 120, 300][(fails.max(1) - 1).min(2)] };
            tokio::time::sleep(std::time::Duration::from_secs(wait)).await;
        }
    });
}

/// The host or any parent domain on a blocklist (and not on MetaMask's whitelist).
fn blocklist_hit(host: &str) -> Option<String> {
    let h = host.trim_end_matches('.').to_ascii_lowercase();
    let labels: Vec<&str> = h.split('.').collect();
    let cands: Vec<String> = (0..labels.len().saturating_sub(1)).map(|i| labels[i..].join(".")).collect();
    let b = BLOCK.read().ok()?;
    // AUDIT 2026-11-01: our own list wins over MetaMask's whitelist
    if let Some(c) = cands.iter().find(|c| b.kv.contains(*c)) { return Some(format!("{} is on the KasVillage scam list", c)); }
    if cands.iter().any(|c| b.white.contains(c)) { return None; }
    if let Some(c) = cands.iter().find(|c| b.black.contains(*c)) { return Some(format!("{} is on the MetaMask phishing list", c)); }
    None
}
const FETCH_TIMEOUT_SECS: u64 = 10;

// AUDIT 2026-11-01: fetch as a phone browser (scam kits cloak for bot UAs; most victims are on mobile).
const SCAN_UA: &str = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";

// AUDIT 2026-11-01: scans are outbound fetches on the relay's dime - cap them.
const MAX_CONCURRENT_SCANS: usize = 4;
const SCANS_PER_IP_PER_MIN: u32 = 10;
const MAX_TRACKED_IPS: usize = 4096;
static SCAN_SLOTS: once_cell::sync::Lazy<tokio::sync::Semaphore> = once_cell::sync::Lazy::new(|| tokio::sync::Semaphore::new(MAX_CONCURRENT_SCANS));
static SCAN_RATE: once_cell::sync::Lazy<std::sync::Mutex<std::collections::HashMap<String, (u64, u32)>>> =
    once_cell::sync::Lazy::new(|| std::sync::Mutex::new(std::collections::HashMap::new()));

/// Fixed 60s window per IP; bounded map (stale windows pruned, then cleared if still full).
fn scan_rate_ok(ip: &str, now: u64) -> bool {
    let mut m = SCAN_RATE.lock().unwrap_or_else(|e| e.into_inner());
    if m.len() >= MAX_TRACKED_IPS && !m.contains_key(ip) {
        m.retain(|_, (start, _)| now.saturating_sub(*start) < 60);
        if m.len() >= MAX_TRACKED_IPS { m.clear(); }
    }
    let e = m.entry(ip.to_string()).or_insert((now, 0));
    if now.saturating_sub(e.0) >= 60 { *e = (now, 0); }
    if e.1 >= SCANS_PER_IP_PER_MIN { return false; }
    e.1 += 1;
    true
}

/// AUDIT 2026-11-01: only the web ports (an explicit :80/:443 or the scheme default).
fn web_port_ok(port: u16) -> bool { port == 80 || port == 443 }

/// AUDIT 2026-11-01: a link that serves a file (APK, exe, zip...) is not a web page.
fn download_finding(content_type: Option<&str>) -> Option<CanaryFinding> {
    let ct = content_type.unwrap_or("").split(';').next().unwrap_or("").trim().to_ascii_lowercase();
    if ct.is_empty() || ct == "text/html" || ct == "application/xhtml+xml" { return None; }
    let risky = ["application/vnd.android.package-archive", "application/octet-stream", "application/zip", "application/x-zip-compressed",
        "application/x-msdownload", "application/x-msdos-program", "application/x-executable", "application/x-apple-diskimage",
        "application/x-rar-compressed", "application/vnd.rar", "application/x-7z-compressed", "application/java-archive", "application/x-sh"];
    let high = risky.contains(&ct.as_str());
    Some(CanaryFinding {
        code: "download_not_page".into(),
        severity: if high { "high" } else { "medium" }.into(),
        detail: format!("download, not a web page ({})", ct),
    })
}

static CONTENT_CHECKS: once_cell::sync::Lazy<Vec<(Regex, &'static str, &'static str, u32)>> = once_cell::sync::Lazy::new(|| {
    let checks: &[(&str, &'static str, &'static str, u32)] = &[
        (r"(?i)(seed|recovery|secret)\s*phrase", "seed_phrase_prompt", "high", 40),
        (r"(?i)\b(mnemonic|12\s*[- ]?words?|24\s*[- ]?words?)\b", "mnemonic_prompt", "high", 35),
        (r"(?i)(walletdrainer|drainer|inferno|angel[_-]?drainer|seaport[_-]?drain)", "drainer_kit", "high", 60),
        (r"(?i)setApprovalForAll|approve\s*\([^)]{0,60}(MaxUint|2\*\*256|0xf{10,})", "unlimited_approval", "high", 45),
        (r#"(?i)<iframe[^>]{0,200}(display\s*:\s*none|visibility\s*:\s*hidden|width\s*=\s*["']?0|height\s*=\s*["']?0)"#, "hidden_iframe", "medium", 25),
        (r"(?i)eval\s*\(\s*(atob|unescape|String\.fromCharCode)", "obfuscated_eval", "medium", 25),
        (r"(?i)Function\s*\(\s*atob", "obfuscated_function", "medium", 25),
        (r"(?i)document\.write\s*\(\s*(atob|unescape)", "obfuscated_write", "medium", 20),
        (r"(?i)onbeforeunload[^>]{0,80}(prevent|confirm|stay)", "exit_trap", "low", 8),
        (r"(?i)clipboard(Data)?\.(setData|writeText)\s*\([^)]{0,80}(kaspa|addr|0x)", "clipboard_hijack", "high", 45),
    ];
    checks.iter().filter_map(|(p, c, s, n)| Regex::new(p).ok().map(|re| (re, *c, *s, *n))).collect()
});

#[derive(Serialize, Clone)]
pub struct CanaryFinding {
    pub code: String,
    pub severity: String, // low | medium | high
    pub detail: String,
}

#[derive(Serialize, Clone)]
pub struct CanaryVerdict {
    pub v: u8,            // schema version
    pub url: String,
    pub host: String,
    pub ts: u64,
    pub verdict: String,  // clean | suspicious | dangerous
    pub score: u32,
    pub findings: Vec<CanaryFinding>,
}

#[derive(Serialize)]
pub struct CanaryAttestation {
    pub verdict: CanaryVerdict,
    pub digest: String,     // sha256 hex of canonical verdict json
    pub sig: String,        // BIP340 schnorr hex (64 bytes)
    pub attest_pubkey: String, // x-only pubkey hex (32 bytes)
}

fn attest_keypair() -> Result<(Secp256k1<secp256k1::All>, Keypair), String> {
    let sk_hex = std::env::var("TOWNHALL_ATTEST_SK")
        .map_err(|_| "TOWNHALL_ATTEST_SK not set".to_string())?;
    let sk_bytes = hex::decode(sk_hex.trim()).map_err(|e| format!("bad hex: {}", e))?;
    let sk = SecretKey::from_slice(&sk_bytes).map_err(|e| format!("bad sk: {}", e))?;
    let secp = Secp256k1::new();
    let kp = Keypair::from_secret_key(&secp, &sk);
    Ok((secp, kp))
}

fn extract_host(url: &str) -> Option<String> {
    let rest = url.strip_prefix("https://").or_else(|| url.strip_prefix("http://"))?;
    let host = rest.split(['/', '?', '#']).next()?;
    let host = host.split('@').last()?; // strip userinfo
    let host = host.split(':').next()?; // strip port
    if host.is_empty() { None } else { Some(host.to_ascii_lowercase()) }
}

fn is_private_host(host: &str) -> bool {
    if host == "localhost" || host == "0.0.0.0" || host == "::1" { return true; }
    if host.ends_with(".local") || host.ends_with(".internal") { return true; }
    if host.starts_with("127.") || host.starts_with("10.") || host.starts_with("192.168.") || host.starts_with("169.254.") { return true; }
    if let Some(rest) = host.strip_prefix("172.") {
        if let Some(second) = rest.split('.').next() {
            if let Ok(n) = second.parse::<u8>() {
                if (16..=31).contains(&n) { return true; }
            }
        }
    }
    // raw-IP hosts in general are suspicious targets; block scan of bare IPs
    host.chars().all(|c| c.is_ascii_digit() || c == '.')
}

fn levenshtein(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let mut prev: Vec<usize> = (0..=b.len()).collect();
    let mut cur = vec![0usize; b.len() + 1];
    for i in 1..=a.len() {
        cur[0] = i;
        for j in 1..=b.len() {
            let cost = if a[i - 1] == b[j - 1] { 0 } else { 1 };
            cur[j] = (prev[j] + 1).min(cur[j - 1] + 1).min(prev[j - 1] + cost);
        }
        std::mem::swap(&mut prev, &mut cur);
    }
    prev[b.len()]
}

const PROTECTED_BRANDS: &[&str] = &[
    "kaspa", "kasvillage", "metamask", "phantom", "uniswap", "opensea",
    "coinbase", "binance", "kraken", "ledger", "trezor", "trustwallet",
];

fn brand_lookalike(host: &str) -> Option<String> {
    let core = host.trim_end_matches(".com").trim_end_matches(".io")
        .trim_end_matches(".org").trim_end_matches(".net").trim_end_matches(".app");
    let label = core.rsplit('.').next().unwrap_or(core);
    if host.contains("xn--") {
        return Some("punycode host".to_string());
    }
    let normalized: String = label.chars().map(|c| match c {
        '0' => 'o', '1' => 'l', '3' => 'e', '4' => 'a', '5' => 's', '7' => 't',
        other => other,
    }).collect();
    for brand in PROTECTED_BRANDS {
        if label == *brand { return None; } // exact brand label = fine
        let d = levenshtein(&normalized, brand);
        if d > 0 && d <= 2 && normalized.len() + 2 >= brand.len() {
            return Some(format!("resembles '{}'", brand));
        }
        if normalized != *brand && normalized.contains(brand) && label != *brand {
            return Some(format!("embeds brand '{}'", brand));
        }
    }
    None
}

fn scan_content(body: &str, host: &str) -> (Vec<CanaryFinding>, u32) {
    let mut findings = Vec::new();
    let mut score = 0u32;
    let mut push = |code: &str, sev: &str, detail: String, pts: u32,
                    f: &mut Vec<CanaryFinding>, s: &mut u32| {
        f.push(CanaryFinding { code: code.into(), severity: sev.into(), detail });
        *s += pts;
    };

    // AUDIT 2026-11-01: regexes compiled once (CONTENT_CHECKS), not per request
    for (re, code, sev, pts) in CONTENT_CHECKS.iter() {
        if let Some(m) = re.find(body) {
            let snippet: String = m.as_str().chars().take(60).collect();
            push(code, sev, snippet, *pts, &mut findings, &mut score);
        }
    }

    if let Some(reason) = brand_lookalike(host) {
        push("lookalike_domain", "high", reason, 50, &mut findings, &mut score);
    }

    (findings, score)
}

fn verdict_label(score: u32) -> &'static str {
    if score >= 45 { "dangerous" } else if score >= 15 { "suspicious" } else { "clean" }
}

pub async fn api_canary_scan(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> impl Responder {
    use crate::node_registry::{parse_web_url, resolve_public_addrs, pinned_client};
    // AUDIT 2026-11-01: per-IP rate limit + global concurrency cap before any outbound work.
    let ip = req.connection_info().realip_remote_addr().unwrap_or("unknown").to_string();
    if !scan_rate_ok(&ip, now_s()) {
        return HttpResponse::TooManyRequests().json(serde_json::json!({"error":"rate limited: max 10 scans per minute"}));
    }
    let Ok(_slot) = SCAN_SLOTS.try_acquire() else {
        return HttpResponse::TooManyRequests().json(serde_json::json!({"error":"scanner busy, retry shortly"}));
    };
    let raw = body.get("url").and_then(|v| v.as_str()).unwrap_or("").to_string();
    // AUDIT pass 3: parse exactly as the HTTP client will (WHATWG); hand-splitting let
    // "http://169.254.169.254\\@example.com" be checked as example.com but fetched as 169.254.169.254.
    let Some((pu, host, port)) = parse_web_url(&raw, false) else {
        return HttpResponse::BadRequest().json(serde_json::json!({"error":"url required (http/https, a domain name - no IP addresses or user@ parts)"}));
    };
    if !web_port_ok(port) { // AUDIT 2026-11-01
        return HttpResponse::BadRequest().json(serde_json::json!({"error":"only ports 80/443 are scannable"}));
    }
    let url = pu.to_string();
    if is_private_host(&host) {
        return HttpResponse::BadRequest().json(serde_json::json!({"error":"private/IP hosts not scannable"}));
    }
    if let Some(why) = blocklist_hit(&host) {
        return attest_response(url.clone(), host.clone(), 100, vec![CanaryFinding { code: "known_phishing".into(), severity: "high".into(), detail: why }]);
    }

    // Up to 3 redirects followed BY HAND. Every hop: parsed by the client's own parser,
    // blocklist-checked, resolved once, all addresses public, and the connection PINNED to
    // those addresses (no second DNS answer / rebinding).
    let mut cur = url.clone();
    let mut cur_host = host.clone();
    let mut resp_opt: Option<reqwest::Response> = None;
    for _hop in 0..4 {
        let Some((cu, ch, cp)) = parse_web_url(&cur, false) else {
            return HttpResponse::BadRequest().json(serde_json::json!({"error":"redirects to a non-web address", "redirect_to": cur}));
        };
        if !web_port_ok(cp) { // AUDIT 2026-11-01: every hop
            return HttpResponse::BadRequest().json(serde_json::json!({"error":"redirects to a non-web port", "redirect_to": cur}));
        }
        let Some(addrs) = resolve_public_addrs(&ch, cp).await else {
            return HttpResponse::BadRequest().json(serde_json::json!({"error":"host does not resolve to a public address", "url": cur}));
        };
        let r = match pinned_client(&ch, &addrs, FETCH_TIMEOUT_SECS, SCAN_UA /* AUDIT 2026-11-01 */).get(cu.as_str()).send().await {
            Ok(r) => r,
            Err(e) => return HttpResponse::Ok().json(serde_json::json!({
                "error": format!("fetch failed: {}", e), "fetchable": false
            })),
        };
        cur_host = ch;
        if !r.status().is_redirection() { resp_opt = Some(r); break; }
        let loc = r.headers().get(reqwest::header::LOCATION).and_then(|v| v.to_str().ok()).unwrap_or("").to_string();
        let next = match cu.join(&loc) { Ok(u) => u.to_string(), Err(_) => break };
        let Some((_, nh, _)) = parse_web_url(&next, false) else {
            return HttpResponse::BadRequest().json(serde_json::json!({"error":"redirects to a private or non-web address", "redirect_to": next}));
        };
        if let Some(why) = blocklist_hit(&nh) {
            return attest_response(next.clone(), nh.clone(), 100, vec![CanaryFinding { code: "redirects_to_known_phishing".into(), severity: "high".into(), detail: why }]);
        }
        if is_private_host(&nh) {
            return HttpResponse::BadRequest().json(serde_json::json!({"error":"redirects to a private or non-web address", "redirect_to": next}));
        }
        cur = next;
    }
    let resp = match resp_opt {
        Some(r) => r,
        None => return HttpResponse::Ok().json(serde_json::json!({ "error": "too many redirects", "fetchable": false, "last_url": cur })),
    };
    let final_url = cur.clone();
    let final_host = cur_host.clone();

    // AUDIT 2026-11-01: a file download is at least suspicious, whatever its bytes say
    let dl = download_finding(resp.headers().get(reqwest::header::CONTENT_TYPE).and_then(|v| v.to_str().ok()));
    // stream with a cap instead of buffering the whole body
    let mut resp = resp;
    let mut bytes: Vec<u8> = Vec::new();
    loop {
        match resp.chunk().await {
            Ok(Some(c)) => { bytes.extend_from_slice(&c); if bytes.len() >= MAX_BODY_BYTES { break; } }
            Ok(None) => break,
            Err(e) => return HttpResponse::Ok().json(serde_json::json!({
                "error": format!("body read failed: {}", e), "fetchable": false
            })),
        }
    }
    let slice = &bytes[..bytes.len().min(MAX_BODY_BYTES)];
    let text = String::from_utf8_lossy(slice);

    let (mut findings, mut score) = scan_content(&text, &final_host);
    if let Some(f) = dl { score += if f.severity == "high" { 45 } else { 15 }; findings.push(f); } // AUDIT 2026-11-01
    if final_host != host {
        if let Some(reason) = brand_lookalike(&host) {
            findings.push(CanaryFinding {
                code: "redirect_from_lookalike".into(),
                severity: "high".into(),
                detail: reason,
            });
            score += 30;
        }
    }

    attest_response(final_url, final_host, score, findings)
}

fn attest_response(final_url: String, final_host: String, score: u32, findings: Vec<CanaryFinding>) -> HttpResponse {
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let verdict = CanaryVerdict {
        v: 1,
        url: final_url,
        host: final_host,
        ts,
        verdict: verdict_label(score).to_string(),
        score,
        findings,
    };

    let canonical = match serde_json::to_string(&verdict) {
        Ok(s) => s,
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    };
    let digest: [u8; 32] = Sha256::digest(canonical.as_bytes()).into();

    let (secp, kp) = match attest_keypair() {
        Ok(x) => x,
        Err(e) => {
            // unsigned verdict still returned so scanner is usable pre-key-provision
            return HttpResponse::Ok().json(serde_json::json!({
                "verdict": verdict, "digest": hex::encode(digest),
                "sig": null, "attest_pubkey": null, "warn": e
            }));
        }
    };
    let msg = Message::from_digest(digest);
    let sig = secp.sign_schnorr_with_aux_rand(&msg, &kp, &digest); // aux = digest (deterministic)
    let (xonly, _) = kp.x_only_public_key();

    HttpResponse::Ok().json(CanaryAttestation {
        verdict,
        digest: hex::encode(digest),
        sig: hex::encode(sig.as_ref()),
        attest_pubkey: hex::encode(xonly.serialize()),
    })
}

pub async fn api_canary_pubkey() -> impl Responder {
    match attest_keypair() {
        Ok((_, kp)) => {
            let (xonly, _) = kp.x_only_public_key();
            HttpResponse::Ok().json(serde_json::json!({"attest_pubkey": hex::encode(xonly.serialize())}))
        }
        Err(e) => HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": e})),
    }
}

#[cfg(test)]
mod blocklist_tests {
    use super::*;
    #[test]
    fn blocklist_matches_host_and_parents_but_respects_whitelist() {
        {
            let mut w = BLOCK.write().unwrap();
            w.black.insert("evil-phish.xyz".into());
            w.black.insert("trusted.io".into());
            w.white.insert("trusted.io".into());
            w.kv.insert("kaspa-airdrop.example".into());
        }
        assert!(blocklist_hit("evil-phish.xyz").is_some());
        assert!(blocklist_hit("login.evil-phish.xyz").is_some());
        assert!(blocklist_hit("EVIL-PHISH.XYZ.").is_some());
        assert!(blocklist_hit("notevil-phish.xyz").is_none());
        assert!(blocklist_hit("trusted.io").is_none());           // whitelist wins over MetaMask's own blacklist
        assert!(blocklist_hit("claim.kaspa-airdrop.example").unwrap().contains("KasVillage"));
        assert!(blocklist_hit("kaspa.org").is_none());
    }
    // AUDIT 2026-11-01
    #[test]
    fn kv_list_beats_metamask_whitelist() {
        { let mut w = BLOCK.write().unwrap(); w.white.insert("kv-wins.example".into()); w.kv.insert("kv-wins.example".into()); }
        assert!(blocklist_hit("kv-wins.example").unwrap().contains("KasVillage"));
    }
    #[test]
    fn download_content_types_flagged() {
        assert!(download_finding(Some("text/html; charset=utf-8")).is_none());
        assert!(download_finding(None).is_none());
        let apk = download_finding(Some("application/vnd.android.package-archive")).unwrap();
        assert_eq!(apk.severity, "high");
        assert!(apk.detail.contains("download, not a web page"));
        assert_eq!(download_finding(Some("Application/Octet-Stream")).unwrap().severity, "high");
        assert_eq!(download_finding(Some("application/pdf")).unwrap().severity, "medium");
        assert!(verdict_label(15) != "clean");
    }
    #[test]
    fn per_ip_rate_limit_and_ports() {
        let ip = "203.0.113.77-test";
        for _ in 0..SCANS_PER_IP_PER_MIN { assert!(scan_rate_ok(ip, 1000)); }
        assert!(!scan_rate_ok(ip, 1030), "11th within a minute refused");
        assert!(scan_rate_ok(ip, 1061), "new window");
        assert!(web_port_ok(443) && web_port_ok(80) && !web_port_ok(8080) && !web_port_ok(6443));
        assert_eq!(CONTENT_CHECKS.len(), 10, "all content regexes compile");
    }
}
