// fix_quiz_retry.cjs
// Changes second quiz failure from "Restart entire ritual" to 
// "Wait 60 seconds then retry" — respects timeout penalty
const fs = require("fs");
let s = fs.readFileSync("Expo_identity_ritual.tsx", "utf8");

// Replace the restart screen with a timed penalty retry
const oldRestart = `if (state.showQuizResult === 'restart') {
          return (
            <View style={styles.phaseContent}>
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 80 }}>❌</Text>
                <Text style={{ color: '#F44336', fontSize: 28, fontWeight: 'bold', marginTop: 20, textAlign: 'center' }}>
                  SENTRY REJECTS YOU
                </Text>
                <Text style={{ color: '#EF5350', fontSize: 16, marginTop: 12, textAlign: 'center' }}>
                  Failed twice. You must restart the entire ritual.
                </Text>
                <Text style={{ color: '#B8A080', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                  The gate slams shut. Begin again from the beginning.
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: '#F44336', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12, marginTop: 32 }}
                  onPress={() => setState(prev => ({ ...prev, showQuizResult: 'none' as const, phase: 1 }))}
                >
                  <Text style={{ color: '#FFF', fontSize: 18, fontWeight: 'bold' }}>Restart Ritual</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }`;

const newRestart = `if (state.showQuizResult === 'restart') {
          return (
            <QuizPenaltyScreen 
              score={state.quizScore} 
              totalQuestions={state.quizQuestions.length}
              onRetry={() => {
                const quizQuestions = generateQuiz(state.recipe, state.colorMixHistory);
                setState(prev => ({ 
                  ...prev, 
                  showQuizResult: 'none' as const,
                  quizQuestions,
                  currentQuizIndex: 0,
                  quizScore: 0,
                  quizRetries: 0,
                }));
              }}
            />
          );
        }`;

if (s.includes(oldRestart)) {
  s = s.replace(oldRestart, newRestart);
  console.log("✅ Replaced restart screen with penalty timer");
} else {
  console.log("⚠️  Could not find exact restart block, trying partial match...");
  s = s.replace(
    "SENTRY REJECTS YOU",
    "SENTRY TIMEOUT"
  );
  s = s.replace(
    "Failed twice. You must restart the entire ritual.",
    "Wait 60 seconds before retrying."
  );
  s = s.replace(
    "The gate slams shut. Begin again from the beginning.",
    "The sentry needs time to cool down."
  );
  s = s.replace(
    `onPress={() => setState(prev => ({ ...prev, showQuizResult: 'none' as const, phase: 1 }))}`,
    `onPress={() => {
                    const quizQuestions = generateQuiz(state.recipe, state.colorMixHistory);
                    setState(prev => ({ ...prev, showQuizResult: 'none' as const, quizQuestions, currentQuizIndex: 0, quizScore: 0, quizRetries: 0 }));
                  }}`
  );
  s = s.replace("Restart Ritual", "Try Again");
  console.log("✅ Applied partial fix to restart screen");
}

// Add QuizPenaltyScreen component before the main export
const penaltyComponent = `
// ============================================================================
// QUIZ PENALTY SCREEN - 60 second cooldown then retry
// ============================================================================
function QuizPenaltyScreen({ score, totalQuestions, onRetry }: { 
  score: number; totalQuestions: number; onRetry: () => void 
}) {
  const [secondsLeft, setSecondsLeft] = React.useState(60);
  const [canRetry, setCanRetry] = React.useState(false);

  React.useEffect(() => {
    if (secondsLeft <= 0) { setCanRetry(true); return; }
    const timer = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  return (
    <View style={styles.phaseContent}>
      <View style={{ alignItems: 'center', paddingVertical: 40 }}>
        <Text style={{ fontSize: 80 }}>⏳</Text>
        <Text style={{ color: '#FF6B35', fontSize: 28, fontWeight: 'bold', marginTop: 20, textAlign: 'center' }}>
          SENTRY TIMEOUT
        </Text>
        <Text style={{ color: '#FFA726', fontSize: 16, marginTop: 12, textAlign: 'center' }}>
          You scored {score}/{totalQuestions} — the sentry needs time to cool down.
        </Text>
        {!canRetry ? (
          <>
            <Text style={{ color: '#FF6B35', fontSize: 48, fontWeight: 'bold', marginTop: 24 }}>
              {secondsLeft}s
            </Text>
            <Text style={{ color: '#B8A080', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
              Review your avatar choices while you wait...
            </Text>
          </>
        ) : (
          <TouchableOpacity
            style={{ backgroundColor: '#4CAF50', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12, marginTop: 32 }}
            onPress={onRetry}
          >
            <Text style={{ color: '#000', fontSize: 18, fontWeight: 'bold' }}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

`;

// Insert before the main export
if (!s.includes("QuizPenaltyScreen")) {
  s = s.replace(
    "export default function IdentityRitual",
    penaltyComponent + "export default function IdentityRitual"
  );
  console.log("✅ Added QuizPenaltyScreen component");
}

fs.writeFileSync("Expo_identity_ritual.tsx", s);
console.log("✅ Quiz retry with 60s penalty — done");
