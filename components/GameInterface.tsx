'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  HelpCircle, 
  RotateCcw, 
  ThumbsUp, 
  ThumbsDown, 
  Loader2, 
  Brain,
  Zap,
  BarChart3,
  Dna
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { processGameStep, GameStep } from '@/lib/gemini';
import { handleFirestoreError } from '@/lib/errorHandler';

type Status = 'welcome' | 'playing' | 'guessing' | 'finished' | 'incorrect' | 'loading';

interface Suspect {
  name: string;
  probability: number;
}

export default function GameInterface() {
  const [status, setStatus] = useState<Status>('welcome');
  const [history, setHistory] = useState<{ question: string; answer: string }[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [guess, setGuess] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [topSuspects, setTopSuspects] = useState<Suspect[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPool, setShowPool] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const startGame = async () => {
    if (loading) return;
    setLoading(true);
    setGameError(null);
    setStatus('loading');
    try {
      const docRef = await addDoc(collection(db, 'sessions'), {
        status: 'active',
        questions: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSessionId(docRef.id);
      
      const firstStep = await processGameStep([]);
      
      // Use fallback question if first step fails
      setCurrentQuestion(firstStep?.question || 'Is the player a specialist batsman?');
      setTopSuspects(Array.isArray(firstStep?.topSuspects) ? firstStep.topSuspects : []);
      setHistory([]);
      setStatus('playing');
    } catch (err) {
      handleFirestoreError(err, 'WRITE', 'sessions');
      setGameError("Failed to initialize session. Please check your connection.");
      setStatus('welcome');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (answer: string) => {
    if (loading || !sessionId) return;
    
    setGameError(null);
    const newHistory = [...history, { question: currentQuestion, answer }];
    setHistory(newHistory);
    setLoading(true);
    
    try {
      // Use background sync for Firestore
      if (sessionId) {
        updateDoc(doc(db, 'sessions', sessionId), {
          questions: newHistory,
          updatedAt: serverTimestamp(),
        }).catch(e => {
          console.error("Non-critical sync failure:", e);
          setGameError("Network unstable, sync delayed...");
        });
      }

      const nextStep = await processGameStep(newHistory);
      
      if (nextStep?.error === 'QUOTA_EXCEEDED') {
        setGameError("Intelligence quota reached. Switching to backup heuristics.");
      } else if (nextStep?.error === 'AI_STABILITY_TRIGGERED') {
        setGameError("Neural link unstable - using heuristic estimation.");
      } else if (nextStep?.error) {
        setGameError("Engine anomaly detected. Recalibrating...");
      }

      setTopSuspects(Array.isArray(nextStep?.topSuspects) ? nextStep.topSuspects : []);
      setConfidence(nextStep?.confidence ?? 10);
      
      if (nextStep?.isFinal && nextStep?.guess) {
        setGuess(nextStep.guess);
        setStatus('guessing');
      } else {
        setCurrentQuestion(nextStep?.question || 'Is the player currently active in the IPL?');
      }
    } catch (err) {
      console.error("Deduction lifecycle crash:", err);
      setGameError("System sync failure. Attempting to keep state alive...");
      setTimeout(() => setLoading(false), 1500);
      return;
    } finally {
      setLoading(false);
    }
  };

  const handleCorrect = async () => {
    if (!sessionId) return;
    try {
      setStatus('finished');
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'finished',
        finalGuess: guess,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, 'WRITE', `sessions/${sessionId}`);
    }
  };

  const submitFeedback = async (actualPlayer: string) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const fbId = `FB_${Date.now()}`;
      await setDoc(doc(db, 'feedback', fbId), {
        sessionId,
        guessedPlayer: guess,
        actualPlayer,
        history: history.map(h => `${h.question}: ${h.answer}`),
        createdAt: serverTimestamp(),
      });
      
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'failed',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, 'WRITE', 'feedback');
    } finally {
      setLoading(false);
      resetGame();
    }
  };

  const resetGame = () => {
    setStatus('welcome');
    setHistory([]);
    setGuess(null);
    setTopSuspects([]);
    setConfidence(0);
    setSessionId(null);
    setGameError(null);
  };

  const responseOptions = [
    { label: 'YES', color: 'bg-emerald-500 hover:bg-emerald-400' },
    { label: 'NO', color: 'bg-rose-500 hover:bg-rose-400' },
    { label: 'PROBABLY', color: 'bg-slate-700 hover:bg-slate-600' },
    { label: 'PROBABLY NOT', color: 'bg-slate-700 hover:bg-slate-600' },
    { label: 'DON\'T KNOW', color: 'bg-amber-500 hover:bg-amber-400 text-slate-900' }
  ];

  return (
    <div className="w-full h-screen bg-slate-900 font-sans text-white flex flex-col overflow-hidden select-none">
      {/* Top Navigation */}
      <nav className="h-16 px-4 md:px-8 flex items-center justify-between border-b border-white/10 bg-slate-950/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-amber-400 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(251,191,36,0.5)]">
            <span className="text-slate-900 font-black text-lg md:text-xl">🏏</span>
          </div>
          <h1 className="text-lg md:text-xl font-bold tracking-tight bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">AI IPL GURU</h1>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-slate-400">Inquiry Loop</span>
            <span className="text-sm font-mono font-bold text-amber-400 uppercase">
              {status === 'welcome' ? 'READY' : `STEP ${history.length + 1} OF 12`}
            </span>
          </div>
          <div className="w-20 md:w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(history.length / 12) * 100}%` }}
              className="h-full bg-amber-400" 
            />
          </div>
          {status !== 'welcome' && (
            <button 
              onClick={() => setShowPool(!showPool)}
              className="md:hidden p-2 bg-slate-800 rounded-lg"
            >
              <BarChart3 className="w-5 h-5 text-amber-400" />
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1 flex overflow-hidden relative">
        {/* Sidebar: Live Deduction Engine */}
        <aside className={`
          ${showPool ? 'translate-x-0' : '-translate-x-full'} 
          md:translate-x-0 md:static fixed inset-y-0 left-0 z-40
          w-72 md:w-80 bg-slate-950 md:bg-slate-950/30 border-r border-white/5 p-6 flex flex-col gap-6 overflow-y-auto transition-transform duration-300 ease-in-out
        `}>
          <div className="flex justify-between items-center md:hidden mb-4">
             <h2 className="text-lg font-display uppercase text-amber-400">Insights</h2>
             <button onClick={() => setShowPool(false)} className="p-2 text-slate-400">&times;</button>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Dna className="w-3 h-3 text-emerald-400" />
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Live Candidate Pool</h3>
            </div>
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {topSuspects.length > 0 ? (
                  topSuspects.map((suspect, idx) => (
                    <motion.div 
                      key={suspect.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1 - idx * 0.15, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="pool-item"
                    >
                      <span className="text-sm font-medium truncate pr-2">{suspect.name}</span>
                      <span className="text-xs font-mono text-emerald-400">{suspect.probability.toFixed(1)}%</span>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-xs font-mono text-slate-600 italic py-4 text-center">Awaiting data input...</div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="mt-auto">
            <div className="p-4 rounded-xl bg-indigo-600/20 border border-indigo-500/30">
              <div className="flex justify-between items-end mb-2">
                <span className="text-[10px] font-bold uppercase text-indigo-300">Confidence Score</span>
                <span className="text-2xl font-black text-white">{confidence.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${confidence}%` }}
                  className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
                />
              </div>
              <p className="text-[10px] text-indigo-200/60 mt-3 leading-relaxed">
                {confidence >= 80 
                  ? "Threshold reached. Formulating prediction..." 
                  : "System requires 80% confidence for final prediction."}
              </p>
            </div>
          </div>
        </aside>

        {/* Backdrop for mobile sidebar */}
        {showPool && (
          <div 
            onClick={() => setShowPool(false)} 
            className="fixed inset-0 bg-black/60 z-30 md:hidden"
          />
        )}

        {/* Main Gameplay Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-12 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-slate-950 relative overflow-y-auto">
          <AnimatePresence mode="wait">
            {status === 'welcome' && (
              <motion.div 
                key="welcome"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center max-w-lg text-center"
              >
                <div className="relative mb-6 md:mb-8">
                  <div className="absolute inset-0 bg-amber-400 blur-[80px] opacity-20 animate-pulse" />
                  <div className="w-32 h-32 md:w-40 md:h-40 bg-slate-800 rounded-full border-4 border-slate-700 flex items-center justify-center relative z-10">
                    <Brain className="w-16 h-16 md:w-20 md:h-20 text-amber-400" />
                  </div>
                </div>
                <h2 className="text-3xl md:text-4xl font-display uppercase mb-4">Challenge the Guru</h2>
                {gameError && (
                  <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs rounded-lg uppercase font-mono animate-pulse">
                    ⚠️ {gameError}
                  </div>
                )}
                <p className="text-sm md:text-base text-slate-400 mb-8 leading-relaxed px-4">
                  Think of any IPL legend, overseas star, or rising talent. 
                  My neural network will deduce their identity using maximum information gain.
                </p>
                <button 
                  onClick={startGame}
                  className="w-full sm:w-auto px-12 py-4 md:py-5 bg-amber-400 text-slate-900 font-bold uppercase rounded-2xl shadow-xl hover:bg-white transition-all active:scale-95"
                >
                  Initiate Scan
                </button>
              </motion.div>
            )}

            {(status === 'playing' || status === 'loading') && (
              <motion.div 
                key="playing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full max-w-2xl flex flex-col items-center"
              >
                {/* AI Character Visual */}
                <div className="relative mb-8 md:mb-12">
                  <div className="absolute inset-0 bg-indigo-500 blur-[100px] opacity-20" />
                  <div className="w-24 h-24 md:w-32 md:h-32 bg-slate-800 rounded-full border-4 border-slate-700 flex items-center justify-center relative z-10 overflow-hidden">
                    {loading ? (
                      <Loader2 className="w-10 h-10 md:w-12 md:h-12 text-indigo-400 animate-spin" />
                    ) : (
                      <Brain className="w-12 h-12 md:w-16 md:h-16 text-indigo-400" />
                    )}
                    <div className="absolute top-1 right-1 flex animate-bounce">
                      <Zap className="w-3 h-3 md:w-4 md:h-4 text-amber-400 fill-amber-400" />
                    </div>
                  </div>
                </div>

                {/* Question Speech Bubble */}
                <div className="w-full relative px-2">
                  <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-2xl relative">
                    <div className="bubble-triangle" />
                    {loading ? (
                      <div className="h-10 flex items-center justify-center space-x-2">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                      </div>
                    ) : (
                      <p className="text-xl md:text-2xl font-bold text-slate-900 text-center leading-relaxed italic">
                        &quot;{currentQuestion}&quot;
                      </p>
                    )}
                  </div>

                  {gameError && (
                    <div className="mt-4 p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] text-center rounded-lg uppercase tracking-widest font-bold">
                      {gameError}
                    </div>
                  )}

                  {/* Response Actions */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3 mt-8 md:mt-10">
                    {responseOptions.map((opt, idx) => (
                      <button
                        key={opt.label}
                        disabled={loading}
                        onClick={() => handleAnswer(opt.label)}
                        className={`response-btn ${opt.color} ${idx === 4 ? 'col-span-2 sm:col-span-1' : ''} disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm py-4 md:py-6`}
                      >
                        {opt.label === 'DON\'T KNOW' ? 'IDK' : opt.label === 'PROBABLY NOT' ? 'UNLIKELY' : opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {status === 'guessing' && (
              <motion.div 
                key="guessing"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md bg-slate-950 p-6 md:p-10 rounded-2xl md:rounded-3xl border-2 border-amber-400 shadow-[0_0_50px_rgba(251,191,36,0.2)] flex flex-col items-center gap-6 md:gap-8"
              >
                <div className="w-20 h-20 md:w-24 md:h-24 bg-amber-400 rounded-full flex items-center justify-center shadow-lg">
                  <Trophy className="w-12 h-12 md:w-14 md:h-14 text-slate-900" />
                </div>
                <div className="text-center">
                  <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 block">Deduction Result</span>
                  <h2 className="text-4xl md:text-5xl font-display uppercase text-white leading-tight">
                    {guess}
                  </h2>
                  <p className="text-emerald-400 font-mono text-sm mt-2">Confidence: {confidence.toFixed(1)}%</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <button 
                    onClick={handleCorrect}
                    className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl transition-all"
                  >
                    THAT&apos;S HIM!
                  </button>
                  <button 
                    onClick={() => setStatus('incorrect')}
                    className="flex-1 py-4 bg-slate-800 hover:bg-rose-500 text-white font-bold rounded-xl transition-all"
                  >
                    NOPE
                  </button>
                </div>
              </motion.div>
            )}

            {status === 'finished' && (
              <motion.div 
                key="finished"
                className="flex flex-col items-center text-center px-4"
              >
                <div className="w-24 h-24 md:w-32 md:h-32 bg-emerald-500 rounded-full flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                  <ThumbsUp className="w-12 h-12 md:w-16 md:h-16 text-white" />
                </div>
                <h2 className="text-4xl md:text-6xl font-display uppercase mb-4 text-white">Victory!</h2>
                <p className="text-sm md:text-base text-slate-400 mb-8 max-w-sm">
                  Another successful identification. My IPL database remains unmatched.
                </p>
                <button 
                  onClick={() => setStatus('welcome')}
                  className="w-full sm:w-auto px-12 py-4 md:py-5 bg-white text-slate-900 font-bold uppercase rounded-2xl hover:bg-amber-400 transition-all"
                >
                  New Challenge
                </button>
              </motion.div>
            )}

            {status === 'incorrect' && (
              <motion.div 
                key="incorrect"
                className="w-full max-w-md bg-slate-950 p-6 md:p-10 rounded-2xl md:rounded-3xl border-2 border-rose-500/50 flex flex-col items-center gap-6"
              >
                <div className="text-center">
                  <h2 className="text-2xl md:text-3xl font-display uppercase text-white mb-2">Anomaly Detected</h2>
                  <p className="text-slate-500 text-xs md:text-sm italic">Input correct identity to recalibrate engine.</p>
                </div>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const val = (e.target as any).player.value;
                    if (val) submitFeedback(val);
                  }}
                  className="w-full space-y-4"
                >
                  <input 
                    autoFocus
                    name="player"
                    placeholder="PLAYER NAME"
                    className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-white uppercase font-bold outline-none focus:border-amber-400 transition-colors"
                  />
                  <button className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase rounded-xl transition-all">
                    Update Guru
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Telemetry Footer */}
      <footer className="h-12 px-4 md:px-8 flex items-center justify-between bg-slate-950 border-t border-white/5 flex-shrink-0 z-20">
            <div className="flex gap-4 md:gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 ${gameError ? 'bg-amber-500' : 'bg-emerald-500'} rounded-full animate-pulse`} />
            <span className="text-[8px] md:text-[10px] text-slate-400 font-mono tracking-widest uppercase truncate max-w-[100px] md:max-w-none">
              {gameError ? 'Telemetry Degraded' : 'Deduction Core Online'}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2 border-l border-white/10 pl-4 md:pl-6">
            <span className="text-[10px] text-slate-500 uppercase tracking-tighter">Stack:</span>
            <span className="text-[10px] text-slate-300 font-mono">{history.length} ITEMS</span>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <span className="hidden xs:inline text-[10px] text-zinc-600 font-mono">ID: {sessionId?.slice(0, 8) || 'NULL'}</span>
          <button 
            onClick={() => setStatus('welcome')}
            className="text-[10px] bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded text-slate-300 uppercase font-bold tracking-tighter transition-colors pointer-events-auto"
          >
            Restart
          </button>
        </div>
      </footer>
    </div>
  );
}
