declare module '@kcoin/kaspa-web3.js' {
  export const NetworkId: {
    Mainnet: 'mainnet';
    Testnet10: 'testnet-10';
    Testnet11: 'testnet-11';
  };
  export type NetworkId = 'mainnet' | 'testnet-10' | 'testnet-11';
  
  export class Fees {
    constructor(priorityFee?: bigint);
    static SenderPays: number;
    static ReceiverPays: number;
  }
  
  export class SendKasParams {
    constructor(from: string, to: string, amount: bigint | string | number, networkId: NetworkId, fees?: Fees);
    toGeneratorSettings(rpc?: any): any;
  }
  
  export interface PendingTransaction {
    sign(privateKeys: (Uint8Array | string)[]): PendingTransaction;
    toSubmittableJsonTx(): any;
  }
  
  export interface FinalTransactionId {
    toHex(): string;
    toString(): string;
  }
  
  export interface GeneratorSummary {
    finalAmount: bigint;
    fee: bigint;
    finalTransactionId: FinalTransactionId;
  }
  
  export class Generator {
    constructor(config: any);
    generate(): Promise<any>;
    generateTransaction(): PendingTransaction;
    summary(): GeneratorSummary;
  }
  
  export class Resolver {
    constructor(urls?: string[]);
    getNode(): Promise<string>;
  }
  
  export class RpcClient {
    constructor(config: { resolver?: Resolver; url?: string; networkId?: NetworkId });
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getServerInfo(): Promise<any>;
    getBlockDagInfo(): Promise<any>;
    getBalanceByAddress(address: string | { address: string }): Promise<{ balance: bigint | number | string }>;
    getUtxosByAddresses(addresses: string[] | { addresses: string[] }): Promise<any>;
    getUtxosByAddress(address: string): Promise<any>;
    submitTransaction(tx: any): Promise<any>;
    getFeeEstimate(): Promise<{ priorityBucket: { feerate: number } }>;
    subscribeUtxosChanged(addresses: string[] | { addresses: string[] }, callback?: (event: any) => void): { uid: string };
    unsubscribeUtxosChanged(uid?: string | string[]): Promise<void>;
  }
  
  export function createTransaction(params: any): any;
  export function signTransaction(tx: any, privKeys: Uint8Array[]): any;
  export function kaspaToSompi(kas: string | number): bigint;
  export function sompiToKaspa(sompi: bigint): string;
}
