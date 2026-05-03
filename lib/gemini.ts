import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY! });

export interface GameStep {
  question?: string;
  guess?: string;
  confidence: number;
  isFinal: boolean;
  topSuspects: { name: string; probability: number }[];
  error?: string;
}

export async function processGameStep(history: { question: string; answer: string }[], retryCount = 0): Promise<GameStep> {
  const model = "gemini-1.5-flash"; // Using flash for speed in production
  
  const systemInstruction = `
    You are the AI Akinator for IPL (Indian Premier League) players.
    Objective: Identify the IPL player the user is thinking of using deduction.
    
    CRITICAL CONSTRAINTS:
    1. SCOPE: ONLY IPL players (2008-Present).
    2. ENTROPY: Select questions that most effectively split the candidate pool.
    3. CANDIDATES: Always maintain a realistic suspect pool. Never return an empty list.
    4. CONFIDENCE: Trigger "isFinal: true" ONLY when confidence >= 0.8 OR 12 questions reached.
    
    RESPONSE FORMAT (VALID JSON):
    {
      "nextQuestion": "...",
      "guess": "Name",
      "confidence": 0.0 to 1.0,
      "isFinal": boolean,
      "topSuspects": [{"name": "Name", "probability": 0.0 to 1.0}],
      "reasoning": "..."
    }
  `;

  try {
    const prompt = `History:\n${history.map((h, i) => `${i + 1}. Q: ${h.question} | A: ${h.answer}`).join('\n')}\n\nThink step-by-step.`;

    const result = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nextQuestion: { type: Type.STRING },
            guess: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            isFinal: { type: Type.BOOLEAN },
            topSuspects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  probability: { type: Type.NUMBER }
                },
                required: ["name", "probability"]
              }
            },
            reasoning: { type: Type.STRING }
          },
          required: ["confidence", "isFinal", "topSuspects"]
        }
      }
    });

    const data = JSON.parse(result.text || "{}");
    
    // Auto-fix guesses if final but blank
    if (data.isFinal && !data.guess && data.topSuspects.length > 0) {
      data.guess = data.topSuspects[0].name;
    }

    return {
      question: data.nextQuestion || "Is your player a batsman?",
      guess: data.guess || null,
      confidence: (data.confidence || 0) * 100,
      isFinal: !!data.isFinal || history.length >= 12,
      topSuspects: (data.topSuspects || []).slice(0, 5).map((s: any) => ({
        name: s.name,
        probability: Math.min(Math.max((s.probability || 0) * 100, 0), 100)
      }))
    };
  } catch (error) {
    if (retryCount < 2) {
      console.warn(`[RETRYING] Attempt ${retryCount + 1}...`);
      return processGameStep(history, retryCount + 1);
    }
    console.error("AI_GEN_CRITICAL:", error);
    return {
      question: "Engine error. Keep answering anyway: Is the player Indian?",
      confidence: 0,
      isFinal: false,
      topSuspects: [],
      error: "AI_TIMEOUT"
    };
  }
}
