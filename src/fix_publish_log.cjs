// fix_publish_log.cjs — make the PUBLISH CHAIN GAMES log readable:
// taller log, selectable text, and a COPY LOG button that puts the whole
// log on the clipboard. Run from layer1 root: node src\fix_publish_log.cjs
const fs = require("fs");
const P = "Workspace.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("COPY LOG</Text>")) { console.log("already patched"); process.exit(0); }
let n = 0;
function rep(name, a, b, exp) {
  const f = s.split(a).length - 1;
  if (f !== exp) { console.error("ABORT [" + name + "]: expected " + exp + ", found " + f); process.exit(1); }
  s = s.split(a).join(b); n++; console.log("ok  [" + name + "]");
}
rep("log-taller-copy",
`      <View style={{ maxHeight: 220, marginTop: 4 }}>
        <ScrollView nestedScrollEnabled>
          {glog.map((l, i) => <Text key={i} style={{ color: '#e8ddc8', fontSize: 10, fontFamily: 'monospace' }}>{l}</Text>)}
        </ScrollView>
      </View>`,
`      <TouchableOpacity onPress={() => Clipboard.setStringAsync(glog.join(String.fromCharCode(10)))}
        style={{ alignSelf: 'flex-start', backgroundColor: '#2a2118', borderWidth: 1, borderColor: '#6a5a34', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 10, marginTop: 6 }}>
        <Text style={{ color: '#f0c860', fontFamily: 'monospace', fontSize: 10 }}>?? COPY LOG</Text>
      </TouchableOpacity>
      <View style={{ height: 300, marginTop: 4 }}>
        <ScrollView nestedScrollEnabled>
          {glog.map((l, i) => <Text key={i} selectable style={{ color: l.indexOf('FAILED') >= 0 || l.indexOf('ERROR') >= 0 ? '#e06c5a' : '#e8ddc8', fontSize: 10, fontFamily: 'monospace' }}>{l}</Text>)}
        </ScrollView>
      </View>`, 1);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (" + n + "). Reload the app, press PUBLISH again, then COPY LOG and paste it.");
