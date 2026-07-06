const fs=require('fs');let s=fs.readFileSync('content_validator.ts','utf8');
const extra=[
'drugs for boy','drugs for girl','drugs for kids','drugs for teen',
'sell drugs to','give drugs to','drug teen','drug girl','drug boy',
'drug women','drug female','drug male','drug kids',
'rape','molest','sodomy','pedophile','pedophilia','incest',
'sexual abuse','sexual assault','sex with minor','sex with child',
'sex with teen','sex with boy','sex with girl','sex with kids',
'nude boy','nude girl','nude teen','nude child','nude kids',
'naked boy','naked girl','naked teen','naked child','naked kids',
'underage sex','underage porn','underage nude',
'teen porn','teen sex','teen nude',
'child sex','child nude','child porn',
'boy sex','girl sex','kids sex',
'sex slave','sex trade','sex worker','sexual exploitation',
'date rape drug','roofie','rohypnol','ghb drug',
'sell meth','buy meth','sell crack','buy crack','sell weed','buy weed',
'sell marijuana','buy marijuana','sell ecstasy','buy ecstasy',
'sell ketamine','buy ketamine','sell pcp','buy pcp',
'sell xanax','buy xanax','sell adderall','buy adderall',
'sell morphine','buy morphine','sell tramadol','buy tramadol',
'sell codeine','buy codeine','sell percocet','buy percocet',
'sell oxycontin','buy oxycontin','sell vicodin','buy vicodin',
'grooming','groom child','groom teen','groom boy','groom girl',
'lure child','lure teen','lure boy','lure girl',
'age play','ageplay','lolita','shota',
'snuff film','snuff video','bestiality','zoophilia',
'camgirl minor','webcam minor','webcam child','webcam teen',
];
s=s.replace("blocked.push(","blocked.push("+extra.map(e=>"'"+e+"'").join(',')+",");
fs.writeFileSync('content_validator.ts',s);
console.log('added '+extra.length+' phrases');
