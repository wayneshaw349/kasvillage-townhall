const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');
let changes = 0;

// === 1: Import dkim_verify ===
if (!s.includes('verifyDKIM')) {
  s = s.replace(
    "import { ProceduralBackground } from './expo_procedural_backgrounds';",
    "import { ProceduralBackground } from './expo_procedural_backgrounds';\nimport { verifyDKIM, quickDomainCheck } from './dkim_verify';"
  );
  changes++; console.log('1: Imported dkim_verify');
}

// === 2: Add verification state for audit trail ===
if (!s.includes('dkimSteps')) {
  s = s.replace(
    "  const [isLoading, setIsLoading] = useState(false);",
    "  const [isLoading, setIsLoading] = useState(false);\n  const [dkimSteps, setDkimSteps] = useState<string[]>([]);\n  const [dkimError, setDkimError] = useState('');",
  );
  // Find it in AcademicPanel component specifically
  if (!s.includes('dkimSteps')) {
    // Try alternate location inside AcademicPanel
    s = s.replace(
      "const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);",
      "const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);\n  const [dkimSteps, setDkimSteps] = useState<string[]>([]);\n  const [dkimError, setDkimError] = useState('');"
    );
  }
  changes++; console.log('2: Added dkimSteps state');
}

// === 3: Replace the verification onPress handler with real DKIM verify ===
// Find the verification button's onPress and replace the logic
const oldVerifyLogic = "if (!rawEmailHeaders.includes('DKIM-Signature')) { setVerificationError('No DKIM signature found. Paste the FULL email source.'); return; }";

if (s.includes(oldVerifyLogic)) {
  // Replace the entire onPress handler block
  const blockStart = s.indexOf("onPress={async () => {\n                      if (!rawEmailHeaders.includes('DKIM-Signature'))");
  const blockEnd = s.indexOf("}} disabled={isLoading || !rawEmailHeaders.includes('DKIM-Signature')}", blockStart);
  
  if (blockStart >= 0 && blockEnd > blockStart) {
    const newHandler = `onPress={async () => {
                      if (!rawEmailHeaders || rawEmailHeaders.length < 100) { setVerificationError('Paste the full email source — it should be at least a few hundred characters.'); return; }
                      setIsLoading(true); setVerificationError(''); setDkimSteps([]); setDkimError('');
                      try {
                        // Real on-device DKIM verification — zero PII leaves the phone
                        const result = await verifyDKIM(rawEmailHeaders);
                        setDkimSteps(result.steps);
                        
                        if (!result.verified) {
                          setDkimError(result.error || 'Verification failed');
                          setVerificationError(result.error || 'DKIM verification failed. Try pasting the complete email source.');
                          setIsLoading(false);
                          return;
                        }

                        // Check code is in the headers
                        if (magicLink && !rawEmailHeaders.includes(magicLink)) {
                          setVerificationError('Code ' + magicLink + ' not found in email. Did you put it in the subject?');
                          setIsLoading(false);
                          return;
                        }

                        // VERIFIED — domain extracted from DKIM d= tag, never from user input
                        const domain = result.domain;
                        const domainHash = bytesToHex(sha256(new TextEncoder().encode('KV_EDU_' + domain)));
                        const researcherId = 'RES_' + domainHash.slice(0, 12).toUpperCase();
                        await SecureStore.setItemAsync('kv_researcher_id', researcherId);
                        await SecureStore.setItemAsync('kv_researcher_domain_hash', domainHash);
                        await SecureStore.setItemAsync('kv_researcher_domain', domain);
                        // Clear all sensitive data from memory
                        setRawEmailHeaders(''); setMagicLink('');
                        setResearcherProfile({ researcher_id: researcherId, email_verified: true, institution_domain: domain, domain_hash: domainHash, xp: 0, abstract_count: 0, questions_answered: 0, question_price: 0 });
                        Alert.alert('Verified! \\u{1F393}', 'DKIM cryptographically verified!\\n\\nSchool: ' + domain + '\\nID: ' + researcherId + '\\n\\nYour email was never stored — domain extracted from the DKIM digital signature.');
                      } catch (e) { setVerificationError('Verification error: ' + String(e)); }
                      setIsLoading(false);
                    }} disabled={isLoading || rawEmailHeaders.length < 100}`;
    
    s = s.slice(0, blockStart) + newHandler + s.slice(blockEnd + ("}} disabled={isLoading || !rawEmailHeaders.includes('DKIM-Signature')}").length);
    changes++; console.log('3: Wired real DKIM verify');
  }
}

