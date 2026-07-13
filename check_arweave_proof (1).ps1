# Query Arweave GraphQL for KasVillage proofs by identity.
# Usage: .\check_arweave_proof.ps1
$identity = "03947bbfc963b010bebe71536dff6b02b2aa6a9d788338033a148c4aadb3930183"

$query = @"
{
  transactions(
    first: 10,
    tags: [
      { name: "App-Name", values: ["KasVillage"] },
      { name: "KV-Type", values: ["proof"] },
      { name: "KV-Identity", values: ["$identity"] }
    ]
  ) {
    edges {
      node {
        id
        tags { name value }
      }
    }
  }
}
"@

$body = @{ query = $query } | ConvertTo-Json
$resp = Invoke-RestMethod -Uri "https://arweave.net/graphql" -Method Post -Body $body -ContentType "application/json"
$resp.data.transactions.edges | ForEach-Object {
    Write-Output "Arweave TX: $($_.node.id)"
    $_.node.tags | ForEach-Object { Write-Output "  $($_.name): $($_.value)" }
    Write-Output "---"
}
if (-not $resp.data.transactions.edges) { Write-Output "No proofs found yet (Arweave indexing can lag 5-30 min)." }
