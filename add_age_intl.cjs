const fs=require('fs');let s=fs.readFileSync('content_validator.ts','utf8');
const ages=['10','11','12','13','14','15','16','17'];
const extra=[];
// Spanish
for(const a of ages){extra.push(a+' anos nina',a+' anos nino',a+' anos chica',a+' anos chico');}
extra.push('sexo adolescente','menor desnuda','menor desnudo','preadolescente');
// French
for(const a of ages){extra.push(a+' ans fille',a+' ans garcon');}
extra.push('sexe ado','mineur nu','mineur nue','preadolescent');
// German
for(const a of ages){extra.push(a+' jahre maedchen',a+' jahre junge');}
extra.push('teenager sex','minderjaehrig nackt','minderjaerige');
// Portuguese
for(const a of ages){extra.push(a+' anos menina',a+' anos menino');}
extra.push('sexo adolescente','menor nua','menor nu','pre-adolescente');
// Russian transliterated
for(const a of ages){extra.push(a+' let devochka',a+' let malchik');}
extra.push('podrostok seks','golaya nesovershennoletnyaya','nesovershennoletnyaya');
// Arabic transliterated
for(const a of ages){extra.push(a+' sana bint',a+' sana walad');}
extra.push('jins murahiq','qasir ari');
// Chinese pinyin
for(const a of ages){extra.push(a+' sui nv hai',a+' sui nan hai');}
extra.push('qing shao nian xing','wei cheng nian luo ti');
// Hindi transliterated
for(const a of ages){extra.push(a+' saal ladki',a+' saal ladka');}
extra.push('kishor yaun','nabalik nagna');
// Japanese romaji
for(const a of ages){extra.push(a+' sai shoujo',a+' sai shounen');}
extra.push('miseinen sei','miseinen hadaka');
// Korean romanized
for(const a of ages){extra.push(a+' sal sonyeo',a+' sal sonyeon');}
extra.push('cheongsonyon seong','miseongnyeon');
s=s.replace("blocked.push(","blocked.push("+extra.map(e=>"'"+e+"'").join(',')+",");
fs.writeFileSync('content_validator.ts',s);
console.log('added '+extra.length+' intl age phrases');
