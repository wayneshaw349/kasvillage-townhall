// fix_delist_paint_echo.cjs — close the two delist gaps found in testing:
// 1. VillageMailbox: the instant cache paint now applies the delist filter
//    (it was unfiltered - delisted cards flashed back from cache).
// 2. Workspace: runDelist writes a LOCAL ECHO of the delist into
//    kv_game_delist_cache immediately, so this device hides the card at once
//    instead of waiting to re-fetch its own record from the rails.
const fs = require('fs');

// --- 1. VillageMailbox.tsx: filtered early paint ---
{
  const F = 'VillageMailbox.tsx';
  let s = fs.readFileSync(F, 'utf8');
  const CRLF = s.includes('\r\n');
  if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes('KV_PAINT_FILTER')) console.log(F + ': already patched');
  else {
    const A = "          if (byHead.size) { try { setGames(Array.from(byHead.values()) as any); } catch {} }";
    const c = s.split(A).length - 1;
    if (c !== 1) { console.error(F + ': ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }
    const B = "          // KV_PAINT_FILTER: the instant paint honors delists too\n          if (byHead.size) { try { setGames(Array.from(byHead.values()).filter((it: any) => { const d = delistByHead.get(it.quad.head); if (!d || !(d.t > it.t)) return true; return !!(d.o && it.o && d.o !== it.o); }) as any); } catch {} }";
    s = s.replace(A, B);
    fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
    console.log(F + ': instant cache paint now delist-filtered');
  }
}

// --- 2. Workspace.tsx: local echo on delist ---
{
  const F = 'Workspace.tsx';
  let s = fs.readFileSync(F, 'utf8');
  const CRLF = s.includes('\r\n');
  if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes('local delist echo')) console.log(F + ': already patched');
  else {
    const A = "          const res: any = await delistFromRegistry(owner, head, 'game');";
    const c = s.split(A).length - 1;
    if (c !== 1) { console.error(F + ': ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }
    const B = A + "\n          try { const _AS2 = require('@react-native-async-storage/async-storage').default; const dRaw = await _AS2.getItem('kv_game_delist_cache'); const arr = dRaw ? JSON.parse(dRaw) : []; arr.push({ delist: true, head, t: Date.now(), o: pub }); await _AS2.setItem('kv_game_delist_cache', JSON.stringify(arr)); gadd('local delist echo cached'); } catch {}";
    s = s.replace(A, B);
    fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
    console.log(F + ': runDelist writes local delist echo');
  }
}
console.log('DONE - reload Metro (r) and re-test: DELIST -> lane: gone immediately; ANNOUNCE -> back.');
