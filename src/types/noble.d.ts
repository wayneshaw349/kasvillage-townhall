// src/types/noble.d.ts
// Type declarations for @noble/curves and @noble/hashes

declare module '@noble/curves/secp256k1' {
  export const secp256k1: {
    sign(msgHash: Uint8Array, privKey: Uint8Array, opts?: { prehash?: boolean }): {
      toCompactRawBytes(): Uint8Array;
    };
    getPublicKey(privKey: Uint8Array, compressed?: boolean): Uint8Array;
    verify(sig: Uint8Array, msgHash: Uint8Array, pubKey: Uint8Array): boolean;
    getSharedSecret(privateKey: Uint8Array, publicKey: Uint8Array, compressed?: boolean): Uint8Array;
    ProjectivePoint: {
      fromPrivateKey(privKey: Uint8Array): {
        toRawBytes(compressed?: boolean): Uint8Array;
        multiply(scalar: bigint): {
          toRawBytes(compressed?: boolean): Uint8Array;
          add(other: { toRawBytes(compressed?: boolean): Uint8Array }): {
            toRawBytes(compressed?: boolean): Uint8Array;
          };
        };
      };
      fromHex(hex: Uint8Array | string): {
        toRawBytes(compressed?: boolean): Uint8Array;
        multiply(scalar: bigint): {
          toRawBytes(compressed?: boolean): Uint8Array;
          add(other: { toRawBytes(compressed?: boolean): Uint8Array }): {
            toRawBytes(compressed?: boolean): Uint8Array;
          };
        };
      };
      BASE: {
        multiply(scalar: bigint): {
          toRawBytes(compressed?: boolean): Uint8Array;
        };
      };
    };
    CURVE: {
      n: bigint;
      p: bigint;
      a: bigint;
      b: bigint;
      Gx: bigint;
      Gy: bigint;
    };
  };
  export const schnorr: {
    sign(message: Uint8Array, privateKey: Uint8Array, auxRand?: Uint8Array): Uint8Array;
    verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean;
    getPublicKey(privateKey: Uint8Array): Uint8Array;
  };
}

declare module '@noble/curves/secp256k1.js' {
  export const secp256k1: {
    sign(msgHash: Uint8Array, privKey: Uint8Array, opts?: { prehash?: boolean }): {
      toCompactRawBytes(): Uint8Array;
    };
    getPublicKey(privKey: Uint8Array, compressed?: boolean): Uint8Array;
    verify(sig: Uint8Array, msgHash: Uint8Array, pubKey: Uint8Array): boolean;
    getSharedSecret(privateKey: Uint8Array, publicKey: Uint8Array, compressed?: boolean): Uint8Array;
    ProjectivePoint: {
      fromPrivateKey(privKey: Uint8Array): {
        toRawBytes(compressed?: boolean): Uint8Array;
        multiply(scalar: bigint): {
          toRawBytes(compressed?: boolean): Uint8Array;
          add(other: { toRawBytes(compressed?: boolean): Uint8Array }): {
            toRawBytes(compressed?: boolean): Uint8Array;
          };
        };
      };
      fromHex(hex: Uint8Array | string): {
        toRawBytes(compressed?: boolean): Uint8Array;
        multiply(scalar: bigint): {
          toRawBytes(compressed?: boolean): Uint8Array;
          add(other: { toRawBytes(compressed?: boolean): Uint8Array }): {
            toRawBytes(compressed?: boolean): Uint8Array;
          };
        };
      };
      BASE: {
        multiply(scalar: bigint): {
          toRawBytes(compressed?: boolean): Uint8Array;
        };
      };
    };
    CURVE: {
      n: bigint;
      p: bigint;
      a: bigint;
      b: bigint;
      Gx: bigint;
      Gy: bigint;
    };
  };
  export const schnorr: {
    sign(message: Uint8Array, privateKey: Uint8Array, auxRand?: Uint8Array): Uint8Array;
    verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean;
    getPublicKey(privateKey: Uint8Array): Uint8Array;
  };
}

declare module '@noble/hashes/sha256' {
  export function sha256(data: Uint8Array): Uint8Array;
}

declare module '@noble/hashes/sha256.js' {
  export function sha256(data: Uint8Array): Uint8Array;
}

declare module '@noble/hashes/blake2b' {
  export function blake2b(data: Uint8Array, opts?: { dkLen?: number }): Uint8Array;
}

declare module '@noble/hashes/blake2b.js' {
  export function blake2b(data: Uint8Array, opts?: { dkLen?: number }): Uint8Array;
}

declare module '@noble/hashes/utils' {
  export function bytesToHex(bytes: Uint8Array): string;
  export function hexToBytes(hex: string): Uint8Array;
  export function concatBytes(...arrays: Uint8Array[]): Uint8Array;
  export function utf8ToBytes(str: string): Uint8Array;
}

declare module '@noble/hashes/utils.js' {
  export function bytesToHex(bytes: Uint8Array): string;
  export function hexToBytes(hex: string): Uint8Array;
  export function concatBytes(...arrays: Uint8Array[]): Uint8Array;
  export function utf8ToBytes(str: string): Uint8Array;
}

declare module '@react-native-async-storage/async-storage' {
  const AsyncStorage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
    getAllKeys(): Promise<string[]>;
    multiGet(keys: string[]): Promise<[string, string | null][]>;
    multiSet(keyValuePairs: [string, string][]): Promise<void>;
    multiRemove(keys: string[]): Promise<void>;
  };
  export default AsyncStorage;
}

declare module 'expo-network' {
  export interface NetworkState {
    type: string;
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
  }
  export function getNetworkStateAsync(): Promise<NetworkState>;
  export function getIpAddressAsync(): Promise<string>;
  export function isAirplaneModeEnabledAsync(): Promise<boolean>;
}