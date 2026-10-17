// wire_dust_probe.cjs — "Probe Repost Amounts" (dev) button in Workspace.
// Self-sends an announce-sized signed payload at 0.5/0.3/0.2/0.1/0.05 KAS and
// reports which amounts TN10 accepts. Storage mass depends on output size,
// not recipient, so this measures exactly what a repost at that amount faces.
// Money returns to the wallet - only network fees are spent.
const fs = require('fs');
const F = 'Workspace.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_DUST_PROBE')) { console.log('already patched'); process.exit(0); }

const edits = [
  [
`    } catch (e: any) { Alert.alert('Withdraw failed', String(e?.message || e)); }
    setIsLoading(false);
  };`,
`    } catch (e: any) { Alert.alert('Withdraw failed', String(e?.message || e)); }
    setIsLoading(false);
  };

  // KV_DUST_PROBE: smallest repost amount TN10 accepts (self-sends: only fees spent)
  const handleDustProbe = async () => {
    try {
      setIsLoading(true);
      const { _kvResolvePrivHex } = require('./proposal_share');
      const { signRecord, buildPayloadHex } = require('./kaspa_payload');
      const { sendKaspaViaRest } = require('./kaspa_rest_tx');
      const _priv = await _kvResolvePrivHex();
      const _addr = (await SecureStore.getItemAsync('kv_kaspa_address')) || (await SecureStore.getItemAsync('kaspa_address')) || '';
      if (!_priv || !_addr) throw new Error('wallet keys unavailable');
      const _pub2 = bytesToHex(secp256k1.getPublicKey(hexToBytes(_priv), true));
      const _rec = signRecord({ k: 'probe', v: 1, o: _pub2, t: Date.now(), d: { pad: 'x'.repeat(320) } } as any, _priv);
      const _hex = buildPayloadHex(_rec);
      const _rows: string[] = [];
      for (const _kas of [0.5, 0.3, 0.2, 0.1, 0.05]) {
        try {
          const _r: any = await sendKaspaViaRest({ senderAddress: _addr, recipientAddress: _addr, amountSompi: BigInt(Math.round(_kas * 1e8)), privateKeyHex: _priv, network: 'testnet-10' as any, payload: _hex });
          const _tx = String((_r && (_r.txid || _r.transactionId || _r.txId)) || '');
          _rows.push(_kas + ' KAS: ' + (_r && _r.success === false ? 'REJECTED ' + String(_r.error || '').slice(0, 60) : (_tx ? 'OK ' + _tx.slice(0, 10) : 'no txid')));
        } catch (_e: any) { _rows.push(_kas + ' KAS: ERROR ' + String((_e && _e.message) || _e).slice(0, 70)); }
        console.log('[DustProbe]', _rows[_rows.length - 1]);
      }
      Alert.alert('Repost amount probe', _rows.join('\\n') + '\\n\\nSelf-sends - only fees spent. Fee per amount is in Metro ([REST-TX] Fee lines).');
    } catch (e: any) { Alert.alert('Probe failed', String(e?.message || e)); }
    setIsLoading(false);
  };`,
  ],
  [
`<Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Clean Up Untitled Abstracts (withdraw pledges)</Text>
                    </TouchableOpacity>`,
`<Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Clean Up Untitled Abstracts (withdraw pledges)</Text>
                    </TouchableOpacity>
                    {/* KV_DUST_PROBE (dev) */}
                    <TouchableOpacity style={{ backgroundColor: '#44403c', borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginTop: 8 }} onPress={handleDustProbe} disabled={isLoading}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Probe Repost Amounts (dev, fees only)</Text>
                    </TouchableOpacity>`,
  ],
];
let ok = true;
for (let i = 0; i < edits.length; i++) {
  const c = s.split(edits[i][0]).length - 1;
  if (c !== 1) { console.error('ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; }
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const [a, b] of edits) s = s.split(a).join(b);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: Probe Repost Amounts button (dev)');
