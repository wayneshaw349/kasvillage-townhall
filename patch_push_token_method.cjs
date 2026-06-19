const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');

// Find ArweaveReader impl and add get_push_token
const anchor = 'pub async fn get_user_stats(&self, pubkey: &str)';
const implStart = c.lastIndexOf('impl', c.indexOf(anchor));
// Find a good insertion point - after get_user_stats closing brace
const statsEnd = c.indexOf('\n    }', c.indexOf(anchor) + 100);
const insertAt = c.indexOf('\n', statsEnd + 5);

const method = `

    pub async fn get_push_token(&self, pubkey: &str) -> Result<String, String> {
        let query = format!(r#"{{ transactions(tags: [{{ name: "App-Name", values: ["KasVillage"] }}, {{ name: "KV-Type", values: ["push-token"] }}, {{ name: "KV-Pubkey", values: ["{}"] }}], sort: HEIGHT_DESC, first: 1) {{ edges {{ node {{ id }} }} }} }}"#, pubkey);
        let resp = self.http.post(&format!("{}/graphql", self.gateway))
            .json(&serde_json::json!({"query": query}))
            .send().await.map_err(|e| e.to_string())?;
        let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        let tx_id = data["data"]["transactions"]["edges"][0]["node"]["id"]
            .as_str().ok_or("No push token found")?;
        // Fetch the token data
        let token_resp = self.http.get(&format!("{}/{}", self.gateway, tx_id))
            .send().await.map_err(|e| e.to_string())?;
        let token_data: serde_json::Value = token_resp.json().await.map_err(|e| e.to_string())?;
        // The encrypted_token field - for MVP, use as-is
        token_data["encrypted_token"].as_str()
            .map(|s| s.to_string())
            .ok_or("Token field not found".into())
    }`;

if (!c.includes('get_push_token')) {
  // Find end of get_user_stats function
  let depth = 0;
  let pos = c.indexOf(anchor);
  let braceStart = c.indexOf('{', pos);
  pos = braceStart;
  for (let i = braceStart; i < c.length; i++) {
    if (c[i] === '{') depth++;
    if (c[i] === '}') { depth--; if (depth === 0) { pos = i; break; } }
  }
  c = c.substring(0, pos + 1) + method + c.substring(pos + 1);
  fs.writeFileSync('src/main.rs', c);
  console.log('OK: get_push_token added');
} else {
  console.log('Already exists');
}
