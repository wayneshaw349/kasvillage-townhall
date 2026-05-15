// Polyfill crypto.getRandomValues for Hermes (React Native)
// Must run BEFORE @noble/curves is imported anywhere
import * as ExpoCrypto from 'expo-crypto';
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = {} as Crypto;
}
if (typeof globalThis.crypto.getRandomValues === 'undefined') {
  (globalThis.crypto as any).getRandomValues = (buffer: Uint8Array) => {
    const bytes = ExpoCrypto.getRandomBytes(buffer.length);
    buffer.set(bytes);
    return buffer;
  };
}

// Use require() so polyfill runs BEFORE these modules initialize
const { registerRootComponent } = require('expo');
const { AppNavigator } = require('../AppNaviagator');

registerRootComponent(AppNavigator);