// wire_qa_dm.cjs — two pieces:
//  kaspa_payload.ts  KV_TS_MS: block_time from the API is MILLISECONDS, the
//    directory treated it as seconds -> every listing's age came out negative
//    and clamped to 0 (clock always "fresh", visSort freshness always max).
//    Normalize announcedAt to seconds at the source.
//  VillageMailbox.tsx KV_QA_DM: "Ask the researcher" box in the abstract view.
//    - Composes "I saw your abstract <title> and have a question" + the
//      question, copies it, opens the researcher's chosen channel
//      (Instagram/Telegram/WhatsApp/X/email/link; anything else = copy only).
//    - Per-abstract question hash chain on the asker's phone: #1 free; #2+
//      at the researcher's questionPrice (paid to the author's wallet first,
//      payment txid + chain refs go IN the DM so the author can verify on
//      chain and knows it's a paid follow-up).
const fs = require('fs');

const jobs = [
  {
    f: 'kaspa_payload.ts',
    marker: 'KV_TS_MS',
    edits: [[
      '      announcedAt: blockTime,\n      repostedBy: _repostedBy,',
      '      announcedAt: blockTime > 1e12 ? Math.floor(blockTime / 1000) : blockTime, // KV_TS_MS: API block_time is ms\n      repostedBy: _repostedBy,',
    ]],
  },
  {
    f: 'VillageMailbox.tsx',
    marker: 'KV_QA_DM',
    edits: [
      // state + handler
      [
        '  const [keeperBusy, setKeeperBusy] = useState(false);',
        `  const [keeperBusy, setKeeperBusy] = useState(false);
  // KV_QA_DM: ask-the-researcher via their chosen DM channel
  const [qaText, setQaText] = useState('');
  const [qaBusy, setQaBusy] = useState(false);
  const askQuestion = async (entry: any, cfg: any) => {
    const q = String(qaText || '').trim();
    if (q.length < 5) { Alert.alert('Question', 'Type your question first.'); return; }
    if (qaBusy) return;
    setQaBusy(true);
    try {
      const AS = require('@react-native-async-storage/async-storage').default;
      const { sha256 } = require('@noble/hashes/sha256');
      const { bytesToHex, utf8ToBytes } = require('@noble/hashes/utils');
      const absKey = String(entry.arweaveTx || entry.id || '');
      const chainKey = 'kv_qa_chain_' + absKey.slice(-24);
      const chain: any[] = JSON.parse((await AS.getItem(chainKey)) || '[]');
      const n = chain.length + 1;
      const price = Number((cfg && cfg.questionPrice) || 0);
      const title = String((cfg && cfg.title) || entry.title || 'your abstract');
      let payTx = '';
      if (n >= 2 && price > 0) {
        const go = await new Promise<boolean>((res) => Alert.alert('Follow-up question #' + n, 'Your first question was free. This researcher charges ' + price + ' KAS per follow-up, paid straight to their wallet.', [
          { text: 'Cancel', style: 'cancel', onPress: () => res(false) },
          { text: 'Pay ' + price + ' KAS', onPress: () => res(true) },
        ]));
        if (!go) { setQaBusy(false); return; }
        const ps = require('./proposal_share');
        const SS = require('expo-secure-store');
        const sender = (await SS.getItemAsync('kv_kaspa_address')) || (await SS.getItemAsync('kaspa_address'));
        const priv = await ps._kvResolvePrivHex();
        if (!sender || !priv) throw new Error('wallet identity unavailable');
        const { deriveAddress } = require('./canonical_agreement_steps');
        const _o = String(entry.ownerPubkey || '');
        const authorAddr = deriveAddress(_o.length === 66 ? _o.slice(2) : _o, 'testnet-10' as any);
        const { sendKaspaViaRest } = require('./kaspa_rest_tx');
        const r: any = await sendKaspaViaRest({ senderAddress: sender, recipientAddress: authorAddr, amountSompi: BigInt(Math.round(price * 1e8)), privateKeyHex: priv, network: 'testnet-10' as any });
        if (r && r.success === false) throw new Error(String(r.error || 'payment failed'));
        payTx = String((r && (r.txid || r.transactionId || r.txId)) || '');
        console.log('[QA] paid', price, 'KAS ->', authorAddr.slice(0, 24), payTx.slice(0, 16));
      }
      const prev = chain.length ? String(chain[chain.length - 1].h) : '0'.repeat(64);
      const h = bytesToHex(sha256(utf8ToBytes(prev + '|' + absKey + '|' + q + '|' + Date.now())));
      chain.push({ h, prev, n, t: Date.now(), paid: payTx || undefined });
      await AS.setItem(chainKey, JSON.stringify(chain));
      const msg = n === 1
        ? 'Hi! I saw your abstract "' + title + '" on KasVillage and have a question (my first - free):\\n\\n' + q + '\\n\\nRef: ' + h.slice(0, 16)
        : 'Hi! A follow-up on your abstract "' + title + '" - question #' + n + (payTx ? ', paid ' + price + ' KAS (tx ' + payTx + ')' : '') + ':\\n\\n' + q + '\\n\\nChain ref: ' + h.slice(0, 16) + ' (prev ' + prev.slice(0, 16) + ')';
      const rawHandle = String((cfg && cfg.qaHandle) || '').trim();
      const ch = String((cfg && cfg.qaChannel) || '').toLowerCase();
      const hd = rawHandle.replace(/^@/, '');
      let url = '';
      if (/^https?:\\/\\//i.test(rawHandle)) url = rawHandle;
      else if (ch.indexOf('mail') >= 0 || (rawHandle.indexOf('@') > 0 && rawHandle.indexOf('.') > 0)) url = 'mailto:' + rawHandle + '?subject=' + encodeURIComponent('Question about "' + title + '"') + '&body=' + encodeURIComponent(msg);
      else if (ch.indexOf('insta') >= 0) url = 'https://ig.me/m/' + hd;
      else if (ch.indexOf('telegram') >= 0) url = 'https://t.me/' + hd;
      else if (ch.indexOf('whatsapp') >= 0) url = 'https://wa.me/' + hd.replace(/\\D/g, '') + '?text=' + encodeURIComponent(msg);
      else if (ch.indexOf('twitter') >= 0 || ch === 'x' || ch.indexOf('x ') === 0) url = 'https://x.com/' + hd;
      try { Clipboard.setString(msg); } catch {}
      setQaText('');
      console.log('[QA] question #' + n, 'ref', h.slice(0, 16), '->', url || '(copy only)');
      Alert.alert(n === 1 ? 'Question ready (free)' : 'Follow-up #' + n + ' ready', 'Message copied. ' + (url ? 'Opening ' + (cfg.qaChannel || 'their channel') + ' - paste it into the DM.' : 'Paste it into ' + (cfg.qaChannel || 'their channel') + ': ' + rawHandle), [
        { text: 'OK', onPress: () => { if (url) { try { Linking.openURL(url); } catch {} } } },
      ]);
    } catch (e: any) { Alert.alert('Question failed', String((e && e.message) || e)); }
    setQaBusy(false);
  };`,
      ],
      // UI under the "Questions:" line in the abstract view
      [
        "                    {_qa ? <Text style={{ fontSize: rs.font(10), color: '#57534e', marginTop: rs.s(10) }}>Questions: {_qa}</Text> : null}",
        `                    {_qa ? <Text style={{ fontSize: rs.font(10), color: '#57534e', marginTop: rs.s(10) }}>Questions: {_qa}</Text> : null}
                    {_qa ? ( /* KV_QA_DM */
                      <View style={{ marginTop: rs.s(10), borderWidth: 1, borderColor: '#e7e5e4', borderRadius: rs.s(10), padding: rs.s(10) }}>
                        <Text style={{ fontSize: rs.font(12), fontWeight: 'bold', color: '#292524' }}>Ask the researcher</Text>
                        <Text style={{ fontSize: rs.font(9), color: '#78716c', marginTop: rs.s(2) }}>First question free{Number(cfg.questionPrice || 0) > 0 ? ' \\u00b7 follow-ups ' + cfg.questionPrice + ' KAS' : ''} \\u00b7 delivered to their {String(cfg.qaChannel || 'DM')}</Text>
                        <TextInput value={qaText} onChangeText={setQaText} multiline placeholder="Type your question..." placeholderTextColor="#a8a29e" style={{ borderWidth: 1, borderColor: '#d6d3d1', borderRadius: rs.s(8), marginTop: rs.s(8), padding: rs.s(8), minHeight: rs.s(60), color: '#292524', fontSize: rs.font(12), textAlignVertical: 'top' }} />
                        <TouchableOpacity disabled={qaBusy} onPress={() => askQuestion(storeView.entry, cfg)} style={{ marginTop: rs.s(8), backgroundColor: '#4f46e5', borderRadius: rs.s(10), paddingVertical: rs.s(10), alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(12) }}>{qaBusy ? 'Preparing...' : 'Ask via ' + String(cfg.qaChannel || 'DM')}</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}`,
      ],
    ],
  },
];

let ok = true;
const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8');
  const CRLF = s.includes('\r\n');
  if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (let i = 0; i < j.edits.length; i++) {
    const c = s.split(j.edits[i][0]).length - 1;
    if (c !== 1) { console.error(j.f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; }
  }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) {
  let s = j.s;
  for (const [a, b] of j.edits) s = s.split(a).join(b);
  fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s);
  console.log(j.f + ': patched');
}
console.log('DONE - timestamp fix + ask-the-researcher via DM (first free, chain-counted follow-ups).');
