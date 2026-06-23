const fs = require('fs');
const f = 'Workspace.tsx';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// 1. Add hashPubkey import — find last import line and add after
let lastImport = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('import ') && lines[i].includes(' from ')) lastImport = i;
}
if (!lines.slice(0, lastImport + 5).some(l => l.includes("import { hashPubkey }"))) {
  lines.splice(lastImport + 1, 0, "import { hashPubkey } from './arweave_queries';");
  console.log('Added hashPubkey import after line ' + (lastImport + 1));
}

// 2. Fix uploadToIrys — replace typeof check with dynamic import
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("typeof uploadToIrys === 'function'") || 
      lines[i].includes("typeof pledgeUpload === 'function'")) {
    // Replace the if block with dynamic import + call
    // Find the matching closing brace
    let depth = 0, end = i;
    for (let j = i; j < i + 20; j++) {
      for (const ch of lines[j]) { if (ch==='{') depth++; if (ch==='}') depth--; }
      if (depth === 0 && j > i) { end = j; break; }
    }
    
    // Get the body between { and }
    let body = lines.slice(i + 1, end).join('\n');
    // Replace uploadToIrys/pledgeUpload references
    body = body.replace(/await (uploadToIrys|pledgeUpload)\(/g, 'await irysUpload(');
    
    const newBlock = [
      '                        try {',
      "                          const { uploadToIrys: irysUpload } = await import('./arweave_upload');",
      body,
      '                        } catch (uploadErr) { console.warn("Pledge upload failed:", uploadErr); }',
    ];
    
    lines.splice(i, end - i + 1, ...newBlock);
    console.log('Fixed uploadToIrys block with dynamic import');
    break;
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Done');
