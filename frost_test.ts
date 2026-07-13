import { deriveFrostAddressLocal, deriveAggregatePubkey } from './frost_complete';
const a = '031327c9c0469fb1'.padEnd(66,'0');
const b = '028fb889458a4e63'.padEnd(66,'0');
const r1 = deriveFrostAddressLocal({ pubkeyA: a, pubkeyB: b, network: 'testnet-10' as any, agreementId: 'AGR_TEST' });
const r2 = deriveFrostAddressLocal({ pubkeyA: b, pubkeyB: a, network: 'testnet-10' as any, agreementId: 'AGR_TEST' });
console.log('addr1:', r1.address);
console.log('order-independent:', r1.address === r2.address);
console.log('code:', r1.verificationCode);
