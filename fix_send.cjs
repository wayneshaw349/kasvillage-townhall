const fs=require('fs');
let s=fs.readFileSync('SendKAS.tsx','utf8');
s=s.replace(/kasPrice\?\.price/g,'usdPerKas');
s=s.replace(/kasPrice\.price/g,'usdPerKas');
s=s.replace(/previewStealthDesc/g,'previewstealthDesc');
fs.writeFileSync('SendKAS.tsx',s);
console.log('sendkas fixed');
