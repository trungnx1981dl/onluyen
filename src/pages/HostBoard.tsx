import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { Quiz, Question, GameSession, Player } from '../types';
import { 
  Loader2, 
  Users, 
  Trophy, 
  Clock, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Maximize, 
  Minimize, 
  Pause, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Sparkles,
  HelpCircle,
  Home
} from 'lucide-react';
import { shuffleQuiz } from '../utils/shuffleQuiz';
import { calculateScoreBreakdown, formatTFAnswer, parseTFAnswerList, normalizeTFChar } from '../utils/scoring';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';

export default function HostBoard() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Timer & Host Controls
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAllAnswersInSummary, setShowAllAnswersInSummary] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Score breakdown calculated according to rules
  const breakdown = useMemo(() => {
    return quiz ? calculateScoreBreakdown(quiz.questions) : null;
  }, [quiz]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const init = async () => {
      if (!quizId) return;
      const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
      if (quizDoc.exists()) {
        const qData = quizDoc.data() as Quiz;
        const shuffledQuiz = shuffleQuiz(qData);
        setQuiz(shuffledQuiz);
        // Create session with randomized questions
        const sessionId = `ses-${Date.now()}`;
        const newSession: GameSession = {
          id: sessionId,
          quizId,
          hostId: 'host',
          status: 'WAITING',
          currentQuestionIndex: 0,
          createdAt: Date.now(),
          questions: shuffledQuiz.questions,
        };
        await setDoc(doc(db, 'sessions', sessionId), newSession);
        setSession(newSession);
        
        // Listen to players
        const unsub = onSnapshot(collection(db, `sessions/${sessionId}/players`), (snap) => {
          setPlayers(snap.docs.map(d => d.data() as Player));
        });
        setLoading(false);
        return () => unsub();
      }
    };
    init();
  }, [quizId]);

  // Audio for tick
  const playTick = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Timer loop
  useEffect(() => {
    if (session?.status === 'ACTIVE' && quiz) {
      const q = quiz.questions[session.currentQuestionIndex];
      // Reset timer & answer visibility on each question
      setTimeLeft(q.timeLimit || (q.type === 'MC' ? 30 : 60));
      setShowAnswer(false);
      setIsTimerPaused(false);
      
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (isTimerPaused) return prev;
          if (prev <= 10 && prev > 1) playTick();
          if (prev <= 1) {
            // Do not force-skip; stop timer and let teacher reveal answer & explain!
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session?.status, session?.currentQuestionIndex, quiz]);

  // KaTeX rendering for math & formulas
  useEffect(() => {
    const container = document.getElementById('question-content');
    if (container) {
      renderMathInElement(container, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError: false,
      });
    }

    const answerBox = document.getElementById('revealed-answer-box');
    if (answerBox) {
      renderMathInElement(answerBox, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError: false,
      });
    }
  });

  const handleStart = async () => {
    if (!session) return;
    await updateDoc(doc(db, 'sessions', session.id), { status: 'ACTIVE', questionStartTime: Date.now() });
    setSession({ ...session, status: 'ACTIVE', questionStartTime: Date.now() });
  };

  const handleNextQuestion = async () => {
    if (!session || !quiz) return;
    setShowAnswer(false);
    if (session.currentQuestionIndex < quiz.questions.length - 1) {
      const nextIdx = session.currentQuestionIndex + 1;
      await updateDoc(doc(db, 'sessions', session.id), { currentQuestionIndex: nextIdx, questionStartTime: Date.now() });
      setSession({ ...session, currentQuestionIndex: nextIdx, questionStartTime: Date.now() });
    } else {
      await updateDoc(doc(db, 'sessions', session.id), { status: 'FINISHED' });
      setSession({ ...session, status: 'FINISHED' });
    }
  };

  if (loading || !quiz || !session) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-white">
        <Loader2 className="w-14 h-14 text-teal-400 animate-spin" />
        <p className="text-xl font-bold tracking-wide text-slate-300">Đang chuẩn bị màn chiếu 16:9...</p>
      </div>
    );
  }

  // WAITING LOBBY SCREEN (OPTIMIZED FOR 16:9 PROJECTOR)
  if (session.status === 'WAITING') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden select-none">
        {/* Ambient projection glow */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Control Bar */}
        <div className="absolute top-6 right-6 flex items-center gap-3 z-20">
          <button
            onClick={toggleFullscreen}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl backdrop-blur-md text-white border border-white/15 transition-all flex items-center gap-2 text-sm font-bold"
            title="Chuyển chế độ Toàn màn hình máy chiếu"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            <span>{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình (16:9)'}</span>
          </button>
          <Link
            to="/admin"
            className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl backdrop-blur-md text-white border border-white/15 transition-all text-sm font-bold"
          >
            Quản trị
          </Link>
        </div>

        {/* 16:9 Scaled Card */}
        <div className="w-full max-w-6xl aspect-video max-h-[85vh] bg-white/[0.03] backdrop-blur-xl border-2 border-teal-500/30 rounded-[2.5rem] p-8 md:p-14 flex flex-col justify-between items-center text-center shadow-[0_0_80px_rgba(20,184,166,0.15)] relative">
          <div>
            <div className="inline-flex items-center gap-2 px-5 py-2 bg-teal-500/20 border border-teal-400/40 rounded-full text-teal-300 font-extrabold text-sm uppercase tracking-widest mb-4">
              <Sparkles className="w-4 h-4" /> Màn hình chiếu phòng học • Khung hình 16:9
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tight leading-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
              {quiz.title}
            </h1>
            <p className="text-slate-400 text-lg md:text-xl font-medium mt-3">
              Môn: <strong className="text-teal-400">{quiz.subject || 'KHTN'}</strong> • Tổng số: <strong className="text-white">{quiz.questions.length} câu hỏi</strong> • Thang điểm 10
            </p>
          </div>

          {/* Room PIN Code - High Visibility */}
          <div className="bg-black/40 border-2 border-teal-500/40 rounded-3xl p-6 md:p-8 flex flex-col items-center gap-3 w-full max-w-xl shadow-inner">
            <span className="text-sm md:text-base uppercase tracking-widest text-slate-300 font-bold">
              Mã phòng tham gia (Dành cho học sinh)
            </span>
            <div className="font-mono text-5xl md:text-7xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-emerald-300 to-green-400 select-all">
              {session.id.slice(-6).toUpperCase()}
            </div>
            <span className="text-xs text-slate-400">Học sinh vào trang "Vào thi" trên điện thoại/máy tính và nhập mã trên</span>
          </div>

          {/* Joined Players */}
          <div className="w-full">
            <div className="flex items-center justify-center gap-2 text-slate-300 text-lg font-bold mb-3">
              <Users className="w-6 h-6 text-teal-400" />
              <span>Đã tham gia ({players.length} học sinh):</span>
            </div>
            <div className="flex flex-wrap gap-2.5 max-w-4xl justify-center max-h-32 overflow-y-auto px-4 py-2">
              {players.length === 0 ? (
                <p className="text-slate-500 italic text-base">Chưa có học sinh nào vào phòng...</p>
              ) : (
                players.map(p => (
                  <span 
                    key={p.id} 
                    className="px-4 py-1.5 bg-teal-500/20 border border-teal-500/40 rounded-full font-bold text-white text-base shadow-sm animate-in zoom-in-75 duration-200"
                  >
                    {p.name}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Start Button */}
          <button 
            onClick={handleStart} 
            className="px-12 py-5 bg-gradient-to-r from-teal-400 to-emerald-500 hover:from-teal-300 hover:to-emerald-400 text-slate-950 text-2xl md:text-3xl font-black rounded-2xl shadow-[0_0_40px_rgba(20,184,166,0.6)] transition-all transform hover:scale-105 active:scale-95 flex items-center gap-4 cursor-pointer"
          >
            <Play className="w-8 h-8 fill-current" />
            BẮT ĐẦU BUỔI HỌC
          </button>
        </div>
      </div>
    );
  }

  // SUMMARY SCREEN (FINISHED) - 5-COLUMN FULL-SCREEN ANSWER MATRIX WITHOUT LEADERBOARD
  if (session.status === 'FINISHED') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 md:p-8 flex flex-col justify-between select-none">
        <div className="w-full max-w-[177.78vh] mx-auto space-y-5">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/80 border border-white/10 rounded-3xl p-5 md:p-6 backdrop-blur-md shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/20 border-2 border-teal-400/50 flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(45,212,191,0.25)]">
                <CheckCircle2 className="w-8 h-8 text-teal-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">BẢNG ĐÁP ÁN TOÀN BỘ ĐỀ THI</h1>
                <p className="text-slate-400 text-sm md:text-base">
                  {quiz.title} • {quiz.questions.length} câu hỏi • Thang điểm 10 GDPT
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAllAnswersInSummary(!showAllAnswersInSummary)}
                className={`px-5 py-2.5 md:py-3 rounded-2xl font-bold text-sm md:text-base flex items-center gap-2 transition-all shadow-lg cursor-pointer active:scale-95 ${
                  showAllAnswersInSummary
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 ring-4 ring-amber-400/30'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-4 ring-emerald-500/30'
                }`}
                title="Mở hoặc ẩn đáp án"
              >
                {showAllAnswersInSummary ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                <span>{showAllAnswersInSummary ? 'Ẩn đáp án' : 'Hiển thị đáp án'}</span>
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-2.5 md:p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold border border-white/10 transition-colors"
                title="Toàn màn hình máy chiếu"
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
              <Link
                to="/admin"
                className="px-5 py-2.5 md:py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-sm md:text-base flex items-center gap-2 transition-colors border border-white/10"
              >
                <Home className="w-5 h-5" /> Về Quản trị
              </Link>
            </div>
          </div>

          {/* Score Calculation Rule Banner */}
          {breakdown && (
            <div className="bg-gradient-to-r from-teal-950/80 via-slate-900 to-emerald-950/80 border border-teal-500/30 rounded-2xl p-3.5 text-center text-xs md:text-sm text-teal-200 font-semibold shadow-inner">
              ⭐ <strong>Quy chuẩn tính điểm GDPT (Thang 10):</strong> Đúng - Sai: 1.0 đ/câu (0.25 đ/ý) • Trả lời ngắn: 0.5 đ/câu • Trắc nghiệm 4 lựa chọn: {breakdown.mcScorePerQ > 0 ? breakdown.mcScorePerQ.toFixed(2) : '0'} đ/câu
            </div>
          )}

          {/* 5-COLUMN GRID DISPLAYING ALL ANSWERS ON ONE SCREEN */}
          <div className="bg-slate-900/70 border border-white/10 rounded-3xl p-4 md:p-6 backdrop-blur-md shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
                <span className="text-sm md:text-base font-bold text-slate-300">
                  Hiển thị toàn bộ {quiz.questions.length} câu hỏi theo 5 cột:
                </span>
              </div>
              <div className="text-xs font-semibold">
                {showAllAnswersInSummary ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                    Đang hiển thị đáp án
                  </span>
                ) : (
                  <span className="text-amber-400 font-bold flex items-center gap-1.5">
                    <EyeOff className="w-3.5 h-3.5" />
                    Đáp án đang ẩn (Mặc định)
                  </span>
                )}
              </div>
            </div>

            {/* 5 Columns Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3 max-h-[70vh] overflow-y-auto pr-1">
              {quiz.questions.map((q, i) => {
                const isTF = q.type === 'TF';
                const isMC = q.type === 'MC';
                const isSA = q.type === 'SA' || q.type === 'ESSAY';
                const pts = isTF ? '1.0đ' : isSA ? '0.5đ' : `${breakdown?.mcScorePerQ.toFixed(2) || '0.5'}đ`;

                return (
                  <div
                    key={q.id || i}
                    className={`p-3 rounded-2xl border transition-all flex flex-col justify-between gap-2 shadow-sm ${
                      showAllAnswersInSummary
                        ? isTF
                          ? 'bg-amber-950/30 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.12)]'
                          : 'bg-emerald-950/30 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.12)]'
                        : 'bg-slate-900/90 border-slate-700/60 hover:border-slate-500'
                    }`}
                  >
                    {/* Top Row: Question number + badge + points */}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-teal-500/20 border border-teal-500/40 text-teal-300 font-bold text-xs sm:text-sm font-mono">
                          Câu {i + 1}
                        </span>
                        <span className="text-[10px] font-extrabold uppercase text-slate-400">
                          {isMC ? 'MC' : isTF ? 'Đ/S' : 'TL'}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">
                        {pts}
                      </span>
                    </div>

                    {/* Answer Display Area */}
                    <div className="min-h-[2.5rem] flex items-center">
                      {!showAllAnswersInSummary ? (
                        <div className="w-full py-1 px-2 rounded-lg bg-white/5 border border-dashed border-white/10 flex items-center justify-center gap-1.5 text-slate-500 text-xs font-mono">
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>[Ẩn]</span>
                        </div>
                      ) : isTF ? (
                        <div className="w-full">
                          <div className="font-mono text-xs sm:text-sm font-black text-amber-300 tracking-wider leading-tight">
                            {formatTFAnswer(q.answer, i + 1)}
                          </div>
                        </div>
                      ) : isMC ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-medium">Đáp án:</span>
                          <span className="w-7 h-7 rounded-lg bg-emerald-400 text-slate-950 font-black font-mono text-base flex items-center justify-center shadow-md">
                            {q.answer}
                          </span>
                        </div>
                      ) : (
                        <div className="w-full">
                          <div className="font-mono text-xs font-bold text-emerald-300 truncate" title={q.answer}>
                            {q.answer}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="w-full max-w-[177.78vh] mx-auto mt-4 text-center text-xs text-slate-500">
          Chế độ toàn lớp học • Toàn bộ đáp án hiển thị 5 cột đồng bộ
        </div>
      </div>
    );
  }

  // ACTIVE QUESTION SCREEN (PROJECTOR OPTIMIZED 16:9 WITH WHITE-BORDERED NEON STEM & REFINED COLOR HARMONY)
  const currentQ = quiz.questions[session.currentQuestionIndex];
  const isTF = currentQ.type === 'TF';
  const isMC = currentQ.type === 'MC';
  const isSA = currentQ.type === 'SA' || currentQ.type === 'ESSAY';

  // Points for this question based on GDPT 2018 formula
  const currentQPoints = isTF 
    ? '1.0 điểm (0.25 đ/ý)' 
    : isSA 
    ? '0.5 điểm' 
    : `${breakdown?.mcScorePerQ.toFixed(2) || '0.5'} điểm`;

  // Parse TF answers
  const tfCorrectList = isTF ? parseTFAnswerList(currentQ.answer) : [];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 select-none">
      {/* 16:9 Aspect Ratio Projector Container */}
      <div className="w-full max-w-[177.78vh] aspect-video max-h-[96vh] bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-white/15 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Top Header Bar */}
        <div className="h-20 md:h-24 bg-black/50 border-b border-white/10 flex items-center justify-between px-6 md:px-10 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-teal-500/20 border-2 border-teal-400/40 text-teal-300 px-4 py-1.5 md:px-5 md:py-2 rounded-2xl font-black text-lg md:text-2xl flex items-center gap-2 shadow-[0_0_15px_rgba(45,212,191,0.2)]">
              <span>CÂU {session.currentQuestionIndex + 1} / {quiz.questions.length}</span>
            </div>
            <span className="hidden sm:inline-block px-3.5 py-1 bg-white/10 rounded-xl text-xs md:text-sm font-bold text-slate-300 border border-white/10">
              {isMC ? 'TRẮC NGHIỆM' : isTF ? 'ĐÚNG - SAI' : 'TRẢ LỜI NGẮN'} • {currentQPoints}
            </span>
          </div>

          {/* Action buttons & Timer */}
          <div className="flex items-center gap-3 md:gap-5">
            {/* Reveal Answer Button */}
            <button
              onClick={() => setShowAnswer(!showAnswer)}
              className={`px-4 py-2 md:px-6 md:py-3 rounded-2xl font-bold text-sm md:text-lg flex items-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 ${
                showAnswer 
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 ring-4 ring-amber-400/30' 
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-4 ring-emerald-500/30'
              }`}
              title="Nhấn để mở / ẩn đáp án câu hỏi"
            >
              {showAnswer ? <EyeOff className="w-5 h-5 md:w-6 md:h-6" /> : <Eye className="w-5 h-5 md:w-6 md:h-6" />}
              <span>{showAnswer ? 'Ẩn đáp án' : 'Hiển thị đáp án'}</span>
            </button>

            {/* Next question */}
            <button
              onClick={handleNextQuestion}
              className="px-4 py-2 md:px-6 md:py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-sm md:text-lg flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <span>{session.currentQuestionIndex < quiz.questions.length - 1 ? 'Câu tiếp' : 'Tổng kết'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            {/* Timer countdown */}
            <div 
              onClick={() => setIsTimerPaused(!isTimerPaused)}
              className={`flex items-center gap-2 md:gap-3 px-4 py-1.5 md:px-6 md:py-2 rounded-2xl font-black text-2xl md:text-4xl border-2 cursor-pointer transition-all ${
                timeLeft <= 10 
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500 animate-pulse' 
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/15'
              }`}
              title="Nhấn để tạm dừng / tiếp tục đếm ngược"
            >
              <Clock className="w-6 h-6 md:w-8 md:h-8" />
              <span className="w-12 md:w-16 text-center font-mono font-black">{timeLeft}</span>
              {isTimerPaused && <span className="text-xs bg-amber-400 text-black px-1.5 py-0.5 rounded font-bold uppercase">Tạm dừng</span>}
            </div>

            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-2 md:p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl border border-white/15 transition-all"
              title="Toàn màn hình máy chiếu"
            >
              {isFullscreen ? <Minimize className="w-5 h-5 md:w-6 md:h-6" /> : <Maximize className="w-5 h-5 md:w-6 md:h-6" />}
            </button>
          </div>
        </div>

        {/* Question Area - High Contrast, Optimized Color Harmony */}
        <div className="flex-1 p-6 md:p-10 flex flex-col justify-between overflow-y-auto">
          {/* Question Text with White Border and Subtle Neon Glow */}
          <div className="space-y-4">
            <div className="relative rounded-3xl border-2 border-white/90 bg-slate-900/90 p-5 md:p-7 shadow-[0_0_16px_rgba(255,255,255,0.3),0_0_35px_rgba(45,212,191,0.18)] backdrop-blur-md">
              <div 
                id="question-content" 
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-snug tracking-tight whitespace-pre-wrap drop-shadow-md"
              >
                {currentQ.content}
              </div>
            </div>

            {/* ANSWER REVEAL BANNER (If showAnswer is on) */}
            {showAnswer && isTF && (
              <div 
                id="revealed-answer-box" 
                className="p-4 md:p-6 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-emerald-500/20 border-2 border-yellow-400/80 rounded-2xl shadow-[0_0_30px_rgba(250,204,21,0.3)] animate-in fade-in zoom-in-95 duration-300"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-yellow-400 text-slate-950 font-black rounded-lg text-sm uppercase">
                      ĐÁP ÁN CHÍNH THỨC
                    </span>
                    <span className="font-mono text-2xl md:text-4xl font-black text-yellow-300 tracking-wider">
                      {formatTFAnswer(currentQ.answer, session.currentQuestionIndex + 1)}
                    </span>
                  </div>
                  <span className="text-xs md:text-sm font-bold text-slate-300">
                    Mỗi ý đúng: 0.25 điểm • 4 ý: 1.0 điểm
                  </span>
                </div>
              </div>
            )}

            {showAnswer && (isSA || isMC) && (
              <div 
                id="revealed-answer-box" 
                className="p-4 md:p-6 bg-emerald-500/20 border-2 border-emerald-400 rounded-2xl shadow-[0_0_30px_rgba(52,211,153,0.3)] animate-in fade-in zoom-in-95 duration-300 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <CheckCircle2 className="w-8 h-8 md:w-10 md:h-10 text-emerald-400 flex-shrink-0" />
                  <div>
                    <span className="text-xs md:text-sm font-bold uppercase text-emerald-300 tracking-wider">
                      ĐÁP ÁN ĐÚNG
                    </span>
                    <div className="text-2xl md:text-4xl font-black text-white font-mono">
                      {isMC ? `LỰA CHỌN ${currentQ.answer}` : currentQ.answer}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Options: 4 Multiple Choice (MC) with Optimized Colors */}
          {isMC && currentQ.options && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 mt-6 md:mt-8">
              {currentQ.options.map((opt, i) => {
                const letter = ['A', 'B', 'C', 'D'][i];
                const isCorrect = showAnswer && (currentQ.answer === letter || opt.trim().toLowerCase() === (currentQ.answer || '').trim().toLowerCase());
                const isOther = showAnswer && !isCorrect;

                // Distinct, balanced palette: A: Indigo/Blue, B: Emerald/Teal, C: Amber, D: Rose
                const optionThemes = [
                  { border: 'border-blue-500/40', badge: 'bg-blue-500 text-white', hover: 'hover:border-blue-400 hover:bg-blue-950/30' },
                  { border: 'border-teal-500/40', badge: 'bg-teal-500 text-white', hover: 'hover:border-teal-400 hover:bg-teal-950/30' },
                  { border: 'border-amber-500/40', badge: 'bg-amber-500 text-slate-950', hover: 'hover:border-amber-400 hover:bg-amber-950/30' },
                  { border: 'border-rose-500/40', badge: 'bg-rose-500 text-white', hover: 'hover:border-rose-400 hover:bg-rose-950/30' },
                ];
                const theme = optionThemes[i] || optionThemes[0];

                return (
                  <div 
                    key={i} 
                    className={`rounded-2xl md:rounded-3xl p-4 md:p-6 border-2 transition-all flex items-center gap-4 md:gap-5 shadow-lg relative overflow-hidden ${
                      isCorrect 
                        ? 'bg-gradient-to-r from-emerald-600/90 to-green-700/90 border-yellow-300 ring-4 ring-yellow-300/60 scale-[1.02] shadow-[0_0_35px_rgba(16,185,129,0.5)] z-10' 
                        : isOther 
                        ? 'bg-slate-900/40 border-white/5 opacity-30 grayscale-[50%]' 
                        : `bg-slate-800/90 ${theme.border} ${theme.hover}`
                    }`}
                  >
                    {/* Letter badge */}
                    <div className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center font-black text-2xl md:text-3xl flex-shrink-0 shadow-md ${
                      isCorrect ? 'bg-yellow-300 text-slate-950' : theme.badge
                    }`}>
                      {letter}
                    </div>

                    {/* Option Text */}
                    <div className="flex-1 text-xl sm:text-2xl md:text-3xl font-bold leading-normal text-white">
                      {opt}
                    </div>

                    {/* Checkmark when answer is revealed */}
                    {isCorrect && (
                      <div className="flex-shrink-0 px-3 py-1.5 bg-yellow-300 text-slate-950 font-black rounded-xl text-xs md:text-sm uppercase tracking-wider flex items-center gap-1 shadow-lg">
                        <CheckCircle2 className="w-4 h-4" /> ĐÚNG
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Options: True - False (TF) Statements with Optimized Colors */}
          {isTF && currentQ.options && (
            <div className="space-y-3 md:space-y-4 mt-6 md:mt-8">
              {currentQ.options.map((opt, i) => {
                const letter = ['a', 'b', 'c', 'd'][i];
                const correctVal = tfCorrectList[i] ? normalizeTFChar(tfCorrectList[i]) : 'Đ';
                const isTrue = correctVal === 'Đ';

                return (
                  <div 
                    key={i} 
                    className={`rounded-2xl p-3.5 md:p-5 border-2 transition-all flex items-center justify-between gap-4 shadow-md ${
                      showAnswer 
                        ? isTrue 
                          ? 'bg-emerald-950/60 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]' 
                          : 'bg-rose-950/60 border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.25)]'
                        : 'bg-slate-800/80 border-slate-700/80 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <span className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center font-black text-xl md:text-2xl flex-shrink-0 shadow-md ${
                        showAnswer 
                          ? isTrue 
                            ? 'bg-emerald-500 text-slate-950' 
                            : 'bg-rose-500 text-white' 
                          : 'bg-white/10 text-slate-200'
                      }`}>
                        {letter}
                      </span>
                      <span className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold text-white leading-normal">
                        {opt}
                      </span>
                    </div>

                    {/* Answer Badge */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {showAnswer ? (
                        <div className={`px-5 py-2 md:px-7 md:py-3 rounded-xl md:rounded-2xl font-black text-lg md:text-2xl uppercase tracking-wider shadow-lg flex items-center gap-2 ${
                          isTrue 
                            ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-400/40' 
                            : 'bg-rose-600 text-white ring-4 ring-rose-500/40'
                        }`}>
                          {isTrue ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                          <span>{letter}) {correctVal} ({isTrue ? 'ĐÚNG' : 'SAI'})</span>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <span className="px-3.5 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs md:text-sm font-bold text-slate-400">
                            Đúng
                          </span>
                          <span className="px-3.5 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs md:text-sm font-bold text-slate-400">
                            Sai
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Options: Short Answer / Essay */}
          {isSA && (
            <div className="mt-6 md:mt-8 p-6 md:p-8 bg-slate-900/60 border-2 border-dashed border-white/20 rounded-3xl text-center">
              <p className="text-slate-300 text-lg md:text-xl font-medium">
                Học sinh đang nhập câu trả lời trực tiếp trên thiết bị cá nhân...
              </p>
              {!showAnswer && (
                <p className="text-teal-400 text-sm md:text-base font-bold mt-2">
                  Nhấn "Hiển thị đáp án" ở góc trên để chiếu đáp án mẫu cho cả lớp.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Bottom Status Ticker */}
        <div className="h-12 bg-black/60 border-t border-white/10 px-8 flex items-center justify-between text-xs md:text-sm text-slate-400 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-400" />
            <span>Học sinh trong phòng: <strong className="text-white">{players.length}</strong></span>
          </div>
          <div className="flex items-center gap-6">
            <span>Phòng: <strong className="text-teal-300 font-mono">{session.id.slice(-6).toUpperCase()}</strong></span>
            <span>Khung chiếu 16:9 • Chế độ toàn lớp học</span>
          </div>
        </div>

      </div>
    </div>
  );
}
