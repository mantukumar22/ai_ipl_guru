import { IPL_PLAYERS, ATTRIBUTE_QUESTIONS } from './playerDb';

export function getHeuristicGameStep(history: { technicalQuestion?: string; question: string; answer: string }[]) {
  let candidates = [...IPL_PLAYERS];

  // 1. Filter candidates based on history
  for (const entry of history) {
    const technicalKey = entry.technicalQuestion || entry.question;
    const questionData = ATTRIBUTE_QUESTIONS.find(q => q.question === technicalKey);
    if (!questionData) continue;

    const { key, value } = questionData;
    const isYes = entry.answer === 'Yes' || entry.answer === 'PROBABLY';
    const isNo = entry.answer === 'No' || entry.answer === 'PROBABLY NOT';

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
  // We strictly avoid questions that technically overlap with what we already know.
  const technicalHistory = history.map(h => h.technicalQuestion || h.question);

  // Track which ATTRIBUTES (key-value pairs) have already been definitively explored
  const exploredAttributes = new Set(technicalHistory.map(techQ => {
    const q = ATTRIBUTE_QUESTIONS.find(aq => aq.question === techQ);
    return q ? `${q.key}:${q.value}` : null;
  }).filter(Boolean));

  let bestQuestion = null;
  let minDiff = Infinity;

  for (const q of ATTRIBUTE_QUESTIONS) {
    // Skip if this technical question has already been asked
    if (technicalHistory.includes(q.question)) continue;
    
    // Skip if we already explored this specific attribute value
    if (exploredAttributes.has(`${q.key}:${q.value}`)) continue;

    const matchingCount = candidates.filter(p => String(p[q.key as keyof typeof p]) === String(q.value)).length;
    
    // If a question doesn't split the current pool at all (0 or all), it's useless
    if (matchingCount === 0 || matchingCount === candidates.length) continue;

    const diff = Math.abs(matchingCount - (candidates.length / 2));

    if (diff < minDiff) {
      minDiff = diff;
      bestQuestion = q;
    }
  }

  // Fallback if no specific attribute question is discriminative enough
  const finalQuestion = bestQuestion ? bestQuestion.question : "Is your player a high-profile IPL star?";

  return {
    isFinal: false,
    guess: null,
    confidence: confidence,
    topSuspects: candidates.slice(0, 5).map(p => ({
       name: p.name, 
       probability: Math.round((1 / (candidates.length || 1)) * 100) 
    })),
    question: finalQuestion
  };
}
