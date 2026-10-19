// wire_game_invite.cjs - wallet side of the new KasCity lobby:
//   {kvshare:{text}} -> opens the phone's share sheet (Messages, WhatsApp, Telegram...) with the invite
//   {kvpaste:1}      -> reads the clipboard and hands back ONLY a game code (kc + 8 hex), nothing else
const fs = require('fs');
const f = 'OnChainPageView.tsx';
let s = fs.readFileSync(f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_GAME_INVITE')) { console.log(f + ': already patched - skipping'); process.exit(0); }
const A = "    try { const _d = JSON.parse(event?.nativeEvent?.data || '{}'); if (_d.kvlog !== undefined) { console.log('[GamePage]', _d.kvlog); return; } } catch {}\n";
const H = "    // KV_GAME_INVITE: share an invite / paste a table code (games only)\n" +
"    try { const _g = JSON.parse(event?.nativeEvent?.data || '{}');\n" +
"      if (_g && _g.kvshare && props.game) { const t = String(_g.kvshare.text || '').slice(0, 300); require('react-native').Share.share({ message: t }).catch(() => {}); return; }\n" +
"      if (_g && _g.kvpaste && props.game) { (async () => { let code = ''; try { const t = await require('expo-clipboard').getStringAsync(); code = ((String(t || '').match(/kc[0-9a-f]{8}/i) || [])[0] || '').toLowerCase(); } catch {}\n" +
"        try { webRef.current && webRef.current.injectJavaScript('try{window.__kvPasted&&window.__kvPasted(' + JSON.stringify(code) + ')}catch(e){};true;'); } catch {} })(); return; }\n" +
"    } catch {}\n";
const c = s.split(A).length - 1;
if (c !== 1) { console.error(f + ' anchor count = ' + c + ' - expected 1. Aborting - nothing written.'); process.exit(1); }
s = s.replace(A, A + H);
fs.writeFileSync(f, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log(f + ': patched - KasCity Invite opens the share sheet; Paste reads the table code.');
