const L=require('fs').readFileSync('showcase_kascity133.html','utf8').split(/\r?\n/);
const re=/KV_PROFNAME\s*=|KV_PROF\b|profile|personality|now a developer|now a trader|now a miser|MATE_PULL|WOBBLE|\baggr\b|msl_p|"developer"|"trader"|"miser"/i;
let n=0;L.forEach((l,i)=>{if(l.length<1500&&re.test(l)&&n<60){console.log((i+1)+': '+l.trim().slice(0,200));n++}});
const R=L.find(l=>l.indexOf('world.flags.left')>=0&&l.length>100000)||'';
const J=R.replace(/\\"/g,'"');
console.log('== engine: aggr / msl / prof flags');
[...J.matchAll(/"(aggr_p\d|msl_p\d|prof_p\d|pers_p\d)"/g)].slice(0,4).forEach(m=>console.log('  @'+m.index+' '+J.slice(m.index-300,m.index+200).replace(/\s+/g,' ')));
console.log('count aggr:'+(J.match(/aggr_p/g)||[]).length+' msl:'+(J.match(/msl_p/g)||[]).length+' prof:'+(J.match(/prof_p/g)||[]).length);
