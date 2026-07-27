const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.forEach((l,n)=>{ if(/Clipboard\.setStringAsync|setStringAsync|>Copy|placeholder=|<TextInput|Paste |onChangeText/.test(l)) console.log((n+1)+': '+l.trim().slice(0,120)); });
