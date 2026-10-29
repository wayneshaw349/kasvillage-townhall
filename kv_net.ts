// KV_NET - the ONE network switch for the whole wallet.
// Flip with:  node wire_mainnet_flip.cjs mainnet|testnet   (then rebuild: npx expo start -c)
// Every module defaults from this constant; address-prefix logic and explicit
// comparisons stay untouched, so mixed display (vault vs hot) keeps working.
export const KV_NET: 'mainnet' | 'testnet-10' = 'mainnet';
export const kvIsMainnet = (): boolean => (KV_NET as string) === 'mainnet';
