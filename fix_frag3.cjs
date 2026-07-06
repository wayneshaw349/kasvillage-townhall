const fs=require('fs');let s=fs.readFileSync('IOUBalanceSheetShare.tsx','utf8');s=s.replace(/<Text style=\{styles\.empty\}>No IOUs yet<\/Text>/,"<><Text style={styles.empty}>No IOUs yet</Text>");
let idx=s.lastIndexOf("</View>\n            )}");
if(idx<0)idx=s.lastIndexOf("</View>\r\n            )}");
if(idx>0){let end=s.indexOf(")}",idx+8);s=s.slice(0,end+2)+"</>\n"+s.slice(end+2);}
fs.writeFileSync('IOUBalanceSheetShare.tsx',s);console.log('done');
