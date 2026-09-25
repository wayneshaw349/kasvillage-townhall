// patch_townhall_wnet.js — closes the KV_WNET gap in TownHall's game scan.
//
// Adds to src/main.rs:
//   - GAME_IO_PATTERNS: raw-I/O and bridge-tamper patterns for chain games
//   - fn scan_game_io_discipline(code) -> Vec<PatternMatch>
//   - scan_game_code() gains the io-discipline pass whenever the submitted
//     code declares itself a chain game (contains "KV_WNET")
//
// Policy (mirrors the wallet's check_wnet.cjs, aligned with scanHtmlForPublish):
//   CRITICAL raw_fetch / raw_xhr / raw_beacon    — a chain game does I/O only via KV_WNET
//   CRITICAL raw_clipboard_write                 — writeText/setData (readText stays allowed)
//   CRITICAL kv_wnet_redefined                   — window.KV_WNET assigned more than once
//   CRITICAL kv_wnet_stub_not_inert              — the single assignment isn't the
//            guarded offline stub `window.KV_WNET=window.KV_WNET||{req:...reject...`
//            (the guard means the wallet's injected bridge always wins)
//   CRITICAL reply_hook_defined                  — page defines __kvWnetReply (wallet-only)
//   HIGH     external_script / iframe / dynamic_import / service_worker
//   (WebRTC P2P and the engine's ReactNativeWebView result rail stay allowed.)
//
// Usage (repo root):  node patch_townhall_wnet.js   -> patches src/main.rs in place
const fs = require("fs");
const P = "src/main.rs";
let rs = fs.readFileSync(P, "utf8");
let n = 0;
function rep(name, anchor, to, expected) {
  const found = rs.split(anchor).length - 1;
  if (found !== expected) { console.error(`ABORT [${name}]: expected ${expected}, found ${found}`); process.exit(1); }
  rs = rs.split(anchor).join(to); n++; console.log("ok  [" + name + "]");
}

const BLOCK = `
// [KV_WNET] IO discipline for chain games: raw I/O is prohibited, the wallet
// bridge is the only door, and the page may ship at most one INERT offline stub.
static GAME_IO_PATTERNS: Lazy<Vec<(Regex, &'static str, Severity)>> = Lazy::new(|| {
    vec![
        (Regex::new(r"\\bfetch\\s*\\(").unwrap(), "raw_fetch", Severity::Critical),
        (Regex::new(r"XMLHttpRequest").unwrap(), "raw_xhr", Severity::Critical),
        (Regex::new(r"navigator\\.sendBeacon").unwrap(), "raw_beacon", Severity::Critical),
        (Regex::new(r"navigator\\.clipboard\\.writeText|clipboardData\\.setData").unwrap(), "raw_clipboard_write", Severity::Critical),
        (Regex::new(r"(?i)<script[^>]*\\ssrc\\s*=").unwrap(), "external_script", Severity::High),
        (Regex::new(r"(?i)<iframe").unwrap(), "iframe_not_allowed", Severity::High),
        (Regex::new(r"import\\s*\\(").unwrap(), "dynamic_import", Severity::High),
        (Regex::new(r"serviceWorker").unwrap(), "service_worker", Severity::High),
    ]
});
static KV_WNET_ASSIGN: Lazy<Regex> = Lazy::new(|| Regex::new(r"window\\.KV_WNET\\s*=[^=]").unwrap());
static KV_WNET_INERT_STUB: Lazy<Regex> = Lazy::new(|| Regex::new(
    r#"^window\\.KV_WNET=window\\.KV_WNET\\|\\|\\{req:function\\(\\)\\{return Promise\\.reject\\(new Error\\("offline"#).unwrap());
static KV_REPLY_HOOK: Lazy<Regex> = Lazy::new(|| Regex::new(r"__kvWnetReply\\s*=[^=]").unwrap());

pub fn scan_game_io_discipline(code: &str) -> Vec<PatternMatch> {
    let mut out = Vec::new();
    let mut push = |name: &str, severity: Severity| out.push(PatternMatch {
        pattern_name: name.to_string(), severity, line_number: None, context: None });
    for (regex, name, severity) in GAME_IO_PATTERNS.iter() {
        if regex.is_match(code) { push(name, *severity); }
    }
    let assigns: Vec<_> = KV_WNET_ASSIGN.find_iter(code).collect();
    if assigns.len() > 1 { push("kv_wnet_redefined", Severity::Critical); }
    if let Some(m) = assigns.first() {
        let end = (m.start() + 400).min(code.len());
        if !KV_WNET_INERT_STUB.is_match(&code[m.start()..end]) { push("kv_wnet_stub_not_inert", Severity::Critical); }
    }
    if KV_REPLY_HOOK.is_match(code) { push("reply_hook_defined", Severity::Critical); }
    out
}
`;

rep("wnet-patterns",
  "static GAME_PROHIBITED_PATTERNS: Lazy<Vec<(Regex, &'static str, Severity)>> = Lazy::new(|| {",
  BLOCK + "\nstatic GAME_PROHIBITED_PATTERNS: Lazy<Vec<(Regex, &'static str, Severity)>> = Lazy::new(|| {", 1);

const CALL_ANCHOR = "let mut base = scan_code(code, EntityType::Game);";
rep("wnet-in-scan", CALL_ANCHOR,
  CALL_ANCHOR + `

    // [KV_WNET] a chain game (declares the bridge) must keep IO discipline
    if code.contains("KV_WNET") {
        for m in scan_game_io_discipline(code) {
            match m.severity {
                Severity::Critical => base.critical_matches.push(m),
                Severity::High => base.high_matches.push(m),
                Severity::Medium => base.medium_matches.push(m),
                Severity::Low => base.low_matches.push(m),
            }
        }
    }`, 1);

fs.writeFileSync(P, rs);
console.log("\npatched " + P + " (" + n + " patches). cargo check, then redeploy TownHall.");
