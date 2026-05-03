# AI IPL GURU 🏏
### *Advanced Probabilistic Deduction Engine for IPL Legends*

**AI IPL GURU** is a sophisticated, AI-driven interactive guessing system designed to identify any IPL cricketer (past or present) through a sequence of high-entropy, adaptive questions. Built for the modern web, it moves beyond static decision trees by utilizing Large Language Models (LLMs) to perform real-time candidate filtering and reasoning.

---

## 🚀 The Challenge
Identifying a specific player out of thousands of IPL participants (2008–Present) using only 12 questions is a significant data-science and UX challenge. Traditional "Akinator" clones rely on massive static databases; **AI IPL GURU** leverages dynamic AI reasoning to perform information gain-based questioning in real-time.

## 💡 The Solution
A full-stack Next.js application that integrates the **Gemini 1.5/3 Flash** engine to act as a "Neural Deduction Core." The system evaluates the game state after every response, updates a dynamic suspect pool, and selects the next question strategically to eliminate the maximum number of candidates.

## ✨ Key Features
- **Dynamic Questioning:** Questions are not hardcoded. The AI generates context-aware inquiries based on the current suspect pool.
- **Probabilistic Deduction:** A live "Insights" panel shows the top 5 suspects and their shifting probabilities as you play.
- **Resilient AI Loop:** Includes a multi-tier fallback system and retry logic to ensure the game never crashes, even if API limits are hit.
- **Telemetry & Session Tracking:** Integrated with Firebase/Firestore to track deduction history and recalibrate based on user feedback.
- **Mobile-Optimized:** A polished "Cyber-Sport" aesthetic designed to be lightning-fast on both desktop and mobile devices.

---

## 🏗️ System Architecture
The application follows a clean, serverless architecture:

1.  **Frontend (React/Next.js):** Manages the game state, animations (Framer Motion), and real-time telemetry display.
2.  **Deduction Engine (Gemini API):** Processes the `Interaction History` to calculate probabilities and generate the next most discriminative question.
3.  **Persistence Layer (Firestore):** Stores session data for learning from incorrect guesses and telemetry logging.
4.  **Error-Boundary Bridge:** A specialized handler that catches malformed AI JSON and injects static heuristic fallbacks to maintain 100% uptime.

---

## 🧠 AI Reasoning Approach
Unlike simple keyword filtering, our engine uses a **Entropy Reduction Strategy**:

- **Contextual Memory:** Each turn, the entire history is passed to the LLM with a strict system instruction to identify contradictions.
- **Suspect Weighting:** The AI assigns a confidence score (0-1) to candidates. If a candidate crosses the **85% threshold**, a final guess is triggered.
- **Information Gain:** The AI is instructed to ask questions that "split the pool." If it knows the player is a bowler, it won't ask if he's a batsman; it will ask if he's a "Wrist Spinner" vs. "Finger Spinner."

---

## 🛠️ Tech Stack
- **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
- **AI Core:** [Google Gemini API](https://ai.google.dev/) (google-genai SDK)
- **Database:** [Firebase/Firestore](https://firebase.google.com/)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)
- **Icons/UI:** [Lucide React](https://lucide.dev/), [Framer Motion](https://www.framer.com/motion/)

---

## ⚙️ Setup & Installation

### 1. Clone the repository
```bash
git clone https://github.com/your-username/ai-ipl-guru.git
cd ai-ipl-guru
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
# Firebase config is usually loaded from firebase-applet-config.json in this project
```

### 4. Run locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to start the game.

---

## 📉 Challenges & Learnings
- **JSON Stability:** Large Language Models can sometimes return malformed JSON. We implemented a robust "cleaning" regex and validation layer to sanitize outputs.
- **Token Optimization:** To keep the game fast, we optimized prompt length by utilizing `systemInstruction` parameters rather than injecting large context into every user message.
- **State Management:** Handling "Probably" and "IDK" responses required fine-tuning the AI's "Reasoning" system so it wouldn't prematurely eliminate valid candidates.

---

## 🔮 Future Improvements
- **Reinforcement Learning:** Build a local SQL/NoSQL player database that updates weights based on thousands of community games.
- **Image Integration:** Dynamically fetch player portraits from a validated CDN when making a guess.
- **Voice Mode:** Integrate Web Speech API for a hands-free "Guru" experience.

---

## 👋 Team
*Built with ❤️ for the AI Hackathon 2026.*
- **Amrit Guru** - Lead Developer & AI Engineer
