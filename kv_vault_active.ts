// KV_VAULT_ACTIVE - vaults follow the Real/Tutorial toggle.
// A key works on every network; only the address prefix differs. Vaults created on testnet
// stored a kaspatest: address, so in Real mode we re-derive the SAME key's mainnet address
// (card vault: from its stored pubkey; FROST vault: from both stored pubkeys + vaultId).
// Nothing is regenerated and no key material changes.
import * as SecureStore from 'expo-secure-store';

export type KvNet = 'mainnet' | 'testnet-10';

export function kvActiveNet(): KvNet {
  return require('./kv_tutorial').kvIsTutorial() ? 'testnet-10' : require('./kv_net').KV_NET;
}

const hrpOf = (n: string) => (n.startsWith('testnet') ? 'kaspatest' : 'kaspa');
const onNet = (addr: string, n: string) => !!addr && addr.split(':')[0] === hrpOf(n);

/** Card-vault address for the active network ('' if no vault). */
export async function kvVaultAddrActive(): Promise<string> {
  const net = kvActiveNet();
  const stored = (await SecureStore.getItemAsync('kv_vault_address')) || '';
  if (!stored || onNet(stored, net)) return stored;
  const pub = (await SecureStore.getItemAsync('kv_vault_pubkey')) || '';
  if (pub.length < 66) return '';           // cannot re-derive without the pubkey: show nothing rather than a wrong-network address
  const { hexToBytes } = require('@noble/hashes/utils');
  const { kaspaAddressFromXOnly } = require('./wallet_registration_v2');
  return kaspaAddressFromXOnly(hexToBytes(pub.slice(2, 66)), hrpOf(net));
}

/** FROST vault re-derived for the active network (null if none). */
export async function kvFrostVaultActive(): Promise<any | null> {
  let v: any = null;
  try { const raw = await SecureStore.getItemAsync('kv_frost_vault'); v = raw ? JSON.parse(raw) : null; } catch { return null; }
  if (!v) return null;
  const net = kvActiveNet();
  if (v.network === net && onNet(v.address, net)) return v;
  try {
    const { deriveVault } = require('./frost_qr_signer');
    const d = deriveVault({ vaultId: v.vaultId, myPubkey: v.myPubkey, cosignerPubkey: v.cosignerPubkey, network: net });
    return { ...v, ...d, createdAt: v.createdAt };
  } catch { return null; }
}
