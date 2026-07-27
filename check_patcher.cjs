const t=require('fs').readFileSync('patch_inbox_localfirst.cjs','utf8');
const m=t.match(/const A =\s*([\s\S]{0,120})/);
console.log(m?m[1]:'NOT FOUND');
