const https = require('https');
const urls = [
  'https://gateway.irys.xyz/zk9uuxG1_knlR_NRzCaOL8U8HjmcUsDlu1NAPtbsLQ0',
  'https://arweave.net/zk9uuxG1_knlR_NRzCaOL8U8HjmcUsDlu1NAPtbsLQ0',
  'https://up.arweave.net/zk9uuxG1_knlR_NRzCaOL8U8HjmcUsDlu1NAPtbsLQ0'
];
for (const url of urls) {
  https.get(url, res => {
    let buf = '';
    res.on('data', d => buf += d);
    res.on('end', () => console.log(url.split('/')[2] + ':', res.statusCode, buf.slice(0,100)));
  }).on('error', e => console.log(url.split('/')[2] + ': ERROR', e.message));
}
