const https = require('https');
const q = `{transactions(tags:[{name:"App-Name",values:["KasVillage"]}],first:5){edges{node{id tags{name value}}}}}`;
const data = JSON.stringify({query: q});
const req = https.request('https://arweave.net/graphql', {method:'POST',headers:{'Content-Type':'application/json','Content-Length':data.length}}, res => {
  let buf = '';
  res.on('data', d => buf += d);
  res.on('end', () => { 
    const r = JSON.parse(buf);
    const edges = r.data?.transactions?.edges || [];
    console.log('Total KasVillage TXs on Arweave:', edges.length);
    edges.forEach(e => {
      const tags = e.node.tags.map(t => t.name + '=' + t.value).join(', ');
      console.log('  TX:', e.node.id.slice(0,20) + '...', tags);
    });
  });
});
req.write(data);
req.end();
