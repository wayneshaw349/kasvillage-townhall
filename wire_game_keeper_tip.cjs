// wire_game_keeper_tip.cjs - keeper tips for games, same as stores.
// Keep records carry the keeper's own wallet address (readers accept it only if it IS the
// signer's address - nobody can redirect tips). Game cards list "Kept alive by N keeper(s)"
// with a "Tip this keeper" button each; KAS goes wallet-to-wallet. Run after wire_game_repost.cjs.
const fs = require('fs');
const jobs = [
  { f: 'game_chunks.ts', marker: 'KV_KEEPER_ADDR', edits: [
    ["{ head: q.head, game: q.game, manifestAddress: q.manifestAddress, manifestHash: q.manifestHash, ...coords }, 'keep');",
     "{ head: q.head, game: q.game, manifestAddress: q.manifestAddress, manifestHash: q.manifestHash, tip_addr: keeper.address, ...coords }, 'keep'); // KV_KEEPER_ADDR"],
  ]},
  { f: 'VillageMailbox.tsx', marker: 'KV_GAME_KEEPER_TIP', edits: [
    ["          const keepByHead = new Map<string, any>(); // KV_GAME_KEEP\n",
     "          const keepByHead = new Map<string, any>(); // KV_GAME_KEEP\n          const keepersByHead = new Map<string, string[]>(); // KV_GAME_KEEPER_TIP\n"],
    ["            if (it.keep) { const pk = keepByHead.get(it.head);",
     "            if (it.keep) { try { const ka = String((it.d && it.d.tip_addr) || ''); const own = require('./canonical_agreement_steps').deriveAddress(String(it.o).slice(2), 'testnet-10'); if (ka && ka === own) { let L = keepersByHead.get(it.head); if (!L) { L = []; keepersByHead.set(it.head, L); } if (L.indexOf(ka) < 0) L.push(ka); } } catch {} }\n            if (it.keep) { const pk = keepByHead.get(it.head);"],
    ["          const items = Array.from(byHead.values()).filter((it: any) => {\n            const d = delistByHead.get(it.quad.head);",
     "          for (const [kh2, L2] of keepersByHead) { const it2 = byHead.get(kh2); if (it2) byHead.set(kh2, { ...it2, keepers: L2 }); }\n          const items = Array.from(byHead.values()).filter((it: any) => {\n            const d = delistByHead.get(it.quad.head);"],
    ["  const installGame = async (item: any) => {\n",
     "  // KV_GAME_KEEPER_TIP: tip whoever kept a game alive (wallet-to-wallet)\n  const tipGameKeeper = (item: any, addr: string) => {\n    const nm = String((item && (item.name || (item.quad && item.quad.game))) || 'game');\n    require('./kv_prompt').kvPrompt('Tip the keeper', 'Keeper of \"' + nm + '\"\\n' + addr + '\\n\\nKAS goes straight to their wallet. Tips are what keep games alive.', [\n      { text: 'Cancel', style: 'cancel' },\n      { text: 'Send tip', onPress: async (v: string) => {\n        const kas = Number(String(v || '').replace(/[^0-9.]/g, ''));\n        if (!(kas > 0) || kas > 5000) { Alert.alert('Invalid amount', 'Enter between 0 and 5000 KAS.'); return; }\n        try {\n          const ps = require('./proposal_share'); const SS = require('expo-secure-store');\n          const sender = (await SS.getItemAsync('kv_kaspa_address')) || (await SS.getItemAsync('kaspa_address'));\n          const priv = await ps._kvResolvePrivHex();\n          if (!sender || !priv) throw new Error('wallet identity unavailable');\n          if (sender === addr) { Alert.alert('That is you', 'You kept this game alive yourself.'); return; }\n          const { sendKaspaViaRest } = require('./kaspa_rest_tx');\n          const r: any = await sendKaspaViaRest({ senderAddress: sender, recipientAddress: String(addr), amountSompi: BigInt(Math.round(kas * 1e8)), privateKeyHex: priv, network: 'testnet-10' as any });\n          if (r && r.success === false) throw new Error(String(r.error || 'send failed'));\n          console.log('[GameKeeperTip]', kas, 'KAS ->', String(addr).slice(0, 24));\n          Alert.alert('Tip sent \\u2713', kas + ' KAS to the keeper of \"' + nm + '\".');\n        } catch (e: any) { Alert.alert('Tip failed', String((e && e.message) || e)); }\n      } },\n    ], 'plain-text', '1');\n  };\n  const installGame = async (item: any) => {\n"],
    ["function GameRegistryCard({ item, onInstall, installing, onTip, onRepost, reposting, repostProg }: any) {",
     "function GameRegistryCard({ item, onInstall, installing, onTip, onRepost, reposting, repostProg, onTipKeeper }: any) {"],
    ["'Repost — keep this game alive'}</Text>\n            </TouchableOpacity>\n",
     "'Repost — keep this game alive'}</Text>\n            </TouchableOpacity>\n            {onTipKeeper && Array.isArray(item.keepers) && item.keepers.length ? (\n              <View style={{ marginTop: 6 }}>\n                <Text style={{ color: '#d97706', fontSize: 10, fontWeight: '700', textAlign: 'center' }}>{'Kept alive by ' + item.keepers.length + ' keeper' + (item.keepers.length === 1 ? '' : 's')}</Text>\n                {item.keepers.slice(0, 3).map((ka: string, ki: number) => (\n                  <TouchableOpacity key={ki} onPress={() => onTipKeeper(item, ka)} style={{ marginTop: 4, borderWidth: 1, borderColor: '#d97706', borderRadius: 8, paddingVertical: 5, alignItems: 'center' }}>\n                    <Text style={{ color: '#d97706', fontSize: 10, fontWeight: '700' }}>{ka.slice(10, 26) + '… — Tip this keeper'}</Text>\n                  </TouchableOpacity>\n                ))}\n              </View>\n            ) : null}\n"],
    ["onRepost={runRepostGame} ", "onRepost={runRepostGame} onTipKeeper={tipGameKeeper} "],
  ]},
];
let ok = true; const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (let i = 0; i < j.edits.length; i++) { const c = s.split(j.edits[i][0]).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1 (run wire_game_repost.cjs first).'); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) { let s = j.s; for (const [a, b] of j.edits) s = s.split(a).join(b); fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s); console.log(j.f + ': patched'); }
console.log('DONE - game keepers can be tipped like store keepers. Reload the app.');
