// KV_RELAY_NET - every relay call names its network. The relay serves both; without this
// it defaults to testnet-10 (old clients), which is why mainnet game chunks came back
// "orphan" (a testnet node has never seen mainnet coins) and the walk anchor was a
// testnet block hash. Follows the Real/Tutorial toggle.
export function kvRelayNet(): 'mainnet' | 'testnet-10' {
  try { return require('./kv_vault_active').kvActiveNet(); } catch { return require('./kv_net').KV_NET; }
}
export const kvRelayNetQ = (): string => 'network=' + kvRelayNet();
