const fs=require('fs');let s=fs.readFileSync('content_validator.ts','utf8');
const extra=[
// Spanish
'violacion','abusar sexualmente','abuso sexual','pornografia infantil',
'sexo con menor','sexo con nino','sexo con nina','desnudo menor',
'drogas para ninos','drogar mujer','drogar chica','pedofilia',
'trata sexual','esclava sexual','acoso sexual menor',
'vender metanfetamina','comprar metanfetamina','vender crack','comprar crack',
'vender marihuana','comprar marihuana','vender extasis','comprar extasis',
// French
'viol','abus sexuel','sexe avec mineur','pornographie enfantine',
'nu mineur','droguer fille','droguer femme','pedophilie',
'esclave sexuel','exploitation sexuelle','vendre crack','acheter crack',
'vendre marijuana','acheter marijuana','vendre ecstasy','acheter ecstasy',
// German
'vergewaltigung','sexueller missbrauch','sex mit minderjaehrigen',
'kinderporno','nackt minderjaehrig','drogen maedchen','paedophilie',
'sexsklave','sexuelle ausbeutung','crack verkaufen','crack kaufen',
// Portuguese
'estupro','abuso sexual','sexo com menor','pornografia infantil',
'nu menor','drogar menina','drogar mulher','pedofilia',
'escravo sexual','exploracao sexual','vender crack','comprar crack',
// Russian transliterated
'iznasilovanie','seksualnoe nasilie','seks s nesovershennoletnim',
'detskoe porno','golyy rebenok','pedofiliya','seksualnyy rab',
'prodat metamfetamin','kupit metamfetamin','prodat marihuanu','kupit marihuanu',
// Arabic transliterated
'ightisab','itida jinsi','jins maa qasir','suar atfal',
'takhdir fatah','bidufiliya','abd jinsi',
// Chinese pinyin
'qiang jian','xing qin hai','yu wei cheng nian ren xing jiao',
'er tong luo ti','xia yao','lian tong pi','xing nu li',
'mai bing du','mai da ma','mai yao tou wan',
// Hindi transliterated
'balatkar','yaun shoshan','nabalik ke saath sambhog',
'bachchon ki asheel tasveerein','nasheela karna',
'yaun gulam','yaun taskaree',
// Japanese romaji
'goukan','sei teki gyakutai','miseinen to no seikoi',
'jido poruno','kusuri moru','sei dorei',
// Korean romanized
'gangggan','seong hagdae','miseongnyeonja seong','aidong poreuno',
'yaksul meogida','seong noye',
];
s=s.replace("blocked.push(","blocked.push("+extra.map(e=>"'"+e+"'").join(',')+",");
fs.writeFileSync('content_validator.ts',s);
console.log('added '+extra.length+' translated phrases');
