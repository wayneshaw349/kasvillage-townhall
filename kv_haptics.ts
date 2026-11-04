// KV_HAPTICS: phone buzz on the moments that matter. Uses React Native's built-in
// Vibration (in today's dev builds already - iOS gives a fixed-length buzz).
// When a build ships expo-haptics, it is picked up automatically for soft Taptic taps.
import { Vibration } from 'react-native';

let H: any = null;
try { H = require('expo-haptics'); if (!H || !H.notificationAsync) H = null; } catch { H = null; }

export function kvBuzz(kind: 'tap' | 'ok' | 'done' | 'error' = 'tap'): void {
  try {
    if (H) {
      if (kind === 'done' || kind === 'ok') H.notificationAsync(H.NotificationFeedbackType.Success);
      else if (kind === 'error') H.notificationAsync(H.NotificationFeedbackType.Error);
      else H.impactAsync(H.ImpactFeedbackStyle.Light);
      return;
    }
    if (kind === 'done') Vibration.vibrate([0, 300, 180, 300]);
    else if (kind === 'error') Vibration.vibrate([0, 450, 220, 450, 220, 450]);
    else Vibration.vibrate(120);
  } catch {}
}
