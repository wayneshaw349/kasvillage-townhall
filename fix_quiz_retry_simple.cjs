// fix_quiz_retry_simple.cjs
// Just changes "Restart Ritual" (phase 1 reset) to "Try Again" (regenerate quiz)
// NO penalty timer here — AppNavigator's QuizGate already handles lockout
const fs = require("fs");
let s = fs.readFileSync("Expo_identity_ritual.tsx", "utf8");

// Remove QuizPenaltyScreen if previous patch added it
if (s.includes("QuizPenaltyScreen")) {
  // Remove the component definition
  s = s.replace(/\/\/ =+\n\/\/ QUIZ PENALTY SCREEN[\s\S]*?^}\n\n/m, "");
  // Revert any reference to it
  s = s.replace(/QuizPenaltyScreen[\s\S]*?\/>/g, "");
  console.log("✅ Removed old QuizPenaltyScreen");
}

// Change "Restart Ritual" to "Try Again" — just regenerate quiz, don't reset to phase 1
s = s.replace(
  "Failed twice. You must restart the entire ritual.",
  "Failed twice. Take a moment and try again."
);
s = s.replace(
  "The gate slams shut. Begin again from the beginning.",
  "The sentry gives you one more chance."
);
s = s.replace(
  "Restart Ritual",
  "Try Again"
);

// Change the restart button action: regenerate quiz instead of phase 1
s = s.replace(
  `onPress={() => setState(prev => ({ ...prev, showQuizResult: 'none' as const, phase: 1 }))}`,
  `onPress={() => {
                    const quizQuestions = generateQuiz(state.recipe, state.colorMixHistory);
                    setState(prev => ({ ...prev, showQuizResult: 'none' as const, quizQuestions, currentQuizIndex: 0, quizScore: 0, quizRetries: 0 }));
                  }}`
);

fs.writeFileSync("Expo_identity_ritual.tsx", s);
console.log("✅ Retry button: regenerates quiz instead of restarting ritual");
console.log("   Penalty timer stays in AppNavigator QuizGate (30s→2m→10m→1h→24h)");
