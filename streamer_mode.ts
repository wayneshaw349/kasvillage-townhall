// KV_STREAMER_MODE — hides balances and addresses while streaming/screen-sharing.
// Seed / key export is blocked while on. Persisted in AsyncStorage (kv_streamer).
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'kv_streamer';
const subs = new Set<(v: boolean) => void>();
const g: any = globalThis as any;
if (typeof g.__kvStreamer !== 'boolean') g.__kvStreamer = false;

AsyncStorage.getItem(KEY).then((v) => {
  const on = v === '1';
  if (on !== g.__kvStreamer) { g.__kvStreamer = on; subs.forEach((f) => { try { f(on); } catch {} }); }
}).catch(() => {});

export function isStreamer(): boolean { return g.__kvStreamer === true; }

export function setStreamer(on: boolean): void {
  g.__kvStreamer = !!on;
  AsyncStorage.setItem(KEY, on ? '1' : '0').catch(() => {});
  subs.forEach((f) => { try { f(!!on); } catch {} });
}

export function useStreamer(): boolean {
  const [on, setOn] = useState<boolean>(isStreamer());
  useEffect(() => { subs.add(setOn); setOn(isStreamer()); return () => { subs.delete(setOn); }; }, []);
  return on;
}

export const STREAMER_BAL = '••• KAS';
export const STREAMER_USD = '≈ $••• USD';

export function maskAddr(addr?: string | null): string {
  if (!addr) return '';
  const i = addr.indexOf(':');
  const pre = i >= 0 ? addr.slice(0, i + 1) : '';
  const body = i >= 0 ? addr.slice(i + 1) : addr;
  return pre + body.slice(0, 2) + '…' + body.slice(-4);
}
