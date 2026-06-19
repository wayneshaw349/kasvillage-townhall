const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');

// 1. Fix unicode escape in push notification
c = c.replace('"\\u2705 Proof Ready"', '"Proof Ready"');

// 2. Replace the broken get_push_token method with correct field names
const oldMethod = /pub async fn get_push_token\(&self, pubkey: &str\) -> Result<String, String> \{[\s\S]*?\.ok_or\("Token field not found"\.to_string\(\)\)\s*\}/;
const newMethod = `pub async fn get_push_token(&self, pubkey: &str) -> Result<String, String> {
        let query = format!(r#"{{ transactions(tags: [{{ name: "App-Name", values: ["KasVillage"] }}, {{ name: "KV-Type", values: ["push-token"] }}, {{ name: "KV-Pubkey", values: ["{}"] }}], sort: HEIGHT_DESC, first: 1) {{ edges {{ node {{ id }} }} }} }}"#, pubkey);
        let resp = self.http_client.post("https://arweave.net/graphql")
            .json(&serde_json::json!({"query": query}))
            .send().await.map_err(|e| e.to_string())?;
        let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        let tx_id = data["data"]["transactions"]["edges"][0]["node"]["id"]
            .as_str().ok_or_else(|| "No push token found".to_string())?;
        let token_resp = self.http_client.get(&format!("https://arweave.net/{}", tx_id))
            .send().await.map_err(|e| e.to_string())?;
        let token_data: serde_json::Value = token_resp.json().await.map_err(|e| e.to_string())?;
        token_data["encrypted_token"].as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| "Token field not found".to_string())
    }`;

if (oldMethod.test(c)) {
  c = c.replace(oldMethod, newMethod);
  console.log('Method fixed');
} else {
  console.log('Method pattern not found');
}

fs.writeFileSync('src/main.rs', c);
