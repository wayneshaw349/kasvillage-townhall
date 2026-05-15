// ============================================================================
// KASVILLAGE - UNIFIED KASPA MODULE
// ============================================================================
import { KaspaClient, KaspaNetwork, FeeEstimate, FeeCalculation, UtxoEntry, TransactionResult, ServerInfo } from './KaspaClient';

let _client: KaspaClient | null = null;
let _network: KaspaNetwork = 'testnet-10';
let _connectionPromise: Promise<ServerInfo> | null = null;

export async function getClient(): Promise<KaspaClient> {
  if (!_client) _client = new KaspaClient(_network);
  if (!_client.isConnected()) {
    if (!_connectionPromise) {
      _connectionPromise = _client.connect().finally(() => { _connectionPromise = null; });
    }
    await _connectionPromise;
  }
  return _client;
}

export async function connect(): Promise<KaspaClient> { return getClient(); }

export function setNetwork(network: KaspaNetwork): void {
  if (_client?.isConnected()) throw new Error('Cannot change network while connected. Call disconnect() first.');
  _network = network; _client = null;
}

export function getNetwork(): KaspaNetwork { return _network; }

export async function disconnect(): Promise<void> {
  if (_client) { await _client.disconnect(); _client = null; }
}

export function isConnected(): boolean { return _client?.isConnected() ?? false; }

// BALANCE & UTXO
export async function getBalance(address: string): Promise<bigint> {
  return (await getClient()).getBalance(address);
}

export async function getBalanceKAS(address: string): Promise<number> {
  return (await getClient()).getBalanceKAS(address);
}

export async function getUtxos(address: string): Promise<UtxoEntry[]> {
  return (await getClient()).getUtxos([address]);
}

export async function getSpendableUtxos(address: string): Promise<UtxoEntry[]> {
  return (await getClient()).getSpendableUtxos(address);
}

export async function getSpendableBalance(address: string): Promise<bigint> {
  return (await getClient()).getSpendableBalance(address);
}

// FEE ESTIMATION
export async function getFeeEstimate(): Promise<FeeEstimate> {
  return (await getClient()).getFeeEstimate();
}

export async function calculateFee(
  inputCount: number, outputCount: number, payloadBytes?: number, priority?: 'low' | 'normal' | 'priority'
): Promise<FeeCalculation> {
  return (await getClient()).calculateFee(inputCount, outputCount, payloadBytes, priority);
}

export async function getRecommendedFee(
  utxoCount?: number, priority?: 'low' | 'normal' | 'priority'
): Promise<FeeCalculation> {
  return (await getClient()).getRecommendedFee(utxoCount, priority);
}

export async function estimateSendFee(
  address: string, amountSompi: bigint, priority?: 'low' | 'normal' | 'priority'
): Promise<FeeCalculation & { utxoCount: number; sufficientBalance: boolean }> {
  return (await getClient()).estimateSendFee(address, amountSompi, priority);
}

// TRANSACTIONS
export async function sendKAS(
  senderAddress: string, recipientAddress: string, amountKAS: number, privateKeyHex: string, priorityFeeKAS?: number
): Promise<TransactionResult> {
  return (await getClient()).sendKAS(senderAddress, recipientAddress, amountKAS, privateKeyHex, priorityFeeKAS);
}

export async function sendSompi(
  senderAddress: string, recipientAddress: string, amountSompi: bigint, privateKeyHex: string, priorityFeeSompi?: bigint
): Promise<TransactionResult> {
  const amountKAS = Number(amountSompi) / 1e8;
  const priorityFeeKAS = priorityFeeSompi ? Number(priorityFeeSompi) / 1e8 : 0;
  return (await getClient()).sendKAS(senderAddress, recipientAddress, amountKAS, privateKeyHex, priorityFeeKAS);
}

export async function broadcastTransaction(signedTx: any): Promise<string> {
  return (await getClient()).broadcastTransaction(signedTx);
}

// INSCRIPTIONS
export async function sendWithInscription(
  senderAddress: string, recipientAddress: string, amountSompi: bigint,
  payload: Uint8Array, privateKeyHex: string, priorityFeeSompi?: bigint
): Promise<TransactionResult> {
  return (await getClient()).sendWithInscription(senderAddress, recipientAddress, amountSompi, payload, privateKeyHex, priorityFeeSompi);
}

export async function inscribeIdentity(
  pubkey: string, aptHash: string, avatarHash: string, deviceAnchorHash: string, privateKeyHex: string
): Promise<TransactionResult> {
  return (await getClient()).inscribeIdentity(pubkey, aptHash, avatarHash, privateKeyHex);
}

export async function inscribeFrostEvent(
  eventType: 'C' | 'D' | 'X' | 'R', agreementHash: string, amountSompi: bigint, privateKeyHex: string, senderAddress: string
): Promise<TransactionResult> {
  return (await getClient()).inscribeFrostEvent(eventType, agreementHash, amountSompi, privateKeyHex, senderAddress);
}

