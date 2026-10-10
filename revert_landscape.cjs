// revert_landscape.cjs — back out the native-orientation approach, restore the old setup.
// 1. OnChainPageView: remove the KV_LANDSCAPE_LOCK effect and the KV_GAME_VIEW_RESET guard
//    (the ⟳/zoom view stack behaves exactly as before today). The [KV] QUAD log stays.
// 2. app.json: orientation "default" -> "portrait" (for future builds).
// 3. src/index.tsx: prepend a startup portrait re-lock — TODAY'S installed build was compiled
//    with "default", so without this the app itself can rotate; the JS lock pins it back
//    to portrait app-wide on the current build, no rebuild needed.
const fs = require('fs');
const norm = (f) => { let s = fs.readFileSync(f, 'utf8'); const crlf = s.includes('\r\n'); return { s: crlf ? s.replace(/\r\n/g, '\n') : s, crlf }; };
const save = (f, s, crlf) => fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s);

// --- 1. OnChainPageView.tsx ---
{
  const F = 'OnChainPageView.tsx';
  let { s, crlf } = norm(F);
  let changed = false;

  const LOCK = `
  // KV_LANDSCAPE_LOCK: real landscape for chain games (replaces the CSS-rotate simulation).
  useEffect(() => {
    if (!props.game) return;
    let SO: any = null;
    try { SO = require('expo-screen-orientation'); } catch { return; }
    try { SO.lockAsync(SO.OrientationLock.LANDSCAPE).catch(() => {}); } catch {}
    return () => { try { SO.lockAsync(SO.OrientationLock.PORTRAIT_UP).catch(() => {}); } catch {} };
  }, []);`;
  if (s.includes(LOCK)) { s = s.replace(LOCK, ''); changed = true; }
  else if (s.includes('KV_LANDSCAPE_LOCK')) { console.error(F + ': KV_LANDSCAPE_LOCK present but block text differs - aborting.'); process.exit(1); }

  const RESET = "\n    if (props.game) { r = false; z = 1; } // KV_GAME_VIEW_RESET: real landscape owns rotation; CSS sim retired for games";
  if (s.includes(RESET)) { s = s.replace(RESET, ''); changed = true; }
  else if (s.includes('KV_GAME_VIEW_RESET')) { console.error(F + ': KV_GAME_VIEW_RESET present but line text differs - aborting.'); process.exit(1); }

  if (changed) { save(F, s, crlf); console.log(F + ': landscape lock + view-reset removed (QUAD log kept)'); }
  else console.log(F + ': nothing to remove (already clean)');
}

// --- 2. app.json ---
{
  const j = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  if (j.expo && j.expo.orientation === 'default') { j.expo.orientation = 'portrait'; fs.writeFileSync('app.json', JSON.stringify(j, null, 2) + '\n'); console.log('app.json: orientation default -> portrait'); }
  else console.log('app.json: orientation already ' + JSON.stringify(j.expo && j.expo.orientation));
}

// --- 3. src/index.tsx startup re-lock (current build allows all orientations) ---
{
  const F = 'src/index.tsx';
  let { s, crlf } = norm(F);
  if (s.includes('KV_PORTRAIT_DEFAULT')) console.log(F + ': already re-locked');
  else {
    const INS = "// KV_PORTRAIT_DEFAULT: this binary was built with orientation \"default\"; pin the app back to portrait at startup.\ntry { const _SO = require('expo-screen-orientation'); _SO.lockAsync(_SO.OrientationLock.PORTRAIT_UP).catch(() => {}); } catch {}\n";
    save(F, INS + s, crlf);
    console.log(F + ': startup portrait lock prepended');
  }
}
console.log('REVERT DONE - reload Metro (r). Wallet: portrait everywhere. Games: old view stack as before today.');
