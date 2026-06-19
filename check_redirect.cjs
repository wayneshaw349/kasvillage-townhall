const https = require('https');
https.get('https://zzhw5oyrwx7etzkh6ni4yjuof7ctyhrztrjmbzn3knad5vxmfugq.arweave.developerdao.com/zk9uuxG1_knlR_NRzCaOL8U8HjmcUsDlu1NAPtbsLQ0', res => {
  let buf = '';
  res.on('data', d => buf += d);
  res.on('end', () => console.log('Status:', res.statusCode, '\nData:', buf.slice(0,300)));
}).on('error', e => console.error(e.message));