export async function sendWithOpReturn(
  recipientAddress: string, amountSompi: bigint, opReturnData: string, privateKeyHex?: string
): Promise<TransactionResult> {
  let senderAddress: string;
  let privKey: string;

  if (privateKeyHex) {
    privKey = privateKeyHex;
    const { secp256k1 } = await import('@noble/curves/secp256k1');
    const privBytes = hexToBytes(privateKeyHex);
    const pubBytes = secp256k1.getPublicKey(privBytes, true);
    const xOnly = pubBytes.slice(1);
    const prefix = _network === 'mainnet' ? 'kaspa' : 'kaspatest';
    senderAddress = xOnlyToAddress(xOnly, prefix);
  } else {
    const SecureStore = await import('expo-secure-store');
    const storedPrivKey = await SecureStore.getItemAsync('kv_private_key');
    const storedAddress = await SecureStore.getItemAsync('kv_kaspa_address');
    if (!storedPrivKey || !storedAddress) throw new Error('No wallet keys found');
    privKey = storedPrivKey;
    senderAddress = storedAddress;
  }

  return (await getClient()).sendWithInscription(senderAddress, recipientAddress, amountSompi, hexToBytes(opReturnData), privKey);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

// Correct Kaspa bech32 — 40-bit polymod, 8-char checksum
function xOnlyToAddress(xOnly: Uint8Array, prefix: string): string {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  function kaspaPolymod(values: number[]): bigint {
    let c = 1n;
    for (const d of values) {
      const c0 = c >> 35n;
      c = ((c & 0x07fffffffffn) << 5n) ^ BigInt(d);
      if (c0 & 0x01n) c ^= 0x98f2bc8e61n;
      if (c0 & 0x02n) c ^= 0x79b76d99e2n;
      if (c0 & 0x04n) c ^= 0xf33e5fb3c4n;
      if (c0 & 0x08n) c ^= 0xae2eabe2a8n;
      if (c0 & 0x10n) c ^= 0x1e4f43e470n;
    }
    return c ^ 1n;
  }
  function conv8to5(payload: number[]): number[] {
    const result: number[] = [];
    let buff = 0, bits = 0;
    for (const c of payload) {
      buff = (buff << 8) | c; bits += 8;
      while (bits >= 5) { bits -= 5; result.push((buff >> bits) & 31); buff &= (1 << bits) - 1; }
    }
    if (bits > 0) result.push((buff << (5 - bits)) & 31);
    return result;
  }
  const fullPayload = [0, ...Array.from(xOnly)];
  const fivebitPayload = conv8to5(fullPayload);
  const fivebitPrefix = Array.from(prefix).map(c => c.charCodeAt(0) & 0x1f);
  const checksumInput = [...fivebitPrefix, 0, ...fivebitPayload, 0, 0, 0, 0, 0, 0, 0, 0];
  const cs = kaspaPolymod(checksumInput);
  const csBytes: number[] = [];
  for (let i = 4; i >= 0; i--) csBytes.push(Number((cs >> BigInt(i * 8)) & 0xFFn));
  const cs5bit = conv8to5(csBytes);
  let addr = prefix + ':';
  for (const d of [...fivebitPayload, ...cs5bit]) addr += CHARSET[d];
  return addr;
}

// BLOCKCHAIN INFO
export async function getVirtualDaaScore(): Promise<bigint> {
  return (await getClient()).getVirtualDaaScore();
}

export async function getBlockDagInfo(): Promise<{ virtualDaaScore: bigint; networkName: string }> {
  return (await getClient()).getBlockDagInfo();
}

export async function getServerInfo(): Promise<ServerInfo> {
  return (await getClient()).getServerInfo();
}

export async function getTransaction(txId: string): Promise<any> {
  return (await getClient()).getTransaction(txId);
}

// SUBSCRIPTIONS
export async function subscribeUtxosChanged(addresses: string[], callback: (data: any) => void): Promise<string> {
  return (await getClient()).subscribeUtxosChanged(addresses, callback);
}

export async function unsubscribeUtxosChanged(uid: string): Promise<void> {
  return (await getClient()).unsubscribeUtxosChanged(uid);
}

// UTILITIES
export function getExplorerUrl(txId: string): string {
  if (!_client) {
    const base = _network === 'mainnet' ? 'https://explorer.kaspa.org/txs/' : 'https://explorer-tn10.kaspa.org/txs/';
    return base + txId;
  }
  return _client.getExplorerUrl(txId);
}

export function getFaucetUrl(): string | null {
  if (_network === 'mainnet') return null;
  return 'https://faucet-testnet.kas.fyi/';
}

export function kasToSompi(kas: number): bigint { return BigInt(Math.round(kas * 1e8)); }
export function sompiToKas(sompi: bigint): number { return Number(sompi) / 1e8; }
export function formatKAS(sompi: bigint, decimals: number = 4): string { return sompiToKas(sompi).toFixed(decimals) + ' KAS'; }

export function isValidAddress(address: string): boolean {
  if (!address) return false;
  const prefix = _network === 'mainnet' ? 'kaspa:' : 'kaspatest:';
  if (!address.startsWith(prefix)) return false;
  const data = address.slice(prefix.length);
  return data.length >= 60 && data.length <= 65;
}

export type { KaspaNetwork, FeeEstimate, FeeCalculation, UtxoEntry, TransactionResult, ServerInfo };
export { KaspaClient };