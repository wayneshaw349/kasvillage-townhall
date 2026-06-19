const https = require('https');
https.get('https://arweave.net/zk9uuxG1_knlR_NRzCaOL8U8HjmcUsDlu1NAPtbsLQ0', res => {
  let buf = '';
  res.on('data', d => buf += d);
  res.on('end', () => { console.log('Status:', res.statusCode); console.log('Data:', buf.slice(0, 200)); });
}).on('error', e => console.error(e));
