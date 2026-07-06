const fs=require('fs');let s=fs.readFileSync('content_validator.ts','utf8');
const extra=[
'anal sex','oral sex','group sex','forced sex','rough sex','unprotected sex',
'sexo anal','sexo oral','sexo grupal','sexo forzado',
'sexe anal','sexe oral','sexe force',
'analsex','oralsex','gruppensex','erzwungener sex',
'sexo anal','sexo oral','sexo forcado',
'analnyy seks','oralnyy seks','gruppovoy seks','prinuditelnyy seks',
'jins sharji','jins fami',
'gang xing','kou jiao','qiang po xing jiao',
'yaun sambhog','muh mein sambhog','jabardasti sambhog',
'anaru sekusu','oaru sekusu','goukan',
'hang mun seong','gu gang seong',
];
s=s.replace("blocked.push(","blocked.push("+extra.map(e=>"'"+e+"'").join(',')+",");
fs.writeFileSync('content_validator.ts',s);
console.log('added '+extra.length);
