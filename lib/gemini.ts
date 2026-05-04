import { GoogleGenAI, Type } from "@google/genai";

let genAI: GoogleGenAI | null = null;

function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is not defined");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export interface GameStep {
  question?: string;
  guess?: string;
  confidence: number;
  isFinal: boolean;
  topSuspects: { name: string; probability: number }[];
  error?: string;
}

const cache = new Map<string, GameStep>();
let lastRequestTime = 0;

export async function processGameStep(history: { question: string; answer: string }[], retryCount = 0): Promise<GameStep> {
  const modelName = "gemini-3-flash-preview"; 
  
  // 1. Caching: Avoid redundant calls for the exact same state
  const historyKey = JSON.stringify(history);
  if (cache.has(historyKey)) {
    console.log("[CACHE_HIT]: Reusing previous deduction step.");
    return cache.get(historyKey)!;
  }

  // 2. Throttling: Prevent rapid-fire requests (must be at least 1s apart)
  const now = Date.now();
  if (now - lastRequestTime < 1000 && retryCount === 0) {
    console.warn("[THROTTLE]: Request too frequent, introducing delay.");
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const staticFallbacks = [
    "Is the player currently playing for an IPL franchise?",
    "Has the player ever won an IPL trophy?",
    "Is the player a specialist bowler?",
    "Has the player represented India in International cricket?",
    "Is the player known for explosive power-hitting?"
  ];

  if (!history) {
    history = [];
  }

  // 3. Request Capping: If game history is excessive (>15), force a fallback or final guess
  if (history.length > 20) {
     return {
        question: "I've asked too many questions! Is it Virat Kohli?",
        confidence: 50,
        isFinal: true,
        guess: "Virat Kohli",
        topSuspects: [{ name: "Virat Kohli", probability: 50 }]
     };
  }

  try {
    lastRequestTime = Date.now();
    const ai = getGenAI();
    
    const systemInstruction = `
      You are the "AI IPL GURU", a master deduction engine specializing in IPL players (2008-Present).
      
      CORE TASK:
      Deduce the player using the history. 
      
      RULES:
      1. ENTROPY: Select questions that eliminate the most candidates.
      2. CANDIDATES: Always return exactly 5 candidates.
      3. TERMINATION: Set 'isFinal' true only if confidence > 0.85 or count is 12.
      
      OUTPUT FORMAT (JSON):
      {
        "nextQuestion": "The next question",
        "guess": "Full Player Name",
        "confidence": float (0.0 to 1.0),
        "isFinal": boolean,
        "topSuspects": [{"name": "Name", "probability": float (0.0 to 1.0)}],
        "reasoning": "Quick reason"
      }
    `;

    const interactionHistory = history.length > 0 
      ? history.map((h, i) => `${i + 1}. Q: ${h.question} | A: ${h.answer}`).join('\n')
      : "No history yet.";

    const prompt = `HISTORY:\n${interactionHistory}\n\nTASK: Generate the next deduction step JSON.`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.1,
      }
    });

    const rawText = response.text;
    if (!rawText) throw new Error("Empty response from Gemini");

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error("[JSON_PARSE_ERROR]:", rawText);
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        data = JSON.parse(match[0]);
      } else {
        throw new Error("Could not find valid JSON in AI response");
      }
    }
    
    const suspects = Array.isArray(data?.topSuspects) ? data.topSuspects : [];
    const normalizedSuspects = suspects.slice(0, 5).map((s: any) => ({
      name: String(s?.name || "Unknown Player"),
      probability: Math.min(Math.max((Number(s?.probability) || 0) * 100, 0), 100)
    }));

    if (normalizedSuspects.length === 0 && data?.guess) {
      normalizedSuspects.push({ name: String(data.guess), probability: 90 });
    }

    const confidenceVal = Math.min(Math.max((Number(data?.confidence) || 0) * 100, 0), 100);
    const finalFlag = !!data?.isFinal || history.length >= 12;
    
    let guess = data?.guess;
    if (finalFlag && !guess && normalizedSuspects.length > 0) {
      guess = normalizedSuspects[0].name;
    }

    const result: GameStep = {
      question: data?.nextQuestion || staticFallbacks[history.length % staticFallbacks.length],
      guess: guess || null,
      confidence: confidenceVal,
      isFinal: finalFlag,
      topSuspects: normalizedSuspects
    };

    // Store in cache
    cache.set(historyKey, result);
    return result;

  } catch (error: any) {
    console.error(`[AI_FAILURE] Attempt ${retryCount + 1}:`, error);

    const isRateLimit = error?.message?.includes('429') || error?.status === 429;
    
    if (retryCount < 2) {
      // Exponential backoff: 1s, 2s, 4s...
      const waitTime = Math.pow(2, retryCount) * 1000;
      console.warn(`[RETRYING] in ${waitTime}ms due to ${isRateLimit ? 'Rate Limit' : 'Error'}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return processGameStep(history, retryCount + 1);
    }
    
    return {
      question: staticFallbacks[history.length % staticFallbacks.length],
      confidence: 5,
      isFinal: false,
      topSuspects: history.length > 5 ? [{ name: "MS Dhoni", probability: 10 }] : [],
      error: isRateLimit ? "QUOTA_EXCEEDED" : "AI_STABILITY_TRIGGERED"
    };
  }
}
