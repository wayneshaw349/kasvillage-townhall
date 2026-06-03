const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');
let fixes = 0;

// 1: Add missing fields to AbstractItem interface
s = s.replace(
  `interface AbstractItem {
    id: string;
    title: string;
    text: string;
    researcherId: string;
    institutionDomain: string;
    repositoryUrl: string;
    keywords: string[];
    timestamp: number;
    viewCount: number;
    questionCount: number;
    questionPrice: number; // KAS per question (0 = first question free)
  }`,
  `interface AbstractItem {
    id: string;
    title: string;
    text: string;
    researcherId: string;
    institutionDomain: string;
    repositoryUrl: string;
    keywords: string[];
    timestamp: number;
    viewCount: number;
    questionCount: number;
    questionPrice: number;
    discipline?: string;
    videoUrl?: string;
    qaChannel?: string;
    qaHandle?: string;
  }`
);
fixes++;
console.log('1: Added missing fields to AbstractItem');

// 2: Add blue300 to COLORS
s = s.replace(
  "blue200: '#bfdbfe',",
  "blue200: '#bfdbfe',\n  blue300: '#93c5fd',"
);
fixes++;
console.log('2: Added blue300 to COLORS');

// 3: Fix parameter 'p' implicitly has any type
s = s.replace(
  `onChangeText={(t) => setResearcherProfile((p) => p ? ({ ...p, question_price: parseFloat(t) || 0 }) : p)}`,
  `onChangeText={(t) => setResearcherProfile((p: any) => p ? ({ ...p, question_price: parseFloat(t) || 0 }) : p)}`
);
fixes++;
console.log('3: Fixed implicit any on parameter p');

// 4: Fix width string type (row.score + '%')
s = s.replaceAll(
  "width: row.score + '%'",
  "width: (row.score + '%') as any"
);
fixes++;
console.log('4: Fixed width string type');

fs.writeFileSync(f, s);
console.log('Total:', fixes);
