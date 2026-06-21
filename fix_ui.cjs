const fs = require('fs');

// === 1. PassportGate fix (Workspace.tsx) ===
console.log('=== PassportGate ===');
const wf = 'Workspace.tsx';
if (fs.existsSync(wf)) {
  let wl = fs.readFileSync(wf, 'utf8').split(/\r?\n/);
  let wfixes = 0;
  for (let i = 0; i < wl.length; i++) {
    if (wl[i].includes('Complete all 13 Lore traits')) {
      wl[i] = wl[i].replace('Complete all 13 Lore traits', 'Complete 6 identity traits');
      wfixes++; console.log('  13 -> 6 traits text');
    }
    if (wl[i].includes('{filledTraits}/13')) {
      wl[i] = wl[i].replace('{filledTraits}/13', '{filledTraits}/6');
      wfixes++; console.log('  /13 -> /6');
    }
    if (wl[i].includes('filledTraits >= 9') && wl[i].includes('green')) {
      wl[i] = wl[i].replaceAll('filledTraits >= 9', 'filledTraits >= 5');
      wfixes++; console.log('  >= 9 -> >= 5');
    }
    if (wl[i].includes('filledTraits >= 13')) {
      wl[i] = wl[i].replaceAll('filledTraits >= 13', 'filledTraits >= 6');
      wfixes++; console.log('  >= 13 -> >= 6');
    }
    if (wl[i].includes('filledTraits / 13')) {
      wl[i] = wl[i].replace('filledTraits / 13', 'filledTraits / 6');
      wfixes++; console.log('  / 13 -> / 6 (progress bar)');
    }
    if (wl[i].includes('Resident (9)')) {
      wl[i] = wl[i].replace('Resident (9)', 'Resident (5)');
      wfixes++; console.log('  Resident (9) -> (5)');
    }
    if (wl[i].includes('Passport (13)')) {
      wl[i] = wl[i].replace('Passport (13)', 'Passport (6)');
      wfixes++; console.log('  Passport (13) -> (6)');
    }
  }
  fs.writeFileSync(wf, wl.join('\r\n'));
  console.log('  Fixes: ' + wfixes);
} else { console.log('  Workspace.tsx not found'); }

// === 2. Quiz retry with lockout (Expo_identity_ritual.tsx) ===
console.log('=== Quiz Retry ===');
const rf = 'Expo_identity_ritual.tsx';
if (fs.existsSync(rf)) {
  let rl = fs.readFileSync(rf, 'utf8').split(/\r?\n/);
  let rfixes = 0;

  // 2a. Add quizFailedAt to state init (find currentQuizIndex: 0, quizScore: 0)
  for (let i = 0; i < rl.length; i++) {
    if (rl[i].includes('currentQuizIndex: 0,') && rl[i+1]?.includes('quizScore: 0,')) {
      if (!rl[i+2]?.includes('quizFailedAt')) {
        rl.splice(i + 2, 0, '    quizFailedAt: null as number | null,');
        rfixes++; console.log('  Added quizFailedAt to state init');
      }
      break;
    }
  }

  // 2b. Replace the quiz failure alert with retry UI logic
  for (let i = 0; i < rl.length; i++) {
    if (rl[i].includes('Quiz failed:') && rl[i].includes('The Sentry denies entry')) {
      // Replace the alert line with setting quizFailedAt
      rl[i] = rl[i].replace(
        /alert\(`Quiz failed.*?\);/,
        'setState(prev => ({ ...prev, quizFailedAt: Date.now() }));'
      );
      rfixes++; console.log('  Replaced quiz fail alert with quizFailedAt');
      break;
    }
  }

  // 2c. Add retry UI rendering in case 7 — after the PhaseShot return, add lockout screen
  // Find "case 7:" and wrap the return with a lockout check
  for (let i = 0; i < rl.length; i++) {
    if (rl[i].trim() === 'case 7:') {
      // Insert lockout check before the existing quiz rendering
      const lockoutUI = `
        // Quiz lockout & retry
        if (state.quizFailedAt && !state.recipe.quizPassed) {
          const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes
          const elapsed = Date.now() - state.quizFailedAt;
          const remaining = Math.max(0, LOCKOUT_MS - elapsed);
          const canRetry = remaining <= 0;
          const mins = Math.floor(remaining / 60000);
          const secs = Math.floor((remaining % 60000) / 1000);
          
          return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>🛡️</Text>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#dc2626', marginBottom: 8, textAlign: 'center' }}>
                The Sentry Denies Entry
              </Text>
              <Text style={{ fontSize: 14, color: '#78716c', marginBottom: 24, textAlign: 'center' }}>
                You scored {state.quizScore}/{state.quizQuestions.length}. Need {Math.ceil(state.quizQuestions.length * 0.6)} to pass.
              </Text>
              {canRetry ? (
                <TouchableOpacity
                  onPress={() => {
                    const newQuiz = generateQuiz(state.recipe, state.colorMixHistory);
                    setState(prev => ({
                      ...prev,
                      quizQuestions: newQuiz,
                      currentQuizIndex: 0,
                      quizScore: 0,
                      quizFailedAt: null,
                      recipe: { ...prev.recipe, quizPassed: false },
                    }));
                  }}
                  style={{ backgroundColor: '#f59e0b', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>⚔️ Challenge the Sentry Again</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 32, fontWeight: '700', color: '#f59e0b', marginBottom: 4 }}>
                    {mins}:{secs.toString().padStart(2, '0')}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#a8a29e' }}>
                    The Sentry requires patience before retry
                  </Text>
                </View>
              )}
            </View>
          );
        }`;
      // Insert after "case 7:"
      rl.splice(i + 1, 0, ...lockoutUI.split('\n'));
      rfixes++; console.log('  Added lockout UI with retry button');
      break;
    }
  }

  fs.writeFileSync(rf, rl.join('\r\n'));
  console.log('  Fixes: ' + rfixes);
} else { console.log('  Expo_identity_ritual.tsx not found'); }

console.log('Done');
