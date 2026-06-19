const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');

// Find impl ArweaveStateReader and add get_push_token before its closing }
const implStart = c.indexOf('impl ArweaveStateReader {');
// Find the get_user_stats method to insert after it
const statsMethod = c.indexOf('pub async fn get_user_stats', implStart);

// Find the end of get_user_stats by brace counting
let depth = 0, pos = c.indexOf('{', statsMethod);
for (let i = pos; i < c.length; i++) {
  if (c[i] === '{') depth++;
  if (c[i] === '}') { depth--; if (depth === 0) { pos = i; break; } }
}

const method = `

    pub async fn get_push_token(&self, pubkey: &str) -> Result<String, String> {
        let query = format!(r#"{{ transactions(tags: [{{ name: "App-Name", values: ["KasVillage"] }}, {{ name: "KV-Type", values: ["push-token"] }}, {{ name: "KV-Pubkey", values: ["{}"] }}], sort: HEIGHT_DESC, first: 1) {{ edges {{ node {{ id }} }} }} }}"#, pubkey);
        let resp = self.http.post(&format!("{}/graphql", self.gateway))
            .json(&serde_json::json!({{"query": query}}))
            .send().await.map_err(|e| e.to_string())?;
        let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        let tx_id = data["data"]["transactions"]["edges"][0]["node"]["id"]
            .as_str().ok_or("No push token found".to_string())?;
        let token_resp = self.http.get(&format!("{}/{}", self.gateway, tx_id))
            .send().await.map_err(|e| e.to_string())?;
        let token_data: serde_json::Value = token_resp.json().await.map_err(|e| e.to_string())?;
        token_data["encrypted_token"].as_str()
            .map(|s| s.to_string())
            .ok_or("Token field not found".to_string())
    }`;

if (!c.includes('fn get_push_token')) {
  c = c.substring(0, pos + 1) + method + c.substring(pos + 1);
  fs.writeFileSync('src/main.rs', c);
  console.log('OK: get_push_token added to ArweaveStateReader');
} else {
  console.log('Already defined');
}
