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

export async function processGameStep(history: { question: string; answer: string }[], retryCount = 0): Promise<GameStep> {
  const modelName = "gemini-3-flash-preview"; 

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

  try {
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
      // Try to extract JSON if AI included other text
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        data = JSON.parse(match[0]);
      } else {
        throw new Error("Could not find valid JSON in AI response");
      }
    }
    
    // Defensive normalization with strict null checks
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

    return {
      question: data?.nextQuestion || staticFallbacks[history.length % staticFallbacks.length],
      guess: guess || null,
      confidence: confidenceVal,
      isFinal: finalFlag,
      topSuspects: normalizedSuspects
    };

  } catch (error) {
    console.error(`[AI_FAILURE] Attempt ${retryCount + 1}:`, error);

    if (retryCount < 2) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return processGameStep(history, retryCount + 1);
    }
    
    return {
      question: staticFallbacks[history.length % staticFallbacks.length],
      confidence: 5,
      isFinal: false,
      topSuspects: history.length > 5 ? [{ name: "Virat Kohli", probability: 10 }] : [],
      error: "AI_STABILITY_TRIGGERED"
    };
  }
}
