const fs=require('fs');let s=fs.readFileSync('content_validator.ts','utf8');
const extra=[
'sell boy','buy boy','sell girl','buy girl','sell female','buy female',
'sell male','buy male','sell women','buy women','sell kids','buy kids',
'sell woman','buy woman','sell man','buy man',
'exploit boy','exploit girl','exploit kids','exploit women',
'traffic boy','traffic girl','traffic kids','traffic women',
'abuse boy','abuse girl','abuse kids','abuse women',
'vender ninos','comprar ninos','vender ninas','comprar ninas',
'vendre fille','acheter fille','vendre garcon','acheter garcon',
'prodat devochku','kupit devochku','prodat malchika','kupit malchika',
'mai nu hai','mai nan hai','mai nu ren',
'menina vender','menino vender',
'maedchen verkaufen','jungen verkaufen',
'ladki bechna','ladka bechna',
];
s=s.replace("for (const phrase of blocked)","blocked.push("+extra.map(e=>"'"+e+"'").join(',')+");\n  for (const phrase of blocked)");
fs.writeFileSync('content_validator.ts',s);
console.log('added '+extra.length+' phrases');
