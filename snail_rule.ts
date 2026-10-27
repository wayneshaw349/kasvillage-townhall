// KV_SNAIL_RULE: one forgiving trust rule for the whole wallet.
// Snail Mode slows OPENING apps and screens (Mailbox, Workspace, games, DApps...). It never touches
// money: balance, send, receive, agreements, settling, pledges and vaults always open instantly.
// Rule: only after 3+ deals, and only when the completion rate (Laplace) is under 50%.
// Wait: 1 min + 1 min per deadlock, max 10 min, once per screen every 30 min. Clean deals lift it.

export interface KvTrust { snail: boolean; waitMs: number; newUser: boolean; reason: string; xp: number; pComplete: number; deadlocks: number; samples: number; }

const g: any = globalThis as any;
const NONE: KvTrust = { snail: false, waitMs: 0, newUser: true, reason: '', xp: 0, pComplete: 0.5, deadlocks: 0, samples: 0 };
export const SNAIL_MIN_SAMPLES = 3;
export const SNAIL_PASS_MS = 30 * 60_000;
export const SNAIL_GATED = new Set<string>(['mailbox', 'workspace', 'entertainment', 'town_hall', 'bathroom', 'node_register']);

export function trustFromStats(st: { xp?: number; successes?: number; deadlocks?: number }): KvTrust {
  const s = Math.max(0, Number(st.successes) || 0), d = Math.max(0, Number(st.deadlocks) || 0);
  const samples = s + d, pComplete = (1 + s) / (2 + s + d);
  const snail = samples >= SNAIL_MIN_SAMPLES && pComplete < 0.5;
  const waitMs = snail ? Math.min(60_000 + d * 60_000, 600_000) : 0;
  const need = snail ? Math.max(1, d - s + 1) : 0; // clean deals needed to get back over 50%
  const reason = snail ? `${Math.round(pComplete * 100)}% of your recent deals finished (needs 50%). Finish ${need} more deal${need === 1 ? '' : 's'} cleanly to get back to full speed.` : '';
  return { snail, waitMs, newUser: samples < SNAIL_MIN_SAMPLES, reason, xp: Number(st.xp) || 0, pComplete, deadlocks: d, samples };
}

export async function computeTrust(): Promise<KvTrust> {
  try {
    const { getUserStats } = require('./wallet_registration_v2');
    const t = trustFromStats(await getUserStats());
    g.__kvTrust = t;
    return t;
  } catch { return getTrust(); }
}

export function getTrust(): KvTrust { return (g.__kvTrust as KvTrust) || NONE; }

// What DApps/games may see (read-only, no history, no addresses).
export function publicTrust(): { snail: boolean; waitMs: number; newUser: boolean } {
  const t = getTrust(); return { snail: t.snail, waitMs: t.waitMs, newUser: t.newUser };
}

// Screen gate: remaining wait for this screen (0 = open). Leaving and coming back does not restart the clock.
export function snailGateRemaining(screen: string): number {
  const t = getTrust();
  if (!t.snail || !SNAIL_GATED.has(screen)) return 0;
  const m: Record<string, { start?: number; passed?: number }> = (g.__kvSnailGate = g.__kvSnailGate || {});
  const e = (m[screen] = m[screen] || {}), now = Date.now();
  if (e.passed && now - e.passed < SNAIL_PASS_MS) return 0;
  if (!e.start || (e.passed && now - e.passed >= SNAIL_PASS_MS)) { e.start = now; e.passed = 0; }
  return Math.max(0, t.waitMs - (now - e.start));
}
export function snailMarkPassed(screen: string): void {
  const m = (g.__kvSnailGate = g.__kvSnailGate || {}); m[screen] = { passed: Date.now() };
}
