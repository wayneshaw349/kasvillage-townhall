const t=require('fs').readFileSync('NeighborAgreement.tsx','utf8');
console.log('import:', t.includes("from './local_agreements'"));
console.log('laUpsert:', t.split('laUpsert(').length-1);
console.log('laStep:', t.split('laStep(').length-1);
console.log('laAbort:', t.split('laAbort(').length-1);
