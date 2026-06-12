// patch_push_handler.cjs
const fs = require('fs');
const file = 'AppNaviagator.tsx';
let code = fs.readFileSync(file, 'utf8');

const anchor = '}, [loadUserStats]);';
const idx = code.indexOf(anchor);
if (idx === -1) { console.log('ERROR: anchor not found'); process.exit(1); }

const insertAfter = idx + anchor.length;
const block = `

  // Push notification handlers
  useEffect(() => {
    const cleanup = setupNotificationHandlers((event, data) => {
      console.log('[Push] Received:', event, data?.agreementId || '');
    });
    return cleanup;
  }, []);`;

// Only insert if not already present
if (code.includes('setupNotificationHandlers((event')) {
  console.log('SKIP: already wired');
  process.exit(0);
}

code = code.slice(0, insertAfter) + block + code.slice(insertAfter);
fs.writeFileSync(file, code);
console.log('OK: setupNotificationHandlers wired after loadUserStats useEffect');
