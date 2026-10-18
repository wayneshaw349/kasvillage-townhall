// wire_game_contact.cjs - wallet side of KasCity OFFERS.
//  - injects the player's saved contact (Workspace > MY CONTACT) into games as window.KV_MY_CONTACT
//  - a game asking {kvcontact:{to,text}} -> the wallet copies the message and opens Telegram / email / link,
//    with the safety note (settle wallet-to-wallet; never pay an address you did not verify).
//    Games can never open links themselves; only this vetted handoff exists.
const fs = require('fs');
const f = 'OnChainPageView.tsx';
let s = fs.readFileSync(f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_GAME_CONTACT')) { console.log(f + ': already patched - skipping'); process.exit(0); }
const HANDLER = "    // KV_GAME_CONTACT: vetted contact handoff for player-to-player offers (no in-game money)\n" +
"    try { const _c = JSON.parse(event?.nativeEvent?.data || '{}'); if (_c && _c.kvcontact && props.game) { const to = String(_c.kvcontact.to || '').replace(/[<>\"'`\\s]/g, '').slice(0, 80); const text = String(_c.kvcontact.text || '').slice(0, 400); if (!to) return;\n" +
"      let url = '';\n" +
"      if (/^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$/i.test(to)) url = 'mailto:' + to + '?subject=' + encodeURIComponent('KasCity offer') + '&body=' + encodeURIComponent(text);\n" +
"      else if (/^@?[A-Za-z0-9_]{3,}$/.test(to)) url = 'https://t.me/' + to.replace(/^@/, '');\n" +
"      else if (/^(https:\\/\\/)?(t\\.me|wa\\.me|ig\\.me|discord\\.gg|x\\.com)\\//i.test(to)) url = /^https:/i.test(to) ? to : 'https://' + to;\n" +
"      (async () => { try { await require('expo-clipboard').setStringAsync(text); } catch {} })();\n" +
"      const RN = require('react-native');\n" +
"      RN.Alert.alert('Contact player', 'Your message is copied - paste it in the chat.\\n\\nAgree on the deal there, then settle wallet-to-wallet in KasVillage (direct send or a FROST agreement). Never pay an address you did not verify. The owner presses TRANSFER in the game after being paid.' + (url ? '' : '\\n\\nContact: ' + to), url ? [{ text: 'Cancel', style: 'cancel' }, { text: 'Open chat', onPress: () => { RN.Linking.openURL(url).catch(() => RN.Alert.alert('Could not open', to)); } }] : [{ text: 'OK' }]);\n" +
"      return; } } catch {}\n";
const edits = [
  ["    try { const _d = JSON.parse(event?.nativeEvent?.data || '{}'); if (_d.kvlog !== undefined) { console.log('[GamePage]', _d.kvlog); return; } } catch {}\n",
   "    try { const _d = JSON.parse(event?.nativeEvent?.data || '{}'); if (_d.kvlog !== undefined) { console.log('[GamePage]', _d.kvlog); return; } } catch {}\n" + HANDLER],
  ["(props.game ? ('try{window.KV_GRANTS=' + JSON.stringify((globalThis as any).__kvGrantsAll || {}) + ';}catch(e){};') : '')",
   "(props.game ? ('try{window.KV_GRANTS=' + JSON.stringify((globalThis as any).__kvGrantsAll || {}) + ';window.KV_MY_CONTACT=' + JSON.stringify(String((globalThis as any).__kvDevContact || '').slice(0, 80)) + ';}catch(e){};') : '')"],
  ["const v = await AS.getItem(landKey); setLand(", "try { const _mc = await AS.getItem('kv_dev_contact'); if (_mc) (globalThis as any).__kvDevContact = _mc; } catch {} const v = await AS.getItem(landKey); setLand("],
];
for (let i = 0; i < edits.length; i++) { const c = s.split(edits[i][0]).length - 1; if (c !== 1) { console.error(f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1. (run wire_game_landscape_v2.cjs first). Aborting - nothing written.'); process.exit(1); } }
for (const [a, b] of edits) s = s.split(a).join(b);
fs.writeFileSync(f, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log(f + ': patched - games can hand a contact to the wallet (KasCity OFFERS).');
