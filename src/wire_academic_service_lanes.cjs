// wire_academic_service_lanes.cjs — academics & services become CATEGORIES of
// the store rail (no new publish path): category-filtered reads of the store
// registry. Verification semantics per the TownHall rules decision:
//   - services: pledge-anchored listing shows; townhall.verified = pledge (same
//     badge semantics storefronts use today).
//   - academics: STRICT — listed only with a DKIM attestation; until the
//     attestation flow exists (announce d.dkim or config dkim proof), the tab
//     stays empty rather than showing unverified "researchers".
const fs = require('fs');
const F = 'mailbox_kaspa_api.ts';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('academic scan failed')) { console.log('already patched'); process.exit(0); }

const A = `/** Academic + service categories publish on the rail later; empty-success until then. */
export async function fetchAcademics(_cursor?: string): Promise<FetchResult<AcademicEntry>> {
  return { items: [], hasMore: false, fromCache: false };
}
export async function fetchServices(_cursor?: string): Promise<FetchResult<ServiceEntry>> {
  return { items: [], hasMore: false, fromCache: false };
}`;
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }

const B = `/** Academic + service = CATEGORIES of the store rail (one publish path).
 *  TownHall verification rules gate the badges: DKIM for academics (strict -
 *  unattested entries are not listed), pledge-anchor for services. */
export async function fetchAcademics(_cursor?: string): Promise<FetchResult<AcademicEntry>> {
  try {
    const dir = await rebuildDirectory('store', registryAddress('store', NET), NET);
    dir.sort(visSort as any);
    const items: AcademicEntry[] = (dir as any[])
      .filter((e) => String(e.category || '').toLowerCase().indexOf('academ') === 0)
      .map((e) => {
        const dkim = !!(e.record && e.record.d && (e.record.d.dkim === true || e.record.d.dkimDomain));
        return {
          id: e.storeAddress,
          title: e.name,
          description: '',
          institution: String((e.record && e.record.d && e.record.d.institution) || ''),
          field: e.category,
          arweaveTx: e.storeAddress,
          ownerPubkey: e.ownerPubkey,
          dkimVerified: dkim,
          dkimDomain: String((e.record && e.record.d && e.record.d.dkimDomain) || '') || undefined,
          createdAt: e.announcedAt * 1000,
          townhall: { verified: dkim, verifiedAt: e.announcedAt, verificationTx: e.storeAddress },
        } as any;
      });
    return { items, hasMore: false, fromCache: false };
  } catch (e: any) {
    throw new MailboxError('academic scan failed: ' + String(e?.message || e), 'SCAN');
  }
}
export async function fetchServices(_cursor?: string): Promise<FetchResult<ServiceEntry>> {
  try {
    const dir = await rebuildDirectory('store', registryAddress('store', NET), NET);
    dir.sort(visSort as any);
    const items: ServiceEntry[] = (dir as any[])
      .filter((e) => String(e.category || '').toLowerCase().indexOf('service') === 0)
      .map((e) => ({
        id: e.storeAddress,
        title: e.name,
        description: '',
        category: e.category,
        arweaveTx: e.storeAddress,
        ownerPubkey: e.ownerPubkey,
        priceLabel: undefined,
        serviceArea: '',
        townhall: { verified: true, verifiedAt: e.announcedAt, verificationTx: e.storeAddress },
        createdAt: e.announcedAt * 1000,
        coords: (e.record && e.record.d && e.record.d.coords) || null,
        configHash: e.configHash || '',
      } as any));
    return { items, hasMore: false, fromCache: false };
  } catch (e: any) {
    throw new MailboxError('service scan failed: ' + String(e?.message || e), 'SCAN');
  }
}`;

s = s.replace(A, B);
if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: academics/services read the store rail by category (DKIM-strict / pledge-verified)');
