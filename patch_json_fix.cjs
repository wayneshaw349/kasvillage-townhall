const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');
// Fix double braces in json! macro
c = c.replace(
  '.json(&serde_json::json!({{"query": query}}))',
  '.json(&serde_json::json!({"query": query}))'
);
fs.writeFileSync('src/main.rs', c);
console.log('Fixed');
