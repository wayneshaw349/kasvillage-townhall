const fs = require('fs');
let code = fs.readFileSync('townhall_client.ts', 'utf8');

const relayFunctions = `

// ============================================================================
// FROST AGREEMENT RELAY
// ============================================================================

export interface AgreementPartyInfo {
  pubkey: string;
  amount_sompi: number;
  confirmed: boolean;
  collateralTxId: string | null;
}

export interface AgreementStatus {
  agreementId: string;
  status: string;
  description: string;
  network: string;
  frostAddress: string | null;
  partyA: AgreementPartyInfo;
  partyB: AgreementPartyInfo | null;
  createdAt: number;
  updatedAt: number;
}

export interface AgreementListItem {
  agreementId: string;
  status: string;
  description: string;
  frostAddress: string | null;
  myRole: 'A' | 'B';
  myAmount: number;
  createdAt: number;
}

export async function proposeAgreement(params: {
  agreementId: string;
  pubkey: string;
  amount_sompi: number;
  signature: string;
  description: string;
  stipulations?: string;
  network: string;
}): Promise<{ success: boolean; agreementId?: string; error?: string }> {
  try {
    const resp = await fetch(TOWN_HALL_BASE_URL + '/api/agreement/propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await resp.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function acceptAgreement(params: {
  agreementId: string;
  pubkey: string;
  amount_sompi: number;
  signature: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const resp = await fetch(TOWN_HALL_BASE_URL + '/api/agreement/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await resp.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function confirmAgreement(params: {
  agreementId: string;
  pubkey: string;
  signature: string;
}): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    const resp = await fetch(TOWN_HALL_BASE_URL + '/api/agreement/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await resp.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getAgreementStatus(agreementId: string): Promise<AgreementStatus | null> {
  try {
    const resp = await fetch(TOWN_HALL_BASE_URL + '/api/agreement/' + agreementId);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export async function recordCollateral(params: {
  agreementId: string;
  pubkey: string;
  txId: string;
  frostAddress?: string;
}): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    const resp = await fetch(TOWN_HALL_BASE_URL + '/api/agreement/collateral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await resp.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function listMyAgreements(pubkey: string): Promise<AgreementListItem[]> {
  try {
    const resp = await fetch(TOWN_HALL_BASE_URL + '/api/agreements?pubkey=' + pubkey);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.agreements || [];
  } catch {
    return [];
  }
}
`;

// Append to end of file
code += relayFunctions;
fs.writeFileSync('townhall_client.ts', code);
console.log('OK: Agreement relay functions added to townhall_client.ts');
console.log('Lines:', code.split('\n').length);
