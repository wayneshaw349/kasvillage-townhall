// KV_TX_SIM: transaction simulation before signing.
// Kaspa transactions are plain inputs -> outputs (no hidden contract code), so the wallet can show
// EXACTLY what a transaction does before it is signed. Runs on the device only; nothing is sent
// until the user taps "Sign & send". Opt-in: only user-facing sends pass `preview` to sendKaspaViaRest.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KNOWN_KEY = 'kv_sim_known';

export interface SimTx {
  requester: string; from: string; to: string; amountSompi: bigint; changeSompi: bigint; feeSompi: bigint;
  walletSompi: bigint; payloadHex: string; inputs: number; prepareOnly: boolean;
}

const kas = (s: bigint) => (Number(s) / 1e8).toLocaleString(undefined, { maximumFractionDigits: 4 });
const body = (a: string) => String(a || '').split(':').pop() || '';

function describePayload(hex: string): string {
  if (!hex) return 'none';
  try {
    let txt = ''; for (let i = 0; i < hex.length && i < 4000; i += 2) txt += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    if (txt.startsWith('KVP1')) {
      let k = ''; try { k = String(JSON.parse(txt.slice(4)).k || ''); } catch { const m = txt.match(/"k"\s*:\s*"([a-z_]+)"/); k = m ? m[1] : ''; }
      const names: Record<string, string> = { store: 'store listing', dapp: 'DApp listing', game: 'game data', keep: 'game repost', flag: 'listing flag', delist: 'delist', attest: 'proof attestation', agreement: 'agreement record', tip: 'tip note', question: 'question to author' };
      return 'KasVillage ' + (names[k] || (k ? k + ' record' : 'record'));
    }
    return 'unknown data (' + hex.length / 2 + ' bytes) - not a KasVillage record';
  } catch { return 'unknown data (' + hex.length / 2 + ' bytes)'; }
}

async function known(): Promise<string[]> { try { return JSON.parse((await AsyncStorage.getItem(KNOWN_KEY)) || '[]'); } catch { return []; } }
export async function rememberRecipient(addr: string): Promise<void> {
  try { const k = await known(); if (!k.includes(addr)) { k.unshift(addr); await AsyncStorage.setItem(KNOWN_KEY, JSON.stringify(k.slice(0, 300))); } } catch {}
}

export async function simulate(tx: SimTx): Promise<{ lines: string[]; red: string[]; amber: string[] }> {
  const red: string[] = [], amber: string[] = [];
  const toSelf = tx.to === tx.from;
  const k = await known();
  if (!toSelf && !k.includes(tx.to)) {
    const b = body(tx.to);
    const look = k.find((x) => { const xb = body(x); return xb !== b && xb.slice(0, 5) === b.slice(0, 5) && xb.slice(-4) === b.slice(-4); });
    if (look) red.push('LOOKALIKE ADDRESS: this looks like an address you used before (' + look.slice(0, 14) + '…' + look.slice(-4) + ') but it is NOT the same. This is a common scam (address poisoning).');
    else amber.push('First time sending to this address - double-check it.');
  }
  const spend = tx.amountSompi + tx.feeSompi;
  if (!toSelf && tx.walletSompi > 0n && spend * 2n > tx.walletSompi) amber.push('This sends more than half of your balance.');
  if (tx.feeSompi > 100_000_000n || (tx.amountSompi > 0n && tx.feeSompi * 20n > tx.amountSompi && tx.feeSompi > 1_000_000n)) amber.push('The network fee is unusually high for this amount.');
  const pd = describePayload(tx.payloadHex);
  if (pd.startsWith('unknown')) amber.push('Data is attached that is not a KasVillage record.');
  let streamer = false; try { streamer = require('./streamer_mode').isStreamer(); } catch {}
  const shortTo = streamer ? require('./streamer_mode').maskAddr(tx.to) : tx.to.slice(0, 18) + '…' + tx.to.slice(-6);
  const after = tx.walletSompi - (toSelf ? tx.feeSompi : spend);
  const lines = [
    'Requested by: ' + tx.requester,
    (toSelf ? 'Move ' : 'Send ') + kas(tx.amountSompi) + ' KAS → ' + (toSelf ? 'yourself' : shortTo),
    tx.changeSompi > 0n ? 'Change back to you: ' + kas(tx.changeSompi) + ' KAS' : 'No change output',
    'Network fee: ' + kas(tx.feeSompi) + ' KAS (' + tx.inputs + ' coin' + (tx.inputs === 1 ? '' : 's') + ' spent)',
    'Attached data: ' + pd,
    'Your balance after: ' + (streamer ? '••• KAS' : '≈ ' + kas(after > 0n ? after : 0n) + ' KAS'),
  ];
  if (tx.prepareOnly) lines.push('(Prepared now, broadcast in the next agreement step)');
  return { lines, red, amber };
}

export async function confirmSimulatedTx(tx: SimTx): Promise<boolean> {
  const { lines, red, amber } = await simulate(tx);
  const RN = require('react-native');
  const msg = 'We ran a simulation of this transaction before signing. Nothing has been sent yet.\n\n'
    + lines.join('\n')
    + (red.length ? '\n\n⛔ ' + red.join('\n⛔ ') : '')
    + (amber.length ? '\n\n⚠️ ' + amber.join('\n⚠️ ') : '')
    + (!red.length && !amber.length ? '\n\n✅ No problems found.' : '');
  const ask = (title: string, body: string, okText: string) => new Promise<boolean>((res) => {
    RN.Alert.alert(title, body, [
      { text: 'Cancel', style: 'cancel', onPress: () => res(false) },
      { text: okText, style: red.length ? 'destructive' : 'default', onPress: () => res(true) },
    ], { cancelable: true, onDismiss: () => res(false) });
  });
  let ok = await ask('🔍 Transaction simulation', msg, red.length ? 'Send anyway' : 'Sign & send');
  if (ok && red.length) ok = await ask('Are you sure?', 'The simulation found a serious warning:\n\n' + red.join('\n') + '\n\nOnly continue if you are certain this address is correct.', 'Yes, send');
  if (ok && tx.to !== tx.from) await rememberRecipient(tx.to);
  return ok;
}
