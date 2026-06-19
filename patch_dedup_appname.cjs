const fs = require('fs');
let c = fs.readFileSync('ProfileScreen.tsx', 'utf8');
const before = (c.match(/\{ name: 'App-Name', value: 'KasVillage' \}/g) || []).length;
console.log('Before:', before);
while (c.includes("{ name: 'App-Name', value: 'KasVillage' },\n                      { name: 'Content-Type', value: 'application/json' },\n                      { name: 'App-Name', value: 'KasVillage' },")) {
  c = c.replace(
    "{ name: 'App-Name', value: 'KasVillage' },\n                      { name: 'Content-Type', value: 'application/json' },\n                      { name: 'App-Name', value: 'KasVillage' },\n                      { name: 'Content-Type', value: 'application/json' },",
    "{ name: 'App-Name', value: 'KasVillage' },\n                      { name: 'Content-Type', value: 'application/json' },"
  );
}
const after = (c.match(/\{ name: 'App-Name', value: 'KasVillage' \}/g) || []).length;
console.log('After:', after);
fs.writeFileSync('ProfileScreen.tsx', c);
