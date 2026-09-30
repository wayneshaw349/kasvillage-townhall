// fix_view_memory.cjs - the zoom you pick sticks, per game.
//
// "Make it a little smaller" would otherwise mean editing the source, running
// make_chain over 66 fragments and spending ~77 KAS to republish - for a
// preference. And it would be YOUR preference imposed on every player.
//
// Instead: whatever you set with the rotate / minus / plus controls is saved
// per game head and restored the next time you open it. First open with no
// stored preference auto-fits (scale 0 = measure and fit), so a new player
// still gets a sensible default without touching anything.
// Requires fix_game_view_controls.cjs + fix_game_autofit.cjs.
// Run from layer1 root:  node src\\fix_view_memory.cjs
const fs = require("fs");
const P = "OnChainPageView.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (!s.includes("applyView")) { console.error("ABORT: run fix_game_view_controls.cjs first"); process.exit(1); }
if (s.includes("viewKey")) { console.log("already patched"); process.exit(0); }
const n = s.split("  const [rot, setRot] = useState(false);\n  const [zoom, setZoom] = useState(1);\n  const applyView = (r: boolean, z: number) => {\n    webRef.current?.injectJavaScript(KV_ROT_JS.replace('__R__', r ? '1' : '0').replace('__S__', String(z)));\n  };").length - 1;
if (n !== 1) { console.error("ABORT: found " + n + ", expected 1"); process.exit(1); }
s = s.split("  const [rot, setRot] = useState(false);\n  const [zoom, setZoom] = useState(1);\n  const applyView = (r: boolean, z: number) => {\n    webRef.current?.injectJavaScript(KV_ROT_JS.replace('__R__', r ? '1' : '0').replace('__S__', String(z)));\n  };").join("  const [rot, setRot] = useState(false);\n  const [zoom, setZoom] = useState(1);\n  // Remember how this person likes to view THIS game. Rebuilding the board\n  // smaller would mean 66 fragments and ~77 KAS for a preference; a stored\n  // zoom costs nothing and is per-player rather than baked in for everyone.\n  const viewKey = 'kv_view_' + String((props.game && (props.game as any).head) || 'page').slice(0, 16);\n  const applyView = (r: boolean, z: number) => {\n    webRef.current?.injectJavaScript(KV_ROT_JS.replace('__R__', r ? '1' : '0').replace('__S__', String(z)));\n    try {\n      const AS = require('@react-native-async-storage/async-storage').default;\n      AS.setItem(viewKey, JSON.stringify({ r, z })).catch(() => {});\n    } catch {}\n  };\n  useEffect(() => {\n    if (!props.game || !html) return;\n    let alive = true;\n    (async () => {\n      try {\n        const AS = require('@react-native-async-storage/async-storage').default;\n        const raw = await AS.getItem(viewKey);\n        const v = raw ? JSON.parse(raw) : null;\n        if (!alive) return;\n        // No stored preference: auto-fit once (scale 0 = measure and fit).\n        const r = v ? !!v.r : false, z = v ? Number(v.z) || 0 : 0;\n        setRot(r); setZoom(z);\n        setTimeout(() => applyView(r, z), 350);\n      } catch {}\n    })();\n    return () => { alive = false; };\n  }, [html]);");
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("ok  [view-memory]");
console.log("\npatched " + P + ". Zoom + rotation persist per game; first open auto-fits.");
