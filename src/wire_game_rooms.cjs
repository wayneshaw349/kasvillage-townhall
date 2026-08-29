// wire_game_rooms.cjs — adds mod declaration + route registration for game_rooms into src/main.rs
// Anchors (must each appear exactly once):
//   "mod node_registry;"
//   ".configure(node_registry::configure_node_registry_routes)"
// Aborts before writing on any mismatch. CRLF-safe (string anchors, no $ regex).
const fs = require("fs");
const P = "src/main.rs";
let s = fs.readFileSync(P, "utf8");

if (s.indexOf("mod game_rooms;") !== -1 || s.indexOf("game_rooms::configure") !== -1) {
  console.error("ABORT: game_rooms already wired. File untouched.");
  process.exit(1);
}
if (!fs.existsSync("src/game_rooms.rs")) {
  console.error("ABORT: src/game_rooms.rs not found. Save the module first.");
  process.exit(1);
}
const A1 = "mod node_registry;";
const A2 = ".configure(node_registry::configure_node_registry_routes)";
const c1 = s.split(A1).length - 1, c2 = s.split(A2).length - 1;
if (c1 !== 1 || c2 !== 1) {
  console.error("ABORT: anchor counts mod=" + c1 + " configure=" + c2 + " (expected 1 each). File untouched.");
  process.exit(1);
}
s = s.replace(A1, A1 + "\nmod game_rooms;");
s = s.replace(A2, A2 + "\n                    .configure(game_rooms::configure)");
fs.writeFileSync(P, s);
console.log("OK: mod game_rooms + .configure(game_rooms::configure) wired into " + P);
console.log("Next: cargo check");
