const fs = require("fs");
const P = "Workspace.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("</React.Fragment>")) { console.log("already patched"); process.exit(0); }
let n = 0;
function rep(name, a, b, exp) {
  const f = s.split(a).length - 1;
  if (f !== exp) { console.error("ABORT [" + name + "]: expected " + exp + ", found " + f); process.exit(1); }
  s = s.split(a).join(b); n++; console.log("ok  [" + name + "]");
}
rep("frag-open",
".map(([id, e]: any) => (\n        <TouchableOpacity key={id + '-ann'}",
".map(([id, e]: any) => (\n        <React.Fragment key={id}>\n        <TouchableOpacity key={id + '-ann'}", 1);
rep("frag-close",
"            {gbusy === id ? 'PUBLISHING ' + id + '\u2026' : 'PUBLISH ' + id + ' (' + e.bundle.frags.length + ' frags)'}\n          </Text>\n        </TouchableOpacity>\n      ))}",
"            {gbusy === id ? 'PUBLISHING ' + id + '\u2026' : 'PUBLISH ' + id + ' (' + e.bundle.frags.length + ' frags)'}\n          </Text>\n        </TouchableOpacity>\n        </React.Fragment>\n      ))}", 1);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("patched " + P + " (" + n + "). Bundle again.");
