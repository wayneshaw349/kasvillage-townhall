// kascity_visual_v126.cjs
// Reads showcase_kascity125.html -> showcase_kascity126.html
// "a dialog is open" fired all game: the z-index test matched the engine's prompt bar. Modals are
// now tagged data-kvmodal (bid, offer-received, list, roll-off) and both the bot-offer engine and
// the stall detector look for the tag only.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity125.html')) die('showcase_kascity125.html missing');
let html = fs.readFileSync('showcase_kascity125.html', 'utf8');
function repN(a, b, name, lo, hi) { const n = html.split(a).length - 1; if (n < lo || n > hi) die(name + ': expected ' + lo + '-' + hi + ', got ' + n); html = html.split(a).join(b); console.log('PASS ' + name + ' (' + n + ')'); }
function rep(a, b, name) { repN(a, b, name, 1, 1); }

const z77 = 'ov.style.cssText="position:fixed;inset:0;z-index:77;background:rgba(10,8,6,.6);display:flex;align-items:center;justify-content:center;";';
repN(z77, z77 + ' ov.setAttribute("data-kvmodal","1");', 'bid + offer-received modals tagged', 2, 2);

const z78 = 'var ov=el("div","position:fixed;inset:0;z-index:78;background:rgba(10,8,6,.6);display:flex;align-items:center;justify-content:center;");';
rep(z78, z78 + ' ov.setAttribute("data-kvmodal","1");', 'list modal tagged');

const z90 = 'ov.style.cssText="position:fixed;inset:0;z-index:90;background:rgba(10,8,6,.18);display:flex;align-items:center;justify-content:center;";';
rep(z90, z90 + ' ov.setAttribute("data-kvmodal","1");', 'roll-off modal tagged');

rep('function dialogOpen(){ var a=document.body.children; for(var i=0;i<a.length;i++){ var z=+(a[i].style&&a[i].style.zIndex); if((z===77||z===78||z===90)&&a[i].style.display!=="none"&&a[i].children.length) return true; } return false; }',
    'function dialogOpen(){ return !!document.querySelector("[data-kvmodal]"); }',
    'bot-offer engine checks the tag');

rep('var __dlg=false; var __all=document.body.children; for(var __i=0;__i<__all.length;__i++){ var __z=+(__all[__i].style&&__all[__i].style.zIndex); if((__z===77||__z===78||__z===90) && __all[__i].style.display!=="none" && __all[__i].children.length) __dlg=true; }',
    'var __dlg=!!document.querySelector("[data-kvmodal]");',
    'stall detector checks the tag');

fs.writeFileSync('showcase_kascity126.html', html);
console.log('OK showcase_kascity126.html (' + (fs.statSync('showcase_kascity126.html').size/1024/1024).toFixed(1) + ' MB)');
