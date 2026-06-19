const fs = require('fs');
let c = fs.readFileSync('ProfileScreen.tsx', 'utf8');

// Add App-Name tag to all uploadToTurbo calls
let count = 0;
while (c.includes("{ name: 'KV-Type', value: 'device-attestation' },") && !c.includes("{ name: 'App-Name', value: 'KasVillage' },\n                      { name: 'KV-Type', value: 'device-attestation' },")) {
  c = c.replace(
    "{ name: 'KV-Type', value: 'device-attestation' },",
    "{ name: 'App-Name', value: 'KasVillage' },\n                      { name: 'Content-Type', value: 'application/json' },\n                      { name: 'KV-Type', value: 'device-attestation' },"
  );
  count++;
  if (count > 5) break;
}
console.log('Added App-Name tag to', count, 'upload calls');

fs.writeFileSync('ProfileScreen.tsx', c);
