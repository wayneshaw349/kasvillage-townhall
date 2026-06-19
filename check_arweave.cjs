const https = require('https');
const q = `{transactions(tags:[{name:"App-Name",values:["KasVillage"]},{name:"KV-Type",values:["verification-proof"]},{name:"KV-Pubkey",values:["031327c9c0469fb1"]}],first:1){edges{node{id tags{name value}}}}}`;
const data = JSON.stringify({query: q});
const req = https.request('https://arweave.net/graphql', {method:'POST',headers:{'Content-Type':'application/json','Content-Length':data.length}}, res => {
  let buf = '';
  res.on('data', d => buf += d);
  res.on('end', () => { const r = JSON.parse(buf); console.log(r.data.transactions.edges.length ? 'PROOF ON ARWEAVE: ' + r.data.transactions.edges[0].node.id : 'NOT ON ARWEAVE YET'); });
});
req.write(data);
req.end();
