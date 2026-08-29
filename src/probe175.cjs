const L = require('fs').readFileSync('showcase_kascity174.html', 'utf8').split(/\r?\n/);
console.log('== every place a p2pbuy or renovate move is recorded ==');
let n = 0;
L.forEach((l, i) => {
  if (l.length < 1500 && /KV_MOVE\s*\([^)]*["'](p2pbuy|renovate)/.test(l) && n < 25) {
    console.log((i + 1) + ': ' + l.trim().slice(0, 200));
    n++;
  }
});
console.log('total emitters found: ' + n);
console.log('\n== guards installed (should appear once each) ==');
['__KV_REPORTED', '__KV_RENOV', '__KV_PAID'].forEach(g => {
  console.log(g + ': ' + L.filter(l => l.indexOf(g) >= 0).length + ' lines');
});
