const https = require('https');
const BASE = 'https://kasvillage.app.runonflux.io';

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(buf); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    https.get(BASE + path, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(buf); } });
    }).on('error', reject);
  });
}

async function main() {
  console.log('1. Sending verify-identity...');
  const res = await post('/verify-identity', {
    pubkey: 'test123',
    avatar: { animal:'fox', class:'ranger', combatStyle:'', definingMoment:'', formativeMemory:'', lifePhilosophy:'', loreOrigin:'', mutant:'', mutate:'', name:'Test', occupation:'trader', originStory:'forest born', personality:'', powerSpike:'', race:'elf', signatureMove:'', voiceLine:'', weakness:'' },
    signature: 'self-attest'
  });
  console.log('Response:', JSON.stringify(res, null, 2));
  
  if (res.proof_id) {
    console.log('\n2. Polling for proof (proof_id: ' + res.proof_id + ')...');
    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const poll = await get('/proof-status/' + res.proof_id);
      console.log('   Poll ' + (i+1) + ':', poll.status || JSON.stringify(poll));
      if (poll.status === 'ready') {
        console.log('\n3. PROOF READY!');
        console.log('   Type:', poll.response?.proof_hash?.length > 64 ? 'halo2-ipa' : 'sha256');
        console.log('   Hash:', (poll.response?.proof_hash || '').slice(0, 60) + '...');
        console.log('   Inputs:', poll.response?.proof_public_inputs);
        return;
      }
      if (poll.status === 'failed') { console.log('FAILED'); return; }
    }
    console.log('TIMEOUT: proof not ready after 2 minutes');
  } else {
    console.log('No proof_id — Flux may be running old binary');
  }
}

main().catch(e => console.error('Error:', e.message));
