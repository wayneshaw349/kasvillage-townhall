// KV_TUTORIAL - practice mode. When active, every money function in the wallet returns a
// simulated success instead of touching the network: send, agreement funding, settle, refund,
// inscribe. Users learn the full flow with practice coins; nothing is signed onto any chain.
// Real mode is one toggle away on the Dashboard ("Go Real").
export const kvSetMode = (m: 'tutorial' | 'real'): void => { (globalThis as any).__kvMode = m; };
export const kvIsTutorial = (): boolean => (globalThis as any).__kvMode === 'tutorial';

export const TUTORIAL_KAS = 1000; // practice balance shown on the Dashboard

export function kvFakeTxid(): string {
  let h = '';
  for (let i = 0; i < 12; i++) h += '0123456789abcdef'[Math.floor(Math.random() * 16)];
  return 'TUTORIAL' + h; // unmistakable in any history view; never a real txid
}

// One simulated broadcast: short delay so the UI feels real, then success.
export async function kvTutorialTx(): Promise<{ success: true; txId: string; explorerUrl: string }> {
  await new Promise((r) => setTimeout(r, 900));
  const txId = kvFakeTxid();
  return { success: true, txId, explorerUrl: '' };
}
