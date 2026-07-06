const fs=require('fs');let s=fs.readFileSync('content_validator.ts','utf8');
const ages=['10','11','12','13','14','15','16','17'];
const genders=['girl','boy','female','male','year old'];
const extra=[];
for(const a of ages){for(const g of genders){extra.push(a+' '+g);extra.push(a+'yr '+g);extra.push(a+' yr '+g);extra.push(a+'yo '+g);}}
extra.push('teen sex','teen girl sex','teen boy sex','preteen','pre-teen','preteen sex','pre-teen sex','teen female','teen male','minor sex','minor nude','minor naked','underage girl','underage boy','underage female','underage male','young girl sex','young boy sex','young teen');
s=s.replace("blocked.push(","blocked.push("+extra.map(e=>"'"+e+"'").join(',')+",");
fs.writeFileSync('content_validator.ts',s);
console.log('added '+extra.length+' age phrases');
