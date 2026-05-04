import { GoogleGenAI } from "@google/genai";
import { getHeuristicGameStep } from './gameEngine';

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
  guess?: string | null;
  confidence: number;
  isFinal: boolean;
  topSuspects: { name: string; probability: number }[];
  error?: string;
}

/**
 * PROCESS_GAME_STEP (Hybrid Edition)
 * Main entry point for game logic.
 * Combines local heuristic filtering with surgical AI narrative injections.
 */
export async function processGameStep(history: { question: string; answer: string }[], retryCount = 0): Promise<GameStep> {
  // 1. Core Logic: Always calculate the technical state locally first.
  // This ensures accuracy and zero-crashes even if the API is dead.
  const localResult = getHeuristicGameStep(history);
  
  // 2. Intelligence Strategy: Decide if this turn warrants a precious AI call.
  // We only call the AI for the Start, Mid-pivot, and the Final guess.
  const turnCount = history.length;
  const isStart = turnCount === 0;
  const isMidWay = turnCount === 6;
  const isFinal = localResult.isFinal;
  
  const shouldCallAI = isStart || isMidWay || isFinal;

  if (!shouldCallAI) {
    console.log(`[HYBRID_ENGINE]: Turn ${turnCount} - Using local heuristics (API Preserved)`);
    return localResult as GameStep;
  }

  try {
    const ai = getGenAI();
    const modelName = "gemini-3-flash-preview";
    
    console.log(`[AI_REQUEST]: Turn ${turnCount} - Fetching narrative intelligence...`);

    const systemInstruction = `
      You are the "AI IPL GURU". You handle the narrative layer of a player guessing game.
      
      LOGIC_INPUT: ${JSON.stringify(localResult)}
      
      CORE GUIDELINES:
      1. DO NOT change the technical candidates or confidence.
      2. If isFinal is FALSE: Rewrite 'question' to be more mystical, guru-like, and engaging.
      3. If isFinal is TRUE: Write a dramatic "Guru Revelation" guess (max 15 words).
      4. Avoid repeating previous questions. Keep it fresh.
      
      OUTPUT FORMAT (VALID JSON):
      {
        "nextQuestion": "Guru-style question string",
        "guess": "Dramatic guess string (if final)",
        "explanation": "Brief reasoning"
      }
    `;

    const interactionHistory = history.length > 0 
      ? history.map((h, i) => `${i + 1}. Q: ${h.question} | A: ${h.answer}`).join('\n')
      : "The pitch is fresh. No history yet.";

    const response = await ai.models.generateContent({
      model: modelName,
      contents: `CONTEXT:\n${interactionHistory}\n\nTOP CANDIDATES: ${localResult.topSuspects.map(s => s.name).join(', ')}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.3,
      }
    });

    const rawText = response.text;
    if (!rawText) throw new Error("Empty AI response");

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      // Fallback extraction if AI adds markdown
      const match = rawText.match(/\{[\s\S]*\}/);
      data = match ? JSON.parse(match[0]) : {};
    }
    
    return {
      ...localResult,
      question: data.nextQuestion || localResult.question,
      guess: localResult.isFinal ? (data.guess || localResult.guess) : null,
    } as GameStep;

  } catch (error: any) {
    console.warn(`[AI_BYPASS]: Turn ${turnCount} - Quota/Network issue. Reverting to technical core.`, error?.message);
    
    // Total Stability: If AI is down, the user moves through the game 
    // seamlessly using the local heuristic output.
    return {
      ...localResult,
      error: error?.status === 429 ? "QUOTA_MANAGED" : "HEURISTIC_RECOVERY"
    } as GameStep;
  }
}
