const fs=require('fs');
const s=`export function validateContentText(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  const blocked = [
    'child trafficking','human trafficking','sex trafficking','labor trafficking',
    'sell children','buy children','exploit children','child exploitation',
    'child pornography','child abuse','minor exploitation',
    'sell weapons','buy weapons','illegal weapons','ghost gun','3d printed gun',
    'sell firearms','buy firearms','unregistered firearm','sell ammunition',
    'sell drugs','buy drugs','sell narcotics','buy narcotics',
    'sell cocaine','buy cocaine','sell heroin','buy heroin',
    'sell methamphetamine','buy methamphetamine','sell fentanyl','buy fentanyl',
    'sell mdma','buy mdma','sell lsd','buy lsd',
    'sell opioids','buy opioids','sell pills','buy pills',
    'sell knives','buy knives','sell switchblade','buy switchblade',
    'sell explosives','buy explosives','pipe bomb','bomb making',
    'hire hitman','contract killing','murder for hire',
    'sell organs','buy organs','organ trafficking',
    'money laundering','counterfeit currency','counterfeit money',
    'sell stolen','buy stolen','stolen goods','stolen credit card',
    'identity theft','sell identity','buy identity','fake passport','fake id',
    'ransomware','ddos attack','hack for hire','sell exploit',
    'sell poison','buy poison','sell cyanide','buy cyanide',
    'human smuggling','illegal immigration service',
    'forced labor','slave labor','debt bondage',
    'revenge porn','non-consensual intimate','sextortion',
    'terrorism','terrorist attack','extremist recruitment',
    'suicide instruction','how to kill yourself',
    'animal crush','animal cruelty',
    'escort service','prostitution','sell sex','buy sex',
    // Spanish
    'trata de personas','vender drogas','comprar drogas','vender armas','comprar armas',
    'trata de ninos','explotacion infantil','pornografia infantil','vender cocaina',
    'comprar cocaina','vender heroina','comprar heroina','lavado de dinero',
    'asesino a sueldo','trafico de organos','trabajo forzado','vender explosivos',
    'comprar explosivos','terrorismo','identidad falsa','pasaporte falso',
    // French
    'traite des personnes','vendre des drogues','acheter des drogues','vendre des armes',
    'acheter des armes','exploitation des enfants','pornographie infantile',
    'vendre de la cocaine','acheter de la cocaine','blanchiment d\\'argent',
    'tueur a gages','trafic d\\'organes','travail force','vendre des explosifs',
    'acheter des explosifs','terrorisme','faux passeport','fausse identite',
    // Arabic transliterated
    'itjar bil bashar','bay\\'a mukhadarat','shira mukhadarat','bay\\'a aslaha',
    'shira aslaha','istighlal atfal','irhab','tazyif amwal','qatil majur',
    'itjar a\\'da','amal qasri',
    // Russian transliterated
    'torgovlya lyudmi','prodat narkotiki','kupit narkotiki','prodat oruzhie',
    'kupit oruzhie','detskaya pornografiya','ekspluataciya detey','terrorizm',
    'otmyvanie deneg','naemnyy ubiyca','torgovlya organami','prinuditelnyy trud',
    // Chinese pinyin
    'mai du pin','mai wu qi','fan mai ren kou','er tong se qing',
    'xi qian','gu yong sha shou','qi guan mai mai','kong bu zhu yi',
    'qiang zhi lao dong','jia hu zhao','mai huo yao',
    // Portuguese
    'trafico de pessoas','vender drogas','comprar drogas','vender armas',
    'comprar armas','exploracao infantil','pornografia infantil','lavagem de dinheiro',
    'assassino de aluguel','trafico de orgaos','trabalho forcado','terrorismo',
    // German
    'menschenhandel','drogen verkaufen','drogen kaufen','waffen verkaufen',
    'waffen kaufen','kinderpornographie','kinderausbeutung','geldwaesche',
    'auftragsmord','organhandel','zwangsarbeit','terrorismus','sprengstoff',
    // Hindi transliterated
    'manav taskaree','nasheele padaarth bechna','hathiyaar bechna',
    'bachchon ka shoshan','aatankavaad','kale dhan ko safed karna',
    'supari dena','ang vyapaar',
    // Japanese romaji
    'jido poruno','mayaku hanbai','buki hanbai','jinshin baibai',
    'tero','maney rondaringu','satsujin iraisha','zoki baibai',
  ];
  for (const phrase of blocked) { if (lower.includes(phrase)) return 'Content rejected: prohibited phrase detected'; }
  return null;
}`;
fs.writeFileSync('content_validator.ts',s);
console.log('done: '+s.split("'").filter((_,i)=>i%2===1).length+' phrases');