// === 4: Add audit trail display below the paste box ===
const pasteProofTitle = "Paste the Proof";
if (s.includes(pasteProofTitle) && !s.includes('dkimSteps.length > 0')) {
  // Add audit trail after the verify error display
  const errorDisplay = "{verificationError ? <Text style={{ fontSize: 11, color: COLORS.red600, marginTop: 8 }}>{verificationError}</Text> : null}";
  const auditTrail = `{verificationError ? <Text style={{ fontSize: 11, color: COLORS.red600, marginTop: 8 }}>{verificationError}</Text> : null}
                    {dkimSteps.length > 0 && (
                      <View style={{ backgroundColor: '#f0f9ff', borderRadius: 10, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#93c5fd' }}>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1e40af', marginBottom: 4 }}>Verification Steps:</Text>
                        {dkimSteps.map((step, i) => (
                          <Text key={i} style={{ fontSize: 9, color: step.includes('\\u2713') ? '#16a34a' : step.includes('\\u2717') ? '#dc2626' : '#3b82f6', fontFamily: 'monospace', marginBottom: 2 }}>{step}</Text>
                        ))}
                      </View>
                    )}`;

  // Find the first occurrence in the step 2 section
  const step2Area = s.indexOf(pasteProofTitle);
  const errorIdx = s.indexOf(errorDisplay, step2Area);
  if (errorIdx >= 0) {
    s = s.slice(0, errorIdx) + auditTrail + s.slice(errorIdx + errorDisplay.length);
    changes++; console.log('4: Added DKIM audit trail display');
  }
}

// === 5: Update the green check to detect DKIM dynamically ===
const oldDkimCheck = "rawEmailHeaders.includes('DKIM-Signature') ? COLORS.green500 : COLORS.stone300";
if (s.includes(oldDkimCheck)) {
  s = s.replace(oldDkimCheck, "rawEmailHeaders.length > 200 ? COLORS.green500 : COLORS.stone300");
  changes++; console.log('5: Updated paste box border check');
}

const oldDkimHint = "rawEmailHeaders.includes('DKIM-Signature') ? '✓ DKIM signature found!' : '⚠ No DKIM found yet — paste the FULL source'";
if (s.includes(oldDkimHint)) {
  s = s.replace(oldDkimHint, "rawEmailHeaders.length > 200 ? '✓ Headers pasted (' + rawEmailHeaders.length + ' chars) — tap Verify below' : '⚠ Paste the FULL email source (Show Original / View Source)'");
  changes++; console.log('6: Updated paste hint text');
}

// === 7: Update the privacy box text ===
const oldPrivacy = "🔒 What we check: a real .edu server signed this email (DKIM).";
if (s.includes(oldPrivacy)) {
  s = s.replace(oldPrivacy, "🔒 What happens: DNS lookup for school's public DKIM key → RSA signature verified on YOUR phone → only school name saved.");
  changes++; console.log('7: Updated privacy text');
}

fs.writeFileSync(f, s);
console.log('\nTotal changes:', changes);
const v = fs.readFileSync(f, 'utf8');
console.log('Verify - import dkim_verify:', v.includes("from './dkim_verify'"));
console.log('Verify - verifyDKIM call:', v.includes('await verifyDKIM(rawEmailHeaders)'));
console.log('Verify - dkimSteps state:', v.includes('dkimSteps'));
console.log('Verify - audit trail:', v.includes('Verification Steps'));
console.log('Verify - DKIM cryptographically:', v.includes('cryptographically verified'));
console.log('Verify - zero PII:', v.includes('zero PII'));
