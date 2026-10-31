// kv_age.ts — Apple 4.7 mini-app age ratings + declared-age gate.
// Publisher picks a band (4+/9+/13+/17+) at publish; it rides the signed announce
// quad as `age`. Players declare an age band once; DOWNLOAD is blocked above it.
// Unrated games count as 17+. The band is kept on this phone only.
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AGE_BANDS = ['4+', '9+', '13+', '17+'] as const;
export type AgeBand = typeof AGE_BANDS[number];
const KEY = 'kv_age_band_v1';

export const ageNum = (a: any): number => { const n = parseInt(String(a || ''), 10); return [4, 9, 13, 17].indexOf(n) >= 0 ? n : 17; };
export const normAge = (a: any): AgeBand | null => { const n = parseInt(String(a || ''), 10); return [4, 9, 13, 17].indexOf(n) >= 0 ? (n + '+') as AgeBand : null; };

/** <meta name="kv-age" content="13+"> in the game HTML (optional; else asked at publish). */
export function ageFromHtml(html: string): AgeBand | null {
  const s = String(html || '');
  const m = /<meta[^>]+name=["']kv-age["'][^>]*content=["']([^"']*)["']/i.exec(s) || /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']kv-age["']/i.exec(s);
  return m ? normAge(m[1]) : null;
}

/** Publisher: ask for a rating. Resolves null on cancel. */
export function askGameAge(gameId: string): Promise<AgeBand | null> {
  return new Promise((res) => Alert.alert('Age rating for ' + gameId,
    'Required for app-store rules. 4+ no objectionable content · 9+ mild cartoon violence · 13+ moderate violence, mild language · 17+ frequent violence, mature themes.',
    [...AGE_BANDS.map((b) => ({ text: b, onPress: () => res(b) })), { text: 'Cancel', style: 'cancel' as const, onPress: () => res(null) }],
    { cancelable: true, onDismiss: () => res(null) }));
}

async function readBand(): Promise<number | null> {
  try { const v = await AsyncStorage.getItem(KEY); return v ? parseInt(v, 10) : null; } catch { return null; }
}

/** Player: declared age band, asked once. Resolves null on cancel. */
export async function ensureUserAge(): Promise<number | null> {
  const have = await readBand(); if (have) return have;
  const pick: number | null = await new Promise((res) => Alert.alert('How old are you?',
    'Community games carry age ratings. This stays on your phone and is only used to filter downloads.',
    [{ text: 'Under 13', onPress: () => res(9) }, { text: '13 - 16', onPress: () => res(13) }, { text: '17 or older', onPress: () => res(17) }, { text: 'Cancel', style: 'cancel', onPress: () => res(null) }],
    { cancelable: true, onDismiss: () => res(null) }));
  if (pick) { try { await AsyncStorage.setItem(KEY, String(pick)); } catch {} }
  return pick;
}

/** True when this player may download a game rated `age`. Shows the reason if not. */
export async function ageAllowed(age: any, name: string): Promise<boolean> {
  const band = await ensureUserAge(); if (!band) return false;
  const need = ageNum(age);
  if (need <= band) return true;
  Alert.alert('Rated ' + need + '+', '"' + name + '" is rated ' + need + '+' + (normAge(age) ? '' : ' (unrated games count as 17+)') + '. It is not available for your age.');
  return false;
}
