const fs = require("fs");
let s = fs.readFileSync("Expo_identity_ritual.tsx", "utf8");
s = s.replace(
  `if (state.showQuizResult === 'restart') {
          return (
            
          );
        }`,
  `if (state.showQuizResult === 'restart') {
          return (
            <View style={styles.phaseContent}>
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 80 }}>?</Text>
                <Text style={{ color: '#FF6B35', fontSize: 28, fontWeight: 'bold', marginTop: 20, textAlign: 'center' }}>
                  SENTRY SUSPICIOUS
                </Text>
                <Text style={{ color: '#FFA726', fontSize: 16, marginTop: 12, textAlign: 'center' }}>
                  Failed twice. Take a moment and try again.
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: '#F59E0B', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12, marginTop: 32 }}
                  onPress={() => {
                    const quizQuestions = generateQuiz(state.recipe, state.colorMixHistory);
                    setState(prev => ({ ...prev, showQuizResult: 'none', quizQuestions, currentQuizIndex: 0, quizScore: 0, quizRetries: 0 }));
                  }}
                >
                  <Text style={{ color: '#000', fontSize: 18, fontWeight: 'bold' }}>Try Again</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }`
);
fs.writeFileSync("Expo_identity_ritual.tsx", s);
console.log("done");
