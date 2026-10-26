# KasCity 4-player harness

Plays a real 4-seat multiplayer game headlessly against 3 local relay nodes, then counts churn
(RESYNC, dice corrections, dropped rolls, stalls) per device.

    cargo build --release --bin kv_relay
    for p in 36001 36002 36003; do PORT=$p ./target/release/kv_relay & done
    mkdir run && cp dev_kascity_v417_browser.html run/
    node tools/mp_harness/harness.cjs run 240 mytag      # needs playwright; writes result_mytag.json

Flux discovery, the three node IPs and the Kaspa DAA clock are all mocked inside the browser routes.
Note: the bot clicker also taps prompts that leak onto other players' turns - like a real player would.
