const L=require('fs').readFileSync('showcase_kascity145.html','utf8').split(/\r?\n/);
const i=L.findIndex(l=>l.indexOf('id:"buyer"')>=0||l.indexOf("id:'buyer'")>=0||(l.indexOf('buyer')>=0&&l.indexOf('sc')>=0&&l.indexOf('cash')>=0));
console.log('== scenario defs mentioning buyer/offer/sale');
const re=/buyer|offer to buy|sells? to|"sale"|sc_amt/i;
let n=0;L.forEach((l,idx)=>{if(idx>9400&&idx<9900&&l.length<1500&&re.test(l)&&n<40){console.log((idx+1)+': '+l.trim().slice(0,240));n++}});
