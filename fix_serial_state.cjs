const fs = require("fs");
let s = fs.readFileSync("Expo_identity_ritual.tsx", "utf8");

if (s.includes("serialInput") && !s.includes("serialInput, setSerialInput")) {
  // UI exists but state doesn't — add state vars after showMnemonic
  const anchor = "const [showMnemonic, setShowMnemonic] = useState(false);";
  const replacement = anchor + "\n  const [serialInput, setSerialInput] = useState('');\n  const [serialHashed, setSerialHashed] = useState(false);";
  s = s.replace(anchor, replacement);
  fs.writeFileSync("Expo_identity_ritual.tsx", s, "utf8");
  console.log("✅ Fixed — serialInput + serialHashed state added to PhaseAnchor");
} else if (s.includes("serialInput, setSerialInput")) {
  console.log("⚠️  Already exists");
} else {
  console.log("⚠️  No serialInput references found");
}
