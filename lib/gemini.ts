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
  technicalQuestion?: string; // The raw attribute-based question
  question?: string;          // The narrative/mystical question
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
export async function processGameStep(history: { technicalQuestion?: string; question: string; answer: string }[], retryCount = 0): Promise<GameStep> {
  // 1. Core Logic: Always calculate the technical state locally first.
  const localResult = getHeuristicGameStep(history);
  
  // 2. Intelligence Strategy: Decide if this turn warrants a precious AI call.
  const turnCount = history.length;
  const isStart = turnCount === 0;
  const isMidWay = turnCount === 6;
  const isFinal = localResult.isFinal;
  
  const shouldCallAI = isStart || isMidWay || isFinal;

  if (!shouldCallAI) {
    console.log(`[HYBRID_ENGINE]: Turn ${turnCount} - Using local heuristics (API Preserved)`);
    return {
      ...localResult,
      technicalQuestion: localResult.question, // In local mode, they are the same
      question: localResult.question,
    } as GameStep;
  }

  try {
    const ai = getGenAI();
    const modelName = "gemini-3-flash-preview";
    
    console.log(`[AI_REQUEST]: Turn ${turnCount} - Fetching narrative intelligence...`);

    const systemInstruction = `
      You are the "AI IPL GURU". You handle the narrative layer of a player guessing game.
      
      TECHNICAL_INTENT: "${localResult.question}"
      LOGIC_STATE: ${JSON.stringify(localResult)}
      
      CORE GUIDELINES:
      1. DO NOT change the technical candidates or confidence.
      2. If isFinal is FALSE: Rewrite the provided 'TECHNICAL_INTENT' to be more mystical, guru-like, and engaging.
      3. CRITICAL: DO NOT repeat or rephrase any ideas from the previous conversation history. 
      4. Avoid semantic similarity. If the history already covers a topic, focus exclusively on the new 'TECHNICAL_INTENT'.
      5. If isFinal is TRUE: Write a dramatic "Guru Revelation" guess (max 15 words).
      
      OUTPUT FORMAT (VALID JSON):
      {
        "nextQuestion": "Unique guru-style question string",
        "guess": "Dramatic guess string (if final)",
        "explanation": "Brief reasoning"
      }
    `;

    const interactionHistory = history.length > 0 
      ? history.map((h, i) => `${i + 1}. Intent: ${h.technicalQuestion} | Guru Asked: ${h.question} | User Answered: ${h.answer}`).join('\n')
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
      technicalQuestion: localResult.question,
      question: data.nextQuestion || localResult.question,
      guess: localResult.isFinal ? (data.guess || localResult.guess) : null,
    } as GameStep;

  } catch (error: any) {
    console.warn(`[AI_BYPASS]: Turn ${turnCount} - Quota/Network issue. Reverting to technical core.`, error?.message);
    
    return {
      ...localResult,
      technicalQuestion: localResult.question,
      question: localResult.question,
      error: error?.status === 429 ? "QUOTA_MANAGED" : "HEURISTIC_RECOVERY"
    } as GameStep;
  }
}
