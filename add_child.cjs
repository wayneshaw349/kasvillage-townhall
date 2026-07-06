const fs=require('fs');let s=fs.readFileSync('content_validator.ts','utf8');
const ages=['10','11','12','13','14','15','16','17'];
const extra=[];
for(const a of ages){extra.push(a+' child',a+'yr child',a+' yr child',a+'yo child');}
extra.push('child sex','child nude','child naked','child porn','child rape','child slave','child bride','child marry','marry child','sex child','nude child','naked child','porn child','rape child','drug child','sell child','buy child','exploit child','traffic child','abuse child','groom child','lure child');
extra.push('nino','nina','enfant','kind','kinder','crianca','rebenok','deti','tifl','atfal','ertong','kodomo','ayi');
for(const a of ages){extra.push(a+' nino',a+' nina',a+' enfant',a+' kind',a+' crianca',a+' rebenok',a+' tifl',a+' ertong',a+' kodomo',a+' ayi');}
extra.push('sexo nino','sexo nina','sexe enfant','sex kind','sexo crianca','seks rebenok','jins tifl','xing ertong','sei kodomo','seong ayi');
extra.push('desnudo nino','desnuda nina','nu enfant','nackt kind','nu crianca','golyy rebenok','ari tifl','luo ti ertong','hadaka kodomo');
extra.push('vender nino','comprar nino','vendre enfant','acheter enfant','kind verkaufen','kind kaufen','vender crianca','comprar crianca','prodat rebenka','kupit rebenka','bay tifl','shira tifl','mai ertong','kodomo uru');
s=s.replace("blocked.push(","blocked.push("+extra.map(e=>"'"+e+"'").join(',')+",");
fs.writeFileSync('content_validator.ts',s);
console.log('added '+extra.length);
