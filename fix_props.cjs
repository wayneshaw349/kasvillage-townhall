const fs=require('fs');let s=fs.readFileSync('IOUBalanceSheetShare.tsx','utf8');
s=s.replace("export function IOUBalanceSheetModal(props: Props) {","export function IOUBalanceSheetModal(props: Partial<Props> & { visible: boolean; onClose: () => void }) {");
fs.writeFileSync('IOUBalanceSheetShare.tsx',s);console.log('done');
