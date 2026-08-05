const fs = require("fs");
const f = "TownHallScreen.tsx";
const orig = fs.readFileSync(f, "utf8");
let s = orig;

// The mis-placed button: it sits between the copy button close (1510) and the row close (1518).
const nl = s.includes("\r\n") ? "\r\n" : "\n";
const btnBlock = [
"              <TouchableOpacity",
"                style={{ marginTop: 8, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: COLORS.amber600, borderRadius: 8, alignItems: 'center', opacity: aptRegistering ? 0.6 : 1 }}",
"                disabled={aptRegistering}",
"                onPress={handleRegisterApt}",
"              >",
"                <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>{aptRegistering ? 'Registering…' : 'Register APT (make searchable)'}</Text>",
"              </TouchableOpacity>"
].join(nl);

if (s.split(btnBlock).length - 1 !== 1) { console.error("button block count", s.split(btnBlock).length-1, "-- ABORT"); process.exit(1); }

// Remove it from inside the row (plus the leading newline that precedes it)
s = s.replace(nl + btnBlock, "");

// Now re-insert AFTER the APT identityRow closes. Anchor: the copyBtn(handleCopyApt) TouchableOpacity + its </TouchableOpacity> + the row-closing </View>.
const rowClose = [
"                <TouchableOpacity style={styles.copyBtn} onPress={handleCopyApt}>",
"                  <Copy size={rs.s(18)} color={COLORS.amber600} />",
"                </TouchableOpacity>",
"              </View>"
].join(nl);

if (s.split(rowClose).length - 1 !== 1) { console.error("rowClose anchor count", s.split(rowClose).length-1, "-- ABORT"); process.exit(1); }

// place button below the closed row (indented to sit inside the <> fragment, sibling to the rows)
s = s.replace(rowClose, rowClose + nl + btnBlock);

fs.writeFileSync(f + ".bak5", orig);
fs.writeFileSync(f, s);
console.log("moved Register APT button below the identity row");
