// android_perf.ts — Android rendering optimizations
import { Platform, InteractionManager } from 'react-native';
import { useEffect, useRef, useCallback } from 'react';

/**
 * Defer heavy work until after navigation animation completes.
 * Critical for Android where JS thread blocks UI thread.
 */
export function useAfterInteraction(callback: () => void, deps: any[] = []) {
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      callback();
    });
    return () => task.cancel();
  }, deps);
}

/**
 * Throttle a function — prevents rapid re-calls on Android.
 * Use for scroll handlers, polls, and resize events.
 */
export function useThrottle<T extends (...args: any[]) => any>(fn: T, ms: number = 100): T {
  const lastCall = useRef(0);
  return useCallback((...args: any[]) => {
    const now = Date.now();
    if (now - lastCall.current >= ms) {
      lastCall.current = now;
      return fn(...args);
    }
  }, [fn, ms]) as T;
}

/**
 * Skip frames on Android to maintain 60fps.
 * Use for procedural animations that can tolerate lower update rates.
 */
export function shouldSkipFrame(frameCount: number): boolean {
  if (Platform.OS !== 'android') return false;
  // On Android, skip every other frame for non-critical animations
  return frameCount % 2 === 0;
}

/**
 * Android-safe batch state update.
 * React Native on Android doesn't always batch setState calls.
 */
export function batchUpdates(fn: () => void) {
  // React 18+ auto-batches, but for safety:
  if (Platform.OS === 'android') {
    requestAnimationFrame(fn);
  } else {
    fn();
  }
}

/**
 * Reduce poll frequency on Android to save battery and CPU.
 */
export function getPollInterval(baseMs: number): number {
  return Platform.OS === 'android' ? baseMs * 1.5 : baseMs;
}
