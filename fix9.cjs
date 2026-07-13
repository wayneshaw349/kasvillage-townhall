const fs=require('fs');let d=fs.readFileSync('Dashboard.tsx','utf8');
d=d.replace("let _live=[];","let _live: string[]=[];");
d=d.replace("(JSON.parse(raw)||[]).map(x =>","(JSON.parse(raw)||[]).map((x: any) =>");
d=d.replace(/onNavigatePOBox\?: \(\) => void;\r?\n  onNavigatePhoneProof\?: \(\) => void;/,"onNavigatePOBox?: () => void;");
d=d.replace(/setStats\(\{(\r?\n        agreementsCompleted,)/,"setStats(prev => ({ ...prev,$1");
d=d.replace(/loading: false,?\r?\n      \}\);/,"loading: false,\n      }));");
d=d.replace(/interface DashboardProps \{/,"interface DashboardProps {\n  onNavigateBalanceSheet?: () => void;");
fs.writeFileSync('Dashboard.tsx',d);console.log('done');
