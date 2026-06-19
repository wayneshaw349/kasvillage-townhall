const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');
const old = "if (data.ok || data.success) {";
const rep = "if (data.ok || data.success || data.proof_id) {\n        // Poll for async proof\n        if (data.proof_id) {\n          const pollForProof = async () => {\n            for (let i = 0; i < 24; i++) {\n              await new Promise(r => setTimeout(r, 5000));\n              try {\n                const pollRes = await fetch(`${TOWNHALL_BASE}/proof-status/${data.proof_id}`);\n                const pollData = await pollRes.json();\n                console.log('[TownHall] Proof poll:', pollData.status);\n                if (pollData.status === 'ready' && pollData.response) {\n                  data.proof_hash = pollData.response.proof_hash;\n                  data.proof_public_inputs = pollData.response.proof_public_inputs;\n                  break;\n                }\n                if (pollData.status === 'failed') break;\n              } catch {}\n            }\n          };\n          await pollForProof();\n        }";
if (c.includes(old)) {
  c = c.replace(old, rep);
  fs.writeFileSync('townhallscreen.tsx', c);
  console.log('OK: polling wired');
} else { console.log('FAIL'); }
