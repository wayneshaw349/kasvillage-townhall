const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

const anchor = "setContract(prev => ({ ...prev, releaseTxId: txId }));\n        setStep(7);\n        Alert.alert('Funds Released!'";
if (!s.includes(anchor)) { console.log('Anchor not found'); process.exit(1); }
if (s.includes('KV-Release inscribed')) { console.log('Already patched'); process.exit(0); }

const inject = `
        // === RELEASE INSCRIPTION + FULL MERKLE PROOF (same as direct TX) ===
        try {
          const _rWallet = await loadMainWallet();
          if (_rWallet) {
            const _rCharset = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
            const _rDp = _rWallet.address.split(':')[1];
            const _rD5 = Array.from(_rDp).map((c) => _rCharset.indexOf(c));
            const _rRb = []; let _rBf = 0, _rBi = 0;
            for (const d of _rD5) { _rBf = (_rBf << 5) | d; _rBi += 5; while (_rBi >= 8) { _rBi -= 8; _rRb.push((_rBf >> _rBi) & 0xff); } }
            const _rMyPk = _rRb[0] === 0x00 && _rRb.length >= 33 ? '02' + _rRb.slice(1, 33).map((b) => b.toString(16).padStart(2, '0')).join('') : '';
            const _rApiBase = (_rWallet.network || 'testnet-10').includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
            // Fetch actual TX from L1 for full proof data
            let _rDaaScore = 0;
            let _rScriptPubKey = '';
            let _rBalanceAfter = 0;
            try {
              // Get DAA score
              const _rDaaResp = await fetch(_rApiBase + '/info/virtual-chain-blue-score');
              if (_rDaaResp.ok) { const _rDaaData = await _rDaaResp.json(); _rDaaScore = _rDaaData.blueScore || 0; }
              // Get output scriptPubKeys from the release TX
              await new Promise(r => setTimeout(r, 2000)); // wait for L1 propagation
              const _rTxResp = await fetch(_rApiBase + '/transactions/' + txId);
              if (_rTxResp.ok) {
                const _rTxData = await _rTxResp.json();
                const _rOutputs = _rTxData.outputs || [];
                _rScriptPubKey = _rOutputs[0]?.scriptPublicKey?.scriptPublicKey || '';
                console.log('[KV-Release] TX fetched:', _rOutputs.length, 'outputs, daa:', _rDaaScore);
              }
              // Get buyer balance after release
              const _rBalResp = await fetch(_rApiBase + '/addresses/' + _rWallet.address + '/balance');
              if (_rBalResp.ok) { _rBalanceAfter = Number((await _rBalResp.json()).balance || '0'); }
            } catch (e) { console.warn('[KV-Release] L1 fetch failed (non-fatal):', e); }
            // Arweave inscription with full lifecycle
            await inscribeAgreementToArweave({
              agreementId: contract.agreementId || '',
              pubkey: _rMyPk,
              amount_sompi: Math.floor((contract.itemPriceKas + contract.sellerCommitmentKas) * 1e8),
              description: contract.itemDescription || '',
              network: _rWallet.network || 'testnet-10',
              status: 'Released',
              frostAddress: contract.multisigAddress || '',
              signature: 'release_' + txId,
              counterpartyPubkey: contract.sellerPubkey || '',
              buyerAmountSompi: Math.floor(contract.itemPriceKas * 1e8),
              sellerAmountSompi: Math.floor(contract.sellerCommitmentKas * 1e8),
            });
            console.log('[KV-Release] inscribed to Arweave');
            // Full merkle proof with L1 data (same as direct TX)
            await uploadPerTxProof({
              txId: txId,
              txIndex: 0,
              amountSompi: BigInt(Math.floor((contract.itemPriceKas + contract.sellerCommitmentKas) * 1e8)),
              scriptPubKey: _rScriptPubKey,
              daaScore: _rDaaScore,
              txType: 'release',
              balanceAfter: _rBalanceAfter,
              agreementId: contract.agreementId,
              uploadFn: async (data, tags) => { const r = await uploadToIrys(data, tags); return r.txId || ''; },
              network: 'testnet',
            });
            console.log('[KV-Release] Merkle proof with L1 data uploaded');
          }
        } catch (e) { console.warn('[KV-Release] Inscription failed (non-fatal):', e); }
`;

s = s.replace(anchor, inject + '        ' + anchor);
fs.writeFileSync(f, s);
console.log('Added Release inscription + full merkle proof');
console.log('Verify:', s.includes('KV-Release') && s.includes('_rDaaScore') && s.includes('_rScriptPubKey'));
