// fix_profile_restore.cjs — the DKIM verification persists in SecureStore,
// but researcherProfile is React state and resets on every reload, so the
// panel demanded re-verification it didn't need. Restore the profile from
// SecureStore on mount. Verify-once, not verify-per-submission.
const fs = require('fs');
const F = 'Workspace.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_PROFILE_RESTORE')) { console.log('already patched'); process.exit(0); }

const A = "  const [researcherProfile, setResearcherProfile] = useState<any>(null);";
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }

const B = A + "\n  // KV_PROFILE_RESTORE: DKIM verification persists in SecureStore - restore on mount\n  React.useEffect(() => { (async () => {\n    try {\n      const _rid = await SecureStore.getItemAsync('kv_researcher_id');\n      if (!_rid) return;\n      const _dom = await SecureStore.getItemAsync('kv_dkim_domain');\n      const _dh = await SecureStore.getItemAsync('kv_researcher_domain_hash');\n      setResearcherProfile((p: any) => p || { researcher_id: _rid, email_verified: true, institution_domain: _dom || 'verified.edu', domain_hash: _dh || '', xp: 0, abstract_count: 0, questions_answered: 0, question_price: 0 });\n    } catch {}\n  })(); }, []);";

s = s.split(A).join(B);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: researcher profile restores from SecureStore on mount');
