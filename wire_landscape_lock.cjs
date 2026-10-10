// wire_landscape_lock.cjs — real landscape for chain games.
// Lock LANDSCAPE when OnChainPageView mounts in game mode; restore PORTRAIT_UP on unmount.
// Guarded require: on the current dev build (no native module yet) it no-ops instead of crashing;
// after the EAS rebuild (and in Expo Go, which ships the module) it locks for real.
const fs = require('fs');
const F = 'OnChainPageView.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_LANDSCAPE_LOCK')) { console.log('already patched'); process.exit(0); }

const A = "  const { storeAddress, pageHash, network = 'testnet-10', ownerPubkey } = props;";
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }

const INS = A + `
  // KV_LANDSCAPE_LOCK: real landscape for chain games (replaces the CSS-rotate simulation).
  useEffect(() => {
    if (!props.game) return;
    let SO: any = null;
    try { SO = require('expo-screen-orientation'); } catch { return; }
    try { SO.lockAsync(SO.OrientationLock.LANDSCAPE).catch(() => {}); } catch {}
    return () => { try { SO.lockAsync(SO.OrientationLock.PORTRAIT_UP).catch(() => {}); } catch {} };
  }, []);`;

s = s.replace(A, INS);
if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: games lock LANDSCAPE on mount, PORTRAIT_UP on unmount');
