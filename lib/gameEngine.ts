import { IPL_PLAYERS, ATTRIBUTE_QUESTIONS } from './playerDb';

export function getHeuristicGameStep(history: { question: string; answer: string }[]) {
  let candidates = [...IPL_PLAYERS];

  // 1. Filter candidates based on history
  for (const entry of history) {
    const questionData = ATTRIBUTE_QUESTIONS.find(q => q.question === entry.question);
    if (!questionData) continue;

    const { key, value } = questionData;
    const isYes = entry.answer === 'Yes';
    const isNo = entry.answer === 'No';

    if (isYes) {
      candidates = candidates.filter(p => String(p[key as keyof typeof p]) === String(value));
    } else if (isNo) {
      candidates = candidates.filter(p => String(p[key as keyof typeof p]) !== String(value));
    }
  }

  // 2. Calculate Confidence
  const totalOriginal = IPL_PLAYERS.length;
  const confidence = Math.min(100, Math.round((1 - candidates.length / totalOriginal) * 100));

  // 3. Selection: Is it time for a guess?
  if (candidates.length === 1 || (history.length >= 12 && candidates.length > 0)) {
    return {
      isFinal: true,
      guess: candidates[0].name,
      confidence: candidates.length === 1 ? 100 : confidence,
      topSuspects: candidates.slice(0, 5).map(p => ({ name: p.name, probability: 100 / candidates.length })),
      question: null
    };
  }

  // 4. Find the best next question (Information Gain / Splitting)
  const usedQuestions = history.map(h => h.question);
  let bestQuestion = ATTRIBUTE_QUESTIONS[0];
  let minDiff = Infinity;

  for (const q of ATTRIBUTE_QUESTIONS) {
    if (usedQuestions.includes(q.question)) continue;

    const matchingCount = candidates.filter(p => String(p[q.key as keyof typeof p]) === String(q.value)).length;
    const diff = Math.abs(matchingCount - (candidates.length / 2));

    if (diff < minDiff) {
      minDiff = diff;
      bestQuestion = q;
    }
  }

  return {
    isFinal: false,
    guess: null,
    confidence: confidence,
    topSuspects: candidates.slice(0, 5).map(p => ({
       name: p.name, 
       probability: Math.round((1 / (candidates.length || 1)) * 100) 
    })),
    question: bestQuestion.question
  };
}
