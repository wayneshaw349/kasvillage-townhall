# KasVillage Web Gateway (kasvillage.com)

Read-only, crawlable mirror of the on-chain Mailbox. Holds no keys, no accounts, no user
data. Every listing is signature-verified and re-derived from Kaspa; playing and dealing
happen only in the wallet. Cost: Cloudflare Workers free tier (100k requests/day) = $0.

## Deploy (PowerShell)
    cd "C:\Users\wayne\Downloads\kasvillage layer1\web_gateway"
    npm install
    npx wrangler login          # opens browser -> allow
    npx wrangler deploy         # prints a *.workers.dev URL - test it

## Attach kasvillage.com
Cloudflare dashboard -> Workers & Pages -> kasvillage-gateway -> Settings ->
Domains & Routes -> Add -> Custom domain -> kasvillage.com (domain must be on this
Cloudflare account). Done - DNS and TLS are automatic.

## Launch day
Edit `const NET = 'testnet-10'` -> 'mainnet' in worker.js, `npx wrangler deploy`.

## Pages
/  /games  /stores  /dapps  /g/<head>  /s/<storeAddress>  /sitemap.xml  /robots.txt
