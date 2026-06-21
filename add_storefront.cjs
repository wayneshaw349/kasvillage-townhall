const fs = require('fs');
const f = 'C:\\Users\\wayne\\Downloads\\townhall_verification_complete.rs';
let text = fs.readFileSync(f, 'utf8');

// Check what's already there
const has = (s) => text.includes(s);
console.log('Structs: Storefront=' + has('pub struct Storefront'));
console.log('Structs: StorefrontStats=' + has('pub struct StorefrontStats'));
console.log('Structs: VisitRequest=' + has('pub struct VisitRequest'));
console.log('Structs: StorefrontSaveRequest=' + has('pub struct StorefrontSaveRequest'));
console.log('Structs: StorefrontSearchQuery=' + has('pub struct StorefrontSearchQuery'));
console.log('Structs: StorefrontSearchResult=' + has('pub struct StorefrontSearchResult'));
console.log('Structs: VisitResponse=' + has('pub struct VisitResponse'));
console.log('Handlers: api_get_storefront=' + has('pub async fn api_get_storefront'));
console.log('Handlers: api_save_storefront=' + has('pub async fn api_save_storefront'));
console.log('Helpers: verify_signature=' + has('fn verify_signature'));
console.log('Helpers: compute_hash_index=' + has('fn compute_hash_index'));
console.log('Helpers: query_storefront_from=' + has('fn query_storefront_from'));
console.log('Helpers: aggregate_storefront=' + has('fn aggregate_storefront'));
