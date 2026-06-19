const https = require('https');
const txId = 'zk9uuxG1_knlR_NRzCaOL8U8HjmcUsDlu1NAPtbsLQ0';
const urls = [
  'https://turbo.ardrive.io/' + txId,
  'https://arweave.developerdao.com/' + txId,
  'https://g8way.io/' + txId
];
for (const url of urls) {
  https.get(url, res => {
    let buf = '';
    res.on('data', d => buf += d);
    res.on('end', () => console.log(url.split('/')[2] + ':', res.statusCode, buf.slice(0,120)));
  }).on('error', e => console.log(url.split('/')[2] + ': ERROR', e.message));
}
