const https = require('https');
const q = `{transactions(tags:[{name:"App-Name",values:["KasVillage"]},{name:"KV-Type",values:["verification-proof"]},{name:"KV-Pubkey",values:["031327c9c0469fb1acff6781299b7a16dd1eec8e85b96e9ba59d47d02fb12b63a8"]}],first:1){edges{node{id tags{name value}}}}}`;
const data = JSON.stringify({query: q});
const req = https.request('https://arweave.net/graphql', {method:'POST',headers:{'Content-Type':'application/json','Content-Length':data.length}}, res => {
  let buf = '';
  res.on('data', d => buf += d);
  res.on('end', () => { const r = JSON.parse(buf); console.log(r.data.transactions.edges.length ? 'PROOF ON ARWEAVE: ' + r.data.transactions.edges[0].node.id : 'NOT FOUND'); });
});
req.write(data);
req.end();
