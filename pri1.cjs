const fs=require('fs');
// frost_complete: add frostCounter to param type
let f=fs.readFileSync('frost_complete.ts','utf8');
f=f.replace("export function deriveFrostAddressLocal(params: {","export function deriveFrostAddressLocal(params: {\n  frostCounter?: number;");
fs.writeFileSync('frost_complete.ts',f);
// kv_proposal: add frostCounter+buyerPubkey to param type, fix parts
let k=fs.readFileSync('kv_proposal.ts','utf8');
k=k.replace("if (params.frostCounter !== undefined) parts.push(String(params.frostCounter));","");
k=k.replace("params.network, params.buyerR, params.verificationCode, desc, params.buyerPubkey || ''].join('|');","params.network, params.buyerR, params.verificationCode, desc, (params as any).buyerPubkey || '', String((params as any).frostCounter ?? '')].join('|');");
fs.writeFileSync('kv_proposal.ts',k);
// townhall_client: frostCounter on agreement type
let t=fs.readFileSync('townhall_client.ts','utf8');
t=t.replace("if (agreement.frostCounter !== undefined)","if ((agreement as any).frostCounter !== undefined)");
t=t.replace("tags.push({ name: 'KV-FrostCounter', value: String(agreement.frostCounter) });","tags.push({ name: 'KV-FrostCounter', value: String((agreement as any).frostCounter) });");
t=t.replace("const agreements = await Promise.all(edges.map(async (edge) => {","const agreements = await Promise.all(edges.map(async (edge: any) => {");
t=t.replace("const tags = edge.node.tags.reduce((acc, t) => {","const tags = edge.node.tags.reduce((acc: any, t: any) => {");
t=t.replace("description: agreementData.description ||","description: (agreementData as any).description ||");
fs.writeFileSync('townhall_client.ts',t);console.log('done');
